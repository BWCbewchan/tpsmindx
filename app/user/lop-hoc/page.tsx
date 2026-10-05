'use client'

import { PageContainer } from '@/components/PageContainer'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  MessageSquareText,
  MoreVertical,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const SESSION_COUNT = 14
const PAGE_SIZE = 20

type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'EXCUSED'
  | 'NOT_RECORDED'

type TeacherAccount = {
  id: string
  fullName: string
  email: string
  username: string
  code: string
  roleShortName: string
  roleName: string
}

type Student = {
  id: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  gender: string | null
  customer?: CustomerInfo | null
  imageUrl: string | null
  activeInClass: boolean
}

type CustomerInfo = {
  fullName?: string | null
  phoneNumber?: string | null
  email?: string | null
  facebook?: string | null
  zalo?: string | null
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
    customer?: CustomerInfo | null
  }
}

type TeacherAttendance = {
  _id?: string | null
  status?: string | null
  note?: string | null
  teacher?: {
    id?: string | null
    fullName?: string | null
    email?: string | null
    username?: string | null
    code?: string | null
    imageUrl?: string | null
  } | null
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
  teacherAttendance: TeacherAttendance[]
  teachers: TeacherAccount[]
  studentAttendance: StudentAttendance[]
  recordedCount: number
  studentsCount: number
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
  progressSession?: number
  progressTotal?: number
  operationMethodName: string
  operatorName: string
  centreId: string | null
  centreName: string
  centreShortName: string
  courseName: string
  courseShortName: string
  courseLineName: string
  classTeachers: TeacherAccount[]
  slotTeachers: TeacherAccount[]
  allTeachers: TeacherAccount[]
  allTeacherNames: string[]
  lecTeachers: string[]
  accessRoles: string[]
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

type FiltersState = {
  search: string
  centre: string
  startDate: string
  endDate: string
  slotFrom: string
  slotTo: string
  status: string
  teacher: string
}

type SelectOption = {
  value: string
  label: string
}

const INITIAL_FILTERS: FiltersState = {
  search: '',
  centre: '',
  startDate: '',
  endDate: '',
  slotFrom: '',
  slotTo: '',
  status: '',
  teacher: '',
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

function dateKey(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function compareDateKey(a: string, b: string): number {
  if (!a || !b) return 0
  return a.localeCompare(b)
}

function formatDate(value: string | null | undefined): string {
  const key = dateKey(value)
  if (!key) return '-'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
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

function weekDayName(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
  }).format(date)
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

function classStatusLabel(status: string): string {
  const normalized = status.toUpperCase()
  if (normalized === 'RUNNING') return 'Running'
  if (normalized === 'PREPARING') return 'Preparing'
  if (normalized === 'FINISHED') return 'Finished'
  if (normalized === 'CANCELLED') return 'Cancelled'
  return status || 'Unknown'
}

function classStatusTextClass(status: string): string {
  const normalized = status.toUpperCase()
  if (normalized === 'RUNNING') return 'text-green-700'
  if (normalized === 'PREPARING') return 'text-amber-700'
  if (normalized === 'FINISHED') return 'text-blue-700'
  if (normalized === 'CANCELLED') return 'text-rose-700'
  return 'text-gray-600'
}

function normalizeAttendanceStatus(value: unknown): AttendanceStatus {
  const raw = String(value ?? '').trim()
  if (!raw) return 'NOT_RECORDED'
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()

  if (normalized.includes('LATE') || normalized.includes('MUON')) return 'LATE'
  if (
    normalized.includes('WITH_NOTICE') ||
    normalized.includes('NOTICE') ||
    normalized.includes('EXCUSED') ||
    normalized.includes('PERMITTED') ||
    normalized.includes('PERMISSION') ||
    normalized.includes('AUTHORIZED') ||
    normalized.includes('LEAVE') ||
    normalized.includes('PHEP')
  ) {
    return 'EXCUSED'
  }
  if (
    normalized.includes('ABSENT') ||
    normalized.includes('MISSING') ||
    normalized.includes('NO_SHOW') ||
    normalized.includes('UNEXCUSED') ||
    normalized.includes('VANG')
  ) {
    return 'ABSENT'
  }
  if (
    normalized.includes('PRESENT') ||
    normalized.includes('ATTENDED') ||
    normalized.includes('CHECKED') ||
    normalized.includes('ON_TIME') ||
    normalized.includes('DONE') ||
    normalized.includes('CO MAT') ||
    normalized.includes('DUNG GIO')
  ) {
    return 'PRESENT'
  }
  return 'NOT_RECORDED'
}

function formatShortDate(value: string | null | undefined): string {
  const key = dateKey(value)
  if (!key) return '--/--'
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

function formatShortDateWithYear(value: string | null | undefined): string {
  const key = dateKey(value)
  if (!key) return '--/--/--'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year.slice(-2)}`
}

function formatTimeRange(slot: ClassSlot): string {
  const start = formatTime(slot.startTime)
  const end = formatTime(slot.endTime)
  if (start && end) return `${start}-${end}`
  return start || end || ''
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'HV'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function buildDisplaySlots(cls: AttendanceClass): ClassSlot[] {
  const slots = cls.slots.slice(0, SESSION_COUNT).map((slot, index) => ({
    ...slot,
    sessionNumber: index + 1,
  }))

  while (slots.length < SESSION_COUNT) {
    const sessionNumber = slots.length + 1
    slots.push({
      id: `placeholder-${cls.id}-${sessionNumber}`,
      sessionNumber,
      date: null,
      dateKey: '',
      startTime: null,
      endTime: null,
      sessionHour: null,
      summary: '',
      homework: '',
      teacherAttendance: [],
      teachers: [],
      studentAttendance: [],
      recordedCount: 0,
      studentsCount: cls.students.length,
      isPlaceholder: true,
    })
  }

  return slots
}

function teacherName(teacher: TeacherAccount): string {
  return teacher.fullName || teacher.username || teacher.email || teacher.code || 'Giảng viên'
}

function teacherAttendanceName(attendance: TeacherAttendance): string {
  return (
    String(attendance.teacher?.fullName || '').trim() ||
    String(attendance.teacher?.username || '').trim() ||
    String(attendance.teacher?.email || '').trim() ||
    String(attendance.teacher?.code || '').trim() ||
    'Giảng viên'
  )
}

function attendanceKey(classId: string, slotId: string, personId: string): string {
  return `${classId}:${slotId}:${personId}`
}

function findAttendance(slot: ClassSlot, studentId: string): StudentAttendance | undefined {
  return slot.studentAttendance.find((attendance) => attendance.student.id === studentId)
}

function studentStatus(slot: ClassSlot, studentId: string): AttendanceStatus {
  return normalizeAttendanceStatus(findAttendance(slot, studentId)?.status)
}

function studentInfoForTooltip(cls: AttendanceClass, student: Student) {
  const attendanceStudent = cls.slots
    .flatMap((slot) => slot.studentAttendance)
    .find((attendance) => attendance.student.id === student.id)?.student
  const customer = attendanceStudent?.customer || student.customer || null

  return {
    fullName: attendanceStudent?.fullName || student.fullName,
    phoneNumber: attendanceStudent?.phoneNumber || student.phoneNumber || '-',
    email: attendanceStudent?.email || student.email || '-',
    gender: attendanceStudent?.gender || student.gender || '-',
    customerName: customer?.fullName || '-',
    customerPhone: customer?.phoneNumber || customer?.zalo || '-',
    customerEmail: customer?.email || customer?.facebook || '-',
    imageUrl: attendanceStudent?.imageUrl || student.imageUrl || '',
  }
}

function teacherRowsForClass(cls: AttendanceClass) {
  const rows = new Map<string, {
    id: string
    fullName: string
    email: string
    imageUrl: string | null
  }>()

  cls.allTeachers.forEach((teacher) => {
    const name = teacherName(teacher)
    const key = teacher.id || teacher.email || teacher.username || name
    rows.set(key, {
      id: key,
      fullName: name,
      email: teacher.email,
      imageUrl: null,
    })
  })

  cls.slots.flatMap((slot) => slot.teacherAttendance).forEach((attendance, index) => {
    const name = teacherAttendanceName(attendance)
    const key = String(attendance.teacher?.id || attendance.teacher?.email || attendance._id || `${name}-${index}`)
    rows.set(key, {
      id: key,
      fullName: name,
      email: String(attendance.teacher?.email || ''),
      imageUrl: attendance.teacher?.imageUrl || null,
    })
  })

  return Array.from(rows.values())
}

function teacherStatus(slot: ClassSlot, teacherId: string, teacherEmail: string): AttendanceStatus {
  const attendance = slot.teacherAttendance.find((item) => {
    const currentId = String(item.teacher?.id || item._id || '')
    const currentEmail = String(item.teacher?.email || '').toLowerCase()
    return (teacherId && currentId === teacherId) || (teacherEmail && currentEmail === teacherEmail.toLowerCase())
  })

  return normalizeAttendanceStatus(attendance?.status)
}

const ATTENDANCE_META: Record<AttendanceStatus, {
  label: string
  icon: LucideIcon
  colorClass: string
  activeClass: string
}> = {
  PRESENT: {
    label: 'Có mặt đúng giờ',
    icon: Check,
    colorClass: 'text-emerald-600',
    activeClass: 'text-emerald-600 bg-emerald-50',
  },
  LATE: {
    label: 'Đi muộn',
    icon: Clock,
    colorClass: 'text-amber-600',
    activeClass: 'text-amber-600 bg-amber-50',
  },
  EXCUSED: {
    label: 'Vắng có phép',
    icon: ShieldCheck,
    colorClass: 'text-orange-500',
    activeClass: 'text-orange-600 bg-orange-50',
  },
  ABSENT: {
    label: 'Vắng không phép',
    icon: X,
    colorClass: 'text-gray-600',
    activeClass: 'text-rose-600 bg-rose-50',
  },
  NOT_RECORDED: {
    label: 'Chưa ghi nhận',
    icon: X,
    colorClass: 'text-blue-500',
    activeClass: 'text-blue-500 bg-blue-50',
  },
}

function AttendanceMark({ status, className }: { status: AttendanceStatus; className?: string }) {
  if (status === 'NOT_RECORDED') {
    return <span className={cn('text-lg font-semibold leading-none text-blue-500', className)}>–</span>
  }

  const meta = ATTENDANCE_META[status]
  const Icon = meta.icon
  return <Icon className={cn('h-5 w-5', meta.colorClass, className)} />
}

function StatusControls({
  value,
  onChange,
  hasComment,
}: {
  value: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
  hasComment?: boolean
}) {
  const actions: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']

  return (
    <div className="flex items-center justify-center gap-2">
      {actions.map((status) => {
        const meta = ATTENDANCE_META[status]
        const Icon = meta.icon
        const active = value === status
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            title={meta.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156d4]',
              active ? meta.activeClass : 'text-gray-500',
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        )
      })}
      <MessageSquareText
        title={hasComment ? 'Có nhận xét' : 'Chưa có nhận xét'}
        className={cn('h-5 w-5', hasComment ? 'text-orange-500' : 'text-gray-500')}
      />
      <MoreVertical className="h-5 w-5 text-gray-500" />
    </div>
  )
}

function scheduleText(cls: AttendanceClass): string {
  const entries = cls.slots
    .filter((slot) => slot.startTime || slot.date)
    .map((slot) => {
      const weekday = weekDayName(slot.date || slot.startTime)
      const start = formatTime(slot.startTime)
      const end = formatTime(slot.endTime)
      const time = start && end ? `${start}-${end}` : start || end
      return [weekday, time].filter(Boolean).join(' ')
    })
    .filter(Boolean)

  const unique = Array.from(new Set(entries))
  if (unique.length === 0) return '-'
  return unique.slice(0, 2).join(', ') + (unique.length > 2 ? ` +${unique.length - 2}` : '')
}

function classProgress(cls: AttendanceClass): { done: number; total: number; percent: number } {
  const total = Number(cls.progressTotal || cls.numberOfSessions || cls.sessionCount || SESSION_COUNT) || SESSION_COUNT
  const pastSlotCount = cls.slots.filter((slot) => {
    const key = dateKey(slot.startTime || slot.date)
    return key && compareDateKey(key, dateKey(new Date().toISOString())) <= 0
  }).length
  const fallbackDone = cls.slots.length === 0
    ? 0
    : cls.status === 'FINISHED'
    ? Math.min(cls.slots.length || total, total)
    : Math.min(pastSlotCount + 1, total)
  const done = Math.min(Number(cls.progressSession || fallbackDone) || 0, total)
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  }
}

function hasSlotInRange(cls: AttendanceClass, from: string, to: string): boolean {
  if (!from && !to) return true
  return cls.slots.some((slot) => {
    const key = dateKey(slot.date || slot.startTime)
    if (!key) return false
    if (from && compareDateKey(key, from) < 0) return false
    if (to && compareDateKey(key, to) > 0) return false
    return true
  })
}

function optionKey(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-')
}

function buildOptions(values: string[], allLabel: string): SelectOption[] {
  const seen = new Set<string>()
  const options = values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = optionKey(value)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((value) => ({ value, label: value }))

  return [{ value: '', label: allLabel }, ...options]
}

function HeaderButton({
  icon: Icon,
  children,
  onClick,
  disabled,
}: {
  icon: LucideIcon
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon className={cn('h-4 w-4', disabled && Icon === RefreshCcw && 'animate-spin')} />
      {children}
    </button>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
    >
      {options.map((option) => (
        <option key={`${option.value}-${option.label}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function SearchableSelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.value === value)
  const normalizedQuery = normalizeText(query)
  const visibleOptions = options.filter((option) => {
    if (!normalizedQuery) return true
    return normalizeText(option.label).includes(normalizedQuery)
  })

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <input
        value={open ? query : selectedOption?.label || ''}
        onFocus={() => {
          setOpen(true)
          setQuery(selectedOption?.value ? selectedOption.label : '')
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 pr-9 text-sm font-normal text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  setQuery('')
                }}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#eef3ff]',
                  option.value === value ? 'bg-[#dbe7ff] font-medium text-gray-950' : 'font-normal text-gray-800',
                )}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">Không có giảng viên phù hợp</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
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
        <p className="mt-1 truncate text-xl font-semibold text-gray-950">{value}</p>
      </div>
    </div>
  )
}

