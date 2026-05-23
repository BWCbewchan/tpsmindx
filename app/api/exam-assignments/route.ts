import { rejectIfAnyTeacherCodeForbidden, requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const teacherCodesRaw = searchParams.get('teacher_codes');
    const month = searchParams.get('month');
    const since = searchParams.get('since');
    const before = searchParams.get('before');

    if (!teacherCode && !teacherCodesRaw) {
      return NextResponse.json(
        { success: false, error: 'teacher_code or teacher_codes is required' },
        { status: 400 }
      );
    }

    // Guard: kiểm tra bảng chuyen_sau_results có tồn tại không
    const tableCheck = await pool.query(`
      SELECT
        to_regclass('public.chuyen_sau_results') IS NOT NULL AS has_results,
        to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL AS has_giaitrinh
    `);
    const hasResults = Boolean(tableCheck.rows[0]?.has_results);
    const hasGiaitrinh = Boolean(tableCheck.rows[0]?.has_giaitrinh);

    if (!hasResults) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    const teacherCodes = (teacherCodesRaw || '')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const normalizedPrimary = (teacherCode || '').trim().toLowerCase();

    const allCodes = [...new Set([normalizedPrimary, ...teacherCodes].filter(Boolean))];
    const denied = await rejectIfAnyTeacherCodeForbidden(
      auth.sessionEmail,
      auth.privileged,
      allCodes,
    );
    if (denied) return denied;

    // JOIN với chuyen_sau_giaitrinh nếu tồn tại
    const giaitrinh_join = hasGiaitrinh
      ? `
      LEFT JOIN LATERAL (
        SELECT csg.id, csg.tru_diem, csg.xu_ly_giai_trinh
        FROM chuyen_sau_giaitrinh csg
        WHERE csg.id_ket_qua = csr.id
        ORDER BY csg.tao_luc DESC
        LIMIT 1
      ) csg ON TRUE
      `
      : '';

    const giaitrinh_select = hasGiaitrinh
      ? `COALESCE(csg.tru_diem, 0)::numeric AS penalty_deduction,`
      : `0::numeric AS penalty_deduction,`;

    const giaitrinh_explanation_status = hasGiaitrinh
      ? `CASE COALESCE(csg.xu_ly_giai_trinh, '')
          WHEN 'đã duyệt'       THEN 'accepted'
          WHEN 'từ chối'         THEN 'rejected'
          WHEN 'chờ giải trình' THEN 'pending'
          ELSE NULL
        END::text AS explanation_status,`
      : `NULL::text AS explanation_status,`;

    const giaitrinh_explanation_id = hasGiaitrinh
      ? `csg.id::int AS explanation_id,`
      : `NULL::int AS explanation_id,`;

    let query = `
      SELECT
        csr.id                                                    AS result_id,
        csr.id                                                    AS id,
        LOWER(TRIM(COALESCE(csr.ma_giao_vien, '')))              AS teacher_code,
        csr.ho_ten,
        csr.dia_chi_email,
        csr.co_so_lam_viec,
        csr.khu_vuc,
        CASE
          WHEN LOWER(TRIM(COALESCE(csr.hinh_thuc, ''))) LIKE '%b%sung%'
            OR LOWER(TRIM(COALESCE(csr.hinh_thuc, ''))) LIKE '%bo%'
            OR LOWER(TRIM(COALESCE(csr.hinh_thuc, ''))) = 'additional'
          THEN 'additional'
          ELSE 'official'
        END                                                     AS registration_type,
        csr.khoi_giang_day                                       AS block_code,
        csm.ma_mon                                               AS subject_code,
        csm.ten_mon                                              AS subject_name,
        csm.ma_khoi                                              AS subject_block,
        -- Thời gian làm bài thực tế: đọc từ event_schedules (ket_thuc - bat_dau), fallback từ cột môn học
        COALESCE(ev_dur.duration_min, csm.thoi_gian_thi_phut, 90)::int AS duration_minutes,
        csr.id_mon,
        COALESCE(csr.id_de_thi, fallback_chonde.id_de)          AS selected_set_id,
        csr.id_su_kien::text                                     AS event_schedule_id,
        csr.thang_dk,
        csr.nam_dk,
        csr.dot,
        -- Thời điểm thi (open_at): ưu tiên event_schedules.bat_dau_luc (admin đặt), fallback logic cũ
        COALESCE(
          ev_dur.event_open_at,
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ELSE NULL
          END,
          CASE WHEN csr.nam_dk IS NOT NULL AND csr.thang_dk IS NOT NULL
               THEN make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0)
               ELSE NULL END,
          csr.dang_ky_luc
        ) AS open_at,
        COALESCE(
          ev_dur.event_close_at,
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
                    + make_interval(mins => COALESCE(ev_dur.duration_min, csm.thoi_gian_thi_phut, 90))
            ELSE NULL
          END,
          CASE WHEN csr.nam_dk IS NOT NULL AND csr.thang_dk IS NOT NULL
               THEN make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0) + INTERVAL '1 month'
               ELSE NULL END,
          csr.dang_ky_luc + make_interval(mins => COALESCE(ev_dur.duration_min, csm.thoi_gian_thi_phut, 90))
        ) AS close_at,
        -- Trạng thái bài thi
        CASE
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) = 'đã hoàn thành' THEN 'graded'
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) = 'da thi'         THEN 'graded'
          WHEN COALESCE(csr.diem, 0) > 0                                     THEN 'graded'
          ELSE 'assigned'
        END AS assignment_status,
        csr.diem::numeric                                        AS score,
        -- Có điểm trong DB → luôn coi là đã có điểm (kể cả chờ giải trình điểm); tránh score_status='null' khiến UI user tính TB = 0
        CASE
          WHEN csr.diem IS NOT NULL THEN 'graded'
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) IN ('đã hoàn thành', 'da thi') THEN 'graded'
          ELSE 'null'
        END AS score_status,
        COALESCE(csr.xu_ly_diem, '')::text                       AS score_handling_note,
        COALESCE(csr.cau_dung, 0)::int                           AS correct_answers,
        csr.da_giai_thich,
        csr.so_lan_giai_thich,
        csr.tong_diem_bi_tru,
        ${giaitrinh_select}
        -- Thông tin bộ đề (dùng COALESCE fallback từ chonde_thang nếu id_de_thi chưa set)
        es.ma_de                                                 AS set_code,
        es.ten_de                                                AS set_name,
        es.tong_diem                                             AS total_points,
        es.diem_dat                                              AS passing_score,
        es.trang_thai                                            AS set_status,
        NULL::timestamp                                          AS set_valid_from,
        NULL::timestamp                                          AS set_valid_to,
        COALESCE((
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi bq
          WHERE bq.id_de = COALESCE(csr.id_de_thi, fallback_chonde.id_de)
        ), 0) AS total_questions,
        EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi bq
          WHERE bq.id_de = COALESCE(csr.id_de_thi, fallback_chonde.id_de)
        ) AS has_questions,
        -- Explanation status from chuyen_sau_giaitrinh.xu_ly_diem
        ${giaitrinh_explanation_status}
        ${giaitrinh_explanation_id}
        NULL::text AS admin_note,
        csr.tao_luc  AS created_at,
        csr.tao_luc  AS updated_at
      FROM chuyen_sau_results csr
      LEFT JOIN chuyen_sau_monhoc csm ON csm.id = csr.id_mon
      -- Fallback bộ đề từ chonde_thang khi id_de_thi chưa được set
      LEFT JOIN LATERAL (
        SELECT ct.id_de
        FROM chuyen_sau_chonde_thang ct
        WHERE ct.id_mon = csr.id_mon
          AND ct.nam = COALESCE(csr.nam_dk, EXTRACT(YEAR FROM NOW())::int)
          AND ct.thang = COALESCE(csr.thang_dk, EXTRACT(MONTH FROM NOW())::int)
        LIMIT 1
      ) fallback_chonde ON (csr.id_de_thi IS NULL)
      LEFT JOIN chuyen_sau_bode   es  ON es.id = COALESCE(csr.id_de_thi, fallback_chonde.id_de)
      -- Lấy thời gian làm bài từ event_schedules: ưu tiên id_su_kien, fallback tìm theo tháng/năm/môn
      LEFT JOIN LATERAL (
        SELECT
          (EXTRACT(EPOCH FROM (ket_thuc_luc - bat_dau_luc)) / 60)::int AS duration_min,
          bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS event_open_at,
          ket_thuc_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS event_close_at
        FROM event_schedules
        WHERE loai_su_kien = 'exam'
          AND (
            (csr.id_su_kien IS NOT NULL AND id = csr.id_su_kien)
            OR (
              csr.id_su_kien IS NULL
              AND chuyen_nganh = csm.ma_mon
              AND EXTRACT(YEAR  FROM bat_dau_luc) = COALESCE(csr.nam_dk,  EXTRACT(YEAR  FROM NOW()))
              AND EXTRACT(MONTH FROM bat_dau_luc) = COALESCE(csr.thang_dk, EXTRACT(MONTH FROM NOW()))
            )
          )
        ORDER BY (csr.id_su_kien IS NOT NULL AND id = csr.id_su_kien) DESC, bat_dau_luc DESC
        LIMIT 1
      ) ev_dur ON TRUE
      ${giaitrinh_join}
      WHERE TRUE
    `;

    const values: any[] = [];

    if (teacherCodes.length > 0) {
      values.push(teacherCodes);
      query += `
        AND LOWER(TRIM(COALESCE(csr.ma_giao_vien, ''))) = ANY($${values.length}::text[])
      `;
    } else {
      values.push(normalizedPrimary);
      query += `
        AND LOWER(TRIM(COALESCE(csr.ma_giao_vien, ''))) = $${values.length}
      `;
    }

    if (month) {
      const [monthYear, monthNumber] = month.split('-').map(Number);
      if (Number.isFinite(monthYear) && Number.isFinite(monthNumber)) {
        values.push(monthYear);
        values.push(monthNumber);
        query += `
          AND csr.nam_dk = $${values.length - 1}
          AND csr.thang_dk = $${values.length}
        `;
      }
    }

    if (since) {
      values.push(since);
      query += `
        AND COALESCE(csr.dang_ky_luc::date, make_date(csr.nam_dk, csr.thang_dk, 1)) >= $${values.length}::date
      `;
    }

    if (before) {
      values.push(before);
      query += `
        AND COALESCE(csr.dang_ky_luc::date, make_date(csr.nam_dk, csr.thang_dk, 1)) < $${values.length}::date
      `;
    }

    query += `
      ORDER BY csr.nam_dk DESC, csr.thang_dk DESC, csr.tao_luc DESC
    `;

    const result = await pool.query(query, values);

    const now = new Date();
    const mapped = result.rows.map((row) => {
      const openAt = row.open_at ? new Date(row.open_at) : null;
      const closeAt = row.close_at ? new Date(row.close_at) : null;
      const isOpen = openAt && closeAt ? now >= openAt && now <= closeAt : false;

      const isSetActive = row.set_status === 'hoat_dong' || row.set_status === 'active';
      const selectedSetId = Number(row.selected_set_id || 0);
      const hasSet = Number.isFinite(selectedSetId) && selectedSetId > 0;
      const resultId = Number(row.result_id || 0);
      const hasRuntimeId = Number.isFinite(resultId) && resultId > 0;

      const rawStatus = String(row.assignment_status || '').toLowerCase();
      const handlingNote = String(row.score_handling_note || '').toLowerCase();
      const isDefaultZeroNeedExplanation =
        handlingNote.includes('mac dinh 0') || handlingNote.includes('mặc định 0') ||
        handlingNote.includes('chờ giải trình') || handlingNote.includes('cho giai trinh');
      const isSubmittedOrGraded = rawStatus === 'submitted' || rawStatus === 'graded';
      const isExpiredByTime = closeAt ? now > closeAt : false;

      let effectiveAssignmentStatus = rawStatus || 'assigned';
      let effectiveExplanationStatus = row.explanation_status || null;

      if (isDefaultZeroNeedExplanation && !isSubmittedOrGraded) {
        if (isExpiredByTime) {
          effectiveAssignmentStatus = 'expired';
          if (!effectiveExplanationStatus || effectiveExplanationStatus === 'rejected') {
            effectiveExplanationStatus = 'pending';
          }
        } else {
          effectiveExplanationStatus = null;
          if (!['assigned', 'in_progress'].includes(effectiveAssignmentStatus)) {
            effectiveAssignmentStatus = 'assigned';
          }
        }
      }

      const isAllowedStatus = ['assigned', 'in_progress'].includes(effectiveAssignmentStatus);
      const canTake =
        hasRuntimeId &&
        hasSet &&
        isOpen &&
        isSetActive &&
        row.has_questions === true &&
        isAllowedStatus &&
        effectiveExplanationStatus !== 'accepted';

      return {
        ...row,
        assignment_status: effectiveAssignmentStatus,
        explanation_status: effectiveExplanationStatus,
        id: resultId,
        is_open: isOpen,
        is_set_active_now: isSetActive,
        can_take: canTake,
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped,
      count: mapped.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam assignments' },
      { status: 500 }
    );
  }
}
