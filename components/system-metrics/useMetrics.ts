import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const REFRESH_INTERVAL = 30_000 // 30 seconds

// ── System Health ────────────────────────────────────

export interface SystemHealthData {
  concurrent_users: number
  db_usage: number
  response_time_p95: number
  response_time_trend: number
  error_rate: number
  error_500: number
  error_404: number
  error_by_page: Array<{
    page: string
    total_errors: number
    errors_500: number
    errors_404: number
    total_requests: number
    error_rate: number | null
  }>
}

export function useSystemHealth(requestEmail?: string) {
  const endpoint = requestEmail
    ? `/api/metrics/system-health?requestEmail=${encodeURIComponent(requestEmail)}`
    : null

  return useSWR<SystemHealthData>(endpoint, fetcher, {
    refreshInterval: REFRESH_INTERVAL,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  })
}

// ── Engagement ────────────────────────────────────────

export interface EngagementData {
  dau: Array<{ date: string; users: number }>
  wau: Array<{ date: string; users: number }>
  avg_session_duration: number
  top_pages: Array<{ page: string; views: number; percentage: number }>
  devices: { mobile: number; desktop: number }
  feature_usage: Array<{
    feature: string
    usage_count: number
    unique_users: number
  }>
  retention: { d1: number; d7: number; d30: number }
  online_users: Array<{
    user_id: string
    last_seen: string
    hits_5m: number
  }>
  user_interaction_ranking: Array<{
    rank: number
    user_id: string
    interactions: number
    active_days: number
    interactions_per_day: number
  }>
  center_usage: Array<{
    center: string
    users: number
    usage_count: number
    usage_per_user: number
  }>
  center_user_details: Record<
    string,
    Array<{
      user_id: string
      usage_count: number
      last_seen: string
    }>
  >
}

export function useEngagement(period: string, requestEmail?: string) {
  const endpoint = requestEmail
    ? `/api/metrics/engagement?period=${period}&requestEmail=${encodeURIComponent(requestEmail)}`
    : null

  return useSWR<EngagementData>(endpoint, fetcher, {
    refreshInterval: REFRESH_INTERVAL,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  })
}
