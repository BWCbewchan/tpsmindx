'use client'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { resolveCenterBuEmail } from '@/lib/center-bu-email-fallback'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

type LeaveBuNoticeProps = {
  className?: string
  /** Tên cơ sở trên phiếu (dùng khi tra DB theo tên). */
  campus?: string | null
  /** `leave_requests.center_id` → tra trực tiếp bảng `centers` (ưu tiên). */
  centerId?: number | null
  /** Snapshot khi gửi phiếu; chỉ dùng khi `centers.email` trống. */
  campusBuEmail?: string | null
}

type CenterPayload = {
  full_name?: string
  display_name?: string | null
  short_code?: string | null
}

function looksLikeEmail(s: string): boolean {
  return /^\S+@\S+\.\S+$/.test(s.trim())
}

function parseCenterContactsPayload(
  data: {
    success?: boolean
    center?: CenterPayload | null
    buEmail?: string | null
  },
  campusLabel: string,
  snapshotEmail: string,
): { name: string | null; email: string | null } | null {
  if (!data?.success || !data.center) return null
  const center = data.center
  const name =
    (typeof center.display_name === 'string' && center.display_name.trim()) ||
    (typeof center.full_name === 'string' && center.full_name.trim()) ||
    (campusLabel ? campusLabel : null)
  /** API: `centers.email` hoặc đã suy ra trên server; nếu vẫn trống thì suy tiếp client (giống form xin nghỉ). */
  const fromCenters =
    typeof data.buEmail === 'string' && data.buEmail.trim()
      ? data.buEmail.trim()
      : null
  const fromSnap = snapshotEmail ? snapshotEmail.trim() : ''
  const resolved =
    fromCenters ||
    fromSnap ||
    resolveCenterBuEmail({
      email: null,
      short_code:
        typeof center.short_code === 'string' ? center.short_code : null,
      full_name: name || campusLabel || '',
    })?.trim() ||
    ''
  const email = resolved || null
  return { name, email }
}

/**
 * Email BU cơ sở: API `center-contacts` (DB + fallback map khi `centers.email` trống).
 */
export function LeaveBuNotice({
  className,
  campus,
  centerId,
  campusBuEmail,
}: LeaveBuNoticeProps) {
  const { token } = useAuth()
  const [fromDb, setFromDb] = useState<{
    name: string | null
    email: string | null
  } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setFromDb(null)
      setLoading(false)
      return
    }

    const c = campus?.trim() ?? ''
    const snap = campusBuEmail?.trim() ?? ''
    const cid =
      centerId != null &&
      Number.isFinite(Number(centerId)) &&
      Number(centerId) > 0
        ? Number(centerId)
        : null

    let cancelled = false
    setLoading(true)
    setFromDb(null)

    const fetchJson = async (url: string) => {
      const res = await fetch(url, {
        headers: authHeaders(token),
        cache: 'no-store',
      })
      return (await res.json()) as {
        success?: boolean
        center?: CenterPayload | null
        buEmail?: string | null
      }
    }

    void (async () => {
      try {
        if (cid != null) {
          const byId = await fetchJson(
            `/api/leave-requests/center-contacts?centerId=${encodeURIComponent(String(cid))}`,
          )
          if (cancelled) return
          const parsed = parseCenterContactsPayload(byId, c, snap)
          if (parsed) {
            setFromDb(parsed)
            return
          }
        }

        if (c) {
          const byName = await fetchJson(
            `/api/leave-requests/center-contacts?fullName=${encodeURIComponent(c)}`,
          )
          if (cancelled) return
          const parsed = parseCenterContactsPayload(byName, c, snap)
          if (parsed) {
            setFromDb(parsed)
            return
          }
        }

        if (!cancelled) {
          if (snap) {
            setFromDb({ name: c || null, email: snap })
          } else if (c) {
            const byLabel = resolveCenterBuEmail({ full_name: c })?.trim() || ''
            setFromDb(byLabel ? { name: c, email: byLabel } : null)
          } else {
            setFromDb(null)
          }
        }
      } catch {
        if (!cancelled) {
          if (snap) {
            setFromDb({ name: c || null, email: snap })
          } else if (c) {
            const byLabel = resolveCenterBuEmail({ full_name: c })?.trim() || ''
            setFromDb(byLabel ? { name: c, email: byLabel } : null)
          } else {
            setFromDb(null)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [campus, campusBuEmail, centerId, token])

  const loadingCampus = Boolean(
    loading && (Boolean(campus?.trim()) || centerId != null),
  )
  const rawEmail = (!loadingCampus && fromDb?.email?.trim()) || ''
  const displayName = loadingCampus
    ? 'Đang tải…'
    : fromDb?.name?.trim() || campus?.trim() || 'Chưa xác định cơ sở'
  const displayEmail = loadingCampus
    ? '…'
    : rawEmail ||
      'Chưa có email BU — cập nhật cột email trong quản trị hoặc map short_code/tên cơ sở.'

  const matchedCenter = Boolean(fromDb && (fromDb.name || fromDb.email))

  const showMailto = !loadingCampus && rawEmail.length > 0 && looksLikeEmail(rawEmail)

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800',
        className,
      )}
      role="region"
      aria-label="Email BU cơ sở"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Email BU (cơ sở)
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Tên cơ sở:{' '}
        <span className="text-sm font-medium text-slate-900">{displayName}</span>
      </p>
      <p className="mt-1 text-xs text-slate-600 break-all">
        Email BU:{' '}
        {loadingCampus ? (
          <span className="text-sm font-medium text-slate-500">{displayEmail}</span>
        ) : showMailto ? (
          <a
            href={`mailto:${rawEmail}`}
            className="text-sm font-medium text-[#1152D4] underline underline-offset-2 hover:text-[#0d45b0]"
          >
            {rawEmail}
          </a>
        ) : (
          <span className="text-sm font-medium text-slate-700">{displayEmail}</span>
        )}
      </p>
      {matchedCenter && campus?.trim() && !loadingCampus && (
        <p className="mt-2 text-[11px] text-slate-500">
          Theo phiếu — cơ sở: {campus.trim()}
        </p>
      )}
    </div>
  )
}
