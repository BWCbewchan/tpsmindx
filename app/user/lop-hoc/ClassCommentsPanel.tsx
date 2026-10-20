'use client'

import { CommentRichTextEditor } from '@/components/CommentRichTextEditor'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  LoaderCircle,
  MessageSquareText,
  Save,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type CommentAreaType = 'CONTENT' | 'RATE' | 'CHECKPOINT' | 'DEMO'
type SlotKind = 'NONE' | 'DEFAULT' | 'SPECIAL' | 'CHECKPOINT' | 'FINAL'

type CommentRate = {
  value: number
  commentSamples?: string[]
}

type CheckpointQuestionConfig = {
  id: string
  question: string
  grade: number
}

type DemoQuestionConfig = {
  id: string
  title: string
  maxScore: number
}

type CommentArea = {
  id: string
  name: string
  fieldName: string
  type: CommentAreaType
  rates: CommentRate[]
  checkpoint?: {
    gradeFrom?: number | null
    gradeTo?: number | null
    questions?: CheckpointQuestionConfig[]
  } | null
  demo?: DemoQuestionConfig[]
  sortOrder?: number | null
  isPublic?: boolean
  isRequired?: boolean
  guideline?: string | null
  sectionTitle?: string
  requiresGrade?: boolean
}

type CheckpointValue = {
  practiceScore: number
  checkpointScore: number
  checkpointQuestions: Array<{
    id: string
    title: string
    result: boolean
    score: number
  }>
}

type DemoQuestionValue = {
  courseProcessDemoDetailId: string
  title: string
  result: boolean
  score: number
  maxScore: number
}

type CommentAreaValue = {
  commentAreaId: string
  type: CommentAreaType
  content: string
  grade?: number
  checkpoint?: CheckpointValue
  demoQuestions?: DemoQuestionValue[]
}

type CommentStudent = {
  id: string
  fullName: string
  imageUrl: string | null
  gender: string | null
  classSiteId: string
  attendanceId: string | null
  attendanceStatus: string
  comment: string
  sendCommentStatus: string | null
  commentStatus?: {
    status?: string | null
    version?: number | null
    feedback?: string | null
  } | null
  commentByAreas: CommentAreaValue[]
}

type CommentSlot = {
  id: string
  sessionNumber: number
  date: string | null
  startTime: string | null
  endTime: string | null
  summary: string
  homework: string
  kind: SlotKind
  alwaysShow: boolean
  areas: CommentArea[]
  editableClassSiteIds: string[]
  students: CommentStudent[]
}

type CommentClass = {
  id: string
  name: string
  status: string
  numberOfSessions: number
  courseName: string
  hasCourseProcess: boolean
  classSites: Array<{ id: string; name: string }>
  slots: CommentSlot[]
}

type ApiResponse = {
  success?: boolean
  message?: string
  class?: CommentClass
  checkpoint?: {
    scoreDetail?: CheckpointValue | null
    studentSubmissions?: Array<{ id?: string; isDeleted?: boolean }>
  } | null
}

type SaveMessage = {
  type: 'success' | 'error'
  message: string
}

type Props = {
  classId: string
  selectedClassSiteId: string
}

const classRequestCache = new Map<string, Promise<CommentClass>>()

