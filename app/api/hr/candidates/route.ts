import { requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HR_PERMISSION_ROUTE = '/admin/hr-candidates';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

const SOUTH_REGION_CODES = ['1', '3'];
const NORTH_REGION_CODES = ['2', '4', '5'];

function normalizeValue(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normalizeRegionCode(value: string): '1' | '2' | '3' | '4' | '5' | null {
  const n = normalizeValue(value);
  if (['1', '2', '3', '4', '5'].includes(n)) return n as '1' | '2' | '3' | '4' | '5';
  return null;
}

function resolveRegionCodes(regionFilter: string): string[] | null {
  const n = normalizeValue(regionFilter).toLowerCase();
  if (!n || n === 'all') return null;
  if (n === 'south') return SOUTH_REGION_CODES;
  if (n === 'north') return NORTH_REGION_CODES;
  const single = normalizeRegionCode(n);
  return single ? [single] : null;
}

function parsePageParam(input: string | null, fallback: number) {
  if (!input) return fallback;
  const parsed = Number(input);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.floor(parsed);
}

async function validateHrAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const userResult = await pool.query(
    `SELECT id, role, is_active FROM app_users WHERE email = $1 LIMIT 1`,
    [requestEmail]
  );
  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    return { ok: false, status: 403, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' };
  }
  const user = userResult.rows[0] as { id: number; role: string };
  if (user.role === 'super_admin') return { ok: true, status: 200 };

  const permissionResult = await pool.query(
    `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true
     UNION
     SELECT rp.route_path FROM user_roles ur JOIN role_permissions rp ON rp.role_code = ur.role_code WHERE ur.user_id = $1`,
    [user.id]
  );
  const permissions = permissionResult.rows.map((r: { route_path: string }) => r.route_path);
  const hasAccess = permissions.some(p => p === HR_PERMISSION_ROUTE || HR_PERMISSION_ROUTE.startsWith(`${p}/`));
  if (!hasAccess) return { ok: false, status: 403, message: 'Bạn không có quyền truy cập module HR.' };
  return { ok: true, status: 200 };
}

// ─── GET: Danh sách ứng viên từ database ─────────────────────────────────────
const handleGet = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

    const sp = request.nextUrl.searchParams;
    const statusFilter = normalizeValue(sp.get('status')) || 'all';
    const search = normalizeValue(sp.get('search'));
    const genFilter = normalizeValue(sp.get('gen'));
    const regionFilter = normalizeValue(sp.get('region'));
    const page = parsePageParam(sp.get('page'), 1);
    const pageSize = Math.min(parsePageParam(sp.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const selectedRegionCodes = resolveRegionCodes(regionFilter);

    // Build WHERE conditions
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    // Status filter
    if (statusFilter === 'assigned') {
      conditions.push(`c.gen_id IS NOT NULL`);
    } else if (statusFilter === 'unassigned') {
      conditions.push(`c.gen_id IS NULL`);
    }
    // 'missing-sheet-gen' và 'manual-assigned' không còn ý nghĩa với DB — bỏ qua

    // Gen filter
    if (genFilter && genFilter !== 'all' && genFilter !== '__unassigned__') {
      conditions.push(`g.gen_name = $${idx++}`);
      params.push(genFilter);
    } else if (genFilter === '__unassigned__') {
      conditions.push(`c.gen_id IS NULL`);
    }

    // Region filter
    if (selectedRegionCodes && selectedRegionCodes.length > 0) {
      conditions.push(`c.region_code = ANY($${idx++}::text[])`);
      params.push(selectedRegionCodes);
    }

    // Search
    if (search) {
      const q = `%${search}%`;
      conditions.push(`(c.full_name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`);
      params.push(q); idx++;
    }

    const where = conditions.join(' AND ');

    const [rowsResult, countResult, summaryResult, gensResult] = await Promise.all([
      pool.query(
        `SELECT c.id, c.full_name, c.email, c.phone, c.region_code, c.desired_campus,
                c.work_block, c.subject_code, c.gen_id, c.status, c.source,
                c.created_by_email, c.updated_by_email, c.created_at, c.updated_at,
                g.gen_name
         FROM hr_candidates c
         LEFT JOIN hr_gen_catalog g ON g.id = c.gen_id
         WHERE ${where}
         ORDER BY c.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pageSize, (page - 1) * pageSize]
      ),
      pool.query(
        `SELECT COUNT(*) FROM hr_candidates c LEFT JOIN hr_gen_catalog g ON g.id = c.gen_id WHERE ${where}`,
        params
      ),
      pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE c.gen_id IS NOT NULL) AS assigned,
           COUNT(*) FILTER (WHERE c.gen_id IS NULL) AS unassigned,
           COUNT(*) FILTER (WHERE c.region_code = '1') AS r1,
           COUNT(*) FILTER (WHERE c.region_code = '2') AS r2,
           COUNT(*) FILTER (WHERE c.region_code = '3') AS r3,
           COUNT(*) FILTER (WHERE c.region_code = '4') AS r4,
           COUNT(*) FILTER (WHERE c.region_code = '5') AS r5
         FROM hr_candidates c`
      ),
      pool.query(`SELECT id, gen_name FROM hr_gen_catalog WHERE is_active = true ORDER BY gen_name ASC`),
    ]);

    const total = parseInt(countResult.rows[0].count);
    const s = summaryResult.rows[0];

    // Build byGen from rows
    const byGen: Record<string, number> = {};
    for (const row of rowsResult.rows) {
      const gen = row.gen_name || 'Chưa xếp GEN';
      byGen[gen] = (byGen[gen] || 0) + 1;
    }

    // Map rows to HrCandidateRow shape
    const rows = rowsResult.rows.map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone || '',
      region_code: r.region_code || '',
      desired_campus: r.desired_campus || '',
      work_block: r.work_block || '',
      subject_code: r.subject_code || '',
      gen_id: r.gen_id,
      gen_name: r.gen_name || '',
      status: r.status,
      source: r.source,
      created_by_email: r.created_by_email,
      updated_by_email: r.updated_by_email,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        total: parseInt(s.total),
        assigned: parseInt(s.assigned),
        unassigned: parseInt(s.unassigned),
        byGen,
        byRegion: {
          '1': parseInt(s.r1),
          '2': parseInt(s.r2),
          '3': parseInt(s.r3),
          '4': parseInt(s.r4),
          '5': parseInt(s.r5),
        },
      },
      availableGens: gensResult.rows.map((r: any) => r.gen_name),
    });
  } catch (error) {
    console.error('HR candidates GET error:', error);
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 });
  }
};

