import { recordPortfolioAnalytics } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await recordPortfolioAnalytics({
      portfolioId: body?.portfolioId,
      publicSlug: body?.publicSlug,
      sessionId: body?.sessionId,
      durationSeconds: Number(body?.durationSeconds || 0),
      userAgent: req.headers.get('user-agent'),
      referrer: req.headers.get('referer'),
      projectViews: Array.isArray(body?.projectViews) ? body.projectViews : [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể ghi nhận lượt xem portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
