/**
 * Utility để normalize storage URLs.
 *
 * Vấn đề: Một số bài viết cũ lưu Supabase public URL trực tiếp
 * (https://xxx.supabase.co/storage/v1/object/public/bucket/key)
 * nhưng bucket chưa được set public → HTTP 400.
 *
 * Giải pháp: Chuyển tất cả Supabase storage URLs sang proxy URL
 * (/api/storage-image?bucket=...&key=...) để server fetch và serve.
 */

const SUPABASE_STORAGE_PATTERN = /https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/;

/** Parse s3://bucket/key → proxy URL */
function s3UriToProxyUrl(url: string): string | null {
  const match = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return `/api/storage-image?bucket=${encodeURIComponent(match[1])}&key=${encodeURIComponent(match[2])}`;
}

/**
 * Normalize một URL ảnh/video:
 * - Nếu là Supabase storage URL → chuyển sang proxy URL
 * - Nếu là proxy URL hoặc URL khác → giữ nguyên
 */
export function normalizeStorageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.svg';

  // Đã là proxy URL → giữ nguyên
  if (url.startsWith('/api/storage-image')) return url;

  // s3://bucket/key → proxy URL
  if (url.startsWith('s3://')) {
    return s3UriToProxyUrl(url) ?? url;
  }

  // Supabase storage URL → chuyển sang proxy
  const match = url.match(SUPABASE_STORAGE_PATTERN);
  if (match) {
    const bucket = match[1];
    const key = match[2];
    return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
  }

  // URL khác (Cloudinary, local, etc.) → giữ nguyên
  return url;
}

/**
 * Kiểm tra xem URL có phải là Supabase storage URL không.
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return SUPABASE_STORAGE_PATTERN.test(url);
}
