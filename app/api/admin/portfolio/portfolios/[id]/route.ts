import { requireBearerSession } from '@/lib/datasource-api-auth';
import { isPortfolioEditorUser } from '@/lib/menu-permissions';
import {
  buildPortfolioDataFromLms,
  getPortfolioById,
  mergePortfolioWithLmsData,
  updatePortfolioById,
} from '@/lib/student-portfolio/service';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';
import {
  applyRefreshedCookies,
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
} from '@/lib/lms-token-helper';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioEditorUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản này chỉ có quyền xem portfolio, không có quyền lưu chỉnh sửa.' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const portfolio = await getPortfolioById(id);
    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy portfolio' },
        { status: 404 },
      );
    }

    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;
    let seedData: StudentPortfolioData | null = null;
    const lmsInput = {
      studentId: portfolio.student_lms_id,
      classId: portfolio.class_lms_id,
      studentName: portfolio.student_name,
      className: portfolio.class_name || undefined,
      centreName: portfolio.centre_name || undefined,
      courseName: portfolio.course_name || undefined,
      courseLine: portfolio.data?.profile?.courseLine || undefined,
      teacherName: portfolio.data?.profile?.teacherName || undefined,
    };
    try {
      seedData = await buildPortfolioDataFromLms(lmsInput, lmsAuthHeader);
    } catch (err: any) {
      if (
        err?.message?.includes('Authentication token is missing') ||
        err?.message?.includes('jwt expired') ||
        err?.message?.includes('401')
      ) {
        tokenSession = await loginFallbackLmsAccount();
        lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;
        seedData = await buildPortfolioDataFromLms(lmsInput, lmsAuthHeader).catch(() => null);
      } else {
        seedData = null;
      }
    }

    const response = NextResponse.json({
      success: true,
      portfolio: seedData
        ? { ...portfolio, data: mergePortfolioWithLmsData(portfolio.data, seedData) }
        : portfolio,
      seedData,
    });
    applyRefreshedCookies(response, tokenSession);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioEditorUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản này chỉ có quyền xem portfolio, không có quyền lưu chỉnh sửa.' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const data = body.data as StudentPortfolioData;
    const status = body.status === 'published' ? 'published' : 'draft';

    if (!data?.profile?.studentName) {
      return NextResponse.json(
        { success: false, error: 'Thiếu dữ liệu portfolio' },
        { status: 400 },
      );
    }

    const portfolio = await updatePortfolioById(id, data, status);
    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy portfolio' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lưu portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
