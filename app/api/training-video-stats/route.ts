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

function centerFilterSql(): string {
  return `
    AND EXISTS (
      SELECT 1
      FROM unnest(
        string_to_array(
          regexp_replace(COALESCE(t.main_centre, t."Main centre", t.centers, tts.center, ''), '[\\n;|]+', ',', 'g'),
          ','
        )
      ) AS teacher_center
      WHERE LOWER(TRIM(teacher_center)) = ANY($1::text[])
    )
  `;
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireDatasourceBearer(request);
    if (!auth.ok) return auth.response;

    const allowedCenters = auth.privileged
      ? []
      : collectCenterTokens(auth.accessibleCenters);

    if (!auth.privileged && allowedCenters.length === 0) {
      return NextResponse.json({
        success: true,
        video_stats: [],
        teacher_matrix: [],
      });
    }

    const centerParams = auth.privileged ? [] : [allowedCenters];
    const filterSql = auth.privileged ? '' : centerFilterSql();

    // Per-video aggregate stats — grouped by video_group_id so split chunks appear as one row.
    // The representative video is the one with the lowest chunk_index (or lowest id for singles).
    const videoStatsResult = await pool.query(`
      WITH group_rep AS (
        -- Pick one representative video per group (lowest chunk_index, then lowest id)
        SELECT DISTINCT ON (COALESCE(video_group_id, CAST(id AS TEXT)))
          id,
          title,
          status,
          created_at,
          COALESCE(video_group_id, CAST(id AS TEXT)) AS group_key
        FROM training_videos
        WHERE status = 'active'
        ORDER BY COALESCE(video_group_id, CAST(id AS TEXT)), COALESCE(chunk_index, 0) ASC, id ASC
      ),
      group_ids AS (
        -- All video ids that belong to each group
        SELECT
          COALESCE(video_group_id, CAST(id AS TEXT)) AS group_key,
          ARRAY_AGG(id) AS video_ids
        FROM training_videos
        WHERE status = 'active'
        GROUP BY COALESCE(video_group_id, CAST(id AS TEXT))
      )
      SELECT
        gr.id AS video_id,
        gr.title,
        gr.status,
        gr.created_at,
        COUNT(DISTINCT tts.teacher_code) AS total_assigned,
        -- A teacher "viewed" the group if they viewed ANY chunk
        COUNT(DISTINCT tvs.teacher_code) AS total_viewed,
        -- A teacher "completed" the group if they completed ALL chunks
        COUNT(DISTINCT tvs_completed.teacher_code) AS total_completed,
        ROUND(
          COUNT(DISTINCT tvs.teacher_code) * 100.0 / NULLIF(COUNT(DISTINCT tts.teacher_code), 0),
          1
        ) AS watch_rate_pct,
        COUNT(DISTINCT tvs_qa.teacher_code) AS qa_answered_count,
        ROUND(
          COUNT(DISTINCT tvs_qa.teacher_code) * 100.0 / NULLIF(COUNT(DISTINCT tts.teacher_code), 0),
          1
        ) AS qa_rate_pct
      FROM group_rep gr
      JOIN group_ids gi ON gi.group_key = gr.group_key
      -- All teachers in the system
      JOIN training_teacher_stats tts ON gr.status = 'active'
      JOIN teachers t ON LOWER(TRIM(tts.teacher_code)) = LOWER(TRIM(t.code))
      -- Viewed: teacher has a score row for ANY video in the group
      LEFT JOIN training_teacher_video_scores tvs
        ON tvs.video_id = ANY(gi.video_ids) AND tts.teacher_code = tvs.teacher_code
      -- Completed: teacher completed ALL videos in the group
      LEFT JOIN (
        SELECT tvs2.teacher_code, gi2.group_key
        FROM training_teacher_video_scores tvs2
        JOIN group_ids gi2 ON tvs2.video_id = ANY(gi2.video_ids)
        WHERE tvs2.completion_status = 'completed'
        GROUP BY tvs2.teacher_code, gi2.group_key, gi2.video_ids
        HAVING COUNT(DISTINCT tvs2.video_id) >= array_length(gi2.video_ids, 1)
      ) tvs_completed ON tts.teacher_code = tvs_completed.teacher_code AND tvs_completed.group_key = gr.group_key
      -- Q&A: teacher answered any question in any chunk of the group
      LEFT JOIN training_teacher_video_scores tvs_qa
        ON tvs_qa.video_id = ANY(gi.video_ids)
        AND tts.teacher_code = tvs_qa.teacher_code
        AND tvs_qa.score IS NOT NULL AND tvs_qa.score > 0
      WHERE 1=1
      ${filterSql}
      GROUP BY gr.id, gr.title, gr.status, gr.created_at
      ORDER BY gr.created_at ASC
    `, centerParams);

    // Per-teacher, per-video matrix — collapse grouped videos into one representative column.
    const teacherMatrixResult = await pool.query(`
      SELECT
        tts.teacher_code,
        COALESCE(t.full_name, tts.full_name) AS full_name,
        COALESCE(t.main_centre, tts.center) AS center,
        COALESCE(NULLIF(t.khoi_final, ''), NULLIF(t.course_line, ''), tts.teaching_block) AS teaching_block,
        tv.id AS video_id,
        tv.video_group_id,
        tv.chunk_index,
        tvs.completion_status,
        tvs.time_spent_seconds,
        tvs.score
      FROM training_teacher_stats tts
      JOIN teachers t ON tts.teacher_code = t.code
      CROSS JOIN training_videos tv
      LEFT JOIN training_teacher_video_scores tvs
        ON tv.id = tvs.video_id AND tts.teacher_code = tvs.teacher_code
      WHERE tv.status = 'active'
      ${filterSql}
      ORDER BY COALESCE(t.full_name, tts.full_name) ASC, tv.created_at ASC
    `, centerParams);

    // Build a map: group_key → representative video_id (lowest chunk_index / lowest id)
    const groupRepMap = new Map<string, number>(); // group_key → rep video_id
    for (const row of teacherMatrixResult.rows) {
      const groupKey = row.video_group_id ?? `single:${row.video_id}`;
      if (!groupRepMap.has(groupKey)) {
        groupRepMap.set(groupKey, row.video_id);
      } else {
        // Keep the one with lower chunk_index (or lower id as fallback)
        const existingId = groupRepMap.get(groupKey)!;
        const existingChunk = teacherMatrixResult.rows.find(r => r.video_id === existingId)?.chunk_index ?? 0;
        const currentChunk = row.chunk_index ?? 0;
        if (currentChunk < existingChunk || (currentChunk === existingChunk && row.video_id < existingId)) {
          groupRepMap.set(groupKey, row.video_id);
        }
      }
    }

    // Group matrix by teacher, collapsing chunks into one representative video per group
    const teacherMap = new Map<string, {
      teacher_code: string;
      full_name: string;
      center: string;
      teaching_block: string;
      videos: Record<string, { completion_status: string | null; time_spent_seconds: number; score: number | null }>;
    }>();

    // Intermediate: teacher → group_key → all chunk entries
    const teacherGroupChunks = new Map<string, Map<string, Array<{
      video_id: number;
      completion_status: string | null;
      time_spent_seconds: number;
      score: number | null;
    }>>>();

    for (const row of teacherMatrixResult.rows) {
      const groupKey = row.video_group_id ?? `single:${row.video_id}`;

      if (!teacherGroupChunks.has(row.teacher_code)) {
        teacherGroupChunks.set(row.teacher_code, new Map());
        teacherMap.set(row.teacher_code, {
          teacher_code: row.teacher_code,
          full_name: row.full_name,
          center: row.center,
          teaching_block: row.teaching_block,
          videos: {},
        });
      }

      const groupMap = teacherGroupChunks.get(row.teacher_code)!;
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push({
        video_id: row.video_id,
        completion_status: row.completion_status || null,
        time_spent_seconds: row.time_spent_seconds ? parseInt(row.time_spent_seconds) : 0,
        score: row.score != null ? parseFloat(row.score) : null,
      });
    }

    // Collapse each group into one entry keyed by the representative video_id
    for (const [teacherCode, groupMap] of teacherGroupChunks.entries()) {
      const entry = teacherMap.get(teacherCode)!;
      for (const [groupKey, chunks] of groupMap.entries()) {
        const repId = groupRepMap.get(groupKey)!;

        // Merge completion_status: completed if ALL chunks completed, in_progress if any in_progress/completed, else null
        const statuses = chunks.map(c => c.completion_status);
        let mergedStatus: string | null = null;
        if (statuses.every(s => s === 'completed')) {
          mergedStatus = 'completed';
        } else if (statuses.some(s => s === 'completed' || s === 'in_progress')) {
          mergedStatus = 'in_progress';
        }

        // Sum time spent across all chunks
        const totalTime = chunks.reduce((sum, c) => sum + c.time_spent_seconds, 0);

        // Average score across chunks that have a score
        const scoredChunks = chunks.filter(c => c.score != null);
        const avgScore = scoredChunks.length > 0
          ? scoredChunks.reduce((sum, c) => sum + c.score!, 0) / scoredChunks.length
          : null;

        entry.videos[repId] = {
          completion_status: mergedStatus,
          time_spent_seconds: totalTime,
          score: avgScore,
        };
      }
    }

    return NextResponse.json({
      success: true,
      video_stats: videoStatsResult.rows.map(row => ({
        video_id: row.video_id,
        title: row.title,
        status: row.status,
        total_assigned: parseInt(row.total_assigned) || 0,
        total_viewed: parseInt(row.total_viewed) || 0,
        total_completed: parseInt(row.total_completed) || 0,
        watch_rate_pct: parseFloat(row.watch_rate_pct) || 0,
        qa_answered_count: parseInt(row.qa_answered_count) || 0,
        qa_rate_pct: parseFloat(row.qa_rate_pct) || 0,
      })),
      teacher_matrix: Array.from(teacherMap.values()),
    });
  } catch (error) {
    console.error('[Video Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
