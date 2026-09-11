import { requireBearerSession } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { getOrRefreshLmsToken, loginFallbackLmsAccount } from '@/lib/lms-token-helper';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

const STUDENT_STUDY_CLASSES_QUERY = /* graphql */ `
  query studentStudyClasses($pageIndex: Int!, $itemsPerPage: Int!, $studentId: String!) {
    studentStudyClasses(payload: { pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, studentId: $studentId }) {
      data {
        id
        name
        startDate
        endDate
        status
        course {
          id
          name
          shortName
          courseLine {
            id
            name
          }
        }
        centre {
          id
          name
        }
      }
      pagination {
        total
      }
    }
  }
`;

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function mapStatus(status?: string | null): string {
  if (!status) return 'Đang diễn ra';
  const upper = status.toUpperCase();
  if (upper === 'FINISHED') return 'Đã hoàn thành';
  return 'Đang diễn ra';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioAllowedUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ tài khoản TEGL, TEGL+, TM, CL, RL, AL, LEAD, TE, TC hoặc super_admin mới có quyền truy cập.' },
        { status: 403 },
      );
    }

    const rl = await rateLimitOr429Async(
      `student-study-classes:${clientIpFromRequest(req)}`,
      60,
      60_000,
    );
    if (rl) return rl;

    const { studentId } = await params;
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'studentId is required' },
        { status: 400 },
      );
    }

    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;

    let resData;
    try {
      resData = await callLmsApi<{
        data: {
          studentStudyClasses: {
            data: Array<{
              id: string;
              name: string;
              startDate?: string;
              endDate?: string;
              status?: string;
              course?: {
                id?: string;
                name?: string;
                shortName?: string;
                courseLine?: { id?: string; name?: string };
              };
              centre?: { id?: string; name?: string };
            }>;
            pagination: { total: number };
          };
        };
      }>(
        {
          query: STUDENT_STUDY_CLASSES_QUERY,
          operationName: 'studentStudyClasses',
          variables: {
            pageIndex: 0,
            itemsPerPage: 50,
            studentId,
          },
        },
        lmsAuthHeader,
      );
    } catch (err: any) {
      if (
        err?.message?.includes('Authentication token is missing') ||
        err?.message?.includes('jwt expired') ||
        err?.message?.includes('401')
      ) {
        tokenSession = await loginFallbackLmsAccount();
        if (tokenSession.token) {
          lmsAuthHeader = `Bearer ${tokenSession.token}`;
          resData = await callLmsApi<any>(
            {
              query: STUDENT_STUDY_CLASSES_QUERY,
              operationName: 'studentStudyClasses',
              variables: {
                pageIndex: 0,
                itemsPerPage: 50,
                studentId,
              },
            },
            lmsAuthHeader,
          );
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const rawClasses = resData.data?.studentStudyClasses?.data || [];
    
    // Sort chronologically by startDate
    const sorted = [...rawClasses].sort((a, b) => {
      const tA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const tB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return tA - tB;
    });

    const journey = sorted.map((c) => {
      const start = formatDate(c.startDate);
      const end = formatDate(c.endDate);
      const period = start && end ? `${start} - ${end}` : start || end || '';
      return {
        title: c.course?.name || c.name,
        code: c.name,
        status: mapStatus(c.status),
        period,
        description: `Cơ sở: ${c.centre?.name || 'MindX'} | Mã khóa: ${c.course?.shortName || ''}`,
      };
    });

    return NextResponse.json({
      success: true,
      data: journey,
      rawClasses,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[student-study-classes] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
