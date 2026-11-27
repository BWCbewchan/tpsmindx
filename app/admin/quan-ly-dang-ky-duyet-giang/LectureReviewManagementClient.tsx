'use client'

import { PageHeader } from '@/components/PageHeader'
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/lecture-review/SearchableSelect'
import DateRangePicker from '@/components/portfolio/DateRangePicker'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  canAccessLectureReviewCalendar,
  LECTURE_REVIEW_CALENDAR_PATH,
} from '@/lib/lecture-review-calendar-access'
import { formatReviewDateTime, formatDateTimeGMT7 } from '@/lib/format-date'
import {
  exportLectureReviewsToExcel,
  formatEvaluationScore10,
  formatTheoryScore10,
  formatScoreDisplay,
  computeFinalScore,
  computeTrainingStatus,
} from '@/lib/lecture-review-export'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowUpDown,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Filter,
  Loader2,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Shapes,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

type Leader = {
  code: string
  full_name: string
}

type Center = {
  id: number
  full_name: string
}

type RegistrationRow = {
  id: number
  manager_leader_name: string
  center_name: string
  candidate_name: string
  lms_code: string
  review_date: string
  review_time?: string | null
  reviewer_name: string
  material_file_name: string
  scoring_status: string | null
  evaluation_score: number | string | null
  theory_score: number | string | null
  final_score: number | string | null
  total_lesson: number | null
  training_status: string | null
  evaluation_format?: string | null
  evaluation_details?: any
  evaluation_general_feedback?: string | null
  evaluated_at?: string | null
  evaluated_by_name?: string | null
  can_score: boolean
  can_delete?: boolean
}

type Filters = {
  q: string
  leader: string
  center: string
  reviewer: string
  block: string
  fromDate: string
  toDate: string
  sort: string
}

const REVIEWERS = [
  'Thầy Hoàng Việt Hùng',
  'Thầy Cao Quang Sơn',
  'Thầy Trần Văn Nghĩa',
  'Thầy Phạm Tiến Thịnh',
]

const BLOCK_LABELS: Record<string, string> = {
  coding: 'Coding',
  art: 'Art',
  robotics: 'Robotics',
  age_4_plus: '4+',
}

const INITIAL_FILTERS: Filters = {
  q: '',
  leader: '',
  center: '',
  reviewer: '',
  block: '',
  fromDate: '',
  toDate: '',
  sort: 'review_date_desc',
}

const selectClassName =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#b00020] focus:ring-4 focus:ring-[#b00020]/10'

function formatDate(value?: string | null, timeValue?: string | null): string {
  return formatReviewDateTime(value, timeValue)
}

function monthYear(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  return match ? `${match[2]}/${match[1]}` : '-'
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-'
  return String(value).replace('.', ',')
}

function FilterField({
  label,
  icon,
  children,
  className,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-600">
        <span className="text-[#b00020]">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  )
}

