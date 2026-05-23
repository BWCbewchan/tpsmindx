/**
 * exam-assignment-questions/route.ts
 *
 * Flow mới:
 *   - Câu hỏi được phân công dựa trên chuyen_sau_results (result_id) chứ không phải bảng phân công cũ.
 *   - GET  → lấy câu hỏi được phân cho result_id (từ bộ đề đã gán: ma_de trong chuyen_sau_results)
 *   - POST → phân công bộ đề cho result → cập nhật ma_de + tạo câu hỏi trong chuyen_sau_baithi_cauhoi
 *   - PUT  → cập nhật thông tin phân công (ma_de)
 */

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── GET: Lấy câu hỏi theo result_id / assignment_id ─────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Chấp nhận cả result_id và assignment_id (cùng là chuyen_sau_results.id)
    const resultId = searchParams.get('result_id') || searchParams.get('assignment_id');

    if (!resultId) {
      return NextResponse.json(
        { success: false, error: 'Cần result_id hoặc assignment_id' },
        { status: 400 }
      );
    }

    // Tìm result kèm thông tin bộ đề (fallback từ chonde_thang nếu id_de_thi chưa set)
    const resultRow = await pool.query(
      `SELECT
         r.id,
         r.id_de_thi,
         COALESCE(r.id_de_thi, ct_sub.id_de)         AS resolved_set_id,
         r.id_mon,
         r.id_su_kien,
         r.ma_giao_vien,
         r.ho_ten,
         r.diem,
         r.thang_dk,
         r.nam_dk,
         r.dang_ky_luc,
         r.thoi_gian_kiem_tra,
         mh.ma_mon,
         mh.ten_mon,
         mh.ma_khoi,
         mh.loai_ky_thi,
         mh.thoi_gian_thi_phut,
         -- Thời gian làm bài thực tế từ event_schedules (ket_thuc - bat_dau), fallback từ môn học
         COALESCE(ev_dur.duration_min, mh.thoi_gian_thi_phut, 90)::int AS event_duration_minutes,
         ev_dur.event_open_at,
         ev_dur.event_close_at,
         bd.id                                        AS bode_id,
         bd.ma_de                                     AS set_code,
         bd.ten_de                                    AS set_name,
         bd.tong_diem                                 AS total_points,
         bd.diem_dat                                  AS passing_score
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN LATERAL (
         SELECT ct.id_de FROM chuyen_sau_chonde_thang ct
         WHERE ct.id_mon = r.id_mon
           AND ct.nam   = COALESCE(r.nam_dk,   EXTRACT(YEAR  FROM NOW())::int)
           AND ct.thang = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int)
         LIMIT 1
       ) ct_sub ON (r.id_de_thi IS NULL)
       LEFT JOIN chuyen_sau_bode bd ON bd.id = COALESCE(r.id_de_thi, ct_sub.id_de)
       -- Lấy thời gian làm bài từ event_schedules: ưu tiên id_su_kien, fallback tìm theo tháng/năm/môn
       LEFT JOIN LATERAL (
         SELECT
           (EXTRACT(EPOCH FROM (ket_thuc_luc - bat_dau_luc)) / 60)::int AS duration_min,
           bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS event_open_at,
           ket_thuc_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS event_close_at
         FROM event_schedules
         WHERE loai_su_kien = 'exam'
           AND (
             (r.id_su_kien IS NOT NULL AND id = r.id_su_kien)
             OR (
               r.id_su_kien IS NULL
               AND chuyen_nganh = mh.ma_mon
               AND EXTRACT(YEAR  FROM bat_dau_luc) = COALESCE(r.nam_dk,  EXTRACT(YEAR  FROM NOW()))
               AND EXTRACT(MONTH FROM bat_dau_luc) = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW()))
             )
           )
         ORDER BY (r.id_su_kien IS NOT NULL AND id = r.id_su_kien) DESC, bat_dau_luc DESC
         LIMIT 1
       ) ev_dur ON TRUE
       WHERE r.id = $1
       LIMIT 1`,
      [resultId]
    );

    if (resultRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy kết quả đăng ký' }, { status: 404 });
    }

    const row = resultRow.rows[0];
    const resolvedSetId = row.resolved_set_id;

    if (!resolvedSetId) {
      return NextResponse.json({
        success: false,
        error: 'Chưa có bộ đề nào được phân công cho lần thi này',
      }, { status: 404 });
    }

    // Tính open_at / close_at:
    // - Nếu đã bắt đầu thi (thoi_gian_kiem_tra set): open_at = lúc bắt đầu, close_at = bắt đầu + thời gian thi
    // - Nếu chưa: open_at = đầu tháng, close_at = đầu tháng sau (window cho phép lấy bài)
    // Thời gian làm bài = event_duration_minutes (từ event_schedules) hoặc fallback 90 phút
    const timeLimitMinutes = Number(row.event_duration_minutes) || 90;
    const durationMs = timeLimitMinutes * 60_000;

    // Ưu tiên dùng event_schedules.bat_dau_luc / ket_thuc_luc nếu có (admin đặt giờ qua "Tạo sự kiện")
    let openAtTs: string;
    let closeAtTs: string;

    if (row.event_open_at && row.event_close_at) {
      openAtTs  = new Date(row.event_open_at).toISOString();
      closeAtTs = new Date(row.event_close_at).toISOString();
    } else {
      const THOI_GIAN_REGEX = /^[0-9]{1,2}:[0-9]{2} [0-9]{2}\/[0-9]{2}\/[0-9]{4}$/;
      const hasStartedTime =
        typeof row.thoi_gian_kiem_tra === 'string' &&
        THOI_GIAN_REGEX.test(row.thoi_gian_kiem_tra.trim());

      if (hasStartedTime) {
        // Parse 'HH:MM DD/MM/YYYY' as Asia/Ho_Chi_Minh -> compute UTC ms
        const [timePart, datePart] = row.thoi_gian_kiem_tra.trim().split(' ');
        const [hh, mm] = timePart.split(':').map(Number);
        const [dd, mo, yyyy] = datePart.split('/').map(Number);
        // VN is UTC+7: subtract 7 hours to get UTC
        const startMs = Date.UTC(yyyy, mo - 1, dd, hh - 7, mm, 0, 0);
        openAtTs = new Date(startMs).toISOString();
        closeAtTs = new Date(startMs + durationMs).toISOString();
      } else if (row.thang_dk && row.nam_dk) {
        openAtTs = new Date(row.nam_dk, row.thang_dk - 1, 1).toISOString();
        closeAtTs = new Date(row.nam_dk, row.thang_dk, 1).toISOString();
      } else if (row.dang_ky_luc) {
        openAtTs = new Date(row.dang_ky_luc).toISOString();
        closeAtTs = new Date(new Date(row.dang_ky_luc).getTime() + durationMs).toISOString();
      } else {
        openAtTs = new Date().toISOString();
        closeAtTs = new Date(Date.now() + durationMs).toISOString();
      }
    }

    // Build assignment object đúng format mà exam page cần
    const assignment = {
      id: row.id,
      teacher_code: row.ma_giao_vien || '',
      subject_code: row.ma_mon || '',
      subject_name: row.ten_mon || '',
      set_code: row.set_code || '',
      set_name: row.set_name || '',
      open_at: openAtTs,
      close_at: closeAtTs,
      total_points: Number(row.total_points || 0),
      passing_score: row.passing_score != null ? Number(row.passing_score) : null,
      assignment_status: 'assigned',
      score: row.diem != null ? Number(row.diem) : null,
      time_limit_minutes: timeLimitMinutes,
    };

    // Lấy câu hỏi từ bộ đề
    const questions = await pool.query(
      `SELECT
         cq.id                                              AS id,
         bc.id_de                                          AS set_id,
         bd.ma_de                                          AS set_code,
         cq.loai_cau_hoi                                   AS question_type,
         cq.noi_dung_cau_hoi                               AS question_text,
         CASE
           WHEN cq.lua_chon_a IS NOT NULL OR cq.lua_chon_b IS NOT NULL
            OR cq.lua_chon_c IS NOT NULL OR cq.lua_chon_d IS NOT NULL
           THEN jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
           ELSE NULL
         END                                               AS options,
         cq.dap_an_dung                                    AS correct_answer,
         cq.giai_thich                                     AS explanation,
         cq.image_url                                      AS image_url,
         cq.diem                                           AS points,
         cq.do_kho                                         AS difficulty,
         bc.thu_tu_hien_thi                                AS order_number
       FROM chuyen_sau_bode bd
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_de = bd.id
       JOIN chuyen_sau_cauhoi cq      ON cq.id = bc.id_cau
       WHERE bd.id = $1
       ORDER BY bc.thu_tu_hien_thi ASC`,
      [resolvedSetId]
    );

    return NextResponse.json({
      success: true,
      assignment,
      questions: questions.rows,
      count: questions.rows.length,
    });
  } catch (error) {
    console.error('Error fetching assignment questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assignment questions' }, { status: 500 });
  }
}

