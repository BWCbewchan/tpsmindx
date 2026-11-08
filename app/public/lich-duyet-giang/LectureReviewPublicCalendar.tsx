'use client'

import { cn } from '@/lib/utils'
import {
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Loader2,
  MapPin,
  RefreshCcw,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

type CalendarRegistration = {
  review_date: string
  candidate_name: string
  manager_leader_name: string
  center_name: string
  reviewer_name: string
  teaching_block: string
}

type CalendarDay = {
  date: Date
  key: string
  currentMonth: boolean
  today: boolean
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const BLOCK_META: Record<
  string,
  { label: string; chip: string; dot: string; card: string }
> = {
  coding: {
    label: 'Coding',
    chip: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    card: 'border-l-rose-500 hover:bg-rose-50/70',
  },
  art: {
    label: 'Art',
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    card: 'border-l-amber-500 hover:bg-amber-50/70',
  },
  robotics: {
    label: 'Robotics',
    chip: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    card: 'border-l-sky-500 hover:bg-sky-50/70',
  },
  age_4_plus: {
    label: '4+',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    card: 'border-l-emerald-500 hover:bg-emerald-50/70',
  },
}

function blockMeta(value: string) {
  return (
    BLOCK_META[value] || {
      label: value || 'Chưa xác định',
      chip: 'border-slate-200 bg-slate-50 text-slate-700',
      dot: 'bg-slate-400',
      card: 'border-l-slate-400 hover:bg-slate-50',
    }
  )
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonth(value: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function monthLabel(date: Date): string {
  const value = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1)
}

function fullDateLabel(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDate(value))
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  const today = dateKey(new Date())

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      key: dateKey(date),
      currentMonth: date.getMonth() === month.getMonth(),
      today: dateKey(date) === today,
    }
  })
}

