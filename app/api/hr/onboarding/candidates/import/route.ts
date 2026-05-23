import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { parseCsvCandidates } from '@/lib/hr-onboarding-utils'
import { NextRequest, NextResponse } from 'next/server'

export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Thiếu file CSV.' }, { status: 400 })
  }

  const text = await (file as File).text()
  const { valid, skipped } = parseCsvCandidates(text)

  let inserted = 0
  const insertSkipped: Array<{ row: number; reason: string }> = [...skipped]

  for (const row of valid) {
    try {
      await pool.query(
        `INSERT INTO hr_candidates
           (full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id, source, created_by_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'csv',$9)
         ON CONFLICT (email, gen_id) DO NOTHING`,
        [row.full_name, row.email, row.phone || null, row.region_code || null,
         row.desired_campus || null, row.work_block || null, row.subject_code || null,
         row.gen_id || null, auth.sessionEmail]
      )
      inserted++
    } catch {
      insertSkipped.push({ row: 0, reason: `Lỗi khi insert email ${row.email}` })
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      total: valid.length + skipped.length,
      inserted,
      skipped: insertSkipped.length,
      reasons: insertSkipped.map(s => `Dòng ${s.row}: ${s.reason}`),
    },
  })
})
