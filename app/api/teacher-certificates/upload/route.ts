import { withApiProtection } from '@/lib/api-protection'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3'
import {
  buildTeacherCertificateKey,
  hasAllowedTeacherCertificateSignature,
  isAllowedTeacherCertificateContentType,
  makeTeacherCertificateProxyUrl,
  TEACHER_CERTIFICATE_MAX_BYTES,
  TEACHER_CERTIFICATES_BUCKET,
} from '@/lib/teacher-certificate-storage'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function ensureBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: TEACHER_CERTIFICATES_BUCKET }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: TEACHER_CERTIFICATES_BUCKET }))
  }
}

async function handlePost(req: NextRequest) {
  try {
    const csrfDenied = requireSameOriginMutation(req)
    if (csrfDenied) return csrfDenied

    const auth = await requireBearerSession(req)
    if (!auth.ok) return auth.response

    const rateLimited = await rateLimitOr429Async(
      `teacher-certificates-upload:${auth.sessionEmail}:${clientIpFromRequest(req)}`,
      20,
      60_000,
    )
    if (rateLimited) return rateLimited

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Request upload không hợp lệ' },
        { status: 400 },
      )
    }

    const file = formData.get('certificate')

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file chứng chỉ' },
        { status: 400 },
      )
    }

    const contentType = file.type.trim().toLowerCase()
    if (!isAllowedTeacherCertificateContentType(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ PDF, JPG, PNG hoặc WEBP' },
        { status: 400 },
      )
    }

    if (file.size <= 0 || file.size > TEACHER_CERTIFICATE_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Kích thước file tối đa 10MB' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasAllowedTeacherCertificateSignature(buffer, contentType)) {
      return NextResponse.json(
        { success: false, error: 'Nội dung file không đúng định dạng chứng chỉ' },
        { status: 400 },
      )
    }

    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 },
      )
    }

    const key = buildTeacherCertificateKey(auth.sessionEmail, contentType)

    await ensureBucket()
    const client = createSupabaseS3Client()
    await client.send(
      new PutObjectCommand({
        Bucket: TEACHER_CERTIFICATES_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          owner: auth.sessionEmail,
        },
      }),
    )

    return NextResponse.json({
      success: true,
      url: makeTeacherCertificateProxyUrl(key),
      key,
      bucket: TEACHER_CERTIFICATES_BUCKET,
    })
  } catch (error) {
    console.error('Error uploading teacher certificate:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể upload chứng chỉ' },
      { status: 500 },
    )
  }
}

export const POST = withApiProtection(handlePost)
