'use client'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  COURSE_OPTIONS,
  LEVELS,
  SUBJECT_FOLDERS,
  TeachingDocumentLibrary,
  type DocumentStatus,
  type TeachingDocument,
} from '@/components/teaching-documents/TeachingDocumentLibrary'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import {
  BookOpen,
  FileArchive,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SUBJECTS = [...SUBJECT_FOLDERS]
type SubjectName = (typeof SUBJECTS)[number]
const LESSONS = Array.from({ length: 14 }, (_, index) => `Buổi ${index + 1}`)
const MAX_DOCUMENT_MB = 100

const STATUS_TABS: Array<{ value: DocumentStatus; label: string }> = [
  { value: 'published', label: 'Tài liệu ban hành' },
  { value: 'draft', label: 'Tài liệu nháp' },
  { value: 'disabled', label: 'Tài liệu bị khóa' },
]

function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function normalizeStatus(document: TeachingDocument): DocumentStatus {
  return document.document_status || 'published'
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
        ? 'Máy chủ đang lỗi nội bộ. Vui lòng thử lại sau khi server ổn định.'
        : text,
    }
  }
}

export default function QuanLyTaiLieuGiangDayPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<TeachingDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [activeStatus, setActiveStatus] = useState<DocumentStatus>('published')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    subject_name: SUBJECTS[0],
    course_name: COURSE_OPTIONS[SUBJECTS[0]][0],
    document_level: 'Basic',
    lesson_number: LESSONS[0],
  })

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/teaching-documents', { cache: 'no-store' })
      const data = await readJsonResponse(response)
      if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải tài liệu')
      setDocuments(data.documents || [])
    } catch (error: any) {
      setMessage(error?.message || 'Không thể tải tài liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const groupedStats = useMemo(() => {
    const subjects = new Set(documents.map((doc) => doc.subject_name)).size
    const lessons = new Set(documents.map((doc) => `${doc.subject_name}-${doc.document_level}-${doc.lesson_number}`)).size
    const totalSize = documents.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0)
    return { subjects, lessons, totalSize }
  }, [documents])

  const statusCounts = useMemo(() => {
    return STATUS_TABS.reduce<Record<DocumentStatus, number>>(
      (counts, tab) => {
        counts[tab.value] = documents.filter((document) => normalizeStatus(document) === tab.value).length
        return counts
      },
      { published: 0, draft: 0, disabled: 0 },
    )
  }, [documents])

  const visibleDocuments = useMemo(
    () => documents.filter((document) => normalizeStatus(document) === activeStatus),
    [activeStatus, documents],
  )

  const selectedCourseOptions = COURSE_OPTIONS[form.subject_name] || []

  const resetUploadForm = () => {
    setFile(null)
    setDragActive(false)
    setForm({
      title: '',
      description: '',
      subject_name: SUBJECTS[0],
      course_name: COURSE_OPTIONS[SUBJECTS[0]][0],
      document_level: 'Basic',
      lesson_number: LESSONS[0],
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectFile = (nextFile: File | null) => {
    setFile(nextFile)
    if (nextFile && !form.title.trim()) {
      setForm((current) => ({ ...current, title: nextFile.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setMessage('Vui lòng chọn file tài liệu')
      return
    }
    if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
      setMessage(`File vượt quá dung lượng tối đa ${MAX_DOCUMENT_MB}MB`)
      return
    }

    setUploading(true)
    setMessage('')
    try {
      const payload = new FormData()
      payload.append('file', file)
      payload.append('document_status', 'published')
      Object.entries(form).forEach(([key, value]) => payload.append(key, value))

      const response = await fetch('/api/admin/teaching-documents', {
        method: 'POST',
        body: payload,
      })
      const data = await readJsonResponse(response)
      if (!response.ok || !data.success) throw new Error(data.error || 'Ban hành thất bại')

      setMessage('Đã ban hành tài liệu giảng dạy')
      resetUploadForm()
      setIsUploadOpen(false)
      setActiveStatus('published')
      await loadDocuments()
    } catch (error: any) {
      setMessage(error?.message || 'Không thể ban hành tài liệu')
    } finally {
      setUploading(false)
    }
  }

  return (
    <PageContainer
      title="Quản lý tài liệu giảng dạy"
      description="Upload tài liệu bảo mật theo khối, môn học, level và buổi học"
      headerActions={
        <Button type="button" variant="mindx" onClick={() => setIsUploadOpen(true)}>
          <UploadCloud className="h-4 w-4" />
          Upload
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border border-slate-200 p-4">
          <FileText className="mb-3 h-5 w-5 text-rose-700" />
          <p className="text-2xl font-black text-slate-950">{documents.length}</p>
          <p className="text-sm text-slate-500">Tài liệu</p>
        </Card>
        <Card className="rounded-lg border border-slate-200 p-4">
          <BookOpen className="mb-3 h-5 w-5 text-rose-700" />
          <p className="text-2xl font-black text-slate-950">{groupedStats.subjects}</p>
          <p className="text-sm text-slate-500">Bộ môn</p>
        </Card>
        <Card className="rounded-lg border border-slate-200 p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-rose-700" />
          <p className="text-2xl font-black text-slate-950">{formatFileSize(groupedStats.totalSize)}</p>
          <p className="text-sm text-slate-500">Dung lượng private S3</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveStatus(tab.value)}
            className={`h-10 rounded-md px-4 text-sm font-bold transition ${
              activeStatus === tab.value
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                activeStatus === tab.value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {statusCounts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      <Card className="rounded-lg border border-slate-200 p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Kho tài liệu</h2>
            <p className="text-sm text-slate-500">Người tạo: {user?.email || 'Super Admin'}</p>
          </div>
          <FileArchive className="h-5 w-5 text-rose-700" />
        </div>

        <TeachingDocumentLibrary documents={visibleDocuments} loading={loading} subjects={SUBJECT_FOLDERS} />
      </Card>

      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          setIsUploadOpen(open)
          if (!open) resetUploadForm()
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden">
          <DialogHeader className="flex-row items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-black">Upload tài liệu</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                PDF, DOCX, PPTX hoặc hình ảnh, tối đa {MAX_DOCUMENT_MB}MB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <DialogBody className="max-h-[calc(92vh-96px)] overflow-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                  selectFile(event.dataTransfer.files?.[0] || null)
                }}
                className={`flex min-h-36 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition ${
                  dragActive ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50 hover:border-rose-300'
                }`}
              >
                <UploadCloud className="mb-3 h-8 w-8 text-rose-700" />
                <span className="text-sm font-bold text-slate-900">
                  {file ? file.name : 'Kéo thả file hoặc bấm để chọn'}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {file ? formatFileSize(file.size) : '.pdf, .docx, .pptx, .png, .jpg, .webp'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0] || null)}
              />

              <label className="block">
                <span className="mb-1 block text-sm font-bold text-slate-700">Tiêu đề</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-bold text-slate-700">Mô tả</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Khối</span>
                  <select
                    value={form.subject_name}
                    onChange={(event) => {
                      const subject = event.target.value as SubjectName
                      setForm((current) => ({
                        ...current,
                        subject_name: subject,
                        course_name: COURSE_OPTIONS[subject]?.[0] || '',
                      }))
                    }}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                    required
                  >
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Môn học</span>
                  <select
                    value={form.course_name}
                    onChange={(event) => setForm((current) => ({ ...current, course_name: event.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                    required
                  >
                    {selectedCourseOptions.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Level</span>
                  <select
                    value={form.document_level}
                    onChange={(event) => setForm((current) => ({ ...current, document_level: event.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Buổi học</span>
                  <select
                    value={form.lesson_number}
                    onChange={(event) => setForm((current) => ({ ...current, lesson_number: event.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                    required
                  >
                    {LESSONS.map((lesson) => (
                      <option key={lesson} value={lesson}>
                        {lesson}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {message && (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>
              )}

              <Button type="submit" variant="mindx" className="w-full" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {uploading ? 'Đang ban hành...' : 'Ban hành'}
              </Button>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
