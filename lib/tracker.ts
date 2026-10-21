/**
 * Client-side event tracking for System Metrics Dashboard.
 * Batches events and sends them every 30s or when the buffer exceeds 20 items.
 */

const FLUSH_INTERVAL = 30_000
const FLUSH_THRESHOLD = 20

interface TrackEvent {
  event_name: string
  user_id?: string
  session_id?: string
  timestamp: number
  properties?: Record<string, unknown>
}

let buffer: TrackEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let sessionId: string | null = null
let lastHeartbeat = 0

// ── Session management ───────────────────────────────

function generateSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  if (sessionId) return sessionId

  const stored = sessionStorage.getItem('tps_session_id')
  if (stored) {
    sessionId = stored
    return stored
  }

  sessionId = generateSessionId()
  sessionStorage.setItem('tps_session_id', sessionId)
  return sessionId
}

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return ''
    const u = JSON.parse(raw)
    return u.email || ''
  } catch {
    return ''
  }
}

// ── Device detection ─────────────────────────────────

export function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  )
    ? 'mobile'
    : 'desktop'
}

// ── Core tracking ────────────────────────────────────

function enqueue(event: TrackEvent) {
  buffer.push(event)
  if (buffer.length >= FLUSH_THRESHOLD) {
    void flush()
  }
}

async function flush() {
  if (buffer.length === 0) return
  const batch = [...buffer]
  buffer = []

  try {
    await fetch('/api/metrics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
  } catch {
    // Re-queue on failure (drop if it keeps failing to avoid memory leaks)
    if (buffer.length < 100) {
      buffer.push(...batch)
    }
  }
}

function flushOnPageHide() {
  void flush()
}

function flushOnVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void flush()
  }
}

// ── Public API ────────────────────────────────────────

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  enqueue({
    event_name: name,
    user_id: getUserId(),
    session_id: getSessionId(),
    timestamp: Date.now(),
    properties: {
      ...properties,
      device: getDeviceType(),
    },
  })
}

export function trackPageView(page: string) {
  trackEvent('page_view', { page })
}

export function trackSessionStart() {
  trackEvent('session_start')
}

export function trackSessionEnd() {
  trackEvent('session_end')
  void flush()
}

export function trackApiRequest(
  endpoint: string,
  status: number,
  responseTime: number,
) {
  trackEvent('api_request', { endpoint, status, response_time: responseTime })
}

export function trackError(code: number, message: string) {
  const page =
    typeof window !== 'undefined' ? window.location.pathname : undefined
  trackEvent('error', { code, message, page })
}

export function trackFeatureUsage(feature: string) {
  trackEvent(feature)
}

// ── Lifecycle ─────────────────────────────────────────

export function startTracker() {
  if (typeof window === 'undefined') return
  if (flushTimer) return

  flushTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastHeartbeat >= 60_000) {
        lastHeartbeat = Date.now()
        trackEvent('session_heartbeat')
      }
      void flush()
    }
  }, FLUSH_INTERVAL)

  window.addEventListener('pagehide', flushOnPageHide)
  document.addEventListener('visibilitychange', flushOnVisibilityChange)
}

export function stopTracker() {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  window.removeEventListener('pagehide', flushOnPageHide)
  document.removeEventListener('visibilitychange', flushOnVisibilityChange)
  void flush()
}
