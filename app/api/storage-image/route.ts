/**
 * Proxy API để serve ảnh/video từ Supabase S3 private buckets.
 * Dùng khi bucket chưa được set public.
 *
 * Usage: /api/storage-image?bucket=mindx-thumbnails&key=thumbnails/xxx.png
 *
 * Cũng hỗ trợ parse Supabase public URL format:
 * /api/storage-image?url=https://xxx.supabase.co/storage/v1/object/public/bucket/key
 *
 * Hỗ trợ HTTP Range Requests để video streaming hoạt động đúng.
 */
import { requireBearerSession } from '@/lib/datasource-api-auth';
import {
  TPS_SESSION_COOKIE,
  verifySessionCookieValue,
} from '@/lib/session-cookie';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

/** Cho phép đọc ẩn danh (vd. <img> trang công khai) — bucket còn lại cần phiên đăng nhập. */
const ANONYMOUS_READ_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
  'mindx-videos',
  'mindx-question-images',
]);

async function isAuthenticatedRequest(request: NextRequest): Promise<boolean> {
  const auth = await requireBearerSession(request);
  if (auth.ok) return true;
  const raw = request.cookies.get(TPS_SESSION_COOKIE)?.value;
  if (!raw) return false;
  return (await verifySessionCookieValue(raw)) !== null;
}

export async function GET(request: NextRequest) {
  let bucket: string | null = null;
  let key: string | null = null;

  try {
    if (!isSupabaseS3Configured()) {
      return new NextResponse('Storage not configured', { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    bucket = searchParams.get('bucket');
    key = searchParams.get('key');

    // Hỗ trợ parse từ Supabase public URL
    const rawUrl = searchParams.get('url');
    if (rawUrl && (!bucket || !key)) {
      const match = rawUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (match) {
        bucket = match[1];
        key = match[2];
      }
    }

    if (!bucket || !key) {
      return new NextResponse('Missing bucket or key', { status: 400 });
    }

    if (
      !ANONYMOUS_READ_BUCKETS.has(bucket) &&
      !(await isAuthenticatedRequest(request))
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const isVideo = key.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
    const rangeHeader = request.headers.get('range');

    const client = createSupabaseS3Client();

    // Với video + range request: forward range header tới S3
    const getObjectParams: any = { Bucket: bucket, Key: key };
    if (isVideo && rangeHeader) {
      getObjectParams.Range = rangeHeader;
    }

    const result = await client.send(new GetObjectCommand(getObjectParams));

    if (!result.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    const contentType = result.ContentType || (isVideo ? 'video/mp4' : 'application/octet-stream');
    const contentLength = result.ContentLength;
    const contentRange = result.ContentRange;

    // Stream body trực tiếp thay vì buffer toàn bộ vào memory
    const stream = result.Body.transformToWebStream();

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': isVideo
        ? 'public, max-age=3600, s-maxage=3600'
        : 'public, max-age=604800, s-maxage=86400',
    };

    if (contentLength != null) {
      headers['Content-Length'] = String(contentLength);
    }

    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }

    // 206 Partial Content khi có range, 200 khi full
    const status = isVideo && rangeHeader && contentRange ? 206 : 200;

    return new NextResponse(stream, { status, headers });
  } catch (error: any) {
    // S3 trả về 416 nếu range không hợp lệ
    if (error?.name === 'InvalidRange' || error?.$metadata?.httpStatusCode === 416) {
      return new NextResponse('Range Not Satisfiable', { status: 416 });
    }

    // File không tồn tại trong S3 → trả về placeholder SVG thay vì 404 trắng
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      console.warn(`[storage-proxy] NoSuchKey: ${bucket}/${key}`);
      const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f3f4f6"/>
        <text x="200" y="140" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9ca3af">Ảnh không tồn tại</text>
        <text x="200" y="165" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#d1d5db">${key?.split('/').pop() ?? ''}</text>
      </svg>`;
      return new NextResponse(placeholder, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store',
        },
      });
    }

    console.error('Storage proxy error:', error);
    return new NextResponse('Not found', { status: 404 });
  }
}
