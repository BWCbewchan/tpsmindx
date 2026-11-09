import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  LECTURE_REVIEW_LEGACY_LEADERS,
  LECTURE_REVIEW_MANAGER_ROLE_CODES,
  resolveLectureReviewAccess,
} from '@/lib/lecture-review-applications'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function cleanSearch(value: string | null): string {
  return String(value || '').trim().slice(0, 120)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const access = await resolveLectureReviewAccess(auth.sessionEmail)
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền sử dụng chức năng duyệt giảng' },
        { status: 403 },
      )
    }

    const candidateSearch = cleanSearch(
      request.nextUrl.searchParams.get('candidate'),
    )
    const [leadersResult, centersResult, candidatesResult] = await Promise.all([
      pool.query(
        `SELECT code, full_name, role_code, email
         FROM teaching_leaders
         WHERE UPPER(TRIM(COALESCE(role_code, ''))) = ANY($1::text[])
           AND UPPER(TRIM(COALESCE(status, ''))) <> 'DEACTIVE'
           AND NULLIF(TRIM(COALESCE(full_name, '')), '') IS NOT NULL
         ORDER BY
           ARRAY_POSITION($1::text[], UPPER(TRIM(role_code))),
           full_name ASC`,
        [LECTURE_REVIEW_MANAGER_ROLE_CODES],
      ),
      pool.query(
        `SELECT id, region, short_code, full_name, display_name, status
         FROM centers
         WHERE NULLIF(TRIM(COALESCE(full_name, '')), '') IS NOT NULL
           AND REGEXP_REPLACE(
             LOWER(CONCAT_WS(' ', full_name, display_name, short_code)),
             '\\s+',
             '',
             'g'
           ) NOT LIKE '%testmail%'
         ORDER BY region ASC NULLS LAST, full_name ASC`,
      ),
      candidateSearch
        ? pool.query(
            `SELECT
               code,
               COALESCE(
                 NULLIF(TRIM(full_name), ''),
                 NULLIF(TRIM("Full name"), ''),
                 code
               ) AS full_name,
               COALESCE(
                 NULLIF(TRIM(main_centre), ''),
                 NULLIF(TRIM("Main centre"), ''),
                 NULLIF(TRIM(centers), '')
               ) AS center_name,
               COALESCE(
                 NULLIF(TRIM(te_quan_ly), ''),
                 NULLIF(TRIM(leader_quan_ly), '')
               ) AS manager_name
             FROM teachers
             WHERE NULLIF(TRIM(COALESCE(code, '')), '') IS NOT NULL
               AND (
                 LOWER(TRIM(code)) LIKE '%' || LOWER($1) || '%'
                 OR LOWER(TRIM(COALESCE(full_name, "Full name", ''))) LIKE '%' || LOWER($1) || '%'
               )
             ORDER BY
               CASE WHEN LOWER(TRIM(code)) = LOWER($1) THEN 0 ELSE 1 END,
               CASE WHEN LOWER(TRIM(COALESCE(full_name, "Full name", ''))) = LOWER($1) THEN 0 ELSE 1 END,
               COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), ''), code)
             LIMIT 20`,
            [candidateSearch],
          )
        : Promise.resolve({ rows: [] }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        leaders: [...leadersResult.rows, ...LECTURE_REVIEW_LEGACY_LEADERS].sort(
          (a, b) =>
            String(a.full_name).localeCompare(String(b.full_name), 'vi'),
        ),
        centers: centersResult.rows,
        candidates: candidatesResult.rows,
      },
    })
  } catch (error) {
    console.error('[lecture-review-applications/options][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu đăng ký duyệt giảng' },
      { status: 500 },
    )
  }
}
