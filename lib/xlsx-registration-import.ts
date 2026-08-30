import * as XLSX from "xlsx";

const PREFERRED_SHEET_NAMES = ["Đăng ký", "Dang ky", "Import", "Data"];
const UNSAFE_HEADER_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function isSafeHeader(value: string): boolean {
  return Boolean(value) && !UNSAFE_HEADER_KEYS.has(value.toLowerCase());
}

/**
 * Đọc file .xlsx mẫu import: ưu tiên sheet "Đăng ký", không đọc sheet tham chiếu.
 */
export function parseXlsxRegistrationSheet(buf: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buf, { type: "array" });
  if (!wb.SheetNames.length) {
    throw new Error("File Excel không có sheet nào.");
  }
  const name =
    wb.SheetNames.find((n) => PREFERRED_SHEET_NAMES.includes(n.trim())) ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) {
    throw new Error("Không đọc được sheet dữ liệu.");
  }
  const table = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
  const [rawHeaders = [], ...rawRows] = table
    .map((row) => row.map((value) => String(value ?? "").trim()))
    .filter((row) => row.some(Boolean));
  if (!rawHeaders.length || !rawRows.length) {
    throw new Error('Sheet "Đăng ký" không có dòng dữ liệu (cần ít nhất 1 dòng sau dòng tiêu đề).');
  }
  const headerEntries = rawHeaders
    .map((value, index) => ({ header: normalizeHeader(value), index }))
    .filter(({ header }) => isSafeHeader(header));
  const headers = headerEntries.map(({ header }) => header);
  if (!headers.length) {
    throw new Error("File Excel không có header hợp lệ.");
  }

  const rows: Record<string, string>[] = rawRows.map((row) => {
    const r = Object.create(null) as Record<string, string>;
    for (const { header, index } of headerEntries) {
      r[header] = String(row[index] ?? "").trim();
    }
    return r;
  });
  return { headers, rows };
}
