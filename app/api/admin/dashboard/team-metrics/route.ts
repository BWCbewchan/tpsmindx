import { withApiProtection } from '@/lib/api-protection'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { getAccessibleCenters, getAllActiveCenters } from '@/lib/center-access'
import { callLmsApi } from '@/lib/lms-api'
import {
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
  applyRefreshedCookies,
} from '@/lib/lms-token-helper'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const LMS_ITEMS_PER_PAGE = 200
const LMS_MAX_PAGES = 30

const GET_TEAM_CLASSES_QUERY = /* graphql */ `
  query GetTeamClasses(
    $search: String,
    $statusIn: [String],
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String
  ) {
    classes(payload: {
      filter_textSearch: $search,
      status_in: $statusIn,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      pagination { total }
      data {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id username code fullName email }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName email phoneNumber }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          teachers {
            isActive
            teacher { id username code fullName email }
            role { id name shortName }
          }
          teacherAttendance {
            _id
            status
            note
            teacher { id username code fullName email }
          }
          studentAttendance {
            _id
            status
            student { id fullName }
          }
        }
      }
    }
  }
`

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function uniqueClassesById(classes: any[]): any[] {
  return Array.from(
    new Map(
      classes
        .filter((cls) => cls?.id)
        .map((cls) => [String(cls.id), cls]),
    ).values(),
  )
}

function normalizeWords(value: unknown): string[] {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((word) => word.trim())
    .filter(Boolean)
}

function addIdentityToken(tokens: Set<string>, value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return

  const normalized = normalizeKey(raw)
  if (normalized.length >= 3) tokens.add(normalized)

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const normalizedLocal = normalizeKey(localPart)
    if (normalizedLocal.length >= 3) tokens.add(normalizedLocal)
  }
}

function matchesIdentityToken(value: unknown, tokens: Set<string>): boolean {
  const normalized = normalizeKey(value)
  if (!normalized || tokens.size === 0) return false

  for (const token of tokens) {
    if (normalized.includes(token) || token.includes(normalized)) {
      return true
    }
  }

  return false
}

function addTeacherLookupKeys(
  keys: Set<string>,
  teacher: {
    code?: unknown
    email?: unknown
    work_email?: unknown
    username?: unknown
    user_name?: unknown
    fullName?: unknown
    full_name?: unknown
  },
) {
  const code = normalizeKey(teacher.code)
  if (code) {
    keys.add(`code:${code}`)
    keys.add(`identity:${code}`)
  }

  const username = normalizeKey(teacher.username || teacher.user_name)
  if (username) {
    keys.add(`user:${username}`)
    keys.add(`identity:${username}`)
  }

  const email = String(teacher.email || teacher.work_email || '').trim()
  const normalizedEmail = normalizeKey(email)
  if (normalizedEmail) keys.add(`email:${normalizedEmail}`)

  const emailLocal = normalizeKey(email.includes('@') ? email.split('@')[0] : '')
  if (emailLocal) {
    keys.add(`emailLocal:${emailLocal}`)
    keys.add(`identity:${emailLocal}`)
  }

  const fullName = normalizeKey(teacher.fullName || teacher.full_name)
  if (!code && !username && !emailLocal && !normalizedEmail && fullName.length >= 5) {
    keys.add(`name:${fullName}`)
  }
}

function isManagementRole(role: string, userRoles: string[]): boolean {
  const normRole = (role || '').toLowerCase().trim()
  if (normRole === 'super_admin' || normRole === 'superadmin') return true
  const codes = userRoles.map((r) => String(r).toUpperCase().trim())
  if (role) {
    codes.push(String(role).toUpperCase().trim())
  }
  const allowed = ['TE', 'CL', 'AL', 'RL', 'TC', 'LEADER', 'SUPER_ADMIN', 'SUPERADMIN']
  return codes.some((code) => allowed.includes(code))
}

/**
 * Phân tích và chuẩn hóa chức vụ giáo viên (Giảng viên chính [LEC] vs Trợ giảng [TA])
 * Dựa trên cấu trúc LMS GraphQL: role { id name shortName code }
 */
function parseTeacherRole(roleObj: any): { role: string; roleCode: 'LEC' | 'TA' } {
  if (!roleObj) {
    return { role: 'Giảng viên chính', roleCode: 'LEC' }
  }

  const rawShortName = String(roleObj.shortName || '').toUpperCase().trim()
  const rawCode = String(roleObj.code || '').toUpperCase().trim()
  const rawName = String(roleObj.name || '').trim()

  const combined = `${rawShortName} ${rawCode} ${rawName}`
  const normalized = normalizeKey(combined)

  const isTA =
    rawShortName === 'TA' ||
    rawShortName === 'TG' ||
    rawShortName === 'TUTOR' ||
    rawCode === 'TA' ||
    rawCode === 'TG' ||
    rawCode === 'TUTOR' ||
    /\b(TA|TG)\b/i.test(rawShortName) ||
    /\b(TA|TG)\b/i.test(rawName) ||
    normalized.includes('trogiang') ||
    normalized.includes('tro giang') ||
    normalized.includes('assistant') ||
    normalized.includes('tutor') ||
    normalized.includes('supporter')

  if (isTA) {
    return { role: 'Trợ giảng', roleCode: 'TA' }
  }

  return { role: 'Giảng viên chính', roleCode: 'LEC' }
}

