'use client'
import { useQueryRestore } from '@/lib/use-query-restore'
import { useQueryFilters } from '@/lib/use-query-filters'
import { useQueryState } from '@/lib/use-query-state'


import { PageContainer } from '@/components/PageContainer'
import DateRangePicker from '@/components/portfolio/DateRangePicker'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Bot,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Eye,
  FileSpreadsheet,
  Filter,
  LockKeyhole,
  Loader2,
  MapPin,
  MessageSquareText,
  MoreVertical,
  PenTool,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '@/lib/app-toast'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ClassCommentsPanel } from './ClassCommentsPanel'

const SESSION_COUNT = 14
const PAGE_SIZE = 20
const LEADER_ROLE_CODES = new Set(['CL', 'AL', 'RL', 'TC', 'TE'])

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
  classSiteId?: string
  classSiteName?: string
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
  courseId?: string | null
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
  if (normalized === 'RUNNING') return 'Đang học'
  if (normalized === 'PREPARING') return 'Sắp diễn ra'
  if (normalized === 'FINISHED') return 'Đã kết thúc'
  if (normalized === 'CANCELLED') return 'Đã hủy'
  return status || 'Không xác định'
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
  if (!key) return '--/--/----'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

function formatDateTimeFull(value: string | number | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${hours}:${minutes} ${day}/${month}/${year}`
}

function formatDateFull(value: string | number | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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
  const startTime = slotStartTimestamp(slot)
  if (startTime === null) return 'PRESENT'

  return Date.now() > startTime + 15 * 60 * 1000 ? 'LATE' : 'PRESENT'
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
    colorClass: 'text-blue-600',
    activeClass: 'text-blue-600 bg-blue-50',
  },
  ABSENT: {
    label: 'Vắng không phép',
    icon: X,
    colorClass: 'text-rose-600',
    activeClass: 'text-rose-600 bg-rose-50',
  },
  NOT_RECORDED: {
    label: 'Chưa ghi nhận',
    icon: X,
    colorClass: 'text-gray-400',
    activeClass: 'text-gray-400',
  },
}

function AttendanceMark({ status, className }: { status: AttendanceStatus; className?: string }) {
  if (status === 'NOT_RECORDED') {
    return <span className={cn('text-lg font-semibold leading-none text-gray-300', className)}>–</span>
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
  hasComment?: boolean
}) {
  const actions: AttendanceStatus[] = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT']

  return (
    <div className="flex items-center justify-center gap-1.5">
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
              'flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none',
              active ? meta.activeClass : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </button>
        )
      })}
    </div>
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
  const reachedIndex = progress.done > 0 && slots.length > 0
    ? Math.min(slots.length - 1, progress.done - 1)
    : -1
  const pointInsetPercent = 50 / slotCount
  const trackLengthPercent = 100 - pointInsetPercent * 2
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

            {reachedIndex >= 0 ? (
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

            <ol
              className="absolute inset-x-0 top-[14px] grid h-3 items-center"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
              role="list"
            >
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
                        completed ? 'border-[#a1001f] bg-[#a1001f]' : 'border-gray-300 bg-white',
                        selected && 'border-[#a1001f] bg-white ring-4 ring-[#a1001f]/15',
                        !opened && 'cursor-not-allowed hover:scale-100',
                        reachedIndex === index && 'opacity-0',
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

function getScheduleList(cls: AttendanceClass): string[] {
  const entries = cls.slots
    .filter((slot) => slot.startTime || slot.date)
    .map((slot) => {
      const weekday = weekDayName(slot.date || slot.startTime)
      const start = formatTime(slot.startTime)
      const end = formatTime(slot.endTime)
      const time = start && end ? `${start} - ${end}` : start || end
      if (weekday && time) return `${weekday}, ${time}`
      return weekday || time || ''
    })
    .filter(Boolean)

  return Array.from(new Set(entries))
}

function scheduleText(cls: AttendanceClass): string {
  const unique = getScheduleList(cls)
  if (unique.length === 0) return '-'
  return unique.slice(0, 2).join('; ') + (unique.length > 2 ? ` (+${unique.length - 2})` : '')
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

type StudentDemoGradeItemState = {
  level: 'Chưa đạt' | 'Hoàn thành' | 'Tốt'
  earnedScore: number
  note: string
  noteJudge?: string
}

function toDDMMYYYY(val: string): string {
  if (!val) return ''
  if (val.includes('/')) return val
  const parts = val.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return val
}

function toYYYYMMDD(val: string): string {
  if (!val) return ''
  const parts = val.split('/')
  if (parts.length === 3 && parts[2]?.length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return val
}

function formatScoreMax3(val: number | string): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(n)) return '0'
  return (Math.round(n * 1000) / 1000).toString()
}

function cleanGroupTitle(name: string): string {
  if (!name) return ''
  return name
    .replace(/\s*\(\s*[\d.,]+\s*(?:đ|điểm|diem|pts?|points?)?\s*\)/gi, '')
    .replace(/\s*-\s*[\d.,]+\s*(?:đ|điểm|diem|pts?|points?)\s*$/gi, '')
    .trim()
}

function getGradingPermission(
  cls: AttendanceClass,
  user: any,
): {
  canGrade: boolean
  canEdit: boolean
  isManager: boolean
  isLecOrJudge: boolean
  reason: string
  timeNotice?: string
} {
  // 1. Kiểm tra role Manager (manager, admin, super_admin, hoặc userRoles có manager/admin/leader)
  const roleStr = (user?.role || '').toLowerCase()
  const isAdmin = Boolean(user?.isAdmin)
  const hasManagerRole =
    isAdmin ||
    roleStr === 'manager' ||
    roleStr === 'admin' ||
    roleStr === 'super_admin' ||
    (Array.isArray(user?.userRoles) &&
      user.userRoles.some((r: string) => {
        const s = (r || '').toLowerCase()
        return s.includes('manager') || s.includes('admin') || s.includes('leader')
      }))

  // 2. Kiểm tra role Lec hoặc Judge trong lớp này
  const userEmail = (user?.email || '').toLowerCase().trim()
  const userName = (user?.displayName || '').toLowerCase().trim()

  const hasLecAccess =
    cls.accessRoles?.includes('LEC') ||
    cls.lecTeachers?.some((name) => name.toLowerCase().trim() === userName) ||
    cls.classTeachers?.some((t) => {
      const r = (t.roleShortName || t.roleName || '').toUpperCase()
      const isLecRole = r === 'LEC' || r.includes('LECTURER') || r.includes('GIANG VIEN')
      const match =
        (t.email && t.email.toLowerCase() === userEmail) ||
        (t.username && t.username.toLowerCase() === userEmail) ||
        (t.fullName && t.fullName.toLowerCase().trim() === userName)
      return isLecRole && match
    })

  const hasJudgeAccess =
    cls.accessRoles?.includes('JUDGE_SESSION_14') ||
    cls.allTeachers?.some((t) => {
      const r = (t.roleShortName || t.roleName || '').toUpperCase()
      const isJudgeRole = r === 'JUDGE' || r === 'BGK' || r.includes('GIAM KHAO')
      const match =
        (t.email && t.email.toLowerCase() === userEmail) ||
        (t.username && t.username.toLowerCase() === userEmail) ||
        (t.fullName && t.fullName.toLowerCase().trim() === userName)
      return isJudgeRole && match
    })

  const isLecOrJudge = Boolean(hasLecAccess || hasJudgeAccess)

  // Nếu không có quyền Manager và cũng không phải Lec/Judge của lớp
  if (!hasManagerRole && !isLecOrJudge) {
    return {
      canGrade: false,
      canEdit: false,
      isManager: false,
      isLecOrJudge: false,
      reason: 'Chỉ Giảng viên phụ trách (Lec), Giám khảo (Judge) hoặc Quản lý mới có quyền chấm điểm lớp này.',
    }
  }

  // 3. Mốc thời gian bắt đầu của buổi học cuối (buổi demo)
  const slots = cls.slots || []
  const lastSlot = slots.slice().reverse().find((s) => !s.isPlaceholder) || slots[slots.length - 1]
  const rawStart = lastSlot?.startTime || lastSlot?.date || cls.startDate
  let startMs = 0
  let endOfDayMs = Infinity

  if (rawStart) {
    const dtStart = new Date(rawStart)
    if (!isNaN(dtStart.getTime())) {
      startMs = dtStart.getTime()
      const dtEnd = new Date(dtStart.getFullYear(), dtStart.getMonth(), dtStart.getDate(), 23, 59, 59, 999)
      endOfDayMs = dtEnd.getTime()
    }
  }

  const now = Date.now()

  // 3a. Trường hợp Role có Manager
  if (hasManagerRole) {
    if (startMs > 0 && now < startMs) {
      const startStr = formatDateTimeFull(startMs)
      return {
        canGrade: true,
        canEdit: false,
        isManager: true,
        isLecOrJudge,
        reason: `Chưa đến thời gian bắt đầu buổi học (${startStr}). Quản lý chỉ được chấm điểm từ khi buổi học bắt đầu.`,
        timeNotice: `Mở từ: ${startStr}`,
      }
    }
    return {
      canGrade: true,
      canEdit: true,
      isManager: true,
      isLecOrJudge,
      reason: '',
      timeNotice: 'Role Quản lý: Được phép cập nhật bảng điểm lúc nào cũng được từ khi buổi học bắt đầu.',
    }
  }

  // 3b. Trường hợp Lec / Judge (không có role Manager)
  if (startMs > 0 && now < startMs) {
    const startStr = formatDateTimeFull(startMs)
    return {
      canGrade: true,
      canEdit: false,
      isManager: false,
      isLecOrJudge: true,
      reason: `Chưa đến thời gian chấm điểm. Buổi học cuối bắt đầu lúc ${startStr}.`,
      timeNotice: `Chưa mở (Bắt đầu từ: ${startStr})`,
    }
  }

  if (endOfDayMs < Infinity && now > endOfDayMs) {
    const endStr = `23:59 ngày ${formatDateFull(endOfDayMs)}`
    return {
      canGrade: true,
      canEdit: false,
      isManager: false,
      isLecOrJudge: true,
      reason: `Đã hết thời hạn chấm điểm cho Giảng viên/Giám khảo (${endStr}). Bảng điểm hiện ở chế độ chỉ xem. Vui lòng liên hệ Quản lý nếu cần điều chỉnh.`,
      timeNotice: `Hết hạn lúc ${endStr}`,
    }
  }

  const deadlineStr = endOfDayMs < Infinity ? `23:59 ngày ${formatDateFull(endOfDayMs)}` : ''
  return {
    canGrade: true,
    canEdit: true,
    isManager: false,
    isLecOrJudge: true,
    reason: '',
    timeNotice: deadlineStr ? `Thời hạn chấm điểm: Đến ${deadlineStr}` : undefined,
  }
}

function detectProjectType(cls: AttendanceClass): string {
  const text = normalizeText(
    [cls.courseName, cls.courseShortName, cls.courseLineName, cls.name]
      .filter(Boolean)
      .join(' ')
  )

  if (text.includes('scratch')) return 'Lập Trình Scratch'
  if (text.includes('app') || text.includes('flutter') || text.includes('react native')) return 'Lập Trình App'
  if (text.includes('game')) return 'Lập Trình Game'
  if (text.includes('web')) return 'Lập Trình Web'
  if (text.includes('robot')) return 'Lập Trình Robotics'
  if (text.includes('python')) return 'Lập Trình Python'
  if (text.includes('computer scientist') || text.includes('khoa hoc may tinh') || text.includes('cs0')) return 'Khoa Học Máy Tính'
  if (text.includes('art') || text.includes('visual') || text.includes('illustrator')) return 'Mỹ Thuật Số'
  if (text.includes('data')) return 'Khoa Học Dữ Liệu'

  return cls.courseLineName || cls.courseName || 'Dự án demo'
}

function StudentDemoGradingModal({
  cls,
  student,
  courseCriteria,
  defaultDemoDate,
  onClose,
  onSaved,
  token,
}: {
  cls: AttendanceClass
  student: Student
  courseCriteria: {
    hasCriteria?: boolean
    hasCourseCriteria?: boolean
    hasCommonCriteria?: boolean
    weights?: {
      courseWeight?: number
      commonWeight?: number
      courseWeightPercent: number
      commonWeightPercent: number
    }
    courseCriteria?: any
    commonCriteria?: any
    courseRubric?: {
      weightPercent: number
      totalMaxScore: number
      groups: any[]
      itemsCount: number
    }
    commonRubric?: {
      weightPercent: number
      totalMaxScore: number
      groups: any[]
      itemsCount: number
    }
    totalMaxScore: number
    groups: Array<{ groupName: string; rubricType?: string; weight?: number; weightPercent?: number; totalGroupScore: number; items: any[] }>
    data: any[]
  }
  defaultDemoDate?: string
  onClose: () => void
  onSaved?: (studentId: string) => void
  token?: string | null
}) {
  const { user } = useAuth()
  const perm = useMemo(() => getGradingPermission(cls, user), [cls, user])

  // Xác định tên GV phụ trách (Lec) của lớp
  const lecName = useMemo(() => {
    if (cls.lecTeachers && cls.lecTeachers.length > 0) {
      return cls.lecTeachers.join(', ')
    }
    const foundLec = cls.classTeachers?.find((t) => {
      const r = (t.roleShortName || t.roleName || '').toUpperCase()
      return r === 'LEC' || r.includes('LECTURER') || r.includes('GIANG VIEN')
    })
    if (foundLec?.fullName) return foundLec.fullName
    return cls.allTeacherNames?.[0] || cls.operatorName || ''
  }, [cls])

  // Xác định user hiện tại có phải là Lec và/hoặc Judge của lớp không
  const { isCurrentLec, isCurrentJudge } = useMemo(() => {
    const userEmail = (user?.email || '').trim().toLowerCase()
    const userName = (user?.displayName || (user as any)?.name || '').trim().toLowerCase()

    const hasLecAccess = Boolean(
      cls.accessRoles?.some((r) => r === 'LEC' || r.includes('LECTURER') || r.includes('GIANG_VIEN'))
    )
    const hasJudgeAccess = Boolean(
      cls.accessRoles?.some((r) => r === 'JUDGE' || r.includes('JUDGE') || r.includes('BGK'))
    )

    const isLecMatch = Boolean(
      hasLecAccess ||
      (userName && cls.lecTeachers?.some((name) => name.toLowerCase() === userName)) ||
      cls.allTeachers?.some((t) => {
        const email = (t.email || '').toLowerCase()
        const name = (t.fullName || '').toLowerCase()
        const role = (t.roleShortName || t.roleName || '').toUpperCase()
        const isLecRole = role === 'LEC' || role.includes('LECTURER') || role.includes('GIANG VIEN')
        return isLecRole && (email === userEmail || (userName && name === userName))
      })
    )

    const isJudgeMatch = Boolean(
      hasJudgeAccess ||
      cls.allTeachers?.some((t) => {
        const email = (t.email || '').toLowerCase()
        const name = (t.fullName || '').toLowerCase()
        const role = (t.roleShortName || t.roleName || '').toUpperCase()
        const isJudgeRole = role === 'JUDGE' || role === 'BGK' || role.includes('GIAM KHAO')
        return isJudgeRole && (email === userEmail || (userName && name === userName))
      })
    )

    return { isCurrentLec: isLecMatch, isCurrentJudge: isJudgeMatch }
  }, [cls, user])

  // Phân quyền sửa cho Lec và Judge:
  // Nếu là Manager: được sửa cả 2
  // Nếu không có role manager: Lec chỉ sửa được phần của Lec, Judge chỉ sửa được phần của Judge
  const canEditLec = useMemo(() => {
    if (!perm.canEdit) return false
    if (perm.isManager) return true
    return isCurrentLec
  }, [perm.canEdit, perm.isManager, isCurrentLec])

  const canEditJudge = useMemo(() => {
    if (!perm.canEdit) return false
    if (perm.isManager) return true
    return isCurrentJudge
  }, [perm.canEdit, perm.isManager, isCurrentJudge])

  const todayStr = useMemo(() => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }, [])

  // Hình thức dự án: Tự động nhận diện (Lập Trình App, Lập Trình Game, Lập Trình Scratch,...)
  const projectType = detectProjectType(cls)

  const [demoDate, setDemoDate] = useState(() => toDDMMYYYY(defaultDemoDate || '') || todayStr)
  const [evalDate, setEvalDate] = useState(todayStr)
  const [bgk1Note, setBgk1Note] = useState('')
  const [bgk2Note, setBgk2Note] = useState('')
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState<{ by: string; at: string } | null>(null)
  const [items, setItems] = useState<Record<string | number, StudentDemoGradeItemState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Kiểm tra xem có GV chấm (Judge) / BGK2 hay không
  const judgeInfo = useMemo(() => {
    const isJudgeRole = (r: string) => {
      const s = (r || '').toUpperCase()
      return (
        s === 'JUDGE' ||
        s === 'BGK' ||
        s.includes('GIAM KHAO') ||
        s.includes('GIÁM KHẢO') ||
        s.includes('JUDGE')
      )
    }

    // 1. Tìm trong allTeachers hoặc classTeachers giáo viên có vai trò Judge / BGK
    const foundJudge = cls.allTeachers?.find((t) => isJudgeRole(t.roleShortName || t.roleName))
    if (foundJudge?.fullName) {
      return { hasJudge: true, name: foundJudge.fullName }
    }

    // 2. Tìm trong slot cuối cùng (buổi demo)
    const lastSlot = cls.slots?.[cls.slots.length - 1]
    if (lastSlot?.teachers && lastSlot.teachers.length > 0) {
      const slotJudge = lastSlot.teachers.find((t) => isJudgeRole(t.roleShortName || t.roleName))
      if (slotJudge?.fullName) {
        return { hasJudge: true, name: slotJudge.fullName }
      }

      // Có giáo viên khác với Lec và không phải là Trợ giảng (TA)
      const isTaRole = (r: string) => {
        const s = (r || '').toUpperCase()
        return s === 'TA' || s.includes('TRO GIANG') || s.includes('TRỢ GIẢNG')
      }
      const otherTeacher = lastSlot.teachers.find(
        (t) => t.fullName && t.fullName !== lecName && !isTaRole(t.roleShortName || t.roleName)
      )
      if (otherTeacher?.fullName) {
        return { hasJudge: true, name: otherTeacher.fullName }
      }
    }

    // 3. Nếu người dùng đang đăng nhập có quyền JUDGE_SESSION_14 trên lớp và khác với Lec
    if (cls.accessRoles?.includes('JUDGE_SESSION_14') && user?.displayName && user.displayName !== lecName) {
      return { hasJudge: true, name: user.displayName }
    }

    // 4. Nếu trước đó đã có nhận xét BGK2 được lưu trong DB
    if (bgk2Note && bgk2Note.trim().length > 0) {
      return { hasJudge: true, name: '' }
    }

    return { hasJudge: false, name: '' }
  }, [cls, lecName, user, bgk2Note])

  // Flattened list of items
  const allItems = useMemo(() => {
    return courseCriteria.groups.flatMap((g) =>
      g.items.map((it) => ({
        ...it,
        groupName: g.groupName,
        rubricType: g.rubricType || 'course',
      }))
    )
  }, [courseCriteria])

  const totalItemsCount = allItems.length

  useEffect(() => {
    let active = true

    // Initialize defaults
    const initial: Record<string | number, StudentDemoGradeItemState> = {}
    allItems.forEach((it) => {
      const max = Math.round((Number(it.maxScore) || 0) * 1000) / 1000
      initial[it.id] = {
        level: 'Tốt',
        earnedScore: max,
        note: '',
        noteJudge: '',
      }
    })
    setItems(initial)

    // Load from DB
    fetch(`/api/user/student-demo-grade?classId=${encodeURIComponent(cls.id)}&studentId=${encodeURIComponent(student.id)}`, {
      headers: { ...authHeaders(token) },
    })
      .then((res) => res.json())
      .then((res) => {
        if (!active) return
        if (res?.success && res?.data) {
          const d = res.data
          if (d.demoDate) setDemoDate(toDDMMYYYY(d.demoDate))
          if (d.evalDate) setEvalDate(toDDMMYYYY(d.evalDate))
          if (d.note) setBgk1Note(d.note)
          if (d.bgk2Note) setBgk2Note(d.bgk2Note)

          if (d.updatedAt) {
            const dt = new Date(d.updatedAt)
            const atStr = !isNaN(dt.getTime())
              ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
              : ''
            const byStr = d.updatedByName || d.updatedByEmail || d.teacherEmail || ''
            if (byStr || atStr) {
              setLastUpdatedInfo({ by: byStr || 'Giảng viên', at: atStr })
            }
          }

          if (Array.isArray(d.criteriaScores) && d.criteriaScores.length > 0) {
            setItems((prev) => {
              const next = { ...prev }
              d.criteriaScores.forEach((saved: any) => {
                const idKey = saved.itemId ?? saved.id
                if (idKey !== undefined && next[idKey]) {
                  const savedScore = typeof saved.earnedScore === 'number'
                    ? saved.earnedScore
                    : parseFloat(saved.earnedScore) || 0
                  next[idKey] = {
                    level: saved.level || next[idKey].level,
                    earnedScore: Math.round(savedScore * 1000) / 1000,
                    note: saved.noteLec || saved.note || '',
                    noteJudge: saved.noteJudge || '',
                  }
                }
              })
              return next
            })
          }
        }
      })
      .catch((err) => console.error('Error loading student demo grade:', err))
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [cls.id, student.id, allItems, token])

  const handleLevelChange = (
    itemId: string | number,
    maxScore: number,
    level: 'Chưa đạt' | 'Hoàn thành' | 'Tốt'
  ) => {
    let earned = Math.round(Number(maxScore) * 1000) / 1000
    if (level === 'Chưa đạt') earned = 0
    else if (level === 'Hoàn thành') earned = Math.round(maxScore * 0.5 * 1000) / 1000

    setItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        level,
        earnedScore: earned,
      },
    }))
  }

  const handleScoreChange = (itemId: string | number, score: number) => {
    const rounded = isNaN(score) ? 0 : Math.round(score * 1000) / 1000
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        earnedScore: rounded,
      },
    }))
  }

  const handleNoteChange = (
    itemId: string | number,
    field: 'note' | 'noteJudge',
    value: string
  ) => {
    setItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  const isDualRubric = Boolean(
    courseCriteria.weights &&
      courseCriteria.weights.courseWeightPercent < 100 &&
      courseCriteria.weights.commonWeightPercent > 0
  )

  const { totalScore, maxPossibleScore } = useMemo(() => {
    if (isDualRubric) {
      const courseItems = allItems.filter((it) => it.rubricType !== 'common')
      const commonItems = allItems.filter((it) => it.rubricType === 'common')

      const courseMax = courseItems.reduce((s, it) => s + (Number(it.maxScore) || 0), 0)
      const commonMax = commonItems.reduce((s, it) => s + (Number(it.maxScore) || 0), 0)

      const courseEarned = courseItems.reduce(
        (s, it) => s + (Number(items[it.id]?.earnedScore) || 0),
        0
      )
      const commonEarned = commonItems.reduce(
        (s, it) => s + (Number(items[it.id]?.earnedScore) || 0),
        0
      )

      const courseWeighted = courseMax > 0 ? (courseEarned / courseMax) * 5.0 * 0.6 : 0
      const commonWeighted = commonMax > 0 ? (commonEarned / commonMax) * 5.0 * 0.4 : 0

      return {
        totalScore: Math.round((courseWeighted + commonWeighted) * 1000) / 1000,
        maxPossibleScore: 5.0,
      }
    } else {
      const earnedTotal = allItems.reduce(
        (s, it) => s + (Number(items[it.id]?.earnedScore) || 0),
        0
      )
      const maxTotal = allItems.reduce(
        (s, it) => s + (Number(it.maxScore) || 0),
        0
      )
      return {
        totalScore: Math.round(earnedTotal * 1000) / 1000,
        maxPossibleScore: maxTotal > 0 ? Math.round(maxTotal * 1000) / 1000 : 5.0,
      }
    }
  }, [allItems, items, isDualRubric])

  const handleSave = async () => {
    if (!perm.canEdit) {
      toast.error(perm.reason || 'Bạn không có quyền chỉnh sửa bảng điểm này.')
      return
    }
    setIsSaving(true)
    try {
      const payloadCriteria = allItems.map((it) => {
        const cur = items[it.id]
        return {
          itemId: it.id,
          groupName: it.groupName,
          content: it.content,
          maxScore: Number(it.maxScore) || 0,
          rubricType: it.rubricType,
          level: cur?.level || 'Tốt',
          earnedScore: cur?.earnedScore ?? (Number(it.maxScore) || 0),
          note: cur?.note || '',
          noteLec: cur?.note || '',
          noteJudge: cur?.noteJudge || '',
        }
      })

      const res = await fetch('/api/user/student-demo-grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          classId: cls.id,
          studentId: student.id,
          courseId: cls.courseId || '',
          projectType,
          criteriaScores: payloadCriteria,
          totalScore,
          maxPossibleScore,
          note: bgk1Note,
          bgk2Note,
          demoDate,
          evalDate,
          updatedByName: user?.displayName || user?.email || 'Giảng viên',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Lỗi khi lưu bảng điểm học viên')
        return
      }

      if (data?.data?.updatedAt) {
        const dt = new Date(data.data.updatedAt)
        const atStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
        setLastUpdatedInfo({
          by: user?.displayName || user?.email || 'Bạn',
          at: atStr,
        })
      }

      toast.success(`Đã lưu bảng điểm demo cho học viên ${student.fullName}`)
      onSaved?.(student.id)
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối khi lưu bảng điểm')
    } finally {
      setIsSaving(false)
    }
  }

  let globalRowCounter = 0

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 md:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-gray-300">
        {/* Header Title */}
        <div className="pt-5 pb-3 px-6 text-center border-b border-gray-200 bg-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl md:text-2xl font-black text-[#a1001f] tracking-wide uppercase">
            Bảng chấm điểm buổi demo {cls.courseName || cls.name}
          </h2>
          {isDualRubric && (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs">
              <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                🎯 Chuyên môn: 60%
              </span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                🌐 Tiêu chí chung: 40%
              </span>
            </div>
          )}
        </div>

        {/* Thông báo quyền chấm điểm / Thời hạn */}
        {perm.reason ? (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="font-medium">{perm.reason}</span>
          </div>
        ) : perm.timeNotice ? (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span className="font-medium">{perm.timeNotice}</span>
            </div>
            {perm.isManager && (
              <span className="font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px]">
                Quyền Quản lý
              </span>
            )}
          </div>
        ) : null}

        {/* Info Grid (Matches screenshot format) */}
        <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 min-w-[130px]">Họ và tên Học viên:</span>
            <span className="font-bold text-gray-950 text-base">{student.fullName}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 min-w-[120px]">Ngày Demo:</span>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={demoDate}
                onChange={(e) => setDemoDate(e.target.value)}
                className="h-8 w-32 px-2.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-800 focus:border-[#a1001f] focus:outline-none"
              />
              <div className="relative ml-1">
                <button
                  type="button"
                  tabIndex={-1}
                  className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                  title="Chọn ngày Demo"
                >
                  <CalendarDays className="h-4 w-4 text-gray-600" />
                </button>
                <input
                  type="date"
                  value={toYYYYMMDD(demoDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDemoDate(toDDMMYYYY(e.target.value))
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 min-w-[120px]">Ngày đánh giá:</span>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={evalDate}
                onChange={(e) => setEvalDate(e.target.value)}
                className="h-8 w-32 px-2.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-800 focus:border-[#a1001f] focus:outline-none"
              />
              <div className="relative ml-1">
                <button
                  type="button"
                  tabIndex={-1}
                  className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                  title="Chọn ngày đánh giá"
                >
                  <CalendarDays className="h-4 w-4 text-gray-600" />
                </button>
                <input
                  type="date"
                  value={toYYYYMMDD(evalDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setEvalDate(toDDMMYYYY(e.target.value))
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="projectTypeInput" className="font-bold text-gray-700 min-w-[130px]">Hình thức dự án:</label>
            <input
              id="projectTypeInput"
              type="text"
              readOnly
              value={projectType}
              className="h-8 px-2.5 rounded border border-gray-300 bg-gray-100 text-sm font-medium text-gray-800 focus:outline-none cursor-default"
            />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <span className="font-bold text-gray-700 min-w-[130px]">Tổng điểm đạt được:</span>
            <span className="font-black text-xl text-[#a1001f] font-mono">
              {formatScoreMax3(totalScore)} / {formatScoreMax3(maxPossibleScore)}
            </span>
          </div>

          {/* Phần cập nhật lần cuối */}
          <div className="col-span-full flex items-center justify-between gap-2 pt-2 border-t border-gray-200/80 text-xs text-gray-600">
            {lastUpdatedInfo ? (
              <div className="flex items-center gap-1.5 text-amber-900 bg-amber-50/80 border border-amber-200 px-3 py-1 rounded-md">
                <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>
                  Cập nhật lần cuối: <strong className="text-gray-950 font-semibold">{lastUpdatedInfo.by}</strong> vào lúc <strong className="text-gray-950 font-semibold">{lastUpdatedInfo.at}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>Chưa có dữ liệu chấm điểm trước đó cho học viên này</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" />
              <p className="mt-2 text-sm">Đang tải bảng điểm học viên...</p>
            </div>
          ) : (
            <>
              {/* Bảng tiêu chí đúng theo thiết kế */}
              <div className="border border-red-900 rounded-md overflow-hidden shadow-xs">
                <table className="w-full table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[160px]" />
                    <col />
                    <col className="w-[75px]" />
                    <col className="w-[195px]" />
                    <col className="w-[85px]" />
                    {judgeInfo.hasJudge ? (
                      <>
                        <col className="w-[135px]" />
                        <col className="w-[135px]" />
                      </>
                    ) : (
                      <col className="w-[180px]" />
                    )}
                    <col className="w-[105px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#a1001f] text-white font-bold text-center border-b border-red-900 divide-x divide-red-800">
                      <th className="py-2.5 px-3 text-center">Tiêu chí đầu ra</th>
                      <th className="py-2.5 px-3 text-center">Nội dung</th>
                      <th className="py-2.5 px-2 text-center">Điểm tối đa</th>
                      <th className="py-2.5 px-2 text-center">
                        <div>Mức độ đạt được</div>
                        <div className="text-[10px] font-normal opacity-90">(Chưa đạt - Hoàn thành - Tốt)</div>
                      </th>
                      <th className="py-2.5 px-2 text-center">
                        <div>Điểm đạt được</div>
                        <div className="text-[10px] font-normal opacity-90">(Tự động tính)</div>
                      </th>
                      {judgeInfo.hasJudge ? (
                        <>
                          <th className="py-2.5 px-2 text-center">
                            <div>Ghi chú Lec</div>
                            {lecName && <div className="text-[10px] font-normal opacity-90 truncate max-w-[125px] mx-auto">({lecName})</div>}
                          </th>
                          <th className="py-2.5 px-2 text-center">
                            <div>Ghi chú Judge</div>
                            {judgeInfo.name && <div className="text-[10px] font-normal opacity-90 truncate max-w-[125px] mx-auto">({judgeInfo.name})</div>}
                          </th>
                        </>
                      ) : (
                        <th className="py-2.5 px-2 text-center">
                          <div>Ghi chú</div>
                          {lecName && <div className="text-[10px] font-normal opacity-90 truncate max-w-[170px] mx-auto">({lecName})</div>}
                        </th>
                      )}
                      <th className="py-2.5 px-2 text-center">Tổng Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {courseCriteria.groups.map((group, gIdx) => {
                      const isCommon = group.rubricType === 'common'
                      const isFirstInType =
                        gIdx === 0 || courseCriteria.groups[gIdx - 1]?.rubricType !== group.rubricType

                      return (
                        <Fragment key={group.groupName || gIdx}>
                          {isFirstInType && isDualRubric && (
                            <tr className={isCommon ? 'bg-emerald-50 text-emerald-900 font-bold border-t-2 border-emerald-300 divide-x divide-emerald-200' : 'bg-indigo-50 text-indigo-900 font-bold border-t-2 border-indigo-300 divide-x divide-indigo-200'}>
                              <td colSpan={judgeInfo.hasJudge ? 8 : 7} className="py-1.5 px-3 text-xs uppercase tracking-wider">
                                {isCommon
                                  ? `🌐 TIÊU CHÍ CHẤM ĐIỂM CHUNG (TRỌNG SỐ ${courseCriteria.weights?.commonWeightPercent}%)`
                                  : `🎯 TIÊU CHÍ CHUYÊN MÔN THEO KHÓA (TRỌNG SỐ ${courseCriteria.weights?.courseWeightPercent}%)`}
                              </td>
                            </tr>
                          )}

                          {group.items.map((item, iIdx) => {
                            const isGlobalFirst = globalRowCounter === 0
                            globalRowCounter++
                            const cur = items[item.id] || {
                              level: 'Tốt',
                              earnedScore: Number(item.maxScore) || 0,
                              note: '',
                              noteJudge: '',
                            }

                            return (
                              <tr key={item.id || `${gIdx}-${iIdx}`} className="hover:bg-red-50/20 divide-x divide-gray-200">
                                {/* Cột 1: Tiêu chí đầu ra (gộp theo nhóm) */}
                                {iIdx === 0 && (
                                  <td
                                    rowSpan={group.items.length}
                                    className="py-3 px-3 font-bold text-gray-950 bg-gray-50/80 align-top text-xs"
                                  >
                                    <div className="font-bold text-gray-900 leading-snug">
                                      {cleanGroupTitle(group.groupName)}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-mono mt-1 font-normal">
                                      ({formatScoreMax3(
                                        group.items.reduce((sum: number, it: any) => sum + (Number(it.maxScore) || 0), 0)
                                      )} điểm)
                                    </div>
                                  </td>
                                )}

                                {/* Cột 2: Nội dung */}
                                <td className="py-2.5 px-3 text-gray-800 align-middle text-xs break-words leading-relaxed">
                                  {item.content}
                                </td>

                                {/* Cột 3: Điểm tối đa */}
                                <td className="py-2.5 px-2 text-center font-mono font-semibold text-gray-900 align-middle">
                                  {formatScoreMax3(item.maxScore)}
                                </td>

                                {/* Cột 4: Mức độ đạt được (3 nút) */}
                                <td className="py-2 px-1 text-center align-middle">
                                  <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-[11px] font-semibold shadow-xs">
                                    <button
                                      type="button"
                                      disabled={!perm.canEdit}
                                      onClick={() => handleLevelChange(item.id, Number(item.maxScore) || 0, 'Chưa đạt')}
                                      className={cn(
                                        'px-2 py-1 transition-colors whitespace-nowrap disabled:cursor-not-allowed',
                                        cur.level === 'Chưa đạt'
                                          ? 'bg-rose-600 text-white font-bold'
                                          : 'bg-white text-gray-600 hover:bg-rose-50'
                                      )}
                                    >
                                      Chưa đạt
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!perm.canEdit}
                                      onClick={() => handleLevelChange(item.id, Number(item.maxScore) || 0, 'Hoàn thành')}
                                      className={cn(
                                        'px-2 py-1 border-x border-gray-300 transition-colors whitespace-nowrap disabled:cursor-not-allowed',
                                        cur.level === 'Hoàn thành'
                                          ? 'bg-amber-500 text-white font-bold'
                                          : 'bg-white text-gray-600 hover:bg-amber-50'
                                      )}
                                    >
                                      Hoàn thành
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!perm.canEdit}
                                      onClick={() => handleLevelChange(item.id, Number(item.maxScore) || 0, 'Tốt')}
                                      className={cn(
                                        'px-2 py-1 transition-colors whitespace-nowrap disabled:cursor-not-allowed',
                                        cur.level === 'Tốt'
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'bg-white text-gray-600 hover:bg-emerald-50'
                                      )}
                                    >
                                      Tốt
                                    </button>
                                  </div>
                                </td>

                                {/* Cột 5: Điểm đạt được (Tự tính, không cho nhập) */}
                                <td className="py-2 px-1 text-center align-middle">
                                  <div
                                    className={cn(
                                      'inline-flex items-center justify-center min-w-[50px] px-2 py-1 rounded text-xs font-mono font-bold border',
                                      cur.level === 'Tốt'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : cur.level === 'Hoàn thành'
                                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                                          : 'bg-rose-50 text-rose-800 border-rose-300'
                                    )}
                                    title="Điểm tự động tính theo Mức độ đạt được"
                                  >
                                    {formatScoreMax3(cur.earnedScore)}
                                  </div>
                                </td>

                                {judgeInfo.hasJudge ? (
                                  <>
                                    {/* Cột 6: Ghi chú Lec */}
                                    <td className="py-2 px-1.5 align-middle">
                                      <input
                                        type="text"
                                        placeholder={canEditLec ? (lecName ? `Ghi chú ${lecName}...` : 'Ghi chú Lec...') : ''}
                                        disabled={!canEditLec}
                                        value={cur.note || ''}
                                        onChange={(e) => handleNoteChange(item.id, 'note', e.target.value)}
                                        className="w-full h-7 px-2 text-xs border border-gray-300 rounded focus:border-[#a1001f] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        title={!canEditLec ? 'Chỉ GV phụ trách (Lec) hoặc Quản lý được nhập ghi chú này' : undefined}
                                      />
                                    </td>

                                    {/* Cột 7: Ghi chú Judge */}
                                    <td className="py-2 px-1.5 align-middle">
                                      <input
                                        type="text"
                                        placeholder={canEditJudge ? (judgeInfo.name ? `Ghi chú ${judgeInfo.name}...` : 'Ghi chú Judge...') : ''}
                                        disabled={!canEditJudge}
                                        value={cur.noteJudge || ''}
                                        onChange={(e) => handleNoteChange(item.id, 'noteJudge', e.target.value)}
                                        className="w-full h-7 px-2 text-xs border border-gray-300 rounded focus:border-[#a1001f] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        title={!canEditJudge ? 'Chỉ GV chấm (Judge) hoặc Quản lý được nhập ghi chú này' : undefined}
                                      />
                                    </td>
                                  </>
                                ) : (
                                  /* Cột 6: Ghi chú (chỉ có Lec) */
                                  <td className="py-2 px-1.5 align-middle">
                                    <input
                                      type="text"
                                      placeholder={canEditLec ? (lecName ? `Ghi chú ${lecName}...` : 'Ghi chú...') : ''}
                                      disabled={!canEditLec}
                                      value={cur.note || ''}
                                      onChange={(e) => handleNoteChange(item.id, 'note', e.target.value)}
                                      className="w-full h-7 px-2 text-xs border border-gray-300 rounded focus:border-[#a1001f] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      title={!canEditLec ? 'Chỉ GV phụ trách (Lec) hoặc Quản lý được nhập ghi chú này' : undefined}
                                    />
                                  </td>
                                )}

                                {/* Cột cuối: Tổng Điểm (Gộp toàn bảng thành 1 ô lớn như ảnh mẫu) */}
                                {isGlobalFirst && (
                                  <td
                                    rowSpan={totalItemsCount}
                                    className="text-center align-middle bg-red-50/20 p-2 border-l border-red-900"
                                  >
                                    <div className="font-black font-mono text-2xl md:text-3xl text-gray-950">
                                      {formatScoreMax3(totalScore)}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-semibold mt-1">
                                      / {formatScoreMax3(maxPossibleScore)}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bảng Nhận xét (BGK1 và BGK2 nếu có, hoặc chỉ BGK nếu chỉ có Lec) */}
              <div className="border border-red-900 rounded-md overflow-hidden shadow-xs">
                <div className="bg-[#a1001f] text-white font-bold text-center py-2 text-sm uppercase tracking-wide">
                  Nhận xét
                </div>
                {judgeInfo.hasJudge ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-red-900 bg-white">
                    <div className="p-3">
                      <label htmlFor="bgk1Textarea" className="block text-center font-bold text-xs uppercase tracking-wide text-[#a1001f] mb-1.5">
                        BGK1 (Lec){lecName ? ` (${lecName})` : ''}
                      </label>
                      <textarea
                        id="bgk1Textarea"
                        rows={4}
                        disabled={!canEditLec}
                        value={bgk1Note}
                        onChange={(e) => setBgk1Note(e.target.value)}
                        placeholder={canEditLec ? (lecName ? `Nhập nhận xét của ${lecName}...` : 'Nhập nhận xét của BGK1...') : 'Chỉ GV phụ trách (Lec) hoặc Quản lý được nhập nhận xét này'}
                        className="w-full p-2.5 text-xs border border-gray-300 rounded-md focus:border-[#a1001f] focus:outline-none resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="p-3">
                      <label htmlFor="bgk2Textarea" className="block text-center font-bold text-xs uppercase tracking-wide text-[#a1001f] mb-1.5">
                        BGK2 (Judge){judgeInfo.name ? ` (${judgeInfo.name})` : ''}
                      </label>
                      <textarea
                        id="bgk2Textarea"
                        rows={4}
                        disabled={!canEditJudge}
                        value={bgk2Note}
                        onChange={(e) => setBgk2Note(e.target.value)}
                        placeholder={canEditJudge ? (judgeInfo.name ? `Nhập nhận xét của ${judgeInfo.name}...` : 'Nhập nhận xét của BGK2...') : 'Chỉ GV chấm (Judge) hoặc Quản lý được nhập nhận xét này'}
                        className="w-full p-2.5 text-xs border border-gray-300 rounded-md focus:border-[#a1001f] focus:outline-none resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-3">
                    <label htmlFor="bgk1Textarea" className="block text-center font-bold text-xs uppercase tracking-wide text-[#a1001f] mb-1.5">
                      BGK{lecName ? ` (${lecName})` : ''}
                    </label>
                    <textarea
                      id="bgk1Textarea"
                      rows={4}
                      disabled={!canEditLec}
                      value={bgk1Note}
                      onChange={(e) => setBgk1Note(e.target.value)}
                      placeholder={canEditLec ? (lecName ? `Nhập nhận xét của ${lecName}...` : 'Nhập nhận xét của BGK...') : 'Chỉ GV phụ trách (Lec) hoặc Quản lý được nhập nhận xét này'}
                      className="w-full p-2.5 text-xs border border-gray-300 rounded-md focus:border-[#a1001f] focus:outline-none resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {!perm.canEdit ? (
              <span className="text-amber-800 font-medium flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                {perm.reason || 'Bảng điểm đang ở chế độ xem, không được chỉnh sửa.'}
              </span>
            ) : isDualRubric ? (
              'Điểm tổng kết = (Chuyên môn × 60%) + (Chung × 40%) quy về thang 5.'
            ) : (
              'Điểm tổng kết tính theo tổng điểm các tiêu chí của khóa học.'
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              {perm.canEdit ? 'Hủy' : 'Đóng'}
            </button>
            {perm.canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="px-6 py-2 rounded-lg bg-[#a1001f] hover:bg-red-800 text-xs font-bold text-white shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu bảng điểm
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassAttendanceDrawer({
  cls,
  onClose,
  onRefresh,
  onClassUpdated,
}: {
  cls: AttendanceClass | null
  onClose: () => void
  onRefresh: () => void
  onClassUpdated: (nextClass: AttendanceClass) => void
}) {
  const { token, user } = useAuth()
  const perm = useMemo(() => {
    if (!cls) return { canGrade: false, canEdit: false, isManager: false, isLecOrJudge: false, reason: '' }
    return getGradingPermission(cls, user)
  }, [cls, user])
  const [activeTab, setActiveTab] = useQueryState<'attendance' | 'comments'>('tab', 'attendance', { values: ["attendance","comments"], history: 'push' })
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null)
  const [selectedClassSiteId, setSelectedClassSiteId] = useState('')
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [showUpdateNote, setShowUpdateNote] = useState(true)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Tiêu chí chấm điểm khóa học của lớp này (hỗ trợ phân loại chuyên môn 60% / chung 40%)
  const [courseCriteria, setCourseCriteria] = useState<{
    hasCriteria: boolean
    hasCourseCriteria?: boolean
    hasCommonCriteria?: boolean
    weights?: {
      courseWeight: number
      commonWeight: number
      courseWeightPercent: number
      commonWeightPercent: number
    }
    courseCriteria?: {
      hasCriteria: boolean
      weight: number
      weightPercent: number
      totalMaxScore: number
      groups: any[]
      itemsCount: number
    }
    commonCriteria?: {
      hasCriteria: boolean
      weight: number
      weightPercent: number
      totalMaxScore: number
      groups: any[]
      itemsCount: number
    }
    totalMaxScore: number
    groups: Array<{ groupName: string; rubricType?: string; weight?: number; weightPercent?: number; totalGroupScore: number; items: any[] }>
    data: any[]
  } | null>(null)

  // Học viên đang được mở modal chấm điểm
  const [gradingStudent, setGradingStudent] = useState<Student | null>(null)

  // Danh sách ID học viên đã có điểm chấm được lưu trong DB
  const [gradedStudentIds, setGradedStudentIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setActiveTab('attendance')
    setSelectedSessionIndex(null)
    setSelectedClassSiteId(cls?.classSites?.[0]?.id || '')
    setDraftStatuses({})
    setShowUpdateNote(true)
    setIsSavingAttendance(false)
    setSaveResult(null)
    setGradingStudent(null)
    setGradedStudentIds(new Set())
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

  // Lấy danh sách tóm tắt học viên đã có điểm trong lớp
  useEffect(() => {
    if (!cls?.id) return

    fetch(`/api/user/student-demo-grade?classId=${encodeURIComponent(cls.id)}`, {
      headers: { ...authHeaders(token) },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.data)) {
          setGradedStudentIds(new Set(data.data.map((d: any) => String(d.studentId))))
        }
      })
      .catch((err) => console.error('Error fetching graded student summary:', err))
  }, [cls?.id, token])

  // Tải tiêu chí chấm điểm của khóa học từ DB (nếu có)
  useEffect(() => {
    if (!cls?.courseId && !cls?.courseName) {
      setCourseCriteria(null)
      return
    }

    const params = new URLSearchParams()
    if (cls.courseId) params.append('courseId', cls.courseId.trim())
    if (cls.courseName) params.append('courseName', cls.courseName.trim())
    if (cls.courseShortName) params.append('courseShortName', cls.courseShortName.trim())
    if (cls.courseLineName) params.append('courseLineName', cls.courseLineName.trim())
    if (cls.name) params.append('className', cls.name.trim())

    fetch(`/api/user/course-grading-criteria?${params.toString()}`, {
      headers: { ...authHeaders(token) },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.hasCriteria) {
          setCourseCriteria(data)
        } else {
          setCourseCriteria(null)
        }
      })
      .catch(() => setCourseCriteria(null))
  }, [cls?.courseId, cls?.courseName, cls?.courseShortName, cls?.courseLineName, cls?.name, token])

  if (!cls) return null

  const classId = cls.id
  const visual = courseVisual(cls)
  const CourseIcon = visual.icon
  const slots = buildDisplaySlots(cls)
  const realSlots = slots.filter((s) => !s.isPlaceholder)
  const lastRealSlotIndex = realSlots.length > 0 ? realSlots.length - 1 : -1
  const selectedSlot = selectedSessionIndex === null ? null : slots[selectedSessionIndex] || null
  const classSites = cls.classSites || []
  const selectedClassSite = classSites.find((classSite) => classSite.id === selectedClassSiteId)
  const visibleStudents = cls.students.filter((student) => {
    if (!selectedClassSiteId) return classSites.length <= 1
    return student.classSiteId === selectedClassSiteId || (!student.classSiteId && classSites.length <= 1)
  })
  const teacherRows = teacherRowsForClass(cls)
  const normalizedCurrentUserEmail = String(user?.email || '').trim().toLowerCase()
  const currentTeacher = teacherRows.find(
    (teacher) => teacher.email.trim().toLowerCase() === normalizedCurrentUserEmail,
  )
  const selectedTeacherRows = selectedSlot
    ? teacherRows.filter((teacher) => teacherIsAssignedForSelectedSite(selectedSlot, teacher))
    : []
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
  const teacherRowsToSubmit = selectedTeacherRows.filter((teacher) => currentTeacher?.id !== teacher.id)
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
  const canSaveAttendance = Boolean(
    selectedSlot &&
    selectedClassSiteId &&
    isSlotOpen(selectedSlot) &&
    hasDraftChanges &&
    allStudentsRecorded &&
    allOtherTeachersRecorded &&
    !isSavingAttendance,
  )

  function teacherIsAssignedForSelectedSite(slot: ClassSlot, teacher: TeacherRow): boolean {
    const siteTeacherIds = selectedClassSite?.slotTeacherIds?.[slot.id]
    if (siteTeacherIds) return siteTeacherIds.includes(teacher.id)
    return teacherIsAssignedToSlot(slot, teacher)
  }

  function addAutomaticTeacherAttendance(
    current: Record<string, AttendanceStatus>,
    slot: ClassSlot,
  ): Record<string, AttendanceStatus> {
    if (
      !currentTeacher ||
      !teacherIsAssignedForSelectedSite(slot, currentTeacher) ||
      visibleStudents.length === 0
    ) return current

    const studentsComplete = visibleStudents.every((student) => {
      const key = attendanceKey(classId, slot.id, student.id)
      return (current[key] || studentStatus(slot, student.id)) !== 'NOT_RECORDED'
    })
    if (!studentsComplete) return current

    const teacherKey = attendanceKey(classId, slot.id, currentTeacher.id)
    const currentStatus = current[teacherKey] || teacherStatus(slot, currentTeacher.id, currentTeacher.email)
    if (currentStatus !== 'NOT_RECORDED') return current

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
    if (!selectedSlot || !canSaveAttendance) return

    setIsSavingAttendance(true)
    setSaveResult(null)
    try {
      const response = await fetch('/api/user/diem-danh-lop-hoc', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...authHeaders(token),
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
      setIsSavingAttendance(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-modal-title"
        className="flex h-[min(90dvh,840px)] w-[min(94vw,1180px)] flex-col overflow-hidden rounded-lg border border-white/80 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
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
                  {classSites.length > 0 ? (
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
                        {classSites.map((classSite) => (
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

          <nav className="mt-4 flex gap-1 border-t border-gray-100 bg-gray-50/70 px-1 text-sm text-gray-500" aria-label="Nội dung lớp học">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={cn(
                'border-b-2 px-3 py-3 font-medium transition-colors',
                activeTab === 'attendance'
                  ? 'border-[#a1001f] text-[#a1001f]'
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
                  ? 'border-[#a1001f] text-[#a1001f]'
                  : 'border-b-2 border-transparent hover:text-gray-900',
              )}
            >
              Nhận xét
            </button>
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f6f7f9] px-4 py-4 sm:px-5">
          {activeTab === 'comments' ? (
            <ClassCommentsPanel
              classId={classId}
              selectedClassSiteId={selectedClassSiteId}
            />
          ) : (
            <>
          <SessionJourney
            cls={cls}
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
                  <th className="sticky left-0 z-20 w-[210px] bg-white px-0 py-2" />
                  {slots.map((slot, index) => {
                    const active = index === selectedSessionIndex
                    const opened = isSlotOpen(slot)
                    const isLastSlot = !slot.isPlaceholder && (
                      index === lastRealSlotIndex ||
                      (cls.numberOfSessions && slot.sessionNumber === cls.numberOfSessions) ||
                      (cls.sessionCount && slot.sessionNumber === cls.sessionCount)
                    )
                    const isGradable = isLastSlot && Boolean(courseCriteria?.hasCriteria)
                    return (
                      <th
                        key={slot.id}
                        className={cn(
                          'px-1 py-2 text-center transition-all',
                          active
                            ? isGradable ? 'w-[330px]' : 'w-[220px]'
                            : isGradable ? 'w-[180px]' : 'w-[96px]',
                        )}
                      >
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
                          <span className="block text-sm font-semibold">
                            #{slot.sessionNumber}
                            {isGradable && (
                              <span className="ml-1 inline-block rounded bg-amber-400 px-1 py-0.2 text-[9px] font-black text-amber-950">
                                Demo
                              </span>
                            )}
                          </span>
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
                {/* Tiêu đề mục: Kiểm tra giáo viên */}
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-0 pt-4 pb-2 align-bottom">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-950">Kiểm tra giáo viên</h3>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b6fd8] text-sm font-semibold text-white">1</span>
                      </div>
                      <p className="text-sm font-semibold text-green-700">
                        {selectedSlot ? `${teacherRecorded}/${selectedTeacherRows.length} đã ghi nhận` : 'Chọn một buổi để thực hiện điểm danh'}
                      </p>
                    </div>
                  </td>
                  <td colSpan={slots.length} className="bg-white" />
                </tr>

                {teacherRows.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="sticky left-0 z-10 bg-white px-0 py-3 align-middle">
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
                        <td key={`${teacher.id}-${slot.id}`} className="px-1 py-3 text-center align-middle">
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

                {/* Tiêu đề mục: Kiểm tra học viên */}
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-0 pt-6 pb-2 align-bottom">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-950">Kiểm tra học viên</h3>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b6fd8] text-sm font-semibold text-white">2</span>
                      </div>
                      <p className="text-sm font-semibold text-green-700">
                        {selectedSlot ? `${studentRecorded}/${visibleStudents.length} đã ghi nhận` : 'Chọn một buổi để thực hiện điểm danh'}
                      </p>
                    </div>
                  </td>
                  <td colSpan={slots.length} className="bg-white" />
                </tr>

                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="sticky left-0 z-10 bg-white px-0 py-3 align-middle">
                      <StudentIdentity cls={cls} student={student} />
                    </td>
                    {slots.map((slot, index) => {
                      const attendance = findAttendance(slot, student.id)
                      const key = attendanceKey(cls.id, slot.id, student.id)
                      const status = draftStatuses[key] || studentStatus(slot, student.id)
                      const opened = isSlotOpen(slot)

                      // Buổi cuối cùng: slot thực tế cuối cùng của lớp hoặc sessionNumber bằng tổng số buổi của lớp
                      const isLastSlot = !slot.isPlaceholder && (
                        index === lastRealSlotIndex ||
                        (cls.numberOfSessions && slot.sessionNumber === cls.numberOfSessions) ||
                        (cls.sessionCount && slot.sessionNumber === cls.sessionCount)
                      )
                      const canGradeStudent = isLastSlot && opened && Boolean(courseCriteria?.hasCriteria)
                      const isGraded = gradedStudentIds.has(student.id)
                      const buttonText = isGraded ? 'Xem điểm' : perm.canEdit ? 'Chấm điểm' : 'Xem điểm'
                      const buttonClass = isGraded
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : perm.canEdit
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-slate-700 hover:bg-slate-800'

                      return (
                        <td key={`${student.id}-${slot.id}`} className="px-1 py-3 text-center align-middle">
                          {index === selectedSessionIndex ? (
                            <div className="flex items-center justify-center gap-2">
                              <StatusControls
                                value={status}
                                hasComment={Boolean(attendance?.comment)}
                                onChange={(nextStatus) => setStudentDraft(slot, student.id, nextStatus)}
                              />
                              {canGradeStudent && (
                                <button
                                  type="button"
                                  onClick={() => setGradingStudent(student)}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white transition text-xs font-semibold shadow-xs whitespace-nowrap cursor-pointer',
                                    buttonClass
                                  )}
                                  title={
                                    isGraded
                                      ? `Xem bảng điểm demo của ${student.fullName}${perm.canEdit ? ' (Có thể chỉnh sửa)' : ''}`
                                      : perm.canEdit
                                        ? `Chấm điểm buổi demo cho ${student.fullName}`
                                        : `Xem bảng điểm demo của ${student.fullName} (${perm.reason || 'Chế độ xem'})`
                                  }
                                >
                                  <Award className="h-3.5 w-3.5" />
                                  {buttonText}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex h-8 items-center justify-center">
                                <AttendanceMark status={opened ? status : 'NOT_RECORDED'} />
                              </div>
                              {canGradeStudent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setGradingStudent(student)
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-xs transition whitespace-nowrap cursor-pointer',
                                    buttonClass
                                  )}
                                  title={
                                    isGraded
                                      ? `Xem bảng điểm demo của ${student.fullName}${perm.canEdit ? ' (Có thể chỉnh sửa)' : ''}`
                                      : perm.canEdit
                                        ? `Chấm điểm demo cho ${student.fullName}`
                                        : `Xem bảng điểm demo của ${student.fullName} (${perm.reason || 'Chế độ xem'})`
                                  }
                                >
                                  <Award className="h-3.5 w-3.5" />
                                  {buttonText}
                                </button>
                              )}
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
                            disabled={!canSaveAttendance}
                            className="mx-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#a1001f] px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#850019] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                          >
                            {isSavingAttendance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingAttendance ? 'Đang lưu...' : 'Lưu'}
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

      {/* Modal Chấm điểm demo cho học viên */}
      {gradingStudent && courseCriteria && (
        <StudentDemoGradingModal
          cls={cls}
          student={gradingStudent}
          courseCriteria={courseCriteria}
          defaultDemoDate={dateKey(realSlots[realSlots.length - 1]?.date || realSlots[realSlots.length - 1]?.startTime)}
          token={token}
          onClose={() => setGradingStudent(null)}
          onSaved={(savedStudentId) => {
            setGradedStudentIds((prev) => new Set([...prev, savedStudentId]))
          }}
        />
      )}
    </div>,
    document.body,
  )
}

function getClassRecencyScore(cls: AttendanceClass, todayMs: number): number {
  const slotDates: number[] = []
  if (Array.isArray(cls.slots)) {
    for (const slot of cls.slots) {
      if (slot.isPlaceholder) continue
      const rawDate = slot.date || slot.startTime
      if (rawDate) {
        const d = new Date(rawDate)
        if (!isNaN(d.getTime())) {
          slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
        }
      }
    }
  }

  if (slotDates.length === 0) {
    if (cls.startDate) {
      const d = new Date(cls.startDate)
      if (!isNaN(d.getTime())) {
        slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
      }
    }
    if (cls.endDate) {
      const d = new Date(cls.endDate)
      if (!isNaN(d.getTime())) {
        slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
      }
    }
  }

  if (slotDates.length === 0) {
    return 999999999
  }

  const oneDayMs = 24 * 60 * 60 * 1000

  // 1. Kiểm tra nếu có slot đúng hôm nay (chênh lệch < 12h so với 00:00 hôm nay)
  const hasToday = slotDates.some((time) => Math.abs(time - todayMs) < 12 * 60 * 60 * 1000)
  if (hasToday) {
    return 0 // Ưu tiên cao nhất
  }

  // 2. Tìm slot tương lai gần nhất (>= todayMs)
  const futureSlots = slotDates.filter((time) => time >= todayMs).sort((a, b) => a - b)
  const nextFutureSlot = futureSlots.length > 0 ? futureSlots[0] : null

  // 3. Tìm slot quá khứ gần nhất (< todayMs)
  const pastSlots = slotDates.filter((time) => time < todayMs).sort((a, b) => b - a)
  const lastPastSlot = pastSlots.length > 0 ? pastSlots[0] : null

  if (nextFutureSlot !== null && lastPastSlot !== null) {
    const futureDiffDays = (nextFutureSlot - todayMs) / oneDayMs
    const pastDiffDays = (todayMs - lastPastSlot) / oneDayMs
    if (futureDiffDays <= pastDiffDays) {
      return futureDiffDays
    } else {
      return pastDiffDays + 0.05
    }
  } else if (nextFutureSlot !== null) {
    return (nextFutureSlot - todayMs) / oneDayMs
  } else if (lastPastSlot !== null) {
    return (todayMs - lastPastSlot) / oneDayMs + 0.05
  }

  return 999999999
}

function compareClassesByRecency(a: AttendanceClass, b: AttendanceClass, todayMs: number): number {
  const scoreA = getClassRecencyScore(a, todayMs)
  const scoreB = getClassRecencyScore(b, todayMs)

  if (Math.abs(scoreA - scoreB) > 0.001) {
    return scoreA - scoreB
  }

  if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1
  if (b.status === 'RUNNING' && a.status !== 'RUNNING') return 1

  return String(a.name || '').localeCompare(String(b.name || ''), 'vi')
}

export default function TeacherClassesPage() {
  const { user, token, isLoading: authLoading } = useAuth()
  const [classes, setClasses] = useState<AttendanceClass[]>([])
  const [filters, setFilters] = useQueryFilters<FiltersState>(INITIAL_FILTERS, {"search":"search","centre":"centre","startDate":"dateFrom","endDate":"dateTo","slotFrom":"slotFrom","slotTo":"slotTo","status":"status","teacher":"teacher"})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [noLmsToken, setNoLmsToken] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [hasRequestedLoad, setHasRequestedLoad] = useState(false)
  const [page, setPage] = useQueryState<number>('page', 1)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const requestedFiltersRef = useRef<FiltersState>(INITIAL_FILTERS)

  const isLeaderRole = useMemo(() => {
    const roleCodes = [...(user?.userRoles || []), user?.role || '']
      .map((role) => String(role).trim().toUpperCase())
      .filter(Boolean)
    return roleCodes.some((role) => LEADER_ROLE_CODES.has(role))
  }, [user?.role, user?.userRoles])

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some(Boolean),
    [filters],
  )

  const loadClasses = useCallback(() => {
    if (isLeaderRole && !hasActiveFilters) return
    requestedFiltersRef.current = { ...filters }
    setHasRequestedLoad(true)
    setIsLoading(true)
    setRefreshSignal((current) => current + 1)
  }, [filters, hasActiveFilters, isLeaderRole])

  useQueryRestore(loadClasses, ['search','centre','dateFrom','dateTo','slotFrom','slotTo','status','teacher','classId'], !authLoading);

  useEffect(() => {
    if (authLoading) return

    if (isLeaderRole && !hasRequestedLoad) {
      setClasses([])
      setError('')
      setNoLmsToken(false)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const requestedFilters = requestedFiltersRef.current
    const params = new URLSearchParams()
    if (requestedFilters.search.trim()) params.set('q', requestedFilters.search.trim())
    if (requestedFilters.status) params.set('status', requestedFilters.status)
    if (requestedFilters.slotFrom) params.set('from', requestedFilters.slotFrom)
    if (requestedFilters.slotTo) params.set('to', requestedFilters.slotTo)
    const query = params.toString()

    setIsLoading(true)
    setError('')
    setNoLmsToken(false)

    fetch(`/api/user/diem-danh-lop-hoc${query ? `?${query}` : ''}`, {
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
  }, [authLoading, hasRequestedLoad, isLeaderRole, refreshSignal, token])

  const centreOptions = useMemo(
    () => buildOptions(
      [
        ...(user?.assignedCenters || []).map((centre) => centre.short_code || centre.full_name),
        ...classes.map((cls) => cls.centreShortName || cls.centreName),
      ],
      'Tất cả cơ sở',
    ),
    [classes, user?.assignedCenters],
  )

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả (Đang học, Sắp diễn ra & Đã kết thúc)' },
      { value: 'RUNNING', label: 'Đang học' },
      { value: 'PREPARING', label: 'Sắp diễn ra' },
      { value: 'FINISHED', label: 'Đã kết thúc' },
    ],
    [],
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
    const nowVn = new Date()
    const todayMs = new Date(nowVn.getFullYear(), nowVn.getMonth(), nowVn.getDate()).getTime()
    const ALLOWED_STATUSES = new Set(['RUNNING', 'FINISHED', 'PREPARING'])

    return classes
      .filter((cls) => {
        // Chỉ lấy các lớp Running, Finished, Preparing
        if (!ALLOWED_STATUSES.has(cls.status)) return false

        if (filters.status) {
          if (cls.status !== filters.status) return false
        }

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
      .sort((a, b) => compareClassesByRecency(a, b, todayMs))
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
    if (!isLoading && hasRequestedLoad && classes.length > 0 && page > totalPages) setPage(totalPages)
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

  function updateSlotRange(range: { dateFrom: string; dateTo: string }) {
    setPage(1)
    setFilters((current) => ({
      ...current,
      slotFrom: range.dateFrom,
      slotTo: range.dateTo,
    }))
  }

  function clearFilters() {
    setPage(1)
    setFilters(INITIAL_FILTERS)
    requestedFiltersRef.current = INITIAL_FILTERS
    if (isLeaderRole) {
      setClasses([])
      setError('')
      setNoLmsToken(false)
      setHasRequestedLoad(false)
      setIsLoading(false)
    }
  }

  const headerActions = !isLeaderRole || hasRequestedLoad ? (
    <div className="flex flex-wrap justify-end gap-2">
      <HeaderButton icon={RefreshCcw} onClick={loadClasses} disabled={isLoading}>
        Làm mới
      </HeaderButton>
    </div>
  ) : null

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
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#a1001f]"
                >
                  <X className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              ) : null}
              {isLeaderRole ? (
                <button
                  type="button"
                  onClick={loadClasses}
                  disabled={!hasActiveFilters || isLoading}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#a1001f] px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#87001a] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
                >
                  {isLoading && hasRequestedLoad ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Tìm lớp
                </button>
              ) : null}
            </div>
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

            <FilterField label="Có buổi học trong khoảng">
              <DateRangePicker
                dateFrom={filters.slotFrom}
                dateTo={filters.slotTo}
                onChange={updateSlotRange}
                placeholder="Chọn khoảng ngày"
                className="w-full"
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
        ) : isLeaderRole && !hasRequestedLoad ? (
          <EmptyState
            icon={Filter}
            title="Chọn bộ lọc để tải lớp học"
            description="Với tài khoản Leader, hãy chọn ít nhất một điều kiện ở phía trên rồi nhấn Tìm lớp. Danh sách sẽ không tự tải khi vừa mở trang."
          />
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
                    <th className="border-b border-gray-200 px-4 py-3 whitespace-nowrap">Lịch học</th>
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
      <ClassAttendanceDrawer
        cls={selectedClass}
        onClose={() => setSelectedClassId(null)}
        onRefresh={loadClasses}
        onClassUpdated={(nextClass) => {
          setClasses((current) => current.map((item) => item.id === nextClass.id ? nextClass : item))
        }}
      />
    </PageContainer>
  )
}
