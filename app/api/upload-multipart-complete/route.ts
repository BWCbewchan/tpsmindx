/**
 * Hoàn tất multipart upload.
 * Client gửi uploadId, key, và danh sách parts (ETag + PartNumber).
 * Trả về public URL của video đã upload.
 */
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json();
    const { bucket, key, uploadId, parts } = body;

    if (!bucket || !key || !uploadId || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'Thiếu thông tin complete upload' }, { status: 400 });
    }

    const client = createSupabaseS3Client();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p: any) => ({
            ETag: p.ETag,
            PartNumber: p.PartNumber,
          })),
        },
      })
    );

    const url = makeProxyUrl(bucket, key);

    return NextResponse.json({
      success: true,
      url,
      key,
      storagePath: `s3://${bucket}/${key}`,
    });
  } catch (error: any) {
    console.error('Multipart complete error:', error);
    return NextResponse.json({ error: 'Không thể hoàn tất upload' }, { status: 500 });
  }
}
