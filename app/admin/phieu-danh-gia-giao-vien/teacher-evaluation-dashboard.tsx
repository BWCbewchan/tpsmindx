'use client'
import { useQueryRestore } from '@/lib/use-query-restore'
import { useQueryState, isQueryUserEdit, resetQueryPage } from '@/lib/use-query-state'


import { PageContainer } from '@/components/PageContainer'
import { Tabs } from '@/components/Tabs'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
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
import type {
  EvaluationCentre,
  EvaluationSourceHealth,
  LmsAssigneeSearchResult,
  LmsEvaluationTicket,
  TeacherEvaluationApiResponse,
  TeacherEvaluationClassSummary,
  TeacherEvaluationDashboardData,
  TeacherEvaluationEntry,
  TeacherEvaluationFilterOptionsResponse,
} from '@/types/teacher-evaluation'
import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  ClipboardCheck,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  List,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  TicketCheck,
  UserCheck,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PAGE_SIZE = 20
const DATA_REQUEST_TIMEOUT_MS = 70000
const OPTIONS_REQUEST_TIMEOUT_MS = 25000

const STATUS_OPTIONS = [
  'NEW',
  'ASSIGNED',
  'IN_PROCESS',
  'IN_PROGRESS',
  'COMPLAIN',
  'RESOLVED',
  'CLOSED',
] as const
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const TOPIC_OPTIONS = ['TEACHER', 'DOCUMENT', 'EQUIPMENT', 'OPERATION', 'OTHER'] as const

type ViewMode = 'classes' | 'entries'
type SourceFilter = 'all' | 'lms' | 'google_sheets'
type SessionFilter = 'all' | '4' | '8' | 'outside_session' | 'inactive'
type ScoreFilter = 'all' | 'low'
type SortDirection = 'asc' | 'desc'
type ClassSortKey = 'className' | 'courseName' | 'sessions' | 'collectionRate' | 'averageTeacherScore' | 'totalResponses'
type EntrySortKey = 'timestamp' | 'studentName' | 'className' | 'teacherScore' | 'status'

interface TicketDraft {
  status: string
  priority: string
  feedbackTopic: string
  assigneeId: string
  assigneeName: string
}

interface BulkDraft extends TicketDraft {
  status: string
  priority: string
  feedbackTopic: string
}

function vietnamToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function classLookupKey(value: unknown) {
  return normalizeSearch(value).replace(/[^a-z0-9]+/g, '')
}

