import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { clampScore, calculateAttendanceScore, calculateAvgTestScore } from '@/lib/hr-onboarding-utils'
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

// ─── GET: Records + candidateSummaries ───────────────────────────────────────
export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const gen_id = searchParams.get('gen_id')
  const session_id = searchParams.get('session_id')

  if (!gen_id) return NextResponse.json({ error: 'gen_id là bắt buộc.' }, { status: 400 })

  // Lấy tất cả sessions của GEN
  const sessionsResult = await pool.query(
    `SELECT id, session_number, title FROM hr_training_sessions WHERE gen_id = $1 ORDER BY session_number ASC`,
    [gen_id]
  )
  const sessions = sessionsResult.rows

  // Lấy tất cả ứng viên của GEN
  const candidatesResult = await pool.query(
    `SELECT id, full_name, email, status FROM hr_candidates WHERE gen_id = $1 ORDER BY full_name ASC`,
    [gen_id]
  )
  const candidates = candidatesResult.rows

  // Lấy records (filter theo session_id nếu có)
  let recordsResult
  if (session_id) {
    recordsResult = await pool.query(
      `SELECT r.* FROM hr_candidate_training_records r
       WHERE r.session_id = $1`,
      [session_id]
    )
  } else {
    recordsResult = await pool.query(
      `SELECT r.* FROM hr_candidate_training_records r
       JOIN hr_training_sessions s ON s.id = r.session_id
       WHERE s.gen_id = $1`,
      [gen_id]
    )
  }
  const records = recordsResult.rows

  // Build candidateSummaries
  const totalSessions = sessions.length
  const candidateSummaries = candidates.map(c => {
    const cRecords = records.filter(r => r.candidate_id === c.id)
    const sessionDetails = sessions.map(s => {
      const rec = cRecords.find(r => r.session_id === s.id)
      return {
        session_id: s.id,
        session_number: s.session_number,
        attendance: rec?.attendance ?? null,
        score: rec?.score != null ? parseFloat(rec.score) : null,
      }
    })
    const attended = sessionDetails.filter(s => s.attendance === true).length
    const scores = sessionDetails.map(s => s.score).filter((s): s is number => s != null)
    return {
      candidate_id: c.id,
      full_name: c.full_name,
      email: c.email,
      status: c.status,
      sessions: sessionDetails,
      attendance_score: calculateAttendanceScore(attended, totalSessions),
      avg_test_score: calculateAvgTestScore(scores),
    }
  })

  return NextResponse.json({ success: true, records, sessions, candidateSummaries })
})

// ─── PATCH: Batch upsert records ─────────────────────────────────────────────
export const PATCH = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const body = await req.json()
  const { records } = body as {
    records: Array<{ candidate_id: number; session_id: number; attendance: boolean; score?: number | null }>
  }

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records là bắt buộc và không được rỗng.' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const upserted: number[] = []
    for (const rec of records) {
      const clampedScore = rec.score != null ? clampScore(rec.score) : null
      const result = await client.query(
        `INSERT INTO hr_candidate_training_records
           (candidate_id, session_id, attendance, score, recorded_by_email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (candidate_id, session_id) DO UPDATE SET
           attendance = EXCLUDED.attendance,
           score = EXCLUDED.score,
           recorded_by_email = EXCLUDED.recorded_by_email,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [rec.candidate_id, rec.session_id, rec.attendance, clampedScore, auth.sessionEmail]
      )
      upserted.push(result.rows[0].id)

      // Auto-update candidate status new → in_training
      await client.query(
        `UPDATE hr_candidates SET status = 'in_training', updated_by_email = $1
         WHERE id = $2 AND status = 'new'`,
        [auth.sessionEmail, rec.candidate_id]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true, upserted: upserted.length })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})