// ─── POST: Phân công bộ đề cho result ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { result_id, set_code, set_id } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }
    if (!set_code && !set_id) {
      return NextResponse.json({ success: false, error: 'set_code hoặc set_id là bắt buộc' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Xác định bộ đề
    let resolvedSetCode = set_code;
    if (!resolvedSetCode) {
      const setRow = await client.query('SELECT ma_de FROM chuyen_sau_bode WHERE id = $1', [set_id]);
      if (setRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Bộ đề không tồn tại' }, { status: 404 });
      }
      resolvedSetCode = setRow.rows[0].ma_de;
    }

    // Cập nhật ma_de và trạng thái trên results
    const updated = await client.query(
      `UPDATE chuyen_sau_results
       SET ma_de = $1, trang_thai = 'da_phan_cong'
       WHERE id = $2
       RETURNING *`,
      [resolvedSetCode, result_id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Không tìm thấy result' }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      data: updated.rows[0],
      message: `Đã phân công bộ đề ${resolvedSetCode}`,
    }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign questions' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Đổi bộ đề cho result ───────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { result_id, set_code } = body;

    if (!result_id || !set_code) {
      return NextResponse.json({ success: false, error: 'result_id và set_code là bắt buộc' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE chuyen_sau_results SET ma_de = $1 WHERE id = $2 AND trang_thai IN ('da_dang_ky', 'da_phan_cong')
       RETURNING *`,
      [set_code, result_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không thể đổi bộ đề - kết quả không tồn tại hoặc đã thi xong.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assignment' }, { status: 500 });
  }
}
