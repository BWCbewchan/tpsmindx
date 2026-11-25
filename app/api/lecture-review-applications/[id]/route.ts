import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { resolveLectureReviewAccess } from '@/lib/lecture-review-applications'
import { deleteObject } from '@/lib/supabase-s3'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập hệ thống duyệt giảng' },
        { status: 403 },
      )
    }

    if (!access.canDelete) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bạn không có quyền xóa phiếu duyệt giảng. Chức năng này chỉ dành riêng cho Super Admin, TEGL, TEGL+, TM, TOM.',
        },
        { status: 403 },
      )
    }

    const { id } = await context.params
    const appId = Number.parseInt(id, 10)
    if (!Number.isFinite(appId) || appId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mã phiếu duyệt giảng không hợp lệ' },
        { status: 400 },
      )
    }

    // Kiểm tra phiếu tồn tại
    const findResult = await pool.query(
      `SELECT id, candidate_name, lms_code, material_bucket, material_key
       FROM lecture_review_applications
       WHERE id = $1
       LIMIT 1`,
      [appId],
    )

    if (findResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy phiếu đăng ký duyệt giảng này' },
        { status: 404 },
      )
    }

    const appRow = findResult.rows[0]

    // Xóa file học liệu nếu có trong storage
    if (appRow.material_bucket && appRow.material_key) {
      await deleteObject(appRow.material_bucket, appRow.material_key).catch((storageErr) => {
        console.warn(
          `[lecture-review][DELETE] Không thể xóa file storage (${appRow.material_bucket}/${appRow.material_key}):`,
          storageErr,
        )
      })
    }

    // Xóa bản ghi trong database
    await pool.query(
      `DELETE FROM lecture_review_applications WHERE id = $1`,
      [appId],
    )

    return NextResponse.json({
      success: true,
      message: `Đã xóa phiếu duyệt giảng của ứng viên ${appRow.candidate_name} (${appRow.lms_code}) thành công.`,
    })
  } catch (error) {
    console.error('[lecture-review-applications][DELETE]', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa phiếu đăng ký duyệt giảng' },
      { status: 500 },
    )
  }
}
