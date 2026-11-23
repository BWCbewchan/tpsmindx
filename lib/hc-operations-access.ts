export const HC_ROLE_CODE = 'HC'
export const HC_ACCOUNT_EMAIL = 'hc@mindx.edu.vn'

export const HC_TEACHER_PORTFOLIO_PATH =
  '/admin/quan-ly-portfolio-giao-vien'
export const HC_TEACHING_SCHEDULE_PATH =
  '/public/teaching-schedule'

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function isHcAccountEmail(email: unknown): boolean {
  return normalize(email) === HC_ACCOUNT_EMAIL
}

export function isHcOperationsUser(user: {
  email?: unknown
  userRoles?: unknown[]
} | null | undefined): boolean {
  if (!user) return false
  if (isHcAccountEmail(user.email)) return true

  return (user.userRoles || []).some((role) => {
    if (typeof role === 'string') {
      return role.trim().toUpperCase() === HC_ROLE_CODE
    }
    if (role && typeof role === 'object') {
      return String((role as { role_code?: unknown }).role_code || '')
        .trim()
        .toUpperCase() === HC_ROLE_CODE
    }
    return false
  })
}

export function isHcTeachingSchedulePath(pathname: string): boolean {
  return (
    pathname === HC_TEACHING_SCHEDULE_PATH ||
    pathname.startsWith(`${HC_TEACHING_SCHEDULE_PATH}/`)
  )
}
