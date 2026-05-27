'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'
import {
  BarChart2,
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
  full_name: string
  email: string
  status: string
  sessions: Array<{
    session_id: number
    session_number: number
    attendance: boolean | null
    score: number | null
  }>
  attendance_score: number
  avg_test_score: number | null
}

// Draft: candidate_id → session_id → { attendance, score }
type SessionDraft = { attendance: boolean; score: string }
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
function scoreClass(score: string): string {
  if (!score) return 'border-gray-200 bg-gray-50 text-gray-400'
  const n = Number(score)
  if (n >= 8) return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (n >= 6) return 'border-amber-300 bg-amber-50 text-amber-700'
  return 'border-red-300 bg-red-50 text-red-700'
}

function attendanceBadgeClass(count: number, total: number) {
  if (count === 0) return 'bg-gray-100 text-gray-400 border-gray-200'
  if (count < total) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function initDraft(): SessionDraft {
  return { attendance: false, score: '' }
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

  // Draft state: candidate_id → session_id → { attendance, score }
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [originalData, setOriginalData] = useState<DraftMap>({})
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  const [candidateSearch, setCandidateSearch] = useState('')

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
            score: record?.score != null ? String(record.score) : '',
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
    field: 'attendance' | 'score',
    value: boolean | string,
  ) => {
    const currentDraft = { ...(drafts[candidateId] ?? {}) }
    const currentSession = { ...(currentDraft[sessionId] ?? initDraft()) }
    if (field === 'attendance') currentSession.attendance = value as boolean
    else currentSession.score = value as string
    currentDraft[sessionId] = currentSession

    // Dirty check
    const original = originalData[candidateId] ?? {}
    let isDifferent = false
    for (const s of sessions) {
      const d = currentDraft[s.id] || initDraft()
      const o = original[s.id] || initDraft()
      if (d.attendance !== o.attendance || d.score !== o.score) {
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
      const records: Array<{ candidate_id: number; session_id: number; attendance: boolean; score: number | null }> = []
      for (const candidateId of dirtyIds) {
        const draft = drafts[candidateId]
        if (!draft) continue
        for (const s of sessions) {
          const d = draft[s.id] ?? initDraft()
          records.push({
            candidate_id: candidateId,
            session_id: s.id,
            attendance: d.attendance,
            score: d.score === '' ? null : Number(d.score),
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

      // Reload để cập nhật attendance_score, avg_test_score
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
    if (candidates.length === 0 || sessions.length === 0) return { avgAttendance: 0, avgScore: null }
    let totalAttended = 0
    let scoreSum = 0
    let scoredCount = 0
    for (const c of candidates) {
      const draft = drafts[c.candidate_id]
      if (!draft) continue
      for (const s of sessions) {
        if (draft[s.id]?.attendance) totalAttended++
        const sc = draft[s.id]?.score
        if (sc && sc !== '') { scoreSum += Number(sc); scoredCount++ }
      }
    }
    return {
      avgAttendance: totalAttended / (candidates.length * sessions.length),
      avgScore: scoredCount > 0 ? scoreSum / scoredCount : null,
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
                  {candidates.length > 0 && sessions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <CheckSquare2 className="h-3 w-3" />
                        Điểm danh: {Math.round(stats.avgAttendance * 100)}%
                      </span>
                      {stats.avgScore !== null && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          <BarChart2 className="h-3 w-3" />
                          Điểm TB: {stats.avgScore.toFixed(1)}
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
              {sessions.length === 0 && !loading ? (
                <div className="py-16 text-center text-gray-500">
                  <p className="font-medium">Chưa có buổi training nào được thiết lập cho GEN này.</p>
                  <p className="text-sm mt-1 text-gray-400">Vào tab "Đào tạo đầu vào" để tạo buổi training.</p>
                </div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[210px] border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        Ứng viên
                      </th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[75px] text-center">
                        Đ.danh
                      </th>
                      {sessions.map(s => (
                        <th key={s.id} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[140px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[#a1001f]">Buổi {s.session_number}</span>
                            <span className="text-[10px] normal-case font-normal text-gray-400 truncate max-w-[120px]">{s.title}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[80px] text-center">Điểm TB</th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[90px] text-center">Chuyên cần</th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[90px] text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={sessions.length + 5} className="py-20 text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-5 w-5 animate-spin text-[#a1001f]" />
                            Đang tải dữ liệu từ database...
                          </div>
                        </td>
                      </tr>
                    ) : filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={sessions.length + 5} className="py-20 text-center">
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

                      const attendCount = sessions.filter(s => draft[s.id]?.attendance).length
                      const scores = sessions.map(s => draft[s.id]?.score).filter(sc => sc !== undefined && sc !== '')
                      const avgScore = scores.length > 0
                        ? scores.reduce((sum, sc) => sum + Number(sc), 0) / scores.length
                        : null

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
                            <p className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[185px]">{candidate.full_name}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[185px] mt-0.5">{candidate.email}</p>
                          </td>

                          {/* Attendance summary */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${attendanceBadgeClass(attendCount, sessions.length)}`}>
                              {attendCount}/{sessions.length}
                            </span>
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
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={d.score}
                                    placeholder="Điểm (0–10)"
                                    onChange={e => handleChange(candidate.candidate_id, session.id, 'score', e.target.value)}
                                    className={`w-full rounded-lg border px-2 py-1 text-xs font-bold outline-none transition-all focus:ring-2 ${scoreClass(d.score)} focus:ring-blue-100`}
                                  />
                                </div>
                              </td>
                            )
                          })}

                          {/* Avg score */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            {avgScore !== null ? (
                              <span className={`text-sm font-extrabold ${avgScore >= 8 ? 'text-emerald-700' : avgScore >= 6 ? 'text-amber-600' : 'text-red-600'}`}>
                                {avgScore.toFixed(1)}
                              </span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>

                          {/* Attendance score */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span className="text-sm font-bold text-gray-700">{candidate.attendance_score.toFixed(2)}</span>
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

