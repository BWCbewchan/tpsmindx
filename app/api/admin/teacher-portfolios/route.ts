import { NextRequest, NextResponse } from 'next/server'

import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { HC_TEACHER_PORTFOLIO_PATH } from '@/lib/hc-operations-access'
import { checkHrefPermission } from '@/lib/menu-permissions'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  if (!checkHrefPermission(HC_TEACHER_PORTFOLIO_PATH, auth.resolvedAccess)) {
    return NextResponse.json(
      { success: false, error: 'Bạn không có quyền xem Portfolio giáo viên.' },
      { status: 403 },
    )
  }

  if (global.migrationInitPromise) {
    await global.migrationInitPromise.catch(() => undefined)
  }

  const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1)
  const limit = Math.min(
    positiveInteger(request.nextUrl.searchParams.get('limit'), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  )
  const query = String(request.nextUrl.searchParams.get('q') || '')
    .trim()
    .slice(0, 120)
  const requestedStatus = String(
    request.nextUrl.searchParams.get('status') || '',
  ).trim()
  const status = ['published', 'revoked'].includes(requestedStatus)
    ? requestedStatus
    : ''
  const offset = (page - 1) * limit
  const search = query ? `%${query}%` : ''

  try {
    const [rowsResult, countResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT
           p.id,
           p.teacher_code,
           p.public_slug,
           p.status,
           p.created_at,
           p.updated_at,
           COALESCE(
             NULLIF(TRIM(t.full_name), ''),
             NULLIF(TRIM(t."Full name"), ''),
             p.teacher_code
           ) AS teacher_name,
           COALESCE(
             NULLIF(TRIM(t.main_centre), ''),
             NULLIF(TRIM(t."Main centre"), ''),
             NULLIF(TRIM(t.centers), '')
           ) AS center_name,
           COALESCE(
             NULLIF(TRIM(t.course_line), ''),
             NULLIF(TRIM(t."Course Line"), '')
           ) AS course_line
         FROM teacher_portfolios p
         JOIN teachers t ON t.code = p.teacher_code
         WHERE (
           $1::text = ''
           OR p.teacher_code ILIKE $1
           OR COALESCE(t.full_name, '') ILIKE $1
           OR COALESCE(t."Full name", '') ILIKE $1
           OR COALESCE(t.main_centre, '') ILIKE $1
           OR COALESCE(t."Main centre", '') ILIKE $1
           OR COALESCE(t.centers, '') ILIKE $1
         )
           AND ($2::text = '' OR p.status = $2)
         ORDER BY p.updated_at DESC, p.id DESC
         LIMIT $3 OFFSET $4`,
        [search, status, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM teacher_portfolios p
         JOIN teachers t ON t.code = p.teacher_code
         WHERE (
           $1::text = ''
           OR p.teacher_code ILIKE $1
           OR COALESCE(t.full_name, '') ILIKE $1
           OR COALESCE(t."Full name", '') ILIKE $1
           OR COALESCE(t.main_centre, '') ILIKE $1
           OR COALESCE(t."Main centre", '') ILIKE $1
           OR COALESCE(t.centers, '') ILIKE $1
         )
           AND ($2::text = '' OR p.status = $2)`,
        [search, status],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'published')::int AS published,
           COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked
         FROM teacher_portfolios`,
      ),
    ])

    const total = Number(countResult.rows[0]?.total || 0)
    const rows = rowsResult.rows.map((row) => ({
      id: String(row.id),
      teacherCode: String(row.teacher_code || ''),
      teacherName: String(row.teacher_name || row.teacher_code || ''),
      centerName: row.center_name ? String(row.center_name) : null,
      courseLine: row.course_line ? String(row.course_line) : null,
      status: row.status === 'revoked' ? 'revoked' : 'published',
      sharePath:
        row.status === 'published'
          ? `/public/teacher-portfolio/${encodeURIComponent(String(row.public_slug))}`
          : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          rows,
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          summary: {
            total: Number(summaryResult.rows[0]?.total || 0),
            published: Number(summaryResult.rows[0]?.published || 0),
            revoked: Number(summaryResult.rows[0]?.revoked || 0),
          },
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[admin/teacher-portfolios][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách Portfolio giáo viên.' },
      { status: 500 },
    )
  }
}
