'use client'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import {
  TEACHING_POSITION_WORK_RULES,
  TEACHING_SCHEDULE_PATTERNS,
  TEACHING_SCHEDULE_SESSIONS,
  TEACHING_SHIFT_RULES,
  getTeachingSchedulePattern,
  isOnsiteTeachingSchedulePattern,
  type TeachingSchedulePattern,
} from '@/lib/teaching-schedule'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  Search,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './schedule.module.css'

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const OTHER_CENTRE_VALUE = '__other__'

type Centre = {
  id: number
  name: string
  shortCode: string
  region: string
}

type ScheduleProfile = {
  email: string
  code: string
  name: string
  roleCode: string
  roleName: string
  area: string | null
}

type ScheduleEntry = {
  id?: number
  date: string
  pattern: TeachingSchedulePattern
  centreIds: number[]
  centreCodes?: string[]
  flexible: boolean
  note: string
  updatedAt?: string | null
}

type TeamRow = {
  email: string
  code: string
  name: string
  roleCode: string
  entries: ScheduleEntry[]
}

type PageTab = 'register' | 'team' | 'rules'

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function parseMonthKey(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function formatShortDate(value: string) {
  return parseDateKey(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatLongDate(value: string) {
  return parseDateKey(value).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function monthLabel(value: string) {
  return parseMonthKey(value).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  })
}

function getMondayIndex(value: string) {
  const day = parseDateKey(value).getDay()
  return day === 0 ? 6 : day - 1
}

function getMonthDates(value: string) {
  const firstDate = parseMonthKey(value)
  const lastDay = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, index) =>
    toDateKey(new Date(firstDate.getFullYear(), firstDate.getMonth(), index + 1)),
  )
}

function getCalendarCells(value: string, dates: string[]) {
  const leadingCells = getMondayIndex(dates[0])
  const cells: Array<string | null> = [
    ...Array.from({ length: leadingCells }, () => null),
    ...dates,
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function isTemplateDate(value: string) {
  return parseDateKey(value).getDate() <= 7
}

function mapEntries(rows: ScheduleEntry[]) {
  return rows.reduce<Record<string, ScheduleEntry>>((acc, row) => {
    acc[row.date] = {
      ...row,
      centreIds: normalizeCentreIdsForPattern(
        row.pattern,
        Array.isArray(row.centreIds) ? row.centreIds : [],
      ),
      centreCodes: Array.isArray(row.centreCodes) ? row.centreCodes : [],
      flexible: Boolean(row.flexible),
      note: row.note || '',
    }
    return acc
  }, {})
}

function emptyEntry(date: string, centres: Centre[]): ScheduleEntry {
  const defaultCentreIds = centres.length === 1
    ? normalizeCentreIdsForPattern('morning_afternoon', [centres[0].id])
    : []
  return {
    date,
    pattern: 'morning_afternoon',
    centreIds: defaultCentreIds,
    centreCodes: [],
    flexible: false,
    note: '',
  }
}

function normalizeCentreIdsForPattern(
  pattern: TeachingSchedulePattern,
  centreIds: number[],
) {
  const sessionCount = getTeachingSchedulePattern(pattern)?.sessions.length || 0
  if (sessionCount === 0 || centreIds.length === 0) return []
  if (centreIds.length === 1) return Array(sessionCount).fill(centreIds[0])
  const fallbackId = centreIds.find((id) => Number.isInteger(id) && id > 0) || 0
  return Array.from(
    { length: sessionCount },
    (_, index) => centreIds[index] || fallbackId,
  )
}

function updateSessionCentre(
  centreIds: number[],
  sessionIndex: number,
  centreId: number,
  sessionCount: number,
) {
  const next = Array.from(
    { length: sessionCount },
    (_, index) => centreIds[index] || 0,
  )
  next[sessionIndex] = centreId
  return next
}

function getSessionCentreSummary(
  entry: ScheduleEntry,
  centresById?: Map<number, Centre>,
) {
  const sessions = getTeachingSchedulePattern(entry.pattern)?.sessions || []
  return sessions.map((sessionName, index) => {
    const centreCode = entry.centreCodes?.[index]
      || entry.centreCodes?.[0]
      || centresById?.get(entry.centreIds[index] || entry.centreIds[0])?.shortCode
    return centreCode
      ? `${TEACHING_SCHEDULE_SESSIONS[sessionName].label} ${centreCode}`
      : ''
  }).filter(Boolean).join(' · ')
}

function serializableEntries(entries: Record<string, ScheduleEntry>) {
  return Object.values(entries)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      pattern: entry.pattern,
      centreIds: entry.centreIds,
      flexible: entry.flexible,
      note: entry.note.trim(),
    }))
}

