import { requireBearerDbRoles } from '@/lib/auth-server'
import { getAccessibleCenters } from '@/lib/center-access'
import { callLmsApi } from '@/lib/lms-api'
import {
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
  applyRefreshedCookies,
} from '@/lib/lms-token-helper'
import { getQCWindowInfo } from '@/lib/qc-time-window'
import { NextRequest, NextResponse } from 'next/server'

const GET_QC_CLASSES_QUERY = /* graphql */ `
  query GetClasses(
    $search: String,
    $statusIn: [String],
    $startDateTo: Date,
    $endDateFrom: Date,
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String
  ) {
    classes(payload: {
      filter_textSearch: $search,
      status_in: $statusIn,
      startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom,
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
          student { id fullName }
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

type AccessibleCenter = {
  id: number
  full_name: string
  short_code: string | null
  region: string | null
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function buildCenterKeys(centers: AccessibleCenter[]): Set<string> {
  const keys = new Set<string>()
  centers.forEach((center) => {
    ;[center.id, center.short_code, center.full_name].forEach((value) => {
      const key = normalizeKey(value)
      if (key) keys.add(key)
    })
  })
  return keys
}

function isClassInAccessibleCenter(cls: any, allowedKeys: Set<string> | null) {
  if (!allowedKeys) return true
  const candidates = [
    cls?.centre?.shortName,
    cls?.centre?.name,
    cls?.centre?.id,
  ]
    .map(normalizeKey)
    .filter(Boolean)

  return candidates.some((candidate) => {
    if (allowedKeys.has(candidate)) return true
    for (const allowed of allowedKeys) {
      if (candidate.includes(allowed) || allowed.includes(candidate)) return true
    }
    return false
  })
}

function toIsoBoundary(dateText: string | null, fallback: Date, endOfDay = false) {
  const raw = dateText?.trim()
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback.toISOString()
  const suffix = endOfDay ? 'T23:59:59.999+07:00' : 'T00:00:00.000+07:00'
  return new Date(`${raw}${suffix}`).toISOString()
}

function isLecturerAssignment(item: any): boolean {
  if (item?.isActive === false) return false
  const roleValues = [
    item?.role?.shortName,
    item?.role?.name,
    item?.role?.code,
  ].map((value) => String(value ?? '').trim().toUpperCase())
  return roleValues.includes('LEC')
}

function teacherAccountFromAssignment(item: any) {
  const teacher = item?.teacher ?? {}
  const fullName = String(teacher?.fullName ?? '').trim()
  const email = String(teacher?.email ?? '').trim()
  const username = String(teacher?.username ?? '').trim()
  const code = String(teacher?.code ?? '').trim()
  const id = String(teacher?.id ?? '').trim()

  if (!fullName && !email && !username && !code && !id) return null

  return {
    id,
    fullName,
    email,
    username,
    code,
  }
}

function lecturerAccounts(assignments: any[]): Array<{
  id: string
  fullName: string
  email: string
  username: string
  code: string
}> {
  const seen = new Set<string>()
  const accounts: Array<{
    id: string
    fullName: string
    email: string
    username: string
    code: string
  }> = []

  assignments.forEach((item) => {
    if (!isLecturerAssignment(item)) return
    const account = teacherAccountFromAssignment(item)
    if (!account) return
    const key = account.id || account.email || account.username || account.code || account.fullName
    if (seen.has(key)) return
    seen.add(key)
    accounts.push(account)
  })

  return accounts
}

function teacherNamesFromAccounts(
  accounts: Array<{ fullName: string; username: string; email: string; code: string }>,
): string[] {
  return accounts
    .map((account) => account.fullName || account.username || account.email || account.code)
    .filter(Boolean)
}

function mapClass(cls: any, now: Date) {
  const activeStudents = (cls?.students ?? []).filter((item: any) => item?.activeInClass !== false)
  const slots = (cls?.slots ?? [])
    .slice()
    .sort((a: any, b: any) => {
      const aTime = new Date(a?.date || a?.startTime || 0).getTime()
      const bTime = new Date(b?.date || b?.startTime || 0).getTime()
      return aTime - bTime
    })
    .map((slot: any, index: number) => {
      const teacherAccounts = lecturerAccounts(slot?.teachers ?? [])
      const session = {
        id: String(slot?._id ?? ''),
        date: slot?.date ?? null,
        startTime: slot?.startTime ?? null,
        endTime: slot?.endTime ?? null,
        sessionHour: slot?.sessionHour ?? null,
        sessionIndex: index + 1,
        teacherNames: teacherNamesFromAccounts(teacherAccounts),
        teacherAccounts,
        studentAttendanceCount: Array.isArray(slot?.studentAttendance)
          ? slot.studentAttendance.length
          : 0,
      }

      return {
        ...session,
        ...getQCWindowInfo(session, now),
      }
    })
  const eligibleSessionCount = slots.filter((slot: { canCreateQC: boolean }) => slot.canCreateQC).length

  const teacherAccounts = lecturerAccounts(cls?.teachers ?? [])

  return {
    id: String(cls?.id ?? ''),
    name: String(cls?.name ?? ''),
    status: cls?.status ?? null,
    startDate: cls?.startDate ?? null,
    endDate: cls?.endDate ?? null,
    numberOfSessions: cls?.numberOfSessions ?? null,
    courseName: cls?.course?.name ?? cls?.course?.shortName ?? '',
    courseLineName: cls?.course?.courseLine?.name ?? '',
    centreId: cls?.centre?.id ?? null,
    centreName: cls?.centre?.name ?? '',
    centreShortName: cls?.centre?.shortName ?? '',
    teacherNames: teacherNamesFromAccounts(teacherAccounts),
    teacherAccounts,
    studentCount: activeStudents.length,
    slots,
    eligibleSessionCount,
    canCreateQC: eligibleSessionCount > 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')?.trim() || undefined
    const today = new Date()
    const startFallback = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const endFallback = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000)
    const endDateFrom = toIsoBoundary(searchParams.get('from'), startFallback)
    const startDateTo = toIsoBoundary(searchParams.get('to'), endFallback, true)

    const accessibleCenters =
      gate.role === 'super_admin' ? null : await getAccessibleCenters(gate.sessionEmail)
    const allowedKeys =
      gate.role === 'super_admin'
        ? null
        : buildCenterKeys((accessibleCenters ?? []) as AccessibleCenter[])

    if (allowedKeys && allowedKeys.size === 0) {
      return NextResponse.json({ success: true, classes: [], total: 0 })
    }

    // Tự động làm mới token LMS hoặc sử dụng fallback service account
    let tokenSession = await getOrRefreshLmsToken(request)
    let authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined
    const itemsPerPage = 100
    const maxPages = 20
    const variables = {
      search: q,
      statusIn: ['RUNNING', 'PREPARING'],
      startDateTo,
      endDateFrom,
      pageIndex: 0,
      itemsPerPage,
      orderBy: 'startDate_asc',
    }

    let firstResult: any
    try {
      firstResult = await callLmsApi<any>(
        {
          query: GET_QC_CLASSES_QUERY,
          operationName: 'GetClasses',
          variables,
        },
        authHeader,
      )
    } catch (err: any) {
      console.warn(
        '[quan-ly-qc/classes] LMS token call failed:',
        err?.message,
        '- Retrying with fallback account...',
      )
      tokenSession = await loginFallbackLmsAccount()
      if (tokenSession.token) {
        authHeader = `Bearer ${tokenSession.token}`
        firstResult = await callLmsApi<any>(
          {
            query: GET_QC_CLASSES_QUERY,
            operationName: 'GetClasses',
            variables,
          },
          authHeader,
        )
      } else {
        throw err
      }
    }

    const firstPage = firstResult?.data?.classes
    const allClasses = Array.isArray(firstPage?.data) ? [...firstPage.data] : []
    const total = Number(firstPage?.pagination?.total ?? allClasses.length)
    const totalPages = Math.min(Math.ceil(total / itemsPerPage), maxPages)

    for (let pageIndex = 1; pageIndex < totalPages; pageIndex += 1) {
      try {
        const pageResult = await callLmsApi<any>(
          {
            query: GET_QC_CLASSES_QUERY,
            operationName: 'GetClasses',
            variables: { ...variables, pageIndex },
          },
          authHeader,
        )
        const pageRows = pageResult?.data?.classes?.data
        if (!Array.isArray(pageRows) || pageRows.length === 0) break
        allClasses.push(...pageRows)
      } catch (pageErr) {
        console.warn(
          `[quan-ly-qc/classes] Error fetching page ${pageIndex}:`,
          pageErr,
        )
        break
      }
    }

    const now = new Date()
    let classes = allClasses
      .filter((cls) => isClassInAccessibleCenter(cls, allowedKeys))
      .map((cls) => mapClass(cls, now))

    // Thu thập danh sách Khối (Course Lines) có trong dữ liệu
    const courseLineSet = new Set<string>()
    classes.forEach((cls) => {
      if (cls.courseLineName) {
        courseLineSet.add(cls.courseLineName)
      }
    })
    const availableCourseLines = Array.from(courseLineSet).sort((a, b) =>
      a.localeCompare(b, 'vi'),
    )

    // Lọc theo Cơ sở nếu có param
    const centreParam = searchParams.get('centre')?.trim()
    if (centreParam && centreParam !== 'all') {
      const targetCenter = (accessibleCenters || []).find(
        (c: any) =>
          c.full_name === centreParam ||
          c.short_code === centreParam ||
          String(c.id) === centreParam,
      )

      const targetKeys = new Set<string>()
      targetKeys.add(normalizeKey(centreParam))
      if (targetCenter) {
        if (targetCenter.full_name) targetKeys.add(normalizeKey(targetCenter.full_name))
        if (targetCenter.short_code) targetKeys.add(normalizeKey(targetCenter.short_code))
        if (targetCenter.id) targetKeys.add(normalizeKey(targetCenter.id))
      }

      classes = classes.filter((cls) => {
        const c1 = normalizeKey(cls.centreName)
        const c2 = normalizeKey(cls.centreShortName)
        const c3 = normalizeKey(cls.centreId)
        for (const k of targetKeys) {
          if (!k) continue
          if (c1 === k || c2 === k || c3 === k) return true
          if (c1.includes(k) || k.includes(c1)) return true
          if (c2.includes(k) || k.includes(c2)) return true
        }
        return false
      })
    }

    // Lọc theo Khối nếu có param
    const courseLineParam =
      searchParams.get('courseLine')?.trim() || searchParams.get('khoi')?.trim()
    if (courseLineParam && courseLineParam !== 'all') {
      const norm = normalizeKey(courseLineParam)
      classes = classes.filter((cls) => {
        const line = normalizeKey(cls.courseLineName)
        const course = normalizeKey(cls.courseName)
        return (
          line.includes(norm) ||
          course.includes(norm) ||
          norm.includes(line)
        )
      })
    }

    const response = NextResponse.json({
      success: true,
      classes,
      total: classes.length,
      lmsTotal: total,
      accessibleCenters: (accessibleCenters || []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        short_code: c.short_code,
      })),
      availableCourseLines,
      truncated: totalPages === maxPages && total > maxPages * itemsPerPage,
    })

    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải danh sách lớp QC'
    console.error('[quan-ly-qc/classes] error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
