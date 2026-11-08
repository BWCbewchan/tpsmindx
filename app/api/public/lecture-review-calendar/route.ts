import pool from '@/lib/db'
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function parseMonth(value: string | null): { month: string; nextMonth: string } | null {
  const input = String(value || '').trim()
  const match = /^(\d{4})-(\d{2})$/.exec(input)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (year < 2020 || year > 2100 || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  const next = new Date(Date.UTC(year, monthIndex + 1, 1))
  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    nextMonth: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`,
  }
}

export async function GET(request: NextRequest) {
  const limited = await rateLimitOr429Async(
    `public-lecture-review-calendar:${clientIpFromRequest(request)}`,
    120,
    60_000,
  )
  if (limited) return limited

  const parsedMonth = parseMonth(request.nextUrl.searchParams.get('month'))
  if (!parsedMonth) {
    return NextResponse.json(
      { success: false, error: 'Tháng cần có định dạng YYYY-MM' },
      { status: 400 },
    )
  }

  try {
    const result = await pool.query(
      `SELECT
         review_date::text AS review_date,
         candidate_name,
         manager_leader_name,
         center_name,
         reviewer_name,
         teaching_block
       FROM lecture_review_applications
       WHERE review_date >= $1::date
         AND review_date < $2::date
       ORDER BY review_date ASC, candidate_name ASC, id ASC`,
      [`${parsedMonth.month}-01`, `${parsedMonth.nextMonth}-01`],
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          month: parsedMonth.month,
          rows: result.rows,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    console.error('[public/lecture-review-calendar][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải lịch đăng ký duyệt giảng' },
      { status: 500 },
    )
  }
}
