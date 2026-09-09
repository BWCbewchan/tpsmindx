'use client'

import { PageHeader } from '@/components/PageHeader'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  ALL_MANAGE_SUBJECT_OPTIONS,
  MANAGE_SUBJECT_OPTIONS,
  TRACKS,
  type TrialTrack,
} from '@/lib/trial-checkout-rubrics'
import {
  CalendarDays,
  ClipboardCheck,
  Eraser,
  ExternalLink,
  FilePlus2,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import type { ElementType } from 'react'
import { useEffect, useMemo, useState } from 'react'

type CenterOption = {
  id: number
  region: string | null
  short_code: string | null
  full_name: string
}

type CheckoutContext = {
  centers: CenterOption[]
}

type CheckoutRow = {
  id: number
  submitted_at: string
  teacher_email: string
  teacher_code: string | null
  trial_teacher_name: string
  sales_owner_name: string
  student_name: string
  student_age_label: string
  trial_date: string
  track: TrialTrack
  trial_subject: string
  center_name: string
  total_score: string | number
  case_result: string
  general_comment: string
  evidence_link: string | null
  public_token: string | null
  rubric_type: string
}

type Filters = {
  teacher: string
  student: string
  center: string
  track: '' | TrialTrack
  subject: string
  fromDate: string
  toDate: string
}

const INITIAL_FILTERS: Filters = {
  teacher: '',
  student: '',
  center: '',
  track: '',
  subject: '',
  fromDate: '',
  toDate: '',
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function monthRange(date: Date): { fromDate: string; toDate: string } {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    fromDate: localDateString(first),
    toDate: localDateString(last),
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const raw = String(value).slice(0, 10)
  const [year, month, day] = raw.split('-')
  if (!year || !month || !day) return raw
  return `${day}/${month}/${year}`
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatScore(value: string | number | null | undefined): string {
  if (value == null || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return number.toFixed(2)
}

function caseResultClass(value: string) {
  if (!value) return 'bg-slate-500/15 text-slate-300 ring-slate-500/25'
  if (value === 'Pass') return 'bg-green-500/15 text-green-300 ring-green-500/25'
  if (value === 'Fail') return 'bg-red-500/15 text-red-300 ring-red-500/25'
  if (value === '4 tháng') return 'bg-orange-500/15 text-orange-300 ring-orange-500/25'
  return 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
}

function checkoutLink(row: CheckoutRow): { href: string; label: string } | null {
  const tokenOrId = row.public_token || String(row.id)
  if (!tokenOrId) {
    return null
  }

  return {
    href: `/public/checkout/${encodeURIComponent(tokenOrId)}`,
    label: 'Xem form',
  }
}

function FilterLabel({
  icon: Icon,
  children,
}: {
  icon: ElementType
  children: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-[#c7d2fe]">
      <Icon className="h-4 w-4 text-[#ff9f1c]" />
      {children}
    </label>
  )
}

export default function UserCheckoutManagePage() {
  const { token, user } = useAuth()
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [rows, setRows] = useState<CheckoutRow[]>([])
  const [total, setTotal] = useState(0)
  const [context, setContext] = useState<CheckoutContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContext, setIsLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    if (!user?.email) return
    const controller = new AbortController()
    setIsLoadingContext(true)

    fetch('/api/user/checkout/context', {
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Không thể tải danh sách cơ sở')
        }
        return payload.data as CheckoutContext
      })
      .then(setContext)
      .catch(() => {
        if (!controller.signal.aborted) setContext({ centers: [] })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingContext(false)
      })

    return () => controller.abort()
  }, [token, user?.email])

  const subjectOptions = useMemo(() => {
    if (!filters.track) return ALL_MANAGE_SUBJECT_OPTIONS
    return MANAGE_SUBJECT_OPTIONS[filters.track]
  }, [filters.track])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    params.set('limit', '200')
    return params.toString()
  }, [filters])

  useEffect(() => {
    if (!user?.email) return
    const controller = new AbortController()
    setIsLoading(true)
    setError('')

    fetch(`/api/user/checkout/forms?${queryString}`, {
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Không thể tải danh sách form checkout')
        }
        return payload.data as { rows: CheckoutRow[]; total: number }
      })
      .then((data) => {
        setRows(data.rows || [])
        setTotal(data.total || 0)
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách form checkout')
        setRows([])
        setTotal(0)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [queryString, refreshSignal, token, user?.email])

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'track' ? { subject: '' } : {}),
    }))
  }

  function applyQuickRange(type: 'today' | 'yesterday' | '7days' | '30days') {
    const today = new Date()
    if (type === 'today') {
      const value = localDateString(today)
      setFilters((current) => ({ ...current, fromDate: value, toDate: value }))
      return
    }
    if (type === 'yesterday') {
      const value = localDateString(addDays(today, -1))
      setFilters((current) => ({ ...current, fromDate: value, toDate: value }))
      return
    }
    const days = type === '7days' ? 6 : 29
    setFilters((current) => ({
      ...current,
      fromDate: localDateString(addDays(today, -days)),
      toDate: localDateString(today),
    }))
  }

  return (
    <PageLayout background="gray" maxWidth="full" padding="responsive">
      <PageLayoutContent spacing="xl" className="pb-24">
        <PageHeader
          title="Quản Lý Form Checkout"
          description="Tìm kiếm và theo dõi các phiếu checkout đã gửi"
          actions={
            <Link
              href="/user/checkout/create"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b00020] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#90001a]"
            >
              <FilePlus2 className="h-4 w-4" />
              Tạo form
            </Link>
          }
        />

        <section className="rounded-lg border border-[#26344d] bg-[#111c2f] p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-[#c7d2fe]">
            <Filter className="h-5 w-5" />
            <h2 className="text-xl font-bold">Bộ lọc tìm kiếm</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-lg border border-[#2b3a55] bg-[#142039] p-4">
              <div className="border-b border-[#2b3a55] pb-3 text-center text-sm font-bold uppercase text-[#c7d2fe]">
                Bộ lọc nhanh
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  ['today', 'Hôm nay'],
                  ['yesterday', 'Hôm qua'],
                  ['7days', '7 ngày qua'],
                  ['30days', '30 ngày qua'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyQuickRange(key as 'today' | 'yesterday' | '7days' | '30days')}
                    className="h-10 rounded-lg border border-[#35477a] bg-[#202a4c] text-sm font-semibold text-slate-100 hover:bg-[#293560]"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-[#2b3a55] pt-4">
                <Link
                  href="/user/checkout/create"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff9f1c] to-[#ff4d00] text-sm font-bold text-white shadow-sm"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Viết phiếu đánh giá
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-[#2b3a55] bg-[#142039] p-4">
              <div className="border-b border-[#2b3a55] pb-3 text-center text-sm font-bold uppercase text-[#c7d2fe]">
                Tìm theo người
              </div>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <FilterLabel icon={UserRound}>Giáo viên</FilterLabel>
                  <input
                    value={filters.teacher}
                    onChange={(event) => updateFilter('teacher', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#7c89ff]"
                    placeholder="Nhập tên giáo viên..."
                  />
                </div>
                <div className="space-y-2">
                  <FilterLabel icon={UsersRound}>Học viên</FilterLabel>
                  <input
                    value={filters.student}
                    onChange={(event) => updateFilter('student', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#7c89ff]"
                    placeholder="Nhập tên học viên..."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#2b3a55] bg-[#142039] p-4">
              <div className="border-b border-[#2b3a55] pb-3 text-center text-sm font-bold uppercase text-[#c7d2fe]">
                Địa điểm & môn học
              </div>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <FilterLabel icon={MapPin}>Cơ sở</FilterLabel>
                  <select
                    value={filters.center}
                    disabled={isLoadingContext}
                    onChange={(event) => updateFilter('center', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-[#7c89ff]"
                  >
                    <option value="">Tất cả cơ sở</option>
                    {context?.centers.map((center) => (
                      <option key={`${center.id}-${center.full_name}`} value={center.full_name}>
                        {center.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FilterLabel icon={GraduationCap}>Khối</FilterLabel>
                  <select
                    value={filters.track}
                    onChange={(event) => updateFilter('track', event.target.value as Filters['track'])}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-[#7c89ff]"
                  >
                    <option value="">Tất cả khối</option>
                    {TRACKS.map((track) => (
                      <option key={track.value} value={track.value}>
                        {track.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FilterLabel icon={Search}>Môn trải nghiệm</FilterLabel>
                  <select
                    value={filters.subject}
                    onChange={(event) => updateFilter('subject', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-[#7c89ff]"
                  >
                    <option value="">Tất cả môn</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#2b3a55] bg-[#142039] p-4">
              <div className="border-b border-[#2b3a55] pb-3 text-center text-sm font-bold uppercase text-[#c7d2fe]">
                Thời gian & thao tác
              </div>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <FilterLabel icon={CalendarDays}>Từ ngày</FilterLabel>
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(event) => updateFilter('fromDate', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-[#7c89ff]"
                  />
                </div>
                <div className="space-y-2">
                  <FilterLabel icon={CalendarDays}>Đến ngày</FilterLabel>
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(event) => updateFilter('toDate', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2b3a55] bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-[#7c89ff]"
                  />
                </div>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setFilters(INITIAL_FILTERS)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-600 text-sm font-bold text-white hover:bg-slate-500"
                  >
                    <Eraser className="h-4 w-4" />
                    Xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, ...monthRange(new Date()) }))}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, fromDate: '', toDate: '' }))}
                    className="h-10 rounded-lg bg-[#5f4bff] text-sm font-bold text-white hover:bg-[#5140e0]"
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefreshSignal((current) => current + 1)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white hover:bg-blue-500"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Tải lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#26344d] bg-[#111c2f] p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[#c7d2fe]">
              <Search className="h-5 w-5" />
              <h2 className="text-xl font-bold">Kết quả tìm kiếm</h2>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-[#5f4bff] px-3 py-1 text-sm font-bold text-white">
              {total} phiếu
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#26344d]">
            <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#0f172a] text-xs uppercase text-[#b9c5ff]">
                  <th className="px-3 py-4">ID</th>
                  <th className="px-3 py-4">Timestamp</th>
                  <th className="px-3 py-4">Giáo viên</th>
                  <th className="px-3 py-4">Sale</th>
                  <th className="px-3 py-4">Học viên</th>
                  <th className="px-3 py-4">Tuổi</th>
                  <th className="px-3 py-4">Ngày TN</th>
                  <th className="px-3 py-4">Khối</th>
                  <th className="px-3 py-4">Môn</th>
                  <th className="px-3 py-4">Cơ sở</th>
                  <th className="px-3 py-4">Điểm</th>
                  <th className="px-3 py-4">Confirm time</th>
                  <th className="px-3 py-4">Nhận xét</th>
                  <th className="px-3 py-4">Link</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-12 text-center text-slate-300">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang tải dữ liệu
                      </span>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-12 text-center text-red-300">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-12 text-center text-slate-400">
                      Chưa có phiếu checkout phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const link = checkoutLink(row)

                    return (
                      <tr key={row.id} className="border-t border-[#26344d] text-slate-100 odd:bg-[#121f34] even:bg-[#0f1a2c]">
                        <td className="px-3 py-4 font-bold text-[#c7d2fe]">{row.id}</td>
                        <td className="px-3 py-4 text-slate-300">{formatTimestamp(row.submitted_at)}</td>
                        <td className="px-3 py-4 font-semibold">{row.trial_teacher_name}</td>
                        <td className="px-3 py-4 text-slate-300">{row.sales_owner_name}</td>
                        <td className="px-3 py-4 font-semibold">{row.student_name}</td>
                        <td className="px-3 py-4 text-slate-300">{row.student_age_label}</td>
                        <td className="px-3 py-4 text-slate-300">{formatDate(row.trial_date)}</td>
                        <td className="px-3 py-4">{row.track}</td>
                        <td className="px-3 py-4">{row.trial_subject}</td>
                        <td className="px-3 py-4 text-slate-300">{row.center_name}</td>
                        <td className="px-3 py-4 font-bold text-[#66e2e2]">{formatScore(row.total_score)}</td>
                        <td className="px-3 py-4">
                          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1', caseResultClass(row.case_result))}>
                            {row.case_result || '-'}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-3 py-4 text-slate-300">
                          <span className="line-clamp-3">{row.general_comment}</span>
                        </td>
                        <td className="px-3 py-4">
                          {link ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-semibold text-blue-300 underline-offset-4 hover:underline"
                            >
                              {link.label}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </PageLayoutContent>
    </PageLayout>
  )
}
