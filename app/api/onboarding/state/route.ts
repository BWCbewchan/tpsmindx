import { rejectIfEmailNotSelf, requireBearerSession } from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/db-helpers";
import { NextRequest, NextResponse } from "next/server";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Thiếu email" }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  const denied = rejectIfEmailNotSelf(auth.sessionEmail, auth.privileged, normalizedEmail);
  if (denied) return denied;

  try {
    const result = await pool.query(
      `SELECT email, tour_version, completed, completed_at, last_seen_step
       FROM user_onboarding_states
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        state: {
          email: normalizedEmail,
          tour_version: 1,
          completed: false,
          completed_at: null,
          last_seen_step: null,
        },
      });
    }

    return NextResponse.json({ success: true, state: result.rows[0] });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({
        success: true,
        dbUnavailable: true,
        state: {
          email: normalizedEmail,
          tour_version: 1,
          completed: false,
          completed_at: null,
          last_seen_step: null,
        },
      });
    }
    console.error("Failed to get onboarding state:", error);
    return NextResponse.json(
      { error: "Không thể lấy trạng thái onboarding" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const rawBody = await request.text();
    let body: Record<string, unknown> = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
      }
    }
    const email = String(body?.email || "").trim();
    const completed = Boolean(body?.completed);
    const lastSeenStep = body?.last_seen_step ? String(body.last_seen_step) : null;
    const tourVersion = Number(body?.tour_version) || 1;

    if (!email) {
      return NextResponse.json({ error: "Thiếu email" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    const denied = rejectIfEmailNotSelf(auth.sessionEmail, auth.privileged, normalizedEmail);
    if (denied) return denied;

    const result = await pool.query(
      `INSERT INTO user_onboarding_states (email, tour_version, completed, completed_at, last_seen_step)
       VALUES ($1, $2, $3, CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END, $4)
       ON CONFLICT (email)
       DO UPDATE SET
         tour_version = EXCLUDED.tour_version,
         completed = EXCLUDED.completed,
         completed_at = CASE WHEN EXCLUDED.completed THEN CURRENT_TIMESTAMP ELSE user_onboarding_states.completed_at END,
         last_seen_step = EXCLUDED.last_seen_step
       RETURNING email, tour_version, completed, completed_at, last_seen_step`,
      [normalizedEmail, tourVersion, completed, lastSeenStep]
    );

    return NextResponse.json({ success: true, state: result.rows[0] });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        {
          success: false,
          dbUnavailable: true,
          error: "Database tạm thời quá tải hoặc không kết nối được",
        },
        { status: 503 }
      );
    }
    console.error("Failed to update onboarding state:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật trạng thái onboarding" },
      { status: 500 }
    );
  }
}
