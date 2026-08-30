import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/db-helpers'
import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import { requireSameOriginMutation } from '@/lib/api-security'
import { sanitizeText } from '@/lib/server-sanitize-html'
import {
    deleteObject,
    isSupabaseS3Configured,
    parsePublicUrl,
} from '@/lib/supabase-s3'
import {
    isCurrentTeacherCertificateKeyForEmail,
    isSafeTeacherCertificateKey,
    isTeacherCertificateKeyForEmail,
    makeTeacherCertificateProxyUrl,
    TEACHER_CERTIFICATES_BUCKET,
} from '@/lib/teacher-certificate-storage'

export const dynamic = 'force-dynamic'

const MAX_CERTIFICATE_NAME_LENGTH = 200
const MAX_CERTIFICATE_TYPE_LENGTH = 80
const MAX_CERTIFICATE_DESCRIPTION_LENGTH = 1000
const ALLOWED_CERTIFICATE_TYPES = new Set(['Language', 'Technology', 'Teaching', 'Other'])

function toSafeText(value: unknown, maxLength: number): string {
    return sanitizeText(String(value ?? '')).slice(0, maxLength)
}

function normalizeTeacherEmail(value: unknown): string {
    const text = String(value ?? '').trim().toLowerCase()
    if (!text || text.length > 254 || /[\u0000-\u001F\u007F]/.test(text)) return ''
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : ''
}

function normalizeOptionalDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
    const text = String(value ?? '').trim()
    if (!text) return { ok: true, value: null }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false }

    const [year, month, day] = text.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const isRealDate =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day

    return isRealDate ? { ok: true, value: text } : { ok: false }
}

function normalizeCertificateType(value: unknown): string | null {
    const type = toSafeText(value, MAX_CERTIFICATE_TYPE_LENGTH)
    if (!type) return 'Other'
    return ALLOWED_CERTIFICATE_TYPES.has(type) ? type : null
}

function parseTeacherCertificateStorageUrl(value: unknown): { bucket: string; key: string } | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null
    if (!raw.startsWith('/api/storage-image?')) return null

    try {
        const parsed = new URL(raw, 'http://localhost')
        if (parsed.pathname !== '/api/storage-image') return null
        const bucket = parsed.searchParams.get('bucket') || ''
        const key = parsed.searchParams.get('key') || ''
        if (!bucket || !key) return null
        return { bucket, key }
    } catch {
        return null
    }
}

function validateCertificateStorageUrl(
    value: unknown,
    teacherEmail: string,
    privileged: boolean,
): { ok: true; url: string; key: string } | { ok: false; error: string } {
    const raw = String(value ?? '').trim()
    const parsed = parseTeacherCertificateStorageUrl(raw)
    if (!parsed) {
        return { ok: false, error: 'certificate_url không hợp lệ' }
    }

    if (parsed.bucket !== TEACHER_CERTIFICATES_BUCKET || !isSafeTeacherCertificateKey(parsed.key)) {
        return { ok: false, error: 'certificate_url không thuộc kho chứng chỉ hợp lệ' }
    }

    if (!privileged && !isCurrentTeacherCertificateKeyForEmail(parsed.key, teacherEmail)) {
        return { ok: false, error: 'certificate_url không thuộc tài khoản hiện tại' }
    }

    return { ok: true, url: makeTeacherCertificateProxyUrl(parsed.key), key: parsed.key }
}

function normalizeCertificateStorageKey(
    value: unknown,
    teacherEmail: string,
    privileged: boolean,
    fallbackKey: string,
): string {
    const key = String(value ?? '').trim()
    if (
        key &&
        isSafeTeacherCertificateKey(key) &&
        (privileged || isCurrentTeacherCertificateKeyForEmail(key, teacherEmail))
    ) {
        return key
    }
    return fallbackKey
}

function certificateStorageKeyFromRow(row: any): string | null {
    const directKey = String(row?.cloudinary_public_id ?? '').trim()
    if (directKey && isSafeTeacherCertificateKey(directKey)) return directKey

    const parsed = parsePublicUrl(String(row?.certificate_url ?? ''))
    if (parsed?.bucket === TEACHER_CERTIFICATES_BUCKET && isSafeTeacherCertificateKey(parsed.key)) {
        return parsed.key
    }

    return null
}

async function deleteCertificateObjectSilently(row: any) {
    if (!isSupabaseS3Configured()) return
    const key = certificateStorageKeyFromRow(row)
    if (!key) return

    try {
        await deleteObject(TEACHER_CERTIFICATES_BUCKET, key)
    } catch (error) {
        console.error('Failed to delete teacher certificate object:', error)
    }
}

