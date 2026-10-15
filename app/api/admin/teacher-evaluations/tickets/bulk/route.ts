import { NextRequest, NextResponse } from 'next/server'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { applyRefreshedCookies, getOrRefreshLmsToken } from '@/lib/lms-token-helper'
import { checkHrefPermission } from '@/lib/menu-permissions'
import { verifyTicketMutationToken } from '@/lib/teacher-evaluations/access'
import { TEACHER_EVALUATION_ROUTE } from '@/lib/teacher-evaluations/constants'
import { mapWithConcurrency, updateLmsTicket } from '@/lib/teacher-evaluations/lms'
import { validateTicketUpdate } from '@/lib/teacher-evaluations/validation'

interface BulkItem {
  id?: unknown
  mutationToken?: unknown
}

export async function PATCH(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied
  const auth = await requireBearerSession(request)
  if (auth.ok === false) return auth.response
  if (!checkHrefPermission(TEACHER_EVALUATION_ROUTE, auth.resolvedAccess)) {
    return NextResponse.json({ success: false, error: 'Không có quyền cập nhật phiếu.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 128 * 1024) {
    return NextResponse.json({ success: false, error: 'Dữ liệu cập nhật quá lớn.' }, { status: 413 })
  }

  try {
    const body = await request.json() as { items?: BulkItem[]; update?: unknown }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Chọn từ 1 đến 50 phiếu LMS mỗi lần.' },
        { status: 400 },
      )
    }
    const items = body.items.map((item) => ({
      id: String(item.id || '').trim(),
      mutationToken: String(item.mutationToken || ''),
    }))
    const invalidAccess = items.some((item) => !item.id || !verifyTicketMutationToken(item.mutationToken, {
      ticketId: item.id,
      email: auth.sessionEmail,
    }))
    if (invalidAccess) {
      return NextResponse.json(
        { success: false, error: 'Một hoặc nhiều quyền cập nhật đã hết hạn. Vui lòng tải lại dữ liệu.' },
        { status: 403 },
      )
    }

    const template = validateTicketUpdate(items[0].id, body.update)
    const tokenSession = await getOrRefreshLmsToken(request)
    if (!tokenSession.token) {
      return NextResponse.json({ success: false, noLmsToken: true, error: 'Thiếu token LMS.' }, { status: 401 })
    }
    const authHeader = `Bearer ${tokenSession.token}`
    const results = await mapWithConcurrency(items, 4, async (item) => {
      try {
        await updateLmsTicket(authHeader, { ...template, id: item.id })
        return { id: item.id, success: true as const }
      } catch (error) {
        return {
          id: item.id,
          success: false as const,
          error: error instanceof Error ? error.message : 'Cập nhật thất bại',
        }
      }
    })
    const response = NextResponse.json({
      success: results.some((result) => result.success),
      updatedIds: results.filter((result) => result.success).map((result) => result.id),
      errors: results.filter((result) => !result.success),
    })
    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật hàng loạt.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
