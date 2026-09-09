import { requireBearerSession } from '@/lib/datasource-api-auth';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { listPortfolios } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

const PORTFOLIO_ACCESS_ERROR =
  'Chỉ tài khoản TEGL, TEGL+, TM, CL, RL, AL, LEAD, TE, TC hoặc super_admin mới có quyền truy cập portfolio';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioAllowedUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: PORTFOLIO_ACCESS_ERROR },
        { status: 403 },
      );
    }

    const params = req.nextUrl.searchParams;
    const isSuperAdmin = auth.resolvedAccess.role === 'super_admin';
    const centreNames = isSuperAdmin
      ? []
      : auth.accessibleCenters.map((center) => center.full_name).filter(Boolean);

    const result = await listPortfolios({
      search: params.get('search') || undefined,
      track: params.get('track') || undefined,
      pageIndex: Number(params.get('pageIndex') || 0),
      itemsPerPage: Number(params.get('itemsPerPage') || 25),
      centreNames,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải danh sách portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
