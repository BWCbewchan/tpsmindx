import pool from '@/lib/db';
import { isDegradedDatabaseQueryError } from '@/lib/db-unavailable';
import { sanitizeHtml, sanitizeText } from '@/lib/server-sanitize-html';
import { TPS_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/session-cookie';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import {
    requireTruyenThongPostAdmin,
} from '@/lib/truyenthong-posts';
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

/**
 * Upload base64 image lên Supabase S3 và trả về proxy URL.
 */
async function uploadBase64ToS3(base64Data: string): Promise<string> {
  if (!isSupabaseS3Configured()) return base64Data;

  // Parse data URI: data:image/png;base64,<data>
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sessionToken = request.cookies.get(TPS_SESSION_COOKIE)?.value;
    const session = sessionToken
      ? await verifySessionCookieValue(sessionToken)
      : null;
    const canSeeDrafts = session?.canAdminPortal === true;
    const effectiveStatus = canSeeDrafts ? status : 'published';

    let queryText = `
SELECT c.*,
  COALESCE(tt.comment_count, 0)::int AS comment_count,
  COALESCE(tt.hidden_comment_count, 0)::int AS hidden_comment_count
FROM communications c
LEFT JOIN (
  SELECT post_slug,
    COUNT(*) FILTER (WHERE hidden IS NOT TRUE)::int AS comment_count,
    COUNT(*) FILTER (WHERE hidden IS TRUE)::int AS hidden_comment_count
  FROM truyenthong_comments
  GROUP BY post_slug
) tt ON tt.post_slug = c.slug
WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      queryText += ` AND c.post_type = $${paramIndex}`;
      queryParams.push(type);
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

    queryText += ' ORDER BY c.created_at DESC';

    const client = await pool.connect();
    try {
      const result = await client.query(queryText, queryParams);
      return NextResponse.json(result.rows, {
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' },
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
    const denied = await requireTruyenThongPostAdmin(request);
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

    // Đảm bảo bucket tồn tại trước khi xử lý ảnh
    await ensureBucket();

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

    const client = await pool.connect();
    try {
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
          safeTitle, slug, safeDescription, safeContent, featured_image, banner_image,
          post_type, audience, status, published_at || new Date(),
          thumbnail_position || '50% 50%',
        ]
      );
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