function hasAnyKeyword(text: unknown, keywords: string[]): boolean {
  const compact = normalizeKey(text)
  const words = new Set(normalizeWords(text))

  return keywords.some((keyword) => {
    const normalized = normalizeKey(keyword)
    if (!normalized) return false

    if (normalized.length <= 2) {
      return words.has(normalized)
    }

    return compact.includes(normalized) || words.has(normalized)
  })
}

function isExplicitArtBlock(blockText: unknown): boolean {
  return hasAnyKeyword(blockText, [
    'xart',
    'x art',
    'mythuat',
    'my thuat',
    'dohoa',
    'do hoa',
    'graphic',
    'photoshop',
    'illustrator',
    'blender',
    'drawing',
    'uiux',
    'ui ux',
    'thietke',
    'thiet ke',
    'design',
  ])
}

function isExplicitRoboticsBlock(blockText: unknown): boolean {
  return hasAnyKeyword(blockText, [
    'rob',
    'robot',
    'robotics',
    'lego',
    'vex',
    'wedo',
    'stem',
    'spike',
    'mindstorm',
  ])
}

function isTeachingBlockMatchingRole(blockText: unknown, roleCodes: string[]): boolean {
  const isCL = roleCodes.includes('CL')
  const isAL = roleCodes.includes('AL')
  const isRL = roleCodes.includes('RL')

  if (!isCL && !isAL && !isRL) return true

  const explicitArtBlock = isExplicitArtBlock(blockText)
  const explicitRoboticsBlock = isExplicitRoboticsBlock(blockText)

  const matchesCoding =
    isCL &&
    !explicitArtBlock &&
    !explicitRoboticsBlock &&
    hasAnyKeyword(blockText, [
      'c4k',
      'c3k',
      'c2k',
      'creator',
      'code',
      'coding',
      'laptrinh',
      'khoahocmaytinh',
      'kid',
      'python',
      'web',
      'scratch',
      'game',
      'app',
      'cs',
      'computer',
      'java',
      'cplus',
      'data',
      'ai',
    ])

  const matchesArt =
    isAL &&
    (explicitArtBlock ||
      hasAnyKeyword(blockText, [
        'art',
        '2d',
        '3d',
      ]))

  const matchesRobotics =
    isRL &&
    explicitRoboticsBlock

  return matchesCoding || matchesArt || matchesRobotics
}

