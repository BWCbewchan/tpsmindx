import { requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET: Danh sách sessions theo gen_id ─────────────────────────────────────
export const GET = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  const gen_id = new URL(req.url).searchParams.get('gen_id')
  if (!gen_id) return NextResponse.json({ error: 'gen_id là bắt buộc.' }, { status: 400 })

  const result = await pool.query(
    `SELECT s.*, tv.title AS video_title
     FROM hr_training_sessions s
     LEFT JOIN training_videos tv ON tv.id = s.video_id
     WHERE s.gen_id = $1
     ORDER BY s.session_number ASC`,
    [gen_id]
  )
  return NextResponse.json({ success: true, sessions: result.rows })
})

// ─── POST: Tạo buổi training ─────────────────────────────────────────────────
export const POST = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  const { gen_id, session_number, title, session_date, video_id } = await req.json()

  if (!gen_id || !session_number || !title) {
    return NextResponse.json({ error: 'gen_id, session_number và title là bắt buộc.' }, { status: 400 })
  }
  if (session_number < 1 || session_number > 4) {
    return NextResponse.json({ error: 'session_number phải từ 1 đến 4.' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO hr_training_sessions (gen_id, session_number, title, session_date, video_id, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [gen_id, session_number, title, session_date || null, video_id || null, auth.sessionEmail]
    )
    return NextResponse.json({ success: true, session: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ error: `Buổi ${session_number} của GEN này đã tồn tại.` }, { status: 409 })
    }
    throw err
  }
})

// ─── PATCH: Cập nhật buổi training ───────────────────────────────────────────
export const PATCH = withApiProtection(async (req: NextRequest) => {
  const auth = await requireBearerSession(req)
  if (!auth.ok) return auth.response

  const { id, title, session_date, video_id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id là bắt buộc.' }, { status: 400 })

  const updates: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title) }
  if (session_date !== undefined) { updates.push(`session_date = $${idx++}`); params.push(session_date) }
  if (video_id !== undefined) { updates.push(`video_id = $${idx++}`); params.push(video_id) }

  if (updates.length === 0) return NextResponse.json({ error: 'Không có field nào để cập nhật.' }, { status: 400 })

  params.push(id)
  const result = await pool.query(
    `UPDATE hr_training_sessions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  if (result.rowCount === 0) return NextResponse.json({ error: 'Không tìm thấy buổi training.' }, { status: 404 })
  return NextResponse.json({ success: true, session: result.rows[0] })
})