function scopedClassLookupKey(className: unknown, centreId: unknown) {
  return `${classLookupKey(className)}:${String(centreId || '')}`
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

function formatScore(value: number | null) {
  return value === null ? '—' : value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function statusBadgeVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toUpperCase()
  if (normalized === 'CLOSED' || normalized === 'RESOLVED') return 'success'
  if (normalized === 'COMPLAIN') return 'danger'
  if (normalized === 'IN_PROCESS' || normalized === 'IN_PROGRESS' || normalized === 'ASSIGNED') return 'warning'
  return 'info'
}

function healthBadge(health: EvaluationSourceHealth): BadgeProps['variant'] {
  if (health.status === 'ready') return 'success'
  if (health.status === 'error') return 'danger'
  if (health.status === 'unconfigured') return 'warning'
  return 'slate'
}

function healthLabel(status: EvaluationSourceHealth['status']) {
  if (status === 'ready') return 'Sẵn sàng'
  if (status === 'error') return 'Có lỗi'
  if (status === 'unconfigured') return 'Chưa cấu hình'
  return 'Không có dữ liệu'
}

function collectionTone(rate: number | null) {
  if (rate === null) return { text: 'text-gray-500', bar: 'bg-gray-300', badge: 'slate' as const }
  if (rate >= 95) return { text: 'text-emerald-700', bar: 'bg-emerald-500', badge: 'success' as const }
  if (rate >= 71) return { text: 'text-amber-700', bar: 'bg-amber-500', badge: 'warning' as const }
  return { text: 'text-red-700', bar: 'bg-red-500', badge: 'danger' as const }
}

function sourceTimestamp(entry: TeacherEvaluationEntry) {
  return entry.source === 'lms' ? entry.createdAt : entry.timestamp
}

function matchesSessionFilter(
  summary: TeacherEvaluationClassSummary | undefined,
  filter: SessionFilter,
) {
  if (filter === 'all') return true
  if (filter === 'outside_session') return !summary || summary.group === 'outside_session'
  if (filter === 'inactive') return summary?.group === 'inactive'
  return Boolean(summary?.surveySessions.some((session) => String(session.sessionNumber) === filter))
}

function SortableTableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  activeKey: string
  direction: SortDirection
  onSort: (key: string) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <TableHead
      className={className}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-left hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30"
      >
        <span>{label}</span>
        <ArrowUpDown className={`size-3.5 ${active ? 'text-[#a1001f]' : 'text-gray-400'}`} />
      </button>
    </TableHead>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  detail: React.ReactNode
  tone: 'brand' | 'emerald' | 'sky' | 'amber'
}) {
  const tones = {
    brand: 'border-l-[#a1001f] bg-red-50/30 text-[#a1001f]',
    emerald: 'border-l-emerald-500 bg-emerald-50/35 text-emerald-700',
    sky: 'border-l-sky-500 bg-sky-50/35 text-sky-700',
    amber: 'border-l-amber-500 bg-amber-50/35 text-amber-700',
  }
  return (
    <div className={`min-h-32 rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-current/10">
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-gray-600">{detail}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Đang tải dữ liệu">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="mt-5 h-8 w-32 rounded bg-gray-200" />
            <div className="mt-4 h-3 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-gray-200 bg-white" />
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <CircleDashed className="size-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">{description}</p>
    </div>
  )
}

function useAssigneeSearch(query: string, enabled: boolean, token: string | null) {
  const [results, setResults] = useState<LmsAssigneeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/admin/teacher-evaluations/assignees?search=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: 'no-store', headers: authHeaders(token) },
        )
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Không thể tìm người xử lý.')
        setResults(payload.data || [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResults([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 320)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, query, token])
  return { results, loading }
}

function AssigneePicker({
  query,
  onQueryChange,
  selectedName,
  onSelect,
  onClear,
  enabled,
  token,
}: {
  query: string
  onQueryChange: (value: string) => void
  selectedName: string
  onSelect: (user: LmsAssigneeSearchResult) => void
  onClear: () => void
  enabled: boolean
  token: string | null
}) {
  const { results, loading } = useAssigneeSearch(query, enabled, token)
  return (
    <div className="relative">
      {selectedName ? (
        <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-800">
          <span className="min-w-0 truncate font-medium">{selectedName}</span>
          <button type="button" onClick={onClear} className="shrink-0 rounded p-1 hover:bg-emerald-100" title="Bỏ người xử lý">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm tên hoặc email..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-red-100"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />}
        </div>
      )}
      {!selectedName && query.trim().length >= 2 && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-gray-50"
            >
              <UserCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">{user.displayName || user.username || user.email}</span>
                <span className="block truncate text-xs text-gray-500">{user.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ClassTable({
  classes,
  sortKey,
  sortDirection,
  onSort,
}: {
  classes: TeacherEvaluationClassSummary[]
  sortKey: ClassSortKey
  sortDirection: SortDirection
  onSort: (key: ClassSortKey) => void
}) {
  if (classes.length === 0) {
    return <EmptyState title="Chưa có lớp cần khảo sát" description="Không tìm thấy lớp có buổi 4/8 hoặc phiếu đánh giá trong bộ lọc hiện tại." />
  }
  const groups = [
    {
      id: 'standard' as const,
      title: 'Đúng đợt (buổi 4 & 8)',
      description: 'Lớp có buổi khảo sát nằm trong khoảng ngày đã chọn.',
      icon: CalendarCheck2,
      tone: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    },
    {
      id: 'outside_session' as const,
      title: 'Khảo sát sớm / muộn (ngoài đợt)',
      description: 'Có phản hồi nhưng không có buổi 4/8 trong khoảng ngày.',
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-900 border-amber-100',
    },
    {
      id: 'inactive' as const,
      title: 'Lớp đã hủy / tạm dừng',
      description: 'Giữ để đối soát, không tính vào biểu đồ phân tích lớp.',
      icon: Ban,
      tone: 'bg-gray-100 text-gray-700 border-gray-200',
    },
  ]
  return (
    <Table className="min-w-[1100px]">
      <TableHeader>
        <TableRow>
          <SortableTableHead label="Lớp học" sortKey="className" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="tracking-normal" />
          <SortableTableHead label="Khóa học & giáo viên" sortKey="courseName" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="tracking-normal" />
          <SortableTableHead label="Form buổi 4/8" sortKey="sessions" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="tracking-normal" />
          <SortableTableHead label="Tỷ lệ thu phiếu" sortKey="collectionRate" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="w-56 tracking-normal" />
          <SortableTableHead label="Điểm GV" sortKey="averageTeacherScore" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="tracking-normal" />
          <SortableTableHead label="Phản hồi" sortKey="totalResponses" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as ClassSortKey)} className="text-right tracking-normal" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const groupClasses = classes.filter((item) => item.group === group.id)
          if (groupClasses.length === 0) return null
          const GroupIcon = group.icon
          return (
            <Fragment key={group.id}>
              <TableRow className={`border-y hover:bg-inherit ${group.tone}`}>
                <TableCell colSpan={6} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <GroupIcon className="size-4" />
                    <span className="text-xs font-bold uppercase tracking-normal">{group.title}</span>
                    <Badge size="xs" variant="outline">{groupClasses.length}</Badge>
                    <span className="text-xs font-normal opacity-75">{group.description}</span>
                  </div>
                </TableCell>
              </TableRow>
              {groupClasses.map((item) => {
                const tone = collectionTone(item.collectionRate)
                return (
                  <TableRow key={`${group.id}-${item.classId}`} className={group.id === 'inactive' ? 'opacity-65' : undefined}>
                    <TableCell>
                      <p className="max-w-64 break-words font-semibold text-gray-950">{item.className}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge size="xs" variant="outline">{item.centre?.shortName || 'Chưa rõ CS'}</Badge>
                        {item.classStatus && <span className="text-xs text-gray-500">{item.classStatus}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-56 break-words text-sm font-medium text-gray-800">{item.courseName}</p>
                      <p className="mt-1 max-w-56 break-words text-xs text-gray-500">{item.teacherNames.join(', ') || item.courseLineName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {[4, 8].map((sessionNumber) => {
                          const session = item.surveySessions.find((value) => value.sessionNumber === sessionNumber)
                          return (
                            <div key={sessionNumber} className="min-w-28 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-gray-800">Buổi {sessionNumber}</span>
                                <span className={`size-2 rounded-full ${session?.opened ? 'bg-emerald-500' : session ? 'bg-amber-500' : 'bg-gray-300'}`} />
                              </div>
                              <p className="mt-1 text-[11px] text-gray-500">
                                {session ? `${session.opened ? 'Đã mở' : 'Chưa mở'} · ${formatDate(session.date)}` : 'Ngoài kỳ'}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={`font-semibold ${tone.text}`}>{formatPercent(item.collectionRate)}</span>
                        <span className="text-gray-500">{item.collectedResponses}/{item.eligibleStudents}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(item.collectionRate || 0, 100)}%` }} />
                      </div>
                      <div className="mt-2">
                        <Badge size="xs" variant={tone.badge}>Teacher Point {item.teacherPointScore ?? '—'}/5</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold text-gray-950">{formatScore(item.averageTeacherScore)}</span>
                      <span className="ml-1 text-xs text-gray-500">/5</span>
                      <p className="mt-1 text-[11px] text-gray-500">{item.scoredResponseCount} phiếu có điểm</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-gray-900">{item.analyticsResponseCount}</p>
                      <p className="mt-1 text-xs text-gray-500">Duy nhất · gốc {item.totalResponses}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">LMS {item.lmsTicketCount} · Forms {item.googleResponseCount}</p>
                    </TableCell>
                  </TableRow>
                )
              })}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}

