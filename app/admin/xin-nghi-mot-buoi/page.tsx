'use client'

import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/Tabs'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepItem, Stepper } from '@/components/ui/stepper'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CAMPUS_LIST, normalizeText } from '@/lib/campus-data'
import { resolveCenterBuEmail } from '@/lib/center-bu-email-fallback'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'
import {
  mergeAdminNoteWithDeclineAudits,
  stripSubstituteDeclineAuditFromAdminNote,
} from '@/lib/leave-request-admin-note-sanitize'
import { LeaveBuNotice } from '@/components/leave-request/LeaveBuNotice'

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
  status:
    | 'pending_admin'
    | 'approved_unassigned'
    | 'approved_assigned'
    | 'rejected'
    | 'substitute_confirmed'
  admin_note?: string
  admin_name?: string
  admin_email?: string
  substitute_confirmed_at?: string
  created_at: string
  updated_at?: string
}

type StatusVariant = 'warning' | 'info' | 'success' | 'danger'

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
    { id: 4, label: 'Hoàn tất', status: step4Status },
  ]
}

function getStatusMeta(status: LeaveRequest['status']): {
  label: string
  variant: StatusVariant
} {
  switch (status) {
    case 'pending_admin':
      return { label: 'Chờ duyệt', variant: 'warning' }
    case 'approved_unassigned':
      return { label: 'Đã duyệt - chưa có GV thay', variant: 'info' }
    case 'approved_assigned':
      return { label: 'Đã gửi cho GV thay', variant: 'info' }
    case 'substitute_confirmed':
      return { label: 'GV thay đã xác nhận', variant: 'success' }
    case 'rejected':
      return { label: 'Đã từ chối', variant: 'danger' }
    default:
      return { label: status, variant: 'info' }
  }
}

