import { NextRequest, NextResponse } from 'next/server';
import { formatGitHubNotification, verifyGitHubSignature, getCIFailures } from '@/lib/github-telegram.mjs';
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
  if (event === 'workflow_run' && payload && typeof payload === 'object') {
    payload.ci_failures = await getCIFailures(payload, { token: process.env.GITHUB_READ_TOKEN });
  }
  // Vercel sometimes sends a commit SHA as deployment.ref. Resolve only the
  // current release branches, never infer a personal branch from "Preview".
  if (event === 'deployment_status' && payload?.deployment_status?.state === 'success'
    && /^[a-f0-9]{40}$/i.test(payload?.deployment?.ref || '')
    && payload?.repository?.full_name === 'BWCbewchan/tpsmindx') {
    try {
      const production = payload.deployment.production_environment === true
        || /^production$/i.test(payload.deployment_status.environment || payload.deployment.environment || '');
      const branch = production ? 'main' : 'preview';
      const response = await fetch(`https://api.github.com/repos/BWCbewchan/tpsmindx/branches/${branch}`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return NextResponse.json({ error: 'Cannot resolve deployment branch' }, { status: 502 });
      const current = await response.json();
      if (current.commit?.sha === payload.deployment.sha) payload.deployment.ref = branch;
    } catch {
      return NextResponse.json({ error: 'Cannot resolve deployment branch' }, { status: 502 });
    }
  }
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
