/** Parse CSV đơn giản (hỗ trợ dấu ngoặc kép). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

export function parseCsvToRows(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("File cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.");
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Alias header CSV → tên nội bộ.
 * Gồm tên cột giống file «Xuất dữ liệu» trên /admin/page4/danh-sach-dang-ky và tên kỹ thuật cũ.
 */
const HEADER_ALIASES: Record<string, string> = {
  // —— Giống cột xuất Excel (tiếng Việt) ——
  STT: "_stt",
  stt: "_stt",
  "Mã GV": "ma_giao_vien",
  "mã gv": "ma_giao_vien",
  "Loại đăng ký": "loai_dang_ky",
  "loại đăng ký": "loai_dang_ky",
  Khối: "khoi_giang_day",
  khối: "khoi_giang_day",
  "Mã môn": "ma_mon",
  "mã môn": "ma_mon",
  Môn: "ten_mon",
  môn: "ten_mon",
  "Lịch thi": "lich_thi",
  "lịch thi": "lich_thi",
  Điểm: "diem",
  điểm: "diem",
  "Xử lý điểm": "xu_ly_diem",
  "xử lý điểm": "xu_ly_diem",
  "Ngày đăng ký": "ngay_dang_ky",
  "ngày đăng ký": "ngay_dang_ky",
  "Trạng thái HO": "trang_thai_ho",
  "trạng thái ho": "trang_thai_ho",
  /** Cột trong file mẫu / export một số phiên bản (không có chữ HO) */
  "Trạng thái": "trang_thai_ho",
  "trạng thái": "trang_thai_ho",
  // —— Tên kỹ thuật / tiếng Anh ——
  ma_giao_vien: "ma_giao_vien",
  teacher_code: "ma_giao_vien",
  "ma gv": "ma_giao_vien",
  ma_mon: "ma_mon",
  "ma mon": "ma_mon",
  subject_code: "ma_mon",
  hinh_thuc: "hinh_thuc",
  "hình thức": "hinh_thuc",
  registration_type: "hinh_thuc",
  khoi_giang_day: "khoi_giang_day",
  khoi: "khoi_giang_day",
  block_code: "khoi_giang_day",
  thang_dk: "thang_dk",
  tháng: "thang_dk",
  thang: "thang_dk",
  month: "thang_dk",
  nam_dk: "nam_dk",
  năm: "nam_dk",
  nam: "nam_dk",
  year: "nam_dk",
  dia_chi_email: "dia_chi_email",
  email: "dia_chi_email",
  ho_ten: "ho_ten",
  "họ tên": "ho_ten",
  full_name: "ho_ten",
  id_su_kien: "id_su_kien",
  schedule_id: "id_su_kien",
  dot: "dot",
  đợt: "dot",
  co_so_lam_viec: "co_so_lam_viec",
  campus: "co_so_lam_viec",
  khu_vuc: "khu_vuc",
  region: "khu_vuc",
  id_de_thi: "id_de_thi",
  id_mon: "id_mon",
  subject_id: "id_mon",
  open_at: "open_at",
  scheduled_at: "scheduled_at",
};

export function normalizeHeaderKey(header: string): string {
  const raw = header.replace(/^\uFEFF/, "").trim();
  if (HEADER_ALIASES[raw] !== undefined) return HEADER_ALIASES[raw];
  const lower = raw.toLowerCase();
  if (HEADER_ALIASES[lower] !== undefined) return HEADER_ALIASES[lower];
  return raw;
}

/** Gộp các cột về tên chuẩn nội bộ (sau parse CSV). */
export function normalizeImportRow(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    const canon = normalizeHeaderKey(key);
    const trimmed = String(val ?? "").trim();
    if (trimmed === "") continue;
    if (out[canon] !== undefined && String(out[canon]).trim() !== "") continue;
    out[canon] = trimmed;
  }
  return out;
}

