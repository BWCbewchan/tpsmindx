'use client'

import { PageHeader } from '@/components/PageHeader'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { formatReviewDateTime } from '@/lib/format-date'
import {
  LECTURE_REVIEW_CRITERIA,
  LECTURE_REVIEW_MAX_SCORE,
  LECTURE_REVIEW_SECTIONS,
  calculateLectureReviewTotalScore,
  isLectureReviewPassed,
  type LectureReviewAnswer,
} from '@/lib/lecture-review-criteria'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileSignature,
  GraduationCap,
  Loader2,
  Monitor,
  School,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type ApplicationDetail = {
  id: number
  candidate_name: string
  lms_code: string
  reviewer_name: string
  review_date: string
  review_time?: string | null
  scoring_status?: string | null
  evaluation_score?: number | string | null
  training_status?: string | null
  evaluation_format?: string | null
  evaluation_details?: any
  evaluation_general_feedback?: string | null
  evaluated_at?: string | null
  evaluated_by_name?: string | null
  canScore: boolean
}

function formatDateDisplay(value?: string | null, timeValue?: string | null): string {
  return formatReviewDateTime(value, timeValue)
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
      {children}
      {required && <span className="ml-1 text-[#b00020]">*</span>}
    </label>
  )
}

const LEVEL_SCORE_STYLES: Record<
  number,
  {
    buttonChecked: string
    buttonHover: string
    circleChecked: string
    labelChecked: string
    badge: string
  }
