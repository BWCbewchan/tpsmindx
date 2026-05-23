import pool from '@/lib/db';
import { sanitizeHtml, sanitizeText } from '@/lib/server-sanitize-html';
import {
    createSupabaseS3Client,
    deleteObject,
    isSupabaseS3Configured,
    parsePublicUrl,
} from '@/lib/supabase-s3';
import { findCommunicationPostByIdentifier, requireTruyenThongPostAdmin } from '@/lib/truyenthong-posts';
import { generateSlug } from '@/lib/utils';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-posts-content';

async function ensureBucket() {
  if (!isSupabaseS3Configured()) return;
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

async function uploadBase64ToS3(base64Data: string): Promise<string> {
  if (!isSupabaseS3Configured()) return base64Data;

  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return base64Data;

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';

  const client = createSupabaseS3Client();
  const key = `post-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return makeProxyUrl(BUCKET_NAME, key);
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
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

      if (post.status !== 'published') {
        const rawSession = request.cookies.get('tps_session')?.value;
        const session = rawSession ? await import('@/lib/session-cookie').then(({ verifySessionCookieValue }) => verifySessionCookieValue(rawSession)) : null;
        if (!session?.canAdminPortal) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
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
        `SELECT * FROM communications
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
    const denied = await requireTruyenThongPostAdmin(request as NextRequest);
    if (denied) return denied;
    const body = await request.json();
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

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedDescription =
      typeof description === 'string' ? description.trim() : '';
    const rawContent = typeof content === 'string' ? content : '';

    if (!normalizedTitle || !normalizedDescription || !rawContent) {
      return NextResponse.json(
        { error: 'title, description và content là bắt buộc' },
        { status: 400 },
      );
    }

    await ensureBucket();

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

    const client = await pool.connect();
    try {
      const lookup = await findCommunicationPostByIdentifier(client, id);
      if (lookup.invalid) {
        return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
      }
      if (!lookup.post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const currentPost = lookup.post;

      // Lưu URL cũ để xóa sau khi update thành công (chỉ xóa nếu URL thực sự thay đổi)
      const oldFeaturedImage = (featured_image !== currentPost.featured_image) ? currentPost.featured_image : null;
      const oldBannerImage = (banner_image !== currentPost.banner_image) ? currentPost.banner_image : null;

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
          safeTitle, newSlug, safeDescription, safeContent, featured_image, banner_image,
          post_type, audience, status, published_at,
          thumbnail_position || '50% 50%', currentPost.id,
        ]
      );

      // Xóa ảnh cũ trên S3 (chỉ xóa S3, bỏ qua Cloudinary cũ)
      // 1. Xóa thumbnail/banner cũ nếu thay đổi
      if (oldFeaturedImage) deleteImageSilently(oldFeaturedImage);
      if (oldBannerImage && oldBannerImage !== oldFeaturedImage && oldBannerImage !== banner_image) {
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
    const denied = await requireTruyenThongPostAdmin(request as NextRequest);
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
