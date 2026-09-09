import { requireBearerSession } from '@/lib/datasource-api-auth';
import { isPortfolioEditorUser } from '@/lib/menu-permissions';
import { getClassStudentDetails } from '@/lib/portfolio/service';
import {
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
  applyRefreshedCookies,
} from '@/lib/lms-token-helper';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/portfolio-qc/classes/[classId]/students
 *
 * Get detailed student list for a specific class, including submission
 * status (sessions 13/14) and portfolio status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
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
      `portfolio-qc-students:${clientIpFromRequest(req)}`,
      60,
      60_000,
    );
    if (rl) return rl;



    const { classId } = await params;
    if (!classId) {
      return NextResponse.json(
        { success: false, error: 'classId is required' },
        { status: 400 },
      );
    }

    const className = req.nextUrl.searchParams.get('className') || undefined;

    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;

    let result;
    try {
      result = await getClassStudentDetails(classId, className, lmsAuthHeader);
    } catch (err: any) {
      if (
        err?.message?.includes('Authentication token is missing') ||
        err?.message?.includes('jwt expired') ||
        err?.message?.includes('401')
      ) {
        tokenSession = await loginFallbackLmsAccount();
        if (tokenSession.token) {
          lmsAuthHeader = `Bearer ${tokenSession.token}`;
          result = await getClassStudentDetails(classId, className, lmsAuthHeader);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const response = NextResponse.json({
      success: true,
      ...result,
    });

    applyRefreshedCookies(response, tokenSession);
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[portfolio-qc/students] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
