import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function normalizeReviewerName(value: unknown): string {
  return String(value || '').trim();
}

function normalizeMeetingUrl(value: unknown): string | null {
  const url = String(value || '').trim();
  return url ? url : null;
}

function normalizeStatus(value: unknown): 'active' | 'inactive' {
  const status = String(value || 'active').trim().toLowerCase();
  return status === 'inactive' ? 'inactive' : 'active';
}

function isMissingReviewerMeetingsTable(error: any) {
  return error?.code === '42P01' || String(error?.message || '').includes('lecture_reviewer_meetings');
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const reviewerName = normalizeReviewerName(request.nextUrl.searchParams.get('reviewer_name'));

    let query = `
      SELECT
        id,
        reviewer_name,
        meeting_url,
        status,
        created_at,
        updated_at
      FROM lecture_reviewer_meetings
    `;
    const values: any[] = [];

    if (reviewerName) {
      values.push(reviewerName.toLowerCase());
      query += ` WHERE LOWER(TRIM(reviewer_name)) = $1`;
    }

    query += ' ORDER BY reviewer_name ASC';

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: reviewerName ? result.rows[0] || null : result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    if (isMissingReviewerMeetingsTable(error)) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    console.error('[lecture-reviewer-meetings][GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch reviewer meeting links' },
      { status: 500 },
    );
  }
});

async function upsertReviewerMeeting(request: NextRequest) {
  try {
    const body = await request.json();
    const reviewerName = normalizeReviewerName(body.reviewer_name ?? body.reviewerName);
    const meetingUrl = normalizeMeetingUrl(body.meeting_url ?? body.meetingUrl);
    const status = normalizeStatus(body.status);

    if (!reviewerName) {
      return NextResponse.json(
        { success: false, error: 'reviewer_name là bắt buộc' },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `
        INSERT INTO lecture_reviewer_meetings (
          reviewer_name,
          meeting_url,
          status
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (reviewer_name)
        DO UPDATE SET
          meeting_url = EXCLUDED.meeting_url,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, reviewer_name, meeting_url, status, created_at, updated_at
      `,
      [reviewerName, meetingUrl, status],
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Đã lưu meeting link cho reviewer',
    });
  } catch (error: any) {
    if (isMissingReviewerMeetingsTable(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bảng lecture_reviewer_meetings chưa được tạo. Vui lòng chạy migration mới nhất.',
        },
        { status: 503 },
      );
    }
    console.error('[lecture-reviewer-meetings][UPSERT] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save reviewer meeting link' },
      { status: 500 },
    );
  }
}

export const POST = withApiProtection(upsertReviewerMeeting);
export const PUT = withApiProtection(upsertReviewerMeeting);