// ─── POST: Gán GEN cho ứng viên ──────────────────────────────────────────────
const handlePost = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

    const body = await request.json();
    const candidateId = Number(body.candidateId);
    const genName = normalizeValue(body.assignedGen).toUpperCase();

    if (!candidateId || !genName) {
      return NextResponse.json({ error: 'candidateId và assignedGen là bắt buộc.' }, { status: 400 });
    }

    // Lookup gen_id từ catalog
    const genResult = await pool.query(
      `INSERT INTO hr_gen_catalog (gen_name, source, created_by_email, is_active)
       VALUES ($1, 'manual', $2, true)
       ON CONFLICT (gen_name) DO UPDATE SET is_active = true, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [genName, auth.sessionEmail]
    );
    const genId = genResult.rows[0].id;

    const result = await pool.query(
      `UPDATE hr_candidates SET gen_id = $1, updated_by_email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [genId, auth.sessionEmail, candidateId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy ứng viên.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, candidate: result.rows[0] });
  } catch (error) {
    console.error('HR candidates POST error:', error);
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 });
  }
};

// ─── DELETE: Bỏ gán GEN ──────────────────────────────────────────────────────
const handleDelete = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

    const candidateId = Number(request.nextUrl.searchParams.get('candidateId'));
    if (!candidateId) return NextResponse.json({ error: 'candidateId là bắt buộc.' }, { status: 400 });

    await pool.query(
      `UPDATE hr_candidates SET gen_id = NULL, updated_by_email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [auth.sessionEmail, candidateId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('HR candidates DELETE error:', error);
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 });
  }
};

export const GET = withApiProtection(handleGet);
export const POST = withApiProtection(handlePost);
export const DELETE = withApiProtection(handleDelete);
