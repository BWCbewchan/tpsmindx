import { withApiProtection } from '@/lib/api-protection'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  const access = auth.resolvedAccess
  const isSuperAdmin = access.role === 'super_admin'
  const roleCodes = (access.userRoles || []).map((r) =>
    String(r).toUpperCase().trim(),
  )
  const hasDashboardRole =
    isSuperAdmin || roleCodes.includes('TM') || roleCodes.includes('TEGL')

  if (!hasDashboardRole) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền xem chi tiết giáo viên' },
      { status: 403 },
    )
  }

  const searchParams = request.nextUrl.searchParams
  const buName = searchParams.get('bu_name')?.trim()
  const monthParam = searchParams.get('month')?.trim()
  const yearParam = searchParams.get('year')?.trim()

  if (!buName) {
    return NextResponse.json(
      { success: false, error: 'Thiếu tên cơ sở (bu_name)' },
      { status: 400 },
    )
  }

  const month = monthParam ? parseInt(monthParam, 10) : null
  const year = yearParam ? parseInt(yearParam, 10) : null

  const client = await pool.connect()
  try {
    const queryParams: any[] = [buName]
    let joinFilter = ''

    if (month && year) {
      queryParams.push(month, year)
      joinFilter = ` AND r.thang_dk = $2 AND r.nam_dk = $3 `
    }

    const query = `
      SELECT 
        t.code,
        COALESCE(t.work_email, '') AS email,
        TRUNC(AVG(r.diem)::numeric, 2) AS score
      FROM teachers t
      LEFT JOIN chuyen_sau_results r ON (
        (LOWER(TRIM(r.ma_giao_vien)) = LOWER(TRIM(t.code))
         OR (r.dia_chi_email IS NOT NULL AND LOWER(TRIM(r.dia_chi_email)) = LOWER(TRIM(t.work_email))))
        AND r.diem IS NOT NULL
        ${joinFilter}
      )
      WHERE LOWER(TRIM(COALESCE(t.main_centre, t."Main centre", ''))) = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(t.status, t."Status", ''))) NOT IN ('inactive', 'deactive', 'nghỉ')
      GROUP BY t.code, t.work_email
      ORDER BY score DESC NULLS LAST, t.code ASC
    `

    const res = await client.query<{
      code: string
      email: string
      score: string | null
    }>(query, queryParams)

    const teachers = res.rows.map(r => ({
      code: r.code,
      email: r.email,
      score: r.score ? parseFloat(r.score) : null
    }))

    return NextResponse.json({
      success: true,
      data: teachers
    })
  } catch (error) {
    console.error('[BU Teachers Detail API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Lỗi không xác định',
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
})
