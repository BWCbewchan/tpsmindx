'use client'

import { PageContainer } from '@/components/PageContainer'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Bot,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Eye,
  Filter,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  PenTool,
  RefreshCcw,
  Save,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  classSiteId: string
  classSiteName: string
}

type ClassSiteOption = {
  id: string
  name: string
  slotTeacherIds: Record<string, string[]>
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
  classSites: ClassSiteOption[]
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

type SaveAttendanceApiResponse = {
  success?: boolean
  noLmsToken?: boolean
  ambiguous?: boolean
  unchanged?: boolean
  verified?: boolean
  message?: string
  class?: AttendanceClass
}

type TeacherRow = {
  id: string
  fullName: string
  email: string
  imageUrl: string | null
  roleShortName: string
  roleName: string
}

function accessRoleLabels(roles: string[]): string[] {
  const labels: string[] = []
  if (roles.includes('LEC')) labels.push('LEC')
  if (roles.includes('TA')) labels.push('TA')
  if (roles.includes('JUDGE') || roles.includes('JUDGE_SESSION_14')) labels.push('Judge')
  if (labels.length === 0 && roles.includes('ASSIGNED_TEACHER')) labels.push('Giảng dạy')
  if (labels.length === 0 && roles.includes('TEACHER_ATTENDANCE')) labels.push('Đã tham gia')
  return labels
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
  const targetSessionCount = Math.max(
    1,
    Number(cls.numberOfSessions || cls.sessionCount || cls.slots.length || SESSION_COUNT),
  )
  const slots = cls.slots.slice(0, targetSessionCount).map((slot, index) => ({
    ...slot,
    sessionNumber: index + 1,
  }))

  while (slots.length < targetSessionCount) {
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

function teacherRowsForClass(cls: AttendanceClass): TeacherRow[] {
  const rows = new Map<string, TeacherRow>()

  cls.allTeachers.forEach((teacher) => {
    const name = teacherName(teacher)
    const key = teacher.id || teacher.email || teacher.username || name
    rows.set(key, {
      id: key,
      fullName: name,
      email: teacher.email,
      imageUrl: null,
      roleShortName: teacher.roleShortName,
      roleName: teacher.roleName,
    })
  })

  cls.slots.flatMap((slot) => slot.teacherAttendance).forEach((attendance, index) => {
    const name = teacherAttendanceName(attendance)
    const key = String(attendance.teacher?.id || attendance.teacher?.email || attendance._id || `${name}-${index}`)
    const existing = rows.get(key)
    rows.set(key, {
      id: key,
      fullName: name,
      email: String(attendance.teacher?.email || ''),
      imageUrl: attendance.teacher?.imageUrl || null,
      roleShortName: existing?.roleShortName || '',
      roleName: existing?.roleName || '',
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

function teacherIsAssignedToSlot(slot: ClassSlot, teacher: TeacherRow): boolean {
  const email = teacher.email.trim().toLowerCase()
  return slot.teachers.some((assignment) => {
    return assignment.id === teacher.id || (
      Boolean(email) && assignment.email.trim().toLowerCase() === email
    )
  })
}

function slotStartTimestamp(slot: ClassSlot): number | null {
  const value = new Date(slot.startTime || slot.date || '').getTime()
  return Number.isFinite(value) ? value : null
}

function isSlotOpen(slot: ClassSlot): boolean {
  if (slot.isPlaceholder) return false
  const startTime = slotStartTimestamp(slot)
  return startTime !== null && startTime <= Date.now()
}

function automaticTeacherStatus(slot: ClassSlot): AttendanceStatus {
  const startTime = new Date(slot.startTime || slot.date || '').getTime()
  if (!Number.isFinite(startTime)) return 'PRESENT'

  const lateAfter = startTime + 15 * 60 * 1000
  return Date.now() > lateAfter ? 'LATE' : 'PRESENT'
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
    icon: MessageSquareText,
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
}: {
  value: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
}) {
  const actions: AttendanceStatus[] = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT']

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
  const pastSlotCount = cls.slots.filter(isSlotOpen).length
  const fallbackDone = cls.slots.length === 0
    ? 0
    : cls.status === 'FINISHED'
    ? Math.min(cls.slots.length || total, total)
    : Math.min(pastSlotCount, total)
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
    <div className="flex min-h-20 items-center gap-3 px-5 py-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold text-gray-950">{value}</p>
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

    const width = 328
    const height = 390
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
          className="pointer-events-none fixed z-[80] max-h-[calc(100vh-24px)] w-[328px] -translate-y-1/2 overflow-y-auto rounded-lg border border-white/10 bg-[#202020] p-5 text-white shadow-2xl"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          <span
            className={cn(
              'absolute top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-[#202020]',
              tooltipPosition.side === 'right' ? '-left-2' : '-right-2',
            )}
          />
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-gray-600 ring-4 ring-white/10">
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
              <dt className="font-medium text-white/70">Họ tên</dt>
              <dd className="min-w-0 break-words">: {info.fullName}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-medium text-white/70">Ngày sinh</dt>
              <dd>: -</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-medium text-white/70">Giới tính</dt>
              <dd>: {info.gender}</dd>
            </div>
          </dl>
          <h4 className="mt-5 text-center text-base font-semibold">Thông tin phụ huynh/khách hàng</h4>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-medium text-white/70">Họ tên</dt>
              <dd className="min-w-0 break-words">: {info.customerName}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-medium text-white/70">Số điện thoại</dt>
              <dd className="min-w-0 break-words">: {info.customerPhone}</dd>
            </div>
            <div className="grid grid-cols-[105px_1fr] gap-2">
              <dt className="font-medium text-white/70">Email</dt>
              <dd className="min-w-0 break-words">: {info.customerEmail}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function ClassAttendanceModal({
  cls,
  currentUserEmail,
  onClose,
  onRefresh,
  onClassUpdated,
}: {
  cls: AttendanceClass | null
  currentUserEmail: string
  onClose: () => void
  onRefresh: () => void
  onClassUpdated: (nextClass: AttendanceClass) => void
}) {
  const { token: authToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'attendance' | 'comments'>('attendance')
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null)
  const [selectedClassSiteId, setSelectedClassSiteId] = useState('')
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [showUpdateNote, setShowUpdateNote] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setActiveTab('attendance')
    setSelectedSessionIndex(null)
    setSelectedClassSiteId(cls?.classSites?.[0]?.id || '')
    setDraftStatuses({})
    setShowUpdateNote(true)
    setIsSaving(false)
    setSaveResult(null)
  }, [cls?.id])

  useEffect(() => {
    if (!cls) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cls, onClose])

  if (!cls) return null

  const currentClass = cls
  const classId = currentClass.id
  const slots = buildDisplaySlots(currentClass)
  const selectedSlot = selectedSessionIndex === null ? null : slots[selectedSessionIndex] || null
  const visibleStudents = currentClass.students.filter((student) => {
    if (!selectedClassSiteId) return currentClass.classSites.length <= 1
    return student.classSiteId === selectedClassSiteId || (
      !student.classSiteId && currentClass.classSites.length <= 1
    )
  })
  const selectedClassSite = currentClass.classSites.find(
    (classSite) => classSite.id === selectedClassSiteId,
  )
  const teacherRows = teacherRowsForClass(currentClass)
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase()
  const currentTeacher = teacherRows.find(
    (teacher) => teacher.email.trim().toLowerCase() === normalizedCurrentUserEmail,
  )
  const selectedTeacherRows = selectedSlot
    ? teacherRows.filter((teacher) => teacherIsAssignedForSelectedSite(selectedSlot, teacher))
    : []
  const visual = courseVisual(currentClass)
  const CourseIcon = visual.icon
  const teacherRecorded = selectedSlot ? selectedTeacherRows.filter((teacher) => {
    const key = attendanceKey(cls.id, selectedSlot.id, teacher.id)
    const status = draftStatuses[key] || teacherStatus(selectedSlot, teacher.id, teacher.email)
    return status !== 'NOT_RECORDED'
  }).length : 0
  const studentRecorded = selectedSlot
    ? visibleStudents.filter((student) => {
        const key = attendanceKey(cls.id, selectedSlot.id, student.id)
        const status = draftStatuses[key] || studentStatus(selectedSlot, student.id)
        return status !== 'NOT_RECORDED'
      }).length
    : 0
  const teacherRowsToSubmit = selectedTeacherRows.filter(
    (teacher) => currentTeacher?.id !== teacher.id,
  )
  const selectedSlotPrefix = selectedSlot ? `${classId}:${selectedSlot.id}:` : ''
  const hasDraftChanges = Boolean(selectedSlotPrefix) && Object.keys(draftStatuses).some(
    (key) => key.startsWith(selectedSlotPrefix),
  )
  const allStudentsRecorded = Boolean(selectedSlot) && visibleStudents.length > 0 && visibleStudents.every((student) => {
    const key = attendanceKey(classId, selectedSlot!.id, student.id)
    return (draftStatuses[key] || studentStatus(selectedSlot!, student.id)) !== 'NOT_RECORDED'
  })
  const allOtherTeachersRecorded = Boolean(selectedSlot) && teacherRowsToSubmit.every((teacher) => {
    const key = attendanceKey(classId, selectedSlot!.id, teacher.id)
    return (draftStatuses[key] || teacherStatus(selectedSlot!, teacher.id, teacher.email)) !== 'NOT_RECORDED'
  })
  const canSave = Boolean(
    selectedSlot &&
    selectedClassSiteId &&
    isSlotOpen(selectedSlot) &&
    hasDraftChanges &&
    allStudentsRecorded &&
    allOtherTeachersRecorded &&
    !isSaving,
  )

  function addAutomaticTeacherAttendance(
    current: Record<string, AttendanceStatus>,
    slot: ClassSlot,
  ): Record<string, AttendanceStatus> {
    if (
      !currentTeacher ||
      !teacherIsAssignedForSelectedSite(slot, currentTeacher) ||
      visibleStudents.length === 0
    ) return current

    const allStudentsRecorded = visibleStudents.every((student) => {
      const key = attendanceKey(classId, slot.id, student.id)
      return (current[key] || studentStatus(slot, student.id)) !== 'NOT_RECORDED'
    })
    if (!allStudentsRecorded) return current

    const teacherKey = attendanceKey(classId, slot.id, currentTeacher.id)
    const currentTeacherStatus = current[teacherKey] || teacherStatus(
      slot,
      currentTeacher.id,
      currentTeacher.email,
    )
    if (currentTeacherStatus !== 'NOT_RECORDED') return current

    return {
      ...current,
      [teacherKey]: automaticTeacherStatus(slot),
    }
  }

  function selectSession(slot: ClassSlot, index: number) {
    if (!isSlotOpen(slot)) {
      setSaveResult({
        type: 'error',
        message: slot.isPlaceholder
          ? 'Buổi học này chưa có lịch trên LMS.'
          : `Điểm danh sẽ mở lúc ${formatTime(slot.startTime)} ngày ${formatDate(slot.startTime || slot.date)}.`,
      })
      return
    }

    setSelectedSessionIndex((current) => current === index ? null : index)
    setDraftStatuses((current) => addAutomaticTeacherAttendance(current, slot))
    setSaveResult(null)
  }

  function teacherIsAssignedForSelectedSite(slot: ClassSlot, teacher: TeacherRow): boolean {
    const siteTeacherIds = selectedClassSite?.slotTeacherIds?.[slot.id]
    if (siteTeacherIds) return siteTeacherIds.includes(teacher.id)
    return teacherIsAssignedToSlot(slot, teacher)
  }

  function setTeacherDraft(slot: ClassSlot, teacher: TeacherRow, status: AttendanceStatus) {
    if (currentTeacher?.id === teacher.id) return

    setSaveResult(null)
    setDraftStatuses((current) => ({
      ...current,
      [attendanceKey(classId, slot.id, teacher.id)]: status,
    }))
  }

  function setStudentDraft(slot: ClassSlot, studentId: string, status: AttendanceStatus) {
    setSaveResult(null)
    setDraftStatuses((current) => addAutomaticTeacherAttendance({
      ...current,
      [attendanceKey(classId, slot.id, studentId)]: status,
    }, slot))
  }

  async function saveAttendance() {
    if (!selectedSlot || !canSave) return

    setIsSaving(true)
    setSaveResult(null)
    try {
      const response = await fetch('/api/user/diem-danh-lop-hoc', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...authHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          classSiteId: selectedClassSiteId,
          slotId: selectedSlot.id,
          expectedStartTime: selectedSlot.startTime,
          students: visibleStudents.map((student) => ({
            personId: student.id,
            status: draftStatuses[attendanceKey(classId, selectedSlot.id, student.id)] || studentStatus(selectedSlot, student.id),
          })),
          teachers: teacherRowsToSubmit.map((teacher) => ({
            personId: teacher.id,
            status: draftStatuses[attendanceKey(classId, selectedSlot.id, teacher.id)] || teacherStatus(selectedSlot, teacher.id, teacher.email),
          })),
        }),
      })
      const payload = await response.json() as SaveAttendanceApiResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xác nhận dữ liệu điểm danh trên LMS.')
      }

      if (payload.class) onClassUpdated(payload.class)
      setDraftStatuses((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(selectedSlotPrefix)),
      ))
      setSaveResult({
        type: 'success',
        message: payload.message || 'Đã lưu và xác nhận dữ liệu trên LMS.',
      })
    } catch (saveError: unknown) {
      setSaveResult({
        type: 'error',
        message: saveError instanceof Error ? saveError.message : 'Không thể lưu điểm danh lên LMS.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-modal-backdrop-custom flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-modal-title"
        className="z-modal-custom flex h-[min(90dvh,840px)] w-[min(94vw,1180px)] flex-col overflow-hidden rounded-lg border border-white/80 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', visual.surfaceClass)}>
                <CourseIcon className={cn('h-5 w-5', visual.iconClass)} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="attendance-modal-title" className="truncate text-xl font-semibold text-gray-950">{cls.name}</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {classStatusLabel(cls.status)}
                  </span>
                  {accessRoleLabels(cls.accessRoles).map((role) => (
                    <span key={role} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                      {role}
                    </span>
                  ))}
                </div>
                <p className="mt-1 truncate text-sm text-gray-700">
                  {cls.courseName || cls.courseShortName || 'Khóa học'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {cls.centreShortName || cls.centreName || 'Chưa có cơ sở'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(cls.startDate)} - {formatDate(cls.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {cls.operatorName || cls.allTeacherNames[0] || 'Chưa có phụ trách'}
                  </span>
                  {cls.classSites.length > 0 ? (
                    <label className="inline-flex items-center gap-1.5">
                      <span>Class site</span>
                      <select
                        value={selectedClassSiteId}
                        onChange={(event) => {
                          setSelectedClassSiteId(event.target.value)
                          setSelectedSessionIndex(null)
                          setDraftStatuses({})
                          setSaveResult(null)
                        }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#3156d4]"
                      >
                        {cls.classSites.map((classSite) => (
                          <option key={classSite.id} value={classSite.id}>{classSite.name}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
                title="Làm mới"
                aria-label="Làm mới dữ liệu lớp"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
                title="Đóng"
                aria-label="Đóng chi tiết lớp"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex gap-1 border-t border-gray-100 bg-gray-50/70 px-5 text-sm sm:px-6" aria-label="Nội dung lớp học">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={cn(
                'border-b-2 px-3 py-3 font-medium transition-colors',
                activeTab === 'attendance'
                  ? 'border-b-2 border-[#a1001f] text-[#a1001f]'
                  : 'border-b-2 border-transparent hover:text-gray-900',
              )}
            >
              Điểm danh
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={cn(
                'border-b-2 px-3 py-3 font-medium transition-colors',
                activeTab === 'comments'
                  ? 'border-b-2 border-[#a1001f] text-[#a1001f]'
                  : 'border-b-2 border-transparent hover:text-gray-900',
              )}
            >
              Nhận xét
            </button>
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f6f7f9] px-4 py-4 sm:px-5">
          {activeTab === 'comments' ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
              Mục nhận xét sẽ được hoàn thiện sau phần điểm danh.
            </div>
          ) : (
            <>
          <SessionJourney
            cls={currentClass}
            slots={slots}
            selectedSessionIndex={selectedSessionIndex}
            onSelect={selectSession}
          />
          {saveResult ? (
            <div className={cn(
              'mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
              saveResult.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            )}>
              {saveResult.type === 'success' ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{saveResult.message}</span>
            </div>
          ) : null}
          {showUpdateNote && selectedSlot && (!currentTeacher || !teacherIsAssignedForSelectedSite(selectedSlot, currentTeacher)) ? (
            <div className="relative mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-gray-800">
              <button
                type="button"
                onClick={() => setShowUpdateNote(false)}
                className="absolute right-3 top-3 text-gray-600 hover:text-gray-950"
                title="Ẩn thông báo"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="pr-8 font-medium text-gray-900">Không thể cập nhật điểm danh vì những lý do sau:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-gray-700">
                <li>User không phải là giảng viên được phân công dạy slot hiện tại</li>
                <li>User không phải là vận hành của lớp</li>
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white custom-scrollbar [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
            <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 w-[240px] min-w-[240px] border-b border-gray-200 bg-white px-4 py-2" />
                  {slots.map((slot, index) => {
                    const active = index === selectedSessionIndex
                    const opened = isSlotOpen(slot)
                    return (
                      <th key={slot.id} className={cn('border-b border-gray-200 bg-white px-1 py-2 text-center', active ? 'w-[190px] min-w-[190px]' : 'w-[100px] min-w-[100px]')}>
                        <button
                          type="button"
                          onClick={() => selectSession(slot, index)}
                          disabled={!opened}
                          title={!opened && !slot.isPlaceholder
                            ? `Mở điểm danh lúc ${formatTime(slot.startTime)} ngày ${formatDate(slot.startTime || slot.date)}`
                            : undefined}
                          className={cn(
                            'h-[56px] w-full rounded-md border px-3 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/25',
                            active
                              ? 'border-[#a1001f] bg-[#a1001f] text-white shadow-sm'
                              : !opened
                                ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                                : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-gray-100',
                          )}
                        >
                          <span className="block text-sm font-semibold">#{slot.sessionNumber}</span>
                          <span className={cn('mt-1 flex items-center justify-center gap-1 truncate text-xs font-medium', active ? 'text-white' : 'text-gray-500')}>
                            {!opened && !slot.isPlaceholder ? <LockKeyhole className="h-3 w-3" /> : null}
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
                <tr>
                  <td className="sticky left-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a1001f] text-xs font-semibold text-white">1</span>
                      <h3 className="font-semibold text-gray-950">Kiểm tra giáo viên</h3>
                    </div>
                  </td>
                  <td colSpan={slots.length} className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className={cn('text-sm font-medium', selectedSlot ? 'text-emerald-700' : 'text-gray-500')}>
                      {selectedSlot ? `${teacherRecorded}/${selectedTeacherRows.length} đã ghi nhận` : 'Chọn một buổi để thực hiện điểm danh'}
                    </p>
                  </td>
                </tr>

                {teacherRows.length === 0 ? (
                  <tr>
                    <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-4 text-sm text-gray-500">
                      Chưa có dữ liệu giáo viên
                    </td>
                    <td colSpan={slots.length} className="border-b border-gray-100 bg-white" />
                  </tr>
                ) : teacherRows.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs font-semibold text-white">
                          {teacher.imageUrl ? (
                            <img src={teacher.imageUrl} alt={teacher.fullName} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(teacher.fullName)
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-normal text-gray-900">
                            {teacher.fullName}
                            {currentTeacher?.id === teacher.id ? (
                              <span className="ml-1.5 text-[11px] text-gray-400">(Bạn)</span>
                            ) : null}
                          </span>
                          {teacher.roleShortName || teacher.roleName ? (
                            <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                              {teacher.roleShortName || teacher.roleName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {slots.map((slot, index) => {
                      const key = attendanceKey(cls.id, slot.id, teacher.id)
                      const status = draftStatuses[key] || teacherStatus(slot, teacher.id, teacher.email)
                      const isCurrentTeacher = currentTeacher?.id === teacher.id
                      const assignedToSlot = teacherIsAssignedForSelectedSite(slot, teacher)
                      const opened = isSlotOpen(slot)
                      return (
                        <td key={`${teacher.id}-${slot.id}`} className={cn('border-b border-gray-100 px-1 py-3 text-center align-middle', index === selectedSessionIndex && 'bg-[#a1001f]/[0.025]')}>
                          {index === selectedSessionIndex && assignedToSlot && !isCurrentTeacher ? (
                            <StatusControls
                              value={status}
                              onChange={(nextStatus) => setTeacherDraft(slot, teacher, nextStatus)}
                            />
                          ) : (
                            <div
                              className="flex h-8 items-center justify-center"
                              title={isCurrentTeacher && index === selectedSessionIndex
                                ? 'Trạng thái của bạn được tự động ghi nhận khi đã điểm danh đủ học viên'
                                : ATTENDANCE_META[status].label}
                            >
                              <AttendanceMark status={opened && assignedToSlot ? status : 'NOT_RECORDED'} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                <tr>
                  <td className="sticky left-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a1001f] text-xs font-semibold text-white">2</span>
                      <h3 className="font-semibold text-gray-950">Kiểm tra học viên</h3>
                    </div>
                  </td>
                  <td colSpan={slots.length} className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className={cn('text-sm font-medium', selectedSlot ? 'text-emerald-700' : 'text-gray-500')}>
                      {selectedSlot ? `${studentRecorded}/${visibleStudents.length} đã ghi nhận` : 'Chọn một buổi để thực hiện điểm danh'}
                    </p>
                  </td>
                </tr>

                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-3 align-middle">
                      <StudentIdentity cls={cls} student={student} />
                    </td>
                    {slots.map((slot, index) => {
                      const key = attendanceKey(cls.id, slot.id, student.id)
                      const status = draftStatuses[key] || studentStatus(slot, student.id)
                      const opened = isSlotOpen(slot)
                      return (
                        <td key={`${student.id}-${slot.id}`} className={cn('border-b border-gray-100 px-1 py-3 text-center align-middle', index === selectedSessionIndex && 'bg-[#a1001f]/[0.025]')}>
                          {index === selectedSessionIndex ? (
                            <StatusControls
                              value={status}
                              onChange={(nextStatus) => setStudentDraft(slot, student.id, nextStatus)}
                            />
                          ) : (
                            <div className="flex h-8 items-center justify-center">
                              <AttendanceMark status={opened ? status : 'NOT_RECORDED'} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {selectedSlot ? (
                <tfoot>
                  <tr>
                    <td className="sticky left-0 z-20 border-t border-gray-200 bg-white px-4 py-3 align-middle">
                      <p className="text-sm font-medium text-gray-900">
                        Buổi {selectedSlot.sessionNumber} · {formatTimeRange(selectedSlot)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {!allStudentsRecorded
                          ? `Còn ${Math.max(0, visibleStudents.length - studentRecorded)} học viên chưa ghi nhận`
                          : !allOtherTeachersRecorded
                            ? 'Còn giáo viên được phân công chưa ghi nhận'
                            : hasDraftChanges
                              ? 'Đã đủ thông tin, có thể lưu điểm danh'
                              : 'Chưa có thay đổi cần lưu'}
                      </p>
                    </td>
                    {slots.map((slot, index) => (
                      <td
                        key={`save-${slot.id}`}
                        className={cn(
                          'border-t border-gray-200 bg-white px-2 py-3 text-center align-middle',
                          index === selectedSessionIndex && 'bg-[#a1001f]/[0.025]',
                        )}
                      >
                        {index === selectedSessionIndex ? (
                          <button
                            type="button"
                            onClick={saveAttendance}
                            disabled={!canSave}
                            className="mx-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#a1001f] px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#850019] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                          >
                            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSaving ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function courseVisual(cls: AttendanceClass): {
  label: string
  icon: LucideIcon
  iconClass: string
  surfaceClass: string
} {
  const courseText = normalizeText([
    cls.courseName,
    cls.courseShortName,
    cls.courseLineName,
  ].join(' '))

  if (
    courseText.includes('robot') ||
    courseText.includes('arduino') ||
    courseText.includes('lego') ||
    courseText.includes('vex')
  ) {
    return {
      label: 'Robotics',
      icon: Bot,
      iconClass: 'text-amber-700',
      surfaceClass: 'border-amber-200 bg-amber-50',
    }
  }

  if (
    courseText.includes('art') ||
    courseText.includes('drawing') ||
    courseText.includes('painting') ||
    courseText.includes('my thuat')
  ) {
    return {
      label: 'Art',
      icon: PenTool,
      iconClass: 'text-fuchsia-700',
      surfaceClass: 'border-fuchsia-200 bg-fuchsia-50',
    }
  }

  return {
    label: 'Coding',
    icon: Code2,
    iconClass: 'text-blue-700',
    surfaceClass: 'border-blue-200 bg-blue-50',
  }
}

function SessionJourney({
  cls,
  slots,
  selectedSessionIndex,
  onSelect,
}: {
  cls: AttendanceClass
  slots: ClassSlot[]
  selectedSessionIndex: number | null
  onSelect: (slot: ClassSlot, index: number) => void
}) {
  const progress = classProgress(cls)
  const visual = courseVisual(cls)
  const SubjectIcon = visual.icon
  const slotCount = Math.max(slots.length, 1)
  const hasReachedSession = progress.done > 0 && slots.length > 0
  const reachedIndex = hasReachedSession
    ? Math.min(slots.length - 1, progress.done - 1)
    : -1
  const pointInsetPercent = 50 / slotCount
  const trackLengthPercent = 100 - (pointInsetPercent * 2)
  const reachedPercent = reachedIndex >= 0
    ? ((reachedIndex + 0.5) / slotCount) * 100
    : pointInsetPercent
  const completedTrackPercent = reachedIndex > 0 && slots.length > 1
    ? (reachedIndex / (slots.length - 1)) * trackLengthPercent
    : 0

  return (
    <section className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-gray-950">Hành trình buổi học</h3>
          <p className="mt-0.5 text-xs text-gray-500">{cls.courseName || cls.courseShortName || 'Khóa học'}</p>
        </div>
        <span className="text-xs font-medium text-gray-600">
          {progress.done}/{progress.total} buổi đã diễn ra
        </span>
      </div>

      <nav aria-label="Tiến trình buổi học" className="overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1">
        <div className="h-10 min-w-[620px] px-5">
          <div className="relative h-full">
            <span
              className="absolute top-[19px] h-px bg-gray-200"
              style={{ left: `${pointInsetPercent}%`, right: `${pointInsetPercent}%` }}
              aria-hidden="true"
            />
            <span
              className="absolute top-[19px] h-px bg-[#a1001f] transition-[width] duration-500"
              style={{ left: `${pointInsetPercent}%`, width: `${completedTrackPercent}%` }}
              aria-hidden="true"
            />

            {hasReachedSession ? (
              <div
                className={cn(
                  'pointer-events-none absolute top-[5px] z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm ring-2 ring-white transition-[left] duration-500',
                  visual.surfaceClass,
                  selectedSessionIndex === reachedIndex && 'ring-[#a1001f]/20',
                )}
                style={{ left: `${reachedPercent}%` }}
                title={`${visual.label} · Đã tới buổi ${reachedIndex + 1}`}
              >
                <SubjectIcon className={cn('h-3.5 w-3.5', visual.iconClass)} />
              </div>
            ) : null}

            <ol className="absolute inset-x-0 top-[14px] grid h-3 items-center" style={{ gridTemplateColumns: `repeat(${Math.max(slots.length, 1)}, minmax(0, 1fr))` }} role="list">
            {slots.map((slot, index) => {
              const completed = index < progress.done
              const selected = index === selectedSessionIndex
              const opened = isSlotOpen(slot)
              return (
                <li key={`journey-${slot.id}`} className="relative z-10 flex items-center justify-center">
                  <button
                    type="button"
                    disabled={!opened}
                    onClick={() => onSelect(slot, index)}
                    title={slot.isPlaceholder
                      ? `Buổi ${slot.sessionNumber} chưa có lịch`
                      : !opened
                        ? `Buổi ${slot.sessionNumber} mở lúc ${formatTime(slot.startTime)} ngày ${formatDate(slot.startTime || slot.date)}`
                        : `Buổi ${slot.sessionNumber} - ${formatShortDateWithYear(slot.date || slot.startTime)}`}
                    aria-label={`Chọn buổi ${slot.sessionNumber}`}
                    className={cn(
                      'h-3 w-3 rounded-full border-2 transition-[background-color,border-color,box-shadow,transform] hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30 focus-visible:ring-offset-2',
                      completed
                        ? 'border-[#a1001f] bg-[#a1001f]'
                        : 'border-gray-300 bg-white',
                      selected && 'border-[#a1001f] bg-white ring-4 ring-[#a1001f]/15',
                      !opened && 'cursor-not-allowed hover:scale-100',
                      hasReachedSession && index === reachedIndex && 'opacity-0',
                    )}
                  />
                </li>
              )
            })}
            </ol>
          </div>
        </div>
      </nav>
    </section>
  )
}

export default function TeacherClassesPage() {
  const { user, token, isLoading: authLoading } = useAuth()
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
        return (payload.classes || []).filter((cls) => cls.status === 'RUNNING')
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
    </div>
  )

  return (
    <PageContainer
      title="Lớp học"
      description="Theo dõi các lớp được LMS phân quyền và thực hiện điểm danh theo từng buổi."
      headerActions={headerActions}
      maxWidth="full"
    >
      <div className="space-y-5">
        <section className="grid overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 md:grid-cols-4 md:divide-x md:divide-y-0">
          <StatTile icon={BookOpen} label="Lớp hiển thị" value={String(filteredClasses.length)} tone="bg-[#a1001f]/10 text-[#a1001f]" />
          <StatTile icon={Users} label="Học viên" value={String(totalStudents)} tone="bg-emerald-50 text-emerald-700" />
          <StatTile icon={CalendarDays} label="Đang học" value={String(runningCount)} tone="bg-blue-50 text-blue-700" />
          <StatTile icon={Building2} label="Cơ sở" value={String(centreCount)} tone="bg-amber-50 text-amber-700" />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#a1001f]" />
              <h2 className="text-sm font-semibold text-gray-800">Bộ lọc lớp học</h2>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#a1001f] sm:self-auto"
              >
                <X className="h-3.5 w-3.5" />
                Xóa bộ lọc
              </button>
            ) : null}
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
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Danh sách lớp học</h2>
                <p className="text-xs font-normal text-gray-500">
                  Hiển thị {startRow}-{endRow} trong {filteredClasses.length} lớp phù hợp
                </p>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
              <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-700">
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
                          <div className="min-w-[155px]">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="max-w-[170px] truncate font-medium text-gray-950" title={cls.name}>
                                {cls.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedClassId(cls.id)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[#a1001f]/5 hover:text-[#a1001f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/20"
                                title="Xem chi tiết và điểm danh"
                                aria-label={`Xem chi tiết lớp ${cls.name}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                            {accessRoleLabels(cls.accessRoles).length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {accessRoleLabels(cls.accessRoles).map((role) => (
                                  <span key={role} className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                    {role}
                                  </span>
                                ))}
                              </div>
                            ) : null}
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
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
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
      <ClassAttendanceModal
        cls={selectedClass}
        currentUserEmail={user?.email || ''}
        onClose={() => setSelectedClassId(null)}
        onRefresh={loadClasses}
        onClassUpdated={(nextClass) => {
          setClasses((current) => current.map((item) => item.id === nextClass.id ? nextClass : item))
        }}
      />
    </PageContainer>
  )
}