function findWeekdayEntry(entries: ScheduleEntry[], weekdayIndex: number) {
  return entries.find((entry) => getMondayIndex(entry.date) === weekdayIndex)
}

function getTeamRoleOrder(roleCode: string) {
  const normalized = roleCode.trim().toUpperCase()
  if (normalized === 'TEGL+') return 0
  if (normalized === 'TEGL' || normalized === 'HO') return 1
  if (normalized === 'TF') return 3
  return 2
}

export function ScheduleRegistrationClient() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<PageTab>('register')
  const [month, setMonth] = useState(() => toMonthKey(new Date()))
  const [profile, setProfile] = useState<ScheduleProfile | null>(null)
  const [centres, setCentres] = useState<Centre[]>([])
  const [otherCentres, setOtherCentres] = useState<Centre[]>([])
  const [entries, setEntries] = useState<Record<string, ScheduleEntry>>({})
  const [savedEntries, setSavedEntries] = useState<Record<string, ScheduleEntry>>({})
  const [team, setTeam] = useState<TeamRow[]>([])
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScheduleEntry | null>(null)
  const [otherCentreSessionIndex, setOtherCentreSessionIndex] = useState<number | null>(null)
  const [centreSearch, setCentreSearch] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editorError, setEditorError] = useState('')
  const [notice, setNotice] = useState('')

  const monthDates = useMemo(() => getMonthDates(month), [month])
  const calendarCells = useMemo(() => getCalendarCells(month, monthDates), [month, monthDates])
  const allCentres = useMemo(() => [...centres, ...otherCentres], [centres, otherCentres])
  const centresById = useMemo(
    () => new Map(allCentres.map((centre) => [centre.id, centre])),
    [allCentres],
  )
  const registeredPeople = useMemo(
    () => team.filter((person) => person.entries.length > 0).length,
    [team],
  )
  const registeredDays = Object.keys(entries).length
  const templateDays = monthDates.slice(0, 7).filter((date) => entries[date]).length
  const onsiteDays = useMemo(
    () => Object.values(entries).filter((entry) => isOnsiteTeachingSchedulePattern(entry.pattern)).length,
    [entries],
  )
  const restDays = useMemo(
    () => Object.values(entries).filter((entry) => ['day_off', 'leave', 'holiday'].includes(entry.pattern)).length,
    [entries],
  )
  const filteredTeam = useMemo(() => {
    const query = teamSearch.trim().toLowerCase()
    const result = query ? team.filter((person) =>
      [person.name, person.email].some((value) =>
        value.toLowerCase().includes(query),
      ),
    ) : team
    return [...result].sort(
      (left, right) => getTeamRoleOrder(left.roleCode) - getTeamRoleOrder(right.roleCode),
    )
  }, [team, teamSearch])
  const filteredOtherCentres = useMemo(() => {
    const query = centreSearch.trim().toLowerCase()
    return otherCentres.filter((centre) =>
      !query || [centre.name, centre.shortCode, centre.region].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [centreSearch, otherCentres])
  const groupedOtherCentres = useMemo(
    () => filteredOtherCentres.reduce<Record<string, Centre[]>>((acc, centre) => {
      const region = centre.region || 'Khu vực khác'
      acc[region] = acc[region] || []
      acc[region].push(centre)
      return acc
    }, {}),
    [filteredOtherCentres],
  )

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/teaching-schedules?month=${encodeURIComponent(month)}`,
        { cache: 'no-store', headers: authHeaders(token) },
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) {
        throw new Error(body.error || 'Không tải được lịch tháng.')
      }
      const ownEntries = mapEntries(body.data || [])
      setProfile(body.profile || null)
      setCentres(body.centres || [])
      setOtherCentres(body.otherCentres || [])
      setEntries(ownEntries)
      setSavedEntries(ownEntries)
      setTeam(body.team || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được lịch tháng.')
    } finally {
      setLoading(false)
    }
  }, [token, month])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])

  useEffect(() => {
    if (!editingDate) return
    const scrollContainer = document.getElementById('main-scroll-container')
    const previousBodyOverflow = document.body.style.overflow
    const previousContainerOverflow = scrollContainer?.style.overflow || ''
    document.body.style.overflow = 'hidden'
    if (scrollContainer) scrollContainer.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingDate(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      if (scrollContainer) scrollContainer.style.overflow = previousContainerOverflow
    }
  }, [editingDate])

  const openEditor = (date: string) => {
    const entry = entries[date]
    const firstOtherCentreIndex = entry?.centreIds.findIndex((centreId) =>
      otherCentres.some((centre) => centre.id === centreId),
    ) ?? -1
    setEditingDate(date)
    setDraft(entry ? { ...entry } : emptyEntry(date, centres))
    setOtherCentreSessionIndex(firstOtherCentreIndex >= 0 ? firstOtherCentreIndex : null)
    setCentreSearch('')
    setEditorError('')
  }

  const closeEditor = () => {
    setEditingDate(null)
    setDraft(null)
    setEditorError('')
    setOtherCentreSessionIndex(null)
  }

  const persistMonth = async (
    nextEntries: Record<string, ScheduleEntry>,
    successMessage: string,
  ) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/teaching-schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ month, entries: serializableEntries(nextEntries) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) {
        throw new Error(body.error || 'Không lưu được lịch tháng.')
      }
      setEntries(nextEntries)
      setSavedEntries(nextEntries)
      if (profile) {
        const ownTeamEntries = Object.values(nextEntries).map((entry) => ({
          ...entry,
          centreCodes: entry.centreIds
            .map((id) => centresById.get(id)?.shortCode)
            .filter((value): value is string => Boolean(value)),
        }))
        setTeam((current) => {
          const exists = current.some((person) => person.email === profile.email)
          if (!exists) {
            return [...current, {
              email: profile.email,
              code: profile.code,
              name: profile.name,
              roleCode: profile.roleCode,
              entries: ownTeamEntries,
            }]
          }
          return current.map((person) =>
            person.email === profile.email
              ? { ...person, entries: ownTeamEntries }
              : person,
          )
        })
      }
      setNotice(successMessage || body.message || 'Đã lưu lịch tháng.')
      return true
    } catch (saveError) {
      setEntries(savedEntries)
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được lịch tháng.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const commitDraft = async () => {
    if (!draft) return
    const sessionCount = getTeachingSchedulePattern(draft.pattern)?.sessions.length || 0
    if (
      isOnsiteTeachingSchedulePattern(draft.pattern)
      && (
        draft.centreIds.length !== sessionCount
        || draft.centreIds.some((centreId) => !Number.isInteger(centreId) || centreId <= 0)
      )
    ) {
      setEditorError('Vui lòng chọn cơ sở làm việc cho từng ca trong ngày này.')
      return
    }

    const repeatsByWeekday = isTemplateDate(draft.date)
    const weekdayIndex = getMondayIndex(draft.date)
    const targetDates = repeatsByWeekday
      ? monthDates.filter((date) => getMondayIndex(date) === weekdayIndex)
      : [draft.date]
    const nextEntries = { ...entries }
    for (const date of targetDates) {
      nextEntries[date] = {
        ...draft,
        id: undefined,
        date,
        updatedAt: undefined,
      }
    }
    closeEditor()
    await persistMonth(
      nextEntries,
      repeatsByWeekday
        ? `Đã áp dụng mẫu ${WEEKDAYS[weekdayIndex]} cho ${targetDates.length} ngày trong ${monthLabel(month)}.`
        : `Đã cập nhật riêng ${formatLongDate(draft.date)}.`,
    )
  }

  const clearDraftDay = async () => {
    if (!draft) return
    const repeatsByWeekday = isTemplateDate(draft.date)
    const weekdayIndex = getMondayIndex(draft.date)
    const targetDates = repeatsByWeekday
      ? monthDates.filter((date) => getMondayIndex(date) === weekdayIndex)
      : [draft.date]
    const nextEntries = { ...entries }
    for (const date of targetDates) delete nextEntries[date]
    closeEditor()
    await persistMonth(
      nextEntries,
      repeatsByWeekday
        ? `Đã xóa mẫu ${WEEKDAYS[weekdayIndex]} khỏi lịch tháng.`
        : `Đã xóa lịch ${formatLongDate(draft.date)}.`,
    )
  }

  const changeMonth = (amount: number) => {
    const value = parseMonthKey(month)
    value.setMonth(value.getMonth() + amount)
    setMonth(toMonthKey(value))
  }

  if (loading) {
    return (
      <div className={styles.statePage}>
        <LoaderCircle className={styles.spinner} aria-hidden="true" />
        <strong>Đang tải lịch tháng…</strong>
        <span>TPS đang lấy dữ liệu đăng ký và danh sách Team Teaching từ Supabase.</span>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className={styles.statePage}>
        <div className={styles.stateIconError}><AlertCircle aria-hidden="true" /></div>
        <strong>Chưa thể mở trang đăng ký lịch</strong>
        <span>{error}</span>
        <button type="button" onClick={() => void loadSchedule()}>
          <RefreshCcw size={16} /> Thử lại
        </button>
      </div>
    )
  }

  const today = toDateKey(new Date())

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}><Sparkles size={14} /> Workforce plan · Team Teaching</div>
          <h1>Đăng ký lịch làm việc</h1>
          <p>Đăng ký bảy ngày mẫu đầu tháng, TPS sẽ tự lặp lịch theo thứ cho cả tháng. Bạn vẫn có thể mở từng ngày để chỉnh ngoại lệ.</p>
          <div className={styles.profileRow}>
            <span className={styles.profileName}>{profile?.name}</span>
            <span className={styles.roleBadge}>{profile?.roleCode}</span>
            {profile?.area && <span className={styles.profileMeta}><MapPin size={13} /> {profile.area}</span>}
          </div>
        </div>
        <div className={styles.heroStamp}>
          <span>Tháng</span>
          <strong>{String(parseMonthKey(month).getMonth() + 1).padStart(2, '0')}</strong>
          <small>{parseMonthKey(month).getFullYear()}</small>
        </div>
      </section>

      <section className={styles.commandBar} aria-label="Điều khiển tháng">
        <div className={styles.monthControl}>
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước"><ArrowLeft size={17} /></button>
          <label>
            <span>Tháng đăng ký</span>
            <input
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau"><ArrowRight size={17} /></button>
        </div>
        <div className={styles.commandActions}>
          <a
            className={styles.secondaryButton}
            href={`/public/teaching-schedule/${month}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} /> Xem link công khai
          </a>
          <div className={styles.weekSummary}>
            <strong>{monthLabel(month)}</strong>
            <span>{registeredDays}/{monthDates.length} ngày đã có lịch</span>
          </div>
        </div>
      </section>

      <nav className={styles.scheduleTabs} aria-label="Nội dung lịch làm việc">
        <button type="button" data-active={activeTab === 'register'} onClick={() => setActiveTab('register')}>
          <CalendarCheck2 size={17} /> Đăng ký tháng
        </button>
        <button type="button" data-active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
          <UsersRound size={17} /> Bảng toàn team <span>{registeredPeople}</span>
        </button>
        <button type="button" data-active={activeTab === 'rules'} onClick={() => setActiveTab('rules')}>
          <BookOpenCheck size={17} /> Quy định ca làm
        </button>
      </nav>

      {(notice || error) && (
        <div className={error ? styles.errorNotice : styles.successNotice} role="status">
          {error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(''); setNotice('') }} aria-label="Đóng thông báo"><X size={15} /></button>
        </div>
      )}

      {activeTab === 'register' && (
        <>
          <section className={styles.statGrid} aria-label="Tổng quan lịch tháng">
            <article className={styles.statCard}><span>Ngày mẫu đã đặt</span><strong>{templateDays}/7</strong><small>Ngày 01–07 dùng làm tuần mẫu</small></article>
            <article className={styles.statCard}><span>Ngày đã có lịch</span><strong>{registeredDays}</strong><small>Trên tổng {monthDates.length} ngày</small></article>
            <article className={styles.statCard}><span>Ngày tại cơ sở</span><strong>{onsiteDays}</strong><small>Có chọn cơ sở làm việc</small></article>
            <article className={styles.statCard}><span>Nghỉ / phép</span><strong>{restDays}</strong><small>Có thể chỉnh riêng từng ngày</small></article>
          </section>

          <section className={styles.calendarPanel}>
            <div className={styles.calendarHeading}>
              <div>
                <span className={styles.sectionKicker}>LỊCH CỦA TÔI</span>
                <h2>{monthLabel(month)}</h2>
                <p className={styles.calendarHint}>Ngày 01–07 là tuần mẫu: lưu một ngày sẽ áp dụng cho các ngày cùng thứ. Từ ngày 08 trở đi chỉ sửa đúng ngày đã chọn.</p>
              </div>
              <div className={styles.legend} aria-label="Chú thích">
                <span><i data-tone="onsite" /> Tại cơ sở</span>
                <span><i data-tone="remote" /> WFH</span>
                <span><i data-tone="off" /> Nghỉ</span>
              </div>
            </div>
            <div className={styles.templateGuide}>
              <CalendarCheck2 size={17} />
              <span><strong>Cách đăng ký:</strong> điền lần lượt 7 ngày đầu tháng. Lịch sẽ tự phủ xuống các tuần còn lại; sau đó bấm ngày bất kỳ để chỉnh ngoại lệ.</span>
              <em>{templateDays}/7 ngày mẫu</em>
            </div>
            <div className={styles.calendarScroll}>
              <div className={styles.calendarGrid}>
                {WEEKDAYS.map((weekday, index) => (
                  <div key={weekday} className={styles.weekday} data-weekend={index > 4}>{weekday}</div>
                ))}
                {calendarCells.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} className={styles.dayCell} data-outside="true" aria-hidden="true" />
                  const entry = entries[date]
                  const meta = entry ? getTeachingSchedulePattern(entry.pattern) : undefined
                  const centreSummary = entry ? getSessionCentreSummary(entry, centresById) : ''
                  const template = isTemplateDate(date)
                  return (
                    <button
                      key={date}
                      type="button"
                      className={styles.dayCell}
                      data-category={meta?.category || 'empty'}
                      data-today={date === today}
                      data-template={template}
                      onClick={() => openEditor(date)}
                      disabled={saving}
                    >
                      <div className={styles.dayTopline}>
                        <span className={styles.dayNumber}>{parseDateKey(date).getDate()}</span>
                        {template && <span className={styles.templateBadge}>Mẫu tuần</span>}
                        {date === today && <span className={styles.todayBadge}>Hôm nay</span>}
                        {entry?.flexible && <span className={styles.flexBadge}>Linh hoạt</span>}
                      </div>
                      {meta ? (
                        <div className={styles.dayContent}>
                          <span className={styles.patternLabel}>{meta.label}</span>
                          <small className={styles.patternDescription}>{meta.description}</small>
                          {centreSummary && <div className={styles.centreChips}><span><Building2 size={10} /> {centreSummary}</span></div>}
                          {entry.note && <span className={styles.notePreview}>{entry.note}</span>}
                        </div>
                      ) : (
                        <span className={styles.emptyDay}><CalendarCheck2 size={13} /> Đăng ký</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'team' && (
        <section className={styles.teamPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionKicker}>TEAM TEACHING</span>
              <h2>Bảng đăng ký {monthLabel(month)}</h2>
              <p>Lịch Thứ 2–Chủ nhật, được sắp theo TEGL+, TEGL/HO, Leader/TE/TC rồi đến TF.</p>
            </div>
            <label className={styles.teamSearch}>
              <Search size={16} />
              <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Tìm tên nhân sự…" />
            </label>
          </div>
          <div className={styles.teamTableScroll}>
            <table className={styles.teamTable}>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Họ và tên</th>
                  {WEEKDAYS.map((weekday) => <th key={weekday}>{weekday}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredTeam.map((person, index) => (
                  <tr key={`${person.email}-${person.code}-${index}`} data-current={person.email === profile?.email}>
                    <td>{index + 1}</td>
                    <td><span className={styles.memberName}>{person.name}</span></td>
                    {WEEKDAYS.map((weekday, weekdayIndex) => {
                      const entry = findWeekdayEntry(person.entries, weekdayIndex)
                      const meta = entry ? getTeachingSchedulePattern(entry.pattern) : undefined
                      return (
                        <td key={weekday}>
                          {meta ? (
                            <div className={styles.teamScheduleCell} data-category={meta.category} title={entry?.note || meta.description}>
                              <span>{meta.label}</span>
                              {entry && getSessionCentreSummary(entry) && <small>{getSessionCentreSummary(entry)}{entry.flexible ? ' · Linh hoạt' : ''}</small>}
                            </div>
                          ) : <span className={styles.emptyCell}>—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableCaption}>{filteredTeam.length} nhân sự · {registeredPeople} người đã có lịch trong tháng · Tài khoản được đối chiếu theo phân quyền, phần còn lại dùng danh sách bổ sung</div>
        </section>
      )}

      {activeTab === 'rules' && (
        <section className={styles.rulesPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionKicker}>QUY ĐỊNH TEAM TEACHING</span>
              <h2>Thời gian và ngày nghỉ</h2>
              <p>Nội dung được chuẩn hóa từ tab “Thời gian ca làm (final)”.</p>
            </div>
            <div className={styles.rulesStamp}><Clock3 size={18} /> Áp dụng khi đăng ký</div>
          </div>
          <div className={styles.rulesTableScroll}>
            <table className={styles.rulesTable}>
              <thead><tr><th>Vị trí</th><th>Tổng thời gian làm việc</th><th>Thời gian làm việc</th><th>Ngày nghỉ</th></tr></thead>
              <tbody>
                {TEACHING_POSITION_WORK_RULES.map((rule) => (
                  <tr key={rule.position}>
                    <td><strong>{rule.position}</strong></td>
                    <td>{rule.total}</td>
                    <td>{rule.hours.map((line) => <span key={line}>{line}</span>)}</td>
                    <td>{rule.daysOff.length ? rule.daysOff.map((line) => <span key={line}>• {line}</span>) : <span>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.shiftRuleGrid}>
            {TEACHING_SHIFT_RULES.map((rule) => (
              <article key={rule.shift}>
                <span>{rule.shift}</span>
                <strong>{rule.note}</strong>
                <div>{rule.hours.map((line) => <small key={line}>{line}</small>)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {editingDate && draft && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeEditor}>
          <aside className={styles.scheduleModal} role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div><span className={styles.sectionKicker}>{isTemplateDate(editingDate) ? 'NGÀY MẪU ĐẦU THÁNG' : 'CHỈNH NGÀY CỤ THỂ'}</span><h2 id="schedule-editor-title">{formatLongDate(editingDate)}</h2></div>
              <button type="button" onClick={closeEditor} aria-label="Đóng"><X size={19} /></button>
            </header>
            <div className={styles.modalBody}>
              <div className={isTemplateDate(editingDate) ? styles.templateApplyNotice : styles.exceptionNotice}>
                <CalendarCheck2 size={17} />
                <span>{isTemplateDate(editingDate)
                  ? `Lưu ngày mẫu này sẽ áp dụng cho tất cả ${WEEKDAYS[getMondayIndex(editingDate)]} trong ${monthLabel(month)}.`
                  : 'Thay đổi này chỉ áp dụng cho đúng ngày đã chọn và không ảnh hưởng tuần mẫu.'}</span>
              </div>

              <section className={styles.editorSection}>
                <div className={styles.editorLabel}><span>01</span><div><strong>Ca làm / trạng thái</strong><small>Chọn theo quy ước lịch Team Teaching</small></div></div>
                <div className={styles.patternGrid}>
                  {TEACHING_SCHEDULE_PATTERNS.map((pattern) => (
                    <button
                      key={pattern.value}
                      type="button"
                      data-selected={draft.pattern === pattern.value}
                      data-category={pattern.category}
                      onClick={() => {
                        setDraft((current) => current && ({
                          ...current,
                          pattern: pattern.value,
                          centreIds: pattern.category === 'onsite'
                            ? normalizeCentreIdsForPattern(pattern.value, current.centreIds)
                            : [],
                          flexible: pattern.category === 'onsite' ? current.flexible : false,
                        }))
                        setOtherCentreSessionIndex(null)
                        setEditorError('')
                      }}
                    >
                      <span>{pattern.label}</span><small>{pattern.description}</small>
                      {draft.pattern === pattern.value && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </section>

              {isOnsiteTeachingSchedulePattern(draft.pattern) && (
                <section className={styles.editorSection}>
                  <div className={styles.editorLabel}><span>02</span><div><strong>Cơ sở làm việc</strong><small>Chọn nơi bạn sẽ làm việc trong ngày</small></div></div>
                  {allCentres.length > 0 ? (
                    <>
                      <div className={styles.sessionCentreList}>
                        {(getTeachingSchedulePattern(draft.pattern)?.sessions || []).map((sessionName, sessionIndex, sessions) => {
                          const selectedCentreId = draft.centreIds[sessionIndex] || 0
                          const selectedOtherCentre = otherCentres.find((centre) => centre.id === selectedCentreId)
                          const sessionLabel = TEACHING_SCHEDULE_SESSIONS[sessionName].label
                          const otherPanelOpen = otherCentreSessionIndex === sessionIndex
                          return (
                            <div className={styles.sessionCentreRow} key={sessionName} data-active={otherPanelOpen}>
                              <label className={styles.locationSelect}>
                                <span>Cơ sở ca {sessionLabel}</span>
                                <div>
                                  <Building2 size={16} />
                                  <select
                                    value={selectedCentreId ? String(selectedCentreId) : ''}
                                    onChange={(event) => {
                                      if (event.target.value === OTHER_CENTRE_VALUE) {
                                        setOtherCentreSessionIndex(sessionIndex)
                                        setCentreSearch('')
                                      } else {
                                        const id = Number(event.target.value)
                                        setDraft((current) => current && ({
                                          ...current,
                                          centreIds: updateSessionCentre(
                                            current.centreIds,
                                            sessionIndex,
                                            Number.isInteger(id) && id > 0 ? id : 0,
                                            sessions.length,
                                          ),
                                        }))
                                        if (otherPanelOpen) setOtherCentreSessionIndex(null)
                                      }
                                      setEditorError('')
                                    }}
                                  >
                                    <option value="">Chọn cơ sở cho ca {sessionLabel.toLowerCase()}…</option>
                                    {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.shortCode} · {centre.name}</option>)}
                                    {selectedOtherCentre && <option value={selectedOtherCentre.id}>{selectedOtherCentre.shortCode} · {selectedOtherCentre.name}</option>}
                                    {otherCentres.length > 0 && <option value={OTHER_CENTRE_VALUE}>Khác…</option>}
                                  </select>
                                </div>
                              </label>
                              {otherPanelOpen && (
                                <div className={styles.otherCentrePanel}>
                                  <div><strong>Chọn cơ sở khác cho ca {sessionLabel}</strong><small>Tìm trong các cơ sở còn lại ngoài khu vực quản lý</small></div>
                                  <label className={styles.searchBox}><Search size={16} /><input value={centreSearch} onChange={(event) => setCentreSearch(event.target.value)} placeholder="Tìm tên, mã hoặc khu vực…" autoFocus /></label>
                                  <div className={styles.centreList}>
                                    {Object.keys(groupedOtherCentres).length ? Object.entries(groupedOtherCentres).map(([region, regionCentres]) => (
                                      <div key={region} className={styles.centreGroup}>
                                        <span>{region}</span>
                                        <div>{regionCentres.map((centre) => {
                                          const selected = selectedCentreId === centre.id
                                          return (
                                            <button
                                              key={centre.id}
                                              type="button"
                                              data-selected={selected}
                                              onClick={() => {
                                                setDraft((current) => current && ({
                                                  ...current,
                                                  centreIds: updateSessionCentre(
                                                    current.centreIds,
                                                    sessionIndex,
                                                    centre.id,
                                                    sessions.length,
                                                  ),
                                                }))
                                                setEditorError('')
                                              }}
                                            >
                                              <i>{selected && <Check size={12} />}</i><span>{centre.shortCode}</span><small>{centre.name}</small>
                                            </button>
                                          )
                                        })}</div>
                                      </div>
                                    )) : <p className={styles.noCentreResult}>Không tìm thấy cơ sở phù hợp.</p>}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {centres.length > 0 && <div className={styles.managedHint}><MapPin size={14} /><span>{profile?.area ? `Khu vực quản lý: ${profile.area}` : `${centres.length} cơ sở được phân công`}</span></div>}
                      <label className={styles.flexToggle}>
                        <input type="checkbox" checked={draft.flexible} onChange={(event) => setDraft((current) => current && ({ ...current, flexible: event.target.checked }))} />
                        <span><i><Check size={12} /></i></span>
                        <div><strong>Linh hoạt trong khu vực</strong><small>Có thể hỗ trợ cơ sở khác khi cần điều phối</small></div>
                      </label>
                    </>
                  ) : <div className={styles.inlineWarning}><AlertCircle size={17} /> Hệ thống chưa có danh sách cơ sở hoạt động.</div>}
                </section>
              )}

              <section className={styles.editorSection}>
                <div className={styles.editorLabel}><span>03</span><div><strong>Ghi chú</strong><small>Thông tin cần thiết cho điều phối</small></div></div>
                <textarea className={styles.noteInput} value={draft.note} maxLength={500} onChange={(event) => setDraft((current) => current && ({ ...current, note: event.target.value }))} placeholder="Ví dụ: Hỗ trợ sự kiện tại cơ sở…" />
              </section>
              {editorError && <div className={styles.inlineError}><AlertCircle size={15} /> {editorError}</div>}
            </div>
            <footer className={styles.modalFooter}>
              <button type="button" className={styles.dangerButton} onClick={() => void clearDraftDay()} disabled={saving}>{isTemplateDate(editingDate) ? 'Xóa mẫu thứ này' : 'Xóa lịch ngày'}</button>
              <div><button type="button" className={styles.secondaryButton} onClick={closeEditor}>Hủy</button><button type="button" className={styles.primaryButton} onClick={() => void commitDraft()} disabled={saving}>{saving ? <LoaderCircle className={styles.spinner} size={16} /> : <Check size={16} />} {isTemplateDate(editingDate) ? 'Áp dụng cả tháng' : 'Lưu ngày này'}</button></div>
            </footer>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
