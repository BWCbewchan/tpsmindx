import {
  rejectIfDatasourceLookupForbidden,
  requireBearerOrSessionCookie,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import {
  effectiveCompletionForGroupedLesson,
  hasTmsWatchEvidenceForVideoIds,
  mergedWatchSecondsForVideoIds,
  type TrainingVideoScoreRow,
} from '@/lib/training-effective-video-completion';
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

    // Normalize code: lowercase + trim để tránh case mismatch
    const normalizedCode = code.toLowerCase().trim();

    // Get teacher info — tìm case-insensitive
    const teacherResult = await pool.query(
      `SELECT teacher_code, full_name, center, teaching_block, total_score, status
       FROM training_teacher_stats
       WHERE LOWER(TRIM(teacher_code)) = $1`,
      [normalizedCode]
    );

    if (teacherResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy giáo viên' }, { status: 404 });
    }

    const teacher = teacherResult.rows[0];
    const dbTeacherCode = teacher.teacher_code;

    // ── 1. Lấy tất cả video active (giống training-db) ──────────────────────
    const [videosResult, scoresResult, quizEvidenceResult] = await Promise.all([
      pool.query(`
        SELECT id, title, video_link, video_group_id, chunk_index,
               description, duration_minutes, duration_seconds, lesson_number
        FROM training_videos
        WHERE status = 'active'
        ORDER BY lesson_number ASC NULLS LAST, id ASC
      `),
      pool.query(`
        SELECT video_id, score, completion_status, completed_at,
               time_spent_seconds,
               COALESCE(server_time_seconds, 0) AS server_time_seconds,
               last_heartbeat_at
        FROM training_teacher_video_scores
        WHERE LOWER(TRIM(teacher_code)) = $1
      `, [normalizedCode]),
      pool.query(`
        SELECT DISTINCT tva.video_id
        FROM training_assignment_submissions tas
        INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
        WHERE LOWER(TRIM(tas.teacher_code)) = $1
          AND tva.video_id IS NOT NULL
          AND tas.status IN ('submitted', 'graded')
      `, [normalizedCode]),
    ]);

    // ── 2. Build scoresMap (video_id → score row) ────────────────────────────
    const scoresMap = new Map<number, TrainingVideoScoreRow>();
    for (const row of scoresResult.rows) {
      scoresMap.set(Number(row.video_id), {
        score: parseFloat(String(row.score)) || 0,
        completion_status: row.completion_status,
        completed_at: row.completed_at,
        time_spent_seconds: row.time_spent_seconds || 0,
        server_time_seconds: Number(row.server_time_seconds) || 0,
        last_heartbeat_at: row.last_heartbeat_at ?? null,
      });
    }

    const quizEvidenceVideoIds = new Set<number>(
      quizEvidenceResult.rows.map((r: { video_id: number }) => r.video_id)
    );

    // ── 3. Gộp chunk theo video_group_id (giống training-db) ─────────────────
    const groupedVideoMap = new Map<string, any[]>();
    for (const video of videosResult.rows) {
      const groupKey = video.video_group_id
        ? `group:${video.video_group_id}`
        : `single:${video.id}`;
      if (!groupedVideoMap.has(groupKey)) groupedVideoMap.set(groupKey, []);
      groupedVideoMap.get(groupKey)!.push(video);
    }

    // ── 4. Lấy tất cả attempts hợp lệ ───────────────────────────────────────
    // Chỉ tính submission có câu trả lời thực sự (answers_count > 0)
    // hoặc đã được chấm điểm > 0 — loại bỏ bài nộp trống/hết giờ
    const attemptsResult = await pool.query(`
      SELECT
        tva.video_id,
        tas.id as submission_id,
        tas.assignment_id,
        tas.attempt_number,
        tas.score,
        tas.total_points,
        tas.percentage,
        tas.status,
        tas.created_at,
        tas.submitted_at,
        tas.graded_at,
        COUNT(taa.question_id)::INT as answers_count
      FROM training_assignment_submissions tas
      JOIN training_video_assignments tva ON tva.id = tas.assignment_id
      LEFT JOIN training_assignment_answers taa ON taa.submission_id = tas.id
      WHERE LOWER(TRIM(tas.teacher_code)) = $1
        AND tas.status IN ('submitted', 'graded')
      GROUP BY
        tva.video_id, tas.id, tas.assignment_id, tas.attempt_number,
        tas.score, tas.total_points, tas.percentage, tas.status,
        tas.created_at, tas.submitted_at, tas.graded_at
      HAVING COUNT(taa.question_id) > 0
         OR (tas.score IS NOT NULL AND tas.score > 0)
      ORDER BY tva.video_id ASC, tas.created_at DESC
    `, [normalizedCode]);

    // Map video_id → attempts[]
    const attemptMap = new Map<number, any[]>();
    for (const row of attemptsResult.rows) {
      const key = Number(row.video_id);
      if (!attemptMap.has(key)) attemptMap.set(key, []);
      attemptMap.get(key)!.push({
        submission_id: row.submission_id,
        assignment_id: row.assignment_id,
        attempt_number: row.attempt_number,
        score: row.score != null ? parseFloat(row.score) : null,
        total_points: row.total_points != null ? parseFloat(row.total_points) : null,
        percentage: row.percentage != null ? parseFloat(row.percentage) : null,
        status: row.status,
        created_at: row.created_at,
        submitted_at: row.submitted_at,
        graded_at: row.graded_at,
        answers_count: row.answers_count || 0,
      });
    }

    // ── 5. Build video_scores từ grouped lessons ──────────────────────────────
    const videoScores = Array.from(groupedVideoMap.values()).map((videosInGroup) => {
      const sorted = [...videosInGroup].sort((a, b) => {
        const left = a.chunk_index ?? 0;
        const right = b.chunk_index ?? 0;
        if (left !== right) return left - right;
        return a.id - b.id;
      });

      const representative = sorted[0];
      const sourceVideoIds: number[] = sorted.map((v) => v.id);

      // Normalize title (bỏ suffix chunk)
      const normalizedTitle = representative.title
        ? representative.title
            .replace(/\s*[-–—]?\s*(\[?P\d+(\/\d+)?\]?|part-\d+)\s*$/i, '')
            .replace(/\s*\(Phần \d+\)$/i, '')
            .trim()
        : representative.title;

      // Chunk metas để tính duration
      const chunkMetasSorted = sorted.map((v) => ({
        id: v.id,
        duration_seconds: v.duration_seconds,
        duration_minutes: v.duration_minutes,
      }));

      // Effective completion (giống training-db)
      const effective = effectiveCompletionForGroupedLesson({
        sourceVideoIds,
        chunkMetasSorted,
        scoresMap,
        quizEvidenceVideoIds,
      });

      // Thời gian xem gộp tất cả chunk
      const mergedWatchSeconds = mergedWatchSecondsForVideoIds(sourceVideoIds, scoresMap);

      // Điểm bài kiểm tra: lấy từ attempts của tất cả chunk trong group
      const allAttempts = sourceVideoIds.flatMap((id) => attemptMap.get(id) || []);
      // Sắp xếp theo created_at DESC
      allAttempts.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });

      const bestScore = allAttempts.length > 0
        ? Math.max(...allAttempts.map((a) => a.score ?? -Infinity))
        : null;
      const quizScore = bestScore !== null && bestScore !== -Infinity ? bestScore : null;

      // submission_id tốt nhất (điểm cao nhất)
      const bestSubmission = allAttempts.length > 0
        ? allAttempts.reduce((best, cur) =>
            (cur.score ?? -Infinity) > (best.score ?? -Infinity) ? cur : best
          )
        : null;

      // completed_at: lấy từ effective hoặc từ scoresMap
      const completedAt = effective.completed_at
        ?? (sourceVideoIds
            .map((id) => scoresMap.get(id)?.completed_at)
            .filter(Boolean)[0] as string | null | undefined)
        ?? null;

      return {
        video_id: representative.id,
        video_title: normalizedTitle || representative.title,
        video_link: representative.video_link,
        video_description: representative.description,
        lesson_number: representative.lesson_number,
        score: quizScore,
        completion_status: effective.completion_status,
        time_spent_seconds: mergedWatchSeconds,
        viewed_at: sourceVideoIds
          .map((id) => scoresMap.get(id))
          .filter(Boolean)
          .map((s) => (s as any).first_viewed_at)
          .filter(Boolean)[0] ?? null,
        completed_at: completedAt,
        submission_id: bestSubmission?.submission_id ?? null,
        attempt_logs: allAttempts,
        answers: [],
      };
    });

    // Sort theo lesson_number
    videoScores.sort((a, b) => (a.lesson_number ?? 9999) - (b.lesson_number ?? 9999));

    // ── 6. Stats ──────────────────────────────────────────────────────────────
    // Tổng lesson (sau khi gộp group)
    const totalLessons = videoScores.length;
    // Đã xem: completion_status không phải null/not_started
    const watchedCount = videoScores.filter(
      (v) => v.completion_status && v.completion_status !== 'not_started'
    ).length;

    // ── 7. Total score từ submissions ─────────────────────────────────────────
    const totalScoreResult = await pool.query(`
      SELECT COALESCE(AVG(best_score), 0) as avg_score
      FROM (
        SELECT assignment_id, MAX(score) as best_score
        FROM training_assignment_submissions
        WHERE LOWER(TRIM(teacher_code)) = $1
          AND status IN ('submitted', 'graded')
          AND score IS NOT NULL
        GROUP BY assignment_id
      ) sub
    `, [normalizedCode]);
    const computedTotalScore = parseFloat(totalScoreResult.rows[0]?.avg_score) || 0;

    return NextResponse.json({
      success: true,
      teacher: {
        teacher_code: dbTeacherCode,
        full_name: teacher.full_name,
        center: teacher.center,
        teaching_block: teacher.teaching_block,
        total_score: computedTotalScore,
        status: teacher.status,
      },
      stats: {
        total_public_videos: totalLessons,
        watched_videos: watchedCount,
      },
      video_scores: videoScores,
    });
  } catch (error) {
    console.error('[Public Training Detail API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
