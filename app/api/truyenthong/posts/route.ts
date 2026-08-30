import pool from '@/lib/db';
import { isDegradedDatabaseQueryError } from '@/lib/db-unavailable';
import { sanitizeHtml, sanitizeText } from '@/lib/server-sanitize-html';
import { isSupabaseS3Configured } from '@/lib/supabase-s3';
import {
  MAX_TRUYENTHONG_IMAGE_BYTES,
  TRUYENTHONG_CONTENT_IMAGE_BUCKET,
  hasAllowedTruyenThongImageSignature,
  isAllowedTruyenThongImageContentType,
  uploadTruyenThongImageBuffer,
} from '@/lib/truyenthong-image-upload';
import {
  DEFAULT_TRUYENTHONG_POST_IMAGE,
  MAX_TRUYENTHONG_CONTENT_LENGTH,
  MAX_TRUYENTHONG_DESCRIPTION_LENGTH,
  MAX_TRUYENTHONG_TITLE_LENGTH,
  ensureTruyenThongThumbnailPositionSchema,
  normalizeTruyenThongAudience,
  normalizeTruyenThongMediaUrl,
  normalizeTruyenThongPostStatus,
  normalizeTruyenThongPostType,
  normalizeTruyenThongThumbnailPosition,
  requireTruyenThongPostAdminMutation,
  resolveTruyenThongPostAdmin,
} from '@/lib/truyenthong-posts';
import { generateSlug } from '@/lib/utils';
import { createNotificationForEveryone } from '@/lib/notification-service';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BASE64_IMAGE_CHARS = Math.ceil((MAX_TRUYENTHONG_IMAGE_BYTES * 4) / 3) + 1024;

/**
 * Upload base64 image lên Supabase S3 và trả về proxy URL.
 */
