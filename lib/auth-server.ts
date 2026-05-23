import {
  resolveAppUserAccessForEmail,
  type AppUserAccess,
} from '@/lib/app-user-access';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export type DbRoleResult =
  | { ok: true; sessionEmail: string; role: string }
  | { ok: false; response: NextResponse };

export async function getDbRoleForEmail(
  email: string,
  preResolvedAccess?: AppUserAccess | null,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  try {
    const r = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [normalized],
    );
    const dbRole = (r.rows[0]?.role as string) ?? null
    if (dbRole && ['super_admin', 'admin', 'manager'].includes(dbRole)) {
      return dbRole
    }

    const access =
      preResolvedAccess ??
      (await resolveAppUserAccessForEmail(normalized))
    return access.found && access.isActive ? access.role : null
  } catch {
    return null;
  }
}

/** Bearer hợp lệ + role DB thuộc tập cho phép (không tin role trong JWT). */
export async function requireBearerDbRoles(
  request: NextRequest,
  allowedRoles: string[],
): Promise<DbRoleResult> {
  const auth = await requireBearerSession(request);
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }
  const role = await getDbRoleForEmail(
    auth.sessionEmail,
    auth.resolvedAccess,
  );
  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Không có quyền thực hiện thao tác này' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, sessionEmail: auth.sessionEmail, role };
}

export async function requireBearerSuperAdmin(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin']);
}

/** super_admin hoặc admin (quản trị nội dung / S3 manager). */
export async function requireBearerAdminOrSuper(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin', 'admin']);
}
