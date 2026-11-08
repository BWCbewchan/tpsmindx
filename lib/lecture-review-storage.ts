import crypto from 'crypto'

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import {
  createSupabaseS3Client,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3'

export const LECTURE_REVIEW_BUCKET =
  process.env.LECTURE_REVIEW_BUCKET || 'lecture-review-materials'
export const LECTURE_REVIEW_MAX_FILE_BYTES = 100 * 1024 * 1024

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.ppt': [
    'application/vnd.ms-powerpoint',
    'application/octet-stream',
  ],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/octet-stream',
  ],
  '.odp': [
    'application/vnd.oasis.opendocument.presentation',
    'application/zip',
    'application/octet-stream',
  ],
}

function fileExtension(fileName: string): string {
  const match = /\.[a-z0-9]+$/i.exec(fileName.trim())
  return match ? match[0].toLowerCase() : ''
}

export function isAllowedLectureReviewFile(file: File): boolean {
  return isAllowedLectureReviewFileDescriptor(file.name, file.type)
}

export function isAllowedLectureReviewFileDescriptor(
  fileName: string,
  rawContentType: string,
): boolean {
  const extension = fileExtension(fileName)
  const allowedContentTypes = ALLOWED_FILE_TYPES[extension]
  if (!allowedContentTypes) return false
  const contentType = rawContentType.trim().toLowerCase()
  return !contentType || allowedContentTypes.includes(contentType)
}

export function hasAllowedLectureReviewSignature(
  buffer: Buffer,
  fileName: string,
): boolean {
  const extension = fileExtension(fileName)
  if (extension === '.pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }
  if (extension === '.ppt') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    )
  }
  if (extension === '.pptx' || extension === '.odp') {
    return buffer[0] === 0x50 && buffer[1] === 0x4b
  }
  return false
}

function safeFileName(fileName: string): string {
  const extension = fileExtension(fileName)
  const stem = fileName
    .slice(0, extension ? -extension.length : undefined)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
  return `${stem || 'slide-duyet-giang'}${extension}`
}

export async function ensureLectureReviewBucket(): Promise<void> {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: LECTURE_REVIEW_BUCKET }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: LECTURE_REVIEW_BUCKET }))
  }
}

export function buildLectureReviewFileKey(fileName: string): string {
  const now = new Date()
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${safeFileName(fileName)}`
}

export async function createLectureReviewUploadUrl({
  fileName,
  contentType,
  ownerEmail,
}: {
  fileName: string
  contentType: string
  ownerEmail: string
}): Promise<{
  uploadUrl: string
  bucket: string
  key: string
  headers: Record<string, string>
}> {
  if (!isSupabaseS3Configured()) {
    throw new Error('Chưa cấu hình Supabase S3 Storage')
  }
  const normalizedContentType = contentType || 'application/octet-stream'
  const key = buildLectureReviewFileKey(fileName)
  const contentDisposition = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
  const metadata = {
    owner: ownerEmail,
    feature: 'lecture-review-registration',
  }

  await ensureLectureReviewBucket()
  const client = createSupabaseS3Client()
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: LECTURE_REVIEW_BUCKET,
      Key: key,
      ContentType: normalizedContentType,
      ContentDisposition: contentDisposition,
      Metadata: metadata,
    }),
    { expiresIn: 15 * 60 },
  )

  return {
    uploadUrl,
    bucket: LECTURE_REVIEW_BUCKET,
    key,
    headers: {
      'Content-Type': normalizedContentType,
      'Content-Disposition': contentDisposition,
      'x-amz-meta-owner': ownerEmail,
      'x-amz-meta-feature': metadata.feature,
    },
  }
}

export async function validateLectureReviewUpload({
  bucket,
  key,
  fileName,
  contentType,
  fileSize,
  ownerEmail,
}: {
  bucket: string
  key: string
  fileName: string
  contentType: string
  fileSize: number
  ownerEmail: string
}): Promise<void> {
  if (bucket !== LECTURE_REVIEW_BUCKET) {
    throw new Error('Bucket tài liệu duyệt giảng không hợp lệ')
  }
  if (!/^\d{4}\/\d{2}\/[a-f0-9-]+-[a-zA-Z0-9_.-]+$/.test(key)) {
    throw new Error('Đường dẫn tài liệu duyệt giảng không hợp lệ')
  }
  if (!isAllowedLectureReviewFileDescriptor(fileName, contentType)) {
    throw new Error('Định dạng tài liệu duyệt giảng không hợp lệ')
  }

  const client = createSupabaseS3Client()
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )
  if (Number(head.ContentLength || 0) !== fileSize) {
    throw new Error('Kích thước tài liệu tải lên không khớp')
  }
  if (String(head.Metadata?.owner || '').toLowerCase() !== ownerEmail.toLowerCase()) {
    throw new Error('Tài liệu tải lên không thuộc phiên đăng nhập hiện tại')
  }
  if (String(head.Metadata?.feature || '') !== 'lecture-review-registration') {
    throw new Error('Nguồn tài liệu tải lên không hợp lệ')
  }

  const signatureObject = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-7' }),
  )
  const signatureBytes = signatureObject.Body
    ? Buffer.from(await signatureObject.Body.transformToByteArray())
    : Buffer.alloc(0)
  if (!hasAllowedLectureReviewSignature(signatureBytes, fileName)) {
    throw new Error('Nội dung file không đúng định dạng PDF, PPT, PPTX hoặc ODP')
  }
}

export async function uploadLectureReviewFile(
  file: File,
  ownerEmail: string,
): Promise<{
  bucket: string
  key: string
  fileName: string
  contentType: string
  fileSize: number
}> {
  if (!isSupabaseS3Configured()) {
    throw new Error('Chưa cấu hình Supabase S3 Storage')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!hasAllowedLectureReviewSignature(buffer, file.name)) {
    throw new Error('Nội dung file không đúng định dạng PDF, PPT, PPTX hoặc ODP')
  }

  const key = buildLectureReviewFileKey(file.name)
  const contentType = file.type || 'application/octet-stream'

  await ensureLectureReviewBucket()
  const client = createSupabaseS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: LECTURE_REVIEW_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      Metadata: {
        owner: ownerEmail,
        feature: 'lecture-review-registration',
      },
    }),
  )

  return {
    bucket: LECTURE_REVIEW_BUCKET,
    key,
    fileName: file.name,
    contentType,
    fileSize: file.size,
  }
}
