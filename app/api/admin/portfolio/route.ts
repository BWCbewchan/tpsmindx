import { requireBearerSession } from '@/lib/datasource-api-auth';
import { checkHrefPermission } from '@/lib/menu-permissions';
import { listPortfolios } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

const PORTFOLIO_ACCESS_ERROR =
  'Tài khoản chưa được cấp quyền Quản lý Portfolio';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!checkHrefPermission('/admin/portfolio', auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: PORTFOLIO_ACCESS_ERROR },
        { status: 403 },
      );
    }

    const params = req.nextUrl.searchParams;
    const isSuperAdmin = auth.resolvedAccess.role === 'super_admin';
    const requestedCentre = params.get('centre')?.trim();
    const accessibleCentreNames = auth.accessibleCenters.map((center) => center.full_name).filter(Boolean);
    if (!isSuperAdmin && accessibleCentreNames.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản chưa được phân công cơ sở. Vui lòng liên hệ quản trị viên.' },
        { status: 403 },
      );
    }
    const centreNames = requestedCentre
      ? isSuperAdmin || accessibleCentreNames.includes(requestedCentre)
        ? [requestedCentre]
        : ['__NO_ACCESS_TO_SELECTED_CENTRE__']
      : isSuperAdmin
        ? []
        : accessibleCentreNames;

    const result = await listPortfolios({
      search: params.get('search') || undefined,
      track: params.get('track') || undefined,
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
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
