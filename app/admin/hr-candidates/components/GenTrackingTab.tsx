'use client'
import { useQueryState } from '@/lib/use-query-state'


import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'
import {
  INPUT_ASSESSMENT_CRITERIA,
  INPUT_ASSESSMENT_PROFILES,
  type AssessmentCriterion,
  type AssessmentProfile,
  getAssessmentProfile,
  normalizeAssessmentProfileId,
} from '@/lib/hr-input-assessment'
import {
  CheckSquare2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Users,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
type GenEntry = {
  key: string
  genCode: string
  count: number
  regionCode: string
  regionLabel: string
  isTeacher4Plus: boolean
  note: string
}

interface TrainingSession {
  id: number
  session_number: number
  title: string
  session_date: string | null
}

interface DbCandidate {
  candidate_id: number
  candidate_code: string | null
  full_name: string
  email: string
  phone: string | null
  desired_campus: string | null
  work_block: string | null
  facebook_url: string | null
  status: string
  assessments?: Array<{
    assessment_type: string
    total_score: number | null
    is_passed: boolean | null
    criteria_scores?: Record<string, number>
    created_at: string
  }>
  sessions: Array<{
    session_id: number
    session_number: number
    attendance: boolean | null
    score: number | null
    absence_note?: string | null
  }>
  attendance_score: number
  avg_test_score: number | null
}

// Draft: candidate_id → session_id → { attendance, absence note }
type SessionDraft = { attendance: boolean; absenceNote: string }
type CandidateDraft = Record<number, SessionDraft>
type DraftMap = Record<number, CandidateDraft>

interface GenTrackingTabProps {
  genEntries: GenEntry[]
  regionFilter: 'all' | 'south' | 'north'
  activeGenKey: string
  activeGenInfo: { genCode: string; regionCode: string } | null
  onSelectGen: (entry: GenEntry) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function attendanceBadgeClass(count: number, total: number) {
  if (count === 0) return 'bg-gray-100 text-gray-400 border-gray-200'
  if (count < total) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function attendanceScoreClass(score: number, total: number) {
  if (total === 0 || score === 0) return 'text-gray-400'
  if (score < 10) return 'text-amber-600'
  return 'text-emerald-700'
}

function initDraft(): SessionDraft {
  return { attendance: false, absenceNote: '' }
}

function assessmentLabel(type: string) {
  if (type === 'technical_test') return 'Kỹ thuật'
  if (type === 'pedagogical_review') return 'Sư phạm'
  return getAssessmentProfile(normalizeAssessmentProfileId(type)).label || type
}

function latestAssessment(candidate: DbCandidate) {
  const assessments = candidate.assessments || []
  if (assessments.length === 0) return null
  return assessments
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(1)
}

function criteriaScore(candidate: DbCandidate, key: string) {
  const assessment = latestAssessment(candidate)
  const value = assessment?.criteria_scores?.[key]
  return value == null ? null : Number(value)
}

const BASE_ASSESSMENT_KEYS = new Set(['attendance', 'lesson_1', 'lesson_2', 'lesson_3'])
const INPUT_ASSESSMENT_STORAGE_KEY = 'hr-input-assessment-rubric-v2'

function weightEntries(criterion: AssessmentCriterion, profiles: AssessmentProfile[]) {
  return profiles
    .map((profile) => ({
      profileId: profile.id,
      label: profile.label,
      weight: Number(criterion.weights[profile.id]) || 0,
    }))
    .filter((entry) => entry.weight > 0)
}

function WeightBadges({
  criterion,
  profiles,
}: {
  criterion: AssessmentCriterion | undefined
  profiles: AssessmentProfile[]
}) {
  if (!criterion) return null
  const entries = weightEntries(criterion, profiles)
  if (entries.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1 normal-case tracking-normal">
      {entries.map((entry) => (
        <span
          key={entry.profileId}
          className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black leading-none text-emerald-700"
          title={`Tỷ trọng ${entry.label}: ${entry.weight}%`}
        >
          {entries.length === 1 ? `${entry.weight}%` : `${entry.label} ${entry.weight}%`}
        </span>
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GenTrackingTab({
  genEntries,
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen,
}: GenTrackingTabProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [candidates, setCandidates] = useState<DbCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [currentGenId, setCurrentGenId] = useState<number | null>(null)

  // Draft state: candidate_id → session_id → { attendance, absence note }
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [originalData, setOriginalData] = useState<DraftMap>({})
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [assessmentCriteria, setAssessmentCriteria] = useState<AssessmentCriterion[]>(INPUT_ASSESSMENT_CRITERIA)
  const [assessmentProfiles, setAssessmentProfiles] = useState<AssessmentProfile[]>(INPUT_ASSESSMENT_PROFILES)

  const [candidateSearch, setCandidateSearch] = useQueryState<string>('candidateSearch', '')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INPUT_ASSESSMENT_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.criteria)) setAssessmentCriteria(parsed.criteria)
      if (Array.isArray(parsed.profiles)) setAssessmentProfiles(parsed.profiles)
    } catch {
      setAssessmentCriteria(INPUT_ASSESSMENT_CRITERIA)
      setAssessmentProfiles(INPUT_ASSESSMENT_PROFILES)
    }
  }, [])

  const campusCriteria = useMemo(
    () => assessmentCriteria.filter((criterion) => !BASE_ASSESSMENT_KEYS.has(criterion.key)),
    [assessmentCriteria],
  )

  const attendanceCriterion = useMemo(
    () => assessmentCriteria.find((criterion) => criterion.key === 'attendance'),
    [assessmentCriteria],
  )

  // Reset khi đổi region
  useEffect(() => {
    setCandidates([])
    setSessions([])
    setDrafts({})
    setOriginalData({})
    setDirtyIds(new Set())
    setCurrentGenId(null)
  }, [regionFilter])

  // Fetch dữ liệu từ DB khi chọn GEN
  const fetchData = useCallback(async (genCode: string) => {
    setLoading(true)
    setDrafts({})
    setDirtyIds(new Set())

    try {
      // 1. Lookup gen_id từ catalog
      const catalogRes = await fetch('/api/hr/gens')
      const catalogData = await catalogRes.json()
      const catalog: Array<{ id: number; gen_name: string }> = catalogData.catalog || []
      const genEntry = catalog.find(g => g.gen_name === genCode)

      if (!genEntry) {
        setSessions([])
        setCandidates([])
        setLoading(false)
        return
      }

      setCurrentGenId(genEntry.id)

      // 2. Fetch records + candidateSummaries từ API onboarding
      const res = await fetch(`/api/hr/onboarding/records?gen_id=${genEntry.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không thể tải dữ liệu.')

      const fetchedSessions: TrainingSession[] = data.sessions || []
      const fetchedCandidates: DbCandidate[] = data.candidateSummaries || []

      setSessions(fetchedSessions)
      setCandidates(fetchedCandidates)

      // 3. Khởi tạo draft từ dữ liệu DB
      const initialDrafts: DraftMap = {}
      for (const c of fetchedCandidates) {
        initialDrafts[c.candidate_id] = {}
        for (const s of fetchedSessions) {
          const record = c.sessions.find(r => r.session_id === s.id)
          initialDrafts[c.candidate_id][s.id] = {
            attendance: record?.attendance ?? false,
            absenceNote: record?.absence_note || '',
          }
        }
      }
      setDrafts(initialDrafts)
      setOriginalData(JSON.parse(JSON.stringify(initialDrafts)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeGenInfo) {
      fetchData(activeGenInfo.genCode)
    }
  }, [activeGenInfo, fetchData])

  // Xử lý thay đổi ô
  const handleChange = (
    candidateId: number,
    sessionId: number,
    field: 'attendance' | 'absenceNote',
    value: boolean | string,
  ) => {
    const currentDraft = { ...(drafts[candidateId] ?? {}) }
    const currentSession = { ...(currentDraft[sessionId] ?? initDraft()) }
    if (field === 'attendance') {
      currentSession.attendance = value as boolean
      if (value === true) currentSession.absenceNote = ''
    } else {
      currentSession.absenceNote = value as string
    }
    currentDraft[sessionId] = currentSession

    // Dirty check
    const original = originalData[candidateId] ?? {}
    let isDifferent = false
    for (const s of sessions) {
      const d = currentDraft[s.id] || initDraft()
      const o = original[s.id] || initDraft()
      if (d.attendance !== o.attendance || d.absenceNote !== o.absenceNote) {
        isDifferent = true
        break
      }
    }

    setDrafts(prev => ({ ...prev, [candidateId]: currentDraft }))
    setDirtyIds(prev => {
      const next = new Set(prev)
      if (isDifferent) next.add(candidateId)
      else next.delete(candidateId)
      return next
    })
  }

  // Lưu batch
  const handleSave = async () => {
    if (dirtyIds.size === 0) return
    setSaving(true)
    try {
      const records: Array<{
        candidate_id: number
        session_id: number
        attendance: boolean
        score: number | null
        absence_note: string | null
      }> = []
      for (const candidateId of dirtyIds) {
        const draft = drafts[candidateId]
        if (!draft) continue
        for (const s of sessions) {
          const d = draft[s.id] ?? initDraft()
          records.push({
            candidate_id: candidateId,
            session_id: s.id,
            attendance: d.attendance,
            score: null,
            absence_note: d.attendance ? null : d.absenceNote.trim() || null,
          })
        }
      }

      const res = await fetch('/api/hr/onboarding/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.')

      toast.success(`Đã lưu ${dirtyIds.size} ứng viên thành công.`)

      // Cập nhật original
      setOriginalData(prev => {
        const next = { ...prev }
        for (const id of dirtyIds) {
          if (drafts[id]) next[id] = JSON.parse(JSON.stringify(drafts[id]))
        }
        return next
      })
      setDirtyIds(new Set())

      // Reload để cập nhật attendance_score
      if (activeGenInfo) await fetchData(activeGenInfo.genCode)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  // Filter tìm kiếm
  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(c =>
      [c.full_name, c.email].join(' ').toLowerCase().includes(q)
    )
  }, [candidates, candidateSearch])

  // Stats header
  const stats = useMemo(() => {
    if (candidates.length === 0 || sessions.length === 0) return { avgAttendance: 0 }
    let totalAttended = 0
    for (const c of candidates) {
      const draft = drafts[c.candidate_id]
      if (!draft) continue
      for (const s of sessions) {
        if (draft[s.id]?.attendance) totalAttended++
      }
    }
    return {
      avgAttendance: totalAttended / (candidates.length * sessions.length),
    }
  }, [candidates, sessions, drafts])

  return (
    <div className="w-full">
      <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {!activeGenKey ? (
          <div className="flex flex-1 min-h-[480px] flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
              <Users className="h-10 w-10 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-600">Chọn một GEN để bắt đầu</p>
              <p className="mt-1 text-xs text-gray-400">Nhấn vào một mã GEN bên trái để xem danh sách ứng viên</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-gray-900">{activeGenInfo?.genCode}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {filteredCandidates.length} ứng viên • {sessions.length} buổi học
                    </p>
                  </div>
                  {candidates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {sessions.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckSquare2 className="h-3 w-3" />
                          Điểm danh: {Math.round(stats.avgAttendance * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      value={candidateSearch}
                      onChange={e => setCandidateSearch(e.target.value)}
                      placeholder="Tìm ứng viên..."
                      className="rounded-xl border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 w-44"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => activeGenInfo && fetchData(activeGenInfo.genCode)}
                    disabled={loading || !activeGenInfo}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#f3b4bd] bg-white text-[#a1001f] hover:bg-[#a1001f]/5 disabled:opacity-50 transition-colors"
                    title="Làm mới"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || dirtyIds.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white hover:bg-[#880019] disabled:opacity-40 transition-all"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {dirtyIds.size > 0 ? `Lưu (${dirtyIds.size})` : 'Lưu'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              {candidates.length === 0 && !loading ? (
                <div className="py-16 text-center text-gray-500">
                  <p className="font-medium">Không có ứng viên nào trong GEN này.</p>
                  <p className="text-sm mt-1 text-gray-400">Gán ứng viên vào GEN để hiển thị bảng điểm.</p>
                </div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[240px] border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        Ứng viên
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[130px]">
                        Cơ sở
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[100px]">
                        Khối
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[75px] text-center">
                        Đ.danh
                      </th>
                      {sessions.map(s => (
                        <th key={s.id} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[145px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[#a1001f]">Lesson {s.session_number}</span>
                            <span className="text-[10px] normal-case font-normal text-gray-400 truncate max-w-[120px]">{s.title}</span>
                          </div>
                        </th>
                      ))}
                      {campusCriteria.map((criterion) => (
                        <th key={criterion.key} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[130px] text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{criterion.label}</span>
                            <WeightBadges criterion={criterion} profiles={assessmentProfiles} />
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[140px] text-center">
                        Kết quả đánh giá
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[90px] text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>Chuyên cần</span>
                          <WeightBadges criterion={attendanceCriterion} profiles={assessmentProfiles} />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[90px] text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={sessions.length + campusCriteria.length + 7} className="py-20 text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-5 w-5 animate-spin text-[#a1001f]" />
                            Đang tải dữ liệu từ database...
                          </div>
                        </td>
                      </tr>
                    ) : filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={sessions.length + campusCriteria.length + 7} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Users className="h-8 w-8 opacity-40" />
                            <p className="text-sm font-medium">Không có ứng viên nào trong GEN này.</p>
                            <p className="text-xs">Thêm ứng viên qua tab "Đào tạo đầu vào".</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredCandidates.map(candidate => {
                      const isDirty = dirtyIds.has(candidate.candidate_id)
                      const draft = drafts[candidate.candidate_id] ?? {}
                      const assessment = latestAssessment(candidate)

                      const attendCount = sessions.filter(s => draft[s.id]?.attendance).length
                      const liveAttendanceScore = sessions.length > 0
                        ? Math.round((attendCount / sessions.length) * 10 * 100) / 100
                        : 0

                      return (
                        <tr
                          key={candidate.candidate_id}
                          className={`relative group transition-colors ${isDirty ? 'bg-amber-50/60' : 'hover:bg-gray-50/60'}`}
                        >
                          {/* Candidate info */}
                          <td className={`sticky left-0 z-20 px-4 py-2.5 align-middle border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] transition-colors ${
                            isDirty ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7]' : 'bg-white group-hover:bg-gray-50'
                          }`}>
                            {isDirty && <div className="absolute left-0 top-0 h-full w-1 bg-amber-400" aria-hidden />}
                            <p className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[210px]">{candidate.full_name}</p>
                            <p className="mt-0.5 text-xs font-bold text-[#a1001f]">
                              {candidate.candidate_code ? `Mã UV: ${candidate.candidate_code}` : 'Chưa có mã UV'}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[210px] mt-0.5">{candidate.email}</p>
                          </td>

                          <td className="px-3 py-2.5 align-middle">
                            <p className="max-w-[130px] truncate text-xs font-bold text-gray-700">
                              {candidate.desired_campus || 'Chưa có cơ sở'}
                            </p>
                          </td>

                          <td className="px-3 py-2.5 align-middle">
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-700">
                              {candidate.work_block || 'Chưa rõ'}
                            </span>
                          </td>

                          <td className="px-3 py-2.5 align-middle text-center">
                            {sessions.length > 0 ? (
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${attendanceBadgeClass(attendCount, sessions.length)}`}>
                                {attendCount}/{sessions.length}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-gray-400">Chưa có buổi</span>
                            )}
                          </td>

                          {/* Session columns */}
                          {sessions.map(session => {
                            const d = draft[session.id] ?? initDraft()
                            return (
                              <td key={session.id} className={`px-3 py-2 align-middle border-r border-gray-100 transition-colors ${d.attendance ? 'bg-amber-50' : ''}`}>
                                <div className="flex flex-col gap-1.5">
                                  <label className="flex cursor-pointer select-none items-center gap-2 group">
                                    <div className="relative shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={d.attendance}
                                        onChange={e => handleChange(candidate.candidate_id, session.id, 'attendance', e.target.checked)}
                                        className="sr-only"
                                      />
                                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                                        d.attendance
                                          ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200'
                                          : 'bg-white border-gray-300 group-hover:border-emerald-400'
                                      }`}>
                                        {d.attendance && (
                                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`text-xs font-semibold transition-colors ${d.attendance ? 'text-emerald-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                      {d.attendance ? 'Có mặt' : 'Vắng'}
                                    </span>
                                  </label>
                                  <input
                                    type="text"
                                    value={d.absenceNote}
                                    placeholder={d.attendance ? 'Đã có mặt' : 'Lý do vắng'}
                                    disabled={d.attendance}
                                    onChange={e => handleChange(candidate.candidate_id, session.id, 'absenceNote', e.target.value)}
                                    className={`w-full rounded-lg border px-2 py-1 text-xs font-semibold outline-none transition-all focus:ring-2 ${
                                      d.attendance
                                        ? 'border-emerald-100 bg-emerald-50/60 text-emerald-700 placeholder:text-emerald-600/70'
                                        : d.absenceNote.trim()
                                          ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-100'
                                          : 'border-gray-200 bg-gray-50 text-gray-500 focus:border-amber-300 focus:ring-amber-100'
                                    }`}
                                  />
                                </div>
                              </td>
                            )
                          })}

                          {campusCriteria.map((criterion) => (
                            <td key={criterion.key} className="px-3 py-2.5 align-middle text-center">
                              <span className="text-sm font-extrabold text-gray-800">
                                {formatScore(criteriaScore(candidate, criterion.key))}
                              </span>
                            </td>
                          ))}

                          <td className="px-3 py-2.5 align-middle text-center">
                            {assessment?.total_score != null ? (
                              <div className="space-y-1">
                                <p className={`text-sm font-extrabold ${assessment.total_score >= 3.5 ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {assessment.total_score.toFixed(2)}
                                </p>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                                  assessment.is_passed
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {assessment.is_passed ? 'Đạt' : 'Không đạt'}
                                </span>
                                <p className="text-[10px] font-bold text-gray-400">
                                  {assessmentLabel(assessment.assessment_type)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Chưa chấm</span>
                            )}
                          </td>

                          {/* Attendance score */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span className={`text-sm font-bold ${attendanceScoreClass(liveAttendanceScore, sessions.length)}`}>
                              {liveAttendanceScore.toFixed(2)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              candidate.status === 'passed' ? 'bg-green-100 text-green-800' :
                              candidate.status === 'failed' ? 'bg-red-100 text-red-800' :
                              candidate.status === 'dropped' ? 'bg-gray-100 text-gray-600' :
                              candidate.status === 'in_training' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {candidate.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

