'use client'

import { cn } from '@/lib/utils'
import {
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  User,
  Users,
  X,
  BookOpen,
  CheckCircle2,
} from 'lucide-react'
import { useEffect } from 'react'

export interface ClassDetailData {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
  numberOfSessions: number
  courseName: string
  courseLineName: string
  centreName: string
  centreShortName: string
  studentCount: number
  students: Array<{
    id: string
    fullName: string
    email?: string
    phoneNumber?: string
  }>
  teachers: Array<{
    id: string
    code: string
    fullName: string
    email: string
    role: string
    roleCode?: 'LEC' | 'TA'
  }>
  slots: Array<{
    id: string
    sessionIndex: number
    date: string | null
    startTime: string | null
    endTime: string | null
    sessionHour: number | null
    teacherNames: string[]
    studentAttendanceCount: number
  }>
}

interface ClassDetailModalProps {
  cls: ClassDetailData | null
  onClose: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Định dạng thời gian ca học chuyển về múi giờ GMT+7 (Asia/Ho_Chi_Minh) và chỉ hiển thị HH:MM
 */
function formatSlotTimeGmt7(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  try {
    const trimmed = timeStr.trim()
    // Nếu chuỗi đã là dạng HH:MM hoặc H:MM thuần túy thì trả về chuẩn HH:mm
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':')
      return `${h.padStart(2, '0')}:${m}`
    }

    const d = new Date(trimmed)
    if (isNaN(d.getTime())) {
      return trimmed
    }

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return timeStr
  }
}

export function ClassDetailModal({ cls, onClose }: ClassDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!cls) return null

  const isRunning = cls.status === 'RUNNING'
  const isPreparing = cls.status === 'PREPARING'

  // Tính tiến độ buổi học đã hoàn thành
  const totalSessions = cls.numberOfSessions || cls.slots.length || 0
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  const completedSlotsCount = cls.slots.filter((slot) => {
    if (slot.studentAttendanceCount && slot.studentAttendanceCount > 0) return true
    if (slot.date) {
      const d = new Date(slot.date)
      if (!isNaN(d.getTime()) && d <= now) return true
    }
    return false
  }).length

  const completedSessions =
    cls.status === 'FINISHED' && totalSessions > 0
      ? Math.max(completedSlotsCount, totalSessions)
      : Math.min(completedSlotsCount, totalSessions > 0 ? totalSessions : completedSlotsCount)

  const progressPercent =
    totalSessions > 0
      ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="fixed inset-0 cursor-default" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="relative flex flex-col w-full max-w-3xl max-h-[calc(100dvh-32px)] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden z-10"
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5 bg-slate-50/70">
          <div className="pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                  isRunning
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isPreparing
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {isRunning ? 'Đang học' : isPreparing ? 'Chuẩn bị mở' : cls.status}
              </span>

              {cls.courseLineName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-[#a1001f] border border-rose-200/70">
                  <BookOpen className="h-3 w-3" />
                  {cls.courseLineName}
                </span>
              )}
            </div>

            <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {cls.name}
            </h3>

            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {cls.centreName || cls.centreShortName || 'Cơ sở MindX'}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(cls.startDate)} — {formatDate(cls.endDate)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-none"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Sĩ số học viên</span>
              <p className="mt-0.5 text-xl font-bold font-mono text-slate-800">
                {cls.studentCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  Tiến độ buổi học đã hoàn thành
                </span>
                {totalSessions > 0 && (
                  <span className="text-[11px] font-bold font-mono text-[#a1001f]">
                    {progressPercent}%
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xl font-bold font-mono text-slate-900">
                {completedSessions}/{totalSessions > 0 ? totalSessions : '—'}
              </p>
              {totalSessions > 0 && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#a1001f] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Giáo viên phụ trách</span>
              <p className="mt-0.5 text-xl font-bold font-mono text-slate-800">
                {cls.teachers.length}
              </p>
            </div>
          </div>

          {/* Section 1: Giáo viên phụ trách */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              <User className="h-3.5 w-3.5 text-[#a1001f]" />
              Giáo viên đứng lớp ({cls.teachers.length})
            </h4>

            {cls.teachers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có giáo viên được phân công.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {cls.teachers.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {t.fullName || t.code || 'Giáo viên'}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{t.email || t.code}</p>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border',
                        t.role === 'Giảng viên chính' || t.roleCode === 'LEC'
                          ? 'bg-rose-50 text-[#a1001f] border-rose-200/60'
                          : 'bg-slate-100 text-slate-700 border-slate-200',
                      )}
                    >
                      {t.role || (t.roleCode === 'LEC' ? 'Giảng viên chính' : 'Trợ giảng')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Danh sách học viên */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              <GraduationCap className="h-3.5 w-3.5 text-sky-600" />
              Danh sách học viên ({cls.students.length})
            </h4>

            {cls.students.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có dữ liệu học viên trong lớp.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 divide-y divide-slate-100">
                {cls.students.map((student, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3.5 py-2 text-xs bg-white">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 w-5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-semibold text-slate-800">{student.fullName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {student.phoneNumber || student.email || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Tiến độ buổi học (Slots) */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              Lịch các buổi học ({cls.slots.length} buổi)
            </h4>

            {cls.slots.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Lớp học chưa được tạo slot buổi học.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200/80 divide-y divide-slate-100">
                {cls.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-white hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <span className="inline-flex h-6 w-6 shrink-0 place-items-center justify-center rounded-md bg-slate-100 text-[10.5px] font-mono font-bold text-slate-600">
                        {slot.sessionIndex}
                      </span>
                      <div className="truncate">
                        <p className="font-medium text-slate-800">
                          {formatDate(slot.date)}{' '}
                          {slot.startTime && (
                            <span className="text-slate-500 font-mono text-[11px] font-normal">
                              ({formatSlotTimeGmt7(slot.startTime)} - {formatSlotTimeGmt7(slot.endTime) || '...'})
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {slot.teacherNames.length > 0
                            ? `GV: ${slot.teacherNames.join(', ')}`
                            : 'Chưa có GV điểm danh'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="h-3 w-3" />
                        {slot.studentAttendanceCount} học viên
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 sm:px-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition focus:outline-none"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
