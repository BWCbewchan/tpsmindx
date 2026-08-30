import pool from '@/lib/db';
import { sanitizeHtml, sanitizeText } from '@/lib/server-sanitize-html';
import {
    deleteObject,
    isSupabaseS3Configured,
    parsePublicUrl,
} from '@/lib/supabase-s3';
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
  canAdministerTruyenThongPosts,
  ensureTruyenThongThumbnailPositionSchema,
  findCommunicationPostByIdentifier,
  normalizeTruyenThongAudience,
  normalizeTruyenThongMediaUrl,
  normalizeTruyenThongPostStatus,
  normalizeTruyenThongPostType,
  normalizeTruyenThongThumbnailPosition,
  requireTruyenThongPostAdminMutation,
} from '@/lib/truyenthong-posts';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { generateSlug } from '@/lib/utils';
import { createNotificationForEveryone } from '@/lib/notification-service';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BASE64_IMAGE_CHARS = Math.ceil((MAX_TRUYENTHONG_IMAGE_BYTES * 4) / 3) + 1024;

async function uploadBase64ToS3(base64Data: string): Promise<string> {
  if (!isSupabaseS3Configured()) return base64Data;

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

/**
 * Trích xuất tất cả các URL ảnh từ nội dung HTML.
 * Decode HTML entities (&amp; → &) để so sánh URL chính xác.
 */
function extractImageUrls(htmlContent: string): string[] {
  if (!htmlContent) return [];
  const urls: string[] = [];
  const regex = /src=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    // Decode HTML entities để tránh mismatch khi so sánh
    const url = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    urls.push(url);
  }
  return urls;
}

/**
 * Xóa ảnh khỏi S3 (chỉ xóa nếu là URL Supabase, bỏ qua Cloudinary cũ).
 */
function deleteImageSilently(url: string | null) {
  if (!url) return;
  const parsed = parsePublicUrl(url);
  if (!parsed) return; // URL Cloudinary cũ hoặc không phải S3 → bỏ qua
  deleteObject(parsed.bucket, parsed.key).catch((err) =>
    console.error('Failed to delete S3 image:', err)
  );
}

/**
 * So sánh 2 nội dung HTML và xóa những ảnh không còn tồn tại trong nội dung mới.
 */
