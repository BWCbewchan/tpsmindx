'use client'
import { useQueryState } from '@/lib/use-query-state'


import { PageContainer } from '@/components/PageContainer'
import {
  COURSE_OPTIONS,
  LEVELS,
  SUBJECT_FOLDERS,
  TEACHING_DOCUMENT_FOLDERS,
  TeachingDocumentLibrary,
  type DocumentStatus,
  type TeachingDocument,
} from '@/components/teaching-documents/TeachingDocumentLibrary'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  Link2,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SUBJECTS = [...SUBJECT_FOLDERS]
type SubjectName = (typeof SUBJECTS)[number]
type TeachingDocumentFolderName = (typeof TEACHING_DOCUMENT_FOLDERS)[number]
type UploadSourceType = 'file' | 'material_link'
type UploadFormState = {
  title: string
  description: string
  subject_name: SubjectName
  course_name: string
  document_level: string
  folder_name: TeachingDocumentFolderName
  lesson_number: string
}
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
  const [uploadSourceType, setUploadSourceType] = useState<UploadSourceType>('file')
  const [materialUrl, setMaterialUrl] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [activeStatus, setActiveStatus] = useQueryState<DocumentStatus>('status', 'published', {values:['published','draft','disabled']})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<UploadFormState>({
    title: '',
    description: '',
    subject_name: SUBJECTS[0],
    course_name: COURSE_OPTIONS[SUBJECTS[0]][0],
    document_level: 'Basic',
    folder_name: TEACHING_DOCUMENT_FOLDERS[0],
    lesson_number: LESSONS[0],
  })

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/teaching-documents', { cache: 'no-store' })
      const data = await readJsonResponse(response)
      if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải giáo trình')
      setDocuments(data.documents || [])
    } catch (error: any) {
      setMessage(error?.message || 'Không thể tải giáo trình')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const groupedStats = useMemo(() => {
    const subjects = new Set(documents.map((doc) => doc.subject_name)).size
    const totalSize = documents.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0)
    return { subjects, totalSize }
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
    setUploadSourceType('file')
    setMaterialUrl('')
    setDragActive(false)
    setForm({
      title: '',
      description: '',
      subject_name: SUBJECTS[0],
      course_name: COURSE_OPTIONS[SUBJECTS[0]][0],
      document_level: 'Basic',
      folder_name: TEACHING_DOCUMENT_FOLDERS[0],
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
    if (uploadSourceType === 'file' && !file) {
      setMessage('Vui lòng chọn file giáo trình')
      return
    }
    if (uploadSourceType === 'file' && file && file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
      setMessage(`File vượt quá dung lượng tối đa ${MAX_DOCUMENT_MB}MB`)
      return
    }
    if (uploadSourceType === 'material_link' && !materialUrl.trim()) {
      setMessage('Vui lòng nhập link tải Material')
      return
    }

    setUploading(true)
    setMessage('')
    try {
      const payload = new FormData()
      if (file && uploadSourceType === 'file') payload.append('file', file)
      payload.append('source_type', uploadSourceType)
      payload.append('material_url', materialUrl.trim())
      payload.append('document_status', 'published')
      Object.entries({
        ...form,
        folder_name: uploadSourceType === 'material_link' ? 'Material' : form.folder_name,
      }).forEach(([key, value]) => payload.append(key, value))

      const response = await fetch('/api/admin/teaching-documents', {
        method: 'POST',
        body: payload,
      })
      const data = await readJsonResponse(response)
      if (!response.ok || !data.success) throw new Error(data.error || 'Ban hành thất bại')

      setMessage(uploadSourceType === 'material_link' ? 'Đã thêm link Material' : 'Đã ban hành giáo trình')
      resetUploadForm()
      setIsUploadOpen(false)
      setActiveStatus('published')
      await loadDocuments()
    } catch (error: any) {
      setMessage(error?.message || 'Không thể ban hành giáo trình')
    } finally {
      setUploading(false)
    }
  }

  const handleMoveDocument = async (
    document: TeachingDocument,
    folderName: TeachingDocumentFolderName,
  ) => {
    const previousFolder = document.folder_name || 'Material'
    if (previousFolder === folderName) return

    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, folder_name: folderName } : item)),
    )
    setMessage('')

    try {
      const response = await fetch('/api/admin/teaching-documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: document.id,
          folder_name: folderName,
        }),
      })
      const data = await readJsonResponse(response)
      if (!response.ok || !data.success) throw new Error(data.error || 'Không thể di chuyển tài liệu')
      setMessage(`Đã chuyển “${document.title}” vào ${folderName}`)
    } catch (error: any) {
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? { ...item, folder_name: previousFolder } : item)),
      )
      setMessage(error?.message || 'Không thể di chuyển tài liệu')
      throw error
    }
  }

  return (
    <PageContainer
      title="Quản lý giáo trình"
      description="Upload và ban hành giáo trình theo khối, môn học, level và buổi học"
      headerActions={
        <Button type="button" variant="mindx" onClick={() => setIsUploadOpen(true)}>
          <UploadCloud className="h-4 w-4" />
          Upload
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <FileText className="mb-2 h-4 w-4 text-rose-700 sm:mb-3 sm:h-5 sm:w-5" />
          <p className="text-lg font-black leading-none text-slate-950 sm:text-2xl">{documents.length}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500 sm:text-sm">Giáo trình</p>
        </Card>
        <Card className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <BookOpen className="mb-2 h-4 w-4 text-rose-700 sm:mb-3 sm:h-5 sm:w-5" />
          <p className="text-lg font-black leading-none text-slate-950 sm:text-2xl">{groupedStats.subjects}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500 sm:text-sm">Khối</p>
        </Card>
        <Card className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <ShieldCheck className="mb-2 h-4 w-4 text-rose-700 sm:mb-3 sm:h-5 sm:w-5" />
          <p className="text-lg font-black leading-none text-slate-950 sm:text-2xl">
            {formatFileSize(groupedStats.totalSize)}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500 sm:text-sm">
            <span className="sm:hidden">Private S3</span>
            <span className="hidden sm:inline">Dung lượng private S3</span>
          </p>
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

      {message && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>
      )}

      <Card className="rounded-lg border border-slate-200 p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Kho giáo trình</h2>
            <p className="text-sm text-slate-500">Người tạo: {user?.email || 'Super Admin'}</p>
          </div>
          <FileArchive className="h-5 w-5 text-rose-700" />
        </div>

        <TeachingDocumentLibrary
          documents={visibleDocuments}
          loading={loading}
          subjects={SUBJECT_FOLDERS}
          allowDocumentMove
          onMoveDocument={handleMoveDocument}
        />
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
              <DialogTitle className="text-xl font-black">Thêm tài liệu giảng dạy</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                Upload file giáo trình hoặc gắn link tải tài nguyên Material.
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
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setUploadSourceType('file')}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                    uploadSourceType === 'file'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadSourceType('material_link')
                    setFile(null)
                    setForm((current) => ({ ...current, folder_name: 'Material' }))
                  }}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                    uploadSourceType === 'material_link'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Link2 className="h-4 w-4" />
                  Link Material
                </button>
              </div>

              {uploadSourceType === 'file' ? (
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
                    dragActive
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-slate-300 bg-slate-50 hover:border-rose-300'
                  }`}
                >
                  <UploadCloud className="mb-3 h-8 w-8 text-rose-700" />
                  <span className="text-sm font-bold text-slate-900">
                    {file ? file.name : 'Kéo thả file hoặc bấm để chọn'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    {file ? formatFileSize(file.size) : `.pdf, .docx, .pptx, .png, .jpg, .webp · tối đa ${MAX_DOCUMENT_MB}MB`}
                  </span>
                </button>
              ) : (
                <label className="block rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <span className="mb-1 block text-sm font-bold text-slate-800">Link tải Material</span>
                  <input
                    type="url"
                    value={materialUrl}
                    onChange={(event) => setMaterialUrl(event.target.value)}
                    placeholder="https://... (OneDrive, SharePoint hoặc nguồn tải khác)"
                    className="h-11 w-full rounded-md border border-sky-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
                    required
                  />
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    Giáo viên bấm thẻ Material để TPS tải ngầm file từ link này. Chỉ chấp nhận link HTTPS có quyền tải.
                  </span>
                </label>
              )}
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

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Thư mục con</span>
                  <select
                    value={form.folder_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        folder_name: event.target.value as TeachingDocumentFolderName,
                      }))
                    }
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-rose-500"
                    disabled={uploadSourceType === 'material_link'}
                    required
                  >
                    {TEACHING_DOCUMENT_FOLDERS.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                </label>

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
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : uploadSourceType === 'material_link' ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {uploading
                  ? 'Đang lưu...'
                  : uploadSourceType === 'material_link'
                    ? 'Thêm link Material'
                    : 'Ban hành'}
              </Button>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
