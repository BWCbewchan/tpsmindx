'use client'

import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/Tabs'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'
import { LeaveBuNotice } from '@/components/leave-request/LeaveBuNotice'

interface LeaveRequest {
  id: number
  teacher_name: string
  lms_code?: string
  email?: string
  campus: string
  center_id?: number | null
  campus_bu_email?: string | null
  leave_date: string
  class_code?: string
  class_time?: string
  leave_session?: string
  class_status?: string
  substitute_teacher?: string
  substitute_email?: string
  admin_name?: string
  admin_email?: string
  admin_note?: string
  substitute_confirmed_at?: string
  status: 'pending_admin' | 'approved_unassigned' | 'approved_assigned' | 'rejected' | 'substitute_confirmed'
  created_at: string
  updated_at?: string
}

type StatusVariant = 'warning' | 'info' | 'success' | 'danger'

function isAwaitingSubstituteResponse(status: LeaveRequest['status']): boolean {
  return String(status).toLowerCase().trim() === 'approved_assigned'
}

function getStatusMeta(status: LeaveRequest['status']): { label: string; variant: StatusVariant } {
  switch (status) {
    case 'pending_admin': return { label: 'Chờ duyệt', variant: 'warning' }
    case 'approved_unassigned': return { label: 'Đã duyệt - chưa có GV thay', variant: 'info' }
    case 'approved_assigned': return { label: 'Đã gửi cho GV thay', variant: 'info' }
    case 'substitute_confirmed': return { label: 'GV thay đã xác nhận', variant: 'success' }
    case 'rejected': return { label: 'Đã từ chối', variant: 'danger' }
    default: return { label: status, variant: 'info' }
  }
}

interface TabNhanLopProps {
  onRefreshBadge?: () => void
}

