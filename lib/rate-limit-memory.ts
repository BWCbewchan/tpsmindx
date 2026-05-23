import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIpFromRequest(request: NextRequest): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

/** Simple in-memory fixed-window limiter (best-effort; use Redis/Upstash in multi-instance prod). */
export function rateLimitOr429(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return NextResponse.json(
      { success: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
      { status: 429 },
    );
  }
  return null;
}
