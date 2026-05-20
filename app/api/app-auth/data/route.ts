import { requireBearerDbRoles } from '@/lib/auth-server';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { getLeaderAreas } from '@/lib/teaching-leaders';
import { NextRequest, NextResponse } from 'next/server';

/** null = chưa kiểm tra; migration V53 thêm cột areas */
let teachingLeadersHasAreasColumn: boolean | null = null;

async function getTeachingLeadersHasAreasColumn(): Promise<boolean> {
    if (teachingLeadersHasAreasColumn !== null) return teachingLeadersHasAreasColumn;
    try {
        const r = await pool.query(
            `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'teaching_leaders' AND column_name = 'areas'
       LIMIT 1`,
        );
        teachingLeadersHasAreasColumn = (r.rowCount ?? 0) > 0;
    } catch {
        teachingLeadersHasAreasColumn = false;
    }
    return teachingLeadersHasAreasColumn;
}

async function syncTeachingLeaderAppUser(email: string | null, displayName: string | null, status: string | undefined) {
    if (!email?.trim()) return;
    const normalizedEmail = email.trim().toLowerCase();
    const isActive = status !== 'Deactive';

    // Get role_code from teaching_leaders
    const leaderResult = await pool.query('SELECT role_code FROM teaching_leaders WHERE LOWER(TRIM(email)) = $1', [normalizedEmail]);
    const roleCode = leaderResult.rows[0]?.role_code;

    // Insert/update app_users
    const userResult = await pool.query(
        `INSERT INTO app_users (email, display_name, role, auth_type, is_active, created_by)
         VALUES ($1, $2, 'manager', 'firebase', $3, 'teaching_leaders-sync')
         ON CONFLICT (email) DO UPDATE SET
           display_name = COALESCE(app_users.display_name, EXCLUDED.display_name),
                     role = 'manager',
           auth_type = COALESCE(app_users.auth_type, EXCLUDED.auth_type),
                     is_active = EXCLUDED.is_active
         RETURNING id`,
        [normalizedEmail, displayName || null, isActive],
    );

    const userId = userResult.rows[0].id;

    // Assign role if exists
    if (roleCode) {
        await pool.query(
            `INSERT INTO user_roles (user_id, role_code)
             VALUES ($1, $2)
             ON CONFLICT (user_id, role_code) DO NOTHING`,
            [userId, roleCode],
        );
    }
}

function normalizeLeaderRows(rows: Record<string, unknown>[]) {
    return rows.map((r) => ({
        ...r,
        areas: getLeaderAreas(r as { area?: string | null; areas?: unknown }),
    }));
}

