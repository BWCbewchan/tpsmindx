import { requireBearerSession } from '@/lib/datasource-api-auth';
import { listPortfolios } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'manager']);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (!auth.ok) return auth.response;

    if (!ADMIN_ROLES.has(auth.resolvedAccess.role)) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền quản lý portfolio' },
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
