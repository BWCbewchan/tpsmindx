export type TeacherSyncState = {
  foundInDatabase: boolean
  dbUnavailable: boolean
}

// A per-account restriction, deliberately outside /admin so it grants no screens.
// Absence preserves switching for existing accounts.
export const INTERFACE_SWITCH_DISABLED = '/account/interface-switch-disabled'

export function canSwitchInterface(user: {
  role?: string
  isAdmin?: boolean
  permissions?: string[]
} | null | undefined): boolean {
  return Boolean(user?.isAdmin) &&
    (user?.role === 'super_admin' || !user?.permissions?.includes(INTERFACE_SWITCH_DISABLED))
}

type AuthenticatedLandingOptions = {
  selectedRole: 'teacher' | 'manager'
  userRole: string
  isAdmin: boolean
  teacherSync?: TeacherSyncState
  permissions?: string[]
}

export function resolveAuthenticatedLanding({
  selectedRole,
  userRole,
  isAdmin,
  teacherSync,
  permissions,
}: AuthenticatedLandingOptions): string {
  if (isAdmin && (selectedRole === 'manager' || !canSwitchInterface({ role: userRole, isAdmin, permissions }))) {
    return '/admin/dashboard'
  }

  if (isAdmin || userRole !== 'teacher') {
    return '/user/truyenthong'
  }

  if (teacherSync?.dbUnavailable || teacherSync?.foundInDatabase) {
    return '/user/truyenthong'
  }

  return '/checkdatasource'
}
