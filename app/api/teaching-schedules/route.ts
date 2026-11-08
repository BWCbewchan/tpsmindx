import { requireSameOriginMutation } from '@/lib/api-security'
import { getAccessibleCenters, getAllActiveCenters } from '@/lib/center-access'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  TEACHING_SCHEDULE_ALLOWED_ROLE_CODES,
  TEACHING_SCHEDULE_MANUAL_ROSTER,
  TEACHING_SCHEDULE_SESSIONS,
  getTeachingSchedulePattern,
  isOnsiteTeachingSchedulePattern,
  isTeachingSchedulePattern,
  type TeachingSchedulePattern,
} from '@/lib/teaching-schedule'
import { NextRequest, NextResponse } from 'next/server'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_NOTE_LENGTH = 500
const ALLOWED_ROLE_CODES = new Set<string>(TEACHING_SCHEDULE_ALLOWED_ROLE_CODES)

type ScheduleCentre = {
  id: number
  full_name: string
  short_code: string | null
  region: string | null
}

type ScheduleIdentity = {
  email: string
  code: string
  name: string
  roleCode: string
  roleName: string
  area: string | null
  elevated: boolean
}

type ScheduleEntryInput = {
  date: string
  pattern: TeachingSchedulePattern
  centreIds: number[]
  flexible: boolean
  note: string
}

type StoredScheduleRow = Record<string, unknown> & {
  staff_email?: string
  staff_code?: string
  staff_name?: string
  role_code?: string
}

function normalizeRoleCode(value: unknown): string {
  return String(value || '').trim().toUpperCase()
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || '').trim().slice(0, maxLength)
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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getMonthBounds(rawMonth: string) {
  if (!MONTH_PATTERN.test(rawMonth)) throw new Error('Tháng đăng ký không hợp lệ.')
  const [year, month] = rawMonth.split('-').map(Number)
  const firstDate = new Date(Date.UTC(year, month - 1, 1))
  const lastDate = new Date(Date.UTC(year, month, 0))
  const dates = Array.from({ length: lastDate.getUTCDate() }, (_, index) =>
    toDateKey(new Date(Date.UTC(year, month - 1, index + 1))),
  )
  return {
    month: rawMonth,
    start: dates[0],
    end: dates[dates.length - 1],
    dates,
    daysInMonth: dates.length,
  }
}

async function resolveScheduleIdentity(
  email: string,
  userRoles: string[],
  appRole: string,
): Promise<ScheduleIdentity | null> {
  const [leaderResult, teacherResult, appUserResult] = await Promise.all([
    pool.query(
      `SELECT code, full_name, role_code, role_name, area
       FROM teaching_leaders
       WHERE LOWER(TRIM(email)) = $1
         AND status IS DISTINCT FROM 'Deactive'
       LIMIT 1`,
      [email],
    ),
    pool.query(
      `SELECT code,
              COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), ''), code) AS full_name
       FROM teachers
       WHERE LOWER(TRIM(COALESCE(work_email, "Work email", ''))) = $1
       LIMIT 1`,
      [email],
    ),
    pool.query(
      `SELECT display_name
       FROM app_users
       WHERE LOWER(TRIM(email)) = $1 AND is_active = true
       LIMIT 1`,
      [email],
    ),
  ])

  const leader = leaderResult.rows[0] as
    | {
        code?: string
        full_name?: string
        role_code?: string
        role_name?: string
        area?: string
      }
    | undefined
  const teacher = teacherResult.rows[0] as
    | { code?: string; full_name?: string }
    | undefined
  const appUser = appUserResult.rows[0] as { display_name?: string } | undefined
  const candidates = [...userRoles, leader?.role_code || ''].map(normalizeRoleCode)
  const roleCode = candidates.find((code) => ALLOWED_ROLE_CODES.has(code))
  const elevated = appRole === 'super_admin' || appRole === 'admin'

  if (!roleCode && !elevated) return null

  return {
    email,
    code: leader?.code || teacher?.code || email.split('@')[0] || email,
    name:
      leader?.full_name ||
      teacher?.full_name ||
      appUser?.display_name ||
      email.split('@')[0] ||
      email,
    roleCode: roleCode || normalizeRoleCode(appRole),
    roleName: leader?.role_name || roleCode || (elevated ? 'Quản trị hệ thống' : ''),
    area: leader?.area || null,
    elevated,
  }
}

