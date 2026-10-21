import { NextRequest, NextResponse } from 'next/server';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { isAppAdminByEmail } from '@/lib/is-app-admin';
import { callLmsApi } from '@/lib/lms-api';
import { loginFallbackLmsAccount } from '@/lib/lms-token-helper';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const LMS_PAGE_SIZE = 100; // Giới hạn tối đa của LMS là 100

const GET_COURSES_PAGE_QUERY = /* graphql */ `
  query GetCoursesPage($pageIndex: Int!) {
    courses(payload: { itemsPerPage: 100, pageIndex: $pageIndex }) {
      pagination { total }
      data {
        id
        name
        shortName
        code
        courseLine { id name }
      }
    }
  }
`;

// In-memory cache danh sách courses từ LMS trong 10 phút
let cachedLmsCourses: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchAllLmsCourses(lmsToken?: string): Promise<any[]> {
  const now = Date.now();
  if (cachedLmsCourses && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedLmsCourses;
  }

  const authHeader = lmsToken ? `Bearer ${lmsToken}` : undefined;

  // 1. Fetch trang đầu tiên (pageIndex: 0)
  const page0Res = await callLmsApi<any>(
    { query: GET_COURSES_PAGE_QUERY, variables: { pageIndex: 0 } },
    authHeader,
  );

  const pagination = page0Res?.data?.courses?.pagination;
  const total = Number(pagination?.total) || 0;
  const page0Data = page0Res?.data?.courses?.data || [];

  if (total <= LMS_PAGE_SIZE) {
    cachedLmsCourses = page0Data;
    lastCacheTime = now;
    return page0Data;
  }

  // 2. Fetch các trang còn lại song song (pageIndex 1, 2, 3...)
  const totalPages = Math.ceil(total / LMS_PAGE_SIZE);
  const restPromises: Promise<any>[] = [];

  for (let p = 1; p < totalPages; p++) {
    restPromises.push(
      callLmsApi<any>(
        { query: GET_COURSES_PAGE_QUERY, variables: { pageIndex: p } },
        authHeader,
      ).catch((err) => {
        console.error(`[grading-criteria/courses] Failed page ${p}:`, err);
        return null;
      }),
    );
  }

  const restResults = await Promise.all(restPromises);
  const combined = [
    ...page0Data,
    ...restResults.flatMap((r) => r?.data?.courses?.data || []),
  ];

  // Lọc unique theo id
  const uniqueMap = new Map<string, any>();
  combined.forEach((c) => {
    if (c?.id) uniqueMap.set(String(c.id), c);
  });

  cachedLmsCourses = Array.from(uniqueMap.values());
  lastCacheTime = now;
  return cachedLmsCourses;
}

export async function GET(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }
    const email = authSession.sessionEmail;

    // Phân quyền: Super Admin / Admin
    const isAdmin = await isAppAdminByEmail(email);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập. Chức năng chỉ dành cho Super Admin.' }, { status: 403 });
    }

    // 1. Lấy token LMS (từ cookie hoặc fallback)
    let lmsToken = request.cookies.get('lms_token')?.value || request.cookies.get('lms_id_token')?.value || '';
    if (!lmsToken) {
      const fallback = await loginFallbackLmsAccount();
      lmsToken = fallback?.token || '';
    }

    // 2. Fetch danh sách tất cả các khóa học từ LMS (hỗ trợ phân trang 0-indexed và in-memory cache)
    let coursesData: any[] = [];
    try {
      coursesData = await fetchAllLmsCourses(lmsToken);
    } catch (e: any) {
      console.error('[grading-criteria/courses] Failed to fetch courses from LMS:', e);
    }

    // 3. Truy vấn database để đếm số tiêu chí đã lưu theo course_id
    const criteriaStatsRes = await pool.query(`
      SELECT 
        course_id, 
        COUNT(id)::int AS criteria_count, 
        SUM(max_score)::numeric AS total_max_score,
        COUNT(DISTINCT group_name)::int AS group_count,
        MAX(updated_at) AS last_updated_at
      FROM course_grading_criteria
      GROUP BY course_id
    `);

    const criteriaStatsMap = new Map<string, any>();
    criteriaStatsRes.rows.forEach((row: any) => {
      criteriaStatsMap.set(String(row.course_id), {
        criteriaCount: Number(row.criteria_count) || 0,
        totalMaxScore: Number(row.total_max_score) || 0,
        groupCount: Number(row.group_count) || 0,
        lastUpdatedAt: row.last_updated_at,
      });
    });

    // 4. Kết hợp dữ liệu khóa học LMS với thống kê tiêu chí trong DB
    const courses = coursesData.map((c: any) => {
      const courseId = String(c.id);
      const stats = criteriaStatsMap.get(courseId);
      return {
        id: courseId,
        name: c.name || '',
        shortName: c.shortName || '',
        code: c.code || '',
        courseLineName: c.courseLine?.name || '',
        criteriaCount: stats?.criteriaCount || 0,
        groupCount: stats?.groupCount || 0,
        totalMaxScore: stats?.totalMaxScore || 0,
        lastUpdatedAt: stats?.lastUpdatedAt || null,
        hasCriteria: Boolean(stats && stats.criteriaCount > 0),
      };
    });

    // Sắp xếp: Các khóa đã có tiêu chí lên đầu, sau đó sắp theo tên A-Z
    courses.sort((a: any, b: any) => {
      if (a.hasCriteria && !b.hasCriteria) return -1;
      if (!a.hasCriteria && b.hasCriteria) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });

    return NextResponse.json({
      success: true,
      total: courses.length,
      hasCriteriaCount: courses.filter((c: any) => c.hasCriteria).length,
      data: courses,
    });
  } catch (error: any) {
    console.error('[grading-criteria/courses] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi tải danh sách khóa học' }, { status: 500 });
  }
}
