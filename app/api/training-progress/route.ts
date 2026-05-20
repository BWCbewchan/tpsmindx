import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── Hằng số ──────────────────────────────────────────────────────────────────
// Heartbeat gửi mỗi 10s từ client.
// Server cho phép delta tối đa 15s (buffer cho lag/reconnect).
// Nếu delta > MAX_HEARTBEAT_DELTA → bỏ qua, không cộng thêm thời gian.
const HEARTBEAT_INTERVAL_S  = 10;   // client save mỗi 10s
const MAX_HEARTBEAT_DELTA_S = 15;   // tối đa 15s mỗi heartbeat
const MIN_HEARTBEAT_DELTA_S = 1;    // bỏ qua nếu quá nhanh (spam)
const COMPLETION_THRESHOLD  = 0.90; // phải xem ít nhất 90% mới được mark completed

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { teacherCode, videoId, timeSpent, isCompleted, totalDuration } = body;

    if (!teacherCode || !videoId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // ── 1. Lấy record hiện tại + video duration ──────────────────────────
      const [recordResult, metaResult] = await Promise.all([
        client.query(
          `SELECT time_spent_seconds, server_time_seconds, completion_status,
                  last_heartbeat_at, first_viewed_at
           FROM training_teacher_video_scores
           WHERE teacher_code = $1 AND video_id = $2`,
          [teacherCode, videoId]
        ),
        client.query(
          `SELECT duration_minutes, duration_seconds FROM training_videos WHERE id = $1`,
          [videoId]
        ),
      ]);

      const existing = recordResult.rows[0] || null;
      const meta     = metaResult.rows[0] || null;

      const videoDurationSeconds: number | null = meta?.duration_seconds
        ? Number(meta.duration_seconds)
        : meta?.duration_minutes
          ? Number(meta.duration_minutes) * 60
          : null;

      // ── 2. Tính server_time_seconds bằng delta thực tế ───────────────────
      const now = new Date();
      let serverTimeDelta = 0;

      if (existing?.last_heartbeat_at) {
        const lastHeartbeat = new Date(existing.last_heartbeat_at);
        const deltaSeconds  = (now.getTime() - lastHeartbeat.getTime()) / 1000;

        if (deltaSeconds >= MIN_HEARTBEAT_DELTA_S && deltaSeconds <= MAX_HEARTBEAT_DELTA_S) {
          serverTimeDelta = Math.floor(deltaSeconds);
        } else if (deltaSeconds > MAX_HEARTBEAT_DELTA_S) {
          serverTimeDelta = HEARTBEAT_INTERVAL_S;
        }
      } else {
        // Lần đầu tiên → dùng timeSpent từ client nhưng clamp hợp lý
        const safeInitial = Math.max(0, Math.min(
          Math.floor(timeSpent || 0),
          videoDurationSeconds ? videoDurationSeconds : HEARTBEAT_INTERVAL_S * 2
        ));
        serverTimeDelta = safeInitial;
      }

      const prevServerTime = Number(existing?.server_time_seconds) || 0;
      const newServerTime  = prevServerTime + serverTimeDelta;

      // Clamp: không vượt quá video duration + buffer nhỏ
      const maxServerTime = videoDurationSeconds
        ? videoDurationSeconds + HEARTBEAT_INTERVAL_S
        : newServerTime;
      const clampedServerTime = Math.floor(Math.min(newServerTime, maxServerTime));

      // ── 3. Validate isCompleted ──────────────────────────────────────────
      // Chỉ chấp nhận nếu server_time_seconds >= 90% duration
      let validatedIsCompleted = isCompleted === true;
      if (validatedIsCompleted && videoDurationSeconds) {
        const minRequired = videoDurationSeconds * COMPLETION_THRESHOLD;
        if (clampedServerTime < minRequired) {
          validatedIsCompleted = false;
        }
      }
      // Nếu đã completed trước đó → giữ nguyên
      if (existing?.completion_status === 'completed') {
        validatedIsCompleted = true;
      }

      // ── 4. Update video duration nếu client cung cấp ────────────────────
      if (totalDuration && typeof totalDuration === 'number' && totalDuration > 0) {
        const durationMinutes = Math.max(1, Math.ceil(totalDuration / 60));
        await client.query(
          `UPDATE training_videos
           SET duration_minutes = $1
           WHERE id = $2 AND (duration_minutes IS NULL OR duration_minutes != $1)`,
          [durationMinutes, videoId]
        ).catch(() => { /* non-blocking */ });
      }

      // ── 5. Sync teacher stats ────────────────────────────────────────────
      try {
        const teacherInfo = await client.query(
          `SELECT COALESCE(NULLIF(full_name,''),$1) AS full_name,
                  COALESCE(NULLIF(user_name,''),NULL) AS username,
                  COALESCE(NULLIF(work_email,''),'') AS work_email,
                  COALESCE(NULLIF(main_centre,''),NULL) AS center,
                  COALESCE(NULLIF(course_line,''),NULL) AS teaching_block
           FROM teachers WHERE code = $1 LIMIT 1`,
          [teacherCode]
        );
        const t = teacherInfo.rows[0] || null;
        await client.query(
          `INSERT INTO training_teacher_stats
             (teacher_code, full_name, username, work_email, center, teaching_block, status, total_score)
           VALUES ($1,$2,$3,$4,$5,$6,'Active',0.00)
           ON CONFLICT (teacher_code) DO UPDATE SET
             full_name      = COALESCE(NULLIF(EXCLUDED.full_name,''), training_teacher_stats.full_name),
             username       = COALESCE(NULLIF(EXCLUDED.username,''), training_teacher_stats.username),
             work_email     = COALESCE(NULLIF(EXCLUDED.work_email,''), training_teacher_stats.work_email),
             center         = COALESCE(NULLIF(EXCLUDED.center,''), training_teacher_stats.center),
             teaching_block = COALESCE(NULLIF(EXCLUDED.teaching_block,''), training_teacher_stats.teaching_block),
             updated_at     = NOW()`,
          [teacherCode, t?.full_name || teacherCode, t?.username || null,
           t?.work_email || '', t?.center || null, t?.teaching_block || null]
        );
      } catch { /* non-blocking */ }

      // ── 6. Upsert progress ───────────────────────────────────────────────
      const statusParam = validatedIsCompleted
        ? 'watched'
        : (clampedServerTime > 0 ? 'in_progress' : 'not_started');

      const result = await client.query(
        `INSERT INTO training_teacher_video_scores
           (teacher_code, video_id, time_spent_seconds, server_time_seconds,
            completion_status, completed_at, updated_at, first_viewed_at,
            view_count, last_heartbeat_at)
         VALUES ($1, $2, $3, $3, $4::text,
           CASE WHEN $4::text = 'completed' THEN NOW() ELSE NULL END,
           NOW(), NOW(), 1, $5)
         ON CONFLICT (teacher_code, video_id) DO UPDATE SET
           -- time_spent_seconds: dùng GREATEST để không giảm (backward compat)
           time_spent_seconds = GREATEST(
             training_teacher_video_scores.time_spent_seconds,
             $3
           ),
           -- server_time_seconds: luôn dùng giá trị server tính
           server_time_seconds = $3,
           last_heartbeat_at   = $5,
           view_count          = GREATEST(training_teacher_video_scores.view_count, 1),
           completion_status   = CASE
             WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
             WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
             ELSE $4::text
           END,
           completed_at = CASE
             WHEN training_teacher_video_scores.completion_status = 'completed'
               THEN training_teacher_video_scores.completed_at
             WHEN $4::text = 'completed' THEN NOW()
             ELSE training_teacher_video_scores.completed_at
           END,
           updated_at = NOW()
         RETURNING *`,
        [teacherCode, videoId, clampedServerTime, statusParam, now]
      );

      return NextResponse.json({ success: true, data: result.rows[0] });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

export const GET = withApiProtection(async (request: NextRequest) => {
  const teacherCode = request.nextUrl.searchParams.get('teacherCode');
  const videoId     = request.nextUrl.searchParams.get('videoId');

  if (!teacherCode || !videoId) {
    return NextResponse.json({ error: 'Missing teacherCode or videoId' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT time_spent_seconds, server_time_seconds, completion_status, last_heartbeat_at
       FROM training_teacher_video_scores
       WHERE teacher_code = $1 AND video_id = $2`,
      [teacherCode, videoId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    // Trả về server_time_seconds thay vì time_spent_seconds để client resume đúng vị trí
    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        // Client dùng time_spent_seconds để resume — map từ server_time
        time_spent_seconds: row.server_time_seconds || row.time_spent_seconds,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
