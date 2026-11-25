'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { HonorsTrophy, AwardCounter } from './honors-award'
import useSWR from 'swr'
import { normalizeStorageUrl } from '@/lib/storage-url'
import metal from './teacher-honors-popup.module.css'
import styles from './honors-summary.module.css'

interface Teacher { teacher_code: string; full_name: string; center: string; total_score: number; avatar_url: string | null }
interface HonorsData { success: boolean; data: Teacher[]; month?: string }

async function fetcher(url: string): Promise<HonorsData> {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data?.success || !Array.isArray(data.data)) throw new Error('Không tải được bảng vinh danh')
  return data
}

function Avatar({ teacher }: { teacher: Teacher }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [teacher.avatar_url])
  return teacher.avatar_url && !failed
    ? <img src={normalizeStorageUrl(teacher.avatar_url)} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span className={styles.initials}>{teacher.full_name.trim().split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('')}</span>
}

export function HonorsSummary({ onOpenPopup }: { onOpenPopup?: () => void }) {
  const { data, isLoading, error, mutate } = useSWR<HonorsData>('/api/truyenthong/top-teachers', fetcher, {
    revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 15_000,
  })
  const teachers = data?.data?.slice(0, 3) || []
  return <section className={styles.summary} aria-label="Bảng vinh danh giáo viên">
    <header className={styles.header}><span>CR45</span>{data?.month && <span className={styles.month}>Tháng {data.month}</span>}</header>
    {isLoading && !teachers.length ? <div className={styles.status} role="status">Đang tải bảng vinh danh…</div>
      : error && !teachers.length ? <div className={styles.status} role="alert">Chưa tải được dữ liệu.<button type="button" onClick={() => void mutate()}>Thử lại</button></div>
        : !teachers.length ? <div className={styles.status}>Chưa có dữ liệu vinh danh kỳ này.</div>
          : <ol className={styles.list}>
            {teachers.map((teacher, index) => {
              const rank = index + 1, score = Number(teacher.total_score)
              return <li className={`${metal.teacher} ${rank === 1 ? metal.winner : ''} ${styles.row}`} data-rank={rank} key={teacher.teacher_code} aria-label={`Hạng ${rank}: ${teacher.full_name}`}>
                <div className={styles.awardFlag}><HonorsTrophy rank={rank} className={styles.trophy} /></div>
                <div className={styles.avatarFrame}><div className={styles.avatar}><Avatar teacher={teacher} /></div><span className={styles.rank}>{rank}</span></div>
                <div className={styles.info}><h3>{teacher.full_name}</h3><p>{teacher.center}</p></div>
                <div className={styles.metric}><AwardCounter value={score} delay={index * 100} /><span>{rank === 1 ? 'Hạng nhất' : rank === 2 ? 'Hạng nhì' : 'Hạng ba'}</span></div>
              </li>
            })}
          </ol>}
    {error && teachers.length > 0 && <p className={styles.stale}>Dữ liệu gần nhất. <button type="button" onClick={() => void mutate()}>Cập nhật lại</button></p>}
    {onOpenPopup && <button type="button" className={styles.open} onClick={onOpenPopup}>Xem bảng vinh danh <ArrowUpRight size={16} aria-hidden="true" /></button>}
  </section>
}
