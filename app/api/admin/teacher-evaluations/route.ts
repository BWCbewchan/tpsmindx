import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { applyRefreshedCookies, getOrRefreshLmsToken } from '@/lib/lms-token-helper'
import { checkHrefPermission } from '@/lib/menu-permissions'
import {
  createTicketMutationToken,
  resolveAccessibleLmsCentres,
} from '@/lib/teacher-evaluations/access'
import { TEACHER_EVALUATION_ROUTE } from '@/lib/teacher-evaluations/constants'
import { fetchLmsCentres } from '@/lib/teacher-evaluations/lms'
import { parseDateInputBoundary } from '@/lib/teacher-evaluations/normalize'
import { loadTeacherEvaluationDashboard } from '@/lib/teacher-evaluations/service'

const MAX_RANGE_DAYS = 120
const CENTRE_LOOKUP_TIMEOUT_MS = 15000

function dateInVietnam(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function jsonWithTokenCookies(
  body: Record<string, unknown>,
  status: number,
  tokenSession: Awaited<ReturnType<typeof getOrRefreshLmsToken>>,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  applyRefreshedCookies(response, tokenSession)
  return response
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8)
  const startedAt = Date.now()
  const auth = await requireBearerSession(request)
  if (auth.ok === false) return auth.response
  if (!checkHrefPermission(TEACHER_EVALUATION_ROUTE, auth.resolvedAccess)) {
    return NextResponse.json(
      { success: false, error: 'Tài khoản chưa được cấp quyền xem Phiếu đánh giá giáo viên.' },
      { status: 403 },
    )
  }

  const today = dateInVietnam()
  const dateFrom = request.nextUrl.searchParams.get('dateFrom') || `${today.slice(0, 7)}-01`
  const dateTo = request.nextUrl.searchParams.get('dateTo') || today
  const rangeStart = parseDateInputBoundary(dateFrom)
  const rangeEnd = parseDateInputBoundary(dateTo, true)
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    return NextResponse.json({ success: false, error: 'Khoảng ngày không hợp lệ.' }, { status: 400 })
  }
  if (rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { success: false, error: `Mỗi lần chỉ tải tối đa ${MAX_RANGE_DAYS} ngày.` },
      { status: 400 },
    )
  }

  const requestedCentreId = request.nextUrl.searchParams.get('centreId')?.trim() || ''
  const search = request.nextUrl.searchParams.get('search')?.trim() || ''
  if (search.length > 100) {
    return NextResponse.json({ success: false, error: 'Từ khóa tìm kiếm quá dài.' }, { status: 400 })
  }
  if (!requestedCentreId && search.length < 2) {
    return NextResponse.json({
      success: false,
      error: 'Chọn một cơ sở hoặc nhập từ khóa có ít nhất 2 ký tự trước khi áp dụng.',
    }, { status: 400 })
  }

  const tokenSession = await getOrRefreshLmsToken(request)
  if (!tokenSession.token) {
    return jsonWithTokenCookies({
      success: false,
      noLmsToken: true,
      error: 'Phiên đăng nhập chưa có token LMS. Vui lòng đăng nhập lại.',
    }, 401, tokenSession)
  }

  try {
    console.info(`[teacher-evaluations:${requestId}] request:start`, {
      dateFrom,
      dateTo,
      hasCentre: Boolean(requestedCentreId),
      hasSearch: Boolean(search),
    })
    const authHeader = `Bearer ${tokenSession.token}`
    const allCentres = await fetchLmsCentres(authHeader, {
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(CENTRE_LOOKUP_TIMEOUT_MS),
      ]),
    })
    const isSuperAdmin = auth.resolvedAccess.role === 'super_admin'
    const allowedCentres = resolveAccessibleLmsCentres(
      allCentres,
      auth.accessibleCenters,
      isSuperAdmin,
    )
    if (!isSuperAdmin && allowedCentres.length === 0) {
      return jsonWithTokenCookies({
        success: false,
        error: 'Tài khoản chưa được phân công cơ sở LMS phù hợp.',
      }, 403, tokenSession)
    }

    const selectedCentres = requestedCentreId
      ? allowedCentres.filter((centre) => centre.id === requestedCentreId)
      : allowedCentres
    if (requestedCentreId && selectedCentres.length === 0) {
      return jsonWithTokenCookies({
        success: false,
        error: 'Bạn không có quyền truy cập cơ sở đã chọn.',
      }, 403, tokenSession)
    }

    const data = await loadTeacherEvaluationDashboard({
      authHeader,
      dateFrom,
      dateTo,
      centres: selectedCentres,
      allowUnscopedGoogleRows: isSuperAdmin && !requestedCentreId,
      search: search || undefined,
      signal: request.signal,
      requestId,
    })
    data.centres = allowedCentres.map((centre) => ({
      id: centre.id,
      name: centre.name,
      shortName: centre.shortName,
    }))
    data.entries = data.entries.map((entry) => entry.source === 'lms' ? {
      ...entry,
      mutationToken: createTicketMutationToken({
        ticketId: entry.id,
        email: auth.sessionEmail,
        centreId: entry.centre?.id || '',
      }),
    } : entry)

    console.info(`[teacher-evaluations:${requestId}] request:done`, {
      durationMs: Date.now() - startedAt,
      selectedCentres: selectedCentres.length,
      classes: data.classes.length,
      entries: data.entries.length,
    })
    return jsonWithTokenCookies({ success: true, data, requestId }, 200, tokenSession)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải phiếu đánh giá.'
    console.error(`[teacher-evaluations:${requestId}] request:failed`, {
      durationMs: Date.now() - startedAt,
      error: message,
    })
    const status = /timed out|timeout|quá thời gian/i.test(message) ? 504 : 500
    return jsonWithTokenCookies({ success: false, error: message, requestId }, status, tokenSession)
  }
}
