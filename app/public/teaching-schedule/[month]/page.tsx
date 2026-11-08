import { getTeachingScheduleTeamRows, type TeachingScheduleEntryRow } from '@/lib/teaching-schedule-data'
import {
  TEACHING_SCHEDULE_SESSIONS,
  getTeachingSchedulePattern,
} from '@/lib/teaching-schedule'
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from './public-schedule.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

type PublicSchedulePageProps = {
  params: Promise<{ month: string }>
}

function getMonthDetails(value: string) {
  if (!MONTH_PATTERN.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  if (year < 2020 || year > 2100) return null
  const firstDate = new Date(Date.UTC(year, month - 1, 1))
  const lastDate = new Date(Date.UTC(year, month, 0))
  return {
    year,
    month,
    start: firstDate.toISOString().slice(0, 10),
    end: lastDate.toISOString().slice(0, 10),
  }
}

function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function getMondayIndex(value: string) {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay()
  return day === 0 ? 6 : day - 1
}

function findWeekdayEntry(entries: TeachingScheduleEntryRow[], weekdayIndex: number) {
  return entries.find((entry) => getMondayIndex(entry.date) === weekdayIndex)
}

function getRoleOrder(roleCode: string) {
  const normalized = roleCode.trim().toUpperCase()
  if (normalized === 'TEGL+') return 0
  if (normalized === 'TEGL' || normalized === 'HO') return 1
  if (normalized === 'TF') return 3
  return 2
}

function getCentreSummary(entry: TeachingScheduleEntryRow) {
  const sessions = getTeachingSchedulePattern(entry.pattern)?.sessions || []
  return sessions
    .map((session, index) => {
      const code = entry.centreCodes[index] || entry.centreCodes[0]
      return code ? `${TEACHING_SCHEDULE_SESSIONS[session].label} ${code}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

export async function generateMetadata({ params }: PublicSchedulePageProps): Promise<Metadata> {
  const { month: value } = await params
  const details = getMonthDetails(value)
  if (!details) return { title: 'Lịch làm việc Teaching | MindX TPS' }
  return {
    title: `Lịch làm việc Teaching tháng ${details.month}/${details.year} | MindX TPS`,
    description: `Bảng lịch làm việc công khai của team Teaching tháng ${details.month}/${details.year}.`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicTeachingSchedulePage({ params }: PublicSchedulePageProps) {
  const { month: value } = await params
  const details = getMonthDetails(value)
  if (!details) notFound()

  const team = (await getTeachingScheduleTeamRows(details.start, details.end))
    .map((person, index) => ({ person, index }))
    .sort((left, right) => {
      const roleDifference = getRoleOrder(left.person.roleCode) - getRoleOrder(right.person.roleCode)
      return roleDifference || left.index - right.index
    })
    .map(({ person }) => person)
  const registeredPeople = team.filter((person) => person.entries.length > 0).length
  const previousMonth = shiftMonth(details.year, details.month, -1)
  const nextMonth = shiftMonth(details.year, details.month, 1)

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.monthNavigation}>
          <Link href={`/public/teaching-schedule/${previousMonth}`} className={styles.iconButton} aria-label="Xem tháng trước">
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.monthTitle}>
            <span>Tháng đăng ký</span>
            <strong>Tháng {details.month}/{details.year}</strong>
            <CalendarDays size={16} aria-hidden="true" />
          </div>
          <Link href={`/public/teaching-schedule/${nextMonth}`} className={styles.iconButton} aria-label="Xem tháng sau">
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className={styles.monthStatus}>
          <div>
            <strong>Tháng {details.month} năm {details.year}</strong>
            <span>{registeredPeople}/{team.length} nhân sự đã có lịch</span>
          </div>
          <span className={styles.publicBadge}><ExternalLink size={13} /> Công khai</span>
        </div>
      </header>

      <section className={styles.tableViewport} aria-label={`Lịch làm việc tháng ${details.month}/${details.year}`}>
        <table className={styles.scheduleTable}>
          <thead>
            <tr>
              <th className={styles.indexColumn}>STT</th>
              <th className={styles.nameColumn}>Họ và tên</th>
              {WEEKDAYS.map((weekday, index) => (
                <th key={weekday} data-weekend={index > 4}>{weekday}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((person, personIndex) => (
              <tr key={`${person.name}-${personIndex}`}>
                <td className={styles.indexColumn}>{personIndex + 1}</td>
                <th scope="row" className={styles.nameColumn}>{person.name}</th>
                {WEEKDAYS.map((weekday, weekdayIndex) => {
                  const entry = findWeekdayEntry(person.entries, weekdayIndex)
                  const meta = getTeachingSchedulePattern(entry?.pattern)
                  const centreSummary = entry ? getCentreSummary(entry) : ''
                  return (
                    <td key={weekday} className={styles.scheduleCell}>
                      {entry && meta ? (
                        <div className={styles.shiftCard} data-category={meta.category}>
                          <strong>{meta.label}</strong>
                          {centreSummary && <span>{centreSummary}</span>}
                          {entry.flexible && <small>Linh hoạt</small>}
                        </div>
                      ) : (
                        <span className={styles.emptyCell}>—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
