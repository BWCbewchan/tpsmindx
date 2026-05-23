import { requireBearerSession } from '@/lib/datasource-api-auth'
import { eventScheduleTsAsTimestamptz, eventScheduleTsInstantExpr } from '@/lib/event-schedule-time'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type CurrentUser = {
  id: number
  email: string
  role: string
  userRoles: string[]
}

async function getCurrentUser(sessionEmail: string): Promise<CurrentUser | null> {
  const userResult = await pool.query(
    `SELECT id, email, role FROM app_users WHERE LOWER(TRIM(email)) = $1 AND is_active = true LIMIT 1`,
    [sessionEmail.trim().toLowerCase()],
  )

  if (userResult.rows.length === 0) return null

  const user = userResult.rows[0] as { id: number; email: string; role: string }
  const rolesResult = await pool.query(
    'SELECT role_code FROM user_roles WHERE user_id = $1',
    [user.id],
  )

  return {
    id: user.id,
    email: user.email,
    role: String(user.role || ''),
    userRoles: rolesResult.rows.map((r: { role_code: string }) =>
      String(r.role_code || '').toUpperCase(),
    ),
  }
}

function canRegisterLectureReview(user: CurrentUser): boolean {
  const role = user.role.toLowerCase()
  if (['super_admin', 'admin', 'manager'].includes(role)) return true

  const elevated = new Set([
    'LEADER',
    'TE',
    'ACADEMIC_LEADER',
    'CODING_LEADER',
  ])

  return user.userRoles.some((r) => elevated.has(r))
}

  async function getEventScheduleColumns(): Promise<Set<string>> {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'event_schedules'`,
    )

    return new Set(
      result.rows.map((row: any) => String(row.column_name || '').trim().toLowerCase()).filter(Boolean),
    )
  }

async function getTeacherColumns(): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'teachers'`,
  )

  return new Set(
    result.rows.map((row: any) => String(row.column_name || '').trim().toLowerCase()).filter(Boolean),
  )
}

