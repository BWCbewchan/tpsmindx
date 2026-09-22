import pool from '@/lib/db'
import { withTracking } from '@/lib/withTracking'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { getAccessibleCenterIds } from '@/lib/center-access'
import { NextRequest, NextResponse } from 'next/server'

const EXCLUDED_ENGAGEMENT_EMAILS = ['hoteaching@mindx.com.vn']

const actorClassificationCte = `
  manager_users AS (
    SELECT DISTINCT LOWER(TRIM(u.email)) AS user_id
    FROM app_users u
    LEFT JOIN manager_centers mc ON mc.user_id = u.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.email IS NOT NULL
      AND TRIM(u.email) <> ''
      AND COALESCE(u.is_active, true) = true
      AND (
        u.role IN ('super_admin', 'admin', 'manager', 'hr')
        OR mc.user_id IS NOT NULL
        OR UPPER(COALESCE(ur.role_code, '')) IN (
          'HR',
          'TE',
          'TF',
          'LEADER',
          'TC',
          'MANAGER',
          'ADMIN',
          'SUPER_ADMIN'
        )
      )

    UNION

    SELECT DISTINCT LOWER(TRIM(email)) AS user_id
    FROM teaching_leaders
    WHERE email IS NOT NULL
      AND TRIM(email) <> ''
      AND COALESCE(status, 'Active') <> 'Deactive'
  ),
  teacher_users AS (
    SELECT DISTINCT LOWER(
      COALESCE(NULLIF(TRIM(work_email), ''), NULLIF(TRIM("Work email"), ''))
    ) AS user_id
    FROM teachers
    WHERE COALESCE(NULLIF(TRIM(work_email), ''), NULLIF(TRIM("Work email"), '')) IS NOT NULL
  )
`

/**
 * GET /api/metrics/engagement?period=today|7d|30d
 * Returns user engagement metrics filtered by user's accessible centers.
 */
