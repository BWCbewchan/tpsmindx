'use client'

import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepItem, Stepper } from '@/components/ui/stepper'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { CAMPUS_LIST, findMatchingCampus, normalizeText } from '@/lib/campus-data'
import { resolveCenterBuEmail } from '@/lib/center-bu-email-fallback'
import { useTeacher } from '@/lib/teacher-context'
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    CircleX,
    Plus,
    RefreshCcw,
    Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LeaveBuNotice } from '@/components/leave-request/LeaveBuNotice'
import { SubstituteWorkEmailSuggestInput } from '@/components/leave-request/SubstituteWorkEmailSuggestInput'
import {
  LeaveSessionField,
  parseLeaveSessionNumber,
} from '@/components/leave-request/LeaveSessionField'
import { Time24Select } from '@/components/leave-request/Time24Select'

interface LeaveRequest {
  id: number
  teacher_name: string
  lms_code: string
  email: string
  campus: string
  center_id?: number | null
  campus_bu_email?: string | null
  leave_date: string
  reason: string
  class_code?: string
  student_count?: string
  class_time?: string
  leave_session?: string
  has_substitute: boolean
  substitute_teacher?: string
  substitute_email?: string
  class_status?: string
  email_subject?: string
  email_body?: string
  status:
    | 'pending_admin'
    | 'approved_unassigned'
    | 'approved_assigned'
    | 'rejected'
    | 'substitute_confirmed'
  admin_note?: string
  created_at: string
  updated_at: string
}

type StatusVariant = 'warning' | 'info' | 'success' | 'danger'

const STORAGE_KEY = 'teacher_leave_request_auto_fill_data'
const SELECT_BASE_CLASS =
  'w-full min-w-0 max-w-full min-h-11 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-3 pr-10 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
const INPUT_BASE_CLASS =
  'w-full min-w-0 max-w-full min-h-11 rounded-lg border border-gray-300 px-3 py-3 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
const TEXTAREA_BASE_CLASS =
  'w-full min-w-0 max-w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
const MIN_ADVANCE_HOURS = 72
const MAX_REQUESTS_PER_CLASS = 2

type StatFilter = 'pending' | 'done' | 'rejected'

type CampusOption = {
  label: string
  value: string
  shortCode?: string | null
  email?: string | null
  centerId?: number
}

type CenterContactRow = {
  role_code: string
  role_name: string | null
  full_name: string
  email: string
}

function normRoleCode(code: unknown): string {
  return String(code ?? '')
    .trim()
    .toUpperCase()
}

/** Email hiển thị trên dropdown cơ sở = DB + fallback (cùng nguồn với dòng 2 trong list). */
function resolvedBuEmailForOption(row: {
  email?: string | null
  short_code?: string | null
  full_name?: string
}): string | undefined {
  const r = resolveCenterBuEmail({
    email: row.email,
    short_code: row.short_code,
    full_name: row.full_name ?? '',
  })
  const t = r?.trim()
  return t || undefined
}

/** Khớp với lần gọi GET center-contacts (tránh dùng BU của cơ sở trước khi đổi campus). */
function buildCenterContactsFetchKey(opts: {
  pendingEditOpen: boolean
  campus: string
  centerId?: number | null
}): string {
  const c = (opts.campus || '').trim()
  const raw = opts.centerId
  const cid =
    raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0
      ? Number(raw)
      : null
  if (!c && cid == null) return ''
  return `${opts.pendingEditOpen ? 'e' : 'n'}|${cid ?? 'x'}|${normalizeText(c)}`
}

function trustedCenterBuEmail(
  loadedKey: string,
  fetchKey: string,
  contactsBu: string | null | undefined,
): string {
  if (!fetchKey || loadedKey !== fetchKey) return ''
  return (contactsBu ?? '').trim()
}

function formatContactPreviewLine(c: CenterContactRow): string {
  const em = (c.email || '').trim()
  const name = (c.full_name || '').trim()
  const label = (c.role_name || '').trim() || c.role_code
  if (!em) return `${label}: ${name}`.trim()
  return `${label}: ${name} — ${em}`
}

