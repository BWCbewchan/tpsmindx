'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { TEACHER_BEHIND_TEACHER_POST } from '@/lib/static-communications'

const DEADLINE = Date.parse('2026-11-12T23:59:00+07:00')

export function TeacherEventRegistrationModal({ mode = 'user' }: { mode?: 'user' | 'admin' }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    const update = () => setRemaining(Math.max(0, Math.ceil((DEADLINE - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    const restore = () => { window.clearInterval(timer); document.body.style.overflow = previousOverflow }
    dialog.addEventListener('close', restore)
    return () => {
      window.clearInterval(timer)
      dialog.removeEventListener('close', restore)
      dialog.close()
      restore()
      previousFocus?.focus()
    }
  }, [])

  const detailHref = `${mode === 'admin' ? '/admin/truyenthong/posts' : '/user/truyenthong'}/${TEACHER_BEHIND_TEACHER_POST.slug}`
  const seconds = remaining ?? 0
  const units = [
    { label: 'Ngày', value: Math.floor(seconds / 86400) },
    { label: 'Giờ', value: Math.floor(seconds / 3600) % 24 },
    { label: 'Phút', value: Math.floor(seconds / 60) % 60 },
    { label: 'Giây', value: seconds % 60 },
  ]

  return (
    <dialog ref={dialogRef} aria-labelledby="teacher-event-title" aria-describedby="teacher-event-deadline" onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close() }} className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/65 backdrop:backdrop-blur-sm">
      <div className="relative">
        <header className="space-y-3 border-b border-red-100 bg-red-50 p-4 pr-14 text-center">
          <h2 id="teacher-event-title" className="text-lg font-bold text-[#a1001f]">Đăng ký TEACHER BEHIND TEACHER</h2>
          <p id="teacher-event-deadline" className="text-sm text-gray-700">Đóng form lúc 23:59 ngày 12/11/2026 (giờ Việt Nam)</p>
          {remaining === null ? <p className="text-sm text-gray-600">Đang tải thời gian còn lại…</p> : remaining === 0 ? (
            <p className="font-semibold text-red-700">Đã hết thời gian đăng ký</p>
          ) : (
            <div role="timer" aria-label="Thời gian đăng ký còn lại" aria-live="off" className="flex justify-center gap-2">
              {units.map(unit => <div key={unit.label} className="min-w-14 rounded-lg border border-red-100 bg-white px-2 py-1.5">
                <span className="block text-2xl font-bold tabular-nums text-[#a1001f]">{String(unit.value).padStart(2, '0')}</span>
                <span className="text-xs text-gray-600">{unit.label}</span>
              </div>)}
            </div>
          )}
        </header>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Đóng thông báo đăng ký sự kiện" className="absolute right-3 top-3 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
          <X className="h-5 w-5" />
        </button>
        <a href="/communications/teacher-behind-teacher-2026-registration-extension.png" target="_blank" rel="noopener noreferrer" aria-label="Phóng to ảnh và mã QR đăng ký miền Bắc, miền Nam" className="block">
          <img src="/communications/teacher-behind-teacher-2026-registration-extension.png" alt="Quét mã QR miền Bắc bên trái hoặc miền Nam bên phải để đăng ký tham dự sự kiện 20/11" width={1080} height={1080} className="mx-auto max-h-[calc(94dvh_-_240px)] min-h-56 w-full object-contain" />
        </a>
        <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-gray-100 p-3">
          <span className="text-xs text-gray-600">Bấm ảnh để phóng to mã QR</span>
          <Link href={detailHref} onClick={() => dialogRef.current?.close()} className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#870019]">Xem bài viết</Link>
        </footer>
      </div>
    </dialog>
  )
}