async function cleanupOrphanedImages(oldHtml: string, newHtml: string) {
  const oldUrls = extractImageUrls(oldHtml);
  const newUrls = new Set(extractImageUrls(newHtml));

  for (const url of oldUrls) {
    if (!newUrls.has(url)) {
      deleteImageSilently(url);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const viewerAuth = await requireBearerSession(request);
    const userId = viewerAuth.ok ? viewerAuth.sessionEmail.trim().toLowerCase() : null;
    const canReadDrafts = viewerAuth.ok && canAdministerTruyenThongPosts(viewerAuth.resolvedAccess);
    const client = await pool.connect();

    try {
      const lookup = await findCommunicationPostByIdentifier(client, id);
      if (lookup.invalid) {
        return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
      }
      if (!lookup.post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const post = lookup.post;

      if (post.status !== 'published' && !canReadDrafts) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      let isLiked = false;
      let reaction: string | null = null;
      const reaction_counts: Record<string, number> = {};

      if (userId) {
        const likeCheck = await client.query(
          'SELECT reaction FROM communication_likes WHERE post_id = $1 AND user_id = $2',
          [post.id, userId]
        );
        isLiked = likeCheck.rows.length > 0;
        reaction = likeCheck.rows[0]?.reaction || null;
      }

      const reactionCountsResult = await client.query(
        `SELECT reaction, COUNT(*) as count
         FROM communication_likes
         WHERE post_id = $1 AND reaction IS NOT NULL
         GROUP BY reaction
         ORDER BY count DESC`,
        [post.id]
      );
      reactionCountsResult.rows.forEach((r: any) => {
        reaction_counts[r.reaction] = parseInt(r.count);
      });

      const relatedResult = await client.query(
        `SELECT
           id,
           slug,
           title,
           description,
           featured_image,
           banner_image,
           thumbnail_position,
           post_type,
           published_at,
           view_count,
           like_count,
           created_at
         FROM communications
         WHERE post_type = $1 AND status = 'published' AND id != $2
         ORDER BY created_at DESC LIMIT 3`,
        [post.post_type, post.id]
      );

      return NextResponse.json({
        ...post,
        isLiked,
        reaction,
        reaction_counts,
        relatedPosts: relatedResult.rows,
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie',
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const denied = await requireTruyenThongPostAdminMutation(request as NextRequest);
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
      console.error('Error processing base64 images in PUT:', err);
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

      const lookup = await findCommunicationPostByIdentifier(client, id);
      if (lookup.invalid) {
        return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
      }
      if (!lookup.post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const currentPost = lookup.post;

      // Lưu URL cũ để xóa sau khi update thành công (chỉ xóa nếu URL thực sự thay đổi)
      const oldFeaturedImage = (finalFeaturedImage !== currentPost.featured_image) ? currentPost.featured_image : null;
      const oldBannerImage = (finalBannerImage !== currentPost.banner_image) ? currentPost.banner_image : null;

      let newSlug = currentPost.slug;
      if (safeTitle !== currentPost.title) {
        newSlug = generateSlug(safeTitle);
        let slugExists = await client.query(
          'SELECT 1 FROM communications WHERE slug = $1 AND id != $2',
          [newSlug, currentPost.id]
        );
        let counter = 1;
        while (slugExists.rows.length > 0) {
          newSlug = `${generateSlug(safeTitle)}-${counter}`;
          slugExists = await client.query(
            'SELECT 1 FROM communications WHERE slug = $1 AND id != $2',
            [newSlug, currentPost.id]
          );
          counter++;
        }
      }

      const result = await client.query(
        `UPDATE communications SET
          title = $1, slug = $2, description = $3, content = $4,
          featured_image = $5, banner_image = $6, post_type = $7,
          audience = $8, status = $9, published_at = $10,
          thumbnail_position = $11, updated_at = NOW()
        WHERE id = $12 RETURNING *`,
        [
          safeTitle, newSlug, safeDescription, safeContent, finalFeaturedImage, finalBannerImage,
          safePostType, safeAudience, safeStatus, safePublishedAt,
          safeThumbnailPosition, currentPost.id,
        ]
      );

      if (safeStatus === 'published' && currentPost.status !== 'published') {
        await createNotificationForEveryone({
          title: `Bài viết mới: ${safeTitle}`,
          content: safeDescription,
          type: 'communication',
          link: `/user/truyenthong/${newSlug}`,
        }).catch((err) =>
          console.error('Failed to create notification for everyone:', err)
        );
      }

      // Xóa ảnh cũ trên S3 (chỉ xóa S3, bỏ qua Cloudinary cũ)
      // 1. Xóa thumbnail/banner cũ nếu thay đổi
      if (oldFeaturedImage) deleteImageSilently(oldFeaturedImage);
      if (oldBannerImage && oldBannerImage !== oldFeaturedImage && oldBannerImage !== finalBannerImage) {
        deleteImageSilently(oldBannerImage);
      }

      // 2. Xóa các ảnh trong nội dung bài viết đã bị gỡ bỏ
      await cleanupOrphanedImages(currentPost.content, safeContent);

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const denied = await requireTruyenThongPostAdminMutation(request as NextRequest);
    if (denied) return denied;
    const client = await pool.connect();
    try {
      const lookup = await findCommunicationPostByIdentifier(client, id);
      if (lookup.invalid) {
        return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
      }
      if (!lookup.post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const result = await client.query(
        'DELETE FROM communications WHERE id = $1 RETURNING *',
        [lookup.post.id]
      );

      const deletedPost = result.rows[0];

      // Xóa tất cả ảnh liên quan trên S3 (chỉ xóa S3, bỏ qua Cloudinary cũ)
      // 1. Xóa thumbnail & banner
      deleteImageSilently(deletedPost.featured_image);
      if (deletedPost.banner_image !== deletedPost.featured_image) {
        deleteImageSilently(deletedPost.banner_image);
      }

      // 2. Xóa tất cả ảnh trong nội dung bài viết
      const contentUrls = extractImageUrls(deletedPost.content);
      for (const url of contentUrls) {
        deleteImageSilently(url);
      }

      return NextResponse.json({ message: 'Post deleted successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