async function getEngagement(request: NextRequest) {
  try {
    // Check authorization
    const auth = await requireBearerSession(request)
    if (!auth.ok) {
      return auth.response
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    // Get accessible centers for current user
    const accessibleCenterIds = await getAccessibleCenterIds(auth.sessionEmail)

    // If user is not super_admin and has no assigned centers, return empty data
    const isSuperAdmin = auth.privileged
    const centerFilter =
      isSuperAdmin || accessibleCenterIds.length === 0
        ? ''
        : `AND ap.center_id IN (${accessibleCenterIds.join(',')})`

    let intervalSql: string
    let dayCount: number
    switch (period) {
      case 'today':
        intervalSql = '1 day'
        dayCount = 1
        break
      case '30d':
        intervalSql = '30 days'
        dayCount = 30
        break
      default: // 7d
        intervalSql = '7 days'
        dayCount = 7
    }

    // ── 1. DAU by hour ──
    const hourIntervalSql =
      period === 'today'
        ? '24 hours'
        : period === '30d'
          ? '72 hours'
          : '48 hours'

    const dauRes = await pool.query(`
      WITH hourly AS (
        SELECT generate_series(
          date_trunc('hour', NOW() - INTERVAL '${hourIntervalSql}'),
          date_trunc('hour', NOW()),
          INTERVAL '1 hour'
        ) AS hour_start
      )
      SELECT
        hourly.hour_start AS date,
        COALESCE(COUNT(DISTINCT se.user_id), 0) AS users
      FROM hourly
      LEFT JOIN system_events se
        ON date_trunc('hour', se.created_at) = hourly.hour_start
        AND se.event_name = 'page_view'
        AND se.user_id IS NOT NULL
      GROUP BY hourly.hour_start
      ORDER BY hourly.hour_start ASC
    `)
    const dau = dauRes.rows.map((r) => ({
      date: r.date,
      users: parseInt(r.users, 10),
    }))

    // ── 2. WAU by day (rolling 7-day active users) ──
    const wauWindowDays = period === '30d' ? 30 : 7

    const wauRes = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${wauWindowDays - 1} days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        days.day AS date,
        COALESCE(COUNT(DISTINCT se.user_id), 0) AS users
      FROM days
      LEFT JOIN system_events se
        ON se.event_name = 'page_view'
        AND se.user_id IS NOT NULL
        AND se.created_at >= (days.day - INTERVAL '6 days')
        AND se.created_at < (days.day + INTERVAL '1 day')
      GROUP BY days.day
      ORDER BY days.day ASC
    `)
    const wau = wauRes.rows.map((r) => ({
      date: r.date,
      users: parseInt(r.users, 10),
    }))

    // ── 3. Avg Session Duration (seconds) ──
    const sessionRes = await pool.query(`
      WITH sessions AS (
        SELECT 
          session_id,
          MIN(created_at) AS start_time,
          MAX(created_at) AS end_time
        FROM system_events
        WHERE session_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${intervalSql}'
        GROUP BY session_id
        HAVING COUNT(*) > 1
      )
      SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::int AS avg_duration
      FROM sessions
      WHERE EXTRACT(EPOCH FROM (end_time - start_time)) BETWEEN 10 AND 7200
    `)
    const avg_session_duration = parseInt(
      sessionRes.rows[0]?.avg_duration || '0',
      10,
    )

    // ── 4. Top Pages ──
    const topPagesRes = await pool.query(`
      SELECT 
        properties->>'page' AS page,
        COUNT(*) AS views
      FROM system_events
      WHERE event_name = 'page_view'
        AND properties->>'page' IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY properties->>'page'
      ORDER BY views DESC
      LIMIT 10
    `)
    const totalViews = topPagesRes.rows.reduce(
      (sum, r) => sum + parseInt(r.views, 10),
      0,
    )
    const top_pages = topPagesRes.rows.map((r) => ({
      page: r.page,
      views: parseInt(r.views, 10),
      percentage:
        totalViews > 0
          ? parseFloat(((parseInt(r.views, 10) / totalViews) * 100).toFixed(1))
          : 0,
    }))

    // ── 5. Device Distribution ──
    const deviceRes = await pool.query(`
      SELECT 
        COALESCE(properties->>'device', 'desktop') AS device,
        COUNT(*) AS cnt
      FROM system_events
      WHERE event_name = 'page_view'
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY COALESCE(properties->>'device', 'desktop')
    `)
    const totalDeviceHits = deviceRes.rows.reduce(
      (sum, r) => sum + parseInt(r.cnt, 10),
      0,
    )
    const devices: Record<string, number> = { mobile: 0, desktop: 0 }
    deviceRes.rows.forEach((r) => {
      const key = r.device === 'mobile' ? 'mobile' : 'desktop'
      devices[key] =
        totalDeviceHits > 0
          ? parseFloat(
              ((parseInt(r.cnt, 10) / totalDeviceHits) * 100).toFixed(1),
            )
          : 0
    })

    // ── 6. Feature Usage (top features) ──
    const featureRes = await pool.query(`
      SELECT 
        event_name,
        COUNT(*) AS usage_count,
        COUNT(DISTINCT user_id) AS unique_users
      FROM system_events
      WHERE event_name NOT IN ('page_view', 'session_start', 'session_end', 'api_request', 'error')
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY event_name
      ORDER BY usage_count DESC
      LIMIT 10
    `)
    const feature_usage = featureRes.rows.map((r) => ({
      feature: r.event_name,
      usage_count: parseInt(r.usage_count, 10),
      unique_users: parseInt(r.unique_users, 10),
    }))

    // ── 7. Retention: D1 / D7 / D30 ──
    const retentionRes = await pool.query(`
      WITH first_seen AS (
        SELECT user_id, MIN(DATE(created_at)) AS first_date
        FROM system_events
        WHERE user_id IS NOT NULL AND event_name = 'page_view'
        GROUP BY user_id
      ),
      active_days AS (
        SELECT 
          user_id,
          ARRAY_AGG(DISTINCT DATE(created_at)) AS active_dates
        FROM system_events
        WHERE user_id IS NOT NULL AND event_name = 'page_view'
        GROUP BY user_id
      ),
      retention AS (
        SELECT 
          fs.user_id,
          fs.first_date,
          ad.active_dates,
          CURRENT_DATE - fs.first_date AS age_days
        FROM first_seen fs
        JOIN active_days ad ON ad.user_id = fs.user_id
      )
      SELECT
        COUNT(*) FILTER (WHERE age_days >= 1) AS d1_total,
        COUNT(*) FILTER (WHERE age_days >= 7) AS d7_total,
        COUNT(*) FILTER (WHERE age_days >= 30) AS d30_total,
        COUNT(*) FILTER (WHERE age_days >= 1 AND (first_date + 1) = ANY(active_dates)) AS d1,
        COUNT(*) FILTER (WHERE age_days >= 7 AND (first_date + 7) = ANY(active_dates)) AS d7,
        COUNT(*) FILTER (WHERE age_days >= 30 AND (first_date + 30) = ANY(active_dates)) AS d30
      FROM retention
    `)
    const d1Total = parseInt(retentionRes.rows[0]?.d1_total || '0', 10)
    const d7Total = parseInt(retentionRes.rows[0]?.d7_total || '0', 10)
    const d30Total = parseInt(retentionRes.rows[0]?.d30_total || '0', 10)
    const retention = {
      d1:
        d1Total > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d1 || '0', 10) / d1Total) *
                100
              ).toFixed(1),
            )
          : 0,
      d7:
        d7Total > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d7 || '0', 10) / d7Total) *
                100
              ).toFixed(1),
            )
          : 0,
      d30:
        d30Total > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d30 || '0', 10) / d30Total) *
                100
              ).toFixed(1),
            )
          : 0,
    }

    // ── 8. Online users (last 5 minutes) ──
    const onlineUsersRes = await pool.query(
      `
      WITH ${actorClassificationCte}
      SELECT
        LOWER(TRIM(se.user_id)) AS user_id,
        MAX(se.created_at) AS last_seen,
        COUNT(*) AS hits_5m
      FROM system_events se
      JOIN teacher_users tu ON tu.user_id = LOWER(TRIM(se.user_id))
      LEFT JOIN manager_users mu ON mu.user_id = LOWER(TRIM(se.user_id))
      WHERE se.event_name = 'page_view'
        AND se.user_id IS NOT NULL
        AND NOT (LOWER(TRIM(se.user_id)) = ANY($1::text[]))
        AND mu.user_id IS NULL
        AND se.created_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY LOWER(TRIM(se.user_id))
      ORDER BY last_seen DESC
      LIMIT 20
    `,
      [EXCLUDED_ENGAGEMENT_EMAILS],
    )
    const online_users = onlineUsersRes.rows.map((r) => ({
      user_id: r.user_id,
      last_seen: r.last_seen,
      hits_5m: parseInt(r.hits_5m, 10),
    }))

    // ── 9. Interaction ranking by actor type ──
    const rankingRes = await pool.query(
      `
      WITH ${actorClassificationCte},
      user_events AS (
        SELECT
          LOWER(TRIM(se.user_id)) AS user_id,
          COUNT(*) AS interactions,
          COUNT(DISTINCT DATE(se.created_at)) AS active_days,
          ROUND(
            COUNT(*)::numeric / GREATEST(COUNT(DISTINCT DATE(se.created_at)), 1),
            2
          ) AS interactions_per_day
        FROM system_events se
        WHERE se.user_id IS NOT NULL
          AND se.created_at >= NOW() - INTERVAL '${intervalSql}'
          AND se.event_name NOT IN ('session_start', 'session_end')
          AND NOT (LOWER(TRIM(se.user_id)) = ANY($1::text[]))
        GROUP BY LOWER(TRIM(se.user_id))
      ),
      classified AS (
        SELECT
          ue.*,
          CASE
            WHEN mu.user_id IS NOT NULL THEN 'manager'
            WHEN tu.user_id IS NOT NULL THEN 'teacher'
            ELSE 'unknown'
          END AS actor_type
        FROM user_events ue
        LEFT JOIN manager_users mu ON mu.user_id = ue.user_id
        LEFT JOIN teacher_users tu ON tu.user_id = ue.user_id
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY actor_type
            ORDER BY interactions DESC, user_id ASC
          ) AS role_rank
        FROM classified
      )
      SELECT *
      FROM ranked
      WHERE actor_type IN ('manager', 'teacher')
        AND role_rank <= 20
      ORDER BY actor_type ASC, role_rank ASC
    `,
      [EXCLUDED_ENGAGEMENT_EMAILS],
    )

    const buildInteractionRanking = (actorType: 'manager' | 'teacher') =>
      rankingRes.rows
        .filter((r) => r.actor_type === actorType)
        .map((r) => ({
          rank: parseInt(r.role_rank, 10),
          user_id: r.user_id,
          interactions: parseInt(r.interactions, 10),
          active_days: parseInt(r.active_days, 10),
          interactions_per_day: parseFloat(r.interactions_per_day || '0'),
        }))

    const manager_interaction_ranking = buildInteractionRanking('manager')
    const teacher_interaction_ranking = buildInteractionRanking('teacher')
    const user_interaction_ranking = [
      ...manager_interaction_ranking,
      ...teacher_interaction_ranking,
    ]
      .sort((a, b) =>
        b.interactions === a.interactions
          ? a.user_id.localeCompare(b.user_id)
          : b.interactions - a.interactions,
      )
      .slice(0, 20)
      .map((item, idx) => ({ ...item, rank: idx + 1 }))

    // ── 10. Center usage (teachers + managers by profile center) ──
    const centerUsageRes = await pool.query(
      `
      WITH ${actorClassificationCte},
      teacher_profiles AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          center,
          center_id
        FROM (
          SELECT
            LOWER(
              COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''))
            ) AS user_id,
            COALESCE(
              NULLIF(TRIM(t.main_centre), ''),
              NULLIF(TRIM(t."Main centre"), ''),
              'Chưa rõ cơ sở'
            ) AS center,
            c.id AS center_id
          FROM teachers t
          LEFT JOIN centers c
            ON c.full_name = COALESCE(NULLIF(TRIM(t.main_centre), ''), NULLIF(TRIM(t."Main centre"), ''))
            OR c.short_code = COALESCE(NULLIF(TRIM(t.main_centre), ''), NULLIF(TRIM(t."Main centre"), ''))
          WHERE COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), '')) IS NOT NULL
        ) p
        WHERE user_id IS NOT NULL
          AND user_id <> ''
        ORDER BY user_id, CASE WHEN center = 'Chưa rõ cơ sở' THEN 1 ELSE 0 END, center ASC
      ),
      actor_profiles AS (
        SELECT
          tp.user_id,
          tp.center,
          tp.center_id,
          CASE
            WHEN mu.user_id IS NOT NULL THEN 'manager'
            ELSE 'teacher'
          END AS actor_type
        FROM teacher_profiles tp
        LEFT JOIN manager_users mu ON mu.user_id = tp.user_id
        LEFT JOIN teacher_users tu ON tu.user_id = tp.user_id
        WHERE mu.user_id IS NOT NULL
          OR tu.user_id IS NOT NULL
      )
      SELECT
        ap.center,
        COUNT(DISTINCT se.user_id) AS users,
        COUNT(DISTINCT se.user_id) FILTER (WHERE ap.actor_type = 'teacher') AS teacher_users,
        COUNT(DISTINCT se.user_id) FILTER (WHERE ap.actor_type = 'manager') AS manager_users,
        COUNT(*) AS usage_count,
        ROUND(
          COUNT(*)::numeric / GREATEST(COUNT(DISTINCT se.user_id), 1),
          2
        ) AS usage_per_user
      FROM system_events se
      JOIN actor_profiles ap ON ap.user_id = LOWER(TRIM(se.user_id))
      WHERE se.event_name = 'page_view'
        AND se.user_id IS NOT NULL
        AND NOT (LOWER(TRIM(se.user_id)) = ANY($1::text[]))
        AND se.created_at >= NOW() - INTERVAL '${intervalSql}'
        ${centerFilter}
      GROUP BY ap.center
      ORDER BY usage_count DESC
      LIMIT 20
    `,
      [EXCLUDED_ENGAGEMENT_EMAILS],
    )
    const center_usage = centerUsageRes.rows.map((r) => ({
      center: r.center,
      users: parseInt(r.users, 10),
      teacher_users: parseInt(r.teacher_users, 10),
      manager_users: parseInt(r.manager_users, 10),
      usage_count: parseInt(r.usage_count, 10),
      usage_per_user: parseFloat(r.usage_per_user || '0'),
    }))

    // ── 11. User details per center by actor type ──
    const centerUserDetailRes = await pool.query(
      `
      WITH ${actorClassificationCte},
      teacher_profiles AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          center,
          center_id
        FROM (
          SELECT
            LOWER(
              COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), ''))
            ) AS user_id,
            COALESCE(
              NULLIF(TRIM(t.main_centre), ''),
              NULLIF(TRIM(t."Main centre"), ''),
              'Chưa rõ cơ sở'
            ) AS center,
            c.id AS center_id
          FROM teachers t
          LEFT JOIN centers c
            ON c.full_name = COALESCE(NULLIF(TRIM(t.main_centre), ''), NULLIF(TRIM(t."Main centre"), ''))
            OR c.short_code = COALESCE(NULLIF(TRIM(t.main_centre), ''), NULLIF(TRIM(t."Main centre"), ''))
          WHERE COALESCE(NULLIF(TRIM(t.work_email), ''), NULLIF(TRIM(t."Work email"), '')) IS NOT NULL
        ) p
        WHERE user_id IS NOT NULL
          AND user_id <> ''
        ORDER BY user_id, CASE WHEN center = 'Chưa rõ cơ sở' THEN 1 ELSE 0 END, center ASC
      ),
      actor_profiles AS (
        SELECT
          tp.user_id,
          tp.center,
          tp.center_id,
          CASE
            WHEN mu.user_id IS NOT NULL THEN 'manager'
            ELSE 'teacher'
          END AS actor_type
        FROM teacher_profiles tp
        LEFT JOIN manager_users mu ON mu.user_id = tp.user_id
        LEFT JOIN teacher_users tu ON tu.user_id = tp.user_id
        WHERE mu.user_id IS NOT NULL
          OR tu.user_id IS NOT NULL
      )
      SELECT
        ap.center,
        ap.actor_type,
        LOWER(TRIM(se.user_id)) AS user_id,
        COUNT(*) AS usage_count,
        MAX(se.created_at) AS last_seen
      FROM system_events se
      JOIN actor_profiles ap ON ap.user_id = LOWER(TRIM(se.user_id))
      WHERE se.event_name = 'page_view'
        AND se.user_id IS NOT NULL
        AND NOT (LOWER(TRIM(se.user_id)) = ANY($1::text[]))
        AND se.created_at >= NOW() - INTERVAL '${intervalSql}'
        ${centerFilter}
      GROUP BY ap.center, ap.actor_type, LOWER(TRIM(se.user_id))
      ORDER BY center ASC, actor_type ASC, usage_count DESC, last_seen DESC
    `,
      [EXCLUDED_ENGAGEMENT_EMAILS],
    )

    type CenterUserDetail = {
      user_id: string
      actor_type: 'teacher' | 'manager'
      usage_count: number
      last_seen: string
    }

    const center_user_details: Record<
      string,
      CenterUserDetail[]
    > = {}
    const center_actor_details: Record<
      string,
      { teachers: CenterUserDetail[]; managers: CenterUserDetail[] }
    > = {}

    for (const r of centerUserDetailRes.rows) {
      const key = r.center
      if (!center_user_details[key]) {
        center_user_details[key] = []
      }
      if (!center_actor_details[key]) {
        center_actor_details[key] = { teachers: [], managers: [] }
      }

      const actorType = r.actor_type === 'manager' ? 'manager' : 'teacher'
      const detail: CenterUserDetail = {
        user_id: r.user_id,
        actor_type: actorType,
        usage_count: parseInt(r.usage_count, 10),
        last_seen: r.last_seen,
      }

      center_user_details[key].push(detail)
      center_actor_details[key][
        actorType === 'manager' ? 'managers' : 'teachers'
      ].push(detail)
    }

    return NextResponse.json({
      dau,
      wau,
      avg_session_duration,
      top_pages,
      devices,
      feature_usage,
      retention,
      online_users,
      user_interaction_ranking,
      manager_interaction_ranking,
      teacher_interaction_ranking,
      center_usage,
      center_user_details,
      center_actor_details,
    })
  } catch (error: any) {
    console.error('[metrics/engagement] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch engagement metrics' },
      { status: 500 },
    )
  }
}

export const GET = withTracking(getEngagement, {
  endpoint: '/api/metrics/engagement',
  requireSuperAdmin: true,
})
