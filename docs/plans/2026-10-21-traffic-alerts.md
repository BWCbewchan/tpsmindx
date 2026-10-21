# TPS traffic alerts implementation plan

Goal: notify TpsLog_bot at >50%, >70%, >90%, >=100% of the measured PostgreSQL connection budget, with distinct active user counts in every message. Never equate teacher count, MAU, or database connections to tested concurrent-user capacity.

Evidence: TPS Supabase project wrlfozuzdblljlxwvbst has max_connections=60 and superuser_reserved_connections=3. Existing session_tracking is not written by current app tracking; authenticated /api/metrics/track writes system_events instead.

1. Add a pure traffic policy and formatter: thresholds, exact percentages, overload and recovery, active users over a clearly stated 15-minute window.
2. Add a small RLS-protected monitor state table for distributed sample throttling, notification leases and successful delivery state. Apply via Supabase and mirror in app migrations.
3. Sample pg_settings/pg_stat_activity and authenticated presence events once per minute across instances. Notify directly through the shared Security bot transport; await delivery using Next after(). Failed delivery stays eligible for a later activity-driven retry.
4. Emit a visible-tab heartbeat every minute through the existing authenticated metrics endpoint. Exclude untrusted API request tracking identities from distinct-user counts.
5. Suppress duplicates for 15 minutes, escalate immediately at the next sample, announce recovery at <=45%. Keep user limits unset until load-tested; show database connection pressure as its own metric.
6. Verify threshold boundaries, cross-instance claims, failed sends, actual Supabase query results, TypeScript and focused tests; push to preview.

Sampling is activity-driven. It is not an independent 24/7 heartbeat, CPU/RAM monitor, full outbox, or a guarantee of delivery when the database itself is unavailable. No synthetic load against production.
