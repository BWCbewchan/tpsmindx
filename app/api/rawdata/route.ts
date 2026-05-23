import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from "@/lib/datasource-api-auth";
import { NextRequest, NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api-protection";
import pool from "@/lib/db";

interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject: string;
  branch: string;
  code: string;
  type: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam: string;
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

  const client = await pool.connect();
  try {
    // Lấy kết quả thi từ DB, kèm thông tin môn học và trạng thái giải trình
    const result = await client.query(
      `SELECT
         r.khu_vuc            AS area,
         r.ho_ten             AS name,
         r.dia_chi_email      AS email,
         COALESCE(mh.ten_mon, mh.ma_mon, r.id_mon::text, '') AS subject,
         r.co_so_lam_viec     AS branch,
         r.ma_giao_vien       AS code,
         r.hinh_thuc          AS type,
         r.thang_dk           AS month,
         r.nam_dk             AS year,
         r.dot                AS batch,
         r.thoi_gian_kiem_tra AS time,
         r.cau_dung           AS correct,
         r.diem               AS score,
         r.email_giai_trinh   AS email_explanation,
         r.xu_ly_diem         AS processing,
         EXISTS (
           SELECT 1 FROM chuyen_sau_giaitrinh g
           WHERE g.id_ket_qua = r.id
             AND g.xu_ly_giai_trinh = 'đã duyệt'
           LIMIT 1
         ) AS has_accepted_explanation
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = LOWER(TRIM($1))
         AND r.thang_dk IS NOT NULL
         AND r.nam_dk   IS NOT NULL
       ORDER BY r.nam_dk DESC, r.thang_dk DESC`,
      [code]
    );

    const records: TestRecord[] = result.rows.map((row) => {
      const score = parseFloat(String(row.score ?? "0")) || 0;
      const didNotSubmit = row.processing !== "đã hoàn thành";
      // Loại trừ khỏi trung bình: user không nộp bài VÀ có giải trình được duyệt
      const isCountedInAverage = !(didNotSubmit && row.has_accepted_explanation);
      const dateStr = `${row.month}/${row.year}`;

      return {
        area:             row.area || "",
        name:             row.name || "",
        email:            row.email || "",
        subject:          row.subject || "",
        branch:           row.branch || "",
        code:             row.code || "",
        type:             row.type || "",
        month:            String(row.month || ""),
        year:             String(row.year || ""),
        batch:            row.batch || "",
        time:             row.time || "",
        exam:             "",
        correct:          String(row.correct ?? "0"),
        score:            String(score),
        emailExplanation: row.email_explanation || "",
        processing:       row.processing || "",
        date:             dateStr,
        isCountedInAverage,
      };
    });

    // Nhóm theo tháng/năm và tính trung bình theo công thức: (Chính thức + Bổ sung) / 2 cho mỗi môn
    const monthlyMap = new Map<string, TestRecord[]>();
    records.forEach((record) => {
      if (!monthlyMap.has(record.date)) {
        monthlyMap.set(record.date, []);
      }
      monthlyMap.get(record.date)!.push(record);
    });

    const monthlyData: MonthlyAverage[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      // Nhóm theo môn học trong tháng
      const subjectMap = new Map<string, TestRecord[]>();
      monthRecords.forEach(r => {
        if (!subjectMap.has(r.subject)) {
          subjectMap.set(r.subject, []);
        }
        subjectMap.get(r.subject)!.push(r);
      });

      let totalCombinedScore = 0;
      let subjectCount = 0;

      subjectMap.forEach((subjectRecords) => {
        // Chỉ tính những môn có ít nhất một bài thi được tính vào trung bình (isCountedInAverage)
        if (subjectRecords.some(r => r.isCountedInAverage)) {
          let officialScore = 0;
          let supplementScore = 0;
          let hasOfficial = false;
          let hasSupplement = false;

          subjectRecords.forEach(r => {
            if (!r.isCountedInAverage) return;
            
            const type = r.type.toLowerCase();
            const isSupplement = type.includes('bổ sung') || type.includes('bo') || type === 'additional';
            const score = parseFloat(r.score);

            if (isSupplement) {
              supplementScore = score;
              hasSupplement = true;
            } else {
              officialScore = score;
              hasOfficial = true;
            }
          });

          // Công thức: (Điểm Chính thức + Điểm Bổ sung) / 2
          // Nếu không thi chính thức, mặc định là 0
          const combinedScore = (officialScore + supplementScore) / 2;
          totalCombinedScore += combinedScore;
          subjectCount++;
        }
      });

      if (subjectCount > 0) {
        const average = totalCombinedScore / subjectCount;
        monthlyData.push({ month, average, count: subjectCount, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });

    monthlyData.sort((a, b) => {
      const [monthA, yearA] = a.month.split("/").map(Number);
      const [monthB, yearB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });

    return NextResponse.json({
      records,
      monthlyData,
      totalRecords: records.length,
      teacherCode: code,
    });
  } catch (error) {
    console.error("Error fetching rawdata from DB:", error);
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
});
