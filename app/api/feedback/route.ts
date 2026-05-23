import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { getSignedObjectUrl, isSupabaseS3Configured, parseStoragePath } from '@/lib/supabase-s3';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['super_admin', 'admin']);
const VALID_STATUSES = new Set(['new', 'in_progress', 'done']);

async function getUserRole(email?: string | null) {
  if (!email) return null;
  const result = await pool.query(
    'SELECT role FROM app_users WHERE email = $1 AND is_active = true LIMIT 1',
    [email.toLowerCase()]
  );
  return result.rows[0]?.role || null;
}

/** Signed URLs expire; DB should store s3://bucket/key only. */
const FEEDBACK_IMAGE_URL_TTL_SEC = 7 * 24 * 60 * 60;

function coerceImageUrlArray(imageUrls: unknown): string[] {
  if (imageUrls == null) return [];
  if (Array.isArray(imageUrls)) return imageUrls.map((x) => String(x ?? ''));
  if (typeof imageUrls === 'string') {
    try {
      const parsed = JSON.parse(imageUrls);
      return Array.isArray(parsed) ? parsed.map((x: unknown) => String(x ?? '')) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function hydrateImageUrls(imageUrls: unknown, signedUrlCache: Map<string, string>) {
  const source = coerceImageUrlArray(imageUrls);
  const hydrated = await Promise.all(
    source.map(async (raw) => {
      const value = String(raw || '').trim();
      if (!value) return '';
      const ref = normalizeStorageRef(value);
      const parsed = parseStoragePath(ref);
      if (parsed) {
        if (!isSupabaseS3Configured()) {
          return ref.startsWith('s3://') ? ref : value;
        }
        const cacheKey = `${parsed.bucket}/${parsed.key}`;
        const cached = signedUrlCache.get(cacheKey);
        if (cached) return cached;
        try {
          const signed = await getSignedObjectUrl(parsed.bucket, parsed.key, FEEDBACK_IMAGE_URL_TTL_SEC);
          signedUrlCache.set(cacheKey, signed);
          return signed;
        } catch {
          return '';
        }
      }
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
      }
      return '';
    })
  );
  return hydrated.filter(Boolean);
}

function normalizeStorageRef(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('s3://')) return raw;

  try {
    const url = new URL(raw);
    const s3Match = url.pathname.match(/\/storage\/v1\/s3\/([^/]+)\/(.+)/);
    if (s3Match) {
      return `s3://${s3Match[1]}/${decodeURIComponent(s3Match[2])}`;
    }
    const publicMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (publicMatch) {
      return `s3://${publicMatch[1]}/${decodeURIComponent(publicMatch[2])}`;
    }
    const signMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/);
    if (signMatch) {
      return `s3://${signMatch[1]}/${decodeURIComponent(signMatch[2])}`;
    }
    const authMatch = url.pathname.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
    if (authMatch) {
      return `s3://${authMatch[1]}/${decodeURIComponent(authMatch[2])}`;
    }
  } catch {
    return raw;
  }

  return raw;
}

