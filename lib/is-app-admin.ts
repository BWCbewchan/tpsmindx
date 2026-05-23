import pool from '@/lib/db';

/**
 * Whether this email is allowed admin-style actions (trùng logic /api/check-admin).
 */
export async function isAppAdminByEmail(email: string | undefined | null): Promise<boolean> {
  if (!email?.trim()) return false;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const dbResult = await pool.query(
      `SELECT id, role, is_active FROM app_users WHERE email = $1`,
      [normalizedEmail]
    );

    if (dbResult.rows.length === 0) return false;

    const appUser = dbResult.rows[0];
    if (!appUser.is_active) return false;

    if (['super_admin', 'admin', 'manager'].includes(appUser.role)) {
      return true;
    }

    const directPerms = await pool.query(
      'SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true',
      [appUser.id]
    );

    const rolePerms = await pool.query(
      `
      SELECT DISTINCT rp.route_path
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_code = ur.role_code
      WHERE ur.user_id = $1
    `,
      [appUser.id]
    );

    const userRoles = await pool.query('SELECT role_code FROM user_roles WHERE user_id = $1', [
      appUser.id,
    ]);

    const allPerms = new Set<string>();
    directPerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));
    rolePerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));

    const permissions = Array.from(allPerms);
    const roleCodes = userRoles.rows.map((r: { role_code: string }) =>
      (r.role_code || '').toUpperCase()
    );
    const hasTrainingInputRole = roleCodes.some((code) => code === 'HR' || code === 'TE' || code === 'TF');
    const hasAdminPerms = permissions.some((p) => p.startsWith('/admin'));

    return hasAdminPerms || hasTrainingInputRole;
  } catch (e) {
    console.error('isAppAdminByEmail:', e);
    return false;
  }
}
