'use client'

import { PageContainer } from '@/components/PageContainer'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Eraser,
  Loader2,
  MinusCircle,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const SESSION_COUNT = 14

type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'EXCUSED'
  | 'NOT_RECORDED'

type ClassStatusFilter = 'ALL' | 'RUNNING' | 'PREPARING'

type Student = {
  id: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  imageUrl: string | null
  activeInClass: boolean
}

type StudentAttendance = {
  id: string | null
  status: string
  comment: string
  sendCommentStatus: string | null
  commentByAreas: Array<unknown>
  student: {
    id: string
    fullName: string
    phoneNumber: string | null
    email: string | null
    gender: string | null
    imageUrl: string | null
  }
}

type ClassSlot = {
  id: string
  sessionNumber: number
  date: string | null
  dateKey: string
  startTime: string | null
  endTime: string | null
  sessionHour: number | null
  summary: string
  homework: string
  teacherAttendance: Array<unknown>
  studentAttendance: StudentAttendance[]
  recordedCount: number
  studentsCount: number
}

type DisplaySlot = ClassSlot & {
  isPlaceholder?: boolean
}

type AttendanceClass = {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
  sessionCount: number
  numberOfSessions: number
  courseName: string
  courseShortName: string
  courseLineName: string
  centreName: string
  lecTeachers: string[]
  students: Student[]
  slots: ClassSlot[]
}

type AttendanceApiResponse = {
  success?: boolean
  noLmsToken?: boolean
  message?: string
  classes?: AttendanceClass[]
  meta?: {
    totalFetched?: number
    totalMatched?: number
    sessionCount?: number
  }
}

type DraftEntry = {
  status: AttendanceStatus
  note: string
  updatedAt: string
}

type DraftStore = Record<string, Record<string, Record<string, DraftEntry>>>

type AttendanceCellState = {
  status: AttendanceStatus
  lmsStatus: AttendanceStatus
  comment: string
  isDraft: boolean
  updatedAt?: string
}

type StatusMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  textClass: string
  dotClass: string
  cellClass: string
  buttonClass: string
  mutedClass: string
}

const STATUS_ORDER: AttendanceStatus[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'EXCUSED',
  'NOT_RECORDED',
]

const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  PRESENT: {
    label: 'Có mặt',
    shortLabel: 'Có',
    icon: CheckCircle2,
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500',
    cellClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    buttonClass: 'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-200',
    mutedClass: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  LATE: {
    label: 'Đi muộn',
    shortLabel: 'Muộn',
    icon: Clock,
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    cellClass: 'border-amber-200 bg-amber-50 text-amber-700',
    buttonClass: 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-200',
    mutedClass: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  ABSENT: {
    label: 'Vắng',
    shortLabel: 'Vắng',
    icon: XCircle,
    textClass: 'text-rose-700',
    dotClass: 'bg-rose-500',
    cellClass: 'border-rose-200 bg-rose-50 text-rose-700',
    buttonClass: 'border-rose-500 bg-rose-600 text-white shadow-sm shadow-rose-200',
    mutedClass: 'border-rose-100 bg-rose-50 text-rose-700',
  },
  EXCUSED: {
    label: 'Có phép',
    shortLabel: 'Phép',
    icon: ShieldCheck,
    textClass: 'text-sky-700',
    dotClass: 'bg-sky-500',
    cellClass: 'border-sky-200 bg-sky-50 text-sky-700',
    buttonClass: 'border-sky-500 bg-sky-600 text-white shadow-sm shadow-sky-200',
    mutedClass: 'border-sky-100 bg-sky-50 text-sky-700',
  },
  NOT_RECORDED: {
    label: 'Chưa ghi',
    shortLabel: 'Trống',
    icon: MinusCircle,
    textClass: 'text-gray-500',
    dotClass: 'bg-gray-300',
    cellClass: 'border-gray-200 bg-gray-50 text-gray-400',
    buttonClass: 'border-gray-400 bg-gray-700 text-white shadow-sm shadow-gray-200',
    mutedClass: 'border-gray-200 bg-gray-50 text-gray-500',
  },
}

const CLASS_FILTERS: Array<{ value: ClassStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'RUNNING', label: 'Đang học' },
  { value: 'PREPARING', label: 'Sắp mở' },
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

function normalizeAttendanceStatus(value: unknown): AttendanceStatus {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return 'NOT_RECORDED'
  if (raw.includes('LATE') || raw.includes('MUON')) return 'LATE'
  if (
    raw.includes('EXCUSED') ||
    raw.includes('PERMITTED') ||
    raw.includes('LEAVE') ||
    raw.includes('PHEP')
  ) {
    return 'EXCUSED'
  }
  if (
    raw.includes('ABSENT') ||
    raw.includes('MISSING') ||
    raw.includes('NO_SHOW') ||
    raw.includes('VANG')
  ) {
    return 'ABSENT'
  }
  if (
    raw.includes('PRESENT') ||
    raw.includes('ATTENDED') ||
    raw.includes('CHECKED') ||
    raw.includes('ON_TIME') ||
    raw.includes('DONE')
  ) {
    return 'PRESENT'
  }
  return 'NOT_RECORDED'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value)
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '--/--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? `${match[3]}/${match[2]}` : String(value)
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5)
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatTimeRange(slot: DisplaySlot): string {
  const start = formatTime(slot.startTime)
  const end = formatTime(slot.endTime)
  if (start && end) return `${start} - ${end}`
  return start || end || 'Chưa có giờ'
}

