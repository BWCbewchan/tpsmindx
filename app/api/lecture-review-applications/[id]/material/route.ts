import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { resolveLectureReviewAccess } from '@/lib/lecture-review-applications'
import { getSignedObjectUrl } from '@/lib/supabase-s3'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response
    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền mở tài liệu duyệt giảng' },
        { status: 403 },
      )
    }

    const { id: rawId } = await params
    const id = Number.parseInt(rawId, 10)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mã đăng ký không hợp lệ' },
        { status: 400 },
      )
    }

    const result = await pool.query(
      `SELECT material_bucket, material_key
       FROM lecture_review_applications
       WHERE id = $1
       LIMIT 1`,
      [id],
    )
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tài liệu duyệt giảng' },
        { status: 404 },
      )
    }

    const row = result.rows[0]
    const signedUrl = await getSignedObjectUrl(
      String(row.material_bucket),
      String(row.material_key),
      10 * 60,
    )
    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('[lecture-review-applications/material][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể mở tài liệu duyệt giảng' },
      { status: 500 },
    )
  }
}
