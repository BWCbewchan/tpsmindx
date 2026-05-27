import mammoth from 'mammoth'
import { NextRequest, NextResponse } from 'next/server'

import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import { sanitizeHtml } from '@/lib/server-sanitize-html'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import {
  classifyTeachingDocument,
  findTeachingDocument,
  getTeachingDocumentObject,
  signDocumentToken,
  verifyDocumentToken,
} from '@/lib/teaching-documents'

export const runtime = 'nodejs'

function zeroWidthFingerprint(email: string) {
  const bits = Buffer.from(email.toLowerCase()).toString('hex')
  const encoded = bits
    .split('')
    .map((char) => (parseInt(char, 16) % 2 === 0 ? '\u200b' : '\u200c'))
    .join('')
  return `<span aria-hidden="true" style="position:absolute;left:-9999px">${encoded}</span>`
}

function watermarkHeaders() {
  return {
    'Cache-Control': 'no-store, private, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  const { id: rawId } = await context.params
  const documentId = Number(rawId)
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã tài liệu không hợp lệ' }, { status: 400 })
  }

  const rl = rateLimitOr429(
    `teaching-doc-stream:${auth.sessionEmail}:${clientIpFromRequest(request)}`,
    20,
    5_000,
  )
  if (rl) return rl

  const document = await findTeachingDocument(documentId)
  if (!document) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy tài liệu' }, { status: 404 })
  }

  if (!auth.privileged && document.document_status !== 'published') {
    return NextResponse.json({ success: false, error: 'Không có quyền xem tài liệu này' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'content'
  const mode = searchParams.get('mode') || ''
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const kind = classifyTeachingDocument(document.file_type, document.file_name)

  if (action === 'metadata') {
    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          title: document.title,
          description: document.description,
          fileName: document.file_name,
          fileType: document.file_type,
          fileSize: document.file_size,
          kind,
          subjectName: document.subject_name,
          courseName: document.course_name,
          documentLevel: document.document_level,
          lessonNumber: document.lesson_number,
        },
        token: signDocumentToken({
          documentId,
          email: auth.sessionEmail,
          page,
          expiresAt: Date.now() + 10_000,
        }),
        expiresInSeconds: 10,
      },
      { headers: watermarkHeaders() },
    )
  }

  const token = searchParams.get('token') || ''
  const verified = verifyDocumentToken(token)
  if (!verified || verified.documentId !== documentId || verified.email !== auth.sessionEmail) {
    return NextResponse.json({ success: false, error: 'Token xem tài liệu đã hết hạn' }, { status: 401 })
  }

  const object = await getTeachingDocumentObject(document.s3_bucket, document.s3_key)

  if (kind === 'docx' && mode === 'raw') {
    return new NextResponse(object.buffer, {
      status: 200,
      headers: {
        ...watermarkHeaders(),
        'Content-Type': document.file_type || object.contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.file_name)}"`,
      },
    })
  }

  if (kind === 'docx') {
    const result = await mammoth.convertToHtml({ buffer: object.buffer })
    const html = sanitizeHtml(result.value) + zeroWidthFingerprint(auth.sessionEmail)
    return NextResponse.json(
      {
        success: true,
        kind,
        html,
        warnings: result.messages?.map((message: { message: string }) => message.message) || [],
      },
      { headers: watermarkHeaders() },
    )
  }

  return new NextResponse(object.buffer, {
    status: 200,
    headers: {
      ...watermarkHeaders(),
      'Content-Type': document.file_type || object.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.file_name)}"`,
    },
  })
}
