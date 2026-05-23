import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireBearerSuperAdmin } from '@/lib/auth-server'

/**
 * GET /api/app-auth/managers
 * Returns list of managers and admins (for center assignment)
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
        au.id,
        au.email,
        au.display_name AS full_name,
        au.role
      FROM app_users au
      WHERE au.role IN ('admin', 'manager')
      ORDER BY au.role DESC, au.display_name ASC
    `)

    return NextResponse.json({
      success: true,
      managers: result.rows,
      count: result.rows.length,
    })
  } catch (err) {
    console.error('[GET /api/app-auth/managers]', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    )
  }
}
