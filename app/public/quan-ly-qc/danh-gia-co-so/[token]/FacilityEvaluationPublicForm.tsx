'use client'

import { Button } from '@/components/ui/button'
import { CenterCombobox } from '@/components/facility-evaluation/CenterCombobox'
import { Textarea } from '@/components/ui/textarea'
import {
  FACILITY_EVALUATION_CRITERIA,
  FACILITY_EVALUATION_RECIPIENT_ROLE_CODES,
  FACILITY_EVALUATION_SCORE_VALUES,
  formatVietnamMonthLabel,
} from '@/lib/facility-evaluation'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  UserRoundCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type CenterOption = {
  id: number
  fullName: string
  displayName: string
  shortCode: string | null
  region: string | null
}

type RecipientOption = {
  id: string
  centerId: number
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  source: string
}

type LeaderOption = {
  id: string
  centerId: number
  code: string
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  areas: string[]
}

type PublicFormPayload = {
  success?: boolean
  error?: string
  formMonth?: string
  centers?: CenterOption[]
  recipients?: RecipientOption[]
  leaders?: LeaderOption[]
}

const initialScores = () =>
  Object.fromEntries(
    FACILITY_EVALUATION_CRITERIA.map((criterion) => [criterion.key, 0]),
  ) as Record<string, number>