/** Giờ mặc định khi cột «Lịch thi» chỉ có ngày (không có giờ), ví dụ 15/1/2025 */
export const LICH_THI_DEFAULT_HOUR = 19;
export const LICH_THI_DEFAULT_MINUTE = 0;

/** Serial Excel (ngày trong workbook) → ngày dương lịch UTC; phần thập phân = giờ trong ngày. */
function parseExcelSerialToLocalDateTime(serial: number): {
  y: number;
  m: number;
  d: number;
  hh: number;
  min: number;
} | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const whole = Math.floor(serial);
  const frac = serial - whole;
  const ms = (whole - 25569) * 86400 * 1000;
  const base = new Date(ms);
  if (Number.isNaN(base.getTime())) return null;
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();
  let totalSeconds = Math.round(frac * 86400);
  if (totalSeconds < 0) totalSeconds = 0;
  if (totalSeconds >= 86400) totalSeconds = 86399;
  const hh = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  return { y, m, d, hh, min };
}

function buildLichThiResult(
  y: number,
  mo: number,
  d: number,
  hh: number,
  min: number,
): { thang_dk: number; nam_dk: number; open_at: string; scheduled_at: string } | null {
  const dt = new Date(y, mo - 1, d, hh, min, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  const iso = dt.toISOString();
  return {
    thang_dk: mo,
    nam_dk: y,
    open_at: iso,
    scheduled_at: iso,
  };
}

/**
 * Parse cột Lịch thi khi import:
 * - `HH:mm dd/MM/yyyy` (giống xuất dữ liệu), vd: 14:37 16/04/2026
 * - Chỉ ngày `d/M/yyyy` hoặc `dd/MM/yyyy` (ngày/tháng/năm) → mặc định giờ 19:00, vd: 15/1/2025
 * - `d/M/yyyy` kèm giờ `0:00` / `00:00:00` (Excel lưu ô «chỉ ngày») → 19:00
 * - `d/M/yyyy` kèm giờ thật → dùng đúng giờ đó
 * - Số serial Excel (vd 45672 hoặc "45672") → ngày tương ứng; không có phần giờ → 19:00
 */
export function parseLichThiExportFormat(lich: string): {
  thang_dk: number;
  nam_dk: number;
  open_at: string;
  scheduled_at: string;
} | null {
  const t = lich.trim();
  if (!t || t === "N/A") return null;

  const serialMatch = t.match(/^(\d+)(?:\.(\d+))?$/);
  if (serialMatch && !t.includes("/") && !t.includes(":")) {
    const serial = parseFloat(t);
    const looksLikeExcelSerial =
      serial >= 30000 ||
      (t.replace(/\..*$/, "").length >= 5 && serial >= 1);
    if (!looksLikeExcelSerial) {
      /* bỏ qua: tránh nhầm năm 2025 hoặc số ngắn với serial ngày */
    } else {
      const parts = parseExcelSerialToLocalDateTime(serial);
      if (parts) {
        const useDefaultTime = parts.hh === 0 && parts.min === 0;
        const hh = useDefaultTime ? LICH_THI_DEFAULT_HOUR : parts.hh;
        const min = useDefaultTime ? LICH_THI_DEFAULT_MINUTE : parts.min;
        return buildLichThiResult(parts.y, parts.m, parts.d, hh, min);
      }
    }
  }

  const withTime = t.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (withTime) {
    const hh = parseInt(withTime[1], 10);
    const min = parseInt(withTime[2], 10);
    const d = parseInt(withTime[3], 10);
    const mo = parseInt(withTime[4], 10);
    const y = parseInt(withTime[5], 10);
    return buildLichThiResult(y, mo, d, hh, min);
  }

  const dateThenTime = t.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dateThenTime) {
    const d = parseInt(dateThenTime[1], 10);
    const mo = parseInt(dateThenTime[2], 10);
    const y = parseInt(dateThenTime[3], 10);
    const hasTime = dateThenTime[4] !== undefined;
    if (!hasTime) {
      return buildLichThiResult(y, mo, d, LICH_THI_DEFAULT_HOUR, LICH_THI_DEFAULT_MINUTE);
    }
    const hh = parseInt(dateThenTime[4], 10);
    const min = parseInt(dateThenTime[5], 10);
    const sec = dateThenTime[6] !== undefined ? parseInt(dateThenTime[6], 10) : 0;
    const isMidnight = hh === 0 && min === 0 && sec === 0;
    if (isMidnight) {
      return buildLichThiResult(y, mo, d, LICH_THI_DEFAULT_HOUR, LICH_THI_DEFAULT_MINUTE);
    }
    return buildLichThiResult(y, mo, d, hh, min);
  }

  return null;
}