/** Chuẩn hoá "8:0:0" | "08:30" -> "08:30" */
function normalizeHhMm(iso: string): string {
  const parts = iso.split(':').map((p) => parseInt(p, 10))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToVnSegment(iso: string): string {
  const [hs, ms] = normalizeHhMm(iso).split(':')
  const h = parseInt(hs ?? '0', 10)
  const m = parseInt(ms ?? '0', 10)
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatClassTimeRange(start: string, end: string): string {
  return `${timeToVnSegment(start)} - ${timeToVnSegment(end)}`
}

/** Đảo từ chuỗi đã lưu (vd `13h38 - 15h38`) sang `HH:mm` cho input type=time */
function parseVnClassTimeRangeToInputs(range: string): {
  start: string | null
  end: string | null
} {
  const s = range.trim()
  if (!s) return { start: null, end: null }
  const m = s.match(/(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})/i)
  if (!m) return { start: null, end: null }
  const h1 = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min1 = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  const h2 = Math.min(23, Math.max(0, parseInt(m[3], 10)))
  const min2 = Math.min(59, Math.max(0, parseInt(m[4], 10)))
  return {
    start: `${String(h1).padStart(2, '0')}:${String(min1).padStart(2, '0')}`,
    end: `${String(h2).padStart(2, '0')}:${String(min2).padStart(2, '0')}`,
  }
}

function timeToMinutes(iso: string): number {
  const [h, m] = normalizeHhMm(iso).split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function matchesStatFilter(
  status: LeaveRequest['status'],
  filter: StatFilter | null,
): boolean {
  if (!filter) return true
  if (filter === 'pending') return status === 'pending_admin'
  if (filter === 'done') return status === 'substitute_confirmed'
  return status === 'rejected'
}

function getStatusMeta(status: LeaveRequest['status']): {
  label: string
  variant: StatusVariant
} {
  switch (status) {
    case 'pending_admin':
      return { label: 'Chờ TC/Leader duyệt', variant: 'warning' }
    case 'approved_unassigned':
      return { label: 'Đã duyệt - chờ phân GV thay', variant: 'info' }
    case 'approved_assigned':
      return { label: 'Đã gửi cho GV thay thế', variant: 'info' }
    case 'substitute_confirmed':
      return { label: 'GV thay đã xác nhận', variant: 'success' }
    case 'rejected':
      return { label: 'Từ chối', variant: 'danger' }
    default:
      return { label: status, variant: 'info' }
  }
}

function getWorkflowSteps(status: LeaveRequest['status']): StepItem[] {
  const step1: StepItem = {
    id: 1,
    label: 'Gửi mail xin nghỉ',
    status: 'completed',
  }

  let step2Status: StepItem['status'] = 'current'
  let step3Status: StepItem['status'] = 'upcoming'
  let step4Status: StepItem['status'] = 'upcoming'

  if (status === 'rejected') {
    step2Status = 'error'
    step4Status = 'error'
  } else if (
    status === 'approved_unassigned' ||
    status === 'approved_assigned'
  ) {
    step2Status = 'success'
    step3Status = 'current'
  } else if (status === 'substitute_confirmed') {
    step2Status = 'success'
    step3Status = 'success'
    step4Status = 'success'
  }

  return [
    step1,
    { id: 2, label: 'TC/Leader duyệt', status: step2Status },
    { id: 3, label: 'GV thay thế xác nhận', status: step3Status },
    { id: 4, label: 'Hoàn tất quy trình', status: step4Status },
  ]
}

interface XinNghiProps {
  initialLeaveDate?: string
  externalOpen?: boolean
  onCreated?: () => void
}

export default function XinNghiContent({ initialLeaveDate, externalOpen, onCreated }: XinNghiProps) {
  const { user, token } = useAuth()
  const { teacherProfile } = useTeacher()
  const campusPickerRef = useRef<HTMLDivElement | null>(null)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [campusFilter, setCampusFilter] = useState<string[]>([])
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [showCampusDropdown, setShowCampusDropdown] = useState(false)
  const [campusSearchText, setCampusSearchText] = useState('')
  const [showCampusPicker, setShowCampusPicker] = useState(false)
  const [campusPickerSearchText, setCampusPickerSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null,
  )
  const [classTimeStart, setClassTimeStart] = useState<string | null>(null)
  const [classTimeEnd, setClassTimeEnd] = useState<string | null>(null)
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null)

  const campusOptions = useMemo(() => {
    const set = new Set<string>()
    leaveRequests.forEach((item) => {
      if (item.campus) set.add(item.campus)
    })
    return Array.from(set).sort()
  }, [leaveRequests])

  const filteredCampusOptions = useMemo(() => {
    if (!campusSearchText.trim()) return campusOptions
    const searchLower = campusSearchText.toLowerCase()
    return campusOptions.filter((campus) =>
      campus.toLowerCase().includes(searchLower),
    )
  }, [campusOptions, campusSearchText])

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((item) => {
      if (!matchesStatFilter(item.status, statFilter)) {
        return false
      }
      if (campusFilter.length > 0 && !campusFilter.includes(item.campus)) {
        return false
      }
      if (fromDate && new Date(item.leave_date) < new Date(fromDate)) {
        return false
      }
      if (toDate && new Date(item.leave_date) > new Date(toDate)) {
        return false
      }
      return true
    })
  }, [leaveRequests, campusFilter, fromDate, toDate, statFilter])

  const [formData, setFormData] = useState({
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    campus_email: '',
    leave_date: '',
    reason: '',
    class_code: '',
    student_count: '',
    class_time: '',
    leave_session: '',
    has_substitute: false,
    substitute_teacher: '',
    substitute_email: '',
    class_status: '',
  })

  const [leaveFormCampuses, setLeaveFormCampuses] = useState<
    {
      id?: number
      full_name: string
      short_code?: string | null
      email?: string | null
    }[]
  >([])

  const [centerContacts, setCenterContacts] = useState<{
    buEmail: string | null
    contacts: CenterContactRow[]
  } | null>(null)
  const [centerContactsLoading, setCenterContactsLoading] = useState(false)
  const [centerContactsLoadedKey, setCenterContactsLoadedKey] = useState('')

  useEffect(() => {
    if (!user?.email) {
      setLeaveFormCampuses([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/leave-requests/campuses', {
          headers: authHeaders(token),
          cache: 'no-store',
        })
        const d = await r.json()
        if (cancelled || !r.ok || !d?.success) return
        setLeaveFormCampuses(Array.isArray(d.data) ? d.data : [])
      } catch {
        if (!cancelled) setLeaveFormCampuses([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.email, token])

  const campusSelectionOptions = useMemo<CampusOption[]>(() => {
    if (leaveFormCampuses.length > 0) {
      const seen = new Set<string>()
      const options: CampusOption[] = []
      for (const row of leaveFormCampuses) {
        const v = String(row.full_name ?? '').trim()
        if (!v || seen.has(v)) continue
        seen.add(v)
        options.push({
          label: v,
          value: v,
          shortCode: row.short_code ?? null,
          email: resolvedBuEmailForOption({
            email: row.email,
            short_code: row.short_code,
            full_name: v,
          }),
          centerId: typeof row.id === 'number' ? row.id : undefined,
        })
      }
      return options
    }

    const assignedCenters = user?.assignedCenters ?? []
    let options: CampusOption[]
    if (assignedCenters.length > 0) {
      options = assignedCenters.map((center) => ({
        label: center.full_name,
        value: center.full_name,
        shortCode: center.short_code,
        email: resolvedBuEmailForOption({
          email: center.email,
          short_code: center.short_code,
          full_name: center.full_name,
        }),
        centerId: center.id,
      }))
    } else {
      options = CAMPUS_LIST.map((label) => ({
        label,
        value: label,
        email: resolvedBuEmailForOption({ full_name: label }),
      }))
    }

    return Array.from(
      new Map(options.map((option) => [option.value, option])).values(),
    ).sort((a, b) => normalizeText(a.label).localeCompare(normalizeText(b.label)))
  }, [leaveFormCampuses, user?.assignedCenters])

  const filteredCampusSelectionOptions = useMemo(() => {
    const search = normalizeText(campusPickerSearchText)
    if (!search) return campusSelectionOptions

    return campusSelectionOptions.filter((option) => {
      return (
        normalizeText(option.label).includes(search) ||
        normalizeText(option.shortCode ?? '').includes(search)
      )
    })
  }, [campusPickerSearchText, campusSelectionOptions])

  const selectedCampusOption = useMemo(
    () =>
      campusSelectionOptions.find(
        (option) => option.value === formData.campus,
      ),
    [campusSelectionOptions, formData.campus],
  )

  const [pendingEditOpen, setPendingEditOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editClassTimeStart, setEditClassTimeStart] = useState<string | null>(
    null,
  )
  const [editClassTimeEnd, setEditClassTimeEnd] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    teacher_name: '',
    lms_code: '',
    campus: '',
    campus_email: '',
    leave_date: '',
    reason: '',
    class_code: '',
    student_count: '',
    class_time: '',
    leave_session: '',
    has_substitute: false,
    substitute_teacher: '',
    substitute_email: '',
    class_status: '',
  })

  const selectedEditCampusOption = useMemo(
    () =>
      campusSelectionOptions.find(
        (option) => option.value === editForm.campus,
      ),
    [campusSelectionOptions, editForm.campus],
  )

  useEffect(() => {
    const campus = (
      pendingEditOpen ? editForm.campus : formData.campus
    )?.trim()
    const cid = pendingEditOpen
      ? selectedEditCampusOption?.centerId
      : selectedCampusOption?.centerId
    if (!campus && cid == null) {
      setCenterContacts(null)
      setCenterContactsLoadedKey('')
      setCenterContactsLoading(false)
      return
    }
    const fetchKey = buildCenterContactsFetchKey({
      pendingEditOpen,
      campus: campus ?? '',
      centerId: cid,
    })
    let cancelled = false
    setCenterContactsLoadedKey('')
    setCenterContactsLoading(true)
    const qs =
      cid != null
        ? `centerId=${encodeURIComponent(String(cid))}`
        : `fullName=${encodeURIComponent(campus!)}`
    void fetch(`/api/leave-requests/center-contacts?${qs}`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
      .then(async (r) => {
        const d = (await r.json()) as {
          success?: boolean
          buEmail?: string | null
          contacts?: CenterContactRow[]
        }
        if (cancelled) return
        if (!r.ok || !d?.success) {
          setCenterContacts(null)
          if (!cancelled) setCenterContactsLoadedKey('')
          return
        }
        setCenterContacts({
          buEmail: d.buEmail ?? null,
          contacts: Array.isArray(d.contacts) ? d.contacts : [],
        })
        if (!cancelled) setCenterContactsLoadedKey(fetchKey)
      })
      .catch(() => {
        if (!cancelled) {
          setCenterContacts(null)
          setCenterContactsLoadedKey('')
        }
      })
      .finally(() => {
        if (!cancelled) setCenterContactsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    formData.campus,
    selectedCampusOption?.centerId,
    pendingEditOpen,
    editForm.campus,
    selectedEditCampusOption?.centerId,
    token,
  ])

  useEffect(() => {
    if (!pendingEditOpen) return
    if (editClassTimeStart && editClassTimeEnd) {
      const next = formatClassTimeRange(editClassTimeStart, editClassTimeEnd)
      setEditForm((prev) =>
        prev.class_time === next ? prev : { ...prev, class_time: next },
      )
    } else {
      setEditForm((prev) =>
        prev.class_time === '' ? prev : { ...prev, class_time: '' },
      )
    }
  }, [pendingEditOpen, editClassTimeStart, editClassTimeEnd])

  useEffect(() => {
    setPendingEditOpen(false)
    setEditClassTimeStart(null)
    setEditClassTimeEnd(null)
  }, [selectedRequest?.id])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      setFormData((prev) => ({ ...prev, ...parsed }))
    } catch (error) {
      console.error('Error loading leave request cache', error)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        campusPickerRef.current &&
        !campusPickerRef.current.contains(event.target as Node)
      ) {
        setShowCampusPicker(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCampusPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const saveFormDraft = (next: {
    teacher_name: string
    lms_code: string
    email: string
    campus: string
  }) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        teacher_name: next.teacher_name,
        lms_code: next.lms_code,
        email: next.email,
        campus: next.campus,
      }),
    )
  }

  useEffect(() => {
    if (!teacherProfile) {
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user?.email || '',
      }))
      return
    }

    const teacherBranch =
      teacherProfile.branchIn || teacherProfile.branchCurrent || ''
    const matchedCampus = findMatchingCampus(teacherBranch)

    setFormData((prev) => {
      const preservedCampus = campusSelectionOptions.some(
        (option) => option.value === prev.campus,
      )
        ? prev.campus
        : ''
      const matchedCampusAllowed = campusSelectionOptions.some(
        (option) => option.value === matchedCampus,
      )

      const nextCampus = preservedCampus || (matchedCampusAllowed ? matchedCampus : '')
      const selectedCenter = campusSelectionOptions.find(
        (option) => option.value === nextCampus,
      )

      const updated = {
        ...prev,
        teacher_name: teacherProfile.name || prev.teacher_name || '',
        lms_code: teacherProfile.code || prev.lms_code || '',
        email:
          teacherProfile.emailMindx ||
          teacherProfile.emailPersonal ||
          prev.email ||
          user?.email ||
          '',
        campus: nextCampus,
        campus_email: selectedCenter?.email || '',
      }

      saveFormDraft(updated)

      return updated
    })
  }, [campusSelectionOptions, teacherProfile, user?.email])

  const handleCampusSelect = (campus: string) => {
    setFormData((prev) => {
      const selectedCenter = campusSelectionOptions.find(c => c.value === campus)
      const next = { ...prev, campus, campus_email: selectedCenter?.email || '' }
      saveFormDraft(next)
      return next
    })
    setShowCampusPicker(false)
    setCampusPickerSearchText('')
  }

  const fetchLeaveRequests = useCallback(
    async (showRefreshToast = false) => {
      if (!user?.email) return

      try {
        setLoading(true)
        setLoadingError(null)

        const response = await fetch(
          `/api/leave-requests?email=${encodeURIComponent(user.email)}`,
          { headers: authHeaders(token) },
        )
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể tải danh sách yêu cầu')
        }

        setLeaveRequests(data.data || [])
        if (showRefreshToast) toast.success('Đã cập nhật danh sách mới nhất')
      } catch (error: unknown) {
        console.error('Error fetching leave requests:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Có lỗi khi tải dữ liệu'
        setLoadingError(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [user?.email, token],
  )

  useEffect(() => {
    if (user?.email) {
      fetchLeaveRequests()
    }
  }, [fetchLeaveRequests, user?.email])

  // If parent requests opening modal externally, show modal and prefill date
  useEffect(() => {
    if (externalOpen) {
      console.log('XinNghiContent: externalOpen received', { initialLeaveDate })
      try { toast.info('Mở form xin nghỉ...') } catch (_) {}
      // prefill leave_date if given (expected format YYYY-MM-DD)
      if (initialLeaveDate) {
        setFormData((prev) => ({ ...prev, leave_date: initialLeaveDate }))
      }
      setShowModal(true)
    }
  }, [externalOpen, initialLeaveDate])

  useEffect(() => {
    if (classTimeStart && classTimeEnd) {
      const next = formatClassTimeRange(classTimeStart, classTimeEnd)
      setFormData((prev) =>
        prev.class_time === next ? prev : { ...prev, class_time: next },
      )
    } else {
      setFormData((prev) =>
        prev.class_time === '' ? prev : { ...prev, class_time: '' },
      )
    }
  }, [classTimeStart, classTimeEnd])

  const createCenterContactsFetchKey = useMemo(
    () =>
      buildCenterContactsFetchKey({
        pendingEditOpen: false,
        campus: formData.campus,
        centerId: selectedCampusOption?.centerId,
      }),
    [formData.campus, selectedCampusOption?.centerId],
  )

  const editCenterContactsFetchKey = useMemo(
    () =>
      buildCenterContactsFetchKey({
        pendingEditOpen: true,
        campus: editForm.campus,
        centerId: selectedEditCampusOption?.centerId,
      }),
    [editForm.campus, selectedEditCampusOption?.centerId, pendingEditOpen],
  )

  const hasSubstitute =
    formData.has_substitute && formData.substitute_teacher.trim().length > 0

  const buEmailDisplay = useMemo(() => {
    const fromApi = trustedCenterBuEmail(
      centerContactsLoadedKey,
      createCenterContactsFetchKey,
      centerContacts?.buEmail,
    )
    return (
      fromApi ||
      selectedCampusOption?.email?.trim() ||
      formData.campus_email?.trim() ||
      ''
    )
  }, [
    centerContactsLoadedKey,
    createCenterContactsFetchKey,
    centerContacts?.buEmail,
    selectedCampusOption?.email,
    formData.campus_email,
  ])

  const tcContacts = useMemo(() => {
    if (!centerContacts?.contacts?.length) return []
    return centerContacts.contacts.filter(
      (c) => normRoleCode(c.role_code) === 'TC',
    )
  }, [centerContacts])

  const toRolesLabel = 'TC, CS cơ sở xin nghỉ'

  const subjectLine = `[MindX - ${formData.campus || 'Tên Cơ Sở'}] V/v xin nghỉ 1 buổi dạy`

  const leaveDateDisplay = useMemo(() => {
    if (!formData.leave_date) return '[ngày/tháng/năm]'
    return new Date(formData.leave_date).toLocaleDateString('vi-VN')
  }, [formData.leave_date])

  const emailBody = useMemo(() => {
    return `Kính gửi:

Em là ${formData.teacher_name || '[Họ tên giáo viên đầy đủ]'} hiện đang là giáo viên tại cơ sở ${formData.campus || '[Tên Cơ Sở]'}, hôm nay em viết email này xin được nghỉ vào ngày ${leaveDateDisplay}.

Vì lý do ${formData.reason || '[nêu lý do]'}. 

Thông tin lớp học cụ thể như sau:

Mã lớp: ${formData.class_code || '[Mã lớp học]'}. 
Số học viên: ${formData.student_count || '[Số lượng học viên của lớp]'}. 
Thời gian học: ${formData.class_time || '[Giờ Thứ, Ngày]'}. 
Buổi học: ${formData.leave_session || '[Buổi học xin nghỉ]'}. 
Giáo viên thay thế: ${formData.has_substitute ? formData.substitute_teacher || '[Nhập tên giáo viên thay thế]' : ''}. 
Tình hình lớp học: ${formData.class_status || '[Nêu tình hình của lớp, có học viên nào cần lưu ý hay đặc biệt không]'}. 

${
  hasSubstitute
    ? 'Trên đây là thông tin lớp mà em xin nghỉ, mong phía chuyên môn cơ sở xem xét và xác nhận giúp em. Em xin cảm ơn!'
    : 'Trên đây là thông tin lớp mà em xin nghỉ, vì chưa tìm được giáo viên thay nên em nhờ phía chuyên môn hỗ trợ tìm giáo viên giúp em cho buổi học trên. Em xin cảm ơn!'
}

Trân trọng,

${formData.teacher_name || '[Họ Và Tên]'}`
  }, [
    formData.teacher_name,
    formData.campus,
    formData.reason,
    formData.class_code,
    formData.student_count,
    formData.class_time,
    formData.leave_session,
    formData.class_status,
    formData.has_substitute,
    formData.substitute_teacher,
    hasSubstitute,
    leaveDateDisplay,
  ])

  const editHasSubstitute =
    editForm.has_substitute && editForm.substitute_teacher.trim().length > 0

  const editLeaveDateDisplay = useMemo(() => {
    if (!editForm.leave_date) return '[ngày/tháng/năm]'
    return new Date(editForm.leave_date).toLocaleDateString('vi-VN')
  }, [editForm.leave_date])

  const editBuEmailDisplay = useMemo(() => {
    const fromApi = trustedCenterBuEmail(
      centerContactsLoadedKey,
      editCenterContactsFetchKey,
      centerContacts?.buEmail,
    )
    return (
      fromApi ||
      selectedEditCampusOption?.email?.trim() ||
      editForm.campus_email?.trim() ||
      ''
    )
  }, [
    centerContactsLoadedKey,
    editCenterContactsFetchKey,
    centerContacts?.buEmail,
    selectedEditCampusOption?.email,
    editForm.campus_email,
  ])

  /** Modal xem chi tiết (không sửa): cùng nguồn email BU như form tạo / dropdown cơ sở. */
  const detailReadOnlyBuSnapshot = useMemo(() => {
    if (!selectedRequest) return null
    const snap = selectedRequest.campus_bu_email?.trim()
    if (snap) return snap
    const opt = campusSelectionOptions.find(
      (o) => o.value === (selectedRequest.campus || '').trim(),
    )
    const fromPicker = opt?.email?.trim()
    if (fromPicker) return fromPicker
    const fb = resolveCenterBuEmail({
      full_name: selectedRequest.campus || '',
    })?.trim()
    return fb || null
  }, [
    selectedRequest?.id,
    selectedRequest?.campus,
    selectedRequest?.campus_bu_email,
    campusSelectionOptions,
  ])

  const editDraftSubject = useMemo(
    () =>
      `[MindX - ${editForm.campus || 'Tên Cơ Sở'}] V/v xin nghỉ 1 buổi dạy`,
    [editForm.campus],
  )

  const editDraftBody = useMemo(() => {
    return `Kính gửi:

Em là ${editForm.teacher_name || '[Họ tên giáo viên đầy đủ]'} hiện đang là giáo viên tại cơ sở ${editForm.campus || '[Tên Cơ Sở]'}, hôm nay em viết email này xin được nghỉ vào ngày ${editLeaveDateDisplay}.

Vì lý do ${editForm.reason || '[nêu lý do]'}. 

Thông tin lớp học cụ thể như sau:

Mã lớp: ${editForm.class_code || '[Mã lớp học]'}. 
Số học viên: ${editForm.student_count || '[Số lượng học viên của lớp]'}. 
Thời gian học: ${editForm.class_time || '[Giờ Thứ, Ngày]'}. 
Buổi học: ${editForm.leave_session || '[Buổi học xin nghỉ]'}. 
Giáo viên thay thế: ${editForm.has_substitute ? editForm.substitute_teacher || '[Nhập tên giáo viên thay thế]' : ''}. 
Tình hình lớp học: ${editForm.class_status || '[Nêu tình hình của lớp, có học viên nào cần lưu ý hay đặc biệt không]'}. 

${
  editHasSubstitute
    ? 'Trên đây là thông tin lớp mà em xin nghỉ, mong phía chuyên môn cơ sở xem xét và xác nhận giúp em. Em xin cảm ơn!'
    : 'Trên đây là thông tin lớp mà em xin nghỉ, vì chưa tìm được giáo viên thay nên em nhờ phía chuyên môn hỗ trợ tìm giáo viên giúp em cho buổi học trên. Em xin cảm ơn!'
}

Trân trọng,

${editForm.teacher_name || '[Họ Và Tên]'}`
  }, [
    editForm.teacher_name,
    editForm.campus,
    editForm.reason,
    editForm.class_code,
    editForm.student_count,
    editForm.class_time,
    editForm.leave_session,
    editForm.class_status,
    editForm.has_substitute,
    editForm.substitute_teacher,
    editHasSubstitute,
    editLeaveDateDisplay,
  ])

  const pendingCount = useMemo(
    () =>
      leaveRequests.filter((item) => item.status === 'pending_admin').length,
    [leaveRequests],
  )
  const doneCount = useMemo(
    () =>
      leaveRequests.filter((item) => item.status === 'substitute_confirmed')
        .length,
    [leaveRequests],
  )
  const rejectedCount = useMemo(
    () => leaveRequests.filter((item) => item.status === 'rejected').length,
    [leaveRequests],
  )
  const totalCount = leaveRequests.length

  const handleChange = (
    field: keyof typeof formData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetFormForNew = () => {
    setFormData((prev) => ({
      ...prev,
      leave_date: '',
      reason: '',
      class_code: '',
      student_count: '',
      class_time: '',
      leave_session: '',
      has_substitute: false,
      substitute_teacher: '',
      substitute_email: '',
      class_status: '',
    }))
    setClassTimeStart(null)
    setClassTimeEnd(null)
    setShowCampusPicker(false)
    setCampusPickerSearchText('')
  }

  const validateForm = () => {
    if (
      !formData.teacher_name ||
      !formData.lms_code ||
      !formData.email ||
      !formData.campus ||
      !formData.leave_date ||
      !formData.reason
    ) {
      return 'Vui lòng điền đầy đủ các trường bắt buộc.'
    }

    const classCodeTrim = formData.class_code.trim()
    if (!classCodeTrim) {
      return 'Vui lòng nhập mã lớp (tối đa 2 yêu cầu cho mỗi mã lớp).'
    }

    const studentCountTrim = formData.student_count.trim()
    if (!studentCountTrim) {
      return 'Vui lòng nhập số học viên (số nguyên lớn hơn 0).'
    }
    const studentCountNum = Number(studentCountTrim)
    if (
      !Number.isFinite(studentCountNum) ||
      !Number.isInteger(studentCountNum) ||
      studentCountNum <= 0
    ) {
      return 'Số học viên phải là số nguyên lớn hơn 0.'
    }

    const sameClassCount = leaveRequests.filter(
      (r) =>
        r.class_code &&
        r.class_code.trim().toLowerCase() === classCodeTrim.toLowerCase(),
    ).length
    if (sameClassCount >= MAX_REQUESTS_PER_CLASS) {
      return `Mỗi mã lớp chỉ được tạo tối đa ${MAX_REQUESTS_PER_CLASS} yêu cầu. Bạn đã đạt giới hạn cho mã lớp này.`
    }

    if (!classTimeStart || !classTimeEnd) {
      return 'Vui lòng chọn đủ giờ bắt đầu và giờ kết thúc (giờ và phút).'
    }

    if (timeToMinutes(classTimeEnd) <= timeToMinutes(classTimeStart)) {
      return 'Giờ kết thúc phải sau giờ bắt đầu.'
    }

    if (!parseLeaveSessionNumber(formData.leave_session)) {
      return 'Vui lòng nhập số buổi học xin nghỉ (Buổi 1 – Buổi 14).'
    }

    if (formData.reason.trim().length < 10) {
      return 'Lý do xin nghỉ cần rõ ràng hơn (tối thiểu 10 ký tự).'
    }

    const leaveDateMs = new Date(`${formData.leave_date}T00:00:00`).getTime()
    const diffHours = (leaveDateMs - Date.now()) / (1000 * 60 * 60)
    if (diffHours < MIN_ADVANCE_HOURS) {
      return `Ngày xin nghỉ cần cách thời điểm hiện tại tối thiểu ${MIN_ADVANCE_HOURS} giờ.`
    }

    if (formData.has_substitute) {
      if (
        !formData.substitute_teacher.trim() ||
        !formData.substitute_email.trim()
      ) {
        return 'Nếu đã tích giáo viên thay thế, cần nhập đầy đủ tên và email giáo viên thay.'
      }
      const emailValid = /\S+@\S+\.\S+/.test(formData.substitute_email.trim())
      if (!emailValid) {
        return 'Email giáo viên thay thế chưa đúng định dạng.'
      }
    }

    return null
  }

  const editFormChange = (
    field: keyof typeof editForm,
    value: string | boolean,
  ) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const openPendingEdit = () => {
    if (!selectedRequest || selectedRequest.status !== 'pending_admin') return
    const r = selectedRequest
    const dateStr =
      typeof r.leave_date === 'string' && r.leave_date.includes('T')
        ? r.leave_date.split('T')[0]!
        : String(r.leave_date || '').slice(0, 10)
    const parsed = parseVnClassTimeRangeToInputs(r.class_time || '')
    setEditClassTimeStart(parsed.start)
    setEditClassTimeEnd(parsed.end)
    const opt = campusSelectionOptions.find((o) => o.value === (r.campus || ''))
    setEditForm({
      teacher_name: r.teacher_name || '',
      lms_code: r.lms_code || '',
      campus: r.campus || '',
      campus_email: opt?.email?.trim() || r.campus_bu_email?.trim() || '',
      leave_date: dateStr,
      reason: r.reason || '',
      class_code: (r.class_code || '').trim(),
      student_count: String(r.student_count ?? '').trim() || '',
      class_time: r.class_time || '',
      leave_session: r.leave_session || '',
      has_substitute: Boolean(r.has_substitute),
      substitute_teacher: r.substitute_teacher || '',
      substitute_email: r.substitute_email || '',
      class_status: r.class_status || '',
    })
    setPendingEditOpen(true)
  }

  const validatePendingEdit = (): string | null => {
    if (!selectedRequest) return 'Thiếu yêu cầu.'

    if (
      !editForm.teacher_name ||
      !editForm.lms_code ||
      !editForm.campus ||
      !editForm.leave_date ||
      !editForm.reason
    ) {
      return 'Vui lòng điền đầy đủ các trường bắt buộc.'
    }

    const classCodeTrim = editForm.class_code.trim()
    if (!classCodeTrim) {
      return 'Vui lòng nhập mã lớp (tối đa 2 yêu cầu cho mỗi mã lớp).'
    }

    const studentCountTrim = editForm.student_count.trim()
    if (!studentCountTrim) {
      return 'Vui lòng nhập số học viên (số nguyên lớn hơn 0).'
    }
    const studentCountNum = Number(studentCountTrim)
    if (
      !Number.isFinite(studentCountNum) ||
      !Number.isInteger(studentCountNum) ||
      studentCountNum <= 0
    ) {
      return 'Số học viên phải là số nguyên lớn hơn 0.'
    }

    const sameClassCount = leaveRequests.filter(
      (req) =>
        req.id !== selectedRequest.id &&
        req.class_code &&
        req.class_code.trim().toLowerCase() === classCodeTrim.toLowerCase(),
    ).length
    if (sameClassCount >= MAX_REQUESTS_PER_CLASS) {
      return `Mỗi mã lớp chỉ được tạo tối đa ${MAX_REQUESTS_PER_CLASS} yêu cầu. Bạn đã đạt giới hạn cho mã lớp này.`
    }

    if (!editClassTimeStart || !editClassTimeEnd) {
      return 'Vui lòng chọn đủ giờ bắt đầu và giờ kết thúc (giờ và phút).'
    }

    if (timeToMinutes(editClassTimeEnd) <= timeToMinutes(editClassTimeStart)) {
      return 'Giờ kết thúc phải sau giờ bắt đầu.'
    }

    if (!parseLeaveSessionNumber(editForm.leave_session)) {
      return 'Vui lòng nhập số buổi học xin nghỉ (Buổi 1 – Buổi 14).'
    }

    if (editForm.reason.trim().length < 10) {
      return 'Lý do xin nghỉ cần rõ ràng hơn (tối thiểu 10 ký tự).'
    }

    const leaveDateMs = new Date(`${editForm.leave_date}T00:00:00`).getTime()
    const diffHours = (leaveDateMs - Date.now()) / (1000 * 60 * 60)
    if (diffHours < MIN_ADVANCE_HOURS) {
      return `Ngày xin nghỉ cần cách thời điểm hiện tại tối thiểu ${MIN_ADVANCE_HOURS} giờ.`
    }

    if (editForm.has_substitute) {
      if (
        !editForm.substitute_teacher.trim() ||
        !editForm.substitute_email.trim()
      ) {
        return 'Nếu đã tích giáo viên thay thế, cần nhập đầy đủ tên và email giáo viên thay.'
      }
      if (!/\S+@\S+\.\S+/.test(editForm.substitute_email.trim())) {
        return 'Email giáo viên thay thế chưa đúng định dạng.'
      }
    }

    return null
  }

  const savePendingEdit = async () => {
    if (!selectedRequest) return
    const validationError = validatePendingEdit()
    if (validationError) {
      toast.error(validationError)
      return
    }
    const classTimeStr = formatClassTimeRange(
      editClassTimeStart!,
      editClassTimeEnd!,
    )
    const normalizedStudentCount = String(
      Number(editForm.student_count.trim()),
    )

    setEditSubmitting(true)

    try {
      const resolvedCampusEmail =
        trustedCenterBuEmail(
          centerContactsLoadedKey,
          editCenterContactsFetchKey,
          centerContacts?.buEmail,
        ) ||
        selectedEditCampusOption?.email?.trim() ||
        editForm.campus_email?.trim() ||
        ''
      const response = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          action: 'teacher_update',
          id: selectedRequest.id,
          teacher_name: editForm.teacher_name,
          lms_code: editForm.lms_code,
          email: selectedRequest.email,
          campus: editForm.campus,
          leave_date: editForm.leave_date,
          reason: editForm.reason,
          class_code: editForm.class_code.trim(),
          student_count: normalizedStudentCount,
          class_time: classTimeStr,
          leave_session: editForm.leave_session,
          has_substitute: editForm.has_substitute,
          substitute_teacher: editForm.has_substitute
            ? editForm.substitute_teacher
            : '',
          substitute_email: editForm.has_substitute
            ? editForm.substitute_email
            : '',
          class_status: editForm.class_status,
          email_subject: editDraftSubject,
          email_body: editDraftBody,
          center_id: selectedEditCampusOption?.centerId ?? null,
          campus_bu_email: resolvedCampusEmail || null,
        }),
      })

      const data = await response.json()

      if (data.success && data.data) {
        toast.success('Đã cập nhật yêu cầu. TC/Leader sẽ thấy bản mới nhất.')
        setSelectedRequest(data.data as LeaveRequest)
        setPendingEditOpen(false)
        setEditClassTimeStart(null)
        setEditClassTimeEnd(null)
        void fetchLeaveRequests()
      } else {
        toast.error(`Lỗi: ${data.error || 'Không lưu được'}`)
      }
    } catch (error) {
      console.error('Error updating leave request:', error)
      toast.error('Có lỗi xảy ra khi cập nhật yêu cầu')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    const normalizedStudentCount = String(Number(formData.student_count.trim()))

    setSubmitting(true)

    try {
      const resolvedCampusEmail =
        trustedCenterBuEmail(
          centerContactsLoadedKey,
          createCenterContactsFetchKey,
          centerContacts?.buEmail,
        ) ||
        selectedCampusOption?.email?.trim() ||
        formData.campus_email?.trim() ||
        ''

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          ...formData,
          center_id: selectedCampusOption?.centerId ?? null,
          campus_bu_email: resolvedCampusEmail || null,
          student_count: normalizedStudentCount,
          campus_email: resolvedCampusEmail,
          email_subject: subjectLine,
          email_body: emailBody,
          substitute_teacher: formData.has_substitute
            ? formData.substitute_teacher
            : '',
          substitute_email: formData.has_substitute
            ? formData.substitute_email
            : '',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          'Tạo mail xin nghỉ thành công. Yêu cầu đã vào quy trình duyệt.',
        )
        setShowModal(false)
        resetFormForNew()
        fetchLeaveRequests()
        onCreated?.()
      } else {
        toast.error(`Lỗi: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating leave request:', error)
      toast.error('Có lỗi xảy ra khi tạo yêu cầu xin nghỉ')
    } finally {
      setSubmitting(false)
    }
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error(`Không thể copy ${label}`)
    }
  }

  const detailCanTeacherEdit = useMemo(
    () =>
      !!selectedRequest &&
      selectedRequest.status === 'pending_admin' &&
      !!user?.email &&
      !!selectedRequest.email &&
      selectedRequest.email.trim().toLowerCase() ===
        user.email.trim().toLowerCase(),
    [selectedRequest, user?.email],
  )

  if (loading) {
    return <PageSkeleton variant="table" itemCount={8} showHeader={true} />
  }

  return (
    <>
    <PageLayout>
      <PageLayoutContent spacing="lg">
        <PageHeader
          title="Xin nghỉ 1 buổi"
          actions={
            <div className="flex gap-2">
              <Button
                size="lg"
                variant="outline"
                onClick={() => fetchLeaveRequests(true)}
                className="h-10 border-[#f3b4bd] text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5"
              >
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Làm mới
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  resetFormForNew()
                  setShowCampusPicker(false)
                  setShowModal(true)
                }}
                className="whitespace-nowrap border-2 border-[#a1001f] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a]"
              >
                <Plus className="mr-2 h-5 w-5" />
                Tạo yêu cầu xin nghỉ
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatFilter(null)}
            aria-pressed={statFilter === null}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              statFilter === null
                ? 'border-gray-400 bg-gray-100 shadow-md ring-2 ring-gray-300'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100/80'
            }`}
          >
            <p className="text-xs font-medium text-gray-700">Tất cả</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'pending' ? null : 'pending'))
            }
            aria-pressed={statFilter === 'pending'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
              statFilter === 'pending'
                ? 'border-amber-400 bg-amber-100 shadow-md ring-2 ring-amber-300'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100/80'
            }`}
          >
            <p className="text-xs font-medium text-amber-700">Chờ duyệt</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {pendingCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'done' ? null : 'done'))
            }
            aria-pressed={statFilter === 'done'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
              statFilter === 'done'
                ? 'border-emerald-400 bg-emerald-100 shadow-md ring-2 ring-emerald-300'
                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80'
            }`}
          >
            <p className="text-xs font-medium text-emerald-700">Đã hoàn tất</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {doneCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'rejected' ? null : 'rejected'))
            }
            aria-pressed={statFilter === 'rejected'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 ${
              statFilter === 'rejected'
                ? 'border-red-400 bg-red-100 shadow-md ring-2 ring-red-300'
                : 'border-red-200 bg-red-50 hover:bg-red-100/80'
            }`}
          >
            <p className="text-xs font-medium text-red-700">Bị từ chối</p>
            <p className="mt-1 text-2xl font-bold text-red-900">
              {rejectedCount}
            </p>
          </button>
        </div>

        {/* Bộ lọc nâng cao */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="relative w-full md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cơ sở
            </label>
            <button
              type="button"
              onClick={() => setShowCampusDropdown(!showCampusDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 md:min-w-45"
            >
              <span className="min-w-0 flex-1 text-left break-words leading-snug line-clamp-2">
                {campusFilter.length === 0
                  ? 'Tất cả'
                  : `${campusFilter.length} cơ sở`}
              </span>
              <svg
                className="w-4 h-4 ml-2 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showCampusDropdown && (
              <div className="absolute left-0 right-0 z-10 mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg md:left-auto md:right-auto md:min-w-60">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="Tìm kiếm cơ sở..."
                    value={campusSearchText}
                    onChange={(e) => setCampusSearchText(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="p-2 border-b border-gray-200 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCampusFilter(filteredCampusOptions)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampusFilter([])}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Bỏ chọn
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredCampusOptions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      Không tìm thấy cơ sở
                    </div>
                  ) : (
                    filteredCampusOptions.map((campus) => (
                      <label
                        key={campus}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={campusFilter.includes(campus)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCampusFilter([...campusFilter, campus])
                            } else {
                              setCampusFilter(
                                campusFilter.filter((c) => c !== campus),
                              )
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{campus}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="w-fit md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-auto"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
            />
          </div>
          <div className="w-fit md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-auto"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
            />
          </div>
          {(campusFilter.length > 0 ||
            fromDate ||
            toDate ||
            statFilter !== null) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCampusFilter([])
                setFromDate('')
                setToDate('')
                setStatFilter(null)
              }}
            >
              Xoá lọc
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách yêu cầu xin nghỉ
            </h2>
            <p className="text-sm text-gray-600">
              Tổng: {filteredRequests.length} yêu cầu
            </p>
          </div>

          {loadingError && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Không thể tải dữ liệu</p>
                <p className="mt-0.5">{loadingError}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchLeaveRequests()}
              >
                Thử lại
              </Button>
            </div>
          )}

          {filteredRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              Không có yêu cầu nào phù hợp bộ lọc.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Ngày nghỉ</TableHead>
                      <TableHead>Cơ sở</TableHead>
                      <TableHead>Mã lớp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((item) => {
                      const statusMeta = getStatusMeta(item.status)
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50/40"
                          onClick={() => setSelectedRequest(item)}
                        >
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(item.leave_date).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>{item.campus}</TableCell>
                          <TableCell>{item.class_code || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusMeta.variant}>
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-gray-200 lg:hidden">
                {filteredRequests.map((item) => {
                  const statusMeta = getStatusMeta(item.status)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full p-4 text-left hover:bg-gray-50"
                      onClick={() => setSelectedRequest(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.campus}
                        </p>
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        Ngày nghỉ:{' '}
                        {new Date(item.leave_date).toLocaleDateString('vi-VN')}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Mã lớp: {item.class_code || '-'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </PageLayoutContent>
    </PageLayout>

    {typeof document !== 'undefined' && createPortal(
      <Modal open={showModal} onClose={() => {
        setShowCampusPicker(false)
        setCampusPickerSearchText('')
        setShowModal(false)
      }} title="Tạo yêu cầu xin nghỉ 1 buổi" maxWidth="4xl">
        <form onSubmit={handleSubmit} className="space-y-5 pb-2 sm:pb-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Quy định nhanh</p>
              <div className="mt-2 space-y-1 text-[13px]">
                <p className="flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  Báo nghỉ trước tối thiểu {MIN_ADVANCE_HOURS} giờ.
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Mỗi mã lớp tối đa {MAX_REQUESTS_PER_CLASS} yêu cầu; cung cấp đủ
                  thông tin lớp để admin phân GV thay nhanh.
                </p>
                <p className="flex items-center gap-1.5">
                  <CircleX className="h-4 w-4" />
                  Nếu có GV thay sẵn, cần nhập đủ tên và email.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 [&>div]:min-w-0">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Ngày xin nghỉ *
                </label>
                <input
                  required
                  type="date"
                  value={formData.leave_date}
                  onChange={(e) => handleChange('leave_date', e.target.value)}
                  className={`${INPUT_BASE_CLASS} appearance-none`}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Lý do xin nghỉ *
                </label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className={TEXTAREA_BASE_CLASS}
              />
            </div>

            <div ref={campusPickerRef} className="relative md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Cơ sở *
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !showCampusPicker
                  setShowCampusPicker(nextOpen)
                  if (nextOpen) {
                    setCampusPickerSearchText('')
                  }
                }}
                className={`${SELECT_BASE_CLASS} flex items-start justify-between gap-2 py-2.5 text-left`}
                aria-expanded={showCampusPicker}
                aria-haspopup="listbox"
                aria-label={
                  formData.campus
                    ? `Cơ sở đã chọn: ${formData.campus}${
                        selectedCampusOption?.email?.trim() ||
                        formData.campus_email?.trim()
                          ? `, email: ${selectedCampusOption?.email?.trim() || formData.campus_email?.trim()}`
                          : ''
                      }`
                    : 'Chọn cơ sở'
                }
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="block break-words font-medium text-gray-900 leading-snug">
                    {selectedCampusOption?.label || formData.campus || 'Chọn cơ sở'}
                  </span>
                  {selectedCampusOption?.label || formData.campus ? (
                    <span className="mt-0.5 block break-all text-xs text-gray-600 leading-snug">
                      {selectedCampusOption?.email?.trim() ||
                        formData.campus_email?.trim() ||
                        'Chưa có email trên danh sách cơ sở'}
                    </span>
                  ) : null}
                </span>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 self-start text-gray-400" aria-hidden />
              </button>
              <p className="mt-1.5 text-xs text-gray-500">
                Tất cả cơ sở đang hoạt động; các cơ sở được phân quản lý (manager)
                hiển thị trước. Gõ để tìm nhanh.
              </p>

              {showCampusPicker && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={campusPickerSearchText}
                        onChange={(e) => setCampusPickerSearchText(e.target.value)}
                        placeholder="Tìm kiếm cơ sở..."
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 pl-10 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/20"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredCampusSelectionOptions.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        Không tìm thấy cơ sở phù hợp.
                      </div>
                    ) : (
                      filteredCampusSelectionOptions.map((option) => {
                        const isSelected = option.value === formData.campus

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleCampusSelect(option.value)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                              isSelected ? 'bg-[#a1001f]/5 ring-1 ring-[#a1001f]/10' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium text-gray-900 leading-snug">
                                {option.label}
                              </p>
                              {option.email?.trim() ? (
                                <p className="mt-0.5 break-all text-xs text-gray-600 leading-snug">
                                  {option.email.trim()}
                                </p>
                              ) : option.shortCode ? (
                                <p className="mt-0.5 break-words text-xs text-gray-500 leading-snug">
                                  {option.shortCode}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-gray-400">
                                  Chưa có email
                                </p>
                              )}
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : null}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {formData.campus && (
                    <div className="border-t border-gray-100 p-2">
                      <button
                        type="button"
                        onClick={() => handleCampusSelect('')}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        Xóa lựa chọn cơ sở
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Mã lớp *
              </label>
              <input
                required
                type="text"
                value={formData.class_code}
                onChange={(e) => handleChange('class_code', e.target.value)}
                className={INPUT_BASE_CLASS}
                placeholder="Nhập đúng mã lớp (giới hạn theo quy định)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="student-count">
                Số học viên *
              </label>
              <input
                id="student-count"
                required
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={formData.student_count}
                onChange={(e) => handleChange('student_count', e.target.value)}
                className={INPUT_BASE_CLASS}
                placeholder="VD: 16"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Thời gian học *
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Chọn giờ bắt đầu và giờ kết thúc (định dạng 24 giờ, 00:00–23:59).
                Giờ kết thúc phải sau giờ bắt đầu.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="class-time-start"
                    className="mb-1.5 block text-xs font-medium text-gray-600"
                  >
                    Giờ bắt đầu
                  </label>
                  <Time24Select
                    id="class-time-start"
                    value={classTimeStart}
                    onChange={setClassTimeStart}
                    groupAriaLabel="Giờ bắt đầu"
                    hourLabel="Giờ bắt đầu"
                    minuteLabel="Phút bắt đầu"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="class-time-end"
                    className="mb-1.5 block text-xs font-medium text-gray-600"
                  >
                    Giờ kết thúc
                  </label>
                  <Time24Select
                    id="class-time-end"
                    value={classTimeEnd}
                    onChange={setClassTimeEnd}
                    groupAriaLabel="Giờ kết thúc"
                    hourLabel="Giờ kết thúc"
                    minuteLabel="Phút kết thúc"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Buổi học xin nghỉ *
              </label>
              <LeaveSessionField
                id="leave-session"
                required
                value={formData.leave_session}
                onChange={(v) => handleChange('leave_session', v)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.has_substitute}
                  onChange={(e) => {
                    const checked = e.target.checked
                    handleChange('has_substitute', checked)
                    if (!checked) {
                      handleChange('substitute_teacher', '')
                      handleChange('substitute_email', '')
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Giáo viên thay thế (tích nếu đã có)
              </label>
            </div>
            {formData.has_substitute && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Tên giáo viên thay thế *
                  </label>
                  <input
                    type="text"
                    value={formData.substitute_teacher}
                    onChange={(e) =>
                      handleChange('substitute_teacher', e.target.value)
                    }
                    className={INPUT_BASE_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="substitute-work-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Email giáo viên thay thế *
                  </label>
                  <SubstituteWorkEmailSuggestInput
                    id="substitute-work-email"
                    value={formData.substitute_email}
                    onChange={(v) => handleChange('substitute_email', v)}
                    onPickRow={({ fullName, workEmail }) => {
                      setFormData((prev) => ({
                        ...prev,
                        substitute_teacher: fullName,
                        substitute_email: workEmail,
                      }))
                    }}
                    token={token}
                    inputClassName={INPUT_BASE_CLASS}
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Tình hình lớp học
              </label>
              <textarea
                rows={3}
                value={formData.class_status}
                onChange={(e) => handleChange('class_status', e.target.value)}
                className={TEXTAREA_BASE_CLASS}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-800">
                Mẫu mail sẽ gửi
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText('nội dung mail', emailBody)}
                className="w-full sm:w-auto border-[#a1001f]/30 text-[#a1001f] hover:border-[#a1001f]/50 hover:bg-[#a1001f]/5"
              >
                Copy nội dung
              </Button>
            </div>
            <p className="text-sm leading-snug">
              <span className="font-medium">To:</span>{' '}
              <span>{toRolesLabel}</span>
              {centerContactsLoading && (
                <span className="mt-1 block text-xs text-gray-500">
                  Đang tải TC và email cơ sở…
                </span>
              )}
              {buEmailDisplay ? (
                <span className="mt-1 block break-all font-mono text-[13px] text-blue-900">
                  Email cơ sở: {buEmailDisplay}
                </span>
              ) : (
                !centerContactsLoading && (
                  <span className="mt-1 block text-xs text-amber-800">
                    (Chưa có email BU — chọn cơ sở để hiển thị địa chỉ CS trong hệ
                    thống)
                  </span>
                )
              )}
              {tcContacts.length > 0 ? (
                <span className="mt-1 block text-xs text-gray-800">
                  {tcContacts.map((c, i) => (
                    <span
                      key={`${c.email}-${c.role_code}-${i}`}
                      className="block font-mono text-[13px] text-gray-900"
                    >
                      {formatContactPreviewLine(c)}
                    </span>
                  ))}
                </span>
              ) : !centerContactsLoading && formData.campus.trim() ? (
                <span className="mt-1 block text-xs text-gray-500">
                  Không tìm thấy TC trong teaching_leaders (center / khu vực như
                  màn Centers & Leaders).
                </span>
              ) : null}
            </p>
            <p className="text-sm">
              <span className="font-medium">Tiêu đề:</span> {subjectLine}
            </p>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 sm:max-h-52 sm:text-sm">
              {emailBody}
            </pre>
          </div>

          <div className="flex justify-end border-t border-gray-200 pt-5">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto sm:min-w-60 justify-center bg-[#a1001f] px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-[#8a001a]"
            >
              {submitting ? 'Đang tạo...' : 'Tạo yêu cầu xin nghỉ'}
            </Button>
          </div>
        </form>
      </Modal>, document.body)}

    {typeof document !== 'undefined' && createPortal(
      <Modal
        open={!!selectedRequest}
        onClose={() => {
          setPendingEditOpen(false)
          setEditClassTimeStart(null)
          setEditClassTimeEnd(null)
          setSelectedRequest(null)
        }}
        title={selectedRequest ? `Chi tiết yêu cầu #${selectedRequest.id}` : 'Chi tiết yêu cầu'}
        size="3xl"
      >
        {selectedRequest && (
          <div className="space-y-4">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 sm:text-base">
                  Chi tiết yêu cầu xin nghỉ
                </h3>
                <Stepper steps={getWorkflowSteps(selectedRequest.status)} />
              </div>

              {detailCanTeacherEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {!pendingEditOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#1152D4]/40 text-[#1152D4] hover:bg-[#1152D4]/5"
                      onClick={openPendingEdit}
                    >
                      Chỉnh sửa trước khi TC duyệt
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-gray-700"
                      onClick={() => {
                        setPendingEditOpen(false)
                        setEditClassTimeStart(null)
                        setEditClassTimeEnd(null)
                      }}
                    >
                      Thoát chế độ chỉnh sửa
                    </Button>
                  )}
                </div>
              )}

              {detailCanTeacherEdit && pendingEditOpen && (
                <form
                  className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void savePendingEdit()
                  }}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    Cập nhật phiếu (chỉ khi chờ TC/Leader duyệt)
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Họ tên giáo viên *
                      </label>
                      <input
                        required
                        value={editForm.teacher_name}
                        onChange={(e) =>
                          editFormChange('teacher_name', e.target.value)
                        }
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Mã LMS *
                      </label>
                      <input
                        required
                        value={editForm.lms_code}
                        onChange={(e) =>
                          editFormChange('lms_code', e.target.value)
                        }
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <p className="mb-1.5 text-sm font-medium text-gray-700">
                        Email (không đổi)
                      </p>
                      <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 break-all">
                        {selectedRequest.email}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Cơ sở *
                      </label>
                      <div className="relative">
                        <select
                          required
                          value={editForm.campus}
                          onChange={(e) => {
                            const v = e.target.value
                            const opt = campusSelectionOptions.find(
                              (o) => o.value === v,
                            )
                            editFormChange('campus', v)
                            editFormChange(
                              'campus_email',
                              opt?.email?.trim() || '',
                            )
                          }}
                          className={SELECT_BASE_CLASS}
                        >
                          <option value="">Chọn cơ sở</option>
                          {campusSelectionOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                              {o.email?.trim()
                                ? ` — ${o.email.trim()}`
                                : o.shortCode
                                  ? ` — ${o.shortCode}`
                                  : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Ngày nghỉ *
                      </label>
                      <input
                        required
                        type="date"
                        value={editForm.leave_date}
                        onChange={(e) =>
                          editFormChange('leave_date', e.target.value)
                        }
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Mã lớp *
                      </label>
                      <input
                        required
                        value={editForm.class_code}
                        onChange={(e) =>
                          editFormChange('class_code', e.target.value)
                        }
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Số học viên *
                      </label>
                      <input
                        required
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={editForm.student_count}
                        onChange={(e) =>
                          editFormChange('student_count', e.target.value)
                        }
                        className={INPUT_BASE_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Thời gian học *
                      </label>
                      <p className="mb-3 text-xs text-gray-500">
                        Chọn giờ bắt đầu và giờ kết thúc (định dạng 24 giờ, 00:00–23:59).
                        Giờ kết thúc phải sau giờ bắt đầu.
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="edit-class-time-start"
                            className="mb-1.5 block text-xs font-medium text-gray-600"
                          >
                            Giờ bắt đầu
                          </label>
                          <Time24Select
                            id="edit-class-time-start"
                            value={editClassTimeStart}
                            onChange={setEditClassTimeStart}
                            groupAriaLabel="Giờ bắt đầu"
                            hourLabel="Giờ bắt đầu"
                            minuteLabel="Phút bắt đầu"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="edit-class-time-end"
                            className="mb-1.5 block text-xs font-medium text-gray-600"
                          >
                            Giờ kết thúc
                          </label>
                          <Time24Select
                            id="edit-class-time-end"
                            value={editClassTimeEnd}
                            onChange={setEditClassTimeEnd}
                            groupAriaLabel="Giờ kết thúc"
                            hourLabel="Giờ kết thúc"
                            minuteLabel="Phút kết thúc"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Buổi học xin nghỉ *
                      </label>
                      <LeaveSessionField
                        id="edit-leave-session"
                        required
                        value={editForm.leave_session}
                        onChange={(v) => editFormChange('leave_session', v)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Lý do *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={editForm.reason}
                        onChange={(e) =>
                          editFormChange('reason', e.target.value)
                        }
                        className={TEXTAREA_BASE_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.has_substitute}
                          onChange={(e) => {
                            const checked = e.target.checked
                            editFormChange('has_substitute', checked)
                            if (!checked) {
                              editFormChange('substitute_teacher', '')
                              editFormChange('substitute_email', '')
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        Giáo viên thay thế (tích nếu đã có)
                      </label>
                    </div>
                    {editForm.has_substitute && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Tên giáo viên thay thế *
                          </label>
                          <input
                            value={editForm.substitute_teacher}
                            onChange={(e) =>
                              editFormChange('substitute_teacher', e.target.value)
                            }
                            className={INPUT_BASE_CLASS}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="edit-substitute-work-email"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                          >
                            Email giáo viên thay thế *
                          </label>
                          <SubstituteWorkEmailSuggestInput
                            id="edit-substitute-work-email"
                            value={editForm.substitute_email}
                            onChange={(v) => editFormChange('substitute_email', v)}
                            onPickRow={({ fullName, workEmail }) => {
                              setEditForm((prev) => ({
                                ...prev,
                                substitute_teacher: fullName,
                                substitute_email: workEmail,
                              }))
                            }}
                            token={token}
                            inputClassName={INPUT_BASE_CLASS}
                          />
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Tình hình lớp học
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.class_status}
                        onChange={(e) =>
                          editFormChange('class_status', e.target.value)
                        }
                        className={TEXTAREA_BASE_CLASS}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-gray-800">Mẫu mail</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          copyText('nội dung mail', editDraftBody)
                        }
                        className="w-full sm:w-auto border-[#a1001f]/30 text-[#a1001f] hover:border-[#a1001f]/50 hover:bg-[#a1001f]/5"
                      >
                        Copy nội dung
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600">
                      To: {toRolesLabel}
                      {editBuEmailDisplay ? (
                        <span className="mt-1 block break-all font-mono text-[13px] text-blue-900">
                          Email cơ sở: {editBuEmailDisplay}
                        </span>
                      ) : null}
                    </p>
                    <p>
                      <span className="font-medium">Tiêu đề:</span>{' '}
                      {editDraftSubject}
                    </p>
                    <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-700 sm:text-sm">
                      {editDraftBody}
                    </pre>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPendingEditOpen(false)
                        setEditClassTimeStart(null)
                        setEditClassTimeEnd(null)
                      }}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      disabled={editSubmitting}
                      className="bg-[#1152D4] hover:bg-[#0d45b0]"
                    >
                      {editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                  </div>
                </form>
              )}

              {!(detailCanTeacherEdit && pendingEditOpen) && (
              <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Giáo viên</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.teacher_name}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Mã LMS</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.lms_code}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Email</p>
                  <p className="text-sm font-medium text-gray-900 break-all">
                    {selectedRequest.email}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Cơ sở</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(selectedRequest.campus || '').trim() || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Ngày nghỉ</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(selectedRequest.leave_date).toLocaleDateString(
                      'vi-VN',
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Trạng thái</p>
                  <p className="text-sm font-medium text-gray-900">
                    {getStatusMeta(selectedRequest.status).label}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Mã lớp</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.class_code || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Số học viên</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.student_count?.trim()
                      ? selectedRequest.student_count
                      : '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Buổi học xin nghỉ</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.leave_session || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Thời gian học</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.class_time || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Giáo viên thay thế</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedRequest.substitute_teacher ||
                    selectedRequest.substitute_email
                      ? `${selectedRequest.substitute_teacher || '-'} (${selectedRequest.substitute_email || '-'})`
                      : 'Chưa có'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-600">Lý do</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedRequest.reason}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-600">Tình hình lớp</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedRequest.class_status?.trim()
                      ? selectedRequest.class_status
                      : '-'}
                  </p>
                </div>
                {selectedRequest.admin_note && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                    <p className="text-xs text-amber-800">Ghi chú từ TC/Leader</p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">
                      {selectedRequest.admin_note}
                    </p>
                  </div>
                )}
              </div>
              <LeaveBuNotice
                key={`bu-${selectedRequest.id}`}
                campus={selectedRequest.campus}
                centerId={selectedRequest.center_id}
                campusBuEmail={detailReadOnlyBuSnapshot}
              />
              </>
              )}
            </div>
          )}
      </Modal>, document.body)}
    </>
  )
}
