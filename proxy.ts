import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isMaintenanceModeEnabled } from '@/lib/maintenance';
import { isTempHiddenUserRoute } from '@/lib/temp-hidden-user-routes';
import {
  TPS_SESSION_COOKIE,
  verifySessionCookieValue,
} from '@/lib/session-cookie';
import { buildLoginRedirectPath } from '@/lib/auth-redirect';
import {
  canAccessLectureReviewCalendar,
  isLectureReviewCalendarPath,
} from '@/lib/lecture-review-calendar-access';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLectureReviewCalendar = isLectureReviewCalendarPath(pathname);

  if (isTempHiddenUserRoute(pathname)) {
    return NextResponse.rewrite(new URL('/temp-hidden-404', request.url));
  }

  const needsSessionCookie =
    isLectureReviewCalendar ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/database') ||
    pathname.startsWith('/api/debug') ||
    (pathname.startsWith('/api/app-auth/') &&
      pathname !== '/api/app-auth/login');

  if (needsSessionCookie) {
    const raw = request.cookies.get(TPS_SESSION_COOKIE)?.value;
    if (!raw) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Yêu cầu đăng nhập (thiếu cookie phiên)' },
          { status: 401 },
        );
      }
      const requestedPath = `${pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(
        new URL(
          buildLoginRedirectPath(requestedPath, request.nextUrl.origin),
          request.url,
        ),
      );
    }
    const session = await verifySessionCookieValue(raw);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Phiên không hợp lệ hoặc đã hết hạn' },
          { status: 401 },
        );
      }
      const requestedPath = `${pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(
        new URL(
          buildLoginRedirectPath(requestedPath, request.nextUrl.origin),
          request.url,
        ),
      );
    }

    if (
      isLectureReviewCalendar &&
      !canAccessLectureReviewCalendar(session.email)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = session.canAdminPortal
        ? '/admin/dashboard'
        : '/user/thong-tin-giao-vien';
      url.search = '';
      return NextResponse.redirect(url);
    }

    const needsAdminPortal =
      pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
    if (needsAdminPortal && !session.canAdminPortal) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tài khoản không có quyền truy cập khu vực quản trị',
          },
          { status: 403 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = '/user/thongtingv';
      return NextResponse.redirect(url);
    }
  }

  if (!isMaintenanceModeEnabled()) {
    return NextResponse.next();
  }

  if (
    /\.(?:ico|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|mp4|webm|pdf)$/i.test(
      pathname
    )
  ) {
    return NextResponse.next();
  }

  if (pathname === '/bao-tri' || pathname.startsWith('/bao-tri/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        maintenance: true,
        code: 'MAINTENANCE_MODE',
        message:
          'TPS đang tạm đóng để bảo trì và nâng cấp. Vui lòng quay lại sau. Xin cảm ơn quý thầy cô.',
      },
      { status: 503 }
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = '/bao-tri';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:avif|css|eot|gif|ico|jpeg|jpg|js|json|map|mov|mp4|ogg|pdf|png|svg|ttf|txt|webm|webp|woff|woff2|xml)$).*)',
  ],
};
