import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-thumbnails';
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;

async function ensureBucket() {
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

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-thumbnail:${clientIpFromRequest(req)}`, 60, 60_000);
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Khong tim thay file' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File phai la hinh anh' }, { status: 400 });
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      return NextResponse.json({ error: 'Kich thuoc anh toi da 10MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const key = `thumbnails/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      }),
    );

    const url = makeProxyUrl(BUCKET_NAME, key);

    return NextResponse.json({
      success: true,
      url,
      public_id: key,
      storagePath: `s3://${BUCKET_NAME}/${key}`,
    });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: `Loi upload thumbnail (${detail})` }, { status: 500 });
  }
}
