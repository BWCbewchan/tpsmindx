/**
 * Admin Storage Manager — thay thế Cloudinary Manager.
 * List và xóa objects trong các Supabase S3 buckets.
 */
import { requireBearerAdminOrSuper } from '@/lib/auth-server';
import {
  createSupabaseS3Client,
  getPublicObjectUrl,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const KNOWN_BUCKETS = [
  'mindx-videos',
  'mindx-thumbnails',
  'mindx-posts-content',
  'mindx-question-images',
  'feedback-images',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuper(request);
    if (!gate.ok) return gate.response;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || '';
    const prefix = (searchParams.get('prefix') || '').trim();
    const maxResults = Math.min(100, parseInt(searchParams.get('max_results') || '30', 10));
    const continuationToken = searchParams.get('next_cursor') || undefined;

    const client = createSupabaseS3Client();

    // Nếu không chỉ định bucket, list tất cả buckets đã biết
    if (!bucket) {
      return NextResponse.json({
        success: true,
        buckets: KNOWN_BUCKETS,
      });
    }

    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        MaxKeys: maxResults,
        ContinuationToken: continuationToken,
      })
    );

    const objects = (result.Contents || []).map((obj) => {
      const key = obj.Key || '';
      const url = getPublicObjectUrl(bucket, key);
      const ext = key.split('.').pop()?.toLowerCase() || '';
      const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext);
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

      return {
        // Giữ tương thích với CloudinaryResource interface ở frontend
        asset_id: key,
        public_id: key,
        resource_type: isVideo ? 'video' : isImage ? 'image' : 'raw',
        format: ext,
        bytes: obj.Size || 0,
        secure_url: url,
        created_at: obj.LastModified?.toISOString() || new Date().toISOString(),
        // S3-specific
        key,
        bucket,
        etag: obj.ETag,
      };
    });

    return NextResponse.json({
      success: true,
      data: objects,
      next_cursor: result.NextContinuationToken || null,
      total_count: objects.length,
    });
  } catch (error: any) {
    console.error('S3 list error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể lấy danh sách files' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuper(request);
    if (!gate.ok) return gate.response;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 }
      );
    }

    const body = await request.json();
    // Hỗ trợ cả format cũ (public_id) và format mới (key + bucket)
    const key = String(body?.key || body?.public_id || '').trim();
    const bucket = String(body?.bucket || '').trim() || inferBucketFromKey(key);

    if (!key) {
      return NextResponse.json({ success: false, error: 'key là bắt buộc' }, { status: 400 });
    }
    if (!bucket) {
      return NextResponse.json({ success: false, error: 'bucket là bắt buộc' }, { status: 400 });
    }

    const client = createSupabaseS3Client();

    // Retry với exponential backoff
    const maxAttempts = 3;
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        return NextResponse.json({ success: true, data: { result: 'ok' } });
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) await sleep(300 * attempt);
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error('S3 delete error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể xóa file' },
      { status: 500 }
    );
  }
}

/**
 * Suy ra bucket từ key path (dùng khi client cũ không gửi bucket).
 */
function inferBucketFromKey(key: string): string {
  if (key.startsWith('videos/')) return 'mindx-videos';
  if (key.startsWith('thumbnails/')) return 'mindx-thumbnails';
  if (key.startsWith('post-images/')) return 'mindx-posts-content';
  if (key.startsWith('question-images/')) return 'mindx-question-images';
  if (key.startsWith('feedback/')) return 'feedback-images';
  return '';
}
