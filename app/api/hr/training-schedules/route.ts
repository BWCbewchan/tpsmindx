import { withApiProtection } from '@/lib/api-protection';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';

type RegionGroup = 'south' | 'north' | 'all';

const SOUTH_REGION_CODES = ['1', '3'];
const NORTH_REGION_CODES = ['2', '4', '5'];
const HR_PERMISSION_ROUTE = '/admin/hr-candidates';

function normalizeValue(input: unknown): string {
  if (typeof input !== 'string' && typeof input !== 'number') return '';
  return String(input).trim();
}

function normalizeTime(input: unknown): string | null {
  const value = normalizeValue(input);
  if (!value) return null;
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function normalizeDate(input: unknown): string | null {
  const value = normalizeValue(input);
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeTrainingMode(input: unknown): 'offline' | 'online' {
  return normalizeValue(input).toLowerCase() === 'online' ? 'online' : 'offline';
}

function resolveRegionCodes(region: string): string[] | null {
  const normalized = region.toLowerCase() as RegionGroup;
  if (normalized === 'south') return SOUTH_REGION_CODES;
  if (normalized === 'north') return NORTH_REGION_CODES;
  return null;
}

async function validateHrAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const userResult = await pool.query(
    `SELECT id, role, is_active
     FROM app_users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [requestEmail]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    return { ok: false, status: 403, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' };
  }

  const user = userResult.rows[0] as { id: number; role: string };
  if (user.role === 'super_admin') return { ok: true, status: 200 };

  const rolesResult = await pool.query(
    `SELECT role_code
     FROM user_roles
     WHERE user_id = $1`,
    [user.id]
  );

  const hasTrainingInputRole = rolesResult.rows.some((row: { role_code: string }) => {
    const roleCode = normalizeValue(row.role_code).toUpperCase();
    return roleCode === 'HR' || roleCode === 'TE' || roleCode === 'TF';
  });

  if (hasTrainingInputRole) return { ok: true, status: 200 };

  const permissionResult = await pool.query(
    `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true
     UNION
     SELECT rp.route_path
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_code = ur.role_code
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const permissions = permissionResult.rows.map((row: { route_path: string }) => row.route_path);
  const hasAccess = permissions.some(
    (routePath) =>
      routePath === HR_PERMISSION_ROUTE ||
      HR_PERMISSION_ROUTE.startsWith(`${routePath}/`) ||
      routePath.startsWith(`${HR_PERMISSION_ROUTE}/`)
  );

  return hasAccess
    ? { ok: true, status: 200 }
    : { ok: false, status: 403, message: 'Bạn không có quyền truy cập module đào tạo đầu vào.' };
}

async function resolveGenId(genId: unknown, genName: unknown): Promise<number | null> {
  const parsedId = Number(genId);
  if (Number.isInteger(parsedId) && parsedId > 0) return parsedId;

  const normalizedGenName = normalizeValue(genName).toUpperCase();
  if (!normalizedGenName) return null;

  const result = await pool.query(
    `SELECT id
     FROM hr_gen_catalog
     WHERE UPPER(gen_name) = $1 AND is_active = true
     LIMIT 1`,
    [normalizedGenName]
  );

  return result.rows[0]?.id ?? null;
}

async function getReferenceData() {
  const [centersResult, mentorsResult] = await Promise.all([
    pool.query(
      `SELECT
         id,
         short_code,
         full_name,
         display_name,
         region,
         status,
         COALESCE(map_url, map_link) AS map_url,
         COALESCE(full_address, address) AS address
       FROM centers
       WHERE COALESCE(status, 'Active') = 'Active'
       ORDER BY region NULLS LAST, COALESCE(display_name, full_name), full_name`
    ),
    pool.query(
      `SELECT code, full_name, email, role_code, role_name, center, area, status
       FROM teaching_leaders
       WHERE COALESCE(status, 'Active') = 'Active'
         AND (
           UPPER(COALESCE(role_code, '')) IN ('TE', 'TF', 'LEADER')
           OR LOWER(COALESCE(role_name, '')) LIKE '%leader%'
           OR LOWER(COALESCE(role_name, '')) LIKE '%te%'
         )
       ORDER BY full_name ASC`
    ),
  ]);

  return {
    centers: centersResult.rows,
    mentors: mentorsResult.rows,
  };
}

function mapScheduleRow(row: Record<string, unknown>) {
  const startTime = normalizeValue(row.start_time).slice(0, 5) || '18:30';
  const endTime = normalizeValue(row.end_time).slice(0, 5) || '21:00';
  const centerName = normalizeValue(row.center_display_name) || normalizeValue(row.center_full_name);
  const location = normalizeValue(row.location) || centerName;
  const session = Number(row.session_number) || 1;

  return {
    id: row.id,
    genId: row.gen_id,
    gen: row.gen_name,
    region: row.region_label || '',
    session,
    title: row.title,
    date: row.session_date,
    startTime,
    endTime,
    time: `${startTime} - ${endTime}`,
    centerId: row.center_id,
    centerName,
    centerMapUrl: row.center_map_url,
    centerAddress: row.center_address,
    location,
    mentorCode: row.mentor_code,
    mentorName: row.mentor_name,
    mentorEmail: row.mentor_email,
    trainingMode: normalizeTrainingMode(row.training_mode),
    status: row.status || 'draft',
  };
}

const handleGet = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const genId = await resolveGenId(searchParams.get('genId'), searchParams.get('gen'));
    const regionCodes = resolveRegionCodes(normalizeValue(searchParams.get('region')));

    const params: unknown[] = [];
    const where: string[] = ['g.is_active = true'];

    if (genId) {
      params.push(genId);
      where.push(`s.gen_id = $${params.length}`);
    }

    if (!genId && regionCodes) {
      params.push(regionCodes);
      where.push(`EXISTS (
        SELECT 1
        FROM hr_candidates hc
        WHERE hc.gen_id = g.id
          AND hc.region_code = ANY($${params.length}::text[])
      )`);
    }

    const [scheduleResult, references] = await Promise.all([
      pool.query(
        `SELECT
           s.id,
           s.gen_id,
           g.gen_name,
           CASE
             WHEN EXISTS (SELECT 1 FROM hr_candidates hc WHERE hc.gen_id = g.id AND hc.region_code IN ('1', '3')) THEN 'Miền Nam'
             WHEN EXISTS (SELECT 1 FROM hr_candidates hc WHERE hc.gen_id = g.id AND hc.region_code IN ('2', '4', '5')) THEN 'Miền Bắc'
             ELSE ''
           END AS region_label,
           s.session_number,
           s.title,
           to_char(s.session_date, 'YYYY-MM-DD') AS session_date,
           to_char(s.start_time, 'HH24:MI') AS start_time,
           to_char(s.end_time, 'HH24:MI') AS end_time,
           s.center_id,
           c.full_name AS center_full_name,
           c.display_name AS center_display_name,
           COALESCE(c.map_url, c.map_link) AS center_map_url,
           COALESCE(c.full_address, c.address) AS center_address,
           s.location,
           s.mentor_code,
           s.mentor_name,
           s.mentor_email,
           s.training_mode,
           s.status
         FROM hr_training_sessions s
         JOIN hr_gen_catalog g ON g.id = s.gen_id
         LEFT JOIN centers c ON c.id = s.center_id
         WHERE ${where.join(' AND ')}
         ORDER BY
           s.session_date NULLS LAST,
           NULLIF(regexp_replace(g.gen_name, '\\D', '', 'g'), '')::int NULLS LAST,
           g.gen_name ASC,
           s.session_number ASC`,
        params
      ),
      getReferenceData(),
    ]);

    return NextResponse.json({
      success: true,
      schedules: scheduleResult.rows.map(mapScheduleRow),
      ...references,
    });
  } catch (error) {
    console.error('HR training schedules GET error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const handlePut = async (request: NextRequest) => {
  let client: PoolClient | null = null;
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
    }

    const body = await request.json();
    const genId = await resolveGenId(body.genId, body.genName);
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];

    if (!genId) {
      return NextResponse.json({ error: 'Vui lòng chọn GEN cần xếp lịch.' }, { status: 400 });
    }

    if (sessions.length === 0) {
      return NextResponse.json({ error: 'Danh sách buổi học không hợp lệ.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const savedSessionNumbers: number[] = [];

    for (const session of sessions) {
      const sessionNumber = Number(session.sessionNumber);
      if (!Number.isInteger(sessionNumber) || sessionNumber < 1) continue;

      const centerId = Number(session.centerId);
      const safeCenterId = Number.isInteger(centerId) && centerId > 0 ? centerId : null;
      const mentorCode = normalizeValue(session.mentorCode) || null;
      const mentorName = normalizeValue(session.mentorName) || null;
      const mentorEmail = normalizeValue(session.mentorEmail) || null;
      const trainingMode = normalizeTrainingMode(session.trainingMode);
      const sessionDate = normalizeDate(session.date);
      const startTime = normalizeTime(session.startTime);
      const endTime = normalizeTime(session.endTime);
      const location = normalizeValue(session.location) || null;
      if (!sessionDate) {
        await client?.query('ROLLBACK');
        return NextResponse.json(
          { error: `Buổi ${sessionNumber} chưa có ngày học nên chưa thể lưu vào lịch training.` },
          { status: 400 }
        );
      }
      if (!startTime || !endTime || !location || !mentorCode) {
        await client?.query('ROLLBACK');
        return NextResponse.json(
          { error: `Buổi ${sessionNumber} còn thiếu thời gian, địa điểm/link hoặc mentor.` },
          { status: 400 }
        );
      }
      savedSessionNumbers.push(sessionNumber);

      await client.query(
        `INSERT INTO hr_training_sessions (
           gen_id,
           session_number,
           title,
           session_date,
           start_time,
           end_time,
           center_id,
           location,
           mentor_code,
           mentor_name,
           mentor_email,
           training_mode,
           status,
           created_by_email
         )
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (gen_id, session_number)
         DO UPDATE SET
           title = EXCLUDED.title,
           session_date = EXCLUDED.session_date,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           center_id = EXCLUDED.center_id,
           location = EXCLUDED.location,
           mentor_code = EXCLUDED.mentor_code,
           mentor_name = EXCLUDED.mentor_name,
           mentor_email = EXCLUDED.mentor_email,
           training_mode = EXCLUDED.training_mode,
           status = EXCLUDED.status,
           updated_at = CURRENT_TIMESTAMP`,
        [
          genId,
          sessionNumber,
          normalizeValue(session.title) || `Buổi ${sessionNumber}`,
          sessionDate,
          startTime,
          endTime,
          safeCenterId,
          location,
          mentorCode,
          mentorName,
          mentorEmail,
          trainingMode,
          normalizeValue(session.status) || 'draft',
          auth.sessionEmail,
        ]
      );
    }

    await client.query(
      `DELETE FROM hr_training_sessions
       WHERE gen_id = $1
         AND NOT (session_number = ANY($2::int[]))`,
      [genId, savedSessionNumbers]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('HR training schedules PUT error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client?.release();
  }
};

export const GET = withApiProtection(handleGet);
export const PUT = withApiProtection(handlePut);
