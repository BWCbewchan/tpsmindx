import { jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';

import { getJwtSecret } from '@/lib/jwt-secret';

/** Tên cookie phiên (HttpOnly, set từ API login). */
export const TPS_SESSION_COOKIE = 'tps_session';

/**
 * JWT HS256 do server ký (login app hoặc phiên edge sau Firebase).
 * Middleware chỉ tin chữ ký — không gọi DB.
 */
export type VerifiedEdgeSession = {
  email: string;
  /** Có quyền vào /admin và /api/admin (theo DB/permissions lúc đăng nhập). */
  canAdminPortal: boolean;
};

export async function verifySessionCookieValue(
  token: string,
): Promise<VerifiedEdgeSession | null> {
  const raw = token.trim();
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(
      raw,
      new TextEncoder().encode(getJwtSecret()),
      { algorithms: ['HS256'] },
    );
    const email =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!email) return null;
    const ap =
      payload.ap === true ||
      payload.ap === 'true' ||
      (typeof payload.role === 'string' &&
        ['super_admin', 'admin', 'manager'].includes(payload.role));
    return { email, canAdminPortal: Boolean(ap) };
  } catch {
    return null;
  }
}

export function setSessionCookieOnResponse(
  res: NextResponse,
  tokenValue: string,
  maxAgeSeconds = 60 * 60 * 12,
) {
  res.cookies.set(TPS_SESSION_COOKIE, tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}
