import pool from "@/lib/db";
import type { Pool } from "pg";
import { parseNgayDangKyImportFormat } from "./csv-registration-import";

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** ISO / parseable string → Date, hoặc null nếu không hợp lệ */
function parseIsoToDateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Chuẩn hóa xu_ly_diem từ import / POST (khớp GET exam-registrations). */
function normalizeXuLyDiemForImport(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "chờ giải trình";
  const lower = s.toLowerCase();
  if (lower === "đã duyệt" || lower === "da duyet") return "đã duyệt";
  if (lower === "đã hoàn thành" || lower === "da hoan thanh") return "đã hoàn thành";
  if (lower === "da thi") return "da thi";
  if (lower === "từ chối" || lower === "tu choi") return "từ chối";
  if (lower === "chờ giải trình" || lower.includes("chờ giải trình")) return "chờ giải trình";
  if (lower.includes("cho giai trinh")) return "chờ giải trình";
  return s;
}

/** Cột Điểm trống: với đã duyệt / từ chối (miễn) → NULL; còn lại → 0 */
function resolveDiemForImport(raw: unknown, xuLyNormalized: string): number | null {
  const n = num(raw);
  if (n !== undefined) return n;
  const xu = xuLyNormalized.toLowerCase();
  if (xu === "đã duyệt" || xu === "từ chối") return null;
  return 0;
}

export type InsertRegistrationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; httpStatus: number; result_id?: number };

let cachedEventSchedulesHasMetadataColumn: boolean | null = null;

