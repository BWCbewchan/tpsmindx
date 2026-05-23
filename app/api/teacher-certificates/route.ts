import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/db-helpers'
import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'

export const dynamic = 'force-dynamic'

// GET: Lấy danh sách chứng chỉ của giáo viên
async function handleGet(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const teacherEmail = searchParams.get('email')

        if (!teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Teacher email is required' },
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to fetch certificates', details: errorMessage },
            { status: 500 }
        )
    }
}

// POST: Thêm chứng chỉ mới
async function handlePost(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const body = await req.json()
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

        // Validation
        if (!teacher_email || !certificate_name || !certificate_url) {
            return NextResponse.json(
                { success: false, error: 'Required fields: teacher_email, certificate_name, certificate_url' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            String(teacher_email).trim().toLowerCase(),
        )
        if (denied) return denied

        const result = await pool.query(
            `INSERT INTO teacher_certificates 
             (teacher_email, certificate_name, certificate_url, certificate_type, 
              issue_date, expiry_date, description, cloudinary_public_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                teacher_email,
                certificate_name,
                certificate_url,
                certificate_type || null,
                issue_date || null,
                expiry_date || null,
                description || null,
                cloudinary_public_id || null,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to add certificate', details: errorMessage },
            { status: 500 }
        )
    }
}

// DELETE: Xóa chứng chỉ
async function handleDelete(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const certificateId = searchParams.get('id')
        const teacherEmail = searchParams.get('email')

        if (!certificateId || !teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Certificate ID and teacher email are required' },
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to delete certificate', details: errorMessage },
            { status: 500 }
        )
    }
}

export const GET = withApiProtection(handleGet)
export const POST = withApiProtection(handlePost)
export const DELETE = withApiProtection(handleDelete)
