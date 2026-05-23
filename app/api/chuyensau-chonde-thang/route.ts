import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── GET: Lấy bộ đề chọn mặc định cho tháng ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = parseInt(searchParams.get('subject_id') || '0', 10);
    const year = parseInt(searchParams.get('year') || '0', 10);
    const month = parseInt(searchParams.get('month') || '0', 10);

    if (!subjectId || !year || !month) {
      return NextResponse.json({ success: false, error: 'Bắt buộc: subject_id, year, month' }, { status: 400 });
    }

    const res = await pool.query(
      `SELECT
         ct.id_de AS set_id,
         bd.ma_de AS set_code,
         bd.ten_de AS set_name,
         ct.che_do_chon AS selection_mode,
         COALESCE(qc.question_count, 0) AS question_count
       FROM chuyen_sau_chonde_thang ct
       JOIN chuyen_sau_bode bd ON bd.id = ct.id_de
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS question_count
         FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_de = bd.id
       ) qc ON TRUE
       WHERE ct.id_mon = $1 AND ct.nam = $2 AND ct.thang = $3`,
      [subjectId, year, month]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    console.error('Error fetching monthly selection:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Chọn thủ công bộ đề (ghi đè) ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject_id, year, month, selected_set_id } = body;

    if (!subject_id || !year || !month || !selected_set_id) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO chuyen_sau_chonde_thang (id_mon, nam, thang, id_de, che_do_chon)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (id_mon, nam, thang)
       DO UPDATE SET
         id_de = EXCLUDED.id_de,
         che_do_chon = 'manual',
         tao_luc = CURRENT_TIMESTAMP,
         cap_nhat_luc = CURRENT_TIMESTAMP
       RETURNING *`,
      [parseInt(subject_id, 10), parseInt(year, 10), parseInt(month, 10), parseInt(selected_set_id, 10)]
    );

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    console.error('Error saving manual selection:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Chọn ngẫu nhiên bộ đề ────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject_id, year, month } = body;

    if (!subject_id || !year || !month) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Lấy các bộ đề hợp lệ của môn
    const validSets = await pool.query(
      `SELECT
         bd.id, bd.ma_de, bd.ten_de
       FROM chuyen_sau_bode bd
       JOIN LATERAL (
         SELECT COUNT(*) AS c FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_de = bd.id
       ) qc ON true
       WHERE bd.id_mon = $1
         AND bd.trang_thai = 'active'
         AND qc.c > 0`,
      [parseInt(subject_id, 10)]
    );

    if (validSets.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có bộ đề hợp lệ để chọn ngẫu nhiên.' }, { status: 400 });
    }

    // Chọn random 1 bộ
    const randomIndex = Math.floor(Math.random() * validSets.rows.length);
    const chosenSet = validSets.rows[randomIndex];

    const res = await pool.query(
      `INSERT INTO chuyen_sau_chonde_thang (id_mon, nam, thang, id_de, che_do_chon)
       VALUES ($1, $2, $3, $4, 'random')
       ON CONFLICT (id_mon, nam, thang)
       DO UPDATE SET
         id_de = EXCLUDED.id_de,
         che_do_chon = 'random',
         tao_luc = CURRENT_TIMESTAMP,
         cap_nhat_luc = CURRENT_TIMESTAMP
       RETURNING *`,
      [parseInt(subject_id, 10), parseInt(year, 10), parseInt(month, 10), chosenSet.id]
    );

    return NextResponse.json({ success: true, data: { ...res.rows[0], chosenSet } });
  } catch (error) {
    console.error('Error randomizing selection:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Xóa lựa chọn của tháng ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = parseInt(searchParams.get('subject_id') || '0', 10);
    const year = parseInt(searchParams.get('year') || '0', 10);
    const month = parseInt(searchParams.get('month') || '0', 10);

    if (!subjectId || !year || !month) {
      return NextResponse.json({ success: false, error: 'Bắt buộc: subject_id, year, month' }, { status: 400 });
    }

    await pool.query(
      `DELETE FROM chuyen_sau_chonde_thang
       WHERE id_mon = $1 AND nam = $2 AND thang = $3`,
      [subjectId, year, month]
    );

    return NextResponse.json({ success: true, message: 'Đã xóa lựa chọn' });
  } catch (error) {
    console.error('Error deleting monthly selection:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
