'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/app-toast'
import { ArrowLeft, Check, X, Save, UserCheck, UserX, UserMinus, Plus, Calendar } from 'lucide-react'
import Link from 'next/link'

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

export default function GenDetailPage() {
  const params = useParams()
  const gen_id = params.gen as string

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [candidates, setCandidates] = useState<CandidateSummary[]>([])
  const [edits, setEdits] = useState<Map<string, RecordEdit>>(new Map())
  const [saving, setSaving] = useState(false)

  // Session form state
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState<SessionForm>({ session_number: 1, title: '', session_date: '', video_id: '' })
  const [savingSession, setSavingSession] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/hr/onboarding/records?gen_id=${gen_id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu.')
      setSessions(data.sessions || [])
      setCandidates(data.candidateSummaries || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [gen_id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      await fetchData()
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
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định')
    }
  }

  const handleCreateSession = async () => {
    if (!sessionForm.title.trim()) {
      toast.error('Tiêu đề buổi training là bắt buộc.')
      return
    }
    setSavingSession(true)
    try {
      const response = await fetch('/api/hr/onboarding/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gen_id: parseInt(gen_id),
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
      await fetchData()
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

  if (loading) {
    return (
      <PageContainer title="Chi tiết GEN" maxWidth="full" padding="md">
        <div className="text-center py-12 text-gray-500">Đang tải...</div>
      </PageContainer>
    )
  }

  const usedSessionNumbers = sessions.map(s => s.session_number)
  const availableSessionNumbers = [1, 2, 3, 4].filter(n => !usedSessionNumbers.includes(n))

  return (
    <PageContainer title={`Chi tiết GEN ${gen_id}`} maxWidth="full" padding="md">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/admin/hr-onboarding" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Quay lại dashboard
          </Link>
          <div className="flex items-center gap-3">
            {availableSessionNumbers.length > 0 && (
              <Button
                onClick={() => {
                  setSessionForm(f => ({ ...f, session_number: availableSessionNumbers[0] }))
                  setShowSessionForm(true)
                }}
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm buổi training
              </Button>
            )}
            {edits.size > 0 && (
              <Button
                onClick={handleSave}
                disabled={saving}
                loading={saving}
                variant="default"
              >
                <Save className="w-4 h-4 mr-2" />
                Lưu {edits.size} thay đổi
              </Button>
            )}
          </div>
        </div>

        {/* Session Form Modal */}
        {showSessionForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Tạo buổi training mới
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="md:col-span-1">
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Video ID (tuỳ chọn)</label>
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
              <Button
                onClick={handleCreateSession}
                disabled={savingSession}
                loading={savingSession}
                variant="default"
              >
                Tạo buổi training
              </Button>
              <Button
                onClick={() => setShowSessionForm(false)}
                variant="outline"
              >
                Huỷ
              </Button>
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <Calendar className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
            <p className="text-yellow-800 font-medium">Chưa có buổi training nào được thiết lập cho GEN này.</p>
            <p className="text-sm text-yellow-600 mt-1">Nhấn "Thêm buổi training" để bắt đầu.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[180px]">Ứng viên</th>
                  {sessions.map(s => (
                    <th key={s.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan={2}>
                      Buổi {s.session_number}
                      <div className="text-[10px] font-normal text-gray-400 mt-0.5">{s.title}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Chuyên cần</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Điểm TB</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 sticky left-0 bg-gray-50 z-10"></th>
                  {sessions.map(s => (
                    <>
                      <th key={`${s.id}-att`} className="px-2 py-2 text-center text-[10px] text-gray-400 uppercase">Điểm danh</th>
                      <th key={`${s.id}-score`} className="px-2 py-2 text-center text-[10px] text-gray-400 uppercase">Điểm</th>
                    </>
                  ))}
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={4 + sessions.length * 2} className="px-4 py-8 text-center text-gray-500">
                      Chưa có ứng viên nào trong GEN này.
                    </td>
                  </tr>
                ) : candidates.map(c => (
                  <tr key={c.candidate_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
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
                                attendance === true
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : attendance === false
                                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
                              className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </td>
                        </>
                      )
                    })}
                    <td className="px-4 py-3 text-center font-medium text-gray-900">{c.attendance_score.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">{c.avg_test_score != null ? c.avg_test_score.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-center">
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
                    <td className="px-4 py-3 text-center">
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
          </div>
        )}
      </div>
    </PageContainer>
  )
}