function centreMatchesTeacherValue(centre: ScheduleCentre, rawValue: string) {
  const target = rawValue.trim().toLowerCase()
  if (!target) return false
  const candidates = [centre.full_name, centre.short_code || '', centre.region || '']
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return candidates.some(
    (item) => item === target || item.includes(target) || target.includes(item),
  )
}

async function getScheduleCentres(identity: ScheduleIdentity) {
  if (identity.elevated || identity.roleCode === 'HO') return getAllActiveCenters()

  const accessible = await getAccessibleCenters(identity.email)
  if (accessible.length > 0) return accessible

  const teacherResult = await pool.query(
    `SELECT COALESCE(main_centre, "Main centre", centers) AS main_centre
     FROM teachers
     WHERE LOWER(TRIM(COALESCE(work_email, "Work email", ''))) = $1
     LIMIT 1`,
    [identity.email],
  )
  const mainCentre = String(teacherResult.rows[0]?.main_centre || '').trim()
  if (!mainCentre) return []

  const allCentres = await getAllActiveCenters()
  const tokens = mainCentre
    .split(/[,;|\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
  return allCentres.filter((centre) =>
    tokens.some((token) => centreMatchesTeacherValue(centre, token)),
  )
}

async function requireScheduleUser(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth

  const identity = await resolveScheduleIdentity(
    auth.sessionEmail.trim().toLowerCase(),
    auth.resolvedAccess.userRoles,
    auth.resolvedAccess.role,
  )
  if (!identity) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: 'Chức năng dành cho TEGL+, TEGL/HO, Leader/TE/TC và TF.',
        },
        { status: 403 },
      ),
    }
  }

  const centres = await getScheduleCentres(identity)
  const managedCentreIds = new Set(centres.map((centre) => centre.id))
  const otherCentres = (await getAllActiveCenters()).filter(
    (centre) => !managedCentreIds.has(centre.id),
  )
  return { ok: true as const, identity, centres, otherCentres }
}

function parseEntries(
  rawEntries: unknown,
  allowedDates: Set<string>,
  allowedCentreIds: Set<number>,
): ScheduleEntryInput[] {
  if (!Array.isArray(rawEntries) || rawEntries.length > 31) {
    throw new Error('Lịch đăng ký phải nằm trong một tháng.')
  }

  const seenDates = new Set<string>()
  return rawEntries.map((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== 'object') {
      throw new Error('Dữ liệu ngày làm việc không hợp lệ.')
    }
    const item = rawEntry as Record<string, unknown>
    const date = normalizeText(item.date, 10)
    if (!allowedDates.has(date) || seenDates.has(date)) {
      throw new Error(`Ngày ${date || 'trống'} không thuộc tháng đăng ký hoặc bị trùng.`)
    }
    seenDates.add(date)

    if (!isTeachingSchedulePattern(item.pattern)) {
      throw new Error(`Ca làm ngày ${date} không hợp lệ.`)
    }
    const pattern = item.pattern
    let selectedCentreIds = (Array.isArray(item.centreIds) ? item.centreIds : [])
      .map(Number)
    const onsite = isOnsiteTeachingSchedulePattern(pattern)
    const sessionCount = getTeachingSchedulePattern(pattern)?.sessions.length || 0
    if (onsite && selectedCentreIds.length === 1 && sessionCount > 1) {
      selectedCentreIds = Array(sessionCount).fill(selectedCentreIds[0])
    }
    if (
      onsite
      && (
        selectedCentreIds.length !== sessionCount
        || selectedCentreIds.some((id) => !Number.isInteger(id) || !allowedCentreIds.has(id))
      )
    ) {
      throw new Error(`Vui lòng chọn cơ sở làm việc cho từng ca trong ngày ${date}.`)
    }

    return {
      date,
      pattern,
      centreIds: onsite ? selectedCentreIds : [],
      flexible: onsite && Boolean(item.flexible),
      note: normalizeText(item.note, MAX_NOTE_LENGTH),
    }
  })
}

