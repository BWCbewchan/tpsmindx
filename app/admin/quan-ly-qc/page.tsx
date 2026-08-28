'use client'

import { PageContainer } from '@/components/PageContainer'
import { Tabs } from '@/components/Tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Filter,
  ListChecks,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ITEMS_PER_PAGE = 20

function normalizeSearchText(text: unknown): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/^(hcm|hn|tinh)\s*[-:]\s*/i, '')
    .replace(/^(mindx|co\s*so)\s*/i, '')
    .replace(/[^a-z0-9]+/g, '')
}

type QCTemplate = {
  key: string
  title: string
  maxScore: number
  criteria: Array<{
    id: string
    category: string
    criterion: string
    selectionMode: 'multiple' | 'single'
    maxScore: number
    options: Array<{
      id: string
      guide: string
      score: number
    }>
  }>
}

type TeacherAccount = {
  id: string
  fullName: string
  email: string
  username: string
  code: string
}

type QCClassSession = {
  id: string
  date: string | null
  startTime: string | null
  endTime: string | null
  sessionHour: number | null
  sessionIndex: number
  teacherNames: string[]
  teacherAccounts: TeacherAccount[]
  assistantNames?: string[]
  assistantAccounts?: TeacherAccount[]
  teacherRank?: string
  studentAttendanceCount: number
  canCreateQC: boolean
  qcWindowStatus: 'available' | 'upcoming' | 'expired' | 'missing-time'
  availableFrom: string | null
  availableUntil: string | null
}

type QCClass = {
  id: string
  name: string
  status: string | null
  startDate: string | null
  endDate: string | null
  numberOfSessions: number | null
  courseName: string
  courseLineName: string
  centreId: string | null
  centreName: string
  centreShortName: string
  teacherNames: string[]
  teacherAccounts: TeacherAccount[]
  assistantNames?: string[]
  assistantAccounts?: TeacherAccount[]
  teacherRank?: string
  studentCount: number
  slots: QCClassSession[]
  eligibleSessionCount: number
  canCreateQC: boolean
}

type QCRecord = {
  id: number
  template_title: string
  class_name: string
  center_name: string
  teacher_name: string | null
  student_count: number
  session_index: number | null
  session_date: string | null
  total_score: string | number
  max_score: string | number
  result_label: string | null
  signed: boolean
  created_at: string
}

type QCMonthlySummary = {
  target: number
  completed: number
  remaining: number
}

type AnswerState = Record<string, { optionIds: string[]; note: string }>

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatScore(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function teacherAccountLabel(account?: TeacherAccount) {
  if (!account) return ''
  return account.email || account.username || account.code || account.id
}

function sessionLabel(session: QCClassSession) {
  const start = formatDateTime(session.startTime || session.date)
  const end = session.endTime
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(session.endTime))
    : ''
  return `Buổi ${session.sessionIndex} - ${start}${end ? ` đến ${end}` : ''}`
}

function sessionWindowLabel(session: QCClassSession) {
  if (session.qcWindowStatus === 'available') {
    return `Mở đến ${formatDateTime(session.availableUntil)}`
  }
  if (session.qcWindowStatus === 'upcoming') {
    return `Mở từ ${formatDateTime(session.availableFrom)}`
  }
  if (session.qcWindowStatus === 'expired') {
    return `Đã hết hạn ${formatDateTime(session.availableUntil)}`
  }
  return 'Thiếu thời gian buổi học'
}

function buildDefaultAnswers(template: QCTemplate | null): AnswerState {
  if (!template) return {}
  const entries: Array<[string, { optionIds: string[]; note: string }]> = []
  template.criteria.forEach((criterion) => {
    entries.push([criterion.id, { optionIds: [], note: '' }])
  })
  return Object.fromEntries(entries)
}

