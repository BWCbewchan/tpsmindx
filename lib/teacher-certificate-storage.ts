import { createHash, randomUUID } from 'node:crypto'

export const TEACHER_CERTIFICATES_BUCKET = 'mindx-teacher-certificates'
export const TEACHER_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024

const CERTIFICATE_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CERTIFICATE_EXTENSION_PATTERN = '(?:pdf|jpe?g|png|webp)'
const CURRENT_CERTIFICATE_KEY_PATTERN = new RegExp(
  `^certificates/v2/[a-f0-9]{32}/\\d{10,17}-${UUID_PATTERN}\\.${CERTIFICATE_EXTENSION_PATTERN}$`,
  'i',
)
const LEGACY_CERTIFICATE_KEY_PATTERN = new RegExp(
  `^certificates/(?!v2/)[a-z0-9._-]{1,254}/\\d{10,17}-${UUID_PATTERN}\\.${CERTIFICATE_EXTENSION_PATTERN}$`,
  'i',
)

function normalizeTeacherCertificateEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function safeTeacherCertificateOwnerSegment(email: string): string {
  return normalizeTeacherCertificateEmail(email).replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function teacherCertificateOwnerHashSegment(email: string): string {
  return createHash('sha256').update(normalizeTeacherCertificateEmail(email)).digest('hex').slice(0, 32)
}

export function isAllowedTeacherCertificateContentType(contentType: string): boolean {
  return CERTIFICATE_CONTENT_TYPES.has(contentType.trim().toLowerCase())
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte)
}

export function hasAllowedTeacherCertificateSignature(
  buffer: Buffer,
  contentType: string,
): boolean {
  if (buffer.length === 0) return false

  switch (contentType.trim().toLowerCase()) {
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    case 'image/jpeg':
    case 'image/jpg':
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      )
    default:
      return false
  }
}

export function teacherCertificateExtensionForContentType(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType.trim().toLowerCase()] ?? 'bin'
}

export function buildTeacherCertificateKey(email: string, contentType: string): string {
  const owner = teacherCertificateOwnerHashSegment(email)
  const ext = teacherCertificateExtensionForContentType(contentType)
  return `certificates/v2/${owner}/${Date.now()}-${randomUUID()}.${ext}`
}

export function isCurrentTeacherCertificateKeyForEmail(key: string, email: string): boolean {
  const owner = teacherCertificateOwnerHashSegment(email)
  return CURRENT_CERTIFICATE_KEY_PATTERN.test(key) && key.startsWith(`certificates/v2/${owner}/`)
}

export function isTeacherCertificateKeyForEmail(key: string, email: string): boolean {
  const legacyOwner = safeTeacherCertificateOwnerSegment(email)
  return (
    isCurrentTeacherCertificateKeyForEmail(key, email) ||
    (LEGACY_CERTIFICATE_KEY_PATTERN.test(key) && key.startsWith(`certificates/${legacyOwner}/`))
  )
}

export function isSafeTeacherCertificateKey(key: string): boolean {
  return CURRENT_CERTIFICATE_KEY_PATTERN.test(key) || LEGACY_CERTIFICATE_KEY_PATTERN.test(key)
}

export function makeTeacherCertificateProxyUrl(key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(TEACHER_CERTIFICATES_BUCKET)}&key=${encodeURIComponent(key)}`
}
