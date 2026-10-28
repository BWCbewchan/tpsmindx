'use client'
import { useQueryState } from '@/lib/use-query-state'



import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTeacher } from '@/lib/teacher-context'
import { authHeaders } from '@/lib/auth-headers'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Calendar, Clock, MapPin, Users, BookOpen, FileText, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/app-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type OfficeHourType = 'Makeup' | 'Fixed'
type OfficeHourStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string
type AppointmentStatus = 'WAITING' | 'CANCELED' | 'FAIL' | 'PASSED' | string

interface Appointment {
  id: string
  title: string
  candidate: {
    id: string
    fullName: string
  } | null
  courses: Array<{ id: string; name: string; shortName: string }>
  status: AppointmentStatus
  note: string | null
}

interface OfficeHour {
  id: string
  courses: Array<{ id: string; name: string; shortName: string }>
  courseLines: Array<{ id: string; name: string }>
  courseTopics: Array<{ id: string; name: string }>
  startTime: string
  endTime: string
  status: OfficeHourStatus
  centre: {
    id: string
    name: string
    shortName: string
  }
  teacher: {
    id: string
    fullName: string
    email: string
  }
  class: {
    id: string
    name: string
    students: string[]
  }
  note: string
  managerNote: string
  type: OfficeHourType
  studentCount: number
  appointments: Appointment[]
  createdAt: number
  lastModifiedAt: number | null
}

