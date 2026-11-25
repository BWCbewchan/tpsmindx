'use client'

import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
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
  Calendar,
  CheckCircle2,
  FileSignature,
  FileText,
  GraduationCap,
  Loader2,
  Monitor,
  School,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type RegistrationRowForScoring = {
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
  can_score?: boolean
}

type LectureReviewScoringModalProps = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  application: RegistrationRowForScoring | null
  token?: string | null
}

function formatDateDisplay(value?: string | null, timeValue?: string | null): string {
  return formatReviewDateTime(value, timeValue)
}

export function LectureReviewScoringModal({
  open,
  onClose,
  onSaved,
  application,
  token,
}: LectureReviewScoringModalProps) {
  const [format, setFormat] = useState<'online' | 'offline'>('offline')
  const [answers, setAnswers] = useState<Record<number, LectureReviewAnswer>>({})
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize data when application changes
  useEffect(() => {
    if (!open || !application) return

    // Pre-populate if already in application row
    if (application.evaluation_format === 'online') {
      setFormat('online')
    } else {
      setFormat('offline')
    }

    if (application.evaluation_general_feedback) {
      setGeneralFeedback(application.evaluation_general_feedback)
    } else {
      setGeneralFeedback('')
    }

    const existingDetails = application.evaluation_details
    if (existingDetails && typeof existingDetails === 'object' && existingDetails.scores) {
      setAnswers(existingDetails.scores)
    } else {
      setAnswers({})
    }

    // Fetch latest details from server to ensure fresh state
    let active = true
    setIsLoading(true)
    fetch(`/api/lecture-review-applications/${application.id}/score`, {
      headers: authHeaders(token),
    })
      .then((res) => res.json())
      .then((payload) => {
        if (!active || !payload.success || !payload.data) return
        const data = payload.data
        if (data.evaluation_format === 'offline') {
          setFormat('offline')
        }
        if (data.evaluation_general_feedback) {
          setGeneralFeedback(data.evaluation_general_feedback)
        }
        const details = data.evaluation_details
        if (details && typeof details === 'object' && details.scores) {
          setAnswers(details.scores)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [application, open, token])

  // Calculate live total score
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

  // Handle option select
  const handleSelectLevel = (criterionId: number, score: 1 | 2 | 3 | 4 | 5) => {
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
    setAnswers((prev) => ({
      ...prev,
      [criterionId]: {
        score: prev[criterionId]?.score || 0,
        note,
      },
    }))
  }

  // Submit scoring
  const handleSave = async () => {
    if (!application) return

    if (missingCount > 0) {
      const confirmSave = window.confirm(
        `Hiện tại còn ${missingCount} tiêu chí chưa được chọn điểm. Bạn có chắc chắn muốn lưu bảng điểm này không?`,
      )
      if (!confirmSave) return
    }

    setIsSaving(true)
    try {
      const res = await fetch(
        `/api/lecture-review-applications/${application.id}/score`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({
            evaluationFormat: format,
            scores: answers,
            generalFeedback,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi lưu bảng điểm')
      }

      toast.success('Đã lưu bảng điểm duyệt giảng thành công!')
      onSaved?.()
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Lỗi kết nối khi lưu bảng điểm')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !application) return null

  // Group criteria by section
  const criteriaBySection = LECTURE_REVIEW_SECTIONS.map((sec) => ({
    ...sec,
    criteria: LECTURE_REVIEW_CRITERIA.filter((c) => c.sectionNumber === sec.number),
  }))

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-2 md:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* ================= HEADER (Đồng bộ phong cách MindX) ================= */}
        <div className="relative border-b border-gray-200 bg-white px-6 py-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide text-[#a1001f]">
            Bảng Đánh Giá Năng Lực Giảng Dạy Giáo Viên
          </h2>
          <p className="mt-1 text-xs text-gray-500 font-medium">
            [Tập huấn] Tiêu chuẩn đánh giá duyệt giảng MindX · Thang điểm 5 mức độ (1 - 5 điểm)
          </p>
        </div>

        {/* ================= GENERAL INFO HEADER (Đồng bộ nhãn label gọn gàng theo Demo) ================= */}
        <div className="border-b border-gray-200 bg-gray-50/80 px-6 py-4 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3.5 text-sm">
            {/* 1. Tên giám khảo (Label đồng bộ) */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#a1001f]" />
                Tên giám khảo:
              </span>
              <span className="font-bold text-gray-900 text-sm">
                {application.reviewer_name || 'Ban Giám Khảo'}
              </span>
            </div>

            {/* 2. Hình thức đánh giá (Offline/Online) */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <School className="h-3.5 w-3.5 text-[#a1001f]" />
                Hình thức đánh giá:
              </span>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFormat('offline')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition',
                    format === 'offline'
                      ? 'bg-[#a1001f] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  <School className="h-3.5 w-3.5" /> Offline
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('online')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition',
                    format === 'online'
                      ? 'bg-[#a1001f] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" /> Online
                </button>
              </div>
            </div>

            {/* 3. Họ và tên giáo viên được đánh giá */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-[#a1001f]" />
                Họ và tên giáo viên:
              </span>
              <span className="font-bold text-gray-950 text-sm">
                {application.candidate_name}
              </span>
            </div>

            {/* 4. LMS giáo viên được đánh giá (Label đồng bộ) */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#a1001f]" />
                LMS giáo viên:
              </span>
              <span className="font-bold text-gray-900 text-sm font-mono">
                {application.lms_code}
              </span>
            </div>

            {/* 5. Ngày đánh giá */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#a1001f]" />
                Ngày đánh giá:
              </span>
              <span className="font-bold text-gray-900 text-sm">
                {formatDateDisplay(application.review_date, application.review_time)}
              </span>
            </div>

            {/* 6. Tổng điểm đạt được & Trạng thái Pass */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 min-w-[140px] shrink-0 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#a1001f]" />
                Tổng điểm:
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-xl font-mono text-[#a1001f]">
                  {totalScore}
                </span>
                <span className="text-xs font-bold text-gray-400">
                  / {LECTURE_REVIEW_MAX_SCORE}đ
                </span>
                <span
                  className={cn(
                    'ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs',
                    isPass
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300',
                  )}
                >
                  {isPass ? '✓ Đạt duyệt giảng (>= 60đ)' : 'Chưa đạt (< 60đ)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SCROLLABLE CONTENT (RUBRIC & NHẬN XÉT) ================= */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 space-y-6 bg-gray-50/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" />
              <p className="mt-2 text-sm font-medium">Đang tải chi tiết bảng điểm...</p>
            </div>
          ) : (
            <>
              {/* Danh sách 4 Phần và 25 Tiêu chí */}
              {criteriaBySection.map((section) => (
                <div
                  key={section.number}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs"
                >
                  {/* Tiêu đề Phần (Đồng bộ màu đỏ chủ đạo MindX) */}
                  <div className="bg-[#a1001f] px-4 py-2.5 text-white flex items-center justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold text-white">
                          {section.number}
                        </span>
                        {section.title}
                      </h3>
                      {section.description && (
                        <p className="text-[11px] text-white/80 mt-0.5 font-normal">
                          {section.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold bg-black/20 px-2.5 py-1 rounded-md shrink-0">
                      {section.criteria.length} tiêu chí
                    </span>
                  </div>

                  {/* Danh sách tiêu chí trong Phần */}
                  <div className="divide-y divide-gray-100 p-3 md:p-5 space-y-5">
                    {section.criteria.map((criterion) => {
                      const currentAnswer = answers[criterion.id]
                      const currentScore = Number(currentAnswer?.score) || 0

                      return (
                        <div
                          key={criterion.id}
                          className="pt-4 first:pt-0 space-y-3"
                        >
                          {/* Tên tiêu chí */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-[#a1001f] border border-red-200 shrink-0">
                                {criterion.id}
                              </span>
                              <h4 className="font-bold text-gray-900 text-sm">
                                {criterion.name}
                                <span className="text-[#a1001f] ml-1">*</span>
                              </h4>
                            </div>

                            {/* Điểm của tiêu chí */}
                            <div className="flex items-center gap-2">
                              {currentScore > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {currentScore} / 5 điểm
                                </span>
                              ) : (
                                <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                                  Chưa chấm
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Guidance checklist cho Phần 1 (nếu có) */}
                          {criterion.guidance && criterion.guidance.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-950 space-y-1">
                              {criterion.guidance.map((gText, gIndex) => (
                                <p key={gIndex} className="leading-relaxed">
                                  • {gText}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* 5 Mức độ (1 - 5 điểm) dạng danh sách dòng chọn rõ ràng, không rối mắt */}
                          <div className="space-y-1.5">
                            {criterion.levels.map((level) => {
                              const isSelected = currentScore === level.score

                              return (
                                <button
                                  key={level.score}
                                  type="button"
                                  onClick={() =>
                                    handleSelectLevel(criterion.id, level.score)
                                  }
                                  className={cn(
                                    'w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-start sm:items-center justify-between gap-3 shadow-2xs cursor-pointer',
                                    isSelected
                                      ? 'bg-red-50/70 border-[#a1001f] text-gray-950 font-medium ring-1 ring-[#a1001f]/30'
                                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50/80 hover:border-gray-300',
                                  )}
                                >
                                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                    <span
                                      className={cn(
                                        'h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-all',
                                        isSelected
                                          ? 'border-[#a1001f] bg-[#a1001f]'
                                          : 'border-gray-300 bg-white',
                                      )}
                                    >
                                      {isSelected && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                      )}
                                    </span>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                                      <span
                                        className={cn(
                                          'font-bold text-xs shrink-0',
                                          isSelected
                                            ? 'text-[#a1001f]'
                                            : 'text-gray-900',
                                        )}
                                      >
                                        Mức {level.score} · {level.label}:
                                      </span>
                                      <span className="text-xs text-gray-700 leading-relaxed">
                                        {level.detail}
                                      </span>
                                    </div>
                                  </div>
                                  <span
                                    className={cn(
                                      'shrink-0 text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition-colors',
                                      isSelected
                                        ? 'bg-[#a1001f] text-white border-[#a1001f]'
                                        : 'bg-gray-100 text-gray-600 border-gray-200',
                                    )}
                                  >
                                    {level.score} điểm
                                  </span>
                                </button>
                              )
                            })}
                          </div>

                          {/* Ghi chú thêm cho tiêu chí */}
                          <div className="pt-1">
                            <input
                              type="text"
                              value={currentAnswer?.note || ''}
                              onChange={(e) =>
                                handleNoteChange(criterion.id, e.target.value)
                              }
                              placeholder="Ghi chú thêm cho tiêu chí này (tùy chọn)..."
                              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15 focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* ================= NHẬN XÉT CHUNG ================= */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FileSignature className="h-4 w-4 text-[#a1001f]" />
                  <span>Nhận xét chung cho giáo viên</span>
                </div>
                <p className="text-xs text-gray-500">
                  Nhập đánh giá tổng quan về kỹ năng sư phạm, năng lực chuyên môn, tác phong và định hướng phát triển cho giáo viên.
                </p>
                <textarea
                  rows={4}
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  placeholder="Nhập nhận xét chi tiết, góp ý nâng cao năng lực giảng dạy cho giáo viên..."
                  className="w-full text-xs p-3 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15 focus:outline-none leading-relaxed transition-all"
                />
              </div>
            </>
          )}
        </div>

        {/* ================= STICKY FOOTER ================= */}
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          {/* Summary Indicator */}
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <div className="flex items-baseline gap-1">
              <span className="text-gray-600 font-medium">Tổng điểm:</span>
              <span className="text-xl font-black font-mono text-[#a1001f]">
                {totalScore}
              </span>
              <span className="text-gray-400 font-bold">
                / {LECTURE_REVIEW_MAX_SCORE}đ
              </span>
            </div>

            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs',
                isPass
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300',
              )}
            >
              {isPass ? '✓ Đạt duyệt giảng' : 'Chưa đạt duyệt giảng'}
            </span>

            <div className="text-xs font-medium text-gray-600">
              {missingCount > 0 ? (
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  Còn {missingCount} / {LECTURE_REVIEW_CRITERIA.length} tiêu chí chưa chấm
                </span>
              ) : (
                <span className="text-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Đã hoàn tất 25/25 tiêu chí
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#a1001f] px-6 text-xs font-bold text-white shadow-lg shadow-[#a1001f]/15 hover:bg-[#850019] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4" /> Lưu bảng điểm
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
