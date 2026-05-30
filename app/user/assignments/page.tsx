'use client'



import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Modal } from '@/components/ui/modal'
import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Tabs } from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { isExamInCurrentVietnamMonth } from '@/lib/giaitrinh-eligibility'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { useTeacher } from '@/lib/teacher-context'
import {
    AlertCircle,
    ArrowLeft,
    Award,
    BookOpen,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    FilterX,
    RefreshCw,
    Send,
    Trophy,
    XCircle,
} from 'lucide-react'

import { toast } from '@/lib/app-toast'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Assignment {
  id: number
  video_id?: number
  video_title: string
  assignment_title: string
  assignment_type: string
  total_points: number
  passing_score: number
  time_limit_minutes: number
  max_attempts: number
  due_date: string
  status: string
  question_count: number
  video_completion_status?: string
  recent_submission?: {
    score: number
    percentage: number
    is_passed: boolean
    submitted_at: string
    attempt_number: number
  }
}

interface Question {
  id: number
  question_text: string
  question_type: string
  correct_answer: string
  options: string[]
  image_url: string
  points: number
  order_number: number
}

interface Submission {
  id: number
  teacher_code: string
  assignment_id: number
  attempt_number: number
  score: number
  total_points: number
  percentage: number
  is_passed: boolean
  status: string
  started_at: string
  submitted_at: string
  time_spent_seconds: number
}

interface ExamAssignment {
  id: number
  teacher_code: string
  exam_type: 'expertise' | 'experience'
  registration_type: 'official' | 'additional'
  block_code: string
  subject_code: string
  open_at: string
  close_at: string
  assignment_status:
    | 'assigned'
    | 'in_progress'
    | 'submitted'
    | 'expired'
    | 'graded'
  score: number | null
  score_status: 'null' | 'auto_zero' | 'graded'
  selected_set_id: number
  set_code: string
  set_name: string
  total_points: number
  passing_score: number
  duration_minutes: number
  correct_answers?: number
  total_questions?: number
  score_handling_note?: string
  explanation_status?: 'pending' | 'accepted' | 'rejected'
  explanation_id?: number | null
  /** Đã gửi giải trình (cờ trên chuyen_sau_results) */
  da_giai_thich?: boolean
  admin_note?: string
  is_open?: boolean
  can_take?: boolean
}

interface EffectiveExamScore {
  score: number | null
  isMissedCurrentMonth: boolean
}

type ScoreTypeFilter = 'all' | 'expertise' | 'experience'
type ScoreResultFilter =
  | 'all'
  | 'done'
  | 'waiting'
  | 'pending'
  | 'accepted'
  | 'rejected'

interface TrainingSubmissionSummary {
  assignment_id: number
  score: number
  percentage: number
  is_passed: boolean
  submitted_at: string
  attempt_number: number
}

const DEFAULT_PASS_MIN_EXCLUSIVE = 5