export function LectureReviewManagementClient() {
  const { user, token, isLoading: authLoading } = useAuth()
  const canViewLectureReviewCalendar = canAccessLectureReviewCalendar(user?.email)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [rows, setRows] = useState<RegistrationRow[]>([])
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [currentReviewer, setCurrentReviewer] = useState<string | null>(null)
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<RegistrationRow | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  async function handleExportExcel() {
    if (rows.length === 0) {
      toast.error('Không có dữ liệu trong bảng để xuất file Excel')
      return
    }
    setExporting(true)
    try {
      await exportLectureReviewsToExcel(rows)
      toast.success(`Đã xuất ${rows.length} phiếu đăng ký ra file Excel thành công!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xuất file Excel'
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteApplication() {
    if (!confirmDeleteTarget) return
    setDeletingId(confirmDeleteTarget.id)
    try {
      const headers = authHeaders(token)
      const response = await fetch(
        `/api/lecture-review-applications/${confirmDeleteTarget.id}`,
        {
          method: 'DELETE',
          headers,
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Xóa phiếu duyệt giảng thất bại')
      }
      toast.success(payload.message || 'Đã xóa phiếu duyệt giảng thành công!')
      setConfirmDeleteTarget(null)
      setRefreshSignal((v) => v + 1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa phiếu duyệt giảng'
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.q), 300)
    return () => window.clearTimeout(timer)
  }, [filters.q])

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    fetch('/api/lecture-review-applications/options', {
      cache: 'no-store',
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error)
        return payload.data as { leaders: Leader[]; centers: Center[] }
      })
      .then((data) => {
        setLeaders(data.leaders || [])
        setCenters(data.centers || [])
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [authLoading, token])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '50',
      sort: filters.sort,
    })
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (filters.leader) params.set('leader', filters.leader)
    if (filters.center) params.set('center', filters.center)
    if (filters.reviewer) params.set('reviewer', filters.reviewer)
    if (filters.block) params.set('block', filters.block)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return params.toString()
  }, [debouncedQuery, filters, page])

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/lecture-review-applications?${queryString}`, {
      cache: 'no-store',
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Không thể tải danh sách đăng ký')
        }
        return payload.data as {
          rows: RegistrationRow[]
          total: number
          totalPages: number
          currentReviewer?: string | null
        }
      })
      .then((data) => {
        setRows(data.rows || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.currentReviewer) {
          setCurrentReviewer(data.currentReviewer)
        }
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setRows([])
        setTotal(0)
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Không thể tải danh sách',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [authLoading, queryString, refreshSignal, token])

  const leaderOptions = useMemo<SearchableSelectOption[]>(
    () =>
      leaders.map((leader) => ({
        value: leader.code,
        label: leader.full_name,
      })),
    [leaders],
  )
  const centerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      centers.map((center) => ({
        value: String(center.id),
        label: center.full_name,
      })),
    [centers],
  )

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS)
    setDebouncedQuery('')
    setPage(1)
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key === 'sort' ? value !== INITIAL_FILTERS.sort : Boolean(value),
  )

  return (
    <PageLayout
      background="white"
      maxWidth="full"
      padding="responsive"
      fullHeight={false}
      className="px-4 sm:px-6 lg:px-8"
    >
      <PageLayoutContent spacing="xl" className="min-w-0 pb-4 sm:pb-6">
        <PageHeader
          title="Quản Lý Đăng Ký Duyệt Giảng"
          description="Theo dõi phiếu đã đăng ký, mở tài liệu slide và lọc theo Leader, cơ sở hoặc ngày duyệt giảng."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canViewLectureReviewCalendar ? (
                <Link
                  href={LECTURE_REVIEW_CALENDAR_PATH}
                  target="_blank"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <CalendarDays className="h-4 w-4 text-[#b00020]" />
                  Lịch duyệt giảng
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              ) : null}
              <Link
                href="/admin/dang-ky-duyet-giang"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#b00020] px-4 text-sm font-bold text-white shadow-lg shadow-[#b00020]/15 transition hover:bg-[#92001a]"
              >
                <FilePlus2 className="h-4 w-4" />
                Đăng ký mới
              </Link>
            </div>
          }
        />


        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-5 w-5 text-[#b00020]" />
              <div>
                <h2 className="font-bold text-slate-900">Bộ lọc đăng ký</h2>
                <p className="text-xs text-slate-500">
                  {total.toLocaleString('vi-VN')} phiếu phù hợp
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Làm mới
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting || rows.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs"
                title="Xuất danh sách hiện tại ra file Excel"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-emerald-700" />
                )}
                Xuất dữ liệu
              </button>
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Ứng viên / Mã LMS" icon={<UserRound className="h-3.5 w-3.5" />}>
              <input
                value={filters.q}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="Nhập tên hoặc mã LMS..."
                className={selectClassName}
              />
            </FilterField>
            <FilterField label="Leader / TE" icon={<UsersRound className="h-3.5 w-3.5" />}>
              <SearchableSelect
                value={filters.leader}
                onChange={(value) => updateFilter('leader', value)}
                options={[{ value: '', label: 'Tất cả Leader/TE' }, ...leaderOptions]}
                placeholder="Tất cả Leader/TE"
                searchPlaceholder="Tìm Leader/TE..."
              />
            </FilterField>
            <FilterField label="Cơ sở" icon={<MapPin className="h-3.5 w-3.5" />}>
              <SearchableSelect
                value={filters.center}
                onChange={(value) => updateFilter('center', value)}
                options={[{ value: '', label: 'Tất cả cơ sở' }, ...centerOptions]}
                placeholder="Tất cả cơ sở"
                searchPlaceholder="Tìm cơ sở..."
              />
            </FilterField>
            <FilterField label="Khối giảng dạy" icon={<Shapes className="h-3.5 w-3.5" />}>
              <select
                value={filters.block}
                onChange={(event) => updateFilter('block', event.target.value)}
                className={selectClassName}
              >
                <option value="">Tất cả khối</option>
                {Object.entries(BLOCK_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Giám khảo" icon={<BadgeCheck className="h-3.5 w-3.5" />}>
              <select
                value={currentReviewer || filters.reviewer}
                disabled={Boolean(currentReviewer)}
                onChange={(event) => updateFilter('reviewer', event.target.value)}
                className={cn(
                  selectClassName,
                  currentReviewer && 'bg-slate-100 cursor-not-allowed text-slate-800 font-bold',
                )}
              >
                {currentReviewer ? (
                  <option value={currentReviewer}>{currentReviewer} (Phiếu của tôi)</option>
                ) : (
                  <>
                    <option value="">Tất cả giám khảo</option>
                    {REVIEWERS.map((reviewer) => (
                      <option key={reviewer} value={reviewer}>{reviewer}</option>
                    ))}
                  </>
                )}
              </select>
            </FilterField>
            <FilterField label="Khoảng ngày đăng ký" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <DateRangePicker
                dateFrom={filters.fromDate}
                dateTo={filters.toDate}
                onChange={({ dateFrom, dateTo }) => {
                  setPage(1)
                  setFilters((current) => ({
                    ...current,
                    fromDate: dateFrom,
                    toDate: dateTo,
                  }))
                }}
                placeholder="Chọn từ ngày - đến ngày"
              />
            </FilterField>
            <FilterField label="Sắp xếp theo" icon={<ArrowUpDown className="h-3.5 w-3.5" />}>
              <select
                value={filters.sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
                className={selectClassName}
              >
                <option value="review_date_desc">Ngày đăng ký (Mới nhất)</option>
                <option value="review_date_asc">Ngày đăng ký (Cũ nhất)</option>
                <option value="created_desc">Phiếu tạo gần nhất</option>
                <option value="created_asc">Phiếu tạo lâu nhất</option>
                <option value="candidate_asc">Tên ứng viên (A-Z)</option>
              </select>
            </FilterField>
          </div>
        </section>

        <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              <h2 className="font-bold text-slate-900">Danh sách đăng ký duyệt giảng</h2>
            </div>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-[#b00020]">
              {total.toLocaleString('vi-VN')} phiếu
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-[#b00020]" />
              <span className="text-sm font-semibold">Đang tải danh sách đăng ký...</span>
            </div>
          ) : error ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Không thể tải dữ liệu</p>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshSignal((value) => value + 1)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              >
                Thử lại
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <UsersRound className="h-6 w-6" />
              </div>
              <p className="font-bold text-slate-900">Chưa có phiếu phù hợp</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Hãy thay đổi bộ lọc hoặc tạo phiếu đăng ký duyệt giảng đầu tiên.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto overscroll-x-contain">
              <table className="min-w-[2150px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.04em] text-slate-600">
                    {[
                      'STT',
                      'Leader quản lý',
                      'Cơ sở',
                      'Họ và tên ứng viên',
                      'Mã LMS',
                      'Ban giám khảo',
                      'Tài liệu duyệt giảng',
                      'Ngày đăng ký duyệt giảng',
                      'Trạng thái chấm',
                      'Điểm duyệt giảng',
                      'Điểm lý thuyết',
                      'Điểm tổng kết',
                      'Tổng số bài học',
                      'Trạng thái',
                      'Tháng',
                      'Thao tác',
                    ].map((header) => (
                      <th key={header} className="whitespace-nowrap px-4 py-4 font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 align-middle transition last:border-b-0 hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-400">
                        {(page - 1) * 50 + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">
                        {row.manager_leader_name || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">
                        {row.center_name || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">
                        {row.candidate_name || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.lms_code ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                            {row.lms_code}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">
                        {row.reviewer_name || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-4">
                        {row.material_file_name ? (
                          <a
                            href={`/api/lecture-review-applications/${row.id}/material`}
                            target="_blank"
                            rel="noreferrer"
                            title={row.material_file_name}
                            className="inline-flex max-w-56 items-center gap-1.5 font-semibold text-sky-700 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-900"
                          >
                            <span className="truncate">{row.material_file_name}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                        {formatReviewDateTime(row.review_date, row.review_time)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {row.scoring_status === 'Đã chấm' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="h-3 w-3" /> Đã chấm
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                            Chưa chấm
                          </span>
                        )}
                      </td>
                      {/* Điểm duyệt giảng: Thang 10, hiển thị thuần túy số điểm */}
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {(() => {
                          const score10 = formatScoreDisplay(formatEvaluationScore10(row.evaluation_score))
                          return score10 !== null ? (
                            <span
                              className="font-mono font-bold text-slate-900"
                              title={`Điểm chấm gốc: ${row.evaluation_score}/125`}
                            >
                              {score10}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        })()}
                      </td>
                      {/* Điểm lý thuyết: Hiển thị thuần túy số điểm */}
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {(() => {
                          const ltScore = formatScoreDisplay(formatTheoryScore10(row.theory_score))
                          return ltScore !== null ? (
                            <span className="font-mono font-bold text-slate-900">
                              {ltScore}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        })()}
                      </td>
                      {/* Điểm tổng kết: 70% điểm DG + 30% điểm LT */}
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {(() => {
                          const final10 = computeFinalScore(row)
                          return final10 !== null ? (
                            <span
                              className="font-mono font-bold text-slate-900"
                              title="Điểm tổng kết = 70% điểm DG + 30% điểm LT"
                            >
                              {final10}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        })()}
                      </td>
                      {/* Tổng số bài học */}
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {row.total_lesson !== null && row.total_lesson !== undefined && String(row.total_lesson).trim() !== '' ? (
                          <span className="font-mono font-bold text-slate-900">
                            {row.total_lesson}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        {(() => {
                          const status = computeTrainingStatus(row)
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs',
                                status.isCompleted
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700',
                              )}
                              title={
                                status.isCompleted
                                  ? 'Đã đạt đủ tất cả các tiêu chí tập huấn'
                                  : `Chưa đủ tiêu chí: Thiếu ${status.missing.join(', ')}`
                              }
                            >
                              {status.isCompleted ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : null}
                              {status.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-700">
                        {monthYear(row.review_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.can_score ? (
                            <Link
                              href={`/admin/quan-ly-dang-ky-duyet-giang/${row.id}/cham-diem`}
                              className={cn(
                                'inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition shadow-2xs',
                                row.scoring_status === 'Đã chấm'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border border-[#b00020]/20 bg-[#fff7f8] text-[#a3001d] hover:border-[#b00020]/40 hover:bg-[#fff0f2]',
                              )}
                            >
                              {row.scoring_status === 'Đã chấm' ? 'Xem / Sửa điểm' : 'Chấm điểm'}
                            </Link>
                          ) : row.scoring_status === 'Đã chấm' ? (
                            <Link
                              href={`/admin/quan-ly-dang-ky-duyet-giang/${row.id}/cham-diem`}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition shadow-2xs"
                              title="Xem kết quả điểm duyệt giảng (Chế độ chỉ xem)"
                            >
                              Xem điểm
                            </Link>
                          ) : null}

                          {row.can_delete ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTarget(row)}
                              title="Xóa phiếu duyệt giảng (Chỉ dành cho Super Admin, TEGL, TEGL+, TM, TOM)"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}

                          {!row.can_score && row.scoring_status !== 'Đã chấm' && !row.can_delete ? (
                            <span className="text-slate-300">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && rows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-sm text-slate-500">
                Trang <span className="font-bold text-slate-800">{page}</span> / {totalPages}
                {' · '}{total.toLocaleString('vi-VN')} phiếu
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Modal xác nhận xóa phiếu duyệt giảng (Chỉ dành cho Super Admin, TEGL, TEGL+, TM, TOM) */}
        {confirmDeleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Xác nhận xóa phiếu duyệt giảng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thao tác chỉ dành riêng cho Super Admin, TEGL, TEGL+, TM, TOM
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-500">Ứng viên: </span>
                  <span className="font-bold text-slate-900">{confirmDeleteTarget.candidate_name}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Mã LMS: </span>
                  <span className="font-mono font-bold text-slate-800">{confirmDeleteTarget.lms_code}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Cơ sở: </span>
                  <span className="font-medium text-slate-800">{confirmDeleteTarget.center_name}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Ngày duyệt: </span>
                  <span className="font-medium text-slate-800">{formatReviewDateTime(confirmDeleteTarget.review_date, confirmDeleteTarget.review_time)}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-rose-600 font-medium leading-relaxed">
                ⚠️ Hành động này sẽ xóa vĩnh viễn phiếu đăng ký cùng tài liệu duyệt giảng đính kèm và không thể khôi phục.
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => setConfirmDeleteTarget(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={handleDeleteApplication}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm shadow-rose-600/20"
                >
                  {deletingId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Xác nhận xóa
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  )
}
