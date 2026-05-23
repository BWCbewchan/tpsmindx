import { TPS_SESSION_COOKIE } from '@/lib/session-cookie';
import { NextResponse } from 'next/server';

/** Xóa cookie phiên edge. JWT app/Firebase vẫn do client quản lý — hết hạn theo exp claim (và refresh Firebase có giới hạn revoke phía Google). */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(TPS_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
