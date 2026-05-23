import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── GET: Lấy danh sách môn học / bộ đề ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');           // 'monhoc' | 'bode' | 'all'
    const examType = searchParams.get('exam_type');  // loai_ky_thi
    const blockCode = searchParams.get('block_code');
    const subjectCode = searchParams.get('subject_code');

    if (type === 'monhoc' || type === 'all') {
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (examType) {
        conditions.push(`loai_ky_thi = $${values.length + 1}`);
        values.push(examType);
      }
      if (blockCode) {
        conditions.push(`ma_khoi = $${values.length + 1}`);
        values.push(blockCode);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const subjectsResult = await pool.query(
        `SELECT
           id,
           loai_ky_thi   AS exam_type,
           ma_khoi        AS block_code,
           ma_mon         AS subject_code,
           ten_mon        AS subject_name,
           dang_hoat_dong AS is_active,
           thoi_gian_thi_phut AS duration_minutes,
           che_do_chon_de AS set_selection_mode,
           tao_luc        AS created_at
         FROM chuyen_sau_monhoc
         ${where}
         ORDER BY loai_ky_thi, ma_khoi, ten_mon`,
        values
      );

      if (type === 'monhoc') {
        return NextResponse.json({ success: true, data: subjectsResult.rows });
      }

      // type === 'all': gom cả bộ đề
      const setsResult = await pool.query(
        `SELECT
           bd.id,
           bd.id_mon         AS subject_id,
           mh.ma_mon          AS subject_code,
           mh.ma_khoi         AS block_code,
           mh.loai_ky_thi     AS exam_type,
           bd.ma_de           AS set_code,
           bd.ten_de          AS set_name,
           bd.trang_thai      AS status,
           bd.diem_dat        AS passing_score,
           bd.tong_diem       AS total_points,
           bd.che_do_tinh_diem AS scoring_mode,
           bd.trong_so_ngau_nhien AS random_weight,
           COALESCE(qc.question_count, 0) AS question_count
         FROM chuyen_sau_bode bd
         JOIN chuyen_sau_monhoc mh ON mh.id = bd.id_mon
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS question_count
           FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_de = bd.id
         ) qc ON TRUE
         ORDER BY mh.loai_ky_thi, mh.ma_khoi, bd.ma_de`
      );

      return NextResponse.json({
        success: true,
        data: { subjects: subjectsResult.rows, exam_sets: setsResult.rows },
      });
    }

    if (type === 'bode') {
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (examType) {
        conditions.push(`mh.loai_ky_thi = $${values.length + 1}`);
        values.push(examType);
      }
      if (blockCode) {
        conditions.push(`mh.ma_khoi = $${values.length + 1}`);
        values.push(blockCode);
      }
      if (subjectCode) {
        conditions.push(`mh.ma_mon = $${values.length + 1}`);
        values.push(subjectCode);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT
           bd.id,
           bd.id_mon         AS subject_id,
           mh.ma_mon          AS subject_code,
           mh.ma_khoi         AS block_code,
           mh.loai_ky_thi     AS exam_type,
           bd.ma_de           AS set_code,
           bd.ten_de          AS set_name,
           bd.trang_thai      AS status,
           bd.diem_dat        AS passing_score,
           bd.tong_diem       AS total_points,
           bd.che_do_tinh_diem AS scoring_mode,
           COALESCE(qc.question_count, 0) AS question_count
         FROM chuyen_sau_bode bd
         JOIN chuyen_sau_monhoc mh ON mh.id = bd.id_mon
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS question_count
           FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_de = bd.id
         ) qc ON TRUE
         ${where}
         ORDER BY mh.loai_ky_thi, mh.ma_khoi, bd.ma_de`,
        values
      );

      return NextResponse.json({ success: true, data: result.rows });
    }

    // Default: trả về thống kê tổng quan
    const overview = await pool.query(
      `SELECT
         loai_ky_thi   AS exam_type,
         ma_khoi        AS block_code,
         COUNT(*)::int  AS subject_count
       FROM chuyen_sau_monhoc
       GROUP BY loai_ky_thi, ma_khoi
       ORDER BY loai_ky_thi, ma_khoi`
    );
    return NextResponse.json({ success: true, data: overview.rows });
  } catch (error) {
    console.error('Error in chuyensau-chonde-monhoc GET:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch subject/exam-set data' }, { status: 500 });
  }
}

// ─── POST: Tạo môn học ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      exam_type,
      block_code,
      subject_code,
      subject_name,
      is_active = true,
      duration_minutes,
      set_selection_mode = 'mac_dinh',
    } = body;

    if (!exam_type || !block_code || !subject_code || !subject_name) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: exam_type, block_code, subject_code, subject_name' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO chuyen_sau_monhoc (loai_ky_thi, ma_khoi, ma_mon, ten_mon, dang_hoat_dong, thoi_gian_thi_phut, che_do_chon_de)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ma_mon) DO UPDATE SET
         ten_mon         = EXCLUDED.ten_mon,
         dang_hoat_dong  = EXCLUDED.dang_hoat_dong,
         ma_khoi         = EXCLUDED.ma_khoi,
         loai_ky_thi     = EXCLUDED.loai_ky_thi,
         che_do_chon_de  = EXCLUDED.che_do_chon_de,
         thoi_gian_thi_phut = EXCLUDED.thoi_gian_thi_phut
       RETURNING *`,
      [
        exam_type,
        block_code,
        subject_code.toUpperCase(),
        subject_name,
        Boolean(is_active),
        Number(duration_minutes || (exam_type === 'experience' ? 60 : 120)),
        set_selection_mode,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ success: false, error: 'Failed to create subject' }, { status: 500 });
  }
}

// ─── PUT: Cập nhật môn học ───────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, subject_name, is_active, duration_minutes, set_selection_mode } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const clauses: string[] = [];
    const values: unknown[] = [];

    if (subject_name !== undefined) {
      clauses.push(`ten_mon = $${values.length + 1}`);
      values.push(subject_name);
    }
    if (is_active !== undefined) {
      clauses.push(`dang_hoat_dong = $${values.length + 1}`);
      values.push(Boolean(is_active));
    }
    if (duration_minutes !== undefined) {
      clauses.push(`thoi_gian_thi_phut = $${values.length + 1}`);
      values.push(Number(duration_minutes));
    }
    if (set_selection_mode !== undefined) {
      clauses.push(`che_do_chon_de = $${values.length + 1}`);
      values.push(set_selection_mode);
    }

    if (clauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE chuyen_sau_monhoc SET ${clauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Subject not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating subject:', error);
    return NextResponse.json({ success: false, error: 'Failed to update subject' }, { status: 500 });
  }
}

// ─── DELETE: Xóa môn học (chỉ khi chưa có bộ đề) ────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const result = await pool.query(
      `DELETE FROM chuyen_sau_monhoc WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM chuyen_sau_bode WHERE id_mon = $1)
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa - môn học đang có bộ đề hoặc không tồn tại.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Đã xóa môn học thành công' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete subject' }, { status: 500 });
  }
}