function LoadingTable() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

function StudentIdentity({
  cls,
  student,
}: {
  cls: AttendanceClass
  student: Student
}) {
  const info = studentInfoForTooltip(cls, student)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number
    top: number
    side: 'left' | 'right'
  } | null>(null)

  function showTooltip() {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = 360
    const height = 430
    const gap = 12
    const padding = 16
    const canOpenRight = rect.right + gap + width <= window.innerWidth - padding
    const left = canOpenRight
      ? rect.right + gap
      : Math.max(padding, rect.left - width - gap)
    const top = Math.min(
      Math.max(rect.top + rect.height / 2, height / 2 + padding),
      window.innerHeight - height / 2 - padding,
    )

    setTooltipPosition({
      left,
      top,
      side: canOpenRight ? 'right' : 'left',
    })
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onMouseEnter={showTooltip}
      onFocus={showTooltip}
      onMouseLeave={() => setTooltipPosition(null)}
      onBlur={() => setTooltipPosition(null)}
      className="flex min-w-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3156d4]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs font-semibold text-white">
        {info.imageUrl ? (
          <img src={info.imageUrl} alt={info.fullName} className="h-full w-full object-cover" />
        ) : (
          getInitials(info.fullName)
        )}
      </div>
      <span className="truncate text-sm font-normal text-gray-900">{student.fullName}</span>

      {tooltipPosition ? (
        <div
          className="pointer-events-none fixed z-[80] w-[360px] -translate-y-1/2 rounded-sm bg-[#202020] p-5 text-white shadow-2xl"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          <span
            className={cn(
              'absolute top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-[#202020]',
              tooltipPosition.side === 'right' ? '-left-2' : '-right-2',
            )}
          />
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full bg-gray-500">
            {info.imageUrl ? (
              <img src={info.imageUrl} alt={info.fullName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold">
                {getInitials(info.fullName)}
              </div>
            )}
          </div>
          <h4 className="mt-4 text-center text-base font-semibold">Thông tin học viên</h4>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Họ tên</dt>
              <dd className="min-w-0 break-words font-semibold">: {info.fullName}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Ngày sinh</dt>
              <dd className="font-semibold">: -</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Giới tính</dt>
              <dd className="font-semibold">: {info.gender}</dd>
            </div>
          </dl>
          <h4 className="mt-5 text-center text-base font-semibold">Thông tin phụ huynh/khách hàng</h4>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Họ tên</dt>
              <dd className="min-w-0 break-words font-semibold">: {info.customerName}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Số điện thoại</dt>
              <dd className="min-w-0 break-words font-semibold">: {info.customerPhone}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-semibold">Email</dt>
              <dd className="min-w-0 break-words font-semibold">: {info.customerEmail}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function ClassAttendanceDrawer({
  cls,
  onClose,
  onRefresh,
}: {
  cls: AttendanceClass | null
  onClose: () => void
  onRefresh: () => void
}) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'comments'>('attendance')
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null)
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [showUpdateNote, setShowUpdateNote] = useState(true)

  useEffect(() => {
    setActiveTab('attendance')
    setSelectedSessionIndex(null)
    setDraftStatuses({})
    setShowUpdateNote(true)
  }, [cls?.id])

  if (!cls) return null

  const slots = buildDisplaySlots(cls)
  const selectedSlot = selectedSessionIndex === null ? null : slots[selectedSessionIndex] || null
  const teacherRows = teacherRowsForClass(cls)
  const teacherRecorded = selectedSlot ? teacherRows.filter((teacher) => {
    const status = selectedSlot ? teacherStatus(selectedSlot, teacher.id, teacher.email) : 'NOT_RECORDED'
    return status !== 'NOT_RECORDED'
  }).length : 0
  const studentRecorded = selectedSlot
    ? cls.students.filter((student) => {
        const key = attendanceKey(cls.id, selectedSlot.id, student.id)
        const status = draftStatuses[key] || studentStatus(selectedSlot, student.id)
        return status !== 'NOT_RECORDED'
      }).length
    : 0

  function setDraft(slot: ClassSlot, personId: string, status: AttendanceStatus) {
    setDraftStatuses((current) => ({
      ...current,
      [attendanceKey(cls.id, slot.id, personId)]: status,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/45">
      <button type="button" className="hidden flex-1 cursor-default md:block" aria-label="Đóng chi tiết lớp" onClick={onClose} />
      <aside className="ml-auto flex h-full w-full flex-col bg-white shadow-2xl md:w-[min(1180px,calc(100vw-280px))]">
        <header className="shrink-0 border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-gray-950">{cls.name}</h2>
                <span className={cn('text-sm font-medium', classStatusTextClass(cls.status))}>
                  {classStatusLabel(cls.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-700">
                <span>{cls.operatorName || cls.allTeacherNames[0] || 'Chưa có phụ trách'}</span>
                <span className="inline-flex h-9 min-w-[210px] items-center justify-between border border-gray-300 px-3 text-gray-600">
                  Default
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-950"
                title="Làm mới"
              >
                <RefreshCcw className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-950"
                title="Đóng"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <nav className="mt-5 flex gap-6 border-b border-gray-200 text-sm font-semibold text-gray-500">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={cn(
                'pb-3 transition-colors',
                activeTab === 'attendance'
                  ? 'border-b-2 border-[#4556d6] text-[#4556d6]'
                  : 'border-b-2 border-transparent hover:text-gray-900',
              )}
            >
              Điểm danh
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={cn(
                'pb-3 transition-colors',
                activeTab === 'comments'
                  ? 'border-b-2 border-[#4556d6] text-[#4556d6]'
                  : 'border-b-2 border-transparent hover:text-gray-900',
              )}
            >
              Nhận xét
            </button>
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {activeTab === 'comments' ? (
            <div className="flex min-h-[360px] items-center justify-center border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
              Mục nhận xét sẽ được hoàn thiện sau phần điểm danh.
            </div>
          ) : (
            <>
          {showUpdateNote ? (
            <div className="relative mb-4 bg-gray-100 px-3 py-3 text-sm text-gray-950">
              <button
                type="button"
                onClick={() => setShowUpdateNote(false)}
                className="absolute right-3 top-3 text-gray-600 hover:text-gray-950"
                title="Ẩn thông báo"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="pr-8 text-base font-normal">Không thể cập nhật điểm danh vì những lý do sau:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>User không phải là giảng viên được phân công dạy slot hiện tại</li>
                <li>User không phải là vận hành của lớp</li>
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1060px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-[210px] bg-white px-0 py-2" />
                  {slots.map((slot, index) => {
                    const active = index === selectedSessionIndex
                    return (
                      <th key={slot.id} className={cn('px-1 py-2 text-center', active ? 'w-[220px]' : 'w-[96px]')}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!slot.isPlaceholder) setSelectedSessionIndex(index)
                          }}
                          disabled={slot.isPlaceholder}
                          className={cn(
                            'h-[54px] w-full border-0 px-3 py-1 text-center transition-colors',
                            active
                              ? 'bg-[#1300ff] text-white'
                              : slot.isPlaceholder
                                ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200',
                          )}
                        >
                          <span className="block text-sm font-semibold">#{slot.sessionNumber}</span>
                          <span className={cn('mt-1 block truncate text-xs font-semibold', active ? 'text-white' : 'text-gray-500')}>
                            {slot.isPlaceholder
                              ? '--/--'
                              : `${formatTime(slot.startTime) ? `${formatTime(slot.startTime)} ` : ''}${formatShortDateWithYear(slot.date || slot.startTime)}`}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {teacherRows.map((teacher, teacherIndex) => (
                  <tr key={teacher.id}>
                    <td className="sticky left-0 z-10 bg-white px-0 py-3 align-middle">
                      {teacherIndex === 0 ? (
                        <div className="mb-4 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-950">Kiểm tra giáo viên</h3>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b6fd8] text-sm font-semibold text-white">1</span>
                          </div>
                          <p className="text-sm font-semibold text-green-700">
                            {selectedSlot ? `${teacherRecorded}/${teacherRows.length} Đã ghi nhận` : 'Chưa chọn buổi'}
                          </p>
                        </div>
                      ) : null}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs font-semibold text-white">
                          {teacher.imageUrl ? (
                            <img src={teacher.imageUrl} alt={teacher.fullName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(teacher.fullName)
                          )}
                        </div>
                        <span className="truncate text-sm font-normal text-gray-900">{teacher.fullName}</span>
                      </div>
                    </td>
                    {slots.map((slot, index) => {
                      const key = attendanceKey(cls.id, slot.id, teacher.id)
                      const status = draftStatuses[key] || teacherStatus(slot, teacher.id, teacher.email)
                      return (
                        <td key={`${teacher.id}-${slot.id}`} className="px-1 py-3 text-center align-middle">
                          {index === selectedSessionIndex ? (
                            <StatusControls value={status} onChange={(nextStatus) => setDraft(slot, teacher.id, nextStatus)} />
                          ) : (
                            <div className="flex h-8 items-center justify-center">
                              <AttendanceMark status={status} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {cls.students.map((student, studentIndex) => (
                  <tr key={student.id}>
                    <td className="sticky left-0 z-10 bg-white px-0 py-3 align-middle">
                      {studentIndex === 0 ? (
                        <div className="mb-4 mt-5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-950">Kiểm tra học viên</h3>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b6fd8] text-sm font-semibold text-white">2</span>
                          </div>
                          <p className="text-sm font-semibold text-green-700">
                            {selectedSlot ? `${studentRecorded}/${cls.students.length} Đã ghi nhận` : 'Chưa chọn buổi'}
                          </p>
                        </div>
                      ) : null}
                      <StudentIdentity cls={cls} student={student} />
                    </td>
                    {slots.map((slot, index) => {
                      const attendance = findAttendance(slot, student.id)
                      const key = attendanceKey(cls.id, slot.id, student.id)
                      const status = draftStatuses[key] || studentStatus(slot, student.id)
                      return (
                        <td key={`${student.id}-${slot.id}`} className="px-1 py-3 text-center align-middle">
                          {index === selectedSessionIndex ? (
                            <StatusControls
                              value={status}
                              hasComment={Boolean(attendance?.comment)}
                              onChange={(nextStatus) => setDraft(slot, student.id, nextStatus)}
                            />
                          ) : (
                            <div className="flex h-8 items-center justify-center">
                              <AttendanceMark status={status} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default function TeacherClassesPage() {
  const { token, isLoading: authLoading } = useAuth()
  const [classes, setClasses] = useState<AttendanceClass[]>([])
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [noLmsToken, setNoLmsToken] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)

  const loadClasses = useCallback(() => {
    setRefreshSignal((current) => current + 1)
  }, [])

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
          throw new Error(payload?.message || 'Không thể tải danh sách lớp từ LMS.')
        }
        return payload.classes || []
      })
      .then((nextClasses) => setClasses(nextClasses))
      .catch((fetchError) => {
        if (controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách lớp từ LMS.')
        setClasses([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [authLoading, refreshSignal, token])

  const centreOptions = useMemo(
    () => buildOptions(classes.map((cls) => cls.centreShortName || cls.centreName), 'Tất cả cơ sở'),
    [classes],
  )

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...Array.from(new Set(classes.map((cls) => cls.status).filter(Boolean)))
        .sort()
        .map((status) => ({ value: status, label: classStatusLabel(status) })),
    ],
    [classes],
  )

  const teacherOptions = useMemo(
    () =>
      buildOptions(
        classes.flatMap((cls) => cls.allTeachers.map(teacherName)),
        'Tất cả giảng viên',
      ),
    [classes],
  )

  const filteredClasses = useMemo(() => {
    const query = normalizeText(filters.search)
    const teacherQuery = normalizeText(filters.teacher)
    const centreQuery = normalizeText(filters.centre)

    return classes.filter((cls) => {
      const searchText = normalizeText(
        [
          cls.name,
          cls.courseName,
          cls.courseShortName,
          cls.courseLineName,
          cls.centreName,
          cls.centreShortName,
          cls.operationMethodName,
          cls.operatorName,
          cls.allTeacherNames.join(' '),
        ].join(' '),
      )

      if (query && !searchText.includes(query)) return false
      if (
        filters.centre &&
        ![cls.centreName, cls.centreShortName, String(cls.centreId || '')]
          .map(normalizeText)
          .some((value) => value === centreQuery || value.includes(centreQuery))
      ) {
        return false
      }
      if (filters.status && cls.status !== filters.status) return false
      if (
        filters.teacher &&
        !cls.allTeachers.some((teacher) => normalizeText(teacherName(teacher)).includes(teacherQuery))
      ) {
        return false
      }
      const start = dateKey(cls.startDate)
      if (filters.startDate && (!start || compareDateKey(start, filters.startDate) < 0)) return false
      const end = dateKey(cls.endDate)
      if (filters.endDate && (!end || compareDateKey(end, filters.endDate) > 0)) return false
      if (!hasSlotInRange(cls, filters.slotFrom, filters.slotTo)) return false

      return true
    })
  }, [classes, filters])

  const totalStudents = useMemo(
    () => filteredClasses.reduce((total, cls) => total + cls.students.length, 0),
    [filteredClasses],
  )

  const runningCount = useMemo(
    () => filteredClasses.filter((cls) => cls.status === 'RUNNING').length,
    [filteredClasses],
  )

  const centreCount = useMemo(
    () => new Set(filteredClasses.map((cls) => cls.centreShortName || cls.centreName).filter(Boolean)).size,
    [filteredClasses],
  )

  const hasActiveFilters = Object.values(filters).some(Boolean)
  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedClasses = useMemo(
    () => filteredClasses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredClasses, safePage],
  )
  const startRow = filteredClasses.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(safePage * PAGE_SIZE, filteredClasses.length)
  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId) || null,
    [classes, selectedClassId],
  )

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (selectedClassId || classes.length === 0) return
    const classIdFromUrl = new URLSearchParams(window.location.search).get('classId')
    if (classIdFromUrl && classes.some((cls) => cls.id === classIdFromUrl)) {
      setSelectedClassId(classIdFromUrl)
    }
  }, [classes, selectedClassId])

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setPage(1)
    setFilters(INITIAL_FILTERS)
  }

  const headerActions = (
    <div className="flex flex-wrap justify-end gap-2">
      <HeaderButton icon={RefreshCcw} onClick={loadClasses} disabled={isLoading}>
        Làm mới
      </HeaderButton>
      <HeaderButton icon={RotateCcw} onClick={clearFilters} disabled={!hasActiveFilters}>
        Xóa lọc
      </HeaderButton>
    </div>
  )

  return (
    <PageContainer
      title="Lớp học"
      description="Danh sách lớp LMS có dữ liệu giảng dạy hoặc điểm danh của giáo viên hiện tại."
      headerActions={headerActions}
      maxWidth="full"
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <StatTile icon={BookOpen} label="Lớp hiển thị" value={String(filteredClasses.length)} tone="bg-[#a1001f]/10 text-[#a1001f]" />
          <StatTile icon={Users} label="Học viên" value={String(totalStudents)} tone="bg-emerald-50 text-emerald-700" />
          <StatTile icon={CalendarDays} label="Đang học" value={String(runningCount)} tone="bg-blue-50 text-blue-700" />
          <StatTile icon={Building2} label="Cơ sở" value={String(centreCount)} tone="bg-amber-50 text-amber-700" />
        </div>

        <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Filter className="h-4 w-4 text-[#a1001f]" />
            <h2 className="text-sm font-semibold text-gray-800">Bộ lọc lớp học</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Tìm kiếm lớp">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Tên lớp, khóa học, giảng viên..."
                  className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm font-normal text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
                />
              </div>
            </FilterField>

            <FilterField label="Cơ sở">
              <SelectField value={filters.centre} onChange={(value) => updateFilter('centre', value)} options={centreOptions} />
            </FilterField>

            <FilterField label="Ngày bắt đầu">
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => updateFilter('startDate', event.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
              />
            </FilterField>

            <FilterField label="Ngày kết thúc">
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => updateFilter('endDate', event.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
              />
            </FilterField>

            <FilterField label="Có buổi học từ">
              <input
                type="date"
                value={filters.slotFrom}
                max={filters.slotTo || undefined}
                onChange={(event) => updateFilter('slotFrom', event.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
              />
            </FilterField>

            <FilterField label="Có buổi học đến">
              <input
                type="date"
                value={filters.slotTo}
                min={filters.slotFrom || undefined}
                onChange={(event) => updateFilter('slotTo', event.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10"
              />
            </FilterField>

            <FilterField label="Trạng thái">
              <SelectField value={filters.status} onChange={(value) => updateFilter('status', value)} options={statusOptions} />
            </FilterField>

            <FilterField label="Giảng viên">
              <SearchableSelectField
                value={filters.teacher}
                onChange={(value) => updateFilter('teacher', value)}
                options={teacherOptions}
                placeholder="Tìm giảng viên"
              />
            </FilterField>
          </div>
        </section>

        {authLoading || isLoading ? (
          <LoadingTable />
        ) : noLmsToken ? (
          <EmptyState
            icon={AlertTriangle}
            title="Chưa có kết nối LMS"
            description="Phiên đăng nhập hiện tại chưa có token LMS. Bạn đăng nhập lại TPS bằng tài khoản đã đồng bộ LMS rồi tải lại màn hình này."
            action={<HeaderButton icon={RefreshCcw} onClick={loadClasses}>Tải lại</HeaderButton>}
          />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Không tải được danh sách lớp"
            description={error}
            action={<HeaderButton icon={RefreshCcw} onClick={loadClasses}>Thử lại</HeaderButton>}
          />
        ) : filteredClasses.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy lớp phù hợp"
            description="Hãy thử nới bộ lọc, hoặc kiểm tra lại tài khoản LMS nếu giáo viên chưa thấy lớp đang phụ trách."
            action={
              hasActiveFilters ? (
                <HeaderButton icon={X} onClick={clearFilters}>
                  Xóa bộ lọc
                </HeaderButton>
              ) : null
            }
          />
        ) : (
          <section className="rounded-md border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Danh sách lớp học</h2>
                <p className="text-xs font-normal text-gray-500">
                  Hiển thị {startRow}-{endRow} trong {filteredClasses.length} lớp phù hợp
                </p>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-700">
                    <th className="w-12 border-b border-gray-200 px-4 py-3">
                      <input type="checkbox" aria-label="Chọn tất cả lớp" className="h-4 w-4 rounded border-gray-300" />
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3">Tên</th>
                    <th className="border-b border-gray-200 px-4 py-3">Khóa học</th>
                    <th className="border-b border-gray-200 px-4 py-3">Cơ sở</th>
                    <th className="border-b border-gray-200 px-4 py-3">Phụ trách vận hành lớp</th>
                    <th className="border-b border-gray-200 px-4 py-3">Trạng thái</th>
                    <th className="border-b border-gray-200 px-4 py-3">Bắt đầu</th>
                    <th className="border-b border-gray-200 px-4 py-3">Kết thúc</th>
                    <th className="border-b border-gray-200 px-4 py-3">Lịch học</th>
                    <th className="border-b border-gray-200 px-4 py-3">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedClasses.map((cls) => {
                    const progress = classProgress(cls)
                    const centre = cls.centreShortName || cls.centreName || '-'

                    return (
                      <tr key={cls.id} className="group border-b border-gray-100 odd:bg-white even:bg-gray-50/40 hover:bg-[#fff8fa]">
                        <td className="border-b border-gray-100 px-4 py-4">
                          <input type="checkbox" aria-label={`Chọn lớp ${cls.name}`} className="h-4 w-4 rounded border-gray-300" />
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="max-w-[170px] truncate font-medium text-gray-950" title={cls.name}>
                              {cls.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedClassId(cls.id)}
                              className="text-gray-400 transition-colors hover:text-[#a1001f]"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4">
                          <div className="max-w-[260px]">
                            <p className="truncate font-normal text-gray-900" title={cls.courseName || cls.courseShortName}>
                              {cls.courseName || cls.courseShortName || '-'}
                            </p>
                            {cls.courseLineName ? (
                              <p className="mt-0.5 text-xs font-medium text-gray-500">{cls.courseLineName}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4">
                          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-700">
                            <Building2 className="h-3.5 w-3.5" />
                            {centre}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 font-normal text-gray-800">
                          {cls.operatorName || '-'}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4">
                          <span className={cn('text-sm font-medium', classStatusTextClass(cls.status))}>
                            {classStatusLabel(cls.status)}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 font-normal text-gray-700">
                          {formatDate(cls.startDate)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 font-normal text-gray-700">
                          {formatDate(cls.endDate)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 text-xs font-normal text-gray-700">
                          {scheduleText(cls)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4">
                          <div className="w-24">
                            <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                              <span>{progress.done}/{progress.total}</span>
                              <span className="text-gray-400">{progress.percent}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-[#a1001f]" style={{ width: `${progress.percent}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Trang {safePage}/{totalPages} · {PAGE_SIZE} dòng mỗi trang
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      <ClassAttendanceDrawer
        cls={selectedClass}
        onClose={() => setSelectedClassId(null)}
        onRefresh={loadClasses}
      />
    </PageContainer>
  )
}