export default function TabNhanLop({ onRefreshBadge }: TabNhanLopProps) {
  const { user, token } = useAuth()
  const [items, setItems] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [selected, setSelected] = useState<LeaveRequest | null>(null)
  const [submittingKind, setSubmittingKind] = useState<null | 'confirm' | 'decline'>(null)
  const [declineReason, setDeclineReason] = useState('')
  const busy = submittingKind !== null
  const [activeTab, setActiveTab] = useState('all')
  const [campusFilter, setCampusFilter] = useState<string[]>([])
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [showCampusDropdown, setShowCampusDropdown] = useState(false)
  const [campusSearchText, setCampusSearchText] = useState('')
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false)

  const fetchData = useCallback(async (showToast = false) => {
    if (!user?.email) return
    try {
      setLoading(true)
      setLoadingError(null)
      const res = await fetch(
        `/api/leave-requests?mode=substitute&email=${encodeURIComponent(user.email)}`,
        { headers: authHeaders(token) },
      )
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể tải danh sách lớp nhận thay')
      setItems(data.data || [])
      if (showToast) toast.success('Đã cập nhật danh sách mới nhất')
    } catch (error: unknown) {
      console.error(error)
      setLoadingError(error instanceof Error ? error.message : 'Có lỗi xảy ra khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [user?.email, token])

  useEffect(() => { fetchData() }, [fetchData])

  const campusOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => { if (item.campus) set.add(item.campus) })
    return Array.from(set).sort()
  }, [items])

  const filteredCampusOptions = useMemo(() => {
    if (!campusSearchText.trim()) return campusOptions
    const s = campusSearchText.toLowerCase()
    return campusOptions.filter(c => c.toLowerCase().includes(s))
  }, [campusOptions, campusSearchText])

  const filteredItems = useMemo(() => {
    let result = items
    if (activeTab === 'pending') result = result.filter(i => isAwaitingSubstituteResponse(i.status))
    else if (activeTab === 'done') result = result.filter(i => i.status === 'substitute_confirmed')
    if (campusFilter.length > 0) result = result.filter(i => campusFilter.includes(i.campus))
    if (fromDate) result = result.filter(i => new Date(i.leave_date) >= new Date(fromDate))
    if (toDate) result = result.filter(i => new Date(i.leave_date) <= new Date(toDate))
    return result
  }, [activeTab, items, campusFilter, fromDate, toDate])

  const tabs = useMemo(() => [
    { id: 'all', label: 'Tất cả', count: items.length },
    { id: 'pending', label: 'Chờ xác nhận', count: items.filter(i => isAwaitingSubstituteResponse(i.status)).length },
    { id: 'done', label: 'Đã xác nhận', count: items.filter(i => i.status === 'substitute_confirmed').length },
  ], [items])

  const handleConfirm = async (id: number) => {
    if (!user?.email) return
    const item = items.find(i => i.id === id)
    if (!item || !isAwaitingSubstituteResponse(item.status)) {
      toast.error('Yêu cầu này không ở trạng thái chờ xác nhận.')
      return
    }
    setSubmittingKind('confirm')
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'substitute_confirm', id, substitute_email: user.email }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Đã xác nhận nhận thông tin lớp 1 buổi')
        setSelected(null)
        setDeclineReason('')
        fetchData()
        onRefreshBadge?.()
      } else {
        toast.error(data.error || 'Không thể xác nhận')
      }
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi xác nhận')
    } finally {
      setSubmittingKind(null)
    }
  }

  const requestDeclineConfirm = (id: number) => {
    if (!user?.email) return
    const item = items.find(i => i.id === id)
    if (!item || !isAwaitingSubstituteResponse(item.status)) {
      toast.error('Yêu cầu này không ở trạng thái chờ xác nhận.')
      return
    }
    setDeclineConfirmOpen(true)
  }

  const executeDecline = async (id: number) => {
    if (!user?.email) return
    const item = items.find(i => i.id === id)
    if (!item || !isAwaitingSubstituteResponse(item.status)) {
      toast.error('Yêu cầu này không ở trạng thái chờ xác nhận.')
      setDeclineConfirmOpen(false)
      return
    }
    setSubmittingKind('decline')
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          action: 'substitute_decline',
          id,
          substitute_email: user.email,
          decline_reason: declineReason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Đã từ chối nhận lớp thay')
        setDeclineConfirmOpen(false)
        setSelected(null)
        setDeclineReason('')
        fetchData()
        onRefreshBadge?.()
      } else {
        toast.error(data.error || 'Không thể từ chối')
      }
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi từ chối')
    } finally {
      setSubmittingKind(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-10 w-80 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <TableSkeleton rows={6} columns={6} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Danh Sách Nhận Lớp Dạy Thay</h1>
            <p className="mt-1 text-sm text-gray-600">Giáo viên thay thế xác nhận đã nhận thông tin lớp.</p>
          </div>
          <Button size="lg" variant="outline" onClick={() => fetchData(true)} className="h-10 self-start border-[#f3b4bd] text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5">
            <RefreshCcw className="mr-1.5 h-4 w-4" /> Làm mới
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => setActiveTab('all')} className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${activeTab === 'all' ? 'border-gray-400 bg-gray-50 ring-2 ring-gray-300/60' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs font-medium text-gray-600">Tổng lớp nhận thay</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{items.length}</p>
          </button>
          <button type="button" onClick={() => setActiveTab('pending')} className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${activeTab === 'pending' ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-300/60' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-xs font-medium text-amber-700">Chờ xác nhận</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{tabs.find(t => t.id === 'pending')?.count || 0}</p>
          </button>
          <button type="button" onClick={() => setActiveTab('done')} className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${activeTab === 'done' ? 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/60' : 'border-emerald-200 bg-emerald-50'}`}>
            <p className="text-xs font-medium text-emerald-700">Đã xác nhận</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{tabs.find(t => t.id === 'done')?.count || 0}</p>
          </button>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Bộ lọc */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative w-full sm:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cơ sở</label>
            <button type="button" onClick={() => setShowCampusDropdown(!showCampusDropdown)} className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 sm:min-w-45">
              <span className="truncate">{campusFilter.length === 0 ? 'Tất cả' : `${campusFilter.length} cơ sở`}</span>
              <svg className="w-4 h-4 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showCampusDropdown && (
              <div className="absolute left-0 right-0 z-10 mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg sm:left-auto sm:right-auto sm:min-w-60">
                <div className="p-2 border-b border-gray-200">
                  <input type="text" placeholder="Tìm kiếm cơ sở..." value={campusSearchText} onChange={e => setCampusSearchText(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" onClick={e => e.stopPropagation()} />
                </div>
                <div className="p-2 border-b border-gray-200 flex gap-2">
                  <button type="button" onClick={() => setCampusFilter(filteredCampusOptions)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Chọn tất cả</button>
                  <button type="button" onClick={() => setCampusFilter([])} className="text-xs text-gray-600 hover:text-gray-800 font-medium">Bỏ chọn</button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredCampusOptions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">Không tìm thấy cơ sở</div>
                  ) : filteredCampusOptions.map(campus => (
                    <label key={campus} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={campusFilter.includes(campus)} onChange={e => { if (e.target.checked) setCampusFilter([...campusFilter, campus]); else setCampusFilter(campusFilter.filter(c => c !== campus)) }} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span className="text-sm text-gray-700">{campus}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid w-fit grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <div className="min-w-0">
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Từ ngày</label>
              <input type="date" className="w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-[12px] leading-tight" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate || undefined} />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Đến ngày</label>
              <input type="date" className="w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-[12px] leading-tight" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate || undefined} />
            </div>
          </div>
          {(campusFilter.length > 0 || fromDate || toDate) && (
            <Button size="sm" variant="ghost" onClick={() => { setCampusFilter([]); setFromDate(''); setToDate('') }}>Xoá lọc</Button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingError && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1"><p className="font-medium">Không thể tải danh sách</p><p className="mt-0.5">{loadingError}</p></div>
              <Button size="sm" variant="outline" onClick={() => fetchData()}>Thử lại</Button>
            </div>
          )}
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách lớp nhận thay</h2>
            <p className="text-sm text-gray-600">Tổng: {filteredItems.length} lớp</p>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày phân</TableHead>
                  <TableHead>Giáo viên xin nghỉ</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Ngày nghỉ</TableHead>
                  <TableHead>Mã lớp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => {
                  const sm = getStatusMeta(item.status)
                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelected(item)}>
                      <TableCell>{new Date(item.created_at).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">{item.teacher_name}</p>
                        {item.lms_code && <p className="text-xs text-gray-500">LMS: {item.lms_code}</p>}
                      </TableCell>
                      <TableCell>{item.campus}</TableCell>
                      <TableCell>{new Date(item.leave_date).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell>{item.class_code || '-'}</TableCell>
                      <TableCell><Badge variant={sm.variant}>{sm.label}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-gray-200 lg:hidden">
            {filteredItems.map(item => {
              const sm = getStatusMeta(item.status)
              return (
                <button key={item.id} type="button" className="w-full p-4 text-left hover:bg-gray-50" onClick={() => setSelected(item)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{item.teacher_name}</p>
                    <Badge variant={sm.variant}>{sm.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">Cơ sở: {item.campus}</p>
                  <p className="mt-1 text-xs text-gray-600">Ngày nghỉ: {new Date(item.leave_date).toLocaleDateString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-gray-600">Mã lớp: {item.class_code || '-'}</p>
                </button>
              )
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-600">Không có lớp nào phù hợp bộ lọc.</div>
          )}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => {
          setDeclineConfirmOpen(false)
          setDeclineReason('')
          setSelected(null)
        }}
        title={selected ? `Lớp nhận thay #${selected.id}` : 'Chi tiết'}
        size="2xl"
        footer={
          selected && isAwaitingSubstituteResponse(selected.status) ? (
            <div className="flex w-full flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700" htmlFor="substitute-decline-reason">
                  Lý do từ chối (tuỳ chọn)
                </label>
                <textarea
                  id="substitute-decline-reason"
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  disabled={busy}
                  rows={2}
                  maxLength={2000}
                  placeholder="VD: Trùng lịch cá nhân, không dạy được buổi này…"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => requestDeclineConfirm(selected.id)}
                  className="w-full border-red-200 text-red-800 hover:bg-red-50 sm:w-auto"
                >
                  Từ chối nhận lớp
                </Button>
                <Button
                  type="button"
                  variant="mindx"
                  disabled={busy}
                  onClick={() => handleConfirm(selected.id)}
                  className="w-full sm:w-auto"
                >
                  {submittingKind === 'confirm' ? 'Đang xác nhận...' : 'Xác nhận đã nhận thông tin'}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <Stepper steps={[
              { id: 1, label: 'Gửi mail xin nghỉ', status: 'completed' },
              { id: 2, label: 'TC/Leader duyệt', status: 'completed' },
              { id: 3, label: 'GV thay thế xác nhận', status: selected.status === 'substitute_confirmed' ? 'success' : 'current' },
              { id: 4, label: 'Hoàn tất', status: selected.status === 'substitute_confirmed' ? 'success' : 'upcoming' },
            ]} />
            <div className="flex items-center gap-2">
              <Badge variant={getStatusMeta(selected.status).variant}>{getStatusMeta(selected.status).label}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Giáo viên xin nghỉ</p><p className="text-sm font-medium text-gray-900">{selected.teacher_name}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Email giáo viên xin nghỉ</p><p className="text-sm font-medium text-gray-900 break-all">{selected.email || '-'}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Mã lớp</p><p className="text-sm font-medium text-gray-900">{selected.class_code || '-'}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Thời gian học</p><p className="text-sm font-medium text-gray-900">{selected.class_time || '-'}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Buổi học xin nghỉ</p><p className="text-sm font-medium text-gray-900">{selected.leave_session || '-'}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-600">Ngày nghỉ</p><p className="text-sm font-medium text-gray-900">{new Date(selected.leave_date).toLocaleDateString('vi-VN')}</p></div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2"><p className="text-xs text-gray-600">Tình hình lớp học</p><p className="text-sm text-gray-900 whitespace-pre-wrap">{selected.class_status || '-'}</p></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Xác nhận từ TC/Leader</p>
                <p className="mt-1 text-sm font-medium text-amber-900">{selected.admin_name || 'Chưa có tên người xác nhận'}</p>
                <p className="text-xs text-amber-900/80 break-all">{selected.admin_email || 'Chưa có email người xác nhận'}</p>
                <p className="mt-2 text-xs text-amber-900/80 whitespace-pre-wrap">{selected.admin_note || 'Chưa có ghi chú duyệt từ TC/Leader.'}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">Xác nhận từ giáo viên dạy thay</p>
                <p className="mt-1 text-sm font-medium text-emerald-900">{selected.substitute_teacher || 'Chưa có tên giáo viên thay'}</p>
                <p className="text-xs text-emerald-900/80 break-all">{selected.substitute_email || 'Chưa có email giáo viên thay'}</p>
                <p className="mt-2 text-xs text-emerald-900/80">{selected.substitute_confirmed_at ? `Thời điểm xác nhận: ${new Date(selected.substitute_confirmed_at).toLocaleString('vi-VN')}` : 'Chưa xác nhận nhận lớp.'}</p>
              </div>
            </div>
            <LeaveBuNotice
              campus={selected.campus}
              centerId={selected.center_id}
              campusBuEmail={selected.campus_bu_email}
            />
            {isAwaitingSubstituteResponse(selected.status) && (
              <p className="text-sm text-gray-600">
                Dùng các nút <strong className="font-semibold text-gray-800">Từ chối</strong> hoặc{' '}
                <strong className="font-semibold text-gray-800">Xác nhận</strong> ở cuối cửa sổ này.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={declineConfirmOpen}
        onClose={() => {
          if (!busy) setDeclineConfirmOpen(false)
        }}
        title="Xác nhận từ chối nhận lớp thay"
        size="md"
        backdropClassName="z-[100]"
        containerClassName="z-[100]"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeclineConfirmOpen(false)}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => selected && void executeDecline(selected.id)}
              className="w-full border-red-200 text-red-800 hover:bg-red-50 sm:w-auto"
            >
              {submittingKind === 'decline' ? 'Đang từ chối...' : 'Từ chối nhận lớp'}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-gray-700">
          Bạn từ chối nhận lớp thay? Yêu cầu sẽ trở lại trạng thái chưa có GV thay để TC/Leader phân người khác.
        </p>
      </Modal>
    </div>
  )
}
