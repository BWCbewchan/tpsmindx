import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { mapCandidateToTeacher } from '@/lib/hr-onboarding-utils'
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

// ─── POST: Đổi trạng thái ứng viên (passed/failed/dropped) ──────────────────
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const { candidate_id, status } = await req.json()

  if (!candidate_id || !status) {
    return NextResponse.json({ error: 'candidate_id và status là bắt buộc.' }, { status: 400 })
  }
  if (!['passed', 'failed', 'dropped'].includes(status)) {
    return NextResponse.json({ error: 'status phải là passed, failed hoặc dropped.' }, { status: 400 })
  }

  // Lấy thông tin ứng viên
  const candidateResult = await pool.query(
    `SELECT * FROM hr_candidates WHERE id = $1`,
    [candidate_id]
  )
  if (candidateResult.rowCount === 0) {
    return NextResponse.json({ error: 'Không tìm thấy ứng viên.' }, { status: 404 })
  }
  const candidate = candidateResult.rows[0]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Cập nhật status ứng viên
    await client.query(
      `UPDATE hr_candidates SET status = $1, updated_by_email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [status, auth.sessionEmail, candidate_id]
    )

    let teacherInserted = false
    let teacherAlreadyExists = false

    if (status === 'passed') {
      // Kiểm tra teacher đã tồn tại chưa
      const existing = await client.query(
        `SELECT id FROM teachers WHERE work_email = $1 LIMIT 1`,
        [candidate.email]
      )

      if ((existing.rowCount ?? 0) > 0) {
        teacherAlreadyExists = true
      } else {
        const teacherData = mapCandidateToTeacher(candidate)
        await client.query(
          `INSERT INTO teachers (code, full_name, work_email, main_centre, course_line, status, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            teacherData.code,
            teacherData.full_name,
            teacherData.work_email,
            teacherData.main_centre,
            teacherData.course_line,
            teacherData.status,
            teacherData.source,
          ]
        )
        teacherInserted = true
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      candidate: { id: candidate_id, status },
      ...(status === 'passed' && { teacherInserted, teacherAlreadyExists }),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})
