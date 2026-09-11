import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function textOrEmpty(value: unknown): string {
  return String(value ?? '').trim()
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const email = auth.sessionEmail.trim().toLowerCase()
    const emailUser = email.split('@')[0] || email

    const teacherResult = await pool.query(
      `SELECT
          code,
          COALESCE(
            NULLIF(TRIM(full_name), ''),
            NULLIF(TRIM("Full name"), '')
          ) AS teacher_name,
          COALESCE(
            NULLIF(TRIM(main_centre), ''),
            NULLIF(TRIM("Main centre"), ''),
            NULLIF(TRIM(centers), '')
          ) AS default_center
       FROM teachers
       WHERE LOWER(TRIM(COALESCE(work_email, ''))) = $1
          OR LOWER(TRIM(COALESCE("Work email", ''))) = $1
          OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1
          OR LOWER(TRIM(COALESCE(user_name, ''))) = $2
          OR LOWER(TRIM(COALESCE("User name", ''))) = $2
       LIMIT 1`,
      [email, emailUser],
    )

    const centersResult = await pool.query(
      `SELECT id, region, short_code, full_name
       FROM centers
       WHERE status = 'Active'
       ORDER BY region, full_name`,
    )

    const teacher = teacherResult.rows[0] || {}
    const assignedDefault = auth.accessibleCenters[0]?.full_name || ''
    const defaultCenter =
      textOrEmpty(teacher.default_center) ||
      assignedDefault ||
      textOrEmpty(centersResult.rows[0]?.full_name)

    const centers = centersResult.rows.map((row) => ({
      id: Number(row.id),
      region: textOrEmpty(row.region) || null,
      short_code: textOrEmpty(row.short_code) || null,
      full_name: textOrEmpty(row.full_name),
    }))

    if (
      defaultCenter &&
      !centers.some(
        (center) => center.full_name.toLowerCase() === defaultCenter.toLowerCase(),
      )
    ) {
      centers.unshift({
        id: 0,
        region: null,
        short_code: null,
        full_name: defaultCenter,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        email,
        teacherCode: textOrEmpty(teacher.code) || null,
        teacherName: textOrEmpty(teacher.teacher_name) || emailUser,
        defaultCenter,
        centers,
      },
    })
  } catch (error) {
    console.error('Error in user checkout context:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải dữ liệu checkout',
      },
      { status: 500 },
    )
  }
}
