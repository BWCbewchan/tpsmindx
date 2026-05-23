'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/app-toast'
import { motion, AnimatePresence } from 'framer-motion'
import GenTrackingTab from '../components/GenTrackingTab'
import GenSchedulingTab from '../components/GenSchedulingTab'
import GenOverviewTab from '../components/GenOverviewTab'
import GenOnboardingTab from '../components/GenOnboardingTab'
import GenSidebar from '../components/GenSidebar'
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  WandSparkles,
  LayoutGrid,
  Calendar,
  Eye,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react'

import { PageContainer } from '@/components/PageContainer'
import { useAuth } from '@/lib/auth-context'
import { HrCandidateRow, HrPagination, GenEntry } from '../types'

const PAGE_SIZE = 50

const emptyPagination: HrPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
}

type PlannerRegionFilter = 'all' | 'south' | 'north'

function sortGenEntries(a: GenEntry, b: GenEntry, order: 'asc' | 'desc') {
  const compareByCode = a.genCode.localeCompare(b.genCode, 'vi', {
    numeric: true,
  })
  if (compareByCode !== 0) {
    return order === 'desc' ? -compareByCode : compareByCode
  }
  return a.regionCode.localeCompare(b.regionCode, 'vi')
}

// --- Sub-component: Candidate hover popup cell ---
function CandidatePopupCell({
  row,
  rowIndex,
  formatDateTime,
}: {
  row: HrCandidateRow
  rowIndex: number
  formatDateTime: (v: string | null) => string
}) {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPopup = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(true)
  }

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 150)
  }

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )

  return (
    <div
      className="relative cursor-pointer"
      onMouseEnter={showPopup}
      onMouseLeave={scheduleHide}
    >
      <p className="text-sm font-semibold text-gray-900">
        {row.full_name || 'Chưa có tên'}
      </p>
      <p className="text-xs text-gray-500">{row.email || 'Không có email'}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 ${
            row.gen_name
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {row.gen_name || 'Chưa xếp GEN'}
        </span>
        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
          KV {row.region_code || 'N/A'}
        </span>
      </div>

      {/* Popup card */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: rowIndex < 3 ? -10 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: rowIndex < 3 ? -10 : 10 }}
            onMouseEnter={showPopup}
            onMouseLeave={scheduleHide}
            className={`absolute left-0 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl ring-1 ring-black/5 ${
              rowIndex < 3 ? 'top-full mt-1' : 'bottom-full mb-1'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900">{row.full_name || 'Chưa có tên'}</p>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                row.gen_name ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {row.gen_name || 'Chưa xếp GEN'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Email</p>
                <p className="mt-1 font-medium text-gray-800 break-all">{row.email || 'Không có'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">SĐT</p>
                <p className="mt-1 font-medium text-gray-800">{row.phone || 'Không có'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Khu vực</p>
                <p className="mt-1 font-medium text-gray-800">KV {row.region_code || 'N/A'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cơ sở</p>
                <p className="mt-1 font-medium text-gray-800">{row.desired_campus || 'Không có'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Trạng thái</p>
                <p className="mt-1 font-medium text-gray-800">{row.status}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nguồn</p>
                <p className="mt-1 font-medium text-gray-800">{row.source === 'csv' ? 'CSV' : 'Thủ công'}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
type ActiveTab = 'planner' | 'tracking' | 'scheduling' | 'overview' | 'onboarding'

export default function HrGenPlannerPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<ActiveTab>('planner')

  const [rows, setRows] = useState<HrCandidateRow[]>([])
  const [pagination, setPagination] = useState<HrPagination>(emptyPagination)
  const [regionTotalCandidates, setRegionTotalCandidates] = useState(0)
  const [regionAssignedCandidates, setRegionAssignedCandidates] = useState(0)
  const [regionUnassignedCandidates, setRegionUnassignedCandidates] =
    useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('unassigned')
  const [sourceGenFilter, setSourceGenFilter] = useState('all')
  const [sourceGenRegionFilter, setSourceGenRegionFilter] = useState<
    'all' | '1' | '2' | '3' | '4' | '5'
  >('all')
  const [regionFilter, setRegionFilter] = useState<PlannerRegionFilter>('all')
  const [page, setPage] = useState(1)

  const [availableGenEntries, setAvailableGenEntries] = useState<GenEntry[]>([])
  const [targetGen, setTargetGen] = useState('')
  const [newGenName, setNewGenName] = useState('')

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeGenKey, setActiveGenKey] = useState('')
  const [activeGenInfo, setActiveGenInfo] = useState<{
    genCode: string
    regionCode: string
  } | null>(null)

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [creatingGen, setCreatingGen] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const regionParam = searchParams.get('region')
    if (!regionParam) return

    if (
      regionParam === 'south' ||
      regionParam === 'north' ||
      regionParam === 'all'
    ) {
      setRegionFilter(regionParam as PlannerRegionFilter)
      setPage(1)
      setSelectedKeys(new Set())
    }
  }, [searchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
      setSelectedKeys(new Set())
    }, 250)

    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchBoardData = useCallback(
    async (forceRefresh = false) => {
      if (!user?.email) return

      if (forceRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const candidateParams = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          status: statusFilter,
        })

        if (search) candidateParams.set('search', search)
        if (sourceGenFilter !== 'all') candidateParams.set('gen', sourceGenFilter)
        if (regionFilter !== 'all') candidateParams.set('region', regionFilter)

        const [candidateRes, genRes] = await Promise.all([
          fetch(`/api/hr/candidates?${candidateParams.toString()}`, { cache: 'no-store' }),
          fetch('/api/hr/gens', { cache: 'no-store' }),
        ])

        const candidateData = await candidateRes.json()
        const genData = await genRes.json()

        if (!candidateRes.ok) throw new Error(candidateData.error || 'Không thể tải dữ liệu ứng viên.')
        if (!genRes.ok) throw new Error(genData.error || 'Không thể tải danh mục GEN.')

        setRows(candidateData.rows || [])
        setPagination(candidateData.pagination || emptyPagination)

        const summary = candidateData.summary || {}
        setRegionTotalCandidates(summary.total ?? 0)
        setRegionAssignedCandidates(summary.assigned ?? 0)
        setRegionUnassignedCandidates(summary.unassigned ?? 0)

        // Build GenEntry list từ catalog + summary.byGen
        const byGen: Record<string, number> = summary.byGen || {}
        const catalog: Array<{ id: number; gen_name: string }> = genData.catalog || []
        const entries: GenEntry[] = catalog.map(g => ({
          key: `all::${g.gen_name}`,
          genCode: g.gen_name,
          count: byGen[g.gen_name] || 0,
          regionCode: 'all',
          regionLabel: 'Tất cả khu vực',
          isTeacher4Plus: false,
          note: '',
        }))
        setAvailableGenEntries(entries)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user?.email, page, statusFilter, search, sourceGenFilter, regionFilter],
  )

  useEffect(() => {
    fetchBoardData(false)
  }, [fetchBoardData])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedKeys.has(String(row.id))),
    [rows, selectedKeys],
  )

  useEffect(() => {
    if (
      sourceGenFilter !== 'all' &&
      !availableGenEntries.some(
        (entry) =>
          entry.genCode === sourceGenFilter &&
          (sourceGenRegionFilter === 'all' ||
            entry.regionCode === sourceGenRegionFilter),
      )
    ) {
      setSourceGenFilter('all')
      setSourceGenRegionFilter('all')
      setPage(1)
      setSelectedKeys(new Set())
    }
  }, [availableGenEntries, sourceGenFilter, sourceGenRegionFilter])

  const regionOptions: Array<{ value: PlannerRegionFilter; label: string }> = [
    { value: 'all', label: 'Tất cả khu vực' },
    { value: 'south', label: 'Miền Nam (HCM + Tỉnh Nam)' },
    { value: 'north', label: 'Miền Bắc (Hà Nội + Tỉnh Bắc + Tỉnh Trung)' },
  ]

  const regionLabelMap: Record<PlannerRegionFilter, string> = {
    all: 'Tất cả khu vực',
    south: 'Miền Nam',
    north: 'Miền Bắc',
  }

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== 'unassigned' ||
    sourceGenFilter !== 'all' ||
    sourceGenRegionFilter !== 'all' ||
    regionFilter !== 'all'

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Chưa có'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('vi-VN')
  }

  const allSelected = rows.length > 0 && selectedKeys.size === rows.length

  const suggestedNextGen = useMemo(() => {
    const uniqueGenCodes = new Set(
      availableGenEntries
        .map((entry) => entry.genCode.trim().toUpperCase())
        .filter(Boolean),
    )

    const maxGenNumber = Array.from(uniqueGenCodes).reduce((max, genCode) => {
      const parsed = Number((genCode.match(/\d+/) || [])[0])
      if (Number.isNaN(parsed)) return max
      return Math.max(max, parsed)
    }, 0)

    let next = maxGenNumber + 1
    while (uniqueGenCodes.has(`GEN ${next}`)) {
      next += 1
    }

    return `GEN ${next}`
  }, [availableGenEntries])

  const handleToggleSelect = (candidateKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(candidateKey)) next.delete(candidateKey)
      else next.add(candidateKey)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set())
      return
    }
    setSelectedKeys(new Set(rows.map((row) => String(row.id))))
  }

  const submitCreateGen = async (rawGenName: string, isAuto = false) => {
    if (!user?.email) return

    const normalized = rawGenName.trim().toUpperCase()
    if (!normalized) {
      toast.error('Vui lòng nhập tên GEN mới.')
      return
    }

    setCreatingGen(true)
    try {
      const response = await fetch('/api/hr/gens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestEmail: user.email, genName: normalized }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tạo GEN mới.')

      toast.success(
        isAuto ? `Đã tự động tạo GEN ${data.gen}.` : `Đã thêm GEN ${data.gen}.`,
      )
      setNewGenName('')
      setTargetGen(data.gen)
      await fetchBoardData(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setCreatingGen(false)
    }
  }

  const handleCreateGen = async () => {
    await submitCreateGen(newGenName, false)
  }

  const handleAutoCreateGen = async () => {
    await submitCreateGen(suggestedNextGen, true)
  }

  const handleSelectGen = (entry: GenEntry) => {
    const isTogglingOff = activeGenKey === entry.key

    if (isTogglingOff) {
      setActiveGenKey('')
      setActiveGenInfo(null)
      setSourceGenFilter('all')
      setSourceGenRegionFilter('all')
      setTargetGen('')
      if (activeTab === 'planner') setStatusFilter('unassigned')
    } else {
      setActiveGenKey(entry.key)
      setActiveGenInfo({ genCode: entry.genCode, regionCode: entry.regionCode })
      setSourceGenFilter(entry.genCode)
      setSourceGenRegionFilter(entry.regionCode as '1' | '2' | '3' | '4' | '5')
      setTargetGen(entry.genCode)
      if (activeTab === 'planner') setStatusFilter('all')
    }

    setPage(1)
    setSelectedKeys(new Set())
  }

  const handleBulkAssign = async () => {
    if (!user?.email) return
    if (selectedRows.length === 0) {
      toast.error('Vui lòng chọn ứng viên để gán GEN.')
      return
    }
    if (!targetGen.trim()) {
      toast.error('Vui lòng chọn GEN đào tạo.')
      return
    }

    setAssigning(true)
    try {
      const assignRequests = selectedRows.map((row) =>
        fetch('/api/hr/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateId: row.id,
            assignedGen: targetGen,
          }),
        }),
      )

      const responses = await Promise.allSettled(assignRequests)
      let successCount = 0
      let failCount = 0

      for (const item of responses) {
        if (item.status === 'fulfilled') {
          if (item.value.ok) successCount += 1
          else failCount += 1
        } else {
          failCount += 1
        }
      }

      if (successCount > 0) toast.success(`Đã gán ${successCount} ứng viên vào GEN ${targetGen}.`)
      if (failCount > 0) toast.error(`${failCount} ứng viên gán GEN thất bại.`)

      setSelectedKeys(new Set())
      await fetchBoardData(true)
    } finally {
      setAssigning(false)
    }
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusFilter('unassigned')
    setSourceGenFilter('all')
    setSourceGenRegionFilter('all')
    setRegionFilter('all')
    setPage(1)
    setSelectedKeys(new Set())
  }

  const handleStatusCardFilter = (
    status: 'all' | 'assigned' | 'unassigned',
  ) => {
    setStatusFilter(status)
    setPage(1)
    setSelectedKeys(new Set())
  }

  const handleResetSourceGen = () => {
    setSourceGenFilter('all')
    setSourceGenRegionFilter('all')
    setPage(1)
    setSelectedKeys(new Set())
  }

  const handleStatusReset = () => {
    setStatusFilter('all')
    setPage(1)
    setSelectedKeys(new Set())
  }

  return (
    <PageContainer
      title="Kế Hoạch & Thiết Lập GEN"
      description="Trung tâm sắp xếp ứng viên vào GEN, phân bổ tài nguyên và kiểm soát tiến độ đào tạo."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-6 pb-16">
        {/* ── Top bar: back link + tabs ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/hr-candidates"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại trang danh sách
          </Link>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeTab === 'planner'
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              GEN Planner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tracking')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeTab === 'tracking'
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Theo dõi đào tạo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scheduling')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeTab === 'scheduling'
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Xếp lịch training
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye className="h-4 w-4" />
              Lịch training
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('onboarding')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeTab === 'onboarding'
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Đào tạo đầu vào
            </button>
          </div>
        </div>

        <div className="flex gap-6 items-start relative">
          <AnimatePresence mode="wait">
            {!isSidebarOpen && (
              <motion.div
                key="open-sidebar-btn"
                initial={{ opacity: 0, x: -20, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 'auto' }}
                exit={{ opacity: 0, x: -20, width: 0 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 pt-1"
              >
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="group flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-linear-to-br hover:from-[#a1001f] hover:to-[#c41230] hover:text-white hover:border-[#a1001f]"
                  title="Mở bộ lọc GEN"
                >
                  <Menu className="h-5 w-5 transition-transform group-hover:rotate-180 duration-300" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <GenSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            genEntries={availableGenEntries}
            activeGenKey={activeGenKey}
            onSelectGen={handleSelectGen}
            showCreateGen={activeTab === 'planner'}
            newGenName={newGenName}
            onNewGenNameChange={setNewGenName}
            onAutoCreateGen={handleAutoCreateGen}
            onCreateGen={handleCreateGen}
            creatingGen={creatingGen}
            suggestedNextGen={suggestedNextGen}
          />

          <div className="flex-1 min-w-0 space-y-6">
            {/* ══ TAB: GEN Planner ══════════════════════════════════════════ */}
            {activeTab === 'planner' && (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => {
                      handleStatusCardFilter('all')
                      handleResetSourceGen()
                    }}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
                      statusFilter === 'all' &&
                      sourceGenFilter === 'all' &&
                      sourceGenRegionFilter === 'all'
                        ? 'border-gray-400 bg-gray-50 ring-2 ring-gray-300'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tổng ứng viên khu vực
                    </p>
                    <p className="mt-2 text-2xl font-black text-gray-900">
                      {regionTotalCandidates}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusCardFilter(
                        statusFilter === 'unassigned' ? 'all' : 'unassigned',
                      )
                    }
                    className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
                      statusFilter === 'unassigned'
                        ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                        : 'border-red-200 bg-red-50/40 hover:border-red-300 hover:shadow'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                      Chưa xếp GEN
                    </p>
                    <p className="mt-2 text-2xl font-black text-red-700">
                      {regionUnassignedCandidates}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusCardFilter(
                        statusFilter === 'assigned' ? 'all' : 'assigned',
                      )
                    }
                    className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
                      statusFilter === 'assigned'
                        ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:shadow'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Đã có GEN
                    </p>
                    <p className="mt-2 text-2xl font-black text-emerald-800">
                      {regionAssignedCandidates}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSourceGen}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
                      sourceGenFilter === 'all' &&
                      sourceGenRegionFilter === 'all'
                        ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:shadow'
                    }`}
                    title="Nhấn để bỏ lọc nguồn GEN và xem toàn bộ mã GEN"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Số mã GEN đang hiển thị
                    </p>
                    <p className="mt-2 text-2xl font-black text-blue-800">
                      {availableGenEntries.length}
                    </p>
                  </button>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-gray-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-2 py-1 text-gray-700 ring-1 ring-gray-200">
                          Khu vực: {regionLabelMap[regionFilter]}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-gray-700 ring-1 ring-gray-200">
                          Nguồn GEN đào tạo:{' '}
                          {sourceGenFilter === 'all'
                            ? 'Tất cả'
                            : `${sourceGenFilter} (${sourceGenRegionFilter})`}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-gray-700 ring-1 ring-gray-200">
                          Trạng thái:{' '}
                          {statusFilter === 'all'
                            ? 'Tất cả'
                            : statusFilter === 'unassigned'
                              ? 'Chưa xếp GEN'
                              : 'Đã có GEN'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        disabled={!hasActiveFilters}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Tìm tên, email, mã UV..."
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 md:col-span-2"
                      />

                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(
                            e.target.value as 'all' | 'assigned' | 'unassigned',
                          )
                          setPage(1)
                          setSelectedKeys(new Set())
                        }}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="unassigned">Chưa xếp GEN</option>
                        <option value="assigned">Đã có GEN</option>
                      </select>

                      <select
                        value={regionFilter}
                        onChange={(e) => {
                          setRegionFilter(e.target.value as PlannerRegionFilter)
                          setPage(1)
                          setSelectedKeys(new Set())
                        }}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                      >
                        {regionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => fetchBoardData(true)}
                        disabled={refreshing}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#f3b4bd] bg-white text-[#a1001f] transition-colors hover:bg-[#a1001f]/5 disabled:opacity-60 md:justify-self-end"
                        title="Làm mới"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="max-sm:overflow-x-auto w-full">
                    <table className="min-w-full w-full text-left text-sm max-sm:min-w-[800px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={handleToggleSelectAll}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600"
                            />
                          </th>
                          <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                            Mã UV
                          </th>
                          <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                            Ứng viên
                          </th>
                          <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                            Cơ sở mong muốn
                          </th>
                          <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                            GEN hiện tại
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-sm text-gray-500">
                              <div className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Đang tải danh sách ứng viên...
                              </div>
                            </td>
                          </tr>
                        ) : rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-sm text-gray-500">
                              Không có ứng viên phù hợp trường lọc hiện tại.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row, rowIndex) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedKeys.has(String(row.id))}
                                  onChange={() => handleToggleSelect(String(row.id))}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-800">
                                  #{row.id}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <CandidatePopupCell
                                  row={row}
                                  rowIndex={rowIndex}
                                  formatDateTime={formatDateTime}
                                />
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700">
                                {row.desired_campus || '—'}
                              </td>
                              <td className="px-3 py-3">
                                {row.gen_name ? (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                    {row.gen_name}
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                    Chưa xếp GEN
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/70 px-4 py-3">
                    <p className="text-xs text-gray-600">
                      Đang hiển thị {rows.length} / {pagination.total} ứng viên
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={pagination.page <= 1}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
                      >
                        Trang trước
                      </button>
                      <span className="text-xs font-semibold text-gray-700">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((prev) =>
                            Math.min(pagination.totalPages, prev + 1),
                          )
                        }
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                </section>

                {selectedRows.length > 0 && (
                  <div className="sticky bottom-4 z-20 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        Đã chọn{' '}
                        <span className="text-blue-600">
                          {selectedRows.length}
                        </span>{' '}
                        ứng viên. Mục tiêu:{' '}
                        <span className="text-emerald-700">
                          {targetGen || 'Chưa chọn GEN'}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedKeys(new Set())}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Bỏ chọn
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkAssign}
                          disabled={assigning || !targetGen}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white hover:bg-[#880019] disabled:opacity-60"
                        >
                          {assigning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Gán vào GEN {targetGen || ''}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══ TAB: Theo dõi đào tạo ══════════════════════════════════════ */}
            {activeTab === 'tracking' && (
              <GenTrackingTab
                genEntries={availableGenEntries}
                regionFilter={regionFilter}
                activeGenKey={activeGenKey}
                activeGenInfo={activeGenInfo}
                onSelectGen={handleSelectGen}
              />
            )}
            {/* ══ TAB: Scheduling ══════════════════════════════════════════ */}
            {activeTab === 'scheduling' && (
              <GenSchedulingTab
                genEntries={availableGenEntries}
                regionFilter={regionFilter}
                activeGenKey={activeGenKey}
                activeGenInfo={activeGenInfo}
                onSelectGen={handleSelectGen}
              />
            )}
            {/* ══ TAB: Overview ════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <GenOverviewTab
                genEntries={availableGenEntries}
                regionFilter={regionFilter}
                activeGenKey={activeGenKey}
                activeGenInfo={activeGenInfo}
                onSelectGen={handleSelectGen}
              />
            )}
            {/* ══ TAB: Đào tạo đầu vào ═════════════════════════════════════ */}
            {activeTab === 'onboarding' && (
              <GenOnboardingTab
                genEntries={availableGenEntries}
                regionFilter={regionFilter}
                activeGenKey={activeGenKey}
                activeGenInfo={activeGenInfo}
                onSelectGen={handleSelectGen}
              />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
