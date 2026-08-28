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
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSignature,
  Filter,
  HelpCircle,
  Layers,
  ListChecks,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ITEMS_PER_PAGE = 20

export type ScoreLevelKey = 'tot' | 'dat' | 'kha' | 'rui_ro_vua' | 'rui_ro_cao'

export interface ScoreLevelConfig {
  key: ScoreLevelKey
  label: string
  rangeLabel: string
  actionNote: string
  badgeVariant: 'violet' | 'success' | 'info' | 'warning' | 'danger'
  colorClass: string
  borderClass: string
  bgClass: string
  textClass: string
  dotClass: string
}

export const SCORE_LEVELS: Record<ScoreLevelKey, ScoreLevelConfig> = {
  tot: {
    key: 'tot',
    label: 'Tốt',
    rangeLabel: '9.5 - 10.0',
    actionNote: 'Chất lượng xuất sắc',
    badgeVariant: 'violet',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
    borderClass: 'border-purple-200',
    bgClass: 'bg-purple-50/70',
    textClass: 'text-purple-800',
    dotClass: 'bg-purple-500',
  },
  dat: {
    key: 'dat',
    label: 'Đạt',
    rangeLabel: '8.0 - <9.5',
    actionNote: 'Đạt chuẩn yêu cầu',
    badgeVariant: 'success',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    borderClass: 'border-emerald-200',
    bgClass: 'bg-emerald-50/70',
    textClass: 'text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  kha: {
    key: 'kha',
    label: 'Khá',
    rangeLabel: '7.0 - <8.0',
    actionNote: 'Khá, cần lưu ý cải thiện',
    badgeVariant: 'info',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200',
    borderClass: 'border-sky-200',
    bgClass: 'bg-sky-50/70',
    textClass: 'text-sky-800',
    dotClass: 'bg-sky-500',
  },
  rui_ro_vua: {
    key: 'rui_ro_vua',
    label: 'Rủi ro vừa',
    rangeLabel: '5.0 - <7.0',
    actionNote: 'Rủi ro vừa, theo dõi thêm',
    badgeVariant: 'warning',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    borderClass: 'border-amber-200',
    bgClass: 'bg-amber-50/70',
    textClass: 'text-amber-800',
    dotClass: 'bg-amber-500',
  },
  rui_ro_cao: {
    key: 'rui_ro_cao',
    label: 'Rủi ro cao',
    rangeLabel: '1.0 - <5.0',
    actionNote: 'Rủi ro cao, cần tái đào tạo, giải trình tình trạng và theo dõi tình hình',
    badgeVariant: 'danger',
    colorClass: 'text-red-700 bg-red-50 border-red-200',
    borderClass: 'border-red-200',
    bgClass: 'bg-red-50/70',
    textClass: 'text-red-800',
    dotClass: 'bg-red-500',
  },
}

export function getQCScoreLevel(score10: number): ScoreLevelConfig {
  const s = Number(score10) || 0
  if (s >= 9.5) return SCORE_LEVELS.tot
  if (s >= 8.0) return SCORE_LEVELS.dat
  if (s >= 7.0) return SCORE_LEVELS.kha
  if (s >= 5.0) return SCORE_LEVELS.rui_ro_vua
  return SCORE_LEVELS.rui_ro_cao
}

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

type QCAnswerRecord = {
  criterionId?: string
  category?: string
  criterion?: string
  selectionMode?: 'single' | 'multiple'
  selectedOptionIds?: string[]
  selectedOptions?: Array<{
    optionId?: string
    guide?: string
    score?: number
  }>
  score?: number
  note?: string
}