function serializeEntry(row: Record<string, unknown>) {
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

async function getTeamRows(start: string, end: string, identity: ScheduleIdentity) {
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
        `SELECT LOWER(TRIM(COALESCE(work_email, \"Work email\", ''))) AS email,
                COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM(\"Full name\"), ''), code) AS full_name,
                UPPER(TRIM(COALESCE(role, ''))) AS role_code
         FROM teachers
         WHERE COALESCE(TRIM(full_name), TRIM(\"Full name\"), '') <> ''
           AND LOWER(COALESCE(status, \"Status\", status_update, 'active')) NOT LIKE '%deactive%'`,
      ),
      pool.query(
        `SELECT id,
                staff_email,
                staff_code,
                staff_name,
                role_code,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
                work_pattern,
                centre_ids,
                centre_codes,
                is_flexible,
                note,
                updated_at
         FROM teaching_monthly_schedules
         WHERE work_date BETWEEN $1::date AND $2::date
         ORDER BY staff_name, staff_code, work_date`,
        [start, end],
      ),
    ])

  type DirectoryRow = {
    source: 'app' | 'leader' | 'teacher'
    email: string
    name: string
    roleCode: string
  }
  type TeamMember = {
    displayOrder: number
    email: string
    code: string
    name: string
    roleCode: string
    entries: ReturnType<typeof serializeEntry>[]
  }

  const directoryByName = new Map<string, DirectoryRow[]>()
  const addDirectoryRows = (
    source: DirectoryRow['source'],
    rows: Array<Record<string, unknown>>,
  ) => {
    for (const row of rows) {
      const name = String(row.full_name || '').trim()
      const key = normalizePersonName(name)
      if (!key) continue
      const roleCode = normalizeRoleCode(row.role_code)
      const item: DirectoryRow = {
        source,
        email: String(row.email || '').trim().toLowerCase(),
        name,
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
  const team: TeamMember[] = TEACHING_SCHEDULE_MANUAL_ROSTER.map(
    (row) => {
      const name = row.name
      const nameKey = normalizePersonName(name)
      const occurrence = repeatedNameIndex.get(nameKey) || 0
      repeatedNameIndex.set(nameKey, occurrence + 1)
      const candidates = directoryByName.get(nameKey) || []
      const appCandidate = candidates.find((candidate) => candidate.source === 'app')
      const leaderCandidate = candidates.find((candidate) => candidate.source === 'leader')
      const teacherCandidates = candidates.filter((candidate) => candidate.source === 'teacher')
      const candidate =
        appCandidate || leaderCandidate || teacherCandidates[occurrence] || teacherCandidates[0]
      const fallbackRole = normalizeRoleCode(row.roleCode)
      return {
        displayOrder: row.order,
        email: candidate?.email || `roster-${row.order}@schedule.local`,
        code: row.code,
        name,
        roleCode: candidate?.roleCode || fallbackRole || 'TEAM TEACHING',
        entries: [],
      }
    },
  )

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
    member?.entries.push(serializeEntry(row))
  }

  const identityMember = byEmail.get(identity.email) || byName.get(normalizePersonName(identity.name))?.[0]
  if (identityMember && identityMember.email.endsWith('@schedule.local')) {
    identityMember.email = identity.email
  }

  return team
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ displayOrder: _displayOrder, ...person }) => person)
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireScheduleUser(request)
    if (!gate.ok) return gate.response

    const { month, start, end } = getMonthBounds(
      request.nextUrl.searchParams.get('month') || '',
    )
    const [result, team] = await Promise.all([
      pool.query(
        `SELECT id,
                TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
                work_pattern,
                centre_ids,
                centre_codes,
                is_flexible,
                note,
                updated_at
         FROM teaching_monthly_schedules
         WHERE staff_email = $1
           AND work_date BETWEEN $2::date AND $3::date
         ORDER BY work_date`,
        [gate.identity.email, start, end],
      ),
      getTeamRows(start, end, gate.identity),
    ])

    return NextResponse.json({
      success: true,
      month,
      data: result.rows.map(serializeEntry),
      team,
      profile: gate.identity,
      centres: gate.centres.map((centre) => ({
        id: centre.id,
        name: centre.full_name,
        shortCode: centre.short_code || centre.full_name,
        region: centre.region || '',
      })),
      otherCentres: gate.otherCentres.map((centre) => ({
        id: centre.id,
        name: centre.full_name,
        shortCode: centre.short_code || centre.full_name,
        region: centre.region || '',
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Không tải được lịch tháng.'
    console.error('[teaching-schedules GET]', error)
    const status = /không hợp lệ/i.test(message) ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function PUT(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const client = await pool.connect()
  let inTransaction = false
  try {
    const gate = await requireScheduleUser(request)
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => ({}))
    const { month, start, end, dates } = getMonthBounds(normalizeText(body?.month, 7))
    const selectableCentres = [...gate.centres, ...gate.otherCentres]
    const centresById = new Map(selectableCentres.map((centre) => [centre.id, centre]))
    const entries = parseEntries(
      body?.entries,
      new Set(dates),
      new Set(centresById.keys()),
    )

    await client.query('BEGIN')
    inTransaction = true
      await client.query(
        `DELETE FROM teaching_monthly_schedules
         WHERE staff_email = $1
           AND (
             work_date BETWEEN $2::date AND $3::date
             OR (work_date < $2::date AND $2::date <= CURRENT_DATE)
           )`,
        [gate.identity.email, start, end],
      )

    for (const entry of entries) {
      const selectedCentres = entry.centreIds
        .map((id) => centresById.get(id))
        .filter((centre) => centre !== undefined)
      const centreCodes = selectedCentres.map(
        (centre) => centre.short_code || centre.full_name,
      )
      const inserted = await client.query(
        `INSERT INTO teaching_monthly_schedules (
           staff_email,
           staff_code,
           staff_name,
           role_code,
           work_date,
           work_pattern,
           centre_ids,
           centre_codes,
           is_flexible,
           note
         )
         VALUES ($1, $2, $3, $4, $5::date, $6, $7::int[], $8::text[], $9, $10)
         RETURNING id`,
        [
          gate.identity.email,
          gate.identity.code,
          gate.identity.name,
          gate.identity.roleCode,
          entry.date,
          entry.pattern,
          entry.centreIds,
          centreCodes,
          entry.flexible,
          entry.note || null,
        ],
      )
      const sourceScheduleId = Number(inserted.rows[0].id)
      const patternMeta = getTeachingSchedulePattern(entry.pattern)

      for (const [sessionIndex, sessionName] of (patternMeta?.sessions || []).entries()) {
        const session = TEACHING_SCHEDULE_SESSIONS[sessionName]
        await client.query(
          `INSERT INTO dangky_lich_lam (
             ma_gv,
             ngay,
             gio_bat_dau,
             gio_ket_thuc,
             co_so_uu_tien,
             linh_hoat,
             kieu_lap,
             schedule_source,
             source_schedule_id
           )
           VALUES ($1, $2::date, $3::time, $4::time, $5::text[], $6, 'thang', 'teaching_monthly', $7)`,
          [
            gate.identity.code,
            entry.date,
            session.from,
            session.to,
            centreCodes[sessionIndex] ? [centreCodes[sessionIndex]] : [],
            entry.flexible,
            sourceScheduleId,
          ],
        )
      }
    }

    await client.query('COMMIT')
    inTransaction = false
    return NextResponse.json({
      success: true,
      saved: entries.length,
      message: `Đã lưu ${entries.length} ngày làm việc cho tháng ${month}.`,
    })
  } catch (error: unknown) {
    if (inTransaction) await client.query('ROLLBACK')
    const message = error instanceof Error ? error.message : 'Không lưu được lịch tháng.'
    console.error('[teaching-schedules PUT]', error)
    const status = /không hợp lệ|vui lòng|bị trùng|không thuộc/i.test(message) ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  } finally {
    client.release()
  }
}
