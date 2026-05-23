import { resolveAppUserAccessForEmail } from '@/lib/app-user-access';
import pool from '@/lib/db';
import { checkTeacherExistsByEmail } from '@/lib/db-helpers';
import { getJwtSecret } from '@/lib/jwt-secret';
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory';
import { setSessionCookieOnResponse } from '@/lib/session-cookie';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const DOMAIN_SUFFIXES = ['@mindx.edu.vn', '@mindx.net.vn', '@mindx.com.vn'];

async function tryFirebaseLogin(email: string, password: string) {
  try {
    const response = await fetch(FIREBASE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_WEB',
      }),
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = { error: { message: 'FIREBASE_BAD_RESPONSE' } };
    }
    return { ok: response.ok, data };
  } catch (e) {
    console.error('Firebase Auth fetch failed', e);
    return { ok: false, data: { error: { message: 'NETWORK_ERROR' } } };
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimitOr429(
      `auth-login:${clientIpFromRequest(request)}`,
      40,
      60_000,
    );
    if (rl) return rl;

    if (!FIREBASE_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'Đăng nhập qua Firebase chưa được cấu hình (thiếu FIREBASE_API_KEY). Liên hệ quản trị hệ thống.' },
        { status: 503 }
      );
    }

    let body: { email?: string; password?: string; role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
    }

    const { email: rawEmail, password } = body || {};

    if (!rawEmail || !password) {
      return NextResponse.json({ error: 'Email và password là bắt buộc' }, { status: 400 });
    }

    const inputEmail = rawEmail.trim();
    let emailsToTry = [inputEmail];

    if (!inputEmail.includes('@')) {
      emailsToTry = DOMAIN_SUFFIXES.map(suffix => `${inputEmail}${suffix}`);
    }

    let successData: Record<string, unknown> | null = null;
    let lastError: string | null = null;
    let finalDisplayName: string | null = null;

    for (const tryEmail of emailsToTry) {
      try {
        const { ok, data } = await tryFirebaseLogin(tryEmail, password);
        if (ok) {
          successData = data;
          break;
        }
        const errMsg = (data.error as { message?: string } | undefined)?.message;
        lastError = errMsg || 'LOGIN_FAILED';
      } catch (e) {
        console.error('Firebase Auth internal error', e);
      }
    }

    if (!successData) {
      let errorMessage = 'Đăng nhập thất bại';
      if (lastError) {
        switch (lastError) {
          case 'EMAIL_NOT_FOUND':
          case 'INVALID_PASSWORD':
          case 'INVALID_LOGIN_CREDENTIALS':
            errorMessage = 'Email hoặc mật khẩu không chính xác';
            break;
          case 'USER_DISABLED':
            errorMessage = 'Tài khoản đã bị vô hiệu hóa';
            break;
          case 'TOO_MANY_ATTEMPTS_TRY_LATER':
            errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau';
            break;
          case 'NETWORK_ERROR':
            errorMessage = 'Không kết nối được tới máy chủ đăng nhập. Kiểm tra mạng và thử lại.';
            break;
          case 'FIREBASE_BAD_RESPONSE':
            errorMessage = 'Phản hồi đăng nhập không hợp lệ. Vui lòng thử lại.';
            break;
          default:
            errorMessage = lastError;
        }
      }
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    if (successData.displayName) {
      finalDisplayName = String(successData.displayName);
    }

    if (!finalDisplayName) {
      try {
        const dbUser = await pool.query(
          'SELECT display_name FROM app_users WHERE email = $1 LIMIT 1',
          [String(successData.email).toLowerCase()]
        );
        if (dbUser.rows.length > 0 && dbUser.rows[0].display_name) {
          finalDisplayName = dbUser.rows[0].display_name;
        }
      } catch (dbErr) {
        console.warn('Lỗi lấy tên hiển thị từ local db:', dbErr);
      }
    }

    const loginEmail = String(successData.email || '').trim().toLowerCase();

    const access = await resolveAppUserAccessForEmail(loginEmail)
    if (access.found && !access.isActive) {
      return NextResponse.json(
        { error: 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị hệ thống.' },
        { status: 403 },
      );
    }

    const teacherFoundInDb =
      (access.role === 'teacher' || !access.found) && loginEmail
        ? await checkTeacherExistsByEmail(loginEmail)
        : false;

    const edgeSessionJwt = jwt.sign(
      {
        email: loginEmail,
        purpose: 'tps_edge',
        ap: access.isAdmin === true,
      },
      getJwtSecret(),
      { expiresIn: '1h' }, // Khớp thời hạn Firebase idToken — giảm rủi ro nếu bị đánh cắp
    );

    const res = NextResponse.json({
      idToken: successData.idToken,
      /** JWT nội bộ HS256 — dùng làm Bearer cho /api/check-admin và các API bảo vệ thay vì Firebase idToken */
      accessToken: edgeSessionJwt,
      email: successData.email,
      localId: successData.localId,
      displayName: finalDisplayName || String(successData.email || '').split('@')[0],
      expiresIn: successData.expiresIn,
      refreshToken: successData.refreshToken,
      role: access.role,
      isAdmin: access.isAdmin,
      permissions: access.permissions,
      userRoles: access.userRoles,
      isAppUser: access.isAppUser,
      teacherSync: {
        foundInDatabase: teacherFoundInDb,
      },
    });
    setSessionCookieOnResponse(res, edgeSessionJwt);

    // Lưu Firebase idToken + refreshToken vào httpOnly cookie riêng để dùng cho LMS API
    // Cookie này độc lập với session TPS, chỉ dùng để gọi lms-api.mindx.edu.vn
    if (successData.idToken && typeof successData.idToken === 'string') {
      res.cookies.set('lms_firebase_token', String(successData.idToken), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 giờ — khớp thời hạn Firebase idToken
      });
    }
    if (successData.refreshToken && typeof successData.refreshToken === 'string') {
      res.cookies.set('lms_firebase_refresh', String(successData.refreshToken), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 ngày — refresh token sống lâu hơn
      });
    }

    return res;
  } catch (error: unknown) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi server. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
