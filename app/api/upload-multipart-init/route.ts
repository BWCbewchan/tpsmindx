/**
 * Khởi tạo multipart upload cho video lớn.
 * Trả về uploadId để client dùng cho các part tiếp theo.
 */
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, CreateMultipartUploadCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';

async function ensureBucket() {
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json();
    const { filename, contentType = 'video/mp4' } = body;

    if (!filename) {
      return NextResponse.json({ error: 'Thiếu filename' }, { status: 400 });
    }

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = filename.includes('.') ? filename.split('.').pop() : 'mp4';
    const baseName = filename
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // bỏ dấu tiếng Việt
      .replace(/đ/g, 'd').replace(/Đ/g, 'd')             // đ không bị NFD
      .replace(/[^a-z0-9]+/g, '-')                       // chỉ giữ a-z0-9
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'video';
    const key = `video_dtnc/${Date.now()}-${baseName}.${ext}`;

    const result = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      })
    );

    return NextResponse.json({
      success: true,
      uploadId: result.UploadId,
      key,
      bucket: BUCKET_NAME,
    });
  } catch (error: any) {
    console.error('Multipart init error:', error);
    return NextResponse.json({ error: 'Không thể khởi tạo multipart upload' }, { status: 500 });
  }
}