/**
 * Parse cột «Ngày đăng ký» khi import (CSV/Excel):
 * - ISO `yyyy-MM-dd` / chuỗi Date JSON
 * - `dd/MM/yyyy` (giống xuất vi-VN), vd: 16/4/2026
 * - `HH:mm dd/MM/yyyy` (nếu dán nhầm format lịch thi)
 * - Số serial Excel (ô chỉ ngày)
 */
export function parseNgayDangKyImportFormat(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1e12) {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (raw >= 30000 && raw < 2958465) {
      const parts = parseExcelSerialToLocalDateTime(raw);
      if (parts) {
        return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
      }
    }
  }
  const t = String(raw).trim();
  if (!t || t === "N/A") return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const withTime = t.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (withTime) {
    const hh = parseInt(withTime[1], 10);
    const min = parseInt(withTime[2], 10);
    const day = parseInt(withTime[3], 10);
    const mo = parseInt(withTime[4], 10);
    const y = parseInt(withTime[5], 10);
    const dt = new Date(y, mo - 1, day, hh, min, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const ddmmyyyy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const mo = parseInt(ddmmyyyy[2], 10);
    const y = parseInt(ddmmyyyy[3], 10);
    const dt = new Date(y, mo - 1, day, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fuzzy = new Date(t);
  return Number.isNaN(fuzzy.getTime()) ? null : fuzzy;
}

/**
 * Chuyển một dòng import (đã normalize) → payload cho insertExamRegistration.
 * Hỗ trợ đúng cấu trúc cột như file xuất + file mẫu; bỏ cột chỉ để đọc (STT, …).
 */
export function rowToRegistrationPayload(normalized: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...normalized };

  delete o._stt;
  delete o.stt;

  if (!o.ma_giao_vien && o.teacher_code) o.ma_giao_vien = o.teacher_code;

  const loai = String(o.loai_dang_ky ?? "").trim();
  if (loai && !o.hinh_thuc) {
    if (/bổ\s*sung|additional/i.test(loai)) o.hinh_thuc = "Bổ sung";
    else o.hinh_thuc = "Chính thức";
  }
  delete o.loai_dang_ky;

  delete o.ten_mon;
  /** Giữ xu_ly_diem cho insertExamRegistration (Đã duyệt, Đã hoàn thành, …) */
  const ngayDkRaw = o.ngay_dang_ky;
  if (
    ngayDkRaw !== undefined &&
    ngayDkRaw !== null &&
    String(ngayDkRaw).trim() !== ""
  ) {
    const parsed = parseNgayDangKyImportFormat(ngayDkRaw);
    if (parsed) o.dang_ky_luc = parsed.toISOString();
  }
  delete o.ngay_dang_ky;
  delete o.trang_thai_ho;

  const lich = String(o.lich_thi ?? "").trim();
  if (lich && lich !== "N/A") {
    const p = parseLichThiExportFormat(lich);
    if (p) {
      if (o.thang_dk == null || o.thang_dk === "") o.thang_dk = p.thang_dk;
      if (o.nam_dk == null || o.nam_dk === "") o.nam_dk = p.nam_dk;
      o.open_at = p.open_at;
      o.scheduled_at = p.scheduled_at;
    }
  }
  delete o.lich_thi;

  return o;
}
