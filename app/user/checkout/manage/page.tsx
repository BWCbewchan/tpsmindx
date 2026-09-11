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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  X,
} from 'lucide-react'
import Link from 'next/link'
import type { ElementType } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
  lms_code: string | null
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
  lmsCode: string
  student: string
  center: string
  track: '' | TrialTrack
  subject: string
  fromDate: string
  toDate: string
}

const INITIAL_FILTERS: Filters = {
  teacher: '',
  lmsCode: '',
  student: '',
  center: '',
  track: '',
  subject: '',
  fromDate: '',
  toDate: '',
}

function toDdMmYyyy(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slashMatch) {
    return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}/${slashMatch[3]}`
  }
  const parts = trimmed.split(/[-./]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`
  }
  return trimmed
}

function toIsoDate(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parts = trimmed.split(/[/.-]/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (y && y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    if (d && d.length === 4) {
      return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`
    }
    if (y && y.length === 2) {
      const fullYear = Number.parseInt(y, 10) > 50 ? `19${y}` : `20${y}`
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return trimmed
}

function localDateDdMmYyyy(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${day}/${month}/${year}`
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
    fromDate: localDateDdMmYyyy(first),
    toDate: localDateDdMmYyyy(last),
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const str = String(value).trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }
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

type FilterSelectOption = {
  value: string
  label: string
  subtext?: string
}

function SearchableFilterSelect({
  value,
  onChange,
  options,
  allOptionLabel,
  placeholder,
  searchPlaceholder = 'Nhập để lọc...',
  disabled = false,
}: {
  value: string
  onChange: (val: string) => void
  options: FilterSelectOption[]
  allOptionLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtext && opt.subtext.toLowerCase().includes(q)),
    )
  }, [options, search])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayText = selectedOption
    ? selectedOption.label
    : value || allOptionLabel || placeholder || 'Chọn...'

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
            setSearch('')
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-left text-sm transition-colors outline-none focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10 disabled:bg-gray-50 disabled:cursor-not-allowed',
          value ? 'font-medium text-gray-900' : 'text-gray-600',
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={cn(
            'ml-1.5 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl ring-1 ring-black/5">
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs outline-none focus:border-[#b00020] focus:bg-white focus:ring-1 focus:ring-[#b00020]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {allOptionLabel && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition-colors',
                  !value
                    ? 'bg-[#b00020]/10 font-bold text-[#b00020]'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <span>{allOptionLabel}</span>
                {!value && <Check className="h-3.5 w-3.5 shrink-0 text-[#b00020]" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-gray-500">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-[#b00020]/10 font-bold text-[#b00020]'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    <span className="truncate">
                      {opt.label}
                      {opt.subtext && (
                        <span className="ml-1.5 text-[11px] text-gray-400">
                          ({opt.subtext})
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#b00020]" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserCheckoutManagePage() {
  const { token, user } = useAuth()
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [sortBy, setSortBy] = useState<string>('trial_date_desc')
  const [debouncedTeacher, setDebouncedTeacher] = useState('')
  const [debouncedLmsCode, setDebouncedLmsCode] = useState('')
  const [debouncedStudent, setDebouncedStudent] = useState('')
  const [debouncedFromDate, setDebouncedFromDate] = useState('')
  const [debouncedToDate, setDebouncedToDate] = useState('')
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('')
  const [rows, setRows] = useState<CheckoutRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [context, setContext] = useState<CheckoutContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContext, setIsLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)

  const fromDateInputRef = useRef<HTMLInputElement>(null)
  const toDateInputRef = useRef<HTMLInputElement>(null)

  // Debounce search text and dates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTeacher(filters.teacher)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.teacher])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLmsCode(filters.lmsCode)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.lmsCode])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudent(filters.student)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.student])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFromDate(filters.fromDate)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.fromDate])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedToDate(filters.toDate)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.toDate])

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

  const centerOptions: FilterSelectOption[] = useMemo(() => {
    return (context?.centers || []).map((c) => ({
      value: c.full_name,
      label: c.short_code ? `${c.full_name} (${c.short_code})` : c.full_name,
      subtext: c.region || undefined,
    }))
  }, [context?.centers])

  const trackOptions: FilterSelectOption[] = useMemo(() => {
    return TRACKS.map((t) => ({
      value: t.value,
      label: t.label,
      subtext: t.description,
    }))
  }, [])

  const subjectFilterOptions: FilterSelectOption[] = useMemo(() => {
    return subjectOptions.map((s) => ({
      value: s,
      label: s,
    }))
  }, [subjectOptions])

  const sortOptions: FilterSelectOption[] = useMemo(
    () => [
      { value: 'trial_date_desc', label: 'Ngày trải nghiệm (Mới nhất)' },
      { value: 'trial_date_asc', label: 'Ngày trải nghiệm (Cũ nhất)' },
      { value: 'created_desc', label: 'Thời gian gửi (Mới nhất)' },
      { value: 'created_asc', label: 'Thời gian gửi (Cũ nhất)' },
      { value: 'score_desc', label: 'Điểm số (Cao nhất)' },
      { value: 'score_asc', label: 'Điểm số (Thấp nhất)' },
      { value: 'student_name_asc', label: 'Tên học viên (A - Z)' },
    ],
    [],
  )

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedTeacher) params.set('teacher', debouncedTeacher)
    if (debouncedLmsCode) params.set('lmsCode', debouncedLmsCode)
    if (debouncedStudent) params.set('student', debouncedStudent)
    if (filters.center) params.set('center', filters.center)
    if (filters.track) params.set('track', filters.track)
    if (filters.subject) params.set('subject', filters.subject)
    if (debouncedFromDate) {
      const iso = toIsoDate(debouncedFromDate)
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) params.set('fromDate', iso)
    }
    if (debouncedToDate) {
      const iso = toIsoDate(debouncedToDate)
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) params.set('toDate', iso)
    }
    if (sortBy) params.set('sort', sortBy)
    params.set('limit', '100')
    params.set('page', String(page))
    return params.toString()
  }, [
    debouncedTeacher,
    debouncedLmsCode,
    debouncedStudent,
    filters.center,
    filters.track,
    filters.subject,
    debouncedFromDate,
    debouncedToDate,
    sortBy,
    page,
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
          throw new Error(payload?.error || 'Không thể tải danh sách phiếu kết quả trải nghiệm')
        }
        return payload.data as { rows: CheckoutRow[]; total: number; totalPages?: number }
      })
      .then((data) => {
        setRows(data.rows || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || Math.ceil((data.total || 0) / 100) || 1)
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách phiếu kết quả trải nghiệm')
        setRows([])
        setTotal(0)
        setTotalPages(1)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [queryString, refreshSignal, token, user?.email])

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setActiveQuickFilter('')
    setPage(1)
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'track' ? { subject: '' } : {}),
    }))
  }

  function applyQuickRange(type: 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all') {
    setActiveQuickFilter(type)
    setPage(1)
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
      const value = localDateDdMmYyyy(today)
      setFilters((current) => ({ ...current, fromDate: value, toDate: value }))
      return
    }
    if (type === 'yesterday') {
      const value = localDateDdMmYyyy(addDays(today, -1))
      setFilters((current) => ({ ...current, fromDate: value, toDate: value }))
      return
    }
    const days = type === '7days' ? 6 : 29
    setFilters((current) => ({
      ...current,
      fromDate: localDateDdMmYyyy(addDays(today, -days)),
      toDate: localDateDdMmYyyy(today),
    }))
  }

  function resetAllFilters() {
    setActiveQuickFilter('')
    setSortBy('trial_date_desc')
    setPage(1)
    setFilters(INITIAL_FILTERS)
  }

  const hasActiveFilters = Boolean(
    sortBy !== 'trial_date_desc' ||
    filters.teacher ||
    filters.lmsCode ||
    filters.student ||
    filters.center ||
    filters.track ||
    filters.subject ||
    filters.fromDate ||
    filters.toDate,
  )

  return (
    <PageLayout background="gray" maxWidth="full" padding="responsive" className="px-4 sm:px-6 lg:px-8">
      <PageLayoutContent spacing="xl" className="pb-24">
        <PageHeader
          title="Quản Lý Phiếu Kết Quả Trải Nghiệm"
          description="Tìm kiếm và theo dõi các phiếu kết quả trải nghiệm đánh giá học viên"
          actions={
            <Link
              href="/user/checkout/create"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b00020] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#90001a]"
            >
              <FilePlus2 className="h-4 w-4" />
              Tạo phiếu mới
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
            {/* Cột 1: Giáo viên / Mã LMS */}
            <div className="space-y-1.5">
              <FilterLabel icon={UserRound}>Giáo viên / Mã LMS</FilterLabel>
              <div className="relative">
                <input
                  value={filters.teacher}
                  onChange={(event) => updateFilter('teacher', event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                  placeholder="Nhập tên hoặc mã LMS giáo viên..."
                />
              </div>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed [text-wrap:pretty]">
                * Các phiếu tạo trước ngày 11/09/2026 ưu tiên tìm kiếm theo họ tên giáo viên.
              </p>
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
                onChange={(val) => updateFilter('center', val)}
                options={centerOptions}
                allOptionLabel="Tất cả cơ sở"
                searchPlaceholder="Tìm kiếm cơ sở..."
              />
            </div>

            {/* Cột 4: Khối */}
            <div className="space-y-1.5">
              <FilterLabel icon={GraduationCap}>Khối trải nghiệm</FilterLabel>
              <SearchableFilterSelect
                value={filters.track}
                onChange={(val) => updateFilter('track', val as Filters['track'])}
                options={trackOptions}
                allOptionLabel="Tất cả khối"
                searchPlaceholder="Tìm kiếm khối..."
              />
            </div>

            {/* Cột 5: Môn */}
            <div className="space-y-1.5">
              <FilterLabel icon={Search}>Môn trải nghiệm</FilterLabel>
              <SearchableFilterSelect
                value={filters.subject}
                onChange={(val) => updateFilter('subject', val)}
                options={subjectFilterOptions}
                allOptionLabel="Tất cả môn"
                searchPlaceholder="Tìm kiếm môn..."
              />
            </div>

            {/* Cột 6: Từ ngày */}
            <div className="space-y-1.5">
              <FilterLabel icon={CalendarDays}>Từ ngày</FilterLabel>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/yyyy"
                  value={filters.fromDate}
                  onChange={(event) => updateFilter('fromDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                />
                <input
                  ref={fromDateInputRef}
                  type="date"
                  aria-label="Chọn từ ngày"
                  tabIndex={-1}
                  className="sr-only"
                  value={toIsoDate(filters.fromDate)}
                  max={toIsoDate(filters.toDate) || undefined}
                  onChange={(event) => {
                    if (event.target.value) {
                      updateFilter('fromDate', toDdMmYyyy(event.target.value))
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      fromDateInputRef.current?.showPicker()
                    } catch {
                      fromDateInputRef.current?.focus()
                    }
                  }}
                  className="absolute right-2 flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  title="Mở lịch chọn từ ngày"
                >
                  <CalendarDays className="h-3.5 w-3.5 pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Cột 7: Đến ngày */}
            <div className="space-y-1.5">
              <FilterLabel icon={CalendarDays}>Đến ngày</FilterLabel>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/yyyy"
                  value={filters.toDate}
                  onChange={(event) => updateFilter('toDate', event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                />
                <input
                  ref={toDateInputRef}
                  type="date"
                  aria-label="Chọn đến ngày"
                  tabIndex={-1}
                  className="sr-only"
                  value={toIsoDate(filters.toDate)}
                  min={toIsoDate(filters.fromDate) || undefined}
                  onChange={(event) => {
                    if (event.target.value) {
                      updateFilter('toDate', toDdMmYyyy(event.target.value))
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      toDateInputRef.current?.showPicker()
                    } catch {
                      toDateInputRef.current?.focus()
                    }
                  }}
                  className="absolute right-2 flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  title="Mở lịch chọn đến ngày"
                >
                  <CalendarDays className="h-3.5 w-3.5 pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Cột 8: Sắp xếp theo */}
            <div className="space-y-1.5">
              <FilterLabel icon={ArrowUpDown}>Sắp xếp theo</FilterLabel>
              <SearchableFilterSelect
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val)
                  setPage(1)
                }}
                options={sortOptions}
                searchPlaceholder="Tìm kiếm sắp xếp..."
              />
            </div>
          </div>
        </section>

        {/* KẾT QUẢ TÌM KIẾM */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
              <FileCheck2 className="h-5 w-5 text-[#087f80]" />
              Danh sách phiếu kết quả trải nghiệm
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(filters.fromDate || filters.toDate) && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-700" />
                  Ngày TN: {filters.fromDate ? `từ ${filters.fromDate}` : ''}{' '}
                  {filters.toDate ? `đến ${filters.toDate}` : ''}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickFilter('')
                      setFilters((prev) => ({ ...prev, fromDate: '', toDate: '' }))
                    }}
                    className="ml-1 rounded p-0.5 hover:bg-amber-200/60 transition-colors"
                    title="Xóa lọc ngày"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <span className="inline-flex w-fit items-center rounded-full bg-[#fff1f3] border border-[#f8c8d0] px-3 py-1 text-xs font-bold text-[#b00020]">
                {total} phiếu
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-[1440px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-gray-50/90 text-xs font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200">
                  <th className="px-3 py-3.5 border-b border-gray-200">ID</th>
                  <th className="px-3 py-3.5 border-b border-gray-200 bg-amber-50/50 text-[#a1001f] whitespace-nowrap">
                    Ngày trải nghiệm
                  </th>
                  <th className="px-3 py-3.5 border-b border-gray-200 whitespace-nowrap">Thời gian gửi</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Mã LMS</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Giáo viên</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Tư vấn</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Học viên</th>
                  <th className="px-3 py-3.5 border-b border-gray-200">Tuổi</th>
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
                    <td colSpan={15} className="px-3 py-16 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-5 w-5 animate-spin text-[#087f80]" />
                        Đang tải danh sách phiếu kết quả trải nghiệm...
                      </span>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={15} className="px-3 py-16 text-center text-red-600">
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
                    <td colSpan={15} className="px-3 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm font-semibold text-gray-700">Không tìm thấy phiếu kết quả trải nghiệm phù hợp</p>
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
                        <td className="px-3 py-3.5 bg-amber-50/20 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100/70 border border-amber-200/80 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-2xs">
                            <CalendarDays className="h-3 w-3 text-amber-700 shrink-0" />
                            {formatDate(row.trial_date)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(row.submitted_at)}</td>
                        <td className="px-3 py-3.5 font-mono text-xs font-semibold text-gray-700 whitespace-nowrap">
                          {row.lms_code || row.teacher_code || '-'}
                        </td>
                        <td className="px-3 py-3.5 font-semibold text-gray-900">{row.trial_teacher_name}</td>
                        <td className="px-3 py-3.5 text-gray-600">{row.sales_owner_name}</td>
                        <td className="px-3 py-3.5 font-semibold text-gray-900">{row.student_name}</td>
                        <td className="px-3 py-3.5 text-gray-600">{row.student_age_label}</td>
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

          {/* Phân trang - 100 dòng / trang */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
              <div className="text-xs text-gray-600">
                Hiển thị <span className="font-semibold text-gray-900">{(page - 1) * 100 + 1}</span> -{' '}
                <span className="font-semibold text-gray-900">{Math.min(page * 100, total)}</span> trong tổng số{' '}
                <span className="font-bold text-[#b00020]">{total}</span> phiếu (Trang {page}/{totalPages})
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trang trước
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pNum = i + 1
                    if (totalPages > 5) {
                      if (page > 3 && page < totalPages - 1) {
                        pNum = page - 2 + i
                      } else if (page >= totalPages - 1) {
                        pNum = totalPages - 4 + i
                      }
                    }
                    const isCurrent = pNum === page
                    return (
                      <button
                        key={pNum}
                        type="button"
                        disabled={isLoading}
                        onClick={() => setPage(pNum)}
                        className={cn(
                          'h-8 w-8 rounded-md text-xs font-bold transition-all',
                          isCurrent
                            ? 'bg-[#b00020] text-white shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {pNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Trang sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </PageLayoutContent>
    </PageLayout>
  )
}
