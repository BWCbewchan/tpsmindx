import { NextRequest, NextResponse } from 'next/server';
import { formatGitHubNotification, verifyGitHubSignature } from '@/lib/github-telegram.mjs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const body = await request.text();
  // Preserve the existing notification webhook configuration: older installations
  // have Telegram credentials but no signing secret. Enforce HMAC whenever set.
  if (secret && !verifyGitHubSignature(body, request.headers.get('x-hub-signature-256') || '', secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let payload;
  try { payload = JSON.parse(body); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const event = request.headers.get('x-github-event') || '';
  if (event === 'ping') return NextResponse.json({ success: true, message: 'pong' });
  const message = formatGitHubNotification(event, payload);
  if (!message) return NextResponse.json({ success: true, message: 'Event ignored' });
  const token = process.env.GITHUB_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.GITHUB_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return NextResponse.json({ error: 'Telegram credentials not configured' }, { status: 503 });
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      console.error('[GitHubWebhook] Telegram delivery failed', { status: response.status, errorCode: result.error_code });
      return NextResponse.json({ error: 'Failed to notify Telegram' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch {
    // Never log fetch errors: the URL contains the bot token.
    console.error('[GitHubWebhook] Telegram request failed or timed out');
    return NextResponse.json({ error: 'Failed to notify Telegram' }, { status: 502 });
  }
}
