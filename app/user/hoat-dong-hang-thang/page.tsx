'use client'

import { Card } from '@/components/Card'
import { Modal } from '@/components/ui/modal'
import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Plus,
  X,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/app-toast'

type RegistrationTemplate = 'official' | 'supplement'
type EventCategory =
  | 'registration'
  | 'exam'
  | 'thi'
  | 'workshop_teaching'
  | 'meeting'
  | 'teaching_review'
  | 'advanced_training_release'
  | 'holiday'

type CalendarView = 'month' | 'week' | 'day'

interface EvaluationEvent {
  id: string
  title: string
  specialty: string
  startAt: string
  endAt: string
  note?: string
  eventType?: EventCategory
  registrationTemplate?: RegistrationTemplate
  lectureReviewer?: string | null
  centerId?: number | null
  centerName?: string | null
  centerAddress?: string | null
  centerFullAddress?: string | null
  centerMapUrl?: string | null
  allowRegistration?: boolean
}

interface RegisteredExamParticipant {
  id: number
  teacher_code: string
  teacher_name: string | null
  exam_type: 'expertise' | 'experience'
  subject_code: string
  scheduled_at: string
  assignment_status: string | null
}

interface TeacherLookupItem {
  teacher_code: string
  lms_code: string
  teacher_name: string
  email?: string | null
  center?: string | null
}

interface CalendarExamAssignment {
  id: number
  registration_id?: number
  exam_type: 'expertise' | 'experience'
  subject_code: string
  open_at: string
  close_at: string
  event_schedule_id?: string | null
  assignment_status: string
  can_take: boolean
  is_open: boolean
  is_set_active_now: boolean
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const EVENT_TYPE_LABELS: Record<EventCategory, string> = {
  registration: 'A: Lịch đăng ký kiểm tra',
  exam: 'B: Lịch kiểm tra chuyên môn',
  thi: 'B: Lịch kiểm tra chuyên môn',
  workshop_teaching: 'C: Lịch Workshop Teaching',
  meeting: 'D: Lịch họp',
  teaching_review: 'E: Duyệt giảng chuyên môn',
  advanced_training_release: 'E: Lịch phát hành đào tạo nâng cao',
  holiday: 'F: Lịch nghỉ',
}

const REGISTRATION_TEMPLATE_LABELS: Record<RegistrationTemplate, string> = {
  official: 'Chính thức',
  supplement: 'Bổ sung',
}

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace(' ', 'T')
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  )

  if (!match) {
    return new Date(value)
  }

  const [, year, month, day, hour, minute, second = '0'] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
}

