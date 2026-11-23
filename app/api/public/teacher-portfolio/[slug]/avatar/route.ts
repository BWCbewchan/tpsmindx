import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

import pool from '@/lib/db'
import { createSupabaseS3Client, parsePublicUrl, parseStoragePath } from '@/lib/supabase-s3'

export const dynamic = 'force-dynamic'

function validStorageKey(value: string): boolean {
  return Boolean(value) && !value.includes('..') && !value.startsWith('/') && /\.(avif|gif|jpe?g|png|webp)$/i.test(value)
}

function imageContentType(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase()
  if (extension === 'avif') return 'image/avif'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  let decodedSlug = ''
  try {
    decodedSlug = decodeURIComponent(slug).trim()
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!decodedSlug || decodedSlug.length > 180) return new NextResponse('Not found', { status: 404 })

  const result = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(p.portrait_url), ''), ta.avatar_url) AS avatar_url
     FROM teacher_portfolios p
     JOIN teachers t ON t.code = p.teacher_code
     LEFT JOIN LATERAL (
       SELECT avatar_url
       FROM teacher_avatars
       WHERE LOWER(TRIM(teacher_email)) = ANY(ARRAY[
         LOWER(TRIM(COALESCE(t.work_email, ''))),
         LOWER(TRIM(COALESCE(t."Work email", ''))),
         LOWER(TRIM(COALESCE(t.personal_email, '')))
       ])
         AND NULLIF(TRIM(avatar_url), '') IS NOT NULL
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1
     ) ta ON TRUE
     WHERE p.public_slug = $1
       AND p.status = 'published'
     LIMIT 1`,
    [decodedSlug],
  )
  const avatarUrl = String(result.rows[0]?.avatar_url ?? '').trim()
  if (!avatarUrl) return new NextResponse('Not found', { status: 404 })

  const source = parsePublicUrl(avatarUrl) ?? parseStoragePath(avatarUrl)
  if (
    !source ||
    !['mindx-avatars', 'mindx-teacher-portfolios'].includes(source.bucket) ||
    !validStorageKey(source.key)
  ) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const object = await createSupabaseS3Client().send(
      new GetObjectCommand({ Bucket: source.bucket, Key: source.key }),
      { abortSignal: _request.signal },
    )
    if (!object.Body) return new NextResponse('Not found', { status: 404 })

    const headers = new Headers({
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
      'Content-Type': object.ContentType || imageContentType(source.key),
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    })
    if (object.ContentLength != null) headers.set('Content-Length', String(object.ContentLength))
    if (object.ETag) headers.set('ETag', object.ETag)

    return new NextResponse(object.Body.transformToWebStream(), { headers })
  } catch (error: any) {
    if (
      error?.name === 'AbortError' ||
      error?.name === 'RequestAbortedError' ||
      error?.code === 'ERR_ABORTED'
    ) {
      return new NextResponse(null, { status: 499 })
    }
    return new NextResponse('Not found', { status: 404 })
  }
}