async function getCenterColumns(): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'centers'`,
  )

  return new Set(
    result.rows.map((row: any) => String(row.column_name || '').trim().toLowerCase()).filter(Boolean),
  )
}

function buildTeacherCenterExpr(columns: Set<string>): string {
  const parts: string[] = []
  if (columns.has('main_centre')) parts.push("NULLIF(t.main_centre, '')")
  if (columns.has('main centre')) parts.push("NULLIF(t.\"Main centre\", '')")
  if (columns.has('centers')) parts.push("NULLIF(t.centers, '')")
  return parts.length > 0 ? `COALESCE(${parts.join(', ')})` : 'NULL'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const eventId = request.nextUrl.searchParams.get('event_id')
    const columns = await getEventScheduleColumns()
    const teacherColumns = await getTeacherColumns()
    const centerColumns = await getCenterColumns()
    const hasMode = columns.has('mode')
    const hasRoom = columns.has('room')
    const hasCenterId = columns.has('center_id')
    const teacherCenterExpr = buildTeacherCenterExpr(teacherColumns)
    const centerJoin = hasCenterId ? 'LEFT JOIN centers c ON c.id = es.center_id' : ''

    const values: any[] = []
    let query = `
      SELECT
        lrr.id,
        lrr.event_id,
        lrr.te_leader_id,
        lrr.teacher_code,
        lrr.lecture_reviewer,
        lrr.review_lesson,
        lrr.date_regist,
        lrr.status,
        lrr.created_at,
        lrr.updated_at,
        es.ten AS event_title,
        ${eventScheduleTsAsTimestamptz('es', 'bat_dau_luc')},
        ${eventScheduleTsAsTimestamptz('es', 'ket_thuc_luc')},
        ${hasCenterId ? 'es.center_id' : 'NULL::INTEGER AS center_id'},
        ${hasRoom ? 'es.room' : 'NULL::VARCHAR AS room'},
        ${hasMode ? 'es.mode' : 'NULL::VARCHAR AS mode'},
        ${hasCenterId && centerColumns.has('display_name') ? 'c.display_name' : 'NULL::VARCHAR AS center_name'},
        ${hasCenterId && centerColumns.has('address') ? 'c.address' : 'NULL::VARCHAR AS center_address'},
        ${hasCenterId && centerColumns.has('full_address') ? 'c.full_address' : 'NULL::VARCHAR AS center_full_address'},
        ${hasCenterId && centerColumns.has('map_url') ? 'c.map_url' : 'NULL::TEXT AS center_map_url'},
        COALESCE(NULLIF(t.full_name, ''), NULLIF(t."Full name", ''), t.code) AS teacher_name,
        COALESCE(NULLIF(t.work_email, ''), NULLIF(t."Work email", '')) AS teacher_email,
        ${teacherCenterExpr} AS teacher_center
      FROM lecture_review_registrations lrr
      JOIN event_schedules es ON es.id = lrr.event_id
      ${centerJoin}
      LEFT JOIN teachers t ON t.code = lrr.teacher_code
      WHERE TRUE
    `

    const teacherCode = request.nextUrl.searchParams.get('teacher_code')
    if (eventId) {
      values.push(eventId)
      query += ` AND lrr.event_id = $${values.length}::uuid`
    }

    if (teacherCode) {
      values.push(teacherCode)
      query += ` AND LOWER(lrr.teacher_code) = LOWER($${values.length})`
    }
    const teacherEmail = request.nextUrl.searchParams.get('teacher_email')
    if (teacherEmail) {
      values.push(teacherEmail)
      query += ` AND LOWER(COALESCE(t.work_email, t.email, '')) = LOWER($${values.length})`
    }

    query += ' ORDER BY es.bat_dau_luc ASC, lrr.created_at DESC'

    const result = await pool.query(query, values)
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    })
  } catch (error: any) {
    console.error('[lecture-review-registrations][GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch registrations' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const user = await getCurrentUser(auth.sessionEmail)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tài khoản người dùng hiện tại' },
        { status: 403 },
      )
    }

    if (!canRegisterLectureReview(user)) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền đăng ký lịch duyệt giảng' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const eventId = String(body.event_id || '').trim()
    const teacherCode = String(body.teacher_code || body.lms_code || '').trim()
    const lectureReviewer =
      body.lecture_reviewer != null ? String(body.lecture_reviewer).trim() : null

    if (!eventId || !teacherCode) {
      return NextResponse.json(
        { success: false, error: 'event_id và teacher_code là bắt buộc' },
        { status: 400 },
      )
    }

    const columns = await getEventScheduleColumns()
    const teacherColumns = await getTeacherColumns()
    const teacherCenterExpr = buildTeacherCenterExpr(teacherColumns)

    const eventResult = await pool.query(
      `SELECT *,
              ${eventScheduleTsInstantExpr('event_schedules', 'bat_dau_luc')} AS _es_bat_tz,
              ${eventScheduleTsInstantExpr('event_schedules', 'ket_thuc_luc')} AS _es_ket_tz
       FROM event_schedules
       WHERE id = $1::uuid
       LIMIT 1`,
      [eventId],
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy lịch duyệt giảng' },
        { status: 404 },
      )
    }

    const rawEvent = eventResult.rows[0] as Record<string, unknown> & {
      id: string
      loai_su_kien: string
      bat_dau_luc: unknown
      ket_thuc_luc: unknown
      _es_bat_tz?: unknown
      _es_ket_tz?: unknown
      center_id?: number | null
      allow_registration?: boolean
      slot_limit?: number | null
      trang_thai?: string
      lecture_reviewer?: string | null
    }

    const event = {
      ...rawEvent,
      bat_dau_luc: rawEvent._es_bat_tz ?? rawEvent.bat_dau_luc,
      ket_thuc_luc: rawEvent._es_ket_tz ?? rawEvent.ket_thuc_luc,
    }

    if (String(event.loai_su_kien || '').toLowerCase() !== 'teaching_review') {
      return NextResponse.json(
        { success: false, error: 'Chỉ cho phép đăng ký với sự kiện teaching_review' },
        { status: 400 },
      )
    }

    const allowRegistration = columns.has('allow_registration') ? Boolean(event.allow_registration) : true
    if (!allowRegistration) {
      return NextResponse.json(
        { success: false, error: 'Sự kiện này chưa mở đăng ký' },
        { status: 400 },
      )
    }

    const eventStatus = columns.has('trang_thai')
      ? String(event.trang_thai || 'scheduled').toLowerCase()
      : 'scheduled'
    if (!['scheduled', 'rescheduled'].includes(eventStatus)) {
      return NextResponse.json(
        { success: false, error: 'Sự kiện không còn khả dụng để đăng ký' },
        { status: 400 },
      )
    }

    const endAt = new Date(event.ket_thuc_luc as string | number | Date)
    if (!Number.isNaN(endAt.getTime()) && endAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Sự kiện đã kết thúc, không thể đăng ký' },
        { status: 400 },
      )
    }

    const teacherResult = await pool.query(
      `SELECT
         t.code,
         COALESCE(NULLIF(t.full_name, ''), NULLIF(t."Full name", ''), t.code) AS teacher_name,
         ${teacherCenterExpr} AS teacher_center,
         c.id AS center_id
       FROM teachers t
       LEFT JOIN centers c
         ON (
           LOWER(TRIM(COALESCE(c.full_name, ''))) = LOWER(TRIM(COALESCE(${teacherCenterExpr}, '')))
           OR LOWER(TRIM(COALESCE(c.display_name, ''))) = LOWER(TRIM(COALESCE(${teacherCenterExpr}, '')))
           OR LOWER(TRIM(COALESCE(c.short_code, ''))) = LOWER(TRIM(COALESCE(${teacherCenterExpr}, '')))
         )
       WHERE t.code = $1
       LIMIT 1`,
      [teacherCode],
    )

    if (teacherResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy giáo viên theo mã LMS/teacher_code' },
        { status: 404 },
      )
    }

    if (columns.has('slot_limit') && event.slot_limit && event.slot_limit > 0) {
      const slotResult = await pool.query(
        `SELECT COUNT(*)::int AS used_slots
         FROM lecture_review_registrations
         WHERE event_id = $1::uuid
           AND LOWER(status) IN ('pending', 'approved')`,
        [eventId],
      )
      const usedSlots = Number(slotResult.rows[0]?.used_slots || 0)
      if (usedSlots >= event.slot_limit) {
        return NextResponse.json(
          { success: false, error: 'Event đã full slot' },
          { status: 400 },
        )
      }
    }

    const overlapResult = await pool.query(
      `SELECT lrr.id
       FROM lecture_review_registrations lrr
       JOIN event_schedules es ON es.id = lrr.event_id
       WHERE lrr.teacher_code = $1
         AND lrr.event_id <> $2::uuid
         AND LOWER(lrr.status) IN ('pending', 'approved')
         AND LOWER(COALESCE(es.trang_thai, 'scheduled')) <> 'cancelled'
         AND NOT (
           ${eventScheduleTsInstantExpr('es', 'ket_thuc_luc')} <= $3::timestamptz
           OR ${eventScheduleTsInstantExpr('es', 'bat_dau_luc')} >= $4::timestamptz
         )
       LIMIT 1`,
      [teacherCode, eventId, event.bat_dau_luc, event.ket_thuc_luc],
    )

    if (overlapResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Giáo viên đã có lịch duyệt giảng trùng thời gian' },
        { status: 400 },
      )
    }

    const insertResult = await pool.query(
      `INSERT INTO lecture_review_registrations (
         event_id,
         te_leader_id,
         teacher_code,
         lecture_reviewer,
         review_lesson,
         status
       )
       VALUES ($1::uuid, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [eventId, user.id, teacherCode, lectureReviewer || event.lecture_reviewer || null, body.review_lesson || null],
    )

    return NextResponse.json(
      {
        success: true,
        data: insertResult.rows[0],
        message: 'Đăng ký lịch duyệt giảng thành công',
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error('[lecture-review-registrations][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register lecture review' },
      { status: 500 },
    )
  }
}
