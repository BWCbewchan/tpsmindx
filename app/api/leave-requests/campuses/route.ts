import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Tất cả cơ sở active cho form xin nghỉ — ưu tiên các cơ sở trong manager_centers của user lên trước.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const userRes = await pool.query<{ id: number }>(
      `SELECT id FROM app_users
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_active = true
       LIMIT 1`,
      [auth.sessionEmail],
    )

    const userId = userRes.rows[0]?.id

    let result
    if (userId != null) {
      result = await pool.query(
        `SELECT c.id, c.full_name, c.short_code, c.email, c.region,
                EXISTS (
                  SELECT 1 FROM manager_centers mc
                  WHERE mc.center_id = c.id AND mc.user_id = $1
                ) AS manager_assigned
         FROM centers c
         WHERE c.status = 'Active'
         ORDER BY manager_assigned DESC,
                  c.region NULLS LAST,
                  c.full_name`,
        [userId],
      )
    } else {
      result = await pool.query(
        `SELECT c.id, c.full_name, c.short_code, c.email, c.region,
                false AS manager_assigned
         FROM centers c
         WHERE c.status = 'Active'
         ORDER BY c.region NULLS LAST, c.full_name`,
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error: unknown) {
    console.error('leave-requests/campuses GET error:', error)
    const message =
      error instanceof Error ? error.message : 'Không thể tải danh sách cơ sở'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
