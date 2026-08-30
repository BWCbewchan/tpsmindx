import { randomUUID } from 'crypto';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';

export const TRUYENTHONG_CONTENT_IMAGE_BUCKET = 'mindx-posts-content';
export const TRUYENTHONG_THUMBNAIL_BUCKET = 'mindx-thumbnails';
export const MAX_TRUYENTHONG_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TRUYENTHONG_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function makeTruyenThongImageProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

async function ensureBucket(bucket: string): Promise<void> {
  if (!isSupabaseS3Configured()) {
    throw new Error('Supabase S3 storage is not configured');
  }

  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

function normalizeContentType(contentType: string): string {
  return contentType.trim().toLowerCase();
}

export function isAllowedTruyenThongImageContentType(contentType: string): boolean {
  return ALLOWED_TRUYENTHONG_IMAGE_TYPES.has(normalizeContentType(contentType));
}

export function isSafeTruyenThongImageKey(key: string): boolean {
  return (
    /^(?:post-images|thumbnails)\/[0-9]{10,17}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:gif|jpe?g|png|webp)$/i.test(key) &&
    !key.includes('..') &&
    !key.startsWith('/')
  );
}

export function isSafeLegacyTruyenThongImageKey(key: string): boolean {
  return (
    /^(?:post-images|thumbnails)\/[0-9]{10,17}-[a-z0-9_-]{6,80}\.(?:gif|jpe?g|png|webp)$/i.test(key) &&
    !key.includes('..') &&
    !key.startsWith('/')
  );
}

export function isSafeTruyenThongMediaStorageKey(key: string): boolean {
  return isSafeTruyenThongImageKey(key) || isSafeLegacyTruyenThongImageKey(key);
}

function extensionFromContentType(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[normalizeContentType(contentType)] ?? 'png';
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function hasAllowedTruyenThongImageSignature(
  buffer: Buffer,
  contentType: string,
): boolean {
  if (buffer.length === 0) return false;

  switch (normalizeContentType(contentType)) {
    case 'image/jpeg':
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'image/gif':
      return (
        buffer.length >= 6 &&
        ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
      );
    default:
      return false;
  }
}

export async function uploadTruyenThongImageBuffer({
  bucket,
  keyPrefix,
  buffer,
  contentType,
}: {
  bucket: string;
  keyPrefix: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ url: string; key: string; storagePath: string; bucket: string }> {
  const safeContentType = normalizeContentType(contentType);
  if (!isAllowedTruyenThongImageContentType(safeContentType)) {
    throw new Error('Only image files are supported');
  }
  if (buffer.length > MAX_TRUYENTHONG_IMAGE_BYTES) {
    throw new Error('Image size must not exceed 10MB');
  }
  if (!hasAllowedTruyenThongImageSignature(buffer, safeContentType)) {
    throw new Error('Image content does not match its declared type');
  }

  await ensureBucket(bucket);

  const client = createSupabaseS3Client();
  const ext = extensionFromContentType(safeContentType);
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, '') || 'images';
  const key = `${normalizedPrefix}/${Date.now()}-${randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: safeContentType,
    }),
  );

  return {
    url: makeTruyenThongImageProxyUrl(bucket, key),
    key,
    storagePath: `s3://${bucket}/${key}`,
    bucket,
  };
}
