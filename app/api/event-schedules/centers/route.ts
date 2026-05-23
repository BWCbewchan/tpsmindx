import { getAccessibleCenterIds } from '@/lib/center-access'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const accessibleCenterIds = await getAccessibleCenterIds(auth.sessionEmail)
    if (accessibleCenterIds.length === 0) {
      return NextResponse.json({ success: true, centers: [], count: 0 })
    }

    const result = await pool.query(
      `SELECT
         id,
         full_name,
         display_name,
         short_code,
         region,
         address,
         map_link,
         status
       FROM centers
       WHERE id = ANY($1::int[])
         AND status = 'Active'
       ORDER BY full_name`,
      [accessibleCenterIds],
    )

    const centers = result.rows.map((row: any) => ({
      id: row.id,
      name: row.display_name || row.full_name,
      center_name: row.display_name || row.full_name,
      display_name: row.display_name,
      full_name: row.full_name,
      short_code: row.short_code,
      region: row.region,
      address: row.address,
      full_address: row.address,
      map_url: row.map_link,
      status: row.status,
    }))

    return NextResponse.json({
      success: true,
      centers,
      count: centers.length,
    })
  } catch (error: any) {
    console.error('[event-schedules/centers] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch centers' },
      { status: 500 },
    )
  }
}
