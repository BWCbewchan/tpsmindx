import pool from '@/lib/db'

export const LECTURE_REVIEW_ALLOWED_ROLE_CODES = [
  'CL',
  'AL',
  'RL',
  'TE',
  'TEGL',
  'TEGL+',
  'LEADER',
] as const

export const LECTURE_REVIEW_MANAGER_ROLE_CODES = [
  ...LECTURE_REVIEW_ALLOWED_ROLE_CODES,
  'TC',
] as const

export const LECTURE_REVIEW_LEGACY_LEADERS = [
  {
    code: 'legacy-huynh-minh-nhut',
    full_name: 'Huỳnh Minh Nhựt',
    role_code: 'LEGACY',
    email: null,
  },
  {
    code: 'legacy-trinh-hung-thinh',
    full_name: 'Trịnh Hưng Thịnh',
    role_code: 'LEGACY',
    email: null,
  },
  {
    code: 'legacy-ho-xuan-hoan',
    full_name: 'Hồ Xuân Hoàn',
    role_code: 'LEGACY',
    email: null,
  },
  {
    code: 'legacy-vu-trung-duc',
    full_name: 'Vũ Trung Đức',
    role_code: 'LEGACY',
    email: null,
  },
  {
    code: 'legacy-tran-thi-minh-anh',
    full_name: 'Trần Thị Minh Anh',
    role_code: 'LEGACY',
    email: null,
  },
] as const

export const LECTURE_REVIEW_ROUTES = [
  '/admin/dang-ky-duyet-giang',
  '/admin/quan-ly-dang-ky-duyet-giang',
] as const

export const LECTURE_REVIEW_REVIEWERS = [
  'Thầy Hoàng Việt Hùng',
  'Thầy Cao Quang Sơn',
  'Thầy Trần Văn Nghĩa',
  'Thầy Phạm Tiến Thịnh',
] as const

export const LECTURE_REVIEW_REVIEWER_BY_EMAIL: Record<string, string> = {
  'hunghv@mindx.com.vn': 'Thầy Hoàng Việt Hùng',
  'soncq@mindx.com.vn': 'Thầy Cao Quang Sơn',
  'nghiatv@mindx.com.vn': 'Thầy Trần Văn Nghĩa',
  'thinhpt@mindx.com.vn': 'Thầy Phạm Tiến Thịnh',
}

export const LECTURE_REVIEW_BLOCKS = [
  'coding',
  'art',
  'robotics',
  'age_4_plus',
] as const

export type LectureReviewAccess = {
  allowed: boolean
  appUserId: number | null
  email: string
  displayName: string
  roleCodes: string[]
}

function normalizeRoleCode(value: unknown): string {
  return String(value || '').trim().toUpperCase()
}

export async function resolveLectureReviewAccess(
  rawEmail: string,
): Promise<LectureReviewAccess> {
  const email = rawEmail.trim().toLowerCase()
  const [appUserResult, leaderResult] = await Promise.all([
    pool.query(
      `SELECT
         u.id,
         u.display_name,
         u.role,
         u.is_active,
         COALESCE(
           ARRAY_AGG(DISTINCT ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL),
           ARRAY[]::varchar[]
         ) AS role_codes
       FROM app_users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE LOWER(TRIM(u.email)) = $1
       GROUP BY u.id
       LIMIT 1`,
      [email],
    ),
    pool.query(
      `SELECT code, full_name, role_code, status
       FROM teaching_leaders
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [email],
    ),
  ])

  const appUser = appUserResult.rows[0] as
    | {
        id: number
        display_name: string | null
        role: string | null
        is_active: boolean
        role_codes: string[] | null
      }
    | undefined
  const leader = leaderResult.rows[0] as
    | {
        full_name: string | null
        role_code: string | null
        status: string | null
      }
    | undefined

  const roleCodes = Array.from(
    new Set([
      ...((appUser?.role_codes || []).map(normalizeRoleCode)),
      normalizeRoleCode(leader?.role_code),
    ].filter(Boolean)),
  )
  const systemRole = String(appUser?.role || '').trim().toLowerCase()
  const appUserActive = appUser ? appUser.is_active !== false : true
  const leaderActive = leader
    ? normalizeRoleCode(leader.status) !== 'DEACTIVE'
    : true
  const hasAllowedRole = roleCodes.some((code) =>
    (LECTURE_REVIEW_ALLOWED_ROLE_CODES as readonly string[]).includes(code),
  )
  const isSystemAdmin = ['super_admin', 'admin'].includes(systemRole)

  return {
    allowed: appUserActive && leaderActive && (isSystemAdmin || hasAllowedRole),
    appUserId: appUser?.id ?? null,
    email,
    displayName:
      String(appUser?.display_name || leader?.full_name || email).trim() || email,
    roleCodes,
  }
}

export function isLectureReviewReviewer(
  value: string,
): value is (typeof LECTURE_REVIEW_REVIEWERS)[number] {
  return (LECTURE_REVIEW_REVIEWERS as readonly string[]).includes(value)
}

export function isLectureReviewBlock(
  value: string,
): value is (typeof LECTURE_REVIEW_BLOCKS)[number] {
  return (LECTURE_REVIEW_BLOCKS as readonly string[]).includes(value)
}

export function findLegacyLectureReviewLeader(code: string) {
  return LECTURE_REVIEW_LEGACY_LEADERS.find((leader) => leader.code === code)
}
