import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import {
  MAX_TRUYENTHONG_IMAGE_BYTES,
  TRUYENTHONG_CONTENT_IMAGE_BUCKET,
  hasAllowedTruyenThongImageSignature,
  isAllowedTruyenThongImageContentType,
  uploadTruyenThongImageBuffer,
} from '@/lib/truyenthong-image-upload';
import { requireTruyenThongPostAdminMutation } from '@/lib/truyenthong-posts';
import { isSupabaseS3Configured } from '@/lib/supabase-s3';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireTruyenThongPostAdminMutation(req);
    if (denied) return denied;

    const rl = await rateLimitOr429Async(`truyenthong-upload-image:${clientIpFromRequest(req)}`, 60, 60_000);
    if (rl) return rl;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Request upload khong hop le' }, { status: 400 });
    }

    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Khong tim thay file' }, { status: 400 });
    }
    const contentType = file.type.trim().toLowerCase();
    if (!isAllowedTruyenThongImageContentType(contentType)) {
      return NextResponse.json({ error: 'Chi ho tro anh JPG, PNG, WEBP hoac GIF' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_TRUYENTHONG_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Kich thuoc anh toi da 10MB' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasAllowedTruyenThongImageSignature(buffer, contentType)) {
      return NextResponse.json({ error: 'Noi dung file khong dung dinh dang anh' }, { status: 400 });
    }

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const uploaded = await uploadTruyenThongImageBuffer({
      bucket: TRUYENTHONG_CONTENT_IMAGE_BUCKET,
      keyPrefix: 'post-images',
      buffer,
      contentType,
    });

    return NextResponse.json({
      success: true,
      url: uploaded.url,
      public_id: uploaded.key,
      storagePath: uploaded.storagePath,
      bucket: uploaded.bucket,
    });
  } catch (error) {
    console.error('Upload communication image error:', error);
    return NextResponse.json({ error: 'Loi server khi upload anh' }, { status: 500 });
  }
}
