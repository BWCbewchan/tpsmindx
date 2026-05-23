'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/lib/app-toast'
import { Check, X, Save, UserCheck, UserX, UserMinus, Plus, Calendar, Loader2, Users } from 'lucide-react'
import { GenEntry } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrainingSession {
  id: number
  session_number: number
  title: string
  session_date: string | null
  video_id: number | null
  video_title: string | null
}

interface CandidateSummary {
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

interface RecordEdit {
  candidate_id: number
  session_id: number
  attendance: boolean
  score: number | null
}

interface SessionForm {
  session_number: number
  title: string
  session_date: string
  video_id: string
}

interface GenOnboardingTabProps {
  genEntries: GenEntry[]
  regionFilter: 'all' | 'south' | 'north'
  activeGenKey: string
  activeGenInfo: { genCode: string; regionCode: string } | null
  onSelectGen: (entry: GenEntry) => void
}

export default function GenOnboardingTab({
  genEntries,
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen,
}: GenOnboardingTabProps) {
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [candidates, setCandidates] = useState<CandidateSummary[]>([])
  const [edits, setEdits] = useState<Map<string, RecordEdit>>(new Map())
  const [saving, setSaving] = useState(false)
  const [currentGenId, setCurrentGenId] = useState<number | null>(null)

  // Session form state
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState<SessionForm>({ session_number: 1, title: '', session_date: '', video_id: '' })
  const [savingSession, setSavingSession] = useState(false)

  // Fetch data when GEN selected
  const fetchData = useCallback(async (genCode: string) => {
    setLoading(true)
    try {
      // Lookup gen_id từ catalog bằng gen_name
      const catalogRes = await fetch('/api/hr/gens')
      const catalogData = await catalogRes.json()
      const catalog: Array<{ id: number; gen_name: string }> = catalogData.catalog || []
      const genEntry = catalog.find(g => g.gen_name === genCode)

      if (!genEntry) {
        setSessions([])
        setCandidates([])
        setEdits(new Map())
        setLoading(false)
        return
      }

      const response = await fetch(`/api/hr/onboarding/records?gen_id=${genEntry.id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu.')
      setSessions(data.sessions || [])
      setCandidates(data.candidateSummaries || [])
      setEdits(new Map())
      // Store gen_id for session creation
      setCurrentGenId(genEntry.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeGenInfo) {
      fetchData(activeGenInfo.genCode)
    }
  }, [activeGenInfo, fetchData])

  const handleToggleAttendance = (candidate_id: number, session_id: number, current: boolean | null) => {
    const key = `${candidate_id}-${session_id}`
    const existing = edits.get(key)
    const newAttendance = current === null ? true : !current
    setEdits(new Map(edits.set(key, {
      candidate_id,
      session_id,
      attendance: newAttendance,
      score: existing?.score ?? null,
    })))
  }

  const handleScoreChange = (candidate_id: number, session_id: number, value: string) => {
    const key = `${candidate_id}-${session_id}`
    const existing = edits.get(key)
    const parsed = value === '' ? null : parseFloat(value)
    setEdits(new Map(edits.set(key, {
      candidate_id,
      session_id,
      attendance: existing?.attendance ?? false,
      score: parsed,
    })))
  }

  const handleSave = async () => {
    if (edits.size === 0) {
      toast.error('Không có thay đổi nào để lưu.')
      return
    }
    setSaving(true)
    try {
      const records = Array.from(edits.values())
      const response = await fetch('/api/hr/onboarding/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể lưu.')
      toast.success(`Đã lưu ${data.upserted} bản ghi.`)
      setEdits(new Map())
      if (activeGenInfo) await fetchData(activeGenInfo.genCode)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  const handlePromote = async (candidate_id: number, status: 'passed' | 'failed' | 'dropped') => {
    if (!confirm(`Xác nhận đổi trạng thái ứng viên sang "${status}"?`)) return
    try {
      const response = await fetch('/api/hr/onboarding/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id, status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể đổi trạng thái.')
      toast.success(`Đã đổi trạng thái thành "${status}".`)
      if (status === 'passed' && data.teacherInserted) toast.success('Đã thêm vào bảng teachers.')
      if (activeGenInfo) await fetchData(activeGenInfo.genCode)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    }
  }

  const handleCreateSession = async () => {
    if (!sessionForm.title.trim() || !currentGenId) {
      toast.error('Tiêu đề buổi training là bắt buộc.')
      return
    }
    setSavingSession(true)
    try {
      const response = await fetch('/api/hr/onboarding/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gen_id: currentGenId,
          session_number: sessionForm.session_number,
          title: sessionForm.title,
          session_date: sessionForm.session_date || null,
          video_id: sessionForm.video_id ? parseInt(sessionForm.video_id) : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tạo buổi training.')
      toast.success(`Đã tạo buổi ${sessionForm.session_number}.`)
      setShowSessionForm(false)
      setSessionForm({ session_number: 1, title: '', session_date: '', video_id: '' })
      if (activeGenInfo) await fetchData(activeGenInfo.genCode)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setSavingSession(false)
    }
  }

  const getAttendanceValue = (c: CandidateSummary, s: TrainingSession): boolean | null => {
    const key = `${c.candidate_id}-${s.id}`
    if (edits.has(key)) return edits.get(key)!.attendance
    const session = c.sessions.find(sess => sess.session_id === s.id)
    return session?.attendance ?? null
  }

  const getScoreValue = (c: CandidateSummary, s: TrainingSession): number | null => {
    const key = `${c.candidate_id}-${s.id}`
    if (edits.has(key)) return edits.get(key)!.score ?? null
    const session = c.sessions.find(sess => sess.session_id === s.id)
    return session?.score ?? null
  }

  const usedSessionNumbers = sessions.map(s => s.session_number)
  const availableSessionNumbers = [1, 2, 3, 4].filter(n => !usedSessionNumbers.includes(n))

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
              <p className="mt-1 text-xs text-gray-400">Nhấn vào một mã GEN bên trái để xem đào tạo đầu vào</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-blue-100">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">{activeGenInfo?.genCode}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{candidates.length} ứng viên • {sessions.length} buổi</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {availableSessionNumbers.length > 0 && (
                    <button
                      onClick={() => {
                        setSessionForm(f => ({ ...f, session_number: availableSessionNumbers[0] }))
                        setShowSessionForm(true)
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" /> Thêm buổi
                    </button>
                  )}
                  {edits.size > 0 && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#a1001f] text-white rounded-xl font-medium hover:bg-[#880019] disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Đang lưu...' : `Lưu (${edits.size})`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Session Form */}
            {showSessionForm && (
              <div className="bg-blue-50 border-b border-blue-200 p-5 space-y-4">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Tạo buổi training mới
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Buổi số</label>
                    <select
                      value={sessionForm.session_number}
                      onChange={e => setSessionForm(f => ({ ...f, session_number: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {availableSessionNumbers.map(n => (
                        <option key={n} value={n}>Buổi {n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tiêu đề *</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="VD: Buổi 1 - Giới thiệu"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ngày training</label>
                    <input
                      type="date"
                      value={sessionForm.session_date}
                      onChange={e => setSessionForm(f => ({ ...f, session_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Video ID</label>
                    <input
                      type="number"
                      value={sessionForm.video_id}
                      onChange={e => setSessionForm(f => ({ ...f, video_id: e.target.value }))}
                      placeholder="ID video"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCreateSession}
                    disabled={savingSession}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingSession ? 'Đang tạo...' : 'Tạo buổi training'}
                  </button>
                  <button
                    onClick={() => setShowSessionForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              {loading ? (
                <div className="py-20 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#a1001f] mx-auto" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium">Chưa có buổi training nào.</p>
                  <p className="text-sm mt-1">Nhấn "Thêm buổi" để bắt đầu.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 min-w-[200px] border-r border-gray-200">Ứng viên</th>
                      {sessions.map(s => (
                        <th key={s.id} className="px-3 py-3 text-center text-xs font-bold uppercase text-gray-500" colSpan={2}>
                          Buổi {s.session_number}
                          <div className="text-[10px] font-normal text-gray-400 mt-0.5">{s.title}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-bold uppercase text-gray-500">Chuyên cần</th>
                      <th className="px-3 py-3 text-center text-xs font-bold uppercase text-gray-500">Điểm TB</th>
                      <th className="px-3 py-3 text-center text-xs font-bold uppercase text-gray-500">Trạng thái</th>
                      <th className="px-3 py-3 text-center text-xs font-bold uppercase text-gray-500">Hành động</th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2"></th>
                      {sessions.map(s => (
                        <>
                          <th key={`${s.id}-att`} className="px-2 py-2 text-center text-[10px] text-gray-400 uppercase">Điểm danh</th>
                          <th key={`${s.id}-score`} className="px-2 py-2 text-center text-[10px] text-gray-400 uppercase">Điểm</th>
                        </>
                      ))}
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {candidates.length === 0 ? (
                      <tr>
                        <td colSpan={4 + sessions.length * 2} className="px-4 py-8 text-center text-gray-500">
                          Chưa có ứng viên nào trong GEN này.
                        </td>
                      </tr>
                    ) : candidates.map(c => (
                      <tr key={c.candidate_id} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-20 bg-white px-4 py-3 border-r border-gray-200">
                          <div className="font-medium text-gray-900 text-sm">{c.full_name}</div>
                          <div className="text-xs text-gray-500">{c.email}</div>
                        </td>
                        {sessions.map(s => {
                          const attendance = getAttendanceValue(c, s)
                          const score = getScoreValue(c, s)
                          return (
                            <>
                              <td key={`${c.candidate_id}-${s.id}-att`} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => handleToggleAttendance(c.candidate_id, s.id, attendance)}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                    attendance === true ? 'bg-green-100 text-green-600 hover:bg-green-200' :
                                    attendance === false ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                                    'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {attendance === true ? <Check className="w-4 h-4" /> : attendance === false ? <X className="w-4 h-4" /> : <span className="text-xs">—</span>}
                                </button>
                              </td>
                              <td key={`${c.candidate_id}-${s.id}-score`} className="px-2 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={score ?? ''}
                                  onChange={(e) => handleScoreChange(c.candidate_id, s.id, e.target.value)}
                                  className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  placeholder="—"
                                />
                              </td>
                            </>
                          )
                        })}
                        <td className="px-3 py-3 text-center font-medium text-gray-900">{c.attendance_score.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-medium text-gray-900">{c.avg_test_score != null ? c.avg_test_score.toFixed(2) : '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            c.status === 'passed' ? 'bg-green-100 text-green-800' :
                            c.status === 'failed' ? 'bg-red-100 text-red-800' :
                            c.status === 'dropped' ? 'bg-gray-100 text-gray-800' :
                            c.status === 'in_training' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handlePromote(c.candidate_id, 'passed')}
                              disabled={c.status === 'passed'}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-30"
                              title="Đạt"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePromote(c.candidate_id, 'failed')}
                              disabled={c.status === 'failed'}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                              title="Không đạt"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePromote(c.candidate_id, 'dropped')}
                              disabled={c.status === 'dropped'}
                              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-30"
                              title="Bỏ học"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
