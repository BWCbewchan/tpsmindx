import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const BUCKET_NAME = 'mindx-avatars'

async function ensureBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
  }
}

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
}

async function handleGet(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req)
    if (!auth.ok) return auth.response

    const searchParams = req.nextUrl.searchParams
    const teacherEmail = searchParams.get('email') || auth.sessionEmail

    const denied = rejectIfEmailNotSelf(
      auth.sessionEmail,
      auth.privileged,
      teacherEmail.trim().toLowerCase(),
    )
    if (denied) return denied

    const result = await pool.query(
      `SELECT teacher_email, avatar_url, avatar_storage_key, updated_at
       FROM teacher_avatars
       WHERE teacher_email = $1`,
      [teacherEmail],
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0] || null,
    })
  } catch (error) {
    console.error('Error fetching avatar:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Failed to fetch avatar', details: message },
      { status: 500 },
    )
  }
}

async function handlePost(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req)
    if (!auth.ok) return auth.response

    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('image')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File phải là hình ảnh' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Kích thước file tối đa 5MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await ensureBucket()
    const client = createSupabaseS3Client()

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const safeEmail = auth.sessionEmail.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `avatars/${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      }),
    )

    const url = makeProxyUrl(BUCKET_NAME, key)

    const result = await pool.query(
      `INSERT INTO teacher_avatars (teacher_email, avatar_url, avatar_storage_key, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (teacher_email)
       DO UPDATE SET avatar_url = EXCLUDED.avatar_url,
                     avatar_storage_key = EXCLUDED.avatar_storage_key,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING teacher_email, avatar_url, avatar_storage_key, updated_at`,
      [auth.sessionEmail, url, key],
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Failed to upload avatar', details: message },
      { status: 500 },
    )
  }
}

export const GET = withApiProtection(handleGet)
export const POST = withApiProtection(handlePost)
