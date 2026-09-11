import { requireBearerSession } from '@/lib/datasource-api-auth';
import { isPortfolioEditorUser } from '@/lib/menu-permissions';
import {
  buildPortfolioDataFromLms,
  getPortfolioByStudentClass,
  mergePortfolioWithLmsData,
  upsertPortfolio,
} from '@/lib/student-portfolio/service';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';
import {
  applyRefreshedCookies,
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
} from '@/lib/lms-token-helper';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioEditorUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản này chỉ có quyền xem portfolio, không có quyền lưu chỉnh sửa.' },
        { status: 403 },
      );
    }

    const studentId = req.nextUrl.searchParams.get('studentId') || '';
    const classId = req.nextUrl.searchParams.get('classId') || '';
    const lmsInput = {
      studentId,
      classId,
      studentName: req.nextUrl.searchParams.get('studentName') || undefined,
      className: req.nextUrl.searchParams.get('className') || undefined,
      centreName: req.nextUrl.searchParams.get('centreName') || undefined,
      courseName: req.nextUrl.searchParams.get('courseName') || undefined,
      courseLine: req.nextUrl.searchParams.get('courseLine') || undefined,
      teacherName: req.nextUrl.searchParams.get('teacherName') || undefined,
    };

    if (!studentId || !classId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu studentId hoặc classId' },
        { status: 400 },
      );
    }

    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;
    let seedData: StudentPortfolioData | null = null;
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

    const portfolio = await getPortfolioByStudentClass(studentId, classId);
    const response = NextResponse.json({
      success: true,
      portfolio: portfolio && seedData
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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioEditorUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản này chỉ có quyền xem portfolio, không có quyền lưu chỉnh sửa.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const studentId = String(body.studentId || '').trim();
    const classId = String(body.classId || '').trim();
    const studentName = String(body.studentName || '').trim();

    if (!studentId || !classId || !studentName) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin học viên hoặc lớp' },
        { status: 400 },
      );
    }

    const portfolio = await upsertPortfolio({
      studentId,
      classId,
      studentName,
      className: body.className,
      centreName: body.centreName,
      courseName: body.courseName,
      courseLine: body.courseLine,
      status: body.status === 'published' ? 'published' : 'draft',
      data: body.data as StudentPortfolioData | undefined,
      createdBy: auth.sessionEmail,
    });

    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lưu portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