// GET: list with filters
export async function GET(request: NextRequest) {
    try {
        const auth = await requireBearerSession(request);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const table = searchParams.get('table') || 'teaching_leaders';
        const status = searchParams.get('status'); // Active, Deactive
        const search = searchParams.get('search');
        const area = searchParams.get('area');
        const roleCode = searchParams.get('roleCode');

        const hasAreasCol =
            table === 'teaching_leaders' ? await getTeachingLeadersHasAreasColumn() : false;

        let query = ''; const params: any[] = []; let idx = 1;

        if (table === 'teaching_leaders') {
            query = 'SELECT * FROM teaching_leaders WHERE 1=1';
            if (status) { query += ` AND status = $${idx++}`; params.push(status); }
            if (area) {
                if (hasAreasCol) {
                    query += ` AND (area = $${idx} OR COALESCE(areas, '[]'::jsonb) @> jsonb_build_array($${idx}::text))`;
                    params.push(area);
                    idx++;
                } else {
                    query += ` AND (trim(coalesce(area, '')) = $${idx} OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(coalesce(area, ''), ',')) AS p(x)
            WHERE trim(x) = $${idx}
          ))`;
                    params.push(area);
                    idx++;
                }
            }
            if (roleCode) { query += ` AND role_code = $${idx++}`; params.push(roleCode); }
            if (search) { query += ` AND (full_name ILIKE $${idx} OR code ILIKE $${idx} OR center ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
            query += ' ORDER BY status ASC, full_name ASC';
        } else if (table === 'centers') {
            query = 'SELECT * FROM centers WHERE 1=1';
            if (status) { query += ` AND status = $${idx++}`; params.push(status); }
            if (search) { query += ` AND (full_name ILIKE $${idx} OR display_name ILIKE $${idx} OR region ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
            query += ' ORDER BY region, full_name';
        } else if (table === 'roles') {
            query = 'SELECT r.*, COUNT(tl.code)::int as leader_count FROM roles r LEFT JOIN teaching_leaders tl ON tl.role_code = r.role_code GROUP BY r.role_code ORDER BY r.department, r.role_name';
        }

        const result = await pool.query(query, params);

        // Get unique areas and role_codes for filters
        let filters: any = {};
        if (table === 'teaching_leaders') {
            const areasF = hasAreasCol
                ? await pool.query(`
                SELECT DISTINCT trim(x) AS area FROM (
                  SELECT area AS x FROM teaching_leaders WHERE area IS NOT NULL AND trim(area) <> ''
                  UNION ALL
                  SELECT jsonb_array_elements_text(areas) AS x FROM teaching_leaders
                    WHERE areas IS NOT NULL AND jsonb_typeof(areas) = 'array' AND jsonb_array_length(areas) > 0
                ) u WHERE trim(x) <> ''
                ORDER BY area
            `)
                : await pool.query(`
                SELECT DISTINCT trim(x) AS area FROM (
                  SELECT unnest(string_to_array(coalesce(area, ''), ',')) AS x
                  FROM teaching_leaders
                  WHERE area IS NOT NULL AND trim(area) <> ''
                ) u WHERE trim(x) <> ''
                ORDER BY area
            `);
            const rolesF = await pool.query(
                'SELECT role_code, role_name FROM roles ORDER BY department, role_name'
            );
            const statusF = await pool.query('SELECT DISTINCT status FROM teaching_leaders ORDER BY status');
            const coursesF = await pool.query('SELECT DISTINCT courses FROM teaching_leaders WHERE courses IS NOT NULL ORDER BY courses');
            filters = {
                areas: areasF.rows.map((r: any) => r.area),
                roleCodes: rolesF.rows,
                statuses: statusF.rows.map((r: any) => r.status),
                courses: coursesF.rows.map((r: any) => r.courses),
            };
        }

        const rows =
            table === 'teaching_leaders'
                ? normalizeLeaderRows(result.rows as Record<string, unknown>[])
                : result.rows;

        return NextResponse.json({ rows, total: result.rowCount, filters });
    } catch (error: any) {
        console.error('Data API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create
export async function POST(request: NextRequest) {
    try {
        const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!gate.ok) return gate.response;

        const body = await request.json();
        const { table, ...data } = body;

        if (table === 'centers') {
            const row = data as Record<string, unknown>;
            const full_name = String(row.full_name ?? '').trim();
            const short_code = String(row.short_code ?? '').trim();
            if (!full_name || !short_code) {
                return NextResponse.json(
                    { error: 'full_name và short_code là bắt buộc' },
                    { status: 400 },
                );
            }
            const display_name = String(row.display_name ?? '').trim() || full_name;
            const regionRaw = row.region != null ? String(row.region).trim() : '';
            const region = regionRaw ? regionRaw : null;
            const emailRaw = row.email != null ? String(row.email).trim() : '';
            const email = emailRaw ? emailRaw : null;
            const status = String(row.status ?? 'Active').trim() || 'Active';
            try {
                await pool.query(
                    `INSERT INTO centers (full_name, short_code, display_name, region, email, status)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [full_name, short_code, display_name, region, email, status],
                );
            } catch (e: unknown) {
                const err = e as { code?: string };
                if (err.code === '23505') {
                    return NextResponse.json(
                        { error: 'Mã cơ sở (short_code) đã tồn tại. Chọn mã khác.' },
                        { status: 409 },
                    );
                }
                throw e;
            }
            return NextResponse.json({ success: true });
        }

        if (table === 'teaching_leaders') {
            const { code, full_name, email, role_code, role_name, center, courses, area, areas, status } = data;
            const areasList: string[] = Array.isArray(areas)
                ? areas.map(String).map((s: string) => s.trim()).filter(Boolean)
                : area != null && String(area).trim()
                  ? String(area).split(',').map((s) => s.trim()).filter(Boolean)
                  : [];
            const primaryArea = areasList[0] ?? null;
            const hasAreas = await getTeachingLeadersHasAreasColumn();
            const areaLegacy =
                areasList.length > 1 ? areasList.join(', ') : primaryArea;

            if (hasAreas) {
                await pool.query(
                    `INSERT INTO teaching_leaders (code, full_name, email, role_code, role_name, center, courses, area, areas, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT (code) DO UPDATE SET
         full_name=EXCLUDED.full_name, email=EXCLUDED.email, role_code=EXCLUDED.role_code, role_name=EXCLUDED.role_name,
         center=EXCLUDED.center, courses=EXCLUDED.courses, area=EXCLUDED.area, areas=EXCLUDED.areas, status=EXCLUDED.status`,
                    [code, full_name, email || null, role_code, role_name, center, courses || null, primaryArea, JSON.stringify(areasList), status || 'Active'],
                );
            } else {
                await pool.query(
                    `INSERT INTO teaching_leaders (code, full_name, email, role_code, role_name, center, courses, area, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO UPDATE SET
         full_name=EXCLUDED.full_name, email=EXCLUDED.email, role_code=EXCLUDED.role_code, role_name=EXCLUDED.role_name,
         center=EXCLUDED.center, courses=EXCLUDED.courses, area=EXCLUDED.area, status=EXCLUDED.status`,
                    [code, full_name, email || null, role_code, role_name, center, courses || null, areaLegacy, status || 'Active'],
                );
            }
            await syncTeachingLeaderAppUser(email || null, full_name || null, status);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Table not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update
export async function PUT(request: NextRequest) {
    try {
        const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!gate.ok) return gate.response;

        const body = await request.json();
        const { table, ...data } = body;

        if (table === 'teaching_leaders') {
            const { code, full_name, email, role_code, role_name, center, courses, area, areas, status } = data;
            const areasList: string[] = Array.isArray(areas)
                ? areas.map(String).map((s: string) => s.trim()).filter(Boolean)
                : area != null && String(area).trim()
                  ? String(area).split(',').map((s) => s.trim()).filter(Boolean)
                  : [];
            const primaryArea = areasList[0] ?? null;
            const hasAreas = await getTeachingLeadersHasAreasColumn();
            const areaLegacy =
                areasList.length > 1 ? areasList.join(', ') : primaryArea;

            if (hasAreas) {
                await pool.query(
                    `UPDATE teaching_leaders SET full_name=$2, email=$3, role_code=$4, role_name=$5, center=$6, courses=$7, area=$8, areas=$9::jsonb, status=$10 WHERE code=$1`,
                    [code, full_name, email || null, role_code, role_name, center, courses || null, primaryArea, JSON.stringify(areasList), status],
                );
            } else {
                await pool.query(
                    `UPDATE teaching_leaders SET full_name=$2, email=$3, role_code=$4, role_name=$5, center=$6, courses=$7, area=$8, status=$9 WHERE code=$1`,
                    [code, full_name, email || null, role_code, role_name, center, courses || null, areaLegacy, status],
                );
            }
            await syncTeachingLeaderAppUser(email || null, full_name || null, status);
            return NextResponse.json({ success: true });
        }

        if (table === 'teaching_leaders_status') {
            const { code, status } = data;
            await pool.query('UPDATE teaching_leaders SET status=$2 WHERE code=$1', [code, status]);
            return NextResponse.json({ success: true });
        }

        if (table === 'teaching_leaders_center') {
            const { code, center } = data as { code?: string; center?: string };
            if (!code) {
                return NextResponse.json({ error: 'Missing code' }, { status: 400 });
            }
            await pool.query('UPDATE teaching_leaders SET center=$2 WHERE code=$1', [
                code,
                center ?? '',
            ]);
            return NextResponse.json({ success: true });
        }

        if (table === 'teaching_leaders_areas') {
            const { code, areas } = data as { code?: string; areas?: unknown };
            if (!code) {
                return NextResponse.json({ error: 'Missing code' }, { status: 400 });
            }
            const areasList: string[] = Array.isArray(areas)
                ? areas.map(String).map((s: string) => s.trim()).filter(Boolean)
                : [];
            const primaryArea = areasList[0] ?? '';
            const hasAreas = await getTeachingLeadersHasAreasColumn();
            const areaLegacy =
                areasList.length > 1 ? areasList.join(', ') : primaryArea;
            if (hasAreas) {
                await pool.query(
                    `UPDATE teaching_leaders SET area=$2, areas=$3::jsonb WHERE code=$1`,
                    [code, primaryArea || null, JSON.stringify(areasList)],
                );
            } else {
                await pool.query(
                    `UPDATE teaching_leaders SET area=$2 WHERE code=$1`,
                    [code, areaLegacy || null],
                );
            }
            return NextResponse.json({ success: true });
        }

        if (table === 'centers_region') {
            const { id, region, email } = data as { id?: number; region?: string; email?: string };
            if (id == null || Number.isNaN(Number(id))) {
                return NextResponse.json({ error: 'Missing id' }, { status: 400 });
            }
            await pool.query('UPDATE centers SET region=$2, email=$3 WHERE id=$1', [
                id,
                region ?? '',
                email?.trim() ? email.trim() : null,
            ]);
            return NextResponse.json({ success: true });
        }

        if (table === 'centers_status') {
            const { id, status } = data;
            await pool.query('UPDATE centers SET status=$2 WHERE id=$1', [id, status]);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Table not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: NextRequest) {
    try {
        const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!gate.ok) return gate.response;

        const { searchParams } = new URL(request.url);
        const table = searchParams.get('table');
        const code = searchParams.get('code');

        if (table === 'teaching_leaders' && code) {
            await pool.query('DELETE FROM teaching_leaders WHERE code=$1', [code]);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