function formatSavedAt(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function classStatusLabel(status: string): string {
  const normalized = status.toUpperCase()
  if (normalized === 'RUNNING') return 'Đang học'
  if (normalized === 'PREPARING') return 'Sắp mở'
  if (normalized === 'FINISHED') return 'Đã kết thúc'
  return status || 'Không rõ'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'HV'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function buildDisplaySlots(cls: AttendanceClass): DisplaySlot[] {
  const slots: DisplaySlot[] = cls.slots.slice(0, SESSION_COUNT).map((slot, index) => ({
    ...slot,
    sessionNumber: index + 1,
  }))

  while (slots.length < SESSION_COUNT) {
    const sessionNumber = slots.length + 1
    slots.push({
      id: `draft-session-${cls.id}-${sessionNumber}`,
      sessionNumber,
      date: null,
      dateKey: '',
      startTime: null,
      endTime: null,
      sessionHour: null,
      summary: '',
      homework: '',
      teacherAttendance: [],
      studentAttendance: [],
      recordedCount: 0,
      studentsCount: cls.students.length,
      isPlaceholder: true,
    })
  }

  return slots
}

function findLmsAttendance(slot: DisplaySlot, studentId: string): StudentAttendance | undefined {
  return slot.studentAttendance.find((attendance) => attendance.student.id === studentId)
}

function getDraftEntry(
  drafts: DraftStore,
  classId: string,
  slotId: string,
  studentId: string,
): DraftEntry | undefined {
  return drafts[classId]?.[slotId]?.[studentId]
}

function getAttendanceState(
  drafts: DraftStore,
  classId: string,
  slot: DisplaySlot,
  student: Student,
): AttendanceCellState {
  const draft = getDraftEntry(drafts, classId, slot.id, student.id)
  const lmsAttendance = findLmsAttendance(slot, student.id)
  const lmsStatus = normalizeAttendanceStatus(lmsAttendance?.status)

  if (draft) {
    return {
      status: draft.status,
      lmsStatus,
      comment: draft.note || lmsAttendance?.comment || '',
      isDraft: true,
      updatedAt: draft.updatedAt,
    }
  }

  return {
    status: lmsStatus,
    lmsStatus,
    comment: lmsAttendance?.comment || '',
    isDraft: false,
  }
}

function countDraftEntries(drafts: DraftStore, classId?: string): number {
  const classDrafts = classId ? { [classId]: drafts[classId] } : drafts
  return Object.values(classDrafts).reduce((classTotal, slotDrafts) => {
    if (!slotDrafts) return classTotal
    return (
      classTotal +
      Object.values(slotDrafts).reduce(
        (slotTotal, studentDrafts) => slotTotal + Object.keys(studentDrafts).length,
        0,
      )
    )
  }, 0)
}

function getSessionSummary(
  cls: AttendanceClass,
  slot: DisplaySlot,
  drafts: DraftStore,
): Record<AttendanceStatus, number> {
  return cls.students.reduce(
    (summary, student) => {
      const state = getAttendanceState(drafts, cls.id, slot, student)
      summary[state.status] += 1
      return summary
    },
    {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
      NOT_RECORDED: 0,
    } as Record<AttendanceStatus, number>,
  )
}

function getClassProgress(cls: AttendanceClass, drafts: DraftStore) {
  const slots = buildDisplaySlots(cls)
  const totalCells = Math.max(cls.students.length * SESSION_COUNT, 0)
  const recordedCells = slots.reduce((slotTotal, slot) => {
    return (
      slotTotal +
      cls.students.filter((student) => {
        const state = getAttendanceState(drafts, cls.id, slot, student)
        return state.status !== 'NOT_RECORDED'
      }).length
    )
  }, 0)
  const sessionsWithRecords = slots.filter((slot) => {
    const summary = getSessionSummary(cls, slot, drafts)
    return summary.NOT_RECORDED < cls.students.length
  }).length
  const percent = totalCells > 0 ? Math.round((recordedCells / totalCells) * 100) : 0

  return {
    recordedCells,
    totalCells,
    sessionsWithRecords,
    percent,
  }
}

function ClassStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-bold',
        normalized === 'RUNNING'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : normalized === 'PREPARING'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-gray-200 bg-gray-50 text-gray-600',
      )}
    >
      {classStatusLabel(status)}
    </span>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-1 truncate text-xl font-black text-gray-950">{value}</p>
      </div>
    </div>
  )
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-black text-gray-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="h-9 w-2/3 animate-pulse rounded-lg bg-gray-100" />
        <div className="mt-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="h-20 w-32 shrink-0 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="mt-5 h-80 animate-pulse rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}

