export type QCWindowStatus = 'available' | 'upcoming' | 'expired' | 'missing-time'

export type QCWindowInfo = {
  canCreateQC: boolean
  qcWindowStatus: QCWindowStatus
  availableFrom: string | null
  availableUntil: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function parseDate(value: unknown): Date | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getQCWindowInfo(
  session: {
    date?: unknown
    startTime?: unknown
    endTime?: unknown
    sessionHour?: unknown
  },
  now = new Date(),
): QCWindowInfo {
  const start = parseDate(session.startTime) ?? parseDate(session.date)
  let end = parseDate(session.endTime)
  const sessionHour = Number(session.sessionHour)

  if (!end && start && Number.isFinite(sessionHour) && sessionHour > 0) {
    end = new Date(start.getTime() + sessionHour * HOUR_MS)
  }

  if (!start || !end) {
    return {
      canCreateQC: false,
      qcWindowStatus: 'missing-time',
      availableFrom: start?.toISOString() ?? null,
      availableUntil: null,
    }
  }

  const availableFrom = new Date(start.getTime() - DAY_MS)
  const availableUntil = new Date(end.getTime() + DAY_MS)
  const nowTime = now.getTime()
  const fromTime = availableFrom.getTime()
  const untilTime = availableUntil.getTime()

  return {
    canCreateQC: nowTime >= fromTime && nowTime <= untilTime,
    qcWindowStatus:
      nowTime < fromTime ? 'upcoming' : nowTime > untilTime ? 'expired' : 'available',
    availableFrom: availableFrom.toISOString(),
    availableUntil: availableUntil.toISOString(),
  }
}