// GET: Lấy danh sách chứng chỉ của giáo viên
async function handleGet(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const teacherEmail = normalizeTeacherEmail(searchParams.get('email'))

        if (!teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Teacher email is required or invalid' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            teacherEmail.trim().toLowerCase(),
        )
        if (denied) return denied

        const result = await pool.query(
            `SELECT * FROM teacher_certificates 
             WHERE teacher_email = $1 
             ORDER BY created_at DESC`,
            [teacherEmail]
        )

        return NextResponse.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0,
                dbUnavailable: true,
            })
        }
        console.error('Error fetching certificates:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch certificates' },
            { status: 500 }
        )
    }
}

// POST: Thêm chứng chỉ mới
async function handlePost(req: NextRequest) {
    try {
        const csrfDenied = requireSameOriginMutation(req)
        if (csrfDenied) return csrfDenied

        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const body = await req.json().catch(() => null)
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Request body không hợp lệ' },
                { status: 400 },
            )
        }
        const {
            teacher_email,
            certificate_name,
            certificate_url,
            certificate_type,
            issue_date,
            expiry_date,
            description,
            cloudinary_public_id,
        } = body

        const teacherEmail = normalizeTeacherEmail(teacher_email)
        const certificateName = toSafeText(certificate_name, MAX_CERTIFICATE_NAME_LENGTH)
        const certificateType = normalizeCertificateType(certificate_type)
        const issueDate = normalizeOptionalDate(issue_date)
        const expiryDate = normalizeOptionalDate(expiry_date)

        if (!teacherEmail || !certificateName || !certificate_url) {
            return NextResponse.json(
                { success: false, error: 'Required fields: teacher_email, certificate_name, certificate_url' },
                { status: 400 }
            )
        }
        if (!certificateType) {
            return NextResponse.json(
                { success: false, error: 'certificate_type không hợp lệ' },
                { status: 400 },
            )
        }
        if (!issueDate.ok || !expiryDate.ok) {
            return NextResponse.json(
                { success: false, error: 'Ngày chứng chỉ không hợp lệ' },
                { status: 400 },
            )
        }
        if (issueDate.value && expiryDate.value && expiryDate.value < issueDate.value) {
            return NextResponse.json(
                { success: false, error: 'Ngày hết hạn phải sau ngày cấp' },
                { status: 400 },
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            teacherEmail,
        )
        if (denied) return denied

        const validatedUrl = validateCertificateStorageUrl(
            certificate_url,
            teacherEmail,
            auth.privileged,
        )
        if (!validatedUrl.ok) {
            return NextResponse.json(
                { success: false, error: validatedUrl.error },
                { status: 400 },
            )
        }

        const result = await pool.query(
            `INSERT INTO teacher_certificates 
             (teacher_email, certificate_name, certificate_url, certificate_type, 
              issue_date, expiry_date, description, cloudinary_public_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                teacherEmail,
                certificateName,
                validatedUrl.url,
                certificateType,
                issueDate.value,
                expiryDate.value,
                toSafeText(description, MAX_CERTIFICATE_DESCRIPTION_LENGTH) || null,
                normalizeCertificateStorageKey(
                    cloudinary_public_id,
                    teacherEmail,
                    auth.privileged,
                    validatedUrl.key,
                ),
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'Certificate added successfully',
            data: result.rows[0],
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database tạm thời quá tải hoặc không kết nối được',
                    dbUnavailable: true,
                },
                { status: 503 }
            )
        }
        console.error('Error adding certificate:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to add certificate' },
            { status: 500 }
        )
    }
}

// DELETE: Xóa chứng chỉ
async function handleDelete(req: NextRequest) {
    try {
        const csrfDenied = requireSameOriginMutation(req)
        if (csrfDenied) return csrfDenied

        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const certificateId = searchParams.get('id')
        const teacherEmail = normalizeTeacherEmail(searchParams.get('email'))

        if (!certificateId || !/^\d+$/.test(certificateId) || !teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Certificate ID and teacher email are required or invalid' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            teacherEmail.trim().toLowerCase(),
        )
        if (denied) return denied

        // Verify ownership before delete
        const result = await pool.query(
            `DELETE FROM teacher_certificates 
             WHERE id = $1 AND teacher_email = $2
             RETURNING *`,
            [certificateId, teacherEmail]
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Certificate not found or unauthorized' },
                { status: 404 }
            )
        }

        await deleteCertificateObjectSilently(result.rows[0])

        return NextResponse.json({
            success: true,
            message: 'Certificate deleted successfully',
            data: result.rows[0],
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database tạm thời quá tải hoặc không kết nối được',
                    dbUnavailable: true,
                },
                { status: 503 }
            )
        }
        console.error('Error deleting certificate:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete certificate' },
            { status: 500 }
        )
    }
}

export const GET = withApiProtection(handleGet)
export const POST = withApiProtection(handlePost)
export const DELETE = withApiProtection(handleDelete)
