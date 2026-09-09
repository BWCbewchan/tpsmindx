'use client'

import { PageHeader } from '@/components/PageHeader'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  ALL_SUBJECT_OPTIONS,
  CASE_RESULT_OPTIONS,
  RUBRICS,
  SUBJECT_OPTIONS,
  TRACKS,
  calculateAverageScore,
  getRequiredScoreKeys,
  resolveRubricType,
  type CaseResult,
  type RubricConfig,
  type ScoreColumn,
  type ScoreMap,
  type TrialTrack,
} from '@/lib/trial-checkout-rubrics'
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileText,
  Layers3,
  LinkIcon,
  ListChecks,
  Loader2,
  MapPin,
  Send,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type CenterOption = {
  id: number
  region: string | null
  short_code: string | null
  full_name: string
}

type CheckoutContext = {
  email: string
  teacherCode: string | null
  teacherName: string
  defaultCenter: string
  centers: CenterOption[]
}

type FormState = {
  teacherName: string
  center: string
  salesOwner: string
  studentName: string
  studentAge: string
  trialDate: string
  track: TrialTrack | ''
  subject: string
  generalComment: string
  evidenceLink: string
  caseResult: CaseResult | ''
}

const INITIAL_FORM: FormState = {
  teacherName: '',
  center: '',
  salesOwner: '',
  studentName: '',
  studentAge: '',
  trialDate: '',
  track: '',
  subject: '',
  generalComment: '',
  evidenceLink: '',
  caseResult: '',
}

const REQUIRED_LABELS: Record<keyof FormState, string> = {
  teacherName: 'Tên giáo viên',
  center: 'Cơ sở',
  salesOwner: 'Tên tư vấn phụ trách',
  studentName: 'Họ tên học viên',
  studentAge: 'Tuổi',
  trialDate: 'Ngày trải nghiệm',
  track: 'Khối trải nghiệm',
  subject: 'Môn trải nghiệm',
  generalComment: 'Nhận xét chung',
  evidenceLink: 'Link minh chứng nội bộ',
  caseResult: 'Chốt case',
}

const SCORE_VALUES = [1, 2, 3, 4, 5]

function normalizeEmailName(email: string | undefined): string {
  const value = String(email ?? '').trim()
  if (!value) return ''
  return value.split('@')[0] || value
}

