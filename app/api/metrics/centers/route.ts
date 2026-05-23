import { requireBearerSession } from '@/lib/datasource-api-auth'
import { getAccessibleCenters } from '@/lib/center-access'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/metrics/centers
 * Returns list of centers accessible by current user
 * - super_admin: all centers
 * - admin/manager: assigned centers
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) {
      return auth.response
    }

    const centers = await getAccessibleCenters(auth.sessionEmail)

    return NextResponse.json({
      success: true,
      centers,
      count: centers.length,
    })
  } catch (error: any) {
    console.error('[metrics/centers] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch accessible centers' },
      { status: 500 },
    )
  }
}
