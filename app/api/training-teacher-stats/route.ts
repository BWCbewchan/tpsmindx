import { withApiProtection } from '@/lib/api-protection';
import { requireDatasourceBearer } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type AccessibleCenter = {
  id: number;
  full_name: string;
  short_code: string | null;
};

function normalizeCenterToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function collectCenterTokens(centers: AccessibleCenter[]): string[] {
  return Array.from(
    new Set(
      centers
        .flatMap((center) => [center.full_name, center.short_code ?? ''])
        .map(normalizeCenterToken)
        .filter(Boolean),
    ),
  );
}

// GET: Lấy thống kê giáo viên - kết hợp từ table teachers và training stats
export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireDatasourceBearer(request);
    if (!auth.ok) return auth.response;

    const tableCheck = await pool.query(`SELECT to_regclass('public.teachers') AS teachers_table`);
    if (!tableCheck.rows[0]?.teachers_table) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        warning: 'teachers table not found',
      });
    }

    const { searchParams } = new URL(request.url);
    const teacher_code = searchParams.get('teacher_code');
    const center = searchParams.get('center');

    const allowedCenters = auth.privileged
      ? []
      : collectCenterTokens(auth.accessibleCenters);
    const requestedCenters = center ? collectCenterTokens([{ id: 0, full_name: center, short_code: null }]) : [];
    const effectiveCenters = auth.privileged
      ? requestedCenters
      : requestedCenters.length > 0
        ? requestedCenters.filter((value) => allowedCenters.includes(value))
        : allowedCenters;

    if (!auth.privileged && effectiveCenters.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    // Query kết hợp teachers table với training_teacher_stats
    let query = `
      SELECT 
        t.code as teacher_code,
        t.full_name,
        t.user_name as username,
        t.work_email,
        COALESCE(t.main_centre, t.centers) as center,
        COALESCE(t.status, t.status_check, t.status_update, 'Active') as teacher_status,
        COALESCE(tts.total_score, 0) as total_score,
        COALESCE(tts.total_videos_assigned, 0) as total_videos_assigned,
        COALESCE(tts.videos_completed, 0) as videos_completed,
        COALESCE(tts.avg_video_score, 0) as avg_video_score,
        COALESCE(tts.total_assignments_taken, 0) as total_assignments_taken,
        COALESCE(tts.assignments_passed, 0) as assignments_passed,
        COALESCE(tts.avg_assignment_score, 0) as avg_assignment_score
      FROM teachers t
      LEFT JOIN training_teacher_stats tts ON t.code = tts.teacher_code
      WHERE COALESCE(t.status, t.status_check, t.status_update, 'Active') = 'Active'
    `;
    
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!auth.privileged) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM unnest(
            string_to_array(
              regexp_replace(COALESCE(t.main_centre, t."Main centre", t.centers, tts.center, ''), '[\\n;|]+', ',', 'g'),
              ','
            )
          ) AS teacher_center
          WHERE LOWER(TRIM(teacher_center)) = ANY($${params.length + 1}::text[])
        )`,
      );
      params.push(effectiveCenters);
    }

    if (teacher_code) {
      conditions.push(`t.code = $${params.length + 1}`);
      params.push(teacher_code);
    }
    if (center) {
      conditions.push(`COALESCE(t.main_centre, t.centers) ILIKE $${params.length + 1}`);
      params.push(`%${center}%`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY tts.total_score DESC NULLS LAST, t.full_name ASC';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching teacher stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});
