/**
 * /api/lms-token/refresh
 * Dùng Firebase refreshToken (lưu trong httpOnly cookie) để lấy idToken mới.
 * Được gọi server-side khi lms_firebase_token hết hạn.
 */
import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('lms_firebase_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Không có refresh token' }, { status: 401 });
  }

  if (!FIREBASE_API_KEY) {
    return NextResponse.json({ error: 'Firebase chưa được cấu hình' }, { status: 500 });
  }

  try {
    const res = await fetch(FIREBASE_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
    }

    const data = await res.json();
    const newIdToken = data.id_token as string;
    const newRefreshToken = data.refresh_token as string;
    const expiresIn = parseInt(data.expires_in || '3600', 10);

    const response = NextResponse.json({ success: true });

    // Cập nhật cả hai cookie
    response.cookies.set('lms_firebase_token', newIdToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    });
    response.cookies.set('lms_firebase_refresh', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    console.error('[lms-token/refresh] Error:', error?.message);
    return NextResponse.json({ error: 'Lỗi khi refresh token' }, { status: 500 });
  }
}