async function uploadBase64ToS3(base64Data: string): Promise<string> {
  if (!isSupabaseS3Configured()) return base64Data;

  // Parse data URI: data:image/png;base64,<data>
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return base64Data;

  const mimeType = match[1].trim().toLowerCase();
  const base64Payload = match[2].replace(/\s/g, '');
  if (
    !isAllowedTruyenThongImageContentType(mimeType) ||
    base64Payload.length > MAX_BASE64_IMAGE_CHARS
  ) {
    return base64Data;
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  if (
    buffer.length <= 0 ||
    buffer.length > MAX_TRUYENTHONG_IMAGE_BYTES ||
    !hasAllowedTruyenThongImageSignature(buffer, mimeType)
  ) {
    return base64Data;
  }

  const uploaded = await uploadTruyenThongImageBuffer({
    bucket: TRUYENTHONG_CONTENT_IMAGE_BUCKET,
    keyPrefix: 'post-images',
    buffer,
    contentType: mimeType,
  });
  return uploaded.url;
}

async function processBase64Images(htmlContent: string): Promise<string> {
  if (!htmlContent) return htmlContent;

  const regex = /src=["'](data:image\/[^;]+;base64,[^"']+)["']/g;
  let newContent = htmlContent;

  const matches = Array.from(htmlContent.matchAll(regex));
  if (!matches || matches.length === 0) return htmlContent;

  const uploadPromises = matches.map(async (match) => {
    const fullMatch = match[0];
    const base64Data = match[1];

    try {
      const newUrl = await uploadBase64ToS3(base64Data);
      return { originalStr: fullMatch, newStr: `src="${newUrl}"` };
    } catch (error) {
      console.error('Failed to upload base64 image to S3:', error);
      return { originalStr: fullMatch, newStr: fullMatch };
    }
  });

  const replacements = await Promise.all(uploadPromises);

  for (const { originalStr, newStr } of replacements) {
    newContent = newContent.replace(originalStr, newStr);
  }

  return newContent;
}

function normalizePublishedAt(value: unknown): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function hasInlineDataImage(htmlContent: string): boolean {
  return /\bsrc\s*=\s*["']data:image\//i.test(htmlContent);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const search = (searchParams.get('search') || '').trim().slice(0, 120);
    const sort = searchParams.get('sort');
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : null;
    const canSeeDrafts = Boolean(await resolveTruyenThongPostAdmin(request));
    let effectiveStatus: string | null = 'published';
    if (canSeeDrafts) {
      if (!status) {
        effectiveStatus = null;
      } else if (status === 'all') {
        effectiveStatus = 'all';
      } else {
        const normalizedStatus = normalizeTruyenThongPostStatus(status);
        if (!normalizedStatus) {
          return NextResponse.json({ error: 'Post status is invalid' }, { status: 400 });
        }
        effectiveStatus = normalizedStatus;
      }
    }
    const includeCommentCounts =
      canSeeDrafts && searchParams.get('include') === 'comment_counts';

    // List views never render the full HTML body. Excluding `content` keeps the
    // response small as the number and size of posts grow.
    let queryText = `
SELECT
  c.id,
  c.slug,
  c.title,
  c.description,
  c.featured_image,
  c.banner_image,
  c.thumbnail_position,
  c.post_type,
  c.audience,
  c.status,
  c.published_at,
  c.view_count,
  c.like_count,
  c.created_at,
  c.updated_at`;

    if (includeCommentCounts) {
      queryText += `,
  COALESCE(tt.comment_count, 0)::int AS comment_count,
  COALESCE(tt.hidden_comment_count, 0)::int AS hidden_comment_count`;
    }

    queryText += `
FROM communications c`;

    if (includeCommentCounts) {
      queryText += `
LEFT JOIN (
  SELECT post_slug,
    COUNT(*) FILTER (WHERE hidden IS NOT TRUE)::int AS comment_count,
    COUNT(*) FILTER (WHERE hidden IS TRUE)::int AS hidden_comment_count
  FROM truyenthong_comments
  GROUP BY post_slug
) tt ON tt.post_slug = c.slug`;
    }

    queryText += `
WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      const normalizedType = normalizeTruyenThongPostType(type);
      if (!normalizedType) {
        return NextResponse.json({ error: 'Post type is invalid' }, { status: 400 });
      }
      queryText += ` AND c.post_type = $${paramIndex}`;
      queryParams.push(normalizedType);
      paramIndex++;
    }

    if (effectiveStatus && effectiveStatus !== 'all') {
      queryText += ` AND c.status = $${paramIndex}`;
      queryParams.push(effectiveStatus);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const sortColumns: Record<string, string> = {
      view_count: 'c.view_count',
      published_at: 'c.published_at',
      created_at: 'c.created_at',
    };
    const sortColumn = sortColumns[sort || 'created_at'] || sortColumns.created_at;
    queryText += ` ORDER BY ${sortColumn} DESC, c.id DESC`;

    if (limit !== null) {
      queryText += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
    }

    const client = await pool.connect();
    try {
      const result = await client.query(queryText, queryParams);
      const cacheControl = includeCommentCounts || effectiveStatus !== 'published'
        ? 'private, no-store'
        : 'public, s-maxage=60, stale-while-revalidate=300';
      return NextResponse.json(result.rows, {
        headers: { 'Cache-Control': cacheControl },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    if (isDegradedDatabaseQueryError(error)) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59',
          'X-DB-Unavailable': '1',
        },
      });
    }
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireTruyenThongPostAdminMutation(request);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
    }
    const {
      title,
      description,
      content,
      featured_image,
      banner_image,
      post_type,
      audience,
      status,
      published_at,
      thumbnail_position,
    } = body;

    const normalizedTitle = typeof title === 'string'
      ? title.trim().slice(0, MAX_TRUYENTHONG_TITLE_LENGTH)
      : '';
    const normalizedDescription =
      typeof description === 'string'
        ? description.trim().slice(0, MAX_TRUYENTHONG_DESCRIPTION_LENGTH)
        : '';
    const rawContent = typeof content === 'string' ? content : '';

    if (!normalizedTitle || !normalizedDescription || !rawContent) {
      return NextResponse.json(
        { error: 'title, description và content là bắt buộc' },
        { status: 400 },
      );
    }
    if (rawContent.length > MAX_TRUYENTHONG_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: 'Nội dung bài viết vượt quá dung lượng cho phép' },
        { status: 413 },
      );
    }

    const safePostType = normalizeTruyenThongPostType(post_type);
    const safeAudience = normalizeTruyenThongAudience(audience);
    const safeStatus = normalizeTruyenThongPostStatus(status || 'draft');
    const safePublishedAt = normalizePublishedAt(published_at);
    const safeThumbnailPosition = normalizeTruyenThongThumbnailPosition(thumbnail_position);

    if (!safePostType || !safeAudience || !safeStatus) {
      return NextResponse.json(
        { error: 'Loại bài viết, đối tượng xem hoặc trạng thái không hợp lệ' },
        { status: 400 },
      );
    }
    if (!safePublishedAt) {
      return NextResponse.json({ error: 'Ngày đăng không hợp lệ' }, { status: 400 });
    }
    if (!safeThumbnailPosition) {
      return NextResponse.json({ error: 'Cấu hình thumbnail không hợp lệ' }, { status: 400 });
    }

    const safeFeaturedImage = normalizeTruyenThongMediaUrl(featured_image);
    const safeBannerImage = normalizeTruyenThongMediaUrl(banner_image);
    if (String(featured_image ?? '').trim() && !safeFeaturedImage) {
      return NextResponse.json({ error: 'featured_image không hợp lệ' }, { status: 400 });
    }
    if (String(banner_image ?? '').trim() && !safeBannerImage) {
      return NextResponse.json({ error: 'banner_image không hợp lệ' }, { status: 400 });
    }
    const finalFeaturedImage = safeFeaturedImage || DEFAULT_TRUYENTHONG_POST_IMAGE;
    const finalBannerImage = safeBannerImage || finalFeaturedImage;

    let processedContent = rawContent;
    try {
      processedContent = await processBase64Images(rawContent);
    } catch (err) {
      console.error('Error processing base64 images in POST:', err);
    }

    const safeTitle = sanitizeText(normalizedTitle);
    const safeDescription = sanitizeText(normalizedDescription);
    const safeContent = sanitizeHtml(processedContent);

    if (!safeTitle || !safeDescription || !safeContent.trim()) {
      return NextResponse.json(
        { error: 'Nội dung bài viết không hợp lệ sau khi làm sạch' },
        { status: 400 },
      );
    }
    if (hasInlineDataImage(safeContent)) {
      return NextResponse.json(
        { error: 'Ảnh nhúng trực tiếp không được phép. Vui lòng upload ảnh qua editor.' },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await ensureTruyenThongThumbnailPositionSchema(client);

      const duplicateCheck = await client.query('SELECT 1 FROM communications WHERE title = $1', [safeTitle]);
      if (duplicateCheck.rows.length > 0) {
        return NextResponse.json({ error: 'Tiêu đề bài viết đã tồn tại' }, { status: 409 });
      }

      let slug = generateSlug(safeTitle);
      let slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1', [slug]);
      let counter = 1;
      while (slugExists.rows.length > 0) {
        slug = `${generateSlug(safeTitle)}-${counter}`;
        slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1', [slug]);
        counter++;
      }

      const result = await client.query(
        `INSERT INTO communications (
          title, slug, description, content, featured_image, banner_image,
          post_type, audience, status, published_at, thumbnail_position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          safeTitle, slug, safeDescription, safeContent, finalFeaturedImage, finalBannerImage,
          safePostType, safeAudience, safeStatus, safePublishedAt,
          safeThumbnailPosition,
        ]
      );

      if (safeStatus === 'published') {
        await createNotificationForEveryone({
          title: `Bài viết mới: ${safeTitle}`,
          content: safeDescription,
          type: 'communication',
          link: `/user/truyenthong/${slug}`,
        }).catch((err) =>
          console.error('Failed to create notification for everyone:', err)
        );
      }

      return NextResponse.json(result.rows[0], {
        status: 201,
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } }
    );
  }
}
