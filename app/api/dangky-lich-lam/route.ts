import pool from '@/lib/db'
import { requireSameOriginMutation } from '@/lib/api-security'
import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from '@/lib/datasource-api-auth'
import { NextRequest, NextResponse } from 'next/server'

// Chuyển "HH:MM" thành số phút
function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
// Số phút → "HH:MM"
function fromMinutes(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const maGv = searchParams.get('ma_gv')?.trim()
    const thang = searchParams.get('thang')
    if (!maGv) return NextResponse.json({ success: false, error: 'Thiếu ma_gv' }, { status: 400 })

    const denied = await rejectIfDatasourceLookupForbidden(auth.sessionEmail, Boolean(auth.resolvedAccess.isAdmin), '', maGv)
    if (denied) return denied

    let query = `SELECT id, ma_gv, TO_CHAR(ngay, 'YYYY-MM-DD') as ngay, gio_bat_dau, gio_ket_thuc, co_so_uu_tien, linh_hoat, kieu_lap, schedule_source, source_schedule_id FROM dangky_lich_lam WHERE LOWER(TRIM(ma_gv)) = LOWER(TRIM($1))`
    const values: unknown[] = [maGv]
    if (thang) { query += ` AND TO_CHAR(ngay, 'YYYY-MM') = $2`; values.push(thang) }
    query += ` ORDER BY ngay ASC, gio_bat_dau ASC`

    const result = await pool.query(query, values)
    return NextResponse.json({ success: true, data: result.rows })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  try {
    const originDenied = requireSameOriginMutation(request)
    if (originDenied) return originDenied
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { ma_gv, ngay, gio_bat_dau, gio_ket_thuc, co_so_uu_tien, linh_hoat, lap_lai_tu_ngay, lap_lai_den_ngay, kieu_lap } = body

    if (!ma_gv || !ngay || !gio_bat_dau || !gio_ket_thuc) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
    }

    const denied = await rejectIfDatasourceLookupForbidden(auth.sessionEmail, Boolean(auth.resolvedAccess.isAdmin), '', ma_gv)
    if (denied) return denied

    await client.query('BEGIN')

    // Lấy tất cả slot hiện có của ngày này
    const existing = await client.query(
      `SELECT id, gio_bat_dau, gio_ket_thuc, co_so_uu_tien, linh_hoat
       FROM dangky_lich_lam
       WHERE LOWER(TRIM(ma_gv)) = LOWER(TRIM($1))
         AND ngay = $2::date
         AND source_schedule_id IS NULL
       ORDER BY gio_bat_dau`,
      [ma_gv, ngay]
    )

    const newStart = toMinutes(gio_bat_dau.slice(0, 5))
    const newEnd = toMinutes(gio_ket_thuc.slice(0, 5))
    const newCoSo: string[] = co_so_uu_tien || []
    const newLinhHoat: boolean = linh_hoat || false

    // Tìm các slot overlap với slot mới
    type ExistingScheduleRow = {
      id: number
      gio_bat_dau: string
      gio_ket_thuc: string
      co_so_uu_tien: string[] | null
      linh_hoat: boolean | null
    }
    const overlapping: ExistingScheduleRow[] = existing.rows.filter((row: ExistingScheduleRow) => {
      const s = toMinutes(row.gio_bat_dau.slice(0, 5))
      const e = toMinutes(row.gio_ket_thuc.slice(0, 5))
      return newStart < e && newEnd > s // overlap condition
    })

    let finalStart = newStart
    let finalEnd = newEnd
    const finalCoSo = [...newCoSo]
    let finalLinhHoat = newLinhHoat

    if (overlapping.length > 0) {
      // Merge: lấy min start, max end, union co_so
      for (const row of overlapping) {
        finalStart = Math.min(finalStart, toMinutes(row.gio_bat_dau.slice(0, 5)))
        finalEnd = Math.max(finalEnd, toMinutes(row.gio_ket_thuc.slice(0, 5)))
        const existingCoSo: string[] = row.co_so_uu_tien || []
        existingCoSo.forEach(cs => { if (!finalCoSo.includes(cs)) finalCoSo.push(cs) })
        if (row.linh_hoat) finalLinhHoat = true
      }
      // Xóa các slot bị overlap
      const idsToDelete = overlapping.map((row) => row.id)
      await client.query(`DELETE FROM dangky_lich_lam WHERE id = ANY($1)`, [idsToDelete])
    }

    // Insert slot đã merge (hoặc slot mới nếu không overlap)
    const result = await client.query(
      `INSERT INTO dangky_lich_lam (ma_gv, ngay, gio_bat_dau, gio_ket_thuc, co_so_uu_tien, linh_hoat, lap_lai_tu_ngay, lap_lai_den_ngay, kieu_lap)
       VALUES ($1, $2::date, $3::time, $4::time, $5, $6, $7::date, $8::date, $9)
       RETURNING id, ma_gv, TO_CHAR(ngay, 'YYYY-MM-DD') as ngay, gio_bat_dau, gio_ket_thuc, co_so_uu_tien, linh_hoat`,
      [ma_gv, ngay, fromMinutes(finalStart), fromMinutes(finalEnd), finalCoSo, finalLinhHoat,
       lap_lai_tu_ngay || null, lap_lai_den_ngay || null, kieu_lap || 'tuan']
    )

    await client.query('COMMIT')
    return NextResponse.json({ success: true, data: result.rows[0], merged: overlapping.length > 0 })
  } catch (error: any) {
    await client.query('ROLLBACK')
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originDenied = requireSameOriginMutation(request)
    if (originDenied) return originDenied
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const maGv = searchParams.get('ma_gv')?.trim()
    const ngay = searchParams.get('ngay')

    if (maGv) {
      const denied = await rejectIfDatasourceLookupForbidden(auth.sessionEmail, Boolean(auth.resolvedAccess.isAdmin), '', maGv)
      if (denied) return denied
    } else if (id && !Boolean(auth.resolvedAccess.isAdmin)) {
      const owner = await pool.query(
        'SELECT ma_gv, source_schedule_id FROM dangky_lich_lam WHERE id = $1 LIMIT 1',
        [id],
      )
      if (owner.rows.length === 0) return NextResponse.json({ success: false, error: 'Không tìm thấy lịch' }, { status: 404 })
      const denied = await rejectIfDatasourceLookupForbidden(auth.sessionEmail, false, '', String(owner.rows[0].ma_gv || ''))
      if (denied) return denied
    }

    if (id) {
      const sourceResult = await pool.query(
        'SELECT source_schedule_id FROM dangky_lich_lam WHERE id = $1 LIMIT 1',
        [id],
      )
      if (sourceResult.rows[0]?.source_schedule_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Ca này thuộc lịch Team Teaching. Vui lòng chỉnh sửa tại trang Đăng ký lịch làm việc.',
          },
          { status: 409 },
        )
      }
      await pool.query(`DELETE FROM dangky_lich_lam WHERE id = $1`, [id])
    } else if (maGv && ngay) {
      await pool.query(
        `DELETE FROM dangky_lich_lam
         WHERE LOWER(TRIM(ma_gv)) = LOWER(TRIM($1))
           AND ngay = $2::date
           AND source_schedule_id IS NULL`,
        [maGv, ngay],
      )
    } else {
      return NextResponse.json({ success: false, error: 'Thiếu id hoặc ma_gv+ngay' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