export default function QuanLyQCPage() {
  const { token } = useAuth()
  const [templates, setTemplates] = useState<QCTemplate[]>([])
  const [classes, setClasses] = useState<QCClass[]>([])
  const [records, setRecords] = useState<QCRecord[]>([])
  const [monthlySummary, setMonthlySummary] = useState<QCMonthlySummary>({
    target: 8,
    completed: 0,
    remaining: 8,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'classes' | 'records'>('classes')
  const [currentPage, setCurrentPage] = useState(1)
  const [q, setQ] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedCourseLine, setSelectedCourseLine] = useState('')
  const [selectedCentre, setSelectedCentre] = useState('')
  const [availableCourseLines, setAvailableCourseLines] = useState<string[]>([])
  const [accessibleCenters, setAccessibleCenters] = useState<
    Array<{ id: number; full_name: string; short_code: string | null }>
  >([])
  const [selectedClass, setSelectedClass] = useState<QCClass | null>(null)
  const [activeTemplateKey, setActiveTemplateKey] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [answers, setAnswers] = useState<AnswerState>({})
  const [generalNote, setGeneralNote] = useState('')

  const activeTemplate = useMemo(
    () => templates.find((template) => template.key === activeTemplateKey) ?? null,
    [activeTemplateKey, templates],
  )

  const selectedSession = useMemo(() => {
    if (!selectedClass) return null
    return (
      selectedClass.slots.find((session) => session.id === selectedSessionId) ??
      selectedClass.slots.find((session) => session.canCreateQC) ??
      null
    )
  }, [selectedClass, selectedSessionId])

  const totalScore = useMemo(() => {
    if (!activeTemplate) return 0
    return activeTemplate.criteria.reduce((sum, criterion) => {
      const selectedIds = new Set(answers[criterion.id]?.optionIds ?? [])
      const criterionScore = criterion.options.reduce(
        (optionSum, option) => optionSum + (selectedIds.has(option.id) ? option.score : 0),
        0,
      )
      return sum + criterionScore
    }, 0)
  }, [activeTemplate, answers])

  const resultLabel =
    activeTemplate && activeTemplate.maxScore > 0 && totalScore / activeTemplate.maxScore >= 0.8
      ? 'ĐẠT'
      : 'KHÔNG ĐẠT'

  const normalizedTotalScore = activeTemplate?.maxScore
    ? (totalScore / activeTemplate.maxScore) * 10
    : 0

  const missingSingleChoiceCount = useMemo(() => {
    if (!activeTemplate) return 0
    return activeTemplate.criteria.filter(
      (criterion) =>
        criterion.selectionMode === 'single' &&
        (answers[criterion.id]?.optionIds.length ?? 0) !== 1,
    ).length
  }, [activeTemplate, answers])

  const groupedCriteria = useMemo(() => {
    if (!activeTemplate) return []
    const groups = new Map<string, typeof activeTemplate.criteria>()
    activeTemplate.criteria.forEach((criterion) => {
      const current = groups.get(criterion.category) ?? []
      current.push(criterion)
      groups.set(criterion.category, current)
    })
    return Array.from(groups.entries())
  }, [activeTemplate])

  // Danh sách Khối tổng hợp từ backend và dữ liệu lớp
  const allCourseLines = useMemo(() => {
    const set = new Set<string>(availableCourseLines)
    classes.forEach((c) => {
      if (c.courseLineName) set.add(c.courseLineName)
    })
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'))
  }, [availableCourseLines, classes])

  // Danh sách Cơ sở tổng hợp từ phân quyền và dữ liệu lớp
  const allCentres = useMemo(() => {
    const map = new Map<
      string,
      { value: string; label: string; searchKeys: string[] }
    >()

    accessibleCenters.forEach((c) => {
      const code = c.short_code ? `${c.short_code} - ` : ''
      const label = `${code}${c.full_name}`
      const value = c.short_code || c.full_name
      const searchKeys = [
        c.full_name,
        c.short_code || '',
        String(c.id || ''),
        normalizeSearchText(c.full_name),
        normalizeSearchText(c.short_code || ''),
      ].filter(Boolean)

      map.set(value, { value, label, searchKeys })
    })

    classes.forEach((c) => {
      const name = c.centreName || c.centreShortName
      if (!name) return
      const value = c.centreShortName || c.centreName
      if (!map.has(value)) {
        const label =
          c.centreShortName && c.centreName && c.centreShortName !== c.centreName
            ? `${c.centreShortName} - ${c.centreName}`
            : name
        const searchKeys = [
          c.centreName,
          c.centreShortName,
          String(c.centreId || ''),
          normalizeSearchText(c.centreName),
          normalizeSearchText(c.centreShortName),
        ].filter(Boolean)
        map.set(value, { value, label, searchKeys })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [accessibleCenters, classes])

  // Lọc lớp theo từ khóa, Khối và Cơ sở tức thì trên giao diện
  const filteredClasses = useMemo(() => {
    const centreEntry =
      selectedCentre && selectedCentre !== 'all'
        ? allCentres.find((c) => c.value === selectedCentre)
        : null

    return classes.filter((item) => {
      if (selectedCourseLine && selectedCourseLine !== 'all') {
        const normFilter = normalizeSearchText(selectedCourseLine)
        const line = normalizeSearchText(item.courseLineName)
        const course = normalizeSearchText(item.courseName)
        if (
          !line.includes(normFilter) &&
          !normFilter.includes(line) &&
          !course.includes(normFilter)
        ) {
          return false
        }
      }

      if (centreEntry) {
        const c1 = normalizeSearchText(item.centreName)
        const c2 = normalizeSearchText(item.centreShortName)
        const c3 = String(item.centreId || '')
        const cRawName = (item.centreName || '').toLowerCase()
        const cRawShort = (item.centreShortName || '').toLowerCase()

        const matches = centreEntry.searchKeys.some((key) => {
          if (!key) return false
          const keyNorm = normalizeSearchText(key)
          const keyRaw = key.toLowerCase()
          if (item.centreShortName && item.centreShortName.toLowerCase() === keyRaw) return true
          if (item.centreName && item.centreName.toLowerCase() === keyRaw) return true
          if (c3 && c3 === key) return true
          if (cRawName && (cRawName.includes(keyRaw) || keyRaw.includes(cRawName))) return true
          if (cRawShort && (cRawShort.includes(keyRaw) || keyRaw.includes(cRawShort))) return true
          if (c1 && keyNorm && (c1.includes(keyNorm) || keyNorm.includes(c1))) return true
          if (c2 && keyNorm && (c2.includes(keyNorm) || keyNorm.includes(c2))) return true
          return false
        })

        if (!matches) return false
      }

      return true
    })
  }, [classes, selectedCourseLine, selectedCentre, allCentres])

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / ITEMS_PER_PAGE))

  // Đảm bảo trang hiện tại hợp lệ và tính toán danh sách lớp hiển thị trên trang (20 lớp/trang)
  const paginatedClasses = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredClasses.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredClasses, currentPage, totalPages])

  // Tự động về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1)
  }, [q, selectedCourseLine, selectedCentre, fromDate, toDate])

  const hasActiveFilters = Boolean(
    q.trim() || fromDate || toDate || selectedCourseLine || selectedCentre,
  )

  const mainTabs = useMemo(
    () => [
      { id: 'classes', label: 'Danh sách lớp', count: filteredClasses.length },
      { id: 'records', label: 'Phiếu QC đã tạo', count: records.length },
    ],
    [filteredClasses.length, records.length],
  )

  const handleClearFilters = useCallback(() => {
    setQ('')
    setFromDate('')
    setToDate('')
    setSelectedCourseLine('')
    setSelectedCentre('')
    setCurrentPage(1)
  }, [])

  const loadAll = useCallback(async (showToast = false) => {
    try {
      setRefreshing(true)
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (selectedCourseLine) params.set('courseLine', selectedCourseLine)
      if (selectedCentre) params.set('centre', selectedCentre)

      const [templatesRes, classesRes, recordsRes] = await Promise.all([
        fetch('/api/admin/quan-ly-qc/templates', {
          headers: authHeaders(token),
        }),
        fetch(`/api/admin/quan-ly-qc/classes?${params.toString()}`, {
          headers: authHeaders(token),
        }),
        fetch('/api/admin/quan-ly-qc?limit=20', {
          headers: authHeaders(token),
        }),
      ])

      const templatesData = await templatesRes.json().catch(() => ({}))
      const classesData = await classesRes.json().catch(() => ({}))
      const recordsData = await recordsRes.json().catch(() => ({}))

      if (!templatesRes.ok || templatesData.success === false) {
        throw new Error(templatesData.error || 'Không thể tải mẫu QC')
      }
      if (!classesRes.ok || classesData.success === false) {
        throw new Error(classesData.error || 'Không thể tải lớp từ LMS')
      }
      if (!recordsRes.ok || recordsData.success === false) {
        throw new Error(recordsData.error || 'Không thể tải lịch sử QC')
      }

      setTemplates(templatesData.templates || [])
      setClasses(classesData.classes || [])
      if (Array.isArray(classesData.availableCourseLines) && classesData.availableCourseLines.length > 0) {
        setAvailableCourseLines(classesData.availableCourseLines)
      }
      if (Array.isArray(classesData.accessibleCenters) && classesData.accessibleCenters.length > 0) {
        setAccessibleCenters(classesData.accessibleCenters)
      }
      setRecords(recordsData.records || [])
      if (recordsData.monthlySummary) {
        setMonthlySummary(recordsData.monthlySummary)
      }
      if (!activeTemplateKey && templatesData.templates?.[0]?.key) {
        setActiveTemplateKey(templatesData.templates[0].key)
      }
      if (showToast) toast.success('Đã cập nhật dữ liệu QC')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu QC')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTemplateKey, fromDate, q, selectedCentre, selectedCourseLine, toDate, token])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    setAnswers(buildDefaultAnswers(activeTemplate))
  }, [activeTemplate])

  function openCreateModal(item: QCClass) {
    const nextTemplate = activeTemplate ?? templates[0] ?? null
    const firstAvailableSession =
      item.slots.find((session) => session.canCreateQC) || item.slots[0]
    setSelectedClass(item)
    setActiveTemplateKey(nextTemplate?.key ?? '')
    setSelectedSessionId(firstAvailableSession?.id ?? '')
    setAnswers(buildDefaultAnswers(nextTemplate))
    setGeneralNote('')
  }

  function closeModal() {
    setSelectedClass(null)
    setSelectedSessionId('')
    setGeneralNote('')
  }

  async function submitQC() {
    if (!selectedClass || !activeTemplate) return
    if (!selectedSession?.canCreateQC) {
      toast.error('Buổi học này chưa mở hoặc đã quá hạn tạo phiếu QC')
      return
    }
    setSaving(true)
    try {
      const payloadAnswers = activeTemplate.criteria.map((criterion) => ({
        criterionId: criterion.id,
        optionIds: answers[criterion.id]?.optionIds ?? [],
        note: answers[criterion.id]?.note ?? '',
      }))
      const response = await fetch('/api/admin/quan-ly-qc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          templateKey: activeTemplate.key,
          classInfo: selectedClass,
          sessionInfo: selectedSession,
          answers: payloadAnswers,
          teacherRank:
            selectedSession?.teacherRank ||
            selectedClass.teacherRank ||
            selectedClass.teacherAccounts[0]?.code ||
            '',
          assistantName:
            selectedSession?.assistantNames?.join(', ') ||
            selectedClass.assistantNames?.join(', ') ||
            '',
          generalNote,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể lưu phiếu QC')
      }
      toast.success('Đã tạo phiếu QC')
      closeModal()
      await loadAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu phiếu QC')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer
      title="Quản Lý Kiểm Tra Chất Lượng"
      headerActions={
        <Button
          type="button"
          variant="outline"
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="border-[#a1001f]/30 text-[#a1001f] hover:bg-[#a1001f]/5"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Tab chuyển đổi giữa Danh sách lớp và Phiếu QC đã tạo */}
        <Tabs
          tabs={mainTabs}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as 'classes' | 'records')}
        />

        {activeTab === 'classes' && (
          <div className="space-y-4">
            {/* Bộ lọc nâng cao: Tìm kiếm, Khối, Cơ sở, Ngày tháng */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter className="h-4 w-4 text-[#a1001f]" />
                  Bộ lọc tìm kiếm lớp học
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-gray-500 hover:text-[#a1001f] flex items-center gap-1 transition-colors font-medium cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Xoá bộ lọc
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                {/* 1. Tìm kiếm text */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Tìm lớp / Giáo viên
                  </label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadAll(true)}
                      placeholder="Tên lớp, mã lớp, giáo viên..."
                      className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    />
                  </div>
                </div>

                {/* 2. Lọc Khối */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Khối
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={selectedCourseLine}
                      onChange={(e) => setSelectedCourseLine(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    >
                      <option value="">Tất cả khối</option>
                      {allCourseLines.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Lọc Cơ sở */}
                <div className="sm:col-span-1 lg:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Cơ sở
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={selectedCentre}
                      onChange={(e) => setSelectedCentre(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 truncate"
                    >
                      <option value="">Tất cả cơ sở</option>
                      {allCentres.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Ngày tháng */}
                <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate block">
                      Kết thúc sau
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-2 text-xs focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate block">
                      Bắt đầu trước
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-2 text-xs focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    />
                  </div>
                </div>

                {/* 5. Nút tìm kiếm */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <Button
                    type="button"
                    variant="mindx"
                    onClick={() => loadAll(true)}
                    className="h-10 w-full justify-center"
                  >
                    <Search className="h-4 w-4" />
                    Lọc
                  </Button>
                </div>
              </div>
            </div>

            {/* Bảng danh sách lớp */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="text-base font-bold text-gray-950">
                  Danh sách lớp ({filteredClasses.length})
                </h2>
                {(selectedCourseLine || selectedCentre) && (
                  <div className="flex items-center gap-1.5">
                    {selectedCourseLine && (
                      <Badge variant="violet" size="xs" shape="pill">
                        Khối: {selectedCourseLine}
                      </Badge>
                    )}
                    {selectedCentre && (
                      <Badge variant="slate" size="xs" shape="pill">
                        Cơ sở: {selectedCentre}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lớp / Khóa học</TableHead>
                        <TableHead>Khối</TableHead>
                        <TableHead>Cơ sở</TableHead>
                        <TableHead>Giáo viên</TableHead>
                        <TableHead>Sĩ số</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClasses.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-semibold text-gray-950">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.courseName || 'Chưa có khóa học'}
                            </p>
                          </TableCell>
                          <TableCell>
                            {item.courseLineName ? (
                              <Badge variant="violet" size="xs" shape="pill">
                                {item.courseLineName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="slate" shape="pill">
                              {item.centreShortName || item.centreName || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <p className="truncate text-sm text-gray-800">
                              {item.teacherNames.join(', ') || '-'}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              {teacherAccountLabel((item.teacherAccounts ?? [])[0]) || 'Chưa có tài khoản LEC'}
                            </p>
                          </TableCell>
                          <TableCell>{item.studentCount}</TableCell>
                          <TableCell>
                            <p className="text-xs text-gray-600">
                              {formatDate(item.startDate)} - {formatDate(item.endDate)}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant={item.canCreateQC ? 'success' : 'slate'}
                                size="xs"
                                shape="pill"
                              >
                                {item.eligibleSessionCount}/{item.slots.length} buổi mở QC
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="mindx"
                              onClick={() => openCreateModal(item)}
                              disabled={templates.length === 0 || !item.canCreateQC}
                              title={
                                item.canCreateQC
                                  ? 'Tạo phiếu QC'
                                  : 'Chưa có buổi học nào trong cửa sổ tạo QC'
                              }
                            >
                              <FileSignature className="h-4 w-4" />
                              Tạo phiếu QC
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredClasses.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                      Không có lớp phù hợp với phạm vi cơ sở hoặc bộ lọc hiện tại.
                    </div>
                  ) : null}

                  {/* Thanh phân trang 20 lớp / page */}
                  {filteredClasses.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                      <div className="text-xs text-gray-500 font-medium">
                        Hiển thị <span className="font-semibold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>–
                        <span className="font-semibold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredClasses.length)}</span> trong tổng số{' '}
                        <span className="font-semibold text-gray-900">{filteredClasses.length}</span> lớp ({ITEMS_PER_PAGE} lớp/trang)
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Trước
                          </Button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter((page) => {
                                if (totalPages <= 7) return true
                                if (page === 1 || page === totalPages) return true
                                return Math.abs(page - currentPage) <= 1
                              })
                              .map((page, idx, arr) => {
                                const prev = arr[idx - 1]
                                const hasGap = prev && page - prev > 1
                                return (
                                  <div key={page} className="flex items-center gap-1">
                                    {hasGap && <span className="text-xs text-gray-400 px-1">...</span>}
                                    <button
                                      type="button"
                                      onClick={() => setCurrentPage(page)}
                                      className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                        currentPage === page
                                          ? 'bg-[#a1001f] text-white shadow-xs'
                                          : 'text-gray-700 hover:bg-gray-200/80 bg-white border border-gray-200'
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  </div>
                                )
                              })}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                          >
                            Sau
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-950">
                Phiếu QC đã tạo gần đây ({records.length})
              </h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Loại phiếu</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Trạng thái ký</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const total = Number(record.total_score)
                  const max = Number(record.max_score)
                  const displayTotal = max > 0 && max !== 10 ? (total / max) * 10 : total
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{formatDateTime(record.created_at)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">{record.template_title}</p>
                        <p className="text-xs text-gray-500">
                          {record.result_label || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">{record.class_name}</p>
                        <p className="text-xs text-gray-500">
                          {record.center_name} · {record.teacher_name || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        {formatScore(displayTotal)} / 10
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={record.signed ? 'success' : 'warning'}
                          shape="pill"
                        >
                          {record.signed ? 'Đã ký' : 'Chưa ký'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {!loading && records.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Chưa có phiếu QC nào được tạo.
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedClass}
        onClose={closeModal}
        title={selectedClass ? `Tạo phiếu QC - ${selectedClass.name}` : 'Tạo phiếu QC'}
        subtitle={activeTemplate ? `${activeTemplate.title} · ${activeTemplate.criteria.length} tiêu chí` : undefined}
        maxWidth="7xl"
        disableBackdropClick
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-[#a1001f]" />
              {activeTemplate
                ? missingSingleChoiceCount > 0
                  ? `${missingSingleChoiceCount} tiêu chí cần chọn`
                  : `${formatScore(normalizedTotalScore)} / 10 · ${resultLabel}`
                : 'Chưa có mẫu phiếu'}
            </div>
            <div>
              <Button
                type="button"
                variant="mindx"
                onClick={submitQC}
                disabled={
                  saving ||
                  !activeTemplate ||
                  !selectedSession?.canCreateQC ||
                  missingSingleChoiceCount > 0
                }
                className="h-10 px-6 font-semibold"
              >
                <FileSignature className="h-4 w-4" />
                {saving ? 'Đang lưu...' : 'Lưu phiếu QC'}
              </Button>
            </div>
          </div>
        }
      >
        {selectedClass && activeTemplate ? (
          <div className="space-y-4">
            {/* 1. Component thông tin lớp học nhỏ gọn trong 1 box */}
            <div className="rounded-xl border border-gray-200/80 bg-linear-to-r from-gray-50 via-white to-gray-50 p-3 shadow-2xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-gray-200">
                <div className="sm:px-3 first:pl-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    Tên lớp
                  </span>
                  <span className="text-sm font-bold text-gray-950 truncate block mt-0.5" title={selectedClass.name}>
                    {selectedClass.name}
                  </span>
                  {selectedClass.courseName && (
                    <span className="text-[11px] text-gray-500 truncate block mt-0.5" title={selectedClass.courseName}>
                      {selectedClass.courseName}
                    </span>
                  )}
                </div>

                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    Cơ sở
                  </span>
                  <span className="text-sm font-bold text-gray-950 truncate block mt-0.5">
                    {selectedClass.centreShortName || selectedClass.centreName || '-'}
                  </span>
                  {selectedClass.centreName && selectedClass.centreShortName !== selectedClass.centreName && (
                    <span className="text-[11px] text-gray-500 truncate block mt-0.5" title={selectedClass.centreName}>
                      {selectedClass.centreName}
                    </span>
                  )}
                </div>

                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    Giáo viên
                  </span>
                  <span className="text-sm font-bold text-gray-950 truncate block mt-0.5" title={selectedClass.teacherNames.join(', ')}>
                    {selectedClass.teacherNames.join(', ') || '-'}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate block mt-0.5">
                    {teacherAccountLabel((selectedClass.teacherAccounts ?? [])[0]) || ''}
                  </span>
                </div>

                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    Sĩ số
                  </span>
                  <span className="text-sm font-bold text-gray-950 block mt-0.5">
                    {selectedClass.studentCount} học viên
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
                    {selectedClass.eligibleSessionCount}/{selectedClass.slots.length} buổi mở QC
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Dòng thiết lập loại buổi học và buổi học */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Loại buổi học */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Loại buổi học
                </label>
                <select
                  value={activeTemplateKey}
                  onChange={(event) => setActiveTemplateKey(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                >
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buổi học */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Buổi học
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 truncate"
                >
                  {selectedClass.slots.length === 0 ? (
                    <option value="">Chưa có buổi trong LMS</option>
                  ) : (
                    selectedClass.slots.map((session) => (
                      <option
                        key={session.id}
                        value={session.id}
                        disabled={!session.canCreateQC}
                      >
                        {sessionLabel(session)} · {sessionWindowLabel(session)}
                      </option>
                    ))
                  )}
                </select>
                {selectedSession && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    {sessionWindowLabel(selectedSession)}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Bộ tiêu chí QC thoáng, dễ thao tác */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
              {/* Header bộ tiêu chí với Score summary trực quan */}
              <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                      Bộ tiêu chí đánh giá QC
                    </h3>
                    <Badge variant="violet" size="xs" shape="pill">
                      {activeTemplate.criteria.length} tiêu chí
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{activeTemplate.title}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Điểm tạm tính:
                  </span>
                  <Badge
                    variant={resultLabel === 'ĐẠT' ? 'success' : 'danger'}
                    size="md"
                    shape="pill"
                    className="font-bold text-sm px-3 py-1"
                  >
                    {formatScore(normalizedTotalScore)} / 10 · {resultLabel}
                  </Badge>
                </div>
              </div>

              {/* Danh sách tiêu chí */}
              <div className="p-4 sm:p-5 space-y-6">
                {groupedCriteria.map(([category, criteria]) => (
                  <section key={category} className="space-y-3.5">
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-[#f3d5da] bg-[#fff7f8] px-3.5 py-2 text-sm font-bold text-[#a1001f] shadow-2xs backdrop-blur-xs">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 shrink-0" />
                        <span>{category}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#a1001f]/80">
                        {criteria.length} tiêu chí
                      </span>
                    </div>

                    <div className="space-y-3">
                      {criteria.map((criterion, cIdx) => {
                        const selectedIds = new Set(answers[criterion.id]?.optionIds ?? [])
                        const score = criterion.options.reduce(
                          (sum, option) => sum + (selectedIds.has(option.id) ? option.score : 0),
                          0,
                        )
                        const isMultiple = criterion.selectionMode === 'multiple'
                        const isAnswered = selectedIds.size > 0

                        return (
                          <div
                            key={criterion.id}
                            className={`rounded-xl border transition-all duration-150 ${
                              isAnswered
                                ? 'border-gray-300 bg-white shadow-xs'
                                : 'border-amber-200/80 bg-amber-50/20'
                            }`}
                          >
                            {/* Tiêu đề tiêu chí */}
                            <div className="flex flex-col gap-1.5 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between rounded-t-xl">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-700">
                                  {cIdx + 1}
                                </span>
                                <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                                  {criterion.criterion}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                    isMultiple
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {isMultiple ? 'Chọn nhiều' : 'Chọn 1'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-gray-700">
                                  {formatScore(score)} / {formatScore(criterion.maxScore)} đ
                                </span>
                              </div>
                            </div>

                            {/* Các lựa chọn (Tile options) */}
                            <div className="p-3 sm:p-4 space-y-2.5">
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                {criterion.options.map((option) => {
                                  const checked = selectedIds.has(option.id)
                                  return (
                                    <label
                                      key={option.id}
                                      className={`group relative flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-all duration-150 select-none ${
                                        checked
                                          ? 'border-[#a1001f] bg-[#fff5f6] ring-1.5 ring-[#a1001f] shadow-xs text-gray-950 font-medium'
                                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70 text-gray-700'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                        <input
                                          type={isMultiple ? 'checkbox' : 'radio'}
                                          name={criterion.id}
                                          checked={checked}
                                          onChange={() =>
                                            setAnswers((current) => {
                                              const previous = current[criterion.id] ?? {
                                                optionIds: [],
                                                note: '',
                                              }
                                              const nextIds = isMultiple
                                                ? checked
                                                  ? previous.optionIds.filter((id) => id !== option.id)
                                                  : [...previous.optionIds, option.id]
                                                : [option.id]

                                              return {
                                                ...current,
                                                [criterion.id]: {
                                                  optionIds: nextIds,
                                                  note: previous.note,
                                                },
                                              }
                                            })
                                          }
                                          className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-[#a1001f] focus:ring-[#a1001f] accent-[#a1001f]"
                                        />
                                        <span className="leading-snug text-sm">
                                          {option.guide}
                                        </span>
                                      </div>

                                      <span
                                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold transition-colors ${
                                          checked
                                            ? 'bg-[#a1001f] text-white shadow-2xs'
                                            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                                        }`}
                                      >
                                        {option.score > 0 ? `+${formatScore(option.score)}` : formatScore(option.score)}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>

                              {/* Ghi chú ngắn cho tiêu chí */}
                              <details className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-3 py-1.5 group">
                                <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
                                  + Thêm nhận xét riêng cho tiêu chí này (tùy chọn)
                                </summary>
                                <Textarea
                                  value={answers[criterion.id]?.note ?? ''}
                                  onChange={(event) =>
                                    setAnswers((current) => ({
                                      ...current,
                                      [criterion.id]: {
                                        optionIds: current[criterion.id]?.optionIds ?? [],
                                        note: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Nhận xét cụ thể cho tiêu chí này..."
                                  className="mt-2 min-h-[50px] bg-white text-xs"
                                />
                              </details>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            {/* 4. Ghi chú chung */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Ghi chú chung
              </label>
              <Textarea
                value={generalNote}
                onChange={(event) => setGeneralNote(event.target.value)}
                placeholder="Nhận xét tổng quan sau buổi QC..."
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            Chưa tải được mẫu phiếu QC.
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
