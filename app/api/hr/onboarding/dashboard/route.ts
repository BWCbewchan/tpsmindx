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

export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const region_code = searchParams.get('region_code')

  // Build region filter
  const regionCondition = region_code ? `AND c.region_code = $1` : ''
  const regionParams = region_code ? [region_code] : []

  // Per-GEN summary
  const gensResult = await pool.query(
    `SELECT
       g.id AS gen_id,
       g.gen_name,
       COUNT(c.id) AS total,
       COUNT(c.id) FILTER (WHERE c.status = 'new') AS new,
       COUNT(c.id) FILTER (WHERE c.status = 'in_training') AS in_training,
       COUNT(c.id) FILTER (WHERE c.status = 'passed') AS passed,
       COUNT(c.id) FILTER (WHERE c.status = 'failed') AS failed,
       COUNT(c.id) FILTER (WHERE c.status = 'dropped') AS dropped
     FROM hr_gen_catalog g
     LEFT JOIN hr_candidates c ON c.gen_id = g.id ${regionCondition}
     WHERE g.is_active = true
     GROUP BY g.id, g.gen_name
     ORDER BY g.gen_name ASC`,
    regionParams
  )

  // Attendance + test score averages per GEN
  const scoresResult = await pool.query(
    `SELECT
       c.gen_id,
       AVG(
         CASE WHEN s_count.total_sessions > 0
           THEN (CAST(s_count.attended AS FLOAT) / s_count.total_sessions) * 10
           ELSE NULL END
       ) AS avg_attendance_score,
       AVG(s_count.avg_score) AS avg_test_score
     FROM hr_candidates c
     JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE r.attendance = true) AS attended,
         COUNT(DISTINCT s.id) AS total_sessions,
         AVG(r.score) AS avg_score
       FROM hr_training_sessions s
       LEFT JOIN hr_candidate_training_records r ON r.session_id = s.id AND r.candidate_id = c.id
       WHERE s.gen_id = c.gen_id
     ) s_count ON true
     ${region_code ? 'WHERE c.region_code = $1' : ''}
     GROUP BY c.gen_id`,
    regionParams
  )

  const scoresMap = new Map<number, { avg_attendance_score: number | null; avg_test_score: number | null }>()
  for (const row of scoresResult.rows) {
    scoresMap.set(row.gen_id, {
      avg_attendance_score: row.avg_attendance_score != null ? parseFloat(parseFloat(row.avg_attendance_score).toFixed(2)) : null,
      avg_test_score: row.avg_test_score != null ? parseFloat(parseFloat(row.avg_test_score).toFixed(2)) : null,
    })
  }

  const gens = gensResult.rows.map((g: any) => ({
    gen_id: g.gen_id,
    gen_name: g.gen_name,
    total: parseInt(g.total),
    new: parseInt(g.new),
    in_training: parseInt(g.in_training),
    passed: parseInt(g.passed),
    failed: parseInt(g.failed),
    dropped: parseInt(g.dropped),
    ...(scoresMap.get(g.gen_id) ?? { avg_attendance_score: null, avg_test_score: null }),
  }))

  return NextResponse.json({ success: true, gens })
})
