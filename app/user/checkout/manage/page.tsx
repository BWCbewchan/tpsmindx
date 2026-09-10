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
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eraser,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  RefreshCcw,
  RotateCcw,
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
  const str = String(value).trim()
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str)
  if (slashMatch) {
    return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}/${slashMatch[3]}`
  }
  const date = new Date(str)
  if (Number.isNaN(date.getTime())) return str
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatScore(value: string | number | null | undefined): string {
  if (value == null || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return number.toFixed(2)
}

function caseResultClass(value: string) {
  if (!value) return 'bg-gray-100 text-gray-600 border-gray-200'
  if (value === 'Pass') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'Fail') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (value === '4 tháng') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function checkoutLink(row: CheckoutRow): { href: string; label: string } | null {
  if (!row.id) {
    return null
  }

  return {
    href: `/public/checkout/${encodeURIComponent(String(row.id))}`,
    label: 'Xem phiếu',
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
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
      <Icon className="h-3.5 w-3.5 text-[#b00020]" />
      {children}
    </label>
  )
}

type SearchableFilterOption = {
  value: string
  label: string
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

function SearchableFilterSelect({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: string
  options: SearchableFilterOption[]
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder
  const normalizedQuery = normalizeSearchText(query)
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) =>
      normalizeSearchText(option.label).includes(normalizedQuery),
    )
  }, [normalizedQuery, options])

  function selectValue(nextValue: string) {
    onChange(nextValue)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={isOpen ? query : selectedLabel}
          disabled={disabled}
          onFocus={() => {
            setIsOpen(true)
            setQuery('')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              setQuery('')
            }
            if (event.key === 'Enter' && visibleOptions[0]) {
              event.preventDefault()
              selectValue(visibleOptions[0].value)
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false)
              setQuery('')
            }, 120)
          }}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10 disabled:bg-gray-50"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={`${option.value || 'all'}-${option.label}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectValue(option.value)
                  }}
                  className={cn(
                    'flex min-h-9 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-[#fff1f3] font-semibold text-[#b00020]'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                </button>
              )
            })
          ) : (
            <div className="px-3 py-3 text-sm text-gray-500">Không tìm thấy lựa chọn phù hợp</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UserCheckoutManagePage() {
  const { token, user } = useAuth()
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [sortBy, setSortBy] = useState<string>('created_desc')
  const [debouncedTeacher, setDebouncedTeacher] = useState('')
  const [debouncedStudent, setDebouncedStudent] = useState('')
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('')
  const [rows, setRows] = useState<CheckoutRow[]>([])
  const [total, setTotal] = useState(0)
  const [context, setContext] = useState<CheckoutContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContext, setIsLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTeacher(filters.teacher)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.teacher])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudent(filters.student)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.student])

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

  const centerFilterOptions = useMemo<SearchableFilterOption[]>(() => {
    const centers = context?.centers || []
    return [
      { value: '', label: 'Tất cả cơ sở' },
      ...centers.map((center) => ({
        value: center.full_name,
        label: center.full_name,
      })),
    ]
  }, [context?.centers])

  const subjectFilterOptions = useMemo<SearchableFilterOption[]>(
    () => [
      { value: '', label: 'Tất cả môn' },
      ...subjectOptions.map((subject) => ({
        value: subject,
        label: subject,
      })),
    ],
    [subjectOptions],
  )

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedTeacher) params.set('teacher', debouncedTeacher)
    if (debouncedStudent) params.set('student', debouncedStudent)
    if (filters.center) params.set('center', filters.center)
    if (filters.track) params.set('track', filters.track)
    if (filters.subject) params.set('subject', filters.subject)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    if (sortBy) params.set('sort', sortBy)
    params.set('limit', '200')
    return params.toString()
  }, [
    debouncedTeacher,
    debouncedStudent,
    filters.center,
    filters.track,
    filters.subject,
    filters.fromDate,
    filters.toDate,
    sortBy,
  ])

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
    setActiveQuickFilter('')
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'track' ? { subject: '' } : {}),
    }))
  }

  function applyQuickRange(type: 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all') {
    setActiveQuickFilter(type)
    const today = new Date()
    if (type === 'all') {
      setFilters((current) => ({ ...current, fromDate: '', toDate: '' }))
      return
    }
    if (type === 'month') {
      setFilters((current) => ({ ...current, ...monthRange(today) }))
      return
    }
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

  function resetAllFilters() {
    setActiveQuickFilter('')
    setSortBy('created_desc')
    setFilters(INITIAL_FILTERS)
  }

  const hasActiveFilters = Boolean(
    sortBy !== 'created_desc' ||
    filters.teacher ||
    filters.student ||
    filters.center ||
    filters.track ||
    filters.subject ||
    filters.fromDate ||
    filters.toDate,
  )

  return (
    <PageLayout background="gray" maxWidth="full" padding="responsive">
      <PageLayoutContent spacing="xl" className="pb-24">
        <PageHeader
          title="Quản Lý Form Checkout"
          description="Tìm kiếm và theo dõi các phiếu checkout đánh giá học viên"
          actions={
            <Link
              href="/user/checkout/create"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b00020] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#90001a]"
            >
              <FilePlus2 className="h-4 w-4" />
              Tạo phiếu đánh giá
            </Link>
          }
        />

        {/* BỘ LỌC TÌM KIẾM - Giao diện sáng đồng nhất */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5 text-gray-900 font-bold text-lg">
              <Filter className="h-5 w-5 text-[#b00020]" />
              Bộ lọc tìm kiếm
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Quick date range pills */}
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Bộ lọc nhanh theo ngày">
                {[
                  ['today', 'Hôm nay'],
                  ['yesterday', 'Hôm qua'],
                  ['7days', '7 ngày qua'],
                  ['30days', '30 ngày qua'],
                  ['month', 'Tháng này'],
                  ['all', 'Tất cả'],
                ].map(([key, label]) => {
                  const isActive = activeQuickFilter === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyQuickRange(key as 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all')}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                        isActive
                          ? 'border-[#b00020] bg-[#fff1f3] text-[#b00020] shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Action buttons: Reset & Reload */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  disabled={!hasActiveFilters}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Đặt lại tất cả bộ lọc"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Đặt lại
                </button>
                <button
                  type="button"
                  onClick={() => setRefreshSignal((current) => current + 1)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-semibold text-[#087f80] hover:bg-teal-100 transition-colors"
                  title="Tải lại danh sách"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Tải lại
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cột 1: Giáo viên */}
            <div className="space-y-1.5">
              <FilterLabel icon={UserRound}>Giáo viên</FilterLabel>
              <div className="relative">
                <input
                  value={filters.teacher}
                  onChange={(event) => updateFilter('teacher', event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                  placeholder="Nhập tên giáo viên..."
                />
              </div>
            </div>

            {/* Cột 2: Học viên */}
            <div className="space-y-1.5">
              <FilterLabel icon={UsersRound}>Học viên</FilterLabel>
              <div className="relative">
                <input
                  value={filters.student}
                  onChange={(event) => updateFilter('student', event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                  placeholder="Nhập tên học viên..."
                />
              </div>
            </div>

            {/* Cột 3: Cơ sở */}
            <div className="space-y-1.5">
              <FilterLabel icon={MapPin}>Cơ sở</FilterLabel>
              <SearchableFilterSelect
                value={filters.center}
                disabled={isLoadingContext}
                options={centerFilterOptions}
                placeholder="Tất cả cơ sở"
                onChange={(value) => updateFilter('center', value)}
              />
            </div>

            {/* Cột 4: Khối */}
            <div className="space-y-1.5">
              <FilterLabel icon={GraduationCap}>Khối trải nghiệm</FilterLabel>
              <select
                value={filters.track}
                onChange={(event) => updateFilter('track', event.target.value as Filters['track'])}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
              >
                <option value="">Tất cả khối</option>
                {TRACKS.map((track) => (
                  <option key={track.value} value={track.value}>
                    {track.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Cột 5: Môn */}
            <div className="space-y-1.5">
              <FilterLabel icon={Search}>Môn trải nghiệm</FilterLabel>
              <SearchableFilterSelect
                value={filters.subject}
                options={subjectFilterOptions}
                placeholder="Tất cả môn"
                onChange={(value) => updateFilter('subject', value)}
              />
            </div>

            {/* Cột 6: Từ ngày */}
            <div className="space-y-1.5">
              <FilterLabel icon={CalendarDays}>Từ ngày</FilterLabel>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => updateFilter('fromDate', event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
              />
            </div>

            {/* Cột 7: Đến ngày */}
            <div className="space-y-1.5">
              <FilterLabel icon={CalendarDays}>Đến ngày</FilterLabel>
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => updateFilter('toDate', event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
              />
            </div>

            {/* Cột 8: Sắp xếp theo */}
            <div className="space-y-1.5">
              <FilterLabel icon={ArrowUpDown}>Sắp xếp theo</FilterLabel>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
              >
                <option value="created_desc">Ngày tạo (Mới nhất)</option>
                <option value="created_asc">Ngày tạo (Cũ nhất)</option>
                <option value="trial_date_desc">Ngày trải nghiệm (Mới nhất)</option>
                <option value="trial_date_asc">Ngày trải nghiệm (Cũ nhất)</option>
                <option value="score_desc">Điểm số (Cao nhất)</option>
                <option value="score_asc">Điểm số (Thấp nhất)</option>
                <option value="student_name_asc">Tên học viên (A - Z)</option>
              </select>
            </div>
          </div>
        </section>

        {/* KẾT QUẢ TÌM KIẾM */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
              <FileCheck2 className="h-5 w-5 text-[#087f80]" />
              Danh sách phiếu checkout
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-[#fff1f3] border border-[#f8c8d0] px-3 py-1 text-xs font-bold text-[#b00020]">
              {total} phiếu
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-[1360px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-gray-50/90 text-xs font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200">
                  <th className="px-3 py-3.5 border-b border-gray-200">ID</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Thời gian gửi</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Giáo viên</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Tư vấn</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Học viên</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Tuổi</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Ngày TN</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Khối</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Môn</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Cơ sở</th>
                  <th className="px-3 py-3.5 border-b border-gray-200 text-center">Điểm TB</th>
                  <th className="px-3 py-3.5 border-b border-gray-200 text-center">Chốt case</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Nhận xét</th>
                  <th className="px-3 py-3.5 border-b border-gray-200 text-center">Phiếu</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-16 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-5 w-5 animate-spin text-[#087f80]" />
                        Đang tải danh sách phiếu checkout...
                      </span>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-16 text-center text-red-600">
                      <p className="font-semibold">{error}</p>
                      <button
                        type="button"
                        onClick={() => setRefreshSignal((c) => c + 1)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#b00020] hover:underline"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Thử lại
                      </button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm font-semibold text-gray-700">Không tìm thấy phiếu checkout phù hợp</p>
                        <p className="mt-1 text-xs text-gray-500">Hãy thử điều chỉnh bộ lọc tìm kiếm hoặc xóa bộ lọc để xem toàn bộ danh sách.</p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                          >
                            <Eraser className="h-3.5 w-3.5" />
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const link = checkoutLink(row)

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 odd:bg-white even:bg-gray-50/40 text-gray-800 transition-colors hover:bg-teal-50/20"
                      >
                        <td className="px-3 py-3.5 font-bold text-[#087f80]">#{row.id}</td>
                        <td className="px-3 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(row.submitted_at)}</td>
                        <td className="px-3 py-3.5 font-semibold text-gray-900">{row.trial_teacher_name}</td>
                        <td className="px-3 py-3.5 text-gray-600">{row.sales_owner_name}</td>
                        <td className="px-3 py-3.5 font-semibold text-gray-900">{row.student_name}</td>
                        <td className="px-3 py-3.5 text-gray-600">{row.student_age_label}</td>
                        <td className="px-3 py-3.5 text-gray-600 whitespace-nowrap">{formatDate(row.trial_date)}</td>
                        <td className="px-3 py-3.5">
                          <span className="inline-block font-medium text-gray-700">{row.track}</span>
                        </td>
                        <td className="px-3 py-3.5 font-medium text-gray-800">{row.trial_subject}</td>
                        <td className="px-3 py-3.5 text-gray-600">{row.center_name}</td>
                        <td className="px-3 py-3.5 text-center font-bold text-[#087f80]">
                          {formatScore(row.total_score)}
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                              caseResultClass(row.case_result),
                            )}
                          >
                            {row.case_result || '-'}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-3 py-3.5 text-xs text-gray-600">
                          <span className="line-clamp-2" title={row.general_comment}>
                            {row.general_comment}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          {link ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-teal-200/60 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-[#087f80] transition-colors hover:bg-teal-100 hover:text-[#065e5f]"
                            >
                              {link.label}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
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