function EntryTable({
  entries,
  selectedIds,
  onToggle,
  onTogglePage,
  onOpen,
  sortKey,
  sortDirection,
  onSort,
}: {
  entries: TeacherEvaluationEntry[]
  selectedIds: Set<string>
  onToggle: (entry: LmsEvaluationTicket) => void
  onTogglePage: (entries: LmsEvaluationTicket[], checked: boolean) => void
  onOpen: (entry: TeacherEvaluationEntry) => void
  sortKey: EntrySortKey
  sortDirection: SortDirection
  onSort: (key: EntrySortKey) => void
}) {
  const lmsEntries = entries.filter((entry): entry is LmsEvaluationTicket => entry.source === 'lms')
  const allSelected = lmsEntries.length > 0 && lmsEntries.every((entry) => selectedIds.has(entry.id))
  if (entries.length === 0) {
    return <EmptyState title="Không có phiếu phù hợp" description="Hãy thay đổi từ khóa, nguồn hoặc trạng thái đang lọc." />
  }
  return (
    <Table className="min-w-[1180px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-11 px-3 tracking-normal">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onTogglePage(lmsEntries, event.target.checked)}
              aria-label="Chọn tất cả phiếu LMS trên trang"
              className="size-4 accent-[#a1001f]"
            />
          </TableHead>
          <SortableTableHead label="Nguồn & thời gian" sortKey="timestamp" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as EntrySortKey)} className="tracking-normal" />
          <SortableTableHead label="Học viên" sortKey="studentName" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as EntrySortKey)} className="tracking-normal" />
          <SortableTableHead label="Lớp & cơ sở" sortKey="className" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as EntrySortKey)} className="tracking-normal" />
          <SortableTableHead label="Điểm GV" sortKey="teacherScore" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as EntrySortKey)} className="tracking-normal" />
          <TableHead className="tracking-normal">Chủ đề</TableHead>
          <SortableTableHead label="Trạng thái" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={(key) => onSort(key as EntrySortKey)} className="tracking-normal" />
          <TableHead className="w-16 text-right tracking-normal">Xem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={`${entry.source}-${entry.id}`} data-state={entry.source === 'lms' && selectedIds.has(entry.id) ? 'selected' : undefined}>
            <TableCell className="px-3">
              {entry.source === 'lms' ? (
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  onChange={() => onToggle(entry)}
                  aria-label={`Chọn ${entry.ticketCode || entry.id}`}
                  className="size-4 accent-[#a1001f]"
                />
              ) : <span className="block size-4" />}
            </TableCell>
            <TableCell>
              <Badge size="xs" variant={entry.source === 'lms' ? 'info' : 'emerald'} icon={entry.source === 'lms' ? TicketCheck : FileSpreadsheet}>
                {entry.source === 'lms' ? 'LMS' : 'Google Forms'}
              </Badge>
              <p className="mt-1.5 text-xs text-gray-500">{formatDate(sourceTimestamp(entry), true)}</p>
            </TableCell>
            <TableCell>
              <p className="max-w-52 break-words font-semibold text-gray-900">{entry.studentName || 'Ẩn danh'}</p>
              {entry.source === 'lms' && entry.ticketCode && <p className="mt-1 text-xs text-gray-500">{entry.ticketCode}</p>}
            </TableCell>
            <TableCell>
              <p className="max-w-64 break-words text-sm font-medium text-gray-800">{entry.className || 'Chưa khớp lớp'}</p>
              <p className="mt-1 text-xs text-gray-500">{entry.centre?.shortName || 'Chưa rõ cơ sở'}</p>
            </TableCell>
            <TableCell>
              <span className="font-bold text-gray-950">{formatScore(entry.teacherScore)}</span>
              <span className="ml-1 text-xs text-gray-500">/5</span>
            </TableCell>
            <TableCell>
              <Badge size="xs" variant="outline">{entry.source === 'lms' ? entry.feedbackTopic : 'TEACHER'}</Badge>
              {entry.source === 'lms' && <p className="mt-1 text-[11px] text-gray-500">Ưu tiên {entry.priority}</p>}
            </TableCell>
            <TableCell>
              {entry.source === 'lms' ? (
                <Badge size="xs" variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
              ) : (
                <Badge size="xs" variant={entry.matchMethod === 'direct' ? 'success' : entry.matchMethod === 'inferred' ? 'warning' : 'danger'}>
                  {entry.matchMethod === 'direct' ? 'Đã khớp' : entry.matchMethod === 'inferred' ? 'Suy luận' : 'Chưa khớp'}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon-sm" onClick={() => onOpen(entry)} title="Xem chi tiết">
                <Eye className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function TeacherEvaluationDashboard({
  initialData,
}: {
  initialData?: TeacherEvaluationDashboardData
} = {}) {
  const { token, isLoading: authLoading } = useAuth()
  const today = useMemo(() => vietnamToday(), [])
  const [dateFrom, setDateFrom] = useQueryState<string>('dateFrom', `${today.slice(0, 7)}-01`)
  const [dateTo, setDateTo] = useQueryState<string>('dateTo', today)
  const [centreId, setCentreId] = useQueryState<string>('centre', '')
  const [requestSearch, setRequestSearch] = useQueryState<string>('requestSearch', '')
  const [filterCentres, setFilterCentres] = useState<EvaluationCentre[]>(initialData?.centres || [])
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(!initialData)
  const [filterOptionsError, setFilterOptionsError] = useState('')
  const [data, setData] = useState<TeacherEvaluationDashboardData | null>(initialData || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterInputError, setFilterInputError] = useState('')
  const [hasApplied, setHasApplied] = useState(Boolean(initialData))
  const [viewMode, setViewMode] = useQueryState<ViewMode>('view', 'classes', { values: ["classes","entries"] })
  const [search, setSearch] = useQueryState<string>('search', '')
  const [sourceFilter, setSourceFilter] = useQueryState<SourceFilter>('source', 'all', { values: ["all","lms","google_sheets"] })
  const [statusFilter, setStatusFilter] = useQueryState<string>('status', 'all')
  const [tableCentreFilter, setTableCentreFilter] = useQueryState<string>('tableCentre', 'all', { history: 'push' })
  const [courseLineFilter, setCourseLineFilter] = useQueryState<string>('course', 'all')
  const [topicFilter, setTopicFilter] = useQueryState<string>('topic', 'all')
  const [sessionFilter, setSessionFilter] = useQueryState<SessionFilter>('session', 'all', { values: ["all","4","8","outside_session","inactive"] })
  const [scoreFilter, setScoreFilter] = useQueryState<ScoreFilter>('score', 'all', { values: ["all","low"] })
  const [classSortKey, setClassSortKey] = useQueryState<ClassSortKey>('classSort', 'collectionRate', { values: ["className","courseName","sessions","collectionRate","averageTeacherScore","totalResponses"] })
  const [classSortDirection, setClassSortDirection] = useQueryState<SortDirection>('classOrder', 'asc', { values: ["asc","desc"] })
  const [entrySortKey, setEntrySortKey] = useQueryState<EntrySortKey>('entrySort', 'timestamp', { values: ["timestamp","studentName","className","teacherScore","status"] })
  const [entrySortDirection, setEntrySortDirection] = useQueryState<SortDirection>('entryOrder', 'desc', { values: ["asc","desc"] })
  const [page, setPage] = useQueryState<number>('page', 1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedEntry, setSelectedEntry] = useState<TeacherEvaluationEntry | null>(null)
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null)
  const [assigneeQuery, setAssigneeQuery] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkDraft, setBulkDraft] = useState<BulkDraft>({
    status: '',
    priority: '',
    feedbackTopic: '',
    assigneeId: '',
    assigneeName: '',
  })
  const [bulkAssigneeQuery, setBulkAssigneeQuery] = useState('')
  const [savingBulk, setSavingBulk] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const optionsAbortRef = useRef<AbortController | null>(null)

  const loadFilterOptions = useCallback(async () => {
    optionsAbortRef.current?.abort()
    const controller = new AbortController()
    optionsAbortRef.current = controller
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, OPTIONS_REQUEST_TIMEOUT_MS)
    setFilterOptionsLoading(true)
    setFilterOptionsError('')
    try {
      const response = await fetch('/api/admin/teacher-evaluations/options', {
        signal: controller.signal,
        cache: 'no-store',
        headers: authHeaders(token),
      })
      const payload = await response.json() as TeacherEvaluationFilterOptionsResponse
      if (!response.ok || !payload.success || !payload.centres) {
        throw new Error(payload.error || 'Không thể tải danh sách cơ sở.')
      }
      setFilterCentres(payload.centres)
    } catch (optionsError) {
      if (controller.signal.aborted && !timedOut) return
      setFilterOptionsError(timedOut
        ? 'Danh sách cơ sở phản hồi quá lâu. Bạn có thể thử tải lại hoặc tìm bằng từ khóa.'
        : optionsError instanceof Error ? optionsError.message : 'Không thể tải danh sách cơ sở.')
    } finally {
      window.clearTimeout(timeoutId)
      if (optionsAbortRef.current === controller) {
        optionsAbortRef.current = null
        setFilterOptionsLoading(false)
      }
    }
  }, [token])

  const loadData = useCallback(async (preservePage = false) => {
    const normalizedRequestSearch = requestSearch.trim()
    if (!centreId && normalizedRequestSearch.length < 2) {
      setFilterInputError('Chọn một cơ sở hoặc nhập từ khóa có ít nhất 2 ký tự trước khi áp dụng.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, DATA_REQUEST_TIMEOUT_MS)
    setHasApplied(true)
    setLoading(true)
    setError('')
    setFilterInputError('')
    if (process.env.NODE_ENV !== 'production') {
      console.info('[teacher-evaluations] load:start', {
        dateFrom,
        dateTo,
        hasCentre: Boolean(centreId),
        hasSearch: Boolean(normalizedRequestSearch),
      })
    }
    let responseRequestId = ''
    try {
      const params = new URLSearchParams({ dateFrom, dateTo })
      if (centreId) params.set('centreId', centreId)
      if (normalizedRequestSearch) params.set('search', normalizedRequestSearch)
      const response = await fetch(`/api/admin/teacher-evaluations?${params}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: authHeaders(token),
      })
      const payload = await response.json() as TeacherEvaluationApiResponse
      responseRequestId = payload.requestId || ''
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Không thể tải dữ liệu phiếu đánh giá.')
      }
      setData(payload.data)
      setFilterCentres(payload.data.centres)
      setSelectedIds(new Set())
      if (!preservePage) setPage(1)
      if (process.env.NODE_ENV !== 'production') {
        console.info('[teacher-evaluations] load:done', {
          classes: payload.data.classes.length,
          entries: payload.data.entries.length,
        })
      }
    } catch (loadError) {
      if (controller.signal.aborted && !timedOut) {
        if (abortRef.current === controller) setError('Đã dừng tải dữ liệu.')
        return
      }
      console.error('[teacher-evaluations] load:failed', {
        requestId: responseRequestId || undefined,
        timedOut,
        error: loadError instanceof Error ? loadError.message : String(loadError),
      })
      setError(timedOut
        ? 'Yêu cầu đã dừng vì quá 70 giây. Hãy thu hẹp cơ sở, khoảng ngày hoặc từ khóa rồi thử lại.'
        : loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu phiếu đánh giá.')
    } finally {
      window.clearTimeout(timeoutId)
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }, [centreId, dateFrom, dateTo, requestSearch, token])

  useQueryRestore(() => { void loadData(true) }, ['centre','requestSearch'], !authLoading);

  useEffect(() => {
    if (authLoading || initialData) return
    void loadFilterOptions()
  }, [authLoading, initialData, loadFilterOptions])

  useEffect(() => () => {
    abortRef.current?.abort()
    optionsAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (selectedEntry?.source === 'lms') {
      setTicketDraft({
        status: selectedEntry.status,
        priority: selectedEntry.priority,
        feedbackTopic: selectedEntry.feedbackTopic,
        assigneeId: selectedEntry.assignee?.id || '',
        assigneeName: selectedEntry.assignee?.displayName || selectedEntry.assignee?.username || selectedEntry.assignee?.email || '',
      })
    } else {
      setTicketDraft(null)
    }
    setAssigneeQuery('')
  }, [selectedEntry])

  const normalizedSearch = normalizeSearch(search.trim())
  const classLookups = useMemo(() => {
    const byId = new Map<string, TeacherEvaluationClassSummary>()
    const byScopedName = new Map<string, TeacherEvaluationClassSummary>()
    const byName = new Map<string, TeacherEvaluationClassSummary | null>()
    data?.classes.forEach((item) => {
      if (item.classId) byId.set(item.classId, item)
      if (!item.className) return
      const nameKey = classLookupKey(item.className)
      byScopedName.set(scopedClassLookupKey(item.className, item.centre?.id), item)
      if (!byName.has(nameKey)) byName.set(nameKey, item)
      else if (byName.get(nameKey)?.classId !== item.classId) byName.set(nameKey, null)
    })
    return { byId, byName, byScopedName }
  }, [data])

  const centreOptions = useMemo(() => {
    if (!data) return []
    const usedIds = new Set([
      ...data.classes.flatMap((item) => item.centre?.id ? [item.centre.id] : []),
      ...data.entries.flatMap((entry) => entry.centre?.id ? [entry.centre.id] : []),
    ])
    return data.centres.filter((centre) => usedIds.has(centre.id))
  }, [data])

  const courseLineOptions = useMemo(() => {
    const values = new Set<string>()
    data?.classes.forEach((item) => {
      const value = item.courseLineName?.trim()
      if (value && value !== 'Chưa xác định') values.add(value)
    })
    return Array.from(values).sort((first, second) => first.localeCompare(second, 'vi'))
  }, [data])

  const filteredClasses = useMemo(() => {
    if (!data) return []
    return data.classes.filter((item) => {
      if (sourceFilter === 'lms' && item.lmsTicketCount === 0) return false
      if (sourceFilter === 'google_sheets' && item.googleResponseCount === 0) return false
      if (tableCentreFilter !== 'all' && item.centre?.id !== tableCentreFilter) return false
      if (courseLineFilter !== 'all' && item.courseLineName !== courseLineFilter) return false
      if (statusFilter !== 'all' && !(
        item.ticketStatuses.includes(statusFilter) ||
        (statusFilter === 'CLOSED' && item.googleResponseCount > 0)
      )) return false
      if (topicFilter !== 'all' && !(
        item.feedbackTopics.includes(topicFilter) ||
        (topicFilter === 'TEACHER' && item.googleResponseCount > 0)
      )) return false
      if (!matchesSessionFilter(item, sessionFilter)) return false
      if (scoreFilter === 'low' && (item.averageTeacherScore === null || item.averageTeacherScore > 3)) return false
      if (!normalizedSearch) return true
      return normalizeSearch([
        item.className,
        item.centre?.shortName,
        item.centre?.name,
        item.courseName,
        item.courseLineName,
        item.teacherNames.join(' '),
      ].join(' ')).includes(normalizedSearch)
    }).sort((first, second) => {
      let comparison = 0
      if (classSortKey === 'className') comparison = first.className.localeCompare(second.className, 'vi')
      if (classSortKey === 'courseName') comparison = first.courseName.localeCompare(second.courseName, 'vi')
      if (classSortKey === 'sessions') {
        const firstSession = Math.min(...first.surveySessions.map((session) => session.sessionNumber), 99)
        const secondSession = Math.min(...second.surveySessions.map((session) => session.sessionNumber), 99)
        comparison = firstSession - secondSession
      }
      if (classSortKey === 'totalResponses') comparison = first.analyticsResponseCount - second.analyticsResponseCount
      if (classSortKey === 'collectionRate' || classSortKey === 'averageTeacherScore') {
        const firstValue = first[classSortKey]
        const secondValue = second[classSortKey]
        if (firstValue === null && secondValue === null) comparison = 0
        else if (firstValue === null) return 1
        else if (secondValue === null) return -1
        else comparison = firstValue - secondValue
      }
      return (classSortDirection === 'asc' ? comparison : -comparison) || first.className.localeCompare(second.className, 'vi')
    })
  }, [
    classSortDirection,
    classSortKey,
    courseLineFilter,
    data,
    normalizedSearch,
    scoreFilter,
    sessionFilter,
    sourceFilter,
    statusFilter,
    tableCentreFilter,
    topicFilter,
  ])

  const filteredEntries = useMemo(() => {
    if (!data) return []
    return data.entries.filter((entry) => {
      const summary = (
        (entry.classId && classLookups.byId.get(entry.classId)) ||
        classLookups.byScopedName.get(scopedClassLookupKey(entry.className, entry.centre?.id)) ||
        classLookups.byName.get(classLookupKey(entry.className)) ||
        undefined
      )
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false
      if (tableCentreFilter !== 'all' && entry.centre?.id !== tableCentreFilter) return false
      if (courseLineFilter !== 'all' && summary?.courseLineName !== courseLineFilter) return false
      const effectiveStatus = entry.source === 'lms' ? entry.status : 'CLOSED'
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false
      const effectiveTopic = entry.source === 'lms' ? entry.feedbackTopic : 'TEACHER'
      if (topicFilter !== 'all' && effectiveTopic !== topicFilter) return false
      if (!matchesSessionFilter(summary, sessionFilter)) return false
      if (scoreFilter === 'low' && (entry.teacherScore === null || entry.teacherScore > 3)) return false
      if (!normalizedSearch) return true
      const text = entry.source === 'lms'
        ? [entry.studentName, entry.studentId, entry.className, entry.ticketCode, entry.title, entry.centre?.shortName].join(' ')
        : [entry.studentName, entry.studentId, entry.className, entry.inputClassCode, entry.normalizedClassCode, entry.centre?.shortName].join(' ')
      return normalizeSearch(text).includes(normalizedSearch)
    }).sort((first, second) => {
      let comparison = 0
      if (entrySortKey === 'timestamp') {
        const firstValue = sourceTimestamp(first) ? new Date(sourceTimestamp(first) as string).getTime() : null
        const secondValue = sourceTimestamp(second) ? new Date(sourceTimestamp(second) as string).getTime() : null
        if (firstValue === null && secondValue === null) comparison = 0
        else if (firstValue === null) return 1
        else if (secondValue === null) return -1
        else comparison = firstValue - secondValue
      }
      if (entrySortKey === 'studentName') comparison = first.studentName.localeCompare(second.studentName, 'vi')
      if (entrySortKey === 'className') comparison = first.className.localeCompare(second.className, 'vi')
      if (entrySortKey === 'teacherScore') {
        if (first.teacherScore === null && second.teacherScore === null) comparison = 0
        else if (first.teacherScore === null) return 1
        else if (second.teacherScore === null) return -1
        else comparison = first.teacherScore - second.teacherScore
      }
      if (entrySortKey === 'status') {
        const firstStatus = first.source === 'lms' ? first.status : 'CLOSED'
        const secondStatus = second.source === 'lms' ? second.status : 'CLOSED'
        comparison = firstStatus.localeCompare(secondStatus)
      }
      return (entrySortDirection === 'asc' ? comparison : -comparison) || first.id.localeCompare(second.id)
    })
  }, [
    classLookups,
    courseLineFilter,
    data,
    entrySortDirection,
    entrySortKey,
    normalizedSearch,
    scoreFilter,
    sessionFilter,
    sourceFilter,
    statusFilter,
    tableCentreFilter,
    topicFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedEntries = filteredEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  useEffect(() => void (isQueryUserEdit() && resetQueryPage(setPage)), [
    courseLineFilter,
    entrySortDirection,
    entrySortKey,
    normalizedSearch,
    scoreFilter,
    sessionFilter,
    sourceFilter,
    statusFilter,
    tableCentreFilter,
    topicFilter,
  ])

  const hasTableFilters = Boolean(
    normalizedSearch ||
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    tableCentreFilter !== 'all' ||
    courseLineFilter !== 'all' ||
    topicFilter !== 'all' ||
    sessionFilter !== 'all' ||
    scoreFilter !== 'all'
  )

  const clearTableFilters = () => {
    setSearch('')
    setSourceFilter('all')
    setStatusFilter('all')
    setTableCentreFilter('all')
    setCourseLineFilter('all')
    setTopicFilter('all')
    setSessionFilter('all')
    setScoreFilter('all')
  }

  const handleClassSort = (key: ClassSortKey) => {
    if (classSortKey === key) setClassSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else {
      setClassSortKey(key)
      setClassSortDirection(key === 'className' || key === 'courseName' ? 'asc' : 'desc')
    }
  }

  const handleEntrySort = (key: EntrySortKey) => {
    if (entrySortKey === key) setEntrySortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else {
      setEntrySortKey(key)
      setEntrySortDirection(key === 'studentName' || key === 'className' || key === 'status' ? 'asc' : 'desc')
    }
  }

  const selectedTickets = useMemo(() => {
    if (!data) return []
    return data.entries.filter((entry): entry is LmsEvaluationTicket => entry.source === 'lms' && selectedIds.has(entry.id))
  }, [data, selectedIds])

  const toggleTicket = (entry: LmsEvaluationTicket) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.add(entry.id)
      return next
    })
  }

  const togglePage = (entries: LmsEvaluationTicket[], checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      entries.forEach((entry) => checked ? next.add(entry.id) : next.delete(entry.id))
      return next
    })
  }

  const saveTicket = async () => {
    if (selectedEntry?.source !== 'lms' || !ticketDraft) return
    setSavingTicket(true)
    try {
      const response = await fetch(`/api/admin/teacher-evaluations/tickets/${encodeURIComponent(selectedEntry.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          mutationToken: selectedEntry.mutationToken,
          status: ticketDraft.status,
          priority: ticketDraft.priority,
          feedbackTopic: ticketDraft.feedbackTopic,
          assigneeId: ticketDraft.assigneeId,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Không thể cập nhật phiếu.')
      toast.success('Đã cập nhật phiếu LMS.')
      setSelectedEntry(null)
      await loadData()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Không thể cập nhật phiếu.')
    } finally {
      setSavingTicket(false)
    }
  }

  const saveBulk = async () => {
    if (selectedTickets.length === 0) return
    const update = Object.fromEntries(Object.entries({
      status: bulkDraft.status || undefined,
      priority: bulkDraft.priority || undefined,
      feedbackTopic: bulkDraft.feedbackTopic || undefined,
      assigneeId: bulkDraft.assigneeId || undefined,
    }).filter(([, value]) => value !== undefined))
    if (Object.keys(update).length === 0) {
      toast.error('Chọn ít nhất một trường cần cập nhật.')
      return
    }
    setSavingBulk(true)
    try {
      const response = await fetch('/api/admin/teacher-evaluations/tickets/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          items: selectedTickets.map((ticket) => ({ id: ticket.id, mutationToken: ticket.mutationToken })),
          update,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Không thể cập nhật hàng loạt.')
      const failedCount = Array.isArray(payload.errors) ? payload.errors.length : 0
      toast.success(failedCount > 0
        ? `Đã cập nhật ${payload.updatedIds?.length || 0} phiếu, ${failedCount} phiếu lỗi.`
        : `Đã cập nhật ${payload.updatedIds?.length || 0} phiếu.`)
      setShowBulkModal(false)
      setBulkDraft({ status: '', priority: '', feedbackTopic: '', assigneeId: '', assigneeName: '' })
      setBulkAssigneeQuery('')
      await loadData()
    } catch (bulkError) {
      toast.error(bulkError instanceof Error ? bulkError.message : 'Không thể cập nhật hàng loạt.')
    } finally {
      setSavingBulk(false)
    }
  }

  return (
    <PageContainer maxWidth="2xl" padding="md">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="h-1 bg-[#a1001f]" />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#a1001f]">
              <ClipboardCheck className="size-5" />
              <span className="text-xs font-bold uppercase tracking-normal">Teaching Portal System</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">Phiếu đánh giá giáo viên</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Theo dõi phản hồi LMS, Google Forms và tỷ lệ thu phiếu tại các buổi khảo sát 4/8.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-center">
            {data?.generatedAt && <span className="hidden text-xs text-gray-500 sm:inline">Cập nhật {formatDate(data.generatedAt, true)}</span>}
            {hasApplied && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => loading ? abortRef.current?.abort() : void loadData()}
                title={loading ? 'Dừng tải dữ liệu' : 'Tải lại dữ liệu'}
              >
                {loading ? <X className="size-4" /> : <RefreshCcw className="size-4" />}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.8fr_0.8fr_1.2fr_1.4fr_auto] xl:items-end"
          onSubmit={(event) => { event.preventDefault(); void loadData() }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Từ ngày</span>
            <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Đến ngày</span>
            <input type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Cơ sở</span>
            <select
              value={centreId}
              disabled={filterOptionsLoading}
              onChange={(event) => { setCentreId(event.target.value); setFilterInputError('') }}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100 disabled:cursor-wait disabled:bg-gray-50"
            >
              <option value="">{filterOptionsLoading ? 'Đang tải danh sách cơ sở...' : 'Chọn cơ sở'}</option>
              {filterCentres.map((centre) => <option key={centre.id} value={centre.id}>{centre.shortName} · {centre.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Tìm kiếm</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={requestSearch}
                maxLength={100}
                onChange={(event) => { setRequestSearch(event.target.value); setFilterInputError('') }}
                placeholder="Mã lớp, học viên hoặc mã phiếu"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100"
              />
            </span>
          </label>
          <Button type="submit" variant="mindx" className="w-full xl:w-auto" loading={loading} disabled={authLoading}>
            <Filter className="size-4" />
            Áp dụng
          </Button>
        </form>
        {filterInputError && <p className="mt-3 text-sm text-red-700">{filterInputError}</p>}
        {filterOptionsError && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="size-4 shrink-0" />
            <span>{filterOptionsError}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadFilterOptions()}>
              <RefreshCcw className="size-4" />
              Tải lại cơ sở
            </Button>
          </div>
        )}
      </section>

      {!hasApplied && !data ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <EmptyState
            title="Chưa tải dữ liệu"
            description="Chọn một cơ sở hoặc nhập từ khóa, sau đó áp dụng bộ lọc để xem phiếu đánh giá."
          />
        </section>
      ) : loading && !data ? <div className="mt-5"><LoadingState /></div> : error && !data ? (
        <section className="mt-5 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto size-7 text-red-600" />
          <h2 className="mt-3 text-base font-semibold text-red-900">Không thể tải dữ liệu</h2>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void loadData()}><RefreshCcw className="size-4" />Thử lại</Button>
        </section>
      ) : data ? (
        <>
          {(error || data.warnings.length > 0) && (
            <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div className="min-w-0 text-sm text-amber-900">
                  {error && <p>{error}</p>}
                  {data.warnings.slice(0, 3).map((warning) => <p key={warning}>{warning}</p>)}
                  {data.warnings.length > 3 && <p>Và {data.warnings.length - 3} cảnh báo khác.</p>}
                </div>
              </div>
            </section>
          )}

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Sparkles}
              label="Điểm giáo viên"
              value={`${formatScore(data.stats.averageTeacherScore)}/5`}
              detail="Trung bình các câu chấm điểm thuộc nhóm giáo viên trên những phản hồi hợp lệ."
              tone="emerald"
            />
            <MetricCard
              icon={Gauge}
              label="Tỷ lệ thu phiếu"
              value={formatPercent(data.stats.collectionRate)}
              detail={<span>{data.stats.surveyCollected}/{data.stats.surveyEligible} học viên hợp lệ · Teacher Point <strong>{data.stats.teacherPointScore ?? '—'}/5</strong></span>}
              tone="brand"
            />
            <MetricCard
              icon={SquareStack}
              label="Phản hồi duy nhất"
              value={data.stats.totalResponses.toLocaleString('vi-VN')}
              detail={`LMS ${data.stats.lmsTicketCount} · Google Forms ${data.stats.googleResponseCount} · Chưa khớp ${data.stats.unmatchedGoogleCount}`}
              tone="sky"
            />
            <MetricCard
              icon={TicketCheck}
              label="Phiếu cần xử lý"
              value={data.stats.openTicketCount.toLocaleString('vi-VN')}
              detail={`${data.stats.resolvedTicketCount} phiếu đã xử lý · Tỷ lệ ${formatPercent(data.stats.resolutionRate)}`}
              tone="amber"
            />
          </section>

          <section className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 lg:pr-3">
              <ShieldCheck className="size-4 text-emerald-600" />
              Nguồn dữ liệu
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              {data.sourceHealth.map((health) => (
                <div key={health.source} className="flex min-w-0 items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                  <span className={`size-2 shrink-0 rounded-full ${health.status === 'ready' ? 'bg-emerald-500' : health.status === 'error' ? 'bg-red-500' : health.status === 'unconfigured' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                  <span className="shrink-0 text-sm font-semibold text-gray-800">{health.label}</span>
                  <Badge variant={healthBadge(health)} size="xs">{healthLabel(health.status)}</Badge>
                  <span className="min-w-0 truncate text-xs text-gray-500" title={health.message}>{health.message}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Tỷ lệ thu phiếu theo cơ sở</h2>
                  <p className="mt-1 text-xs text-gray-500">Tính trên học viên hợp lệ tại buổi 4/8</p>
                </div>
                <BarChart3 className="size-4 text-emerald-600" />
              </div>
              <div className="mt-4 h-64">
                {data.stats.byCentre.some((row) => row.collectionRate !== null) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.stats.byCentre.filter((row) => row.collectionRate !== null).slice(0, 10)} margin={{ top: 4, right: 8, left: -18, bottom: 28 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-25} textAnchor="end" interval={0} tickFormatter={(value) => String(value).slice(0, 12)} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Tỷ lệ thu phiếu']} />
                      <Bar dataKey="collectionRate" name="Tỷ lệ thu phiếu" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="Chưa có dữ liệu biểu đồ" description="Cần có lớp hợp lệ trong kỳ để tính tỷ lệ theo cơ sở." />}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Điểm giáo viên theo nhóm khóa</h2>
                  <p className="mt-1 text-xs text-gray-500">Điểm trung bình trên thang 5</p>
                </div>
                <BookOpenCheck className="size-4 text-[#a1001f]" />
              </div>
              <div className="mt-4 h-64">
                {data.stats.byCourse.some((row) => row.averageTeacherScore !== null) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.stats.byCourse.filter((row) => row.averageTeacherScore !== null).slice(0, 10)} margin={{ top: 4, right: 8, left: -18, bottom: 28 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-25} textAnchor="end" interval={0} tickFormatter={(value) => String(value).slice(0, 14)} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Tooltip formatter={(value) => [value ?? 0, 'Điểm giáo viên']} />
                      <Bar dataKey="averageTeacherScore" name="Điểm giáo viên" fill="#a1001f" radius={[4, 4, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="Chưa có điểm giáo viên" description="Chưa có phiếu chứa hai câu hỏi chấm điểm giáo viên trong kỳ." />}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 pt-2 sm:px-5">
              <Tabs
                tabs={[
                  { id: 'classes', label: 'Theo lớp', count: filteredClasses.length },
                  { id: 'entries', label: 'Danh sách phiếu', count: filteredEntries.length },
                ]}
                activeTab={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
              />
            </div>
            <div className="space-y-3 border-b border-gray-200 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm lớp, học viên, giáo viên hoặc mã phiếu..."
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-red-100"
                  />
                  {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100" title="Xóa từ khóa"><X className="size-4" /></button>}
                </div>
                <label className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${scoreFilter === 'low' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={scoreFilter === 'low'}
                    onChange={(event) => setScoreFilter(event.target.checked ? 'low' : 'all')}
                    className="size-4 accent-[#a1001f]"
                  />
                  Điểm thấp ≤ 3,0
                </label>
                {hasTableFilters && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearTableFilters}>
                    <RotateCcw className="size-4" />Xóa bộ lọc
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <label>
                  <span className="sr-only">Nguồn phiếu</span>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả nguồn</option>
                    <option value="lms">LMS</option>
                    <option value="google_sheets">Google Forms</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Cơ sở trong bảng</span>
                  <select value={tableCentreFilter} onChange={(event) => setTableCentreFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả cơ sở</option>
                    {centreOptions.map((centre) => <option key={centre.id} value={centre.id}>{centre.shortName || centre.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Nhóm khóa học</span>
                  <select value={courseLineFilter} onChange={(event) => setCourseLineFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả nhóm khóa</option>
                    {courseLineOptions.map((courseLine) => <option key={courseLine} value={courseLine}>{courseLine}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Trạng thái phiếu</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả trạng thái</option>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Chủ đề phản hồi</span>
                  <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả chủ đề</option>
                    {TOPIC_OPTIONS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Đợt khảo sát</span>
                  <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as SessionFilter)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                    <option value="all">Tất cả buổi</option>
                    <option value="4">Buổi 4</option>
                    <option value="8">Buổi 8</option>
                    <option value="outside_session">Sớm / muộn</option>
                    <option value="inactive">Lớp ngừng hoạt động</option>
                  </select>
                </label>
                <div className="flex h-10 items-center rounded-lg bg-gray-50 px-3 text-xs font-medium text-gray-600">
                  {viewMode === 'classes' ? `${filteredClasses.length} lớp` : `${filteredEntries.length} phiếu`}
                </div>
              </div>
            </div>

            {viewMode === 'entries' && selectedIds.size > 0 && (
              <div className="flex flex-col gap-3 border-b border-red-100 bg-red-50 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 text-sm font-semibold text-red-900">
                  <CheckCircle2 className="size-4" />
                  Đã chọn {selectedIds.size} phiếu LMS
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</Button>
                  <Button variant="mindx" size="sm" onClick={() => setShowBulkModal(true)}>
                    <SlidersHorizontal className="size-4" />Cập nhật hàng loạt
                  </Button>
                </div>
              </div>
            )}

            <div className="p-0">
              {viewMode === 'classes' ? (
                <ClassTable
                  classes={filteredClasses}
                  sortKey={classSortKey}
                  sortDirection={classSortDirection}
                  onSort={handleClassSort}
                />
              ) : (
                <EntryTable
                  entries={pagedEntries}
                  selectedIds={selectedIds}
                  onToggle={toggleTicket}
                  onTogglePage={togglePage}
                  onOpen={setSelectedEntry}
                  sortKey={entrySortKey}
                  sortDirection={entrySortDirection}
                  onSort={handleEntrySort}
                />
              )}
            </div>
            {viewMode === 'entries' && filteredEntries.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">Trang {currentPage}/{totalPages} · {filteredEntries.length} phiếu</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon-sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} title="Trang trước"><ChevronLeft className="size-4" /></Button>
                  <Button variant="outline" size="icon-sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} title="Trang sau"><ChevronRight className="size-4" /></Button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      <Modal open={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} size="5xl">
        {selectedEntry && (
          <>
            <ModalHeader className="border-b border-gray-200">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedEntry.source === 'lms' ? 'info' : 'emerald'} size="xs">{selectedEntry.source === 'lms' ? 'LMS' : 'Google Forms'}</Badge>
                  <span className="text-xs text-gray-500">{formatDate(sourceTimestamp(selectedEntry), true)}</span>
                </div>
                <ModalTitle className="mt-2 break-words">{selectedEntry.source === 'lms' ? selectedEntry.title : `Phản hồi của ${selectedEntry.studentName}`}</ModalTitle>
                <p className="mt-1 break-words text-sm text-gray-500">{selectedEntry.className || 'Chưa khớp lớp'} · {selectedEntry.centre?.shortName || 'Chưa rõ cơ sở'}</p>
              </div>
              <ModalClose onClick={() => setSelectedEntry(null)} />
            </ModalHeader>
            <ModalBody className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-500">Học viên</p>
                  <p className="mt-1 break-words text-sm font-semibold text-gray-900">{selectedEntry.studentName || 'Ẩn danh'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-500">Điểm giáo viên</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatScore(selectedEntry.teacherScore)}/5</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500">Mã lớp</p>
                  <p className="mt-1 break-words text-sm font-semibold text-gray-900">{selectedEntry.source === 'lms' ? selectedEntry.className : selectedEntry.normalizedClassCode || selectedEntry.inputClassCode || '—'}</p>
                </div>
              </div>

              {selectedEntry.source === 'lms' && ticketDraft && (
                <section>
                  <div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="size-4 text-[#a1001f]" /><h3 className="text-sm font-semibold text-gray-900">Xử lý phiếu LMS</h3></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">Trạng thái</span>
                      <select value={ticketDraft.status} onChange={(event) => setTicketDraft((current) => current ? { ...current, status: event.target.value } : current)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                        {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">Ưu tiên</span>
                      <select value={ticketDraft.priority} onChange={(event) => setTicketDraft((current) => current ? { ...current, priority: event.target.value } : current)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                        {PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">Chủ đề</span>
                      <select value={ticketDraft.feedbackTopic} onChange={(event) => setTicketDraft((current) => current ? { ...current, feedbackTopic: event.target.value } : current)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                        {TOPIC_OPTIONS.map((topic) => <option key={topic}>{topic}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">Người xử lý</span>
                      <AssigneePicker
                        query={assigneeQuery}
                        onQueryChange={setAssigneeQuery}
                        selectedName={ticketDraft.assigneeName}
                        enabled={Boolean(selectedEntry)}
                        token={token}
                        onSelect={(user) => {
                          setTicketDraft((current) => current ? { ...current, assigneeId: user.id, assigneeName: user.displayName || user.username || user.email } : current)
                          setAssigneeQuery('')
                        }}
                        onClear={() => setTicketDraft((current) => current ? { ...current, assigneeId: '', assigneeName: '' } : current)}
                      />
                    </label>
                  </div>
                </section>
              )}

              {selectedEntry.source === 'google_sheets' && (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-emerald-950">Kết quả đối soát lớp</h3>
                    <Badge size="xs" variant={selectedEntry.matchMethod === 'direct' ? 'success' : selectedEntry.matchMethod === 'inferred' ? 'warning' : 'danger'}>
                      {selectedEntry.matchMethod === 'direct' ? 'Khớp trực tiếp' : selectedEntry.matchMethod === 'inferred' ? 'Khớp suy luận' : 'Chưa khớp'}
                    </Badge>
                    <span className="text-xs text-emerald-800">Độ tin cậy {selectedEntry.matchScore}</span>
                  </div>
                  <p className="mt-2 text-sm text-emerald-900">Mã nhập: <strong>{selectedEntry.inputClassCode || '—'}</strong> · Mã chuẩn hóa: <strong>{selectedEntry.normalizedClassCode || '—'}</strong></p>
                  {selectedEntry.matchReasons.length > 0 && <p className="mt-1 text-xs text-emerald-800">{selectedEntry.matchReasons.join(' · ')}</p>}
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center gap-2"><List className="size-4 text-gray-600" /><h3 className="text-sm font-semibold text-gray-900">Nội dung khảo sát</h3></div>
                {selectedEntry.answers.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="divide-y divide-gray-200 bg-white">
                      {selectedEntry.answers.map((answer) => (
                        <div key={answer.questionId} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.2fr)]">
                          <div>
                            {answer.group && <Badge variant="slate" size="xs" className="mb-1.5">{answer.group}</Badge>}
                            <p className="break-words text-sm font-medium text-gray-800">{answer.title}</p>
                            {answer.description && <p className="mt-1 text-xs text-gray-500">{answer.description}</p>}
                          </div>
                          <p className="break-words text-sm leading-6 text-gray-700">{answer.answer || <span className="italic text-gray-400">Chưa trả lời</span>}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <EmptyState title="Không có nội dung khảo sát" description="Nguồn dữ liệu không trả về câu hỏi và câu trả lời cho phiếu này." />}
              </section>

              {selectedEntry.source === 'lms' && (selectedEntry.comments.length > 0 || selectedEntry.attachments.length > 0) && (
                <section className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Bình luận</h3>
                    <div className="mt-2 space-y-2">
                      {selectedEntry.comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500"><span className="font-medium text-gray-700">{comment.userName || comment.userEmail}</span><span>{formatDate(comment.createdAt, true)}</span></div>
                          <p className="mt-2 break-words text-sm text-gray-700">{comment.message}</p>
                        </div>
                      ))}
                      {selectedEntry.comments.length === 0 && <p className="text-sm text-gray-500">Chưa có bình luận.</p>}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Tệp đính kèm</h3>
                    <div className="mt-2 space-y-2">
                      {selectedEntry.attachments.map((attachment) => (
                        <a key={attachment.fileUrl} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50">
                          <FileSpreadsheet className="size-4" /><span className="min-w-0 truncate">{attachment.fileName}</span>
                        </a>
                      ))}
                      {selectedEntry.attachments.length === 0 && <p className="text-sm text-gray-500">Không có tệp đính kèm.</p>}
                    </div>
                  </div>
                </section>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setSelectedEntry(null)}>Đóng</Button>
              {selectedEntry.source === 'lms' && <Button variant="mindx" loading={savingTicket} onClick={() => void saveTicket()}><Check className="size-4" />Lưu thay đổi</Button>}
            </ModalFooter>
          </>
        )}
      </Modal>

      <Modal open={showBulkModal} onClose={() => setShowBulkModal(false)} size="lg">
        <ModalHeader className="border-b border-gray-200">
          <div>
            <ModalTitle>Cập nhật {selectedIds.size} phiếu LMS</ModalTitle>
            <p className="mt-1 text-sm text-gray-500">Chỉ các trường đã chọn mới được thay đổi.</p>
          </div>
          <ModalClose onClick={() => setShowBulkModal(false)} />
        </ModalHeader>
        <ModalBody className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Trạng thái</span>
              <select value={bulkDraft.status} onChange={(event) => setBulkDraft((current) => ({ ...current, status: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                <option value="">Không thay đổi</option>
                {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Ưu tiên</span>
              <select value={bulkDraft.priority} onChange={(event) => setBulkDraft((current) => ({ ...current, priority: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                <option value="">Không thay đổi</option>
                {PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Chủ đề</span>
              <select value={bulkDraft.feedbackTopic} onChange={(event) => setBulkDraft((current) => ({ ...current, feedbackTopic: event.target.value }))} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#a1001f]">
                <option value="">Không thay đổi</option>
                {TOPIC_OPTIONS.map((topic) => <option key={topic}>{topic}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Người xử lý</span>
              <AssigneePicker
                query={bulkAssigneeQuery}
                onQueryChange={setBulkAssigneeQuery}
                selectedName={bulkDraft.assigneeName}
                enabled={showBulkModal}
                token={token}
                onSelect={(user) => {
                  setBulkDraft((current) => ({ ...current, assigneeId: user.id, assigneeName: user.displayName || user.username || user.email }))
                  setBulkAssigneeQuery('')
                }}
                onClear={() => setBulkDraft((current) => ({ ...current, assigneeId: '', assigneeName: '' }))}
              />
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowBulkModal(false)}>Hủy</Button>
          <Button variant="mindx" loading={savingBulk} onClick={() => void saveBulk()}><Check className="size-4" />Cập nhật</Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
