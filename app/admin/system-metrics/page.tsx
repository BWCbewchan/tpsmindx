'use client'

import { PageContainer } from '@/components/PageContainer'
import { DevicePieChart } from '@/components/system-metrics/DevicePieChart'
import { EngagementChart } from '@/components/system-metrics/EngagementChart'
import { MetricCard } from '@/components/system-metrics/MetricCard'
import { CenterUsageChart } from '@/components/system-metrics/CenterUsageChart'
import { TopPagesTable } from '@/components/system-metrics/TopPagesTable'
import {
  useEngagement,
  useSystemHealth,
} from '@/components/system-metrics/useMetrics'
import { useAuth } from '@/lib/auth-context'
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Download,
  Eye,
  RefreshCw,
  Smartphone,
  Timer,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

type PeriodFilter = 'today' | '7d' | '30d'

const ITEMS_PER_PAGE = 5

function formatDateForInput(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return adjusted.toISOString().slice(0, 10)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          const str = String(val ?? '')
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    ),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function NumberedPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (next: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-3 flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`h-9 min-w-9 shrink-0 rounded-md px-2 text-xs font-medium transition-colors sm:h-7 sm:min-w-7 ${
            n === page
              ? 'bg-[#a1001f] text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-[#a1001f] hover:text-[#a1001f]'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

type InteractionRankingRow = {
  rank: number
  user_id: string
  interactions: number
  active_days: number
  interactions_per_day: number
}

function InteractionRankingTable({
  title,
  actorLabel,
  emptyText,
  rows,
  page,
  totalPages,
  onPageChange,
}: {
  title: string
  actorLabel: string
  emptyText: string
  rows: InteractionRankingRow[]
  page: number
  totalPages: number
  onPageChange: (next: number) => void
}) {
  return (
    <div className="flex h-full min-h-[276px] min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-lg border border-dashed border-gray-100 px-3 text-center text-sm text-gray-400">
          {emptyText}
        </div>
      ) : (
        <div className="max-w-full flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
          <table className="min-w-[34rem] w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  #
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {actorLabel}
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Tổng tương tác
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Trung bình/ngày
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((u) => (
                <tr key={u.user_id} className="hover:bg-gray-50/70">
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                    {u.rank}
                  </td>
                  <td className="max-w-[11.25rem] truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                    {u.user_id}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                    {u.interactions}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                    {u.interactions_per_day}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NumberedPagination
        page={page}
        totalPages={totalPages}
        onChange={onPageChange}
      />
    </div>
  )
}

type CenterActorDetailRow = {
  user_id: string
  usage_count: number
  last_seen: string
}

function CenterActorDetailSection({
  title,
  rows,
  emptyText,
  panelId,
  labelledBy,
}: {
  title: string
  rows: CenterActorDetailRow[]
  emptyText: string
  panelId: string
  labelledBy: string
}) {
  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="flex min-h-[340px] min-w-0 flex-col gap-2 sm:min-h-[360px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          {title}
        </h5>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {rows.length} tài khoản
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 px-3 text-center text-sm text-gray-400">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 sm:hidden">
            {rows.map((u) => (
              <div
                key={`${title}-${u.user_id}`}
                className="rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {u.user_id}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Lần truy cập gần nhất:{' '}
                      {new Date(u.last_seen).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="min-w-[72px] rounded-lg bg-gray-50 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      Lượt sử dụng
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">
                      {u.usage_count}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden min-h-0 flex-1 overflow-auto rounded-xl border border-gray-100 sm:block">
            <table className="min-w-[34rem] w-full text-left">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="sticky top-0 z-10 bg-gray-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Tài khoản
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50/95 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Lượt sử dụng
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50/95 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Lần truy cập gần nhất
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((u) => (
                  <tr key={`${title}-${u.user_id}`} className="hover:bg-gray-50/60">
                    <td className="max-w-[16.25rem] truncate px-4 py-3 text-xs font-medium text-gray-700">
                      {u.user_id}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-600">
                      {u.usage_count}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-600">
                      {new Date(u.last_seen).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default function SystemMetricsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 6)
    return formatDateForInput(date)
  })
  const [toDate, setToDate] = useState(() => formatDateForInput(new Date()))
  const [chartTab, setChartTab] = useState<'dau' | 'wau'>('dau')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [userSearch, setUserSearch] = useState('')
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')
  const [centerFilter, setCenterFilter] = useState('all')
  const [errorTablePage, setErrorTablePage] = useState(1)
  const [onlineTablePage, setOnlineTablePage] = useState(1)
  const [managerRankingTablePage, setManagerRankingTablePage] = useState(1)
  const [teacherRankingTablePage, setTeacherRankingTablePage] = useState(1)
  const [centerTablePage, setCenterTablePage] = useState(1)
  const [selectedCenterDetail, setSelectedCenterDetail] = useState<
    string | null
  >(null)
  const [selectedCenterActorTab, setSelectedCenterActorTab] = useState<
    'teacher' | 'manager'
  >('teacher')

  useEffect(() => {
    if (!authLoading && user?.role !== 'super_admin') {
      router.replace('/admin/dashboard')
    }
  }, [user, authLoading, router])

  const {
    data: health,
    isLoading: healthLoading,
    mutate: refreshHealth,
  } = useSystemHealth(user?.email)
  const period = useMemo<PeriodFilter>(() => {
    const start = new Date(fromDate)
    const end = new Date(toDate)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '7d'
    }

    const diffMs = Math.max(end.getTime() - start.getTime(), 0)
    const dayCount = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1

    if (dayCount <= 1) return 'today'
    if (dayCount <= 7) return '7d'
    return '30d'
  }, [fromDate, toDate])
  const {
    data: engagement,
    isLoading: engagementLoading,
    mutate: refreshEngagement,
  } = useEngagement(period, user?.email)

  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    if (value > toDate) {
      setToDate(value)
    }
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)
    if (value < fromDate) {
      setFromDate(value)
    }
  }

  const handleRefresh = useCallback(() => {
    refreshHealth()
    refreshEngagement()
    setLastRefresh(new Date())
  }, [refreshHealth, refreshEngagement])

  const handleExportHealth = () => {
    if (!health) return
    exportCSV(
      [
        {
          'Concurrent Users': health.concurrent_users,
          'DB Usage (%)': health.db_usage,
          'Response Time P95 (ms)': health.response_time_p95,
          'Error Rate (%)': health.error_rate,
          'Error 500 (%)': health.error_500,
          'Error 404 (%)': health.error_404,
        },
      ],
      'system_health',
    )
  }

  const handleExportEngagement = () => {
    if (!engagement) return
    const rows = engagement.top_pages.map((p) => ({
      Page: p.page,
      Views: p.views,
      'Percentage (%)': p.percentage,
    }))
    exportCSV(rows, 'top_pages')
  }

  const errorAlert = health && health.error_rate > 5
  const dbAlert = health && health.db_usage > 80

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch)
    }, 250)

    return () => clearTimeout(timer)
  }, [userSearch])

  const normalizedUserSearch = debouncedUserSearch.trim().toLowerCase()

  const handleResetUserAndCenterFilters = () => {
    setUserSearch('')
    setCenterFilter('all')
    setOnlineTablePage(1)
    setManagerRankingTablePage(1)
    setTeacherRankingTablePage(1)
    setCenterTablePage(1)
  }

  const filteredOnlineUsers = (engagement?.online_users ?? []).filter((u) =>
    u.user_id.toLowerCase().includes(normalizedUserSearch),
  )

  const filteredManagerInteractionRanking = (
    engagement?.manager_interaction_ranking ?? []
  ).filter((u) => u.user_id.toLowerCase().includes(normalizedUserSearch))

  const filteredTeacherInteractionRanking = (
    engagement?.teacher_interaction_ranking ?? []
  ).filter((u) => u.user_id.toLowerCase().includes(normalizedUserSearch))

  // Get list of center names user has access to
  const accessibleCenterNames = useMemo(() => {
    if (user?.role === 'super_admin') return new Set<string>() // empty = show all
    const names = new Set<string>()
    if (user?.assignedCenters) {
      user.assignedCenters.forEach((c) => {
        names.add(c.full_name)
        if (c.short_code) names.add(c.short_code)
      })
    }
    return names
  }, [user?.role, user?.assignedCenters])

  const centerOptions = Array.from(
    new Set((engagement?.center_usage ?? []).map((c) => c.center)),
  )
    .filter((center) => {
      // If super_admin or no restricted centers, show all
      if (user?.role === 'super_admin' || accessibleCenterNames.size === 0)
        return true
      // Otherwise, only show accessible centers
      return accessibleCenterNames.has(center)
    })
    .sort((a, b) => a.localeCompare(b, 'vi'))

  const filteredCenterUsage = (engagement?.center_usage ?? []).filter((c) => {
    // First, check if user has access to this center
    if (user?.role !== 'super_admin' && accessibleCenterNames.size > 0) {
      if (!accessibleCenterNames.has(c.center)) return false
    }
    // Then apply centerFilter selection
    return centerFilter === 'all' ? true : c.center === centerFilter
  })

  const errorRows = health?.error_by_page ?? []
  const errorTotalPages = Math.max(
    1,
    Math.ceil(errorRows.length / ITEMS_PER_PAGE),
  )
  const pagedErrorRows = errorRows.slice(
    (errorTablePage - 1) * ITEMS_PER_PAGE,
    errorTablePage * ITEMS_PER_PAGE,
  )

  const onlineTotalPages = Math.max(
    1,
    Math.ceil(filteredOnlineUsers.length / ITEMS_PER_PAGE),
  )
  const pagedOnlineUsers = filteredOnlineUsers.slice(
    (onlineTablePage - 1) * ITEMS_PER_PAGE,
    onlineTablePage * ITEMS_PER_PAGE,
  )

  const managerRankingTotalPages = Math.max(
    1,
    Math.ceil(filteredManagerInteractionRanking.length / ITEMS_PER_PAGE),
  )
  const pagedManagerRankingRows = filteredManagerInteractionRanking.slice(
    (managerRankingTablePage - 1) * ITEMS_PER_PAGE,
    managerRankingTablePage * ITEMS_PER_PAGE,
  )

  const teacherRankingTotalPages = Math.max(
    1,
    Math.ceil(filteredTeacherInteractionRanking.length / ITEMS_PER_PAGE),
  )
  const pagedTeacherRankingRows = filteredTeacherInteractionRanking.slice(
    (teacherRankingTablePage - 1) * ITEMS_PER_PAGE,
    teacherRankingTablePage * ITEMS_PER_PAGE,
  )

  const centerTotalPages = Math.max(
    1,
    Math.ceil(filteredCenterUsage.length / ITEMS_PER_PAGE),
  )
  const pagedCenterRows = filteredCenterUsage.slice(
    (centerTablePage - 1) * ITEMS_PER_PAGE,
    centerTablePage * ITEMS_PER_PAGE,
  )

  const selectedCenterActorDetails = selectedCenterDetail
    ? engagement?.center_actor_details?.[selectedCenterDetail]
    : undefined
  const selectedCenterFallbackUsers = selectedCenterDetail
    ? (engagement?.center_user_details?.[selectedCenterDetail] ?? [])
    : []
  const selectedCenterTeachers =
    selectedCenterActorDetails?.teachers ??
    selectedCenterFallbackUsers.filter((u) => u.actor_type !== 'manager')
  const selectedCenterManagers =
    selectedCenterActorDetails?.managers ??
    selectedCenterFallbackUsers.filter((u) => u.actor_type === 'manager')
  const selectedCenterAccountCount =
    selectedCenterTeachers.length + selectedCenterManagers.length
  const activeCenterActorRows =
    selectedCenterActorTab === 'teacher'
      ? selectedCenterTeachers
      : selectedCenterManagers
  const centerActorTabs = [
    {
      id: 'teacher' as const,
      label: 'Giáo viên',
      count: selectedCenterTeachers.length,
    },
    {
      id: 'manager' as const,
      label: 'Quản lý',
      count: selectedCenterManagers.length,
    },
  ]
  const topManagerInteraction = engagement?.manager_interaction_ranking?.[0]
  const topTeacherInteraction = engagement?.teacher_interaction_ranking?.[0]

  useEffect(() => {
    setErrorTablePage(1)
    setOnlineTablePage(1)
    setManagerRankingTablePage(1)
    setTeacherRankingTablePage(1)
    setCenterTablePage(1)
  }, [fromDate, toDate])

  useEffect(() => {
    setOnlineTablePage(1)
    setManagerRankingTablePage(1)
    setTeacherRankingTablePage(1)
  }, [normalizedUserSearch])

  useEffect(() => {
    setCenterTablePage(1)
  }, [centerFilter])

  useEffect(() => {
    if (errorTablePage > errorTotalPages) setErrorTablePage(errorTotalPages)
  }, [errorTablePage, errorTotalPages])

  useEffect(() => {
    if (onlineTablePage > onlineTotalPages) setOnlineTablePage(onlineTotalPages)
  }, [onlineTablePage, onlineTotalPages])

  useEffect(() => {
    if (managerRankingTablePage > managerRankingTotalPages) {
      setManagerRankingTablePage(managerRankingTotalPages)
    }
  }, [managerRankingTablePage, managerRankingTotalPages])

  useEffect(() => {
    if (teacherRankingTablePage > teacherRankingTotalPages) {
      setTeacherRankingTablePage(teacherRankingTotalPages)
    }
  }, [teacherRankingTablePage, teacherRankingTotalPages])

  useEffect(() => {
    if (centerTablePage > centerTotalPages) setCenterTablePage(centerTotalPages)
  }, [centerTablePage, centerTotalPages])

  useEffect(() => {
    if (!selectedCenterDetail) return
    setSelectedCenterActorTab('teacher')
  }, [selectedCenterDetail])

  useEffect(() => {
    if (!selectedCenterDetail) return
    if (
      !engagement?.center_actor_details?.[selectedCenterDetail] &&
      !engagement?.center_user_details?.[selectedCenterDetail]
    ) {
      setSelectedCenterDetail(null)
    }
  }, [engagement, selectedCenterDetail])

  useEffect(() => {
    if (!selectedCenterDetail) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCenterDetail(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCenterDetail])

  if (authLoading || user?.role !== 'super_admin') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <PageContainer
      title="Quản lý chỉ số hệ thống"
      description="Theo dõi sức khỏe, hiệu suất và hành vi người dùng trong hệ thống TPS"
    >
      {(errorAlert || dbAlert) && (
        <div className="mb-4 space-y-2">
          {errorAlert && (
            <div className="animate-in slide-in-from-top-2 fade-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm duration-300 sm:items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-800">
                  Cảnh báo: Tỷ lệ lỗi cao
                </p>
                <p className="text-xs text-red-600">
                  Error rate hiện tại: {health?.error_rate}% (ngưỡng: 5%). Kiểm
                  tra logs ngay.
                </p>
              </div>
            </div>
          )}
          {dbAlert && (
            <div className="animate-in slide-in-from-top-2 fade-in flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm duration-300 sm:items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Database className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  Cảnh báo: DB connection cao
                </p>
                <p className="text-xs text-amber-600">
                  Sử dụng hiện tại: {health?.db_usage}% (ngưỡng: 80%). Cân nhắc
                  scale pool.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 sm:w-auto sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
            <span className="text-[11px] font-medium text-gray-500">
              Từ ngày
            </span>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => handleFromDateChange(event.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:h-8 sm:w-auto sm:text-xs"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
            <span className="text-[11px] font-medium text-gray-500">
              Tới ngày
            </span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => handleToDateChange(event.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:h-8 sm:w-auto sm:text-xs"
            />
          </label>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
          <span className="min-w-0 truncate text-[10px] text-gray-400 sm:text-right">
            Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
          </span>
          <button
            onClick={handleRefresh}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:border-[#a1001f] hover:bg-red-50/50 hover:text-[#a1001f] sm:min-h-0 sm:py-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
              <Activity className="h-3.5 w-3.5 text-[#a1001f]" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">
              Sức khỏe hệ thống
            </h2>
          </div>
          <button
            onClick={handleExportHealth}
            className="flex items-center gap-1 self-start text-[11px] font-medium text-gray-500 transition-colors hover:text-[#a1001f] sm:self-auto"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[140px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Người dùng đang online"
                value={health?.concurrent_users ?? 0}
                icon={Users}
                live
              />
              <MetricCard
                label="DB connection"
                value={health?.db_usage ?? 0}
                unit="%"
                icon={Database}
                progress={health?.db_usage ?? 0}
                warningThreshold={80}
              />
              <MetricCard
                label="API response time (p95)"
                value={health?.response_time_p95 ?? 0}
                unit="ms"
                icon={Zap}
                trend={
                  health?.response_time_trend !== undefined
                    ? {
                        value: Math.abs(health.response_time_trend),
                        direction:
                          health.response_time_trend > 0
                            ? 'up'
                            : health.response_time_trend < 0
                              ? 'down'
                              : 'flat',
                      }
                    : undefined
                }
              />
              <MetricCard
                label="Tỷ lệ lỗi"
                value={health?.error_rate ?? 0}
                unit="%"
                icon={AlertTriangle}
                detail={`500: ${health?.error_500 ?? 0}% | 404: ${health?.error_404 ?? 0}%`}
              />
            </div>

            <div className="mt-4 min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between max-sm:flex-wrap max-sm:gap-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  Chi tiết lỗi theo page (24h)
                </h3>
                <span className="text-[11px] text-gray-400">
                  Top {health?.error_by_page?.length ?? 0} page có lỗi
                </span>
              </div>

              {!health?.error_by_page || health.error_by_page.length === 0 ? (
                <div className="flex min-h-[112px] items-center justify-center px-3 text-center text-sm text-gray-400">
                  Chưa có dữ liệu lỗi theo page
                </div>
              ) : (
                <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
                  <table className="min-w-[46rem] w-full text-left">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Page
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Tổng lỗi
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          500
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          404
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Request
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Tỷ lệ lỗi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedErrorRows.map((row) => (
                        <tr key={row.page} className="hover:bg-gray-50/70">
                          <td className="max-w-[18.75rem] truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                            {row.page}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-900">
                            {row.total_errors.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.errors_500.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.errors_404.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.total_requests.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-gray-800">
                            {row.error_rate !== null
                              ? `${row.error_rate}%`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <NumberedPagination
                page={errorTablePage}
                totalPages={errorTotalPages}
                onChange={setErrorTablePage}
              />
            </div>
          </>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
              <TrendingUp className="h-3.5 w-3.5 text-[#a1001f]" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">
              Tương tác theo vai trò
            </h2>
          </div>
          <button
            onClick={handleExportEngagement}
            className="flex items-center gap-1 self-start text-[11px] font-medium text-gray-500 transition-colors hover:text-[#a1001f] sm:self-auto"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>

        {engagementLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[280px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Thời gian phiên trung bình"
                value={formatDuration(engagement?.avg_session_duration ?? 0)}
                icon={Timer}
              />
              <MetricCard
                label="Thiết bị di động"
                value={engagement?.devices?.mobile ?? 0}
                unit="%"
                icon={Smartphone}
              />
              <MetricCard
                label="Tổng lượt xem trang"
                value={
                  engagement?.top_pages
                    ?.reduce((s, p) => s + p.views, 0)
                    .toLocaleString() ?? '0'
                }
                icon={Clock}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EngagementChart
                  dau={engagement?.dau ?? []}
                  wau={engagement?.wau ?? []}
                  activeTab={chartTab}
                  onTabChange={setChartTab}
                />
              </div>
              <DevicePieChart
                mobile={engagement?.devices?.mobile ?? 0}
                desktop={engagement?.devices?.desktop ?? 0}
              />
            </div>

            <div className="mt-4">
              <TopPagesTable pages={engagement?.top_pages ?? []} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Giáo viên online (5 phút)
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {engagement?.online_users?.length ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Dựa trên lượt xem trang gần nhất
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Quản lý tương tác nhiều nhất
                </p>
                <p className="mt-1 truncate text-xl font-bold text-gray-900 sm:text-2xl">
                  {topManagerInteraction?.user_id || '-'}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {topManagerInteraction?.interactions ?? 0} lượt tương tác
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Giáo viên tương tác nhiều nhất
                </p>
                <p className="mt-1 truncate text-xl font-bold text-gray-900 sm:text-2xl">
                  {topTeacherInteraction?.user_id || '-'}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {topTeacherInteraction?.interactions ?? 0} lượt tương tác
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Cơ sở hoạt động cao nhất
                </p>
                <p className="mt-1 truncate text-2xl font-bold text-gray-900">
                  {engagement?.center_usage?.[0]?.center || '-'}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {engagement?.center_usage?.[0]?.usage_count ?? 0} lượt sử dụng
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:col-span-2 lg:flex-row lg:items-center lg:justify-between xl:col-span-3">
                <p className="min-w-0 text-xs font-medium text-gray-600">
                  Tìm kiếm nhanh tài khoản (áp dụng cho trực tuyến + xếp hạng)
                </p>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Nhập email hoặc tên đăng nhập..."
                    className="min-h-10 w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:w-72 sm:text-xs"
                  />
                  <button
                    onClick={handleResetUserAndCenterFilters}
                    className="min-h-10 shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-[#a1001f] hover:text-[#a1001f]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                  Giáo viên đang trực tuyến
                </h3>
                {filteredOnlineUsers.length === 0 ? (
                <div className="flex min-h-[144px] items-center justify-center px-3 text-center text-sm text-gray-400">
                    Chưa có giáo viên trực tuyến
                  </div>
                ) : (
                  <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
                    <table className="min-w-[32rem] w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Giáo viên
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Lượt trong 5 phút
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Lần truy cập gần nhất
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pagedOnlineUsers.map((u) => (
                          <tr key={u.user_id} className="hover:bg-gray-50/70">
                            <td className="max-w-[13.75rem] truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                              {u.user_id}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {u.hits_5m}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {new Date(u.last_seen).toLocaleTimeString(
                                'vi-VN',
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <NumberedPagination
                  page={onlineTablePage}
                  totalPages={onlineTotalPages}
                  onChange={setOnlineTablePage}
                />
              </div>

              <InteractionRankingTable
                title="Quản lý tương tác nhiều nhất"
                actorLabel="Quản lý"
                emptyText="Chưa có dữ liệu tương tác của quản lý"
                rows={pagedManagerRankingRows}
                page={managerRankingTablePage}
                totalPages={managerRankingTotalPages}
                onPageChange={setManagerRankingTablePage}
              />

              <InteractionRankingTable
                title="Giáo viên tương tác nhiều nhất"
                actorLabel="Giáo viên"
                emptyText="Chưa có dữ liệu tương tác của giáo viên"
                rows={pagedTeacherRankingRows}
                page={teacherRankingTablePage}
                totalPages={teacherRankingTotalPages}
                onPageChange={setTeacherRankingTablePage}
              />
            </div>

            <div className="mt-4 min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Sử dụng theo cơ sở
                </h3>
                <select
                  value={centerFilter}
                  onChange={(e) => setCenterFilter(e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:min-h-0 sm:w-auto sm:text-xs"
                >
                  <option value="all">Tất cả cơ sở</option>
                  {centerOptions.map((center) => (
                    <option key={center} value={center}>
                      {center}
                    </option>
                  ))}
                </select>
              </div>
              {filteredCenterUsage.length === 0 ? (
                <div className="flex min-h-[112px] items-center justify-center px-3 text-center text-sm text-gray-400">
                  Chưa có dữ liệu theo cơ sở
                </div>
              ) : (
                <div className="space-y-4">
                  <CenterUsageChart data={filteredCenterUsage} />

                  <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-gray-100">
                    <table className="min-w-[58rem] w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Cơ sở
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Tổng tài khoản
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Giáo viên
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Quản lý
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Lượt sử dụng
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Tần suất / tài khoản
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pagedCenterRows.map((c) => (
                          <tr key={c.center} className="hover:bg-gray-50/70">
                            <td className="max-w-[18.75rem] truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate">
                                  {c.center}
                                </span>
                                <button
                                  onClick={() =>
                                    setSelectedCenterDetail(c.center)
                                  }
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-[#a1001f] hover:text-[#a1001f] sm:h-7 sm:w-7"
                                  title="Xem chi tiết tài khoản"
                                  aria-label={`Xem giáo viên và quản lý sử dụng tại ${c.center}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.users}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.teacher_users ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.manager_users ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.usage_count}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.usage_per_user}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <NumberedPagination
                page={centerTablePage}
                totalPages={centerTotalPages}
                onChange={setCenterTablePage}
              />
            </div>

            {selectedCenterDetail && (
              <div
                className="fixed inset-0 z-modal-backdrop-custom flex items-center justify-center overflow-y-auto bg-slate-950/45 p-2 backdrop-blur-[2px] sm:p-4"
                onClick={() => setSelectedCenterDetail(null)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="center-detail-title"
                  aria-describedby="center-detail-description"
                  className="flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl ring-1 ring-black/5 sm:h-[90dvh] sm:max-h-[620px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#7f0f1c] bg-[#a1001f] px-4 py-4 text-white sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                        Chi tiết cơ sở
                      </p>
                      <h4
                        id="center-detail-title"
                        className="mt-1 truncate text-sm font-semibold text-white sm:text-base"
                      >
                        {selectedCenterDetail}
                      </h4>
                      <p
                        id="center-detail-description"
                        className="mt-1 text-[11px] text-white/75 sm:text-xs"
                      >
                        {selectedCenterAccountCount} tài khoản trong kỳ đã chọn
                        ({selectedCenterTeachers.length} giáo viên,{' '}
                        {selectedCenterManagers.length} quản lý)
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCenterDetail(null)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:border-white/40 hover:bg-white/20 sm:h-9 sm:w-9"
                      aria-label="Đóng"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
                    {selectedCenterAccountCount === 0 ? (
                      <div className="flex h-full min-h-[240px] items-center justify-center px-3 text-center text-sm text-gray-400">
                        Chưa có dữ liệu tài khoản cho cơ sở này
                      </div>
                    ) : (
                      <div className="flex min-h-full min-w-0 flex-col gap-4 sm:gap-5">
                        <div
                          role="tablist"
                          aria-label="Chọn nhóm tài khoản trong cơ sở"
                          className="inline-flex w-fit max-w-full shrink-0 gap-1 overflow-x-auto rounded-full border border-gray-200 bg-gray-100 p-1 shadow-inner"
                        >
                          {centerActorTabs.map((tab) => {
                            const isActive = selectedCenterActorTab === tab.id
                            const tabId = `center-detail-${tab.id}-tab`
                            const panelId = `center-detail-${tab.id}-panel`

                            return (
                              <button
                                key={tab.id}
                                id={tabId}
                                role="tab"
                                type="button"
                                aria-selected={isActive}
                                aria-controls={panelId}
                                onClick={() => setSelectedCenterActorTab(tab.id)}
                                className={`flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/35 sm:min-h-8 ${
                                  isActive
                                    ? 'bg-[#a1001f] text-white shadow-sm shadow-[#a1001f]/20'
                                    : 'text-gray-600 hover:bg-white hover:text-[#a1001f]'
                                }`}
                              >
                                <span>{tab.label}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                                    isActive
                                      ? 'bg-white/18 text-white'
                                      : 'bg-white text-gray-500'
                                  }`}
                                >
                                  {tab.count}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        <CenterActorDetailSection
                          title={
                            selectedCenterActorTab === 'teacher'
                              ? 'Danh sách giáo viên'
                              : 'Danh sách quản lý'
                          }
                          rows={activeCenterActorRows}
                          emptyText={
                            selectedCenterActorTab === 'teacher'
                              ? 'Chưa có giáo viên sử dụng tại cơ sở này'
                              : 'Chưa có quản lý sử dụng tại cơ sở này'
                          }
                          panelId={`center-detail-${selectedCenterActorTab}-panel`}
                          labelledBy={`center-detail-${selectedCenterActorTab}-tab`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
            <Zap className="h-3.5 w-3.5 text-[#a1001f]" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Chỉ số sản phẩm</h2>
        </div>

        {engagementLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[100px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D1
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d1 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 1 ngày
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D7
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d7 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 7 ngày
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D30
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d30 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 30 ngày
                </p>
              </div>
            </div>

            {engagement?.feature_usage &&
              engagement.feature_usage.length > 0 && (
                <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-gray-800">
                    Sử dụng tính năng
                  </h3>
                  <div className="space-y-3">
                    {engagement.feature_usage.map((f) => {
                      const maxUsage = Math.max(
                        ...engagement.feature_usage.map((x) => x.usage_count),
                      )
                      const pct =
                        maxUsage > 0
                          ? Math.round((f.usage_count / maxUsage) * 100)
                          : 0

                      return (
                        <div
                          key={f.feature}
                          className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <span className="min-w-0 truncate text-xs font-medium text-gray-700 sm:w-40 sm:shrink-0">
                            {f.feature}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#a1001f]/80 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                            <span className="w-16 text-right text-[11px] tabular-nums text-gray-500">
                              {f.usage_count} lần
                            </span>
                            <span className="w-[72px] text-right text-[11px] tabular-nums text-gray-400">
                              {f.unique_users} người dùng
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
