'use client'

import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { setVideo } from '@/lib/redux/features/trainingSlice'
import { useAppDispatch } from '@/lib/redux/hooks'
import { useTeacher } from '@/lib/teacher-context'
import { BookOpen, Clock, FileText } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import AssignmentsPage from '../assignments/page'
interface TrainingLesson {
  id: number
  name: string
  score: number
  link?: string
  segments?: Array<{
    id: number
    url: string
    duration_minutes: number
    duration_seconds?: number | null
  }>
  thumbnail_url?: string
  description?: string
  duration_minutes?: number
  duration_seconds?: number | null
  lesson_number?: number
  completion_status?: string
  completed_at?: string
  time_spent_seconds?: number
}

interface TrainingSubmission {
  score?: number | string | null
  total_points?: number | string | null
  percentage?: number | string | null
  is_passed?: boolean | null
  submitted_at?: string | null
}

interface TrainingAssignment {
  id: number
  assignment_title: string
  description?: string
  video_id: number
  assignment_type?: string
  passing_score?: number
  max_attempts?: number
  time_limit_minutes?: number
  question_count?: number
  recent_submission?: TrainingSubmission | null
  video_completion_status?: string | null
}

interface TrainingData {
  no: string
  fullName: string
  code: string
  userName: string
  workEmail: string
  phoneNumber: string
  status: string
  centers: string
  khoiFinal: string
  position: string
  averageScore?: number
  lessons: TrainingLesson[]
}

interface Teacher {
  code: string
  name: string
  emailMindx: string
  emailPersonal: string
}

interface TeacherLookupResponse {
  teacher?: Teacher | null
}

interface TrainingAssignmentsResponse {
  data?: TrainingAssignment[]
}

interface FetchError extends Error {
  info: unknown
  status?: number
}

type UserAccessLike = {
  role?: string
  isAdmin?: boolean
}

function extractCodeFromEmail(email: string): string {
  const match = email.match(/^([^@]+)@/)
  return match ? match[1] : ''
}