async function hydrateFeedbackRow(item: any, signedUrlCache: Map<string, string>) {
  return {
    ...item,
    image_urls: await hydrateImageUrls(item.image_urls, signedUrlCache),
    admin_image_urls: await hydrateImageUrls(item.admin_image_urls ?? [], signedUrlCache),
  };
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'mine';
    const requestEmail = (searchParams.get('requestEmail') || '').trim().toLowerCase();

    if (!requestEmail) {
      return NextResponse.json({ success: false, error: 'requestEmail là bắt buộc' }, { status: 400 });
    }

    const role = await getUserRole(auth.sessionEmail);
    const isAdmin = ADMIN_ROLES.has(role || '');
    const signedUrlCache = new Map<string, string>();

    if (scope === 'all') {
      if (!isAdmin) {
        return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
      }
      const result = await pool.query(
        `SELECT id, user_email, user_name, user_code, screen_path, content, suggestion, image_urls, status, admin_note,
                admin_reply, admin_image_urls,
                resolved_by_email, resolved_at, created_at, updated_at
         FROM feedback_tickets
         ORDER BY created_at DESC`
      );
      const items = await Promise.all(
        result.rows.map((item: any) => hydrateFeedbackRow(item, signedUrlCache))
      );
      return NextResponse.json({ success: true, items });
    }

    const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, requestEmail);
    if (denied) return denied;

    const result = await pool.query(
      `SELECT id, user_email, user_name, user_code, screen_path, content, suggestion, image_urls, status, admin_note,
              admin_reply, admin_image_urls,
              resolved_by_email, resolved_at, created_at, updated_at
       FROM feedback_tickets
       WHERE user_email = $1
       ORDER BY created_at DESC`,
      [requestEmail]
    );
    const items = await Promise.all(
      result.rows.map((item: any) => hydrateFeedbackRow(item, signedUrlCache))
    );
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tải feedback' },
      { status: 500 }
    );
  }
});

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const requestEmail = String(body?.requestEmail || '').trim().toLowerCase();
    const userName = String(body?.userName || '').trim();
    const userCode = String(body?.userCode || '').trim();
    const screenPath = String(body?.screenPath || '').trim();
    const content = String(body?.content || body?.comment || '').trim();
    const suggestion = String(body?.suggestion || body?.feature || '').trim();
    const imageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.map((v: unknown) => normalizeStorageRef(String(v || ''))).filter(Boolean)
      : [];

    if (!requestEmail || !content) {
      return NextResponse.json(
        { success: false, error: 'requestEmail và content là bắt buộc' },
        { status: 400 }
      );
    }

    const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, requestEmail);
    if (denied) return denied;

    const result = await pool.query(
      `INSERT INTO feedback_tickets (user_email, user_name, user_code, screen_path, content, suggestion, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, user_email, user_name, user_code, screen_path, content, suggestion, image_urls, status, admin_note,
                 admin_reply, admin_image_urls,
                 resolved_by_email, resolved_at, created_at, updated_at`,
      [requestEmail, userName || null, userCode || null, screenPath || null, content, suggestion || null, JSON.stringify(imageUrls)]
    );

    const row = result.rows[0];
    const hydrated = await hydrateFeedbackRow(row, new Map<string, string>());
    return NextResponse.json({ success: true, item: hydrated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tạo feedback' },
      { status: 500 }
    );
  }
});

export const PATCH = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const id = Number(body?.id);
    const status = String(body?.status || '').trim();
    const adminNote = body?.adminNote !== undefined ? String(body.adminNote || '').trim() : undefined;
    const adminReply = body?.adminReply !== undefined ? String(body.adminReply || '').trim() : undefined;
    const adminImageUrls = Array.isArray(body?.adminImageUrls)
      ? body.adminImageUrls.map((v: any) => normalizeStorageRef(String(v || ''))).filter(Boolean)
      : undefined;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: 'id không hợp lệ' }, { status: 400 });
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: 'status không hợp lệ' }, { status: 400 });
    }

    const role = await getUserRole(auth.sessionEmail);
    if (!ADMIN_ROLES.has(role || '')) {
      return NextResponse.json({ success: false, error: 'Không có quyền cập nhật feedback' }, { status: 403 });
    }

    const current = await pool.query('SELECT status FROM feedback_tickets WHERE id = $1 LIMIT 1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy feedback' }, { status: 404 });
    }

    const currentStatus = String(current.rows[0].status || 'new') as 'new' | 'in_progress' | 'done';
    const isValidTransition =
      (currentStatus === 'new' && status === 'in_progress') ||
      (currentStatus === 'in_progress' && status === 'done') ||
      (currentStatus === status);

    if (!isValidTransition) {
      return NextResponse.json(
        { success: false, error: `Không thể chuyển từ ${currentStatus} sang ${status}` },
        { status: 400 }
      );
    }

    if (status === 'done' && !adminReply) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập phản hồi admin trước khi hoàn thành' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE feedback_tickets
       SET status = $2::varchar,
           admin_note = COALESCE($3::text, admin_note),
           admin_reply = COALESCE($4::text, admin_reply),
           admin_image_urls = COALESCE($5::jsonb, admin_image_urls),
           resolved_by_email = CASE WHEN $2::varchar = 'done' THEN $6::text ELSE resolved_by_email END,
           resolved_at = CASE WHEN $2::varchar = 'done' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, user_email, user_name, user_code, screen_path, content, suggestion, image_urls, status, admin_note,
                 admin_reply, admin_image_urls,
                 resolved_by_email, resolved_at, created_at, updated_at`,
      [id, status, adminNote || null, adminReply || null, adminImageUrls ? JSON.stringify(adminImageUrls) : null, auth.sessionEmail]
    );

    return NextResponse.json({ success: true, item: await hydrateFeedbackRow(result.rows[0], new Map<string, string>()) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể cập nhật feedback' },
      { status: 500 }
    );
  }
});
