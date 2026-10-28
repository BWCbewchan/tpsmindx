'use client'
import { useQueryState } from '@/lib/use-query-state'


import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PlayCircle,
  Route,
  UsersRound,
  Video,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

type CandidateProfile = { candidate_code?: string; candidate_id?: number; full_name?: string }
type Assignment = {
  id: number
  video_id?: number | null
  training_stage?: 'centralized_training' | 'pedagogy_training' | null
  assignment_title: string
  assignment_type?: string
  video_title?: string
  video_completion_status?: string
  question_count?: number
  recent_submission?: { score?: number; percentage?: number; is_passed?: boolean; submitted_at?: string }
}
type Question = { id: number; question_text: string; question_type: string; options?: string[] | string | null; points?: number }
type Submission = { id: number }

function AssignmentCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <article key={index} className="animate-pulse rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="h-3 w-32 rounded bg-slate-200" />
              <div className="h-5 w-4/5 rounded bg-slate-200" />
            </div>
            <div className="h-5 w-5 rounded-full bg-slate-200" />
          </div>
          <div className="mt-5 h-4 w-24 rounded bg-slate-100" />
          <div className="mt-4 h-10 w-full rounded-md bg-slate-200" />
        </article>
      ))}
    </>
  )
}

function CandidateTestsPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mt-4 border-b border-slate-200 pb-5">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-72 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100" />
        </div>
        <div className="mt-5 h-10 w-80 max-w-full rounded-lg bg-slate-200" />
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="mt-3 h-6 w-56 rounded bg-slate-200" />
          <div className="mt-3 h-2 rounded-full bg-slate-100" />
        </div>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <AssignmentCardsSkeleton />
        </section>
      </div>
    </main>
  )
}

function candidateCode(): { code: string; name: string } {
  try {
    const raw = window.localStorage.getItem('candidatePortalProfile')
    const profile = raw ? (JSON.parse(raw) as CandidateProfile) : null
    return {
      code: String(profile?.candidate_code || (profile?.candidate_id ? `candidate-${profile.candidate_id}` : '')).trim().toLowerCase(),
      name: String(profile?.full_name || '').trim(),
    }
  } catch {
    return { code: '', name: '' }
  }
}

function parseOptions(options: Question['options']): string[] {
  if (Array.isArray(options)) return options.map(String)
  if (typeof options !== 'string') return []
  try {
    const parsed = JSON.parse(options)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return options.split('|').map((option) => option.trim()).filter(Boolean)
  }
}

function CandidateTestsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startAssignmentId = searchParams.get('start_assignment_id')

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stageTab, setStageTab] = useQueryState<'centralized_training' | 'pedagogy_training'>('stage', 'centralized_training', { values: ["centralized_training","pedagogy_training"], history: 'push' })
  const [loading, setLoading] = useState(true)
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const { logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true)

  async function handleLogout() {
    window.localStorage.removeItem('candidatePortalProfile')
    await logout('/login?role=candidate')
  }

  const loadAssignments = useCallback(async (candidateCode: string) => {
    if (!candidateCode) return
    setLoading(true)
    try {
      const [assignmentsResponse, videosResponse] = await Promise.all([
        fetch(`/api/candidate/training-assignments?assignment_context=all&learner_code=${encodeURIComponent(candidateCode)}`),
        fetch('/api/hr/onboarding/videos'),
      ])
      const [data, videosData] = await Promise.all([
        assignmentsResponse.json(),
        videosResponse.json(),
      ])
      if (data.success) {
        const onboardingVideoIds = new Set<number>(
          Array.isArray(videosData.data)
            ? videosData.data.map((video: { id?: number }) => Number(video.id)).filter(Number.isFinite)
            : [],
        )
        setAssignments(
          (Array.isArray(data.data) ? data.data : []).filter((assignment: Assignment) =>
            assignment.video_id != null && onboardingVideoIds.has(Number(assignment.video_id)),
          ),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const candidate = candidateCode()
    setCode(candidate.code)
    setName(candidate.name)
    void loadAssignments(candidate.code)
  }, [loadAssignments])

  const startTest = useCallback(async (assignment: Assignment) => {
    setStarting(true)
    setMessage('')
    try {
      const [questionsResponse, submissionResponse] = await Promise.all([
        fetch(`/api/training-assignment-questions?assignment_id=${assignment.id}`),
        fetch('/api/candidate/training-submissions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: assignment.id, learner_code: code, learner_info: { full_name: name } }),
        }),
      ])
      const questionsData = await questionsResponse.json()
      const submissionData = await submissionResponse.json()
      if (!questionsData.success || !submissionData.success) throw new Error(submissionData.error || 'Không thể mở bài kiểm tra.')
      setQuestions(Array.isArray(questionsData.data) ? questionsData.data : [])
      setAnswers(submissionData.existing_answers || {})
      setSubmission(submissionData.data)
      setActiveAssignment(assignment)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể mở bài kiểm tra.')
    } finally {
      setStarting(false)
    }
  }, [code, name])

  // Automatically start test if start_assignment_id is in query params
  useEffect(() => {
    if (!loading && startAssignmentId && assignments.length > 0 && !activeAssignment) {
      const targetAssignment = assignments.find(a => Number(a.id) === Number(startAssignmentId))
      if (targetAssignment) {
        void startTest(targetAssignment)
      }
    }
  }, [loading, startAssignmentId, assignments, activeAssignment, startTest])

  const submitTest = async () => {
    if (!submission || !activeAssignment) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/candidate/training-submissions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submission.id, action: 'grade', answers: Object.entries(answers).map(([question_id, answer_text]) => ({ question_id: Number(question_id), answer_text })) }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Không thể nộp bài.')
      setMessage(`Đã nộp bài. Điểm của bạn: ${Number(data.data?.score || 0).toFixed(1)}/10`)
      setActiveAssignment(null)
      setSubmission(null)
      await loadAssignments(code)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể nộp bài.')
    } finally {
      setSubmitting(false)
    }
  }

  const allowedTabs = [
    { id: 'roadmap', label: 'Lộ Trình Đào Tạo', href: '/candidate-portal/roadmap', icon: Route },
    { id: 'observe', label: 'Quản Lý Dự Thính', href: '/candidate-portal', icon: FileText },
    { id: 'videos', label: 'Video Đào Tạo Đầu Vào', href: '/candidate-portal/videos', icon: Video },
    { id: 'tests', label: 'Bài Kiểm Tra Của Tôi', href: '/candidate-portal/tests', icon: ClipboardList },
    { id: 'schedule', label: 'Lịch Đào Tạo', href: '/candidate-portal/schedule', icon: CalendarDays },
    { id: 'te-leader-info', label: 'Thông Tin TE/Leader', href: '/candidate-portal/te-leader-info', icon: UsersRound },
    { id: 'k12-teaching-policy', label: 'Quy Trình Quy Định K12 Teaching', href: '/candidate-portal/k12-teaching-policy', icon: ClipboardList }
  ]

  const activeTab = 'tests'

  const shell = (content: React.ReactNode) => {
    return (
      <main className="min-h-screen overflow-x-hidden bg-muted">
        {/* Mobile Header */}
        {!isSidebarOpen && (
          <header className="fixed left-0 right-0 top-0 z-sidebar-toggle border-b border-gray-200 bg-white shadow-sm md:hidden">
            <div className="flex h-14 items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.svg"
                  alt="MindX Technology School"
                  className="h-7 w-auto"
                />
                <div className="flex flex-col justify-center leading-tight">
                  <p className="text-sm font-bold tracking-wide text-[#2c2b2b]">
                    Teaching Portal System
                  </p>
                  <p className="text-[11px] font-medium text-[#6a6a6a]">
                    Candidate Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Mở sidebar"
                className="rounded-md p-1.5 text-[#1f1f1f] transition-all duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
        )}

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-sidebar-overlay-custom bg-black/50 backdrop-blur-sm transition-all duration-300 ease-in-out animate-in fade-in-0 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Desktop Toggle Menu Button */}
        {!isDesktopSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsDesktopSidebarOpen(true)}
            aria-label="Mở sidebar"
            className="fixed left-3 top-3 z-sidebar-toggle hidden rounded-lg border border-gray-200 bg-white p-2 shadow-md transition-all duration-300 hover:scale-105 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 md:block"
          >
            <Menu className="h-4 w-4 transition-transform duration-300" />
          </button>
        )}

        {/* Sidebar Aside */}
        <aside
          className={`fixed inset-y-0 left-0 z-sidebar-custom h-dvh max-h-dvh w-56 overflow-hidden border-r border-gray-200 bg-white/95 shadow-xl backdrop-blur-xl transition-all duration-500 ease-in-out will-change-transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isDesktopSidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'}`}
          aria-hidden={!isSidebarOpen && !isDesktopSidebarOpen}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="relative flex h-14 items-center justify-between bg-[#a1001f] px-4 py-2 text-white shadow-md">
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  router.push('/candidate-portal');
                }}
                className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
              >
                <div className="rounded-lg bg-white/20 p-1.5 backdrop-blur-sm">
                  <img src="/x_white.svg" alt="MindX" className="h-4 w-4" />
                </div>
                <div className="flex flex-col justify-center leading-tight">
                  <h2 className="text-sm font-bold tracking-wide">TPS</h2>
                  <p className="text-[11px] text-white/80">Candidate Portal</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Đóng sidebar"
                className="rounded-lg p-1.5 transition-all duration-300 hover:rotate-90 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#a1001f] md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen(false)}
                aria-label="Thu gọn sidebar"
                className="hidden rounded-lg p-1.5 transition-all duration-300 hover:rotate-90 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#a1001f] md:inline-flex"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 pb-4 custom-scrollbar" aria-label="Candidate portal">
              {allowedTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      router.push(tab.href);
                    }}
                    className={`group/item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 ${
                      isActive
                        ? 'scale-[1.01] bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20'
                        : 'text-gray-700 hover:scale-[1.01] hover:bg-gray-100 hover:shadow-sm'
                    }`}
                  >
                    <span className={`rounded-md p-1.5 transition-all duration-300 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 group-hover/item:bg-white group-hover/item:shadow-sm'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="mb-2 rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-xs font-bold text-white shadow-md">
                    {name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-xs font-bold leading-snug text-gray-900">
                      {name}
                    </p>
                    <p className="text-xs leading-snug text-gray-500">
                      {code}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center rounded-full bg-[#a1001f] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                  Ứng viên
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          </div>
        </aside>

        {/* Content Container */}
        <div
          className={`mx-auto px-4 pb-6 pt-20 transition-all duration-500 sm:px-6 md:px-8 md:pt-6 ${
            isDesktopSidebarOpen
              ? 'md:ml-56 md:w-[calc(100%_-_14rem)] md:max-w-none'
              : 'md:ml-0 md:w-full md:max-w-none'
          }`}
        >
          {content}
        </div>
      </main>
    );
  }

  if (activeAssignment) return shell(
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" onClick={() => setActiveAssignment(null)}>Quay lại</Button>
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase text-[#a1001f]">Bài kiểm tra sau video</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{activeAssignment.assignment_title}</h1>
          <div className="mt-7 space-y-7">
            {questions.map((question, index) => {
              const options = parseOptions(question.options)
              return <fieldset key={question.id} className="border-b border-slate-100 pb-6 last:border-0">
                <legend className="font-semibold text-slate-900">{index + 1}. {question.question_text}</legend>
                <div className="mt-3 space-y-2">
                  {options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-[#a1001f]">
                    <input type="radio" name={`question-${question.id}`} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />
                    <span>{option}</span>
                  </label>)}
                  {options.length === 0 && <textarea value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Nhập câu trả lời..." />}
                </div>
              </fieldset>
            })}
          </div>
          <Button className="mt-8 w-full bg-[#a1001f] hover:bg-[#820019]" disabled={submitting || questions.length === 0} onClick={submitTest}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang nộp bài...</> : 'Nộp bài'}</Button>
        </section>
      </div>
    </main>
  )

  const stageAssignments = assignments.filter((item) => (item.training_stage || 'centralized_training') === stageTab)
  const available = stageAssignments.filter((item) => ['watched', 'completed'].includes(String(item.video_completion_status)))
  const linkedVideoCount = new Set(stageAssignments.map((item) => item.video_id).filter((id): id is number => typeof id === 'number')).size
  const videoProgress = linkedVideoCount > 0 ? Math.round((available.length / linkedVideoCount) * 100) : 0
  return shell(<main className="min-h-screen px-4 py-6 sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="mt-4 border-b border-slate-200 pb-5"><p className="text-sm font-bold uppercase text-[#a1001f]">Candidate Portal</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Bài Kiểm Tra Của Tôi</h1><p className="mt-2 text-slate-600">Các bài kiểm tra sẽ mở sau khi bạn hoàn thành video được liên kết.</p></header>
    <div className="mt-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {[{ id: 'centralized_training', label: 'Đào Tạo Tập Trung' }, { id: 'pedagogy_training', label: 'Tập Huấn Sư Phạm' }].map((stage) => <button key={stage.id} type="button" onClick={() => setStageTab(stage.id as typeof stageTab)} className={`rounded-md px-4 py-2 text-sm font-bold transition ${stageTab === stage.id ? 'bg-[#a1001f] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{stage.label}</button>)}
    </div>
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-slate-500">Tiến độ video có bài kiểm tra</p><p className="mt-1 text-xl font-bold text-slate-950">{available.length} / {linkedVideoCount || 0} video đã hoàn thành</p></div><span className="text-sm font-bold text-[#a1001f]">{videoProgress}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#a1001f] transition-all" style={{ width: `${videoProgress}%` }} /></div>
    </section>
    {message && <p className="mt-5 rounded-md border border-[#a1001f]/20 bg-[#a1001f]/5 p-3 text-sm font-medium text-[#820019]">{message}</p>}
    <section className="mt-6 grid gap-4 md:grid-cols-2">{loading ? <AssignmentCardsSkeleton /> : available.length === 0 ? <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center"><ClipboardList className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 font-semibold text-slate-800">Chưa có bài kiểm tra được mở</p><p className="mt-1 text-sm text-slate-500">Hoàn thành video liên kết để mở bài kiểm tra.</p></div> : available.map((assignment) => <article key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">{assignment.video_title || 'Video đào tạo đầu vào'}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{assignment.assignment_title}</h2></div><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><p className="mt-3 text-sm text-slate-600">{assignment.question_count || 0} câu hỏi</p>{assignment.recent_submission ? <><p className="mt-4 text-sm font-semibold text-emerald-700">Đã nộp: {Number(assignment.recent_submission.score || 0).toFixed(1)}/10</p><Button variant="outline" className="mt-3 w-full border-[#a1001f]/30 text-[#a1001f] hover:bg-[#a1001f]/5" disabled={starting} onClick={() => startTest(assignment)}><PlayCircle className="h-4 w-4" /> Làm lại để cải thiện điểm</Button></> : <Button className="mt-4 w-full bg-[#a1001f] hover:bg-[#820019]" disabled={starting} onClick={() => startTest(assignment)}><PlayCircle className="h-4 w-4" /> Làm bài kiểm tra</Button>}</article>)}</section>
  </div></main>)
}

export default function CandidateTestsPage() {
  return (
    <Suspense fallback={<CandidateTestsPageSkeleton />}>
      <CandidateTestsContent />
    </Suspense>
  )
}
