import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const MIN_Q = 2
const MAX_Q = 80
const LIMIT = 20

/**
 * Gợi ý work_email / tên GV từ bảng teachers (đăng nhập).
 * GET ?q= — khớp chuỗi con (không dùng LIKE wildcard từ input).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const raw = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (raw.length < MIN_Q) {
      return NextResponse.json({
        success: true,
        data: { items: [] as { code: string; full_name: string; work_email: string }[] },
      })
    }
    const q = raw.slice(0, MAX_Q).toLowerCase()

    const result = await pool.query<{
      code: string
      full_name: string
      work_email: string
    }>(
      `
      SELECT
        t.code,
        COALESCE(NULLIF(TRIM(t.full_name), ''), NULLIF(TRIM(t."Full name"), ''), '') AS full_name,
        COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''), '') AS work_email
      FROM teachers t
      WHERE COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''), '') <> ''
        AND (
          position($1::text IN lower(COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''), ''))) > 0
          OR position($1::text IN lower(COALESCE(NULLIF(TRIM(t.full_name), ''), NULLIF(TRIM(t."Full name"), ''), ''))) > 0
        )
      ORDER BY
        CASE
          WHEN lower(COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''), '')) LIKE $1 || '%'
          THEN 0 ELSE 1
        END,
        lower(COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''), ''))
      LIMIT $2
      `,
      [q, LIMIT],
    )

    return NextResponse.json({
      success: true,
      data: { items: result.rows },
    })
  } catch (e) {
    console.error('work-email-suggest:', e)
    return NextResponse.json(
      { success: false, error: 'Không thể tải gợi ý email' },
      { status: 500 },
    )
  }
}
