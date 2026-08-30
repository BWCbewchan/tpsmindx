import { requireSameOriginMutation } from '@/lib/api-security';
import type { DatasourceBearerOk } from '@/lib/datasource-api-auth';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import {
  TRUYENTHONG_CONTENT_IMAGE_BUCKET,
  TRUYENTHONG_THUMBNAIL_BUCKET,
  isSafeTruyenThongMediaStorageKey,
} from '@/lib/truyenthong-image-upload';
import type { NextRequest, NextResponse } from 'next/server';
import { NextResponse as JsonResponse } from 'next/server';
import type { PoolClient } from 'pg';

const POST_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const TRUYENTHONG_ADMIN_PATH = '/admin/truyenthong';
export const DEFAULT_TRUYENTHONG_POST_IMAGE = '/images/default-post.png';

export const TRUYENTHONG_POST_TYPES = [
  'tin-tức',
  'chính-sách',
  'sự-kiện',
  'đào-tạo',
  'báo-cáo',
  'thông-báo',
] as const;

export const TRUYENTHONG_AUDIENCES = [
  'toàn-công-ty',
  'bộ-phận-hr',
  'quản-lý',
  'kỹ-thuật',
] as const;

export const TRUYENTHONG_POST_STATUSES = ['draft', 'published', 'hidden'] as const;

export const MAX_TRUYENTHONG_TITLE_LENGTH = 240;
export const MAX_TRUYENTHONG_DESCRIPTION_LENGTH = 1000;
export const MAX_TRUYENTHONG_CONTENT_LENGTH = 750_000;

const TRUSTED_EXTERNAL_IMAGE_HOSTS = new Set([
  'images.unsplash.com',
  'i.pinimg.com',
  'res.cloudinary.com',
]);

const TRUYENTHONG_STORAGE_IMAGE_BUCKETS = new Set([
  TRUYENTHONG_CONTENT_IMAGE_BUCKET,
  TRUYENTHONG_THUMBNAIL_BUCKET,
]);

let thumbnailPositionSchemaReady = false;

function normalizePermissionPath(path: string): string {
  const [pathname] = path.trim().split('?');
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function hasTruyenThongAdminPermission(permissions: string[]): boolean {
  return permissions.some((permission) => {
    const path = normalizePermissionPath(permission);
    return path === TRUYENTHONG_ADMIN_PATH || path.startsWith(`${TRUYENTHONG_ADMIN_PATH}/`);
  });
}

export function canAdministerTruyenThongPosts(
  access: Pick<DatasourceBearerOk['resolvedAccess'], 'role' | 'permissions'>,
): boolean {
  const role = String(access.role || '').trim().toLowerCase();
  return (
    role === 'super_admin' ||
    role === 'admin' ||
    hasTruyenThongAdminPermission(access.permissions || [])
  );
}

export async function resolveTruyenThongPostAdmin(
  request: NextRequest,
): Promise<DatasourceBearerOk | null> {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return null;
  return canAdministerTruyenThongPosts(auth.resolvedAccess) ? auth : null;
}

export function isValidTruyenThongPostIdentifier(identifier: string): boolean {
  const normalized = identifier.trim();
  return /^\d+$/.test(normalized) || POST_IDENTIFIER_PATTERN.test(normalized);
}

export function normalizeTruyenThongPostType(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return (TRUYENTHONG_POST_TYPES as readonly string[]).includes(text) ? text : null;
}

export function normalizeTruyenThongAudience(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return (TRUYENTHONG_AUDIENCES as readonly string[]).includes(text) ? text : null;
}

export function normalizeTruyenThongPostStatus(value: unknown): string | null {
  const text = String(value ?? '').trim().toLowerCase();
  return (TRUYENTHONG_POST_STATUSES as readonly string[]).includes(text) ? text : null;
}

function parseStorageProxyUrl(rawUrl: string): { bucket: string; key: string } | null {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    if (parsed.pathname !== '/api/storage-image') return null;
    const bucket = parsed.searchParams.get('bucket') || '';
    const key = parsed.searchParams.get('key') || '';
    if (!bucket || !key) return null;
    return { bucket, key };
  } catch {
    return null;
  }
}