export default function TrainingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const startAssignmentId = searchParams.get('start_assignment_id')
  const { mutate } = useSWRConfig()

  const [tab, setTab] = useState<'lessons' | 'stats' | 'tests'>('lessons')
  const [submitCode, setSubmitCode] = useState('')
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [isResolvingCode, setIsResolvingCode] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const prewarmedLessonIdsRef = useRef<Set<number>>(new Set())
  const prewarmedGroupIdsRef = useRef<Set<string>>(new Set())
  const prewarmInFlightRef = useRef<Map<string, Promise<void>>>(new Map())
  const prewarmLastAtRef = useRef<Map<string, number>>(new Map())
  const prewarmTimerByLessonRef = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const {
    teacherProfile,
    isLoading: isTeacherLoading,
    refreshProfile,
  } = useTeacher() as {
    teacherProfile: Teacher | null | undefined
    isLoading: boolean
    refreshProfile: () => Promise<void>
  }

  // ── Guard: block non-admin users if teacher profile is missing ──
  const [missingProfile, setMissingProfile] = useState(false)

  const refetchTrainingData = useCallback(() => {
    if (!submitCode) return

    mutate(`/api/training-db?code=${submitCode}`)
    if (teacherProfile?.code) {
      mutate(`/api/training-assignments?status=published&teacher_code=${teacherProfile.code}`)
    }
  }, [mutate, submitCode, teacherProfile?.code])

  // Khi startAssignmentId biến mất (user quay về từ bài kiểm tra) → refetch ngay
  const prevStartAssignmentIdRef = useRef(startAssignmentId)
  useEffect(() => {
    const prev = prevStartAssignmentIdRef.current
    prevStartAssignmentIdRef.current = startAssignmentId
    // Chỉ refetch khi chuyển từ có startAssignmentId → không có (tức là vừa quay về)
    if (prev && !startAssignmentId) {
      refetchTrainingData()
    }
  }, [startAssignmentId, refetchTrainingData])

  useEffect(() => {
    if (!user) return

    // Skip check while loading
    if (isTeacherLoading) return

    const authUser = user as UserAccessLike
    const isAdmin = authUser.role === 'admin' || authUser.isAdmin === true
    if (isAdmin) return

    if (!teacherProfile) {
      setMissingProfile(true)
    } else {
      setMissingProfile(false)
    }
  }, [user, isTeacherLoading, teacherProfile])

  const handleRetryProfile = async () => {
    setMissingProfile(false)
    await refreshProfile()
  }

  const secureFetcher = useCallback(async (url: string) => {
    const token = localStorage.getItem('token')

    const doFetch = async (tok: string | null) => {
      const headers: HeadersInit = {}
      if (tok) headers['Authorization'] = `Bearer ${tok}`

      const res = await fetch(url, { headers })
      return res
    }

    const response = await doFetch(token)

    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = new Error('An error occurred while fetching the data.') as FetchError
      try {
        error.info = await response.json()
      } catch {
        error.info = null
      }
      error.status = response.status
      throw error
    }

    return response.json()
  }, [])

  // Mã LMS: ưu tiên TeacherProvider — chỉ gọi /api/teachers/info khi context không có sau khi load xong
  useEffect(() => {
    if (!user?.email || submitCode) return
    if (isTeacherLoading) return

    if (teacherProfile?.code) {
      setSubmitCode(teacherProfile.code.toLowerCase().trim())
      setIsResolvingCode(false)
      return
    }

    if (hasAutoSearched) return
    setHasAutoSearched(true)
    setIsResolvingCode(true)

    ;(async () => {
      try {
        const res = (await secureFetcher(
          `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
        )) as TeacherLookupResponse
        if (res?.teacher?.code) {
          setSubmitCode(res.teacher.code.toLowerCase().trim())
          setIsResolvingCode(false)
          return
        }
      } catch {
        console.warn(
          'Email-based lookup failed, falling back to code extraction',
        )
      }

      const code = extractCodeFromEmail(user.email)
      if (code) {
        setSubmitCode(code.toLowerCase().trim())
      }

      setIsResolvingCode(false)
    })()
  }, [
    user,
    submitCode,
    isTeacherLoading,
    teacherProfile,
    hasAutoSearched,
    secureFetcher,
  ])

  const { data: teacherData, isLoading: isLoadingTeacher } = useSWR<TeacherLookupResponse>(
    submitCode && user ? `/api/teachers/info?code=${submitCode}` : null,
    secureFetcher,
    {      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000,
      shouldRetryOnError: false,
    },
  )

  const teacher = teacherData?.teacher || null

  // Refetch khi pathname thay đổi (user navigate về /user/dao-tao-nang-cao từ lesson page)
  useEffect(() => {
    refetchTrainingData()
  }, [pathname, refetchTrainingData])

  // Refetch khi tab được focus lại (switch tab, alt-tab, v.v.)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      refetchTrainingData()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetchTrainingData])

  const { data: trainingData, isLoading: isLoadingTraining } = useSWR<TrainingData>(
    teacher && user ? `/api/training-db?code=${submitCode}` : null,
    secureFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
      shouldRetryOnError: false,
    },
  )
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useSWR<TrainingAssignmentsResponse>(
    teacher && user
      ? `/api/training-assignments?status=published&teacher_code=${teacher.code}`
      : null,
    secureFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 30000,
    },
  )
  const completedLessons = useMemo(() => {
    if (!trainingData?.lessons) return 0
    return trainingData.lessons.filter(
      (l: TrainingLesson) => l.completion_status === 'completed',
    ).length
  }, [trainingData])

  // Set isMounted to true after all initial data is loaded
  useEffect(() => {
    if (
      !isLoadingTraining &&
      !isLoadingAssignments &&
      !isTeacherLoading &&
      !isResolvingCode &&
      submitCode &&
      (teacher || isLoadingTeacher === false)
    ) {
      setIsMounted(true)
    }
  }, [
    isLoadingTraining,
    isLoadingAssignments,
    isTeacherLoading,
    isResolvingCode,
    submitCode,
    teacher,
  ])

  const prewarmLessonManifest = useCallback(async (lessonId: number) => {
    if (!lessonId || prewarmedLessonIdsRef.current.has(lessonId)) return

    try {
      const videoRes = await fetch(`/api/training-videos?id=${lessonId}`)
      const videoData = await videoRes.json()

      if (
        !videoRes.ok ||
        !videoData?.success ||
        !Array.isArray(videoData.data) ||
        videoData.data.length === 0
      ) {
        return
      }

      const groupId = videoData.data[0]?.video_group_id
      if (!groupId) {
        prewarmedLessonIdsRef.current.add(lessonId)
        return
      }

      if (prewarmedGroupIdsRef.current.has(groupId)) {
        prewarmedLessonIdsRef.current.add(lessonId)
        return
      }

      const now = Date.now()
      const lastAt = prewarmLastAtRef.current.get(groupId) || 0
      if (now - lastAt < 1200) {
        return
      }
      prewarmLastAtRef.current.set(groupId, now)

      const existing = prewarmInFlightRef.current.get(groupId)
      if (existing) {
        await existing
        prewarmedLessonIdsRef.current.add(lessonId)
        return
      }

      const task = (async () => {
        await fetch(`/api/video/${encodeURIComponent(groupId)}`)
        prewarmedGroupIdsRef.current.add(groupId)
      })().finally(() => {
        prewarmInFlightRef.current.delete(groupId)
      })

      prewarmInFlightRef.current.set(groupId, task)
      await task
      prewarmedLessonIdsRef.current.add(lessonId)
    } catch {
      // Best-effort only. Playback flow will still work without prewarm.
    }
  }, [])

  const schedulePrewarmLessonManifest = useCallback(
    (lessonId: number) => {
      const activeTimer = prewarmTimerByLessonRef.current.get(lessonId)
      if (activeTimer) {
        clearTimeout(activeTimer)
      }

      const timer = setTimeout(() => {
        prewarmLessonManifest(lessonId)
        prewarmTimerByLessonRef.current.delete(lessonId)
      }, 180)

      prewarmTimerByLessonRef.current.set(lessonId, timer)
    },
    [prewarmLessonManifest],
  )

  useEffect(() => {
    const timers = prewarmTimerByLessonRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const handleLessonClick = (lesson: TrainingLesson, index: number) => {
    if (lesson.link) {
      console.log('[Training] Opening lesson:', {
        id: lesson.id,
        name: lesson.name,
        index: index + 1,
      })
      const activeTimer = prewarmTimerByLessonRef.current.get(lesson.id)
      if (activeTimer) {
        clearTimeout(activeTimer)
        prewarmTimerByLessonRef.current.delete(lesson.id)
      }
      prewarmLessonManifest(lesson.id)
      dispatch(
        setVideo({
          id: lesson.id,
          link: lesson.link,
          duration: lesson.duration_minutes || 0,
          title: lesson.name,
          segments: lesson.segments,
        }),
      )
      router.push(`/user/dao-tao-nang-cao/lesson?id=${lesson.id}`)
    }
  }

  if (startAssignmentId) {
    return <AssignmentsPage />
  }

  // Show skeleton while loading - check ALL conditions
  if (
    isLoadingTraining || 
    isLoadingAssignments || 
    isTeacherLoading || 
    isResolvingCode ||
    !submitCode ||  // Still resolving code
    (submitCode && !teacher && !isLoadingTeacher) ||  // Waiting for teacher data
    !isMounted  // Prevent content flash on initial render
  ) {
    return <PageSkeleton variant="grid" itemCount={12} showHeader={true} />
  }

  // localStorage guard modal
  if (missingProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            Chưa đồng bộ được thông tin
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Không tải được thông tin giáo viên. Vui lòng tải lại dữ liệu rồi
            thử lại.
          </p>
          <button
            onClick={handleRetryProfile}
            className="w-full bg-[#a1001f] text-white font-semibold py-2.5 rounded-xl hover:bg-[#80001a] transition-colors"
          >
            Tải lại dữ liệu
          </button>
        </div>
      </div>
    )
  }

  return (
    <PageContainer
      title="Đào Tạo Nâng Cao"
      description={`Điểm học trực tuyến - ${trainingData?.lessons?.length || 0} bài học`}
    >
      <div className="mb-6 flex gap-6 border-b border-[#e7c6cb]">
        <button
          className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
            tab === 'lessons'
              ? 'border-[#a1001f] text-[#a1001f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('lessons')}
        >
          Bài học nâng cao
        </button>
        <button
          className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
            tab === 'stats'
              ? 'border-[#a1001f] text-[#a1001f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('stats')}
        >
          Thống kê điểm số
        </button>
        <button
          className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
            tab === 'tests'
              ? 'border-[#a1001f] text-[#a1001f]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('tests')}
        >
          Bài kiểm tra
        </button>
      </div>

      {trainingData ? (
        <>
          {/* Tab: Bài học nâng cao */}
          {tab === 'lessons' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-[#a1001f]">
                  Danh sách bài học
                </h2>

                {/* Progress Bar */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col sm:items-end">
                    <div className="text-sm text-gray-600 mb-1">
                      Tiến độ:{' '}
                      <span className="font-bold text-[#a1001f]">
                        {completedLessons}/{trainingData.lessons.length}
                      </span>
                    </div>
                    <div className="h-3 w-full max-w-48 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-[#a1001f] to-[#c41230] transition-all duration-500 ease-out"
                        style={{
                          width: `${trainingData.lessons.length > 0 ? (completedLessons / trainingData.lessons.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {trainingData.lessons.length > 0
                        ? Math.round(
                            (completedLessons / trainingData.lessons.length) *
                              100,
                          )
                        : 0}
                      % hoàn thành
                    </div>
                  </div>
                </div>
              </div>
              {trainingData.lessons.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Chưa có video nào được giao
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {trainingData.lessons.map(
                    (lesson: TrainingLesson, idx: number) => {
                      const isCompleted =
                        lesson.completion_status === 'completed'
                      const isWatched =
                        lesson.completion_status === 'watched'
                      const canTakeQuiz = isCompleted || isWatched
                      const notStarted = lesson.score === 0
                      const passed = lesson.score >= 7
                      const lessonNumber = lesson.lesson_number || idx + 1

                      return (
                        <div
                          key={lesson.id || idx}
                          className={`flex flex-col gap-3 p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer sm:flex-row sm:items-start sm:gap-4 ${
                            isCompleted
                              ? 'border-green-300 bg-green-50/30'
                              : isWatched
                                ? 'border-blue-300 bg-blue-50/30'
                                : 'border-gray-200'
                          }`}
                          onMouseEnter={() =>
                            schedulePrewarmLessonManifest(lesson.id)
                          }
                          onFocus={() =>
                            schedulePrewarmLessonManifest(lesson.id)
                          }
                          onClick={() => handleLessonClick(lesson, idx)}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-full shrink-0 sm:w-40">
                            <div className="w-full h-40 bg-gray-200 rounded-lg overflow-hidden sm:w-40 sm:h-24">
                              {lesson.thumbnail_url ? (
                                <>
                                  { }
                                  <img
                                    src={lesson.thumbnail_url}
                                    alt={lesson.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src =
                                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzljYTNhZiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0Ij5WaWRlbzwvdGV4dD48L3N2Zz4='
                                    }}
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-rose-100 to-red-100">
                                  <svg
                                    className="w-12 h-12 text-[#a1001f]/60"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Duration badge — prefer duration_seconds for accuracy */}
                            {(() => {
                              // Sum duration_seconds across all segments if available
                              const totalSeconds = lesson.segments
                                ? lesson.segments.reduce(
                                    (sum, s) =>
                                      sum +
                                      (s.duration_seconds != null
                                        ? Number(s.duration_seconds)
                                        : (s.duration_minutes || 0) * 60),
                                    0,
                                  )
                                : 0
                              const displaySeconds =
                                totalSeconds > 0
                                  ? totalSeconds
                                  : lesson.duration_minutes &&
                                      lesson.duration_minutes !== 30
                                    ? lesson.duration_minutes * 60
                                    : 0
                              if (!displaySeconds) return null
                              const mins = Math.floor(displaySeconds / 60)
                              const secs = Math.round(displaySeconds % 60)
                              const label =
                                mins > 0
                                  ? secs > 0
                                    ? `${mins}p ${secs}s`
                                    : `${mins} phút`
                                  : `${secs}s`
                              return (
                                <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                                  {label}
                                </div>
                              )
                            })()}
                            {/* Completion badge */}
                            {isCompleted && (
                              <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Video Info */}
                          <div className="w-full min-w-0">
                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 grow">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                                  {lesson.name}
                                </h3>
                                {lessonNumber && (
                                  <span className="inline-block bg-rose-100 text-[#a1001f] text-xs font-medium px-2 py-1 rounded">
                                    LESSON{' '}
                                    {lessonNumber.toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`self-start px-3 py-1 rounded-full text-xs font-medium sm:self-auto sm:whitespace-nowrap ${
                                  isCompleted
                                    ? 'bg-green-100 text-green-800'
                                    : isWatched
                                      ? 'bg-blue-100 text-blue-800'
                                      : notStarted
                                        ? 'bg-gray-100 text-gray-800'
                                        : passed
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {isCompleted
                                  ? '✓ Hoàn thành'
                                  : isWatched
                                    ? '👁️ Đã xem'
                                    : notStarted
                                      ? 'Chưa học'
                                      : passed
                                        ? '✓ Đã đạt'
                                        : 'Điểm: ' + lesson.score.toFixed(1)}
                              </span>
                            </div>

                            {/* Progress info if not completed but started */}
                            {!isCompleted &&
                              (lesson.time_spent_seconds ?? 0) > 0 && (
                                <div className="mb-2">
                                  <div className="flex justify-between text-xs text-[#a1001f] mb-1">
                                    <span>Đang học</span>
                                    <span>
                                      {Math.min(100, Math.round(
                                        ((lesson.time_spent_seconds || 0) /
                                          ((lesson.duration_minutes || 1) *
                                            60)) *
                                          100,
                                      ))}
                                      %
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-[#c41230] h-1.5 rounded-full"
                                      style={{
                                        width: `${Math.min(100, Math.round(((lesson.time_spent_seconds || 0) / ((lesson.duration_minutes || 1) * 60)) * 100))}%`,
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              )}

                            {lesson.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {lesson.description}
                              </p>
                            )}

                            {/* Quiz Button */}
                            {(() => {
                              const assignmentList = assignmentsData?.data || []
                              const assignment = assignmentList.find(
                                (a) => a.video_id === lesson.id,
                              )

                              if (!assignment) return null

                              return (
                                <div className="mt-2 mb-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (canTakeQuiz) {
                                        router.push(
                                          `/user/dao-tao-nang-cao?start_assignment_id=${assignment.id}`,
                                        )
                                      } else {
                                        import('@/lib/app-toast').then(({ toast }) => {
                                          toast.error(`Bạn cần hoàn thành xem video bài học trước khi làm bài tập này.`, {
                                            icon: '📺'
                                          });
                                        });
                                      }
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                      canTakeQuiz
                                        ? 'bg-[#a1001f] text-white hover:bg-[#8a001a] shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                                        : 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed opacity-80'
                                    }`}
                                  >
                                    <svg
                                      className="w-4 h-4"
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
                                    Làm bài kiểm tra
                                    {!canTakeQuiz && (
                                      <span className="text-[10px] ml-1 text-gray-500 font-normal">
                                        (Cần xem hết video)
                                      </span>
                                    )}
                                  </button>
                                </div>
                              )
                            })()}

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {lesson.completed_at && (
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  Hoàn thành:{' '}
                                  {new Date(
                                    lesson.completed_at,
                                  ).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Video #{idx + 1}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Thống kê điểm số */}
          {tab === 'stats' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-[#a1001f]">
                Thống kê điểm số các bài học
              </h2>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-gray-200">
                      <TableHead className="uppercase font-bold text-gray-700">
                        Lesson
                      </TableHead>
                      <TableHead className="uppercase font-bold text-gray-700">
                        Tên bài học
                      </TableHead>
                      <TableHead className="text-center uppercase font-bold text-gray-700">
                        Điểm số
                      </TableHead>
                      <TableHead className="text-center uppercase font-bold text-gray-700">
                        Trạng thái
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainingData.lessons.map(
                      (lesson: TrainingLesson, idx: number) => {
                        const notStarted = lesson.score === 0
                        const passed = lesson.score >= 7

                        return (
                          <TableRow
                            key={idx}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <TableCell className="font-medium text-[#a1001f]">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-gray-900">
                              {lesson.name.replace(/^Lesson \d+:\s*/, '')}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`text-lg font-bold ${
                                  notStarted
                                    ? 'text-gray-400'
                                    : passed
                                      ? 'text-green-600'
                                      : 'text-yellow-600'
                                }`}
                              >
                                {notStarted ? '—' : lesson.score.toFixed(1)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  notStarted
                                    ? 'bg-gray-100 text-gray-700'
                                    : passed
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {notStarted
                                  ? 'Chưa học'
                                  : passed
                                    ? 'Đạt'
                                    : 'Cần cải thiện'}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      },
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Stats Summary */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                  <div className="text-sm text-gray-600 mb-1">
                    Điểm trung bình
                  </div>
                  <div className="text-2xl font-bold text-[#a1001f]">
                    {trainingData.averageScore?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm text-gray-600 mb-1">
                    Bài học hoàn thành
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {completedLessons}/{trainingData.lessons.length}
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="text-sm text-gray-600 mb-1">
                    Tỷ lệ hoàn thành
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {trainingData.lessons.length > 0
                      ? (
                          (completedLessons / trainingData.lessons.length) *
                          100
                        ).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Bài kiểm tra */}
          {tab === 'tests' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-[#a1001f]">
                Bài kiểm tra & Bài tập
              </h2>
              {(() => {
                const filteredAssignments = (
                  assignmentsData?.data || []
                ).filter((a) => {
                  if (!a.video_id) return false
                  return !!trainingData?.lessons?.find(
                    (l) => l.id === a.video_id,
                  )
                })

                  if (filteredAssignments.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        Không có bài kiểm tra nào được tìm thấy
                      </div>
                    )
                  }

                  return (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredAssignments.map((assignment) => {
                        const linkedVideo = trainingData?.lessons?.find(
                          (l) => l.id === assignment.video_id,
                        )
                        const isLocked =
                          assignment.video_completion_status !== 'completed'
                        const submission = assignment.recent_submission

                        // Điểm bài kiểm tra: ưu tiên recent_submission.score, fallback về 0
                        const submissionScore =
                          submission?.score != null
                            ? Number(submission.score)
                            : null
                        const submissionTotal =
                          submission?.total_points != null
                            ? Number(submission.total_points)
                            : null
                        const isPassed = submission?.is_passed === true
                        const hasSubmission = submission != null

                        // Số câu hỏi từ API (đã được count từ DB)
                        const questionCount = assignment.question_count || 0

                        // Loại bài kiểm tra
                        const assignmentType =
                          assignment.assignment_type === 'quiz'
                            ? 'Trắc nghiệm'
                            : assignment.assignment_type || 'Quiz'

                        return (
                          <div
                            key={assignment.id}
                            className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-all overflow-hidden group flex flex-col ${
                              isLocked
                                ? 'border-gray-200 opacity-75'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Header */}
                            <div
                              className={`p-3 text-white ${isLocked ? 'bg-gray-400' : 'bg-linear-to-br from-[#a1001f] to-[#c41230]'}`}
                            >
                              <div className="flex items-start justify-between mb-1.5">
                                <BookOpen className="w-5 h-5 shrink-0" />
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isLocked
                                      ? 'bg-black/20'
                                      : hasSubmission
                                        ? isPassed
                                          ? 'bg-green-400/80'
                                          : 'bg-amber-400/80'
                                        : 'bg-white/20'
                                  }`}
                                >
                                  {isLocked
                                    ? 'Locked'
                                    : hasSubmission
                                      ? isPassed
                                        ? '✓ Đạt'
                                        : 'Chưa đạt'
                                      : 'Mở'}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold mb-1 line-clamp-2 leading-tight min-h-[2.5em]">
                                {assignment.assignment_title}
                              </h3>
                              <p className="text-[11px] text-rose-50 line-clamp-1 opacity-90">
                                {linkedVideo?.name
                                  ? linkedVideo.name.replace(
                                      /^Lesson \d+:\s*/,
                                      '',
                                    )
                                  : 'Unknown Video'}
                              </p>
                            </div>

                            {/* Body */}
                            <div className="p-3 flex flex-col flex-1">
                              {/* Thông tin bài kiểm tra */}
                              <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <FileText
                                    className="w-3 h-3 text-gray-500"
                                    aria-hidden="true"
                                  />
                                  <span className="font-bold text-gray-900">
                                    {questionCount > 0 ? questionCount : '—'}
                                  </span>
                                  <span className="text-gray-600">câu</span>
                                </div>

                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <BookOpen
                                    className="w-3 h-3 text-gray-500"
                                    aria-hidden="true"
                                  />
                                  <span className="font-bold text-gray-900 text-[10px]">
                                    {assignmentType}
                                  </span>
                                </div>

                                {hasSubmission && submission.submitted_at && (
                                  <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                    <Clock
                                      className="w-3 h-3 text-gray-500"
                                      aria-hidden="true"
                                    />
                                    <span className="font-bold text-gray-900">
                                      {new Date(
                                        submission.submitted_at,
                                      ).toLocaleDateString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-auto">
                                {/* Kết quả nộp bài */}
                                {hasSubmission && submissionScore !== null ? (
                                  <div
                                    className={`mb-2.5 p-2 rounded-lg border flex justify-between items-center ${
                                      isPassed
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-amber-50 border-amber-200'
                                    }`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-semibold text-gray-700">
                                        Điểm số:
                                      </span>
                                      {submission.percentage != null && (
                                        <span className="text-[10px] text-gray-500">
                                          {Number(
                                            submission.percentage,
                                          ).toFixed(0)}
                                          %
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`text-sm font-bold ${isPassed ? 'text-green-600' : 'text-amber-600'}`}
                                    >
                                      {submissionScore.toFixed(1)}
                                      {submissionTotal != null && (
                                        <span className="text-xs text-gray-500">
                                          /{submissionTotal.toFixed(0)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ) : !isLocked && !hasSubmission ? (
                                  <div className="mb-2.5 p-2 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                                    <span className="text-[10px] text-gray-400">
                                      Chưa làm bài
                                    </span>
                                  </div>
                                ) : null}

                                <Button
                                  onClick={() =>
                                    router.push(
                                      `/user/dao-tao-nang-cao?start_assignment_id=${assignment.id}`,
                                    )
                                  }
                                  disabled={isLocked}
                                  variant={isLocked ? 'secondary' : 'default'}
                                  className={`w-full h-9 text-xs font-semibold ${
                                    !isLocked
                                      ? 'bg-[#a1001f] hover:bg-[#8a001a] text-white shadow-sm'
                                      : ''
                                  }`}
                                >
                                  {isLocked
                                    ? 'Hoàn thành video để mở'
                                    : hasSubmission
                                      ? 'Làm lại'
                                      : 'Làm bài'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              }
            </div>
          )}
        </>
      ) : null}

      {/* No Data State */}
      {!isLoadingTeacher && !isLoadingTraining && !trainingData && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Chưa có dữ liệu đào tạo
          </h3>
          <p className="text-sm text-gray-600">
            Vui lòng liên hệ quản lý để được cấp quyền truy cập
          </p>
        </div>
      )}
    </PageContainer>
  )
}
