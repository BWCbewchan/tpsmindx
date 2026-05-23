import { createSupabaseS3Client, getSignedObjectUrl, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { withApiProtection } from '@/lib/api-protection';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'feedback-images';

async function ensureBucket() {
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ success: false, error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Chỉ hỗ trợ file ảnh' }, { status: 400 });
    }

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const filePath = `feedback/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filePath,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    const signedUrl = await getSignedObjectUrl(BUCKET_NAME, filePath, 24 * 60 * 60);
    return NextResponse.json({
      success: true,
      url: signedUrl,
      storagePath: `s3://${BUCKET_NAME}/${filePath}`,
      path: filePath,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể upload ảnh feedback' },
      { status: 500 }
    );
  }
});
