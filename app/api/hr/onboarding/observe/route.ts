import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { validateHrOnboardingAccess } from '@/lib/hr-onboarding-access'
import { NextRequest, NextResponse } from 'next/server'

// GET: Danh sách bài thu hoạch của ứng viên
export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const candidate_id = searchParams.get('candidate_id')
  if (!candidate_id) return NextResponse.json({ error: 'candidate_id là bắt buộc.' }, { status: 400 })

  const result = await pool.query(
    `SELECT * FROM hr_observe_sessions WHERE candidate_id = $1 ORDER BY observe_date DESC`,
    [candidate_id]
  )

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM hr_observe_sessions WHERE candidate_id = $1`,
    [candidate_id]
  )

  return NextResponse.json({
    success: true,
    sessions: result.rows,
    total: parseInt(countResult.rows[0].count),
  })
})

// POST: Nộp bài thu hoạch
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const body = await req.json()
  const { candidate_id, center_code, observe_date, class_type, harvest_file_url } = body

  if (!candidate_id || !center_code || !observe_date || !class_type || !harvest_file_url) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 })
  }

  const result = await pool.query(
    `INSERT INTO hr_observe_sessions (candidate_id, center_code, observe_date, class_type, harvest_file_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [candidate_id, center_code, observe_date, class_type, harvest_file_url]
  )

  return NextResponse.json({ success: true, session: result.rows[0] }, { status: 201 })
})

// PATCH: Duyệt / từ chối bài thu hoạch
export const PATCH = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const body = await req.json()
  const { id, status } = body

  if (!id || !status) return NextResponse.json({ error: 'id và status là bắt buộc.' }, { status: 400 })
  if (!['submitted', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status không hợp lệ.' }, { status: 400 })
  }

  const result = await pool.query(
    `UPDATE hr_observe_sessions SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, auth.sessionEmail, id]
  )
  if (result.rowCount === 0) return NextResponse.json({ error: 'Không tìm thấy bài thu hoạch.' }, { status: 404 })

  return NextResponse.json({ success: true, session: result.rows[0] })
})
