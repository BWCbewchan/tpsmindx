import { NextRequest, NextResponse } from 'next/server';
import { formatGitHubNotification, verifyGitHubSignature } from '@/lib/github-telegram.mjs';
import { sendTelegramMessage } from '@/lib/telegram-delivery.mjs';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
    const result = await sendTelegramMessage({ token, chatId, text: message, parseMode: 'HTML' });
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    // Never log fetch errors: the URL contains the bot token.
    console.error('[GitHubWebhook] Telegram delivery failed', error instanceof Error ? error.message : 'UNKNOWN');
    return NextResponse.json({ error: 'Failed to notify Telegram' }, { status: 502 });
  }
}
