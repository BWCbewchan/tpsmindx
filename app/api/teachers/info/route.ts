import { withApiProtection } from "@/lib/api-protection";
import { requireBearerOrSessionCookie } from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { teacherRowWorkEmail } from "@/lib/verify-bearer-session";
import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy quoted columns duplicate snake_case fields from the same row (confirm route writes both).
 * Spreading onboarding_snapshot also duplicates sheet keys ("Full Name", …) vs DB columns — drop both.
 */
const LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE = new Set([
  "Full name",
  "User name",
  "Work email",
  "Main centre",
  "Status",
  "Course Line",
]);

function mergeTeacherRow(row: Record<string, unknown>): Record<string, unknown> {
  const { onboarding_snapshot: removedSnapshot, ...rest } = row;
  void removedSnapshot;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerOrSessionCookie(request);
    if (!auth.ok) return auth.response;

    const { sessionEmail, privileged } = auth;

    const code = String(request.nextUrl.searchParams.get("code") || "").trim();
    const emailParam = String(request.nextUrl.searchParams.get("email") || "")
      .trim()
      .toLowerCase();

    if (!code && !emailParam) {
      return NextResponse.json(
        { success: false, error: "Vui lòng truyền code hoặc email" },
        { status: 400 },
      );
    }

    let result;

    if (privileged) {
      const conditions: string[] = [];
      const params: string[] = [];

      if (code) {
        params.push(code);
        conditions.push(`LOWER(TRIM(code)) = LOWER(TRIM($${params.length}))`);
      }

      if (emailParam) {
        params.push(emailParam);
        conditions.push(`
        LOWER(TRIM(work_email)) = LOWER(TRIM($${params.length}))
        OR LOWER(TRIM("Work email")) = LOWER(TRIM($${params.length}))
      `);
      }

      result = await pool.query(
        `
        SELECT *
        FROM teachers
        WHERE ${conditions.join(" OR ")}
        LIMIT 1
      `,
        params,
      );
    } else if (code) {
      result = await pool.query(
        `
        SELECT *
        FROM teachers
        WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
        LIMIT 1
      `,
        [code],
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const rowEmail = teacherRowWorkEmail(row);
        if (!rowEmail || rowEmail !== sessionEmail) {
          return NextResponse.json(
            { success: false, error: "Không có quyền xem thông tin giáo viên này" },
            { status: 403 },
          );
        }
      }
    } else {
      result = await pool.query(
        `
        SELECT *
        FROM teachers
        WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
           OR LOWER(TRIM("Work email")) = LOWER(TRIM($1))
        LIMIT 1
      `,
        [sessionEmail],
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy giáo viên trong bảng teachers" },
        { status: 404 },
      );
    }

    const teacher = mergeTeacherRow(result.rows[0] as Record<string, unknown>);

    return NextResponse.json({ success: true, teacher });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể lấy thông tin giáo viên";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
