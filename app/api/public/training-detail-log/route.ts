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
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, error: 'Thiếu mã giáo viên' }, { status: 400 });
    }

    const forbidden = await rejectIfDatasourceLookupForbidden(
      auth.sessionEmail,
      auth.privileged,
      '',
      code,
    );
    if (forbidden) return forbidden;

    const teacherResult = await pool.query(
      `SELECT teacher_code, full_name, center, teaching_block, total_score, status, updated_at
       FROM training_teacher_stats
       WHERE teacher_code = $1`,
      [code]
    );

    if (teacherResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy giáo viên' }, { status: 404 });
    }

    const submissionsResult = await pool.query(
      `SELECT
         tas.id as submission_id,
         tas.teacher_code,
         tas.assignment_id,
         tas.attempt_number,
         tas.score,
         tas.total_points,
         tas.percentage,
         tas.status,
         tas.started_at,
         tas.submitted_at,
         tas.graded_at,
         tas.time_spent_seconds,
         tas.created_at,
         tas.updated_at,
         tva.video_id,
         tva.assignment_title,
         tv.title as video_title
       FROM training_assignment_submissions tas
       JOIN training_video_assignments tva ON tva.id = tas.assignment_id
       JOIN training_videos tv ON tv.id = tva.video_id
       WHERE tas.teacher_code = $1
       ORDER BY tas.created_at DESC`,
      [code]
    );

    const submissionIds = submissionsResult.rows.map((row) => row.submission_id);
    const answersBySubmission = new Map<number, any[]>();

    if (submissionIds.length > 0) {
      const answersResult = await pool.query(
        `SELECT
           taa.submission_id,
           taa.question_id,
           taa.answer_text,
           taa.is_correct,
           taa.points_earned,
           taa.answered_at,
           taq.question_text,
           taq.question_type,
           taq.correct_answer,
           taq.explanation,
           taq.order_number
         FROM training_assignment_answers taa
         LEFT JOIN training_assignment_questions taq ON taq.id = taa.question_id
         WHERE taa.submission_id = ANY($1::int[])
         ORDER BY taa.submission_id DESC, taq.order_number ASC NULLS LAST, taa.question_id ASC`,
        [submissionIds]
      );

      for (const row of answersResult.rows) {
        const key = Number(row.submission_id);
        if (!answersBySubmission.has(key)) {
          answersBySubmission.set(key, []);
        }

        answersBySubmission.get(key)!.push({
          question_id: row.question_id,
          order_number: row.order_number,
          question_text: row.question_text,
          question_type: row.question_type,
          answer_text: row.answer_text,
          is_correct: row.is_correct,
          points_earned: row.points_earned != null ? parseFloat(row.points_earned) : null,
          correct_answer: row.correct_answer,
          explanation: row.explanation,
          answered_at: row.answered_at,
        });
      }
    }

    const log = submissionsResult.rows.map((row) => ({
      submission_id: row.submission_id,
      teacher_code: row.teacher_code,
      video_id: row.video_id,
      video_title: row.video_title,
      assignment_id: row.assignment_id,
      assignment_title: row.assignment_title,
      attempt_number: row.attempt_number,
      score: row.score != null ? parseFloat(row.score) : null,
      total_points: row.total_points != null ? parseFloat(row.total_points) : null,
      percentage: row.percentage != null ? parseFloat(row.percentage) : null,
      status: row.status,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      graded_at: row.graded_at,
      time_spent_seconds: row.time_spent_seconds || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      answers: answersBySubmission.get(Number(row.submission_id)) || [],
    }));

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      teacher: teacherResult.rows[0],
      count_submissions: log.length,
      log,
    });
  } catch (error) {
    console.error('[Public Training Detail Log API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
