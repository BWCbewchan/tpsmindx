'use client'

import { PageContainer } from '@/components/PageContainer'
import { StatCard } from '@/components/StatCard'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import {
  Award,
  BarChart3,
  Building2,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BUMetric {
  bu_name: string
  teacher_count: number
  avg_expertise_score: number | null
  expertise_participant_count: number
  max_teacher_score: number | null
  max_score_teachers_count: number
}

// ─── Permission check ─────────────────────────────────────────────────────────

function canViewBUDashboard(user: {
  role?: string
  userRoles?: string[]
  isAdmin?: boolean
} | null): boolean {
  if (!user) return false
  // super_admin (system role)
  if (user.role === 'super_admin') return true
  // TM / TEGL (role codes trong bảng user_roles)
  const roleCodes = (user.userRoles || []).map((r) =>
    String(r).toUpperCase().trim(),
  )
  return roleCodes.includes('TM') || roleCodes.includes('TEGL')
}


// ─── Custom Recharts components for Tremor design ───────────────────────────

const CustomYAxisTick = (props: any) => {
  const { x, y, payload, index, data, onSelectBU } = props
  const rank = index
  const buName = payload.value
  const shieldNum = Math.min(100, rank + 1)

  const handleClick = () => {
    if (onSelectBU && data) {
      const buData = data.find((d: any) => d.bu_name === buName)
      if (buData) {
        onSelectBU(buData)
      }
    }
  }

  return (
    <g transform={`translate(${x},${y})`} onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Rank Shield Badge */}
      <image
        href={`/images/rank-${shieldNum}.png`}
        x={-238}
        y={-18}
        width={36}
        height={36}
      />

      {/* BU Name */}
      <text
        x={-195}
        y={4}
        textAnchor="start"
        fontSize={11}
        fontWeight={rank < 3 ? 'bold' : 'medium'}
        fill={rank < 3 ? '#1e293b' : '#475569'}
      >
        {buName.length > 22 ? `${buName.slice(0, 22)}...` : buName}
      </text>
    </g>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as BUMetric
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-xl text-xs font-sans">
        <p className="font-bold text-[#a1001f] mb-1.5">{data.bu_name}</p>
        <div className="space-y-1">
          <p className="flex justify-between gap-4 text-slate-500">
            <span>Điểm chuyên sâu TB:</span>
            <span className="font-semibold text-slate-800">
              {data.avg_expertise_score != null ? data.avg_expertise_score.toFixed(2) : '—'}
            </span>
          </p>
          <p className="flex justify-between gap-4 text-slate-500">
            <span>Số GV thực hiện bài:</span>
            <span className="font-semibold text-slate-800">
              {data.expertise_participant_count} người
            </span>
          </p>
          <p className="flex justify-between gap-4 text-slate-500">
            <span>Tổng số GV hoạt động:</span>
            <span className="font-semibold text-slate-800">
              {data.teacher_count} người
            </span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

const TrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-xl text-xs font-sans">
        <p className="font-bold text-[#a1001f] mb-1.5">Tháng {data.month}</p>
        <div className="space-y-1">
          <p className="flex justify-between gap-4 text-slate-500">
            <span>Điểm chuyên sâu TB:</span>
            <span className="font-semibold text-slate-800">
              {data.avg_score != null ? data.avg_score.toFixed(2) : '—'}
            </span>
          </p>
          <p className="flex justify-between gap-4 text-slate-500">
            <span>Số lượt thực hiện:</span>
            <span className="font-semibold text-slate-800">
              {data.participant_count} lượt
            </span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

// ─── BU Detail Table Removed (Replaced by Interactive Modals on BarChart) ─────

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, token, isLoading: authLoading } = useAuth()


  /**
   * AppLayout có thể render children khi user.isAdmin=true từ localStorage,
   * trước khi /api/auth/me hoàn tất và cập nhật user.role đúng.
   * roleConfirmed = true sau khi user có email (tức /api/auth/me đã trả về).
   * authLoading = false báo hiệu /api/auth/me xong.
   */
  const hasAccess = useMemo(() => {
    // Nếu auth đang load → chưa biết role → không phán xét
    if (authLoading) return null
    const res = canViewBUDashboard(user)
    console.log("BU Dashboard Debug:", { user, authLoading, hasAccess: res })
    return res
  }, [user, authLoading])

  const [data, setData] = useState<BUMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [availableMonths, setAvailableMonths] = useState<Array<{ month: number; year: number }>>([])
  const [trendData, setTrendData] = useState<Array<{ month: string; avg_score: number | null; participant_count: number }>>([])
  const [selectedBU, setSelectedBU] = useState<BUMetric | null>(null)
  const [selectedTrendBU, setSelectedTrendBU] = useState<string>('all')
  const [modalTeachers, setModalTeachers] = useState<Array<{ code: string; email: string; score: number | null }>>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    if (!selectedBU) {
      setModalTeachers([])
      return
    }

    setModalLoading(true)
    setModalError('')

    let url = `/api/dashboard/bu-metrics/teachers?bu_name=${encodeURIComponent(selectedBU.bu_name)}`
    if (selectedMonth !== 'all') {
      const [m, y] = selectedMonth.split('-')
      url += `&month=${m}&year=${y}`
    }

    fetch(url, {
      cache: 'no-store',
      headers: authHeaders(token),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setModalTeachers(json.data || [])
        } else {
          setModalError(json.error || 'Lỗi tải danh sách giáo viên')
        }
      })
      .catch(() => setModalError('Lỗi kết nối máy chủ'))
      .finally(() => setModalLoading(false))
  }, [selectedBU, selectedMonth, token])

  useEffect(() => {
    if (hasAccess !== true) return
    setLoading(true)

    let url = '/api/dashboard/bu-metrics'

    if (selectedMonth !== 'all') {
      const [m, y] = selectedMonth.split('-')
      url += `?month=${m}&year=${y}`
    }

    const hasQuery = url.includes('?')
    url += `${hasQuery ? '&' : '?'}trend_bu=${encodeURIComponent(selectedTrendBU)}`

    fetch(url, {
      cache: 'no-store',
      headers: authHeaders(token),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json.data || [])
          if (json.available_months) {
            setAvailableMonths(json.available_months)
          }
          if (json.trend_data) {
            setTrendData(json.trend_data)
          }
        } else {
          setError(json.error || 'Lỗi tải dữ liệu')
        }
      })
      .catch(() => setError('Lỗi kết nối'))
      .finally(() => setLoading(false))
  }, [hasAccess, token, selectedMonth, selectedTrendBU])


  // Derived stats
  const totalTeachers = useMemo(
    () => data.reduce((s, d) => s + d.teacher_count, 0),
    [data],
  )
  const avgScoreOverall = useMemo(() => {
    const withScore = data.filter((d) => d.avg_expertise_score != null)
    if (withScore.length === 0) return null
    return withScore.reduce((s, d) => s + d.avg_expertise_score!, 0) / withScore.length
  }, [data])
  const topBU = useMemo(() => {
    const withScore = [...data].filter((d) => d.avg_expertise_score != null)
    if (withScore.length === 0) return null
    return withScore.sort((a, b) => {
      const avgA = a.avg_expertise_score ?? -1
      const avgB = b.avg_expertise_score ?? -1
      if (avgB !== avgA) return avgB - avgA

      const maxA = a.max_teacher_score ?? -1
      const maxB = b.max_teacher_score ?? -1
      if (maxB !== maxA) return maxB - maxA

      const teachersCountDiff = b.max_score_teachers_count - a.max_score_teachers_count
      if (teachersCountDiff !== 0) return teachersCountDiff

      // Tiêu chí 4: Tỷ lệ hoàn thành chuyên sâu (expertise_participant_count / teacher_count)
      const rateA = a.teacher_count > 0 ? (a.expertise_participant_count / a.teacher_count) : 0
      const rateB = b.teacher_count > 0 ? (b.expertise_participant_count / b.teacher_count) : 0
      return rateB - rateA
    })[0]
  }, [data])

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const avgA = a.avg_expertise_score ?? -1
      const avgB = b.avg_expertise_score ?? -1
      if (avgB !== avgA) return avgB - avgA

      const maxA = a.max_teacher_score ?? -1
      const maxB = b.max_teacher_score ?? -1
      if (maxB !== maxA) return maxB - maxA

      const teachersCountDiff = b.max_score_teachers_count - a.max_score_teachers_count
      if (teachersCountDiff !== 0) return teachersCountDiff

      // Tiêu chí 4: Tỷ lệ hoàn thành chuyên sâu (expertise_participant_count / teacher_count)
      const rateA = a.teacher_count > 0 ? (a.expertise_participant_count / a.teacher_count) : 0
      const rateB = b.teacher_count > 0 ? (b.expertise_participant_count / b.teacher_count) : 0
      return rateB - rateA
    })
  }, [data])

  // ── Chờ auth context xác nhận role từ /api/auth/me (tránh flash placeholder) ──
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-[#a1001f] opacity-60" />
      </div>
    )
  }

  // ── No permission view ──────────────────────────────────────────────────────
  if (!hasAccess) {

    return (
      <PageContainer
        title="Dashboard"
        description="Tổng quan hệ thống"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#a1001f] to-[#c41230] flex items-center justify-center mx-auto mb-5">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Chào mừng đến trang chủ
            </h2>
            <p className="text-sm text-gray-500">
              Sử dụng menu bên trái để điều hướng
            </p>
          </div>
        </div>
      </PageContainer>
    )
  }

  // ── Authorized view ─────────────────────────────────────────────────────────
  return (
    <PageContainer
      title="Dashboard"
      description="Thống kê chất lượng giáo viên"
      headerActions={
        <div className="flex items-center gap-3">
          {/* Bộ lọc tháng */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kỳ đánh giá:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#a1001f] font-semibold text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((m) => (
                <option key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
                  Tháng {String(m.month).padStart(2, '0')}/{m.year}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#a1001f]" />
            <span className="text-sm">Đang tải dữ liệu BU...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center bg-red-50 border border-red-100 rounded-xl px-8 py-6 max-w-sm">
            <p className="text-red-600 font-semibold mb-1">Lỗi tải dữ liệu</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Stat cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              title="Tổng số giáo viên"
              value={totalTeachers.toLocaleString()}
              icon={Users}
              color="red"
              description="Toàn hệ thống"
            />
            <StatCard
              title="Tổng số BU"
              value={data.length}
              icon={Building2}
              color="blue"
              description="Cơ sở đang hoạt động"
            />
            <StatCard
              title="Điểm chuyên sâu"
              value={
                avgScoreOverall != null
                  ? avgScoreOverall.toFixed(2)
                  : '—'
              }
              icon={Award}
              color="green"
              description="Trung bình tất cả BU"
            />
            <StatCard
              title="BU điểm CS cao nhất"
              value={topBU ? topBU.avg_expertise_score!.toFixed(2) : '—'}
              icon={TrendingUp}
              color="purple"
              description={topBU ? topBU.bu_name : 'Chưa có dữ liệu'}
            />
          </div>

          {/* ── Chart section ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#a1001f]" />
                <h2 className="text-sm font-bold text-slate-800">
                  Thống Kê Điểm Trung Bình Chuyên Sâu giữa các BU
                </h2>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                Không có dữ liệu
              </div>
            ) : (
              <div className="px-5 py-4 overflow-y-auto max-h-[550px]">
                <ResponsiveContainer width="100%" height={sortedData.length * 44}>
                  <BarChart
                    layout="vertical"
                    data={sortedData}
                    margin={{ top: 10, right: 35, left: 10, bottom: 10 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const buData = state.activePayload[0].payload as BUMetric
                        setSelectedBU(buData)
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} hide />
                    <YAxis
                      type="category"
                      dataKey="bu_name"
                      width={240}
                      tick={<CustomYAxisTick data={sortedData} onSelectBU={setSelectedBU} />}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(161, 0, 31, 0.04)' }}
                      content={<CustomTooltip />}
                    />
                    <Bar
                      dataKey="avg_expertise_score"
                      fill="#a1001f"
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    >
                      <LabelList
                        dataKey="avg_expertise_score"
                        position="right"
                        formatter={(v: any) => (v != null ? Number(v).toFixed(2) : '')}
                        style={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }}
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Trend chart section ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#a1001f]" />
                <h2 className="text-sm font-bold text-slate-800">
                  Xu Hướng Điểm Trung Bình Chuyên Sâu theo Tháng
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="trend-bu-select" className="text-xs text-slate-500 font-medium">Cơ sở:</label>
                <select
                  id="trend-bu-select"
                  value={selectedTrendBU}
                  onChange={(e) => setSelectedTrendBU(e.target.value)}
                  className="text-xs font-semibold text-slate-705 bg-slate-50 hover:bg-slate-100 active:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-100 transition-all cursor-pointer"
                >
                  <option value="all">Toàn hệ thống</option>
                  {data.map((bu) => (
                    <option key={bu.bu_name} value={bu.bu_name}>
                      {bu.bu_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                Không có dữ liệu xu hướng
              </div>
            ) : (
              <div className="px-5 py-4">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a1001f" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#a1001f" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip content={<TrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="avg_score"
                      stroke="#a1001f"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAvg)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── BU Detail Modal ────────────────────────────────────────────── */}
          {selectedBU && (() => {
            const rank = sortedData.findIndex(bu => bu.bu_name === selectedBU.bu_name) + 1
            const shieldNum = Math.min(100, rank)
            const rate = selectedBU.teacher_count > 0
              ? ((selectedBU.expertise_participant_count / selectedBU.teacher_count) * 100).toFixed(1)
              : '0.0'

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity duration-300">
                <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95">
                  {/* Subtle MindX Watermark (Rotated and Larger for Premium Brand Feel) */}
                  <img
                    src="/logo.svg"
                    alt=""
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-auto opacity-[0.045] pointer-events-none select-none z-0 rotate-[-12deg]"
                  />

                  {/* Modal Header */}
                  <div className="relative flex items-center justify-between px-6 py-4 bg-slate-50/80 backdrop-blur-[2px] border-b border-slate-100 z-10 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={`/images/rank-${shieldNum}.png`}
                        alt={`Hạng ${rank}`}
                        className="w-10 h-10 object-contain flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                          Hạng {rank}
                        </p>
                        <h3 className="text-sm font-extrabold text-slate-800 truncate leading-tight" title={selectedBU.bu_name}>
                          {selectedBU.bu_name}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedBU(null)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 font-bold flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="relative px-6 py-6 space-y-5 z-10 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-350">
                    {/* Score Card (Semi-transparent Red-to-Slate Gradient) */}
                    <div className="bg-gradient-to-r from-red-50/30 to-slate-50/20 p-4 rounded-xl border border-red-100/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-[#a1001f]" />
                        <span className="text-xs font-bold text-slate-700">Điểm chuyên sâu trung bình</span>
                      </div>
                      <span className="text-2xl font-black text-[#a1001f]">
                        {selectedBU.avg_expertise_score != null ? selectedBU.avg_expertise_score.toFixed(2) : '—'}
                      </span>
                    </div>

                    {/* Stats Grid (Translucent Glass Cards to let Watermark shine through) */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Stat 1 */}
                      <div className="bg-slate-50/30 backdrop-blur-[1px] p-4 rounded-xl border border-slate-100/40">
                        <p className="text-xs text-slate-400 font-semibold mb-1">Tổng số giáo viên</p>
                        <p className="text-xl font-bold text-slate-700">{selectedBU.teacher_count}</p>
                      </div>
                      {/* Stat 2 */}
                      <div className="bg-slate-50/30 backdrop-blur-[1px] p-4 rounded-xl border border-slate-100/40">
                        <p className="text-xs text-slate-400 font-semibold mb-1">GV thực hiện bài</p>
                        <p className="text-xl font-bold text-slate-700">{selectedBU.expertise_participant_count}</p>
                      </div>
                    </div>

                    {/* Participation Rate Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>Tỷ lệ thực hiện bài chuyên sâu</span>
                        <span className="font-bold text-[#a1001f]">{rate}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#a1001f] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, parseFloat(rate))}%` }}
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-100/50" />

                    {/* Teacher Scores List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                          Chi tiết điểm giáo viên
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {modalLoading ? 'Đang tải...' : `${modalTeachers.length} GV`}
                        </span>
                      </div>

                      {modalLoading ? (
                        <div className="space-y-2 py-1">
                          <div className="h-9 bg-slate-100/60 rounded-xl animate-pulse" />
                          <div className="h-9 bg-slate-100/60 rounded-xl animate-pulse" />
                        </div>
                      ) : modalError ? (
                        <p className="text-center text-xs text-red-500 py-3 font-medium">{modalError}</p>
                      ) : modalTeachers.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-4">Không có giáo viên hoạt động</p>
                      ) : (
                        <div className="space-y-1.5 pr-1">
                          {modalTeachers.map((teacher) => (
                            <div
                              key={teacher.code}
                              className="flex items-center justify-between px-3 py-2 bg-slate-50/30 hover:bg-slate-50/70 hover:translate-x-0.5 border border-slate-100/50 rounded-xl transition-all duration-200"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Styled Avatar with Initial */}
                                <div className="w-8 h-8 rounded-full bg-red-50/50 border border-red-100/40 text-[#a1001f] flex items-center justify-center font-black text-xs uppercase shrink-0">
                                  {teacher.code.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 truncate">
                                    {teacher.code}
                                  </p>
                                  {teacher.email && (
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {teacher.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                  teacher.score != null
                                    ? teacher.score >= 8.5
                                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                                      : teacher.score >= 7.0
                                      ? 'text-amber-700 bg-amber-50 border border-amber-100'
                                      : 'text-[#a1001f] bg-red-50 border border-red-100/50'
                                    : 'text-slate-400 bg-slate-100/50'
                                }`}
                              >
                                {teacher.score != null ? teacher.score.toFixed(2) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="relative px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end z-10 shrink-0">
                    <button
                      onClick={() => setSelectedBU(null)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#a1001f] hover:bg-[#800018] active:bg-[#600010] rounded-xl shadow-sm transition-all"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </PageContainer>
  )
}
