'use client'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileUp,
  Medal,
  MessageSquare,
  Search,
  Star,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type AdminCheckCongTab = 'records' | 'feedback' | 'analytics'
type StatusFilter = 'all' | 'CHECKED' | 'UNCHECKED'
type FeedbackFilter = 'all' | 'pending' | 'approved' | 'rejected'

interface AdminCheckCongRecord {
  checkKey: string
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  status: string
  slotTime: string
  slotDuration: number
  effectiveDuration: number
  studentCount: number | null
}

interface CheckCongFeedbackSetting {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
  canSubmit: boolean
}

interface CheckCongFeedbackItem {
  id: number
  teacherEmail: string
  teacherName: string
  username: string
  centre: string
  workType: string
  className: string
  course: string
  courseLine: string
  roleType: string
  slotTime: string
  statusSnapshot: string
  studentCount: number | null
  feedbackContent: string
  feedbackStatus: 'pending' | 'approved' | 'rejected'
  reviewerEmail: string | null
  reviewerNote: string | null
  reviewedAt: string | null
  createdAt: string
}

interface TeacherRankingItem {
  teacherName: string
  username: string
  workEmail: string
  checkedRecords: number
  totalRecords: number
  centres: string[]
}

interface AdminCheckCongResponse {
  success: boolean
  error?: string
  summary: {
    totalRecords: number
    checkedRecords: number
    uncheckedRecords: number
    classSessions: number
    officeHours: number
    totalSlotDuration: number
    totalEffectiveDuration: number
    checkRate: number
    monthLabel: string
  }
  records: AdminCheckCongRecord[]
  totalAvailableRecords: number
  availableMonths: string[]
  analytics: {
    teacherCount: number
    checkedByType: Record<string, number>
    teacherRanking: TeacherRankingItem[]
    topTeachers: TeacherRankingItem[]
  }
  pagination: {
    page: number
    limit: number
    totalRecords: number
    returnedRecords: number
    hasMore: boolean
  }
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value))

function formatSlotTime(raw: string): string {
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function toDateTimeLocalInputValue(raw: string | null | undefined): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function cleanText(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text || ['undefined', 'null'].includes(text.toLowerCase())) return ''
  return text
}

function getSessionTitle(record: AdminCheckCongRecord): string {
  const className = cleanText(record.className)
  if (className) return className
  if (record.type === 'OFFICE_HOURS') return 'Trực trải nghiệm'
  return cleanText(record.roleType) || record.type || 'Ca công'
}

function getSessionType(record: AdminCheckCongRecord): string {
  if (record.type === 'OFFICE_HOURS') {
    return cleanText(record.roleType) || 'Office hours'
  }
  return cleanText(record.type) || '-'
}

function checkedStatusLabel(status: string): 'Checked' | 'Unchecked' {
  return status === 'CHECKED' ? 'Checked' : 'Unchecked'
}

function feedbackStatusLabel(status: string): string {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return 'Pending'
}

