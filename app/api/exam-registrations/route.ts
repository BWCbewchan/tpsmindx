/**
 * exam-registrations/route.ts
 *
 * Flow mới: Registration = tạo record trong chuyen_sau_results
 *   - Không còn bảng chuyen_sau_dangky / chuyen_sau_phancong
 *   - GET  → xem lịch thi / results của user
 *   - POST → đăng ký = INSERT chuyen_sau_results (trang_thai = 'da_dang_ky')
 *   - PUT  → cập nhật trạng thái result (hủy, bắt đầu, v.v.)
 *   - DELETE → hủy đăng ký (xóa result nếu chưa thi)
 */

import pool from '@/lib/db';
import { eventScheduleTsInstantExpr } from '@/lib/event-schedule-time';
import { insertExamRegistration } from '@/lib/exam-registration-insert';
import { NextRequest, NextResponse } from 'next/server';

/** Một số bản triển khai cũ chưa có cột `updated_at` — cache theo process, không cần migration */
let cachedChuyenSauResultsHasUpdatedAt: boolean | null = null;

async function chuyenSauResultsHasUpdatedAtColumn(): Promise<boolean> {
  if (cachedChuyenSauResultsHasUpdatedAt !== null) {
    return cachedChuyenSauResultsHasUpdatedAt;
  }
  try {
    const res = await pool.query<{ ok: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_catalog = current_database()
          AND table_schema = ANY (current_schemas(true))
          AND table_name = 'chuyen_sau_results'
          AND column_name = 'updated_at'
      ) AS ok
    `);
    cachedChuyenSauResultsHasUpdatedAt = Boolean(res.rows[0]?.ok);
  } catch {
    cachedChuyenSauResultsHasUpdatedAt = false;
  }
  return cachedChuyenSauResultsHasUpdatedAt;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code') || searchParams.get('ma_giao_vien');
    const email = searchParams.get('email') || searchParams.get('dia_chi_email');
    const subjectCode = searchParams.get('subject_code') || searchParams.get('ma_mon');
    const blockCode = searchParams.get('block_code') || searchParams.get('ma_khoi');
    const scheduleId = searchParams.get('schedule_id') || searchParams.get('id_su_kien');
    const resultId = searchParams.get('result_id');
    const thangDk = searchParams.get('thang_dk');
    const namDk = searchParams.get('nam_dk');
    /** YYYY-MM — lọc theo tháng/năm đăng ký (thang_dk / nam_dk) */
    const monthYm = searchParams.get('month');
    /** Một hoặc nhiều giá trị: lặp `subject_q` hoặc chuỗi phân tách bởi dấu phẩy — OR với nhau */
    const parseMultiQ = (key: string): string[] => {
      const raw = searchParams.getAll(key).flatMap((s) => s.split(','));
      const out: string[] = [];
      const seen = new Set<string>();
      for (const r of raw) {
        const t = r.trim();
        if (!t) continue;
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
      return out;
    };
    const subjectQs = parseMultiQ('subject_q');
    const blockQs = parseMultiQ('block_q');
    const xuLyFilter = searchParams.get('xu_ly_diem')?.trim();
    const registrationType = searchParams.get('registration_type')?.trim();
    const hasScore = searchParams.get('has_score')?.trim();
    /** Chỉ đếm + thời điểm thay đổi gần nhất — dùng poll nhẹ từ admin */
    const syncCheck = searchParams.get('sync_check') === '1';

    /** Phân trang (tùy chọn): chỉ áp dụng khi có `limit` — không gửi `limit` thì trả toàn bộ (tương thích user / xuất CSV). */
    const limitRaw = searchParams.get('limit');
    const pageRaw = searchParams.get('page');
    const offsetRaw = searchParams.get('offset');
    let paginateLimit: number | null = null;
    let paginateOffset = 0;
    if (limitRaw != null && limitRaw !== '') {
      const l = parseInt(limitRaw, 10);
      if (Number.isFinite(l) && l > 0) {
        paginateLimit = Math.min(l, 500);
        if (offsetRaw != null && offsetRaw !== '') {
          const o = parseInt(offsetRaw, 10);
          if (Number.isFinite(o) && o >= 0) paginateOffset = o;
        } else {
          const pg = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
          paginateOffset = (pg - 1) * paginateLimit;
        }
      }
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (resultId) {
      conditions.push(`r.id = $${values.length + 1}`);
      values.push(resultId);
    }
    if (scheduleId) {
      conditions.push(`r.id_su_kien = $${values.length + 1}`);
      values.push(scheduleId);
    }
    if (teacherCode) {
      /** Tìm gần đúng (chuỗi con) — khớp UX ô «Mã GV» trên admin */
      conditions.push(
        `POSITION(LOWER($${values.length + 1}) IN LOWER(COALESCE(r.ma_giao_vien, ''))) > 0`,
      );
      values.push(teacherCode.trim());
    }
    if (email) {
      conditions.push(`LOWER(TRIM(COALESCE(r.dia_chi_email, ''))) = LOWER(TRIM($${values.length + 1}))`);
      values.push(email);
    }
    if (subjectQs.length > 0) {
      const parts: string[] = [];
      for (const sq of subjectQs) {
        const i = values.length + 1;
        values.push(sq);
        parts.push(
          `(POSITION(LOWER($${i}) IN LOWER(COALESCE(mh.ma_mon, ''))) > 0 OR POSITION(LOWER($${i}) IN LOWER(COALESCE(mh.ten_mon, ''))) > 0)`,
        );
      }
      conditions.push(`(${parts.join(' OR ')})`);
    } else if (subjectCode) {
      conditions.push(`mh.ma_mon = $${values.length + 1}`);
      values.push(subjectCode);
    }
    if (blockQs.length > 0) {
      const parts: string[] = [];
      for (const bq of blockQs) {
        const i = values.length + 1;
        values.push(bq);
        parts.push(
          `(POSITION(LOWER($${i}) IN LOWER(COALESCE(r.khoi_giang_day, ''))) > 0 OR POSITION(LOWER($${i}) IN LOWER(COALESCE(mh.ma_khoi, ''))) > 0)`,
        );
      }
      conditions.push(`(${parts.join(' OR ')})`);
    } else if (blockCode) {
      conditions.push(`mh.ma_khoi = $${values.length + 1}`);
      values.push(blockCode);
    }

    let monthFromParam = false;
    if (monthYm && /^\d{4}-\d{2}$/.test(monthYm)) {
      const [yStr, mStr] = monthYm.split('-');
      const yi = parseInt(yStr, 10);
      const mi = parseInt(mStr, 10);
      if (Number.isFinite(yi) && mi >= 1 && mi <= 12) {
        conditions.push(`r.nam_dk = $${values.length + 1}`);
        values.push(yi);
        conditions.push(`r.thang_dk = $${values.length + 1}`);
        values.push(mi);
        monthFromParam = true;
      }
    }
    if (!monthFromParam && thangDk) {
      conditions.push(`r.thang_dk = $${values.length + 1}`);
      values.push(thangDk);
    }
    if (!monthFromParam && namDk) {
      conditions.push(`r.nam_dk = $${values.length + 1}`);
      values.push(namDk);
    }

    if (xuLyFilter && xuLyFilter !== 'all') {
      conditions.push(`LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) = LOWER(TRIM($${values.length + 1}))`);
      values.push(xuLyFilter);
    }

    if (registrationType === 'official') {
      conditions.push(`NOT (
        LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%b%sung%'
        OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bo%'
        OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) = 'additional'
      )`);
    } else if (registrationType === 'additional') {
      conditions.push(`(
        LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%b%sung%'
        OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bo%'
        OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) = 'additional'
      )`);
    }

    if (hasScore === '1') {
      conditions.push(`r.diem IS NOT NULL`);
    } else if (hasScore === '0') {
      conditions.push(`r.diem IS NULL`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const fromJoins = `
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN event_schedules es ON es.id::text = r.id_su_kien::text
       LEFT JOIN chuyen_sau_bode bode ON bode.id = r.id_de_thi
    `;

    if (syncCheck) {
      const hasUpdatedAt = await chuyenSauResultsHasUpdatedAtColumn();
      const maxChangedSql = hasUpdatedAt
        ? 'MAX(COALESCE(r.updated_at, r.tao_luc)) AS max_changed'
        : 'MAX(COALESCE(r.dang_ky_luc, r.tao_luc)) AS max_changed';
      const syncRes = await pool.query(
        `SELECT COUNT(*)::int AS c,
                ${maxChangedSql}
         ${fromJoins}
         ${where}`,
        values,
      );
      const sr = syncRes.rows[0] as { c?: number; max_changed?: Date | string | null };
      const raw = sr?.max_changed;
      let maxChangedAt: string | null = null;
      if (raw != null && raw !== '') {
        maxChangedAt = raw instanceof Date ? raw.toISOString() : String(raw);
      }
      return NextResponse.json({
        success: true,
        sync: {
          total: sr?.c ?? 0,
          maxChangedAt,
        },
      });
    }

    let totalCount: number | undefined;
    if (paginateLimit != null) {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS c ${fromJoins} ${where}`,
        values
      );
      totalCount = countRes.rows[0]?.c ?? 0;
    }

    const limitClause =
      paginateLimit != null
        ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}`
        : '';
    const dataValues =
      paginateLimit != null ? [...values, paginateLimit, paginateOffset] : values;

    const result = await pool.query(
      `SELECT
         r.id                                                          AS id,
         r.id                                                          AS result_id,
         r.id_su_kien                                                  AS schedule_id,
         r.id_mon                                                      AS subject_id,
         r.ma_giao_vien                                                AS teacher_code,
         r.ho_ten,
         r.dia_chi_email                                               AS email,
         r.co_so_lam_viec                                              AS center_code,
         r.khu_vuc,
         r.hinh_thuc,
         r.khoi_giang_day                                              AS block_code,
         r.thang_dk,
         r.nam_dk,
         r.dot,
         r.thoi_gian_kiem_tra,
         r.diem                                                        AS score,
         r.cau_dung                                                    AS correct_answers,
         r.xu_ly_diem,
         r.tong_diem_bi_tru,
         r.email_giai_trinh,
         r.da_giai_thich,
         r.so_lan_giai_thich,
         r.id_de_thi                                                   AS set_id,
         r.id_de_thi                                                   AS selected_set_id,
         r.tao_luc                                                     AS created_at,
         r.dang_ky_luc,
         mh.ma_mon                                                     AS subject_code,
         mh.ten_mon                                                    AS subject_name,
         mh.ma_khoi                                                    AS subject_block,
         COALESCE(mh.loai_ky_thi, 'expertise')                        AS exam_type,
         mh.thoi_gian_thi_phut                                         AS duration_minutes,
         es.ten                                                        AS schedule_name,
         COALESCE(${eventScheduleTsInstantExpr('es', 'bat_dau_luc')}, r.lich_thi_dk)                       AS open_at,
         ${eventScheduleTsInstantExpr('es', 'ket_thuc_luc')}                                               AS close_at,
         COALESCE(${eventScheduleTsInstantExpr('es', 'bat_dau_luc')}, r.lich_thi_dk, r.tao_luc)             AS scheduled_at,
         es.loai_su_kien,
         -- registration_type: map hinh_thuc → official/additional
         CASE
           WHEN LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%b%sung%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bo%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) = 'additional'
           THEN 'additional'
           ELSE 'official'
         END                                                           AS registration_type,
         -- source_form
         COALESCE(r.hinh_thuc, 'system')                              AS source_form,
         -- assignment_id: non-null if any processing has been done
         CASE WHEN r.xu_ly_diem IS NOT NULL OR r.diem IS NOT NULL OR r.da_giai_thich = TRUE
              THEN r.id ELSE NULL END                                  AS assignment_id,
         -- assignment_status
         CASE
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) IN ('đã hoàn thành', 'da thi', 'đã duyệt', 'từ chối')
             THEN 'graded'
           WHEN r.diem IS NOT NULL AND r.diem > 0
             THEN 'graded'
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) = 'chờ giải trình'
             THEN 'expired'
           WHEN r.id_de_thi IS NOT NULL
             THEN 'assigned'
           ELSE 'assigned'
         END                                                           AS assignment_status,
         -- score_status
         CASE
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) IN ('đã hoàn thành', 'đã duyệt', 'từ chối')
             THEN 'graded'
           WHEN r.diem IS NULL
             THEN 'null'
           ELSE 'graded'
         END                                                           AS score_status,
         -- random_assigned_at
         NULL::timestamp                                               AS random_assigned_at,
         bode.ma_de                                                    AS set_code,
         bode.ten_de                                                   AS set_name,
         bode.tong_diem                                                AS total_points,
         bode.diem_dat                                                 AS passing_score
       ${fromJoins}
       ${where}
       ORDER BY r.tao_luc DESC
       ${limitClause}`,
      dataValues
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      ...(paginateLimit != null && totalCount !== undefined
        ? {
            total: totalCount,
            page: Math.floor(paginateOffset / paginateLimit) + 1,
            pageSize: paginateLimit,
          }
        : {}),
    });
  } catch (error: unknown) {
    const pgErr = error as { code?: string; message?: string };
    if (pgErr?.code === '53300') {
      return NextResponse.json(
        {
          success: false,
          error: 'Hệ thống đang bận (quá nhiều kết nối DB). Vui lòng thử lại sau vài giây.',
          code: 'DB_CONNECTION_LIMIT',
        },
        { status: 503 },
      );
    }
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

// ─── POST: Đăng ký thi → tạo results record ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await insertExamRegistration(pool, body as Record<string, unknown>);
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...(result.result_id != null ? { result_id: result.result_id } : {}),
        },
        { status: result.httpStatus }
      );
    }
    return NextResponse.json(
      { success: true, data: result.data, message: 'Đăng ký thi thành công' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating registration:', error);
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

// ─── PUT: Cập nhật trạng thái result ─────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { result_id, status, set_code, notes } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }

    const clauses: string[] = [];
    const values: unknown[] = [];

    const { id_de_thi, xu_ly_diem, diem, cau_dung, email_giai_trinh, da_giai_thich } = body;

    if (id_de_thi !== undefined) {
      clauses.push(`id_de_thi = $${values.length + 1}`);
      values.push(id_de_thi);
    }
    if (xu_ly_diem !== undefined) {
      clauses.push(`xu_ly_diem = $${values.length + 1}`);
      values.push(xu_ly_diem);
    }
    if (diem !== undefined) {
      clauses.push(`diem = $${values.length + 1}`);
      values.push(diem);
    }
    if (cau_dung !== undefined) {
      clauses.push(`cau_dung = $${values.length + 1}`);
      values.push(cau_dung);
    }
    if (email_giai_trinh !== undefined) {
      clauses.push(`email_giai_trinh = $${values.length + 1}`);
      values.push(email_giai_trinh);
    }
    if (da_giai_thich !== undefined) {
      clauses.push(`da_giai_thich = $${values.length + 1}`);
      values.push(da_giai_thich);
    }

    if (clauses.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có trường nào để cập nhật' }, { status: 400 });
    }

    values.push(result_id);
    const result = await pool.query(
      `UPDATE chuyen_sau_results SET ${clauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy result' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json({ success: false, error: 'Failed to update registration' }, { status: 500 });
  }
}

// ─── DELETE: Hủy đăng ký (chỉ được khi chưa thi) ────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');

    if (!resultId) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }

    // Chỉ cho xóa nếu chưa thi (xu_ly_diem = 'chờ giải trình' = chưa nộp bài)
    const result = await pool.query(
      `DELETE FROM chuyen_sau_results
       WHERE id = $1 AND xu_ly_diem = 'chờ giải trình'
       RETURNING id, dia_chi_email, ma_giao_vien`,
      [resultId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không thể hủy - result không tồn tại hoặc đã thi rồi.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Đã hủy đăng ký thành công' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete registration' }, { status: 500 });
  }
}
