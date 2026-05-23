/**
 * Upload một part của multipart upload.
 * Client gửi part number, uploadId, key, và binary data.
 * Trả về ETag để client dùng khi complete.
 */
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await req.formData();
    const bucket = formData.get('bucket') as string;
    const key = formData.get('key') as string;
    const uploadId = formData.get('uploadId') as string;
    const partNumber = parseInt(formData.get('partNumber') as string, 10);
    const file = formData.get('file');

    if (!bucket || !key || !uploadId || !partNumber || !file || typeof file === 'string') {
      return NextResponse.json({ error: 'Thiếu thông tin part upload' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[S3 Upload] Uploading part ${partNumber} for ${key}, size: ${buffer.length} bytes`);

    const client = createSupabaseS3Client();
    const result = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      })
    );

    return NextResponse.json({
      success: true,
      ETag: result.ETag,
      PartNumber: partNumber,
    });
  } catch (error: any) {
    console.error('Multipart part upload error:', error);
    
    // Trả về chi tiết lỗi để frontend hiển thị chính xác
    let errorMessage = error instanceof Error ? error.message : 'Không thể upload part';
    const errorName = error?.name || 'S3Error';
    
    // Bổ sung hướng dẫn cho lỗi EntityTooLarge (thường do giới hạn Supabase)
    if (errorName === 'EntityTooLarge' || errorMessage.includes('EntityTooLarge')) {
      errorMessage = 'File quá lớn so với giới hạn của Supabase (mặc định 50MB). Vui lòng vào Supabase Dashboard > Storage > Settings để tăng "Maximum File Size".';
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: errorName,
      code: error?.$metadata?.httpStatusCode || 500
    }, { status: 500 });
  }
}