export default function TabOfficeHours() {
  const { token } = useAuth()
  const { teacherProfile } = useTeacher()
  const [officeHours, setOfficeHours] = useState<OfficeHour[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOH, setSelectedOH] = useState<OfficeHour | null>(null)

  // Filters
  const [selectedCentres, setSelectedCentres] = useQueryState<string[]>('officeCentre', [])
  const [centreSearchTerm, setCentreSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useQueryState<string>('officeDateFrom', '', { kind: 'date' })
  const [dateTo, setDateTo] = useQueryState<string>('officeDateTo', '', { kind: 'date' })
  const [appointmentStatus, setAppointmentStatus] = useQueryState<'all' | AppointmentStatus>('appointmentStatus', 'all')

  // Available centres list - fetch from LMS or hardcode
  const allCentres = [
    { id: '63034f4a7d1d1e1cb14e4e57', name: 'HCM - 322 Tây Thạnh', shortName: '322TT' },
    { id: '62918d02af37d11e2da237e5', name: 'HCM - Khu Tên Lửa', shortName: '174TL' },
    { id: '5ddf9e3416dbf70374a88ef0', name: 'HCM - 414 Lũy Bán Bích', shortName: '414LBB' },
    { id: '5ddf9e4816dbf70374a88ef2', name: 'HN - Nguyễn Chí Thanh', shortName: 'NCT' },
    { id: '5ddf9e5816dbf70374a88ef4', name: 'HN - Thái Hà', shortName: 'TH' },
    { id: '5ddf9e6b16dbf70374a88ef6', name: 'HN - Ngọc Khánh', shortName: 'NK' },
    // Add more centres as needed
  ]

  const filteredCentres = allCentres.filter(centre =>
    centre.name.toLowerCase().includes(centreSearchTerm.toLowerCase()) ||
    centre.shortName.toLowerCase().includes(centreSearchTerm.toLowerCase())
  )

  const toastShownRef = useRef(false)

  useEffect(() => {
    // Set default date range to current month
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    setDateFrom(`${year}-${month}-01`)

    // Last day of month
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
    setDateTo(`${year}-${month}-${lastDay}`)
  }, [])

  const fetchOfficeHours = async () => {
    const teacherUsername = teacherProfile?.code

    if (!teacherUsername) {
      if (!toastShownRef.current) {
        toast.error('Không tìm thấy mã giáo viên. Vui lòng liên hệ quản trị viên.')
        toastShownRef.current = true
      }
      return
    }

    if (!dateFrom || !dateTo) {
      toast.error('Vui lòng chọn khoảng thời gian')
      return
    }

    try {
      setLoading(true)

      // Build query params
      const params = new URLSearchParams({
        username: teacherUsername,
        dateFrom: dateFrom,
        dateTo: dateTo,
      })

      if (selectedCentres.length > 0) {
        params.append('centres', selectedCentres.join(','))
      }

      if (appointmentStatus !== 'all') {
        params.append('appointmentStatus', appointmentStatus)
      }

      const url = `/api/user/office-hours?${params.toString()}`

      const response = await fetch(url, {
        headers: authHeaders(token),
        credentials: 'include',
        cache: 'no-store',
      })

      const data = await response.json()

      if (data.success) {
        setOfficeHours(data.officeHours || [])
        toast.success(`Tải thành công ${data.officeHours?.length || 0} Office Hours`)
      } else {
        if (!data.noLmsToken) {
          toast.error(data.message || 'Không thể tải dữ liệu Office Hours')
        }
      }
    } catch (error) {
      console.error('[TabOfficeHours] Error:', error)
      toast.error('Có lỗi xảy ra khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const filteredOfficeHours = officeHours.filter((oh) => {
    // Filter by appointment status if specified
    if (appointmentStatus !== 'all') {
      const hasMatchingAppointment = (oh.appointments || []).some(
        appt => appt.status === appointmentStatus
      )
      if (!hasMatchingAppointment) return false
    }
    return true
  })

  // Remove duplicates using a combination of id, startTime, and createdAt
  const uniqueOfficeHours = Array.from(
    new Map(filteredOfficeHours.map(oh => [`${oh.id}-${oh.startTime}-${oh.createdAt}`, oh])).values()
  )

  const stats = {
    total: uniqueOfficeHours.length,
    makeup: uniqueOfficeHours.filter((oh) => oh.type === 'Makeup').length,
    fixed: uniqueOfficeHours.filter((oh) => oh.type === 'Fixed').length,
    totalAppointments: uniqueOfficeHours.reduce((sum, oh) => sum + (oh.appointments?.length || 0), 0),
  }

  // Calculate appointment summary
  const getAppointmentSummary = (appointments: Appointment[]) => {
    const summary = { passed: 0, fail: 0, waiting: 0, canceled: 0 }
    appointments.forEach((a) => {
      if (a.status === 'PASSED') summary.passed++
      else if (a.status === 'FAIL') summary.fail++
      else if (a.status === 'WAITING') summary.waiting++
      else if (a.status === 'CANCELED') summary.canceled++
    })
    return summary
  }

  const getAppointmentStatusBadge = (status: AppointmentStatus) => {
    const variants: Record<string, { variant: 'warning' | 'success' | 'danger' | 'info'; label: string }> = {
      WAITING: { variant: 'warning', label: 'Waiting' },
      PASSED: { variant: 'success', label: 'Passed' },
      FAIL: { variant: 'danger', label: 'Failed' },
      CANCELED: { variant: 'info', label: 'Canceled' },
    }
    const config = variants[status] || { variant: 'warning', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusBadge = (status: OfficeHourStatus) => {
    const variants: Record<OfficeHourStatus, { variant: 'warning' | 'success' | 'danger'; label: string }> = {
      PENDING: { variant: 'warning', label: 'Chờ duyệt' },
      APPROVED: { variant: 'success', label: 'Đã duyệt' },
      REJECTED: { variant: 'danger', label: 'Từ chối' },
    }
    const config = variants[status] || { variant: 'warning', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTypeBadge = (type: OfficeHourType) => {
    return type === 'Makeup' ? (
      <Badge variant="info">Dạy bù</Badge>
    ) : (
      <Badge className="bg-purple-100 text-purple-700 border-purple-200">Trực cố định</Badge>
    )
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Filter Section - Always visible */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Bộ lọc</h3>
            {/* Load Button - Fixed position top right */}
            <button
              onClick={fetchOfficeHours}
              disabled={loading || !dateFrom || !dateTo}
              className="rounded-lg bg-[#a1001f] px-6 py-2 text-sm font-medium text-white hover:bg-[#8a0019] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang tải...' : 'Tải dữ liệu'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Centres Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cơ sở ({selectedCentres.length} đã chọn)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm cơ sở (mã hoặc tên)..."
                  value={centreSearchTerm}
                  onChange={(e) => setCentreSearchTerm(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 disabled:bg-gray-100"
                />
                {filteredCentres.length > 0 && centreSearchTerm && !loading && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredCentres.map((centre) => (
                      <div
                        key={centre.id}
                        onClick={() => {
                          if (selectedCentres.includes(centre.shortName)) {
                            setSelectedCentres(selectedCentres.filter(c => c !== centre.shortName))
                          } else {
                            setSelectedCentres([...selectedCentres, centre.shortName])
                          }
                          setCentreSearchTerm('')
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                          selectedCentres.includes(centre.shortName) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="font-medium">{centre.shortName}</span> - {centre.name}
                        {selectedCentres.includes(centre.shortName) && (
                          <span className="ml-2 text-blue-600">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedCentres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedCentres.map((shortName) => {
                    return (
                      <span
                        key={shortName}
                        className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                      >
                        {shortName}
                        <button
                          onClick={() => setSelectedCentres(selectedCentres.filter(c => c !== shortName))}
                          className="hover:text-blue-900"
                          disabled={loading}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  <button
                    onClick={() => setSelectedCentres([])}
                    className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
                    disabled={loading}
                  >
                    Xóa tất cả
                  </button>
                </div>
              )}
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={dateFrom || ''}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 disabled:bg-gray-100"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={dateTo || ''}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 disabled:bg-gray-100"
              />
            </div>

            {/* Appointment Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={appointmentStatus}
                onChange={(e) => setAppointmentStatus(e.target.value as any)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 disabled:bg-gray-100"
              >
                <option value="all">Tất cả</option>
                <option value="WAITING">Waiting</option>
                <option value="PASSED">Passed</option>
                <option value="FAIL">Failed</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards - Always show when data exists, independent of loading state */}
        {officeHours.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-600">Tổng số</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <p className="text-xs font-medium text-blue-700">Dạy bù</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{stats.makeup}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
              <p className="text-xs font-medium text-purple-700">Trực cố định</p>
              <p className="mt-1 text-2xl font-bold text-purple-900">{stats.fixed}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-medium text-emerald-700">Appointments</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{stats.totalAppointments}</p>
            </div>
          </div>
        )}

      {/* Office Hours Table - Only this section shows loading state */}
      <div>
        {loading ? (
          <PageSkeleton variant="grid" itemCount={6} showHeader={true} />
        ) : uniqueOfficeHours.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Không có Office Hours</h3>
            <p className="mt-2 text-sm text-gray-600">
              {officeHours.length === 0
                ? 'Vui lòng chọn khoảng thời gian và bấm "Tải dữ liệu"'
                : 'Không tìm thấy Office Hours phù hợp với bộ lọc.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Loại</TableHead>
                  <TableHead className="w-[150px]">Ngày</TableHead>
                  <TableHead className="w-[130px]">Thời gian</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Khóa học</TableHead>
                  <TableHead className="w-[200px]">Trạng thái</TableHead>
                  <TableHead className="w-[80px] text-center">HV</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueOfficeHours.map((oh, index) => {
                  const start = formatDateTime(oh.startTime)
                  const end = formatDateTime(oh.endTime)
                  const summary = getAppointmentSummary(oh.appointments || [])

                  return (
                    <TableRow
                      key={`oh-${oh.id}-${oh.createdAt}-${index}`}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedOH(oh)}
                    >
                      <TableCell>{getTypeBadge(oh.type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{start.date}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{start.time} - {end.time}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">{oh.centre.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(oh.courseLines || []).map((cl) => (
                            <span
                              key={cl.id}
                              className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                            >
                              {cl.name}
                            </span>
                          ))}
                          {(oh.courses || []).map((c) => (
                            <span
                              key={c.id}
                              className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                            >
                              {c.shortName}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {summary.passed > 0 && (
                            <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              {summary.passed} Passed
                            </span>
                          )}
                          {summary.fail > 0 && (
                            <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              {summary.fail} Failed
                            </span>
                          )}
                          {summary.waiting > 0 && (
                            <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {summary.waiting} Waiting
                            </span>
                          )}
                          {summary.canceled > 0 && (
                            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {summary.canceled} Canceled
                            </span>
                          )}
                          {(oh.appointments || []).length === 0 && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{oh.studentCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {oh.note ? (
                          <div className="max-w-xs text-sm text-gray-700">
                            <p className="line-clamp-2">{oh.note}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        )}
      </div>
    </div>

    {/* Detail Modal */}
    {selectedOH && (
      <Modal
        isOpen={true}
        onClose={() => setSelectedOH(null)}
        title="Chi tiết Office Hour"
        size="xl"
      >
        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Loại</p>
              <div className="mt-1">{getTypeBadge(selectedOH.type)}</div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Thời gian</p>
              <p className="mt-1 text-sm font-medium">
                {formatDateTime(selectedOH.startTime).date} | {formatDateTime(selectedOH.startTime).time} - {formatDateTime(selectedOH.endTime).time}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cơ sở</p>
              <p className="mt-1 text-sm font-medium">{selectedOH.centre.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Số lượng HV</p>
              <p className="mt-1 text-sm font-medium">{selectedOH.studentCount} học viên</p>
            </div>
          </div>

          {/* Course Info */}
          {((selectedOH.courseLines || []).length > 0 || (selectedOH.courses || []).length > 0) && (
            <div>
              <p className="text-sm text-gray-600">Khóa học</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(selectedOH.courseLines || []).map((cl) => (
                  <span
                    key={cl.id}
                    className="inline-block rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
                  >
                    {cl.name}
                  </span>
                ))}
                {(selectedOH.courses || []).map((c) => (
                  <span
                    key={c.id}
                    className="inline-block rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                  >
                    {c.shortName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {selectedOH.note && (
            <div>
              <p className="text-sm text-gray-600">Ghi chú</p>
              <p className="mt-1 text-sm text-gray-700">{selectedOH.note}</p>
            </div>
          )}

          {/* Appointments */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Danh sách Appointments ({(selectedOH.appointments || []).length})</h4>
            {(selectedOH.appointments || []).length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Chưa có appointment nào</p>
            ) : (
              <div className="mt-3 space-y-3">
                {selectedOH.appointments.map((appt, idx) => (
                  <div
                    key={appt.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {idx + 1}. {appt.candidate?.fullName || 'N/A'}
                          </span>
                          {getAppointmentStatusBadge(appt.status)}
                        </div>
                        {appt.title && (
                          <p className="mt-1 text-sm text-gray-600">{appt.title}</p>
                        )}
                        {(appt.courses || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(appt.courses || []).map((c) => (
                              <span
                                key={c.id}
                                className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                              >
                                {c.shortName}
                              </span>
                            ))}
                          </div>
                        )}
                        {appt.note && (
                          <p className="mt-2 text-xs text-gray-600">
                            <strong>Note:</strong> {appt.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    )}
    </>
  )
}
