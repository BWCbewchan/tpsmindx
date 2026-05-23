import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createSupabaseS3Client, deleteObject, isSupabaseS3Configured, parsePublicUrl } from '@/lib/supabase-s3';
import { normalizeStorageUrl } from '@/lib/storage-url';

export const QUESTION_IMAGE_BUCKET = 'mindx-question-images';
export const MAX_QUESTION_IMAGE_BYTES = 10 * 1024 * 1024;

const DATA_IMAGE_SRC_RE = /\bsrc\s*=\s*(["'])(data:image\/[^;]+;base64,[^"']+)\1/gi;
const BLOB_IMAGE_TAG_RE = /<img\b[^>]*\bsrc\s*=\s*(["'])blob:[^"']*\1[^>]*>/gi;
const SRC_RE = /\bsrc\s*=\s*(["'])([^"']+)\1/gi;

export function makeQuestionImageProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

export async function ensureQuestionImageBucket(): Promise<void> {
  if (!isSupabaseS3Configured()) {
    throw new Error('Supabase S3 storage is not configured');
  }

  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: QUESTION_IMAGE_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: QUESTION_IMAGE_BUCKET }));
  }
}

function extensionFromContentType(contentType: string): string {
  const subtype = contentType.split('/')[1]?.toLowerCase().split(';')[0] || 'png';
  if (subtype === 'jpeg' || subtype === 'pjpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  return subtype.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png';
}

function extensionFromFileName(fileName: string | undefined, contentType: string): string {
  const ext = fileName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ext && ext.length <= 8) return ext;
  return extensionFromContentType(contentType);
}

export async function uploadQuestionImageBuffer(
  buffer: Buffer,
  contentType = 'image/png',
  originalName?: string,
): Promise<{ url: string; key: string; storagePath: string }> {
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image files are supported');
  }
  if (buffer.length > MAX_QUESTION_IMAGE_BYTES) {
    throw new Error('Image size must not exceed 10MB');
  }

  await ensureQuestionImageBucket();

  const client = createSupabaseS3Client();
  const ext = extensionFromFileName(originalName, contentType);
  const key = `question-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: QUESTION_IMAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return {
    url: makeQuestionImageProxyUrl(QUESTION_IMAGE_BUCKET, key),
    key,
    storagePath: `s3://${QUESTION_IMAGE_BUCKET}/${key}`,
  };
}

async function persistDataImageSource(src: string): Promise<string> {
  const match = src.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/i);
  if (!match) return src;

  const contentType = match[1];
  const base64 = match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64, 'base64');
  const uploaded = await uploadQuestionImageBuffer(buffer, contentType);
  return uploaded.url;
}

export async function persistEmbeddedQuestionImages(value: unknown): Promise<unknown> {
  if (typeof value !== 'string' || !value) return value;

  let html = value.replace(BLOB_IMAGE_TAG_RE, '');
  const matches = Array.from(html.matchAll(DATA_IMAGE_SRC_RE));
  if (matches.length === 0) return html;

  const uploadedBySource = new Map<string, string>();
  for (const match of matches) {
    const dataSrc = match[2];
    if (!uploadedBySource.has(dataSrc)) {
      uploadedBySource.set(dataSrc, await persistDataImageSource(dataSrc));
    }
  }

  for (const match of matches) {
    const quote = match[1];
    const dataSrc = match[2];
    const uploaded = uploadedBySource.get(dataSrc);
    if (uploaded) {
      html = html.replace(match[0], `src=${quote}${uploaded}${quote}`);
    }
  }

  return html;
}

export async function persistQuestionImageUrl(value: unknown): Promise<string | null> {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return null;
  if (trimmed.startsWith('data:image/')) return persistDataImageSource(trimmed);
  return normalizeStorageUrl(trimmed);
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractImageUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  return Array.from(html.matchAll(SRC_RE)).map((match) => decodeHtmlAttribute(match[2]));
}

export function extractQuestionImageUrls(...values: unknown[]): string[] {
  const urls: string[] = [];

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'string') return;

    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/api/storage-image') || trimmed.startsWith('http') || trimmed.startsWith('s3://')) {
      urls.push(normalizeStorageUrl(trimmed));
    }
    extractImageUrlsFromHtml(trimmed).forEach((url) => urls.push(normalizeStorageUrl(url)));
  };

  values.forEach(visit);
  return Array.from(new Set(urls));
}

export function deleteQuestionImageSilently(url: string | null | undefined): void {
  if (!url) return;
  const parsed = parsePublicUrl(normalizeStorageUrl(url));
  if (!parsed) return;
  deleteObject(parsed.bucket, parsed.key).catch((err) => {
    console.error(`[Question Image Cleanup] Failed to delete ${url}:`, err);
  });
}

export function deleteQuestionImagesSilently(values: unknown[]): void {
  extractQuestionImageUrls(...values).forEach(deleteQuestionImageSilently);
}

export function deleteRemovedQuestionImagesSilently(oldValues: unknown[], newValues: unknown[]): void {
  const nextUrls = new Set(extractQuestionImageUrls(...newValues));
  extractQuestionImageUrls(...oldValues).forEach((url) => {
    if (!nextUrls.has(url)) deleteQuestionImageSilently(url);
  });
}
