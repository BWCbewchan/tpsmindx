import { NextRequest, NextResponse } from 'next/server'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { applyRefreshedCookies, getOrRefreshLmsToken } from '@/lib/lms-token-helper'
import { checkHrefPermission } from '@/lib/menu-permissions'
import { verifyTicketMutationToken } from '@/lib/teacher-evaluations/access'
import { TEACHER_EVALUATION_ROUTE } from '@/lib/teacher-evaluations/constants'
import { updateLmsTicket } from '@/lib/teacher-evaluations/lms'
import { validateTicketUpdate } from '@/lib/teacher-evaluations/validation'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied
  const auth = await requireBearerSession(request)
  if (auth.ok === false) return auth.response
  if (!checkHrefPermission(TEACHER_EVALUATION_ROUTE, auth.resolvedAccess)) {
    return NextResponse.json({ success: false, error: 'Không có quyền cập nhật phiếu.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 32 * 1024) {
    return NextResponse.json({ success: false, error: 'Dữ liệu cập nhật quá lớn.' }, { status: 413 })
  }

  const { id } = await context.params
  try {
    const body = await request.json() as Record<string, unknown>
    if (!verifyTicketMutationToken(String(body.mutationToken || ''), {
      ticketId: id,
      email: auth.sessionEmail,
    })) {
      return NextResponse.json(
        { success: false, error: 'Quyền cập nhật phiếu đã hết hạn. Vui lòng tải lại dữ liệu.' },
        { status: 403 },
      )
    }
    const update = validateTicketUpdate(id, body)
    const tokenSession = await getOrRefreshLmsToken(request)
    if (!tokenSession.token) {
      return NextResponse.json({ success: false, noLmsToken: true, error: 'Thiếu token LMS.' }, { status: 401 })
    }
    const ticket = await updateLmsTicket(`Bearer ${tokenSession.token}`, update)
    const response = NextResponse.json({ success: true, ticket })
    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật phiếu.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
