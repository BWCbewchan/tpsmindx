import { NextRequest, NextResponse } from 'next/server'

import { withApiProtection } from '@/lib/api-protection'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import {
  getTeacherPortfolioForSelf,
  getTeacherPortfolioForViewer,
  updateTeacherPortfolioForSelf,
} from '@/lib/teacher-portfolio/service'
import {
  parseTeacherPortfolioUpdate,
  TeacherPortfolioValidationError,
} from '@/lib/teacher-portfolio/validation'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 128 * 1024

async function handleGet(request: NextRequest) {
  try {
    const auth = await requireBearerOrSessionCookie(request)
    if (!auth.ok) return auth.response

    const teacherCode = String(request.nextUrl.searchParams.get('code') || '').trim()
    if (teacherCode) {
      const result = await getTeacherPortfolioForViewer(auth.sessionEmail, teacherCode)
      if (result.status === 'forbidden') {
        return NextResponse.json(
          { success: false, error: 'Bạn không có quyền xem portfolio của giáo viên này.' },
          { status: 403 },
        )
      }
      if (result.status === 'not_found') {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy hồ sơ giáo viên.' },
          { status: 404 },
        )
      }
      return NextResponse.json(
        { success: true, data: result.data },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    const data = await getTeacherPortfolioForSelf(auth.sessionEmail)
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên cho tài khoản này.' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[teacher-portfolio] load failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Không thể tải Teacher Portfolio. Vui lòng thử lại sau.',
      },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}

async function handlePut(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu portfolio quá lớn.' },
      { status: 413 },
    )
  }

  try {
    const input = parseTeacherPortfolioUpdate(await request.json())
    const data = await updateTeacherPortfolioForSelf(auth.sessionEmail, input)
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên cho tài khoản này.' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (error instanceof TeacherPortfolioValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          fieldErrors: error.fieldErrors,
        },
        { status: 400 },
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'JSON không hợp lệ.' },
        { status: 400 },
      )
    }
    console.error('[teacher-portfolio] update failed:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể lưu Teacher Portfolio.' },
      { status: 500 },
    )
  }
}

export const GET = withApiProtection(handleGet)
export const PUT = withApiProtection(handlePut)