function PhaseProgress({ phase }: { phase: number }) {
  return (
    <div className="flex items-center gap-2" aria-label="Tiến trình form checkout">
      {[1, 2, 3].map((step, index) => {
        const isActive = step === phase
        const isDone = step < phase

        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                isActive
                  ? 'border-[#b00020] bg-[#b00020] text-white shadow-sm'
                  : isDone
                    ? 'border-[#b00020]/40 bg-[#fff1f3] text-[#b00020]'
                    : 'border-gray-300 bg-white text-gray-500',
              )}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
            </div>
            {index < 2 && (
              <div
                className={cn(
                  'h-px w-9 sm:w-16',
                  step < phase ? 'bg-[#b00020]/45' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldLabel({
  children,
  required = true,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="text-sm font-semibold text-gray-900">
      {children}
      {required && <span className="ml-1 text-[#b00020]">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-[#b00020]">{message}</p>
}

function RadioTile({
  checked,
  label,
  description,
  onSelect,
}: {
  checked: boolean
  label: string
  description?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left transition-colors',
        checked
          ? 'border-[#b00020] bg-[#fff7f8] shadow-sm'
          : 'border-gray-200 hover:border-[#f0a8b3] hover:bg-[#fffafb]',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-[#b00020] bg-[#b00020]' : 'border-gray-300 bg-white',
        )}
      >
        {checked && <CircleDot className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </span>
    </button>
  )
}

function ScoreDot({
  selected,
  value,
  onSelect,
}: {
  selected: boolean
  value: number
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Chọn điểm ${value}`}
      onClick={onSelect}
      className={cn(
        'mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
        selected
          ? 'border-[#087f80] bg-[#087f80] text-white'
          : 'border-gray-300 bg-white text-transparent hover:border-[#087f80]',
      )}
    >
      {selected ? value : ''}
    </button>
  )
}

function MatrixRubric({
  rubric,
  scores,
  onScore,
}: {
  rubric: RubricConfig
  scores: ScoreMap
  onScore: (key: ScoreColumn, value: number) => void
}) {
  return (
    <div className="space-y-5">
      {rubric.sections.map((section, index) => (
        <section key={section.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-[#087f80] px-2 text-xs font-bold text-white">
              {index + 9}
            </div>
            <h3 className="mt-2 text-sm font-bold uppercase text-gray-950">{section.title}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full table-fixed border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-white text-xs font-semibold text-gray-500">
                  <th className="w-[46%] px-4 py-3 text-left">Năng lực</th>
                  {SCORE_VALUES.map((score) => (
                    <th key={score} className="px-3 py-3 text-center">
                      {score}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.criteria.map((criterion) => (
                  <tr key={criterion.key} className="odd:bg-gray-50 even:bg-white">
                    <td className="px-4 py-3 text-xs font-medium leading-relaxed text-gray-700">
                      {criterion.label}
                    </td>
                    {SCORE_VALUES.map((score) => (
                      <td key={score} className="px-3 py-3 text-center">
                        <ScoreDot
                          value={score}
                          selected={scores[criterion.key] === score}
                          onSelect={() => onScore(criterion.key, score)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function LevelListRubric({
  rubric,
  scores,
  onScore,
}: {
  rubric: RubricConfig
  scores: ScoreMap
  onScore: (key: ScoreColumn, value: number) => void
}) {
  return (
    <div className="space-y-5">
      {rubric.sections.map((section, index) => {
        const criterion = section.criteria[0]

        return (
          <section key={section.id} className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-[#087f80] px-2 text-xs font-bold text-white">
                {index + 9}
              </div>
              <h3 className="mt-2 text-sm font-bold uppercase text-gray-950">{section.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{criterion.label}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {criterion.levels?.map((level, levelIndex) => {
                const score = levelIndex + 1
                const checked = scores[criterion.key] === score

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onScore(criterion.key, score)}
                    className={cn(
                      'grid w-full grid-cols-[48px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition-colors',
                      checked ? 'bg-[#eefafa]' : 'hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                        checked
                          ? 'border-[#087f80] bg-[#087f80] text-white'
                          : 'border-gray-300 bg-white text-gray-500',
                      )}
                    >
                      {score}
                    </span>
                    <span className="text-sm leading-relaxed text-gray-700">{level}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CaseResultTile({
  option,
  checked,
  onSelect,
}: {
  option: (typeof CASE_RESULT_OPTIONS)[number]
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border px-4 py-4 text-left transition-colors',
        checked
          ? 'border-[#b00020] bg-[#fff7f8]'
          : 'border-gray-200 bg-white hover:border-[#f0a8b3]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-[#b00020] bg-[#b00020]' : 'border-gray-300 bg-white',
        )}
      >
        {checked && <CircleDot className="h-3.5 w-3.5 text-white" />}
      </span>
      <span>
        <span className={cn('block text-sm font-bold', option.className)}>{option.label}</span>
        <span className="mt-1 block text-sm text-gray-600">{option.description}</span>
      </span>
    </button>
  )
}

export default function UserCheckoutCreatePage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [phase, setPhase] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [scores, setScores] = useState<ScoreMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [context, setContext] = useState<CheckoutContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(true)
  const [contextError, setContextError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const fallbackTeacherName = user?.displayName || normalizeEmailName(user?.email)
    const fallbackCenter = user?.assignedCenters?.[0]?.full_name || ''

    setForm((current) => ({
      ...current,
      teacherName: current.teacherName || fallbackTeacherName,
      center: current.center || fallbackCenter,
    }))
  }, [user?.assignedCenters, user?.displayName, user?.email])

  useEffect(() => {
    if (!user?.email) return

    const controller = new AbortController()
    setIsLoadingContext(true)
    setContextError('')

    fetch('/api/user/checkout/context', {
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Không thể tải dữ liệu checkout')
        }
        return payload.data as CheckoutContext
      })
      .then((data) => {
        setContext(data)
        setForm((current) => ({
          ...current,
          teacherName: data.teacherName || current.teacherName,
          center: current.center || data.defaultCenter,
        }))
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setContextError(error instanceof Error ? error.message : 'Không thể tải dữ liệu checkout')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingContext(false)
      })

    return () => controller.abort()
  }, [token, user?.email])

  const centerOptions = useMemo(() => {
    const options = context?.centers || []
    if (!form.center) return options
    if (options.some((center) => center.full_name === form.center)) return options
    return [{ id: 0, region: null, short_code: null, full_name: form.center }, ...options]
  }, [context?.centers, form.center])

  const subjectOptions = form.track ? SUBJECT_OPTIONS[form.track] : ALL_SUBJECT_OPTIONS
  const rubricType = form.track && form.subject ? resolveRubricType(form.track, form.subject) : 'common'
  const rubric = RUBRICS[rubricType]
  const scoreKeys = form.track && form.subject ? getRequiredScoreKeys(form.track, form.subject) : []
  const averageScore = calculateAverageScore(scores, scoreKeys)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  function selectTrack(track: TrialTrack) {
    setForm((current) => ({
      ...current,
      track,
      subject: current.track === track ? current.subject : '',
    }))
    setScores({})
    setErrors((current) => ({ ...current, track: '', subject: '' }))
  }

  function updateScore(key: ScoreColumn, value: number) {
    setScores((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, scores: '' }))
  }

  function validatePhaseOne(): boolean {
    const nextErrors: Record<string, string> = {}
    ;(
      [
        'teacherName',
        'center',
        'salesOwner',
        'studentName',
        'studentAge',
        'trialDate',
        'track',
        'subject',
      ] as Array<keyof FormState>
    ).forEach((key) => {
      if (!String(form[key] ?? '').trim()) {
        nextErrors[key] = `Vui lòng nhập ${REQUIRED_LABELS[key].toLowerCase()}`
      }
    })

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validatePhaseTwo(): boolean {
    const missingScore = scoreKeys.some((key) => !scores[key])
    const nextErrors: Record<string, string> = {}

    if (missingScore) {
      nextErrors.scores = 'Vui lòng chấm đủ tất cả tiêu chí trước khi sang bước tiếp theo'
    }
    if (!form.generalComment.trim()) {
      nextErrors.generalComment = 'Vui lòng nhập nhận xét chung'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validatePhaseThree(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!form.caseResult) {
      nextErrors.caseResult = 'Vui lòng chọn thông tin chốt case'
    }
    if (form.evidenceLink && !/^https?:\/\//i.test(form.evidenceLink.trim())) {
      nextErrors.evidenceLink = 'Link minh chứng nội bộ nên bắt đầu bằng http:// hoặc https://'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleNext() {
    if (phase === 1 && !validatePhaseOne()) return
    if (phase === 2 && !validatePhaseTwo()) return
    setPhase((current) => Math.min(current + 1, 3))
  }

  async function handleSubmit() {
    if (!validatePhaseThree()) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const headers = new Headers(authHeaders(token))
      headers.set('Content-Type', 'application/json')

      const response = await fetch('/api/user/checkout/forms', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          scores,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Không thể gửi form checkout')
      }
      router.push('/user/checkout/manage')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể gửi form checkout')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageLayout background="gray" maxWidth="7xl" padding="responsive">
      <PageLayoutContent spacing="xl" className="pb-24">
        <PageHeader
          title="Tạo Form Checkout"
          description="Điền thông tin trial, chấm điểm năng lực và gửi kết quả chốt case"
          actions={
            <Link
              href="/user/checkout/manage"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3b4bd] bg-white px-4 text-sm font-semibold text-[#b00020] shadow-sm hover:bg-[#b00020]/5"
            >
              <ListChecks className="h-4 w-4" />
              Quản lý form
            </Link>
          }
        />

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#b00020]">
                <ClipboardCheck className="h-4 w-4" />
                Trial checkout
              </div>
              <h2 className="mt-1 text-xl font-bold text-gray-950">
                {phase === 1 && 'Phase 1: Thông tin trải nghiệm'}
                {phase === 2 && 'Phase 2: Đánh giá năng lực'}
                {phase === 3 && 'Phase 3: Thông tin chốt case'}
              </h2>
            </div>
            <PhaseProgress phase={phase} />
          </div>

          {phase === 1 && (
            <div className="space-y-6 px-4 py-5 sm:px-6">
              {contextError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {contextError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Tên giáo viên Trial</FieldLabel>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={form.teacherName}
                      readOnly
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-medium text-gray-800 outline-none"
                    />
                  </div>
                  <FieldError message={errors.teacherName} />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Cơ sở</FieldLabel>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={form.center}
                      onChange={(event) => updateField('center', event.target.value)}
                      disabled={isLoadingContext && centerOptions.length === 0}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10 disabled:bg-gray-50"
                    >
                      <option value="">Chọn cơ sở</option>
                      {centerOptions.map((center) => (
                        <option key={`${center.id}-${center.full_name}`} value={center.full_name}>
                          {center.short_code ? `${center.full_name} (${center.short_code})` : center.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldError message={errors.center} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Họ tên học viên</FieldLabel>
                  <input
                    value={form.studentName}
                    onChange={(event) => updateField('studentName', event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                    placeholder="Nhập họ tên học viên"
                  />
                  <FieldError message={errors.studentName} />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Tuổi</FieldLabel>
                  <input
                    value={form.studentAge}
                    onChange={(event) => updateField('studentAge', event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                    placeholder="VD: 9 hoặc lớp 4"
                  />
                  <FieldError message={errors.studentAge} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Ngày trải nghiệm</FieldLabel>
                  <input
                    type="date"
                    value={form.trialDate}
                    onChange={(event) => updateField('trialDate', event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                  />
                  <FieldError message={errors.trialDate} />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Tên tư vấn phụ trách</FieldLabel>
                  <input
                    value={form.salesOwner}
                    onChange={(event) => updateField('salesOwner', event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                    placeholder="Nhập tên sale phụ trách case trial"
                  />
                  <p className="text-xs text-[#b00020]">GV chủ động hỏi tên tư vấn phụ trách case trial của mình</p>
                  <FieldError message={errors.salesOwner} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-[#b00020]" />
                  <FieldLabel>Khối trải nghiệm</FieldLabel>
                </div>
                <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Khối trải nghiệm">
                  {TRACKS.map((track) => (
                    <RadioTile
                      key={track.value}
                      checked={form.track === track.value}
                      label={track.label}
                      description={track.description}
                      onSelect={() => selectTrack(track.value)}
                    />
                  ))}
                </div>
                <FieldError message={errors.track} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-[#b00020]" />
                  <FieldLabel required={Boolean(form.track)}>
                    {form.track ? `Môn trải nghiệm ${form.track}` : 'Môn trải nghiệm'}
                  </FieldLabel>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Môn trải nghiệm">
                  {form.track ? (
                    subjectOptions.map((subject) => (
                      <RadioTile
                        key={subject}
                        checked={form.subject === subject}
                        label={subject}
                        onSelect={() => {
                          updateField('subject', subject)
                          setScores({})
                        }}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
                      Chọn khối trải nghiệm để hiện danh sách môn phù hợp.
                    </div>
                  )}
                </div>
                <FieldError message={errors.subject} />
              </div>
            </div>
          )}

          {phase === 2 && (
            <div className="space-y-6 bg-[#eef8f8] px-4 py-5 sm:px-6">
              <div className="rounded-lg border border-[#c6e5e5] bg-white px-4 py-3">
                <p className="text-sm font-bold text-[#075f60]">{rubric.title}</p>
                <p className="mt-1 text-xs text-gray-600">{rubric.note}</p>
              </div>

              {rubric.mode === 'matrix' ? (
                <MatrixRubric rubric={rubric} scores={scores} onScore={updateScore} />
              ) : (
                <LevelListRubric rubric={rubric} scores={scores} onScore={updateScore} />
              )}

              <FieldError message={errors.scores} />

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <FieldLabel>Nhận xét chung</FieldLabel>
                    <p className="mt-1 text-xs text-[#b00020]">
                      Cân nhắc đánh giá theo chân dung học viên và xác nhận lại với Leader nếu là trường hợp cần theo dõi.
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#fff7f8] px-4 py-2 text-sm font-semibold text-[#b00020]">
                    Điểm TB: {averageScore == null ? 'N/A' : averageScore.toFixed(2)}
                  </div>
                </div>
                <textarea
                  value={form.generalComment}
                  onChange={(event) => updateField('generalComment', event.target.value)}
                  className="mt-3 min-h-28 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                  placeholder="Nhập nhận xét chung về học viên"
                />
                <FieldError message={errors.generalComment} />
              </div>
            </div>
          )}

          {phase === 3 && (
            <div className="space-y-6 bg-[#eef8f8] px-4 py-5 sm:px-6">
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-5">
                <h3 className="text-2xl font-bold text-[#00464a]">Thông tin chốt case</h3>
                <p className="mt-4 text-sm italic text-[#d62020]">
                  Lưu ý: Đây là thông tin đề xuất lộ trình từ phía Teaching sau quá trình đánh giá trải nghiệm, không phải kết quả cuối cùng đến từ phía Tư vấn.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-5 py-5">
                <div className="inline-flex h-8 min-w-8 items-center justify-center rounded bg-[#087f80] px-2 text-sm font-bold text-white">
                  14
                </div>
                <h4 className="mt-4 text-lg font-semibold text-gray-950">
                  Học viên có phù hợp với lộ trình học không?
                  <span className="ml-1 text-[#b00020]">*</span>
                </h4>
                <div className="mt-5 space-y-2 text-sm text-gray-600">
                  <p>Note: Confirm trước đến Leader đối với các trường hợp đặc biệt như <span className="font-bold text-orange-600">4 tháng</span> và <span className="font-bold text-amber-500">1:1</span>.</p>
                  {CASE_RESULT_OPTIONS.map((option) => (
                    <p key={option.value}>
                      <span className={cn('font-bold', option.className)}>{option.label}</span>: {option.description}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Thông tin chốt case">
                {CASE_RESULT_OPTIONS.map((option) => (
                  <CaseResultTile
                    key={option.value}
                    option={option}
                    checked={form.caseResult === option.value}
                    onSelect={() => updateField('caseResult', option.value)}
                  />
                ))}
              </div>
              <FieldError message={errors.caseResult} />

              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                <FieldLabel required={false}>Link minh chứng nội bộ</FieldLabel>
                <div className="relative">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.evidenceLink}
                    onChange={(event) => updateField('evidenceLink', event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10"
                    placeholder="https://..."
                  />
                </div>
                <FieldError message={errors.evidenceLink} />
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={() => setPhase((current) => Math.max(current - 1, 1))}
              disabled={phase === 1 || isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {phase < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#b00020] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#90001a]"
              >
                Next
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#087f80] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#066b6c] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Submit
              </button>
            )}
          </div>
        </section>
      </PageLayoutContent>
    </PageLayout>
  )
}
