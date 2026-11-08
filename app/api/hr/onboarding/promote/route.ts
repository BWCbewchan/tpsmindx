import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { validateHrOnboardingAccess } from '@/lib/hr-onboarding-access'
import { mapCandidateToTeacher } from '@/lib/hr-onboarding-utils'
import { NextRequest, NextResponse } from 'next/server'

// ─── POST: Đổi trạng thái ứng viên (passed/failed/dropped) ──────────────────
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
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
    let teacherHrLinked = false

    if (status === 'passed') {
      const teacherData = mapCandidateToTeacher(candidate)
      // Kiểm tra teacher đã tồn tại chưa
      const existing = await client.query(
        `SELECT code, hr_candidate_id
         FROM teachers
         WHERE LOWER(TRIM(COALESCE(work_email, ''))) = LOWER(TRIM($1))
            OR LOWER(TRIM(COALESCE("Work email", ''))) = LOWER(TRIM($1))
            OR LOWER(TRIM(COALESCE(personal_email, ''))) = LOWER(TRIM($1))
            OR LOWER(TRIM(code)) = LOWER(TRIM($2))
         LIMIT 1`,
        [candidate.email, teacherData.code]
      )

      if ((existing.rowCount ?? 0) > 0) {
        teacherAlreadyExists = true
        const existingTeacher = existing.rows[0] as {
          code: string
          hr_candidate_id: number | null
        }
        const linked = await client.query(
          `UPDATE teachers
           SET hr_candidate_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE code = $2
             AND (hr_candidate_id IS NULL OR hr_candidate_id = $1)
           RETURNING code`,
          [candidate_id, existingTeacher.code],
        )
        teacherHrLinked = (linked.rowCount ?? 0) > 0
      } else {
        await client.query(
          `INSERT INTO teachers (
             code, full_name, work_email, main_centre, course_line, status, source,
             hr_candidate_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            teacherData.code,
            teacherData.full_name,
            teacherData.work_email,
            teacherData.main_centre,
            teacherData.course_line,
            teacherData.status,
            teacherData.source,
            candidate_id,
          ]
        )
        teacherInserted = true
        teacherHrLinked = true
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      candidate: { id: candidate_id, status },
      ...(status === 'passed' && {
        teacherInserted,
        teacherAlreadyExists,
        teacherHrLinked,
      }),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})
