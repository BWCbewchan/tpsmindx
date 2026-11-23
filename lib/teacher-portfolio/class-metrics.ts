import 'server-only'

import { callLmsApiAllowPartialWithOptions } from '@/lib/lms-api'
import { loginFallbackLmsAccount } from '@/lib/lms-token-helper'
import type { TeacherPortfolioOwnerRow } from './access'

const METRICS_CACHE_MS = 10 * 60 * 1000
const ALLOWED_STATUSES = ['RUNNING', 'FINISHED', 'PREPARING'] as const

const metricsCache = new Map<string, { expiresAt: number; value: TeacherClassMetrics }>()
let cachedLmsAuth: { authHeader: string; expiresAt: number } | null = null

const GET_TEACHER_BY_CODE_QUERY = /* graphql */ `
  query GetTeacherPortfolioTeacher($code: String) {
    teachers(payload: {
      code_eq: $code
      pageIndex: 0
      itemsPerPage: 10
    }) {
      data { id code username email fullName }
    }
  }
`

const COUNT_TEACHER_CLASSES_QUERY = /* graphql */ `
  query CountTeacherPortfolioClasses(
    $teacherSlots: [String]
    $statusIn: [String]
  ) {
    classes(payload: {
      teacherSlots: $teacherSlots
      status_in: $statusIn
      pageIndex: 0
      itemsPerPage: 1
    }) {
      pagination { total }
    }
  }
`

type LmsTeacher = {
  id?: string | null
  code?: string | null
  username?: string | null
  email?: string | null
  fullName?: string | null
}

export type TeacherClassMetrics = {
  classCount: number
  studentCount: null
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function normalize(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, ' ')
    .trim()
}

async function getLmsAuthHeader(): Promise<string | null> {
  if (cachedLmsAuth && cachedLmsAuth.expiresAt > Date.now()) {
    return cachedLmsAuth.authHeader
  }

  const tokenSession = await loginFallbackLmsAccount()
  if (!tokenSession.token) return null
  const authHeader = `Bearer ${tokenSession.token}`
  cachedLmsAuth = {
    authHeader,
    expiresAt: Date.now() + Math.max(60, (tokenSession.expiresIn || 3600) - 120) * 1000,
  }
  return authHeader
}

function teacherCode(teacher: TeacherPortfolioOwnerRow): string {
  return text(teacher.code)
}

function teacherMatchesOwner(
  lmsTeacher: LmsTeacher,
  teacher: TeacherPortfolioOwnerRow,
): boolean {
  const ownerCode = normalize(teacher.code)
  if (ownerCode && normalize(lmsTeacher.code) === ownerCode) return true

  const ownerEmails = new Set([
    normalize(teacher.work_email),
    normalize(teacher['Work email']),
    normalize(teacher.personal_email),
  ].filter(Boolean))
  if (ownerEmails.has(normalize(lmsTeacher.email))) return true

  const ownerUsernames = new Set([
    normalize(teacher.user_name),
    normalize(teacher['User name']),
  ].filter(Boolean))
  return ownerUsernames.has(normalize(lmsTeacher.username))
}

async function resolveLmsTeacherId(
  teacher: TeacherPortfolioOwnerRow,
  authHeader: string,
): Promise<string | null> {
  const code = teacherCode(teacher)
  if (!code) return null

  const result = await callLmsApiAllowPartialWithOptions<{
    data?: { teachers?: { data?: LmsTeacher[] } }
  }>(
    {
      query: GET_TEACHER_BY_CODE_QUERY,
      operationName: 'GetTeacherPortfolioTeacher',
      variables: { code },
    },
    authHeader,
    { timeoutMs: 15_000 },
  )

  const teachers = Array.isArray(result.data?.teachers?.data)
    ? result.data.teachers.data
    : []
  const match = teachers.find((candidate) => teacherMatchesOwner(candidate, teacher))
  return text(match?.id) || null
}

async function countTeacherClasses(
  teacherId: string,
  authHeader: string,
): Promise<number> {
  const result = await callLmsApiAllowPartialWithOptions<{
    data?: { classes?: { pagination?: { total?: number } } }
  }>(
    {
      query: COUNT_TEACHER_CLASSES_QUERY,
      operationName: 'CountTeacherPortfolioClasses',
      variables: {
        teacherSlots: [teacherId],
        statusIn: [...ALLOWED_STATUSES],
      },
    },
    authHeader,
    { timeoutMs: 15_000 },
  )

  const total = Number(result.data?.classes?.pagination?.total)
  if (!Number.isFinite(total) || total < 0) {
    throw new Error('LMS did not return a valid teacher class total.')
  }
  return total
}

/**
 * Counts the same RUNNING / FINISHED / PREPARING LMS classes shown in the Lớp học tab.
 * The LMS resolves this from Teacher.id + teacherSlots, so Portfolio does not scan every class.
 */
export async function loadTeacherClassMetrics(
  teacher: TeacherPortfolioOwnerRow,
): Promise<TeacherClassMetrics | null> {
  const code = teacherCode(teacher)
  if (!code) return null

  const cacheKey = normalize(code)
  const cached = metricsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const authHeader = await getLmsAuthHeader()
  if (!authHeader) return null

  const teacherId = await resolveLmsTeacherId(teacher, authHeader)
  if (!teacherId) return null

  const value: TeacherClassMetrics = {
    classCount: await countTeacherClasses(teacherId, authHeader),
    studentCount: null,
  }
  metricsCache.set(cacheKey, { value, expiresAt: Date.now() + METRICS_CACHE_MS })
  return value
}