function cleanPersonName(value: unknown): string {
  let name = String(value ?? '').trim().replace(/\s+/g, ' ')
  for (let index = 0; index < 3; index += 1) {
    name = name
      .replace(/^(CM|CSL|CXL|CXO|CS)\s+/i, '')
      .replace(/\s+(CM|CSL|CXL|CXO|CS)$/i, '')
      .replace(/^I\d{3,8}\s+/i, '')
      .replace(/\s+I\d{3,8}$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return name || String(value ?? '').trim()
}

function centerMetaText(center: CenterOption | null): string {
  if (!center) return 'Chọn cơ sở để tiếp tục'

  const shortCode = String(center.shortCode ?? '').trim()
  const region = String(center.region ?? '').trim()
  const displayName = String(center.displayName ?? '').trim()
  const fallback = displayName && displayName !== center.fullName ? displayName : ''

  return [shortCode, region].filter(Boolean).join(' · ') || fallback || 'Đã chọn cơ sở'
}

function ScoreRadio({
  criterionKey,
  value,
  checked,
  onChange,
}: {
  criterionKey: string
  value: number
  checked: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="grid cursor-pointer justify-items-center gap-1.5">
      <span className="text-xs font-bold text-gray-600">{value}</span>
      <span
        className={cn(
          'relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          checked
            ? 'border-[#b00020] bg-[#b00020] shadow-sm'
            : 'border-gray-300 bg-white hover:border-[#b00020]/60 hover:bg-[#fff7f8]',
        )}
      >
        <input
          type="radio"
          name={`facility-public-score-${criterionKey}`}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
          aria-label={`${value} điểm`}
        />
        {checked && (
          <span className="h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#b00020]" />
        )}
      </span>
    </label>
  )
}

export function FacilityEvaluationPublicForm({ token }: { token: string }) {
  const pageTopRef = useRef<HTMLElement | null>(null)
  const [formMonth, setFormMonth] = useState('')
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [leaders, setLeaders] = useState<LeaderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  const [selectedCenterId, setSelectedCenterId] = useState('')
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [manualRecipientName, setManualRecipientName] = useState('')
  const [manualRecipientRole, setManualRecipientRole] = useState('CSL')
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>(initialScores)
  const [improvementNote, setImprovementNote] = useState('')

  const selectedCenter = useMemo(
    () => centers.find((center) => String(center.id) === selectedCenterId) ?? null,
    [centers, selectedCenterId],
  )
  const filteredRecipients = useMemo(
    () =>
      recipients.filter(
        (recipient) => String(recipient.centerId) === selectedCenterId,
      ),
    [recipients, selectedCenterId],
  )
  const filteredLeaders = useMemo(
    () => leaders.filter((leader) => String(leader.centerId) === selectedCenterId),
    [leaders, selectedCenterId],
  )
  const selectedRecipient = useMemo(
    () =>
      filteredRecipients.find((recipient) => recipient.id === selectedRecipientId) ??
      null,
    [filteredRecipients, selectedRecipientId],
  )
  const selectedLeader = useMemo(
    () => filteredLeaders.find((leader) => leader.id === selectedLeaderId) ?? null,
    [filteredLeaders, selectedLeaderId],
  )

  const scoreValues = FACILITY_EVALUATION_CRITERIA.map(
    (criterion) => Number(scores[criterion.key]) || 0,
  )
  const missingScoreCount = scoreValues.filter((score) => score < 1 || score > 5).length
  const usingManualRecipient = Boolean(selectedCenterId && filteredRecipients.length === 0)
  const monthLabel = formMonth ? formatVietnamMonthLabel(formMonth) : ''

  const canSubmit = Boolean(
    selectedCenter &&
      selectedLeader &&
      improvementNote.trim() &&
      missingScoreCount === 0 &&
      (selectedRecipient ||
        (usingManualRecipient && manualRecipientName.trim() && manualRecipientRole)),
  )

  const recipientLabel = useCallback((recipient: RecipientOption) => {
    return `${cleanPersonName(recipient.fullName)} - ${recipient.roleCode}`
  }, [])

  const resetFormFields = useCallback(() => {
    setSelectedCenterId('')
    setSelectedRecipientId('')
    setManualRecipientName('')
    setManualRecipientRole('CSL')
    setSelectedLeaderId('')
    setScores(initialScores())
    setImprovementNote('')
  }, [])

  const scrollToFormTop = useCallback(() => {
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
      document.body.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
  }, [])

  const loadForm = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(
        `/api/public/quan-ly-qc/facility-evaluations/${encodeURIComponent(token)}`,
      )
      const data = (await response.json().catch(() => ({}))) as PublicFormPayload
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Không thể tải form đánh giá cơ sở')
      }

      const nextCenters = data.centers || []
      setFormMonth(data.formMonth || '')
      setCenters(nextCenters)
      setRecipients(data.recipients || [])
      setLeaders(data.leaders || [])
      setSelectedCenterId((current) =>
        nextCenters.some((center) => String(center.id) === current) ? current : '',
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải form đánh giá cơ sở',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadForm()
  }, [loadForm])

  useEffect(() => {
    if (!successMessage) return undefined

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage('')
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  useEffect(() => {
    if (
      selectedRecipientId &&
      !filteredRecipients.some((recipient) => recipient.id === selectedRecipientId)
    ) {
      setSelectedRecipientId('')
    }
    if (
      selectedLeaderId &&
      !filteredLeaders.some((leader) => leader.id === selectedLeaderId)
    ) {
      setSelectedLeaderId('')
    }
  }, [filteredLeaders, filteredRecipients, selectedLeaderId, selectedRecipientId])

  async function submitForm() {
    if (!canSubmit) {
      setError('Vui lòng nhập đủ thông tin trước khi gửi form')
      setSuccessMessage('')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccessMessage('')
      const response = await fetch(
        `/api/public/quan-ly-qc/facility-evaluations/${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            centerId: selectedCenter?.id,
            recipientId: selectedRecipient?.id || '',
            manualRecipientName: usingManualRecipient ? manualRecipientName : '',
            manualRecipientRole: usingManualRecipient ? manualRecipientRole : '',
            leaderId: selectedLeader?.id,
            scores,
            improvementNote,
          }),
        },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể gửi form đánh giá cơ sở')
      }
      resetFormFields()
      setSuccessMessage('Đã gửi đánh giá. Form đã được làm mới để bạn có thể gửi tiếp.')
      scrollToFormTop()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Không thể gửi form đánh giá cơ sở',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-[#a1001f]" />
          Đang tải form đánh giá...
        </div>
      </div>
    )
  }

  return (
    <main ref={pageTopRef} className="min-h-dvh bg-gray-50 px-4 py-5 sm:px-6 lg:px-8">
      {successMessage && (
        <div
          className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm animate-in fade-in-0 slide-in-from-right-4 duration-200"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xl shadow-emerald-950/10">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#a1001f]" />
                <h1 className="text-lg font-black text-gray-950 sm:text-xl">
                  Đánh giá cơ sở
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {monthLabel ? `Phiếu đánh giá ${monthLabel}` : 'Phiếu đánh giá'}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <section className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-gray-950">
                <Building2 className="h-4 w-4 text-[#a1001f]" />
                Thông tin cơ sở
              </div>
              {monthLabel && (
                <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white">
                  {monthLabel}
                </span>
              )}
            </div>

            <div className="p-4">
              <div>
                <label className="sr-only">Cơ sở trực thuộc</label>
                <CenterCombobox
                  centers={centers}
                  selectedCenterId={selectedCenterId}
                  onChange={setSelectedCenterId}
                  placeholder="Chọn cơ sở"
                  className="mt-0"
                  buttonClassName="h-auto min-h-[72px] rounded-xl border-gray-200 bg-white px-3 py-3 shadow-sm hover:border-[#a1001f]/30"
                  contentClassName="overflow-visible whitespace-normal"
                  renderButtonContent={(center, placeholder) => (
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fff7f8] text-[#a1001f]">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-gray-950">
                          {center?.fullName || placeholder}
                        </span>
                        <span className="mt-1 block truncate text-xs font-medium text-gray-500">
                          {centerMetaText(center as CenterOption | null)}
                        </span>
                      </span>
                    </span>
                  )}
                />
              </div>

              <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Tên CM/CSL
                  </label>
                  {filteredRecipients.length > 0 ? (
                    <div className="relative mt-2">
                      <UserRoundCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <select
                        value={selectedRecipientId}
                        onChange={(event) => setSelectedRecipientId(event.target.value)}
                        disabled={!selectedCenterId}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm font-semibold text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">Chọn CM/CSL</option>
                        {filteredRecipients.map((recipient) => (
                          <option key={recipient.id} value={recipient.id}>
                            {recipientLabel(recipient)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-3">
                      <p className="text-xs font-semibold text-amber-900">
                        {selectedCenterId
                          ? 'Cơ sở này chưa có CM/CSL trong dữ liệu.'
                          : 'Vui lòng chọn cơ sở trước.'}
                      </p>
                      {selectedCenterId && (
                        <>
                          <input
                            value={manualRecipientName}
                            onChange={(event) => setManualRecipientName(event.target.value)}
                            placeholder="Nhập tên người nhận"
                            className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                          />
                          <select
                            value={manualRecipientRole}
                            onChange={(event) => setManualRecipientRole(event.target.value)}
                            className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
                          >
                            {FACILITY_EVALUATION_RECIPIENT_ROLE_CODES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Leader khu vực
                  </label>
                  <div className="relative mt-2">
                    <UserRoundCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={selectedLeaderId}
                      onChange={(event) => setSelectedLeaderId(event.target.value)}
                      disabled={!selectedCenterId}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm font-semibold text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">
                        {selectedCenterId ? 'Chọn một leader' : 'Chọn cơ sở trước'}
                      </option>
                      {filteredLeaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.fullName} · {leader.roleCode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserRoundCheck className="h-4 w-4 text-[#a1001f]" />
                  <span className="text-sm font-black uppercase tracking-wide text-gray-950">
                    Tiêu chí đánh giá
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 p-3 sm:p-4">
                {FACILITY_EVALUATION_CRITERIA.map((criterion, index) => {
                  const selected = Number(scores[criterion.key]) || 0
                  return (
                    <div
                      key={criterion.key}
                      className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 lg:grid-cols-[minmax(0,1fr)_280px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-xs font-black text-white">
                            {index + 1}
                          </span>
                          <p className="text-sm font-bold leading-snug text-gray-950">
                            {criterion.label}
                          </p>
                        </div>
                      </div>

                      <div
                        className="grid grid-cols-5 gap-2"
                        role="radiogroup"
                        aria-label={`Điểm ${criterion.label}`}
                      >
                        {FACILITY_EVALUATION_SCORE_VALUES.map((value) => (
                          <ScoreRadio
                            key={value}
                            criterionKey={criterion.key}
                            value={value}
                            checked={selected === value}
                            onChange={(nextValue) =>
                              setScores((current) => ({
                                ...current,
                                [criterion.key]: nextValue,
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="text-sm font-bold text-gray-950">
                6. Điều bạn muốn leader thay đổi sớm nhất
              </label>
              <Textarea
                value={improvementNote}
                onChange={(event) => setImprovementNote(event.target.value)}
                placeholder="Nhập góp ý cụ thể..."
                className="mt-2 min-h-28"
              />
            </div>
          </section>
        </section>

        <footer className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-700">
              {missingScoreCount > 0
                ? `${missingScoreCount} tiêu chí chưa chọn`
                : 'Đã chọn đủ 5 tiêu chí'}
            </div>
            <Button
              type="button"
              variant="mindx"
              onClick={submitForm}
              disabled={!canSubmit || submitting}
              className="h-10 px-5"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </Button>
          </div>
        </footer>
      </div>
    </main>
  )
}
