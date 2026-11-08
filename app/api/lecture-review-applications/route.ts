import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  findLegacyLectureReviewLeader,
  isLectureReviewBlock,
  isLectureReviewReviewer,
  LECTURE_REVIEW_MANAGER_ROLE_CODES,
  LECTURE_REVIEW_REVIEWER_BY_EMAIL,
  resolveLectureReviewAccess,
} from '@/lib/lecture-review-applications'
import {
  LECTURE_REVIEW_BUCKET,
  LECTURE_REVIEW_MAX_FILE_BYTES,
  validateLectureReviewUpload,
} from '@/lib/lecture-review-storage'
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { deleteObject } from '@/lib/supabase-s3'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function missingTable(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string }
  return (
    candidate?.code === '42P01' ||
    String(candidate?.message || '').includes('lecture_review_applications')
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response
    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem đăng ký duyệt giảng' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 50), 100)
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const values: unknown[] = []

    const addValue = (value: unknown) => {
      values.push(value)
      return `$${values.length}`
    }

    const query = String(searchParams.get('q') || '').trim().slice(0, 120)
    if (query) {
      const param = addValue(query)
      conditions.push(`(
        LOWER(candidate_name) LIKE '%' || LOWER(${param}) || '%'
        OR LOWER(lms_code) LIKE '%' || LOWER(${param}) || '%'
        OR LOWER(manager_leader_name) LIKE '%' || LOWER(${param}) || '%'
        OR LOWER(center_name) LIKE '%' || LOWER(${param}) || '%'
      )`)
    }

    const leaderCode = String(searchParams.get('leader') || '').trim().slice(0, 80)
    if (leaderCode) {
      conditions.push(`manager_leader_code = ${addValue(leaderCode)}`)
    }

    const centerId = Number.parseInt(searchParams.get('center') || '', 10)
    if (Number.isFinite(centerId) && centerId > 0) {
      conditions.push(`center_id = ${addValue(centerId)}`)
    }

    const reviewer = String(searchParams.get('reviewer') || '').trim().slice(0, 255)
    if (reviewer) {
      conditions.push(`reviewer_name = ${addValue(reviewer)}`)
    }

    const block = String(searchParams.get('block') || '').trim()
    if (block && isLectureReviewBlock(block)) {
      conditions.push(`teaching_block = ${addValue(block)}`)
    }

    const fromDate = String(searchParams.get('fromDate') || '').trim()
    if (isIsoDate(fromDate)) {
      conditions.push(`review_date >= ${addValue(fromDate)}::date`)
    }

    const toDate = String(searchParams.get('toDate') || '').trim()
    if (isIsoDate(toDate)) {
      conditions.push(`review_date <= ${addValue(toDate)}::date`)
    }

    const sort = String(searchParams.get('sort') || '').trim()
    const orderBy =
      {
        review_date_asc: 'review_date ASC, created_at ASC, id ASC',
        created_desc: 'created_at DESC, id DESC',
        created_asc: 'created_at ASC, id ASC',
        candidate_asc: 'LOWER(candidate_name) ASC, review_date DESC, id DESC',
      }[sort] || 'review_date DESC, created_at DESC, id DESC'

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limitParam = addValue(limit)
    const offsetParam = addValue(offset)
    const result = await pool.query(
      `SELECT
         id,
         manager_leader_code,
         manager_leader_name,
         manager_role_code,
         center_id,
         center_name,
         candidate_name,
         lms_code,
         review_date::text AS review_date,
         reviewer_name,
         teaching_block,
         material_file_name,
         material_file_type,
         material_file_size,
         scoring_status,
         evaluation_score,
         theory_score,
         final_score,
         total_lesson,
         training_status,
         created_at,
         COUNT(*) OVER()::integer AS total_count
       FROM lecture_review_applications
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    )
    const total = Number(result.rows[0]?.total_count || 0)
    const reviewerForAccount = LECTURE_REVIEW_REVIEWER_BY_EMAIL[access.email]
    const rows = result.rows.map((row) => ({
      ...row,
      can_score:
        Boolean(reviewerForAccount) && row.reviewer_name === reviewerForAccount,
    }))

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    if (missingTable(error)) {
      return NextResponse.json(
        { success: false, error: 'Bảng đăng ký duyệt giảng chưa được khởi tạo' },
        { status: 503 },
      )
    }
    console.error('[lecture-review-applications][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách đăng ký duyệt giảng' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  let uploaded: { bucket: string; key: string } | null = null
  try {
    const csrfDenied = requireSameOriginMutation(request)
    if (csrfDenied) return csrfDenied

    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response
    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền đăng ký duyệt giảng' },
        { status: 403 },
      )
    }

    const rateLimited = await rateLimitOr429Async(
      `lecture-review-application:${access.email}:${clientIpFromRequest(request)}`,
      12,
      60_000,
    )
    if (rateLimited) return rateLimited

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu gửi lên không hợp lệ' },
        { status: 400 },
      )
    }

    const leaderCode = text(body.leaderCode, 80)
    const centerId = Number.parseInt(text(body.centerId, 20), 10)
    const candidateName = text(body.candidateName, 255)
    const lmsCode = text(body.lmsCode, 80)
    const reviewDate = text(body.reviewDate, 10)
    const reviewerName = text(body.reviewerName, 255)
    const teachingBlock = text(body.teachingBlock, 30)
    const material = (body.material || {}) as Record<string, unknown>
    const materialBucket = text(material.bucket, 120)
    const materialKey = text(material.key, 500)
    const materialFileName = text(material.fileName, 255)
    const materialFileType = text(material.contentType, 255).toLowerCase()
    const materialFileSize = Number(material.fileSize || 0)

    if (!leaderCode || !Number.isFinite(centerId) || centerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn Leader/TE quản lý và cơ sở' },
        { status: 400 },
      )
    }
    if (!candidateName || !lmsCode) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập họ tên ứng viên và mã LMS' },
        { status: 400 },
      )
    }
    if (!isIsoDate(reviewDate)) {
      return NextResponse.json(
        { success: false, error: 'Ngày đăng ký duyệt giảng không hợp lệ' },
        { status: 400 },
      )
    }
    if (!isLectureReviewReviewer(reviewerName)) {
      return NextResponse.json(
        { success: false, error: 'Giám khảo đánh giá không hợp lệ' },
        { status: 400 },
      )
    }
    if (!isLectureReviewBlock(teachingBlock)) {
      return NextResponse.json(
        { success: false, error: 'Khối giảng dạy không hợp lệ' },
        { status: 400 },
      )
    }
    if (!materialBucket || !materialKey || !materialFileName) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng tải lên tài liệu duyệt giảng' },
        { status: 400 },
      )
    }
    if (
      !Number.isFinite(materialFileSize) ||
      materialFileSize <= 0 ||
      materialFileSize > LECTURE_REVIEW_MAX_FILE_BYTES ||
      materialBucket !== LECTURE_REVIEW_BUCKET
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tài liệu phải là PDF, PPT, PPTX hoặc ODP và không vượt quá 100 MB',
        },
        { status: 400 },
      )
    }

    const [leaderResult, centerResult, candidateResult] = await Promise.all([
      pool.query(
        `SELECT code, full_name, role_code
         FROM teaching_leaders
         WHERE code = $1
           AND UPPER(TRIM(COALESCE(role_code, ''))) = ANY($2::text[])
           AND UPPER(TRIM(COALESCE(status, ''))) <> 'DEACTIVE'
         LIMIT 1`,
        [leaderCode, LECTURE_REVIEW_MANAGER_ROLE_CODES],
      ),
      pool.query(
        `SELECT id, full_name
         FROM centers
         WHERE id = $1
           AND REGEXP_REPLACE(
             LOWER(CONCAT_WS(' ', full_name, display_name, short_code)),
             '\\s+',
             '',
             'g'
           ) NOT LIKE '%testmail%'
         LIMIT 1`,
        [centerId],
      ),
      pool.query(
        `SELECT code
         FROM teachers
         WHERE LOWER(TRIM(code)) = LOWER($1)
         LIMIT 1`,
        [lmsCode],
      ),
    ])

    const leader =
      leaderResult.rows[0] || findLegacyLectureReviewLeader(leaderCode)
    if (!leader || centerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Leader/TE quản lý hoặc cơ sở không còn khả dụng' },
        { status: 400 },
      )
    }
    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy ứng viên theo mã LMS đã nhập' },
        { status: 400 },
      )
    }

    uploaded = { bucket: materialBucket, key: materialKey }
    await validateLectureReviewUpload({
      bucket: materialBucket,
      key: materialKey,
      fileName: materialFileName,
      contentType: materialFileType,
      fileSize: materialFileSize,
      ownerEmail: access.email,
    })
    const center = centerResult.rows[0]
    const canonicalLmsCode = String(candidateResult.rows[0].code)
    const insertResult = await pool.query(
      `INSERT INTO lecture_review_applications (
         manager_leader_code,
         manager_leader_name,
         manager_role_code,
         center_id,
         center_name,
         candidate_name,
         lms_code,
         review_date,
         reviewer_name,
         teaching_block,
         material_bucket,
         material_key,
         material_file_name,
         material_file_type,
         material_file_size,
         registered_by_user_id,
         registered_by_email
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10,
         $11, $12, $13, $14, $15, $16, $17
       )
       RETURNING id, created_at`,
      [
        leader.code,
        leader.full_name,
        leader.role_code,
        center.id,
        center.full_name,
        candidateName,
        canonicalLmsCode,
        reviewDate,
        reviewerName,
        teachingBlock,
        materialBucket,
        materialKey,
        materialFileName,
        materialFileType,
        materialFileSize,
        access.appUserId,
        access.email,
      ],
    )

    return NextResponse.json(
      {
        success: true,
        data: insertResult.rows[0],
        message: 'Đã gửi phiếu đăng ký duyệt giảng',
      },
      { status: 201 },
    )
  } catch (error) {
    if (uploaded) {
      await deleteObject(uploaded.bucket, uploaded.key).catch(() => undefined)
    }
    if (missingTable(error)) {
      return NextResponse.json(
        { success: false, error: 'Bảng đăng ký duyệt giảng chưa được khởi tạo' },
        { status: 503 },
      )
    }
    console.error('[lecture-review-applications][POST]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể gửi phiếu đăng ký duyệt giảng',
      },
      { status: 500 },
    )
  }
}
