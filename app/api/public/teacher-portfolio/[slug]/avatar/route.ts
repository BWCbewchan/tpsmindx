import { NextResponse } from 'next/server'

import pool from '@/lib/db'
import { getSignedObjectUrl, parsePublicUrl, parseStoragePath } from '@/lib/supabase-s3'

export const dynamic = 'force-dynamic'

function validStorageKey(value: string): boolean {
  return Boolean(value) && !value.includes('..') && !value.startsWith('/') && /\.(avif|gif|jpe?g|png|webp)$/i.test(value)
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
    `SELECT ta.avatar_url
     FROM teacher_portfolios p
     JOIN teachers t ON t.code = p.teacher_code
     JOIN LATERAL (
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
  if (!source || source.bucket !== 'mindx-avatars' || !validStorageKey(source.key)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const signedUrl = await getSignedObjectUrl(source.bucket, source.key, 10 * 60)
    const response = NextResponse.redirect(signedUrl, 307)
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
