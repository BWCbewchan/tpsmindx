import { NextRequest, NextResponse } from 'next/server'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { applyRefreshedCookies, getOrRefreshLmsToken } from '@/lib/lms-token-helper'
import { checkHrefPermission } from '@/lib/menu-permissions'
import { resolveAccessibleLmsCentres } from '@/lib/teacher-evaluations/access'
import { TEACHER_EVALUATION_ROUTE } from '@/lib/teacher-evaluations/constants'
import { fetchLmsCentres } from '@/lib/teacher-evaluations/lms'

const OPTIONS_TIMEOUT_MS = 20000

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (auth.ok === false) return auth.response
  if (!checkHrefPermission(TEACHER_EVALUATION_ROUTE, auth.resolvedAccess)) {
    return NextResponse.json(
      { success: false, error: 'Tài khoản chưa được cấp quyền xem Phiếu đánh giá giáo viên.' },
      { status: 403 },
    )
  }

  const tokenSession = await getOrRefreshLmsToken(request)
  if (!tokenSession.token) {
    const response = NextResponse.json({
      success: false,
      noLmsToken: true,
      error: 'Phiên đăng nhập chưa có token LMS. Vui lòng đăng nhập lại.',
    }, { status: 401 })
    applyRefreshedCookies(response, tokenSession)
    return response
  }

  try {
    const allCentres = await fetchLmsCentres(`Bearer ${tokenSession.token}`, {
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(OPTIONS_TIMEOUT_MS),
      ]),
    })
    const centres = resolveAccessibleLmsCentres(
      allCentres,
      auth.accessibleCenters,
      auth.resolvedAccess.role === 'super_admin',
    ).map((centre) => ({
      id: centre.id,
      name: centre.name,
      shortName: centre.shortName,
    }))
    const response = NextResponse.json({ success: true, centres })
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải danh sách cơ sở.'
    console.error('[teacher-evaluations:options] request:failed', { error: message })
    const status = /timed out|timeout|quá thời gian/i.test(message) ? 504 : 500
    const response = NextResponse.json({ success: false, error: message }, { status })
    applyRefreshedCookies(response, tokenSession)
    return response
  }
}
