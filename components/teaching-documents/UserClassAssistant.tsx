'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal, ModalBody, ModalClose, ModalHeader, ModalTitle } from '@/components/ui/modal'
import { Bot, ChevronDown, ExternalLink, Image, Loader2, MessageCircle, Search, Sparkles, Users, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type StudentInfo = {
  id: string
  fullName?: string
}

type StudentAttendance = {
  status?: string
  comment?: string
  sendCommentStatus?: string
  commentByAreas?: Array<{
    content?: string
    grade?: number | null
    type?: string
    courseProcessFinalEvaluationTitle?: string | null
  }>
  student?: {
    id: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
}

export type UserClassSlot = {
  id: string
  classId: string
  className: string
  students: StudentInfo[]
  courseName: string
  courseLineName: string
  centreName: string
  date: string
  startTime: string
  endTime: string
  status: string
  sessionHour: number | null
  summary?: string
  homework?: string
  teacherNames?: string[]
  studentAttendance?: StudentAttendance[]
  classSlots?: UserClassSlot[]
}

type AiSupportResponse = {
  success: boolean
  error?: string
  aiGenerated?: boolean
  followUp?: {
    answer: string
    imageQueries: string[]
    videoQueries: string[]
    referenceLinks: Array<{
      title: string
      url: string
      reason: string
    }>
  }
  analysis?: {
    overview: string
    classSignals: string[]
    pacingSuggestions: string[]
    contentAdjustments: string[]
    activityIdeas: string[]
    presentationTips: string[]
    curriculumFit: string[]
    generalStudentNotes: string[]
    studentNotes: Array<{
      studentName: string
      status?: string
      insight: string
      supportActions: string[]
      teacherApproach: string
    }>
    supportSkills: {
      searchQueries: string[]
      imagePrompts: string[]
      referenceLinks: Array<{
        title: string
        url: string
        reason: string
      }>
    }
  }
}

const STORAGE_KEY = 'user-teaching-document-selected-class'
const GEMINI_API_KEY_STORAGE_KEY = 'mindx-gemini-api-key'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fmtTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function classLabel(slot: UserClassSlot) {
  const studentCount = slot.students?.length || 0
  return `${slot.className} - ${slot.courseName || slot.courseLineName || 'Chưa rõ môn'} - ${studentCount} HV`
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {
      success: false,
      error: text.startsWith('Internal Server Error')
        ? 'Máy chủ đang lỗi nội bộ. Vui lòng thử lại sau.'
        : text,
    }
  }
}

export function UserClassAssistant({ documentId }: { documentId?: number | null }) {
  const [classes, setClasses] = useState<UserClassSlot[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [classMessage, setClassMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)
  const [analysis, setAnalysis] = useState<AiSupportResponse['analysis'] | null>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [followUp, setFollowUp] = useState<AiSupportResponse['followUp'] | null>(null)
  const [questionMessage, setQuestionMessage] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setSelectedClassId(saved)
      const savedApiKey = window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)
      if (savedApiKey) {
        setGeminiApiKey(savedApiKey)
        setApiKeyDraft(savedApiKey)
      }
    } catch {}
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadClasses() {
      setLoadingClasses(true)
      setClassMessage('')
      const from = new Date()
      from.setDate(from.getDate() - 14)
      const to = new Date()
      to.setDate(to.getDate() + 45)

      try {
        const response = await fetch(`/api/user/lich-lop-hoc?from=${formatDate(from)}&to=${formatDate(to)}`, {
          cache: 'no-store',
        })
        const data = await readJsonResponse(response)
        if (data.noLmsToken) {
          if (mounted) {
            setClasses([])
            setClassMessage('Chưa kết nối LMS để lấy lớp của bạn.')
          }
          return
        }
        if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Không thể tải lớp học.')

        const byClass = new Map<string, UserClassSlot>()
        ;(data.slots || []).forEach((slot: UserClassSlot) => {
          if (!slot?.classId) return
          const current = byClass.get(slot.classId)
          if (!current) {
            byClass.set(slot.classId, slot)
            return
          }
          const currentTime = new Date(current.startTime || current.date).getTime()
          const nextTime = new Date(slot.startTime || slot.date).getTime()
          if (Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime < currentTime)) {
            byClass.set(slot.classId, slot)
          }
        })

        const nextClasses = Array.from(byClass.values()).sort((a, b) => a.className.localeCompare(b.className, 'vi'))
        if (mounted) {
          setClasses(nextClasses)
          const savedClassId = window.localStorage.getItem(STORAGE_KEY)
          const usableSavedClassId = savedClassId && nextClasses.some((item) => item.classId === savedClassId)
          if (usableSavedClassId) {
            setSelectedClassId(savedClassId)
          } else if (nextClasses[0]?.classId) {
            setSelectedClassId(nextClasses[0].classId)
            window.localStorage.setItem(STORAGE_KEY, nextClasses[0].classId)
          }
        }
      } catch (error: any) {
        if (mounted) {
          setClasses([])
          setClassMessage(error?.message || 'Không thể tải lớp học.')
        }
      } finally {
        if (mounted) setLoadingClasses(false)
      }
    }

    void loadClasses()

    return () => {
      mounted = false
    }
  }, [])

  const selectedClass = useMemo(
    () => classes.find((item) => item.classId === selectedClassId) || null,
    [classes, selectedClassId],
  )

  const handleClassChange = (value: string) => {
    setSelectedClassId(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {}
  }

  const openAiSupport = async () => {
    setAiMessage('')
    setAiGenerated(false)
    setAnalysis(null)
    setFollowUp(null)
    setQuestionMessage('')

    if (!documentId) {
      setModalOpen(true)
      setAiMessage('Hãy mở một giáo trình cụ thể trước khi dùng AI Hỗ Trợ.')
      return
    }
    if (!selectedClass) {
      setModalOpen(true)
      setAiMessage('Hãy chọn lớp trước khi dùng AI Hỗ Trợ.')
      return
    }
    if (!geminiApiKey) {
      setApiKeyModalOpen(true)
      return
    }

    setModalOpen(true)
    setLoadingAi(true)
    try {
      const response = await fetch('/api/user/teaching-documents/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          classContext: selectedClass,
          geminiApiKey,
        }),
      })
      const data = (await readJsonResponse(response)) as AiSupportResponse
      if (!response.ok || !data.success || !data.analysis) {
        throw new Error(data.error || 'Không thể tạo gợi ý AI.')
      }
      setAiGenerated(Boolean(data.aiGenerated))
      setAnalysis(data.analysis)
    } catch (error: any) {
      setAiMessage(error?.message || 'Không thể tạo gợi ý AI.')
    } finally {
      setLoadingAi(false)
    }
  }

  const askFollowUp = async () => {
    const trimmed = question.trim()
    setQuestionMessage('')
    setFollowUp(null)

    if (!documentId) {
      setQuestionMessage('Hãy mở một giáo trình cụ thể trước khi đặt câu hỏi.')
      return
    }
    if (!selectedClass) {
      setQuestionMessage('Hãy chọn lớp trước khi đặt câu hỏi.')
      return
    }
    if (!trimmed) {
      setQuestionMessage('Nhập câu hỏi hoặc nhu cầu tìm hình ảnh/video minh họa.')
      return
    }
    if (!geminiApiKey) {
      setApiKeyModalOpen(true)
      setQuestionMessage('Vui lòng nhập GEMINI API KEY để hỏi AI.')
      return
    }

    setAsking(true)
    try {
      const response = await fetch('/api/user/teaching-documents/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          classContext: selectedClass,
          question: trimmed,
          geminiApiKey,
        }),
      })
      const data = (await readJsonResponse(response)) as AiSupportResponse
      if (!response.ok || !data.success || !data.followUp) {
        throw new Error(data.error || 'Không thể trả lời câu hỏi.')
      }
      setFollowUp(data.followUp)
      setAiGenerated(Boolean(data.aiGenerated))
    } catch (error: any) {
      setQuestionMessage(error?.message || 'Không thể trả lời câu hỏi.')
    } finally {
      setAsking(false)
    }
  }

  const saveGeminiApiKey = () => {
    const trimmed = apiKeyDraft.trim()
    if (!trimmed) {
      setAiMessage('Vui lòng nhập GEMINI API KEY.')
      setQuestionMessage('Vui lòng nhập GEMINI API KEY.')
      return
    }
    try {
      window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed)
    } catch {}
    setGeminiApiKey(trimmed)
    setApiKeyDraft(trimmed)
    setApiKeyModalOpen(false)
    setModalOpen(false)
    setAiMessage('')
    setQuestionMessage('')
  }

  const clearGeminiApiKey = () => {
    try {
      window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY)
    } catch {}
    setGeminiApiKey('')
    setApiKeyDraft('')
  }

  return (
    <>
      <Card className="rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-bold text-slate-800" htmlFor="user-class-select">
              Lớp của bạn
            </label>
            <div className="relative">
              <select
                id="user-class-select"
                value={selectedClassId}
                onChange={(event) => handleClassChange(event.target.value)}
                disabled={loadingClasses || classes.length === 0}
                className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {loadingClasses ? (
                  <option>Đang tải lớp...</option>
                ) : classes.length === 0 ? (
                  <option>Chưa có lớp trong lịch cá nhân</option>
                ) : (
                  classes.map((slot) => (
                    <option key={slot.classId} value={slot.classId}>
                      {classLabel(slot)}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <Button
            type="button"
            variant="mindx"
            onClick={openAiSupport}
            disabled={loadingClasses}
            className="h-10 shrink-0 px-3 sm:px-4"
            aria-label="AI Hỗ Trợ"
            title="AI Hỗ Trợ"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Hỗ Trợ</span>
          </Button>

          <div className="col-span-2 min-w-0">
            {classMessage ? (
              <p className="text-xs font-semibold text-amber-700">{classMessage}</p>
            ) : selectedClass ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5" />
                {selectedClass.students?.length || 0} học viên
                <span>•</span>
                {selectedClass.centreName || 'Chưa rõ cơ sở'}
                <span>•</span>
                Buổi gần nhất {fmtTime(selectedClass.startTime)}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="4xl">
        <ModalHeader>
          <div className="min-w-0">
            <ModalTitle>AI Hỗ Trợ giảng dạy</ModalTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{selectedClass ? selectedClass.className : 'Chưa chọn lớp'}</span>
              <button
                type="button"
                onClick={() => {
                  setApiKeyDraft(geminiApiKey)
                  setApiKeyModalOpen(true)
                }}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600 hover:bg-slate-200"
              >
                {geminiApiKey ? 'Đổi API key' : 'Nhập API key'}
              </button>
              {aiGenerated ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                  Gemini
                </span>
              ) : null}
            </div>
          </div>
          <ModalClose onClick={() => setModalOpen(false)} />
        </ModalHeader>
        <ModalBody className="max-h-[72vh]">
          {loadingAi ? (
            <div className="flex h-52 items-center justify-center text-sm font-semibold text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI đang tổng hợp dữ liệu lớp và giáo trình...
            </div>
          ) : aiMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {aiMessage}
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                <Bot className="mr-2 inline h-4 w-4" />
                {analysis.overview}
              </div>
              <AssistantSection title="Đối chiếu giáo trình" items={analysis.curriculumFit} />
              <AssistantSection title="Nhận xét lớp học" items={analysis.classSignals} />
              <AssistantSection title="Gợi ý tốc độ giảng dạy" items={analysis.pacingSuggestions} />
              <AssistantSection title="Điều chỉnh nội dung" items={analysis.contentAdjustments} />
              <AssistantSection title="Hoạt động và ví dụ nên dùng" items={analysis.activityIdeas} />
              <AssistantSection title="Cách trình bày" items={analysis.presentationTips} />
              <AssistantSection title="Lưu ý chung cho học viên" items={analysis.generalStudentNotes} />
              <StudentNotesSection notes={analysis.studentNotes} />
              <SupportSkillsSection skills={analysis.supportSkills} />
              <AskAiSection
                question={question}
                setQuestion={setQuestion}
                asking={asking}
                onAsk={askFollowUp}
                message={questionMessage}
                followUp={followUp}
              />
            </div>
          ) : null}
        </ModalBody>
      </Modal>

      <Modal open={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} size="lg">
        <ModalHeader>
          <div>
            <ModalTitle>GEMINI API KEY</ModalTitle>
            <p className="mt-1 text-sm text-slate-500">Key được lưu trong localStorage của trình duyệt này.</p>
          </div>
          <ModalClose onClick={() => setApiKeyModalOpen(false)} />
        </ModalHeader>
        <ModalBody className="max-h-[70vh]">
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-black">⚠️ Cần Nhập API Key</p>
              <p className="mt-1 font-semibold">
                Bạn cần nhập API key để sử dụng tính năng AI. Vui lòng nhập API key để tiếp tục.
              </p>
              <p className="mt-3">
                Để sử dụng tính năng AI, bạn cần nhập API key của Google Gemini.
              </p>
              <p className="mt-2">
                Nếu chưa có API key, bạn có thể lấy tại:{' '}
                <a
                  href="https://aistudio.google.com/apikey?hl=vi"
                  target="_blank"
                  rel="noreferrer"
                  className="font-black text-rose-700 underline"
                >
                  https://aistudio.google.com/apikey?hl=vi
                </a>
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-black text-slate-800">API key</span>
              <input
                value={apiKeyDraft}
                onChange={(event) => setApiKeyDraft(event.target.value)}
                type="password"
                placeholder="Nhập GEMINI API KEY"
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Nếu đổi trình duyệt hoặc xóa dữ liệu localStorage, bạn cần nhập lại key.
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {geminiApiKey ? (
                <Button type="button" variant="outline" onClick={clearGeminiApiKey}>
                  Xóa key
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setApiKeyModalOpen(false)}>
                Đóng
              </Button>
              <Button type="button" variant="mindx" onClick={saveGeminiApiKey}>
                Lưu key
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  )
}

function AskAiSection({
  question,
  setQuestion,
  asking,
  onAsk,
  message,
  followUp,
}: {
  question: string
  setQuestion: (value: string) => void
  asking: boolean
  onAsk: () => void
  message: string
  followUp: AiSupportResponse['followUp'] | null
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-rose-700" />
        <h3 className="text-sm font-black text-slate-950">Hỏi thêm AI</h3>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="VD: Tìm video minh họa vòng lặp cho học sinh nhỏ tuổi, hoặc gợi ý hình ảnh mở bài cho nội dung này..."
          className="min-h-20 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              onAsk()
            }
          }}
        />
        <Button type="button" variant="mindx" onClick={onAsk} disabled={asking} className="h-10 self-start">
          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Hỏi AI
        </Button>
      </div>
      {message ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</p>
      ) : null}
      {followUp ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
            <FormattedAiAnswer text={followUp.answer} />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <QueryCard
              title="Tìm hình ảnh"
              icon={<Image className="h-4 w-4 text-rose-700" />}
              queries={followUp.imageQueries}
              baseUrl="https://www.google.com/search?tbm=isch&q="
            />
            <QueryCard
              title="Tìm video"
              icon={<Video className="h-4 w-4 text-rose-700" />}
              queries={followUp.videoQueries}
              baseUrl="https://www.youtube.com/results?search_query="
            />
            <ReferenceLinks links={followUp.referenceLinks} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function decodeText(value: string) {
  return value
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function FormattedAiAnswer({ text }: { text: string }) {
  const normalized = decodeText(text)
    .replace(/\r\n/g, '\n')
    .replace(/(\d+\.\s+)/g, '\n$1')
    .replace(/\s+-\s+/g, '\n- ')
    .replace(/\s+\*(.+?)\*/g, '\n*$1*')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const blocks = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean)

  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((line, index) => {
        const numbered = line.match(/^(\d+)\.\s*(.+)$/)
        const bullet = line.match(/^-\s*(.+)$/)
        const emphasis = line.match(/^\*(.+?)\*:?(.+)?$/)

        if (numbered) {
          return (
            <div key={`line-${index}`} className="mt-3 flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-700 text-xs font-black text-white">
                {numbered[1]}
              </span>
              <p className="font-black text-slate-950">{numbered[2]}</p>
            </div>
          )
        }

        if (bullet) {
          return (
            <div key={`line-${index}`} className="flex gap-2 pl-8">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-700" />
              <p>{bullet[1]}</p>
            </div>
          )
        }

        if (emphasis) {
          return (
            <p key={`line-${index}`} className="rounded-md bg-slate-50 px-3 py-2 font-semibold text-slate-900">
              <span className="font-black">{emphasis[1]}</span>
              {emphasis[2] ? `: ${emphasis[2].replace(/^:\s*/, '')}` : ''}
            </p>
          )
        }

        return (
          <p key={`line-${index}`} className={index === 0 ? 'font-semibold text-slate-900' : ''}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

function QueryCard({
  title,
  icon,
  queries,
  baseUrl,
}: {
  title: string
  icon: ReactNode
  queries: string[]
  baseUrl: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        {icon}
        {title}
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        {queries.map((query, index) => (
          <li key={`${title}-${index}`}>
            <a
              href={`${baseUrl}${encodeURIComponent(query)}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-rose-700 hover:underline"
            >
              {query}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SupportSkillsSection({
  skills,
}: {
  skills: {
    searchQueries: string[]
    imagePrompts: string[]
    referenceLinks: Array<{ title: string; url: string; reason: string }>
  }
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black text-slate-950">Tư liệu hỗ trợ</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Search className="h-4 w-4 text-rose-700" />
            Tìm kiếm
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {skills.searchQueries.map((query, index) => (
              <li key={`query-${index}`}>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-rose-700 hover:underline"
                >
                  {query}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Image className="h-4 w-4 text-rose-700" />
            Ảnh minh họa
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {skills.imagePrompts.map((prompt, index) => (
              <li key={`image-${index}`} className="rounded-md bg-white px-3 py-2">
                <p>{prompt}</p>
                <a
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-black text-rose-700 hover:underline"
                >
                  Tìm ảnh minh họa
                </a>
              </li>
            ))}
          </ul>
        </div>

        <ReferenceLinks links={skills.referenceLinks} showPreview />
      </div>
    </section>
  )
}

function ReferenceLinks({
  links,
  showPreview = false,
}: {
  links: Array<{ title: string; url: string; reason: string }>
  showPreview?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <ExternalLink className="h-4 w-4 text-rose-700" />
        Link tham khảo
      </div>
      <div className="mt-2 space-y-2">
        {links.map((link, index) => (
          <div key={`ref-${index}`} className="rounded-md bg-white p-2 text-sm">
            <a href={link.url} target="_blank" rel="noreferrer" className="font-black text-rose-700 hover:underline">
              {link.title}
            </a>
            <span className="mt-1 block text-xs text-slate-500">{link.reason}</span>
            {showPreview ? (
              <iframe
                title={link.title}
                src={link.url}
                loading="lazy"
                className="mt-2 h-28 w-full rounded border border-slate-200 bg-white"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentNotesSection({
  notes,
}: {
  notes: Array<{ studentName: string; status?: string; insight: string; supportActions: string[]; teacherApproach: string }>
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black text-slate-950">Lưu ý học sinh</h3>
      {notes.length === 0 ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Chưa có nhận xét học sinh cụ thể trong dữ liệu gửi lên; nên quan sát kỹ nhóm cần hỗ trợ ở 15 phút đầu.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {notes.map((item, index) => (
            <article
              key={`${item.studentName}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-black text-slate-900">{item.studentName || 'Học sinh'}</h4>
                {item.status ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {item.status}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                {item.insight}
              </p>
              <div className="mt-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Hành động hỗ trợ</p>
                <ul className="mt-1.5 space-y-1.5 text-sm text-slate-700">
                  {item.supportActions.map((note, noteIndex) => (
                    <li key={`${item.studentName}-${noteIndex}`} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-700" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cách tương tác</p>
                <p className="mt-1 text-sm text-slate-700">{item.teacherApproach}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function AssistantSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
