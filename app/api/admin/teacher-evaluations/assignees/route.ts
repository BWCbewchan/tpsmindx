import { NextRequest, NextResponse } from 'next/server'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { applyRefreshedCookies, getOrRefreshLmsToken } from '@/lib/lms-token-helper'
import { checkHrefPermission } from '@/lib/menu-permissions'
import { resolveAccessibleLmsCentres } from '@/lib/teacher-evaluations/access'
import { TEACHER_EVALUATION_ROUTE } from '@/lib/teacher-evaluations/constants'
import { fetchLmsCentres, searchLmsAssignees } from '@/lib/teacher-evaluations/lms'

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (auth.ok === false) return auth.response
  if (!checkHrefPermission(TEACHER_EVALUATION_ROUTE, auth.resolvedAccess)) {
    return NextResponse.json({ success: false, error: 'Không có quyền tìm người xử lý.' }, { status: 403 })
  }
  const search = request.nextUrl.searchParams.get('search')?.trim() || ''
  if (search.length < 2) return NextResponse.json({ success: true, data: [] })
  if (search.length > 100) {
    return NextResponse.json({ success: false, error: 'Từ khóa quá dài.' }, { status: 400 })
  }

  const tokenSession = await getOrRefreshLmsToken(request)
  if (!tokenSession.token) {
    return NextResponse.json({ success: false, noLmsToken: true, error: 'Thiếu token LMS.' }, { status: 401 })
  }
  try {
    const authHeader = `Bearer ${tokenSession.token}`
    const [users, centres] = await Promise.all([
      searchLmsAssignees(authHeader, search),
      fetchLmsCentres(authHeader),
    ])
    const isSuperAdmin = auth.resolvedAccess.role === 'super_admin'
    const allowedIds = new Set(resolveAccessibleLmsCentres(
      centres,
      auth.accessibleCenters,
      isSuperAdmin,
    ).map((centre) => centre.id))
    const data = isSuperAdmin
      ? users
      : users.filter((user) => user.centres.some((centre) => allowedIds.has(centre.id)))
    const response = NextResponse.json({ success: true, data })
    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tìm người xử lý.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
