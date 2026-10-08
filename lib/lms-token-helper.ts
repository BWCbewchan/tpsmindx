import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  '';
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

export interface LmsTokenSession {
  token: string | null;
  newToken?: string;
  newRefresh?: string;
  expiresIn?: number;
}

const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const FALLBACK_EMAIL = process.env.LMS_FALLBACK_EMAIL || 'baotc@mindx.com.vn';
const FALLBACK_PASSWORD = process.env.LMS_FALLBACK_PASSWORD || 'MindX@2024';

/**
 * Log in to Firebase using fallback LMS credentials from environment variables.
 */
export async function loginFallbackLmsAccount(): Promise<LmsTokenSession> {
  if (!FIREBASE_API_KEY || !FALLBACK_EMAIL || !FALLBACK_PASSWORD) {
    return { token: null };
  }

  try {
    const res = await fetch(FIREBASE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: FALLBACK_EMAIL,
        password: FALLBACK_PASSWORD,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_WEB',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const idToken = data.idToken as string;
      const refreshToken = data.refreshToken as string;
      const expiresIn = parseInt(data.expiresIn || '3600', 10);

      return {
        token: idToken,
        newToken: idToken,
        newRefresh: refreshToken,
        expiresIn,
      };
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('[lms-token-helper] Fallback login failed:', err);
    }
  } catch (e) {
    console.error('[lms-token-helper] Fallback login network error:', e);
  }

  return { token: null };
}

/**
 * Get LMS Firebase token from request cookies.
 * If token is missing or expired, attempt to refresh using lms_firebase_refresh cookie or fallback account.
 */
export async function getOrRefreshLmsToken(
  req: NextRequest,
): Promise<LmsTokenSession> {
  const currentToken = req.cookies.get('lms_firebase_token')?.value || null;
  const refreshToken = req.cookies.get('lms_firebase_refresh')?.value || null;

  // If current token exists, return it
  if (currentToken) {
    return { token: currentToken };
  }

  // If current token is missing but refresh token is available, try refreshing
  if (refreshToken && FIREBASE_API_KEY) {
    try {
      const res = await fetch(FIREBASE_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newIdToken = data.id_token as string;
        const newRefreshToken = data.refresh_token as string;
        const expiresIn = parseInt(data.expires_in || '3600', 10);

        return {
          token: newIdToken,
          newToken: newIdToken,
          newRefresh: newRefreshToken,
          expiresIn,
        };
      }
    } catch (e) {
      console.error('[lms-token-helper] Auto-refresh failed:', e);
    }
  }

  // Fallback to LMS service account (banghh@mindx.com.vn)
  return await loginFallbackLmsAccount();
}

/**
 * Force refresh token using lms_firebase_refresh cookie or fallback to LMS account.
 */
export async function refreshLmsToken(
  req: NextRequest,
): Promise<LmsTokenSession> {
  const refreshToken = req.cookies.get('lms_firebase_refresh')?.value || null;
  if (refreshToken && FIREBASE_API_KEY) {
    try {
      const res = await fetch(FIREBASE_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newIdToken = data.id_token as string;
        const newRefreshToken = data.refresh_token as string;
        const expiresIn = parseInt(data.expires_in || '3600', 10);

        return {
          token: newIdToken,
          newToken: newIdToken,
          newRefresh: newRefreshToken,
          expiresIn,
        };
      }
    } catch (e) {
      console.error('[lms-token-helper] Force refresh failed:', e);
    }
  }

  // Fallback to LMS service account (banghh@mindx.com.vn)
  return await loginFallbackLmsAccount();
}

/**
 * Attach refreshed cookies to response if new tokens were fetched.
 */
export function applyRefreshedCookies(
  res: NextResponse,
  tokenSession: LmsTokenSession,
) {
  if (tokenSession.newToken) {
    res.cookies.set('lms_firebase_token', tokenSession.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokenSession.expiresIn || 3600,
    });
  }
  if (tokenSession.newRefresh) {
    res.cookies.set('lms_firebase_refresh', tokenSession.newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}