function isCourseMatchingRole(cls: any, roleCodes: string[]): boolean {
  const isCL = roleCodes.includes('CL')
  const isAL = roleCodes.includes('AL')
  const isRL = roleCodes.includes('RL')

  // Nếu không thuộc nhóm Leader môn chuyên biệt thì cho qua
  if (!isCL && !isAL && !isRL) return true

  const courseLineName = String(cls?.course?.courseLine?.name || '').toLowerCase()
  const courseName = String(cls?.course?.name || cls?.course?.shortName || '').toLowerCase()
  const clsName = String(cls?.name || '').toLowerCase()
  const combined = `${courseLineName} ${courseName} ${clsName}`
  return isTeachingBlockMatchingRole(combined, roleCodes)
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  const access = auth.resolvedAccess
  const roleCodes = (access.userRoles || []).map((r) => String(r).toUpperCase().trim())
  if (access.role) {
    roleCodes.push(String(access.role).toUpperCase().trim())
  }

  const leaderIdentityTokens = new Set<string>()
  const leaderRoleCodes: string[] = []
  addIdentityToken(leaderIdentityTokens, access.email)

  try {
    const leaderInfo = await pool.query(
      `SELECT code, full_name, email, role_code, role_name
       FROM teaching_leaders
       WHERE LOWER(TRIM(email)) = $1
       ORDER BY CASE WHEN status = 'Active' THEN 0 ELSE 1 END, role_code
       LIMIT 1`,
      [access.email],
    )

    const leader = leaderInfo.rows[0] as
      | {
          code?: string | null
          full_name?: string | null
          email?: string | null
          role_code?: string | null
          role_name?: string | null
        }
      | undefined

    if (leader) {
      if (leader.role_code) {
        const leaderRoleCode = String(leader.role_code).toUpperCase().trim()
        roleCodes.push(leaderRoleCode)
        leaderRoleCodes.push(leaderRoleCode)
      }
      addIdentityToken(leaderIdentityTokens, leader.code)
      addIdentityToken(leaderIdentityTokens, leader.full_name)
      addIdentityToken(leaderIdentityTokens, leader.email)
    }
  } catch (error) {
    console.warn('[team-metrics] Unable to resolve teaching leader identity:', error)
  }

  const hasAccess = isManagementRole(access.role, roleCodes)

  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền truy cập Dashboard nhóm phụ trách' },
      { status: 403 },
    )
  }

  const isSuperAdmin =
    normalizeKey(access.role) === 'superadmin' ||
    normalizeKey(access.role) === 'super_admin' ||
    roleCodes.includes('SUPER_ADMIN') ||
    roleCodes.includes('SUPERADMIN')

  const specialtySourceRoles = leaderRoleCodes.some((code) => ['CL', 'AL', 'RL'].includes(code))
    ? leaderRoleCodes
    : roleCodes
  const isCL = specialtySourceRoles.includes('CL')
  const isAL = specialtySourceRoles.includes('AL')
  const isRL = specialtySourceRoles.includes('RL')
  const isTE = roleCodes.includes('TE')
  const isTC = roleCodes.includes('TC')

  const { searchParams } = new URL(request.url)
  const selectedCenterFilter = searchParams.get('center')?.trim() || 'all'
  const selectedStatusFilter = searchParams.get('status')?.trim() || 'all'
  const searchQuery = searchParams.get('search')?.trim() || ''

  try {
    // 1. Phân giải danh sách cơ sở được phân quyền
    let assignedCenters: Array<{
      id: number
      full_name: string
      short_code: string | null
      region?: string | null
    }> = []

    if (isSuperAdmin) {
      assignedCenters = await getAllActiveCenters()
    } else {
      assignedCenters = await getAccessibleCenters(access.email)
    }

    const allowedCenterTokens = new Set<string>()
    assignedCenters.forEach((c) => {
      if (c.full_name) allowedCenterTokens.add(normalizeKey(c.full_name))
      if (c.short_code) allowedCenterTokens.add(normalizeKey(c.short_code))
    })

    // 2. Lấy danh sách giáo viên từ PostgreSQL
    const client = await pool.connect()
    let teachersInGroup: any[] = []
    const teacherProfilesByKey = new Map<string, any>()
    try {
      const teacherColumnsRes = await client.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'teachers'`,
      )
      const teacherColumns = new Map<string, string[]>()
      teacherColumnsRes.rows.forEach((row) => {
        const columnName = String(row.column_name)
        const key = columnName.toLowerCase()
        const existing = teacherColumns.get(key) || []
        existing.push(columnName)
        teacherColumns.set(key, existing)
      })
      const quoteTeacherColumn = (columnName: string) =>
        `t."${columnName.replace(/"/g, '""')}"`
      const teacherColumnExpressions = (...names: string[]) => {
        const expressions: string[] = []
        const seen = new Set<string>()
        names.forEach((name) => {
          const columns = teacherColumns.get(name.toLowerCase()) || []
          columns.forEach((columnName) => {
            if (seen.has(columnName)) return
            seen.add(columnName)
            expressions.push(quoteTeacherColumn(columnName))
          })
        })
        return expressions
      }
      const teacherColumn = (name: string) =>
        teacherColumnExpressions(name)[0] || 'NULL::text'
      const coalesceTeacherColumns = (names: string[], fallback = 'NULL::text') => {
        const expressions = teacherColumnExpressions(...names).map((expr) => `NULLIF(${expr}, '')`)
        return expressions.length > 0
          ? `COALESCE(${[...expressions, fallback].join(', ')})`
          : fallback
      }
      const khoiFinalColumn = teacherColumn('khoi_final')
      const roleColumn = coalesceTeacherColumns([
        'role',
        'Role',
        'position',
        'Position',
        'current_role',
        'Current role',
        'job_title',
        'Job title',
        'vi_tri',
        'Vị trí',
      ])
      const teManagerColumn = teacherColumn('te_quan_ly')
      const leaderManagerColumn = teacherColumn('leader_quan_ly')
      const hasManagerScopeColumns =
        teacherColumns.has('te_quan_ly') || teacherColumns.has('leader_quan_ly')

      const teacherQuery = `
        SELECT
          t.code,
          COALESCE(NULLIF(t.full_name, ''), t."Full name") AS full_name,
          COALESCE(NULLIF(t.user_name, ''), t."User name") AS user_name,
          COALESCE(NULLIF(t.work_email, ''), t."Work email") AS work_email,
          COALESCE(NULLIF(t.main_centre, ''), t."Main centre") AS main_centre,
          COALESCE(NULLIF(${khoiFinalColumn}, ''), NULLIF(t.course_line, ''), NULLIF(t."Course Line", ''), tts.teaching_block) AS khoi_final,
          COALESCE(NULLIF(t.course_line, ''), t."Course Line", tts.teaching_block) AS course_line,
          COALESCE(NULLIF(tts.teaching_block, ''), NULLIF(${khoiFinalColumn}, ''), NULLIF(t.course_line, ''), t."Course Line") AS teaching_block,
          COALESCE(NULLIF(${roleColumn}, ''), NULL) AS current_role,
          COALESCE(NULLIF(${teManagerColumn}, ''), NULL) AS te_quan_ly,
          COALESCE(NULLIF(${leaderManagerColumn}, ''), NULL) AS leader_quan_ly,
          COALESCE(NULLIF(t.status, ''), t."Status", 'Active') AS status
        FROM teachers t
        LEFT JOIN (
          SELECT DISTINCT ON (LOWER(TRIM(COALESCE(teacher_code, ''))))
            teacher_code, teaching_block, work_email
          FROM training_teacher_stats
          WHERE teaching_block IS NOT NULL AND teaching_block != ''
        ) tts ON (
          (t.code IS NOT NULL AND t.code != '' AND LOWER(TRIM(t.code)) = LOWER(TRIM(tts.teacher_code)))
          OR (COALESCE(t.work_email, t."Work email") IS NOT NULL AND LOWER(TRIM(COALESCE(t.work_email, t."Work email"))) = LOWER(TRIM(tts.work_email)))
        )
        WHERE LOWER(TRIM(COALESCE(t.status, t."Status", ''))) NOT IN ('inactive', 'deactive', 'nghỉ')
        ORDER BY full_name ASC
      `
      const teacherRes = await client.query(teacherQuery)
      teacherRes.rows.forEach((teacher) => {
        const keys = new Set<string>()
        addTeacherLookupKeys(keys, teacher)
        keys.forEach((key) => {
          if (!teacherProfilesByKey.has(key)) {
            teacherProfilesByKey.set(key, teacher)
          }
        })
      })

      // Lọc giáo viên từ DB:
      // Super Admin: xem tất cả
      // TE/TC: ưu tiên lấy tất cả mentor thuộc quản lý trực tiếp, không chia theo khối
      // Leader chuyên môn (CL, AL, RL): lấy mentor thuộc quản lý trực tiếp và đúng Khối final
      const shouldRequireManagerScope =
        !isSuperAdmin && hasManagerScopeColumns && leaderIdentityTokens.size > 0

      const teacherMatchesScope = (teacher: any, requireManagerScope: boolean) => {
        if (isSuperAdmin) return true

        const centerKey = normalizeKey(teacher.main_centre)
        let centerMatch = false
        if (allowedCenterTokens.size > 0) {
          for (const token of allowedCenterTokens) {
            if (centerKey.includes(token) || token.includes(centerKey)) {
              centerMatch = true
              break
            }
          }
        }

        const managerMatch = matchesIdentityToken(
          `${teacher.te_quan_ly || ''} ${teacher.leader_quan_ly || ''}`,
          leaderIdentityTokens,
        )
        if (requireManagerScope && !managerMatch) return false

        const subjectMatch = isTeachingBlockMatchingRole(
          `${teacher.khoi_final || ''} ${teacher.course_line || ''} ${teacher.teaching_block || ''}`,
          specialtySourceRoles,
        )

        if (isCL || isAL || isRL) {
          return subjectMatch
        }

        if (isTE || isTC) {
          return requireManagerScope ? true : centerMatch || allowedCenterTokens.size === 0
        }

        return managerMatch || centerMatch || allowedCenterTokens.size === 0
      }

      teachersInGroup = teacherRes.rows.filter((teacher) =>
        teacherMatchesScope(teacher, shouldRequireManagerScope),
      )

      if (shouldRequireManagerScope && teachersInGroup.length === 0) {
        teachersInGroup = teacherRes.rows.filter((teacher) => teacherMatchesScope(teacher, false))
      }
    } finally {
      client.release()
    }

    // 3. Lấy dữ liệu lớp học từ LMS GraphQL (lấy đầy đủ nhiều trang nếu có)
    let rawClasses: any[] = []
    let runningClassesForTeacherMap: any[] = []
    let activeTokenSession: any = null
    try {
      let tokenSession = await getOrRefreshLmsToken(request)
      let authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined

      const statuses = selectedStatusFilter === 'all'
        ? ['RUNNING', 'PREPARING', 'FINISHED']
        : [selectedStatusFilter.toUpperCase()]

      const fetchLmsBatch = async (
        page: number,
        limit: number = LMS_ITEMS_PER_PAGE,
        search?: string,
        statusList: string[] = statuses,
      ) => {
        return await callLmsApi<any>(
          {
            query: GET_TEAM_CLASSES_QUERY,
            operationName: 'GetTeamClasses',
            variables: {
              search: search || undefined,
              statusIn: statusList,
              pageIndex: page,
              itemsPerPage: limit,
              orderBy: 'startDate_desc',
            },
          },
          authHeader,
        )
      }

      const fetchAllLmsClasses = async (statusList: string[], search?: string) => {
        const firstRes = await fetchLmsBatch(0, LMS_ITEMS_PER_PAGE, search, statusList)
        const firstPageData = firstRes?.data?.classes?.data || firstRes?.classes?.data || []
        const total =
          Number(firstRes?.data?.classes?.pagination?.total || firstRes?.classes?.pagination?.total) ||
          firstPageData.length

        const allClasses = Array.isArray(firstPageData) ? [...firstPageData] : []
        const totalPages = Math.min(LMS_MAX_PAGES, Math.ceil(total / LMS_ITEMS_PER_PAGE))

        if (totalPages > 1 && authHeader) {
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1)
          const results = await Promise.allSettled(
            remainingPages.map((page) => fetchLmsBatch(page, LMS_ITEMS_PER_PAGE, search, statusList)),
          )
          results.forEach((res) => {
            if (res.status === 'fulfilled' && res.value) {
              const pageData = res.value?.data?.classes?.data || res.value?.classes?.data || []
              if (Array.isArray(pageData)) {
                allClasses.push(...pageData)
              }
            }
          })
        }

        return uniqueClassesById(allClasses)
      }

      // Xử lý nạp lớp học:
      // Trường hợp 1: Người dùng có từ khóa tìm kiếm cụ thể (ví dụ: LBB-C4K-GB32-ONL-HB)
      if (searchQuery) {
        try {
          rawClasses = await fetchAllLmsClasses(['RUNNING', 'PREPARING', 'FINISHED'], searchQuery)
        } catch (err: any) {
          console.warn('[team-metrics] Search LMS call failed, falling back:', err?.message)
          tokenSession = await loginFallbackLmsAccount()
          if (tokenSession.token) {
            authHeader = `Bearer ${tokenSession.token}`
            rawClasses = await fetchAllLmsClasses(['RUNNING', 'PREPARING', 'FINISHED'], searchQuery)
          }
        }
        activeTokenSession = tokenSession
      } else {
        // Trường hợp 2: Lấy dữ liệu tổng quan:
        // Đảm bảo nạp đủ các trang RUNNING/PREPARING thay vì dừng sớm ở vài trang đầu.
        const primaryStatuses =
          selectedStatusFilter === 'all'
            ? ['RUNNING', 'PREPARING']
            : [selectedStatusFilter.toUpperCase()]

        try {
          rawClasses = await fetchAllLmsClasses(primaryStatuses)
        } catch (err: any) {
          console.warn('[team-metrics] Initial LMS call failed, falling back:', err?.message)
          tokenSession = await loginFallbackLmsAccount()
          if (tokenSession.token) {
            authHeader = `Bearer ${tokenSession.token}`
            rawClasses = await fetchAllLmsClasses(primaryStatuses)
          }
        }
        activeTokenSession = tokenSession

        // Nếu user đang xem tổng quan: chỉ lấy thêm trang đầu FINISHED để giữ dashboard nhẹ.
        if (selectedStatusFilter === 'all') {
          const finishedClasses = await fetchLmsBatch(0, LMS_ITEMS_PER_PAGE, undefined, ['FINISHED'])
            .then((res) => res?.data?.classes?.data || res?.classes?.data || [])
            .catch(() => [])

          if (Array.isArray(finishedClasses)) {
            rawClasses.push(...finishedClasses)
          }
        }
      }

      try {
        runningClassesForTeacherMap = await fetchAllLmsClasses(['RUNNING'])
      } catch (err: any) {
        console.warn('[team-metrics] Running-class LMS call failed, using already fetched classes:', err?.message)
        runningClassesForTeacherMap = rawClasses.filter((cls) => normalizeStatus(cls?.status) === 'RUNNING')
      }

      rawClasses = uniqueClassesById(rawClasses)
      runningClassesForTeacherMap = uniqueClassesById([
        ...rawClasses.filter((cls) => normalizeStatus(cls?.status) === 'RUNNING'),
        ...runningClassesForTeacherMap,
      ])
    } catch (lmsErr) {
      console.warn('[team-metrics] LMS fetch error (non-fatal):', lmsErr)
    }

    // Phân quyền dữ liệu lớp học:
    // 1. Nếu dùng token LMS cá nhân của account (isFallback !== true):
    //    LMS GraphQL API đã tự động giới hạn danh sách lớp học theo đúng quyền của account đó trên LMS.
    //    Vì vậy, tất cả các lớp LMS trả về đều là dữ liệu hợp lệ mà account đó được phép xem.
    //    Nếu là Leader chuyên môn (CL, AL, RL), đảm bảo thêm rằng lớp học khớp với khối chuyên môn.
    // 2. Nếu rơi vào fallback LMS token (service account admin MindX):
    //    LMS trả về toàn bộ lớp toàn quốc, lúc này ta áp dụng phân quyền theo account trên TPS:
    //    - Super Admin: Xem toàn bộ.
    //    - CL (Coding Leader): Chỉ lấy các lớp khối Coding.
    //    - AL (Art Leader): Chỉ lấy các lớp khối Art.
    //    - RL (Robotics Leader): Chỉ lấy các lớp khối Robotics.
    //    - TE/TC: Nếu có cơ sở phụ trách (allowedCenterTokens), chỉ lấy các lớp thuộc các cơ sở đó.
    const isUsingUserLmsToken = activeTokenSession && activeTokenSession.isFallback === false

    const classMatchesAccess = (cls: any) => {
      if (isSuperAdmin) return true

      // Nếu dùng token LMS của chính user: LMS đã phân quyền theo account
      if (isUsingUserLmsToken) {
        if (isCL || isAL || isRL) {
          return isCourseMatchingRole(cls, specialtySourceRoles)
        }
        return true
      }

      // Nếu dùng fallback service token: áp dụng phân quyền theo role TPS
      if (isCL || isAL || isRL) {
        return isCourseMatchingRole(cls, specialtySourceRoles)
      }

      // Đối với TE, TC: lọc theo cơ sở phụ trách nếu có
      if (allowedCenterTokens.size > 0) {
        const centerCandidates = [
          cls?.centre?.shortName,
          cls?.centre?.name,
          cls?.centre?.id,
        ]
          .map(normalizeKey)
          .filter(Boolean)

        return centerCandidates.some((candidate) => {
          for (const token of allowedCenterTokens) {
            if (candidate.includes(token) || token.includes(candidate)) return true
          }
          return false
        })
      }

      return true
    }

    const filteredClasses = uniqueClassesById(rawClasses).filter(classMatchesAccess)
    const filteredRunningClassesForTeacherMap = uniqueClassesById(
      runningClassesForTeacherMap.length > 0
        ? runningClassesForTeacherMap
        : rawClasses.filter((cls) => normalizeStatus(cls?.status) === 'RUNNING'),
    )
      .filter((cls) => normalizeStatus(cls?.status) === 'RUNNING')
      .filter(classMatchesAccess)

    // Tổng hợp tất cả các cơ sở mà account có quyền:
    // Kết hợp giữa assignedCenters từ DB TPS và tất cả các cơ sở xuất hiện trong lớp học LMS của account đó
    const centerMap = new Map<string, { id: number; fullName: string; shortCode: string | null; region: string | null }>()

    assignedCenters.forEach((c) => {
      const key = normalizeKey(c.full_name || c.short_code || String(c.id))
      if (key) {
        centerMap.set(key, {
          id: c.id,
          fullName: c.full_name,
          shortCode: c.short_code,
          region: c.region || null,
        })
      }
    })

    filteredClasses.forEach((cls) => {
      const cName = String(cls?.centre?.name || cls?.centre?.shortName || '').trim()
      const cShort = String(cls?.centre?.shortName || '').trim()
      const key = normalizeKey(cName || cShort)
      if (key && !centerMap.has(key)) {
        centerMap.set(key, {
          id: Number(cls?.centre?.id) || Math.floor(Math.random() * 90000) + 10000,
          fullName: cName || cShort,
          shortCode: cShort || null,
          region: null,
        })
      }
    })

    const accessibleCentersList = Array.from(centerMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))

    // 4. XÂY DỰNG teacherClassMap TỪ TẤT CẢ CÁC LỚP ĐANG RUNNING Ở TẤT CẢ CÁC CƠ SỞ (filteredClasses)
    // Để danh sách các lớp phụ trách của giáo viên luôn gồm tất cả các lớp đang running ở mọi cơ sở,
    // không bị mất khi người dùng chọn lọc theo một cơ sở cụ thể.
    const extractLecturers = (
      cls: any,
      options: {
        includeSlotTeachers?: boolean
        refineFromSlotTeachers?: boolean
        includeTeacherAttendance?: boolean
      } = {},
    ) => {
      const classTeacherMap = new Map<
        string,
        {
          id: string
          code: string
          fullName: string
          email: string
          role: string
          roleCode: 'LEC' | 'TA'
          username?: string
          isFromClassLevel?: boolean
        }
      >()
      let hasClassLevelTeachers = false

      const setTeacherEntry = (
        key: string,
        entry: {
          id: string
          code: string
          fullName: string
          email: string
          role: string
          roleCode: 'LEC' | 'TA'
          username?: string
          isFromClassLevel?: boolean
        },
        mode: 'add' | 'refine' = 'add',
      ) => {
        const existing = classTeacherMap.get(key)
        if (!existing) {
          if (mode === 'add') classTeacherMap.set(key, entry)
          return
        }

        if (existing.roleCode !== 'TA' && entry.roleCode === 'TA') {
          classTeacherMap.set(key, {
            ...existing,
            role: entry.role,
            roleCode: entry.roleCode,
          })
        }
      }

      if (Array.isArray(cls?.teachers)) {
        for (const t of cls.teachers) {
          if (t?.isActive === false) continue
          const teacherObj = t?.teacher
          if (!teacherObj) continue

          const fullName = String(teacherObj.fullName || teacherObj.username || teacherObj.code || '').trim()
          const code = String(teacherObj.code || '').trim()
          const email = String(teacherObj.email || '').trim()
          const id = String(teacherObj.id || '')
          const username = String(teacherObj.username || '').trim()

          const key = (email || code || username || fullName || id).toLowerCase()
          if (!key) continue

          const roleInfo = parseTeacherRole(t?.role)
          hasClassLevelTeachers = true

          setTeacherEntry(key, {
            id,
            code,
            fullName: fullName || code || email,
            email,
            role: roleInfo.role,
            roleCode: roleInfo.roleCode,
            username,
            isFromClassLevel: true,
          })
        }
      }

      const includeSlotTeachers = options.includeSlotTeachers ?? !hasClassLevelTeachers
      const refineFromSlotTeachers = options.refineFromSlotTeachers ?? hasClassLevelTeachers
      const includeTeacherAttendance = options.includeTeacherAttendance ?? false

      if (Array.isArray(cls?.slots)) {
        for (const slot of cls.slots) {
          if (Array.isArray(slot?.teachers)) {
            for (const st of slot.teachers) {
              if (st?.isActive === false) continue
              const teacherObj = st?.teacher
              if (!teacherObj) continue

              const fullName = String(teacherObj.fullName || teacherObj.username || teacherObj.code || '').trim()
              const code = String(teacherObj.code || '').trim()
              const email = String(teacherObj.email || '').trim()
              const id = String(teacherObj.id || '')
              const username = String(teacherObj.username || '').trim()

              const key = (email || code || username || fullName || id).toLowerCase()
              if (!key) continue

              const roleInfo = parseTeacherRole(st?.role)
              const slotTeacherEntry = {
                id,
                code,
                fullName: fullName || code || email,
                email,
                role: roleInfo.role,
                roleCode: roleInfo.roleCode,
                username,
                isFromClassLevel: false,
              }

              if (includeSlotTeachers) {
                setTeacherEntry(key, slotTeacherEntry)
              } else if (refineFromSlotTeachers) {
                setTeacherEntry(key, slotTeacherEntry, 'refine')
              }
            }
          }

          if (includeTeacherAttendance && Array.isArray(slot?.teacherAttendance)) {
            for (const attendance of slot.teacherAttendance) {
              const teacherObj = attendance?.teacher
              if (!teacherObj) continue

              const fullName = String(teacherObj.fullName || teacherObj.username || teacherObj.code || '').trim()
              const code = String(teacherObj.code || '').trim()
              const email = String(teacherObj.email || '').trim()
              const id = String(teacherObj.id || '')
              const username = String(teacherObj.username || '').trim()

              const key = (email || code || username || fullName || id).toLowerCase()
              if (!key || classTeacherMap.has(key)) continue

              setTeacherEntry(key, {
                id,
                code,
                fullName: fullName || code || email,
                email,
                role: 'Giảng viên chính',
                roleCode: 'LEC',
                username,
                isFromClassLevel: false,
              })
            }
          }
        }
      }

      return Array.from(classTeacherMap.values()).sort((a, b) => {
        if (a.roleCode === 'LEC' && b.roleCode !== 'LEC') return -1
        if (a.roleCode !== 'LEC' && b.roleCode === 'LEC') return 1
        return a.fullName.localeCompare(b.fullName)
      })
    }

    const teacherClassMap = new Map<
      string,
      Array<{ id: string; name: string; role: string; roleCode?: 'LEC' | 'TA'; courseLineName?: string }>
    >()

    filteredRunningClassesForTeacherMap.forEach((cls) => {
      if (normalizeStatus(cls?.status) === 'RUNNING') {
        const courseLineName = String(cls?.course?.courseLine?.name || cls?.course?.name || '')
        const classSummaryInfo = {
          id: String(cls.id),
          name: String(cls.name || ''),
          role: 'Giảng viên',
          courseLineName,
          status: cls.status,
        }

        const lecturers = extractLecturers(cls, {
          includeSlotTeachers: true,
          refineFromSlotTeachers: true,
          includeTeacherAttendance: true,
        })
        lecturers.forEach((lec) => {
          const classInfoWithRole = {
            ...classSummaryInfo,
            role: lec.role,
            roleCode: lec.roleCode,
          }

          const keysToRegister = new Set<string>()
          addTeacherLookupKeys(keysToRegister, lec)

          keysToRegister.forEach((k) => {
            if (!k) return
            const existing = teacherClassMap.get(k) || []
            if (!existing.some((item) => item.id === classInfoWithRole.id)) {
              existing.push(classInfoWithRole)
            }
            teacherClassMap.set(k, existing)
          })
        })
      }
    })

    // Lọc lớp học hiển thị theo cơ sở đã chọn
    const finalClasses = filteredClasses.filter((cls) => {
      if (selectedCenterFilter === 'all') return true
      const normSelected = normalizeKey(selectedCenterFilter)
      const cand = [cls?.centre?.name, cls?.centre?.shortName].map(normalizeKey)
      return cand.some((c) => c.includes(normSelected) || normSelected.includes(c))
    })

    const formattedClasses = finalClasses.map((cls) => {
      const activeStudents = (cls?.students ?? []).filter((s: any) => s?.activeInClass !== false)
      const lecturers = extractLecturers(cls)
      const courseLineName = String(cls?.course?.courseLine?.name || cls?.course?.name || '')

      // Thông tin slots (buổi học)
      const slots = (cls?.slots ?? []).map((slot: any, idx: number) => {
        const slotTeachers = (slot?.teachers ?? [])
          .filter((t: any) => t?.isActive !== false)
          .map((t: any) => String(t?.teacher?.fullName || t?.teacher?.code || ''))
          .filter(Boolean)

        const studentAttCount = Array.isArray(slot?.studentAttendance) ? slot.studentAttendance.length : 0

        return {
          id: String(slot?._id || idx),
          sessionIndex: idx + 1,
          date: slot?.date || null,
          startTime: slot?.startTime || null,
          endTime: slot?.endTime || null,
          sessionHour: slot?.sessionHour || null,
          teacherNames: slotTeachers,
          studentAttendanceCount: studentAttCount,
        }
      })

      return {
        id: String(cls.id),
        name: String(cls.name || ''),
        status: cls.status || 'RUNNING',
        startDate: cls.startDate || null,
        endDate: cls.endDate || null,
        numberOfSessions: cls.numberOfSessions || slots.length || 0,
        courseName: cls?.course?.name || cls?.course?.shortName || '',
        courseLineName,
        centreName: cls?.centre?.name || cls?.centre?.shortName || '',
        centreShortName: cls?.centre?.shortName || '',
        studentCount: activeStudents.length,
        students: activeStudents.map((s: any) => ({
          id: String(s?.student?.id || s?._id),
          fullName: String(s?.student?.fullName || 'Học viên'),
          email: s?.student?.email || '',
          phoneNumber: s?.student?.phoneNumber || '',
        })),
        teachers: lecturers,
        slots,
      }
    })

    // 4.3. ĐẢM BẢO LẤY ĐỦ HẾT TẤT CẢ GIÁO VIÊN ĐỨNG LỚP:
    // Nếu giáo viên có đứng lớp trong nhóm phụ trách (kể cả cross-centre hay chưa có record trong bảng teachers), tự động bổ sung vào teachersInGroup
    const findTeacherProfileByKeys = (keys: Set<string>) => {
      for (const key of keys) {
        const profile = teacherProfilesByKey.get(key)
        if (profile) return profile
      }
      return null
    }

    const mergeTeacherProfile = (teacher: any, keys?: Set<string>) => {
      const lookupKeys = keys || new Set<string>()
      if (!keys) addTeacherLookupKeys(lookupKeys, teacher)

      const profile = findTeacherProfileByKeys(lookupKeys)
      if (!profile) return teacher

      return {
        ...profile,
        ...teacher,
        code: teacher.code || profile.code,
        full_name: teacher.full_name || profile.full_name,
        user_name: teacher.user_name || profile.user_name,
        work_email: teacher.work_email || profile.work_email,
        main_centre: teacher.main_centre || profile.main_centre,
        khoi_final: teacher.khoi_final || profile.khoi_final,
        course_line: teacher.course_line || profile.course_line,
        teaching_block: teacher.teaching_block || profile.teaching_block,
        current_role: teacher.current_role || profile.current_role,
        status: teacher.status || profile.status,
      }
    }

    const existingTeacherKeys = new Set<string>()
    for (const t of teachersInGroup) {
      addTeacherLookupKeys(existingTeacherKeys, t)
    }

    formattedClasses.forEach((cls) => {
      (cls.teachers || []).forEach((lec: any) => {
        const lecturerKeys = new Set<string>()
        addTeacherLookupKeys(lecturerKeys, lec)
        const hasTeacher = Array.from(lecturerKeys).some((key) => existingTeacherKeys.has(key))

        if (!hasTeacher) {
          teachersInGroup.push(mergeTeacherProfile({
            code: lec.code || '',
            full_name: lec.fullName || lec.username || lec.code || 'Giáo viên',
            user_name: lec.username || '',
            work_email: lec.email || '',
            main_centre: cls.centreName || cls.centreShortName || '',
            khoi_final: cls.courseLineName || '',
            course_line: cls.courseLineName || '',
            teaching_block: cls.courseLineName || '',
            current_role: '',
            status: 'Active',
          }, lecturerKeys))
          lecturerKeys.forEach((key) => existingTeacherKeys.add(key))
        }
      })
    })

    // 5. Kết hợp thông tin số lớp đang dạy & khối giảng dạy vào danh sách giáo viên
    const enrichedTeachers = teachersInGroup.map((t) => {
      const teacherLookupKeys = new Set<string>()
      addTeacherLookupKeys(teacherLookupKeys, t)
      const teacher = mergeTeacherProfile(t, teacherLookupKeys)

      const assignedClasses = Array.from(teacherLookupKeys).reduce<
        Array<{ id: string; name: string; role: string; roleCode?: 'LEC' | 'TA'; courseLineName?: string }>
      >((items, key) => {
        const matched = teacherClassMap.get(key) || []
        matched.forEach((item) => {
          if (!items.some((existing) => existing.id === item.id)) {
            items.push(item)
          }
        })
        return items
      }, [])

      // Xác định khối giảng dạy: ưu tiên Khối final trong DB
      // Nếu DB chưa có hoặc là #N/A, tự động suy ra từ các lớp học giáo viên phụ trách
      let finalCourseLine = String(teacher.khoi_final || teacher.course_line || teacher.teaching_block || '').trim()
      if (!finalCourseLine || finalCourseLine === '#N/A') {
        const inferredLines = Array.from(
          new Set(
            assignedClasses
              .map((c) => c.courseLineName?.trim())
              .filter((line): line is string => Boolean(line && line !== '#N/A')),
          ),
        )
        if (inferredLines.length > 0) {
          finalCourseLine = inferredLines.join(', ')
        }
      }

      const roleCodesForTeacher = Array.from(
        new Set(
          assignedClasses
            .map((c) => c.roleCode)
            .filter((roleCode): roleCode is 'LEC' | 'TA' => Boolean(roleCode)),
        ),
      )

      return {
        code: teacher.code,
        fullName: teacher.full_name,
        email: teacher.work_email,
        mainCentre: teacher.main_centre,
        courseLine: finalCourseLine || 'Chưa phân khối',
        teachingRole: roleCodesForTeacher.join(', '),
        position: String(teacher.current_role || '').trim(),
        currentRole: String(teacher.current_role || '').trim(),
        status: teacher.status,
        classesCount: assignedClasses.length,
        assignedClasses,
      }
    })

    // Lọc tiếp danh sách giáo viên nếu user chọn lọc theo cơ sở cụ thể
    const finalTeachers = enrichedTeachers.filter((t) => {
      if (selectedCenterFilter === 'all') return true
      const normSelected = normalizeKey(selectedCenterFilter)
      const cand = normalizeKey(t.mainCentre)
      const teachesInSelectedCenter = (t.assignedClasses || []).some((c) => {
        const matchedClass = formattedClasses.find((fc) => String(fc.id) === c.id)
        if (!matchedClass) return false
        const cName = normalizeKey(matchedClass.centreName)
        const cShort = normalizeKey(matchedClass.centreShortName)
        return cName.includes(normSelected) || cShort.includes(normSelected)
      })
      return cand.includes(normSelected) || normSelected.includes(cand) || teachesInSelectedCenter
    })

    // 6. Tính toán các chỉ số KPI tóm tắt
    const totalTeachers = finalTeachers.length
    const totalClasses = formattedClasses.length
    const totalRunningClasses = formattedClasses.filter((c) => c.status === 'RUNNING').length
    const totalPreparingClasses = formattedClasses.filter((c) => c.status === 'PREPARING').length
    const totalFinishedClasses = formattedClasses.filter((c) => c.status === 'FINISHED').length
    const totalStudents = formattedClasses.reduce((sum, c) => sum + c.studentCount, 0)
    const activeTeachersWithClasses = finalTeachers.filter((t) => t.classesCount > 0).length

    const response = NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTeachers,
          totalClasses,
          totalRunningClasses,
          totalPreparingClasses,
          totalFinishedClasses,
          totalStudents,
          activeTeachersWithClasses,
        },
        centers: accessibleCentersList,
        classes: formattedClasses,
        teachers: finalTeachers,
      },
    })

    if (activeTokenSession) {
      applyRefreshedCookies(response, activeTokenSession)
    }

    return response
  } catch (error: any) {
    console.error('[team-metrics] Error processing dashboard data:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi xử lý dữ liệu nhóm phụ trách' },
      { status: 500 },
    )
  }
})
