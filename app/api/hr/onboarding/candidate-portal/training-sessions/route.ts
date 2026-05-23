import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const candidateId = Number(request.nextUrl.searchParams.get('candidate_id'));

  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    return NextResponse.json(
      { success: false, error: 'candidate_id không hợp lệ.' },
      { status: 400 }
    );
  }

  try {
    const candidateResult = await pool.query(
      `SELECT c.id,
              COALESCE(c.current_gen_id, c.gen_id) AS current_gen_id,
              g.gen_name AS current_gen_name,
              c.region_code,
              c.region_name
       FROM hr_candidates c
       LEFT JOIN hr_gen_catalog g ON g.id = COALESCE(c.current_gen_id, c.gen_id)
       WHERE c.id = $1 AND c.is_deleted = false`,
      [candidateId]
    );

    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy ứng viên.' },
        { status: 404 }
      );
    }

    const candidate = candidateResult.rows[0];

    if (!candidate.current_gen_id) {
      return NextResponse.json({
        success: true,
        data: {
          currentGen: null,
          sessions: [],
        },
      });
    }

    const sessionsResult = await pool.query(
      `SELECT s.id,
              s.gen_id,
              s.session_number,
              s.title,
              s.session_date,
              tv.title AS video_title
       FROM hr_training_sessions s
       LEFT JOIN training_videos tv ON tv.id = s.video_id
       WHERE s.gen_id = $1
       ORDER BY s.session_date ASC NULLS LAST, s.session_number ASC`,
      [candidate.current_gen_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        currentGen: {
          id: candidate.current_gen_id,
          genCode: candidate.current_gen_name || String(candidate.current_gen_id),
          regionCode: candidate.region_code || '',
          regionName: candidate.region_name || '',
        },
        sessions: sessionsResult.rows.map((row: any) => ({
          gen: candidate.current_gen_name || String(candidate.current_gen_id),
          region: candidate.region_name || candidate.region_code || '',
          session: Number(row.session_number),
          date: row.session_date,
          time: '',
          location: row.video_title || '',
          title: row.title,
        })),
      },
    });
  } catch (error) {
    console.error('[Candidate Portal Training Sessions] error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải lịch training.' },
      { status: 500 }
    );
  }
}
