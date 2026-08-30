import { requireCandidateSession } from '@/lib/candidate-session';
import pool from '@/lib/db';
import { isDatabaseUnavailableError } from '@/lib/db-helpers';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import {
  createSupabaseS3Client,
  getPublicObjectUrl,
  getSignedObjectUrl,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3';
import {
  isSafeTeacherCertificateKey,
  makeTeacherCertificateProxyUrl,
  TEACHER_CERTIFICATES_BUCKET,
} from '@/lib/teacher-certificate-storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ANONYMOUS_READ_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
]);
const AUTHENTICATED_READ_BUCKETS = new Set([
  'mindx-avatars',
  'mindx-question-images',
  'mindx-videos',
]);
const ANONYMOUS_READ_PREFIXES = new Map<string, string[]>([
  ['mindx-avatars', ['avatars/honors-top', 'honors-monthly/']],
]);
const STREAM_BY_DEFAULT_IMAGE_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
  'mindx-avatars',
]);
const SIGNED_REDIRECT_BUCKET_TTLS = new Map<string, number>([
  ['mindx-posts-content', 12 * 60 * 60],
  ['mindx-thumbnails', 12 * 60 * 60],
  ['mindx-question-images', 60 * 60],
  ['mindx-videos', 30 * 60],
]);
const DEFAULT_SIGNED_REDIRECT_TTL = 15 * 60;

function isAnonymousReadObject(bucket: string, key: string): boolean {
  if (ANONYMOUS_READ_BUCKETS.has(bucket)) return true;
  return ANONYMOUS_READ_PREFIXES.get(bucket)?.some((prefix) => key.startsWith(prefix)) ?? false;
}

function parseStorageUrl(rawUrl: string): { bucket: string; key: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
    );
    if (!match) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      key: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function isSafeObjectKey(key: string): boolean {
  return Boolean(key) && !key.includes('..') && !key.startsWith('/');
}

function isSafeBucketName(bucket: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(bucket);
}

function isImageObjectKey(key: string): boolean {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(key);
}

function shouldStreamObjectByDefault(bucket: string, key: string): boolean {
  return (
    STREAM_BY_DEFAULT_IMAGE_BUCKETS.has(bucket) &&
    isAnonymousReadObject(bucket, key) &&
    isImageObjectKey(key)
  );
}

