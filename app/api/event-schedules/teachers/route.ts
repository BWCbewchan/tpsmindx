import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
    [tableName],
  )
  return new Set(res.rows.map((r: any) => String(r.column_name || '').trim().toLowerCase()).filter(Boolean))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get('limit') || 30), 1),
      100,
    )
    const cols = await getTableColumns('teachers')

    const teacherNameParts: string[] = []
    if (cols.has('full_name')) teacherNameParts.push("NULLIF(t.full_name, '')")
    if (cols.has('full name')) teacherNameParts.push("NULLIF(t.\"Full name\", '')")
    // fallback to code
    teacherNameParts.push('t.code')

    const teacherEmailParts: string[] = []
    if (cols.has('work_email')) teacherEmailParts.push("NULLIF(t.work_email, '')")
    if (cols.has('work email')) teacherEmailParts.push("NULLIF(t.\"Work email\", '')")

    const teacherCenterParts: string[] = []
    if (cols.has('main_centre')) teacherCenterParts.push("NULLIF(t.main_centre, '')")
    if (cols.has('main centre')) teacherCenterParts.push("NULLIF(t.\"Main centre\", '')")
    if (cols.has('main_center')) teacherCenterParts.push("NULLIF(t.main_center, '')")
    if (cols.has('centers')) teacherCenterParts.push("NULLIF(t.centers, '')")

    const specialtyParts: string[] = []
    if (cols.has('course_line')) specialtyParts.push("NULLIF(t.course_line, '')")
    if (cols.has('course line')) specialtyParts.push("NULLIF(t.\"Course Line\", '')")

    const teacherNameExpr = `COALESCE(${teacherNameParts.join(', ')})`
    const teacherEmailExpr = teacherEmailParts.length ? `COALESCE(${teacherEmailParts.join(', ')})` : 'NULL'
    const teacherCenterExpr = teacherCenterParts.length ? `COALESCE(${teacherCenterParts.join(', ')})` : 'NULL'
    const specialtyExpr = specialtyParts.length ? `COALESCE(${specialtyParts.join(', ')})` : 'NULL'

    const values: any[] = []
    let query = `
      WITH teacher_source AS (
        SELECT
          t.code AS teacher_code,
          ${teacherNameExpr} AS teacher_name,
          ${teacherEmailExpr} AS teacher_email,
          ${teacherCenterExpr} AS teacher_center,
          ${specialtyExpr} AS specialty,
          t.status
        FROM teachers t
      ),
      teacher_with_center AS (
        SELECT
          ts.teacher_code,
          ts.teacher_name,
          ts.teacher_email,
          ts.teacher_center,
          ts.specialty,
          c.id AS center_id,
          c.full_name AS center_name,
          c.display_name AS center_display_name,
          c.short_code AS center_short_code
        FROM teacher_source ts
        LEFT JOIN centers c
          ON (
            LOWER(TRIM(COALESCE(c.full_name, ''))) = LOWER(TRIM(COALESCE(ts.teacher_center, '')))
            OR LOWER(TRIM(COALESCE(c.display_name, ''))) = LOWER(TRIM(COALESCE(ts.teacher_center, '')))
            OR LOWER(TRIM(COALESCE(c.short_code, ''))) = LOWER(TRIM(COALESCE(ts.teacher_center, '')))
          )
        WHERE COALESCE(ts.status, 'Active') <> 'Deactive'
      )
      SELECT
        teacher_code,
        teacher_name,
        teacher_email,
        teacher_center,
        specialty,
        center_id,
        center_name,
        center_display_name,
        center_short_code
      FROM teacher_with_center
      WHERE TRUE
    `

    if (q) {
      values.push(`%${q}%`)
      query += `
        AND (
          LOWER(teacher_name) LIKE $${values.length}
          OR LOWER(teacher_code) LIKE $${values.length}
          OR LOWER(COALESCE(teacher_email, '')) LIKE $${values.length}
        )
      `
    }

    values.push(limit)
    query += ` ORDER BY teacher_name ASC LIMIT $${values.length}`

    const result = await pool.query(query, values)

    const teachers = result.rows.map((row: any) => ({
      teacher_code: row.teacher_code,
      lms_code: row.teacher_code,
      teacher_name: row.teacher_name,
      email: row.teacher_email,
      center: row.center_name || row.teacher_center,
      center_id: row.center_id,
      center_display_name: row.center_display_name,
      center_short_code: row.center_short_code,
      specialty: row.specialty,
      level: null,
    }))

    return NextResponse.json({
      success: true,
      teachers,
      count: teachers.length,
    })
  } catch (error: any) {
    console.error('[event-schedules/teachers] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch teachers' },
      { status: 500 },
    )
  }
}
