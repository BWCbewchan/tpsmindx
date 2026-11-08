import { NextRequest, NextResponse } from 'next/server'

import {
  createUnauthorizedResponse,
  validateInternalRequest,
} from '@/lib/api-protection'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import { verifyTeacherPortfolioAchievement } from '@/lib/teacher-portfolio/service'

export const dynamic = 'force-dynamic'

async function handlePatch(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestValidation = validateInternalRequest(request)
  if (!requestValidation.isValid) {
    return createUnauthorizedResponse(requestValidation.error || 'Access denied')
  }
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  const { id: idText } = await context.params
  const achievementId = Number(idText)
  if (!Number.isInteger(achievementId) || achievementId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Mã giải thưởng không hợp lệ.' },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: unknown
    note?: unknown
  }
  if (body.status !== 'verified' && body.status !== 'rejected') {
    return NextResponse.json(
      { success: false, error: 'Trạng thái duyệt không hợp lệ.' },
      { status: 400 },
    )
  }
  const note = String(body.note ?? '').trim().slice(0, 1000) || null
  const result = await verifyTeacherPortfolioAchievement({
    viewerEmail: auth.sessionEmail,
    achievementId,
    status: body.status,
    note,
  })
  if (result === 'not_found') {
    return NextResponse.json(
      { success: false, error: 'Không tìm thấy giải thưởng.' },
      { status: 404 },
    )
  }
  if (result === 'forbidden') {
    return NextResponse.json(
      { success: false, error: 'Bạn không có quyền duyệt giải thưởng này.' },
      { status: 403 },
    )
  }
  return NextResponse.json({ success: true })
}

export const PATCH = handlePatch