export function LectureReviewPublicCalendar() {
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [rows, setRows] = useState<CalendarRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    const requestedMonth = parseMonth(
      new URLSearchParams(window.location.search).get('month'),
    )
    if (requestedMonth) setCurrentMonth(requestedMonth)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/public/lecture-review-calendar?month=${monthKey(currentMonth)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Không thể tải lịch duyệt giảng')
        }
        return (payload.data?.rows || []) as CalendarRegistration[]
      })
      .then(setRows)
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setRows([])
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Không thể tải lịch duyệt giảng',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [currentMonth, refreshSignal])

  useEffect(() => {
    if (!selectedDate) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDate(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedDate])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarRegistration[]>()
    rows.forEach((row) => {
      const current = grouped.get(row.review_date) || []
      current.push(row)
      grouped.set(row.review_date, current)
    })
    return grouped
  }, [rows])

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth],
  )

  const activeDates = useMemo(
    () => Array.from(eventsByDate.keys()).sort(),
    [eventsByDate],
  )

  const blockCounts = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((row) => {
      counts.set(row.teaching_block, (counts.get(row.teaching_block) || 0) + 1)
    })
    return counts
  }, [rows])

  const selectedRows = selectedDate
    ? eventsByDate.get(selectedDate) || []
    : []

  const moveMonth = useCallback((amount: number) => {
    setSelectedDate(null)
    setCurrentMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + amount, 1)
      const url = new URL(window.location.href)
      url.searchParams.set('month', monthKey(next))
      window.history.replaceState({}, '', url)
      return next
    })
  }, [])

  const goToday = useCallback(() => {
    const today = new Date()
    const next = new Date(today.getFullYear(), today.getMonth(), 1)
    const url = new URL(window.location.href)
    url.searchParams.set('month', monthKey(next))
    window.history.replaceState({}, '', url)
    setSelectedDate(null)
    setCurrentMonth(next)
  }, [])

  return (
    <div className="portfolio-theme min-h-screen bg-[#f5f3ee] text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-40 -top-52 h-[34rem] w-[34rem] rounded-full bg-[#b00020]/8 blur-3xl" />
        <div className="absolute -bottom-64 -left-48 h-[38rem] w-[38rem] rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#0f172a_1px,transparent_1px),linear-gradient(90deg,#0f172a_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <main className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <header className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#b00020]/15 bg-[#fff5f7] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#a1001f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b00020]" />
                Public calendar · TPS
              </div>
              <div className="flex items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg sm:flex">
                  <BookOpenCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="portfolio-heading text-3xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                    Lịch duyệt giảng
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    Theo dõi ứng viên, khối giảng dạy, Leader/TE phụ trách và giáo viên đăng ký theo từng ngày.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToday}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Hôm nay
              </button>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="Tháng trước"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-44 px-3 text-center text-sm font-extrabold text-slate-900">
                  {monthLabel(currentMonth)}
                </div>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="Tháng sau"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                aria-label="Làm mới lịch"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          <div className="grid border-t border-slate-100 sm:grid-cols-[220px_1fr]">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:border-b-0 sm:border-r sm:px-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-extrabold leading-none text-slate-950">{rows.length}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">lượt duyệt trong tháng</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-7">
              {Object.entries(BLOCK_META).map(([value, meta]) => (
                <div key={value} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                  <span className="font-semibold">{meta.label}</span>
                  <span className="font-extrabold text-slate-950">{blockCounts.get(value) || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]">
          {loading ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-[#b00020]" />
              <p className="text-sm font-semibold">Đang tải lịch duyệt giảng...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Không thể tải lịch</h2>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-950">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="border-r border-white/10 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300 last:border-r-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    const dayEvents = eventsByDate.get(day.key) || []
                    return (
                      <div
                        key={day.key}
                        className={cn(
                          'min-h-44 border-b border-r border-slate-200 p-2.5',
                          (index + 1) % 7 === 0 && 'border-r-0',
                          index >= calendarDays.length - 7 && 'border-b-0',
                          day.currentMonth ? 'bg-white' : 'bg-slate-50/65',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-extrabold',
                              day.today
                                ? 'bg-[#b00020] text-white shadow-sm'
                                : day.currentMonth
                                  ? 'text-slate-700'
                                  : 'text-slate-300',
                            )}
                          >
                            {day.date.getDate()}
                          </span>
                          {dayEvents.length ? (
                            <span className="text-[10px] font-bold text-slate-400">
                              {dayEvents.length} lịch
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          {dayEvents.slice(0, 3).map((event, eventIndex) => {
                            const meta = blockMeta(event.teaching_block)
                            return (
                              <button
                                key={`${day.key}-${event.candidate_name}-${eventIndex}`}
                                type="button"
                                onClick={() => setSelectedDate(day.key)}
                                className={cn(
                                  'w-full rounded-lg border border-slate-200 border-l-[3px] bg-white px-2 py-2 text-left transition',
                                  meta.card,
                                )}
                              >
                                <span className="block truncate text-xs font-extrabold text-slate-900">
                                  {event.candidate_name}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-semibold text-slate-500">
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
                                  {meta.label} · {event.manager_leader_name}
                                </span>
                                <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                                  GV: {event.reviewer_name}
                                </span>
                              </button>
                            )
                          })}
                          {dayEvents.length > 3 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDate(day.key)}
                              className="w-full rounded-lg py-1.5 text-center text-[11px] font-bold text-[#a1001f] transition hover:bg-rose-50"
                            >
                              +{dayEvents.length - 3} thí sinh khác
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="lg:hidden">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-900">Lịch theo ngày</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Chạm vào từng ứng viên để xem đầy đủ thông tin.</p>
                </div>
                {activeDates.length ? (
                  <div className="divide-y divide-slate-100">
                    {activeDates.map((date) => (
                      <div key={date} className="px-4 py-5 sm:px-6">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-extrabold capitalize text-slate-900">
                            {fullDateLabel(date)}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                            {eventsByDate.get(date)?.length || 0} lịch
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(eventsByDate.get(date) || []).map((event, eventIndex) => {
                            const meta = blockMeta(event.teaching_block)
                            return (
                              <button
                                key={`${date}-${event.candidate_name}-${eventIndex}`}
                                type="button"
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                  'rounded-xl border border-slate-200 border-l-4 bg-white p-3 text-left transition',
                                  meta.card,
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-extrabold text-slate-900">{event.candidate_name}</span>
                                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', meta.chip)}>
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="mt-2 truncate text-xs font-semibold text-slate-600">
                                  Leader/TE: {event.manager_leader_name}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  Giáo viên: {event.reviewer_name}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 font-bold text-slate-900">Tháng này chưa có lịch duyệt</h2>
                    <p className="mt-1 text-sm text-slate-500">Bạn có thể chuyển sang tháng khác để xem lịch.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <p className="mt-5 text-center text-xs font-medium text-slate-500">
          Lịch được đồng bộ từ Teaching Portal System · Dữ liệu có thể thay đổi theo đăng ký mới nhất
        </p>
      </main>

      {selectedDate ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDate(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lecture-review-dialog-title"
            className="max-h-[88vh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b00020]">Chi tiết lịch duyệt</p>
                <h2 id="lecture-review-dialog-title" className="portfolio-heading mt-1 text-xl font-extrabold capitalize text-slate-950">
                  {fullDateLabel(selectedDate)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{selectedRows.length} ứng viên đăng ký</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                aria-label="Đóng chi tiết"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-112px)] space-y-3 overflow-y-auto p-4 sm:p-6">
              {selectedRows.map((event, index) => {
                const meta = blockMeta(event.teaching_block)
                return (
                  <article key={`${selectedDate}-${event.candidate_name}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-extrabold text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold text-slate-950">{event.candidate_name}</h3>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">Ứng viên duyệt giảng</p>
                        </div>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold', meta.chip)}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <InfoItem icon={<UsersRound className="h-4 w-4" />} label="Leader/TE quản lý" value={event.manager_leader_name} />
                      <InfoItem icon={<UserRound className="h-4 w-4" />} label="Giáo viên đăng ký" value={event.reviewer_name} />
                      <InfoItem icon={<MapPin className="h-4 w-4" />} label="Cơ sở" value={event.center_name} />
                      <InfoItem icon={<Layers3 className="h-4 w-4" />} label="Khối giảng dạy" value={meta.label} />
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-700">{value || '-'}</p>
      </div>
    </div>
  )
}
