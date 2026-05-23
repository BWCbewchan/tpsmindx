import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Trả về danh sách khu vực (areas) mà admin này quản lý
// Lấy từ teaching_leaders.areas (JSONB array) theo work_email
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    if (!email) return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400 })

    // super_admin → quản lý tất cả
    const adminCheck = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(TRIM(email)) = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    if (adminCheck.rows[0]?.role === 'super_admin') {
      return NextResponse.json({ success: true, areas: null, isSuperAdmin: true })
    }

    // Lấy areas từ teaching_leaders
    const result = await pool.query(
      `SELECT areas FROM teaching_leaders
       WHERE LOWER(TRIM(code)) = $1
          OR LOWER(TRIM(full_name)) = $1
          OR EXISTS (
            SELECT 1 FROM teachers t
            WHERE LOWER(TRIM(t.work_email)) = $1
              AND LOWER(TRIM(t.code)) = LOWER(TRIM(teaching_leaders.code))
          )
       LIMIT 1`,
      [email]
    )

    // Fallback: tìm theo email trong teachers → lấy code → tìm teaching_leaders
    if (result.rows.length === 0) {
      const teacherRes = await pool.query(
        `SELECT tl.areas FROM teaching_leaders tl
         JOIN teachers t ON LOWER(TRIM(t.code)) = LOWER(TRIM(tl.code))
         WHERE LOWER(TRIM(t.work_email)) = $1
            OR LOWER(TRIM(t."Work email")) = $1
         LIMIT 1`,
        [email]
      )
      if (teacherRes.rows.length > 0) {
        const areas: string[] = teacherRes.rows[0].areas || []
        return NextResponse.json({ success: true, areas, isSuperAdmin: false })
      }
      return NextResponse.json({ success: true, areas: [], isSuperAdmin: false })
    }

    const areas: string[] = result.rows[0].areas || []
    return NextResponse.json({ success: true, areas, isSuperAdmin: false })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
