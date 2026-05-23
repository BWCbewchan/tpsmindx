import { requireBearerSuperAdmin } from '@/lib/auth-server'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import {
  TEACHING_DOCUMENT_BUCKET,
  classifyTeachingDocument,
  createTeachingDocumentRecord,
  ensureTeachingDocumentBucket,
  isTeachingDocumentStatus,
  isTeachingDocumentLevel,
  listTeachingDocuments,
  sanitizeFileStem,
  uploadTeachingDocumentObject,
} from '@/lib/teaching-documents'
import { isSupabaseS3Configured } from '@/lib/supabase-s3'
import { NextRequest, NextResponse } from 'next/server'

const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'png', 'jpg', 'jpeg', 'webp'])

export async function GET(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  try {
    const documents = await listTeachingDocuments()
    return NextResponse.json({ success: true, documents })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tải danh sách tài liệu' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  const rl = rateLimitOr429(`teaching-doc-upload:${clientIpFromRequest(request)}`, 10, 60_000)
  if (rl) return rl

  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn file tài liệu' }, { status: 400 })
    }

    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const subjectName = String(formData.get('subject_name') || '').trim()
    const courseName = String(formData.get('course_name') || '').trim()
    const documentLevel = String(formData.get('document_level') || '').trim()
    const lessonNumber = String(formData.get('lesson_number') || '').trim()
    const documentStatus = String(formData.get('document_status') || 'published').trim()

    if (!title || !subjectName || !documentLevel || !lessonNumber) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ tiêu đề, bộ môn, level và buổi học' },
        { status: 400 },
      )
    }

    if (!isTeachingDocumentLevel(documentLevel)) {
      return NextResponse.json({ success: false, error: 'Level tài liệu không hợp lệ' }, { status: 400 })
    }

    if (!isTeachingDocumentStatus(documentStatus)) {
      return NextResponse.json({ success: false, error: 'Trạng thái tài liệu không hợp lệ' }, { status: 400 })
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ success: false, error: 'File vượt quá dung lượng tối đa 100MB' }, { status: 400 })
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ PDF, DOCX, PPTX, PNG, JPG/JPEG và WEBP' },
        { status: 400 },
      )
    }

    const kind = classifyTeachingDocument(file.type || '', file.name)
    if (kind === 'file') {
      return NextResponse.json({ success: false, error: 'Định dạng tài liệu chưa được hỗ trợ' }, { status: 400 })
    }

    await ensureTeachingDocumentBucket()
    const datePrefix = new Date().toISOString().slice(0, 10)
    const key = `secure-teaching/${datePrefix}/${Date.now()}-${sanitizeFileStem(file.name)}.${extension}`
    await uploadTeachingDocumentObject(file, key)

    const document = await createTeachingDocumentRecord({
      title,
      description: description || null,
      s3Key: key,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      subjectName,
      courseName: courseName || null,
      documentLevel,
      lessonNumber,
      documentStatus,
      createdByEmail: gate.sessionEmail,
    })

    return NextResponse.json({
      success: true,
      document,
      storagePath: `s3://${TEACHING_DOCUMENT_BUCKET}/${key}`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể upload tài liệu giảng dạy' },
      { status: 500 },
    )
  }
}
