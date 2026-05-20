import { withApiProtection } from '@/lib/api-protection';
import {
    rejectIfDatasourceLookupForbidden,
    requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import {
  effectiveCompletionForGroupedLesson,
  type TrainingVideoScoreRow,
} from '@/lib/training-effective-video-completion';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch teacher submissions with filters
async function handleTrainingSubmissionsGet(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    // Normalize teacher_code: lowercase + trim để tránh case mismatch
    const teacherCode = (searchParams.get('teacher_code') || '').toLowerCase().trim() || null;
    const assignmentId = searchParams.get('assignment_id');
    const status = searchParams.get('status');
    const latest = searchParams.get('latest'); // Get only the latest submission

    if (!auth.privileged) {
      if (!teacherCode?.trim()) {
        return NextResponse.json(
          { error: 'teacher_code là bắt buộc' },
          { status: 400 },
        );
      }
      const denied = await rejectIfDatasourceLookupForbidden(
        auth.sessionEmail,
        false,
        '',
        teacherCode,
      );
      if (denied) return denied;
    }

    let query = `
      SELECT 
        tas.*,
        tva.assignment_title,
        tv.title as video_title,
        ts.full_name as teacher_name
      FROM training_assignment_submissions tas
      LEFT JOIN training_video_assignments tva ON tas.assignment_id = tva.id
      LEFT JOIN training_videos tv ON tva.video_id = tv.id
      LEFT JOIN training_teacher_stats ts ON tas.teacher_code = ts.teacher_code
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (teacherCode) {
      query += ` AND LOWER(TRIM(tas.teacher_code)) = LOWER(TRIM($${paramIndex}))`;
      values.push(teacherCode);
      paramIndex++;
    }

    if (assignmentId) {
      query += ` AND tas.assignment_id = $${paramIndex}`;
      values.push(assignmentId);
      paramIndex++;
    }

    if (status) {
      query += ` AND tas.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += ' ORDER BY tas.created_at DESC';

    // If latest flag is set, limit to 1 result
    if (latest === 'true') {
      query += ' LIMIT 1';
    }

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

export const GET = withApiProtection(handleTrainingSubmissionsGet);

// POST: Create new submission (teacher starts assignment)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      assignment_id,
      attempt_number = 1
    } = body;
    // Normalize teacher_code: lowercase + trim để tránh case mismatch
    const teacher_code: string = (body.teacher_code || '').toString().toLowerCase().trim();
    const { teacher_info } = body;

    if (!teacher_code || !assignment_id) {
      return NextResponse.json(
        { error: 'teacher_code and assignment_id are required' },
        { status: 400 }
      );
    }

    if (!auth.privileged) {
      const denied = await rejectIfDatasourceLookupForbidden(
        auth.sessionEmail,
        false,
        '',
        String(teacher_code),
      );
      if (denied) return denied;
    }

    // Hoàn thành video hiệu dụng (gộp chunk + heartbeat), khớp /api/training-db và /api/training-assignments
    const assignmentMeta = await pool.query<{
      video_id: number | null
      title: string | null
    }>(
      `SELECT tva.video_id, tv.title
       FROM training_video_assignments tva
       LEFT JOIN training_videos tv ON tva.video_id = tv.id
       WHERE tva.id = $1`,
      [assignment_id],
    );

    if (assignmentMeta.rows.length > 0) {
      const metaRow = assignmentMeta.rows[0];
      const anchorVid = metaRow.video_id;
      if (anchorVid != null && anchorVid > 0) {
        const quizEvidenceByVideoQuery = `
          SELECT DISTINCT tva.video_id
          FROM training_assignment_submissions tas
          INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
          WHERE tas.teacher_code = $1
            AND tva.video_id IS NOT NULL
            AND (
              tas.status = 'graded'
              OR (tas.submitted_at IS NOT NULL AND tas.status IN ('submitted', 'graded'))
            )
        `;
        const [expandedRes, quizEvidenceResult] = await Promise.all([
          pool.query<{
            id: number
            video_group_id: string | null
            chunk_index: number | null
            duration_minutes: number | null
            duration_seconds: number | null
          }>(
            `SELECT id, video_group_id, chunk_index, duration_minutes, duration_seconds
             FROM training_videos
             WHERE id = ANY($1::int[])
                OR video_group_id IN (
                  SELECT DISTINCT video_group_id FROM training_videos
                  WHERE id = ANY($1::int[]) AND video_group_id IS NOT NULL
                )
             ORDER BY video_group_id NULLS LAST, chunk_index NULLS LAST, id`,
            [[anchorVid]],
          ),
          pool.query(quizEvidenceByVideoQuery, [teacher_code]),
        ]);

        const quizEvidenceVideoIds = new Set<number>(
          (quizEvidenceResult.rows as { video_id: number }[]).map(
            (r) => r.video_id,
          ),
        );

        const expandedVideoRows = expandedRes.rows;
        const metaById = new Map(expandedVideoRows.map((r) => [r.id, r]));
        const anchor = metaById.get(anchorVid);

        if (anchor) {
          const sameGroup = expandedVideoRows.filter((r) =>
            anchor.video_group_id
              ? r.video_group_id === anchor.video_group_id
              : r.id === anchor.id,
          );
          const sorted = [...sameGroup].sort((a, b) => {
            const left = a.chunk_index ?? 0;
            const right = b.chunk_index ?? 0;
            if (left !== right) return left - right;
            return a.id - b.id;
          });
          const sourceVideoIds = sorted.map((r) => r.id);
          const chunkMetasSorted = sorted.map((r) => ({
            id: r.id,
            duration_seconds: r.duration_seconds,
            duration_minutes: r.duration_minutes,
          }));

          const allScoreVideoIds = [...new Set(sourceVideoIds)];
          const scoresMapAll = new Map<number, TrainingVideoScoreRow>();
          if (allScoreVideoIds.length > 0) {
            const scoresRes = await pool.query(
              `SELECT video_id, score, completion_status, completed_at, time_spent_seconds,
                      COALESCE(server_time_seconds, 0) AS server_time_seconds,
                      last_heartbeat_at
               FROM training_teacher_video_scores
               WHERE teacher_code = $1 AND video_id = ANY($2::int[])`,
              [teacher_code, allScoreVideoIds],
            );
            scoresRes.rows.forEach(
              (srow: {
                video_id: number
                score: unknown
                completion_status: string
                completed_at: unknown
                time_spent_seconds: number | null
                server_time_seconds: number | null
                last_heartbeat_at: string | Date | null
              }) => {
                scoresMapAll.set(srow.video_id, {
                  score: parseFloat(String(srow.score)) || 0,
                  completion_status: srow.completion_status,
                  completed_at: srow.completed_at as string | Date | null,
                  time_spent_seconds: srow.time_spent_seconds || 0,
                  server_time_seconds: Number(srow.server_time_seconds) || 0,
                  last_heartbeat_at: srow.last_heartbeat_at ?? null,
                });
              },
            );
          }

          const effective = effectiveCompletionForGroupedLesson({
            sourceVideoIds,
            chunkMetasSorted,
            scoresMap: scoresMapAll,
            quizEvidenceVideoIds,
          });

          // Cho phép làm bài nếu đã xem video (watched) hoặc đã hoàn thành (completed)
          if (!['watched', 'completed'].includes(effective.completion_status)) {
            const videoTitle = metaRow.title || 'bài học';
            return NextResponse.json(
              {
                error: `Bạn cần hoàn thành xem video "${videoTitle}" trước khi làm bài tập này.`,
              },
              { status: 403 },
            );
          }
        }
      }
    }

    // Sync teacher info if provided
    if (teacher_info && (teacher_info.center || teacher_info.teaching_block)) {
        // Try to fetch latest info from teachers table to ensure accuracy
        try {
            const teacherRes = await pool.query(
                `SELECT full_name, main_centre, course_line, work_email FROM teachers WHERE code = $1`,
                [teacher_code]
            );
            
            if (teacherRes.rows.length > 0) {
                const updatedTeacher = teacherRes.rows[0];
                console.log(`[Sync] Updating teacher stats for ${teacher_code} from DB:`, updatedTeacher);
                
                // Override with DB values if available
                teacher_info.full_name = updatedTeacher.full_name || teacher_info.full_name;
                teacher_info.center = updatedTeacher.main_centre || teacher_info.center;
                teacher_info.teaching_block = updatedTeacher.course_line || teacher_info.teaching_block;
                // Only update email if DB has one
                if (updatedTeacher.work_email) {
                    teacher_info.work_email = updatedTeacher.work_email;
                }
            }
        } catch (e) {
            console.error("Error fetching teacher details from DB", e);
        }

      try {
        await pool.query(`
          INSERT INTO training_teacher_stats (
            teacher_code, 
            full_name, 
            center, 
            teaching_block, 
            work_email, 
            status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'Active', NOW(), NOW())
          ON CONFLICT (teacher_code) 
          DO UPDATE SET 
            full_name = EXCLUDED.full_name,
            center = EXCLUDED.center,
            teaching_block = EXCLUDED.teaching_block,
            work_email = EXCLUDED.work_email,
            updated_at = NOW()
        `, [
           teacher_code,
           teacher_info.full_name || teacher_code,
           teacher_info.center,
           teacher_info.teaching_block,
           teacher_info.work_email || ''
        ]);
        console.log(`Synced stats for teacher ${teacher_code}`);
      } catch (err) {
        console.error('Error syncing teacher stats:', err);
        // Continue even if sync fails, as the main goal is starting the assignment
      }
    }

    // Check if there's already an in-progress submission
    const existingQuery = `
      SELECT * FROM training_assignment_submissions 
      WHERE teacher_code = $1 AND assignment_id = $2 AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const existingResult = await pool.query(existingQuery, [teacher_code, assignment_id]);
    
    if (existingResult.rows.length > 0) {
      // 1. Fetch Draft Answers
      const submissionId = existingResult.rows[0].id;
      const answersQuery = `
          SELECT question_id, answer_text 
          FROM training_assignment_answers 
          WHERE submission_id = $1
      `;
      const answersResult = await pool.query(answersQuery, [submissionId]);
      
      const existingAnswers: Record<number, string> = {};
      answersResult.rows.forEach(row => {
          existingAnswers[row.question_id] = row.answer_text;
      });

      // Return existing in-progress submission
      return NextResponse.json({
        success: true,
        data: existingResult.rows[0],
        existing_answers: existingAnswers,
        server_time: new Date().toISOString(),
        message: 'Continuing existing submission'
      });
    }

    // total_points và max_attempts đã bị xóa khỏi training_video_assignments (migration V42)
    // Chỉ cần kiểm tra assignment tồn tại
    const assignmentResult = await pool.query(
      'SELECT id FROM training_video_assignments WHERE id = $1',
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Tính total_points từ số câu hỏi (mỗi câu = 1 điểm, thang 10)
    const qCountResult = await pool.query(
      'SELECT COUNT(*) as cnt FROM training_assignment_questions WHERE assignment_id = $1',
      [assignment_id]
    );
    const totalPoints = 10.00; // Thang điểm cố định 10

    // Calculate next attempt number
    const attemptResult = await pool.query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
       FROM training_assignment_submissions
       WHERE teacher_code = $1 AND assignment_id = $2`,
      [teacher_code, assignment_id]
    );
    const nextAttempt = attemptResult.rows[0].next_attempt;
    // max_attempts đã bị xóa — không giới hạn số lần làm

    const query = `
      INSERT INTO training_assignment_submissions (
        teacher_code,
        assignment_id,
        attempt_number,
        total_points,
        status,
        started_at
      ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
      RETURNING *
    `;

    const values = [teacher_code, assignment_id, nextAttempt, totalPoints];
    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      server_time: new Date().toISOString(),
      message: 'Submission started successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating submission:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create submission',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// PUT: Update submission (submit or grade)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Submission id is required' },
        { status: 400 }
      );
    }

    if (!auth.privileged) {
      const own = await pool.query(
        'SELECT teacher_code FROM training_assignment_submissions WHERE id = $1 LIMIT 1',
        [id],
      );
      if (own.rows.length === 0) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
      const denied = await rejectIfDatasourceLookupForbidden(
        auth.sessionEmail,
        false,
        '',
        String(own.rows[0].teacher_code || ''),
      );
      if (denied) return denied;
    }

    let query = '';
    let values = [];

    if (action === 'submit') {
      // Teacher submits assignment
      query = `
        UPDATE training_assignment_submissions
        SET 
          status = 'submitted',
          submitted_at = NOW(),
          time_spent_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
        WHERE id = $1
        RETURNING *
      `;
      values = [id];
    } else if (action === 'grade') {
      // System or admin grades assignment
      const { score, is_passed } = updates;
      
      if (score === undefined) {
        return NextResponse.json(
          { error: 'score is required for grading' },
          { status: 400 }
        );
      }

      // Validate and parse score
      const parsedScore = typeof score === 'number' ? score : parseFloat(score);
      if (isNaN(parsedScore)) {
        console.error('[Submission] Invalid score value:', score, 'type:', typeof score);
        return NextResponse.json(
          { error: 'Invalid score value. Must be a valid number.' },
          { status: 400 }
        );
      }

      // Frontend đã tính điểm theo thang 10 (tổng points của câu đúng).
      // Clamp về [0, 10] và làm tròn 2 chữ số thập phân.
      const passingScore = 7.00; // Ngưỡng đạt cố định 7/10
      const normalizedScore = Math.round(Math.min(Math.max(parsedScore, 0), 10) * 100) / 100;
      const isPassedStatus = normalizedScore >= passingScore;

      console.log('[Submission] Grading:', { 
         id, 
         raw_score: parsedScore, 
         normalized_score: normalizedScore,
         is_passed: isPassedStatus,
      });

      query = `
        UPDATE training_assignment_submissions
        SET 
          score = $1,
          percentage = ($1 / total_points * 100),
          is_passed = $2,
          status = 'graded',
          graded_at = NOW()
        WHERE id = $3
        RETURNING *, (SELECT teacher_code FROM training_assignment_submissions WHERE id = $3) as teacher_code,
                     (SELECT video_id FROM training_video_assignments WHERE id = (SELECT assignment_id FROM training_assignment_submissions WHERE id = $3)) as video_id
      `;
      values = [normalizedScore, isPassedStatus, id];
      
      // Execute the update
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }

      const submission = result.rows[0];

      // Update video stats regardless of pass/fail
      if (submission.teacher_code && submission.video_id) {
        console.log('[Submission] Updating video stats:', {
          teacher_code: submission.teacher_code,
          video_id: submission.video_id,
          score: normalizedScore,
          is_passed: isPassedStatus
        });

        // Ensure teacher exists in training_teacher_stats (auto-create if not exists)
        const ensureTeacherQuery = `
          INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, status)
          VALUES ($1, $1, '', 'Active')
          ON CONFLICT (teacher_code) DO NOTHING
        `;
        await pool.query(ensureTeacherQuery, [submission.teacher_code]);

        // Chỉ chuyển sang 'completed' khi đạt điểm, không đạt thì giữ nguyên trạng thái hiện tại
        const updateVideoScoreQuery = `
          INSERT INTO training_teacher_video_scores (
            teacher_code,
            video_id,
            score,
            completion_status,
            completed_at
          ) VALUES ($1, $2, $3, 'watched', NULL)
          ON CONFLICT (teacher_code, video_id)
          DO UPDATE SET
            score = GREATEST(training_teacher_video_scores.score, $3),
            completion_status = CASE 
              WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
              WHEN $4::boolean THEN 'completed'
              ELSE training_teacher_video_scores.completion_status
            END,
            completed_at = CASE 
              WHEN training_teacher_video_scores.completion_status = 'completed' THEN training_teacher_video_scores.completed_at
              WHEN $4::boolean THEN NOW()
              ELSE training_teacher_video_scores.completed_at
            END,
            updated_at = NOW()
        `;

        await pool.query(updateVideoScoreQuery, [
          submission.teacher_code,
          submission.video_id,
          normalizedScore,
          isPassedStatus
        ]);
        
        // Sync teacher answers in one bulk query and only for valid training_video_questions IDs.
        // Assignment question IDs can differ from video question IDs; filtering here prevents FK errors.
        if (updates.answers && Array.isArray(updates.answers)) {
          try {
            const syncTeacherAnswersQuery = `
              WITH incoming AS (
                SELECT *
                FROM jsonb_to_recordset($3::jsonb) AS x(
                  question_id INT,
                  answer_text TEXT,
                  is_correct BOOLEAN,
                  points_earned NUMERIC
                )
              )
              INSERT INTO training_teacher_answers (
                teacher_code,
                video_id,
                question_id,
                answer_text,
                is_correct,
                points_earned
              )
              SELECT
                $1,
                $2,
                incoming.question_id,
                incoming.answer_text,
                COALESCE(incoming.is_correct, false),
                COALESCE(incoming.points_earned, 0)
              FROM incoming
              INNER JOIN training_video_questions tvq
                ON tvq.id = incoming.question_id
               AND tvq.video_id = $2
            `;

            await pool.query(syncTeacherAnswersQuery, [
              submission.teacher_code,
              submission.video_id,
              JSON.stringify(updates.answers),
            ]);
          } catch (err: any) {
            console.warn('[Submission] Skipped syncing answers to teacher_answers:', err.message);
          }
        }
      }

      // Save submission answers if provided (for view detail later)
      if (updates.answers && Array.isArray(updates.answers)) {
        try {
          console.log('[Submission] Saving answers count:', updates.answers.length);
          const saveAnswersQuery = `
            WITH incoming AS (
              SELECT *
              FROM jsonb_to_recordset($2::jsonb) AS x(
                question_id INT,
                answer_text TEXT,
                is_correct BOOLEAN,
                points_earned NUMERIC
              )
              WHERE question_id IS NOT NULL
            )
            INSERT INTO training_assignment_answers (
              submission_id,
              question_id,
              answer_text,
              is_correct,
              points_earned
            )
            SELECT
              $1,
              incoming.question_id,
              incoming.answer_text,
              COALESCE(incoming.is_correct, false),
              COALESCE(incoming.points_earned, 0)
            FROM incoming
            ON CONFLICT (submission_id, question_id) DO UPDATE SET
              answer_text = EXCLUDED.answer_text,
              is_correct = EXCLUDED.is_correct,
              points_earned = EXCLUDED.points_earned,
              answered_at = NOW()
          `;

          await pool.query(saveAnswersQuery, [id, JSON.stringify(updates.answers)]);
        } catch (err) {
            console.error('[Submission] Error saving answers:', err);
        }
      }

      return NextResponse.json({
        success: true,
        data: submission,
        message: 'Submission graded successfully'
      });
    } else if (action === 'save_draft') {
        const { answers } = updates;
        if (answers && Array.isArray(answers)) {
            try {
                for (const answer of answers) {
                    await pool.query(
                      `INSERT INTO training_assignment_answers (
                         submission_id, question_id, answer_text
                       ) VALUES ($1, $2, $3)
                       ON CONFLICT (submission_id, question_id) DO UPDATE SET
                       answer_text = EXCLUDED.answer_text,
                       answered_at = NOW()`,
                      [
                        id,
                        answer.question_id,
                        answer.answer_text
                      ]
                    );
                }
                return NextResponse.json({ success: true, message: 'Draft saved' });
            } catch (e) {
                console.error("Save draft error", e);
                return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
            }
        }
        return NextResponse.json({ success: true, message: 'No answers to save' });
    } else {
      // General update (if not 'grade' or 'submit')
      const setClauses = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'answers') continue;
        
        setClauses.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
      
      if (setClauses.length > 0) {
        updateValues.push(id);
        query = `
          UPDATE training_assignment_submissions
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        values = updateValues;
      }
    }

    if (query) {
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: result.rows[0],
        message: 'Submission updated successfully'
      });
    } else {
        return NextResponse.json(
          { error: 'No update action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}

// DELETE: Delete submission (fixed sync)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Submission id is required' },
        { status: 400 }
      );
    }

    if (!auth.privileged) {
      const own = await pool.query(
        'SELECT teacher_code FROM training_assignment_submissions WHERE id = $1 LIMIT 1',
        [id],
      );
      if (own.rows.length === 0) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
      const denied = await rejectIfDatasourceLookupForbidden(
        auth.sessionEmail,
        false,
        '',
        String(own.rows[0].teacher_code || ''),
      );
      if (denied) return denied;
    }

    const query = 'DELETE FROM training_assignment_submissions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json(
      { error: 'Failed to delete submission' },
      { status: 500 }
    );
  }
}
// Force recompile 
