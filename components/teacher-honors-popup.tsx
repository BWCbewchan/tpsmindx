'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AwardCounter, HonorsMedallion } from './honors-award'
import useSWR from 'swr'
import { normalizeStorageUrl } from '@/lib/storage-url'
import styles from './teacher-honors-popup.module.css'

interface Teacher {
  teacher_code: string
  full_name: string
  center: string
  total_score: number
  avatar_url: string | null
}
interface HonorsResponse { success: boolean; data: Teacher[]; month?: string }
interface TeacherHonorsPopupProps { isOpen: boolean; onOpen?: () => void; onClose: () => void }

async function fetcher(url: string): Promise<HonorsResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data?.success || !Array.isArray(data.data)) throw new Error('Không thể tải bảng vinh danh')
  return data
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase()
}

function TeacherPortrait({ teacher }: { teacher: Teacher }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [teacher.avatar_url])
  return <div className={styles.portrait}>
    {teacher.avatar_url && !failed ? <img src={normalizeStorageUrl(teacher.avatar_url)} alt={teacher.full_name} onError={() => setFailed(true)} />
      : <span className={styles.initials} aria-label={`Ảnh đại diện của ${teacher.full_name}`}>{initials(teacher.full_name)}</span>}
  </div>
}

export function TeacherHonorsPopup({ isOpen, onClose }: TeacherHonorsPopupProps) {
  const [mounted, setMounted] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const { data, error, isLoading, mutate } = useSWR<HonorsResponse>(isOpen ? '/api/truyenthong/top-teachers' : null, fetcher, {
    revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 15_000,
  })

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!isOpen || !mounted) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }), 0)
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', keydown, true)
      document.body.style.overflow = overflow
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen, mounted])

  if (!mounted || !isOpen) return null
  const teachers = data?.data?.slice(0, 3) || []
  const ranks = [1, 0, 2].filter(index => index < teachers.length)
  return createPortal(<div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="teacher-honors-popup-title" tabIndex={-1}>
      <div className={styles.scrollArea}>
        <section className={styles.content}>
          <header className={styles.heading}>
            <h2 id="teacher-honors-popup-title">Vinh danh giáo viên</h2>
            <div className={styles.headerActions}>
              {data?.month && <span className={styles.period}>Tháng {data.month}</span>}
              <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng bảng vinh danh"><X size={20} /></button>
            </div>
          </header>
          {isLoading && !teachers.length ? <div className={styles.status} role="status">Đang cập nhật bảng vinh danh…</div>
            : error && !teachers.length ? <div className={styles.status} role="alert"><p>Chưa tải được bảng vinh danh.</p><button type="button" onClick={() => void mutate()}>Thử lại</button></div>
              : !teachers.length ? <div className={styles.status}>Bảng vinh danh đang được cập nhật. Hẹn gặp bạn trong kỳ tiếp theo.</div>
                : <div className={styles.podium} data-count={teachers.length} aria-label="Các giáo viên được vinh danh">
                  {ranks.map(index => {
                    const teacher = teachers[index], rank = index + 1
                    const score = Number(teacher.total_score)
                    return <div className={styles.cardAura} data-rank={rank} key={teacher.teacher_code}>
                    <article className={`${styles.teacher} ${styles.sashCard} ${rank === 1 ? styles.winner : ''}`} data-rank={rank} aria-label={`Hạng ${rank}: ${teacher.full_name}`}>
                      <span className={styles.innerStroke} aria-hidden="true" />
                      <span className={styles.cardShine} aria-hidden="true" />
                      <div className={styles.portraitFrame}>

                        <TeacherPortrait teacher={teacher} />
                      </div>
                      <div className={styles.teacherInfo}><div className={styles.nameSash}><h3>{teacher.full_name}</h3></div><p>{teacher.center}</p></div>
                      <div className={styles.score}>
                        <HonorsMedallion rank={rank} className={styles.medallion} />
                        <span className={styles.awardLabel}>{rank === 1 ? 'HẠNG NHẤT' : rank === 2 ? 'HẠNG NHÌ' : 'HẠNG BA'}</span>
                        <AwardCounter value={score} delay={rank === 1 ? 120 : rank === 2 ? 240 : 360} />
                        <span className={styles.metric}>CR45</span>
                      </div>
                    </article>
                    </div>
                  })}
                </div>}
          {error && teachers.length > 0 && <p className={styles.stale} role="status">Đang hiển thị dữ liệu gần nhất. <button type="button" onClick={() => void mutate()}>Thử cập nhật lại</button></p>}
        </section>
      </div>
    </div>
  </div>, document.body)
}

export default TeacherHonorsPopup
