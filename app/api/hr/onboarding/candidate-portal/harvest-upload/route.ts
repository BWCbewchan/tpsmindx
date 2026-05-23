import {
  createSupabaseS3Client,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-candidate-harvest';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

async function ensureBucket() {
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

function safeFilename(filename: string) {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
  const base = filename
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${base || 'harvest'}.${ext || 'bin'}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const candidateId = String(formData.get('candidate_id') || '').trim();
    const file = formData.get('file');

    if (!candidateId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu candidate_id' },
        { status: 400 },
      );
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn file thu hoạch' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File thu hoạch không được vượt quá 25MB' },
        { status: 400 },
      );
    }

    const contentType = file.type || 'application/octet-stream';
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ PDF, Word, Excel hoặc ảnh' },
        { status: 400 },
      );
    }

    await ensureBucket();
    const client = createSupabaseS3Client();
    const key = `harvest/${candidateId}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `/api/storage-image?bucket=${encodeURIComponent(BUCKET_NAME)}&key=${encodeURIComponent(key)}`;

    return NextResponse.json({
      success: true,
      data: {
        url,
        bucket: BUCKET_NAME,
        key,
        filename: file.name,
      },
    });
  } catch (error: any) {
    console.error('[Candidate Harvest Upload]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể upload file thu hoạch' },
      { status: 500 },
    );
  }
}
