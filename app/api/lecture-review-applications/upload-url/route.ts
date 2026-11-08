import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { resolveLectureReviewAccess } from '@/lib/lecture-review-applications'
import {
  createLectureReviewUploadUrl,
  isAllowedLectureReviewFileDescriptor,
  LECTURE_REVIEW_MAX_FILE_BYTES,
} from '@/lib/lecture-review-storage'
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const csrfDenied = requireSameOriginMutation(request)
    if (csrfDenied) return csrfDenied

    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response
    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tải tài liệu duyệt giảng' },
        { status: 403 },
      )
    }

    const rateLimited = await rateLimitOr429Async(
      `lecture-review-upload-url:${access.email}:${clientIpFromRequest(request)}`,
      20,
      60_000,
    )
    if (rateLimited) return rateLimited

    const body = await request.json().catch(() => ({}))
    const fileName = String(body.fileName || '').trim().slice(0, 255)
    const contentType = String(body.contentType || 'application/octet-stream')
      .trim()
      .toLowerCase()
      .slice(0, 255)
    const fileSize = Number(body.fileSize || 0)

    if (!fileName || !isAllowedLectureReviewFileDescriptor(fileName, contentType)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ tệp PDF, PPT, PPTX hoặc ODP' },
        { status: 400 },
      )
    }
    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > LECTURE_REVIEW_MAX_FILE_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: 'Kích thước tệp tối đa là 100 MB' },
        { status: 400 },
      )
    }

    const upload = await createLectureReviewUploadUrl({
      fileName,
      contentType,
      ownerEmail: access.email,
    })
    return NextResponse.json({
      success: true,
      data: {
        ...upload,
        fileName,
        contentType,
        fileSize,
        expiresInSeconds: 15 * 60,
      },
    })
  } catch (error) {
    console.error('[lecture-review-applications/upload-url][POST]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể khởi tạo lượt tải tài liệu' },
      { status: 500 },
    )
  }
}