function feedbackStatusClass(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function RankAdornment({ index }: { index: number }) {
  if (index === 0) return <Trophy className="h-5 w-5 text-amber-500" />
  if (index === 1) return <Medal className="h-5 w-5 text-slate-500" />
  if (index === 2) return <Medal className="h-5 w-5 text-orange-500" />
  if (index === 3 || index === 4) {
    return <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
  }
  return null
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: 'brand' | 'green' | 'red' | 'blue' | 'amber'
}) {
  const tones = {
    brand: 'text-[#a1001f] bg-red-50 border-red-100',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-950">{value}</div>
        </div>
        <div className={`rounded-lg border p-3 ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

export default function AdminCheckCongPage() {
  const { token } = useAuth()
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const fetchingPageRef = useRef(false)
  const dataRef = useRef<AdminCheckCongResponse | null>(null)
  const [month, setMonth] = useState('all')
  const [tab, setTab] = useState<AdminCheckCongTab>('records')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [queryInput, setQueryInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<AdminCheckCongResponse | null>(null)
  const [loadedRecords, setLoadedRecords] = useState<AdminCheckCongRecord[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [feedbackSetting, setFeedbackSetting] =
    useState<CheckCongFeedbackSetting | null>(null)
  const [feedbacks, setFeedbacks] = useState<CheckCongFeedbackItem[]>([])
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('pending')
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false)
  const [isSavingFeedbackSetting, setIsSavingFeedbackSetting] = useState(false)
  const [feedbackOpId, setFeedbackOpId] = useState<number | null>(null)
  const [feedbackOpNote, setFeedbackOpNote] = useState('')
  const [feedbackOpStatus, setFeedbackOpStatus] =
    useState<'approved' | 'rejected'>('approved')
  const [feedbackOpSubmitting, setFeedbackOpSubmitting] = useState(false)
  const [feedbackSchedule, setFeedbackSchedule] = useState({
    isOpen: false,
    opensAt: '',
    closesAt: '',
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'records' || tabParam === 'feedback' || tabParam === 'analytics') {
      setTab(tabParam)
    }
  }, [searchParams])

  const fetchPage = useCallback(
    async (targetPage: number, mode: 'reset' | 'append') => {
      if (fetchingPageRef.current && mode === 'append') return

      fetchingPageRef.current = true
      const requestId =
        mode === 'reset' ? ++requestSeqRef.current : requestSeqRef.current

      if (mode === 'reset') {
        if (dataRef.current) setIsRefreshing(true)
        else setIsInitialLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      try {
        const params = new URLSearchParams({
          month,
          page: String(targetPage),
          limit: '20',
          status: statusFilter,
          q: debouncedQuery,
        })
        const response = await fetch(`/api/admin/check-cong?${params}`, {
          headers: authHeaders(token),
        })
        const result = (await response
          .json()
          .catch(() => ({}))) as AdminCheckCongResponse
        if (!response.ok || result.success === false) {
          throw new Error(result.error || 'Không thể tải dữ liệu check công')
        }
        if (requestId !== requestSeqRef.current) return

        dataRef.current = result
        setData(result)
        setLoadedRecords((current) =>
          mode === 'reset' ? result.records : [...current, ...result.records],
        )
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Không thể tải dữ liệu check công',
        )
      } finally {
        if (requestId === requestSeqRef.current) {
          if (mode === 'reset') {
            setIsInitialLoading(false)
            setIsRefreshing(false)
          } else {
            setIsLoadingMore(false)
          }
        }
        fetchingPageRef.current = false
      }
    },
    [debouncedQuery, month, statusFilter, token],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [queryInput])

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 })
    void fetchPage(1, 'reset')
  }, [fetchPage])

  const loadFeedbacks = useCallback(async () => {
    setIsLoadingFeedbacks(true)
    try {
      const params = new URLSearchParams({
        status: feedbackFilter,
        month,
      })
      const response = await fetch(`/api/admin/check-cong/feedback?${params}`, {
        headers: authHeaders(token),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể tải phản hồi công')
      }
      setFeedbacks(result.feedbacks || [])
      setFeedbackSetting(result.setting || null)
      setFeedbackSchedule({
        isOpen: Boolean(result.setting?.isOpen),
        opensAt: toDateTimeLocalInputValue(result.setting?.opensAt),
        closesAt: toDateTimeLocalInputValue(result.setting?.closesAt),
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Không thể tải phản hồi công',
      )
    } finally {
      setIsLoadingFeedbacks(false)
    }
  }, [feedbackFilter, month, token])

  useEffect(() => {
    if (tab === 'feedback') void loadFeedbacks()
  }, [loadFeedbacks, tab])

  const maxTypeCount = Math.max(
    1,
    ...Object.values(data?.analytics.checkedByType ?? {}),
  )

  function handleTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 140
    if (
      nearBottom &&
      data?.pagination.hasMore &&
      !isInitialLoading &&
      !isLoadingMore
    ) {
      void fetchPage(data.pagination.page + 1, 'append')
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('month', month)

    setIsUploading(true)
    try {
      const response = await fetch('/api/admin/check-cong', {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Upload file thất bại')
      }
      toast.success(`Đã upload ${formatNumber(result.uploaded.recordCount)} dòng`)
      setLoadedRecords([])
      tableScrollRef.current?.scrollTo({ top: 0 })
      await fetchPage(1, 'reset')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload file thất bại')
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSaveFeedbackSchedule(nextIsOpen: boolean) {
    if (nextIsOpen) {
      if (!feedbackSchedule.opensAt || !feedbackSchedule.closesAt) {
        toast.error('Vui lòng chọn đủ thời gian mở và thời gian đóng')
        return
      }
      if (new Date(feedbackSchedule.closesAt) <= new Date(feedbackSchedule.opensAt)) {
        toast.error('Thời gian đóng phải sau thời gian mở')
        return
      }
    }

    setIsSavingFeedbackSetting(true)
    try {
      const response = await fetch('/api/admin/check-cong/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          isOpen: nextIsOpen,
          opensAt: nextIsOpen && feedbackSchedule.opensAt
            ? new Date(feedbackSchedule.opensAt).toISOString()
            : null,
          closesAt: nextIsOpen && feedbackSchedule.closesAt
            ? new Date(feedbackSchedule.closesAt).toISOString()
            : null,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể lưu lịch phản hồi')
      }
      setFeedbackSetting(result.setting)
      setFeedbackSchedule({
        isOpen: Boolean(result.setting?.isOpen),
        opensAt: toDateTimeLocalInputValue(result.setting?.opensAt),
        closesAt: toDateTimeLocalInputValue(result.setting?.closesAt),
      })
      toast.success(nextIsOpen ? 'Đã mở lịch phản hồi công' : 'Đã đóng phản hồi công')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu lịch phản hồi',
      )
    } finally {
      setIsSavingFeedbackSetting(false)
    }
  }

  async function handleReviewFeedback() {
    if (!feedbackOpId) return
    setFeedbackOpSubmitting(true)
    try {
      const response = await fetch('/api/admin/check-cong/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          id: feedbackOpId,
          status: feedbackOpStatus,
          reviewerNote: feedbackOpNote,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể duyệt phản hồi')
      }
      toast.success(
        feedbackOpStatus === 'approved'
          ? 'Đã duyệt phản hồi công'
          : 'Đã từ chối phản hồi công',
      )
      setFeedbackOpId(null)
      setFeedbackOpNote('')
      await loadFeedbacks()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Không thể duyệt phản hồi',
      )
    } finally {
      setFeedbackOpSubmitting(false)
    }
  }

  async function handleExportFeedbackCsv() {
    try {
      const response = await fetch('/api/admin/check-cong/feedback/export', {
        headers: authHeaders(token),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Không thể export CSV')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `check-cong-feedback-approved-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Đã export CSV phản hồi đã duyệt')
      await loadFeedbacks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể export CSV')
    }
  }

  return (
    <PageContainer
      title="Kiểm tra công giáo viên"
      description="Quản lý dữ liệu công từ file CSV/Excel cuối tháng và phân tích số ca checked của toàn bộ giáo viên."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="mindx"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
          >
            <FileUp className="h-4 w-4" />
            {isUploading ? 'Đang tải lên...' : 'Tải CSV/Excel'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'records' as const, label: 'Kiểm tra công', icon: ClipboardCheck },
                { value: 'feedback' as const, label: 'Phản hồi công', icon: MessageSquare },
                { value: 'analytics' as const, label: 'Vinh danh & phân tích', icon: Trophy },
              ].map((item) => {
                const ActiveIcon = item.icon
                const active = tab === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTab(item.value)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#a1001f] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-[#a1001f]/40 hover:text-[#a1001f]'
                    }`}
                  >
                    <ActiveIcon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20"
              >
                <option value="all">Tất cả dữ liệu</option>
                {(data?.availableMonths ?? []).map((value) => {
                  const [year, monthValue] = value.split('-')
                  return (
                    <option key={value} value={value}>
                      Tháng {Number(monthValue)}/{year}
                    </option>
                  )
                })}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Tìm GV, mã lớp, cơ sở..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 sm:w-72"
                />
              </div>
            </div>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={ClipboardCheck}
                label="Tổng số"
                value={formatNumber(data.summary.totalRecords)}
                tone="brand"
              />
              <StatCard
                icon={CheckCircle2}
                label="Checked"
                value={formatNumber(data.summary.checkedRecords)}
                tone="green"
              />
              <StatCard
                icon={XCircle}
                label="Unchecked"
                value={formatNumber(data.summary.uncheckedRecords)}
                tone="red"
              />
              <StatCard
                icon={BarChart3}
                label="Tỷ lệ check"
                value={`${data.summary.checkRate.toFixed(1)}%`}
                tone="amber"
              />
              <StatCard
                icon={Users}
                label="Số giáo viên"
                value={formatNumber(data.analytics.teacherCount)}
                tone="blue"
              />
            </div>

            {tab === 'records' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex rounded-lg border border-gray-200 bg-white p-1">
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'CHECKED' as const, label: 'Checked' },
                      { value: 'UNCHECKED' as const, label: 'Unchecked' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatusFilter(option.value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          statusFilter === option.value
                            ? 'bg-[#a1001f] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-[#a1001f]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isRefreshing ? (
                      <span className="mr-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        Đang cập nhật...
                      </span>
                    ) : null}
                    Đang hiển thị{' '}
                    <span className="font-bold text-gray-900">
                      {formatNumber(loadedRecords.length)}
                    </span>{' '}
                    / {formatNumber(data.pagination.totalRecords)} dòng
                  </div>
                </div>

                <div
                  ref={tableScrollRef}
                  onScroll={handleTableScroll}
                  className="max-h-[620px] overflow-auto rounded-lg border border-gray-200 bg-white"
                >
                  <Table className="min-w-[1180px] text-xs">
                    <TableHeader className="sticky top-0 z-10 bg-gray-50">
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Giáo viên</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Lớp/OH</TableHead>
                        <TableHead>Bộ môn</TableHead>
                        <TableHead>Cơ sở</TableHead>
                        <TableHead className="text-center">Số HV</TableHead>
                        <TableHead className="text-center">Công</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-8 text-center text-sm text-gray-500"
                          >
                            Không có dòng nào theo bộ lọc hiện tại.
                          </TableCell>
                        </TableRow>
                      ) : (
                        loadedRecords.map((record, index) => (
                          <TableRow key={`${record.slotTime}-${record.username}-${index}`}>
                            <TableCell className="font-medium text-gray-800">
                              {formatSlotTime(record.slotTime)}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {record.teacherName || '-'}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {record.workEmail || '-'}
                              </div>
                            </TableCell>
                            <TableCell>{record.username || '-'}</TableCell>
                            <TableCell>{getSessionType(record)}</TableCell>
                            <TableCell className="font-semibold">
                              {getSessionTitle(record)}
                            </TableCell>
                            <TableCell>
                              {[record.course, record.courseLine]
                                .map(cleanText)
                                .filter(Boolean)
                                .join(', ') || '-'}
                            </TableCell>
                            <TableCell>{record.centre || '-'}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {record.studentCount ?? '-'}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {record.effectiveDuration || record.slotDuration || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  record.status === 'CHECKED'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {checkedStatusLabel(record.status)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {isLoadingMore && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-4 text-center text-xs font-semibold text-gray-500"
                          >
                            Đang tải thêm...
                          </TableCell>
                        </TableRow>
                      )}
                      {data.pagination.hasMore && !isLoadingMore && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-4 text-center text-xs font-semibold text-gray-500"
                          >
                            Kéo xuống để tải thêm...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : tab === 'feedback' ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.8fr_0.8fr_auto] xl:items-end">
                    <div>
                      <h3 className="text-base font-bold text-gray-950">
                        Lịch mở phản hồi
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        TeachingHO mở thời hạn để giáo viên phản hồi các ca Unchecked.
                      </p>
                      <div
                        className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                          feedbackSetting?.canSubmit
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        {feedbackSetting?.canSubmit
                          ? 'Đang nhận phản hồi'
                          : feedbackSetting?.isOpen
                            ? 'Đã lên lịch, chưa đến giờ'
                            : 'Đang đóng phản hồi'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Bắt đầu
                      </label>
                      <input
                        type="datetime-local"
                        value={feedbackSchedule.opensAt}
                        onChange={(event) =>
                          setFeedbackSchedule((current) => ({
                            ...current,
                            opensAt: event.target.value,
                          }))
                        }
                        className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Kết thúc
                      </label>
                      <input
                        type="datetime-local"
                        value={feedbackSchedule.closesAt}
                        onChange={(event) =>
                          setFeedbackSchedule((current) => ({
                            ...current,
                            closesAt: event.target.value,
                          }))
                        }
                        className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                      <Button
                        type="button"
                        variant="mindx"
                        onClick={() => handleSaveFeedbackSchedule(true)}
                        disabled={isSavingFeedbackSetting}
                        className="h-11"
                      >
                        {isSavingFeedbackSetting ? 'Đang lưu...' : 'Mở lịch'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSaveFeedbackSchedule(false)}
                        disabled={isSavingFeedbackSetting}
                        className="h-11 border-[#a1001f]/30 text-[#a1001f] hover:bg-red-50"
                      >
                        Đóng phản hồi
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-950">
                        Phản hồi chờ xử lý
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        TC/Leader duyệt xong thì TeachingHO export CSV báo Tech.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
                        {[
                          { value: 'pending' as const, label: 'Pending' },
                          { value: 'approved' as const, label: 'Approved' },
                          { value: 'rejected' as const, label: 'Rejected' },
                          { value: 'all' as const, label: 'All' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFeedbackFilter(option.value)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                              feedbackFilter === option.value
                                ? 'bg-[#a1001f] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-[#a1001f]'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="mindx"
                        onClick={handleExportFeedbackCsv}
                      >
                        <Download className="h-4 w-4" />
                        Export approved
                      </Button>
                    </div>
                  </div>

                  {isLoadingFeedbacks ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-24 animate-pulse rounded-lg bg-gray-100"
                        />
                      ))}
                    </div>
                  ) : feedbacks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                      Chưa có phản hồi công theo bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                      {feedbacks.map((feedback) => (
                        <div
                          key={feedback.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-[#a1001f]/25 hover:bg-red-50/20"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-[11px] font-bold ${feedbackStatusClass(
                                    feedback.feedbackStatus,
                                  )}`}
                                >
                                  {feedbackStatusLabel(feedback.feedbackStatus)}
                                </span>
                                <span className="text-xs font-semibold text-gray-500">
                                  {formatSlotTime(feedback.slotTime)}
                                </span>
                              </div>
                              <h4 className="mt-2 text-sm font-bold text-gray-950">
                                {feedback.teacherName || feedback.teacherEmail} ·{' '}
                                {feedback.className || 'Trực trải nghiệm'}
                              </h4>
                              <p className="mt-1 text-xs text-gray-500">
                                {feedback.centre || '-'} · {feedback.workType || '-'} ·{' '}
                                {feedback.roleType || '-'} · {feedback.studentCount ?? 0} HV
                              </p>
                              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm font-medium leading-relaxed text-gray-800">
                                {feedback.feedbackContent || 'Không có ghi chú'}
                              </p>
                              {feedback.reviewerNote ? (
                                <p className="mt-2 text-xs text-gray-500">
                                  Ghi chú duyệt: {feedback.reviewerNote}
                                </p>
                              ) : null}
                            </div>
                            {feedback.feedbackStatus === 'pending' ? (
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setFeedbackOpId(feedback.id)
                                    setFeedbackOpStatus('rejected')
                                    setFeedbackOpNote('')
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="mindx"
                                  onClick={() => {
                                    setFeedbackOpId(feedback.id)
                                    setFeedbackOpStatus('approved')
                                    setFeedbackOpNote('')
                                  }}
                                >
                                  Approve
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.6fr]">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-gray-950">
                      Phân bổ ca checked theo loại
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Chỉ tính các dòng có trạng thái Checked.
                    </p>
                  </div>
                  <div className="space-y-5">
                    {Object.entries(data.analytics.checkedByType).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        Chưa có ca checked trong kỳ này.
                      </div>
                    ) : (
                      Object.entries(data.analytics.checkedByType).map(
                        ([type, count]) => (
                          <div key={type}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-bold text-gray-900">
                                {type === 'CLASS' ? 'Lớp học (CLASS)' : 'Office Hours'}
                              </span>
                              <span className="font-semibold text-gray-500">
                                {formatNumber(count)}
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-gray-100">
                              <div
                                className={`h-3 rounded-full ${
                                  type === 'CLASS' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`}
                                style={{
                                  width: `${Math.max(8, (count / maxTypeCount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <div>
                      <h3 className="text-base font-bold text-gray-950">
                        Top 10 giáo viên check nhiều nhất
                      </h3>
                      <p className="text-sm text-gray-500">
                        Xếp hạng theo số lượng ca Checked.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.analytics.topTeachers.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        Chưa có dữ liệu xếp hạng.
                      </div>
                    ) : (
                      data.analytics.topTeachers.map((teacher, index) => (
                        <div
                          key={`${teacher.username}-${teacher.workEmail}-${index}`}
                          className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a1001f]/25 hover:bg-red-50/30 hover:shadow-md"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${
                              index < 3
                                ? 'bg-[#a1001f]'
                                : 'bg-slate-600'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-950">
                              {teacher.username || teacher.workEmail || '-'} -{' '}
                              {teacher.teacherName || 'Chưa có tên'}
                            </div>
                            <div className="mt-0.5 text-sm text-gray-500">
                              {formatNumber(teacher.checkedRecords)} ca checked /{' '}
                              {formatNumber(teacher.totalRecords)} tổng số
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {teacher.centres.slice(0, 6).map((centre) => (
                                <span
                                  key={centre}
                                  className="rounded-full border border-[#c7c2ff] bg-[#ecebff] px-2 py-0.5 text-[11px] font-semibold text-[#5146d9] transition-colors group-hover:border-[#aaa2ff] group-hover:bg-[#e3e1ff]"
                                >
                                  {centre}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110">
                            <RankAdornment index={index} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Chưa tải được dữ liệu check công.
          </div>
        )}
      </div>

      {feedbackOpId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setFeedbackOpId(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-950">
              {feedbackOpStatus === 'approved'
                ? 'Duyệt phản hồi công'
                : 'Từ chối phản hồi công'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Ghi chú sẽ được gửi thông báo lại cho giáo viên.
            </p>
            <textarea
              value={feedbackOpNote}
              onChange={(event) => setFeedbackOpNote(event.target.value)}
              rows={4}
              placeholder="Nhập ghi chú cho giáo viên..."
              className="mt-4 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFeedbackOpId(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="mindx"
                onClick={handleReviewFeedback}
                disabled={feedbackOpSubmitting}
              >
                {feedbackOpSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
