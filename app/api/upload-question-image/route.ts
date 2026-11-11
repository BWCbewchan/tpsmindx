import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import {
  MAX_QUESTION_IMAGE_BYTES,
  QUESTION_IMAGE_BUCKET,
  uploadQuestionImageBuffer,
} from '@/lib/question-image-storage';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { isSupabaseS3Configured } from '@/lib/supabase-s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-question-image:${clientIpFromRequest(req)}`, 60, 60_000);
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
    if (file.size > MAX_QUESTION_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Kich thuoc anh toi da 10MB' }, { status: 400 });
    }

    const uploaded = await uploadQuestionImageBuffer(
      Buffer.from(await file.arrayBuffer()),
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
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: `Loi server khi upload anh (${detail})` }, { status: 500 });
  }
}

