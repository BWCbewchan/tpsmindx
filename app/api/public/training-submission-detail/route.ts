import {
  rejectIfDatasourceLookupForbidden,
  requireBearerOrSessionCookie,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerOrSessionCookie(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID bài làm' }, { status: 400 });
    }

    // 1. Get submission details
    const submissionResult = await pool.query(
      `SELECT 
         tas.id, tas.teacher_code, tas.score, tas.total_points, tas.percentage, tas.status, tas.submitted_at, tas.attempt_number,
         tva.assignment_title, tva.assignment_type,
         tts.full_name as teacher_name, tts.center
       FROM training_assignment_submissions tas
       JOIN training_video_assignments tva ON tas.assignment_id = tva.id
       LEFT JOIN training_teacher_stats tts ON tas.teacher_code = tts.teacher_code
       WHERE tas.id = $1`,
      [id]
    );

    if (submissionResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy bài làm' }, { status: 404 });
    }

    const submission = submissionResult.rows[0];
    const forbidden = await rejectIfDatasourceLookupForbidden(
      auth.sessionEmail,
      auth.privileged,
      '',
      String(submission.teacher_code || ''),
    );
    if (forbidden) return forbidden;

    // 2. Get answers
    const answersResult = await pool.query(
      `SELECT 
         taq.id as question_id,
         taq.question_text, 
         taq.question_type, 
         taq.image_url, 
         taq.points as max_points,
         taa.answer_text, 
         taa.is_correct, 
         taa.points_earned,
         taq.correct_answer,
         taq.options,
         taq.explanation
       FROM training_assignment_answers taa
       JOIN training_assignment_questions taq ON taa.question_id = taq.id
       WHERE taa.submission_id = $1
       ORDER BY taq.order_number ASC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      submission: {
        ...submission,
        score: submission.score != null ? parseFloat(submission.score) : null,
        total_points: parseFloat(submission.total_points),
        percentage: submission.percentage != null ? parseFloat(submission.percentage) : null
      },
      answers: answersResult.rows.map(row => ({
        ...row,
        max_points: parseFloat(row.max_points),
        points_earned: parseFloat(row.points_earned),
        // No need to hide correct answer since this is a "Proof" view
      }))
    });

  } catch (error) {
    console.error('[Public Submission Detail API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
