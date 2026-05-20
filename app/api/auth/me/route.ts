import { resolveAppUserAccessForEmail } from '@/lib/app-user-access';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';

/** Trả về thông tin user theo Bearer (không tin email từ query/body). */
export async function GET(request: NextRequest) {
  try {
    console.log('[auth/me] request start', request.nextUrl.pathname)

    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await resolveAppUserAccessForEmail(auth.sessionEmail);
    const assignedCenters = access.assignedCenters.map((center) => ({
      id: center.id,
      full_name: center.full_name,
      short_code: center.short_code,
      email: center.email,
    }));

    console.log(
      '[auth/me] resolved session',
      JSON.stringify(
        {
          email: auth.sessionEmail,
          role: access.role,
          isAdmin: access.isAdmin,
          isAppUser: access.isAppUser,
          centerCount: assignedCenters.length,
          assignedCenters,
        },
        null,
        2,
      ),
    );

    return NextResponse.json({
      success: true,
      email: auth.sessionEmail,
      isAdmin: access.isAdmin,
      isAppUser: access.isAppUser,
      role: access.role,
      permissions: access.permissions,
      userRoles: access.userRoles,
      assignedCenters,
    });
  } catch (error: unknown) {
    console.error('auth/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải thông tin phiên' },
      { status: 500 },
    );
  }
}
