import * as XLSX from "xlsx";

const PREFERRED_SHEET_NAMES = ["Đăng ký", "Dang ky", "Import", "Data"];

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
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
  if (!json.length) {
    throw new Error('Sheet "Đăng ký" không có dòng dữ liệu (cần ít nhất 1 dòng sau dòng tiêu đề).');
  }
  const headers = Object.keys(json[0] ?? {}).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows: Record<string, string>[] = json.map((obj) => {
    const r: Record<string, string> = {};
    for (const h of headers) {
      r[h] = String(obj[h] ?? "").trim();
    }
    return r;
  });
  return { headers, rows };
}
