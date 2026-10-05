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
            teacher { id fullName email }
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
  const norm = normalizeKey(combined)

  let match = false
  if (isCL) {
    if (
      norm.includes('c4k') ||
      norm.includes('c3k') ||
      norm.includes('c2k') ||
      norm.includes('creator') ||
      norm.includes('khoahocmaytinh') ||
      norm.includes('kid') ||
      norm.includes('code') ||
      norm.includes('coding') ||
      norm.includes('laptrinh') ||
      norm.includes('python') ||
      norm.includes('web') ||
      norm.includes('scratch') ||
      norm.includes('game') ||
      norm.includes('app') ||
      norm.includes('cs') ||
      norm.includes('computer') ||
      norm.includes('java') ||
      norm.includes('cplus') ||
      norm.includes('c++') ||
      norm.includes('data') ||
      norm.includes('ai')
    ) {
      match = true
    }
  }

  if (isAL) {
    if (
      norm.includes('art') ||
      norm.includes('mythuat') ||
      norm.includes('dohoa') ||
      norm.includes('graphic') ||
      norm.includes('photoshop') ||
      norm.includes('illustrator') ||
      norm.includes('blender') ||
      norm.includes('drawing') ||
      norm.includes('2d') ||
      norm.includes('3d') ||
      norm.includes('uiux') ||
      norm.includes('thietke')
    ) {
      match = true
    }
  }

  if (isRL) {
    if (
      norm.includes('robot') ||
      norm.includes('robotics') ||
      norm.includes('lego') ||
      norm.includes('vex') ||
      norm.includes('wedo') ||
      norm.includes('stem') ||
      norm.includes('spike') ||
      norm.includes('mindstorm')
    ) {
      match = true
    }
  }

  return match
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  const access = auth.resolvedAccess
  const roleCodes = (access.userRoles || []).map((r) => String(r).toUpperCase().trim())
  if (access.role) {
    roleCodes.push(String(access.role).toUpperCase().trim())
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

  const isCL = roleCodes.includes('CL')
  const isAL = roleCodes.includes('AL')
  const isRL = roleCodes.includes('RL')
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
    try {
      const teacherQuery = `
        SELECT
          t.code,
          COALESCE(NULLIF(t.full_name, ''), t."Full name") AS full_name,
          COALESCE(NULLIF(t.user_name, ''), t."User name") AS user_name,
          COALESCE(NULLIF(t.work_email, ''), t."Work email") AS work_email,
          COALESCE(NULLIF(t.main_centre, ''), t."Main centre") AS main_centre,
          COALESCE(NULLIF(t.course_line, ''), t."Course Line", tts.teaching_block) AS course_line,
          COALESCE(NULLIF(tts.teaching_block, ''), NULLIF(t.course_line, ''), t."Course Line") AS teaching_block,
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

      // Lọc giáo viên từ DB:
      // Super Admin: xem tất cả
      // Leader chuyên môn (CL, AL, RL): lấy giáo viên theo môn chuyên môn hoặc cơ sở phụ trách
      // TE/TC: lấy giáo viên theo cơ sở phụ trách
      teachersInGroup = teacherRes.rows.filter((teacher) => {
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

        // Leader chuyên môn (CL, AL, RL): kiểm tra thêm khối giảng dạy của giáo viên
        let subjectMatch = false
        if (isCL || isAL || isRL) {
          const teacherBlock = normalizeKey(`${teacher.course_line || ''} ${teacher.teaching_block || ''}`)
          if (
            isCL &&
            (teacherBlock.includes('code') ||
              teacherBlock.includes('coding') ||
              teacherBlock.includes('laptrinh') ||
              teacherBlock.includes('python') ||
              teacherBlock.includes('web') ||
              teacherBlock.includes('scratch'))
          ) {
            subjectMatch = true
          }
          if (
            isAL &&
            (teacherBlock.includes('art') ||
              teacherBlock.includes('mythuat') ||
              teacherBlock.includes('dohoa') ||
              teacherBlock.includes('graphic'))
          ) {
            subjectMatch = true
          }
          if (
            isRL &&
            (teacherBlock.includes('robot') ||
              teacherBlock.includes('robotics') ||
              teacherBlock.includes('lego') ||
              teacherBlock.includes('stem'))
          ) {
            subjectMatch = true
          }
        }

        if (isCL || isAL || isRL) {
          return subjectMatch || centerMatch
        }

        return centerMatch || allowedCenterTokens.size === 0
      })
    } finally {
      client.release()
    }

    // 3. Lấy dữ liệu lớp học từ LMS GraphQL (lấy đầy đủ nhiều trang nếu có)
    let rawClasses: any[] = []
    let activeTokenSession: any = null
    try {
      let tokenSession = await getOrRefreshLmsToken(request)
      let authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined

      const statuses = selectedStatusFilter === 'all'
        ? ['RUNNING', 'PREPARING', 'FINISHED']
        : [selectedStatusFilter.toUpperCase()]

      const fetchLmsBatch = async (
        page: number,
        limit: number = 100,
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

      // Xử lý nạp lớp học:
      // Trường hợp 1: Người dùng có từ khóa tìm kiếm cụ thể (ví dụ: LBB-C4K-GB32-ONL-HB)
      if (searchQuery) {
        let lmsRes: any
        try {
          lmsRes = await fetchLmsBatch(0, 100, searchQuery, ['RUNNING', 'PREPARING', 'FINISHED'])
        } catch (err: any) {
          console.warn('[team-metrics] Search LMS call failed, falling back:', err?.message)
          tokenSession = await loginFallbackLmsAccount()
          if (tokenSession.token) {
            authHeader = `Bearer ${tokenSession.token}`
            lmsRes = await fetchLmsBatch(0, 100, searchQuery, ['RUNNING', 'PREPARING', 'FINISHED'])
          }
        }
        activeTokenSession = tokenSession
        rawClasses = lmsRes?.data?.classes?.data || lmsRes?.classes?.data || []
      } else {
        // Trường hợp 2: Lấy dữ liệu tổng quan:
        // ĐẢM BẢO LẤY ĐỦ 100% TẤT CẢ CÁC LỚP ĐANG RUNNING & PREPARING TRÊN TOÀN BỘ CÁC CƠ SỞ (khoảng 470 lớp = 5 trang x 100)
        let initialRes: any
        try {
          initialRes = await fetchLmsBatch(0, 100, undefined, ['RUNNING', 'PREPARING'])
        } catch (err: any) {
          console.warn('[team-metrics] Initial LMS call failed, falling back:', err?.message)
          tokenSession = await loginFallbackLmsAccount()
          if (tokenSession.token) {
            authHeader = `Bearer ${tokenSession.token}`
            initialRes = await fetchLmsBatch(0, 100, undefined, ['RUNNING', 'PREPARING'])
          }
        }
        activeTokenSession = tokenSession

        const firstPageData = initialRes?.data?.classes?.data || initialRes?.classes?.data || []
        const totalRunningAndPreparing =
          Number(initialRes?.data?.classes?.pagination?.total || initialRes?.classes?.pagination?.total) ||
          firstPageData.length

        rawClasses = [...firstPageData]

        // Fetch song song toàn bộ các trang còn lại của RUNNING & PREPARING để đảm bảo 100% không sót lớp
        if (totalRunningAndPreparing > 100 && authHeader) {
          const totalPages = Math.min(8, Math.ceil(totalRunningAndPreparing / 100))
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1)
          const results = await Promise.allSettled(
            remainingPages.map((page) => fetchLmsBatch(page, 100, undefined, ['RUNNING', 'PREPARING'])),
          )
          results.forEach((res) => {
            if (res.status === 'fulfilled' && res.value) {
              const pageData = res.value?.data?.classes?.data || res.value?.classes?.data || []
              if (Array.isArray(pageData)) {
                rawClasses.push(...pageData)
              }
            }
          })
        }

        // Nếu user đang lọc hoặc muốn xem lớp FINISHED: nạp thêm các lớp FINISHED
        if (selectedStatusFilter === 'finished' || selectedStatusFilter === 'all') {
          const finishedRes = await fetchLmsBatch(0, 100, undefined, ['FINISHED']).catch(() => null)
          const finishedData = finishedRes?.data?.classes?.data || finishedRes?.classes?.data || []
          if (Array.isArray(finishedData)) {
            rawClasses.push(...finishedData)
          }
        }
      }
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

    const filteredClasses = rawClasses.filter((cls) => {
      if (isSuperAdmin) return true

      // Nếu dùng token LMS của chính user: LMS đã phân quyền theo account
      if (isUsingUserLmsToken) {
        if (isCL || isAL || isRL) {
          return isCourseMatchingRole(cls, roleCodes)
        }
        return true
      }

      // Nếu dùng fallback service token: áp dụng phân quyền theo role TPS
      if (isCL || isAL || isRL) {
        return isCourseMatchingRole(cls, roleCodes)
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
    })

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
    const extractLecturers = (cls: any) => {
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

          classTeacherMap.set(key, {
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

              if (!classTeacherMap.has(key)) {
                const roleInfo = parseTeacherRole(st?.role)
                classTeacherMap.set(key, {
                  id,
                  code,
                  fullName: fullName || code || email,
                  email,
                  role: roleInfo.role,
                  roleCode: roleInfo.roleCode,
                  username,
                  isFromClassLevel: false,
                })
              }
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
      Array<{ id: string; name: string; role: string; courseLineName?: string }>
    >()

    filteredClasses.forEach((cls) => {
      if (cls.status === 'RUNNING') {
        const courseLineName = String(cls?.course?.courseLine?.name || cls?.course?.name || '')
        const classSummaryInfo = {
          id: String(cls.id),
          name: String(cls.name || ''),
          role: 'Giảng viên',
          courseLineName,
          status: cls.status,
        }

        const lecturers = extractLecturers(cls)
        lecturers.forEach((lec) => {
          const classInfoWithRole = {
            ...classSummaryInfo,
            role: lec.role,
            roleCode: lec.roleCode,
          }

          const keysToRegister = new Set<string>()
          if (lec.email) keysToRegister.add(`email:${normalizeKey(lec.email)}`)
          if (lec.code) keysToRegister.add(`code:${normalizeKey(lec.code)}`)
          if (lec.username) keysToRegister.add(`user:${normalizeKey(lec.username)}`)

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
    const existingTeacherKeys = new Set<string>()
    for (const t of teachersInGroup) {
      if (t.work_email) existingTeacherKeys.add(`email:${normalizeKey(t.work_email)}`)
      if (t.code) existingTeacherKeys.add(`code:${normalizeKey(t.code)}`)
      if (t.user_name) existingTeacherKeys.add(`user:${normalizeKey(t.user_name)}`)
    }

    formattedClasses.forEach((cls) => {
      (cls.teachers || []).forEach((lec: any) => {
        const hasTeacher =
          (lec.email && existingTeacherKeys.has(`email:${normalizeKey(lec.email)}`)) ||
          (lec.code && existingTeacherKeys.has(`code:${normalizeKey(lec.code)}`)) ||
          (lec.username && existingTeacherKeys.has(`user:${normalizeKey(lec.username)}`))

        if (!hasTeacher) {
          teachersInGroup.push({
            code: lec.code || '',
            full_name: lec.fullName || lec.username || lec.code || 'Giáo viên',
            user_name: lec.username || '',
            work_email: lec.email || '',
            main_centre: cls.centreName || cls.centreShortName || '',
            course_line: cls.courseLineName || '',
            teaching_block: cls.courseLineName || '',
            status: 'Active',
          })
          if (lec.email) existingTeacherKeys.add(`email:${normalizeKey(lec.email)}`)
          if (lec.code) existingTeacherKeys.add(`code:${normalizeKey(lec.code)}`)
          if (lec.username) existingTeacherKeys.add(`user:${normalizeKey(lec.username)}`)
        }
      })
    })

    // 5. Kết hợp thông tin số lớp đang dạy & khối giảng dạy vào danh sách giáo viên
    const enrichedTeachers = teachersInGroup.map((t) => {
      const emailKey = t.work_email ? `email:${normalizeKey(t.work_email)}` : ''
      const codeKey = t.code ? `code:${normalizeKey(t.code)}` : ''
      const userKey = t.user_name ? `user:${normalizeKey(t.user_name)}` : ''

      // Tra cứu CHÍNH XÁC bằng email, code hoặc username duy nhất (KHÔNG dùng fullName hay email prefix ngắn)
      const assignedClasses =
        (emailKey ? teacherClassMap.get(emailKey) : null) ||
        (codeKey ? teacherClassMap.get(codeKey) : null) ||
        (userKey ? teacherClassMap.get(userKey) : null) ||
        []

      // Xác định khối giảng dạy: ưu tiên t.course_line / t.teaching_block trong DB
      // Nếu DB chưa có hoặc là #N/A, tự động suy ra từ các lớp học giáo viên phụ trách
      let finalCourseLine = String(t.course_line || t.teaching_block || '').trim()
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

      return {
        code: t.code,
        fullName: t.full_name,
        email: t.work_email,
        mainCentre: t.main_centre,
        courseLine: finalCourseLine || 'Chưa phân khối',
        status: t.status,
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
