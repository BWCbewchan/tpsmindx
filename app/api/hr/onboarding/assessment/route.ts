import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const HR_ONBOARDING_ROUTE = '/admin/hr-onboarding'

async function validateHrAccess(email: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT u.id, u.role FROM app_users u WHERE u.email = $1 AND u.is_active = true LIMIT 1`,
    [email]
  )
  if (r.rows.length === 0) return false
  const user = r.rows[0]
  if (user.role === 'super_admin') return true
  const perm = await pool.query(
    `SELECT 1 FROM app_permissions WHERE user_id = $1 AND route_path = $2 AND can_access = true
     UNION
     SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_code = ur.role_code
     WHERE ur.user_id = $1 AND rp.route_path = $2 LIMIT 1`,
    [user.id, HR_ONBOARDING_ROUTE]
  )
  return (perm.rowCount ?? 0) > 0
}

// GET: Lấy tất cả đánh giá của một ứng viên
export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const candidate_id = searchParams.get('candidate_id')
  if (!candidate_id) return NextResponse.json({ error: 'candidate_id là bắt buộc.' }, { status: 400 })

  const result = await pool.query(
    `SELECT * FROM hr_candidate_assessments WHERE candidate_id = $1 ORDER BY created_at DESC`,
    [candidate_id]
  )

  return NextResponse.json({ success: true, assessments: result.rows })
})

// POST: Tạo hoặc cập nhật đánh giá cho ứng viên
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const body = await req.json()
  const { 
    candidate_id, 
    assessment_type, 
    total_score, 
    is_passed, 
    feedback_note, 
    criteria_scores 
  } = body

  if (!candidate_id || !assessment_type) {
    return NextResponse.json({ error: 'candidate_id và assessment_type là bắt buộc.' }, { status: 400 })
  }

  try {
    // Upsert assessment: if same candidate and same type, update it
    const result = await pool.query(
      `INSERT INTO hr_candidate_assessments 
       (candidate_id, evaluator_email, assessment_type, total_score, is_passed, feedback_note, criteria_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (candidate_id, assessment_type) 
       DO UPDATE SET 
         evaluator_email = EXCLUDED.evaluator_email,
         total_score = EXCLUDED.total_score,
         is_passed = EXCLUDED.is_passed,
         feedback_note = EXCLUDED.feedback_note,
         criteria_scores = EXCLUDED.criteria_scores,
         created_at = NOW()
       RETURNING *`,
      [candidate_id, auth.sessionEmail, assessment_type, total_score, is_passed, feedback_note, criteria_scores]
    )

    return NextResponse.json({ success: true, assessment: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error('Assessment POST error:', err)
    throw err
  }
})