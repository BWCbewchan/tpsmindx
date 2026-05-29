import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from "@/lib/datasource-api-auth";
import { NextRequest, NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api-protection";

const CSV_URL = process.env.NEXT_PUBLIC_RAWDATA_EXPERIENCE_CSV_URL || "";

interface TestRecord {
  area: string;
  name: string;
  email: string;
  branch: string;
  code: string;
  type: string;
  teachingLevel: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Mã giáo viên là bắt buộc" }, { status: 400 });
  }

  const denied = await rejectIfDatasourceLookupForbidden(
    auth.sessionEmail,
    auth.privileged,
    "",
    code,
  );
  if (denied) return denied;

  try {
    const response = await fetch(CSV_URL);
    const csvText = await response.text();

    const lines = csvText.split("\n");
    const records: TestRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns: string[] = [];
      let currentColumn = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          columns.push(currentColumn);
          currentColumn = "";
        } else {
          currentColumn += char;
        }
      }
      columns.push(currentColumn);

      const teacherCode = columns[4]?.trim().toLowerCase();
      if (teacherCode !== code.toLowerCase()) continue;

      const score = parseFloat(columns[12]?.replace(",", ".") || "0");
      const emailExplanation = columns[13]?.trim() || "";
      
      let dateStr = columns[15]?.trim();
      if (!dateStr && columns[7] && columns[8]) {
        dateStr = `${columns[7]}/${columns[8]}`;
      }

      const isCountedInAverage = !(score === 0 && emailExplanation === "Đã email giải trình");

      const record: TestRecord = {
        area: columns[0]?.trim() || "",
        name: columns[1]?.trim() || "",
        email: columns[2]?.trim() || "",
        branch: columns[3]?.trim() || "",
        code: columns[4]?.trim() || "",
        type: columns[5]?.trim() || "",
        teachingLevel: columns[6]?.trim() || "",
        month: columns[7]?.trim() || "",
        year: columns[8]?.trim() || "",
        batch: columns[9]?.trim() || "",
        time: columns[10]?.trim() || "",
        correct: columns[11]?.trim() || "",
        score: columns[12]?.trim() || "0",
        emailExplanation: emailExplanation,
        processing: columns[14]?.trim() || "",
        date: dateStr || "",
        isCountedInAverage: isCountedInAverage,
      };

      records.push(record);
    }

    records.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      if (yearA !== yearB) return yearB - yearA;
      
      const monthA = parseInt(a.month) || 0;
      const monthB = parseInt(b.month) || 0;
      return monthB - monthA;
    });

    const monthlyMap = new Map<string, TestRecord[]>();
    records.forEach((record) => {
      if (!monthlyMap.has(record.date)) {
        monthlyMap.set(record.date, []);
      }
      monthlyMap.get(record.date)!.push(record);
    });

    const monthlyData: MonthlyAverage[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      // Nhóm theo cấp độ giảng dạy trong tháng
      const levelMap = new Map<string, TestRecord[]>();
      monthRecords.forEach(r => {
        if (!levelMap.has(r.teachingLevel)) {
          levelMap.set(r.teachingLevel, []);
        }
        levelMap.get(r.teachingLevel)!.push(r);
      });

      let totalCombinedScore = 0;
      let levelCount = 0;

      levelMap.forEach((levelRecords) => {
        // Chỉ tính những cấp độ có ít nhất một bài thi được tính vào trung bình
        if (levelRecords.some(r => r.isCountedInAverage)) {
          let officialScore = 0;
          let supplementScore = 0;

          levelRecords.forEach(r => {
            if (!r.isCountedInAverage) return;
            
            const type = r.type.toLowerCase();
            const isSupplement = type.includes('bổ sung') || type.includes('bo') || type === 'additional';
            const score = parseFloat(r.score.replace(",", "."));

            if (isSupplement) {
              supplementScore = score;
            } else {
              officialScore = score;
            }
          });

          // Công thức:
          // - Có cả chính thức VÀ bổ sung → (officialScore + supplementScore) / 2
          // - Chỉ có bổ sung (không có chính thức) → lấy điểm bổ sung làm điểm chính
          // - Chỉ có chính thức → lấy điểm chính thức
          const hasOfficial = levelRecords.some(r => r.isCountedInAverage && !r.type.toLowerCase().includes('bổ sung') && !r.type.toLowerCase().includes('bo') && r.type.toLowerCase() !== 'additional');
          const hasSupplement = levelRecords.some(r => r.isCountedInAverage && (r.type.toLowerCase().includes('bổ sung') || r.type.toLowerCase().includes('bo') || r.type.toLowerCase() === 'additional'));
          const combinedScore = (hasOfficial && hasSupplement)
            ? (officialScore + supplementScore) / 2
            : hasSupplement
              ? supplementScore
              : officialScore;
          totalCombinedScore += combinedScore;
          levelCount++;
        }
      });

      if (levelCount > 0) {
        const average = totalCombinedScore / levelCount;
        monthlyData.push({
          month: month,
          average: average,
          count: levelCount,
          records: monthRecords,
        });
      } else {
        monthlyData.push({
          month: month,
          average: 0,
          count: 0,
          records: monthRecords,
        });
      }
    });

    monthlyData.sort((a, b) => {
      const [monthA, yearA] = a.month.split("/").map(Number);
      const [monthB, yearB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });

    return NextResponse.json({
      records: records,
      monthlyData: monthlyData,
      totalRecords: records.length,
      teacherCode: code,
    });
  } catch (error) {
    console.error("Error fetching raw data experience:", error);
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu từ Google Sheets" },
      { status: 500 }
    );
  }
});
