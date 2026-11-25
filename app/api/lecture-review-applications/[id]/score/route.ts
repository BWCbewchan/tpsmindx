import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { resolveLectureReviewAccess } from '@/lib/lecture-review-applications'
import {
  calculateLectureReviewTotalScore,
  isLectureReviewPassed,
  type LectureReviewAnswer,
} from '@/lib/lecture-review-criteria'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập' },
        { status: 403 },
      )
    }

    const { id } = await context.params
    const appId = Number.parseInt(id, 10)
    if (!Number.isFinite(appId) || appId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mã phiếu không hợp lệ' },
        { status: 400 },
      )
    }

    const result = await pool.query(
      `SELECT
         id,
         candidate_name,
         lms_code,
         reviewer_name,
         review_date::text AS review_date,
         TO_CHAR(review_time, 'HH24:MI') AS review_time,
         room_name,
         scoring_status,
         evaluation_score,
         final_score,
         training_status,
         evaluation_format,
         evaluation_details,
         evaluation_general_feedback,
         evaluated_at,
         evaluated_by_name
       FROM lecture_review_applications
       WHERE id = $1
       LIMIT 1`,
      [appId],
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy phiếu đăng ký' },
        { status: 404 },
      )
    }

    const row = result.rows[0]
    // Quyền chấm/sửa điểm: Chỉ dành cho Ban giám khảo và Super Admin
    const canScore = access.isSuperAdmin || Boolean(access.assignedReviewer)

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        canScore,
      },
    })
  } catch (error) {
    console.error('[lecture-review-applications/score][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi tải bảng điểm' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chấm điểm' },
        { status: 403 },
      )
    }

    const { id } = await context.params
    const appId = Number.parseInt(id, 10)
    if (!Number.isFinite(appId) || appId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Mã phiếu không hợp lệ' },
        { status: 400 },
      )
    }

    const appResult = await pool.query(
      `SELECT id, reviewer_name, candidate_name, lms_code, theory_score, total_lesson
       FROM lecture_review_applications
       WHERE id = $1
       LIMIT 1`,
      [appId],
    )

    if (appResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy phiếu đăng ký' },
        { status: 404 },
      )
    }

    const appRow = appResult.rows[0]
    // Quyền chấm/sửa điểm: Chỉ dành cho Ban giám khảo và Super Admin
    const canScore = access.isSuperAdmin || Boolean(access.assignedReviewer)

    if (!canScore) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bạn không có quyền chấm hoặc sửa điểm duyệt giảng. Chức năng này chỉ dành riêng cho Ban giám khảo và Super Admin.',
        },
        { status: 403 },
      )
    }

    const body = await request.json()
    const evaluationFormat =
      body.evaluationFormat === 'offline' ? 'offline' : 'online'
    const rawScores = (body.scores || {}) as Record<
      string | number,
      LectureReviewAnswer
    >
    const generalFeedback = String(body.generalFeedback || '').trim()

    // Normalize scores
    const scores: Record<number, LectureReviewAnswer> = {}
    for (const [key, val] of Object.entries(rawScores)) {
      const criterionId = Number(key)
      if (Number.isFinite(criterionId) && criterionId >= 1 && criterionId <= 25) {
        const sc = Math.max(1, Math.min(5, Number(val?.score) || 0))
        scores[criterionId] = {
          score: sc,
          note: val?.note ? String(val.note).trim().slice(0, 1000) : undefined,
        }
      }
    }

    const totalScore = calculateLectureReviewTotalScore(scores)
    const isPass = isLectureReviewPassed(totalScore)
    const hasLT =
      appRow.theory_score !== null &&
      appRow.theory_score !== undefined &&
      Number(appRow.theory_score) > 0
    const hasDG = totalScore > 0
    const hasTotal = totalScore > 0
    const hasLessons =
      appRow.total_lesson !== null &&
      appRow.total_lesson !== undefined &&
      Number(appRow.total_lesson) > 0
    const isCompleted = hasLT && hasDG && hasTotal && hasLessons
    const trainingStatus = isCompleted ? 'Đã hoàn thành tập huấn' : 'Chưa hoàn thành tập huấn'
    const evaluatedByName =
      access.assignedReviewer || access.displayName || auth.sessionEmail

    const evaluationDetails = {
      scores,
      totalScore,
      isPass,
      passThreshold: 60,
      generalFeedback,
      evaluatedByName,
      evaluatedAt: new Date().toISOString(),
    }

    const updateResult = await pool.query(
      `UPDATE lecture_review_applications
       SET
         evaluation_format = $1,
         evaluation_score = $2,
         final_score = $3,
         scoring_status = 'Đã chấm',
         training_status = $4,
         evaluation_details = $5::jsonb,
         evaluation_general_feedback = $6,
         evaluated_at = NOW(),
         evaluated_by_name = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING
         id,
         candidate_name,
         lms_code,
         reviewer_name,
         review_date::text AS review_date,
         scoring_status,
         evaluation_score,
         final_score,
         training_status,
         evaluation_format,
         evaluation_details,
         evaluation_general_feedback,
         evaluated_at,
         evaluated_by_name`,
      [
        evaluationFormat,
        totalScore,
        totalScore,
        trainingStatus,
        JSON.stringify(evaluationDetails),
        generalFeedback,
        evaluatedByName,
        appId,
      ],
    )

    return NextResponse.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Lưu bảng điểm thành công',
    })
  } catch (error) {
    console.error('[lecture-review-applications/score][POST]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể lưu bảng điểm duyệt giảng' },
      { status: 500 },
    )
  }
}
