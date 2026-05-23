import {
  MAX_QUESTION_IMAGE_BYTES,
  QUESTION_IMAGE_BUCKET,
  uploadQuestionImageBuffer,
} from '@/lib/question-image-storage';
import { isSupabaseS3Configured } from '@/lib/supabase-s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<Response> {
  try {
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

    if (file.size > MAX_QUESTION_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Kich thuoc anh toi da 10MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploaded = await uploadQuestionImageBuffer(
      Buffer.from(arrayBuffer),
      file.type || 'image/png',
      file.name,
    );

    return NextResponse.json({
      success: true,
      url: uploaded.url,
      public_id: uploaded.key,
      storagePath: uploaded.storagePath,
      bucket: QUESTION_IMAGE_BUCKET,
    });
  } catch (error) {
    console.error('Upload question image error:', error);
    return NextResponse.json({ error: 'Loi server khi upload anh' }, { status: 500 });
  }
}
