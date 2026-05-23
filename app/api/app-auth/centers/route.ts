import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireBearerSuperAdmin } from '@/lib/auth-server'

/**
 * GET /api/app-auth/centers
 * Returns list of all centers
 * Super admin only
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSuperAdmin(request)
    if (!auth.ok) {
      return auth.response
    }

    const result = await pool.query(`
      SELECT
        id,
        full_name,
        short_code
      FROM centers
      ORDER BY full_name ASC
    `)

    return NextResponse.json({
      success: true,
      centers: result.rows,
      count: result.rows.length,
    })
  } catch (err) {
    console.error('[GET /api/app-auth/centers]', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    )
  }
}
