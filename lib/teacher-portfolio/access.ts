import 'server-only'

import { resolveAppUserAccessForEmail } from '@/lib/app-user-access'
import pool from '@/lib/db'

export type TeacherPortfolioOwnerRow = Record<string, unknown> & {
  code: string
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function splitTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitTokens)
  const raw = String(value ?? '').trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.flatMap(splitTokens)
    } catch {
      // Tiếp tục với cách tách chuỗi thông thường.
    }
  }
  return raw
    .split(/[\n,;|]+/g)
    .map(normalize)
    .filter(Boolean)
}

function ownerEmails(row: Record<string, unknown>): Set<string> {
  return new Set(
    [row.work_email, row['Work email'], row.personal_email]
      .map(normalize)
      .filter(Boolean),
  )
}

function teacherCenterTokens(row: Record<string, unknown>): Set<string> {
  return new Set(
    [row.main_centre, row['Main centre'], row.centers, row.center]
      .flatMap(splitTokens)
      .filter(Boolean),
  )
}

export async function findTeacherForPortfolioSession(
  sessionEmail: string,
): Promise<TeacherPortfolioOwnerRow | null> {
  const email = normalize(sessionEmail)
  if (!email) return null
  const username = email.includes('@') ? email.split('@')[0] : email
  const result = await pool.query(
    `SELECT *
     FROM teachers
     WHERE LOWER(TRIM(COALESCE(work_email, ''))) = $1
        OR LOWER(TRIM(COALESCE("Work email", ''))) = $1
        OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1
        OR LOWER(TRIM(COALESCE(user_name, ''))) = $2
        OR LOWER(TRIM(COALESCE("User name", ''))) = $2
     LIMIT 1`,
    [email, username],
  )
  return (result.rows[0] as TeacherPortfolioOwnerRow | undefined) ?? null
}

export async function resolveTeacherPortfolioAccess(
  viewerEmail: string,
  teacher: TeacherPortfolioOwnerRow,
): Promise<{
  allowed: boolean
  isOwner: boolean
  canVerifyAchievements: boolean
}> {
  const normalizedViewer = normalize(viewerEmail)
  const isOwner = ownerEmails(teacher).has(normalizedViewer)
  if (isOwner) {
    return { allowed: true, isOwner: true, canVerifyAchievements: false }
  }

  const access = await resolveAppUserAccessForEmail(normalizedViewer)
  if (!access.isActive || !access.found) {
    return { allowed: false, isOwner: false, canVerifyAchievements: false }
  }

  const isSuperAdmin = access.role === 'super_admin'
  const allowedCenterTokens = new Set(
    access.assignedCenters
      .flatMap((center) => [center.full_name, center.short_code ?? ''])
      .map(normalize)
      .filter(Boolean),
  )
  const centerMatches = [...teacherCenterTokens(teacher)].some((token) =>
    allowedCenterTokens.has(token),
  )
  const allowed = isSuperAdmin || centerMatches

  const reviewerRoleCodes = new Set([
    'TE',
    'TEGL',
    'TEGL+',
    'LEAD',
    'LEADER',
    'TM',
    'TC',
  ])
  const hasReviewerRole = access.userRoles.some((role) =>
    reviewerRoleCodes.has(String(role).trim().toUpperCase()),
  )
  const canVerifyAchievements =
    allowed && (isSuperAdmin || hasReviewerRole || normalizedViewer.includes('hoteaching'))

  return { allowed, isOwner: false, canVerifyAchievements }
}

