import pool from '@/lib/db'

const HR_ONBOARDING_ROUTES = [
  '/admin/hr-onboarding',
  '/admin/hr-candidates',
  '/admin/hr-candidates/gen-planner',
  '/admin/hr-candidates/gen-planner/overview',
  '/admin/hr-candidates/gen-planner/planner',
  '/admin/hr-candidates/gen-planner/scheduling',
  '/admin/hr-candidates/gen-planner/tracking',
  '/admin/hr-onboarding/videos',
] as const

function isRouteCovered(grantedRoute: string, targetRoute: string) {
  return (
    grantedRoute === targetRoute ||
    targetRoute.startsWith(`${grantedRoute}/`) ||
    grantedRoute.startsWith(`${targetRoute}/`)
  )
}

export async function validateHrOnboardingAccess(email: string): Promise<boolean> {
  const userResult = await pool.query(
    `SELECT u.id, u.role FROM app_users u WHERE u.email = $1 AND u.is_active = true LIMIT 1`,
    [email],
  )

  if (userResult.rows.length === 0) return false

  const user = userResult.rows[0] as { id: number; role: string }
  if (user.role === 'super_admin') return true

  const roleResult = await pool.query(
    `SELECT role_code FROM user_roles WHERE user_id = $1`,
    [user.id],
  )
  const roleCodes = roleResult.rows.map((row: { role_code: string }) =>
    String(row.role_code || '').trim().toUpperCase(),
  )
  if (['HR', 'TE', 'TF'].some((role) => roleCodes.includes(role))) {
    return true
  }

  const permissionResult = await pool.query(
    `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true
     UNION
     SELECT rp.route_path
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_code = ur.role_code
     WHERE ur.user_id = $1`,
    [user.id],
  )

  return permissionResult.rows.some((row: { route_path: string }) =>
    HR_ONBOARDING_ROUTES.some((route) => isRouteCovered(row.route_path, route)),
  )
}
