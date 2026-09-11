import { requireBearerSession } from '@/lib/datasource-api-auth';
import { getAccessibleCenters } from '@/lib/center-access';
import { isPortfolioEditorUser } from '@/lib/menu-permissions';
import { fetchClassesForQC } from '@/lib/portfolio/service';
import {
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
  applyRefreshedCookies,
} from '@/lib/lms-token-helper';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/portfolio-qc/classes
 *
 * Fetch classes for Portfolio QC management.
 * Only accessible by configured Portfolio role codes.
 * Centres are filtered based on the user's assignedCenters.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioEditorUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản này chỉ có quyền xem portfolio, không có quyền quản lý nộp SPCK.' },
        { status: 403 },
      );
    }

    const rl = await rateLimitOr429Async(
      `portfolio-qc:${clientIpFromRequest(req)}`,
      60,
      60_000,
    );
    if (rl) return rl;



    const params = req.nextUrl.searchParams;

    // Get user's accessible centres
    const accessibleCenters = await getAccessibleCenters(auth.sessionEmail);

    // Parse filter params
    const centreNamesParam = params.get('centres');
    const selectedCentreNames = centreNamesParam
      ? centreNamesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // If user selected specific centres, validate they have access
    let centreNamesToFilter: string[] = [];
    if (selectedCentreNames.length > 0) {
      const accessibleNames = new Set(accessibleCenters.map((c) => c.full_name));
      centreNamesToFilter = selectedCentreNames.filter(
        (name) => accessibleNames.size === 0 || accessibleNames.has(name),
      );
      if (centreNamesToFilter.length === 0) {
        centreNamesToFilter = selectedCentreNames;
      }
    }

    const filter = {
      centreNames: centreNamesToFilter,
      courses: params.get('courses')?.split(',').filter(Boolean) || undefined,
      courseLines: params.get('courseLines')?.split(',').filter(Boolean) || undefined,
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
      qcStatus: params.get('qcStatus') || undefined,
      status: params.get('status') || undefined,
      teacherId: params.get('teacherId') || undefined,
      search: params.get('search') || undefined,
      pageIndex: parseInt(params.get('pageIndex') || '0', 10),
      itemsPerPage: parseInt(params.get('itemsPerPage') || '50', 10),
    };

    // Auto-refresh LMS token if missing or expired
    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;

    let result;
    try {
      result = await fetchClassesForQC(filter, lmsAuthHeader);
    } catch (err: any) {
      if (
        err?.message?.includes('Authentication token is missing') ||
        err?.message?.includes('jwt expired') ||
        err?.message?.includes('401')
      ) {
        tokenSession = await loginFallbackLmsAccount();
        if (tokenSession.token) {
          lmsAuthHeader = `Bearer ${tokenSession.token}`;
          result = await fetchClassesForQC(filter, lmsAuthHeader);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Post-filter by centre names ONLY if user explicitly selected specific centres
    if (selectedCentreNames.length > 0 && centreNamesToFilter.length > 0) {
      const nameSet = new Set(centreNamesToFilter);
      result.data = result.data.filter((cls) => nameSet.has(cls.centreName));
    }

    const response = NextResponse.json({
      success: true,
      ...result,
      accessibleCenters: accessibleCenters.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        short_code: c.short_code,
      })),
    });

    applyRefreshedCookies(response, tokenSession);
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[portfolio-qc/classes] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