function redirectToObjectUrl(url: string, bucket: string, key: string, ttlSeconds?: number) {
  const isAnonymousObject = isAnonymousReadObject(bucket, key);
  const sharedMaxAge = ttlSeconds
    ? Math.max(60, ttlSeconds - 5 * 60)
    : 7 * 24 * 60 * 60;
  const response = NextResponse.redirect(url, 307);
  response.headers.set(
    'Cache-Control',
    isAnonymousObject
      ? `public, max-age=${sharedMaxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=300`
      : 'private, max-age=300',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

async function hasTeacherCertificateDbAccess(email: string, key: string): Promise<boolean> {
  const canonicalUrl = makeTeacherCertificateProxyUrl(key);
  const result = await pool.query(
    `SELECT 1
     FROM teacher_certificates
     WHERE lower(trim(teacher_email)) = $1
       AND (
         cloudinary_public_id = $2
         OR certificate_url = $3
       )
     LIMIT 1`,
    [email.trim().toLowerCase(), key, canonicalUrl],
  );
  return result.rows.length > 0;
}

async function requireReadAccess(
  request: NextRequest,
  bucket: string,
  key: string,
): Promise<NextResponse | null> {
  if (isAnonymousReadObject(bucket, key)) return null;

  if (bucket === TEACHER_CERTIFICATES_BUCKET) {
    if (!isSafeTeacherCertificateKey(key)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;
    if (auth.privileged) {
      return null;
    }

    try {
      if (await hasTeacherCertificateDbAccess(auth.sessionEmail, key)) {
        return null;
      }
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return new NextResponse('Storage temporarily unavailable', { status: 503 });
      }
      throw error;
    }

    return new NextResponse('Forbidden', { status: 403 });
  }

  if (bucket === 'mindx-candidate-harvest') {
    const candidateAuth = await requireCandidateSession(request);
    if (!candidateAuth.ok) return candidateAuth.response;
    if (!key.startsWith(`harvest/${candidateAuth.candidateId}/`)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    return null;
  }

  if (!AUTHENTICATED_READ_BUCKETS.has(bucket)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;
  return null;
}

function teacherCertificateContentTypeForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function teacherCertificateFilenameForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') {
    return `certificate.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'certificate.bin';
}

export async function GET(request: NextRequest) {
  let bucket: string | null = null;
  let key: string | null = null;

  try {
    const rl = await rateLimitOr429Async(`storage-image:${clientIpFromRequest(request)}`, 300, 60_000);
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    bucket = searchParams.get('bucket');
    key = searchParams.get('key');

    const rawUrl = searchParams.get('url');
    if (rawUrl && (!bucket || !key)) {
      const parsed = parseStorageUrl(rawUrl);
      if (parsed) {
        bucket = parsed.bucket;
        key = parsed.key;
      }
    }

    if (!bucket || !key || !isSafeBucketName(bucket) || !isSafeObjectKey(key)) {
      return new NextResponse('Missing or invalid bucket/key', { status: 400 });
    }

    const denied = await requireReadAccess(request, bucket, key);
    if (denied) return denied;

    if (!isSupabaseS3Configured()) {
      if (isAnonymousReadObject(bucket, key)) {
        return redirectToObjectUrl(getPublicObjectUrl(bucket, key), bucket, key);
      }
      return new NextResponse('Storage not configured', { status: 500 });
    }

    const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(key);
    // Keep legacy proxy=1 URLs working, but stream public images by default.
    // This avoids browsers caching old signed redirects while still keeping a
    // redirect escape hatch via redirect=1 for diagnostics.
    // Force proxy streaming for videos to avoid Range request/seeking issues over 307 redirects.
    const forceStream =
      searchParams.get('stream') === '1' ||
      bucket === TEACHER_CERTIFICATES_BUCKET ||
      isVideo ||
      (searchParams.get('redirect') !== '1' && shouldStreamObjectByDefault(bucket, key));
    if (!forceStream) {
      const signedRedirectTtl =
        SIGNED_REDIRECT_BUCKET_TTLS.get(bucket) ?? DEFAULT_SIGNED_REDIRECT_TTL;
      try {
        const objectUrl = await getSignedObjectUrl(bucket, key, signedRedirectTtl);
        return redirectToObjectUrl(objectUrl, bucket, key, signedRedirectTtl);
      } catch (error: any) {
        console.warn('[storage-proxy] direct redirect failed, fallback to proxy stream:', error?.message || error);
      }
    }

    const rangeHeader = request.headers.get('range');
    const client = createSupabaseS3Client();
    const getObjectParams: any = { Bucket: bucket, Key: key };
    if (isVideo && rangeHeader) {
      getObjectParams.Range = rangeHeader;
    }

    const result = await client.send(
      new GetObjectCommand(getObjectParams),
      // Abort the S3 download if the browser closes the connection
      // (e.g., during video seeking or page navigation).
      { abortSignal: request.signal },
    );
    if (!result.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    const stream = result.Body.transformToWebStream();
    const isTeacherCertificate = bucket === TEACHER_CERTIFICATES_BUCKET;
    const headers: Record<string, string> = {
      'Content-Type': isTeacherCertificate
        ? teacherCertificateContentTypeForKey(key)
        : result.ContentType || (isVideo ? 'video/mp4' : 'application/octet-stream'),
      'Accept-Ranges': 'bytes',
      'Cache-Control': isTeacherCertificate
        ? 'private, no-store'
        : isAnonymousReadObject(bucket, key)
        ? 'public, max-age=604800, s-maxage=86400'
        : 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };
    if (isTeacherCertificate) {
      headers['Content-Disposition'] = `inline; filename="${teacherCertificateFilenameForKey(key)}"`;
      headers['Content-Security-Policy'] = 'sandbox';
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';
      headers['Referrer-Policy'] = 'no-referrer';
      headers.Vary = 'Authorization, Cookie';
    }

    if (result.ContentLength != null) {
      headers['Content-Length'] = String(result.ContentLength);
    }
    if (result.ContentRange) {
      headers['Content-Range'] = result.ContentRange;
    }

    return new NextResponse(stream, {
      status: isVideo && rangeHeader && result.ContentRange ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    // Client disconnected (e.g., video seek, page navigation) — silent, not an error.
    if (
      error?.name === 'AbortError' ||
      error?.name === 'RequestAbortedError' ||
      error?.code === 'ERR_ABORTED'
    ) {
      return new NextResponse(null, { status: 499 });
    }
    if (error?.name === 'InvalidRange' || error?.$metadata?.httpStatusCode === 416) {
      return new NextResponse('Range Not Satisfiable', { status: 416 });
    }
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      console.warn(`[storage-proxy] NoSuchKey: ${bucket}/${key}`);
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      });
    }

    console.error('Storage proxy error:', error?.message || error);
    return new NextResponse('Not found', { status: 404 });
  }
}
