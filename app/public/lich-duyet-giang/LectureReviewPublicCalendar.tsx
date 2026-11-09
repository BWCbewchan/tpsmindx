'use client'

import { cn } from '@/lib/utils'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
    card: 'border-rose-200 border-l-rose-500 bg-rose-50/60 hover:bg-rose-50',
  },
  art: {
    label: 'Art',
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    card: 'border-amber-200 border-l-amber-500 bg-amber-50/60 hover:bg-amber-50',
  },
  robotics: {
    label: 'Robotics',
    chip: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    card: 'border-sky-200 border-l-sky-500 bg-sky-50/60 hover:bg-sky-50',
  },
  age_4_plus: {
    label: '4+',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    card: 'border-emerald-200 border-l-emerald-500 bg-emerald-50/60 hover:bg-emerald-50',
  },
}

function blockMeta(value: string) {
  return (
    BLOCK_META[value] || {
      label: value || 'Chưa xác định',
      chip: 'border-slate-200 bg-slate-50 text-slate-700',
      dot: 'bg-slate-400',
      card: 'border-slate-200 border-l-slate-400 bg-slate-50 hover:bg-slate-100/70',
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
    <div className="min-h-screen bg-gray-50/70 text-gray-900">
      <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Lịch duyệt giảng</h1>
            <p className="mt-1 text-sm leading-5 text-gray-500">
              Theo dõi lịch đăng ký của ứng viên theo từng ngày trong tháng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Hôm nay
            </button>
            <div className="flex h-9 items-center rounded-lg border border-gray-300 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Tháng trước"
                className="flex h-full w-9 items-center justify-center rounded-l-lg text-gray-600 transition hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-40 border-x border-gray-200 px-3 text-center text-sm font-medium text-gray-700">
                {monthLabel(currentMonth)}
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Tháng sau"
                className="flex h-full w-9 items-center justify-center rounded-r-lg text-gray-600 transition hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRefreshSignal((value) => value + 1)}
              aria-label="Làm mới lịch"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50"
            >
              <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a1001f] text-white">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none text-gray-900">{rows.length}</p>
                <p className="mt-1 text-xs text-gray-500">lượt duyệt trong tháng</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {Object.entries(BLOCK_META).map(([value, meta]) => (
                <div key={value} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                  <span>{meta.label}</span>
                  <span className="font-medium text-gray-900">{blockCounts.get(value) || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 className="h-7 w-7 animate-spin text-[#b00020]" />
              <p className="text-sm">Đang tải lịch duyệt giảng...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-medium text-gray-900">Không thể tải lịch</h2>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#870019]"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="flex h-10 items-center justify-center border-r border-gray-200 text-xs font-medium text-gray-600 last:border-r-0"
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
                        onClick={() => day.currentMonth && setSelectedDate(day.key)}
                        className={cn(
                          'min-h-[128px] border-b border-r border-gray-200 p-2 transition-colors xl:min-h-[142px]',
                          (index + 1) % 7 === 0 && 'border-r-0',
                          index >= calendarDays.length - 7 && 'border-b-0',
                          day.currentMonth
                            ? 'cursor-pointer bg-white hover:bg-gray-50/70'
                            : 'bg-gray-50/60',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium',
                              day.today
                                ? 'bg-[#a1001f] text-white'
                                : day.currentMonth
                                  ? 'text-gray-700'
                                  : 'text-gray-300',
                            )}
                          >
                            {day.date.getDate()}
                          </span>
                          {dayEvents.length ? (
                            <span className="text-[10px] text-gray-400">
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
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation()
                                  setSelectedDate(day.key)
                                }}
                                className={cn(
                                  'w-full rounded-md border border-l-[3px] px-2 py-1.5 text-left transition-colors',
                                  meta.card,
                                )}
                              >
                                <span className="block truncate text-xs font-medium text-gray-900">
                                  {event.candidate_name}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-gray-600">
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
                                  {meta.label} · {event.manager_leader_name}
                                </span>
                                <span className="mt-0.5 block truncate text-[10px] text-gray-500">
                                  GV: {event.reviewer_name}
                                </span>
                              </button>
                            )
                          })}
                          {dayEvents.length > 3 ? (
                            <button
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                setSelectedDate(day.key)
                              }}
                              className="w-full rounded-md py-1 text-center text-[11px] font-medium text-[#a1001f] transition hover:bg-rose-50"
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
                <div className="border-b border-gray-200 px-4 py-3">
                  <h2 className="text-sm font-medium text-gray-900">Lịch theo ngày</h2>
                  <p className="mt-0.5 text-xs text-gray-500">Chạm vào ứng viên để xem chi tiết.</p>
                </div>
                {activeDates.length ? (
                  <div className="divide-y divide-gray-200">
                    {activeDates.map((date) => (
                      <div key={date} className="px-4 py-4 sm:px-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-medium capitalize text-gray-900">
                            {fullDateLabel(date)}
                          </h3>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] text-gray-600">
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
                                  'rounded-lg border border-l-[3px] p-3 text-left transition-colors',
                                  meta.card,
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-gray-900">{event.candidate_name}</span>
                                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.chip)}>
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="mt-2 truncate text-xs text-gray-600">
                                  Leader/TE: {event.manager_leader_name}
                                </p>
                                <p className="mt-1 truncate text-xs text-gray-500">
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 text-sm font-medium text-gray-900">Tháng này chưa có lịch duyệt</h2>
                    <p className="mt-1 text-sm text-gray-500">Bạn có thể chuyển sang tháng khác để xem lịch.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <p className="mt-3 text-center text-xs text-gray-400">
          Dữ liệu được đồng bộ theo đăng ký mới nhất trên Teaching Portal System.
        </p>
      </main>

      {selectedDate ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDate(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lecture-review-dialog-title"
            className="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-[#a1001f] px-5 py-4">
              <div>
                <h2 id="lecture-review-dialog-title" className="text-base font-semibold text-white">
                  Lịch duyệt giảng trong ngày
                </h2>
                <p className="mt-0.5 text-xs capitalize text-white/80">
                  {fullDateLabel(selectedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                aria-label="Đóng chi tiết"
                className="rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-80px)] overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ứng viên đăng ký
                </p>
                <span className="text-xs text-gray-500">{selectedRows.length} lịch</span>
              </div>

              {selectedRows.length ? (
                <div className="space-y-3">
                  {selectedRows.map((event, index) => {
                    const meta = blockMeta(event.teaching_block)
                    return (
                      <article key={`${selectedDate}-${event.candidate_name}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#a1001f]/10 text-sm font-medium text-[#a1001f]">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-gray-900">{event.candidate_name}</h3>
                              <p className="mt-0.5 text-xs text-gray-500">Ứng viên duyệt giảng</p>
                            </div>
                          </div>
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.chip)}>
                            {meta.label}
                          </span>
                        </div>

                        <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                          <InfoItem icon={<UsersRound className="h-4 w-4" />} label="Leader/TE quản lý" value={event.manager_leader_name} />
                          <InfoItem icon={<UserRound className="h-4 w-4" />} label="Giáo viên đăng ký" value={event.reviewer_name} />
                          <InfoItem icon={<MapPin className="h-4 w-4" />} label="Cơ sở" value={event.center_name} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <p className="py-2 text-sm italic text-gray-400">
                  Không có ứng viên duyệt giảng trong ngày này.
                </p>
              )}
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
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-800">{value || '-'}</p>
      </div>
    </div>
  )
}
