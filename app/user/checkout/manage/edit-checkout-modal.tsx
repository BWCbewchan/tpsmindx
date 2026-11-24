'use client'

import { authHeaders } from '@/lib/auth-headers'
import { toast } from '@/lib/app-toast'
import { TrialTimeRangeField } from '@/components/checkout/TrialTimeRangeField'
import {
  ACTIVE_CASE_RESULT_OPTIONS,
  RUBRICS,
  SCORE_COLUMNS,
  SUBJECT_OPTIONS,
  TRACKS,
  calculateAverageScore,
  getRequiredScoreKeys,
  resolveRubricType,
  type CaseResult,
  type ScoreColumn,
  type ScoreMap,
  type TrialTrack,
} from '@/lib/trial-checkout-rubrics'
import { cn } from '@/lib/utils'
import { CalendarDays, CheckCircle2, Clock, Loader2, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type EditableCheckoutRow = Partial<Record<ScoreColumn, string | number | null>> & {
  id: number
  submitted_at: string
  teacher_email: string
  teacher_code: string | null
  lms_code: string | null
  trial_teacher_name: string
  sales_owner_name: string
  student_name: string
  student_age_label: string
  trial_date: string
  trial_time_range: string | null
  track: TrialTrack
  trial_subject: string
  center_name: string
  total_score: string | number
  case_result: string
  general_comment: string
  evidence_link: string | null
  public_token: string | null
  rubric_type: string
  note: string | null
  editable_until: string | null
}

type CenterOption = {
  id: number
  short_code: string | null
  full_name: string
}

type EditForm = {
  center: string
  salesOwner: string
  studentName: string
  studentAge: string
  trialDate: string
  trialTimeStart: string
  trialTimeEnd: string
  track: TrialTrack
  subject: string
  generalComment: string
  caseResult: CaseResult | ''
  note: string
}

function splitTimeRange(value: string | null | undefined): [string, string] {
  const match = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(String(value || '').trim())
  return match ? [match[1].padStart(5, '0'), match[2].padStart(5, '0')] : ['', '']
}

function buildInitialForm(record: EditableCheckoutRow): EditForm {
  const [trialTimeStart, trialTimeEnd] = splitTimeRange(record.trial_time_range)
  return {
    center: record.center_name || '',
    salesOwner: record.sales_owner_name || '',
    studentName: record.student_name || '',
    studentAge: record.student_age_label || '',
    trialDate: String(record.trial_date || '').slice(0, 10),
    trialTimeStart,
    trialTimeEnd,
    track: record.track,
    subject: record.trial_subject || '',
    generalComment: record.general_comment || '',
    caseResult: record.case_result as CaseResult,
    note: record.note || '',
  }
}

function buildInitialScores(record: EditableCheckoutRow): ScoreMap {
  const scores: ScoreMap = {}
  for (const key of SCORE_COLUMNS) {
    const value = Number(record[key])
    if (Number.isFinite(value) && value >= 1 && value <= 5) scores[key] = value
  }
  return scores
}

function Field({
  label,
  children,
  required = true,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
        {label}
        {required && <span className="ml-1 text-[#b00020]">*</span>}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10 disabled:cursor-not-allowed disabled:bg-gray-100'

export function EditCheckoutModal({
  record,
  centers,
  token,
  onClose,
  onSaved,
}: {
  record: EditableCheckoutRow
  centers: CenterOption[]
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EditForm>(() => buildInitialForm(record))
  const [scores, setScores] = useState<ScoreMap>(() => buildInitialScores(record))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isSaving, onClose])

  const scoreKeys = useMemo(
    () => getRequiredScoreKeys(form.track, form.subject),
    [form.subject, form.track],
  )
  const rubric = RUBRICS[resolveRubricType(form.track, form.subject)]
  const criteria = useMemo(() => {
    const byKey = new Map<ScoreColumn, { key: ScoreColumn; label: string; section: string }>()
    for (const section of rubric.sections) {
      for (const criterion of section.criteria) {
        byKey.set(criterion.key, {
          key: criterion.key,
          label: criterion.label,
          section: section.title,
        })
      }
    }
    return scoreKeys.map((key) => byKey.get(key)).filter(Boolean) as Array<{
      key: ScoreColumn
      label: string
      section: string
    }>
  }, [rubric.sections, scoreKeys])
  const averageScore = calculateAverageScore(scores, scoreKeys)

  const availableCenters = useMemo(() => {
    if (centers.some((center) => center.full_name === form.center)) return centers
    return [{ id: 0, short_code: null, full_name: form.center }, ...centers].filter(
      (center) => center.full_name,
    )
  }, [centers, form.center])

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  async function handleSave() {
    if (
      !form.center.trim() ||
      !form.salesOwner.trim() ||
      !form.studentName.trim() ||
      !form.studentAge.trim() ||
      !form.trialDate ||
      !form.trialTimeStart ||
      !form.trialTimeEnd ||
      !form.subject.trim() ||
      !form.generalComment.trim() ||
      !form.caseResult
    ) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc.')
      return
    }

    const [startHour, startMinute] = form.trialTimeStart.split(':').map(Number)
    const [endHour, endMinute] = form.trialTimeEnd.split(':').map(Number)
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute) {
      setError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    if (scoreKeys.some((key) => scores[key] == null)) {
      setError('Vui lòng chấm đủ tất cả tiêu chí đánh giá.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const headers = new Headers(authHeaders(token))
      headers.set('Content-Type', 'application/json')
      const response = await fetch('/api/user/checkout/forms', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: record.id,
          ...form,
          scores: Object.fromEntries(scoreKeys.map((key) => [key, scores[key]])),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Không thể cập nhật phiếu trải nghiệm')
      }
      toast.success('Đã cập nhật phiếu', { message: `Phiếu #${record.id} đã được lưu thành công` })
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật phiếu trải nghiệm')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-checkout-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#b00020]">
              <Clock className="h-4 w-4" />
              Chỉnh sửa trong 48 giờ
            </div>
            <h2 id="edit-checkout-title" className="mt-1 text-xl font-black text-gray-950">
              Sửa phiếu #{record.id} · {record.student_name}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Giáo viên gửi phiếu: <strong className="text-gray-700">{record.trial_teacher_name}</strong>
              {record.lms_code || record.teacher_code ? ` · LMS ${record.lms_code || record.teacher_code}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
            aria-label="Đóng cửa sổ sửa phiếu"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <CalendarDays className="h-4 w-4 text-[#b00020]" />
                <h3 className="text-sm font-black uppercase tracking-wide text-gray-900">Thông tin trải nghiệm</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Họ tên học viên">
                  <input className={inputClass} value={form.studentName} onChange={(event) => updateField('studentName', event.target.value)} />
                </Field>
                <Field label="Tuổi / lớp">
                  <input className={inputClass} value={form.studentAge} onChange={(event) => updateField('studentAge', event.target.value)} />
                </Field>
                <Field label="Ngày trải nghiệm">
                  <input type="date" className={inputClass} value={form.trialDate} onChange={(event) => updateField('trialDate', event.target.value)} />
                </Field>
                <div className="space-y-1.5 md:col-span-2 xl:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                    Khung giờ trải nghiệm <span className="text-[#b00020]">*</span>
                  </span>
                  <TrialTimeRangeField
                    startTime={form.trialTimeStart}
                    endTime={form.trialTimeEnd}
                    onStartTimeChange={(value) => updateField('trialTimeStart', value)}
                    onEndTimeChange={(value) => updateField('trialTimeEnd', value)}
                  />
                </div>
                <Field label="Cơ sở">
                  <select className={inputClass} value={form.center} onChange={(event) => updateField('center', event.target.value)}>
                    <option value="">Chọn cơ sở</option>
                    {availableCenters.map((center) => (
                      <option key={`${center.id}-${center.full_name}`} value={center.full_name}>
                        {center.full_name}{center.short_code ? ` (${center.short_code})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tư vấn phụ trách">
                  <input className={inputClass} value={form.salesOwner} onChange={(event) => updateField('salesOwner', event.target.value)} />
                </Field>
                <Field label="Khối trải nghiệm">
                  <select
                    className={inputClass}
                    value={form.track}
                    onChange={(event) => {
                      updateField('track', event.target.value as TrialTrack)
                      updateField('subject', '')
                      setScores({})
                    }}
                  >
                    {TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}
                  </select>
                </Field>
                <Field label="Môn trải nghiệm">
                  <input
                    className={inputClass}
                    list="checkout-edit-subjects"
                    value={form.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    placeholder="Chọn hoặc nhập tên môn"
                  />
                  <datalist id="checkout-edit-subjects">
                    {SUBJECT_OPTIONS[form.track].map((subject) => <option key={subject} value={subject} />)}
                  </datalist>
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-[#c6e5e5] bg-[#eef8f8] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-2 border-b border-[#c6e5e5] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-[#075f60]">Đánh giá năng lực</h3>
                  <p className="mt-1 text-xs text-gray-600">{rubric.title}</p>
                </div>
                <span className="w-fit rounded-lg bg-white px-3 py-1.5 text-sm font-black text-[#087f80] shadow-sm">
                  Điểm TB: {averageScore == null ? '—' : `${averageScore.toFixed(2)}/5.00`}
                </span>
              </div>
              <div className="space-y-2.5">
                {criteria.map((criterion, index) => (
                  <div key={criterion.key} className="grid gap-3 rounded-lg border border-[#c6e5e5] bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#087f80]">{index + 1}. {criterion.section}</p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-gray-800">{criterion.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={criterion.label}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={scores[criterion.key] === value}
                          onClick={() => {
                            setScores((current) => ({ ...current, [criterion.key]: value }))
                            setError('')
                          }}
                          className={cn(
                            'grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black transition',
                            scores[criterion.key] === value
                              ? 'border-[#087f80] bg-[#087f80] text-white ring-4 ring-[#087f80]/15'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-[#087f80] hover:text-[#087f80]',
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-4 border-b border-gray-100 pb-3 text-sm font-black uppercase tracking-wide text-gray-900">Nhận xét và kết quả</h3>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
                <Field label="Nhận xét chung">
                  <textarea className="min-h-32 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10" value={form.generalComment} onChange={(event) => updateField('generalComment', event.target.value)} />
                </Field>
                <div className="space-y-4">
                  <Field label="Thông tin chốt case">
                    <select className={inputClass} value={form.caseResult} onChange={(event) => updateField('caseResult', event.target.value as CaseResult)}>
                      <option value="">Chọn kết quả</option>
                      {ACTIVE_CASE_RESULT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Định hướng thêm" required={false}>
                    <textarea className="min-h-20 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10" value={form.note} onChange={(event) => updateField('note', event.target.value)} />
                  </Field>
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-gray-500">
            Sau khi lưu, nội dung phiếu public và danh sách quản lý sẽ được cập nhật ngay.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Hủy
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#b00020] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#90001a] disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

