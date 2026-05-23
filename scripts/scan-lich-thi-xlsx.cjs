const XLSX = require("xlsx");
const path = process.argv[2] || "c:/Users/admin/Downloads/datagoc/data dùng để import.xlsx";
const wb = XLSX.readFile(path);
const ws = wb.Sheets["Đăng ký"] || wb.Sheets[wb.SheetNames[0]];
const j = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
const DATE_ONLY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const WITH_TIME = /(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const bad = [];
const uniq = new Map();
for (const r of j) {
  const v = String(r["Lịch thi"] ?? "").trim();
  if (!v) {
    bad.push("(empty)");
    continue;
  }
  uniq.set(v, (uniq.get(v) || 0) + 1);
  if (!DATE_ONLY.test(v) && !v.match(WITH_TIME)) bad.push(v);
}
console.log("Rows:", j.length);
console.log("Unique Lịch thi:", uniq.size);
console.log("Sample values:", [...uniq.keys()].slice(0, 15));
console.log("Non-parseable samples:", [...new Set(bad)].slice(0, 25));
console.log("Rows with non-parseable:", bad.length);
