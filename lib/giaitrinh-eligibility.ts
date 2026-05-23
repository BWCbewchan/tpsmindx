/**
 * Quy tắc nghiệp vụ: giải trình điểm chỉ trong tháng hiện tại (theo múi giờ Việt Nam).
 */

const VN_TZ = "Asia/Ho_Chi_Minh";

function vnYearMonthParts(d: Date): { y: string; m: string } {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  return { y, m: mo.padStart(2, "0") };
}

/** Khóa YYYY-MM theo lịch Việt Nam */
export function vietnamYearMonthKey(d: Date): string {
  const { y, m } = vnYearMonthParts(d);
  return `${y}-${m}`;
}

/** So khớp tháng/năm (VN) của mốc thời gian với «bây giờ» */
export function isExamInCurrentVietnamMonth(isoOrDate: string | Date | null | undefined): boolean {
  if (isoOrDate == null) return false;
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return false;
  return vietnamYearMonthKey(d) === vietnamYearMonthKey(new Date());
}

export type ResultMonthFields = {
  thang_dk: number | null;
  nam_dk: number | null;
  lich_thi_dk: Date | string | null;
  schedule_open: Date | string | null;
};

/**
 * Tháng kỳ thi từ bản ghi kết quả: ưu tiên thang_dk/nam_dk, sau đó lịch thi / lịch sự kiện.
 * Trả về khóa YYYY-MM (theo VN) hoặc null.
 */
export function resultExamVietnamYearMonthKey(row: ResultMonthFields): string | null {
  if (row.thang_dk != null && row.nam_dk != null && row.thang_dk >= 1 && row.thang_dk <= 12) {
    return `${row.nam_dk}-${String(row.thang_dk).padStart(2, "0")}`;
  }
  const t = row.lich_thi_dk || row.schedule_open;
  if (t) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return vietnamYearMonthKey(d);
  }
  return null;
}

export function isResultEligibleForGiaiTrinhThisMonth(row: ResultMonthFields): boolean {
  const key = resultExamVietnamYearMonthKey(row);
  if (!key) return false;
  return key === vietnamYearMonthKey(new Date());
}
