'use client'

import { cn } from '@/lib/utils'
import {
  BookOpen,
  Briefcase,
  Building2,
  Mail,
  UserCheck,
  X,
} from 'lucide-react'
import { useEffect } from 'react'

export interface TeacherDetailData {
  code: string
  fullName: string
  email: string
  mainCentre: string
  courseLine?: string
  teachingRole?: string
  position?: string
  currentRole?: string
  status?: string
  classesCount: number
  assignedClasses: Array<{
    id: string
    name: string
    role: string
    roleCode?: 'LEC' | 'TA'
    status?: string
  }>
}

interface TeacherDetailModalProps {
  teacher: TeacherDetailData | null
  onClose: () => void
  onSelectClass?: (classId: string) => void
}

export function TeacherDetailModal({
  teacher,
  onClose,
  onSelectClass,
}: TeacherDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!teacher) return null

  const isActive = (teacher.status || 'Active').toLowerCase() === 'active'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="fixed inset-0 cursor-default" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="relative flex flex-col w-full max-w-xl max-h-[calc(100dvh-32px)] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden z-10"
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5 bg-slate-50/70">
          <div className="pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-200/70 text-slate-800">
                {teacher.code}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {isActive ? 'Đang hoạt động' : teacher.status}
              </span>
            </div>

            <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {teacher.fullName}
            </h3>

            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {teacher.email || 'Chưa cập nhật email'}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {teacher.mainCentre || 'Chưa phân cơ sở'}
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Số lớp đang dạy</span>
              <p className="mt-0.5 text-xl font-bold font-mono text-slate-800">
                {teacher.classesCount}
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Khối giảng dạy</span>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate">
                {teacher.courseLine || 'Đang cập nhật'}
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Role</span>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate">
                {teacher.teachingRole || 'Đang cập nhật'}
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400">Vị trí</span>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate">
                {teacher.position || teacher.currentRole || 'Đang cập nhật'}
              </p>
            </div>
          </div>

          {/* Section: Danh sách lớp học đang phụ trách */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              <BookOpen className="h-3.5 w-3.5 text-[#a1001f]" />
              Các lớp học đang phụ trách ({teacher.assignedClasses.length})
            </h4>

            {teacher.assignedClasses.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
                <p className="text-xs text-slate-500 font-medium">
                  Hiện giáo viên chưa có lớp học nào trong kỳ này.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {teacher.assignedClasses.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs transition"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10.5px] font-mono text-slate-400">
                        ID: {item.id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                          item.role === 'Giảng viên chính' || item.roleCode === 'LEC'
                            ? 'bg-rose-50 text-[#a1001f] border-rose-200/60'
                            : 'bg-slate-100 text-slate-700 border-slate-200',
                        )}
                      >
                        {item.role || (item.roleCode === 'LEC' ? 'Giảng viên chính' : 'Trợ giảng')}
                      </span>

                      {onSelectClass && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectClass(item.id)
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-[#a1001f] hover:bg-rose-50 rounded-lg transition"
                        >
                          Xem lớp
                        </button>
                      )}
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
