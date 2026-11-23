import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { withApiProtection } from '@/lib/api-protection'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import {
  createSupabaseS3Client,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3'
import { updateTeacherPortfolioPortraitForSelf } from '@/lib/teacher-portfolio/service'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'mindx-teacher-portfolios'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_REQUEST_BYTES = 6 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function ensureBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
  }
}

function makeProxyUrl(key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(BUCKET_NAME)}&key=${encodeURIComponent(key)}`
}

function fileExtension(contentType: string): 'jpg' | 'png' | 'webp' {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
}

function hasExpectedSignature(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (contentType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
  }
  if (contentType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }
  return false
}

function safeOwnedKey(key: string | null): key is string {
  return Boolean(key) && !key!.includes('..') && key!.startsWith('portraits/')
}

async function deleteOwnedObject(key: string | null) {
  if (!safeOwnedKey(key)) return
  try {
    const client = createSupabaseS3Client()
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
  } catch (error) {
    console.warn('[teacher-portfolio/image] cleanup failed:', error)
  }
}

async function handlePost(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  if (!isSupabaseS3Configured()) {
    return NextResponse.json(
      { success: false, error: 'Chưa cấu hình kho lưu trữ ảnh.' },
      { status: 500 },
    )
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Ảnh portfolio tối đa 5MB.' },
      { status: 413 },
    )
  }

  let uploadedKey: string | null = null
  try {
    const formData = await request.formData()
    const file = formData.get('image')
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn một ảnh.' },
        { status: 400 },
      )
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' },
        { status: 400 },
      )
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Ảnh portfolio tối đa 5MB.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasExpectedSignature(buffer, file.type)) {
      return NextResponse.json(
        { success: false, error: 'Nội dung file ảnh không hợp lệ.' },
        { status: 400 },
      )
    }

    await ensureBucket()
    const client = createSupabaseS3Client()
    const safeEmail = auth.sessionEmail.replace(/[^a-zA-Z0-9._-]/g, '_')
    uploadedKey = `portraits/${safeEmail}/${Date.now()}-${randomUUID()}.${fileExtension(file.type)}`
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: uploadedKey,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'private, max-age=31536000, immutable',
      }),
    )

    const result = await updateTeacherPortfolioPortraitForSelf(auth.sessionEmail, {
      url: makeProxyUrl(uploadedKey),
      storageKey: uploadedKey,
    })
    if (!result) {
      await deleteOwnedObject(uploadedKey)
      uploadedKey = null
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên.' },
        { status: 404 },
      )
    }

    if (result.previousStorageKey !== uploadedKey) {
      await deleteOwnedObject(result.previousStorageKey)
    }
    return NextResponse.json(
      { success: true, data: result.data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    await deleteOwnedObject(uploadedKey)
    console.error('[teacher-portfolio/image] upload failed:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải ảnh portfolio lên.' },
      { status: 500 },
    )
  }
}

async function handleDelete(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerOrSessionCookie(request)
  if (!auth.ok) return auth.response

  try {
    const result = await updateTeacherPortfolioPortraitForSelf(auth.sessionEmail, null)
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên.' },
        { status: 404 },
      )
    }
    await deleteOwnedObject(result.previousStorageKey)
    return NextResponse.json(
      { success: true, data: result.data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[teacher-portfolio/image] delete failed:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể xóa ảnh portfolio.' },
      { status: 500 },
    )
  }
}

export const POST = withApiProtection(handlePost)
export const DELETE = withApiProtection(handleDelete)
