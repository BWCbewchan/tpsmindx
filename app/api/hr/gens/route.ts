import { requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const HR_PERMISSION_ROUTE = '/admin/hr-candidates';

function normalizeValue(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function normalizeEmail(input: unknown): string {
  return normalizeValue(input).toLowerCase();
}

async function validateHrAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const userResult = await pool.query(
    `SELECT id, role, is_active
     FROM app_users
     WHERE email = $1
     LIMIT 1`,
    [requestEmail]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    return { ok: false, status: 403, message: 'Tai khoan khong ton tai hoac da bi vo hieu hoa.' };
  }

  const user = userResult.rows[0] as { id: number; role: string };
  if (user.role === 'super_admin') {
    return { ok: true, status: 200 };
  }

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

  if (hasTrainingInputRole) {
    return { ok: true, status: 200 };
  }

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

  if (!hasAccess) {
    return { ok: false, status: 403, message: 'Ban khong co quyen truy cap module HR.' };
  }

  return { ok: true, status: 200 };
}

const handleGet = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const requestEmail = auth.sessionEmail;

    const access = await validateHrAccess(requestEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Khong co quyen truy cap.' }, { status: access.status });
    }

    const catalogResult = await pool.query(
      `SELECT id, gen_name
       FROM hr_gen_catalog
       WHERE is_active = true
       ORDER BY gen_name ASC`
    );

    return NextResponse.json({
      success: true,
      gens: catalogResult.rows.map((row: { id: number; gen_name: string }) => row.gen_name),
      catalog: catalogResult.rows as Array<{ id: number; gen_name: string }>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Loi khong xac dinh';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const handlePost = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const requestEmail = auth.sessionEmail;
    const genName = normalizeValue(body.genName).toUpperCase();

    if (!genName) {
      return NextResponse.json({ error: 'genName la bat buoc.' }, { status: 400 });
    }

    const access = await validateHrAccess(requestEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Khong co quyen truy cap.' }, { status: access.status });
    }

    if (genName.length > 100) {
      return NextResponse.json({ error: 'Ten GEN qua dai.' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO hr_gen_catalog (gen_name, source, created_by_email, is_active)
       VALUES ($1, 'manual', $2, true)
       ON CONFLICT (gen_name)
       DO UPDATE SET
         is_active = true,
         updated_at = CURRENT_TIMESTAMP
       RETURNING gen_name`,
      [genName, requestEmail]
    );

    return NextResponse.json({
      success: true,
      gen: result.rows[0]?.gen_name || genName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Loi khong xac dinh';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withApiProtection(handleGet);
export const POST = withApiProtection(handlePost);