type QCRecord = {
  id: number
  template_key: string
  template_title: string
  class_lms_id?: string
  class_code?: string
  class_name: string
  center_name: string
  teacher_name: string | null
  teacher_rank?: string | null
  assistant_name?: string | null
  student_count: number
  session_index: number | null
  session_date: string | null
  total_score: string | number
  max_score: string | number
  result_label: string | null
  general_note?: string | null
  signed: boolean
  criteria_snapshot?: unknown
  answers?: QCAnswerRecord[]
  created_by_email: string
  created_by_name?: string
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
  const { user, token } = useAuth()
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

  // State quản lý bộ lọc và xem chi tiết phiếu QC đã tạo (dành cho Super Admin & Leader)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [recordSearch, setRecordSearch] = useState('')
  const [recordCentre, setRecordCentre] = useState('all')
  const [recordLevel, setRecordLevel] = useState<string>('all')
  const [recordLeader, setRecordLeader] = useState<string>('all')
  const [recordPage, setRecordPage] = useState(1)
  const [selectedViewRecord, setSelectedViewRecord] = useState<QCRecord | null>(null)
  const [showDashboard, setShowDashboard] = useState(true)

  const isSuperOrHOTeaching = useMemo(() => {
    const emailNorm = (user?.email || '').toLowerCase()
    return (
      isSuperAdmin ||
      user?.role === 'super_admin' ||
      user?.role === 'admin' ||
      emailNorm.includes('hoteaching') ||
      emailNorm.includes('hr-teaching')
    )
  }, [isSuperAdmin, user?.email, user?.role])

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

  const normalizedTotalScore = activeTemplate?.maxScore
    ? (totalScore / activeTemplate.maxScore) * 10
    : 0

  const currentScoreLevel = useMemo(
    () => getQCScoreLevel(normalizedTotalScore),
    [normalizedTotalScore],
  )

  const resultLabel = currentScoreLevel.label

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

    records.forEach((r) => {
      const name = r.center_name
      if (!name) return
      if (!map.has(name)) {
        const searchKeys = [
          name,
          normalizeSearchText(name),
        ].filter(Boolean)
        map.set(name, { value: name, label: name, searchKeys })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [accessibleCenters, classes, records])

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

  // ================= DASHBOARD & THỐNG KÊ PHIẾU QC =================
  // 1. Thống kê tổng quan và phân bổ 5 mức độ đánh giá
  const recordOverallStats = useMemo(() => {
    const total = records.length
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        goodRate: 0,
        riskRate: 0,
        counts: { tot: 0, dat: 0, kha: 0, rui_ro_vua: 0, rui_ro_cao: 0 },
        pcts: { tot: 0, dat: 0, kha: 0, rui_ro_vua: 0, rui_ro_cao: 0 },
        goodCount: 0,
        riskCount: 0,
      }
    }

    let scoreSum = 0
    const counts: Record<ScoreLevelKey, number> = {
      tot: 0,
      dat: 0,
      kha: 0,
      rui_ro_vua: 0,
      rui_ro_cao: 0,
    }

    records.forEach((r) => {
      const totalScoreNum = Number(r.total_score) || 0
      const maxScoreNum = Number(r.max_score) || 10
      const score10 =
        maxScoreNum > 0 && maxScoreNum !== 10
          ? (totalScoreNum / maxScoreNum) * 10
          : totalScoreNum
      scoreSum += score10
      const level = getQCScoreLevel(score10)
      counts[level.key] += 1
    })

    const avgScore = Number((scoreSum / total).toFixed(2))
    const pcts: Record<ScoreLevelKey, number> = {
      tot: Math.round((counts.tot / total) * 100),
      dat: Math.round((counts.dat / total) * 100),
      kha: Math.round((counts.kha / total) * 100),
      rui_ro_vua: Math.round((counts.rui_ro_vua / total) * 100),
      rui_ro_cao: Math.round((counts.rui_ro_cao / total) * 100),
    }
    const goodCount = counts.tot + counts.dat
    const riskCount = counts.rui_ro_vua + counts.rui_ro_cao
    const goodRate = Math.round((goodCount / total) * 100)
    const riskRate = Math.round((riskCount / total) * 100)

    return {
      total,
      avgScore,
      goodRate,
      riskRate,
      counts,
      pcts,
      goodCount,
      riskCount,
    }
  }, [records])

  // 2. Thống kê tỷ lệ và tình trạng QC theo từng Cơ sở
  const centreQCStats = useMemo(() => {
    const map = new Map<
      string,
      {
        centreName: string
        totalClasses: number
        totalRecords: number
        scoreSum: number
        counts: Record<ScoreLevelKey, number>
      }
    >()

    // Điền trước danh sách cơ sở từ classes
    classes.forEach((c) => {
      const name = c.centreShortName || c.centreName || 'Khác'
      if (!map.has(name)) {
        map.set(name, {
          centreName: name,
          totalClasses: 0,
          totalRecords: 0,
          scoreSum: 0,
          counts: { tot: 0, dat: 0, kha: 0, rui_ro_vua: 0, rui_ro_cao: 0 },
        })
      }
      const entry = map.get(name)!
      entry.totalClasses += 1
    })

    // Điền dữ liệu từ records
    records.forEach((r) => {
      const name = r.center_name || 'Khác'
      if (!map.has(name)) {
        map.set(name, {
          centreName: name,
          totalClasses: 0,
          totalRecords: 0,
          scoreSum: 0,
          counts: { tot: 0, dat: 0, kha: 0, rui_ro_vua: 0, rui_ro_cao: 0 },
        })
      }
      const entry = map.get(name)!
      const totalScoreNum = Number(r.total_score) || 0
      const maxScoreNum = Number(r.max_score) || 10
      const score10 =
        maxScoreNum > 0 && maxScoreNum !== 10
          ? (totalScoreNum / maxScoreNum) * 10
          : totalScoreNum
      entry.totalRecords += 1
      entry.scoreSum += score10
      const lvl = getQCScoreLevel(score10)
      entry.counts[lvl.key] += 1
    })

    return Array.from(map.values())
      .map((entry) => {
        const avgScore =
          entry.totalRecords > 0
            ? Number((entry.scoreSum / entry.totalRecords).toFixed(1))
            : 0
        const highRisk = entry.counts.rui_ro_cao
        const medRisk = entry.counts.rui_ro_vua
        const good = entry.counts.tot + entry.counts.dat
        const qcRate =
          entry.totalClasses > 0
            ? Math.min(
                100,
                Math.round((entry.totalRecords / entry.totalClasses) * 100),
              )
            : 0
        return {
          ...entry,
          avgScore,
          highRisk,
          medRisk,
          good,
          qcRate,
        }
      })
      .filter((e) => e.totalRecords > 0 || e.totalClasses > 0)
      .sort(
        (a, b) =>
          b.totalRecords - a.totalRecords ||
          a.centreName.localeCompare(b.centreName, 'vi'),
      )
  }, [classes, records])

  // 3. Danh sách các Leader đã tạo phiếu (dành cho Super Admin)
  const leadersList = useMemo(() => {
    const map = new Map<
      string,
      { email: string; name: string; count: number; scoreSum: number }
    >()
    records.forEach((r) => {
      const email = (r.created_by_email || '').toLowerCase()
      if (!email) return
      const name = r.created_by_name || email
      if (!map.has(email)) {
        map.set(email, { email, name, count: 0, scoreSum: 0 })
      }
      const entry = map.get(email)!
      entry.count += 1
      const totalScoreNum = Number(r.total_score) || 0
      const maxScoreNum = Number(r.max_score) || 10
      const score10 =
        maxScoreNum > 0 && maxScoreNum !== 10
          ? (totalScoreNum / maxScoreNum) * 10
          : totalScoreNum
      entry.scoreSum += score10
    })
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgScore:
          item.count > 0 ? Number((item.scoreSum / item.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  // 4. Lọc danh sách phiếu QC đã tạo
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (recordSearch.trim()) {
        const query = recordSearch.trim().toLowerCase()
        const normQ = normalizeSearchText(query)
        const matchName = (r.class_name || '').toLowerCase().includes(query)
        const matchCode = (r.class_code || '').toLowerCase().includes(query)
        const matchTeacher = (r.teacher_name || '').toLowerCase().includes(query)
        const matchCentre = (r.center_name || '').toLowerCase().includes(query)
        const matchLeaderName = (r.created_by_name || '').toLowerCase().includes(query)
        const matchLeaderEmail = (r.created_by_email || '').toLowerCase().includes(query)
        const matchNorm =
          normalizeSearchText(r.class_name).includes(normQ) ||
          normalizeSearchText(r.center_name).includes(normQ) ||
          normalizeSearchText(r.teacher_name).includes(normQ)
        if (
          !matchName &&
          !matchCode &&
          !matchTeacher &&
          !matchCentre &&
          !matchLeaderName &&
          !matchLeaderEmail &&
          !matchNorm
        ) {
          return false
        }
      }

      if (recordCentre && recordCentre !== 'all') {
        const normC = normalizeSearchText(recordCentre)
        const normRec = normalizeSearchText(r.center_name)
        if (
          !normRec.includes(normC) &&
          !normC.includes(normRec) &&
          r.center_name !== recordCentre
        ) {
          return false
        }
      }

      if (isSuperOrHOTeaching && recordLeader && recordLeader !== 'all') {
        if ((r.created_by_email || '').toLowerCase() !== recordLeader.toLowerCase()) {
          return false
        }
      }

      if (recordLevel && recordLevel !== 'all') {
        const totalScoreNum = Number(r.total_score) || 0
        const maxScoreNum = Number(r.max_score) || 10
        const score10 =
          maxScoreNum > 0 && maxScoreNum !== 10
            ? (totalScoreNum / maxScoreNum) * 10
            : totalScoreNum
        const level = getQCScoreLevel(score10)
        if (level.key !== recordLevel) {
          return false
        }
      }

      return true
    })
  }, [records, recordSearch, recordCentre, recordLeader, recordLevel, isSuperOrHOTeaching])

  const totalRecordPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / ITEMS_PER_PAGE),
  )
  const paginatedRecords = useMemo(() => {
    const safePage = Math.min(Math.max(1, recordPage), totalRecordPages)
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredRecords, recordPage, totalRecordPages])

  useEffect(() => {
    setRecordPage(1)
  }, [recordSearch, recordCentre, recordLeader, recordLevel])

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

  const loadAll = useCallback(
    async (showToast = false) => {
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
          fetch('/api/admin/quan-ly-qc?limit=500', {
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
        if (
          Array.isArray(classesData.availableCourseLines) &&
          classesData.availableCourseLines.length > 0
        ) {
          setAvailableCourseLines(classesData.availableCourseLines)
        }
        if (
          Array.isArray(classesData.accessibleCenters) &&
          classesData.accessibleCenters.length > 0
        ) {
          setAccessibleCenters(classesData.accessibleCenters)
        }
        setRecords(recordsData.records || [])
        if (typeof recordsData.isSuperAdmin === 'boolean') {
          setIsSuperAdmin(recordsData.isSuperAdmin)
        }
        if (recordsData.monthlySummary) {
          setMonthlySummary(recordsData.monthlySummary)
        }
        if (!activeTemplateKey && templatesData.templates?.[0]?.key) {
          setActiveTemplateKey(templatesData.templates[0].key)
        }
        if (showToast) toast.success('Đã cập nhật dữ liệu QC')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Không thể tải dữ liệu QC',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeTemplateKey, fromDate, q, selectedCentre, selectedCourseLine, toDate, token],
  )

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
      setActiveTab('records')
      setRecordSearch('')
      setRecordCentre('all')
      setRecordLevel('all')
      setRecordLeader('all')
      setRecordPage(1)
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
          <div className="space-y-4">
            {/* 1. Header & Nút bật/tắt Dashboard */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-950">
                    Dashboard & Danh sách phiếu QC đã tạo ({records.length})
                  </h2>
                  {isSuperOrHOTeaching ? (
                    <Badge variant="violet" size="xs" shape="pill" className="font-semibold">
                      Super Admin / HO Teaching (Xem toàn hệ thống)
                    </Badge>
                  ) : (
                    <Badge variant="slate" size="xs" shape="pill">
                      Leader / Quản lý cơ sở
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Theo dõi đánh giá chất lượng từ các Leader, tỷ lệ hoàn thành tại từng cơ sở và các ca cần xử lý.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDashboard((v) => !v)}
                  className="h-8 text-xs gap-1.5"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-[#a1001f]" />
                  {showDashboard ? 'Thu gọn Dashboard' : 'Mở rộng Dashboard'}
                </Button>
              </div>
            </div>

            {/* 2. Dashboard xem nhanh tỷ lệ và phân loại chất lượng */}
            {showDashboard && (
              <div className="space-y-4">
                {/* 2.1 4 Thẻ KPI Tổng quan */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Tổng phiếu QC */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Tổng phiếu QC
                      </span>
                      <FileSignature className="h-4 w-4 text-[#a1001f]" />
                    </div>
                    <p className="mt-1.5 text-2xl font-black text-gray-900">
                      {recordOverallStats.total}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {centreQCStats.length} cơ sở đã triển khai
                    </p>
                  </div>

                  {/* Điểm trung bình hệ thống */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Điểm TB hệ thống
                      </span>
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="mt-1.5 text-2xl font-black text-emerald-600">
                      {recordOverallStats.avgScore} <span className="text-xs font-semibold text-gray-400">/ 10</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Thang chuẩn chất lượng 10đ
                    </p>
                  </div>

                  {/* Tỷ lệ Đạt & Tốt */}
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Đạt & Tốt (≥ 8.0)
                      </span>
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="mt-1.5 text-2xl font-black text-emerald-700">
                      {recordOverallStats.goodRate}%
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-800 font-medium">
                      {recordOverallStats.goodCount} / {recordOverallStats.total} phiếu đạt chuẩn
                    </p>
                  </div>

                  {/* Ca cần theo dõi & Rủi ro */}
                  <div className="rounded-xl border border-red-200/80 bg-red-50/40 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">
                        Cần xử lý & Rủi ro (&lt; 7.0)
                      </span>
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                    </div>
                    <p className="mt-1.5 text-2xl font-black text-red-700">
                      {recordOverallStats.riskCount} <span className="text-xs font-semibold text-red-500">phiếu</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-red-700 font-medium">
                      {recordOverallStats.counts.rui_ro_cao} rủi ro cao · {recordOverallStats.counts.rui_ro_vua} rủi ro vừa
                    </p>
                  </div>
                </div>

                {/* 2.2 Quy chuẩn 5 Mức độ QC & Hướng xử lý từng trường hợp */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-[#a1001f]" />
                      <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                        Phân loại 5 mức độ QC &amp; Hướng xử lý
                      </h3>
                    </div>
                    <span className="text-xs text-gray-400">
                      Nhấp vào từng mức để lọc nhanh danh sách phiếu
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Mức 1: Tốt (9.5 - 10) */}
                    <div
                      onClick={() => setRecordLevel(recordLevel === 'tot' ? 'all' : 'tot')}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                        recordLevel === 'tot'
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-400 shadow-xs'
                          : 'border-purple-200/80 bg-purple-50/30 hover:border-purple-300 hover:bg-purple-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-800">
                          <span className="h-2 w-2 rounded-full bg-purple-600" />
                          9.5 - 10 · Tốt
                        </span>
                        <span className="text-xs font-bold text-purple-900">
                          {recordOverallStats.counts.tot} ({recordOverallStats.pcts.tot}%)
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-purple-950 leading-snug">
                        Chất lượng xuất sắc
                      </p>
                      <p className="mt-0.5 text-[11px] text-purple-700 leading-tight">
                        Duy trì phát huy tiêu chuẩn
                      </p>
                    </div>

                    {/* Mức 2: Đạt (8.0 - <9.5) */}
                    <div
                      onClick={() => setRecordLevel(recordLevel === 'dat' ? 'all' : 'dat')}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                        recordLevel === 'dat'
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 shadow-xs'
                          : 'border-emerald-200/80 bg-emerald-50/30 hover:border-emerald-300 hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                          8 - &lt;9.5 · Đạt
                        </span>
                        <span className="text-xs font-bold text-emerald-900">
                          {recordOverallStats.counts.dat} ({recordOverallStats.pcts.dat}%)
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-emerald-950 leading-snug">
                        Đạt chuẩn yêu cầu
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-700 leading-tight">
                        Chất lượng giảng dạy chuẩn
                      </p>
                    </div>

                    {/* Mức 3: Khá (7.0 - <8.0) */}
                    <div
                      onClick={() => setRecordLevel(recordLevel === 'kha' ? 'all' : 'kha')}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                        recordLevel === 'kha'
                          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400 shadow-xs'
                          : 'border-sky-200/80 bg-sky-50/30 hover:border-sky-300 hover:bg-sky-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-800">
                          <span className="h-2 w-2 rounded-full bg-sky-600" />
                          7 - &lt;8 · Khá
                        </span>
                        <span className="text-xs font-bold text-sky-900">
                          {recordOverallStats.counts.kha} ({recordOverallStats.pcts.kha}%)
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-sky-950 leading-snug">
                        Khá
                      </p>
                      <p className="mt-0.5 text-[11px] text-sky-700 leading-tight">
                        Cần lưu ý cải thiện một số điểm
                      </p>
                    </div>

                    {/* Mức 4: Rủi ro vừa (5.0 - <7.0) */}
                    <div
                      onClick={() => setRecordLevel(recordLevel === 'rui_ro_vua' ? 'all' : 'rui_ro_vua')}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                        recordLevel === 'rui_ro_vua'
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 shadow-xs'
                          : 'border-amber-200/80 bg-amber-50/30 hover:border-amber-300 hover:bg-amber-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                          <span className="h-2 w-2 rounded-full bg-amber-600" />
                          5 - &lt;7 · Rủi ro vừa
                        </span>
                        <span className="text-xs font-bold text-amber-900">
                          {recordOverallStats.counts.rui_ro_vua} ({recordOverallStats.pcts.rui_ro_vua}%)
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-amber-950 leading-snug">
                        Rủi ro vừa
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700 leading-tight">
                        Theo dõi thêm và hỗ trợ giáo viên
                      </p>
                    </div>

                    {/* Mức 5: Rủi ro cao (1.0 - <5.0) */}
                    <div
                      onClick={() => setRecordLevel(recordLevel === 'rui_ro_cao' ? 'all' : 'rui_ro_cao')}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                        recordLevel === 'rui_ro_cao'
                          ? 'border-red-500 bg-red-50 ring-2 ring-red-400 shadow-xs'
                          : 'border-red-200/80 bg-red-50/30 hover:border-red-300 hover:bg-red-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2 py-0.5 text-xs font-black text-red-800">
                          <span className="h-2 w-2 rounded-full bg-red-600" />
                          1 - &lt;5 · Rủi ro cao
                        </span>
                        <span className="text-xs font-bold text-red-900">
                          {recordOverallStats.counts.rui_ro_cao} ({recordOverallStats.pcts.rui_ro_cao}%)
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-red-950 leading-snug">
                        Rủi ro cao
                      </p>
                      <p className="mt-0.5 text-[11px] text-red-700 leading-tight">
                        Cần tái đào tạo, giải trình tình trạng và theo dõi tình hình
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Bộ lọc Phiếu QC đã tạo (dành cho Leader & Super Admin) */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter className="h-4 w-4 text-[#a1001f]" />
                  Bộ lọc danh sách phiếu QC
                </div>
                {(recordSearch || recordCentre !== 'all' || recordLevel !== 'all' || recordLeader !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordSearch('')
                      setRecordCentre('all')
                      setRecordLevel('all')
                      setRecordLeader('all')
                    }}
                    className="text-xs text-gray-500 hover:text-[#a1001f] flex items-center gap-1 transition-colors font-medium cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Xoá bộ lọc phiếu
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                {/* 1. Tìm kiếm text */}
                <div className={isSuperOrHOTeaching ? 'sm:col-span-2 lg:col-span-4' : 'sm:col-span-2 lg:col-span-5'}>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Tìm kiếm phiếu
                  </label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={recordSearch}
                      onChange={(event) => setRecordSearch(event.target.value)}
                      placeholder={isSuperOrHOTeaching ? 'Lớp, giáo viên, cơ sở, người tạo...' : 'Lớp, giáo viên, cơ sở...'}
                      className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    />
                  </div>
                </div>

                {/* 2. Lọc Cơ sở */}
                <div className={isSuperOrHOTeaching ? 'sm:col-span-1 lg:col-span-3' : 'sm:col-span-1 lg:col-span-4'}>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Cơ sở
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={recordCentre}
                      onChange={(e) => setRecordCentre(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    >
                      <option value="all">Tất cả cơ sở</option>
                      {allCentres.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Lọc Mức độ đánh giá */}
                <div className={isSuperOrHOTeaching ? 'sm:col-span-1 lg:col-span-2' : 'sm:col-span-1 lg:col-span-3'}>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Mức độ đánh giá
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={recordLevel}
                      onChange={(e) => setRecordLevel(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                    >
                      <option value="all">Tất cả mức độ</option>
                      <option value="tot">9.5 - 10 (Tốt)</option>
                      <option value="dat">8.0 - &lt;9.5 (Đạt)</option>
                      <option value="kha">7.0 - &lt;8.0 (Khá)</option>
                      <option value="rui_ro_vua">5.0 - &lt;7.0 (Rủi ro vừa)</option>
                      <option value="rui_ro_cao">1.0 - &lt;5.0 (Rủi ro cao)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Lọc Leader tạo phiếu - CHỈ HIỂN THỊ CHO SUPER ADMIN & HO TEACHING */}
                {isSuperOrHOTeaching && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Người tạo (Leader)
                    </label>
                    <div className="relative mt-1">
                      <select
                        value={recordLeader}
                        onChange={(e) => setRecordLeader(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                      >
                        <option value="all">Tất cả Leader</option>
                        {leadersList.map((leader) => (
                          <option key={leader.email} value={leader.email}>
                            {leader.name} ({leader.count} phiếu · TB: {leader.avgScore}đ)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Bảng Danh sách Chi tiết Phiếu QC */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/70">
                <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                  Danh sách Phiếu QC ({filteredRecords.length} phiếu phù hợp)
                </h3>
                <span className="text-xs text-gray-500">
                  Trang {recordPage} / {totalRecordPages}
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Ngày tạo</TableHead>
                    <TableHead>Lớp &amp; Cơ sở</TableHead>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Người tạo (Leader)</TableHead>
                    <TableHead className="w-[110px]">Điểm số</TableHead>
                    <TableHead className="min-w-[200px]">Mức độ &amp; Hướng xử lý</TableHead>
                    <TableHead className="w-[90px]">Ký tên</TableHead>
                    <TableHead className="w-[70px] text-right">Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => {
                    const total = Number(record.total_score) || 0
                    const max = Number(record.max_score) || 10
                    const displayTotal = max > 0 && max !== 10 ? (total / max) * 10 : total
                    const scoreLevel = getQCScoreLevel(displayTotal)

                    return (
                      <TableRow key={record.id} className="hover:bg-gray-50/80">
                        {/* Ngày tạo */}
                        <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(record.created_at)}
                        </TableCell>

                        {/* Lớp & Cơ sở */}
                        <TableCell>
                          <p className="font-bold text-sm text-gray-950 leading-tight">
                            {record.class_name}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <Badge variant="slate" size="xs" shape="pill">
                              {record.center_name}
                            </Badge>
                            {record.session_index && (
                              <span className="text-[11px] text-gray-500 font-medium">
                                Buổi {record.session_index}
                              </span>
                            )}
                            {record.student_count > 0 && (
                              <span className="text-[11px] text-gray-400">
                                · {record.student_count} HV
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Giáo viên */}
                        <TableCell>
                          <p className="font-semibold text-sm text-gray-900 leading-tight">
                            {record.teacher_name || '-'}
                          </p>
                          {(record.teacher_rank || record.assistant_name) && (
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {record.teacher_rank ? `Rank: ${record.teacher_rank}` : ''}
                              {record.teacher_rank && record.assistant_name ? ' · ' : ''}
                              {record.assistant_name ? `TG: ${record.assistant_name}` : ''}
                            </p>
                          )}
                        </TableCell>

                        {/* Người tạo (Leader) */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-[#a1001f] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {record.created_by_name || record.created_by_email}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate">
                                {record.created_by_email}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Điểm số */}
                        <TableCell>
                          <div className="font-black text-sm text-gray-900">
                            {formatScore(displayTotal)}{' '}
                            <span className="text-[10px] font-normal text-gray-400">/ 10</span>
                          </div>
                          <span className="text-[10px] text-gray-500 truncate block">
                            {record.template_title}
                          </span>
                        </TableCell>

                        {/* Mức độ & Hướng xử lý */}
                        <TableCell>
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${scoreLevel.colorClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${scoreLevel.dotClass}`} />
                              {scoreLevel.rangeLabel}: {scoreLevel.label}
                            </span>
                            <p className="text-[11px] text-gray-600 leading-tight">
                              {scoreLevel.actionNote}
                            </p>
                          </div>
                        </TableCell>

                        {/* Trạng thái ký */}
                        <TableCell>
                          <Badge
                            variant={record.signed ? 'success' : 'warning'}
                            size="xs"
                            shape="pill"
                          >
                            {record.signed ? 'Đã ký' : 'Chưa ký'}
                          </Badge>
                        </TableCell>

                        {/* Chi tiết */}
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedViewRecord(record)}
                            className="h-8 px-2 text-xs text-[#a1001f] hover:bg-[#a1001f]/10"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Xem
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {!loading && filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Không tìm thấy phiếu QC nào phù hợp với bộ lọc.
                </div>
              ) : null}

              {/* Phân trang phiếu QC đã tạo (20 phiếu/trang) */}
              {filteredRecords.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                  <div className="text-xs text-gray-500 font-medium">
                    Hiển thị <span className="font-semibold text-gray-900">{(recordPage - 1) * ITEMS_PER_PAGE + 1}</span>–
                    <span className="font-semibold text-gray-900">{Math.min(recordPage * ITEMS_PER_PAGE, filteredRecords.length)}</span> trong tổng số{' '}
                    <span className="font-semibold text-gray-900">{filteredRecords.length}</span> phiếu ({ITEMS_PER_PAGE} phiếu/trang)
                  </div>

                  {totalRecordPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRecordPage((p) => Math.max(1, p - 1))}
                        disabled={recordPage === 1}
                        className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Trước
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalRecordPages }, (_, i) => i + 1)
                          .filter((page) => {
                            if (totalRecordPages <= 7) return true
                            if (page === 1 || page === totalRecordPages) return true
                            return Math.abs(page - recordPage) <= 1
                          })
                          .map((page, idx, arr) => {
                            const prev = arr[idx - 1]
                            const hasGap = prev && page - prev > 1
                            return (
                              <div key={page} className="flex items-center gap-1">
                                {hasGap && <span className="text-xs text-gray-400 px-1">...</span>}
                                <button
                                  type="button"
                                  onClick={() => setRecordPage(page)}
                                  className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                    recordPage === page
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
                        onClick={() => setRecordPage((p) => Math.min(totalRecordPages, p + 1))}
                        disabled={recordPage === totalRecordPages}
                        className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
                      >
                        Sau
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Xem chi tiết Phiếu QC */}
      <Modal
        isOpen={!!selectedViewRecord}
        onClose={() => setSelectedViewRecord(null)}
        title={selectedViewRecord ? `Chi tiết phiếu QC - ${selectedViewRecord.class_name}` : 'Chi tiết phiếu QC'}
        subtitle={selectedViewRecord ? `${selectedViewRecord.template_title} · Tạo ngày ${formatDateTime(selectedViewRecord.created_at)}` : undefined}
        maxWidth="5xl"
      >
        {selectedViewRecord && (
          <div className="space-y-4">
            {/* Box thông tin lớp */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-gray-200">
                <div className="sm:px-3 first:pl-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Lớp học</span>
                  <span className="text-sm font-bold text-gray-950 block mt-0.5">{selectedViewRecord.class_name}</span>
                  {selectedViewRecord.session_index && (
                    <span className="text-xs text-gray-500 block mt-0.5">Buổi {selectedViewRecord.session_index}</span>
                  )}
                </div>
                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Cơ sở</span>
                  <span className="text-sm font-bold text-gray-950 block mt-0.5">{selectedViewRecord.center_name}</span>
                </div>
                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Giáo viên</span>
                  <span className="text-sm font-bold text-gray-950 block mt-0.5">{selectedViewRecord.teacher_name || '-'}</span>
                </div>
                <div className="sm:px-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Người tạo (Leader)</span>
                  <span className="text-xs font-bold text-gray-950 block mt-0.5 truncate">{selectedViewRecord.created_by_name || selectedViewRecord.created_by_email}</span>
                  <span className="text-[10px] text-gray-500 block truncate">{selectedViewRecord.created_by_email}</span>
                </div>
              </div>
            </div>

            {/* Box Đánh giá điểm số & Mức độ & Chi tiết tiêu chí */}
            {(() => {
              const total = Number(selectedViewRecord.total_score) || 0
              const max = Number(selectedViewRecord.max_score) || 10
              const displayTotal = max > 0 && max !== 10 ? (total / max) * 10 : total
              const lvl = getQCScoreLevel(displayTotal)

              // Parse answers safely if string or array
              let parsedAnswers: QCAnswerRecord[] = []
              if (Array.isArray(selectedViewRecord.answers)) {
                parsedAnswers = selectedViewRecord.answers
              } else if (typeof selectedViewRecord.answers === 'string') {
                try {
                  parsedAnswers = JSON.parse(selectedViewRecord.answers)
                } catch {
                  parsedAnswers = []
                }
              }

              // Group answers by category
              const groupedAnswers = parsedAnswers.reduce<Record<string, QCAnswerRecord[]>>((acc, item) => {
                const cat = item.category || 'Tiêu chí đánh giá'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(item)
                return acc
              }, {})

              return (
                <div className="space-y-4">
                  {/* Kết quả đánh giá */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Kết quả đánh giá</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-2xl font-black text-gray-950">
                            {formatScore(displayTotal)} <span className="text-xs font-normal text-gray-400">/ 10</span>
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${lvl.colorClass}`}>
                            <span className={`h-2 w-2 rounded-full ${lvl.dotClass}`} />
                            {lvl.rangeLabel}: {lvl.label}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Badge variant={selectedViewRecord.signed ? 'success' : 'warning'} shape="pill">
                          {selectedViewRecord.signed ? 'Đã ký duyệt' : 'Chưa ký duyệt'}
                        </Badge>
                      </div>
                    </div>

                    <div className={`rounded-lg border p-3 ${lvl.bgClass} ${lvl.borderClass}`}>
                      <span className="text-xs font-bold block" style={{ color: 'inherit' }}>
                        Hướng xử lý &amp; Khuyến nghị:
                      </span>
                      <p className="mt-1 text-xs leading-relaxed font-medium" style={{ color: 'inherit' }}>
                        {lvl.actionNote}
                      </p>
                    </div>

                    {selectedViewRecord.general_note && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                          Nhận xét chung từ Leader:
                        </span>
                        <p className="mt-1 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {selectedViewRecord.general_note}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Chi tiết từng mục / tiêu chí Leader đã chấm */}
                  <div className="rounded-xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-[#a1001f]" />
                        <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                          Chi tiết các mục Leader đã chấm ({parsedAnswers.length} tiêu chí)
                        </h3>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        Tổng điểm: <strong className="text-gray-900">{formatScore(displayTotal)} / 10</strong>
                      </span>
                    </div>

                    {parsedAnswers.length > 0 ? (
                      <div className="p-4 sm:p-5 space-y-5">
                        {Object.entries(groupedAnswers).map(([category, items]) => (
                          <div key={category} className="space-y-3">
                            <div className="flex items-center justify-between rounded-lg border border-[#f3d5da] bg-[#fff7f8] px-3.5 py-2 text-sm font-bold text-[#a1001f] shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#a1001f]" />
                                <span>{category}</span>
                              </div>
                              <span className="text-xs font-semibold text-[#a1001f]/80">
                                {items.length} tiêu chí
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                              {items.map((ans, idx) => {
                                const scoreVal = Number(ans.score) || 0
                                const hasScore = scoreVal > 0
                                return (
                                  <div
                                    key={ans.criterionId || idx}
                                    className={`rounded-xl border p-3.5 transition-all ${
                                      hasScore
                                        ? 'border-emerald-200 bg-emerald-50/20'
                                        : 'border-gray-200 bg-gray-50/40'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold text-gray-400">
                                            #{idx + 1}
                                          </span>
                                          <h4 className="text-sm font-bold text-gray-900 leading-snug">
                                            {ans.criterion}
                                          </h4>
                                        </div>
                                      </div>
                                      <span
                                        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-black ${
                                          hasScore
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                                        }`}
                                      >
                                        +{scoreVal} đ
                                      </span>
                                    </div>

                                    {/* Lựa chọn đã chấm */}
                                    {ans.selectedOptions && ans.selectedOptions.length > 0 && (
                                      <div className="mt-2.5 space-y-1.5">
                                        {ans.selectedOptions.map((opt, optIdx) => (
                                          <div
                                            key={opt.optionId || optIdx}
                                            className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-950 shadow-2xs"
                                          >
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                            <span className="flex-1">{opt.guide}</span>
                                            {opt.score !== undefined && (
                                              <span className="font-bold text-emerald-700 shrink-0">
                                                +{opt.score} đ
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Ghi chú riêng của tiêu chí nếu có */}
                                    {ans.note && (
                                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 flex items-start gap-1.5">
                                        <span className="font-bold shrink-0">Ghi chú:</span>
                                        <span className="whitespace-pre-wrap">{ans.note}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm text-gray-500">
                        Chưa có dữ liệu chi tiết các tiêu chí đã chấm cho phiếu này.
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </Modal>

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
