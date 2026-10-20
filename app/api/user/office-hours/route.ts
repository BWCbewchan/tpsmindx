import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie';
import { resolveAppUserAccessForEmail } from '@/lib/app-user-access';
import { getOrRefreshLmsToken, applyRefreshedCookies, LmsTokenSession } from '@/lib/lms-token-helper';
import { NextRequest, NextResponse } from 'next/server';
import { callLmsApi } from '@/lib/lms-api';

const GET_OFFICE_HOURS_QUERY = /* graphql */ `
  query GetOfficeHours($payload: OfficeHourQuery) {
    officeHours(payload: $payload) {
      data {
        id
        courses {
          id
          name
          shortName
        }
        courseLines {
          id
          name
        }
        courseTopics {
          id
          name
        }
        startTime
        endTime
        status
        centre {
          id
          name
          shortName
        }
        teacher {
          id
          username
          code
          fullName
          email
        }
        class {
          id
          name
          sessions {
            id
            startTime
            endTime
          }
          students
        }
        classSiteId
        note
        managerNote
        type
        studentCount
        appointments {
          id
          title
          candidate {
            id
            fullName
          }
          courses {
            id
            name
            shortName
          }
          status
          note
        }
        createdBy {
          username
        }
        createdAt
        lastModifiedAt
      }
      pagination {
        type
        total
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(TPS_SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const session = await verifySessionCookieValue(sessionCookie);
  if (!session?.email) {
    return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 });
  }

  const access = await resolveAppUserAccessForEmail(session.email);
  const isSuperAdmin = access.role === 'super_admin';

  let tokenSession: LmsTokenSession | null = null;
  let firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';

  if (isSuperAdmin) {
    tokenSession = await getOrRefreshLmsToken(request);
    firebaseToken = tokenSession.token || firebaseToken;
  } else if (!firebaseToken) {
    tokenSession = await getOrRefreshLmsToken(request);
    if (!tokenSession.isFallback && tokenSession.token) {
      firebaseToken = tokenSession.token;
    }
  }

  if (!firebaseToken) {
    return NextResponse.json({
      success: false,
      noLmsToken: true,
      officeHours: [],
      message: 'Tài khoản này không có kết nối LMS.'
    });
  }

  try {
    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    const centresParam = searchParams.get('centres');

    if (!username) {
      return NextResponse.json({
        success: false,
        officeHours: [],
        message: 'Thiếu username.'
      }, { status: 400 });
    }

    if (!dateFromParam || !dateToParam) {
      return NextResponse.json({
        success: false,
        officeHours: [],
        message: 'Thiếu thông tin thời gian.'
      }, { status: 400 });
    }

    const authHeader = `Bearer ${firebaseToken}`;

    // Convert dates to ISO format for LMS API
    const timeFrom = new Date(dateFromParam + 'T00:00:00.000Z').toISOString();
    const timeTo = new Date(dateToParam + 'T23:59:59.999Z').toISOString();

    const centreShortNames = centresParam ? centresParam.split(',') : [];

    const allFilteredOfficeHours: any[] = [];
    let page = 0;
    const itemsPerPage = 100;
    const maxPages = 20; // Limit to prevent timeout

    while (page < maxPages) {
      const payload = {
        pageIndex: page,
        itemsPerPage: itemsPerPage,
        orderBy: "startTime_desc",
        timeFrom: timeFrom,
        timeTo: timeTo, // Add timeTo filter
      };

      try {
        const result = await callLmsApi<any>({
          query: GET_OFFICE_HOURS_QUERY,
          variables: { payload },
          operationName: "GetOfficeHours",
        }, authHeader);

        const officeHoursData = result.data?.officeHours?.data || [];
        const total = result.data?.officeHours?.pagination?.total || 0;

        if (officeHoursData.length === 0) {
          break;
        }

        // Filter by teacher username for this page
        const filtered = officeHoursData.filter((oh: any) => {
          const teacherUsername = oh.teacher?.username?.toLowerCase();
          const teacherCode = oh.teacher?.code?.toLowerCase();
          const matchesTeacher = teacherUsername === username.toLowerCase() || teacherCode === username.toLowerCase();

          // If centre filters specified, also check centre
          if (matchesTeacher && centreShortNames.length > 0) {
            const ohCentreShortName = oh.centre?.shortName;
            return centreShortNames.includes(ohCentreShortName);
          }

          return matchesTeacher;
        });

        if (filtered.length > 0) {
          allFilteredOfficeHours.push(...filtered);
        }

        // Check if we've reached the end
        if (officeHoursData.length < itemsPerPage) {
          break;
        }

        page++;

      } catch (fetchError: any) {
        console.error(`[office-hours] Error fetching page ${page}:`, fetchError.message);

        // If it's the first page and we get an error, return error response
        if (page === 0) {
          return NextResponse.json({
            success: false,
            officeHours: [],
            message: 'Lỗi khi lấy dữ liệu Office Hours từ LMS.',
            error: fetchError.message
          });
        }

        // If we already have some data, break and return what we have
        break;
      }
    }

    const response = NextResponse.json({ success: true, officeHours: allFilteredOfficeHours });
    if (tokenSession) {
      applyRefreshedCookies(response, tokenSession);
    }
    return response;

  } catch (error: any) {
    console.error('[office-hours] Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      officeHours: [],
      message: 'Không thể kết nối đến LMS API.',
      error: error?.message
    }, { status: 500 });
  }
}
