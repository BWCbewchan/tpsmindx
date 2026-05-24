import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { validateHrOnboardingAccess } from '@/lib/hr-onboarding-access'
import { NextRequest, NextResponse } from 'next/server'

// GET: Lịch sử chuyển GEN của ứng viên
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
    `SELECT t.*, 
            fg.gen_name as from_gen_name, 
            tg.gen_name as to_gen_name
     FROM hr_candidate_gen_transfers t
     LEFT JOIN hr_gen_catalog fg ON fg.id = t.from_gen_id
     LEFT JOIN hr_gen_catalog tg ON tg.id = t.to_gen_id
     WHERE t.candidate_id = $1
     ORDER BY t.created_at DESC`,
    [candidate_id]
  )

  return NextResponse.json({ success: true, transfers: result.rows })
})

// POST: Chuyển GEN cho ứng viên
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response
  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const body = await req.json()
  const { candidate_id, to_gen_id, reason } = body

  if (!candidate_id || !to_gen_id) {
    return NextResponse.json({ error: 'candidate_id và to_gen_id là bắt buộc.' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Validate candidate exists and not deleted
    const candidateRes = await client.query(
      `SELECT id, current_gen_id, gen_id, is_deleted FROM hr_candidates WHERE id = $1`,
      [candidate_id]
    )
    if (candidateRes.rowCount === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Không tìm thấy ứng viên.' }, { status: 404 })
    }
    const candidate = candidateRes.rows[0]
    if (candidate.is_deleted) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Ứng viên đã bị xóa.' }, { status: 422 })
    }

    // 2. Validate to_gen_id exists
    const genRes = await client.query('SELECT id FROM hr_gen_catalog WHERE id = $1', [to_gen_id])
    if (genRes.rowCount === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'GEN đích không tồn tại.' }, { status: 404 })
    }

    const fromGenId = candidate.current_gen_id || candidate.gen_id

    // 3. Insert transfer history
    await client.query(
      `INSERT INTO hr_candidate_gen_transfers (candidate_id, from_gen_id, to_gen_id, reason, changed_by_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [candidate_id, fromGenId, to_gen_id, reason || null, auth.sessionEmail]
    )

    // 4. Update candidate current_gen_id and gen_id (NOT initial_gen_id, NOT candidate_code)
    await client.query(
      `UPDATE hr_candidates SET current_gen_id = $1, gen_id = $1 WHERE id = $2`,
      [to_gen_id, candidate_id]
    )

    await client.query('COMMIT')

    return NextResponse.json({ success: true, message: 'Chuyển GEN thành công.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Transfer GEN error:', err)
    throw err
  } finally {
    client.release()
  }
})
