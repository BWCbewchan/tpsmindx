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
    <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`h-7 min-w-7 rounded-md px-2 text-xs font-medium transition-colors ${
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
  const [rankingTablePage, setRankingTablePage] = useState(1)
  const [centerTablePage, setCenterTablePage] = useState(1)
  const [selectedCenterDetail, setSelectedCenterDetail] = useState<
    string | null
  >(null)

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
    setRankingTablePage(1)
    setCenterTablePage(1)
  }

  const filteredOnlineUsers = (engagement?.online_users ?? []).filter((u) =>
    u.user_id.toLowerCase().includes(normalizedUserSearch),
  )

  const filteredInteractionRanking = (
    engagement?.user_interaction_ranking ?? []
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

  const rankingTotalPages = Math.max(
    1,
    Math.ceil(filteredInteractionRanking.length / ITEMS_PER_PAGE),
  )
  const pagedRankingRows = filteredInteractionRanking.slice(
    (rankingTablePage - 1) * ITEMS_PER_PAGE,
    rankingTablePage * ITEMS_PER_PAGE,
  )

  const centerTotalPages = Math.max(
    1,
    Math.ceil(filteredCenterUsage.length / ITEMS_PER_PAGE),
  )
  const pagedCenterRows = filteredCenterUsage.slice(
    (centerTablePage - 1) * ITEMS_PER_PAGE,
    centerTablePage * ITEMS_PER_PAGE,
  )

  const selectedCenterUsers = selectedCenterDetail
    ? (engagement?.center_user_details?.[selectedCenterDetail] ?? [])
    : []

  useEffect(() => {
    setErrorTablePage(1)
    setOnlineTablePage(1)
    setRankingTablePage(1)
    setCenterTablePage(1)
  }, [fromDate, toDate])

  useEffect(() => {
    setOnlineTablePage(1)
    setRankingTablePage(1)
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
    if (rankingTablePage > rankingTotalPages)
      setRankingTablePage(rankingTotalPages)
  }, [rankingTablePage, rankingTotalPages])

  useEffect(() => {
    if (centerTablePage > centerTotalPages) setCenterTablePage(centerTotalPages)
  }, [centerTablePage, centerTotalPages])

  useEffect(() => {
    if (!selectedCenterDetail) return
    if (!engagement?.center_user_details?.[selectedCenterDetail]) {
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
            <div className="animate-in slide-in-from-top-2 fade-in flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
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
            <div className="animate-in slide-in-from-top-2 fade-in flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Database className="h-4 w-4 text-amber-600" />
              </div>
              <div>
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

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 sm:w-auto sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500">
              Từ ngày
            </span>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => handleFromDateChange(event.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition-colors focus:border-[#a1001f]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500">
              Tới ngày
            </span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => handleToDateChange(event.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition-colors focus:border-[#a1001f]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-[10px] text-gray-400 sm:text-right">
            Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:border-[#a1001f] hover:bg-red-50/50 hover:text-[#a1001f]"
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
                className="h-35 animate-pulse rounded-xl bg-gray-100"
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

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between max-sm:flex-wrap max-sm:gap-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  Chi tiết lỗi theo page (24h)
                </h3>
                <span className="text-[11px] text-gray-400">
                  Top {health?.error_by_page?.length ?? 0} page có lỗi
                </span>
              </div>

              {!health?.error_by_page || health.error_by_page.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                  Chưa có dữ liệu lỗi theo page
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="min-w-180 w-full text-left">
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
                          <td className="max-w-75 truncate px-3 py-2.5 text-xs font-medium text-gray-700">
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
              Tương tác người dùng
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
                className="h-70 animate-pulse rounded-xl bg-gray-100"
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

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Người dùng online (5 phút)
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {engagement?.online_users?.length ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Dựa trên lượt xem trang gần nhất
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-gray-500">
                  Người dùng tương tác nhiều nhất
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {engagement?.user_interaction_ranking?.[0]?.user_id || '-'}
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {engagement?.user_interaction_ranking?.[0]?.interactions ?? 0}{' '}
                  lượt tương tác
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs font-medium text-gray-600">
                  Tìm kiếm nhanh người dùng (áp dụng cho trực tuyến + xếp hạng)
                </p>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Nhập email hoặc tên đăng nhập..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:w-72"
                  />
                  <button
                    onClick={handleResetUserAndCenterFilters}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-[#a1001f] hover:text-[#a1001f]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                  Giáo viên đang trực tuyến
                </h3>
                {filteredOnlineUsers.length === 0 ? (
                  <div className="flex h-36 items-center justify-center text-sm text-gray-400">
                    Chưa có người dùng trực tuyến
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-130 w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Người dùng
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
                            <td className="max-w-55 truncate px-3 py-2.5 text-xs font-medium text-gray-700">
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

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                  Xếp hạng tần suất tương tác
                </h3>
                {filteredInteractionRanking.length === 0 ? (
                  <div className="flex h-36 items-center justify-center text-sm text-gray-400">
                    Chưa có dữ liệu tương tác
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-140 w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            #
                          </th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Người dùng
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
                        {pagedRankingRows.map((u) => (
                          <tr key={u.user_id} className="hover:bg-gray-50/70">
                            <td className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                              {u.rank}
                            </td>
                            <td className="max-w-45 truncate px-3 py-2.5 text-xs font-medium text-gray-700">
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
                  page={rankingTablePage}
                  totalPages={rankingTotalPages}
                  onChange={setRankingTablePage}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Sử dụng theo cơ sở
                </h3>
                <select
                  value={centerFilter}
                  onChange={(e) => setCenterFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none transition-colors focus:border-[#a1001f] sm:w-auto"
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
                <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                  Chưa có dữ liệu theo cơ sở
                </div>
              ) : (
                <div className="space-y-4">
                  <CenterUsageChart data={filteredCenterUsage} />

                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-180 w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Cơ sở
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Số người dùng
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Lượt sử dụng
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Tần suất / người dùng
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pagedCenterRows.map((c) => (
                          <tr key={c.center} className="hover:bg-gray-50/70">
                            <td className="max-w-75 truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{c.center}</span>
                                <button
                                  onClick={() =>
                                    setSelectedCenterDetail(c.center)
                                  }
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:border-[#a1001f] hover:text-[#a1001f]"
                                  title="Xem chi tiết người dùng"
                                  aria-label={`Xem người dùng sử dụng tại ${c.center}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                              {c.users}
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-4"
                onClick={() => setSelectedCenterDetail(null)}
              >
                <div
                  className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-white shadow-2xl ring-1 ring-black/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#7f0f1c] bg-[#a1001f] px-4 py-4 text-white sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                        Chi tiết cơ sở
                      </p>
                      <h4 className="mt-1 truncate text-sm font-semibold text-white sm:text-base">
                        {selectedCenterDetail}
                      </h4>
                      <p className="mt-1 text-[11px] text-white/75 sm:text-xs">
                        {selectedCenterUsers.length} người dùng trong kỳ đã chọn
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCenterDetail(null)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 hover:border-white/40"
                      aria-label="Đóng"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-[78vh] overflow-auto p-3 sm:max-h-[60vh] sm:p-5">
                    {selectedCenterUsers.length === 0 ? (
                      <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                        Chưa có dữ liệu người dùng cho cơ sở này
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 sm:hidden">
                          {selectedCenterUsers.map((u) => (
                            <div
                              key={`${selectedCenterDetail}-${u.user_id}`}
                              className="rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                            >
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-gray-800">
                                    {u.user_id}
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                                    Lần truy cập gần nhất:{' '}
                                    {new Date(u.last_seen).toLocaleString(
                                      'vi-VN',
                                    )}
                                  </p>
                                </div>
                                <div className="min-w-18 rounded-lg bg-gray-50 px-3 py-2 text-right">
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

                        <div className="hidden overflow-hidden rounded-xl border border-gray-100 sm:block">
                          <table className="min-w-140 w-full text-left">
                            <thead>
                              <tr className="bg-gray-50/80">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                  Người dùng
                                </th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                  Lượt sử dụng
                                </th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                  Lần truy cập gần nhất
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {selectedCenterUsers.map((u) => (
                                <tr
                                  key={`${selectedCenterDetail}-${u.user_id}`}
                                  className="hover:bg-gray-50/60"
                                >
                                  <td className="max-w-65 truncate px-4 py-3 text-xs font-medium text-gray-700">
                                    {u.user_id}
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-600">
                                    {u.usage_count}
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-600">
                                    {new Date(u.last_seen).toLocaleString(
                                      'vi-VN',
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
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
                className="h-25 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
                          className="flex items-center gap-3"
                        >
                          <span className="w-40 truncate text-xs font-medium text-gray-700">
                            {f.feature}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#a1001f]/80 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-[11px] tabular-nums text-gray-500">
                            {f.usage_count} lần
                          </span>
                          <span className="w-14 text-right text-[11px] tabular-nums text-gray-400">
                            {f.unique_users} người dùng
                          </span>
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