export default function AdminXinNghiMotBuoiPage() {
  const { user, token } = useAuth()

  const [items, setItems] = useState<LeaveRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [campusFilter, setCampusFilter] = useState<string[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCampusDropdown, setShowCampusDropdown] = useState(false)
  const [campusSearchText, setCampusSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const [selected, setSelected] = useState<LeaveRequest | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [substituteTeacher, setSubstituteTeacher] = useState('')
  const [substituteEmail, setSubstituteEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /** Khóa form mặc định; bấm Chỉnh sửa mới sửa, Gửi chỉnh sửa để lưu. */
  const [detailFormEditing, setDetailFormEditing] = useState(false)

  /** Giống form tạo xin nghỉ: GET /api/leave-requests/campuses + resolveCenterBuEmail. */
  const [campusBuByKey, setCampusBuByKey] = useState<Map<string, string>>(
    () => new Map(),
  )

  const fetchData = useCallback(async (showToast = false) => {
    try {
      setLoading(true)
      setLoadingError(null)

      const res = await fetch('/api/leave-requests?mode=admin', {
        headers: authHeaders(token),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải dữ liệu xin nghỉ')
      }

      setItems(data.data || [])
      if (showToast) toast.success('Đã cập nhật dữ liệu mới nhất')
    } catch (error: unknown) {
      console.error(error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Có lỗi xảy ra khi tải dữ liệu.'
      setLoadingError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!token?.trim()) {
      setCampusBuByKey(new Map())
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
        const list = Array.isArray(d.data) ? d.data : []
        const m = new Map<string, string>()
        for (const row of list) {
          const fn = String(
            (row as { full_name?: string }).full_name ?? '',
          ).trim()
          if (!fn) continue
          const em =
            resolveCenterBuEmail({
              email: (row as { email?: string | null }).email,
              short_code: (row as { short_code?: string | null }).short_code,
              full_name: fn,
            })?.trim() || ''
          if (!em) continue
          m.set(fn.toLowerCase(), em)
          m.set(normalizeText(fn), em)
        }
        if (!cancelled) setCampusBuByKey(m)
      } catch {
        if (!cancelled) setCampusBuByKey(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const lookupBuEmailLikeTeacherForm = useCallback(
    (campus: string | undefined | null) => {
      const c = campus?.trim() ?? ''
      if (!c) return ''
      const fromCentersList =
        campusBuByKey.get(c.toLowerCase()) ||
        campusBuByKey.get(normalizeText(c))
      if (fromCentersList) return fromCentersList
      const canon = CAMPUS_LIST.find(
        (label) =>
          normalizeText(label) === normalizeText(c) ||
          normalizeText(c).includes(normalizeText(label)) ||
          normalizeText(label).includes(normalizeText(c)),
      )
      if (canon) {
        const fromCanon =
          campusBuByKey.get(canon.toLowerCase()) ||
          campusBuByKey.get(normalizeText(canon))
        if (fromCanon) return fromCanon
      }
      return resolveCenterBuEmail({ full_name: c })?.trim() || ''
    },
    [campusBuByKey],
  )

  // Danh sách campus duy nhất
  const campusOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      if (item.campus) set.add(item.campus)
    })
    return Array.from(set).sort()
  }, [items])

  const filteredCampusOptions = useMemo(() => {
    if (!campusSearchText.trim()) return campusOptions
    const searchLower = campusSearchText.toLowerCase()
    return campusOptions.filter((campus) =>
      campus.toLowerCase().includes(searchLower),
    )
  }, [campusOptions, campusSearchText])

  // Lọc items theo tab, tìm kiếm, campus, thời gian
  const filteredItems = useMemo(() => {
    let arr = items
    if (activeTab !== 'all')
      arr = arr.filter((item) => item.status === activeTab)
    if (campusFilter.length > 0)
      arr = arr.filter((item) => campusFilter.includes(item.campus))
    if (fromDate)
      arr = arr.filter(
        (item) => new Date(item.leave_date) >= new Date(fromDate),
      )
    if (toDate)
      arr = arr.filter((item) => new Date(item.leave_date) <= new Date(toDate))
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      arr = arr.filter(
        (item) =>
          (item.class_code && item.class_code.toLowerCase().includes(q)) ||
          (item.teacher_name && item.teacher_name.toLowerCase().includes(q)) ||
          (item.lms_code && item.lms_code.toLowerCase().includes(q)),
      )
    }
    return arr
  }, [items, activeTab, campusFilter, fromDate, toDate, searchQuery])

  const tabs = [
    { id: 'all', label: 'Tất cả', count: items.length },
    {
      id: 'pending_admin',
      label: 'Chờ duyệt',
      count: items.filter((i) => i.status === 'pending_admin').length,
    },
    {
      id: 'approved_unassigned',
      label: 'Chưa có GV thay',
      count: items.filter((i) => i.status === 'approved_unassigned').length,
    },
    {
      id: 'approved_assigned',
      label: 'Đã gửi GV thay',
      count: items.filter((i) => i.status === 'approved_assigned').length,
    },
    {
      id: 'substitute_confirmed',
      label: 'Đã hoàn tất',
      count: items.filter((i) => i.status === 'substitute_confirmed').length,
    },
    {
      id: 'rejected',
      label: 'Từ chối',
      count: items.filter((i) => i.status === 'rejected').length,
    },
  ]

  const getAdminConfirmText = (item: LeaveRequest) => {
    if (!item.admin_name && !item.admin_email) return 'Chờ TC/Leader xác nhận'
    return item.admin_name || item.admin_email || 'Đã xác nhận'
  }

  const getSubstituteConfirmText = (item: LeaveRequest) => {
    if (item.status !== 'substitute_confirmed')
      return 'Chờ giáo viên thay xác nhận'
    if (item.substitute_confirmed_at) {
      return `Đã xác nhận ${new Date(item.substitute_confirmed_at).toLocaleString('vi-VN')}`
    }
    return 'Đã xác nhận'
  }

  const openDetail = (item: LeaveRequest) => {
    setSelected(item)
    setDetailFormEditing(false)
    setAdminNote(
      stripSubstituteDeclineAuditFromAdminNote(item.admin_note) ?? '',
    )
    setSubstituteTeacher(item.substitute_teacher || '')
    setSubstituteEmail(item.substitute_email || '')
  }

  const closeDetail = () => {
    setDetailFormEditing(false)
    setSelected(null)
  }

  const canDetailFormEditMode = (status: LeaveRequest['status']) =>
    status === 'pending_admin' ||
    status === 'approved_unassigned' ||
    status === 'approved_assigned'

  const cancelDetailFormEdit = () => {
    if (!selected) return
    setDetailFormEditing(false)
    setAdminNote(
      stripSubstituteDeclineAuditFromAdminNote(selected.admin_note) ?? '',
    )
    setSubstituteTeacher(selected.substitute_teacher || '')
    setSubstituteEmail(selected.substitute_email || '')
  }

  const validateSubstituteFields = () => {
    const teacher = substituteTeacher.trim()
    const email = substituteEmail.trim()

    if (!teacher && !email) return null
    if (!teacher || !email)
      return 'Vui lòng nhập đủ tên và email giáo viên thay thế.'
    if (!/\S+@\S+\.\S+/.test(email))
      return 'Email giáo viên thay thế chưa đúng định dạng.'

    return null
  }

  const submitAdminReview = async (decision: 'approved' | 'rejected') => {
    if (!selected) return

    const substituteValidationError = validateSubstituteFields()
    if (substituteValidationError) {
      toast.error(substituteValidationError)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          action: 'admin_review',
          id: selected.id,
          decision,
          admin_note: adminNote,
          admin_email: user?.email,
          admin_name: user?.displayName || user?.email,
          substitute_teacher: substituteTeacher.trim(),
          substitute_email: substituteEmail.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(
          decision === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu',
        )
        closeDetail()
        fetchData()
      } else {
        toast.error(data.error || 'Không thể cập nhật')
      }
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi cập nhật')
    } finally {
      setSubmitting(false)
    }
  }

  const submitAdminSaveFields = async () => {
    if (!selected) return

    const substituteValidationError = validateSubstituteFields()
    if (substituteValidationError) {
      toast.error(substituteValidationError)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          action: 'admin_save_fields',
          id: selected.id,
          admin_note: mergeAdminNoteWithDeclineAudits(
            adminNote,
            selected.admin_note,
          ),
          substitute_teacher: substituteTeacher.trim(),
          substitute_email: substituteEmail.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        const updated = data.data as LeaveRequest
        const wasUnassigned = selected.status === 'approved_unassigned'
        const nowAssigned = updated.status === 'approved_assigned'
        if (wasUnassigned && nowAssigned) {
          toast.success('Đã lưu và phân giáo viên thay thế')
        } else {
          toast.success('Đã lưu nội dung chỉnh sửa')
        }
        setSelected(updated)
        setAdminNote(
          stripSubstituteDeclineAuditFromAdminNote(updated.admin_note) ?? '',
        )
        setSubstituteTeacher(updated.substitute_teacher || '')
        setSubstituteEmail(updated.substitute_email || '')
        setDetailFormEditing(false)
        fetchData()
      } else {
        toast.error(data.error || 'Không thể lưu')
      }
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi lưu')
    } finally {
      setSubmitting(false)
    }
  }

  const submitDetailFormChanges = async () => {
    if (!selected) return
    if (selected.status === 'pending_admin') {
      await submitAdminSaveFields()
      return
    }
    if (
      selected.status === 'approved_unassigned' ||
      selected.status === 'approved_assigned'
    ) {
      await submitAdminSaveFields()
    }
  }

  if (loading) {
    return <PageSkeleton variant="table" itemCount={8} showHeader={true} />
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Tiếp nhận xin nghỉ 1 buổi
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Step 2: TC/Leader duyệt yêu cầu và phân giáo viên thay thế khi
              cần.
            </p>
          </div>
          <Button
            size="lg"
            variant="outline"
            onClick={() => fetchData(true)}
            className="h-10 self-start border-[#f3b4bd] text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5"
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            Làm mới
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('pending_admin')}
            className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              activeTab === 'pending_admin'
                ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-300/60'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className="text-xs font-medium text-amber-700">Chờ duyệt</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {tabs.find((t) => t.id === 'pending_admin')?.count || 0}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved_unassigned')}
            className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              activeTab === 'approved_unassigned'
                ? 'border-sky-400 bg-sky-100 ring-2 ring-sky-300/60'
                : 'border-sky-200 bg-sky-50'
            }`}
          >
            <p className="text-xs font-medium text-sky-700">Chờ phân GV thay</p>
            <p className="mt-1 text-2xl font-bold text-sky-900">
              {tabs.find((t) => t.id === 'approved_unassigned')?.count || 0}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved_assigned')}
            className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              activeTab === 'approved_assigned'
                ? 'border-indigo-400 bg-indigo-100 ring-2 ring-indigo-300/60'
                : 'border-indigo-200 bg-indigo-50'
            }`}
          >
            <p className="text-xs font-medium text-indigo-700">
              Đã gửi GV thay
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">
              {tabs.find((t) => t.id === 'approved_assigned')?.count || 0}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('substitute_confirmed')}
            className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              activeTab === 'substitute_confirmed'
                ? 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/60'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <p className="text-xs font-medium text-emerald-700">Hoàn tất</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {tabs.find((t) => t.id === 'substitute_confirmed')?.count || 0}
            </p>
          </button>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Bộ lọc nâng cao + tìm kiếm */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cơ sở
            </label>
            <button
              type="button"
              onClick={() => setShowCampusDropdown(!showCampusDropdown)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[180px] text-left flex items-center justify-between bg-white hover:bg-gray-50"
            >
              <span className="truncate">
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
              <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
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
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1 invisible">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã lớp, tên GV, mã LMS..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[220px]"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                onClick={() => setSearchQuery('')}
                tabIndex={-1}
              >
                ×
              </button>
            )}
          </div>
          {(campusFilter.length > 0 || fromDate || toDate || searchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCampusFilter([])
                setFromDate('')
                setToDate('')
                setSearchQuery('')
              }}
            >
              Xoá lọc
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          {loadingError && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Không thể tải danh sách</p>
                <p className="mt-0.5">{loadingError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => fetchData()}>
                Thử lại
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Giáo viên</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Ngày nghỉ</TableHead>
                <TableHead>Mã lớp</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const statusMeta = getStatusMeta(item.status)

                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-blue-50/40"
                    onClick={() => openDetail(item)}
                  >
                    <TableCell>
                      {new Date(item.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900">
                        {item.teacher_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.lms_code || 'Chưa có LMS'}
                      </p>
                    </TableCell>
                    <TableCell>{item.campus}</TableCell>
                    <TableCell>
                      {new Date(item.leave_date).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell>{item.class_code || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.variant}>
                        {statusMeta.label}
                      </Badge>
                      <p className="mt-1 text-[11px] text-gray-600">
                        TC/Leader: {getAdminConfirmText(item)}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        GV thay: {getSubstituteConfirmText(item)}
                      </p>
                      {item.admin_note && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-amber-700">
                          Note: {item.admin_note}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-600">
              Không có dữ liệu ở tab này.
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!selected}
        onClose={closeDetail}
        title={selected ? `Yêu cầu #${selected.id}` : 'Chi tiết yêu cầu'}
        maxWidth="5xl"
        footer={
          selected ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {selected.status === 'pending_admin' && (
                <>
                  <Button
                    variant="outline"
                    disabled={submitting}
                    onClick={() => submitAdminReview('rejected')}
                    className="w-full sm:w-auto"
                  >
                    Từ chối
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={() => submitAdminReview('approved')}
                    className="w-full border-2 border-[#7d0018] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a] sm:w-auto"
                  >
                    Duyệt yêu cầu
                  </Button>
                </>
              )}

              {(selected.status === 'approved_unassigned' ||
                selected.status === 'approved_assigned' ||
                selected.status === 'substitute_confirmed' ||
                selected.status === 'rejected') && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                  onClick={closeDetail}
                >
                  Đóng
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4">
            <Stepper steps={getWorkflowSteps(selected.status)} />

            <div className="flex items-center gap-2">
              <Badge variant={getStatusMeta(selected.status).variant}>
                {getStatusMeta(selected.status).label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.teacher_name}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã LMS</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.lms_code || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Email GV xin nghỉ</p>
                <p className="text-sm font-medium text-gray-900 break-all">
                  {selected.email}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Cơ sở</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.campus || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Ngày nghỉ</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selected.leave_date).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã lớp</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.class_code || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Số học viên</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.student_count || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Thời gian học</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.class_time || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Buổi học xin nghỉ</p>
                <p className="text-sm font-medium text-gray-900">
                  {selected.leave_session || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Lý do</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selected.reason}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Tình hình lớp học</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selected.class_status || '-'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Xác nhận từ TC/Leader</p>
                <p className="mt-1 text-sm font-medium text-amber-900">
                  {selected.admin_name || 'Chưa có tên người xác nhận'}
                </p>
                <p className="text-xs text-amber-900/80 break-all">
                  {selected.admin_email || 'Chưa có email người xác nhận'}
                </p>
                <p className="mt-2 text-xs text-amber-900/80 whitespace-pre-wrap">
                  {selected.admin_note || 'Chưa có ghi chú duyệt từ TC/Leader.'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">
                  Xác nhận từ giáo viên dạy thay
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-900">
                  {selected.substitute_teacher || 'Chưa có tên giáo viên thay'}
                </p>
                <p className="text-xs text-emerald-900/80 break-all">
                  {selected.substitute_email || 'Chưa có email giáo viên thay'}
                </p>
                <p className="mt-2 text-xs text-emerald-900/80">
                  {selected.substitute_confirmed_at
                    ? `Thời điểm xác nhận: ${new Date(selected.substitute_confirmed_at).toLocaleString('vi-VN')}`
                    : 'Chưa xác nhận nhận lớp.'}
                </p>
              </div>
            </div>

            <LeaveBuNotice
              key={selected.id}
              campus={selected.campus}
              centerId={selected.center_id}
              campusBuEmail={
                selected.campus_bu_email?.trim() ||
                lookupBuEmailLikeTeacherForm(selected.campus) ||
                null
              }
            />

            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              {canDetailFormEditMode(selected.status) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <p className="text-sm font-medium text-gray-800">
                    Ghi chú và giáo viên thay
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!detailFormEditing ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailFormEditing(true)}
                      >
                        Chỉnh sửa
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={submitting}
                          onClick={cancelDetailFormEdit}
                        >
                          Hủy chỉnh sửa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={submitting}
                          onClick={submitDetailFormChanges}
                          className="bg-[#1152D4] text-white hover:bg-[#0d45b0]"
                        >
                          Gửi chỉnh sửa
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700">
                Ghi chú duyệt
                {canDetailFormEditMode(selected.status) && (
                  <span className="ml-1 font-normal text-gray-500">
                    (bấm Chỉnh sửa; log GV thay từ chối tự ghép phía sau khi lưu)
                  </span>
                )}
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={
                  !canDetailFormEditMode(selected.status) ||
                  !detailFormEditing
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
              />

              <label className="block text-sm font-medium text-gray-700">
                {selected.status === 'approved_assigned'
                  ? 'Giáo viên thay (sửa nếu sai tên hoặc email)'
                  : 'Giáo viên thay thế (nếu có)'}
              </label>
              {selected.status === 'approved_assigned' && (
                <p className="text-xs text-gray-600">
                  Bấm Chỉnh sửa → sửa → Gửi chỉnh sửa. Sau khi sửa email đúng, GV
                  thay đăng nhập đúng tài khoản mới thấy yêu cầu trong mục Nhận
                  lớp.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={substituteTeacher}
                  onChange={(e) => setSubstituteTeacher(e.target.value)}
                  placeholder="Tên giáo viên thay thế"
                  disabled={
                    selected.status === 'substitute_confirmed' ||
                    selected.status === 'rejected' ||
                    !detailFormEditing
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <input
                  type="email"
                  value={substituteEmail}
                  onChange={(e) => setSubstituteEmail(e.target.value)}
                  placeholder="Email giáo viên thay thế"
                  disabled={
                    selected.status === 'substitute_confirmed' ||
                    selected.status === 'rejected' ||
                    !detailFormEditing
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>
            </div>

            {selected.admin_note && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Ghi chú hiện tại</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {selected.admin_note}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
