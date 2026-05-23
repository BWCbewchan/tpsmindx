import { getAccessibleCenters } from '@/lib/center-access'
import pool from '@/lib/db'

export type AppUserAccess = {
  found: boolean
  /** Email chuẩn hóa (lower case). */
  email: string
  role: string
  isAdmin: boolean
  permissions: string[]
  userRoles: string[]
  isAppUser: boolean
  isActive: boolean
  /** Centers assigned to this manager/admin */
  assignedCenters: Array<{
    id: number
    full_name: string
    short_code: string | null
    email?: string | null
  }>
}

/**
 * Quyền thực tế từ DB — dùng cho đăng nhập và check-admin (không tin client).
 */
export async function resolveAppUserAccessForEmail(
  rawEmail: string,
): Promise<AppUserAccess> {
  const normalized = rawEmail.trim().toLowerCase()

  try {
    const dbResult = await pool.query(
      'SELECT id, role, is_active, auth_type FROM app_users WHERE email = $1',
      [normalized],
    )

    if (dbResult.rows.length === 0) {
      const leaderResult = await pool.query(
        'SELECT status FROM teaching_leaders WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
        [normalized],
      )

      if (leaderResult.rows.length > 0) {
        const leaderRow = leaderResult.rows[0] as { status?: string }
        const isActive = leaderRow.status !== 'Deactive'
        return {
          found: true,
          email: normalized,
          role: 'manager',
          isAdmin: isActive,
          permissions: [],
          userRoles: [],
          isAppUser: false,
          isActive,
          assignedCenters: await getAccessibleCenters(normalized),
        }
      }

      return {
        found: false,
        email: normalized,
        role: 'teacher',
        isAdmin: false,
        permissions: [],
        userRoles: [],
        isAppUser: false,
        isActive: true,
        assignedCenters: [],
      }
    }

    const appUser = dbResult.rows[0] as {
      id: number
      role: string
      is_active: boolean
      auth_type: string
    }

    const assignedCenters = await getAccessibleCenters(normalized)

    const directPerms = await pool.query(
      'SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true',
      [appUser.id],
    )

    const rolePerms = await pool.query(
      `
      SELECT DISTINCT rp.route_path
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_code = ur.role_code
      WHERE ur.user_id = $1
    `,
      [appUser.id],
    )

    const userRoles = await pool.query(
      'SELECT role_code FROM user_roles WHERE user_id = $1',
      [appUser.id],
    )

    const allPerms = new Set<string>()
    directPerms.rows.forEach((r: { route_path: string }) =>
      allPerms.add(r.route_path),
    )
    rolePerms.rows.forEach((r: { route_path: string }) =>
      allPerms.add(r.route_path),
    )

    const permissions = Array.from(allPerms)
    const roleCodes = userRoles.rows.map((r: { role_code: string }) =>
      (r.role_code || '').toUpperCase(),
    )
    const hasTrainingInputRole = roleCodes.some(
      (code) => code === 'HR' || code === 'TE' || code === 'TF',
    )
    const hasAdminPerms = permissions.some((p) => p.startsWith('/admin'))
    const effectiveRole =
      assignedCenters.length > 0 &&
      !['super_admin', 'admin', 'manager'].includes(appUser.role)
        ? 'manager'
        : appUser.role
    const isAdmin =
      appUser.is_active &&
      (['super_admin', 'admin', 'manager'].includes(effectiveRole) ||
        hasAdminPerms ||
        hasTrainingInputRole)

    return {
      found: true,
      email: normalized,
      role: effectiveRole,
      isAdmin,
      permissions,
      userRoles: userRoles.rows.map((r: { role_code: string }) => r.role_code),
      isAppUser: appUser.auth_type === 'app',
      isActive: Boolean(appUser.is_active),
      assignedCenters,
    }
  } catch (e) {
    console.error('resolveAppUserAccessForEmail:', e)
    return {
      found: false,
      email: normalized,
      role: 'teacher',
      isAdmin: false,
      permissions: [],
      userRoles: [],
      isAppUser: false,
      isActive: true,
      assignedCenters: [],
    }
  }
}