function loadCommentClass(classId: string, token: string | null): Promise<CommentClass> {
  const cacheKey = `${classId}:${token || 'session-cookie'}`
  const pendingRequest = classRequestCache.get(cacheKey)
  if (pendingRequest) return pendingRequest

  const request = fetch(`/api/user/nhan-xet-lop-hoc?classId=${encodeURIComponent(classId)}`, {
    cache: 'no-store',
    headers: authHeaders(token),
  }).then(async (response) => {
    const payload = await response.json() as ApiResponse
    if (!response.ok || !payload.success || !payload.class) {
      throw new Error(payload.message || 'Không thể tải dữ liệu nhận xét từ LMS.')
    }
    return payload.class
  })

  classRequestCache.set(cacheKey, request)
  const clearRequest = () => {
    if (classRequestCache.get(cacheKey) === request) classRequestCache.delete(cacheKey)
  }
  void request.then(clearRequest, clearRequest)
  return request
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  ATTENDED: { label: 'Có mặt', className: 'bg-emerald-50 text-emerald-700' },
  PRESENT: { label: 'Có mặt', className: 'bg-emerald-50 text-emerald-700' },
  LATE_ARRIVED: { label: 'Đi muộn', className: 'bg-amber-50 text-amber-700' },
  LATE: { label: 'Đi muộn', className: 'bg-amber-50 text-amber-700' },
  ABSENT_WITH_NOTICE: { label: 'Vắng có phép', className: 'bg-orange-50 text-orange-700' },
  EXCUSED: { label: 'Vắng có phép', className: 'bg-orange-50 text-orange-700' },
  ABSENT: { label: 'Vắng', className: 'bg-rose-50 text-rose-700' },
  NOT_RECORDED: { label: 'Chưa điểm danh', className: 'bg-gray-100 text-gray-500' },
}