> = {
  1: {
    buttonChecked: 'border-red-400 bg-red-50/70 border-l-4 border-l-red-600 shadow-2xs',
    buttonHover: 'hover:border-red-300 hover:bg-red-50/30',
    circleChecked: 'border-red-600 bg-red-600 text-white shadow-sm ring-4 ring-red-500/20',
    labelChecked: 'text-red-700',
    badge: 'border-red-200 bg-red-50 text-red-700',
  },
  2: {
    buttonChecked: 'border-orange-400 bg-orange-50/70 border-l-4 border-l-orange-500 shadow-2xs',
    buttonHover: 'hover:border-orange-300 hover:bg-orange-50/30',
    circleChecked: 'border-orange-500 bg-orange-500 text-white shadow-sm ring-4 ring-orange-500/20',
    labelChecked: 'text-orange-700',
    badge: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  3: {
    buttonChecked: 'border-amber-400 bg-amber-50/70 border-l-4 border-l-amber-500 shadow-2xs',
    buttonHover: 'hover:border-amber-300 hover:bg-amber-50/30',
    circleChecked: 'border-amber-500 bg-amber-500 text-white shadow-sm ring-4 ring-amber-500/20',
    labelChecked: 'text-amber-800',
    badge: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  4: {
    buttonChecked: 'border-lime-400 bg-lime-50/70 border-l-4 border-l-lime-600 shadow-2xs',
    buttonHover: 'hover:border-lime-300 hover:bg-lime-50/30',
    circleChecked: 'border-lime-600 bg-lime-600 text-white shadow-sm ring-4 ring-lime-500/20',
    labelChecked: 'text-lime-800',
    badge: 'border-lime-300 bg-lime-50 text-lime-800',
  },
  5: {
    buttonChecked: 'border-emerald-500 bg-emerald-50/70 border-l-4 border-l-emerald-600 shadow-2xs',
    buttonHover: 'hover:border-emerald-300 hover:bg-emerald-50/30',
    circleChecked: 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-500/20',
    labelChecked: 'text-emerald-800',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
}

export function LectureReviewScoringPageClient({
  applicationId,
}: {
  applicationId: string
}) {
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [appData, setAppData] = useState<ApplicationDetail | null>(null)
  const [format, setFormat] = useState<'online' | 'offline'>('offline')
  const [answers, setAnswers] = useState<Record<number, LectureReviewAnswer>>({})
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Fetch scoring application details
  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetch(`/api/lecture-review-applications/${applicationId}/score`, {
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Không thể tải dữ liệu phiếu chấm điểm')
        }
        return payload.data as ApplicationDetail
      })
      .then((data) => {
        setAppData(data)
        if (data.evaluation_format === 'online') {
          setFormat('online')
        } else {
          setFormat('offline')
        }
        if (data.evaluation_general_feedback) {
          setGeneralFeedback(data.evaluation_general_feedback)
        }
        const existingDetails = data.evaluation_details
        if (existingDetails && typeof existingDetails === 'object' && existingDetails.scores) {
          setAnswers(existingDetails.scores)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Lỗi khi tải bảng điểm')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [applicationId, authLoading, token])

  // Real-time calculation of total score and completion
  const totalScore = useMemo(
    () => calculateLectureReviewTotalScore(answers),
    [answers],
  )
  const isPass = isLectureReviewPassed(totalScore)
  const selectedCount = useMemo(
    () => Object.values(answers).filter((a) => (Number(a?.score) || 0) > 0).length,
    [answers],
  )
  const missingCount = LECTURE_REVIEW_CRITERIA.length - selectedCount

  // Handle select level
  const handleSelectLevel = (criterionId: number, score: 1 | 2 | 3 | 4 | 5) => {
    if (!appData?.canScore) return
    setAnswers((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        score,
      },
    }))
  }

  // Handle criterion note change
  const handleNoteChange = (criterionId: number, note: string) => {
    if (!appData?.canScore) return
    setAnswers((prev) => ({
      ...prev,
      [criterionId]: {
        score: prev[criterionId]?.score || 0,
        note,
      },
    }))
  }

  // Handle Save
  const handleSave = async () => {
    if (!appData) return

    if (!appData.canScore) {
      toast.error('Không có quyền', {
        message: 'Bạn không có quyền lưu điểm cho phiếu đánh giá này.',
      })
      return
    }

    if (missingCount > 0) {
      const confirmSave = window.confirm(
        `Hiện tại còn ${missingCount} tiêu chí chưa được chọn điểm. Bạn có chắc chắn muốn lưu bảng điểm này không?`,
      )
      if (!confirmSave) return
    }

    setIsSaving(true)
    try {
      const response = await fetch(
        `/api/lecture-review-applications/${applicationId}/score`,
        {
          method: 'POST',
          headers: {
            ...authHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format,
            scores: answers,
            generalFeedback,
          }),
        },
      )

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Lỗi khi lưu bảng điểm')
      }

      toast.success('Lưu bảng điểm thành công!', {
        message: `Tổng điểm: ${((totalScore / 125) * 10).toFixed(1)}/10đ (${totalScore}/${LECTURE_REVIEW_MAX_SCORE}đ) (${isPass ? 'Đạt duyệt giảng' : 'Chưa đạt duyệt giảng'
          })`,
      })

      // Update appData state
      setAppData((prev) =>
        prev
          ? {
            ...prev,
            scoring_status: 'Đã chấm',
            evaluation_score: totalScore,
            training_status: isPass ? 'Đạt duyệt giảng' : 'Chưa đạt',
          }
          : null,
      )

      // Navigate back to list after short delay
      setTimeout(() => {
        router.push('/admin/quan-ly-dang-ky-duyet-giang')
      }, 700)
    } catch (err) {
      toast.error('Không thể lưu bảng điểm', {
        message: err instanceof Error ? err.message : 'Vui lòng thử lại sau',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <PageLayout background="white" maxWidth="7xl" padding="responsive" className="px-4 sm:px-6 lg:px-8">
        <PageLayoutContent spacing="xl" className="pb-16">
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#b00020]" />
            <p className="text-sm font-semibold text-gray-600">Đang tải bảng điểm duyệt giảng...</p>
          </div>
        </PageLayoutContent>
      </PageLayout>
    )
  }

  if (error || !appData) {
    return (
      <PageLayout background="white" maxWidth="7xl" padding="responsive" className="px-4 sm:px-6 lg:px-8">
        <PageLayoutContent spacing="xl" className="pb-16">
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-600" />
            <div>
              <h2 className="text-lg font-bold text-red-900">Không thể tải thông tin phiếu</h2>
              <p className="mt-1 text-sm text-red-700">{error || 'Không tìm thấy phiếu duyệt giảng yêu cầu'}</p>
            </div>
            <Link
              href="/admin/quan-ly-dang-ky-duyet-giang"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>
          </div>
        </PageLayoutContent>
      </PageLayout>
    )
  }

  return (
    <PageLayout background="white" maxWidth="7xl" padding="responsive" className="px-4 sm:px-6 lg:px-8">
      <PageLayoutContent spacing="xl" className="pb-16">
        {/* PAGE HEADER */}
        <PageHeader
          title="Bảng Đánh Giá Năng Lực Giảng Dạy Giáo Viên"
          description="[Tập huấn] Tiêu chuẩn đánh giá duyệt giảng MindX · Thang điểm 5 mức độ (1 - 5 điểm)"
          actions={
            <Link
              href="/admin/quan-ly-dang-ky-duyet-giang"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>
          }
        />

        {/* KHỐI PHIẾU ĐÁNH GIÁ (CHUẨN TOÀN BỘ TRONG 1 THẺ NHƯ CHECKOUT/CREATE) */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* HEADER PHIẾU */}
          <div className="border-b border-gray-200 bg-gray-50/70 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b00020]">
              <ClipboardCheck className="h-4 w-4" />
              Phiếu đánh giá duyệt giảng
            </div>
            <h2 className="mt-1 text-lg font-bold text-gray-950">
              Ứng viên: {appData.candidate_name}
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {!appData.canScore && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-2xs">
                <Eye className="h-4 w-4 shrink-0 text-amber-700" />
                <span>Bạn chỉ có quyền được xem bảng điểm này</span>
              </div>
            )}

            {/* THÔNG TIN CHUNG */}
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Tên giám khảo */}
              <div className="space-y-1.5">
                <FieldLabel>Tên giám khảo</FieldLabel>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={appData.reviewer_name || '-'}
                    readOnly
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold text-gray-800 outline-none"
                  />
                </div>
              </div>

              {/* Hình thức đánh giá */}
              <div className="space-y-1.5">
                <FieldLabel required>Hình thức đánh giá</FieldLabel>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hình thức đánh giá">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={format === 'offline'}
                    onClick={() => setFormat('offline')}
                    disabled={!appData.canScore}
                    className={cn(
                      'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition shadow-2xs',
                      format === 'offline'
                        ? 'border-[#b00020] bg-[#fff5f6] text-[#b00020]'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                      !appData.canScore && 'cursor-not-allowed opacity-80',
                    )}
                  >
                    <School className="h-4 w-4" />
                    Offline
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={format === 'online'}
                    onClick={() => setFormat('online')}
                    disabled={!appData.canScore}
                    className={cn(
                      'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition shadow-2xs',
                      format === 'online'
                        ? 'border-[#b00020] bg-[#fff5f6] text-[#b00020]'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                      !appData.canScore && 'cursor-not-allowed opacity-80',
                    )}
                  >
                    <Monitor className="h-4 w-4" />
                    Online
                  </button>
                </div>
              </div>

              {/* Họ và tên giáo viên */}
              <div className="space-y-1.5">
                <FieldLabel>Họ và tên giáo viên</FieldLabel>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={appData.candidate_name || '-'}
                    readOnly
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold text-gray-800 outline-none"
                  />
                </div>
              </div>

              {/* LMS giáo viên */}
              <div className="space-y-1.5">
                <FieldLabel>Mã LMS giáo viên</FieldLabel>
                <input
                  value={appData.lms_code || '-'}
                  readOnly
                  className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-sm font-bold text-gray-800 outline-none"
                />
              </div>

              {/* Ngày đánh giá */}
              <div className="space-y-1.5">
                <FieldLabel>Ngày đánh giá</FieldLabel>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={formatDateDisplay(appData.review_date, appData.review_time)}
                    readOnly
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold text-gray-800 outline-none"
                  />
                </div>
              </div>

              {/* Thống kê điểm hiện tại */}
              <div className="space-y-1.5">
                <FieldLabel>Tổng điểm &amp; Đánh giá</FieldLabel>
                <div className="flex h-11 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3.5">
                  <span className="font-mono text-sm font-bold text-gray-900">
                    {((totalScore / 125) * 10).toFixed(1)}/10đ{' '}
                    <span className="text-xs font-normal text-gray-400">
                      ({totalScore}/{LECTURE_REVIEW_MAX_SCORE}đ)
                    </span>
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-bold border shadow-2xs',
                      isPass
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700',
                    )}
                  >
                    {isPass ? 'Đạt duyệt giảng' : 'Chưa đạt (< 60đ)'}
                  </span>
                </div>
              </div>
            </div>

            {/* CÁC PHẦN TIÊU CHÍ (LEVEL LIST RUBRIC) */}
            <div className="space-y-6 pt-2">
              {LECTURE_REVIEW_SECTIONS.map((section) => {
                const criteriaInSection = LECTURE_REVIEW_CRITERIA.filter(
                  (c) => c.sectionNumber === section.number,
                )
                const sectionCompletedCount = criteriaInSection.filter(
                  (c) => (answers[c.id]?.score || 0) > 0,
                ).length

                return (
                  <div
                    key={section.number}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    {/* SECTION HEADER */}
                    <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#b00020] text-xs font-bold text-white shadow-2xs mt-0.5 sm:mt-0">
                          {section.number}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                            {section.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-gray-500">{section.description}</p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center self-start sm:self-center rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                        {sectionCompletedCount}/{criteriaInSection.length} tiêu chí đã chấm
                      </span>
                    </div>

                    {/* CRITERIA LIST */}
                    <div className="divide-y divide-gray-100">
                      {criteriaInSection.map((criterion) => {
                        const selectedScore = answers[criterion.id]?.score
                        const selectedLevel = criterion.levels.find(
                          (lvl) => lvl.score === selectedScore,
                        )

                        return (
                          <div
                            key={criterion.id}
                            className="p-4 sm:p-5 space-y-3"
                          >
                            {/* CRITERION HEADER */}
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-gray-100 px-1.5 font-mono text-xs font-bold text-gray-700">
                                  #{criterion.id}
                                </span>
                                <h4 className="text-sm sm:text-base font-bold text-gray-900">
                                  {criterion.name}
                                </h4>
                              </div>

                              <div className="self-start sm:self-auto">
                                {selectedScore ? (
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-2xs',
                                      LEVEL_SCORE_STYLES[selectedScore]?.badge || 'border-gray-200 bg-gray-50 text-gray-700',
                                    )}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Mức {selectedScore} ({selectedScore}đ) · {selectedLevel?.label}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                                    Chưa chấm
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* GUIDANCE IF AVAILABLE */}
                            {criterion.guidance && criterion.guidance.length > 0 && (
                              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 space-y-1 text-xs text-gray-700">
                                {criterion.guidance.map((guide, gIdx) => (
                                  <p key={gIdx} className="leading-relaxed">
                                    {guide}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* 5 LEVELS LIST (LEVEL LIST RUBRIC VỚI MÀU SẮC PHÂN CẤP TỪ 1 ĐẾN 5) */}
                            <div
                              className="space-y-2"
                              role="radiogroup"
                              aria-label={`Tiêu chí ${criterion.id}: ${criterion.name}`}
                            >
                              {criterion.levels.map((level) => {
                                const checked = selectedScore === level.score
                                const levelStyle = LEVEL_SCORE_STYLES[level.score]

                                return (
                                  <button
                                    key={level.score}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    disabled={!appData.canScore}
                                    onClick={() => handleSelectLevel(criterion.id, level.score)}
                                    className={cn(
                                      'grid w-full grid-cols-[40px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3 text-left transition-all border rounded-lg',
                                      checked
                                        ? levelStyle?.buttonChecked
                                        : cn('border-gray-200 bg-white hover:border-gray-300', levelStyle?.buttonHover),
                                      !appData.canScore && 'cursor-default opacity-85',
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                                        checked
                                          ? levelStyle?.circleChecked
                                          : 'border-gray-300 bg-white text-gray-500',
                                      )}
                                    >
                                      {level.score}
                                    </span>
                                    <span className="min-w-0">
                                      <span
                                        className={cn(
                                          'text-xs font-bold uppercase tracking-wider',
                                          checked ? levelStyle?.labelChecked : 'text-gray-500',
                                        )}
                                      >
                                        Mức {level.score} ({level.score} điểm) · {level.label}
                                      </span>
                                      <span
                                        className={cn(
                                          'mt-0.5 block text-xs sm:text-sm leading-relaxed',
                                          checked ? 'font-medium text-gray-950' : 'text-gray-700',
                                        )}
                                      >
                                        {level.detail}
                                      </span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>

                            {/* CRITERION NOTE */}
                            <div className="pt-0.5">
                              <input
                                type="text"
                                value={answers[criterion.id]?.note || ''}
                                readOnly={!appData.canScore}
                                onChange={(e) => handleNoteChange(criterion.id, e.target.value)}
                                placeholder={appData.canScore ? 'Ghi chú cụ thể cho tiêu chí này (tùy chọn)...' : 'Không có ghi chú'}
                                className={cn(
                                  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10',
                                  !appData.canScore && 'bg-gray-50 cursor-default',
                                )}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* NHẬN XÉT CHUNG CỦA GIÁM KHẢO */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-2xs space-y-2.5">
              <div>
                <FieldLabel>Nhận xét &amp; Góp ý chung của Giám khảo</FieldLabel>
                <p className="mt-0.5 text-xs text-gray-500">
                  Ghi nhận tổng quan về phong thái, điểm cần phát huy và các điểm cần cải thiện trước khi nhận lớp chính thức.
                </p>
              </div>
              <textarea
                value={generalFeedback}
                onChange={(e) => setGeneralFeedback(e.target.value)}
                readOnly={!appData.canScore}
                rows={4}
                className={cn(
                  'w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-[#b00020] focus:ring-2 focus:ring-[#b00020]/10',
                  !appData.canScore && 'bg-gray-50 cursor-default',
                )}
                placeholder={appData.canScore ? 'Nhập nhận xét tổng quan về buổi dạy thử của giáo viên...' : 'Chưa có nhận xét tổng quan'}
              />
            </div>
          </div>

          {/* FOOTER HÀNH ĐỘNG CỦA PHIẾU (LIỀN MẠCH DƯỚI CÙNG CARD - GIỐNG CHECKOUT/CREATE) */}
          <div className="flex flex-col-reverse gap-4 border-t border-gray-200 bg-gray-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/quan-ly-dang-ky-duyet-giang"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Link>

              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 shadow-2xs text-xs">
                <span className="text-gray-500">Tổng điểm:</span>
                <span className="font-mono text-sm font-bold text-gray-900">
                  {totalScore} <span className="text-xs font-normal text-gray-400">/{LECTURE_REVIEW_MAX_SCORE}đ</span>
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-bold border shadow-2xs',
                    isPass
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700',
                  )}
                >
                  {isPass ? 'Đạt duyệt giảng' : 'Chưa đạt (< 60đ)'}
                </span>
              </div>

              <div className="text-xs font-medium text-gray-600">
                {missingCount === 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã chọn đủ 25/25 tiêu chí
                  </span>
                ) : (
                  <span>
                    Đã chấm <strong className="text-gray-900">{selectedCount}/25</strong> (Còn {missingCount} tiêu chí)
                  </span>
                )}
              </div>
            </div>

            <div>
              {appData.canScore ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#b00020] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#90001a] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <FileSignature className="h-4 w-4" />
                      Lưu bảng điểm
                    </>
                  )}
                </button>
              ) : (
                <div className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 text-xs font-bold text-slate-600 shadow-2xs">
                  <Eye className="h-4 w-4 text-slate-500" />
                  Chế độ chỉ xem điểm
                </div>
              )}
            </div>
          </div>
        </section>
      </PageLayoutContent>
    </PageLayout>
  )
}
