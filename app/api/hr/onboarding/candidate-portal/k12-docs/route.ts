import { NextResponse } from 'next/server';
import { loadK12Docs } from '@/lib/k12-docs';

export async function GET() {
  try {
    const docs = await loadK12Docs();
    return NextResponse.json({ success: true, data: docs });
  } catch (error) {
    console.error('[Candidate Portal K12 Docs] error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải tài liệu K12 Teaching.' },
      { status: 500 }
    );
  }
}
