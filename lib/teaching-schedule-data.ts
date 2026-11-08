import pool from '@/lib/db'
import {
  TEACHING_SCHEDULE_ALLOWED_ROLE_CODES,
  TEACHING_SCHEDULE_MANUAL_ROSTER,
} from '@/lib/teaching-schedule'

const ALLOWED_ROLE_CODES = new Set<string>(TEACHING_SCHEDULE_ALLOWED_ROLE_CODES)

type StoredScheduleRow = Record<string, unknown> & {
  staff_email?: string
  staff_name?: string
}

type ScheduleIdentityReference = {
  email: string
  name: string
}

export type TeachingScheduleEntryRow = {
  id: number
  date: string
  pattern: string
  centreIds: number[]
  centreCodes: string[]
  flexible: boolean
  note: string
  updatedAt: string | null
}

export type TeachingScheduleTeamRow = {
  email: string
  code: string
  name: string
  roleCode: string
  entries: TeachingScheduleEntryRow[]
}

function normalizeRoleCode(value: unknown): string {
  return String(value || '').trim().toUpperCase()
}

function normalizePersonName(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function serializeTeachingScheduleEntry(
  row: Record<string, unknown>,
): TeachingScheduleEntryRow {
  return {
    id: Number(row.id),
    date: String(row.work_date),
    pattern: String(row.work_pattern),
    centreIds: Array.isArray(row.centre_ids)
      ? row.centre_ids.map(Number).filter(Number.isInteger)
      : [],
    centreCodes: Array.isArray(row.centre_codes)
      ? row.centre_codes.map(String)
      : [],
    flexible: Boolean(row.is_flexible),
    note: row.note ? String(row.note) : '',
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function getTeachingScheduleTeamRows(
  start: string,
  end: string,
  identity?: ScheduleIdentityReference,
): Promise<TeachingScheduleTeamRow[]> {
  const allowedRoles = Array.from(ALLOWED_ROLE_CODES)
  const [appUsersResult, leadersResult, teachersResult, schedulesResult] =
    await Promise.all([
      pool.query(
        `SELECT LOWER(TRIM(u.email)) AS email,
                COALESCE(NULLIF(TRIM(u.display_name), ''), SPLIT_PART(LOWER(TRIM(u.email)), '@', 1)) AS full_name,
                (
                  ARRAY_AGG(
                    UPPER(TRIM(ur.role_code))
                    ORDER BY ARRAY_POSITION($1::text[], UPPER(TRIM(ur.role_code)))
                  ) FILTER (WHERE UPPER(TRIM(ur.role_code)) = ANY($1::text[]))
                )[1] AS role_code
         FROM app_users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE u.is_active = true AND COALESCE(TRIM(u.email), '') <> ''
         GROUP BY u.id, u.email, u.display_name`,
        [allowedRoles],
      ),
      pool.query(
        `SELECT LOWER(TRIM(email)) AS email,
                COALESCE(NULLIF(TRIM(full_name), ''), code) AS full_name,
                UPPER(TRIM(role_code)) AS role_code
         FROM teaching_leaders
         WHERE status IS DISTINCT FROM 'Deactive'
           AND COALESCE(TRIM(full_name), '') <> ''`,
      ),
      pool.query(
        `SELECT LOWER(TRIM(COALESCE(work_email, "Work email", ''))) AS email,
                COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), ''), code) AS full_name,
                UPPER(TRIM(COALESCE(role, ''))) AS role_code
         FROM teachers
         WHERE COALESCE(TRIM(full_name), TRIM("Full name"), '') <> ''
           AND LOWER(COALESCE(status, "Status", status_update, 'active')) NOT LIKE '%deactive%'`,
      ),
      pool.query(
        `SELECT id,
                staff_email,
                staff_name,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
                work_pattern,
                centre_ids,
                centre_codes,
                is_flexible,
                note,
                updated_at
         FROM teaching_monthly_schedules
         WHERE work_date BETWEEN $1::date AND $2::date
         ORDER BY staff_name, work_date`,
        [start, end],
      ),
    ])

  type DirectoryRow = {
    source: 'app' | 'leader' | 'teacher'
    email: string
    roleCode: string
  }
  type TeamMember = TeachingScheduleTeamRow & { displayOrder: number }

  const directoryByName = new Map<string, DirectoryRow[]>()
  const addDirectoryRows = (
    source: DirectoryRow['source'],
    rows: Array<Record<string, unknown>>,
  ) => {
    for (const row of rows) {
      const key = normalizePersonName(row.full_name)
      if (!key) continue
      const roleCode = normalizeRoleCode(row.role_code)
      const item: DirectoryRow = {
        source,
        email: String(row.email || '').trim().toLowerCase(),
        roleCode:
          roleCode === 'TP'
            ? 'TF'
            : ALLOWED_ROLE_CODES.has(roleCode)
              ? roleCode
              : '',
      }
      const current = directoryByName.get(key) || []
      current.push(item)
      directoryByName.set(key, current)
    }
  }

  addDirectoryRows('app', appUsersResult.rows)
  addDirectoryRows('leader', leadersResult.rows)
  addDirectoryRows('teacher', teachersResult.rows)

  const repeatedNameIndex = new Map<string, number>()
  const team: TeamMember[] = TEACHING_SCHEDULE_MANUAL_ROSTER.map((row) => {
    const nameKey = normalizePersonName(row.name)
    const occurrence = repeatedNameIndex.get(nameKey) || 0
    repeatedNameIndex.set(nameKey, occurrence + 1)
    const candidates = directoryByName.get(nameKey) || []
    const appCandidate = candidates.find((candidate) => candidate.source === 'app')
    const leaderCandidate = candidates.find((candidate) => candidate.source === 'leader')
    const teacherCandidates = candidates.filter((candidate) => candidate.source === 'teacher')
    const candidate =
      appCandidate || leaderCandidate || teacherCandidates[occurrence] || teacherCandidates[0]

    return {
      displayOrder: row.order,
      email: candidate?.email || `roster-${row.order}@schedule.local`,
      code: row.code,
      name: row.name,
      roleCode: candidate?.roleCode || normalizeRoleCode(row.roleCode),
      entries: [],
    }
  })

  const byEmail = new Map(
    team
      .filter((person) => !person.email.endsWith('@schedule.local'))
      .map((person) => [person.email, person]),
  )
  const byName = new Map<string, TeamMember[]>()
  for (const person of team) {
    const key = normalizePersonName(person.name)
    const current = byName.get(key) || []
    current.push(person)
    byName.set(key, current)
  }

  for (const row of schedulesResult.rows as StoredScheduleRow[]) {
    const email = String(row.staff_email || '').trim().toLowerCase()
    const nameKey = normalizePersonName(row.staff_name)
    const member = byEmail.get(email) || byName.get(nameKey)?.[0]
    member?.entries.push(serializeTeachingScheduleEntry(row))
  }

  if (identity) {
    const identityMember =
      byEmail.get(identity.email) ||
      byName.get(normalizePersonName(identity.name))?.[0]
    if (identityMember && identityMember.email.endsWith('@schedule.local')) {
      identityMember.email = identity.email
    }
  }

  return team
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(({ displayOrder: _displayOrder, ...person }) => person)
}
