import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.SUPABASE_S3_REGION || 'ap-south-1';
const ENDPOINT = process.env.SUPABASE_S3_ENDPOINT || '';
const ACCESS_KEY_ID = process.env.SUPABASE_S3_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '';

// Supabase project ref extracted from endpoint
// e.g. https://wrlfozuzdblljlxwvbst.storage.supabase.co/storage/v1/s3
function getProjectRef(): string {
  if (!ENDPOINT) return '';
  const match = ENDPOINT.match(/https:\/\/([^.]+)\.storage\.supabase\.co/);
  return match ? match[1] : '';
}

export function isSupabaseS3Configured() {
  return Boolean(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

export function createSupabaseS3Client() {
  if (!isSupabaseS3Configured()) {
    throw new Error('Chưa cấu hình Supabase S3 endpoint/access key/secret key');
  }

  return new S3Client({
    forcePathStyle: true,
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
}

export function getSupabasePublicBaseUrl() {
  const direct = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (direct) return direct.replace(/\/$/, '');

  if (!ENDPOINT) return '';
  // Convert: https://<ref>.storage.supabase.co/storage/v1/s3 -> https://<ref>.supabase.co
  return ENDPOINT.replace(/\/storage\/v1\/s3\/?$/, '').replace('.storage.supabase.co', '.supabase.co');
}

/**
 * Tạo public URL cho object trong public bucket.
 * Format: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<key>
 */
export function getPublicObjectUrl(bucket: string, key: string): string {
  const ref = getProjectRef();
  if (!ref) {
    const base = getSupabasePublicBaseUrl();
    return `${base}/storage/v1/object/public/${bucket}/${key}`;
  }
  return `https://${ref}.supabase.co/storage/v1/object/public/${bucket}/${key}`;
}

export async function getSignedObjectUrl(bucket: string, key: string, expiresInSeconds = 3600) {
  const client = createSupabaseS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Xóa một object khỏi S3 bucket.
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = createSupabaseS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Parse storage path dạng s3://bucket/key
 */
export function parseStoragePath(value: string): { bucket: string; key: string } | null {
  if (!value.startsWith('s3://')) return null;
  const raw = value.replace('s3://', '');
  const splitIndex = raw.indexOf('/');
  if (splitIndex <= 0) return null;
  return {
    bucket: raw.slice(0, splitIndex),
    key: raw.slice(splitIndex + 1),
  };
}

/**
 * Parse Supabase public URL hoặc proxy URL để lấy bucket và key.
 * Format 1: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<key>
 * Format 2: /api/storage-image?bucket=<bucket>&key=<key>
 */
export function parsePublicUrl(url: string): { bucket: string; key: string } | null {
  if (!url) return null;

  // Case 1: Proxy URL format
  if (url.includes('/api/storage-image')) {
    try {
      const u = new URL(url, 'http://localhost');
      const bucket = u.searchParams.get('bucket');
      const key = u.searchParams.get('key');
      if (bucket && key) return { bucket, key };
    } catch (e) {
      console.error('Failed to parse proxy URL:', e);
    }
  }

  // Case 2: Supabase public URL format
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}

/**
 * List objects trong một bucket (dùng cho admin manager).
 */
export async function listObjects(bucket: string, prefix = '', maxKeys = 100) {
  const client = createSupabaseS3Client();
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      MaxKeys: maxKeys,
    })
  );
  return result.Contents || [];
}