function isTrustedSupabaseStorageImageUrl(url: URL): boolean {
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return false;

  const match = url.pathname.match(
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
  );
  if (!match) return false;

  const bucket = decodeURIComponent(match[1]);
  const key = decodeURIComponent(match[2]);
  return TRUYENTHONG_STORAGE_IMAGE_BUCKETS.has(bucket) && isSafeTruyenThongMediaStorageKey(key);
}

export function normalizeTruyenThongMediaUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (raw === DEFAULT_TRUYENTHONG_POST_IMAGE) return raw;

  if (raw.startsWith('/api/storage-image')) {
    const parsed = parseStorageProxyUrl(raw);
    if (
      parsed &&
      TRUYENTHONG_STORAGE_IMAGE_BUCKETS.has(parsed.bucket) &&
      isSafeTruyenThongMediaStorageKey(parsed.key)
    ) {
      return `/api/storage-image?bucket=${encodeURIComponent(parsed.bucket)}&key=${encodeURIComponent(parsed.key)}`;
    }
    return null;
  }

  try {
    const url = new URL(raw);
    if (isTrustedSupabaseStorageImageUrl(url)) return raw;
    if (url.protocol === 'https:' && TRUSTED_EXTERNAL_IMAGE_HOSTS.has(url.hostname)) {
      return raw;
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeTruyenThongThumbnailPosition(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '50% 50%') return '50% 50%';
  if (raw.length > 180) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const w = Number(parsed.w);
    const h = Number(parsed.h);
    const values = [x, y, w, h];
    if (
      values.every((n) => Number.isFinite(n)) &&
      x >= 0 &&
      y >= 0 &&
      w > 0 &&
      h > 0 &&
      w <= 1 &&
      h <= 1 &&
      x + w <= 1.001 &&
      y + h <= 1.001
    ) {
      return JSON.stringify({
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        w: Number(w.toFixed(4)),
        h: Number(h.toFixed(4)),
      });
    }
  } catch {
    return null;
  }

  return null;
}

export async function ensureTruyenThongThumbnailPositionSchema(client: PoolClient): Promise<void> {
  if (thumbnailPositionSchemaReady) return;

  await client.query(`
    ALTER TABLE communications
      ADD COLUMN IF NOT EXISTS thumbnail_position TEXT DEFAULT '50% 50%';
    ALTER TABLE communications
      ALTER COLUMN thumbnail_position TYPE TEXT;
  `);
  thumbnailPositionSchemaReady = true;
}

export async function requireTruyenThongPostAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;
  return canAdministerTruyenThongPosts(auth.resolvedAccess)
    ? null
    : JsonResponse.json(
        { success: false, error: 'Không có quyền quản trị bài viết Truyền thông' },
        { status: 403 },
      );
}

export async function requireTruyenThongPostAdminMutation(
  request: NextRequest,
): Promise<NextResponse | null> {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return originDenied;

  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  if (canAdministerTruyenThongPosts(auth.resolvedAccess)) {
    return null;
  }

  return JsonResponse.json(
    { success: false, error: 'Không có quyền quản trị bài viết Truyền thông' },
    { status: 403 },
  );
}

export async function findCommunicationPostByIdentifier(
  client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  },
  identifier: string,
  options: { summary?: boolean } = {},
): Promise<{ invalid: boolean; post: any | null }> {
  const normalized = identifier.trim();

  if (!isValidTruyenThongPostIdentifier(normalized)) {
    return { invalid: true, post: null };
  }

  const columns = options.summary
    ? 'id, slug, status, like_count, post_type'
    : '*';

  let result = await client.query(
    `SELECT ${columns} FROM communications WHERE slug = $1`,
    [normalized],
  );

  if (result.rows.length === 0 && /^\d+$/.test(normalized)) {
    result = await client.query(`SELECT ${columns} FROM communications WHERE id = $1`, [
      Number(normalized),
    ]);
  }

  return { invalid: false, post: result.rows[0] ?? null };
}