function formatDateTime(value: string) {
  return parseLocalDateTime(value).toLocaleString('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getEventClass(eventType: EventCategory | undefined) {
  switch (eventType) {
    case 'registration':
      return 'bg-red-100 text-red-900'
    case 'workshop_teaching':
      return 'bg-purple-200 text-purple-900'
    case 'meeting':
      return 'bg-blue-200 text-blue-900'
    case 'teaching_review':
      return 'bg-cyan-200 text-cyan-900'
    case 'advanced_training_release':
      return 'bg-indigo-200 text-indigo-900'
    case 'holiday':
      return 'bg-amber-200 text-amber-900'
    case 'thi':
    case 'exam':
    default:
      return 'bg-green-200 text-green-900'
  }
}

function getCalendarEventStyle(eventType: EventCategory | undefined) {
  switch (eventType) {
    case 'registration':
      return {
        timeClassName: 'text-red-700',
        titleClassName: 'bg-red-100 text-red-900',
      }
    case 'workshop_teaching':
      return {
        timeClassName: 'text-purple-700',
        titleClassName: 'bg-purple-200 text-purple-900',
      }
    case 'meeting':
      return {
        timeClassName: 'text-blue-700',
        titleClassName: 'bg-blue-200 text-blue-900',
      }
    case 'teaching_review':
      return {
        timeClassName: 'text-cyan-700',
        titleClassName: 'bg-cyan-200 text-cyan-900',
      }
    case 'advanced_training_release':
      return {
        timeClassName: 'text-indigo-700',
        titleClassName: 'bg-indigo-200 text-indigo-900',
      }
    case 'holiday':
      return {
        timeClassName: 'text-amber-700',
        titleClassName: 'bg-amber-200 text-amber-900',
      }
    case 'thi':
    case 'exam':
    default:
      return {
        timeClassName: 'text-green-700',
        titleClassName: 'bg-green-200 text-green-900',
      }
  }
}

function getEventDotClass(eventType: EventCategory | undefined) {
  switch (eventType) {
    case 'registration':
      return 'bg-red-500'
    case 'workshop_teaching':
      return 'bg-purple-500'
    case 'meeting':
      return 'bg-blue-500'
    case 'teaching_review':
      return 'bg-cyan-500'
    case 'advanced_training_release':
      return 'bg-indigo-500'
    case 'holiday':
      return 'bg-amber-500'
    case 'thi':
    case 'exam':
    default:
      return 'bg-green-500'
  }
}

const DAY_TIMELINE_START_HOUR = 5
const DAY_TIMELINE_END_HOUR = 24
const DAY_TIMELINE_ROW_HEIGHT = 64

function getTimelineEventContainerClass(eventType: EventCategory | undefined) {
  switch (eventType) {
    case 'registration':
      return 'border-red-300 bg-red-50/80 text-red-900'
    case 'workshop_teaching':
      return 'border-purple-300 bg-purple-50/80 text-purple-900'
    case 'meeting':
      return 'border-blue-300 bg-blue-50/80 text-blue-900'
    case 'teaching_review':
      return 'border-cyan-300 bg-cyan-50/80 text-cyan-900'
    case 'advanced_training_release':
      return 'border-indigo-300 bg-indigo-50/80 text-indigo-900'
    case 'holiday':
      return 'border-amber-300 bg-amber-50/80 text-amber-900'
    case 'thi':
    case 'exam':
    default:
      return 'border-green-300 bg-green-50/80 text-green-900'
  }
}

// REGISTER_OPTIONS và REGISTER_OPTION_MAP được build động từ DB (chuyen_sau_monhoc)
// Các constant dưới đây chỉ là fallback khi DB chưa load xong
type RegisterPayload = {
  exam_type: 'expertise' | 'experience'
  block_code: string
  subject_code: string
  optionLabel: string
  specialtyAliases: string[]
  subjectCodeCandidates: string[]
  default_set_id?: number | null
  default_set_code?: string | null
  default_set_name?: string | null
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function isSameDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function getWeekStartMonday(date: Date) {
  const current = startOfDay(date)
  const start = new Date(current)
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(current.getDate() + mondayOffset)
  return start
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatEventTimeRange(startAt: string, endAt: string) {
  const start = parseLocalDateTime(startAt)
  const end = parseLocalDateTime(endAt)
  const hhmm = (value: Date) => {
    const h = value.getHours().toString().padStart(2, '0')
    const m = value.getMinutes().toString().padStart(2, '0')
    return `${h}h${m}`
  }
  return `${hhmm(start)} - ${hhmm(end)}`
}

function isPastEvent(event: EvaluationEvent) {
  return parseLocalDateTime(event.endAt).getTime() < Date.now()
}

function isPastDate(date: Date) {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime()
}

function isFutureDate(date: Date) {
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime()
}

function normalizeSearchString(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeSubjectCode(value: string) {
  return normalizeSearchString(value || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSameMinute(firstValue: string, secondValue: string) {
  const first = parseLocalDateTime(firstValue).getTime()
  const second = parseLocalDateTime(secondValue).getTime()
  return Math.abs(first - second) < 60 * 1000
}

function toMinuteStamp(value: string) {
  return Math.floor(parseLocalDateTime(value).getTime() / (60 * 1000))
}

function isRegistrationActive(event: EvaluationEvent) {
  const now = new Date()
  return (
    now >= parseLocalDateTime(event.startAt) &&
    now <= parseLocalDateTime(event.endAt)
  )
}

function extractCodeFromEmail(email: string) {
  return (email || '').split('@')[0]?.trim() || ''
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function mapEventToRegisterPayloads(
  event: EvaluationEvent,
  registerOptionMap: Record<string, RegisterPayload>,
) {
  const eventSpecialty = (event.specialty || '').trim()
  const eventTitle = (event.title || '').trim()
  const normalize = (v: string) =>
    v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const nSpecialty = normalize(eventSpecialty)
  const nTitle = normalize(eventTitle)

  return Object.values(registerOptionMap).filter((mapped) => {
    // Match trực tiếp specialty với subject_code (cách admin lưu vào DB)
    if (normalize(mapped.subject_code) === nSpecialty) return true
    if (normalize(mapped.subject_code) === nTitle) return true
    // Fallback: match qua aliases
    return [...mapped.specialtyAliases, ...mapped.subjectCodeCandidates].some(
      (alias) => {
        const a = normalize(alias)
        return a && (nSpecialty.includes(a) || nTitle.includes(a) || a.includes(nSpecialty))
      },
    )
  })
}

function getEventTagAndSpecialty(
  event: EvaluationEvent,
  registerOptionMap: Record<string, RegisterPayload>,
): string {
  const payloads = mapEventToRegisterPayloads(event, registerOptionMap)
  if (payloads && payloads.length > 0) {
    const firstPayload = payloads[0]
    const optionLabel = firstPayload.optionLabel || ''
    const tagMatch = optionLabel.match(/\[(.*?)\]/)
    const tag = tagMatch ? `[${tagMatch[1]}]` : ''
    const specialty = event.specialty || ''
    return tag ? `${tag} ${specialty}`.trim() : specialty
  }
  return event.specialty || ''
}

function resolveExamActionStatus(assignment: CalendarExamAssignment | null) {
  if (!assignment) {
    return 'Chưa có bài thi cho lịch này'
  }

  if (assignment.can_take) {
    return 'Sẵn sàng làm bài'
  }

  if (!assignment.is_set_active_now) {
    return 'Bộ đề đang tạm ngưng'
  }

  if (!assignment.is_open) {
    const now = Date.now()
    const openAt = new Date(assignment.open_at).getTime()
    const closeAt = new Date(assignment.close_at).getTime()
    if (now < openAt) {
      return 'Chưa tới giờ mở bài'
    }
    if (now > closeAt) {
      return 'Đã quá hạn làm bài'
    }
  }

  if (!['assigned', 'in_progress'].includes(assignment.assignment_status)) {
    return `Trạng thái hiện tại: ${assignment.assignment_status}`
  }

  return 'Chưa thể làm bài'
}

function formatExamAssignmentStatus(rawStatus: string | null | undefined) {
  if (!rawStatus) {
    return 'Chưa có trạng thái'
  }

  const status = rawStatus.toLowerCase()
  switch (status) {
    case 'assigned':
      return 'Đã làm bài'
    case 'in_progress':
      return 'Đang làm'
    case 'submitted':
      return 'Đã nộp'
    case 'graded':
      return 'Đã chấm'
    case 'expired':
      return 'Đã đóng'
    case 'approved':
      return 'Đã duyệt'
    case 'rejected':
      return 'Đã từ chối'
    default:
      return rawStatus
  }
}

function buildCalendarCells(focusDate: Date, view: CalendarView) {
  if (view === 'day') {
    return [{ date: new Date(focusDate), inCurrentMonth: true }]
  }

  if (view === 'week') {
    const start = getWeekStartMonday(focusDate)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return { date, inCurrentMonth: true }
    })
  }

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  const monthStartDay = monthStart.getDay()
  const monthStartOffset = monthStartDay === 0 ? 6 : monthStartDay - 1
  gridStart.setDate(monthStart.getDate() - monthStartOffset)

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() }
  })
}

export default function MonthlyActivitiesPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<CalendarView>('month')
  const [focusDate, setFocusDate] = useState(new Date())
  const [events, setEvents] = useState<EvaluationEvent[]>([])
  const [examSubjects, setExamSubjects] = useState<Array<{
    id: number
    exam_type: 'expertise' | 'experience'
    block_code: string
    subject_code: string
    subject_name: string
    default_set_id?: number | null
    default_set_code?: string | null
    default_set_name?: string | null
  }>>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedRegistrationEvent, setSelectedRegistrationEvent] =
    useState<EvaluationEvent | null>(null)
  const [selectedSupplementEvent, setSelectedSupplementEvent] =
    useState<EvaluationEvent | null>(null)
  const [showDayEventsModal, setShowDayEventsModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [teacherCode, setTeacherCode] = useState('')
  const [teacherCenterCode, setTeacherCenterCode] = useState('')
  const [teacherInfo, setTeacherInfo] = useState<{
    teacher_name?: string
    email?: string
    lms_code?: string
    campus?: string
  }>({})
  const [registeringSupplementOption, setRegisteringSupplementOption] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [registeredParticipantsByEvent, setRegisteredParticipantsByEvent] =
    useState<Record<string, RegisteredExamParticipant[]>>({})
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsForEvent, setParticipantsForEvent] = useState<
    RegisteredExamParticipant[]
  >([])
  const [participantsEvent, setParticipantsEvent] =
    useState<EvaluationEvent | null>(null)
  const [showLectureRegisterModal, setShowLectureRegisterModal] = useState(false)
  const [selectedLectureEvent, setSelectedLectureEvent] = useState<EvaluationEvent | null>(null)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teacherResults, setTeacherResults] = useState<TeacherLookupItem[]>([])
  const [selectedTeacherCode, setSelectedTeacherCode] = useState('')
  const [registeringLectureReview, setRegisteringLectureReview] = useState(false)
  const [userRegisteredSubjects, setUserRegisteredSubjects] = useState<
    Set<string>
  >(new Set())
  const [registeredScheduleTimesByOption, setRegisteredScheduleTimesByOption] =
    useState<Record<string, string[]>>({})
  const [registeredExamEventIdsByOption, setRegisteredExamEventIdsByOption] =
    useState<Record<string, string[]>>({})
  const [selectedExamEventByOption, setSelectedExamEventByOption] = useState<
    Record<string, string>
  >({})
  const [examAssignments, setExamAssignments] = useState<
    CalendarExamAssignment[]
  >([])
  const [registeredScheduleIds, setRegisteredScheduleIds] = useState<
    Set<string>
  >(new Set())
  const registerHintShownRef = useRef(false)
  const [selectedWeekDateKeys, setSelectedWeekDateKeys] = useState<string[]>([])
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    if (
      searchParams.get('showRegisterHint') !== '1' ||
      registerHintShownRef.current
    ) {
      return
    }

    registerHintShownRef.current = true

    toast('Bấm vào lịch để có thể đăng ký.', {
      id: 'register-hint-toast',
      duration: 2000,
    })

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('showRegisterHint')
    const nextQuery = nextParams.toString()
    router.replace(
      nextQuery
        ? `/user/hoat-dong-hang-thang?${nextQuery}`
        : '/user/hoat-dong-hang-thang',
      { scroll: false },
    )
  }, [router, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const updateViewport = (event?: MediaQueryListEvent) => {
      setIsMobileViewport(event ? event.matches : mediaQuery.matches)
    }

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  // Build REGISTER_OPTIONS và REGISTER_OPTION_MAP động từ examSubjects (chuyen_sau_monhoc)
  const { REGISTER_OPTIONS, REGISTER_OPTION_MAP } = useMemo(() => {
    if (examSubjects.length === 0) {
      return { REGISTER_OPTIONS: [] as string[], REGISTER_OPTION_MAP: {} as Record<string, RegisterPayload> }
    }

    const options: string[] = []
    const map: Record<string, RegisterPayload> = {}

    examSubjects.forEach((subject) => {
      const key = subject.subject_name || subject.subject_code
      options.push(key)
      map[key] = {
        exam_type: subject.exam_type,
        block_code: subject.block_code,
        subject_code: subject.subject_code,
        optionLabel: key,
        default_set_id: subject.default_set_id,
        default_set_code: subject.default_set_code,
        default_set_name: subject.default_set_name,
        // specialtyAliases: match trực tiếp với subject_code và subject_name
        // (admin lưu chuyen_nganh = subject_code khi tạo lịch)
        specialtyAliases: [subject.subject_name, subject.subject_code].filter(Boolean),
        subjectCodeCandidates: [subject.subject_code, subject.subject_name].filter(Boolean),
      }
    })

    return { REGISTER_OPTIONS: options, REGISTER_OPTION_MAP: map }
  }, [examSubjects])

  // availableOptions: build từ examSubjects (chuyen_sau_monhoc)
  // Môn có default_set_id (đã set đề mặc định) hoặc exam_type=experience thì available
  const availableOptions = useMemo(() => {
    const available = new Set<string>()
    examSubjects.forEach((subject) => {
      const key = subject.subject_name || subject.subject_code
      if (subject.exam_type === 'experience' || subject.default_set_id != null) {
        available.add(key)
      }
    })
    return available
  }, [examSubjects])

  const canRegisterLectureReview = useMemo(() => {
    const role = String(user?.role || '').toLowerCase()
    if (['super_admin', 'admin', 'manager'].includes(role)) return true

    return (user?.userRoles || []).some((item) =>
      ['LEADER', 'TE', 'ACADEMIC_LEADER', 'CODING_LEADER'].includes(String(item || '').toUpperCase()),
    )
  }, [user?.role, user?.userRoles])

  const resolveExamEventIdByOptionAndSchedule = useCallback(
    (option: string, scheduledAt: string) => {
      const scheduledStamp = toMinuteStamp(scheduledAt)
      const matched = events.find((event) => {
        if (event.eventType !== 'exam') {
          return false
        }

        if (toMinuteStamp(event.startAt) !== scheduledStamp) {
          return false
        }

        const mappedPayloads = mapEventToRegisterPayloads(event, REGISTER_OPTION_MAP)
        return mappedPayloads.some((mapped) => mapped.optionLabel === option)
      })

      return matched?.id || ''
    },
    [events, REGISTER_OPTION_MAP],
  )

  useEffect(() => {
    if (!user?.email) return
    ;(async () => {
      try {
        const response = await fetch(
          `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
          { headers: authHeaders(token) },
        )
        const data = await response.json()
        if (data?.teacher?.code) {
          setTeacherCode(data.teacher.code)
          const branchCurrent =
            data?.teacher?.bu_check ||
            data?.teacher?.main_centre ||
            data?.teacher?.centers ||
            ''
          if (branchCurrent) {
            setTeacherCenterCode(String(branchCurrent))
          }
          setTeacherInfo({
            teacher_name: data.teacher.full_name || user?.displayName || '',
            email: data.teacher.work_email || user?.email || '',
            lms_code: data.teacher.code || '',
            campus: String(branchCurrent),
          })
          return
        }
      } catch {}

      const fallback = user.email.split('@')[0] || ''
      setTeacherCode(fallback)
    })()
  }, [user?.email, user?.displayName, token])

  // Fetch danh sách môn học từ DB (chuyen_sau_monhoc)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/exam-subjects')
        const data = await res.json()
        if (res.ok && data.success) {
          setExamSubjects(data.data || [])
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const month = toMonthValue(focusDate)
        const response = await fetch(`/api/event-schedules?month=${month}`, {
          headers: authHeaders(token),
        })
        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải dữ liệu lịch sự kiện')
        }

        const rows = (data.data || []) as Array<{
          id: string
          title: string
          specialty: string | null
          start_at: string
          end_at: string
          note?: string | null
          event_type: EventCategory
          registration_template?: RegistrationTemplate | null
          lecture_reviewer?: string | null
          center_id?: number | null
          center_name?: string | null
          center_address?: string | null
          center_full_address?: string | null
          center_map_url?: string | null
          allow_registration?: boolean
        }>

        setEvents(
          rows.map((item) => ({
            id: item.id,
            title: item.title,
            specialty: item.specialty || item.title,
            startAt: item.start_at,
            endAt: item.end_at,
            note: item.note || undefined,
            eventType: item.event_type,
            registrationTemplate: item.registration_template || undefined,
            lectureReviewer: item.lecture_reviewer || undefined,
            centerId: item.center_id ?? null,
            centerName: item.center_name || null,
            centerAddress: item.center_address || null,
            centerFullAddress: item.center_full_address || null,
            centerMapUrl: item.center_map_url || null,
            allowRegistration: item.allow_registration ?? undefined,
          })),
        )
      } catch (error) {
        console.error(
          'Failed to load event_schedules for teacher calendar:',
          error,
        )
        setEvents([])
      }
    })()
  }, [focusDate, token])

  useEffect(() => {
    if (!teacherCode) return
    ;(async () => {
      try {
        const response = await fetch(
          `/api/exam-registrations?teacher_code=${encodeURIComponent(teacherCode)}`,
        )
        const data = await response.json()
        if (!response.ok || !data?.success) return
        const registeredSet = new Set<string>()
        const scheduleTimesByOption: Record<string, string[]> = {}
        const eventIdsByOption: Record<string, string[]> = {}

        const scheduleIds = new Set<string>()
        ;(data.data || []).forEach(
          (row: {
            block_code: string
            subject_code: string
            scheduled_at: string
            schedule_id?: string | null
            scheduled_event_id?: string | null
          }) => {
            if (row.schedule_id) scheduleIds.add(row.schedule_id)
            Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
              if (
                mapped.block_code === row.block_code &&
                mapped.subject_code === row.subject_code
              ) {
                registeredSet.add(option)
                if (!scheduleTimesByOption[option]) {
                  scheduleTimesByOption[option] = []
                }
                if (row.scheduled_at) {
                  scheduleTimesByOption[option].push(row.scheduled_at)

                  const rawEventId = (row.scheduled_event_id || '')
                    .toString()
                    .trim()
                  const isExamEventId =
                    !!rawEventId &&
                    events.some(
                      (event) =>
                        event.id === rawEventId && event.eventType === 'exam',
                    )
                  const eventId = isExamEventId
                    ? rawEventId
                    : resolveExamEventIdByOptionAndSchedule(
                        option,
                        row.scheduled_at,
                      )
                  if (eventId) {
                    if (!eventIdsByOption[option]) {
                      eventIdsByOption[option] = []
                    }

                    if (!eventIdsByOption[option].includes(eventId)) {
                      eventIdsByOption[option].push(eventId)
                    }
                  }
                }
              }
            })
          },
        )
        setUserRegisteredSubjects(registeredSet)
        setRegisteredScheduleTimesByOption(scheduleTimesByOption)
        setRegisteredExamEventIdsByOption(eventIdsByOption)
        setRegisteredScheduleIds(scheduleIds)
      } catch {}
    })()
  }, [teacherCode, resolveExamEventIdByOptionAndSchedule])

  const fetchExamAssignmentsForMonth = useCallback(
    async (targetDate: Date) => {
      const candidates = new Set<string>()
      const normalizedTeacherCode = teacherCode?.trim()
      if (normalizedTeacherCode) {
        candidates.add(normalizedTeacherCode)
        candidates.add(normalizedTeacherCode.toLowerCase())
        candidates.add(normalizedTeacherCode.toUpperCase())
      }

      if (user?.email) {
        const emailCode = extractCodeFromEmail(user.email)
        if (emailCode) {
          candidates.add(emailCode)
          candidates.add(emailCode.toLowerCase())
          candidates.add(emailCode.toUpperCase())
        }
      }

      const candidateList = Array.from(candidates).filter(Boolean)
      if (candidateList.length === 0) {
        setExamAssignments([])
        return
      }

      const teacherCodeParam = normalizedTeacherCode || candidateList[0]
      const teacherCodesParam = encodeURIComponent(candidateList.join(','))
      const month = toMonthValue(targetDate)

      try {
        const response = await fetch(
          `/api/exam-assignments?teacher_code=${encodeURIComponent(
            teacherCodeParam,
          )}&teacher_codes=${teacherCodesParam}&month=${month}`,
          { cache: 'no-store' },
        )
        const data = await response.json()
        if (!response.ok || !data?.success) {
          setExamAssignments([])
          return
        }
        setExamAssignments((data.data || []) as CalendarExamAssignment[])
      } catch {
        setExamAssignments([])
      }
    },
    [teacherCode, user?.email],
  )

  useEffect(() => {
    const targetDate = selectedDate || focusDate
    fetchExamAssignmentsForMonth(targetDate)
  }, [fetchExamAssignmentsForMonth, focusDate, selectedDate])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 9 }, (_, index) => currentYear - 3 + index)
  }, [])

  const calendarCells = useMemo(
    () => buildCalendarCells(focusDate, view),
    [focusDate, view],
  )

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>()
    events.forEach((event) => {
      if (event.eventType === 'registration' || event.eventType === 'holiday') {
        const startDate = startOfDay(parseLocalDateTime(event.startAt))
        const endDate = startOfDay(parseLocalDateTime(event.endAt))
        const cursor = new Date(startDate)
        while (cursor.getTime() <= endDate.getTime()) {
          const key = formatDateKey(cursor)
          const previous = map.get(key) || []
          previous.push(event)
          map.set(key, previous)
          cursor.setDate(cursor.getDate() + 1)
        }
      } else {
        const key = formatDateKey(parseLocalDateTime(event.startAt))
        const previous = map.get(key) || []
        previous.push(event)
        map.set(key, previous)
      }
    })

    map.forEach((list, key) => {
      map.set(
        key,
        list.sort(
          (first, second) =>
            parseLocalDateTime(first.startAt).getTime() -
            parseLocalDateTime(second.startAt).getTime(),
        ),
      )
    })

    return map
  }, [events])

  const visibleEventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>()
    eventsByDateKey.forEach((dayEvents, key) => {
      const visible = dayEvents.filter(() => true)
      map.set(key, visible)
    })
    return map
  }, [eventsByDateKey])

  const upcomingExamEventsByOption = useMemo(() => {
    const now = new Date()
    const normalizeStr = (v: string) =>
      v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    const map: Record<string, EvaluationEvent[]> = {}
    Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
      map[option] = events
        .filter((e) => e.eventType === 'exam' || e.eventType === 'thi')
        .filter((e) => {
          const specialty = normalizeStr(e.specialty || '')
          const title = normalizeStr(e.title || '')

          // 1. Match trực tiếp với subject_code hoặc subjectCodeCandidates
          const directMatch = [
            mapped.subject_code,
            ...mapped.subjectCodeCandidates,
          ].some((code) => {
            const c = normalizeStr(code)
            return (
              specialty === c ||
              title === c ||
              specialty.includes(c) ||
              title.includes(c)
            )
          })
          if (directMatch) return true

          // 2. Match qua specialtyAliases (fallback)
          return mapped.specialtyAliases.some((alias) => {
            const a = normalizeStr(alias)
            return specialty.includes(a) || title.includes(a)
          })
        })
        .filter((e) => parseLocalDateTime(e.endAt) >= now)
        .sort(
          (a, b) =>
            parseLocalDateTime(a.startAt).getTime() -
            parseLocalDateTime(b.startAt).getTime(),
        )
    })
    return map
  }, [events, REGISTER_OPTION_MAP])

  /** Lịch đang chọn để đăng ký: chỉ trả về id khi user đã chọn rõ ràng. */
  const resolveSelectedExamEventIdForOption = useCallback(
    (option: string) => {
      const regIds = new Set(registeredExamEventIdsByOption[option] || [])
      const raw = selectedExamEventByOption[option] || ''
      if (raw && !regIds.has(raw)) return raw
      // Không tự động chọn ngày thay user — trả về empty nếu không có lựa chọn rõ ràng
      return ''
    },
    [registeredExamEventIdsByOption, selectedExamEventByOption],
  )

  const supplementSubjectAssignmentByOption = useMemo(() => {
    return Object.entries(REGISTER_OPTION_MAP).reduce(
      (acc, [option, mapped]) => {
        const selectedAssignment = examAssignments.find((assignment) => {
          const normalizedAssignmentSubject = normalizeSubjectCode(
            assignment.subject_code || '',
          )
          const candidates = [
            mapped.subject_code,
            mapped.optionLabel,
            ...mapped.subjectCodeCandidates,
          ]
            .map(normalizeSubjectCode)
            .filter(Boolean)

          return candidates.some(
            (candidate) =>
              candidate === normalizedAssignmentSubject ||
              normalizedAssignmentSubject.includes(candidate) ||
              candidate.includes(normalizedAssignmentSubject),
          )
        })

        acc[option] = selectedAssignment || null
        return acc
      },
      {} as Record<string, CalendarExamAssignment | null>,
    )
  }, [examAssignments, REGISTER_OPTION_MAP])

  const periodLabel = useMemo(() => {
    if (view === 'day') {
      return focusDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }

    if (view === 'week') {
      const start = getWeekStartMonday(focusDate)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`
  }, [focusDate, view])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return []
    return visibleEventsByDateKey.get(formatDateKey(selectedDate)) || []
  }, [visibleEventsByDateKey, selectedDate])

  useEffect(() => {
    if (view !== 'month' || !isMobileViewport) {
      return
    }

    if (
      !selectedDate ||
      selectedDate.getMonth() !== focusDate.getMonth() ||
      selectedDate.getFullYear() !== focusDate.getFullYear()
    ) {
      setSelectedDate(startOfDay(focusDate))
    }
  }, [focusDate, isMobileViewport, selectedDate, view])

  const weekDates = useMemo(
    () => buildCalendarCells(focusDate, 'week').map((cell) => cell.date),
    [focusDate],
  )

  useEffect(() => {
    if (view !== 'week') {
      return
    }

    const focusKey = formatDateKey(focusDate)
    const weekKeys = weekDates.map((date) => formatDateKey(date))
    const firstIndex = weekKeys.includes(focusKey)
      ? weekKeys.indexOf(focusKey)
      : 0
    const firstKey = weekKeys[firstIndex]
    const secondIndex =
      firstIndex < weekKeys.length - 1
        ? firstIndex + 1
        : firstIndex > 0
          ? firstIndex - 1
          : -1

    if (secondIndex >= 0) {
      const minIndex = Math.min(firstIndex, secondIndex)
      const maxIndex = Math.max(firstIndex, secondIndex)
      setSelectedWeekDateKeys([weekKeys[minIndex], weekKeys[maxIndex]])
      return
    }

    setSelectedWeekDateKeys([firstKey])
  }, [focusDate, view, weekDates])

  const dayTimelineEvents = useMemo(() => {
    const dayKey = formatDateKey(focusDate)
    const list = visibleEventsByDateKey.get(dayKey) || []

    return [...list].sort(
      (first, second) =>
        parseLocalDateTime(first.startAt).getTime() -
        parseLocalDateTime(second.startAt).getTime(),
    )
  }, [focusDate, visibleEventsByDateKey])

  const dayTimelineHours = useMemo(
    () =>
      Array.from(
        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
        (_, index) => DAY_TIMELINE_START_HOUR + index,
      ),
    [],
  )

  const dayTimelineGridHeight =
    dayTimelineHours.length * DAY_TIMELINE_ROW_HEIGHT

  const nowTimelineTop = useMemo(() => {
    const now = new Date()
    const totalMinutes = now.getHours() * 60 + now.getMinutes()
    const minMinutes = DAY_TIMELINE_START_HOUR * 60
    const maxMinutes = DAY_TIMELINE_END_HOUR * 60

    if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
      return null
    }

    return ((totalMinutes - minMinutes) / 60) * DAY_TIMELINE_ROW_HEIGHT
  }, [])

  const dayTimelineEventsByHour = useMemo(() => {
    const grouped: Record<number, EvaluationEvent[]> = {}
    dayTimelineHours.forEach((hour) => {
      grouped[hour] = []
    })

    dayTimelineEvents.forEach((event) => {
      const start = parseLocalDateTime(event.startAt)
      const slotHour = Math.max(
        DAY_TIMELINE_START_HOUR,
        Math.min(start.getHours(), DAY_TIMELINE_END_HOUR),
      )
      grouped[slotHour].push(event)
    })

    return grouped
  }, [dayTimelineEvents, dayTimelineHours])

  const selectedMonthTimelineEventsByHour = useMemo(() => {
    const grouped: Record<number, EvaluationEvent[]> = {}
    dayTimelineHours.forEach((hour) => {
      grouped[hour] = []
    })

    selectedDayEvents.forEach((event) => {
      const start = parseLocalDateTime(event.startAt)
      const slotHour = Math.max(
        DAY_TIMELINE_START_HOUR,
        Math.min(start.getHours(), DAY_TIMELINE_END_HOUR),
      )
      grouped[slotHour].push(event)
    })

    return grouped
  }, [dayTimelineHours, selectedDayEvents])

  const selectedWeekDates = useMemo(
    () =>
      weekDates
        .filter((date) => selectedWeekDateKeys.includes(formatDateKey(date)))
        .slice(0, 2),
    [selectedWeekDateKeys, weekDates],
  )

  const weekShowsNowLine = useMemo(
    () =>
      selectedWeekDates.some((date) =>
        isSameDate(startOfDay(date), startOfDay(new Date())),
      ),
    [selectedWeekDates],
  )

  const weekTimelineEventsByDateHour = useMemo(() => {
    const grouped: Record<string, Record<number, EvaluationEvent[]>> = {}

    selectedWeekDates.forEach((date) => {
      const dateKey = formatDateKey(date)
      grouped[dateKey] = {}
      dayTimelineHours.forEach((hour) => {
        grouped[dateKey][hour] = []
      })

      const eventsOfDay = visibleEventsByDateKey.get(dateKey) || []
      eventsOfDay.forEach((event) => {
        const start = parseLocalDateTime(event.startAt)
        const slotHour = Math.max(
          DAY_TIMELINE_START_HOUR,
          Math.min(start.getHours(), DAY_TIMELINE_END_HOUR),
        )
        grouped[dateKey][slotHour].push(event)
      })
    })

    return grouped
  }, [dayTimelineHours, selectedWeekDates, visibleEventsByDateKey])

  const toggleWeekDateSelection = (date: Date) => {
    const dateKey = formatDateKey(date)

    setSelectedWeekDateKeys((previous) => {
      const weekKeys = weekDates.map((item) => formatDateKey(item))
      const getIndex = (key: string) => weekKeys.indexOf(key)
      const sortByWeekOrder = (keys: string[]) =>
        [...keys].sort((first, second) => getIndex(first) - getIndex(second))

      if (previous.includes(dateKey)) {
        if (previous.length <= 1) {
          return previous
        }
        return previous.filter((key) => key !== dateKey)
      }

      if (previous.length === 0) {
        return [dateKey]
      }

      if (previous.length === 1) {
        const previousIndex = getIndex(previous[0])
        const nextIndex = getIndex(dateKey)
        const isAdjacent = Math.abs(previousIndex - nextIndex) === 1
        return isAdjacent ? sortByWeekOrder([previous[0], dateKey]) : [dateKey]
      }

      const adjacentCurrent = previous.find(
        (key) => Math.abs(getIndex(key) - getIndex(dateKey)) === 1,
      )

      if (adjacentCurrent) {
        return sortByWeekOrder([adjacentCurrent, dateKey])
      }

      return [dateKey]
    })
  }

  const examAssignmentByEventId = useMemo(() => {
    const next: Record<string, CalendarExamAssignment | null> = {}

    selectedDayEvents.forEach((event) => {
      if (event.eventType !== 'exam' && event.eventType !== 'thi') {
        next[event.id] = null
        return
      }

      const mappedPayloads = mapEventToRegisterPayloads(event, REGISTER_OPTION_MAP)
      if (mappedPayloads.length === 0) {
        next[event.id] = null
        return
      }

      const matches = examAssignments.filter((assignment) => {
        if (
          assignment.event_schedule_id &&
          assignment.event_schedule_id === event.id
        ) {
          return true
        }

        const hasMappedSubject = mappedPayloads.some((mapped) => {
          if (mapped.exam_type !== assignment.exam_type) {
            return false
          }

          const normalizedAssignmentSubject = normalizeSubjectCode(
            assignment.subject_code || '',
          )
          if (!normalizedAssignmentSubject) {
            return false
          }

          const candidates = [
            mapped.subject_code,
            mapped.optionLabel,
            ...mapped.subjectCodeCandidates,
          ]
            .map((candidate) => normalizeSubjectCode(candidate || ''))
            .filter(Boolean)

          return candidates.some(
            (candidate) =>
              candidate === normalizedAssignmentSubject ||
              candidate.includes(normalizedAssignmentSubject) ||
              normalizedAssignmentSubject.includes(candidate),
          )
        })

        if (!hasMappedSubject) {
          return false
        }

        const assignmentOpenAt = parseLocalDateTime(assignment.open_at)
        const eventStartAt = parseLocalDateTime(event.startAt)
        return isSameDate(assignmentOpenAt, eventStartAt)
      })

      if (matches.length === 0) {
        next[event.id] = null
        return
      }

      matches.sort((first, second) => {
        if (first.can_take !== second.can_take) {
          return first.can_take ? -1 : 1
        }

        const eventStartTime = parseLocalDateTime(event.startAt).getTime()
        const firstDistance = Math.abs(
          parseLocalDateTime(first.open_at).getTime() - eventStartTime,
        )
        const secondDistance = Math.abs(
          parseLocalDateTime(second.open_at).getTime() - eventStartTime,
        )
        if (firstDistance !== secondDistance) {
          return firstDistance - secondDistance
        }

        return (
          parseLocalDateTime(second.open_at).getTime() -
          parseLocalDateTime(first.open_at).getTime()
        )
      })

      next[event.id] = matches[0]
    })

    return next
  }, [selectedDayEvents, examAssignments])

  const activeRegistrationEventsForSelectedDate = useMemo(() => {
    return selectedDayEvents.filter(
      (event) => event.eventType === 'registration' && !isPastEvent(event),
    )
  }, [selectedDayEvents])

  useEffect(() => {
    if (!showDayEventsModal || selectedDayEvents.length === 0) {
      return
    }

    const relevantEvents = selectedDayEvents.filter(
      (event) =>
        event.eventType === 'exam' ||
        event.eventType === 'thi' ||
        !event.eventType,
    )

    if (relevantEvents.length === 0) {
      setRegisteredParticipantsByEvent({})
      return
    }

    ;(async () => {
      try {
        const targetDate =
          selectedDate || parseLocalDateTime(relevantEvents[0].startAt)
        const monthValue = `${targetDate.getFullYear()}-${`${targetDate.getMonth() + 1}`.padStart(2, '0')}`
        const response = await fetch(
          `/api/exam-registrations?month=${monthValue}`,
        )
        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải danh sách đăng ký')
        }

        const registrationRows = (data.data ||
          []) as RegisteredExamParticipant[]
        const next: Record<string, RegisteredExamParticipant[]> = {}

        relevantEvents.forEach((event) => {
          const matchedMappings = mapEventToRegisterPayloads(event, REGISTER_OPTION_MAP)

          const subjectCodes = new Set(
            matchedMappings.map((mapped) => mapped.subject_code),
          )
          const examTypes = new Set(
            matchedMappings.map((mapped) => mapped.exam_type),
          )

          next[event.id] = registrationRows.filter((row) => {
            if (!subjectCodes.has(row.subject_code)) {
              return false
            }
            if (!examTypes.has(row.exam_type)) {
              return false
            }
            return isSameMinute(row.scheduled_at, event.startAt)
          })
        })

        setRegisteredParticipantsByEvent(next)
      } catch (error) {
        console.error('Failed to load registered participants:', error)
        setRegisteredParticipantsByEvent({})
      }
    })()
  }, [showDayEventsModal, selectedDayEvents, selectedDate])

  useEffect(() => {
    if (!showRegisterModal) return
    setSelectedExamEventByOption((prev) => {
      const next: Record<string, string> = {}
      REGISTER_OPTIONS.forEach((option) => {
        const examEvents = upcomingExamEventsByOption[option] || []
        const regIds = registeredExamEventIdsByOption[option] || []
        const regSet = new Set(regIds)
        const prevId = prev[option]
        const prevStillValid = !!prevId && examEvents.some((e) => e.id === prevId)
        const prevIsStillSelectable = !!prevId && !regSet.has(prevId)
        if (prevStillValid && prevIsStillSelectable) {
          // keep explicit previous selection
          next[option] = prevId
        } else {
          // do not auto-select any slot — leave empty for user to choose
          next[option] = ''
        }
      })
      return next
    })
  }, [
    upcomingExamEventsByOption,
    showRegisterModal,
    registeredExamEventIdsByOption,
    REGISTER_OPTIONS,
  ])

  useEffect(() => {
    const hasOpenModal =
      showParticipantsModal || showRegisterModal || showDayEventsModal
    if (!hasOpenModal) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (showParticipantsModal) {
        setShowParticipantsModal(false)
        setParticipantsEvent(null)
        setParticipantsForEvent([])
        return
      }

      if (showRegisterModal) {
        setShowRegisterModal(false)
        setSelectedRegistrationEvent(null)
        return
      }

      if (showDayEventsModal) {
        setShowDayEventsModal(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showDayEventsModal, showRegisterModal, showParticipantsModal])

  const stepDate = (amount: number) => {
    const next = new Date(focusDate)

    if (view === 'day') {
      next.setDate(next.getDate() + amount)
    } else if (view === 'week') {
      next.setDate(next.getDate() + amount * 7)
    } else {
      next.setMonth(next.getMonth() + amount)
    }

    setFocusDate(next)
  }

  const activeRegistrationEventByDate = (date: Date) => {
    const dateEvents = eventsByDateKey.get(formatDateKey(date)) || []
    return dateEvents.find(
      (event) => event.eventType === 'registration' && !isPastEvent(event),
    )
  }

  const registrationEventByDate = (date: Date) => {
    const dateEvents = eventsByDateKey.get(formatDateKey(date)) || []
    return dateEvents.find((event) => event.eventType === 'registration')
  }

  const openSupplementModalForEvent = (registrationEvent: EvaluationEvent) => {
    if (isPastEvent(registrationEvent)) {
      toast.error('Sự kiện đăng ký đã hết hạn')
      return
    }

    setShowDayEventsModal(false)
    setSelectedSupplementEvent(registrationEvent)
    setSelectedDate(parseLocalDateTime(registrationEvent.startAt))
    setShowSupplementModal(true)
  }

  const handleDayClick = (date: Date) => {
    if (isPastDate(date)) {
      return
    }

    if (view === 'month' && isMobileViewport) {
      setSelectedDate(date)
      setShowDayEventsModal(false)
      return
    }

    const dateEvents = visibleEventsByDateKey.get(formatDateKey(date)) || []
    if (dateEvents.length === 0) {
      return
    }

    const registrationEvent = dateEvents.find(
      (event) => event.eventType === 'registration' && !isPastEvent(event),
    )
    if (registrationEvent && dateEvents.length === 1) {
      if (isFutureDate(date)) {
        toast(
          `Chưa tới ngày đăng ký. Vui lòng quay lại vào ngày ${date.toLocaleDateString('vi-VN')}.`,
        )
        return
      }
      setSelectedDate(date)
      if (registrationEvent.registrationTemplate === 'supplement') {
        openSupplementModalForEvent(registrationEvent)
      } else {
        openRegisterModalForEvent(registrationEvent)
      }
      return
    }

    setSelectedDate(date)
    setShowDayEventsModal(true)
  }

  const handleDayEventClick = (date: Date, event: EvaluationEvent) => {
    if (isPastDate(date) || isPastEvent(event)) {
      return
    }

    setSelectedDate(date)

    if (event.eventType === 'registration') {
      if (isFutureDate(date)) {
        toast(
          `Chưa tới ngày đăng ký. Vui lòng quay lại vào ngày ${date.toLocaleDateString('vi-VN')}.`,
        )
        return
      }
      if (event.registrationTemplate === 'supplement') {
        openSupplementModalForEvent(event)
      } else {
        openRegisterModalForEvent(event)
      }
      return
    }

    setShowDayEventsModal(true)
  }

  const openMapUrl = (url?: string | null) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openRegisterModalFromDay = () => {
    if (!selectedDate) {
      return
    }

    if (isFutureDate(selectedDate)) {
      toast(
        `Chưa tới ngày đăng ký. Vui lòng quay lại vào ngày ${selectedDate.toLocaleDateString('vi-VN')}.`,
      )
      return
    }

    const registrationEvent = registrationEventByDate(selectedDate)
    if (!registrationEvent) {
      toast.error('Ngày này không có lịch đăng ký')
      return
    }

    if (registrationEvent.registrationTemplate === 'supplement') {
      openSupplementModalForEvent(registrationEvent)
      return
    }

    openRegisterModalForEvent(registrationEvent)
  }

  const openRegisterModalForEvent = (registrationEvent: EvaluationEvent) => {
    if (registrationEvent.registrationTemplate === 'supplement') {
      openSupplementModalForEvent(registrationEvent)
      return
    }

    if (isPastEvent(registrationEvent)) {
      toast.error('Sự kiện đăng ký đã hết hạn')
      return
    }

    const preselectedOptions = REGISTER_OPTIONS.filter((option) => {
      const examEvents = upcomingExamEventsByOption[option] || []
      const preferredEventId =
        selectedExamEventByOption[option] || examEvents[0]?.id || ''
      if (!preferredEventId) {
        return false
      }
      return (registeredExamEventIdsByOption[option] || []).includes(
        preferredEventId,
      )
    })

    setShowDayEventsModal(false)
    setSelectedOptions(preselectedOptions)
    setSelectedExamEventByOption({})
    setSelectedRegistrationEvent(registrationEvent)
    setShowRegisterModal(true)
  }

  const resolveValidTeacherCode = async () => {
    if (!user?.email) return ''

    try {
      const response = await fetch(
        `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
        { headers: authHeaders(token) },
      )
      const data = await response.json()
      const resolved = (data?.teacher?.code || '').toString().trim()
      if (response.ok && data?.teacher && resolved) {
        if (resolved !== teacherCode) {
          setTeacherCode(resolved)
        }
        return resolved
      }
    } catch {}

    return ''
  }

  const openParticipantsList = async (event: EvaluationEvent) => {
    setParticipantsEvent(event)
    setShowParticipantsModal(true)
    setParticipantsLoading(true)

    try {
      const list = registeredParticipantsByEvent[event.id] || []
      setParticipantsForEvent(list)
    } finally {
      setParticipantsLoading(false)
    }
  }

  const loadTeachersForLectureReview = useCallback(
    async (queryText: string) => {
      try {
        setTeachersLoading(true)
        const response = await fetch(
          `/api/event-schedules/teachers?q=${encodeURIComponent(queryText.trim())}`,
          { headers: authHeaders(token) },
        )
        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải danh sách giáo viên')
        }

        setTeacherResults((data.teachers || []) as TeacherLookupItem[])
      } catch (error: any) {
        setTeacherResults([])
        toast.error(error?.message || 'Không thể tải danh sách giáo viên')
      } finally {
        setTeachersLoading(false)
      }
    },
    [token],
  )

  const openLectureRegisterModal = async (event: EvaluationEvent) => {
    setSelectedLectureEvent(event)
    setTeacherQuery('')
    setSelectedTeacherCode('')
    setTeacherResults([])
    setShowLectureRegisterModal(true)
    await loadTeachersForLectureReview('')
  }

  const handleSubmitLectureRegistration = async () => {
    if (!selectedLectureEvent) return

    if (!selectedTeacherCode) {
      toast.error('Vui lòng chọn giáo viên')
      return
    }

    try {
      setRegisteringLectureReview(true)
      const response = await fetch('/api/lecture-review-registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          event_id: selectedLectureEvent.id,
          teacher_code: selectedTeacherCode,
          lecture_reviewer: selectedLectureEvent.lectureReviewer || null,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể đăng ký lịch duyệt giảng')
      }

      toast.success('Đăng ký lịch duyệt giảng thành công')
      setShowLectureRegisterModal(false)
      setSelectedLectureEvent(null)
      setTeacherQuery('')
      setSelectedTeacherCode('')
      setTeacherResults([])
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đăng ký lịch duyệt giảng')
    } finally {
      setRegisteringLectureReview(false)
    }
  }

  const submitRegistration = async () => {
    if (selectedOptions.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 nội dung đăng ký')
      return
    }

    if (!selectedDate) {
      toast.error('Không xác định được ngày đăng ký')
      return
    }

    const validTeacherCode = await resolveValidTeacherCode()
    if (!validTeacherCode) {
      toast.error(
        'Không xác định được mã giáo viên hợp lệ từ hồ sơ. Vui lòng kiểm tra lại email/mã GV hoặc liên hệ admin.',
      )
      return
    }

    const registrationEvent =
      selectedRegistrationEvent || registrationEventByDate(selectedDate)
    if (!registrationEvent || isPastEvent(registrationEvent)) {
      toast.error('Đợt đăng ký này đã hết hạn')
      return
    }
    const registrationType =
      registrationEvent?.registrationTemplate === 'supplement'
        ? 'additional'
        : 'official'
    const sourceForm =
      registrationEvent?.registrationTemplate === 'supplement'
        ? 'additional_form'
        : 'main_form'

    const submittedOptions: string[] = []
    const submittedSlots: Array<{ option: string; scheduledAt: string }> = []
    const submittedEventIdsByOption: Record<string, string> = {}
    const failedOptions: string[] = []
    const failedDetails: string[] = []

    const teacherAutoFillData = teacherInfo

    try {
      setSubmitting(true)

      for (const option of selectedOptions) {
        const examEvents = upcomingExamEventsByOption[option] || []

        const mapped = REGISTER_OPTION_MAP[option]
        if (!mapped) {
          failedOptions.push(option)
          failedDetails.push(`${option}: chưa có mapping dữ liệu`)
          continue
        }

        // Experience test (quy trình/kỹ năng trải nghiệm) không cần bộ đề chuyên môn
        // Cho phép đăng ký tự do theo lịch admin set (không check bộ đề)
        // if (mapped.exam_type !== 'experience') {
        //   const hasActiveSetForOption = availableOptions.has(option)
        //   if (!hasActiveSetForOption) {
        //     failedOptions.push(option)
        //     failedDetails.push(`${option}: chưa có bộ đề active`)
        //     continue
        //   }
        // }

        // Require explicit chosen slot per option — do not auto-select
        const examEventId = selectedExamEventByOption[option] || ''
        if (!examEventId) {
          failedOptions.push(option)
          failedDetails.push(`${option}: chưa chọn lịch thi`)
          continue
        }

        const matchedExamEvent = events.find((e) => e.id === examEventId) || null
        if (!matchedExamEvent) {
          failedOptions.push(option)
          failedDetails.push(`${option}: lịch đã chọn không hợp lệ`)
          continue
        }

        const targetEventId = examEventId
        const alreadyRegisteredSameSlot =
          !!targetEventId &&
          (registeredExamEventIdsByOption[option] || []).includes(targetEventId)

        if (alreadyRegisteredSameSlot) {
          failedOptions.push(option)
          failedDetails.push(`${option}: bạn đã đăng ký lịch thi này`)
          continue
        }

        const scheduledAt = parseLocalDateTime(matchedExamEvent.startAt)
        const closeAt = parseLocalDateTime(matchedExamEvent.endAt)

        const response = await fetch('/api/exam-registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_code: validTeacherCode,
            exam_type: mapped.exam_type,
            registration_type: registrationType,
            block_code: mapped.block_code,
            subject_code: mapped.subject_code,
            center_code: teacherCenterCode || null,
            scheduled_at: scheduledAt.toISOString(),
            source_form: sourceForm,
            open_at: scheduledAt.toISOString(),
            close_at: closeAt.toISOString(),
            scheduled_event_id: targetEventId,
            teacher_info: teacherAutoFillData,
          }),
        })

        const data = await response.json()
        if (response.ok && data.success) {
          submittedOptions.push(option)
          submittedSlots.push({ option, scheduledAt: matchedExamEvent.startAt })
          submittedEventIdsByOption[option] = targetEventId
        } else {
          const errMsg = data?.error || 'lỗi không xác định'
          failedOptions.push(option)
          failedDetails.push(`${option}: ${errMsg}`)
          console.error('[Registration] Failed:', {
            option,
            errMsg,
            teacher_code: validTeacherCode,
            block_code: mapped.block_code,
            subject_code: mapped.subject_code,
          })
        }
      }
    } finally {
      setSubmitting(false)
    }

    if (submittedOptions.length > 0) {
      setUserRegisteredSubjects((prev) => {
        const next = new Set(prev)
        submittedOptions.forEach((option) => next.add(option))
        return next
      })

      setRegisteredScheduleTimesByOption((prev) => {
        const next: Record<string, string[]> = { ...prev }
        submittedSlots.forEach(({ option, scheduledAt }) => {
          const existing = next[option] || []
          const hasSameSlot = existing.some(
            (value) => toMinuteStamp(value) === toMinuteStamp(scheduledAt),
          )
          if (!hasSameSlot) {
            next[option] = [...existing, scheduledAt]
          }
        })
        return next
      })

      setRegisteredExamEventIdsByOption((prev) => {
        const next: Record<string, string[]> = { ...prev }
        submittedOptions.forEach((option) => {
          const selectedEventId = submittedEventIdsByOption[option] || ''
          if (!selectedEventId) {
            return
          }

          const existing = next[option] || []
          if (!existing.includes(selectedEventId)) {
            next[option] = [...existing, selectedEventId]
          }
        })
        return next
      })

      toast.success(`Đăng ký thành công ${submittedOptions.length} nội dung`)
      setShowRegisterModal(false)
      setSelectedOptions([])
      setSelectedRegistrationEvent(null)

      const firstSubmittedOption = submittedOptions[0]
      const firstSubmittedExamEventId =
        submittedEventIdsByOption[firstSubmittedOption] || ''
      const firstSubmittedExamEvent = events.find(
        (event) => event.id === firstSubmittedExamEventId,
      )
      const refreshDate = firstSubmittedExamEvent
        ? parseLocalDateTime(firstSubmittedExamEvent.startAt)
        : selectedDate || focusDate
      await fetchExamAssignmentsForMonth(refreshDate)
    }

    if (failedOptions.length > 0) {
      const firstDetail = failedDetails[0] || failedOptions.join(', ')
      toast.error(`Đăng ký thất bại: ${firstDetail}`, { duration: 6000 })
      if (failedDetails.length > 1) {
        setTimeout(
          () =>
            toast.error(failedDetails.slice(1).join('\n'), { duration: 6000 }),
          500,
        )
      }
      console.warn('Registration failed details:', failedDetails)
    }
  }

  const createSupplementAssignmentForOption = async (option: string) => {
    if (!selectedDate) {
      toast.error('Không xác định được ngày đăng ký')
      return
    }

    const registrationEvent =
      selectedSupplementEvent || registrationEventByDate(selectedDate)
    if (!registrationEvent || isPastEvent(registrationEvent)) {
      toast.error('Sự kiện đăng ký đã hết hạn')
      return
    }

    const mapped = REGISTER_OPTION_MAP[option]
    if (!mapped) {
      toast.error('Không xác định được môn đăng ký')
      return
    }

    const validTeacherCode = await resolveValidTeacherCode()
    if (!validTeacherCode) {
      toast.error(
        'Không xác định được mã giáo viên hợp lệ từ hồ sơ. Vui lòng kiểm tra lại email/mã GV hoặc liên hệ admin.',
      )
      return
    }

    const registrationStart = parseLocalDateTime(registrationEvent.startAt)
    const registrationMonth = registrationStart.getMonth() + 1
    const registrationYear = registrationStart.getFullYear()

    setRegisteringSupplementOption(option)
    try {
      const response = await fetch('/api/exam-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_code: validTeacherCode,
          exam_type: mapped.exam_type,
          registration_type: 'additional',
          block_code: mapped.block_code,
          subject_code: mapped.subject_code,
          id_de_thi: mapped.default_set_id || undefined,
          center_code: teacherCenterCode || null,
          scheduled_at: new Date(registrationEvent.startAt).toISOString(),
          source_form: 'additional_form',
          open_at: new Date(registrationEvent.startAt).toISOString(),
          close_at: new Date(registrationEvent.endAt).toISOString(),
          scheduled_event_id: registrationEvent.id,
          thang_dk: registrationMonth,
          nam_dk: registrationYear,
          teacher_info: teacherInfo,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tạo assignment cho môn này')
      }

      const createdResultId = data?.data?.id || data?.result_id || null
      toast.success(`Đã tạo bài kiểm tra cho môn ${option}`)
      await fetchExamAssignmentsForMonth(selectedDate || focusDate)
      if (createdResultId) {
        setShowSupplementModal(false)
        setSelectedSupplementEvent(null)
        router.push(`/user/assignments/exam/${createdResultId}`)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo assignment cho môn này')
    } finally {
      setRegisteringSupplementOption(null)
    }
  }

  const toggleOption = (option: string) => {
    setSelectedOptions((previous) =>
      previous.includes(option)
        ? previous.filter((item) => item !== option)
        : [...previous, option],
    )
  }

  // Show skeleton while loading initial data
  const isInitialLoading = events.length === 0 && !teacherCode

  if (isInitialLoading) {
    return <PageSkeleton variant="default" itemCount={6} showHeader={true} />
  }

  return (
    <PageContainer title="Các Hoạt Động Hàng Tháng" description="">
      <Card className="overflow-hidden" padding="sm">
        <div className=" py-3 border-bs text-center">
          <h2 className="text-2xl font-bold text-gray-900">Lịch Sự Kiện</h2>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <select
              value={focusDate.getMonth()}
              onChange={(event) => {
                const next = new Date(focusDate)
                next.setMonth(Number(event.target.value))
                setFocusDate(next)
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  Tháng {index + 1}
                </option>
              ))}
            </select>

            <select
              value={focusDate.getFullYear()}
              onChange={(event) => {
                const next = new Date(focusDate)
                next.setFullYear(Number(event.target.value))
                setFocusDate(next)
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => stepDate(-1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => stepDate(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {[
              { value: 'day' as CalendarView, label: 'Ngày' },
              { value: 'week' as CalendarView, label: 'Tuần' },
              { value: 'month' as CalendarView, label: 'Tháng' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setView(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                  view === option.value
                    ? 'bg-[#a1001f] text-white border-[#a1001f]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {periodLabel}
        </div>

        {view === 'day' ? (
          <div className="border-t border-gray-200 bg-white">
            <div className="grid grid-cols-[64px_1fr]">
              <div className="border-r border-gray-200 bg-gray-50/70">
                {dayTimelineHours.map((hour) => (
                  <div
                    key={`label-${hour}`}
                    className="relative"
                    style={{ height: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                  >
                    <span className="absolute top-1 right-2 text-xs font-medium text-gray-500">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="relative grow flex flex-col"
                style={{ minHeight: `${dayTimelineGridHeight}px` }}
              >
                {dayTimelineHours.map((hour) => {
                  const hourEvents = dayTimelineEventsByHour[hour] || []
                  const eventCount = hourEvents.length
                  const expandedHeight =
                    eventCount > 0
                      ? Math.max(
                          DAY_TIMELINE_ROW_HEIGHT,
                          eventCount * 32 + (eventCount - 1) * 6 + 12,
                        )
                      : DAY_TIMELINE_ROW_HEIGHT

                  return (
                    <div
                      key={`slot-${hour}`}
                      className="border-t border-gray-200 px-2 py-1.5"
                      style={{ minHeight: `${expandedHeight}px` }}
                    >
                      <div className="space-y-1.5">
                        {hourEvents.map((event) => {
                          const calendarEventStyle = getCalendarEventStyle(
                            event.eventType,
                          )
                          const tagAndSpecialty = getEventTagAndSpecialty(event, REGISTER_OPTION_MAP)

                          return (
                            <button
                              key={event.id}
                              type="button"
                              className={`w-full rounded-xl border-l-4 px-2 py-1.5 text-left shadow-sm hover:shadow-md transition flex flex-col ${getTimelineEventContainerClass(event.eventType)}`}
                              onClick={() =>
                                handleDayEventClick(focusDate, event)
                              }
                              title={`${event.title}${tagAndSpecialty}`}
                            >
                              <p
                                className={`text-[10px] font-semibold leading-3 ${calendarEventStyle.timeClassName}`}
                              >
                                {formatEventTimeRange(
                                  event.startAt,
                                  event.endAt,
                                )}
                              </p>
                              <p className="text-xs font-bold leading-4 mt-0.5">
                                {event.title}
                                {tagAndSpecialty && (
                                  <span className="whitespace-nowrap">
                                    {tagAndSpecialty}
                                  </span>
                                )}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {nowTimelineTop !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 border-t-2 border-red-500 z-20"
                    style={{ top: `${nowTimelineTop}px` }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="border-t border-gray-200 bg-white">
            <div className="lg:hidden">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {weekDates.map((date) => {
                  const key = formatDateKey(date)
                  const isSelected = selectedWeekDateKeys.includes(key)
                  const isToday = isSameDate(
                    startOfDay(date),
                    startOfDay(new Date()),
                  )
                  const weekdayIndex =
                    date.getDay() === 0 ? 6 : date.getDay() - 1

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleWeekDateSelection(date)}
                      className={`border-r border-gray-200 px-1 py-2 text-center transition-colors ${isSelected ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <p
                        className={`text-[11px] font-semibold ${isSelected ? 'text-[#a1001f]' : 'text-gray-500'}`}
                      >
                        {WEEKDAY_LABELS[weekdayIndex]}
                      </p>
                      <p
                        className={`mt-1 text-sm font-bold ${isToday ? 'text-red-600' : isSelected ? 'text-gray-900' : 'text-gray-600'}`}
                      >
                        {String(date.getDate()).padStart(2, '0')}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: `64px repeat(${Math.max(selectedWeekDates.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                <div className="border-r border-gray-200 bg-gray-50/70">
                  {dayTimelineHours.map((hour) => (
                    <div
                      key={`week-label-${hour}`}
                      className="relative"
                      style={{ height: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                    >
                      <span className="absolute top-1 right-2 text-xs font-medium text-gray-500">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {selectedWeekDates.map((date) => {
                  const dateKey = formatDateKey(date)
                  const isToday = isSameDate(
                    startOfDay(date),
                    startOfDay(new Date()),
                  )

                  return (
                    <div
                      key={`week-col-${dateKey}`}
                      className="relative border-r border-gray-200 grow flex flex-col"
                    >
                      {dayTimelineHours.map((hour) => {
                        const hourEvents =
                          weekTimelineEventsByDateHour[dateKey]?.[hour] || []
                        const eventCount = hourEvents.length
                        const expandedHeight =
                          eventCount > 0
                            ? Math.max(
                                DAY_TIMELINE_ROW_HEIGHT,
                                eventCount * 28 + (eventCount - 1) * 4 + 8,
                              )
                            : DAY_TIMELINE_ROW_HEIGHT

                        return (
                          <div
                            key={`${dateKey}-${hour}`}
                            className="border-t border-gray-200 px-1.5 py-1"
                            style={{
                              minHeight: `${expandedHeight}px`,
                            }}
                          >
                            <div className="space-y-1">
                              {hourEvents.map((event) => {
                                const calendarEventStyle =
                                  getCalendarEventStyle(event.eventType)
                                const tagAndSpecialty =
                                  getEventTagAndSpecialty(event, REGISTER_OPTION_MAP)

                                return (
                                  <button
                                    key={event.id}
                                    type="button"
                                    className={`w-full overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left shadow-sm hover:shadow-md transition flex flex-col text-xs ${getTimelineEventContainerClass(event.eventType)}`}
                                    onClick={() =>
                                      handleDayEventClick(date, event)
                                    }
                                    title={`${event.title}${tagAndSpecialty}`}
                                  >
                                    <p
                                      className={`text-[9px] font-semibold leading-2 ${calendarEventStyle.timeClassName}`}
                                    >
                                      {formatEventTimeRange(
                                        event.startAt,
                                        event.endAt,
                                      )}
                                    </p>
                                    <p className="mt-0.5 line-clamp-3 wrap-break-word text-[10px] font-bold leading-3">
                                      {event.title}
                                      {tagAndSpecialty && (
                                        <span className="ml-0.5 wrap-break-word">
                                          {tagAndSpecialty}
                                        </span>
                                      )}
                                    </p>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {isToday &&
                        weekShowsNowLine &&
                        nowTimelineTop !== null && (
                          <div
                            className="pointer-events-none absolute left-0 right-0 border-t-2 border-red-500 z-20"
                            style={{ top: `${nowTimelineTop}px` }}
                          />
                        )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="grid grid-cols-7 border-l border-t border-gray-200">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={`week-head-${label}`}
                    className="h-10 border-r border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 flex items-center justify-center"
                  >
                    {label}
                  </div>
                ))}

                {weekDates.map((date) => {
                  const isToday = isSameDate(
                    startOfDay(date),
                    startOfDay(new Date()),
                  )
                  const dateKey = formatDateKey(date)
                  const isPastCalendarDate = isPastDate(date)
                  const dayEvents = isPastCalendarDate
                    ? []
                    : visibleEventsByDateKey.get(dateKey) || []
                  const hasActiveRegistration =
                    !isPastCalendarDate &&
                    Boolean(activeRegistrationEventByDate(date))

                  return (
                    <div
                      key={`week-grid-${dateKey}`}
                      className={`min-h-36 flex flex-col border-r border-b border-gray-200 p-2 ${
                        isPastCalendarDate
                          ? 'bg-gray-100'
                          : isToday
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-white'
                      } ${dayEvents.length > 0 && !isPastCalendarDate ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                      onClick={() => handleDayClick(date)}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        {isToday ? (
                          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-gray-900">
                            Hôm nay {date.getDate()}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">
                            {date.getDate()}
                          </span>
                        )}

                        {hasActiveRegistration && (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Đang mở
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 4).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            className={`w-full rounded px-1.5 py-1 text-left text-[11px] font-semibold leading-4 ${getEventClass(event.eventType)}`}
                            onClick={(eventMouse) => {
                              eventMouse.stopPropagation()
                              handleDayEventClick(date, event)
                            }}
                          >
                            {event.title}
                          </button>
                        ))}

                        {dayEvents.length > 4 && (
                          <p className="text-[11px] font-semibold text-gray-500">
                            +{dayEvents.length - 4} sự kiện
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 border-l border-t border-gray-200">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="h-10 border-r border-b border-gray-200 bg-gray-50 text-xs md:text-sm font-semibold text-gray-600 flex items-center justify-center"
              >
                {label}
              </div>
            ))}

            {calendarCells.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDate(
                startOfDay(date),
                startOfDay(new Date()),
              )
              const dateKey = formatDateKey(date)
              const isPastCalendarDate = isPastDate(date)
              const dayEvents = isPastCalendarDate
                ? []
                : visibleEventsByDateKey.get(dateKey) || []
              const hasActiveRegistration =
                !isPastCalendarDate &&
                Boolean(activeRegistrationEventByDate(date))
              const isSelectedMobileDate =
                isMobileViewport &&
                selectedDate !== null &&
                isSameDate(startOfDay(date), startOfDay(selectedDate))

              return (
                <div
                  key={dateKey}
                  className={`min-h-20 md:min-h-28 flex flex-col border-r border-b border-gray-200 p-1.5 md:p-2 ${
                    isPastCalendarDate
                      ? 'bg-gray-100'
                      : isToday
                        ? 'bg-yellow-50 border-yellow-300'
                        : inCurrentMonth
                          ? 'bg-white'
                          : 'bg-gray-50'
                  } ${isSelectedMobileDate ? 'ring-2 ring-blue-400 ring-inset' : ''} ${!isPastCalendarDate ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  onClick={() => handleDayClick(date)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {isToday ? (
                      <span className="inline-flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-yellow-300 text-xs md:text-sm font-bold text-yellow-900">
                        {date.getDate()}
                      </span>
                    ) : (
                      <span
                        className={`text-xs md:text-sm font-medium ${
                          inCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    )}

                    {hasActiveRegistration &&
                      !isPastCalendarDate &&
                      !isFutureDate(date) && (
                        <span className="hidden lg:inline rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Đăng ký
                        </span>
                      )}
                  </div>

                  {isMobileViewport ? (
                    <div className="mt-1 flex min-h-4 items-center gap-1">
                      {dayEvents.slice(0, 4).map((event, index) => (
                        <span
                          key={`${event.id}-${index}`}
                          className={`h-1.5 w-1.5 rounded-full ${getEventDotClass(event.eventType)}`}
                        />
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="text-[9px] font-semibold text-gray-500">
                          +{dayEvents.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const calendarEventStyle = getCalendarEventStyle(
                          event.eventType,
                        )

                        if (event.eventType === 'registration') {
                          return (
                            <button
                              type="button"
                              key={event.id}
                              className={`rounded-sm px-1 py-1 text-center text-[11px] leading-4 font-bold whitespace-pre-line ${calendarEventStyle.titleClassName}`}
                              title={event.title.replace(/\n/g, ' ')}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDayEventClick(date, event)
                              }}
                            >
                              {event.title}
                            </button>
                          )
                        }

                        return (
                          <button
                            type="button"
                            key={event.id}
                            className="w-full text-left"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDayEventClick(date, event)
                            }}
                            title={event.title.replace(/\n/g, ' ')}
                          >
                            <p
                              className={`text-[11px] font-semibold leading-4 ${calendarEventStyle.timeClassName}`}
                            >
                              {formatEventTimeRange(event.startAt, event.endAt)}
                            </p>
                            <div
                              className={`mt-0.5 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center ${calendarEventStyle.titleClassName}`}
                            >
                              {event.title}
                            </div>
                          </button>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-gray-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDate(date)
                            setShowDayEventsModal(true)
                          }}
                        >
                          +{dayEvents.length - 3} sự kiện khác
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex-1" />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {view === 'month' && isMobileViewport && selectedDate && (
        <Card className="mt-4" padding="sm">
          <div className="border-b border-gray-200 py-3">
            <h3 className="text-base font-bold text-gray-900">
              Ngày {selectedDate.toLocaleDateString('vi-VN')}
            </h3>
          </div>

          <div className=" py-3">
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[52px_1fr] bg-white">
                <div className="border-r border-gray-200 bg-gray-50/80">
                  {dayTimelineHours.map((hour) => (
                    <div
                      key={`mobile-month-label-${hour}`}
                      className="relative border-b border-gray-200 last:border-b-0"
                      style={{ height: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                    >
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold text-gray-500">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  {dayTimelineHours.map((hour) => {
                    const hourEvents =
                      selectedMonthTimelineEventsByHour[hour] || []

                    return (
                      <div
                        key={`mobile-month-slot-${hour}`}
                        className="border-b border-gray-200 px-2 py-1.5 last:border-b-0"
                        style={{ minHeight: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                      >
                        <div className="space-y-1.5">
                          {hourEvents.map((event) => {
                            const calendarEventStyle = getCalendarEventStyle(
                              event.eventType,
                            )

                            return (
                              <button
                                type="button"
                                key={`mobile-month-event-${event.id}`}
                                onClick={() =>
                                  handleDayEventClick(selectedDate, event)
                                }
                                title={event.title.replace(/\n/g, ' ')}
                                className={`w-full rounded-lg border-l-4 px-2.5 py-2 text-left shadow-sm transition hover:shadow-md ${getTimelineEventContainerClass(event.eventType)}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={`text-[11px] font-semibold ${calendarEventStyle.timeClassName}`}
                                  >
                                    {formatEventTimeRange(
                                      event.startAt,
                                      event.endAt,
                                    )}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getEventClass(event.eventType)}`}
                                  >
                                    {
                                      EVENT_TYPE_LABELS[
                                        event.eventType || 'exam'
                                      ]
                                    }
                                  </span>
                                </div>
                                <p className="mt-1 text-xs font-bold leading-4 text-gray-900 whitespace-pre-line">
                                  {event.title}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {selectedDayEvents.length === 0 && (
              <p className="mt-3 text-center text-xs font-medium text-gray-500">
                Ngày này chưa có sự kiện trong timeline.
              </p>
            )}
          </div>
        </Card>
      )}

      {showDayEventsModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                Sự kiện ngày {selectedDate.toLocaleDateString('vi-VN')}
              </h3>
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Không có sự kiện nào trong ngày này.
                </div>
              ) : (
                selectedDayEvents.map((event) => {
                  const eventIsPast = isPastEvent(event)
                  const isRegistrationDateFuture =
                    !!selectedDate && isFutureDate(selectedDate)
                  const canRegister =
                    event.eventType === 'registration' &&
                    !eventIsPast &&
                    !isRegistrationDateFuture
                  const supportsParticipantList =
                    event.eventType === 'exam' || !event.eventType
                  const registeredCount = (
                    registeredParticipantsByEvent[event.id] || []
                  ).length
                  const matchedExamAssignment =
                    examAssignmentByEventId[event.id] || null
                  const examActionStatus = resolveExamActionStatus(
                    matchedExamAssignment,
                  )
                  const canTakeExamNow = Boolean(
                    matchedExamAssignment?.can_take,
                  )

                  return (
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getEventClass(event.eventType)}`}
                        >
                          {EVENT_TYPE_LABELS[event.eventType || 'exam']}
                        </span>
                        <span className="text-xs font-semibold text-blue-700">
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold whitespace-pre-line text-gray-900">
                        {event.title}
                      </p>

                      <div className="mt-2 grid gap-1 text-sm text-gray-700">
                        <p>
                          <span className="font-semibold">Chuyên môn:</span>{' '}
                          {event.specialty || '-'}
                        </p>
                        <p>
                          <span className="font-semibold">Bắt đầu:</span>{' '}
                          {formatDateTime(event.startAt)}
                        </p>
                        <p>
                          <span className="font-semibold">Kết thúc:</span>{' '}
                          {formatDateTime(event.endAt)}
                        </p>
                        {event.registrationTemplate && (
                          <p>
                            <span className="font-semibold">Mẫu đăng ký:</span>{' '}
                            {
                              REGISTRATION_TEMPLATE_LABELS[
                                event.registrationTemplate
                              ]
                            }
                          </p>
                        )}
                        {event.note && (
                          <p className="whitespace-pre-line">
                            <span className="font-semibold">Ghi chú:</span>{' '}
                            {event.note}
                          </p>
                        )}
                        {event.eventType === 'teaching_review' && event.lectureReviewer && (
                          <p>
                            <span className="font-semibold">Reviewer:</span>{' '}
                            {event.lectureReviewer}
                          </p>
                        )}
                        {event.eventType === 'teaching_review' && (
                          <div className="space-y-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
                            <p className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                <span className="font-semibold">Cơ sở duyệt giảng:</span>{' '}
                                {event.centerName || 'Chưa có thông tin cơ sở'}
                                {event.centerFullAddress ? (
                                  <span className="mt-1 block text-xs text-cyan-900/80">
                                    {event.centerFullAddress}
                                  </span>
                                ) : event.centerAddress ? (
                                  <span className="mt-1 block text-xs text-cyan-900/80">
                                    {event.centerAddress}
                                  </span>
                                ) : null}
                              </span>
                            </p>
                            {event.centerMapUrl && (
                              <button
                                type="button"
                                onClick={() => openMapUrl(event.centerMapUrl)}
                                className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Xem map
                              </button>
                            )}
                          </div>
                        )}
                        {eventIsPast && (
                          <p className="text-xs font-semibold text-gray-500">
                            Sự kiện đã qua
                          </p>
                        )}
                      </div>

                      {event.eventType === 'registration' &&
                        !eventIsPast &&
                        isRegistrationDateFuture && (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <p className="text-xs font-semibold text-amber-700">
                              ⏰ Chưa tới ngày đăng ký. Vui lòng quay lại vào
                              ngày {selectedDate?.toLocaleDateString('vi-VN')}.
                            </p>
                          </div>
                        )}

                      {canRegister && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <button
                            onClick={() =>
                              event.registrationTemplate === 'supplement'
                                ? openSupplementModalForEvent(event)
                                : openRegisterModalForEvent(event)
                            }
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            {event.registrationTemplate === 'supplement'
                              ? 'Đăng ký kiểm tra chuyên sâu bổ sung'
                              : 'Đăng ký kiểm tra chuyên sâu chính thức'}
                          </button>
                        </div>
                      )}

                      {event.eventType === 'teaching_review' &&
                        !eventIsPast &&
                        canRegisterLectureReview && (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <button
                              type="button"
                              onClick={() => openLectureRegisterModal(event)}
                              className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                            >
                              Đăng ký duyệt giảng
                            </button>
                          </div>
                        )}

                      {supportsParticipantList && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="mb-2 text-xs font-semibold text-gray-600">
                            Người tham gia
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                              {registeredCount} người đăng ký
                            </span>
                            <button
                              onClick={() => openParticipantsList(event)}
                              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Xem danh sách
                            </button>
                            {eventIsPast && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                Sự kiện đã kết thúc
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {event.eventType === 'exam' && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="mb-2 text-xs font-semibold text-gray-600">
                            Làm bài kiểm tra
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                canTakeExamNow
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {examActionStatus}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!matchedExamAssignment) {
                                  toast.error(
                                    'Chưa tạo assignment cho lịch thi này',
                                  )
                                  return
                                }

                                if (!matchedExamAssignment.can_take) {
                                  toast.error(examActionStatus)
                                  return
                                }

                                setShowDayEventsModal(false)
                                router.push(
                                  `/user/assignments/exam/${matchedExamAssignment.id}`,
                                )
                              }}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                                canTakeExamNow
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-500'
                              }`}
                            >
                              Làm bài
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              {activeRegistrationEventsForSelectedDate.length > 0 && (
                <button
                  onClick={openRegisterModalFromDay}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Mở đăng ký
                </button>
              )}
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showParticipantsModal && participantsEvent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Danh sách người đăng ký
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  {participantsEvent.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowParticipantsModal(false)
                  setParticipantsEvent(null)
                  setParticipantsForEvent([])
                }}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {participantsLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Đang tải danh sách...
                </div>
              ) : participantsForEvent.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Chưa có giáo viên đăng ký làm bài cho lịch này.
                </div>
              ) : (
                <div className="space-y-2">
                  {participantsForEvent.map((participant, index) => (
                    <div
                      key={
                        participant.id || `${participant.teacher_code}-${index}`
                      }
                      className="rounded-md border border-gray-200 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {participant.teacher_name || participant.teacher_code}
                      </p>
                      <p className="text-xs text-gray-600">
                        Mã GV: {participant.teacher_code}
                      </p>
                      <p className="text-xs text-gray-600">
                        Trạng thái bài:{' '}
                        {participant.assignment_status || 'pending'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200  py-3">
              <button
                onClick={() => {
                  setShowParticipantsModal(false)
                  setParticipantsEvent(null)
                  setParticipantsForEvent([])
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showLectureRegisterModal && selectedLectureEvent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Đăng ký lịch duyệt giảng</h3>
                <p className="mt-1 text-xs text-gray-600">
                  {selectedLectureEvent.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLectureRegisterModal(false)
                  setSelectedLectureEvent(null)
                  setTeacherQuery('')
                  setSelectedTeacherCode('')
                  setTeacherResults([])
                }}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4">
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                <p>
                  Reviewer:{' '}
                  <span className="font-semibold">
                    {selectedLectureEvent.lectureReviewer || 'Chưa gán reviewer'}
                  </span>
                </p>
              </div>

              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={teacherQuery}
                    onChange={(event) => setTeacherQuery(event.target.value)}
                    placeholder="Tìm theo tên giáo viên hoặc LMS code"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => loadTeachersForLectureReview(teacherQuery)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Tìm giáo viên
                  </button>
                </div>

                <select
                  value={selectedTeacherCode}
                  onChange={(event) => setSelectedTeacherCode(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- Chọn giáo viên --</option>
                  {teacherResults.map((teacher) => (
                    <option key={teacher.teacher_code} value={teacher.teacher_code}>
                      {teacher.teacher_name} ({teacher.lms_code}){teacher.center ? ` - ${teacher.center}` : ''}
                    </option>
                  ))}
                </select>

                {teachersLoading && (
                  <p className="text-xs text-blue-700">Đang tải danh sách giáo viên...</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitLectureRegistration}
                    disabled={registeringLectureReview}
                    className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" /> {registeringLectureReview ? 'Đang đăng ký...' : 'Xác nhận đăng ký'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={showRegisterModal && !!selectedDate}
        onClose={() => {
          setShowRegisterModal(false)
          setSelectedRegistrationEvent(null)
        }}
        title={`Form đăng ký kiểm tra - ${selectedDate?.toLocaleDateString('vi-VN') || ''}`}
        subtitle="Chọn lịch thi trước, sau đó tick môn và gửi đăng ký."
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowRegisterModal(false)
                setSelectedRegistrationEvent(null)
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
            <button
              onClick={submitRegistration}
              disabled={submitting}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#840018] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Đang gửi...' : 'Gửi đăng ký'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-4">
            {selectedRegistrationEvent && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a1001f]">
                  Đợt đăng ký đang chọn
                </p>
                <p className="mt-2 whitespace-pre-line text-base font-semibold text-gray-900">
                  {selectedRegistrationEvent.title}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Thời gian: {formatDateTime(selectedRegistrationEvent.startAt)}{' '}
                  - {formatDateTime(selectedRegistrationEvent.endAt)}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a1001f]">
                Thứ tự thao tác
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-gray-700">
                <li>Chọn lịch thi theo từng môn trước.</li>
                <li>Tick môn muốn đăng ký rồi bấm Gửi đăng ký.</li>
              </ol>
            </div>
          </div>
          <div className="space-y-4">
            {REGISTER_OPTIONS.filter((option) => {
              const mapped = REGISTER_OPTION_MAP[option]
              const hasExamEvents =
                (upcomingExamEventsByOption[option] || []).length > 0
              const isExperience = mapped?.exam_type === 'experience'
              // Hiển thị tất cả option có lịch thi, không phụ thuộc bộ đề
              return hasExamEvents
            }).map((option) => {
              const mapped = REGISTER_OPTION_MAP[option]
              const isExperience = mapped?.exam_type === 'experience'
              const isAvailable = true // Cho phép đăng ký tự do theo lịch admin set
              const isSelected = selectedOptions.includes(option)
              const examEvents = upcomingExamEventsByOption[option] || []
              const hasExamEvents = examEvents.length > 0
              const registeredEventIdsForOption =
                registeredExamEventIdsByOption[option] || []
              const registeredEventIdSet = new Set(registeredEventIdsForOption)
              const selectControlledId =
                resolveSelectedExamEventIdForOption(option)

              const hasAnyRegistration = userRegisteredSubjects.has(option)
              const isAlreadyRegisteredForSelectedEvent =
                !!selectControlledId &&
                registeredEventIdSet.has(selectControlledId)
              const isDisabled =
                !isAvailable ||
                !hasExamEvents ||
                isAlreadyRegisteredForSelectedEvent

              return (
                <div
                  key={option}
                  className={`space-y-3 rounded-xl border p-4 shadow-sm ${
                    isDisabled
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-[#a1001f]/15 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={`text-sm font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}
                    >
                      {option}
                    </p>
                    {isSelected && !isDisabled && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                        Đã chọn đăng ký
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Lịch thi
                    </p>
                    {!hasExamEvents ? (
                      <p className="text-sm text-gray-500">Chưa có lịch thi</p>
                    ) : examEvents.length === 1 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          {formatDateTime(examEvents[0].startAt)} —{' '}
                          {formatDateTime(examEvents[0].endAt)}
                        </p>
                        {registeredEventIdSet.has(examEvents[0].id) ? (
                          <p className="text-xs font-semibold text-amber-800">
                            Đã đăng ký lịch này — không thể đăng ký trùng.
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-800">
                            Còn đăng ký được lịch này.
                          </p>
                        )}
                      </div>
                    ) : examEvents.every((e) => registeredEventIdSet.has(e.id)) ? (
                      <ul className="space-y-2">
                        {examEvents.map((event) => (
                          <li
                            key={event.id}
                            className="flex flex-wrap items-center gap-2 text-sm text-gray-800"
                          >
                            <span className="font-medium">
                              {formatDateTime(event.startAt)} —{' '}
                              {formatDateTime(event.endAt)}
                            </span>
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                              Đã đăng ký
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Tất cả khung giờ của môn — chọn một lịch còn trống để đăng ký.
                        </p>
                        <div className="space-y-2">
                          {examEvents.map((event) => {
                            const slotRegistered =
                              registeredEventIdSet.has(event.id)
                            const isActiveSlot = selectControlledId === event.id
                            return (
                              <label
                                key={event.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                                  slotRegistered
                                    ? 'cursor-not-allowed border-gray-200 bg-white/80'
                                    : isActiveSlot
                                      ? 'border-[#a1001f]/35 bg-white shadow-sm ring-1 ring-[#a1001f]/15'
                                      : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`exam-schedule-${option}`}
                                  value={event.id}
                                  checked={isActiveSlot}
                                  disabled={slotRegistered}
                                  onChange={() =>
                                    setSelectedExamEventByOption((prev) => ({
                                      ...prev,
                                      [option]: event.id,
                                    }))
                                  }
                                  className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-[#a1001f] focus:ring-[#a1001f] disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900">
                                    {formatDateTime(event.startAt)} —{' '}
                                    {formatDateTime(event.endAt)}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {slotRegistered ? (
                                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                        Đã đăng ký
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        Còn đăng ký
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                        {/* Bỏ chọn: nút cho phép xóa lựa chọn và uncheck môn */}
                        <div className="mt-2 flex justify-end">
                          {(isSelected || (selectedExamEventByOption[option] || '')) && !isDisabled && (
                            <button
                              type="button"
                              onClick={() => {
                                // remove checkbox selection and clear chosen slot
                                setSelectedOptions((prev) => prev.filter((it) => it !== option))
                                setSelectedExamEventByOption((prev) => ({ ...prev, [option]: '' }))
                              }}
                              className="text-sm font-medium text-[#a1001f] hover:underline"
                            >
                              Bỏ chọn
                            </button>
                          )}
                        </div>
                        {examEvents.some((e) => registeredEventIdSet.has(e.id)) &&
                          examEvents.some((e) => !registeredEventIdSet.has(e.id)) && (
                            <p className="text-xs text-gray-500">
                              Khung «Đã đăng ký» không chọn được; chỉ đăng ký được
                              khung «Còn đăng ký».
                            </p>
                          )}
                      </div>
                    )}
                  </div>

                  <label
                    className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
                      isDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => toggleOption(option)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                    />
                    <span
                      className={`text-sm leading-6 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}
                    >
                      Đăng ký môn này
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={showSupplementModal && !!selectedSupplementEvent}
        onClose={() => {
          setShowSupplementModal(false)
          setSelectedSupplementEvent(null)
        }}
        title="Kiểm tra bổ sung"
        subtitle={
          selectedSupplementEvent
            ? `Sự kiện bổ sung: ${selectedSupplementEvent.title}`
            : undefined
        }
        headerColor="bg-[#a1001f]"
        maxWidth="5xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowSupplementModal(false)
                setSelectedSupplementEvent(null)
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
          </div>
        }
      >
        <div className="space-y-4">
            {REGISTER_OPTIONS.map((option) => {
              const mapped = REGISTER_OPTION_MAP[option]
              const assignment = supplementSubjectAssignmentByOption[option]
              const canTake = assignment?.can_take === true
              const statusLabel = assignment
                ? formatExamAssignmentStatus(assignment.assignment_status)
                : 'Chưa tạo bài kiểm tra'

              return (
                <div
                  key={option}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{option}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {mapped.subject_code}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        canTake
                          ? 'bg-emerald-100 text-emerald-800'
                          : assignment
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <p>
                      Bài kiểm tra sẽ được tạo độc lập theo sự kiện bổ sung hiện tại.
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      Môn: {mapped.optionLabel}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      Mã môn: {mapped.subject_code}
                    </p>
                    {mapped.default_set_code ? (
                      <p className="mt-1 text-sm text-gray-700">
                        Bộ đề mặc định: {mapped.default_set_code}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">
                        Bộ đề mặc định: chưa có (bài kiểm tra sẽ dùng cấu hình mặc định)
                      </p>
                    )}
                    {selectedSupplementEvent ? (
                      <p className="mt-2 text-sm text-gray-500">
                        Thời điểm đăng ký: {formatDateTime(selectedSupplementEvent.startAt)} — {formatDateTime(selectedSupplementEvent.endAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {canTake ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!assignment?.id) return
                          setShowSupplementModal(false)
                          setSelectedSupplementEvent(null)
                          router.push(`/user/assignments/exam/${assignment.id}`)
                        }}
                        className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Làm bài
                      </button>
                    ) : assignment ? (
                      <button
                        type="button"
                        disabled
                        className="rounded-md bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-600"
                      >
                        Đã hoàn thành
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={registeringSupplementOption === option}
                        onClick={() => createSupplementAssignmentForOption(option)}
                        className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
                          registeringSupplementOption === option
                            ? 'bg-[#a1001f] cursor-wait'
                            : 'bg-[#a1001f] hover:bg-[#7f0017]'
                        }`}
                      >
                        {registeringSupplementOption === option
                          ? 'Đang tạo bài kiểm tra...'
                          : 'Tạo bài kiểm tra'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
      </Modal>
    </PageContainer>
  )
}
