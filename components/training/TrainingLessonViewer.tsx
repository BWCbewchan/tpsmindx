'use client'

import { Button } from '@/components/ui/button'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { toast as flatToast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { useAppSelector, useAppDispatch } from '@/lib/redux/hooks'
import { setVideo } from '@/lib/redux/features/trainingSlice'
import { useTeacher } from '@/lib/teacher-context'
import { useToast } from '@/lib/use-toast'
import { Loader2, CheckCircle2, PlayCircle, Lock, Clock } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

interface Question {
  id: number
  time: number
  question: string
  options: string[]
  answer: number | null
}

interface TrainingVideoSegment {
  id: string | number
  url: string
  duration_seconds?: number | null
  duration_minutes?: number | null
}

interface TrainingAssignment {
  id: string | number
  [key: string]: unknown
}

interface TrainingQuestionRecord {
  id: number
  time_in_video?: number | null
  question_text: string
  options?: string[] | string | null
  correct_answer?: string | number | null
}

type LessonUser = {
  role?: string
  isAdmin?: boolean
}

interface PlaylistItemProps {
  lesson: any
  lessonId: string | null
  isActive: boolean
  isCompleted: boolean
  onClick: () => void
  assignment: any | null
  router: any
}

function PlaylistItem({
  lesson,
  lessonId,
  isActive,
  isCompleted,
  onClick,
  assignment,
  router,
}: PlaylistItemProps) {
  const isWatched = lesson.completion_status === 'watched'
  const assignmentVideoCompleted = ['completed', 'watched'].includes(
    assignment?.video_completion_status || '',
  )
  const canTakeQuiz = isCompleted || isWatched || assignmentVideoCompleted
  const pathname = usePathname()
  const isCandidatePortal = pathname?.startsWith('/candidate-portal') ?? false

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`w-full flex gap-3 p-3 transition text-left group hover:bg-slate-50/80 border-b border-slate-100 relative cursor-pointer
        ${isActive ? 'bg-[#a1001f]/5 border-l-2 border-[#a1001f]' : ''}`}
    >
      {/* Thumbnail or Fallback */}
      <div className="relative w-24 aspect-video rounded overflow-hidden bg-gray-100 flex-shrink-0 border border-slate-200/60">
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src =
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzljYTNhZiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0Ij5WaWRlbzwvdGV4dD48L3N2Zz4='
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-50 to-red-50">
            <PlayCircle className="w-6 h-6 text-[#a1001f]/40" />
          </div>
        )}

        {/* Duration Badge */}
        {lesson.duration_minutes > 0 && (
          <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 text-[9px] font-mono text-white rounded flex items-center gap-0.5 z-10">
            <Clock className="w-2.5 h-2.5 text-white/90" />
            {lesson.duration_minutes}p
          </span>
        )}
      </div>

      {/* Title & Progress info */}
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="text-[10px] font-bold text-[#a1001f] mb-0.5">
            Bài {lesson.lesson_number}
          </div>
          <h3 className={`text-xs font-semibold leading-snug line-clamp-2 transition
            ${isActive ? 'text-[#a1001f]' : 'text-slate-700 group-hover:text-[#a1001f]'}`}>
            {lesson.name}
          </h3>
        </div>

        <div className="flex flex-col gap-2 mt-1.5">
          {/* Bottom Row inside info: Status Badge */}
          <div className="flex items-center justify-between">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                Đã hoàn thành
              </span>
            ) : lesson.completion_status === 'in_progress' ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                <PlayCircle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Đang học
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <PlayCircle className="w-3.5 h-3.5 text-slate-300" />
                Chưa bắt đầu
              </span>
            )}

            {lesson.score > 0 && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                Điểm: {lesson.score}
              </span>
            )}
          </div>

          {/* Action button: Làm bài tập */}
          {assignment && (
            <div className="w-full">
              <button
                onClick={(e) => {
                  e.stopPropagation() // prevent changing active video
                  if (canTakeQuiz) {
                    const targetPath = isCandidatePortal
                      ? `/candidate-portal/tests?start_assignment_id=${assignment.id}&video_ok=1`
                      : `/user/dao-tao-nang-cao?start_assignment_id=${assignment.id}&video_ok=1`
                    router.push(targetPath)
                  } else {
                    flatToast.error('Bạn cần hoàn thành xem video bài học trước khi làm bài tập này.', {
                      icon: '📺',
                    })
                  }
                }}
                className={`w-full py-1.5 rounded-lg text-[11px] font-semibold text-center transition-all ${
                  canTakeQuiz
                    ? 'bg-[#a1001f] text-white hover:bg-[#8a001a] active:scale-95 shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80'
                }`}
              >
                Làm bài tập
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LessonContent() {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const { user, token } = useAuth()
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher()
  const toast = useToast()
  const searchParams = useSearchParams()
  const lessonIdParam = searchParams.get('id')
  const isCandidatePortalLesson = pathname?.startsWith('/candidate-portal/videos/lesson') ?? false
  const isAdminOnboardingLesson = pathname?.startsWith('/admin/hr-onboarding/videos/lesson') ?? false
  const isOnboardingLesson = isCandidatePortalLesson || isAdminOnboardingLesson
  const lessonBackHref = isAdminOnboardingLesson
    ? '/admin/hr-onboarding/videos'
    : isCandidatePortalLesson
      ? '/candidate-portal/videos'
      : '/user/dao-tao-nang-cao'

  // Ref to track token for event handlers (token thay đổi không trigger re-render)
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  /**
   * Gọi video.play() an toàn — bỏ qua AbortError (xảy ra khi element bị unmount
   * hoặc segment switch trong lúc play() đang pending). Lỗi thực sự vẫn được log.
   */
  const safePlay = (video: HTMLVideoElement): Promise<void> =>
    video.play().catch((e: unknown) => {
      if (
        e instanceof Error &&
        (e.name === 'AbortError' || e.message?.includes('interrupted'))
      ) {
        return // bình thường khi unmount / segment switch
      }
      console.error('[Lesson] play() failed:', e)
    })

  // Get video details from Redux
  const {
    currentVideoId,
    videoLink,
    title: reduxTitle,
    duration: reduxDurationMinutes,
    segments,
  } = useAppSelector((state) => state.training)

  // If IDs don't match or no video link, session is invalid (e.g. refresh)
  const isSessionValid =
    currentVideoId?.toString() === lessonIdParam && !!videoLink

  const lessonId = isSessionValid ? currentVideoId!.toString() : null
  const title = isSessionValid ? reduxTitle : null
  // Convert minutes from Redux to seconds for the video player overlay
  const overrideDurationSeconds = isSessionValid
    ? (reduxDurationMinutes || 1) * 60
    : 0

  const videoSegments = useMemo(() => {
    return isSessionValid && Array.isArray(segments) && segments.length > 0
      ? (segments as TrainingVideoSegment[])
      : videoLink
        ? [
            {
              id: currentVideoId!,
              url: videoLink,
              duration_minutes: overrideDurationSeconds / 60,
            },
          ]
        : []
  }, [
    isSessionValid,
    segments,
    videoLink,
    currentVideoId,
    overrideDurationSeconds,
  ])

  const [currentIndex, setCurrentIndex] = useState(0)
  const currentIndexRef = useRef(currentIndex)
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null)

  // Tính toán trước mốc thời gian bắt đầu của từng video và tổng thời lượng từ DB / Redux
  const { totalDurationMap, startTimes } = useMemo(() => {
    let total = 0
    const starts: number[] = []
    videoSegments.forEach((vid) => {
      starts.push(total)
      // Sử dụng ưu tiên duration_seconds nếu có, else duration_minutes
      const segmentSecs =
        vid.duration_seconds != null
          ? Number(vid.duration_seconds)
          : (vid.duration_minutes || 0) * 60
      total += segmentSecs
    })
    // Nếu db không có chi tiết segment length nhưng có overide length
    if (total === 0) total = overrideDurationSeconds

    return { totalDurationMap: total, startTimes: starts }
  }, [videoSegments, overrideDurationSeconds])

  const startTimesRef = useRef(startTimes)
  useEffect(() => {
    startTimesRef.current = startTimes
  }, [startTimes])

  const totalDurationMapRef = useRef(totalDurationMap)
  useEffect(() => {
    totalDurationMapRef.current = totalDurationMap
  }, [totalDurationMap])

  const videoUrl = videoSegments[currentIndex]?.url || null

  const [progress, setProgress] = useState(0)
  const [videoCompleted, setVideoCompleted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isSavingCompletion, setIsSavingCompletion] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number | null>(
    null,
  )
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set(),
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  // When resuming a previously-watched video, we queue a seek via pendingSeekTime.
  // This ref signals that once the seek is applied (in handleLoadedMetadata), we should
  // auto-play — even if isPlayingRef is still false (user hasn't pressed Play yet on
  // the resumed lesson).
  const pendingResumePlayRef = useRef(false)

  const [videoPaused, setVideoPaused] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false)
  const [currentAssignment, setCurrentAssignment] = useState<TrainingAssignment | null>(
    null,
  ) // Trạng thái bài tập của video hiện tại

  const [allLessons, setAllLessons] = useState<any[]>([])
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)

  const [candidateTrainingCode, setCandidateTrainingCode] = useState('')
  useEffect(() => {
    if (!isCandidatePortalLesson) { setCandidateTrainingCode(''); return }
    try {
      const raw = window.localStorage.getItem('candidatePortalProfile')
      const profile = raw ? JSON.parse(raw) as { candidate_code?: string; candidate_id?: number } : null
      setCandidateTrainingCode(String(profile?.candidate_code || (profile?.candidate_id ? `candidate-${profile.candidate_id}` : '')).trim().toLowerCase())
    } catch { setCandidateTrainingCode('') }
  }, [isCandidatePortalLesson])
  const resolvedTeacherCode = useMemo(() => {
    if (isCandidatePortalLesson) return candidateTrainingCode
    const profileCode = String(teacherProfile?.code || '').trim().toLowerCase()
    if (profileCode) return profileCode
    return user?.email ? user.email.split('@')[0].toLowerCase().trim() : ''
  }, [candidateTrainingCode, isCandidatePortalLesson, teacherProfile?.code, user?.email])

  const resolvedTeacherCodeRef = useRef(resolvedTeacherCode)
  useEffect(() => {
    resolvedTeacherCodeRef.current = resolvedTeacherCode
  }, [resolvedTeacherCode])

  // Fetch all lessons and progress
  useEffect(() => {
    if (isCandidatePortalLesson ? !candidateTrainingCode : (isTeacherLoading || !resolvedTeacherCode)) return
    const fetchLessons = async () => {
      setIsLoadingLessons(true)
      try {
        if (isCandidatePortalLesson) {
          const learnerCode = encodeURIComponent(resolvedTeacherCode)
          const [videosRes, assignmentsRes] = await Promise.all([
            fetch('/api/hr/onboarding/videos', { headers: authHeaders(token) }),
            fetch(`/api/candidate/training-assignments?assignment_context=all&learner_code=${learnerCode}`, { headers: authHeaders(token) }),
          ])
          const videosData = await videosRes.json()
          const assignmentsData = await assignmentsRes.json()
          if (videosRes.ok && Array.isArray(videosData?.data)) {
            setAllLessons(videosData.data.map((video: Record<string, unknown>) => ({
              ...video,
              name: video.title || video.name,
              link: video.video_link || video.link,
            })))
          }
          if (assignmentsRes.ok && Array.isArray(assignmentsData?.data)) setAllAssignments(assignmentsData.data)
          return
        }
        const teacherCode = encodeURIComponent(resolvedTeacherCode)
        const [dbRes, assignmentsRes] = await Promise.all([
          fetch(`/api/training-db?code=${teacherCode}`, {
            headers: authHeaders(token),
          }),
          fetch(`/api/training-assignments?status=published&teacher_code=${teacherCode}`, {
            headers: authHeaders(token),
          })
        ])

        if (dbRes.ok) {
          const data = await dbRes.json()
          if (data && Array.isArray(data.lessons)) {
            setAllLessons(data.lessons)
          }
        }

        if (assignmentsRes.ok) {
          const assData = await assignmentsRes.json()
          if (assData && Array.isArray(assData.data)) {
            setAllAssignments(assData.data)
          }
        }
      } catch (err) {
        console.error('[Lesson] Failed to fetch lessons or assignments:', err)
      } finally {
        setIsLoadingLessons(false)
      }
    }
    fetchLessons()
  }, [candidateTrainingCode, isCandidatePortalLesson, isTeacherLoading, resolvedTeacherCode, token, lessonIdParam, videoCompleted])

  const handleLessonClick = (lesson: any) => {
    if (lesson.id.toString() === lessonId) return
    if (lesson.link) {
      dispatch(
        setVideo({
          id: lesson.id,
          link: lesson.link,
          duration: lesson.duration_minutes || 0,
          title: lesson.name,
          segments: lesson.segments,
        }),
      )
      router.push(`${isCandidatePortalLesson ? '/candidate-portal/videos/lesson' : '/user/dao-tao-nang-cao/lesson'}?id=${lesson.id}`)
    }
  }

  // Ref to track user for event handlers
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  // Ref to track current lesson ID for event handlers to access latest value
  const lessonIdRef = useRef(lessonId)
  useEffect(() => {
    lessonIdRef.current = lessonId
  }, [lessonId])

  // ── Guard: redirect non-admin users if teacher profile missing ──
  useEffect(() => {
    if (!user) return
    if (isTeacherLoading) return

    const currentUser = user as LessonUser | null
    const isAdmin =
      currentUser?.role === 'admin' || currentUser?.isAdmin === true
    if (isAdmin) return

    // Check if teacher profile is valid
    if (!teacherProfile) {
      flatToast.error(
        'Chưa đồng bộ được thông tin giáo viên. Vui lòng thử lại sau.',
      )
      router.replace('/user/dao-tao-nang-cao')
    }
  }, [isCandidatePortalLesson, user, isTeacherLoading, teacherProfile, router])

  const getReliableLessonDurationSeconds = useCallback(() => {
    const currentVideoDuration = videoRef.current?.duration
    if (
      videoSegments.length <= 1 &&
      typeof currentVideoDuration === 'number' &&
      Number.isFinite(currentVideoDuration) &&
      currentVideoDuration > 0
    ) {
      return currentVideoDuration
    }

    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return duration
    }

    const mappedDuration = Number(totalDurationMapRef.current) || 0
    if (mappedDuration > 0) return mappedDuration

    return overrideDurationSeconds > 0 ? overrideDurationSeconds : 0
  }, [duration, overrideDurationSeconds, videoSegments.length])

  // Helper to save progress — dùng useCallback để reference ổn định trong event closures
  const saveCompletion = useCallback(async (id: string | null, durationSeconds: number): Promise<boolean> => {
    const currentUser = userRef.current
    const teacherCode =
      resolvedTeacherCodeRef.current ||
      (currentUser?.email
        ? currentUser.email.split('@')[0].toLowerCase().trim()
        : '')
    if (!id || !teacherCode) return false
    const safeDurationSeconds = Math.max(
      0,
      Math.floor(Number(durationSeconds) || 0),
    )
    try {
      const res = await fetch(isCandidatePortalLesson ? '/api/candidate/training-progress' : '/api/training-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(tokenRef.current),
        },
        body: JSON.stringify({
          [isCandidatePortalLesson ? 'learnerCode' : 'teacherCode']: teacherCode,
          videoId: id,
          timeSpent: safeDurationSeconds,
          isCompleted: true,
          eventType: 'ended',
          totalDuration: safeDurationSeconds > 0 ? safeDurationSeconds : undefined,
        }),
      })
      if (!res.ok) {
        console.error('[Lesson] saveCompletion failed:', res.status, await res.text().catch(() => ''))
        return false
      }
      const result = (await res.json()) as {
        data?: { completion_status?: string | null }
        completionAccepted?: boolean
      }
      const accepted =
        result.completionAccepted === true ||
        ['watched', 'completed'].includes(
          String(result.data?.completion_status || ''),
        )
      if (!accepted) {
        console.warn('[Lesson] Completion rejected by server timing checks')
        return false
      }
      // Signal training page để force-revalidate assignments cache
      try {
        sessionStorage.setItem('training_completion_invalidate', `${id}:${Date.now()}`)
      } catch { /* ignore */ }
      return true
    } catch (err) {
      console.error('[Lesson] Failed to save completion:', err)
      return false
    }
  }, [isCandidatePortalLesson])

  // Load assignment for the current video
  // deps: lessonId + token — re-fetch khi token vừa được set (tránh fetch lúc token chưa load)
  useEffect(() => {
    if (!lessonId) return
    const currentToken = tokenRef.current
    const loadAssignment = async () => {
      try {
        const res = await fetch(
          `${isCandidatePortalLesson ? '/api/candidate/training-assignments' : '/api/training-assignments'}?video_id=${lessonId}&status=published${isCandidatePortalLesson ? `&learner_code=${encodeURIComponent(resolvedTeacherCode)}` : ''}`,
          { headers: authHeaders(currentToken) },
        )
        const data = (await res.json()) as {
          success: boolean
          data?: TrainingAssignment[]
        }

        if (data.success && data.data && data.data.length > 0) {
          setCurrentAssignment(data.data[0])
        } else {
          setCurrentAssignment(null)
        }
      } catch (err) {
        console.error('[Lesson] Failed to load assignment:', err)
      }
    }
    loadAssignment()
  }, [lessonId, token]) // token trong deps để retry khi auth sẵn sàng

  // (Rest of the component code...)

  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const lastValidTimeRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════════════════════════════════════════════
  // ANTI-CHEAT SYSTEM
  // 1. Prototype patch: chặn rate > 1x tại nguồn (không cần reset mỗi frame)
  // 2. setInterval 500ms: check wall-clock — nhẹ hơn rAF 60fps nhiều
  // 3. Penalty: lùi đúng 15s từ lastSafePosition, cooldown 3s
  // ═══════════════════════════════════════════════════════════════════════

  const VIOLATION_LIMIT = 3
  const PENALTY_COOLDOWN = 3000
  const CHECK_INTERVAL = 500 // ms — check mỗi 500ms thay vì 60fps

  const wallStartRef = useRef<number | null>(null)
  const videoTimeAtWallRef = useRef<number>(0)
  const lastSafePositionRef = useRef<number>(0)
  const violationCountRef = useRef(0)
  const isLockedRef = useRef(false)
  const isReplayingRef = useRef(false)
  const lastPenaltyTimeRef = useRef<number>(0)
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  // Lấy native descriptor một lần khi mount — trước khi extension inject
  const nativeRateDesc = useRef(
    Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate'),
  )

  // Patch prototype: chặn rate > 1x tại nguồn
  // Extension gọi video.playbackRate = 1.5 → setter bị intercept → thực tế set 1.0
  useEffect(() => {
    const desc = nativeRateDesc.current
    if (!desc?.set || !desc?.get) return
    const { set: nativeSet, get: nativeGet } = desc
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable: true,
        get() {
          return nativeGet.call(this)
        },
        set(val: number) {
          nativeSet.call(this, Math.min(1.0, Math.max(0.1, Number(val) || 1)))
        },
      })
    } catch {
      /* Safari fallback — interval sẽ xử lý */
    }
    return () => {
      try {
        Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', desc)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Apply penalty — có cooldown để tránh loop
  const applyPenalty = useCallback(
    (video: HTMLVideoElement, reason: string) => {
      const now = Date.now()
      if (now - lastPenaltyTimeRef.current < PENALTY_COOLDOWN) return
      if (isLockedRef.current) return

      lastPenaltyTimeRef.current = now
      violationCountRef.current += 1
      console.warn(`[AntiCheat] ${reason} — #${violationCountRef.current}`)

      const { set: nativeSet } = nativeRateDesc.current ?? {}

      // Reset rate về 1x
      try {
        nativeSet?.call(video, 1.0)
      } catch {
        /* ignore */
      }

      // Reset wall-clock từ vị trí hiện tại
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      wallStartRef.current = Date.now()
      videoTimeAtWallRef.current = Math.max(0, video.currentTime - offset)
      lastSafePositionRef.current = Math.max(0, video.currentTime - offset)

      if (violationCountRef.current >= VIOLATION_LIMIT) {
        // Lần thứ 3: pause hẳn
        video.pause()
        isLockedRef.current = true
        violationCountRef.current = 0
        setIsPlaying(false)
        isPlayingRef.current = false
        playbackAllowedRef.current = false
        flatToast.error('🚫 Gian lận bị phát hiện. Video đã bị tạm dừng.', {
          duration: 6000,
        })
      } else {
        // Lần 1-2: chỉ reset tốc độ về 1x, cảnh báo
        flatToast.error('⚠️ Phát hiện tốc độ bất thường! Đã đặt lại về 1x.', {
          duration: 4000,
        })
      }
    },
    [setIsPlaying],
  )

  // Interval 500ms: nhẹ hơn rAF 60fps, đủ để detect trong ~0.5s
  const startAntiCheatLoop = useCallback(() => {
    if (checkTimerRef.current !== null) return

    checkTimerRef.current = setInterval(() => {
      const video = videoElRef.current
      if (
        !video ||
        video.paused ||
        isLockedRef.current ||
        isReplayingRef.current
      )
        return

      const { get: nativeGet, set: nativeSet } = nativeRateDesc.current ?? {}
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      const localTime = Math.max(0, video.currentTime - offset)

      // Fallback: reset rate nếu prototype patch bị bypass
      const realRate = nativeGet?.call(video) ?? 1
      if (realRate > 1.01) {
        try {
          nativeSet?.call(video, 1.0)
        } catch {
          /* ignore */
        }
        applyPenalty(video, `Rate=${realRate.toFixed(2)}x`)
        return // skip wall-clock check trong lần này
      }

      // Rate hợp lệ → cập nhật lastSafePosition và wall-clock
      lastSafePositionRef.current = localTime

      if (wallStartRef.current === null) {
        wallStartRef.current = Date.now()
        videoTimeAtWallRef.current = localTime
        return
      }

      // Wall-clock check: buffer 2% + 0.5s để tránh false positive từ buffering
      const wallElapsed = (Date.now() - wallStartRef.current) / 1000
      const maxAllowedPos =
        videoTimeAtWallRef.current + wallElapsed * 1.02 + 0.5

      if (localTime > maxAllowedPos) {
        applyPenalty(
          video,
          `Wall-clock: ${localTime.toFixed(2)}s > ${maxAllowedPos.toFixed(2)}s`,
        )
      } else {
        // Bình thường → reset baseline để tránh drift tích lũy
        wallStartRef.current = Date.now()
        videoTimeAtWallRef.current = localTime
      }
    }, CHECK_INTERVAL)
  }, [applyPenalty])

  const stopAntiCheatLoop = useCallback(() => {
    if (checkTimerRef.current !== null) {
      clearInterval(checkTimerRef.current)
      checkTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    startAntiCheatLoop()
    return () => stopAntiCheatLoop()
  }, [startAntiCheatLoop, stopAntiCheatLoop])

  const lockPlaybackRate = useCallback((video: HTMLVideoElement) => {
    videoElRef.current = video
    const { set: nativeSet } = nativeRateDesc.current ?? {}
    try {
      nativeSet?.call(video, 1.0)
    } catch {
      /* ignore */
    }
    if (wallStartRef.current === null) {
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      const pos = Math.max(0, video.currentTime - offset)
      wallStartRef.current = Date.now()
      videoTimeAtWallRef.current = pos
      lastSafePositionRef.current = pos
    }
  }, [])

  const resetWallClock = useCallback((video: HTMLVideoElement) => {
    const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
    const pos = Math.max(0, video.currentTime - offset)
    wallStartRef.current = Date.now()
    videoTimeAtWallRef.current = pos
    lastSafePositionRef.current = pos
    isLockedRef.current = false
  }, [])

  // Ref to track if we are in quiz mode (to prevent auto-resume)
  const isQuizActiveRef = useRef(false)
  const isPlayingRef = useRef(false)
  /** false after tab hide / blur — blocks segment switch, loadedmetadata, canplay from calling play() until user clicks Play */
  const playbackAllowedRef = useRef(false)
  useEffect(() => {
    isQuizActiveRef.current = videoPaused || currentQuestionIdx !== null
  }, [videoPaused, currentQuestionIdx])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Reset state when lesson changes
  useEffect(() => {
    setProgress(0)
    setVideoCompleted(false)
    setCurrentTime(0)
    setDuration(0)
    setQuestions([])
    setCurrentQuestionIdx(null)
    setUserAnswer(null)
    setAnsweredQuestions(new Set())
    setVideoPaused(false)
    setShowResult(false)
    setIsCorrectAnswer(false)
    setIsPlaying(false)
    playbackAllowedRef.current = false
    setCurrentIndex(0)
    setPendingSeekTime(null)

    // Reset anti-cheat state refs
    isLockedRef.current = false
    violationCountRef.current = 0
    lastValidTimeRef.current = 0
    wallStartRef.current = null
    videoTimeAtWallRef.current = 0
    isReplayingRef.current = false
    lastPenaltyTimeRef.current = 0
    lastSafePositionRef.current = 0
    pendingResumePlayRef.current = false

    // Reset video element
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.load()
    }
  }, [lessonId])

  useEffect(() => {
    const docHidden = () =>
      typeof document !== 'undefined' &&
      (document.hidden ||
        document.visibilityState !== 'visible' ||
        // Safari legacy
        !!(document as Document & { webkitHidden?: boolean }).webkitHidden)

    const pauseAllVideos = () => {
      playbackAllowedRef.current = false
      isPlayingRef.current = false
      setIsPlaying(false)
      document.querySelectorAll('video').forEach((v) => {
        if (!v.paused) v.pause()
      })
    }

    const handleVisibilityChange = () => {
      if (docHidden()) pauseAllVideos()
    }

    const handlePageHide = () => pauseAllVideos()

    // Bổ sung khi visibility không đổi (ví dụ focus sang app/cửa sổ khác) — document mất focus → dừng phát
    const handleWindowBlur = () => {
      if (typeof document !== 'undefined' && !document.hasFocus()) {
        pauseAllVideos()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange, true)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
        true,
      )
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  // Load saved progress
  useEffect(() => {
    const controller = new AbortController()

    const loadProgress = async () => {
      if (!lessonId || !resolvedTeacherCode) return

      try {
        if (isCandidatePortalLesson) {
          const learnerCode = encodeURIComponent(resolvedTeacherCode)
          const [videosRes, assignmentsRes] = await Promise.all([
            fetch('/api/hr/onboarding/videos', { headers: authHeaders(token) }),
            fetch(`/api/candidate/training-assignments?assignment_context=all&learner_code=${learnerCode}`, { headers: authHeaders(token) }),
          ])
          const videosData = await videosRes.json()
          const assignmentsData = await assignmentsRes.json()
          if (videosRes.ok && Array.isArray(videosData?.data)) {
            setAllLessons(videosData.data.map((video: Record<string, unknown>) => ({
              ...video,
              name: video.title || video.name,
              link: video.video_link || video.link,
            })))
          }
          if (assignmentsRes.ok && Array.isArray(assignmentsData?.data)) setAllAssignments(assignmentsData.data)
          return
        }
        const teacherCode = encodeURIComponent(resolvedTeacherCode)
        const res = await fetch(
          `${isCandidatePortalLesson ? '/api/candidate/training-progress' : '/api/training-progress'}?${isCandidatePortalLesson ? 'learnerCode' : 'teacherCode'}=${teacherCode}&videoId=${lessonId}`,
          {
            signal: controller.signal,
            headers: authHeaders(token),
          },
        )
        const data = (await res.json()) as {
          success: boolean
          data?: {
            time_spent_seconds: number
            completion_status?: string | null
          }
        }

        if (data.success && data.data) {
          const { time_spent_seconds, completion_status } = data.data
          const currentIndexSnapshot = currentIndexRef.current
          const startTimesSnapshot = startTimesRef.current
          const totalDurationSnapshot = totalDurationMapRef.current

          if (completion_status === 'completed' || completion_status === 'watched') {
            setVideoCompleted(true)
            setProgress(100)
            setIsPlaying(false)
            isPlayingRef.current = false
            playbackAllowedRef.current = false
          } else if (time_spent_seconds > 0) {
            // Find target video segment
            let targetIndex = 0
            let timeInTargetVideo = time_spent_seconds

            for (let i = 0; i < startTimesSnapshot.length; i++) {
              const start = startTimesSnapshot[i]
              const nextStart = startTimesSnapshot[i + 1] || totalDurationSnapshot

              if (
                time_spent_seconds >= start &&
                time_spent_seconds < nextStart
              ) {
                targetIndex = i
                timeInTargetVideo = time_spent_seconds - start
                break
              }
            }

            if (targetIndex === currentIndexSnapshot) {
              // Always queue via pendingSeekTime so handleLoadedMetadata applies
              // the seek after metadata is ready. Directly setting currentTime
              // when readyState < 1 silently fails and causes the resume lag.
              isReplayingRef.current = true
              // Allow auto-play after seek — user intends to continue watching.
              // Without this, handleLoadedMetadata's playbackAllowedRef check fails
              // and the video seeks but never plays.
              playbackAllowedRef.current = true
              lastValidTimeRef.current = time_spent_seconds
              lastSafePositionRef.current = timeInTargetVideo
              // Pre-set wall-clock baseline to the RESUME position so that the
              // anti-cheat loop does not see a giant jump from 0 → savedTime.
              wallStartRef.current = Date.now()
              videoTimeAtWallRef.current = timeInTargetVideo
              if (
                videoRef.current &&
                videoRef.current.readyState >= 1
              ) {
                // Metadata already loaded — seek immediately
                const offset =
                  videoRef.current.seekable.length > 0
                    ? videoRef.current.seekable.start(0)
                    : 0
                videoRef.current.currentTime = timeInTargetVideo + offset
                // Signal auto-play after seek if not already playing
                pendingResumePlayRef.current = true
              } else {
                // Metadata not yet loaded — queue for handleLoadedMetadata
                setPendingSeekTime(timeInTargetVideo)
                // Signal that handleLoadedMetadata should auto-play after seek
                pendingResumePlayRef.current = true
              }
              // Hold isReplaying guard for 3s to cover seek → buffer → canplay.
              // 800ms was too short — anti-cheat interval (500ms) could fire
              // after the guard expired but before resetWallClock in handlePlaying.
              setTimeout(() => {
                isReplayingRef.current = false
              }, 3000)
            } else {
              setIsPlaying(false)
              isPlayingRef.current = false
              isReplayingRef.current = true
              // Allow auto-play after seeking to the resume position.
              playbackAllowedRef.current = true
              lastValidTimeRef.current = time_spent_seconds
              lastSafePositionRef.current = timeInTargetVideo
              // Pre-seed wall-clock at resume position to prevent false positives.
              wallStartRef.current = Date.now()
              videoTimeAtWallRef.current = timeInTargetVideo
              setCurrentIndex(targetIndex)
              setPendingSeekTime(timeInTargetVideo)
              pendingResumePlayRef.current = true
              setTimeout(() => {
                isReplayingRef.current = false
              }, 3000)
            }
          }
        }
      } catch (err: unknown) {
        const errorName =
          typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name?: unknown }).name)
            : ''
        if (errorName !== 'AbortError') {
          console.error('[Lesson] Failed to load progress:', err)
        }
      }
    }

    loadProgress()
    return () => controller.abort()
  }, [lessonId, resolvedTeacherCode, token])

  // Save progress periodically (every 10 seconds)
  useEffect(() => {
    if (!isPlaying || !lessonId || !resolvedTeacherCode) return

    const teacherCode = resolvedTeacherCode
    const interval = setInterval(async () => {
      // Get current time directly from video element for accuracy
      const time = videoRef.current ? videoRef.current.currentTime : 0
      if (time <= 0) return

      const globalTime = (startTimesRef.current[currentIndexRef.current] ?? 0) + time
      const globalDuration = getReliableLessonDurationSeconds()

      try {
        await fetch(isCandidatePortalLesson ? '/api/candidate/training-progress' : '/api/training-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(tokenRef.current),
          },
          body: JSON.stringify({
            [isCandidatePortalLesson ? 'learnerCode' : 'teacherCode']: teacherCode,
            videoId: lessonId,
            timeSpent: globalTime,
            isCompleted: false,
            totalDuration: globalDuration > 0 ? globalDuration : undefined,
            eventType: 'heartbeat',
          }),
        })
      } catch (err) {
        console.error('[Lesson] Failed to save progress:', err)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [getReliableLessonDurationSeconds, isPlaying, lessonId, resolvedTeacherCode])

  // Save progress on completion (removed)
  useEffect(() => {
    // Only run when lessonId changes to reset state
    // Old implementation was causing auto-complete on next video
    // Keeping this comment for context, but effect is effectively removed
  }, [])

  // Load questions from database
  useEffect(() => {
    const loadQuestions = async () => {
      if (!lessonId) {
        console.warn('[Lesson] ⚠️ No lessonId found in URL')
        setQuestions([])
        return
      }
      try {
        const response = await fetch(
          `/api/training-video-questions?video_id=${lessonId}`,
          { headers: authHeaders(tokenRef.current) },
        )
        const data = (await response.json()) as {
          success: boolean
          data?: TrainingQuestionRecord[]
        }

        if (data.success && data.data && data.data.length > 0) {
          const loadedQuestions = data.data.map((question) => ({
            id: Number(question.id),
            time: question.time_in_video || 0,
            question: question.question_text,
            options:
              typeof question.options === 'string'
                ? (JSON.parse(question.options) as string[])
                : question.options || [],
            answer: null,
          }))
          setQuestions(loadedQuestions)
        } else {
          setQuestions([])
        }
      } catch (err: unknown) {
        console.error('[Lesson] ❌ Error loading questions:', err)
        setQuestions([])
      }
    }
    loadQuestions()
  }, [lessonId])

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Check for questions at current time
  useEffect(() => {
    if (videoPaused || questions.length === 0 || currentQuestionIdx !== null)
      return
    if (currentTime === 0 || duration === 0) return

    const foundQuestion = questions.findIndex((q) => {
      const timeDiff = Math.abs(q.time - currentTime)
      return timeDiff <= 2 && !answeredQuestions.has(q.id)
    })

    if (foundQuestion !== -1) {
      setCurrentQuestionIdx(foundQuestion)
      setVideoPaused(true)
      if (videoRef.current) videoRef.current.pause()
    }
  }, [
    currentTime,
    duration,
    questions,
    answeredQuestions,
    videoPaused,
    currentQuestionIdx,
  ])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Immediately play if already buffered — chỉ khi user đã bật phát (không tự play sau khi vừa ẩn tab)
    if (
      playbackAllowedRef.current &&
      isPlayingRef.current &&
      video.readyState >= 1 &&
      !document.hidden &&
      document.visibilityState === 'visible'
    ) {
      safePlay(video)
      setIsWaiting(false)
    }

    // Đảm bảo volume áp dụng lại cho video mới
    video.volume = volume

    const handleTimeUpdate = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean })
        .webkitHidden
      if (
        document.hidden ||
        document.visibilityState !== 'visible' ||
        webkitHidden
      ) {
        if (!video.paused) video.pause()
        playbackAllowedRef.current = false
        isPlayingRef.current = false
        setIsPlaying(false)
        return
      }
      if (!playbackAllowedRef.current) {
        if (!video.paused) video.pause()
        isPlayingRef.current = false
        setIsPlaying(false)
        return
      }

      // ── Seek block ────────────────────────────────────────────────────────
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      const localCrtTime = Math.max(0, video.currentTime - offset)
      const gTime = (startTimes[currentIndex] ?? 0) + localCrtTime
      const lastTime = lastValidTimeRef.current

      // Skip seek enforcement during resume replaying to prevent snapping back to
      // position 0 while the seek to the saved position is still being processed.
      if (!isReplayingRef.current && Math.abs(gTime - lastTime) > 3) {
        video.currentTime =
          Math.max(
            0,
            lastValidTimeRef.current - (startTimes[currentIndex] ?? 0),
          ) + offset
        return
      }

      lastValidTimeRef.current = gTime
      setCurrentTime(gTime)

      // Early switch to next segment
      if (currentIndex < videoSegments.length - 1 && video.duration > 0) {
        const timeRemaining = video.duration - localCrtTime
        if (timeRemaining <= 0.25) {
          if (document.hidden || !playbackAllowedRef.current) {
            if (!video.paused) video.pause()
            setIsPlaying(false)
            isPlayingRef.current = false
            return
          }
          setIsWaiting(true)
          setCurrentIndex((prev) => prev + 1)
          setIsPlaying(true)
          isPlayingRef.current = true
        }
      }
    }

    const handleLoadedMetadata = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean })
        .webkitHidden
      const visible =
        !document.hidden &&
        document.visibilityState === 'visible' &&
        !webkitHidden
      // Lock playbackRate ngay khi video load để chặn extension
      lockPlaybackRate(video)
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      if (pendingSeekTime !== null) {
        // Apply queued resume seek. After seeking, resume playback if:
        //   (a) the player was already playing, OR
        //   (b) loadProgress queued this seek for auto-resume (pendingResumePlayRef).
        const seekTarget = pendingSeekTime
        isReplayingRef.current = true
        video.currentTime = seekTarget + offset
        setPendingSeekTime(null)
        // Reset wall-clock baseline to the SEEK TARGET position immediately.
        // This prevents the anti-cheat loop from seeing a jump from 0 → seekTarget
        // and triggering a false "abnormal speed" warning.
        wallStartRef.current = Date.now()
        videoTimeAtWallRef.current = seekTarget
        lastSafePositionRef.current = seekTarget
        setTimeout(() => {
          isReplayingRef.current = false
        }, 3000)
        const shouldPlay =
          playbackAllowedRef.current &&
          visible &&
          (isPlayingRef.current || pendingResumePlayRef.current)
        pendingResumePlayRef.current = false
        if (shouldPlay) {
          safePlay(video)
          setIsPlaying(true)
          isPlayingRef.current = true
          setIsWaiting(false)
        }
      } else {
        if (playbackAllowedRef.current && isPlayingRef.current && visible) {
          safePlay(video)
          setIsWaiting(false)
        }
      }

      // For single-segment videos, always use the real duration from the browser.
      // overrideDurationSeconds (from DB) is only a fallback when browser can't determine duration.
      if (startTimes.length === 1) {
        setDuration(
          video.duration > 0 ? video.duration : overrideDurationSeconds,
        )
      } else {
        setDuration(totalDurationMap)
      }
    }

    const handleCanPlay = () => {
      const shouldResume =
        playbackAllowedRef.current &&
        !document.hidden &&
        document.visibilityState === 'visible' &&
        (isPlayingRef.current || pendingResumePlayRef.current)
      if (shouldResume) {
        pendingResumePlayRef.current = false
        safePlay(video)
        setIsWaiting(false)
      }
    }


    const handleEnded = async () => {
      if (currentIndex < videoSegments.length - 1) {
        // Có phần tiếp theo của video hiện tại (Cloudinary parts)

        // Vanilla DOM fix for gapless transitions
        const nextVideoEl = document.getElementById(
          `video-part-${currentIndex + 1}`,
        ) as HTMLVideoElement
        if (nextVideoEl) {
          nextVideoEl.muted = volume === 0
          nextVideoEl.volume = volume
          nextVideoEl.currentTime = 0

          const isHidden =
            document.hidden ||
            document.visibilityState === 'hidden' ||
            !!(document as Document & { webkitHidden?: boolean }).webkitHidden
          if (playbackAllowedRef.current && isPlayingRef.current && !isHidden) {
            safePlay(nextVideoEl)
            setIsPlaying(true)
          } else {
            setIsPlaying(false)
            isPlayingRef.current = false
          }

          nextVideoEl.classList.remove('hidden')
          nextVideoEl.classList.add('block')

          video.classList.remove('block')
          video.classList.add('hidden')
        }

        setIsWaiting(false)
        setCurrentIndex((prev) => prev + 1)
        if (
          !document.hidden &&
          playbackAllowedRef.current &&
          isPlayingRef.current
        ) {
          setIsPlaying(true)
        } else {
          setIsPlaying(false)
          isPlayingRef.current = false
        }
      } else {
        setIsPlaying(false)
        isPlayingRef.current = false
        setIsSavingCompletion(true)

        let completionSaved = false
        if (lessonIdRef.current && userRef.current?.email) {
          completionSaved = await saveCompletion(
            lessonIdRef.current,
            getReliableLessonDurationSeconds(),
          )
        }

        setIsSavingCompletion(false)
        if (completionSaved) {
          setProgress(100)
          setVideoCompleted(true)
        } else {
          flatToast.error(
            'Máy chủ chưa xác nhận đủ thời gian xem. Video sẽ tiếp tục từ vị trí đã ghi nhận.',
          )
        }
      }
    }

    const handlePlaying = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean })
        .webkitHidden
      if (
        document.hidden ||
        document.visibilityState !== 'visible' ||
        webkitHidden ||
        !playbackAllowedRef.current
      ) {
        video.pause()
        playbackAllowedRef.current = false
        setIsPlaying(false)
        isPlayingRef.current = false
        return
      }
      // Lock playbackRate và reset wall-clock baseline mỗi khi bắt đầu play
      lockPlaybackRate(video)
      resetWallClock(video)
      isLockedRef.current = false
      setIsWaiting(false)

      const teacherCode = resolvedTeacherCodeRef.current
      const activeLessonId = lessonIdRef.current
      if (teacherCode && activeLessonId) {
        const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
        const localTime = Math.max(0, video.currentTime - offset)
        const globalTime =
          (startTimesRef.current[currentIndexRef.current] ?? 0) + localTime
        fetch(isCandidatePortalLesson ? '/api/candidate/training-progress' : '/api/training-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(tokenRef.current),
          },
          body: JSON.stringify({
            [isCandidatePortalLesson ? 'learnerCode' : 'teacherCode']: teacherCode,
            videoId: activeLessonId,
            timeSpent: globalTime,
            isCompleted: false,
            eventType: 'start',
          }),
        }).catch((err) =>
          console.error('[Lesson] Failed to start progress session:', err),
        )
      }
    }

    const handlePause = () => {
      if (lessonIdRef.current) {
        const teacherCode =
          resolvedTeacherCodeRef.current ||
          (userRef.current?.email
            ? userRef.current.email.split('@')[0].toLowerCase().trim()
            : '')
        if (!teacherCode) return

        const time = video.currentTime
        const globalTime = (startTimesRef.current[currentIndexRef.current] ?? 0) + time
        const globalDuration = getReliableLessonDurationSeconds()

        fetch(isCandidatePortalLesson ? '/api/candidate/training-progress' : '/api/training-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(tokenRef.current),
          },
          body: JSON.stringify({
            [isCandidatePortalLesson ? 'learnerCode' : 'teacherCode']: teacherCode,
            videoId: lessonIdRef.current,
            timeSpent: globalTime,
            isCompleted: false,
            totalDuration: globalDuration > 0 ? globalDuration : undefined,
            eventType: 'pause',
          }),
        }).catch((err) =>
          console.error('[Lesson] Failed to save on pause:', err),
        )
      }
    }

    const handleError = (errorEvent: Event) => {
      console.error('[Lesson] Video error:', video.error, errorEvent)
      if (video.error && video.error.code === 4) {
        toastRef.current?.error(
          'Không tải được video: file không tồn tại, hết hạn link hoặc định dạng không hỗ trợ.',
        )
      } else {
        toastRef.current?.error(
          'Lỗi tải luồng trình phát video, vui lòng tải lại trang.',
        )
      }
    }

    const handleSeeking = () => {
      // Chỉ cho phép seek nội bộ khi resume, chuyển segment hoặc xem lại từ đầu.
      if (isReplayingRef.current) return

      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
      const attemptedTime = Math.max(0, video.currentTime - offset)
      const localLastTime = Math.max(
        0,
        lastValidTimeRef.current - (startTimes[currentIndex] ?? 0),
      )

      if (Math.abs(attemptedTime - localLastTime) > 0.25) {
        isReplayingRef.current = true
        video.currentTime = localLastTime + offset
        wallStartRef.current = Date.now()
        videoTimeAtWallRef.current = localLastTime
        setTimeout(() => {
          isReplayingRef.current = false
        }, 150)

        if (Date.now() - lastPenaltyTimeRef.current > 2500) {
          lastPenaltyTimeRef.current = Date.now()
          flatToast.error('Không thể tua video đào tạo.', {
            duration: 2500,
          })
        }
      }
    }

    const handleRateChange = () => {
      const realRate =
        Object.getOwnPropertyDescriptor(
          HTMLMediaElement.prototype,
          'playbackRate',
        )?.get?.call(video) ?? video.playbackRate
      if (realRate > 1.01) {
        try {
          Object.getOwnPropertyDescriptor(
            HTMLMediaElement.prototype,
            'playbackRate',
          )?.set?.call(video, 1.0)
        } catch {
          /* ignore */
        }
        setPlaybackSpeed(1)
        wallStartRef.current = Date.now()
        const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0
        videoTimeAtWallRef.current = Math.max(0, video.currentTime - offset)
      }
    }

    const handleWaiting = () => setIsWaiting(true)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ratechange', handleRateChange)
    video.addEventListener('seeking', handleSeeking)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)
    video.addEventListener('waiting', handleWaiting)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ratechange', handleRateChange)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
      video.removeEventListener('seeking', handleSeeking)
      video.removeEventListener('waiting', handleWaiting)
    }
  }, [
    currentIndex,
    isPlaying,
    volume,
    pendingSeekTime,
    videoSegments,
    startTimes,
    overrideDurationSeconds,
    totalDurationMap,
    duration,
    getReliableLessonDurationSeconds,
    lockPlaybackRate,
    resetWallClock,
    saveCompletion,
  ])

  // Update progress bar based on video time
  useEffect(() => {
    if (duration > 0) {
      const calculatedProgress = (currentTime / duration) * 100
      setProgress(Math.min(100, Math.max(0, calculatedProgress)))
    }
  }, [currentTime, duration])

  const handleAnswerQuestion = async () => {
    if (currentQuestionIdx === null || userAnswer === null) return

    const question = questions[currentQuestionIdx]
    try {
      const response = await fetch('/api/training-video-questions/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(tokenRef.current),
        },
        body: JSON.stringify({
          question_id: question.id,
          selected_answer: userAnswer,
          teacher_code: resolvedTeacherCode,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        flatToast.error(data.error || 'Không thể kiểm tra đáp án')
        return
      }

      const correctAnswer =
        typeof data.correct_answer === 'number'
          ? data.correct_answer
          : Number.parseInt(String(data.correct_answer ?? ''), 10)
      const normalizedCorrectAnswer = Number.isFinite(correctAnswer)
        ? correctAnswer
        : null

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === question.id
            ? { ...item, answer: normalizedCorrectAnswer }
            : item,
        ),
      )
      setAnsweredQuestions((prev) => new Set([...prev, question.id]))
      setIsCorrectAnswer(Boolean(data.correct))
      setShowResult(true)
    } catch (error) {
      console.error('[Lesson] Failed to validate answer:', error)
      flatToast.error('Không thể kiểm tra đáp án')
    }
  }

  const handleContinue = () => {
    // Reset states and resume video
    setCurrentQuestionIdx(null)
    setUserAnswer(null)
    setShowResult(false)
    setIsCorrectAnswer(false)
    setVideoPaused(false)
    if (videoRef.current) {
      playbackAllowedRef.current = true
      safePlay(videoRef.current)
      setIsPlaying(true)
    }
  }

  // Custom video controls handlers
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        playbackAllowedRef.current = true
        safePlay(videoRef.current)
        setIsPlaying(true)
      }
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setVolume(newVolume)
    }
  }

  const goToAssignmentAfterCompletion = useCallback(async () => {
    if (isSavingCompletion) return

    setIsSavingCompletion(true)
    try {
      const saved = await saveCompletion(
        lessonIdRef.current,
        getReliableLessonDurationSeconds(),
      )

      if (!saved) {
        flatToast.error(
          'Chưa lưu được trạng thái hoàn thành video. Vui lòng thử lại.',
        )
        return
      }

      let assignmentId = currentAssignment?.id
      if (!assignmentId && lessonId) {
        try {
          const res = await fetch(
            `${isCandidatePortalLesson ? '/api/candidate/training-assignments' : '/api/training-assignments'}?video_id=${lessonId}&status=published${isCandidatePortalLesson ? `&learner_code=${encodeURIComponent(resolvedTeacherCode)}` : ''}`,
            { headers: authHeaders(tokenRef.current) },
          )
          const data = (await res.json()) as {
            success: boolean
            data?: TrainingAssignment[]
          }
          if (data.success && data.data && data.data.length > 0) {
            setCurrentAssignment(data.data[0])
            assignmentId = data.data[0].id
          }
        } catch {
          /* fallback below */
        }
      }

      if (assignmentId) {
        router.push(
          `${isCandidatePortalLesson ? '/candidate-portal/tests' : '/user/dao-tao-nang-cao'}?start_assignment_id=${assignmentId}&video_ok=1`,
        )
      } else {
        flatToast.error('Không tìm thấy bài tập của video này.')
        router.push(isCandidatePortalLesson ? '/candidate-portal/videos' : '/user/dao-tao-nang-cao')
      }
    } finally {
      setIsSavingCompletion(false)
    }
  }, [
    currentAssignment?.id,
    getReliableLessonDurationSeconds,
    isSavingCompletion,
    lessonId,
    router,
    saveCompletion,
  ])

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return

    if (!isFullscreen) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      // Clear controls timeout on unmount
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  // Handle invalid session (e.g. refresh) by redirecting
  useEffect(() => {
    if (!videoUrl) {
      router.push(isCandidatePortalLesson ? '/candidate-portal/videos' : '/user/dao-tao-nang-cao')
    }
  }, [videoUrl, router])

  if (!videoUrl) return null // Render nothing while redirecting

  return (
    <div className="bg-black min-h-screen overflow-x-hidden lg:h-screen lg:overflow-hidden">
      <div className="flex flex-col lg:h-full">
        {/* Header - compact */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-4 py-2 flex items-center gap-3 z-50">
          <button
            onClick={() => router.push(lessonBackHref)}
            className="p-1.5 hover:bg-white/10 rounded-full transition"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 text-sm font-bold text-white break-words text-pretty leading-snug line-clamp-2 text-center">
            {title || 'Bài học'}
          </h1>
          <div className="text-xs text-white/80">
            {Math.floor(currentTime / 60)}:
            {String(Math.floor(currentTime % 60)).padStart(2, '0')} /{' '}
            {Math.floor(duration / 60)}:
            {String(Math.floor(duration % 60)).padStart(2, '0')}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
          {/* Left Column: Player + Info Bar */}
          <div className="flex-1 flex flex-col lg:h-full lg:overflow-hidden">

            {/* Video player container */}
        <div
          ref={playerContainerRef}
          className="relative bg-black overflow-hidden w-full aspect-video lg:aspect-auto lg:flex-1"
          onMouseMove={handleMouseMove}
          onTouchStart={() => setShowControls(true)}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {/* Multi-video buffering logic: We render ALL video segments but only ONE is visible and attached to videoRef.
              This guarantees the browser completes DNS handshake, preload cache, and audio initialization bounds BEFORE they appear.
          */}
          {videoSegments.map((segment, idx) => {
            const isActive = idx === currentIndex
            const isNext = idx === currentIndex + 1

            // Only render current, next, or keep DOM alive to prevent re-load
            if (!isActive && !isNext) return null

            return (
              <video
                key={segment.id}
                id={`video-part-${idx}`}
                ref={isActive ? videoRef : null}
                src={segment.url}
                preload={isActive ? 'auto' : isNext ? 'metadata' : 'none'}
                className={`w-full h-full object-contain ${isActive ? 'block' : 'hidden'}`}
                style={{ maxHeight: '100%' }}
                onClick={isActive ? togglePlayPause : undefined}
                onContextMenu={(e) => e.preventDefault()}
                controlsList="nodownload noplaybackrate noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                tabIndex={-1}
                playsInline
                // If this is the next video, keep it muted so browser aggressive autoplay policies don't complain during background buffer
                muted={!isActive || volume === 0}
              />
            )
          })}

          {/* Loading overlay */}
          {isWaiting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            </div>
          )}

          {/* Central Play/Pause overlay */}
          {!isPlaying && currentQuestionIdx === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <button
                onClick={togglePlayPause}
                className="bg-white/90 hover:bg-white rounded-full p-5 sm:p-8 transition-all hover:scale-110 active:scale-95"
              >
                <svg
                  className="w-10 h-10 sm:w-16 sm:h-16 text-purple-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </button>
            </div>
          )}

          {/* Custom Controls Overlay */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3 sm:p-6 transition-all duration-300 ${
              showControls || !isPlaying
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Progress bar - Enhanced MultiVideoPlayer features */}
            <div className="mb-3 sm:mb-4">
              <div
                className="relative h-8 sm:h-10 flex items-center cursor-not-allowed group"
                title="Thanh tiến độ chỉ để theo dõi; video đào tạo không cho phép tua."
                aria-label="Tiến độ video, không thể tua"
              >
                {/* Progress bar background */}
                <div className="absolute left-0 right-0 h-1.5 bg-white/20 rounded-full top-1/2 transform -translate-y-1/2 group-hover:h-2 transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-yellow-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Question markers */}
                <div className="absolute left-0 right-0 h-10 flex items-center top-1/2 transform -translate-y-1/2">
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      className="absolute transform -translate-x-1/2"
                      style={{
                        left:
                          duration > 0 ? `${(q.time / duration) * 100}%` : '0%',
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full border-2 transition ${
                          answeredQuestions.has(q.id)
                            ? 'bg-green-400 border-green-500'
                            : 'bg-orange-400 border-orange-500 animate-pulse'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 min-w-0">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition shrink-0"
              >
                {isPlaying ? (
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => handleVolumeChange(volume > 0 ? 0 : 1)}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition"
                >
                  {volume === 0 ? (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) =>
                    handleVolumeChange(parseFloat(e.target.value))
                  }
                  className="hidden sm:block w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
                  }}
                />
              </div>

              {/* Speed control */}
              <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
                {[0.5, 0.75, 1].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-1.5 sm:px-2 py-1 rounded text-[11px] sm:text-xs font-semibold whitespace-nowrap transition ${
                      playbackSpeed === speed
                        ? 'bg-purple-600 text-white'
                        : 'text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0" />

              {/* Progress percentage */}
              <span className="text-white text-xs sm:text-sm font-bold shrink-0">
                {Math.round(progress)}%
              </span>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition shrink-0"
              >
                {isFullscreen ? (
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Question modal overlay */}
          {currentQuestionIdx !== null && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-8 max-w-md w-full max-h-full overflow-y-auto border border-gray-200">
                <div className="mb-6">
                  {/* Result indicator */}
                  {showResult && (
                    <div
                      className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                        isCorrectAnswer
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-red-100 border-2 border-red-500'
                      }`}
                    >
                      {isCorrectAnswer ? (
                        <>
                          <svg
                            className="w-6 h-6 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-bold text-green-700">
                            Chính xác!
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-bold text-red-700">
                            Chưa chính xác!
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    {questions[currentQuestionIdx]?.question}
                  </h3>
                  <div className="space-y-3">
                    {questions[currentQuestionIdx]?.options.map(
                      (option: string, idx: number) => {
                        const isUserAnswer = userAnswer === idx
                        const isCorrectOption =
                          questions[currentQuestionIdx].answer === idx

                        let buttonClass =
                          'w-full p-3 text-left rounded-lg border-2 transition '

                        if (!showResult) {
                          // Before answering
                          buttonClass += isUserAnswer
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-gray-200 hover:border-yellow-300'
                        } else {
                          // After answering
                          if (isCorrectOption) {
                            // Correct answer - always green
                            buttonClass += 'border-green-500 bg-green-50'
                          } else if (isUserAnswer && !isCorrectAnswer) {
                            // User's wrong answer - red
                            buttonClass += 'border-red-500 bg-red-50'
                          } else {
                            // Other options
                            buttonClass += 'border-gray-200 bg-gray-50'
                          }
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => !showResult && setUserAnswer(idx)}
                            disabled={showResult}
                            className={buttonClass}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-semibold mr-2 ${
                                    showResult && isCorrectOption
                                      ? 'text-green-600'
                                      : showResult &&
                                          isUserAnswer &&
                                          !isCorrectAnswer
                                        ? 'text-red-600'
                                        : 'text-purple-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + idx)}.
                                </span>
                                <span
                                  className={
                                    showResult && isCorrectOption
                                      ? 'text-green-700 font-semibold'
                                      : showResult &&
                                          isUserAnswer &&
                                          !isCorrectAnswer
                                        ? 'text-red-700'
                                        : 'text-gray-800'
                                  }
                                >
                                  {option}
                                </span>
                              </div>
                              {showResult && isCorrectOption && (
                                <svg
                                  className="w-6 h-6 text-green-600 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                              {showResult &&
                                isUserAnswer &&
                                !isCorrectAnswer && (
                                  <svg
                                    className="w-6 h-6 text-red-600 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                            </div>
                          </button>
                        )
                      },
                    )}
                  </div>
                </div>
                {!showResult ? (
                  <Button
                    onClick={handleAnswerQuestion}
                    disabled={userAnswer === null}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold py-2 h-auto text-base"
                  >
                    Trả lời
                  </Button>
                ) : (
                  <Button
                    onClick={handleContinue}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 h-auto text-base"
                  >
                    Tiếp tục
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completion overlay */}
          {videoCompleted && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 p-2">
              <div className="bg-white rounded-xl p-4 sm:p-8 max-w-md w-full text-center space-y-3 sm:space-y-6 animate-fade-in max-h-full overflow-y-auto">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg
                  className="w-7 h-7 sm:w-10 sm:h-10 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                    Chúc mừng bạn đã hoàn thành!
                  </h2>
                  <p className="text-gray-600">
                    Bạn đã xem hết nội dung bài học này.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 w-full">
                  <Button
                    disabled={isSavingCompletion}
                    onClick={goToAssignmentAfterCompletion}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-3 h-auto text-lg rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isSavingCompletion ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Đang lưu kết quả...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                          </svg>
                          Làm bài tập & Kiểm tra
                        </>
                      )}
                    </div>
                  </Button>

                  {/* Next Lesson button removed */}

                  <Button
                    variant="ghost"
                    onClick={() => {
                      const video = videoRef.current
                      if (video) {
                        // Bật flag replay để skip mọi anti-cheat check trong lúc seek về 0
                        isReplayingRef.current = true

                        // Reset toàn bộ state
                        isLockedRef.current = false
                        violationCountRef.current = 0
                        lastValidTimeRef.current = 0
                        wallStartRef.current = null
                        videoTimeAtWallRef.current = 0
                        playbackAllowedRef.current = true
                        isPlayingRef.current = true

                        // Seek về 0 rồi play
                        video.currentTime = 0
                        safePlay(video).then(() => {
                          isReplayingRef.current = false
                        }).catch(() => {
                          isReplayingRef.current = false
                        })
                      }
                      setVideoCompleted(false)
                      setProgress(0)
                      setIsPlaying(true)
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Xem lại video
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info bar - only in non-fullscreen */}
        {!isFullscreen && (
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-3 py-2 sm:px-4 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold">Video không cho phép tua</span>
            </div>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{questions.length} câu hỏi</span>
            </div>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                {answeredQuestions.size} {' / '} {questions.length} đã trả lời
              </span>
            </div>
            <div className="flex-1" />
            {videoCompleted && (
              <Button
                variant="ghost"
                disabled={isSavingCompletion}
                onClick={goToAssignmentAfterCompletion}
                className="bg-white/10 hover:bg-white/20 hover:text-white px-4 py-1.5 font-semibold transition flex items-center gap-2 h-auto text-white"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Làm bài tập</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Playlist — mobile only, hidden on lg+ */}
      {!isFullscreen && (
        <div className="w-full lg:hidden bg-white border-t border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">Danh sách bài học</span>
            <span className="text-[10px] text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded font-semibold font-mono">
              {allLessons.length} bài
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {isLoadingLessons && allLessons.length === 0 ? (
              <div className="animate-pulse divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex gap-3 p-3">
                    <div className="h-16 w-24 shrink-0 rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-16 rounded bg-slate-200" />
                      <div className="h-4 w-4/5 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allLessons.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Không tìm thấy bài học nào.
              </div>
            ) : (
              allLessons.map((lesson) => {
                const isActive = lesson.id.toString() === lessonId
                const isCompleted = lesson.completion_status === 'completed'
                const assignment = allAssignments.find((a) => a.video_id === lesson.id) || null

                return (
                  <PlaylistItem
                    key={lesson.id}
                    lesson={lesson}
                    lessonId={lessonId}
                    isActive={isActive}
                    isCompleted={isCompleted}
                    onClick={() => handleLessonClick(lesson)}
                    assignment={assignment}
                    router={router}
                  />
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  </div>
</div>
)
}

export default function LessonPage() {
  return (
    <Suspense
      fallback={
        <PageLayout maxWidth="4xl">
          <PageLayoutContent spacing="xl">
            <div className="h-8 bg-gray-300 rounded w-1/3 animate-pulse"></div>
            <div className="aspect-video bg-gray-300 rounded animate-pulse"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2 animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-2/3 animate-pulse"></div>
            </div>
          </PageLayoutContent>
        </PageLayout>
      }
    >
      <LessonContent />
    </Suspense>
  )
}
