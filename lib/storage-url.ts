import { normalizePublicImageUrl } from './public-image-url';
/**
 * Normalize storage URLs through the authenticated storage endpoint.
 *
 * The endpoint normally responds with a short-lived signed redirect so large
 * image/video bodies do not pass through the application server.
 */

const SUPABASE_STORAGE_PATTERN =
  /https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/;

const STABLE_STREAM_IMAGE_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
]);

function decodeStorageKey(key: string): string {
  const pathOnly = key.split(/[?#]/, 1)[0]
  try {
    return decodeURIComponent(pathOnly)
  } catch {
    return pathOnly
  }
}

function isImageStorageKey(key: string): boolean {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(key)
}

function shouldUseStableImageStream(bucket: string, key: string): boolean {
  if (!isImageStorageKey(key)) return false
  if (STABLE_STREAM_IMAGE_BUCKETS.has(bucket)) return true

  return (
    bucket === 'mindx-avatars' &&
    (key.startsWith('avatars/honors-top') || key.startsWith('honors-monthly/'))
  )
}

function makeStorageProxyUrl(bucket: string, key: string): string {
  const decodedKey = decodeStorageKey(key)
  const params = new URLSearchParams({ bucket, key: decodedKey });
  if (shouldUseStableImageStream(bucket, decodedKey)) {
    params.set('stream', '1')
  }
  if (/\.(png|jpe?g|gif|avif)$/i.test(key) && bucket !== 'mindx-teacher-certificates') params.set('format', 'webp');
  return `/api/storage-image?${params.toString()}`;
}

function normalizeLegacyProxyUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname !== '/api/storage-image') return url;

    parsed.searchParams.delete('proxy');
    const bucket = parsed.searchParams.get('bucket')
    const key = parsed.searchParams.get('key')
    if (key && /\.(png|jpe?g|gif|avif)$/i.test(key) && bucket !== 'mindx-teacher-certificates') parsed.searchParams.set('format', 'webp')
    if (
      bucket &&
      key &&
      parsed.searchParams.get('redirect') !== '1' &&
      shouldUseStableImageStream(bucket, decodeStorageKey(key))
    ) {
      parsed.searchParams.set('stream', '1')
    }
    const normalized = `${parsed.pathname}?${parsed.searchParams.toString()}`;
    return url.startsWith('/') ? normalized : parsed.toString();
  } catch {
    return url;
  }
}

/** Parse s3://bucket/key to the authenticated storage endpoint. */
function s3UriToProxyUrl(url: string): string | null {
  const match = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return makeStorageProxyUrl(match[1], match[2]);
}

/**
 * Normalize an image/video URL:
 * - Supabase URLs use the authenticated storage endpoint.
 * - Legacy proxy=1 parameters are removed so the endpoint can redirect.
 * - Other URLs are left unchanged.
 */
export function normalizeStorageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.svg';

  if (url.startsWith('/api/storage-image')) {
    return normalizeLegacyProxyUrl(url);
  }

  if (url.startsWith('/')) return normalizePublicImageUrl(url);

  if (url.startsWith('s3://')) {
    return s3UriToProxyUrl(url) ?? url;
  }

  const match = url.match(SUPABASE_STORAGE_PATTERN);
  if (match) {
    return makeStorageProxyUrl(match[1], match[2]);
  }

  return url;
}

export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return SUPABASE_STORAGE_PATTERN.test(url);
}
