import { withApiProtection } from "@/lib/api-protection";
import {
    rejectIfDatasourceLookupForbidden,
    requireDatasourceBearer,
} from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { checkTeacherExistsByEmailDetailed } from "@/lib/db-helpers";
import {
  findTeacherRowByLookupQuery,
  loadTeacherProfileBundle,
} from "@/lib/teacher-profile-bundle";
import { NextRequest, NextResponse } from "next/server";

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireDatasourceBearer(request);
    if (!auth.ok) return auth.response;

    const { sessionEmail, privileged } = auth;

    const searchParams = request.nextUrl.searchParams;
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();
    const code = String(searchParams.get("code") || "").trim();
    const brief = searchParams.get("brief") === "1";
    const fast = searchParams.get("fast") === "1";

    if (brief) {
      if (!email) {
        return NextResponse.json(
          { success: false, error: "email là bắt buộc khi brief=1" },
          { status: 400 },
        );
      }
      const denied = await rejectIfDatasourceLookupForbidden(
        sessionEmail,
        privileged,
        email,
        "",
      );
      if (denied) return denied;

      const { exists, dbUnavailable } = await checkTeacherExistsByEmailDetailed(
        email,
      );
      return NextResponse.json({ success: true, exists, dbUnavailable });
    }

    if (!email && !code) {
      return NextResponse.json(
        { success: false, error: "Cần email hoặc code" },
        { status: 400 },
      );
    }

    let lookupCode = code;
    if (code && !email) {
      const found = await findTeacherRowByLookupQuery(pool, code);

      if (found.matches && found.matches.length > 1) {
        const allowedMatches: typeof found.matches = [];
        for (const candidate of found.matches) {
          const denied = await rejectIfDatasourceLookupForbidden(
            sessionEmail,
            privileged,
            "",
            candidate.code,
          );
          if (!denied) allowedMatches.push(candidate);
        }

        if (allowedMatches.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "Không có quyền xem giáo viên khớp tên này",
            },
            { status: 403 },
          );
        }

        if (allowedMatches.length === 1) {
          lookupCode = allowedMatches[0].code;
        } else {
          return NextResponse.json({
            success: true,
            exists: false,
            chooseTeacher: true,
            matches: allowedMatches,
            teacher: null,
            expertise: null,
            experience: null,
            certificates: null,
            training: null,
          });
        }
      } else if (!found.row) {
        return NextResponse.json({
          success: true,
          exists: false,
          teacher: null,
          expertise: null,
          experience: null,
          certificates: null,
          training: null,
        });
      } else {
        lookupCode = String(
          (found.row as Record<string, unknown>).code ?? "",
        ).trim();
      }
    }

    const deniedLookup = await rejectIfDatasourceLookupForbidden(
      sessionEmail,
      privileged,
      email,
      lookupCode || code,
    );
    if (deniedLookup) return deniedLookup;

    const bundle = await loadTeacherProfileBundle(
      pool,
      email ? { email, fast } : { code: lookupCode, fast },
    );

    return NextResponse.json({
      success: true,
      exists: bundle.exists,
      teacher: bundle.teacher,
      expertise: bundle.expertise,
      experience: bundle.experience,
      certificates: bundle.certificates,
      training: bundle.training,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể tải dữ liệu";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
