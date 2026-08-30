import { requireSameOriginMutation } from '@/lib/api-security';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { canAdministerTruyenThongPosts } from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

export type CommunicationActorResult =
  | {
      ok: true;
      userId: string;
      userEmail: string;
      userName: string;
      isAdmin: boolean;
    }
  | { ok: false; response: NextResponse };

async function displayNameForEmail(email: string): Promise<string> {
  const fallback = email.split('@')[0] || email;

  try {
    const appUser = await pool.query(
      `SELECT display_name FROM app_users WHERE LOWER(TRIM(email)) = $1 AND is_active = true LIMIT 1`,
      [email],
    );
    const appName = String(appUser.rows[0]?.display_name || '').trim();
    if (appName) return appName;

    const teacher = await pool.query(
      `SELECT COALESCE(full_name, "Full name") AS full_name
       FROM teachers
       WHERE LOWER(TRIM(COALESCE(work_email, "Work email", ''))) = $1
       LIMIT 1`,
      [email],
    );
    const teacherName = String(teacher.rows[0]?.full_name || '').trim();
    if (teacherName) return teacherName;

    const leader = await pool.query(
      `SELECT full_name FROM teaching_leaders WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
      [email],
    );
    const leaderName = String(leader.rows[0]?.full_name || '').trim();
    if (leaderName) return leaderName;
  } catch {
    // Display name is best effort; never fail the mutation because of profile lookup.
  }

  return fallback;
}

export async function requireCommunicationActor(
  request: NextRequest,
): Promise<CommunicationActorResult> {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return { ok: false, response: originDenied };

  const auth = await requireBearerSession(request);
  if (!auth.ok) return { ok: false, response: auth.response };

  const userEmail = auth.sessionEmail.trim().toLowerCase();
  const userName = await displayNameForEmail(userEmail);

  return {
    ok: true,
    userId: userEmail,
    userEmail,
    userName,
    isAdmin: canAdministerTruyenThongPosts(auth.resolvedAccess),
  };
}
