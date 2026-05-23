import pool from '@/lib/db'
import { withTracking } from '@/lib/withTracking'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/metrics/system-health
 * Returns system health indicators for Super Admin dashboard.
 *
 * Only super_admin can call this.
 * Uses system_events + pg_stat_activity for real metrics.
 */
async function getSystemHealth(request: NextRequest) {
  try {
    // ── 1. Concurrent users (distinct users with page_view in last 5 min) ──
    const concurrentRes = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM system_events
      WHERE event_name = 'page_view'
        AND created_at >= NOW() - INTERVAL '5 minutes'
        AND user_id IS NOT NULL
    `)
    const concurrent_users = parseInt(concurrentRes.rows[0]?.cnt || '0', 10)

    // ── 2. DB Connection Usage ──
    let db_usage = 0
    try {
      const dbStatsRes = await pool.query(`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity) AS active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
      `)
      const active = parseInt(dbStatsRes.rows[0]?.active || '0', 10)
      const maxConn = parseInt(dbStatsRes.rows[0]?.max_conn || '100', 10)
      db_usage = maxConn > 0 ? Math.round((active / maxConn) * 100) : 0
    } catch {
      // pg_stat_activity might not be accessible on some hosted DBs
      db_usage = 0
    }

    // ── 3. API Response Time p95 (last 24h) ──
    const p95Res = await pool.query(`
      SELECT 
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (properties->>'response_time')::numeric) AS p95
      FROM system_events
      WHERE event_name = 'api_request'
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND properties->>'response_time' IS NOT NULL
    `)
    const response_time_p95 = Math.round(parseFloat(p95Res.rows[0]?.p95 || '0'))

    // Previous 24h for trend comparison
    const p95PrevRes = await pool.query(`
      SELECT 
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (properties->>'response_time')::numeric) AS p95
      FROM system_events
      WHERE event_name = 'api_request'
        AND created_at >= NOW() - INTERVAL '48 hours'
        AND created_at < NOW() - INTERVAL '24 hours'
        AND properties->>'response_time' IS NOT NULL
    `)
    const response_time_p95_prev = Math.round(
      parseFloat(p95PrevRes.rows[0]?.p95 || '0'),
    )
    const response_time_trend =
      response_time_p95_prev > 0
        ? Math.round(
            ((response_time_p95 - response_time_p95_prev) /
              response_time_p95_prev) *
              100,
          )
        : 0

    // ── 4. Error Rate (last 24h) ──
    const errorRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_name = 'api_request') AS total_requests,
        COUNT(*) FILTER (WHERE event_name = 'error') AS total_errors,
        COUNT(*) FILTER (WHERE event_name = 'error' AND (properties->>'code')::int = 500) AS errors_500,
        COUNT(*) FILTER (WHERE event_name = 'error' AND (properties->>'code')::int = 404) AS errors_404
      FROM system_events
      WHERE event_name IN ('api_request', 'error')
        AND created_at >= NOW() - INTERVAL '24 hours'
    `)
    const totalReq = parseInt(errorRes.rows[0]?.total_requests || '0', 10)
    const totalErrors = parseInt(errorRes.rows[0]?.total_errors || '0', 10)
    const errors500 = parseInt(errorRes.rows[0]?.errors_500 || '0', 10)
    const errors404 = parseInt(errorRes.rows[0]?.errors_404 || '0', 10)

    const error_rate =
      totalReq > 0 ? parseFloat(((totalErrors / totalReq) * 100).toFixed(2)) : 0
    const error_500 =
      totalReq > 0 ? parseFloat(((errors500 / totalReq) * 100).toFixed(2)) : 0
    const error_404 =
      totalReq > 0 ? parseFloat(((errors404 / totalReq) * 100).toFixed(2)) : 0

    // ── 5. Error detail by page/endpoint (last 24h) ──
    const errorByPageRes = await pool.query(`
      WITH scoped AS (
        SELECT
          COALESCE(
            NULLIF(properties->>'page', ''),
            NULLIF(properties->>'endpoint', ''),
            'Unknown'
          ) AS page,
          COUNT(*) FILTER (WHERE event_name = 'error') AS total_errors,
          COUNT(*) FILTER (
            WHERE event_name = 'error'
              AND (properties->>'code') ~ '^[0-9]+$'
              AND (properties->>'code')::int = 500
          ) AS errors_500,
          COUNT(*) FILTER (
            WHERE event_name = 'error'
              AND (properties->>'code') ~ '^[0-9]+$'
              AND (properties->>'code')::int = 404
          ) AS errors_404,
          COUNT(*) FILTER (WHERE event_name = 'api_request') AS total_requests
        FROM system_events
        WHERE event_name IN ('api_request', 'error')
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY 1
      )
      SELECT
        page,
        total_errors,
        errors_500,
        errors_404,
        total_requests,
        CASE
          WHEN total_requests > 0
            THEN ROUND((total_errors::numeric / total_requests) * 100, 2)
          ELSE NULL
        END AS error_rate
      FROM scoped
      WHERE total_errors > 0
      ORDER BY total_errors DESC
      LIMIT 20
    `)

    const error_by_page = errorByPageRes.rows.map((r) => ({
      page: r.page,
      total_errors: parseInt(r.total_errors || '0', 10),
      errors_500: parseInt(r.errors_500 || '0', 10),
      errors_404: parseInt(r.errors_404 || '0', 10),
      total_requests: parseInt(r.total_requests || '0', 10),
      error_rate: r.error_rate !== null ? parseFloat(r.error_rate) : null,
    }))

    return NextResponse.json({
      concurrent_users,
      db_usage,
      response_time_p95,
      response_time_trend,
      error_rate,
      error_500,
      error_404,
      error_by_page,
    })
  } catch (error: any) {
    console.error('[metrics/system-health] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch system health metrics' },
      { status: 500 },
    )
  }
}

export const GET = withTracking(getSystemHealth, {
  endpoint: '/api/metrics/system-health',
  requireSuperAdmin: true,
})
