import { withApiProtection } from "@/lib/api-protection";
import { rejectIfEmailNotSelf, requireDatasourceBearer } from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/db-helpers";
import { NextRequest, NextResponse } from "next/server";

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireDatasourceBearer(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const userEmail = String(body?.userEmail || "").trim().toLowerCase();
    const userName = String(body?.userName || "").trim();
    const userCode = String(body?.userCode || "").trim();
    const raw =
      typeof body?.onboardingData === "object" && body.onboardingData !== null
        ? body.onboardingData
        : {};
    const f = (key: string) =>
      String((raw as Record<string, unknown>)?.[key] || "").trim();

    if (!userEmail) {
      return NextResponse.json({ success: false, error: "userEmail là bắt buộc" }, { status: 400 });
    }

    const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, userEmail);
    if (denied) return denied;

    const code          = f("Code") || userCode || userEmail.split("@")[0];
    const fullName      = f("Full name") || userName || code;
    const userNameField = f("User name") || code;
    const workEmail     = f("Work email") || userEmail;
    const personalEmail = f("Personal email");
    const phoneNumber   = f("Phone number");
    const statusUpdate  = f("Status (update)");
    const centers       = f("Centers");
    const khoiFinal     = f("Khối final");
    const role          = f("Role");
    const courseLine    = f("Course line");
    const rank          = f("Rank");
    const joinedDate    = f("Joined date");
    const teacherPoint  = f("Teacher point");
    const dataHrRaw     = f("Data HR (Raw)");
    const statusCheck   = f("Status check");
    const buCheck       = f("BU check");
    const khoiCheck     = f("Khối check");
    const checkCol      = f("CHECK");
    const teQuanLy      = f("TE quản lý");
    const leaderQuanLy  = f("Leader quản lý");
    const rateK12Check  = f("Rate K12 check");
    const rankK12Check  = f("Rank K12 check");
    const snapshotJson  = JSON.stringify(raw);

    await pool.query(
      `INSERT INTO teachers (
         code, full_name, user_name, work_email, personal_email, phone_number,
         status_update, centers, khoi_final, role, course_line, rank,
         joined_date, teacher_point, data_hr_raw, status_check, bu_check,
         khoi_check, check_col, te_quan_ly, leader_quan_ly,
         rate_k12_check, rank_k12_check, status, main_centre,
         "Full name", "User name", "Work email", "Main centre", "Status", "Course Line",
         onboarding_snapshot, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23, $24, $8,
         $2, $3, $4, $8, $24, $11,
         $25::jsonb, CURRENT_TIMESTAMP
       )
       ON CONFLICT (code)
       DO UPDATE SET
         full_name       = EXCLUDED.full_name,
         user_name       = EXCLUDED.user_name,
         work_email      = EXCLUDED.work_email,
         personal_email  = EXCLUDED.personal_email,
         phone_number    = EXCLUDED.phone_number,
         status_update   = EXCLUDED.status_update,
         centers         = EXCLUDED.centers,
         khoi_final      = EXCLUDED.khoi_final,
         role            = EXCLUDED.role,
         course_line     = EXCLUDED.course_line,
         rank            = EXCLUDED.rank,
         joined_date     = EXCLUDED.joined_date,
         teacher_point   = EXCLUDED.teacher_point,
         data_hr_raw     = EXCLUDED.data_hr_raw,
         status_check    = EXCLUDED.status_check,
         bu_check        = EXCLUDED.bu_check,
         khoi_check      = EXCLUDED.khoi_check,
         check_col       = EXCLUDED.check_col,
         te_quan_ly      = EXCLUDED.te_quan_ly,
         leader_quan_ly  = EXCLUDED.leader_quan_ly,
         rate_k12_check  = EXCLUDED.rate_k12_check,
         rank_k12_check  = EXCLUDED.rank_k12_check,
         status          = EXCLUDED.status,
         main_centre     = EXCLUDED.main_centre,
         "Full name"     = EXCLUDED."Full name",
         "User name"     = EXCLUDED."User name",
         "Work email"    = EXCLUDED."Work email",
         "Main centre"   = EXCLUDED."Main centre",
         "Status"        = EXCLUDED."Status",
         "Course Line"   = EXCLUDED."Course Line",
         onboarding_snapshot = EXCLUDED.onboarding_snapshot,
         updated_at      = CURRENT_TIMESTAMP`,
      [
        code, fullName, userNameField, workEmail, personalEmail || null, phoneNumber || null,
        statusUpdate || null, centers || null, khoiFinal || null, role || null, courseLine || null, rank || null,
        joinedDate || null, teacherPoint || null, dataHrRaw || null, statusCheck || null, buCheck || null,
        khoiCheck || null, checkCol || null, teQuanLy || null, leaderQuanLy || null,
        rateK12Check || null, rankK12Check || null, statusCheck || statusUpdate || "Active",
        snapshotJson,
      ]
    );

    return NextResponse.json({ success: true, persisted: true });
  } catch (error: unknown) {
    if (isDatabaseUnavailableError(error)) {
      // Cho phép client coi như thành công để user vẫn vào được app; đồng bộ DB khi slot trở lại.
      return NextResponse.json({
        success: true,
        persisted: false,
        dbUnavailable: true,
        warning:
          "Máy chủ database đang quá tải. Bạn vẫn có thể vào hệ thống; dữ liệu xác nhận sẽ được lưu khi kết nối ổn định.",
      });
    }
    const message = error instanceof Error ? error.message : "Không thể lưu xác nhận datasource";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
