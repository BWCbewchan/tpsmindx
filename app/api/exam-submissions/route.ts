/**
 * exam-submissions/route.ts
 *
 * Flow nộp bài MỚI (schema V60):
 *   1. User nộp answers kèm result_id (đã có trên chuyen_sau_results)
 *   2. Server tính điểm từ chuyen_sau_cauhoi
 *   3. Lưu từng câu vào chuyen_sau_baithi_cauhoi
 *   4. Cập nhật chuyen_sau_results: so_diem, so_cau_dung, tong_cau, trang_thai='da_nop'
 *
 * Không còn dùng: chuyen_sau_phancong, chuyen_sau_dangky, chuyen_sau_submissions (legacy)
 */

import {
    rejectIfChuyenSauResultNotOwned,
    rejectIfEmailNotSelf,
    requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface AnswerPayload {
  question_id: number | string;
  answer: string | null;
}

// ─── GET: Xem kết quả bài thi ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');
    const email = searchParams.get('email');
    const subjectCode = searchParams.get('subject_code');
    const includeAnswers = searchParams.get('include_answers') === 'true';
    const examType = searchParams.get('exam_type');
    const blockCode = searchParams.get('block_code');

    if (!auth.privileged && !resultId && !email) {
      return NextResponse.json(
        { success: false, error: 'Cần result_id hoặc email để tra cứu' },
        { status: 400 },
      );
    }

    if (email) {
      const denied = rejectIfEmailNotSelf(auth.sessionEmail, auth.privileged, email);
      if (denied) return denied;
    }
    if (resultId) {
      const denied = await rejectIfChuyenSauResultNotOwned(
        auth.sessionEmail,
        auth.privileged,
        resultId,
      );
      if (denied) return denied;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (resultId) {
      conditions.push(`r.id = $${values.length + 1}`);
      values.push(resultId);
    }
    if (email) {
      conditions.push(`r.email = $${values.length + 1}`);
      values.push(email);
    }
    if (subjectCode) {
      conditions.push(`mh.ma_mon = $${values.length + 1}`);
      values.push(subjectCode);
    }
    if (examType) {
      conditions.push(`mh.loai_ky_thi = $${values.length + 1}`);
      values.push(examType);
    }
    if (blockCode) {
      conditions.push(`mh.ma_khoi = $${values.length + 1}`);
      values.push(blockCode);
    }
    // Chỉ lấy những bài đã thi
    conditions.push(`r.trang_thai IN ('da_nop', 'dang_thi')`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         r.id                   AS result_id,
         r.user_id,
         r.firebase_uid,
         r.email,
         r.ho_ten               AS full_name,
         r.ma_de                AS set_code,
         r.so_diem              AS score,
         r.tong_cau             AS total_questions,
         r.so_cau_dung          AS correct_count,
         r.trang_thai           AS status,
         r.thoi_gian_bat_dau    AS started_at,
         r.thoi_gian_nop        AS submitted_at,
         r.tao_luc              AS created_at,
         mh.ma_mon              AS subject_code,
         mh.ten_mon             AS subject_name,
         mh.ma_khoi             AS block_code,
         mh.loai_ky_thi         AS exam_type,
         bd.diem_dat            AS passing_score,
         bd.tong_diem           AS max_score
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN chuyen_sau_bode bd ON bd.ma_de = r.ma_de
       ${where}
       ORDER BY r.thoi_gian_nop DESC NULLS LAST`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    // Kèm chi tiết từng câu nếu yêu cầu
    if (includeAnswers && resultId) {
      const answers = await pool.query(
        `SELECT
           btc.id,
           btc.id_cau             AS question_id,
           cq.noi_dung_cau_hoi    AS question_text,
           cq.loai_cau_hoi        AS question_type,
           CASE
             WHEN cq.lua_chon_a IS NOT NULL OR cq.lua_chon_b IS NOT NULL
              OR cq.lua_chon_c IS NOT NULL OR cq.lua_chon_d IS NOT NULL
             THEN jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
             ELSE NULL
           END                    AS options,
           cq.dap_an_dung         AS correct_answer,
           cq.giai_thich          AS explanation,
           btc.dap_an_nguoi_dung  AS user_answer,
           btc.la_dung            AS is_correct,
           btc.diem_dat_duoc      AS points_earned,
           cq.diem                AS points_total
         FROM chuyen_sau_baithi_cauhoi btc
         JOIN chuyen_sau_cauhoi cq ON cq.id = btc.id_cau
         WHERE btc.id_ket_qua = $1
         ORDER BY btc.id ASC`,
        [resultId]
      );
      return NextResponse.json({
        success: true,
        data: result.rows[0],
        answers: answers.rows,
        count: answers.rows.length,
      });
    }

    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

// ─── POST: Nộp bài ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    // Chấp nhận assignment_id là alias của result_id (chuyen_sau_results.id)
    const result_id = body.result_id || body.assignment_id;
    const teacher_code = body.teacher_code;

    if (!result_id) {
      return NextResponse.json(
        { success: false, error: 'Cần result_id hoặc assignment_id' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Tìm result record — xác nhận tồn tại và lấy bộ đề
    const resultRow = await client.query(
      `SELECT r.id, r.id_de_thi, r.id_mon, r.nam_dk, r.thang_dk, r.id_su_kien,
              COALESCE(r.id_de_thi, ct_sub.id_de) AS resolved_set_id
       FROM chuyen_sau_results r
       LEFT JOIN LATERAL (
         SELECT ct.id_de FROM chuyen_sau_chonde_thang ct
         WHERE ct.id_mon = r.id_mon
           AND ct.nam   = COALESCE(r.nam_dk,   EXTRACT(YEAR  FROM NOW())::int)
           AND ct.thang = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int)
         LIMIT 1
       ) ct_sub ON (r.id_de_thi IS NULL)
       WHERE r.id = $1
       LIMIT 1`,
      [result_id]
    );

    if (resultRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy kết quả đăng ký.' },
        { status: 404 }
      );
    }

    const resultRecord = resultRow.rows[0];
    const resolvedSetId = resultRecord.resolved_set_id;

    if (!resolvedSetId) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Chưa có bộ đề nào được phân công.' },
        { status: 400 }
      );
    }

    // Kiểm tra cửa sổ thi hợp lệ: chỉ cho phép bắt đầu khi event_schedules.bat_dau_luc <= NOW() <= ket_thuc_luc
    const eventWindow = await client.query(
      `SELECT es.bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS bat_dau_luc,
              es.ket_thuc_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS ket_thuc_luc
       FROM event_schedules es
       JOIN chuyen_sau_monhoc mh ON mh.id = $3
       WHERE es.loai_su_kien = 'exam'
         AND (
           ($4::uuid IS NOT NULL AND es.id = $4::uuid)
           OR (
             $4::uuid IS NULL
             AND es.chuyen_nganh = mh.ma_mon
             AND EXTRACT(YEAR  FROM es.bat_dau_luc) = COALESCE($1, EXTRACT(YEAR  FROM NOW()))
             AND EXTRACT(MONTH FROM es.bat_dau_luc) = COALESCE($2, EXTRACT(MONTH FROM NOW()))
           )
         )
       ORDER BY ($4::uuid IS NOT NULL AND es.id = $4::uuid) DESC, es.bat_dau_luc DESC
       LIMIT 1`,
      [resultRecord.nam_dk, resultRecord.thang_dk, resultRecord.id_mon, resultRecord.id_su_kien || null]
    );

    if (eventWindow.rows.length > 0) {
      const { bat_dau_luc, ket_thuc_luc } = eventWindow.rows[0];
      const now = new Date();
      if (bat_dau_luc && now < new Date(bat_dau_luc)) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Bài thi chưa đến thời gian mở. Vui lòng chờ đến giờ admin đã đặt.' },
          { status: 403 }
        );
      }
      if (ket_thuc_luc && now > new Date(ket_thuc_luc)) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Cửa sổ thi đã đóng.' },
          { status: 403 }
        );
      }
    }

    // Tạo hoặc lấy lại bản ghi bài nộp trong chuyen_sau_bainop
    const existingBainop = await client.query(
      `SELECT id, bat_dau_luc FROM chuyen_sau_bainop WHERE id_ket_qua = $1 AND trang_thai_nop = 'dang_nop' LIMIT 1`,
      [result_id]
    );

    let bainopId: number;
    let bainopStartedAt: Date;
    if (existingBainop.rows.length > 0) {
      bainopId = existingBainop.rows[0].id;
      bainopStartedAt = existingBainop.rows[0].bat_dau_luc || new Date();
    } else {
      const newBainop = await client.query(
        `INSERT INTO chuyen_sau_bainop (id_ket_qua, id_de_thi, trang_thai_nop, bat_dau_luc, teacher_code, tao_luc)
         VALUES ($1, $2, 'dang_nop', NOW(), $3, NOW())
         RETURNING id, bat_dau_luc`,
        [result_id, resolvedSetId, teacher_code || null]
      );
      bainopId = newBainop.rows[0].id;
      bainopStartedAt = newBainop.rows[0].bat_dau_luc || new Date();
    }

    // Fill thoi_gian_kiem_tra + id_su_kien vào chuyen_sau_results khi bắt đầu thi
    // Tìm event_schedule khớp: loai_su_kien='exam', chuyen_nganh=ma_mon, cùng tháng/năm
    const eventLookup = await client.query(
      `SELECT es.id::text AS event_id
       FROM event_schedules es
       JOIN chuyen_sau_monhoc mh ON mh.id = $3
       WHERE es.loai_su_kien = 'exam'
         AND es.chuyen_nganh = mh.ma_mon
         AND EXTRACT(YEAR  FROM es.bat_dau_luc) = COALESCE($1, EXTRACT(YEAR  FROM NOW()))
         AND EXTRACT(MONTH FROM es.bat_dau_luc) = COALESCE($2, EXTRACT(MONTH FROM NOW()))
       ORDER BY es.bat_dau_luc DESC
       LIMIT 1`,
      [resultRecord.nam_dk, resultRecord.thang_dk, resultRecord.id_mon]
    );

    const eventId = eventLookup.rows[0]?.event_id || null;

    await client.query(
      `UPDATE chuyen_sau_results SET
         thoi_gian_kiem_tra = TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY'),
         id_su_kien         = COALESCE(id_su_kien, $1::uuid)
       WHERE id = $2`,
      [eventId, result_id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Bắt đầu bài thi thành công',
      data: {
        bainop_id: bainopId,
        result_id: Number(result_id),
        event_id: eventId,
        started_at: new Date().toISOString(), // Always use server's current time so timer counts from NOW
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting exam:', error);
    return NextResponse.json({ success: false, error: 'Failed to start exam' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Nộp bài + chấm điểm ────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    // Chấp nhận assignment_id là alias của result_id
    const result_id = body.result_id || body.assignment_id;
    const { answers = [], teacher_code } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'Cần result_id hoặc assignment_id' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Tìm result kèm bộ đề
    const resultRow = await client.query(
      `SELECT r.id, r.id_de_thi, r.id_mon,
              COALESCE(r.id_de_thi, ct_sub.id_de) AS resolved_set_id
       FROM chuyen_sau_results r
       LEFT JOIN LATERAL (
         SELECT ct.id_de FROM chuyen_sau_chonde_thang ct
         WHERE ct.id_mon = r.id_mon
           AND ct.nam   = COALESCE(r.nam_dk,   EXTRACT(YEAR  FROM NOW())::int)
           AND ct.thang = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int)
         LIMIT 1
       ) ct_sub ON (r.id_de_thi IS NULL)
       WHERE r.id = $1
       LIMIT 1`,
      [result_id]
    );

    if (resultRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Không tìm thấy kết quả đăng ký.' }, { status: 404 });
    }

    const resultRecord = resultRow.rows[0];
    const resolvedSetId = resultRecord.resolved_set_id;

    if (!resolvedSetId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Chưa có bộ đề nào được phân công.' }, { status: 400 });
    }

    // Lấy câu hỏi từ bộ đề
    const questionsResult = await client.query(
      `SELECT cq.id, cq.dap_an_dung, cq.loai_cau_hoi, cq.diem
       FROM chuyen_sau_bode bd
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_de = bd.id
       JOIN chuyen_sau_cauhoi cq      ON cq.id = bc.id_cau
       WHERE bd.id = $1`,
      [resolvedSetId]
    );

    const questionMap = new Map(questionsResult.rows.map((q) => [String(q.id), q]));

    // Tính điểm
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    const totalQuestions = questionsResult.rows.length;

    // Cộng điểm tối đa theo bộ đề
    for (const q of questionsResult.rows) {
      totalPoints += Number(q.diem || 1);
    }

    const submittedAnswers: Array<{ question_id: number | string; answer_text?: string; answer?: string }> =
      Array.isArray(answers) ? answers : [];

    const processedAnswers: Array<{
      id_bai_nop: number;
      id_cau: number;
      dap_an_chon: string | null;
      dung: boolean;
      diem_dat_duoc: number;
    }> = [];

    // Lấy / tạo bainop
    const bainopRow = await client.query(
      `SELECT id FROM chuyen_sau_bainop WHERE id_ket_qua = $1 ORDER BY tao_luc DESC LIMIT 1`,
      [result_id]
    );
    let bainopId: number;
    if (bainopRow.rows.length > 0) {
      bainopId = bainopRow.rows[0].id;
    } else {
      const newBainop = await client.query(
        `INSERT INTO chuyen_sau_bainop (id_ket_qua, id_de_thi, trang_thai_nop, bat_dau_luc, teacher_code, tao_luc)
         VALUES ($1, $2, 'dang_nop', NOW(), $3, NOW()) RETURNING id`,
        [result_id, resolvedSetId, teacher_code || null]
      );
      bainopId = newBainop.rows[0].id;
    }

    for (const ans of submittedAnswers) {
      const q = questionMap.get(String(ans.question_id));
      if (!q) continue;

      const userAnswer = (ans.answer_text ?? ans.answer ?? null);
      const points = Number(q.diem || 1);

      let isCorrect = false;
      if (q.loai_cau_hoi !== 'tu_luan' && userAnswer !== null && q.dap_an_dung) {
        isCorrect = String(userAnswer).trim().toUpperCase() === q.dap_an_dung.trim().toUpperCase();
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += points;
      }

      processedAnswers.push({
        id_bai_nop: bainopId,
        id_cau: Number(ans.question_id),
        dap_an_chon: userAnswer ? String(userAnswer) : null,
        dung: isCorrect,
        diem_dat_duoc: isCorrect ? points : 0,
      });
    }

    // Điểm thô & quy đổi thang 10
    const rawScore = earnedPoints;
    const score10 = totalPoints > 0
      ? Number(((earnedPoints / totalPoints) * 10).toFixed(2))
      : 0;
    const percentage = totalPoints > 0
      ? Number(((earnedPoints / totalPoints) * 100).toFixed(1))
      : 0;

    // Xóa câu trả lời cũ của bainop này rồi insert lại (idempotent)
    await client.query('DELETE FROM chuyen_sau_bainop_traloi WHERE id_bai_nop = $1', [bainopId]);

    if (processedAnswers.length > 0) {
      const insertQ = `
        INSERT INTO chuyen_sau_bainop_traloi (id_bai_nop, id_cau, dap_an_chon, dung, diem_dat_duoc, tao_luc)
        VALUES ${processedAnswers.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, NOW())`).join(', ')}
      `;
      const insertVals = processedAnswers.flatMap((a) => [
        a.id_bai_nop, a.id_cau, a.dap_an_chon, a.dung, a.diem_dat_duoc,
      ]);
      await client.query(insertQ, insertVals);
    }

    // Cập nhật chuyen_sau_bainop
    await client.query(
      `UPDATE chuyen_sau_bainop SET
         trang_thai_nop       = 'da_nop',
         nop_luc              = NOW(),
         diem_tho             = $1,
         diem_tho_toi_da      = $2,
         phan_tram            = $3,
         diem_chuan_hoa       = $4,
         raw_score            = $1,
         percentage           = $3,
         submitted_at         = NOW()
       WHERE id = $5`,
      [rawScore, totalPoints, percentage, score10, bainopId]
    );

    // Cập nhật chuyen_sau_results với điểm và trạng thái hoàn thành
    await client.query(
      `UPDATE chuyen_sau_results SET
         diem         = $1,
         cau_dung     = $2,
         xu_ly_diem   = 'đã hoàn thành'
       WHERE id = $3`,
      [score10, correctCount, result_id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Nộp bài thành công',
      data: {
        bainop_id: bainopId,
        result_id: Number(result_id),
        calculated_score: score10,
        raw_score: rawScore,
        percentage,
        total_questions: totalQuestions,
        correct_count: correctCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting exam:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit exam' }, { status: 500 });
  } finally {
    client.release();
  }
}
