import { randomUUID } from 'node:crypto';
import { telegramHtml } from './telegram-delivery.mjs';

export const TRAFFIC_MONITOR_SCHEMA = `
  CREATE TABLE IF NOT EXISTS public.tps_traffic_monitor_state (
    monitor_key text PRIMARY KEY,
    checked_at timestamptz NOT NULL DEFAULT '-infinity',
    notified_tier integer NOT NULL DEFAULT 0,
    notified_at timestamptz,
    delivery_token uuid,
    delivery_until timestamptz,
    sample jsonb,
    last_alert jsonb
  );
  ALTER TABLE public.tps_traffic_monitor_state ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.tps_traffic_monitor_state FROM anon, authenticated;
`;

// A connection budget is NOT a tested concurrent-user capacity.
export const TRAFFIC_SAMPLE_SQL = `
  SELECT
    current_setting('max_connections')::int AS max_connections,
    current_setting('superuser_reserved_connections')::int
      + COALESCE(current_setting('reserved_connections', true), '0')::int AS reserved_connections,
    (SELECT count(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend') AS connections,
    (SELECT count(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend' AND state = 'active') AS busy_connections,
    (SELECT count(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend' AND state = 'idle') AS idle_connections,
    (SELECT count(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend' AND wait_event_type = 'Lock') AS lock_waiters,
    (SELECT count(DISTINCT lower(trim(user_id)))::int FROM public.system_events
      WHERE created_at > now() - interval '15 minutes'
        AND event_name IN ('page_view', 'session_start', 'session_heartbeat')
        AND nullif(trim(user_id), '') IS NOT NULL) AS active_users
`;

export function trafficTier(percent) {
  if (!Number.isFinite(percent) || percent < 0) throw new Error('Invalid traffic percentage');
  if (percent >= 100) return 100 + Math.floor((percent - 100) / 25) * 25;
  if (percent > 90) return 90;
  if (percent > 70) return 70;
  if (percent > 50) return 50;
  return 0;
}

export function trafficSample(row) {
  const maxConnections = Number(row.max_connections), reservedConnections = Number(row.reserved_connections);
  const connections = Number(row.connections), activeUsers = Number(row.active_users);
  const budget = maxConnections - reservedConnections;
  if (![maxConnections, reservedConnections, connections, activeUsers].every(Number.isFinite)
    || budget <= 0 || Math.min(connections, activeUsers, reservedConnections) < 0) throw new Error('Invalid traffic sample');
  const percent = connections / budget * 100;
  return { activeUsers, maxConnections, reservedConnections, connections, budget, percent,
    tier: trafficTier(percent), busyConnections: Number(row.busy_connections || 0),
    idleConnections: Number(row.idle_connections || 0), lockWaiters: Number(row.lock_waiters || 0) };
}

export function formatTrafficAlert(sample) {
  const recovery = sample.tier === 0;
  const icon = recovery ? '✅' : sample.tier >= 100 ? '🚨' : sample.tier >= 90 ? '🔴' : sample.tier >= 70 ? '🟠' : '🟡';
  const overload = Math.max(0, sample.connections - sample.budget);
  return [
    `${icon} <b>[TPS] ${recovery ? 'Tải database đã giảm' : `Cảnh báo tải database — mốc ${sample.tier}%`}</b>`,
    `👥 Người hoạt động trong 15 phút: <b>${sample.activeUsers}</b> (đếm tài khoản, không cộng trùng tab).`,
    `🔌 Kết nối database: <b>${sample.connections}/${sample.budget} (${sample.percent.toFixed(1)}%)</b>`,
    `Giới hạn PostgreSQL: ${sample.maxConnections}; dành riêng: ${sample.reservedConnections}.`,
    `Đang xử lý: ${sample.busyConnections} · Idle: ${sample.idleConnections} · Chờ khóa: ${sample.lockWaiters}.`,
    overload > 0 ? `Vượt ngân sách kết nối: <b>${overload}</b> (${(sample.percent - 100).toFixed(1)}%).` : '',
    recovery ? 'Đã xuống ngưỡng phục hồi ≤45%.'
      : sample.tier >= 90 ? 'Cần kiểm tra ngay query chậm, kết nối idle và connection pool; cân nhắc nâng compute sau khi xác định nút thắt.'
        : 'Theo dõi truy vấn chậm và connection pool để xử lý trước khi chạm giới hạn.',
    'Phần trăm trên là mức dùng kết nối DB, không phải CPU/RAM hoặc sức chịu tải tối đa theo số người.',
    `Thời gian: ${telegramHtml(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }))}`,
  ].filter(Boolean).join('\n');
}

