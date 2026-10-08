'use client'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { cn } from '@/lib/utils'
import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Filter,
  Loader2,
  Medal,
  Percent,
  RefreshCw,
  Repeat2,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClassDetailData, ClassDetailModal } from './ClassDetailModal'
import { TeacherDetailData, TeacherDetailModal } from './TeacherDetailModal'

interface CenterOption {
  id: number
  fullName: string
  shortCode: string | null
  region: string | null
}

const KPI_ITEMS = [
  {
    label: 'CR46',
    value: '46',
    helper: 'Chỉ số CR mẫu trong kỳ',
    icon: BarChart3,
    iconTone: 'bg-rose-50 text-[#a1001f] border-rose-100',
  },
  {
    label: 'TP',
    value: '92',
    helper: 'TP đang được theo dõi',
    icon: Users,
    iconTone: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    label: 'Completion rate',
    value: '87%',
    helper: 'Tỷ lệ hoàn thành mẫu',
    icon: BadgeCheck,
    iconTone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    label: 'Số lượng GV đạt chuẩn',
    value: '128',
    helper: 'Giáo viên đạt chuẩn mẫu',
    icon: UserCheck,
    iconTone: 'bg-violet-50 text-violet-700 border-violet-100',
  },
  {
    label: 'Tỷ lệ Giáo viên đạt chuẩn',
    value: '72%',
    helper: 'Tạm chờ công thức chính thức',
    icon: Percent,
    iconTone: 'bg-pink-50 text-pink-700 border-pink-100',
  },
  {
    label: 'Chỉ số thay đổi giáo viên',
    value: '+5.4%',
    helper: 'Biến động so với kỳ trước',
    icon: TrendingUp,
    iconTone: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  {
    label: 'Giáo viên không đạt chuẩn đi dạy',
    value: '14',
    helper: 'Cần rà soát thêm',
    icon: UserX,
    iconTone: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  {
    label: 'Re-upsale',
    value: '36',
    helper: 'Lớp có tín hiệu upsale mẫu',
    icon: Repeat2,
    iconTone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  {
    label: 'Đánh giá từ Cơ sở',
    value: '4.6',
    helper: 'Điểm đánh giá mẫu',
    icon: Star,
    iconTone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    label: 'Điểm đánh giá (Max = 5)',
    value: '4.3/5',
    helper: 'Điểm tổng hợp mẫu',
    icon: Award,
    iconTone: 'bg-rose-50 text-[#a1001f] border-rose-100',
  },
  {
    label: 'Xếp loại',
    value: 'A',
    helper: 'Xếp hạng tạm thời',
    icon: Medal,
    iconTone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    label: 'Đánh giá cuối cùng',
    value: '4.5',
    helper: 'Kết quả mẫu chờ xác nhận',
    icon: ClipboardCheck,
    iconTone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
]

/** Component điều hướng phân trang */
function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'mục',
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  itemLabel?: string
}) {
  if (totalItems === 0) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const pageNumbers: (number | string)[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (currentPage > 3) pageNumbers.push('...')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (currentPage < totalPages - 2) pageNumbers.push('...')
    pageNumbers.push(totalPages)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200/80 text-xs">
      <div className="flex items-center gap-2 text-slate-500 flex-wrap">
        <span>
          Hiển thị <span className="font-semibold text-slate-800">{startItem}</span> -{' '}
          <span className="font-semibold text-slate-800">{endItem}</span> trên tổng số{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
        </span>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400">Số dòng:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value))
              onPageChange(1)
            }}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition"
          title="Trang đầu"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition"
          title="Trang trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'min-w-6 h-6 px-1.5 rounded-md font-mono font-medium transition text-xs',
                  currentPage === p
                    ? 'bg-[#a1001f] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent',
                )}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-slate-400 font-mono">
                ...
              </span>
            ),
          )}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition"
          title="Trang sau"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-600 transition"
          title="Trang cuối"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function TeamDashboardView() {
  const { user, token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [classes, setClasses] = useState<ClassDetailData[]>([])
  const [teachers, setTeachers] = useState<TeacherDetailData[]>([])

  // Filters state
  const [selectedCenter, setSelectedCenter] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'classes' | 'teachers'>('classes')

  // Debounce từ khóa tìm kiếm để gửi request lên server tìm chính xác nếu cần
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Pagination state
  const [classesPage, setClassesPage] = useState(1)
  const [classesPageSize, setClassesPageSize] = useState(10)
  const [teachersPage, setTeachersPage] = useState(1)
  const [teachersPageSize, setTeachersPageSize] = useState(10)

  // Selected item for modals
  const [selectedClass, setSelectedClass] = useState<ClassDetailData | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDetailData | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (selectedCenter !== 'all') params.set('center', selectedCenter)
      if (selectedStatus !== 'all') params.set('status', selectedStatus)
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

      const res = await fetch(
        `/api/admin/dashboard/team-metrics?${params.toString()}`,
        {
          headers: authHeaders(token),
          cache: 'no-store',
        },
      )

      const json = await res.json()
      if (json.success && json.data) {
        setCenters(json.data.centers || [])
        setClasses(json.data.classes || [])
        setTeachers(json.data.teachers || [])
      } else {
        setError(json.error || 'Không thể tải dữ liệu nhóm phụ trách')
      }
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [selectedCenter, selectedStatus, debouncedSearch, token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset phân trang khi thay đổi filter hoặc từ khóa tìm kiếm
  useEffect(() => {
    setClassesPage(1)
    setTeachersPage(1)
  }, [searchQuery, selectedCenter, selectedStatus])

  // 1. Tìm kiếm đúng theo tab Lớp học
  const searchedClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes
    const q = searchQuery.toLowerCase().trim()
    return classes.filter((cls) => {
      const nameMatch = cls.name?.toLowerCase().includes(q)
      const idMatch = cls.id?.toLowerCase().includes(q)
      const courseMatch = cls.courseName?.toLowerCase().includes(q)
      const courseLineMatch = cls.courseLineName?.toLowerCase().includes(q)
      const centreMatch =
        cls.centreName?.toLowerCase().includes(q) ||
        cls.centreShortName?.toLowerCase().includes(q)
      const teacherMatch = (cls.teachers || []).some(
        (t) =>
          t.fullName?.toLowerCase().includes(q) ||
          t.code?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q),
      )
      return nameMatch || idMatch || courseMatch || courseLineMatch || centreMatch || teacherMatch
    })
  }, [classes, searchQuery])

  // 2. Tìm kiếm đúng theo tab Giáo viên
  const searchedTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers
    const q = searchQuery.toLowerCase().trim()
    return teachers.filter((t) => {
      const nameMatch = t.fullName?.toLowerCase().includes(q)
      const codeMatch = t.code?.toLowerCase().includes(q)
      const emailMatch = t.email?.toLowerCase().includes(q)
      const centreMatch = t.mainCentre?.toLowerCase().includes(q)
      const lineMatch = t.courseLine?.toLowerCase().includes(q)
      const teachingRoleMatch = t.teachingRole?.toLowerCase().includes(q)
      const positionMatch =
        t.position?.toLowerCase().includes(q) ||
        t.currentRole?.toLowerCase().includes(q)
      const classMatch = (t.assignedClasses || []).some((c) =>
        c.name?.toLowerCase().includes(q),
      )
      return (
        nameMatch ||
        codeMatch ||
        emailMatch ||
        centreMatch ||
        lineMatch ||
        teachingRoleMatch ||
        positionMatch ||
        classMatch
      )
    })
  }, [searchQuery, teachers])

  // Phân trang dữ liệu hiển thị
  const paginatedClasses = useMemo(() => {
    const start = (classesPage - 1) * classesPageSize
    return searchedClasses.slice(start, start + classesPageSize)
  }, [searchedClasses, classesPage, classesPageSize])

  const classesTotalPages = Math.ceil(searchedClasses.length / classesPageSize) || 1

  const paginatedTeachers = useMemo(() => {
    const start = (teachersPage - 1) * teachersPageSize
    return searchedTeachers.slice(start, start + teachersPageSize)
  }, [searchedTeachers, teachersPage, teachersPageSize])

  const teachersTotalPages = Math.ceil(searchedTeachers.length / teachersPageSize) || 1

  // Get active roles display
  const userRoleBadge = useMemo(() => {
    const roles = (user?.userRoles || []).map((r) => String(r).toUpperCase().trim())
    if (user?.role) roles.push(String(user.role).toUpperCase().trim())
    if (roles.includes('TE')) return 'TE'
    if (roles.includes('CL')) return 'Coding Leader (CL)'
    if (roles.includes('AL')) return 'Art Leader (AL)'
    if (roles.includes('RL')) return 'Robotics Leader (RL)'
    if (roles.includes('TC')) return 'Teacher Coordinator (TC)'
    if (roles.includes('LEADER')) return 'Teaching Leader'
    if (roles.includes('TEGL')) return 'TEGL'
    if (roles.includes('TM')) return 'Teaching Manager'
    return user?.role ? String(user.role).toUpperCase() : 'Quản lý'
  }, [user?.role, user?.userRoles])

  // Kiểm tra xem hiện tại có đang áp dụng filter (cơ sở, trạng thái hoặc tìm kiếm) hay không
  const hasActiveFilter = useMemo(() => {
    return selectedCenter !== 'all' || selectedStatus !== 'all' || searchQuery.trim() !== ''
  }, [selectedCenter, selectedStatus, searchQuery])

  const handleOpenClassById = (classId: string) => {
    const found = classes.find((c) => String(c.id) === String(classId))
    if (found) {
      setSelectedTeacher(null)
      setSelectedClass(found)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 1. HEADER SECTION ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-[#a1001f] border border-rose-200/60">
              <Sparkles className="h-3 w-3" />
              {userRoleBadge}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {centers.length > 0 ? `${centers.length} cơ sở phụ trách` : 'Tất cả cơ sở'}
            </span>
            {hasActiveFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                <Filter className="h-3 w-3" />
                Chỉ số theo bộ lọc
              </span>
            )}
          </div>

          <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Chỉ số nhóm & vận hành lớp học
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Theo dõi chi tiết lớp học, tiến độ giảng dạy và danh sách giáo viên trong phạm vi phụ trách.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-1.5 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI BLOCKS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="min-h-[104px] rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-sm"
            >
              <div className="flex min-h-8 items-start justify-between gap-3">
                <p className="min-w-0 pr-2 text-[12px] font-semibold leading-tight text-slate-500">
                  {item.label}
                </p>
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-xl border',
                    item.iconTone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900">
                {item.value}
              </p>
              <p className="mt-1 truncate text-[11px] leading-relaxed text-slate-500">
                {item.helper}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── 3. FILTER BAR & TABS ───────────────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        {/* Top bar: Tabs & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          {/* Tabs switch: Classes vs Teachers */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/70 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                activeTab === 'classes'
                  ? 'bg-white text-[#a1001f] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Danh sách Lớp học ({searchedClasses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('teachers')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                activeTab === 'teachers'
                  ? 'bg-white text-[#a1001f] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Danh sách Giáo viên ({searchedTeachers.length})</span>
            </button>
          </div>

          {/* Filter dropdowns & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Center filter */}
            {centers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 hidden sm:inline" />
                <select
                  value={selectedCenter}
                  onChange={(e) => setSelectedCenter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#a1001f] focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
                >
                  <option value="all">Tất cả cơ sở ({centers.length})</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.shortCode || c.fullName}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status filter (only for classes) */}
            {activeTab === 'classes' && (
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#a1001f] focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="RUNNING">Đang học (RUNNING)</option>
                <option value="PREPARING">Chuẩn bị (PREPARING)</option>
                <option value="FINISHED">Kết thúc (FINISHED)</option>
              </select>
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'classes'
                    ? 'Tìm tên lớp, mã lớp, môn, GV...'
                    : 'Tìm tên GV, mã GV, role, vị trí, email, lớp...'
                }
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:border-[#a1001f] focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
              />
            </div>
          </div>
        </div>

        {/* ── 4. CONTENT TABLES ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-[#a1001f] opacity-70" />
            <p className="mt-2.5 text-xs font-medium">Đang tải dữ liệu nhóm phụ trách...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 px-4 rounded-xl border border-rose-100 bg-rose-50/50">
            <p className="text-xs font-semibold text-[#a1001f]">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="mt-2.5 px-3 py-1 text-xs font-bold text-white bg-[#a1001f] rounded-lg hover:bg-[#850019] transition"
            >
              Thử lại
            </button>
          </div>
        ) : activeTab === 'classes' ? (
          /* ── TAB 1: DANH SÁCH LỚP HỌC ── */
          searchedClasses.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {searchQuery.trim()
                  ? `Không tìm thấy lớp học nào khớp với từ khóa "${searchQuery}"`
                  : 'Không có lớp học nào phù hợp với bộ lọc'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchQuery.trim()
                  ? 'Vui lòng kiểm tra lại tên lớp, mã lớp hoặc tên giáo viên cần tìm.'
                  : 'Vui lòng thử thay đổi bộ lọc cơ sở hoặc trạng thái lớp.'}
              </p>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#a1001f] bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                >
                  Xóa từ khóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Lớp học / Khóa học</th>
                      <th className="px-4 py-3">Cơ sở</th>
                      <th className="px-4 py-3">Giáo viên phụ trách</th>
                      <th className="px-4 py-3 text-center">Sĩ số</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedClasses.map((cls) => {
                      const isRunning = cls.status === 'RUNNING'
                      const isPreparing = cls.status === 'PREPARING'

                      return (
                        <tr
                          key={cls.id}
                          onClick={() => setSelectedClass(cls)}
                          className="hover:bg-slate-50/70 transition cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 group-hover:text-[#a1001f] transition">
                              {cls.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {cls.courseLineName || cls.courseName || 'Khóa học MindX'}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            <span className="font-medium">
                              {cls.centreShortName || cls.centreName || '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {cls.teachers.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>
                            ) : (
                              <div className="space-y-0.5">
                                {cls.teachers.map((t, idx) => {
                                  const isLec = (t as any).roleCode === 'LEC' || t.role === 'Giảng viên chính'
                                  const tag = (t as any).roleCode || (isLec ? 'LEC' : 'TA')
                                  return (
                                    <p key={idx} className="text-[11px] font-medium text-slate-700">
                                      <span
                                        className={cn(
                                          'font-bold mr-1 text-[10.5px]',
                                          isLec ? 'text-[#a1001f]' : 'text-sky-700',
                                        )}
                                      >
                                        [{tag}]
                                      </span>{' '}
                                      {t.fullName || t.code}
                                    </p>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                            {cls.studentCount}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border',
                                isRunning
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isPreparing
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200',
                              )}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {isRunning ? 'Đang học' : isPreparing ? 'Chuẩn bị' : cls.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#a1001f] group-hover:translate-x-0.5 transition">
                              <span>Xem</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Classes */}
              <PaginationBar
                currentPage={classesPage}
                totalPages={classesTotalPages}
                totalItems={searchedClasses.length}
                pageSize={classesPageSize}
                onPageChange={setClassesPage}
                onPageSizeChange={setClassesPageSize}
                itemLabel="lớp học"
              />
            </div>
          )
        ) : (
          /* ── TAB 2: DANH SÁCH GIÁO VIÊN ── */
          searchedTeachers.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
              <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {searchQuery.trim()
                  ? `Không tìm thấy giáo viên nào khớp với từ khóa "${searchQuery}"`
                  : 'Không tìm thấy giáo viên nào'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchQuery.trim()
                  ? 'Vui lòng kiểm tra lại mã GV, họ tên, email hoặc tên lớp học.'
                  : 'Vui lòng thử tìm kiếm theo từ khóa khác hoặc đổi cơ sở phụ trách.'}
              </p>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#a1001f] bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                >
                  Xóa từ khóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Mã GV</th>
                      <th className="px-4 py-3">Họ và tên</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Vị trí</th>
                      <th className="px-4 py-3">Email liên hệ</th>
                      <th className="px-4 py-3">Cơ sở chính</th>
                      <th className="px-4 py-3">Khối giảng dạy</th>
                      <th className="px-4 py-3 text-center">Lớp phụ trách</th>
                      <th className="px-4 py-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedTeachers.map((teacher) => (
                      <tr
                        key={teacher.code}
                        onClick={() => setSelectedTeacher(teacher)}
                        className="hover:bg-slate-50/70 transition cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {teacher.code}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 group-hover:text-[#a1001f] transition">
                            {teacher.fullName}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {teacher.teachingRole ? (
                            <span className="inline-flex items-center rounded-md border border-rose-200/70 bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-[#a1001f]">
                              {teacher.teachingRole}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {teacher.position || teacher.currentRole ? (
                            <span className="inline-flex max-w-32 items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                              <span className="truncate">{teacher.position || teacher.currentRole}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {teacher.email || '—'}
                        </td>

                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {teacher.mainCentre || '—'}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {teacher.courseLine ? (
                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-700">
                              {teacher.courseLine}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              'font-mono font-bold px-2 py-0.5 rounded-full text-xs',
                              teacher.classesCount > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            {teacher.classesCount} lớp
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#a1001f] group-hover:translate-x-0.5 transition">
                            <span>Xem</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Teachers */}
              <PaginationBar
                currentPage={teachersPage}
                totalPages={teachersTotalPages}
                totalItems={searchedTeachers.length}
                pageSize={teachersPageSize}
                onPageChange={setTeachersPage}
                onPageSizeChange={setTeachersPageSize}
                itemLabel="giáo viên"
              />
            </div>
          )
        )}
      </div>

      {/* ── 5. MODALS ──────────────────────────────────────────────────────── */}
      <ClassDetailModal
        cls={selectedClass}
        onClose={() => setSelectedClass(null)}
      />

      <TeacherDetailModal
        teacher={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        onSelectClass={handleOpenClassById}
      />
    </div>
  )
}
