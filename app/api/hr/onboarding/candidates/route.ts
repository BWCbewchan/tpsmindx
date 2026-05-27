import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { parseCsvCandidates } from '@/lib/hr-onboarding-utils'
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
     WHERE ur.user_id = $1 AND rp.route_path = $2
     LIMIT 1`,
    [user.id, HR_ONBOARDING_ROUTE]
  )
  return (perm.rowCount ?? 0) > 0
}

// ─── GET: Danh sách ứng viên ─────────────────────────────────────────────────
export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const gen_id = searchParams.get('gen_id')
  const status = searchParams.get('status')
  const region_code = searchParams.get('region_code')
  const search = searchParams.get('search')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '25')))

  const conditions: string[] = ['1=1']
  const params: unknown[] = []
  let idx = 1

  if (gen_id) { conditions.push(`gen_id = $${idx++}`); params.push(gen_id) }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status) }
  if (region_code) { conditions.push(`region_code = $${idx++}`); params.push(region_code) }
  if (search) {
    conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`)
    params.push(`%${search}%`); idx++
  }

  const where = conditions.join(' AND ')
  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM hr_candidates WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, (page - 1) * pageSize]
    ),
    pool.query(`SELECT COUNT(*) FROM hr_candidates WHERE ${where}`, params),
  ])

  const total = parseInt(countResult.rows[0].count)
  return NextResponse.json({
    success: true,
    rows: rowsResult.rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
})

// ─── POST: Tạo ứng viên thủ công ────────────────────────────────────────────
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const body = await req.json()
  const { full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id } = body

  if (!full_name || !email) {
    return NextResponse.json({ error: 'full_name và email là bắt buộc.' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO hr_candidates
         (full_name, email, phone, region_code, desired_campus, work_block, subject_code, gen_id, source, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual',$9)
       RETURNING *`,
      [full_name, email.toLowerCase().trim(), phone || null, region_code || null,
       desired_campus || null, work_block || null, subject_code || null,
       gen_id || null, auth.sessionEmail]
    )
    return NextResponse.json({ success: true, candidate: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Ứng viên với email này đã tồn tại trong GEN.' }, { status: 409 })
    }
    throw err
  }
})

// ─── PATCH: Cập nhật ứng viên ────────────────────────────────────────────────
export const PATCH = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const body = await req.json()
  const { id, full_name, phone, desired_campus, work_block, subject_code } = body

  if (!id) return NextResponse.json({ error: 'id là bắt buộc.' }, { status: 400 })

  const updates: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); params.push(full_name) }
  if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone) }
  if (desired_campus !== undefined) { updates.push(`desired_campus = $${idx++}`); params.push(desired_campus) }
  if (work_block !== undefined) { updates.push(`work_block = $${idx++}`); params.push(work_block) }
  if (subject_code !== undefined) { updates.push(`subject_code = $${idx++}`); params.push(subject_code) }

  if (updates.length === 0) return NextResponse.json({ error: 'Không có field nào để cập nhật.' }, { status: 400 })

  updates.push(`updated_by_email = $${idx++}`)
  params.push(auth.sessionEmail)
  params.push(id)

  const result = await pool.query(
    `UPDATE hr_candidates SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  if (result.rowCount === 0) return NextResponse.json({ error: 'Không tìm thấy ứng viên.' }, { status: 404 })
  return NextResponse.json({ success: true, candidate: result.rows[0] })
})

// ─── DELETE: Xóa ứng viên ────────────────────────────────────────────────────
export const DELETE = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  if (!(await validateHrAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR Onboarding.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id là bắt buộc.' }, { status: 400 })

  const check = await pool.query('SELECT status FROM hr_candidates WHERE id = $1', [id])
  if (check.rowCount === 0) return NextResponse.json({ error: 'Không tìm thấy ứng viên.' }, { status: 404 })

  const { status } = check.rows[0]
  if (['in_training', 'passed', 'failed'].includes(status)) {
    return NextResponse.json({ error: `Không thể xóa ứng viên có trạng thái "${status}".` }, { status: 422 })
  }

  await pool.query('DELETE FROM hr_candidates WHERE id = $1', [id])
  return NextResponse.json({ success: true })
})