function getPassingScore(item: ExamAssignment): number | null {
  const parsed = Number(item.passing_score)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function isExamPassed(item: ExamAssignment, score: number | null): boolean {
  if (score === null) return false
  const passingScore = getPassingScore(item)
  if (passingScore !== null) return score >= passingScore
  return score > DEFAULT_PASS_MIN_EXCLUSIVE
}

const extractCodeFromEmail = (email: string): string | null => {
  const match = email.match(/^([^@]+)@/)
  return match ? match[1] : null
}

export default function TeacherAssignmentPage() {
  const { user, token } = useAuth()
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher()
  const router = useRouter()
  const pathname = usePathname()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [examAssignments, setExamAssignments] = useState<ExamAssignment[]>([])
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(
    null,
  )
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<{ [key: number]: string }>({})
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [trainingLoading, setTrainingLoading] = useState(true)
  const [examLoading, setExamLoading] = useState(true)
  const [error, setError] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const [activeMainTab, setActiveMainTab] = useState<
    'available' | 'list' | 'training'
  >('available')

  const [selectedExamMonth, setSelectedExamMonth] = useState('6months')
  const [scoreTypeFilter, setScoreTypeFilter] = useState<ScoreTypeFilter>('all')
  const [scoreResultFilter, setScoreResultFilter] = useState<ScoreResultFilter>(
    'all',
  )
  const [scoreSubjectKeyword, setScoreSubjectKeyword] = useState('')

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [activeStatCard, setActiveStatCard] = useState<
    null | 'expertise' | 'experience' | 'missing'
  >(null)
  const [showPassRateModal, setShowPassRateModal] = useState(false)

  const toggleStatCard = (card: 'expertise' | 'experience' | 'missing') => {
    setActiveStatCard((prev) => (prev === card ? null : card))
  }

  // Auto-expand month when selected
  useEffect(() => {
    if (selectedExamMonth !== '6months' && selectedExamMonth !== 'all') {
      setExpandedMonths((prev) => {
        const next = new Set(prev)
        next.add(selectedExamMonth)
        return next
      })
    }
  }, [selectedExamMonth])

  const toggleMonthExpand = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }

  const clearFilters = () => {
    setScoreSubjectKeyword('')
    setSelectedExamMonth('6months')
    setScoreTypeFilter('all')
    setScoreResultFilter('all')
  }
  const [view, setView] = useState<'list' | 'taking' | 'result'>('list')
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [timerActive, setTimerActive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)
  const isSubmittingRef = useRef(false)
  // Track previous nowTs to detect crossing of open_at boundaries
  const lastNowTsRef = useRef(Date.now())
  const [selectedExamInfo, setSelectedExamInfo] =
    useState<ExamAssignment | null>(null)

  const submitAssignment = useCallback(
    async (skipConfirm?: boolean | React.MouseEvent) => {
      if (!submission) return
      if (isSubmittingRef.current) return

      const isConfirmed = typeof skipConfirm === 'boolean' ? skipConfirm : false

      const unansweredCount = questions.length - Object.keys(answers).length
      if (!isConfirmed && unansweredCount > 0) {
        if (
          !confirm(
            `Bạn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`,
          )
        ) {
          // Scroll to the first unanswered question
          const firstUnansweredQuestion = questions.find((q) => !answers[q.id])
          if (firstUnansweredQuestion) {
            const element = document.getElementById(
              `question-${firstUnansweredQuestion.id}`,
            )
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2')
              setTimeout(
                () =>
                  element.classList.remove(
                    'ring-2',
                    'ring-red-500',
                    'ring-offset-2',
                  ),
                2000,
              )
              toast('Đã chuyển đến câu hỏi chưa hoàn thành', { icon: '👇' })
            }
          }
          return
        }
      }

      try {
        isSubmittingRef.current = true
        setIsSubmitting(true)
        setTimerActive(false)

        // Calculate score synchronously
        let correctCount = 0
        console.log(
          '[Assignment] Starting score calculation for',
          questions.length,
          'questions',
        )

        questions.forEach((question, idx) => {
          const userAnswer = answers[question.id] || ''
          const correctAnswer = (question.correct_answer || '').trim()

          let isCorrect = false
          if (question.question_type === 'multiple_select') {
            // Phải chọn đúng 100% — so sánh 2 mảng
            try {
              const userArr: string[] = JSON.parse(userAnswer || '[]')
              const correctArr: string[] = JSON.parse(correctAnswer || '[]')
              isCorrect =
                userArr.length === correctArr.length &&
                correctArr.every(a => userArr.includes(a))
            } catch { isCorrect = false }
          } else {
            isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()
          }

          if (isCorrect) correctCount++

          console.log(`[Assignment] Q${idx + 1}:`, {
            questionId: question.id,
            userAnswer,
            correctAnswer,
            isCorrect,
          })
        })

        // Tính điểm theo thang 10 dựa trên số câu đúng / tổng câu hỏi
        const totalQuestions = questions.length || 1
        const totalScore = Math.round((correctCount / totalQuestions) * 10 * 100) / 100

        console.log(
          '[Assignment] Score calculation:',
          `${correctCount}/${totalQuestions} correct →`,
          totalScore,
          '/ 10',
        )

        // Ensure score is a valid number
        if (
          isNaN(totalScore) ||
          totalScore === null ||
          totalScore === undefined
        ) {
          console.error(
            '[Assignment] Invalid total score calculated:',
            totalScore,
          )
          toast.error('Lỗi: Không thể tính điểm. Vui lòng thử lại.')
          return
        }

        // Update submission — ngưỡng đạt cố định 7/10 (passing_score đã bị xóa khỏi DB)
        const PASSING_SCORE = 7.0
        const isPassed = totalScore >= PASSING_SCORE

        // Prepare answers payload
        const pointsPerQuestion = 10 / (questions.length || 1)
        const answersPayload = questions.map((q) => {
          const userAnswer = answers[q.id] || ''
          const correctAnswer = (q.correct_answer || '').trim()

          let isCorrect = false
          if (q.question_type === 'multiple_select') {
            try {
              const userArr: string[] = JSON.parse(userAnswer || '[]')
              const correctArr: string[] = JSON.parse(correctAnswer || '[]')
              isCorrect =
                userArr.length === correctArr.length &&
                correctArr.every(a => userArr.includes(a))
            } catch { isCorrect = false }
          } else {
            isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()
          }

          const pointsEarned = isCorrect ? Math.round(pointsPerQuestion * 100) / 100 : 0

          return {
            question_id: q.id,
            answer_text: userAnswer,
            is_correct: isCorrect,
            points_earned: pointsEarned,
          }
        })

        const response = await fetch('/api/training-submissions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: submission.id,
            action: 'grade',
            score: totalScore,
            is_passed: isPassed,
            answers: answersPayload,
          }),
        })

        const data = await response.json()
        if (data.success) {
          setSubmission(data.data)
          setView('result')
        } else {
          toast.error('Lỗi khi nộp bài: ' + data.error)
        }
      } catch (err) {
        console.error('Error submitting assignment:', err)
        toast.error('Lỗi khi nộp bài')
      } finally {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    },
    [answers, currentAssignment, questions, submission],
  )

  const startAssignment = useCallback(
    async (assignment: Assignment) => {
      try {
        if (
          assignment.video_id &&
          !['completed', 'watched'].includes(assignment.video_completion_status || '')
        ) {
          toast.error(
            `Bạn cần hoàn thành xem video "${assignment.video_title}" trước khi làm bài tập này.`,
            { icon: '📺' },
          )
          return
        }

        // 1. Check teacher profile from context to insure data integrity
        if (isTeacherLoading) {
          toast(
            'Đang đồng bộ dữ liệu giáo viên, vui lòng thử lại sau giây lát...',
          )
          return
        }

        if (!teacherProfile) {
          toast.error(
            'Thiếu thông tin giáo viên. Vui lòng tải lại dữ liệu rồi thử lại.',
          )
          return
        }

        // Check required fields directly from profile
        const teacherBranch =
          teacherProfile.branchCurrent || teacherProfile.branchIn
        // Note: teacherProfile.status might be mapped differently, but checking basic existence is safer
        // We assume if profile loaded, it's good enough or we can check branch
        if (!teacherBranch) {
          toast.error(
            'Thiếu thông tin Cơ sở (Branch). Vui lòng cập nhật thông tin.',
          )
          return
        }

        // Fetch questions
        const questionsRes = await fetch(
          `/api/training-assignment-questions?assignment_id=${assignment.id}`,
        )
        const questionsData = await questionsRes.json()

        if (!questionsData.success) {
          toast.error('Không thể tải câu hỏi')
          return
        }

        // Create submission
        const submissionRes = await fetch('/api/training-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_code: teacherCode,
            assignment_id: assignment.id,
            attempt_number: 1,
            teacher_info: {
              full_name: teacherProfile?.name || teacherCode,
              center: teacherProfile?.branchCurrent || '',
              teaching_block: teacherProfile?.programCurrent || '',
              work_email: user?.email || '',
            },
          }),
        })

        const submissionData = await submissionRes.json()
        if (!submissionData.success) {
          toast.error('Không thể bắt đầu bài tập: ' + submissionData.error)
          return
        }

        setCurrentAssignment(assignment)
        setQuestions(questionsData.data)
        setSubmission(submissionData.data)

        // Load saved answers if this is a continuing submission
        if (
          submissionData.existing_answers &&
          Object.keys(submissionData.existing_answers).length > 0
        ) {
          setAnswers(submissionData.existing_answers)
          toast.success('Đã tải lại bài làm cũ của bạn')
        } else {
          setAnswers({})
        }

        setView('taking')

        // Start timer - logic updated to use server started_at and server_time
        if (assignment.time_limit_minutes > 0) {
          let remainingSeconds = assignment.time_limit_minutes * 60

          if (submissionData.data.started_at) {
            const startTime = new Date(submissionData.data.started_at).getTime()

            // Use server time if available to avoid clock drift, fallback to local
            const serverNow = submissionData.server_time
              ? new Date(submissionData.server_time).getTime()
              : Date.now()
            const elapsedSeconds = Math.floor((serverNow - startTime) / 1000)

            // Calculate offset for local countdown
            const clientNow = Date.now()
            // How much ahead/behind is the client vs server?
            const clockOffset = clientNow - serverNow // e.g. +5000ms if client is 5s ahead

            remainingSeconds = Math.max(
              0,
              assignment.time_limit_minutes * 60 - elapsedSeconds,
            )

            console.log('[Assignment] Timer init:', {
              serverStarted: submissionData.data.started_at,
              serverNow: submissionData.server_time,
              elapsed: elapsedSeconds,
              limit: assignment.time_limit_minutes * 60,
              remaining: remainingSeconds,
              offset: clockOffset,
            })
          }

          setTimeRemaining(remainingSeconds)
          setTimerActive(remainingSeconds > 0)

          if (remainingSeconds === 0) {
            // If already expired according to server, submit immediately
            setTimeout(() => submitAssignment(true), 100)
          }
        }
      } catch (err) {
        console.error('Error starting assignment:', err)
        toast.error('Lỗi khi bắt đầu bài tập')
      }
    },
    [
      isTeacherLoading,
      submitAssignment,
      teacherCode,
      teacherProfile,
      user,
    ],
  )

  const fetchAvailableAssignments = useCallback(
    async (isBackgroundUpdate = false) => {
      try {
        setTrainingLoading(true)

        // 1. Fetch assignments list with teacher_code to get video completion status
        const response = await fetch(`/api/training-assignments?status=published&teacher_code=${teacherCode}`)
        const data = await response.json()

        if (data.success) {
          const submissionsMap = new Map<number, TrainingSubmissionSummary>()

          // 2. Fetch all submissions for teacher (instead of N+1 requests)
          if (teacherCode) {
            try {
              // Fetch only graded/submitted submissions, ordered by created_at DESC
              const subRes = await fetch(
                `/api/training-submissions?teacher_code=${teacherCode}&status=graded`,
              )
              const subData: { success?: boolean; data?: TrainingSubmissionSummary[] } =
                await subRes.json()

              if (subData.success && Array.isArray(subData.data)) {
                // Map assignment_id to its LATEST graded submission
                subData.data.forEach((sub: TrainingSubmissionSummary) => {
                  if (!submissionsMap.has(sub.assignment_id)) {
                    submissionsMap.set(sub.assignment_id, sub)
                  }
                })
              }
            } catch (err) {
              console.warn('Failed to batch fetch submissions', err)
            }
          }

          // 3. Merge data
          const assignmentsWithScores = data.data.map(
            (assignment: Assignment) => {
              const latestSubmission = submissionsMap.get(assignment.id)
              if (latestSubmission) {
                return {
                  ...assignment,
                  recent_submission: {
                    score: latestSubmission.score,
                    percentage: latestSubmission.percentage,
                    is_passed: latestSubmission.is_passed,
                    submitted_at: latestSubmission.submitted_at,
                    attempt_number: latestSubmission.attempt_number,
                  },
                }
              }
              return assignment
            },
          )

          setAssignments(assignmentsWithScores)
        }
      } catch (err) {
        console.error('Error fetching assignments:', err)
        setError('Failed to load assignments')
      } finally {
        if (!isBackgroundUpdate) setTrainingLoading(false)
      }
    },
    [teacherCode],
  )

  const fetchExamAssignments = useCallback(
    async (isBackgroundUpdate = false) => {
      try {
        if (!isBackgroundUpdate) setExamLoading(true)

        let canonicalTeacherCode = ''
        if (user?.email) {
          try {
            const res = await fetch(
              `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
              { headers: authHeaders(token) },
            )
            const data = await res.json()
            canonicalTeacherCode = (data?.teacher?.code || '').toString().trim()
            if (canonicalTeacherCode && canonicalTeacherCode !== teacherCode) {
              setTeacherCode(canonicalTeacherCode)
            }
          } catch {
            // Keep fallback behavior below when teacher lookup is unavailable.
          }
        }

        const candidates = new Set<string>()
        const normalizedTeacherCode = teacherCode?.trim()
        if (normalizedTeacherCode) {
          candidates.add(normalizedTeacherCode)
          candidates.add(normalizedTeacherCode.toLowerCase())
          candidates.add(normalizedTeacherCode.toUpperCase())
        }

        if (canonicalTeacherCode) {
          candidates.add(canonicalTeacherCode)
          candidates.add(canonicalTeacherCode.toLowerCase())
          candidates.add(canonicalTeacherCode.toUpperCase())
        }

        if (user?.email) {
          const emailCode = extractCodeFromEmail(user.email)?.trim()
          if (emailCode) {
            candidates.add(emailCode)
            candidates.add(emailCode.toLowerCase())
            candidates.add(emailCode.toUpperCase())
          }
        }

        const teacherCodesParam = encodeURIComponent(
          Array.from(candidates).join(','),
        )
        const effectiveTeacherCode = canonicalTeacherCode || teacherCode
        const baseParams = `teacher_code=${encodeURIComponent(effectiveTeacherCode)}&teacher_codes=${teacherCodesParam}`
        // Fetch full assignment history so score tab filters (6 months/all/custom month)
        // operate on complete data instead of only current month.
        const recentRes = await fetch(`/api/exam-assignments?${baseParams}`, {
          cache: 'no-store',
        })
        const recentData = await recentRes.json()
        if (recentData.success) {
          setExamAssignments(recentData.data || [])
        }

        if (!isBackgroundUpdate) setExamLoading(false)
      } catch (err) {
        console.error('Error fetching exam assignments:', err)
        setError('Failed to load exam assignments')
        if (!isBackgroundUpdate) setExamLoading(false)
      }
    },
    [teacherCode, token, user],
  )

  const searchParams = useSearchParams()
  const startId = searchParams.get('start_assignment_id')

  // Auto-start assignment logic
  useEffect(() => {
    if (startId) {
      if (activeMainTab !== 'training') {
        setActiveMainTab('training')
      } else if (assignments.length > 0 && view === 'list') {
        const target = assignments.find((a) => a.id.toString() === startId)
        if (target) {
          const isVideoFinished =
            target.video_completion_status === 'completed' ||
            target.video_completion_status === 'watched';

          if (
            target.video_id &&
            !isVideoFinished
          ) {
            toast.error(
              `Bạn cần hoàn thành xem video "${target.video_title}" trước khi làm bài kiểm tra.`,
              { icon: '📺' },
            );
            router.replace(pathname || '/user/dao-tao-nang-cao');
            return;
          }
          startAssignment(target);
        }
      }
    }
  }, [startId, activeMainTab, assignments, startAssignment, view, pathname, router])

  // Helper function to safely parse percentage
  const formatPercentage = (
    percentage: number | string | undefined,
  ): string => {
    if (percentage === undefined || percentage === null) return '0.0'
    const num =
      typeof percentage === 'number' ? percentage : parseFloat(percentage)
    return isNaN(num) ? '0.0' : num.toFixed(1)
  }

  // Get teacher code from user email (tránh gọi /api/teachers/info trùng TeacherProvider khi profile đang load)
  useEffect(() => {
    if (teacherCode) return // Already have code
    if (isTeacherLoading) return

    // 1. Try from context first (fastest)
    if (teacherProfile?.code) {
      setTeacherCode(teacherProfile.code.toLowerCase().trim())
      return
    }

    // 2. Fetch from API
    if (user && user.email) {
      ;(async () => {
        try {
          const res = await fetch(
            `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
            { headers: authHeaders(token) },
          )
          const data = await res.json()
          if (data?.teacher?.code) {
            setTeacherCode(data.teacher.code.toLowerCase().trim())
            return          }
        } catch {
          console.warn(
            'Email-based lookup failed, falling back to code extraction',
          )
        }

        // Fallback: extract code from email
        const code = extractCodeFromEmail(user.email)
        if (code) {
          setTeacherCode(code.toLowerCase().trim())
        }
      })()
    }
  }, [isTeacherLoading, teacherCode, teacherProfile, token, user])

  useEffect(() => {
    if (teacherCode) {
      fetchAvailableAssignments()
      fetchExamAssignments()
    }
  }, [teacherCode, fetchAvailableAssignments, fetchExamAssignments])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [submitAssignment])

  // Auto-refetch exam assignments when any exam's open_at boundary is crossed
  useEffect(() => {
    const prev = lastNowTsRef.current
    lastNowTsRef.current = nowTs

    const anyJustOpened = examAssignments.some((item) => {
      if (item.can_take) return false
      if (!['assigned', 'in_progress'].includes(item.assignment_status))
        return false
      const openMs = new Date(item.open_at).getTime()
      return prev < openMs && nowTs >= openMs
    })

    if (anyJustOpened) {
      fetchExamAssignments(true)
    }
  }, [examAssignments, fetchExamAssignments, nowTs])

  // Create debounced save function
  const saveAnswerToDb = async (
    submissionId: number,
    questionId: number,
    answer: string,
  ) => {
    try {
      await fetch('/api/training-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId,
          action: 'save_draft',
          answers: [{ question_id: questionId, answer_text: answer }],
        }),
      })
    } catch (e) {
      console.error('Failed to auto-save answer', e)
    }
  }

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
    if (submission?.id) {
      saveAnswerToDb(submission.id, questionId, answer)
    }
  }

  const scrollToQuestion = (questionId: number) => {
    const element = document.getElementById(`question-${questionId}`)
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
    }, 1200)
  }

  const handleStopAndSubmit = () => {
    setIsStopConfirmOpen(false)
    router.back()
  }

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          setTimerActive(false)
          submitAssignment()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [submitAssignment, timerActive, timeRemaining])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const decodeEscapedHtml = (value: string) => {
    if (!value) return ''
    let decoded = String(value)

    // Some records are escaped multiple times (e.g. &amp;lt;img...&amp;gt;).
    for (let i = 0; i < 4; i += 1) {
      if (!decoded.includes('&')) break
      const textarea = document.createElement('textarea')
      textarea.innerHTML = decoded
      const next = textarea.value
      if (next === decoded) break
      decoded = next
    }

    return decoded
  }

  const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

  const getProgress = () => {
    const answered = questions.filter(q => {
      const ans = answers[q.id]
      if (!ans) return false
      if (q.question_type === 'multiple_select') {
        try { return JSON.parse(ans).length > 0 } catch { return false }
      }
      return ans.trim().length > 0
    }).length
    return Math.round((answered / questions.length) * 100)
  }

  // ─── Shared Helper Functions ───
  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-')
    return `Tháng ${parseInt(m)}/${y}`
  }

  function getEffectiveExamScore(item: ExamAssignment): EffectiveExamScore {
    const now = new Date()
    const openAt = new Date(item.open_at)
    const closeAt = new Date(item.close_at)
    const isMissedCurrentMonth =
      isExamInCurrentVietnamMonth(item.open_at) &&
      closeAt < now &&
      item.score === null &&
      item.score_status === 'null' &&
      !item.can_take

    // 0. "môn nào chưa tới giờ mở bài làm thì không tính"
    if (openAt > now) {
      return { score: null, isMissedCurrentMonth: false }
    }

    // 1. "nếu giải trình đã được duyệt thì điểm = null và loại bỏ môn đó khỏi các môn tính điểm trung bình"
    if (item.explanation_status === 'accepted') {
      return { score: null, isMissedCurrentMonth: false }
    }

    // 2. "trung bình điểm của các môn đăng ký trong tháng đó, nếu chưa giải trình thì điểm = 0, ... nếu đã giải trình thì nhưng bị từ chối thì điểm = 0"
    // Mặc định nạp 0 điểm cho bất kỳ môn nào không bị loại bỏ (tức là chưa thi, chưa giải trình, chờ giải trình, từ chối giải trình).
    let effectiveScore = 0
    if (item.score !== null && item.score_status !== 'null') {
      const parsed = Number(item.score)
      effectiveScore = Number.isNaN(parsed) ? 0 : parsed
    }

    return {
      score: effectiveScore,
      isMissedCurrentMonth,
    }
  }

  function shouldShowExplanationCTA(item: ExamAssignment): boolean {
    // Chỉ cho phép giải trình bài CHÍNH THỨC, không cho phép giải trình bài BỔ SUNG
    if (item.registration_type === 'additional') {
      return false
    }

    if (!isExamInCurrentVietnamMonth(item.open_at)) {
      return false
    }
    const closeAt = new Date(item.close_at)
    const expired = item.assignment_status === 'expired' || closeAt < new Date()
    const note = (item.score_handling_note || '').toLowerCase()
    const requiresExplanation =
      note.includes('mac dinh 0') ||
      note.includes('mặc định 0') ||
      note.includes('chờ giải trình') ||
      note.includes('cho giai trinh')
    const explanationId = Number(item.explanation_id || 0)
    const hasLinkedExplanation =
      Number.isFinite(explanationId) && explanationId > 0
    const isPendingWithoutLinkedExplanation =
      item.explanation_status === 'pending' && !hasLinkedExplanation

    if (item.explanation_status === 'accepted') {
      return false
    }

    // Đã gửi ticket giải trình, chờ admin duyệt — hiện trạng thái, không nút «Giải trình» lần nữa
    if (item.explanation_status === 'pending') {
      if (hasLinkedExplanation || item.da_giai_thich) {
        return false
      }
    }

    if (isPendingWithoutLinkedExplanation) {
      return true
    }

    return expired && requiresExplanation
  }

  function buildExplanationHref(item: ExamAssignment): string {
    // Trim subject_code để loại bỏ ký tự thừa (CRLF, spaces) có thể có trong DB
    const cleanSubject = (item.subject_code || '').trim()
    return `/user/giaitrinh?assignment_id=${item.id}&subject=${encodeURIComponent(cleanSubject)}&test_date=${encodeURIComponent(item.open_at)}&campus=${encodeURIComponent(item.block_code)}`
  }

  function formatScoreSummary(
    item: ExamAssignment,
    score: number | null,
  ): string {
    if (score === null) return 'Chưa có'
    const correctAnswers = Number(item.correct_answers ?? 0)
    const totalQuestions = Number(item.total_questions ?? 0)
    if (Number.isFinite(totalQuestions) && totalQuestions > 0) {
      return `${correctAnswers}/${totalQuestions} câu • ${score} điểm`
    }
    return `${score} điểm`
  }

  const formatExplanationStatus = (
    status?: ExamAssignment['explanation_status'],
  ) => {
    if (status === 'pending') return 'Đang chờ duyệt'
    if (status === 'accepted') return 'Đã duyệt'
    if (status === 'rejected') return 'Từ chối'
    return 'Chưa có'
  }

  // ─── Sub-tabs inside exam section (hooks must be before any early return) ──
  const scoreStats = useMemo(() => {
    let totalAssigned = 0
    let totalPassed = 0
    let bestExperience = 0
    let bestExpertiseMonth = ''
    let missingOrPending = 0
    let explanationsApproved = 0
    let explanationsRejected = 0
    let explanationsPending = 0

    const now = new Date()

    // Determine the target month dynamically (realtime with filter)
    let targetMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (selectedExamMonth !== 'all' && selectedExamMonth !== '6months') {
      targetMonthKey = selectedExamMonth
    } else if (examAssignments.length > 0) {
      const maxDate = new Date(
        Math.max(...examAssignments.map((a) => new Date(a.open_at).getTime())),
      )
      targetMonthKey = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`
    }

    const monthlyExpertiseScores = new Map<string, number[]>()

    examAssignments.forEach((item) => {
      const date = new Date(item.open_at)
      if (Number.isNaN(date.getTime())) return
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const { score, isMissedCurrentMonth } = getEffectiveExamScore(item)

      if (monthKey === targetMonthKey) {
        if (item.explanation_status === 'accepted') explanationsApproved++
        else if (item.explanation_status === 'rejected') explanationsRejected++
        else if (item.explanation_status === 'pending') explanationsPending++
      }

      // Tỉ lệ đạt / TB CM / điểm QT: toàn bộ bài trong danh sách đã tải (không lọc «6 tháng lăn» — tránh mất kỳ cũ khi năm lịch khác nhau)
      const isExcluded = item.explanation_status === 'accepted'
      if (!isExcluded && score !== null) {
        totalAssigned++
        if (isExamPassed(item, score)) totalPassed++
      }

      if (score !== null) {
        if (item.exam_type === 'experience') {
          if (score > bestExperience) {
            bestExperience = score
          }
        }
        if (item.exam_type !== 'experience') {
          if (!monthlyExpertiseScores.has(monthKey)) {
            monthlyExpertiseScores.set(monthKey, [])
          }
          monthlyExpertiseScores.get(monthKey)!.push(score)
        }
      }

      // Chỉ đếm nếu thiếu điểm và chưa từng gửi giải trình (pending/accepted/rejected đều coi đã xử lý)
      if (isMissedCurrentMonth && !item.explanation_status) {
        missingOrPending++
      }
    })

    let bestMonthAverage = 0
    monthlyExpertiseScores.forEach((scores, month) => {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        if (avg > bestMonthAverage) {
          bestMonthAverage = avg
          bestExpertiseMonth = month
        }
      }
    })

    // Tháng có điểm QT / trải nghiệm cao nhất (cùng phạm vi danh sách)
    let bestExperienceMonth = ''
    let tempBest = 0
    examAssignments.forEach((item) => {
      if (item.exam_type !== 'experience') return
      const { score } = getEffectiveExamScore(item)
      if (score === null) return
      const date = new Date(item.open_at)
      if (Number.isNaN(date.getTime())) return
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (score > tempBest) {
        tempBest = score
        bestExperienceMonth = monthKey
      }
    })

    // Track all months with missing/pending items (only count if no explanation status at all)
    const missingMonths = new Set<string>()
    examAssignments.forEach((item) => {
      const { isMissedCurrentMonth } = getEffectiveExamScore(item)
      if (isMissedCurrentMonth && !item.explanation_status) {
        const date = new Date(item.open_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        missingMonths.add(monthKey)
      }
    })

    return {
      totalAssigned,
      totalPassed,
      passRate:
        totalAssigned > 0
          ? ((totalPassed / totalAssigned) * 100).toFixed(1)
          : '0',
      avgExpertise: bestMonthAverage > 0 ? bestMonthAverage.toFixed(2) : '0',
      bestExpertiseMonth,
      bestExperience,
      bestExperienceMonth,
      missingOrPending,
      missingMonths,
      explanationsApproved,
      explanationsRejected,
      explanationsPending,
      targetMonthKey,
    }
  }, [examAssignments, selectedExamMonth])

  const monthlyOverviewData = useMemo(() => {
    const dataMap = new Map<
      string,
      {
        expertiseSum: number
        expertiseCount: number
        experienceScores: number[]
      }
    >()

    examAssignments.forEach((item) => {
      const { score } = getEffectiveExamScore(item)
      if (score === null) return

      const date = new Date(item.open_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, {
          expertiseSum: 0,
          expertiseCount: 0,
          experienceScores: [],
        })
      }

      const monthData = dataMap.get(monthKey)!
      if (item.exam_type === 'experience') {
        monthData.experienceScores.push(score)
      } else {
        monthData.expertiseSum += score
        monthData.expertiseCount += 1
      }
    })

    return Array.from(dataMap.entries())
      .map(([month, stats]) => ({
        month,
        avgExpertise:
          stats.expertiseCount > 0
            ? (stats.expertiseSum / stats.expertiseCount).toFixed(2)
            : null,
        maxExperience:
          stats.experienceScores.length > 0
            ? Math.max(...stats.experienceScores)
            : null,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)) // Newest first
  }, [examAssignments])

  const filteredGroupedExams = useMemo(() => {
    const now = new Date()
    const last6MonthsSet = new Set(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }),
    )

    const filtered = examAssignments.filter((item) => {
      if (scoreSubjectKeyword) {
        const keyword = scoreSubjectKeyword.toLowerCase()
        if (
          !item.subject_code.toLowerCase().includes(keyword) &&
          (!item.set_name || !item.set_name.toLowerCase().includes(keyword))
        ) {
          return false
        }
      }

      const date = new Date(item.open_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (selectedExamMonth === '6months') {
        if (!last6MonthsSet.has(monthKey)) return false
      } else if (selectedExamMonth !== 'all') {
        if (monthKey !== selectedExamMonth) return false
      }

      if (scoreTypeFilter !== 'all' && item.exam_type !== scoreTypeFilter) {
        return false
      }

      if (scoreResultFilter !== 'all') {
        // Mirror admin "Thao tác HO" badge logic using score_handling_note (= xu_ly_diem)
        const xuLower = (item.score_handling_note || '').trim().toLowerCase()
        const isAccepted = xuLower === 'đã duyệt'
        const isRejected = xuLower === 'từ chối'
        const isWaiting = xuLower === 'chờ giải trình'
        const isDone =
          item.score !== null ||
          xuLower === 'đã hoàn thành' ||
          xuLower === 'da thi'
        // Pending = not yet done/waiting/accepted/rejected
        const isPending = !isDone && !isWaiting && !isAccepted && !isRejected

        if (scoreResultFilter === 'done') {
          if (!isDone) return false
        } else if (scoreResultFilter === 'waiting') {
          if (!isWaiting) return false
        } else if (scoreResultFilter === 'pending') {
          if (!isPending) return false
        } else if (scoreResultFilter === 'accepted') {
          if (!isAccepted) return false
        } else if (scoreResultFilter === 'rejected') {
          if (!isRejected) return false
        }
      }

      return true
    })

    const groups: Record<string, typeof filtered> = {}
    filtered.forEach((item) => {
      const date = new Date(item.open_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[monthKey]) groups[monthKey] = []
      groups[monthKey].push(item)
    })

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, items]) => ({
        month,
        items: items.sort(
          (a, b) =>
            new Date(b.open_at).getTime() - new Date(a.open_at).getTime(),
        ),
      }))
  }, [
    examAssignments,
    scoreSubjectKeyword,
    selectedExamMonth,
    scoreTypeFilter,
    scoreResultFilter,
  ])

  // Loading state when auto-starting assignment
  if (startId && view === 'list') {
    const target = assignments.find((a) => a.id.toString() === startId)
    // Show loading if still fetching OR if target found (waiting for redirect effect)
    if (trainingLoading || target) {
      return (
        <PageContainer>
          <div className="flex flex-col items-center justify-center p-12 h-64">
            <LoadingSpinner />
            <p className="mt-4 text-gray-500 font-medium">
              Đang chuẩn bị bài làm...
            </p>
          </div>
        </PageContainer>
      )
    }
  }

  if (trainingLoading || examLoading) {
    return <PageSkeleton variant="grid" itemCount={6} showHeader={true} />
  }

  if (view === 'taking' && currentAssignment) {
    const progress = getProgress()
    const answeredCount = Object.keys(answers).length

    return (
      <PageContainer>
        <div className="w-full">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content - Questions */}
            <div className="flex-1 min-w-0">
              {/* Mobile Header */}
              <div className="lg:hidden mb-4">
                <h1 className="text-xl font-bold text-gray-900 mb-1">
                  {currentAssignment.assignment_title}
                </h1>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {currentAssignment.video_title}
                </p>
              </div>

              {/* Questions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                {questions.map((question, idx) => {
                  // Determine if question should span full width
                  const isFullWidth =
                    question.question_type === 'essay' ||
                    question.question_type === 'multiple_choice' ||
                    question.question_type === 'multiple_select' ||
                    question.image_url // Questions with images also take full width

                  return (
                    <div
                      key={question.id}
                      id={`question-${question.id}`}
                      className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                        (() => {
                          const ans = answers[question.id]
                          const hasAnswer = question.question_type === 'multiple_select'
                            ? (() => { try { return JSON.parse(ans || '[]').length > 0 } catch { return false } })()
                            : Boolean(ans)
                          return hasAnswer
                            ? 'border-green-200 bg-green-50/30'
                            : 'border-gray-200 hover:border-blue-200'
                        })()
                      } ${isFullWidth ? 'lg:col-span-2' : 'lg:col-span-1'}`}
                    >
                      <div className="p-4 md:p-6">
                        {/* Question Header */}
                        <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                          <div
                            className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-sm md:text-base font-bold ${
                              (() => {
                                const ans = answers[question.id]
                                const hasAnswer = question.question_type === 'multiple_select'
                                  ? (() => { try { return JSON.parse(ans || '[]').length > 0 } catch { return false } })()
                                  : Boolean(ans)
                                return hasAnswer ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                              })()
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                              <div
                                className="prose prose-sm max-w-none flex-1"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(question.question_text),
                                }}
                              />
                              <span className="self-start px-2 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] md:text-xs font-semibold shrink-0">
                                {question.points} điểm
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Question Image */}
                        {question.image_url && (
                          <div className="mb-3 md:mb-4 ml-11 md:ml-14">
                            { }
                            <img
                              src={question.image_url}
                              alt="Question"
                              width={400}
                              height={300}
                              className="rounded-lg border border-gray-300 w-full h-auto"
                            />
                          </div>
                        )}

                        {/* Answer Options */}
                        <div className="ml-11 md:ml-14">
                          {question.question_type === 'multiple_choice' &&
                          Array.isArray(question.options) ? (
                            <div className="space-y-2">
                              {question.options.map(
                                (option: string, optIdx: number) => (
                                  <label
                                    key={optIdx}
                                    className={`flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                      answers[question.id] === option
                                        ? 'border-[#a1001f] bg-[#fff5f7] shadow-sm'
                                        : 'border-gray-200 hover:border-[#d47a8b] hover:bg-[#fff5f7]'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${question.id}`}
                                      value={option}
                                      checked={answers[question.id] === option}
                                      onChange={(e) =>
                                        handleAnswerChange(
                                          question.id,
                                          e.target.value,
                                        )
                                      }
                                      className="w-4 md:w-5 h-4 md:h-5 text-[#a1001f]"
                                    />
                                    {(() => {
                                      const normalizedOption =
                                        decodeEscapedHtml(String(option))
                                      const renderAsHtml =
                                        hasHtmlMarkup(normalizedOption)

                                      if (renderAsHtml) {
                                        return (
                                          <>
                                            <div
                                              className="prose prose-sm md:prose-base max-w-none flex-1 text-gray-900 [&_.tiptap-image]:inline-block [&_.tiptap-image]:max-w-full [&_img]:h-auto"
                                              dangerouslySetInnerHTML={{
                                                __html: sanitizeHtml(normalizedOption),
                                              }}
                                            />
                                          </>
                                        )
                                      }

                                      return (
                                        <span className="flex-1 text-sm md:text-base font-medium text-gray-900">
                                          {normalizedOption}
                                        </span>
                                      )
                                    })()}
                                  </label>
                                ),
                              )}
                            </div>
                          ) : question.question_type === 'multiple_select' &&
                          Array.isArray(question.options) ? (
                            <div className="space-y-2">
                              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg mb-2">
                                Chọn <strong>tất cả</strong> đáp án đúng (có thể chọn nhiều)
                              </p>
                              {(() => {
                                // Parse selected answers từ JSON string
                                let selectedArr: string[] = []
                                try {
                                  const raw = answers[question.id] || '[]'
                                  selectedArr = JSON.parse(raw)
                                  if (!Array.isArray(selectedArr)) selectedArr = []
                                } catch { selectedArr = [] }

                                const toggleOption = (opt: string) => {
                                  const next = selectedArr.includes(opt)
                                    ? selectedArr.filter(a => a !== opt)
                                    : [...selectedArr, opt]
                                  handleAnswerChange(question.id, JSON.stringify(next))
                                }

                                return question.options.map((option: string, optIdx: number) => {
                                  const isChecked = selectedArr.includes(option)
                                  return (
                                    <label
                                      key={optIdx}
                                      className={`flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        isChecked
                                          ? 'border-[#a1001f] bg-[#fff5f7] shadow-sm'
                                          : 'border-gray-200 hover:border-[#d47a8b] hover:bg-[#fff5f7]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleOption(option)}
                                        className="w-4 md:w-5 h-4 md:h-5 text-[#a1001f] rounded mt-0.5"
                                      />
                                      {(() => {
                                        const normalizedOption = decodeEscapedHtml(String(option))
                                        if (hasHtmlMarkup(normalizedOption)) {
                                          return (
                                            <div
                                              className="prose prose-sm md:prose-base max-w-none flex-1 text-gray-900"
                                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizedOption) }}
                                            />
                                          )
                                        }
                                        return <span className="flex-1 text-sm md:text-base font-medium text-gray-900">{normalizedOption}</span>
                                      })()}
                                    </label>
                                  )
                                })
                              })()}
                            </div>
                          ) : question.question_type === 'true_false' ? (
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                              {['Đúng', 'Sai'].map((option) => (
                                <label
                                  key={option}
                                  className={`flex items-center justify-center gap-2 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                    answers[question.id] === option
                                      ? 'border-[#a1001f] bg-[#fff5f7] shadow-sm'
                                      : 'border-gray-200 hover:border-[#d47a8b] hover:bg-[#fff5f7]'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option}
                                    checked={answers[question.id] === option}
                                    onChange={(e) =>
                                      handleAnswerChange(
                                        question.id,
                                        e.target.value,
                                      )
                                    }
                                    className="w-4 md:w-5 h-4 md:h-5 text-[#a1001f]"
                                  />
                                  <span className="text-sm md:text-base font-semibold text-gray-900">
                                    {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <textarea
                              value={answers[question.id] || ''}
                              onChange={(e) =>
                                handleAnswerChange(question.id, e.target.value)
                              }
                              placeholder="Nhập câu trả lời của bạn..."
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all resize-none"
                              rows={question.question_type === 'essay' ? 6 : 3}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Submit Footer */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 sticky bottom-0 lg:hidden">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsStopConfirmOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 font-medium text-gray-700 text-sm md:text-base h-auto border-gray-300 hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 md:w-5 h-4 md:h-5" />
                    Hủy bài làm
                  </Button>

                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
                    {answeredCount < questions.length && (
                      <div className="flex items-center justify-center gap-2 text-amber-600 py-2 md:py-0">
                        <AlertCircle className="w-4 md:w-5 h-4 md:h-5" />
                        <span className="text-xs md:text-sm font-medium">
                          Còn {questions.length - answeredCount} câu chưa trả
                          lời
                        </span>
                      </div>
                    )}

                    <Button
                      disabled={isSubmitting}
                      onClick={submitAssignment}
                      className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 font-semibold shadow-md text-sm md:text-base h-auto bg-[#a1001f] text-white hover:bg-[#840018]"
                    >
                      <Send className="w-4 md:w-5 h-4 md:h-5" />
                      {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Desktop only */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {/* Assignment Info Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h2 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
                    {currentAssignment.assignment_title}
                  </h2>
                  <p className="text-xs text-gray-600 flex items-center gap-1.5 line-clamp-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {currentAssignment.video_title}
                  </p>
                </div>

                {/* Timer Card */}
                {timeRemaining !== null && (
                  <div
                    className={`rounded-lg shadow-sm border-2 p-4 ${
                      timeRemaining < 300
                        ? 'bg-red-50 border-red-300'
                        : 'bg-[#fff5f7] border-[#f1d1d8]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock
                        className={`w-4 h-4 ${timeRemaining < 300 ? 'text-red-600' : 'text-[#a1001f]'}`}
                      />
                      <span
                        className={`text-xs font-semibold ${timeRemaining < 300 ? 'text-red-700' : 'text-[#a1001f]'}`}
                      >
                        Thời gian còn lại
                      </span>
                    </div>
                    <div
                      className={`font-mono text-2xl font-bold ${timeRemaining < 300 ? 'text-red-700' : 'text-[#a1001f]'}`}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                  </div>
                )}

                {/* Progress Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">
                      Tiến độ
                    </span>
                    <span className="text-xl font-bold text-[#a1001f]">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-[#a1001f] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    {answeredCount}/{questions.length} câu đã trả lời
                  </p>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Ma trận câu hỏi
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((q, index) => {
                        const isAnswered =
                          answers[q.id] !== undefined && answers[q.id] !== ''
                        return (
                          <button
                            type="button"
                            key={q.id}
                            onClick={() => scrollToQuestion(q.id)}
                            className={`
                          flex items-center justify-center text-[10px] font-bold h-7 rounded transition-all duration-200 cursor-pointer
                          ${
                            isAnswered
                              ? 'bg-[#a1001f] text-white shadow-sm ring-1 ring-[#840018]'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }
                        `}
                            title={`Câu ${index + 1}: ${isAnswered ? 'Đã làm' : 'Chưa làm'}`}
                            aria-label={`Đi tới câu ${index + 1}`}
                          >
                            {index + 1}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">
                    Thông tin bài tập
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#fde8ec] rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#a1001f]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Số câu hỏi</p>
                        <p className="text-base font-bold text-gray-900">
                          {questions.length}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#fff1f2] rounded-lg flex items-center justify-center">
                        <Award className="w-4 h-4 text-[#be123c]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Tổng điểm</p>
                        <p className="text-base font-bold text-gray-900">
                          {currentAssignment.total_points}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#ffe4e6] rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-[#9f1239]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">
                          Điểm đạt yêu cầu
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          {currentAssignment.passing_score}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  {answeredCount < questions.length && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                      <div className="flex items-start gap-2 text-amber-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="text-xs font-medium">
                          Còn {questions.length - answeredCount} câu chưa trả
                          lời
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    disabled={isSubmitting}
                    onClick={submitAssignment}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold shadow-md h-auto bg-[#a1001f] text-white hover:bg-[#840018]"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setIsStopConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-gray-700 h-auto border-gray-300 hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Hủy bài làm
                  </Button>
                </div>
              </div>
            </div>

            <ConfirmDialog
              isOpen={isStopConfirmOpen}
              onClose={() => setIsStopConfirmOpen(false)}
              onConfirm={handleStopAndSubmit}
              title="Xác nhận thoát bài làm"
              message="Bạn có chắc muốn thoát không? Bài làm hiện tại sẽ không được lưu."
              confirmText="Thoát"
              cancelText="Tiếp tục làm"
              type="warning"
              icon="warning"
            />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (view === 'result' && submission) {
    const percentage = formatPercentage(submission.percentage)
    const isPassed = submission.is_passed

    return (
      <PageContainer>
        <div className="w-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Result Header */}
            <div className="text-center mb-8">
              <div
                className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                  isPassed ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                {isPassed ? (
                  <CheckCircle className="w-12 h-12 text-green-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>

              <h2 className="text-3xl font-bold mb-2">
                {isPassed ? 'Chúc mừng!' : 'Cố gắng thêm nhé!'}
              </h2>

              <p
                className={`text-lg font-semibold ${isPassed ? 'text-green-600' : 'text-red-600'}`}
              >
                {isPassed ? '✅ Đạt yêu cầu' : '❌ Chưa đạt yêu cầu'}
              </p>
            </div>

            {/* Score Display */}
            <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-8 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Điểm số của bạn</p>
                <div className="text-6xl font-bold text-blue-600 mb-2">
                  {submission.score}
                  <span className="text-3xl text-gray-400">
                    /{submission.total_points}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Điểm đạt: {currentAssignment?.passing_score}/
                  {submission.total_points}
                </p>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    Tỷ lệ hoàn thành
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {percentage}%
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    isPassed ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Feedback Message */}
            {isPassed && (
              <div className="rounded-xl p-6 mb-6 bg-green-50 border-2 border-green-200">
                <p className="text-center text-gray-700">
                  Xuất sắc! Bạn đã hoàn thành bài tập với {submission.score}{' '}
                  điểm!
                </p>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={() => {
                if (startId) {
                  router.push('/user/dao-tao-nang-cao')
                } else {
                  setView('list')
                  fetchAvailableAssignments()
                }
              }}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold h-auto border-[#d47a8b] bg-[#fff5f7] text-[#a1001f] hover:bg-[#fde8ec] hover:border-[#a1001f]"
            >
              <ArrowLeft className="w-5 h-5" />
              {startId ? 'Quay lại bài học' : 'Quay lại danh sách'}
            </Button>

            {currentAssignment?.max_attempts &&
              submission &&
              submission.attempt_number < currentAssignment.max_attempts && (
                <Button
                  onClick={() => {
                    if (
                      confirm(
                        'Bạn có chắc muốn làm lại bài tập này? Kết quả mới sẽ được tính là một lần làm bài mới.',
                      )
                    ) {
                      startAssignment(currentAssignment)
                    }
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-3 font-semibold h-auto shadow-md"
                >
                  <RefreshCw className="w-5 h-5" />
                  Làm lại bài tập
                </Button>
              )}
          </div>
        </div>
      </PageContainer>
    )
  }

  const examMonthOptions = Array.from(
    new Set(
      examAssignments
        .filter((item) => item.open_at)
        .map((item) => {
          const date = new Date(item.open_at)
          const month = `${date.getMonth() + 1}`.padStart(2, '0')
          return `${date.getFullYear()}-${month}`
        }),
    ),
  ).sort((a, b) => b.localeCompare(a))

  const formatRegistrationType = (type: 'official' | 'additional') =>
    type === 'official' ? 'Chính thức' : 'Bổ sung'

  const getExamStatusLabel = (item: ExamAssignment) => {
    const now = new Date()
    const closeAt = new Date(item.close_at)
    if (item.assignment_status === 'expired' || closeAt < now) return 'Đã đóng'
    if (item.assignment_status === 'submitted') return 'Đã nộp'
    if (item.assignment_status === 'graded') return 'Đã chấm'
    if (item.assignment_status === 'in_progress') return 'Đang làm'
    return 'Đang mở'
  }

  const getExamStatusClass = (item: ExamAssignment) => {
    const status = getExamStatusLabel(item)
    if (status === 'Đã đóng') return 'bg-red-100 text-red-700 border-red-300'
    if (status === 'Đã nộp' || status === 'Đã chấm')
      return 'bg-green-100 text-green-700 border-green-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const formatCountdown = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(safe / 3600)
      .toString()
      .padStart(2, '0')
    const minutes = Math.floor((safe % 3600) / 60)
      .toString()
      .padStart(2, '0')
    const secs = Math.floor(safe % 60)
      .toString()
      .padStart(2, '0')
    return `${hours}:${minutes}:${secs}`
  }

  const getExamCountdownInfo = (item: ExamAssignment) => {
    const openMs = new Date(item.open_at).getTime()
    const closeMs = new Date(item.close_at).getTime()

    if (nowTs < openMs) {
      return {
        label: 'Mở sau',
        value: formatCountdown((openMs - nowTs) / 1000),
        className: 'text-amber-700 bg-amber-50 border-amber-200',
      }
    }

    if (nowTs >= closeMs) {
      return {
        label: 'Đã hết giờ',
        value: '00:00:00',
        className: 'text-red-700 bg-red-50 border-red-200',
      }
    }

    // Cửa sổ đang mở → đếm ngược đến close_at theo giây
    return {
      label: 'Đóng sau',
      value: formatCountdown((closeMs - nowTs) / 1000),
      className: 'text-blue-700 bg-blue-50 border-blue-200',
    }
  }

  const mainTabs = [
    { id: 'available', label: 'Bài kiểm tra khả dụng' },
    {
      id: 'list',
      label: 'Danh sách bài kiểm tra',
      count: examAssignments.length,
    },
  ]

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto assignments-page">
        <style>{`
          .assignments-page button,
          .assignments-page a,
          .assignments-page [role="button"],
          .assignments-page select,
          .assignments-page label,
          .assignments-page summary,
          .assignments-page input[type="button"],
          .assignments-page input[type="submit"],
          .assignments-page input[type="checkbox"],
          .assignments-page input[type="radio"],
          .assignments-page input[type="file"],
          .assignments-page div[onClick],
          .assignments-page span[onClick],
          .assignments-page .fixed.inset-0.bg-opacity-60 {
            cursor: pointer !important;
          }
        `}</style>
        <div className="mb-8 border-b border-gray-200 pb-4 sm:pb-5">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bài Kiểm Tra Của Tôi
          </h1>
          <p className="text-gray-600">
            Danh sách các bài kiểm tra đã được đăng ký.
          </p>
        </div>

        <Tabs
          tabs={mainTabs}
          activeTab={activeMainTab}
          onChange={(tabId) =>
            setActiveMainTab(tabId as 'available' | 'list' | 'training')
          }
          borderClassName="border-[#e7c6cb]"
        />

        {error ? (
          <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : activeMainTab === 'available' ? (
          <div key="available" className="mt-6 animate-tab-enter">
            {(() => {
              const availableNow = examAssignments.filter(
                (item) => item.can_take === true,
              )
              return availableNow.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
                  <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Hiện tại không có bài kiểm tra nào đang mở.
                    </p>
                    <p className="text-xs text-gray-500">
                      Những môn bạn đã đăng ký sẽ xuất hiện ở đây khi đến giờ
                      làm bài.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {availableNow.map((item) => {
                      const countdown = getExamCountdownInfo(item)
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border-2 border-blue-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <h4 className="line-clamp-2 text-base font-bold text-gray-900">
                              {item.subject_code}
                            </h4>
                            <span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold bg-green-100 text-green-700 border-green-300">
                              Đang mở
                            </span>
                          </div>
                          <div className="mb-4 space-y-2 text-sm text-gray-600 flex-1">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Loại:</span>
                              <span className="font-medium text-gray-900">
                                {item.exam_type === 'expertise'
                                  ? 'Chuyên môn'
                                  : 'Quy trình - KN trải nghiệm'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Mở:</span>
                              <span>
                                {new Date(item.open_at).toLocaleDateString(
                                  'vi-VN',
                                )}{' '}
                                {new Date(item.open_at).toLocaleTimeString(
                                  'vi-VN',
                                  { hour: '2-digit', minute: '2-digit' },
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Đóng:</span>
                              <span>
                                {new Date(item.close_at).toLocaleDateString(
                                  'vi-VN',
                                )}{' '}
                                {new Date(item.close_at).toLocaleTimeString(
                                  'vi-VN',
                                  { hour: '2-digit', minute: '2-digit' },
                                )}
                              </span>
                            </div>
                            <div
                              className={`mt-3 flex items-center justify-between rounded-md border px-3 py-2 ${countdown.className}`}
                            >
                              <span className="text-xs font-semibold">
                                {countdown.label}
                              </span>
                              <span className="font-mono text-sm font-bold">
                                {countdown.value}
                              </span>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-gray-100">
                            <Link
                              href={`/user/assignments/exam/${item.id}`}
                              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                            >
                              {item.score !== null ||
                              item.assignment_status === 'submitted'
                                ? 'Làm bài'
                                : 'Bắt đầu làm bài'}
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
            }
          </div>
        ) : activeMainTab === 'list' ? (
          <div key="list" className="mt-6 space-y-6 animate-tab-enter">
            {/* 1. General Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setShowPassRateModal(true)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-md ring-offset-1 text-center sm:text-left"
              >
                <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-center sm:items-start sm:justify-start sm:text-left">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="w-full text-[13px] font-semibold leading-4 text-gray-700 sm:min-w-0 sm:flex-1 sm:w-auto sm:text-sm sm:leading-5">
                    Tỉ lệ đạt
                  </h3>
                  <span className="mt-1 inline-flex w-full justify-center rounded-full border border-blue-100 bg-blue-50 px-1 py-0.5 text-[8px] font-semibold text-blue-500 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-start sm:px-1.5 sm:text-[10px]">
                    <span className="sm:hidden">Chi tiết</span>
                    <span className="hidden sm:inline">Xem chi tiết</span>
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scoreStats.passRate}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {scoreStats.totalPassed} / {scoreStats.totalAssigned} bài trong
                  danh sách đã tải
                </p>
              </button>

              <button
                onClick={() => toggleStatCard('expertise')}
                className={`bg-white rounded-xl shadow-sm border p-4 transition-all ring-offset-1 text-center sm:text-left ${activeStatCard === 'expertise' ? 'border-purple-400 ring-2 ring-purple-300' : 'border-gray-200 hover:border-purple-200'}`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-center sm:items-start sm:justify-start sm:text-left">
                  <div
                    className={`p-2 rounded-lg ${activeStatCard === 'expertise' ? 'bg-purple-200 text-purple-700' : 'bg-purple-100 text-purple-600'}`}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="w-full text-[13px] font-semibold leading-4 text-gray-700 sm:min-w-0 sm:flex-1 sm:w-auto sm:text-sm sm:leading-5">
                    TB Chuyên môn
                  </h3>
                  {activeStatCard === 'expertise' && (
                    <span className="mt-1 inline-flex w-full justify-center rounded-full bg-purple-100 px-1 py-0.5 text-[8px] font-semibold text-purple-600 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-start sm:px-1.5 sm:text-[10px]">
                      Đang lọc
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scoreStats.avgExpertise}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tháng có TB chuyên môn cao nhất
                </p>
              </button>

              <button
                onClick={() => toggleStatCard('experience')}
                className={`bg-white rounded-xl shadow-sm border p-4 transition-all ring-offset-1 text-center sm:text-left ${activeStatCard === 'experience' ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-200 hover:border-green-200'}`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-center sm:items-start sm:justify-start sm:text-left">
                  <div
                    className={`p-2 rounded-lg ${activeStatCard === 'experience' ? 'bg-green-200 text-green-700' : 'bg-green-100 text-green-600'}`}
                  >
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h3 className="w-full text-[13px] font-semibold leading-4 text-gray-700 sm:min-w-0 sm:flex-1 sm:w-auto sm:text-sm sm:leading-5">
                    Điểm QT - KN trải nghiệm
                  </h3>
                  {activeStatCard === 'experience' && (
                    <span className="mt-1 inline-flex w-full justify-center rounded-full bg-green-100 px-1 py-0.5 text-[8px] font-semibold text-green-600 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-start sm:px-1.5 sm:text-[10px]">
                      Đang lọc
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scoreStats.bestExperience}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Điểm cao nhất (cùng phạm vi danh sách)
                </p>
              </button>

              <button
                onClick={() => toggleStatCard('missing')}
                className={`bg-white rounded-xl shadow-sm border p-4 transition-all ring-offset-1 text-center sm:text-left ${activeStatCard === 'missing' ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-200 hover:border-amber-200'}`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-center sm:items-start sm:justify-start sm:text-left">
                  <div
                    className={`p-2 rounded-lg ${activeStatCard === 'missing' ? 'bg-amber-200 text-amber-700' : 'bg-amber-100 text-amber-600'}`}
                  >
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="w-full text-[13px] font-semibold leading-4 text-gray-700 sm:min-w-0 sm:flex-1 sm:w-auto sm:text-sm sm:leading-5">
                    Cần giải trình
                  </h3>
                  {activeStatCard === 'missing' && (
                    <span className="mt-1 inline-flex w-full justify-center rounded-full bg-amber-100 px-1 py-0.5 text-[8px] font-semibold text-amber-600 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-start sm:px-1.5 sm:text-[10px]">
                      Đang lọc
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scoreStats.missingOrPending}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Bài thi cần giải trình
                </p>
              </button>
            </div>

            {/* Explanation Stats for Current Month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                Tình trạng giải trình (
                {formatMonthLabel(scoreStats.targetMonthKey)})
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Thống kê các bài thi được yêu cầu giải trình trong tháng đánh
                giá gần nhất
              </p>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="text-center bg-green-50 text-green-700 px-3 md:px-5 py-2.5 rounded-lg border border-green-200 hover:shadow-sm transition-all">
                  <div className="text-xl md:text-2xl font-bold">
                    {scoreStats.explanationsApproved}
                  </div>
                  <div className="text-[9px] md:text-xs font-semibold uppercase tracking-wider mt-1">
                    Thành công
                  </div>
                </div>
                <div className="text-center bg-red-50 text-red-700 px-3 md:px-5 py-2.5 rounded-lg border border-red-200 hover:shadow-sm transition-all">
                  <div className="text-xl md:text-2xl font-bold">
                    {scoreStats.explanationsRejected}
                  </div>
                  <div className="text-[9px] md:text-xs font-semibold uppercase tracking-wider mt-1">
                    Thất bại
                  </div>
                </div>
                <div className="text-center bg-amber-50 text-amber-700 px-3 md:px-5 py-2.5 rounded-lg border border-amber-200 hover:shadow-sm transition-all">
                  <div className="text-xl md:text-2xl font-bold">
                    {scoreStats.explanationsPending}
                  </div>
                  <div className="text-[9px] md:text-xs font-semibold uppercase tracking-wider mt-1">
                    Đang chờ
                  </div>
                </div>
              </div>
            </div>

            {/* 1.5. Monthly Overview Timeline */}
            {monthlyOverviewData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Tổng quan trạng thái theo tháng (Toàn thời gian)
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                  {monthlyOverviewData.map((data) => {
                    const now = new Date()
                    const last6MonthsSet = new Set(
                      Array.from({ length: 6 }, (_, i) => {
                        const d = new Date(
                          now.getFullYear(),
                          now.getMonth() - i,
                          1,
                        )
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                      }),
                    )
                    /** Ngoài cửa sổ 6 tháng lăn (lọc nhanh), không đồng nghĩa «chưa nộp / trễ hạn» */
                    const isOutsideRecentWindow =
                      !last6MonthsSet.has(data.month)
                    const isSelected = selectedExamMonth === data.month
                    const hasExpertiseAvg =
                      data.avgExpertise != null && data.avgExpertise !== ''
                    const hasExperienceMax = data.maxExperience !== null
                    const hasGradedResult =
                      (hasExpertiseAvg &&
                        Number.parseFloat(String(data.avgExpertise)) > 0) ||
                      (hasExperienceMax && Number(data.maxExperience) > 0)

                    // Stat card highlight logic
                    const isExpertiseHighlight =
                      activeStatCard === 'expertise' &&
                      data.month === scoreStats.bestExpertiseMonth
                    const isExperienceHighlight =
                      activeStatCard === 'experience' &&
                      data.month === scoreStats.bestExperienceMonth
                    const isMissingHighlight =
                      activeStatCard === 'missing' &&
                      scoreStats.missingMonths.has(data.month)
                    const isStatHighlighted =
                      isExpertiseHighlight ||
                      isExperienceHighlight ||
                      isMissingHighlight
                    const statHighlightClass = isExpertiseHighlight
                      ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50 shadow-md'
                      : isExperienceHighlight
                        ? 'border-green-400 ring-2 ring-green-200 bg-green-50 shadow-md'
                        : isMissingHighlight
                          ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50 shadow-md'
                          : ''

                    return (
                      <div
                        key={data.month}
                        className={`shrink-0 min-w-40 border rounded-lg p-3 snap-start transition-all cursor-pointer ${
                          isStatHighlighted
                            ? statHighlightClass
                            : isSelected
                              ? isOutsideRecentWindow && !hasGradedResult
                                ? 'border-gray-400 bg-gray-100 shadow-sm'
                                : 'border-blue-400 bg-blue-50 shadow-sm'
                              : isOutsideRecentWindow
                                ? hasGradedResult
                                  ? 'border-purple-100 bg-purple-50/50 opacity-90 hover:opacity-100 hover:border-purple-200'
                                  : 'border-gray-200 bg-gray-50/60 opacity-70 hover:opacity-90 hover:border-gray-300'
                                : 'border-gray-100 bg-gray-50 hover:border-blue-200 hover:bg-white'
                        }`}
                        onClick={() =>
                          setSelectedExamMonth(
                            isSelected ? '6months' : data.month,
                          )
                        }
                      >
                        <div
                          className={`text-xs font-semibold mb-2 border-b pb-1 text-center flex items-center justify-center gap-1.5 ${
                            isExpertiseHighlight
                              ? 'text-purple-700 border-purple-200'
                              : isExperienceHighlight
                                ? 'text-green-700 border-green-200'
                                  : isMissingHighlight
                                    ? 'text-amber-700 border-amber-200'
                                    : isOutsideRecentWindow &&
                                        !hasGradedResult &&
                                        !hasExpertiseAvg &&
                                        !hasExperienceMax
                                      ? 'text-gray-400 border-gray-200'
                                      : isOutsideRecentWindow
                                        ? 'text-gray-700 border-gray-200'
                                        : 'text-gray-600 border-gray-200'
                          }`}
                        >
                          {formatMonthLabel(data.month)}
                          {isOutsideRecentWindow && !isStatHighlighted && (
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded font-normal ${
                                hasGradedResult
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {hasGradedResult ? 'Kỳ cũ' : 'Quá hạn'}
                            </span>
                          )}
                          {isExpertiseHighlight && (
                            <span className="text-[9px] bg-purple-200 text-purple-700 px-1 py-0.5 rounded font-semibold">
                              TB tốt nhất
                            </span>
                          )}
                          {isExperienceHighlight && (
                            <span className="text-[9px] bg-green-200 text-green-700 px-1 py-0.5 rounded font-semibold">
                              Cao nhất
                            </span>
                          )}
                          {isMissingHighlight && (
                            <span className="text-[9px] bg-amber-200 text-amber-700 px-1 py-0.5 rounded font-semibold">
                              Cần GT
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 text-[11px]">
                          <div
                            className={`flex justify-between items-center px-2 py-1.5 rounded border ${
                              isExpertiseHighlight
                                ? 'bg-purple-50 border-purple-100'
                                : hasExpertiseAvg &&
                                    isOutsideRecentWindow &&
                                    !isStatHighlighted &&
                                    hasGradedResult
                                  ? 'bg-purple-50/70 border-purple-100'
                                  : isOutsideRecentWindow
                                    ? 'bg-gray-50 border-gray-100'
                                    : 'bg-white border-gray-100'
                            }`}
                          >
                            <span
                              className={`font-medium ${
                                isOutsideRecentWindow &&
                                !isStatHighlighted &&
                                !hasExpertiseAvg
                                  ? 'text-gray-400'
                                  : 'text-gray-600'
                              }`}
                            >
                              CM Chuyên sâu:
                            </span>
                            <span
                              className={`font-bold ml-2 text-sm ${
                                isExpertiseHighlight || hasExpertiseAvg
                                  ? 'text-purple-700'
                                  : 'text-gray-400'
                              }`}
                            >
                              {data.avgExpertise ?? '-'}
                            </span>
                          </div>
                          <div
                            className={`flex justify-between items-center px-2 py-1.5 rounded border ${
                              isExperienceHighlight
                                ? 'bg-green-50 border-green-100'
                                : hasExperienceMax &&
                                    isOutsideRecentWindow &&
                                    !isStatHighlighted &&
                                    hasGradedResult
                                  ? 'bg-green-50/70 border-green-100'
                                  : isOutsideRecentWindow
                                    ? 'bg-gray-50 border-gray-100'
                                    : 'bg-white border-gray-100'
                            }`}
                          >
                            <span
                              className={`font-medium ${
                                isOutsideRecentWindow &&
                                !isStatHighlighted &&
                                !hasExperienceMax
                                  ? 'text-gray-400'
                                  : 'text-gray-600'
                              }`}
                            >
                              QT Trải nghiệm:
                            </span>
                            <span
                              className={`font-bold ml-2 text-sm ${
                                isExperienceHighlight || hasExperienceMax
                                  ? 'text-green-700'
                                  : 'text-gray-400'
                              }`}
                            >
                              {data.maxExperience ?? '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 2. Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 flex flex-col gap-3 transition-all">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Môn học
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập mã môn/bộ đề..."
                    value={scoreSubjectKeyword}
                    onChange={(e) => setScoreSubjectKeyword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Tháng
                  </label>
                  <select
                    value={selectedExamMonth}
                    onChange={(e) => setSelectedExamMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="6months">6 tháng gần nhất</option>
                    <option value="all">Tất cả thời gian</option>
                    {examMonthOptions.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Loại kiểm tra
                  </label>
                  <select
                    value={scoreTypeFilter}
                    onChange={(e) =>
                      setScoreTypeFilter(e.target.value as ScoreTypeFilter)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tất cả</option>
                    <option value="expertise">Chuyên môn</option>
                    <option value="experience">Trải nghiệm</option>
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Kết quả
                  </label>
                  <select
                    value={scoreResultFilter}
                    onChange={(e) =>
                      setScoreResultFilter(
                        e.target.value as ScoreResultFilter,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tất cả / Bất kỳ</option>
                    <option value="done">Done</option>
                    <option value="waiting">Waiting</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {(scoreSubjectKeyword ||
                selectedExamMonth !== '6months' ||
                scoreTypeFilter !== 'all' ||
                scoreResultFilter !== 'all') && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    title="Xóa tất cả bộ lọc"
                    className="inline-flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors border border-red-100 text-sm font-medium"
                  >
                    <FilterX className="w-4 h-4" />
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>

            {/* 3. Detailed Month View */}
            {filteredGroupedExams.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
                <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Không có bài thi nào phù hợp với bộ lọc hiện tại.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroupedExams.map((group, index) => {
                  const isExpanded =
                    expandedMonths.has(group.month) ||
                    (expandedMonths.size === 0 &&
                      (selectedExamMonth === '6months' ||
                        selectedExamMonth === 'all') &&
                      index === 0)

                  return (
                    <div
                      key={group.month}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden mb-4"
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer group p-4 sm:p-6 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                        onClick={() => toggleMonthExpand(group.month)}
                      >
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-105 transition-transform border border-blue-100">
                            <Clock className="w-5 h-5" />
                          </div>
                          {formatMonthLabel(group.month)}
                          <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full ml-2 shadow-sm">
                            {group.items.length} bài
                          </span>
                        </h3>
                        <button className="p-2 rounded-full text-gray-400 group-hover:bg-white group-hover:text-gray-700 transition-colors border border-transparent group-hover:border-gray-200 shadow-sm">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="p-4 sm:p-6 pt-2 border-t border-gray-100 animate-tab-enter">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {group.items.map((item) => {
                              const {
                                score: effectiveScore,
                                isMissedCurrentMonth,
                              } = getEffectiveExamScore(item)

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg transition-all flex flex-col h-full"
                                >
                                  <div className="mb-3 flex items-start justify-between gap-2">
                                    <h4 className="line-clamp-2 text-base font-bold text-gray-900">
                                      {item.subject_code}
                                    </h4>
                                    <span
                                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getExamStatusClass(item)}`}
                                    >
                                      {getExamStatusLabel(item)}
                                    </span>
                                  </div>

                                  <div className="mb-4 space-y-2 text-sm text-gray-600 flex-1">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">
                                        Loại:
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {formatRegistrationType(
                                          item.registration_type,
                                        )}{' '}
                                        (
                                        {item.exam_type === 'expertise'
                                          ? 'CC'
                                          : 'TN'}
                                        )
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Mở:</span>
                                      <span>
                                        {new Date(
                                          item.open_at,
                                        ).toLocaleDateString('vi-VN')}{' '}
                                        {new Date(
                                          item.open_at,
                                        ).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">
                                        Đóng:
                                      </span>
                                      <span>
                                        {new Date(
                                          item.close_at,
                                        ).toLocaleDateString('vi-VN')}{' '}
                                        {new Date(
                                          item.close_at,
                                        ).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    {nowTs <
                                      new Date(item.open_at).getTime() && (
                                      <div className="mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                                        <span className="text-xs font-semibold">
                                          Mở sau
                                        </span>
                                        <span className="font-mono text-sm font-bold">
                                          {formatCountdown(
                                            (new Date(item.open_at).getTime() -
                                              nowTs) /
                                              1000,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2.5 rounded-lg mt-3">
                                      <span className="font-semibold text-gray-700">
                                        Điểm số:
                                      </span>
                                      {item.explanation_status ===
                                      'accepted' ? (
                                        <span className="text-blue-600 italic text-sm font-medium">
                                          Miễn thi (Đã duyệt GT)
                                        </span>
                                      ) : effectiveScore === null ? (
                                        <span className="text-gray-400 italic text-sm">
                                          Chưa có
                                        </span>
                                      ) : (
                                        <span
                                          className={`font-bold text-base flex items-center gap-2 ${isExamPassed(item, effectiveScore) ? 'text-green-600' : 'text-red-600'}`}
                                        >
                                          {formatScoreSummary(
                                            item,
                                            effectiveScore,
                                          )}
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isExamPassed(item, effectiveScore) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                          >
                                            {isExamPassed(item, effectiveScore)
                                              ? 'ĐẠT'
                                              : 'KHÔNG ĐẠT'}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-auto pt-4 border-t border-gray-100">
                                    {item.can_take &&
                                    nowTs >=
                                      new Date(item.open_at).getTime() ? (
                                      <Link
                                        href={`/user/assignments/exam/${item.id}`}
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                                      >
                                        {item.score !== null ||
                                        item.assignment_status === 'submitted'
                                          ? 'Làm bài'
                                          : 'Bắt đầu làm bài'}
                                      </Link>
                                    ) : shouldShowExplanationCTA(item) ? (
                                      <Link
                                        href={buildExplanationHref(item)}
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition cursor-pointer"
                                      >
                                        Giải trình
                                      </Link>
                                    ) : isMissedCurrentMonth &&
                                      !item.explanation_status ? (
                                      <Link
                                        href={buildExplanationHref(item)}
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition cursor-pointer"
                                      >
                                        Giải trình (Lỡ bài)
                                      </Link>
                                    ) : item.explanation_status ? (
                                      item.explanation_status === 'rejected' ? (
                                        <Link
                                          href={`/user/giaitrinh`}
                                          title={
                                            item.admin_note ||
                                            'Nhấn để xem chi tiết'
                                          }
                                          className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                                        >
                                          Giải trình:{' '}
                                          {formatExplanationStatus(
                                            item.explanation_status,
                                          )}
                                        </Link>
                                      ) : (
                                        <div
                                          className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold border ${
                                            item.explanation_status ===
                                            'accepted'
                                              ? 'bg-green-50 text-green-700 border-green-200'
                                              : 'bg-amber-50 text-amber-700 border-amber-200'
                                          }`}
                                        >
                                          Giải trình:{' '}
                                          {formatExplanationStatus(
                                            item.explanation_status,
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedExamInfo(item)
                                        }
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                                      >
                                        {nowTs <
                                        new Date(item.open_at).getTime()
                                          ? 'Chưa tới giờ mở'
                                          : 'Chi tiết bài thi'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Chưa có bài tập
            </h3>
            <p className="text-gray-500">
              Hiện tại chưa có bài tập nào được giao cho bạn.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="bg-linear-to-br from-blue-500 to-blue-600 p-3 text-white">
                  <div className="flex items-start justify-between mb-1.5">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    {assignment.status === 'published' && (
                      <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-semibold">
                        Mở
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold mb-1 line-clamp-2 leading-tight">
                    {assignment.assignment_title}
                  </h3>
                  <p className="text-[11px] text-blue-100 line-clamp-1">
                    {assignment.video_title}
                  </p>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2.5 text-xs flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <FileText className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">
                        {assignment.question_count || 0}
                      </span>
                      <span className="text-gray-600">câu</span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <Award className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">
                        {assignment.total_points}
                      </span>
                      <span className="text-gray-600">đ</span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">
                        {assignment.passing_score}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">
                        {assignment.time_limit_minutes}p
                      </span>
                    </div>
                  </div>

                  {assignment.recent_submission && (
                    <div
                      className={`mb-2.5 p-2.5 rounded-lg border ${
                        assignment.recent_submission.is_passed
                          ? 'bg-green-50 border-green-300'
                          : 'bg-amber-50 border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-700">
                          Điểm gần nhất:
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            assignment.recent_submission.is_passed
                              ? 'text-green-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {assignment.recent_submission.score}
                          <span className="text-xs text-gray-500">
                            /{assignment.total_points}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      if (assignment.video_id && !['completed', 'watched'].includes(assignment.video_completion_status || '')) {
                        toast.error(`Bạn cần hoàn thành xem video "${assignment.video_title}" trước khi làm bài tập này.`, {
                          icon: '📺'
                        });
                        return;
                      }
                      startAssignment(assignment);
                    }}
                    disabled={assignment.status !== 'published'}
                    className={`w-full py-2 text-sm font-semibold h-auto cursor-pointer disabled:cursor-not-allowed ${
                      assignment.status === 'published'
                        ? assignment.video_id && !['completed', 'watched'].includes(assignment.video_completion_status || '')
                          ? 'bg-gray-400 text-white hover:bg-gray-500'
                          : 'shadow-sm hover:shadow-md bg-[#a1001f] text-white hover:bg-[#840018]'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {assignment.status === 'published'
                      ? assignment.video_id && !['completed', 'watched'].includes(assignment.video_completion_status || '')
                        ? 'Cần xem video'
                        : assignment.recent_submission
                          ? 'Làm lại'
                          : 'Bắt đầu'
                      : 'Chưa mở'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pass Rate Drill-down Modal */}
        {(() => {
          const passRateItems = examAssignments
            .filter((item) => {
              const date = new Date(item.open_at)
              if (Number.isNaN(date.getTime())) return false
              const isExcluded = item.explanation_status === 'accepted'
              const { score } = getEffectiveExamScore(item)
              return !isExcluded && score !== null
            })
            .sort(
              (a, b) =>
                new Date(b.open_at).getTime() - new Date(a.open_at).getTime(),
            )

          const passed = passRateItems.filter((item) => {
            const { score } = getEffectiveExamScore(item)
            return isExamPassed(item, score)
          }).length

          return (
            <Modal
              open={showPassRateModal}
              onClose={() => setShowPassRateModal(false)}
              title="Chi tiết Tỉ lệ đạt"
              subtitle={`${passed} / ${passRateItems.length} bài đạt yêu cầu (theo danh sách đã tải)`}
              maxWidth="xl"
              headerColor="bg-[#a1001f]"
              footer={
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowPassRateModal(false)}
                  >
                    Đóng
                  </Button>
                </div>
              }
            >
              {passRateItems.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    Không có bài thi nào được tính trong phạm vi thống kê.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {passRateItems.map((item) => {
                    const { score: effectiveScore } =
                      getEffectiveExamScore(item)
                    const isPassed = isExamPassed(item, effectiveScore)
                    const date = new Date(item.open_at)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                          isPassed
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        {/* Pass/Fail icon */}
                        <div
                          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isPassed
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'
                          }`}
                        >
                          {isPassed ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>

                        {/* Subject & type */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">
                            {item.subject_code}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatMonthLabel(monthKey)} ·{' '}
                            {item.exam_type === 'expertise'
                              ? 'Chuyên môn'
                              : 'Trải nghiệm'}{' '}
                            ·{' '}
                            {item.registration_type === 'official'
                              ? 'Chính thức'
                              : 'Bổ sung'}
                          </p>
                        </div>

                        {/* Score */}
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-base font-bold ${
                              isPassed ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {effectiveScore}{' '}
                            <span className="text-xs font-normal text-gray-400">
                              / {item.total_points}
                            </span>
                          </p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPassed
                                ? 'bg-green-200 text-green-800'
                                : 'bg-red-200 text-red-800'
                            }`}
                          >
                            {isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Modal>
          )
        })()}

        <Modal
          isOpen={selectedExamInfo !== null}
          onClose={() => setSelectedExamInfo(null)}
          title="Thông tin bài thi"
          subtitle={selectedExamInfo?.subject_code || ''}
          maxWidth="lg"
          footer={
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedExamInfo(null)}
              >
                Đóng
              </Button>
            </div>
          }
        >
          {selectedExamInfo && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Môn học</p>
                  <p className="font-semibold text-gray-900">
                    {selectedExamInfo.subject_code}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <p className="font-semibold text-gray-900">
                    {getExamStatusLabel(selectedExamInfo)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Loại đăng ký</p>
                  <p className="font-semibold text-gray-900">
                    {formatRegistrationType(selectedExamInfo.registration_type)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Bộ đề</p>
                  <p className="font-semibold text-gray-900">
                    {selectedExamInfo.set_code} - {selectedExamInfo.set_name}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Mở bài</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedExamInfo.open_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Đóng bài</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedExamInfo.close_at).toLocaleString(
                      'vi-VN',
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-500">Tình trạng giải trình</p>
                  <p className="font-semibold text-gray-900">
                    {formatExplanationStatus(
                      selectedExamInfo.explanation_status,
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Điểm</p>
                <p className="text-base font-bold text-blue-900">
                  {(() => {
                    const { score } = getEffectiveExamScore(selectedExamInfo)
                    return formatScoreSummary(selectedExamInfo, score)
                  })()}
                </p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageContainer>
  )
}