const KIND_META: Record<SlotKind, { label: string; className: string }> = {
  NONE: { label: 'Nhận xét buổi học', className: 'border-gray-200 bg-gray-50 text-gray-600' },
  DEFAULT: { label: 'Nhận xét buổi học', className: 'border-gray-200 bg-gray-50 text-gray-600' },
  SPECIAL: { label: 'Tiêu chí riêng', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  CHECKPOINT: { label: 'Checkpoint', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  FINAL: { label: 'Tổng kết cuối khóa', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}

function isSlotOpen(slot: CommentSlot): boolean {
  const time = new Date(slot.startTime || slot.date || '').getTime()
  return Number.isFinite(time) && time <= Date.now()
}

function formatDate(value: string | null): string {
  if (!value) return '--/--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--/--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function htmlToPlainText(value: string): string {
  if (!value) return ''
  const prepared = value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
  if (typeof window === 'undefined') {
    return prepared
      .replace(/<[^>]*>/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
      .join('\n')
      .trim()
  }
  const element = document.createElement('div')
  element.innerHTML = prepared
  return (element.textContent || '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
    .trim()
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return parts.slice(-2).map((part) => part[0]?.toUpperCase() || '').join('') || 'HV'
}

function draftKey(slotId: string, studentId: string): string {
  return `${slotId}:${studentId}`
}

function normalizeValues(values: CommentAreaValue[]): string {
  return JSON.stringify(
    values.map((value) => ({
      ...value,
      content: value.content.trim(),
    })).sort((left, right) => left.commentAreaId.localeCompare(right.commentAreaId)),
  )
}

function areaHasValue(value: CommentAreaValue | undefined): boolean {
  if (!value) return false
  if (value.type === 'RATE') return value.grade !== undefined
  if (value.type === 'CONTENT') return Boolean(htmlToPlainText(value.content)) || value.grade !== undefined
  if (value.type === 'CHECKPOINT') return Boolean(value.checkpoint)
  return Boolean(value.demoQuestions?.length)
}

function completedAreaCount(areas: CommentArea[], values: CommentAreaValue[]): number {
  return areas.filter((area) => areaHasValue(values.find((value) => value.commentAreaId === area.id))).length
}

function defaultValueForArea(area: CommentArea): CommentAreaValue {
  if (area.type === 'CHECKPOINT') {
    const questions = area.checkpoint?.questions || []
    return {
      commentAreaId: area.id,
      type: 'CHECKPOINT',
      content: '',
      checkpoint: {
        practiceScore: Number(area.checkpoint?.gradeFrom || 0),
        checkpointScore: 0,
        checkpointQuestions: questions.map((question) => ({
          id: question.id,
          title: question.question,
          result: false,
          score: Number(question.grade || 0),
        })),
      },
    }
  }
  if (area.type === 'DEMO') {
    return {
      commentAreaId: area.id,
      type: 'DEMO',
      content: '',
      demoQuestions: (area.demo || []).map((question) => ({
        courseProcessDemoDetailId: question.id,
        title: question.title,
        result: false,
        score: 0,
        maxScore: Number(question.maxScore || 0),
      })),
    }
  }
  return {
    commentAreaId: area.id,
    type: area.type,
    content: '',
  }
}

function valuesForEditor(
  areas: CommentArea[],
  savedValues: CommentAreaValue[],
  checkpoint?: ApiResponse['checkpoint'],
): CommentAreaValue[] {
  return areas.map((area) => {
    const saved = savedValues.find((value) => value.commentAreaId === area.id)
    if (saved) return { ...saved, content: saved.content || '' }
    const initial = defaultValueForArea(area)
    if (area.type === 'CHECKPOINT' && checkpoint?.scoreDetail) {
      const scoreDetail = checkpoint.scoreDetail
      return {
        ...initial,
        checkpoint: {
          practiceScore: Number(scoreDetail.practiceScore || 0),
          checkpointScore: Number(scoreDetail.checkpointScore || 0),
          checkpointQuestions: scoreDetail.checkpointQuestions || [],
        },
      }
    }
    return initial
  })
}

function validateValues(areas: CommentArea[], values: CommentAreaValue[]): string | null {
  for (const area of areas) {
    const value = values.find((entry) => entry.commentAreaId === area.id)
    const required = Boolean(area.isRequired) || Boolean(area.requiresGrade)
    if (required && !areaHasValue(value)) return `Vui lòng hoàn thành “${area.name}”.`
    if (!value || !areaHasValue(value)) continue
    if (area.type === 'CONTENT' && area.requiresGrade) {
      if (value.grade === undefined || !htmlToPlainText(value.content)) {
        return `Vui lòng nhập đủ điểm và nhận xét cho “${area.name}”.`
      }
    }
    if (area.type === 'CHECKPOINT' && !value.checkpoint) {
      return `Vui lòng nhập điểm cho “${area.name}”.`
    }
    if (area.type === 'DEMO' && !value.demoQuestions?.length) {
      return `Vui lòng nhập điểm sản phẩm cho “${area.name}”.`
    }
  }
  if (!values.some(areaHasValue)) return 'Hãy nhập ít nhất một nội dung nhận xét.'
  return null
}

function StudentAvatar({ student }: { student: CommentStudent }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
      {student.imageUrl ? (
        <img src={student.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : getInitials(student.fullName)}
    </span>
  )
}

function AreaEditor({
  area,
  value,
  checkpointLocked,
  onChange,
}: {
  area: CommentArea
  value: CommentAreaValue
  checkpointLocked: boolean
  onChange: (value: CommentAreaValue) => void
}) {
  const label = area.name || area.fieldName || 'Tiêu chí nhận xét'

  if (area.type === 'RATE') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(area.rates || []).map((rate) => {
            const nextGrade = Number(rate.value)
            const active = value.grade === nextGrade
            return (
              <button
                key={rate.value}
                type="button"
                onClick={() => onChange({
                  ...value,
                  grade: nextGrade,
                  content: active ? value.content : (rate.commentSamples?.[0] || ''),
                })}
                className={cn(
                  'flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-[#a1001f] bg-[#a1001f] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                {rate.value}
              </button>
            )
          })}
        </div>
        <CommentRichTextEditor
          value={value.content}
          onChange={(content) => onChange({ ...value, content })}
          placeholder={`Nhận xét về ${label.toLocaleLowerCase('vi')}`}
          ariaLabel={`Nhận xét về ${label}`}
        />
      </div>
    )
  }

  if (area.type === 'CHECKPOINT') {
    const checkpoint = value.checkpoint || defaultValueForArea(area).checkpoint!
    const min = Number(area.checkpoint?.gradeFrom ?? 0)
    const max = Number(area.checkpoint?.gradeTo ?? 10)
    return (
      <div className="space-y-4">
        {checkpointLocked ? (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Điểm checkpoint được lấy từ bài nộp trên LMS.
          </div>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-600">Điểm thực hành ({min}-{max})</span>
          <input
            type="number"
            min={min}
            max={max}
            step="0.1"
            readOnly={checkpointLocked}
            value={checkpoint.practiceScore}
            onChange={(event) => onChange({
              ...value,
              checkpoint: { ...checkpoint, practiceScore: Number(event.target.value) },
            })}
            className="h-10 w-32 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#3156d4] read-only:bg-gray-50 read-only:text-gray-500"
          />
        </label>
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
          {checkpoint.checkpointQuestions.map((question) => (
            <label key={question.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                checked={question.result}
                disabled={checkpointLocked}
                onChange={(event) => {
                  const questions = checkpoint.checkpointQuestions.map((item) =>
                    item.id === question.id ? { ...item, result: event.target.checked } : item,
                  )
                  onChange({
                    ...value,
                    checkpoint: {
                      ...checkpoint,
                      checkpointQuestions: questions,
                      checkpointScore: questions.reduce(
                        (total, item) => total + (item.result ? item.score : 0),
                        0,
                      ),
                    },
                  })
                }}
                className="h-4 w-4 rounded border-gray-300 accent-[#a1001f]"
              />
              <span className="min-w-0 flex-1 text-sm text-gray-700">{question.title}</span>
              <span className="text-xs font-medium text-gray-500">{question.score} điểm</span>
            </label>
          ))}
        </div>
        <p className="text-right text-sm font-medium text-gray-700">
          Điểm checkpoint: <span className="text-[#a1001f]">{checkpoint.checkpointScore}</span>
        </p>
      </div>
    )
  }

  if (area.type === 'DEMO') {
    const questions = value.demoQuestions || defaultValueForArea(area).demoQuestions || []
    return (
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {questions.map((question) => (
          <div key={question.courseProcessDemoDetailId} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm text-gray-700">{question.title}</span>
            <input
              type="number"
              min={0}
              max={question.maxScore}
              step="0.1"
              value={question.score}
              onChange={(event) => {
                const score = Math.min(question.maxScore, Math.max(0, Number(event.target.value)))
                onChange({
                  ...value,
                  demoQuestions: questions.map((item) => item.courseProcessDemoDetailId === question.courseProcessDemoDetailId
                    ? { ...item, score, result: score > 0 }
                    : item),
                })
              }}
              className="h-9 w-20 rounded-md border border-gray-200 px-2 text-right text-sm outline-none focus:border-[#3156d4]"
            />
            <span className="w-10 text-xs text-gray-500">/ {question.maxScore}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {area.guideline ? (
        <p className="text-xs leading-5 text-gray-500">{htmlToPlainText(area.guideline)}</p>
      ) : null}
      {area.requiresGrade ? (
        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
          Điểm
          <input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={value.grade ?? ''}
            onChange={(event) => onChange({
              ...value,
              grade: event.target.value === '' ? undefined : Number(event.target.value),
            })}
            className="h-9 w-20 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-[#3156d4]"
          />
          / 5
        </label>
      ) : null}
      <CommentRichTextEditor
        value={value.content}
        onChange={(content) => onChange({ ...value, content })}
        placeholder={`Nhập ${label.toLocaleLowerCase('vi')}`}
        ariaLabel={label}
      />
    </div>
  )
}

export function ClassCommentsPanel({ classId, selectedClassSiteId }: Props) {
  const { token } = useAuth()
  const [detail, setDetail] = useState<CommentClass | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, { summary: string; homework: string }>>({})
  const [studentDrafts, setStudentDrafts] = useState<Record<string, CommentAreaValue[]>>({})
  const [checkpointByStudent, setCheckpointByStudent] = useState<Record<string, ApiResponse['checkpoint']>>({})
  const [checkpointLoading, setCheckpointLoading] = useState(false)
  const [savingLesson, setSavingLesson] = useState(false)
  const [savingStudent, setSavingStudent] = useState(false)
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    setDetail(null)
    setSelectedSlotId('')
    setSelectedStudentId('')
    setLessonDrafts({})
    setStudentDrafts({})
    setCheckpointByStudent({})
    setSaveMessage(null)

    loadCommentClass(classId, token)
      .then((nextDetail) => {
        if (!active) return
        setDetail(nextDetail)
        const openedSlots = nextDetail.slots.filter(isSlotOpen)
        const initialSlot = openedSlots.at(-1)
        setSelectedSlotId(initialSlot?.id || '')
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu nhận xét.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [classId, token])

  const selectedSlot = detail?.slots.find((slot) => slot.id === selectedSlotId) || null
  const siteStudents = useMemo(() => {
    if (!selectedSlot) return []
    const normalizedSearch = studentSearch.trim().toLocaleLowerCase('vi')
    return selectedSlot.students.filter((student) => {
      const inSite = student.classSiteId === selectedClassSiteId || (
        !student.classSiteId && (detail?.classSites.length || 0) <= 1
      )
      return inSite && (!normalizedSearch || student.fullName.toLocaleLowerCase('vi').includes(normalizedSearch))
    })
  }, [detail?.classSites.length, selectedClassSiteId, selectedSlot, studentSearch])

  const selectedStudent = selectedSlot?.students.find((student) => student.id === selectedStudentId) || null
  const currentDraftKey = selectedSlot && selectedStudent
    ? draftKey(selectedSlot.id, selectedStudent.id)
    : ''
  const checkpoint = currentDraftKey ? checkpointByStudent[currentDraftKey] : null
  const savedValues = selectedStudent?.commentByAreas || []
  const editorValues = selectedSlot && selectedStudent
    ? studentDrafts[currentDraftKey] || valuesForEditor(selectedSlot.areas, savedValues, checkpoint)
    : []
  const checkpointLocked = Boolean(
    checkpoint?.studentSubmissions?.some((submission) => submission?.isDeleted !== true),
  )

  useEffect(() => {
    setSelectedStudentId((current) => {
      if (siteStudents.some((student) => student.id === current)) return current
      return siteStudents[0]?.id || ''
    })
  }, [selectedClassSiteId, selectedSlotId, siteStudents])

  useEffect(() => {
    if (!selectedSlot || selectedSlot.kind !== 'CHECKPOINT' || !selectedStudent) return
    const key = draftKey(selectedSlot.id, selectedStudent.id)
    if (Object.prototype.hasOwnProperty.call(checkpointByStudent, key)) return

    const controller = new AbortController()
    setCheckpointLoading(true)
    const search = new URLSearchParams({
      classId,
      slotId: selectedSlot.id,
      studentId: selectedStudent.id,
    })
    fetch(`/api/user/nhan-xet-lop-hoc?${search.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: authHeaders(token),
    })
      .then(async (response) => {
        const payload = await response.json() as ApiResponse
        if (!response.ok || !payload.success) throw new Error(payload.message || 'Không tải được điểm checkpoint.')
        setCheckpointByStudent((current) => ({ ...current, [key]: payload.checkpoint || null }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCheckpointByStudent((current) => ({ ...current, [key]: null }))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckpointLoading(false)
      })

    return () => controller.abort()
  }, [checkpointByStudent, classId, selectedSlot, selectedStudent, token])

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-gray-200 bg-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#a1001f]" />
          <p className="mt-3 text-sm text-gray-500">Đang tải tiêu chí nhận xét từ LMS...</p>
        </div>
      </div>
    )
  }

  if (loadError || !detail) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-6 text-center">
        <div>
          <AlertCircle className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-medium text-rose-800">{loadError || 'Không có dữ liệu nhận xét.'}</p>
        </div>
      </div>
    )
  }

  if (!selectedSlot) {
    return <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Chưa có buổi học đã bắt đầu để nhận xét.</div>
  }

  const activeSlot = selectedSlot
  const lessonDraft = lessonDrafts[selectedSlot.id] || {
    summary: htmlToPlainText(selectedSlot.summary),
    homework: htmlToPlainText(selectedSlot.homework),
  }
  const lessonDirty = lessonDraft.summary.trim() !== htmlToPlainText(selectedSlot.summary).trim()
    || lessonDraft.homework.trim() !== htmlToPlainText(selectedSlot.homework).trim()
  const status = STATUS_META[selectedStudent?.attendanceStatus || 'NOT_RECORDED'] || STATUS_META.NOT_RECORDED
  const studentDirty = Boolean(currentDraftKey && Object.prototype.hasOwnProperty.call(studentDrafts, currentDraftKey))
    && normalizeValues(editorValues) !== normalizeValues(valuesForEditor(selectedSlot.areas, savedValues, checkpoint))
  const validationMessage = selectedStudent ? validateValues(selectedSlot.areas, editorValues) : null
  const absentBlocked = Boolean(
    selectedStudent
      && ['ABSENT', 'ABSENT_WITH_NOTICE'].includes(selectedStudent.attendanceStatus)
      && !selectedSlot.alwaysShow,
  )
  const canEditSlot = selectedSlot.editableClassSiteIds.includes(selectedClassSiteId)
  const canCommentStudent = canEditSlot
    && Boolean(selectedStudent?.attendanceId)
    && selectedStudent?.attendanceStatus !== 'NOT_RECORDED'
    && !absentBlocked
  const selectedKind = KIND_META[selectedSlot.kind]

  function updateLessonDraft(patch: Partial<{ summary: string; homework: string }>) {
    setLessonDrafts((current) => ({
      ...current,
      [activeSlot.id]: { ...lessonDraft, ...patch },
    }))
    setSaveMessage(null)
  }

  function updateAreaValue(nextValue: CommentAreaValue) {
    if (!selectedStudent || !currentDraftKey) return
    setStudentDrafts((current) => {
      const currentValues = current[currentDraftKey] || editorValues
      return {
        ...current,
        [currentDraftKey]: currentValues.map((value) =>
          value.commentAreaId === nextValue.commentAreaId ? nextValue : value,
        ),
      }
    })
    setSaveMessage(null)
  }

  async function saveLesson() {
    if (!lessonDirty || !canEditSlot || savingLesson) return
    setSavingLesson(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/user/nhan-xet-lop-hoc', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'lesson',
          classId,
          classSiteId: selectedClassSiteId,
          slotId: activeSlot.id,
          expectedStartTime: activeSlot.startTime,
          summary: lessonDraft.summary,
          homework: lessonDraft.homework,
        }),
      })
      const payload = await response.json() as ApiResponse
      if (!response.ok || !payload.success || !payload.class) {
        throw new Error(payload.message || 'Không thể lưu nội dung buổi học.')
      }
      setDetail(payload.class)
      setLessonDrafts((current) => {
        const next = { ...current }
        delete next[activeSlot.id]
        return next
      })
      setSaveMessage({ type: 'success', message: payload.message || 'Đã lưu nội dung buổi học.' })
    } catch (error: unknown) {
      setSaveMessage({ type: 'error', message: error instanceof Error ? error.message : 'Không thể lưu nội dung buổi học.' })
    } finally {
      setSavingLesson(false)
    }
  }

  async function saveStudentComment() {
    if (!selectedStudent || !studentDirty || validationMessage || !canCommentStudent || savingStudent) return
    setSavingStudent(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/user/nhan-xet-lop-hoc', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'student',
          classId,
          classSiteId: selectedClassSiteId,
          slotId: activeSlot.id,
          expectedStartTime: activeSlot.startTime,
          studentId: selectedStudent.id,
          attendanceId: selectedStudent.attendanceId,
          commentByAreas: editorValues,
        }),
      })
      const payload = await response.json() as ApiResponse
      if (!response.ok || !payload.success || !payload.class) {
        throw new Error(payload.message || 'Không thể lưu nhận xét học viên.')
      }
      setDetail(payload.class)
      setStudentDrafts((current) => {
        const next = { ...current }
        delete next[currentDraftKey]
        return next
      })
      setSaveMessage({ type: 'success', message: payload.message || 'Đã lưu nhận xét học viên.' })
    } catch (error: unknown) {
      setSaveMessage({ type: 'error', message: error instanceof Error ? error.message : 'Không thể lưu nhận xét học viên.' })
    } finally {
      setSavingStudent(false)
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#a1001f]" />
            <h3 className="text-sm font-medium text-gray-950">Nhận xét theo buổi</h3>
          </div>
          <span className={cn('rounded-md border px-2 py-1 text-xs font-medium', selectedKind.className)}>
            {selectedKind.label}
          </span>
        </div>
        <div className="overflow-x-auto pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1">
          <div className="flex min-w-max gap-1.5">
            {detail.slots.map((slot) => {
              const opened = isSlotOpen(slot)
              const active = slot.id === selectedSlot.id
              const commented = slot.students.some((student) => student.commentByAreas.length > 0 || Boolean(student.comment))
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!opened}
                  onClick={() => {
                    setSelectedSlotId(slot.id)
                    setSelectedStudentId('')
                    setSaveMessage(null)
                  }}
                  className={cn(
                    'relative flex h-14 w-[88px] shrink-0 flex-col items-center justify-center rounded-md border text-center transition-colors',
                    active
                      ? 'border-[#a1001f] bg-[#a1001f] text-white shadow-sm'
                      : opened
                        ? 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                        : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400',
                  )}
                >
                  <span className="text-sm font-semibold">Buổi {slot.sessionNumber}</span>
                  <span className={cn('mt-0.5 text-[11px]', active ? 'text-white/80' : 'text-gray-500')}>
                    {formatDate(slot.startTime || slot.date)}
                  </span>
                  {commented ? (
                    <span className={cn('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', active ? 'bg-white' : 'bg-emerald-500')} />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {saveMessage ? (
        <div className={cn(
          'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
          saveMessage.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800',
        )}>
          {saveMessage.type === 'success'
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{saveMessage.message}</span>
        </div>
      ) : null}

      {!canEditSlot ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Bạn chỉ có quyền xem nhận xét ở buổi học và class site này.</span>
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#a1001f]/10 text-[#a1001f]">
              <BookOpenCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-950">Nội dung buổi {selectedSlot.sessionNumber}</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatTime(selectedSlot.startTime)} {formatDate(selectedSlot.startTime || selectedSlot.date)}
              </p>
            </div>
          </div>
        </header>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              Tổng kết buổi học
            </span>
            <textarea
              value={lessonDraft.summary}
              onChange={(event) => updateLessonDraft({ summary: event.target.value })}
              disabled={!canEditSlot}
              rows={4}
              placeholder="Kiến thức và hoạt động chính trong buổi học"
              className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-gray-400 focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700">
              <ClipboardCheck className="h-3.5 w-3.5 text-gray-400" />
              Bài tập về nhà
            </span>
            <textarea
              value={lessonDraft.homework}
              onChange={(event) => updateLessonDraft({ homework: event.target.value })}
              disabled={!canEditSlot}
              rows={4}
              placeholder="Nội dung học viên cần hoàn thành sau buổi học"
              className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-gray-400 focus:border-[#3156d4] focus:ring-2 focus:ring-[#3156d4]/10 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
        </div>
        <footer className="flex justify-end border-t border-gray-100 bg-gray-50/70 px-4 py-3">
          <button
            type="button"
            onClick={saveLesson}
            disabled={!lessonDirty || !canEditSlot || savingLesson}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#a1001f] px-4 text-sm font-medium text-white transition-colors hover:bg-[#850019] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {savingLesson ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingLesson ? 'Đang lưu...' : 'Lưu nội dung buổi học'}
          </button>
        </footer>
      </section>

      <section className="grid min-h-[440px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-gray-50/70 lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-200 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Học viên</h3>
              </div>
              <span className="text-xs text-gray-500">{siteStudents.length}</span>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Tìm học viên"
                className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#3156d4]"
              />
            </label>
          </div>
          <div className="max-h-[520px] overflow-y-auto [scrollbar-width:thin]">
            {siteStudents.map((student) => {
              const active = student.id === selectedStudent?.id
              const meta = STATUS_META[student.attendanceStatus] || STATUS_META.NOT_RECORDED
              const done = student.commentByAreas.length > 0 || Boolean(student.comment)
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(student.id)
                    setSaveMessage(null)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors',
                    active ? 'bg-white shadow-[inset_3px_0_0_#a1001f]' : 'hover:bg-white',
                  )}
                >
                  <StudentAvatar student={student} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{student.fullName}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', meta.className)}>{meta.label}</span>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    </span>
                  </span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0', active ? 'text-[#a1001f]' : 'text-gray-300')} />
                </button>
              )
            })}
            {siteStudents.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Không có học viên trong class site này.</p>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0">
          {!selectedStudent ? (
            <div className="flex h-full min-h-[440px] items-center justify-center px-6 text-center">
              <div>
                <GraduationCap className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">Chọn một học viên để viết nhận xét.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <StudentAvatar student={selectedStudent} />
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-950">{selectedStudent.fullName}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>{status.label}</span>
                      <span className="text-xs text-gray-500">
                        {completedAreaCount(selectedSlot.areas, editorValues)}/{selectedSlot.areas.length} tiêu chí
                      </span>
                    </div>
                  </div>
                </div>
              </header>

              {canEditSlot && !canCommentStudent ? (
                <div className="m-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {!selectedStudent.attendanceId || selectedStudent.attendanceStatus === 'NOT_RECORDED'
                      ? 'Học viên cần được điểm danh trước khi viết nhận xét.'
                      : 'LMS không cho nhận xét học viên vắng ở buổi này.'}
                  </span>
                </div>
              ) : null}

              {checkpointLoading ? (
                <div className="mx-5 mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Đang đọc điểm checkpoint...
                </div>
              ) : null}

              <div className={cn('space-y-4 p-5', !canCommentStudent && 'pointer-events-none opacity-60')}>
                {selectedSlot.areas.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 px-5 py-10 text-center">
                    <Sparkles className="mx-auto h-6 w-6 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">LMS chưa cấu hình tiêu chí nhận xét cho buổi này.</p>
                  </div>
                ) : selectedSlot.areas.map((area, index) => {
                  const value = editorValues.find((entry) => entry.commentAreaId === area.id) || defaultValueForArea(area)
                  const previousSection = index > 0 ? selectedSlot.areas[index - 1]?.sectionTitle : ''
                  return (
                    <div key={area.id}>
                      {area.sectionTitle && area.sectionTitle !== previousSection ? (
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
                          <span className="h-px flex-1 bg-gray-200" />
                          {area.sectionTitle}
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {area.name}
                              {area.isRequired || area.requiresGrade ? <span className="ml-1 text-rose-500">*</span> : null}
                            </h4>
                            <p className="mt-0.5 text-[11px] text-gray-400">
                              {area.type === 'RATE' ? 'Chọn mức đánh giá và điều chỉnh nhận xét'
                                : area.type === 'CHECKPOINT' ? 'Điểm thực hành và câu hỏi checkpoint'
                                  : area.type === 'DEMO' ? 'Chấm điểm sản phẩm cuối khóa'
                                    : 'Nhập nhận xét cụ thể, dễ hiểu cho phụ huynh'}
                            </p>
                          </div>
                          {areaHasValue(value) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <Check className="h-3.5 w-3.5" /> Đã nhập
                            </span>
                          ) : null}
                        </div>
                        <AreaEditor
                          area={area}
                          value={value}
                          checkpointLocked={checkpointLocked}
                          onChange={updateAreaValue}
                        />
                      </div>
                    </div>
                  )
                })}

                {validationMessage && studentDirty ? (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {validationMessage}
                  </p>
                ) : null}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  Buổi {selectedSlot.sessionNumber} · {selectedStudent.fullName}
                </div>
                <button
                  type="button"
                  onClick={saveStudentComment}
                  disabled={!studentDirty || Boolean(validationMessage) || !canCommentStudent || savingStudent}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#a1001f] px-4 text-sm font-medium text-white transition-colors hover:bg-[#850019] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {savingStudent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingStudent ? 'Đang lưu...' : 'Lưu nhận xét'}
                </button>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