async function eventSchedulesHasMetadataColumn(): Promise<boolean> {
  if (cachedEventSchedulesHasMetadataColumn !== null) {
    return cachedEventSchedulesHasMetadataColumn;
  }

  const columnCheck = await pool.query<{ ok: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'event_schedules'
        AND column_name = 'metadata'
    ) AS ok
  `);

  cachedEventSchedulesHasMetadataColumn = Boolean(columnCheck.rows[0]?.ok);
  return cachedEventSchedulesHasMetadataColumn;
}

/**
 * Tạo một bản ghi đăng ký kiểm tra (INSERT chuyen_sau_results) — dùng chung cho POST /api/exam-registrations và import CSV.
 */
function isSupplementaryRegistrationType(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'additional' || normalized.includes('bổ sung') || normalized.includes('bo sung');
}

export async function insertExamRegistration(
  pool: Pool,
  body: Record<string, unknown>
): Promise<InsertRegistrationResult> {
  const teacherInfo = (body.teacher_info as Record<string, unknown>) || {};
  const ma_giao_vien = body.ma_giao_vien || body.teacher_code;
  const ho_ten = body.ho_ten || body.full_name || teacherInfo.teacher_name || teacherInfo.full_name;
  const dia_chi_email = body.dia_chi_email || body.email || teacherInfo.email;
  const co_so_lam_viec = body.co_so_lam_viec || body.campus || teacherInfo.campus;
  const khu_vuc = body.khu_vuc || body.region || teacherInfo.region;
  const hinh_thuc = body.hinh_thuc || body.registration_type;
  const khoi_giang_day = body.khoi_giang_day || body.block_code;
  const dotResolved = num(body.dot);
  const id_mon = body.id_mon || body.subject_id;
  const ma_mon = body.ma_mon || body.subject_code;
  const id_su_kien = body.id_su_kien || body.schedule_id || body.scheduled_event_id || null;
  const id_de_thi = body.id_de_thi;
  const supplementaryRound = num(body.flow_round) ?? num((body as Record<string, unknown>).flowRound);

  /** Khi không gắn lịch sự kiện (import CSV/Excel): lưu ngày giờ từ cột Lịch thi để GET không rơi về tao_luc (hôm nay). */
  let lich_thi_dk: Date | null = null;
  if (!id_su_kien) {
    lich_thi_dk = parseIsoToDateOrNull(body.scheduled_at) ?? parseIsoToDateOrNull(body.open_at);
  }

  let thang_dk = num(body.thang_dk ?? body.month);
  let nam_dk = num(body.nam_dk ?? body.year);
  if ((!thang_dk || !nam_dk) && (body.open_at || body.scheduled_at)) {
    const refDate = new Date(String(body.open_at || body.scheduled_at));
    if (!Number.isNaN(refDate.getTime())) {
      thang_dk = thang_dk || refDate.getMonth() + 1;
      nam_dk = nam_dk || refDate.getFullYear();
    }
  }

  if (!ma_giao_vien || String(ma_giao_vien).trim() === "") {
    return { ok: false, error: "ma_giao_vien là bắt buộc", httpStatus: 400 };
  }
  if (!id_mon && !ma_mon) {
    return { ok: false, error: "Cần cung cấp id_mon hoặc ma_mon", httpStatus: 400 };
  }

  const xuLyNormalized = normalizeXuLyDiemForImport(body.xu_ly_diem);
  const diemResolved = resolveDiemForImport(body.diem ?? body.score, xuLyNormalized);

  const dangKyRaw = body.dang_ky_luc ?? body.ngay_dang_ky;
  let dangKyResolved: Date | null = null;
  if (dangKyRaw !== undefined && dangKyRaw !== null && String(dangKyRaw).trim() !== "") {
    dangKyResolved = parseNgayDangKyImportFormat(dangKyRaw);
  }

  // Khai báo biến để dùng trong catch block
  let resolvedSubjectId: number | null = null;
  let resolvedSupplementaryRound: number | null | undefined = supplementaryRound;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let resolvedHoTen = ho_ten;
    if (!resolvedHoTen) {
      const teacherRow = await client.query(
        `SELECT full_name FROM teachers WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1`,
        [ma_giao_vien]
      );
      resolvedHoTen = teacherRow.rows[0]?.full_name || ma_giao_vien;
    }

    resolvedSubjectId = id_mon as number | null;
    if (!resolvedSubjectId && ma_mon) {
      const subj = await client.query(
        `SELECT id FROM chuyen_sau_monhoc
         WHERE ma_mon = $1
            OR $1 LIKE (ma_mon || '%')
            OR ma_mon LIKE ($1 || '%')
         ORDER BY
           CASE WHEN ma_mon = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [ma_mon]
      );
      if (subj.rows.length === 0) {
        await client.query("ROLLBACK");
        const raw = String(ma_mon ?? "").trim();
        const hint = raw
          ? `Không tìm thấy môn học tương ứng — mã đã gửi: "${raw}" (cần trùng hoặc khớp chuyen_sau_monhoc.ma_mon).`
          : "Không tìm thấy môn học tương ứng — thiếu hoặc rỗng mã môn.";
        return { ok: false, error: hint, httpStatus: 404 };
      }
      resolvedSubjectId = subj.rows[0].id;
    }

    let resolvedSetId = id_de_thi;
    if (!resolvedSetId && resolvedSubjectId && thang_dk && nam_dk) {
      const activeMonthlySet = await client.query(
        `SELECT id_de FROM chuyen_sau_chonde_thang WHERE id_mon = $1 AND nam = $2 AND thang = $3 LIMIT 1`,
        [resolvedSubjectId, nam_dk, thang_dk]
      );
      if (activeMonthlySet.rows.length > 0) {
        resolvedSetId = activeMonthlySet.rows[0].id_de;
      }
    }

    if (resolvedSetId != null) {
      const bodeOk = await client.query(`SELECT 1 FROM chuyen_sau_bode WHERE id = $1 LIMIT 1`, [resolvedSetId]);
      if (bodeOk.rows.length === 0) {
        resolvedSetId = null;
      }
    }

    const hasEventMetadataColumn = await eventSchedulesHasMetadataColumn();

    resolvedSupplementaryRound = supplementaryRound;
    if (id_su_kien && isSupplementaryRegistrationType(hinh_thuc) && resolvedSupplementaryRound == null && hasEventMetadataColumn) {
      try {
        const metadataRound = await client.query(
          `SELECT COALESCE((metadata->>'flow_round')::int, NULL) AS flow_round
           FROM event_schedules
           WHERE id = $1::uuid
           LIMIT 1`,
          [id_su_kien]
        );
        resolvedSupplementaryRound = num(metadataRound.rows[0]?.flow_round);
        console.log('[insertExamRegistration] Resolved flow_round from event:', resolvedSupplementaryRound);
      } catch (err) {
        console.warn('[insertExamRegistration] Failed to get flow_round from event:', err);
        // Không có flow_round không phải lỗi nghiêm trọng, tiếp tục
      }
    }

    // Nếu vẫn không có flow_round cho đợt bổ sung, sử dụng event_id để phân biệt
    const useEventIdForDuplication = isSupplementaryRegistrationType(hinh_thuc) && 
                                      id_su_kien && 
                                      (resolvedSupplementaryRound == null || resolvedSupplementaryRound === 0);

    if (
      isSupplementaryRegistrationType(hinh_thuc) &&
      hasEventMetadataColumn &&
      resolvedSupplementaryRound != null &&
      resolvedSupplementaryRound > 0
    ) {
      const dupSupplement = await client.query(
        `SELECT r.id
         FROM chuyen_sau_results r
         LEFT JOIN event_schedules es ON es.id::text = r.id_su_kien::text
         WHERE LOWER(TRIM(r.ma_giao_vien)) = LOWER(TRIM($1))
           AND r.id_mon = $2
           AND (
             LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bổ sung%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bo sung%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) = 'additional'
           )
           AND COALESCE((es.metadata->>'flow_round')::int, 0) = $3
         LIMIT 1`,
        [ma_giao_vien, resolvedSubjectId, resolvedSupplementaryRound]
      );
      if (dupSupplement.rows.length > 0) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: `Bạn đã làm môn này trong đợt bổ sung #${resolvedSupplementaryRound} rồi.`,
          httpStatus: 409,
          result_id: dupSupplement.rows[0].id,
        };
      }
    }

    if (id_su_kien) {
      const dupEvent = await client.query(
        `SELECT id FROM chuyen_sau_results
         WHERE id_su_kien = $1::uuid
           AND LOWER(TRIM(ma_giao_vien)) = LOWER(TRIM($2))
           AND id_mon = $3
         LIMIT 1`,
        [id_su_kien, ma_giao_vien, resolvedSubjectId]
      );
      if (dupEvent.rows.length > 0) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "Bạn đã đăng ký lịch thi này rồi.",
          httpStatus: 409,
          result_id: dupEvent.rows[0].id,
        };
      }
    }

    // Không chặn trùng (cùng GV + môn + tháng / chờ giải trình): import cần cho phép thêm bản ghi mới.

    const insertResult = await client.query(
      `INSERT INTO chuyen_sau_results (
         ma_giao_vien, ho_ten, dia_chi_email, co_so_lam_viec,
         khu_vuc, hinh_thuc, khoi_giang_day,
         thang_dk, nam_dk, dot,
         id_mon, id_su_kien, id_de_thi,
         lich_thi_dk,
         diem, xu_ly_diem, dang_ky_luc
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE($17::timestamptz, NOW()))
       RETURNING *`,
      [
        ma_giao_vien,
        resolvedHoTen,
        dia_chi_email || null,
        co_so_lam_viec || null,
        khu_vuc || null,
        hinh_thuc || null,
        khoi_giang_day || null,
        thang_dk || null,
        nam_dk || null,
        dotResolved ?? null,
        resolvedSubjectId,
        id_su_kien || null,
        resolvedSetId ?? null,
        lich_thi_dk,
        diemResolved,
        xuLyNormalized,
        dangKyResolved,
      ]
    );

    await client.query("COMMIT");
    return { ok: true, data: insertResult.rows[0] as Record<string, unknown> };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("insertExamRegistration ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const pgError = error as { code?: string; detail?: string; constraint?: string };
    
    // Log chi tiết để debug
    console.error("Error details:", {
      message: errorMessage,
      code: pgError?.code,
      detail: pgError?.detail,
      constraint: pgError?.constraint,
      teacher_code: ma_giao_vien,
      subject_id: resolvedSubjectId,
      event_id: id_su_kien,
      flow_round: resolvedSupplementaryRound,
    });
    
    return { 
      ok: false, 
      error: `Failed to create registration: ${errorMessage}`, 
      httpStatus: 500 
    };
  } finally {
    client.release();
  }
}
