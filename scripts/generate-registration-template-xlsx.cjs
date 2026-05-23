/**
 * Tạo public/templates/mau-import-dang-ky-ky-thi.xlsx:
 * "Đăng ký", "Tham chiếu môn", "Khối & môn" (Khối + Mã môn + Môn).
 *
 * Lưu ý: trong DB (chuyen_sau_monhoc.ma_mon) mã môn là chuỗi đầy đủ, ví dụ "[COD] Scratch",
 * không phải mã ngắn "COD". Import map cột "Mã môn" → ma_mon.
 *
 * Chạy: node scripts/generate-registration-template-xlsx.cjs
 * Đối chiếu DB: node scripts/query-chuyen-sau-monhoc-sample.cjs
 */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "public", "templates");
const outFile = path.join(outDir, "mau-import-dang-ky-ky-thi.xlsx");

const dataAoa = [
  [
    "STT",
    "Mã GV",
    "Loại đăng ký",
    "Khối",
    "Mã môn",
    "Môn",
    "Lịch thi",
    "Điểm",
    "Xử lý điểm",
    "Ngày đăng ký",
    "Trạng thái HO",
  ],
  [
    1,
    "thanhnq",
    "Chính thức",
    "CODING",
    "[COD] Scratch",
    "[COD] Scratch",
    "21:51 16/04/2026",
    0,
    "chờ giải trình",
    "16/4/2026",
    "Waiting",
  ],
  [
    2,
    "thanhnq",
    "Chính thức",
    "CODING",
    "[COD] Scratch",
    "[COD] Scratch",
    "21:51 16/04/2026",
    10,
    "đã hoàn thành",
    "16/4/2026",
    "Done",
  ],
  [
    3,
    "thanhnq",
    "Chính thức",
    "CODING",
    "[COD] Scratch",
    "[COD] Scratch",
    "21:51 16/04/2026",
    0,
    "chờ giải trình",
    "16/4/2026",
    "Waiting",
  ],
  [
    4,
    "thanhnq",
    "Chính thức",
    "CODING",
    "[COD] Scratch",
    "[COD] Scratch",
    "21:51 16/04/2026",
    10,
    "đã hoàn thành",
    "16/4/2026",
    "Done",
  ],
];

/** Tham chiếu — trùng ma_khoi / ma_mon / ten_mon trong chuyen_sau_monhoc (snapshot). */
const refAoa = [
  ["Mã môn", "Môn"],
  ["[ART] Chuyên Sâu", "[ART] Chuyên Sâu"],
  ["[COD] App Producer", "[COD] App Producer"],
  ["[COD] Computer Science", "[COD] Computer Science"],
  ["[COD] GameMaker", "[COD] GameMaker"],
  ["[COD] Scratch", "[COD] Scratch"],
  ["[COD] Web", "[COD] Web"],
  [
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Art]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Art]",
  ],
  [
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Coding]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Coding]",
  ],
  [
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Robotics]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Robotics]",
  ],
  ["[ROB] Vex GO", "[ROB] Vex GO"],
  ["[ROB] Vex IQ", "[ROB] Vex IQ"],
];

const refKhoiMonAoa = [
  ["Khối", "Mã môn", "Môn"],
  ["ART", "[ART] Chuyên Sâu", "[ART] Chuyên Sâu"],
  ["CODING", "[COD] App Producer", "[COD] App Producer"],
  ["CODING", "[COD] Computer Science", "[COD] Computer Science"],
  ["CODING", "[COD] GameMaker", "[COD] GameMaker"],
  ["CODING", "[COD] Scratch", "[COD] Scratch"],
  ["CODING", "[COD] Web", "[COD] Web"],
  [
    "PROCESS-ART",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Art]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Art]",
  ],
  [
    "PROCESS-COD",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Coding]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Coding]",
  ],
  [
    "PROCESS-ROB",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Robotics]",
    "Kiểm tra quy trình - Kỹ năng trải nghiệm [Robotics]",
  ],
  ["ROBOTICS", "[ROB] Vex GO", "[ROB] Vex GO"],
  ["ROBOTICS", "[ROB] Vex IQ", "[ROB] Vex IQ"],
];

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const wb = XLSX.utils.book_new();
const wsData = XLSX.utils.aoa_to_sheet(dataAoa);
const wsRef = XLSX.utils.aoa_to_sheet(refAoa);
const wsKhoiMon = XLSX.utils.aoa_to_sheet(refKhoiMonAoa);
XLSX.utils.book_append_sheet(wb, wsData, "Đăng ký");
XLSX.utils.book_append_sheet(wb, wsRef, "Tham chiếu môn");
XLSX.utils.book_append_sheet(wb, wsKhoiMon, "Khối & môn");
XLSX.writeFile(wb, outFile);
console.log("Wrote", outFile);