/** @param {{ query: (sql: string, values?: any[]) => Promise<{rows: any[]}>, send: (text: string) => Promise<unknown>, clock?: () => number }} deps */
export function createTrafficMonitor({ query, send, clock = Date.now }) {
  let nextCheck = 0, inFlight = false;
  return async function check() {
    if (inFlight || clock() < nextCheck) return { status: 'throttled', notified: false };
    inFlight = true;
    let token;
    try {
      const claim = await query(`/* traffic:sample-claim */
        INSERT INTO public.tps_traffic_monitor_state (monitor_key, checked_at) VALUES ('database', now())
        ON CONFLICT (monitor_key) DO UPDATE SET checked_at = now()
        WHERE tps_traffic_monitor_state.checked_at < now() - interval '1 minute'
        RETURNING monitor_key`);
      nextCheck = clock() + 60_000;
      if (!claim.rows.length) return { status: 'throttled', notified: false };
      const metrics = await query(TRAFFIC_SAMPLE_SQL);
      const sample = trafficSample(metrics.rows[0] || {});
      const candidate = randomUUID();
      // Escalation bypasses the reminder cooldown. The lease serializes sends.
      const delivery = await query(`/* traffic:delivery-claim */
        UPDATE public.tps_traffic_monitor_state SET sample = $1::jsonb,
          delivery_token = CASE WHEN
            (delivery_until IS NULL OR delivery_until < now()) AND
            ($2 > notified_tier OR ($2 = 0 AND notified_tier > 0 AND $3::double precision <= 45)
              OR ($2 > 0 AND (notified_at IS NULL OR notified_at < now() - interval '15 minutes')))
            THEN $4::uuid ELSE delivery_token END,
          delivery_until = CASE WHEN
            (delivery_until IS NULL OR delivery_until < now()) AND
            ($2 > notified_tier OR ($2 = 0 AND notified_tier > 0 AND $3::double precision <= 45)
              OR ($2 > 0 AND (notified_at IS NULL OR notified_at < now() - interval '15 minutes')))
            THEN now() + interval '90 seconds' ELSE delivery_until END
        WHERE monitor_key = 'database' RETURNING delivery_token`,
      [JSON.stringify(sample), sample.tier, sample.percent, candidate]);
      if (delivery.rows[0]?.delivery_token !== candidate) return { status: 'sampled', sample, notified: false };
      token = candidate;
      await send(formatTrafficAlert(sample));
      await query(`/* traffic:delivered */ UPDATE public.tps_traffic_monitor_state
        SET notified_tier = $1, notified_at = now(), last_alert = $2::jsonb,
          delivery_token = NULL, delivery_until = NULL
        WHERE monitor_key = 'database' AND delivery_token = $3::uuid`,
      [sample.tier, JSON.stringify(sample), token]);
      return { status: 'sampled', sample, notified: true };
    } catch (error) {
      if (token) await query(`/* traffic:release */ UPDATE public.tps_traffic_monitor_state
        SET delivery_token = NULL, delivery_until = NULL
        WHERE monitor_key = 'database' AND delivery_token = $1::uuid`, [token]).catch(() => {});
      // An unknown DB state is never reported as zero users / healthy.
      throw error;
    } finally { inFlight = false; }
  };
}