export default function TeacherAttendancePage() {
  const { token, user, isLoading: authLoading } = useAuth()
  const [classes, setClasses] = useState<AttendanceClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>('ALL')
  const [drafts, setDrafts] = useState<DraftStore>({})
  const [hasUnsavedDrafts, setHasUnsavedDrafts] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [noLmsToken, setNoLmsToken] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const storageKey = useMemo(
    () => `tps-attendance-drafts:v1:${user?.email || 'unknown'}`,
    [user?.email],
  )

  useEffect(() => {
    if (authLoading) return

    try {
      const raw = localStorage.getItem(storageKey)
      setDrafts(raw ? (JSON.parse(raw) as DraftStore) : {})
    } catch {
      setDrafts({})
    }
    setHasUnsavedDrafts(false)
    setLastSavedAt(null)
  }, [authLoading, storageKey])

  useEffect(() => {
    if (authLoading) return

    const controller = new AbortController()
    setIsLoading(true)
    setError('')
    setNoLmsToken(false)

    fetch('/api/user/diem-danh-lop-hoc', {
      cache: 'no-store',
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as AttendanceApiResponse

        if (payload?.noLmsToken) {
          setNoLmsToken(true)
          return []
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Không thể tải dữ liệu điểm danh từ LMS.')
        }

        return payload.classes || []
      })
      .then((nextClasses) => {
        setClasses(nextClasses)
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Không thể tải dữ liệu điểm danh từ LMS.',
        )
        setClasses([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [authLoading, refreshSignal, token])

  const filteredClasses = useMemo(() => {
    const query = normalizeText(search)
    return classes.filter((cls) => {
      const matchesStatus = statusFilter === 'ALL' || cls.status === statusFilter
      const searchable = normalizeText(
        [
          cls.name,
          cls.courseName,
          cls.courseShortName,
          cls.courseLineName,
          cls.centreName,
          cls.lecTeachers.join(' '),
        ].join(' '),
      )
      const matchesSearch = !query || searchable.includes(query)
      return matchesStatus && matchesSearch
    })
  }, [classes, search, statusFilter])

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedClassId('')
      return
    }

    setSelectedClassId((current) => {
      if (current && filteredClasses.some((cls) => cls.id === current)) return current
      return filteredClasses[0].id
    })
  }, [filteredClasses])

  useEffect(() => {
    setSelectedSessionIndex(0)
  }, [selectedClassId])

  const selectedClass = useMemo(
    () => filteredClasses.find((cls) => cls.id === selectedClassId) || null,
    [filteredClasses, selectedClassId],
  )

  const displaySlots = useMemo(
    () => (selectedClass ? buildDisplaySlots(selectedClass) : []),
    [selectedClass],
  )

  const selectedSlot = displaySlots[selectedSessionIndex] || displaySlots[0]

  const selectedSessionSummary = useMemo(() => {
    if (!selectedClass || !selectedSlot) return null
    return getSessionSummary(selectedClass, selectedSlot, drafts)
  }, [drafts, selectedClass, selectedSlot])

  const totalStudents = useMemo(
    () => classes.reduce((total, cls) => total + cls.students.length, 0),
    [classes],
  )

  const draftCount = useMemo(() => countDraftEntries(drafts), [drafts])

  const updateDraft = useCallback(
    (
      classId: string,
      slotId: string,
      studentId: string,
      nextPatch: Partial<Pick<DraftEntry, 'status' | 'note'>>,
    ) => {
      setDrafts((current) => {
        const currentEntry = current[classId]?.[slotId]?.[studentId]
        const nextEntry: DraftEntry = {
          status: nextPatch.status || currentEntry?.status || 'NOT_RECORDED',
          note: nextPatch.note ?? currentEntry?.note ?? '',
          updatedAt: new Date().toISOString(),
        }

        return {
          ...current,
          [classId]: {
            ...(current[classId] || {}),
            [slotId]: {
              ...(current[classId]?.[slotId] || {}),
              [studentId]: nextEntry,
            },
          },
        }
      })
      setHasUnsavedDrafts(true)
    },
    [],
  )

  const markAllPresent = useCallback(() => {
    if (!selectedClass || !selectedSlot) return
    const now = new Date().toISOString()
    setDrafts((current) => {
      const nextSlotDraft = { ...(current[selectedClass.id]?.[selectedSlot.id] || {}) }
      selectedClass.students.forEach((student) => {
        nextSlotDraft[student.id] = {
          status: 'PRESENT',
          note: nextSlotDraft[student.id]?.note || '',
          updatedAt: now,
        }
      })

      return {
        ...current,
        [selectedClass.id]: {
          ...(current[selectedClass.id] || {}),
          [selectedSlot.id]: nextSlotDraft,
        },
      }
    })
    setHasUnsavedDrafts(true)
    toast.success('Đã đánh dấu cả buổi là có mặt', {
      message: 'Thay đổi đang ở dạng nháp trên máy của bạn.',
    })
  }, [selectedClass, selectedSlot])

  const clearSessionDraft = useCallback(() => {
    if (!selectedClass || !selectedSlot) return
    setDrafts((current) => {
      const classDraft = current[selectedClass.id]
      if (!classDraft?.[selectedSlot.id]) return current

      const nextClassDraft = { ...classDraft }
      delete nextClassDraft[selectedSlot.id]
      const next = { ...current }

      if (Object.keys(nextClassDraft).length > 0) {
        next[selectedClass.id] = nextClassDraft
      } else {
        delete next[selectedClass.id]
      }

      return next
    })
    setHasUnsavedDrafts(true)
  }, [selectedClass, selectedSlot])

  const clearClassDraft = useCallback(() => {
    if (!selectedClass) return
    setDrafts((current) => {
      if (!current[selectedClass.id]) return current
      const next = { ...current }
      delete next[selectedClass.id]
      return next
    })
    setHasUnsavedDrafts(true)
  }, [selectedClass])

  const saveDrafts = useCallback(() => {
    localStorage.setItem(storageKey, JSON.stringify(drafts))
    const savedAt = new Date().toISOString()
    setLastSavedAt(savedAt)
    setHasUnsavedDrafts(false)
    toast.success('Đã lưu nháp điểm danh', {
      message: 'Nháp được lưu trong trình duyệt, chưa gửi lên LMS.',
    })
  }, [drafts, storageKey])

  const reloadData = useCallback(() => {
    setRefreshSignal((current) => current + 1)
  }, [])

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={reloadData}
        disabled={isLoading}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        Tải lại LMS
      </button>
      <button
        type="button"
        onClick={saveDrafts}
        disabled={draftCount === 0}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a1001f] px-3 text-sm font-bold text-white shadow-sm shadow-[#a1001f]/20 transition-colors hover:bg-[#87001a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
      >
        <Save className="h-4 w-4" />
        Lưu nháp
      </button>
    </div>
  )

  return (
    <PageContainer
      title="Điểm danh lớp học"
      description="Dữ liệu lớp và lịch buổi học được đọc từ LMS theo giáo viên LEC đang đăng nhập. Phần chỉnh sửa hiện lưu nháp để test giao diện."
      headerActions={headerActions}
      maxWidth="full"
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <StatTile
            icon={BookOpen}
            label="Lớp LEC"
            value={String(classes.length)}
            tone="bg-[#a1001f]/10 text-[#a1001f]"
          />
          <StatTile
            icon={Users}
            label="Học viên"
            value={String(totalStudents)}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatTile
            icon={CalendarDays}
            label="Số buổi"
            value={`${SESSION_COUNT} buổi`}
            tone="bg-sky-50 text-sky-700"
          />
          <StatTile
            icon={ClipboardCheck}
            label="Nháp test"
            value={`${draftCount} dòng`}
            tone={hasUnsavedDrafts ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}
          />
        </div>

        {lastSavedAt ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Nháp gần nhất: {formatSavedAt(lastSavedAt)}
          </div>
        ) : null}

        {authLoading || isLoading ? (
          <LoadingSkeleton />
        ) : noLmsToken ? (
          <EmptyPanel
            icon={AlertTriangle}
            title="Chưa có kết nối LMS"
            description="Tài khoản hiện tại chưa có token LMS trong phiên đăng nhập. Bạn hãy đăng nhập lại TPS bằng tài khoản đã đồng bộ LMS rồi thử tải lại."
            action={
              <button
                type="button"
                onClick={reloadData}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a1001f] px-4 text-sm font-bold text-white hover:bg-[#87001a]"
              >
                <RefreshCcw className="h-4 w-4" />
                Tải lại
              </button>
            }
          />
        ) : error ? (
          <EmptyPanel
            icon={AlertTriangle}
            title="Không tải được dữ liệu điểm danh"
            description={error}
            action={
              <button
                type="button"
                onClick={reloadData}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a1001f] px-4 text-sm font-bold text-white hover:bg-[#87001a]"
              >
                <RefreshCcw className="h-4 w-4" />
                Thử lại
              </button>
            }
          />
        ) : classes.length === 0 ? (
          <EmptyPanel
            icon={Search}
            title="Chưa tìm thấy lớp LEC"
            description="Trong khoảng dữ liệu LMS đang đọc, tài khoản này chưa có lớp RUNNING/PREPARING với vai trò LEC hoặc lịch điểm danh liên quan."
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm lớp, khóa học, cơ sở..."
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/10"
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
                  {CLASS_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn(
                        'h-8 rounded-md text-xs font-bold transition-colors',
                        statusFilter === filter.value
                          ? 'bg-white text-[#a1001f] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900',
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[calc(100vh-320px)] min-h-[280px] space-y-2 overflow-y-auto p-3 custom-scrollbar">
                {filteredClasses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                    Không có lớp phù hợp bộ lọc.
                  </div>
                ) : (
                  filteredClasses.map((cls) => {
                    const progress = getClassProgress(cls, drafts)
                    const active = cls.id === selectedClassId

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-[#a1001f] bg-[#fff6f8] shadow-sm ring-2 ring-[#a1001f]/10'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-black leading-5 text-gray-950">
                              {cls.name}
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                              {cls.courseShortName || cls.courseName || cls.courseLineName || 'Khóa học LMS'}
                            </p>
                          </div>
                          <ChevronRight
                            className={cn(
                              'mt-1 h-4 w-4 shrink-0',
                              active ? 'text-[#a1001f]' : 'text-gray-300',
                            )}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <ClassStatusBadge status={cls.status} />
                          {cls.centreName ? (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 text-[11px] font-bold text-gray-600">
                              <Building2 className="h-3 w-3" />
                              {cls.centreName}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-gray-500">
                          <span>{cls.students.length} học viên</span>
                          <span>{progress.sessionsWithRecords}/{SESSION_COUNT} buổi có dữ liệu</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-[#a1001f]"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            <main className="min-w-0 space-y-5">
              {selectedClass ? (
                <>
                  <section className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ClassStatusBadge status={selectedClass.status} />
                          <span className="inline-flex h-6 items-center rounded-full border border-gray-200 bg-gray-50 px-2 text-[11px] font-bold text-gray-600">
                            {selectedClass.students.length} học viên
                          </span>
                          <span className="inline-flex h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-2 text-[11px] font-bold text-sky-700">
                            {SESSION_COUNT} buổi
                          </span>
                        </div>
                        <h2 className="mt-3 text-2xl font-black leading-tight text-gray-950">
                          {selectedClass.name}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-gray-600">
                          <span>{selectedClass.courseName || selectedClass.courseShortName || 'Khóa học LMS'}</span>
                          {selectedClass.centreName ? <span>{selectedClass.centreName}</span> : null}
                          <span>
                            {formatDate(selectedClass.startDate)} - {formatDate(selectedClass.endDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={markAllPresent}
                          disabled={!selectedSlot || selectedClass.students.length === 0}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Tất cả có mặt
                        </button>
                        <button
                          type="button"
                          onClick={clearSessionDraft}
                          disabled={!selectedSlot || !drafts[selectedClass.id]?.[selectedSlot.id]}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Eraser className="h-4 w-4" />
                          Xóa nháp buổi
                        </button>
                        <button
                          type="button"
                          onClick={clearClassDraft}
                          disabled={!drafts[selectedClass.id]}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Eraser className="h-4 w-4" />
                          Xóa nháp lớp
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 overflow-x-auto pb-1 custom-scrollbar">
                      <div className="flex min-w-max gap-2">
                        {displaySlots.map((slot, index) => {
                          const summary = getSessionSummary(selectedClass, slot, drafts)
                          const recorded =
                            selectedClass.students.length - summary.NOT_RECORDED
                          const active = index === selectedSessionIndex

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSessionIndex(index)}
                              className={cn(
                                'h-24 w-[132px] shrink-0 rounded-xl border px-3 py-2 text-left transition-all',
                                active
                                  ? 'border-[#a1001f] bg-[#a1001f] text-white shadow-sm shadow-[#a1001f]/20'
                                  : slot.isPlaceholder
                                    ? 'border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:bg-white'
                                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-black">#{slot.sessionNumber}</span>
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                    active
                                      ? 'bg-white/20 text-white'
                                      : recorded === selectedClass.students.length
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600',
                                  )}
                                >
                                  {recorded}/{selectedClass.students.length}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-black leading-4">
                                {slot.isPlaceholder ? 'Chưa có lịch' : formatShortDate(slot.date || slot.startTime)}
                              </p>
                              <p
                                className={cn(
                                  'mt-1 line-clamp-1 text-[11px] font-semibold',
                                  active ? 'text-white/80' : 'text-gray-500',
                                )}
                              >
                                {slot.isPlaceholder ? 'Buổi nháp' : formatTimeRange(slot)}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Tổng quan 14 buổi
                        </p>
                        <h3 className="mt-1 text-lg font-black text-gray-950">
                          Ma trận điểm danh theo học viên
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_ORDER.map((status) => {
                          const meta = STATUS_META[status]
                          const Icon = meta.icon
                          return (
                            <span
                              key={status}
                              className={cn(
                                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold',
                                meta.mutedClass,
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 custom-scrollbar">
                      <table className="min-w-[1160px] w-full border-separate border-spacing-0 text-left text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                            <th className="sticky left-0 z-20 w-[230px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3">
                              Học viên
                            </th>
                            {displaySlots.map((slot, index) => (
                              <th
                                key={slot.id}
                                className={cn(
                                  'w-[66px] border-b border-gray-200 px-2 py-3 text-center',
                                  index === selectedSessionIndex && 'bg-[#fff1f3] text-[#a1001f]',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedSessionIndex(index)}
                                  className="mx-auto flex h-10 w-12 flex-col items-center justify-center rounded-md transition-colors hover:bg-white"
                                  title={`Chọn buổi ${slot.sessionNumber}`}
                                >
                                  <span>#{slot.sessionNumber}</span>
                                  <span className="text-[10px] normal-case tracking-normal text-gray-400">
                                    {slot.isPlaceholder ? '--/--' : formatShortDate(slot.date || slot.startTime)}
                                  </span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClass.students.map((student) => (
                            <tr key={student.id} className="odd:bg-white even:bg-gray-50/60">
                              <td className="sticky left-0 z-10 border-r border-gray-200 bg-inherit px-3 py-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#a1001f] text-xs font-black text-white">
                                    {student.imageUrl ? (
                                      <img
                                        src={student.imageUrl}
                                        alt={student.fullName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      getInitials(student.fullName)
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-gray-900">
                                      {student.fullName}
                                    </p>
                                    <p className="truncate text-[11px] font-medium text-gray-500">
                                      {student.phoneNumber || student.email || student.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {displaySlots.map((slot, index) => {
                                const state = getAttendanceState(drafts, selectedClass.id, slot, student)
                                const meta = STATUS_META[state.status]
                                const Icon = meta.icon

                                return (
                                  <td
                                    key={`${student.id}-${slot.id}`}
                                    className={cn(
                                      'border-b border-gray-100 px-2 py-2 text-center',
                                      index === selectedSessionIndex && 'bg-[#fff8fa]',
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSessionIndex(index)}
                                      title={`${student.fullName} - Buổi ${slot.sessionNumber}: ${meta.label}`}
                                      className={cn(
                                        'relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1',
                                        meta.cellClass,
                                      )}
                                    >
                                      <Icon className="h-4 w-4" />
                                      {state.isDraft ? (
                                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-[#a1001f]" />
                                      ) : null}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            Chi tiết buổi đang chọn
                          </p>
                          <h3 className="mt-1 text-lg font-black text-gray-950">
                            Buổi #{selectedSlot?.sessionNumber || 1}{' '}
                            <span className="text-gray-400">
                              {selectedSlot?.isPlaceholder
                                ? 'chưa có lịch LMS'
                                : `- ${formatDate(selectedSlot?.date || selectedSlot?.startTime)}`}
                            </span>
                          </h3>
                          <p className="mt-1 text-sm font-medium text-gray-500">
                            {selectedSlot?.isPlaceholder
                              ? 'Bạn vẫn có thể nhập nháp để test giao diện trước khi có slot LMS.'
                              : formatTimeRange(selectedSlot)}
                          </p>
                        </div>

                        {selectedSessionSummary ? (
                          <div className="flex flex-wrap gap-2">
                            {STATUS_ORDER.map((status) => {
                              const meta = STATUS_META[status]
                              const Icon = meta.icon
                              return (
                                <span
                                  key={status}
                                  className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black',
                                    meta.mutedClass,
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {selectedSessionSummary[status]}
                                </span>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {selectedClass.students.map((student) => {
                        const state = selectedSlot
                          ? getAttendanceState(drafts, selectedClass.id, selectedSlot, student)
                          : null
                        const lmsMeta = STATUS_META[state?.lmsStatus || 'NOT_RECORDED']

                        return (
                          <div
                            key={student.id}
                            className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(420px,1.5fr)_minmax(220px,0.8fr)] lg:items-center"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#a1001f] text-sm font-black text-white">
                                {student.imageUrl ? (
                                  <img
                                    src={student.imageUrl}
                                    alt={student.fullName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getInitials(student.fullName)
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-gray-950">
                                  {student.fullName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold',
                                      lmsMeta.mutedClass,
                                    )}
                                  >
                                    LMS: {lmsMeta.shortLabel}
                                  </span>
                                  {state?.isDraft ? (
                                    <span className="inline-flex h-6 items-center rounded-full border border-[#a1001f]/20 bg-[#fff1f3] px-2 text-[11px] font-bold text-[#a1001f]">
                                      Nháp
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {STATUS_ORDER.map((status) => {
                                const meta = STATUS_META[status]
                                const Icon = meta.icon
                                const active = state?.status === status

                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => {
                                      if (!selectedSlot) return
                                      updateDraft(selectedClass.id, selectedSlot.id, student.id, {
                                        status,
                                      })
                                    }}
                                    className={cn(
                                      'inline-flex h-9 min-w-[86px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-1',
                                      active
                                        ? meta.buttonClass
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                                    )}
                                  >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    <span>{meta.label}</span>
                                  </button>
                                )
                              })}
                            </div>

                            <div>
                              <input
                                value={state?.comment || ''}
                                onChange={(event) => {
                                  if (!selectedSlot) return
                                  updateDraft(selectedClass.id, selectedSlot.id, student.id, {
                                    note: event.target.value,
                                  })
                                }}
                                placeholder="Ghi chú buổi học..."
                                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/10"
                              />
                              {state?.updatedAt ? (
                                <p className="mt-1 text-[11px] font-semibold text-gray-400">
                                  Sửa nháp: {formatSavedAt(state.updatedAt)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              ) : (
                <EmptyPanel
                  icon={Search}
                  title="Chọn một lớp để điểm danh"
                  description="Danh sách bên trái sẽ hiện những lớp LMS mà giáo viên đang là LEC. Hãy chọn lớp để xem 14 buổi và trạng thái từng học viên."
                />
              )}
            </main>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
