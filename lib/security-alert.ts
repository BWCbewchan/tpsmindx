/**
 * security-alert.ts
 * ─────────────────────────────────────────────────────────────
 * Gửi cảnh báo bảo mật real-time khi phát hiện sự kiện CRITICAL.
 * Hỗ trợ: Telegram Bot, Email (qua SMTP đã có trong .env)
 *
 * Cách kích hoạt:
 *   1. Thêm vào .env:
 *      TELEGRAM_BOT_TOKEN=<token từ @BotFather>
 *      TELEGRAM_CHAT_ID=<chat_id của admin/group>
 *   2. Gọi sendSecurityAlert() sau khi writeAuditLog() cho event CRITICAL
 * ─────────────────────────────────────────────────────────────
 */

import type { AuditEvent } from '@/lib/audit-logger';
import { sendTelegramMessage, telegramHtml } from './telegram-delivery.mjs';

// ─── Config ──────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const APP_NAME           = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.tpsmindx.com/';

// Chỉ gửi alert cho các severity này
const ALERT_SEVERITIES = new Set(['CRITICAL', 'HIGH']);

// Chỉ gửi alert cho các event type này (tránh spam INFO)
const ALERT_EVENT_TYPES = new Set([
  'PRIVILEGE_ESCALATION',
  'AUTH',
]);

// ─── Icon mapping ─────────────────────────────────────────────

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: '🚨',
  HIGH:     '🔴',
  WARNING:  '🟡',
  INFO:     '🟢',
};

const EVENT_ICON: Record<string, string> = {
  PRIVILEGE_ESCALATION: '⚡',
  AUTH:                 '🔐',
  DATA_MUTATION:        '📝',
  SENSITIVE_DATA_ACCESS:'👁️',
  SYSTEM:               '⚙️',
  GENERAL:              'ℹ️',
};

function eventActorLabel(event: AuditEvent): string {
  if (event.user_email) return event.user_email;
  return event.event_type === 'SYSTEM' ? 'system-event' : 'invalid-session-email';
}

// ─── Core alert function ──────────────────────────────────────

/**
 * Gửi security alert qua Telegram khi event đủ nghiêm trọng.
 * Fire-and-forget — không block response.
 */
export function sendSecurityAlert(event: AuditEvent & { id?: number }): void {
  // Bỏ qua nếu không đủ nghiêm trọng
  if (!ALERT_SEVERITIES.has(event.severity))  return;

  // Bỏ qua các event type không cần alert (DATA_MUTATION bình thường không alert)
  const isPrivEsc    = event.event_type === 'PRIVILEGE_ESCALATION';
  const isBruteForce = event.action?.includes('BRUTE_FORCE');
  const isCritical   = event.severity === 'CRITICAL';
  const isMissingActor = event.threat_flags?.includes('MISSING_ACTOR_EMAIL') === true;
  const actorLabel = eventActorLabel(event);

  if (!isPrivEsc && !isBruteForce && !isCritical && !isMissingActor) return;

  // Gửi qua Telegram nếu đã cấu hình
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    sendTelegramAlert(event).catch((err) => {
      console.error('[SecurityAlert] Telegram failed:', err.message);
    });
  } else {
    // Fallback: log ra console với format dễ nhìn
    const sev = event.severity;
    const icon = SEVERITY_ICON[sev] ?? '⚠️';
    console.warn(
      `\n${icon} SECURITY ALERT [${sev}]\n` +
      `  Action:  ${event.action}\n` +
      `  User:    ${actorLabel} (${event.user_role ?? 'no role'})\n` +
      `  IP:      ${event.ip_address ?? 'unknown'}\n` +
      `  Flags:   ${event.threat_flags?.join(', ') ?? 'none'}\n` +
      `  Risk:    ${event.risk_score}/100\n` +
      `  Endpoint: ${event.endpoint ?? 'N/A'}\n` +
      '─'.repeat(50)
    );
  }
}

// ─── Telegram ────────────────────────────────────────────────

async function sendTelegramAlert(event: AuditEvent & { id?: number }): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const sevIcon   = SEVERITY_ICON[event.severity]   ?? '⚠️';
  const now       = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const flags = event.threat_flags?.length ? event.threat_flags.join(', ') : 'none';

  // Dynamic audit data must not be interpreted as Telegram markup.
  const safeMessage = [
    `${sevIcon} <b>SECURITY ALERT — ${telegramHtml(event.severity)}</b>`,
    `App: ${telegramHtml(APP_NAME)}`,
    `Event: <code>${telegramHtml(event.action)}</code>`,
    `User: <code>${telegramHtml(eventActorLabel(event))}</code>`,
    `Role: ${telegramHtml(event.user_role ?? 'N/A')}`,
    `IP: <code>${telegramHtml(event.ip_address ?? 'unknown')}</code>`,
    `Endpoint: <code>${telegramHtml(event.endpoint ?? 'N/A')}</code>`,
    `Flags: ${telegramHtml(flags)}`,
    `Risk: ${telegramHtml(event.risk_score)}/100`,
    event.old_data ? `Trước: <code>${telegramHtml(JSON.stringify(event.old_data), 200)}</code>` : '',
    event.new_data ? `Sau: <code>${telegramHtml(JSON.stringify(event.new_data), 200)}</code>` : '',
    `Thời gian: ${telegramHtml(now)}`,
    event.id ? `Log ID: #${telegramHtml(event.id)}` : '',
  ].filter(Boolean).join('\n');

  const bodyPayload: Record<string, unknown> = {};

  // Đính kèm các nút tương tác thông minh (Inline Keyboard Buttons) nếu có IP nguồn
  if (event.ip_address && event.ip_address !== 'unknown') {
    bodyPayload.reply_markup = {
      inline_keyboard: [
        [
          { text: '🛡️ Khóa IP (24h)', callback_data: `tgblock:${event.ip_address}` },
          { text: '🔓 Mở khóa IP', callback_data: `tgunblock:${event.ip_address}` }
        ]
      ]
    };
  }

  await sendTelegramMessage({ token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID,
    text: safeMessage, parseMode: 'HTML', replyMarkup: bodyPayload.reply_markup });
}

// ─── Email alert (backup nếu không dùng Telegram) ─────────────

/**
 * Gửi email cảnh báo qua nodemailer (dùng config SMTP trong .env)
 * Chỉ dùng khi TELEGRAM_BOT_TOKEN chưa được setup
 */
export async function sendEmailAlert(event: AuditEvent & { id?: number }): Promise<void> {
  if (TELEGRAM_BOT_TOKEN) return; // Ưu tiên Telegram

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const now  = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const icon = SEVERITY_ICON[event.severity] ?? '⚠️';

  const startedAt = Date.now();
  const { normalizeEmailRecipients, recordEmailDelivery } =
    await import('@/lib/email-delivery-log');
  const toRecipients = normalizeEmailRecipients(adminEmail);

  try {
    const nodemailer = await import('nodemailer');
    const { ensureEmailLogoInHtml, prepareEmailForSend } = await import('@/lib/email-branding');
    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST    ?? 'smtp.gmail.com',
      port:   parseInt(process.env.MAIL_PORT ?? '465', 10),
      secure: true,
      auth: {
        user: process.env.MAILDEV_INCOMING_USER,
        pass: process.env.MAILDEV_INCOMING_PASS,
      },
    });

    const alertHtml = ensureEmailLogoInHtml(`
        <h2>${icon} Security Alert — ${event.severity}</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:monospace">
          <tr><td><b>Action</b></td><td>${event.action}</td></tr>
          <tr><td><b>User</b></td><td>${eventActorLabel(event)}</td></tr>
          <tr><td><b>Role</b></td><td>${event.user_role ?? 'N/A'}</td></tr>
          <tr><td><b>IP</b></td><td>${event.ip_address ?? 'unknown'}</td></tr>
          <tr><td><b>Endpoint</b></td><td>${event.endpoint ?? 'N/A'}</td></tr>
          <tr><td><b>Threat Flags</b></td><td>${event.threat_flags?.join(', ') ?? 'none'}</td></tr>
          <tr><td><b>Risk Score</b></td><td>${event.risk_score}/100</td></tr>
          <tr><td><b>Time</b></td><td>${now}</td></tr>
          ${event.old_data ? `<tr><td><b>Before</b></td><td><pre>${JSON.stringify(event.old_data, null, 2)}</pre></td></tr>` : ''}
          ${event.new_data ? `<tr><td><b>After</b></td><td><pre>${JSON.stringify(event.new_data, null, 2)}</pre></td></tr>` : ''}
        </table>
      `);
    const { html, attachments } = prepareEmailForSend(alertHtml);

    const info = await transporter.sendMail({
      from:    `"TMS Security" <${process.env.MAILDEV_INCOMING_USER}>`,
      to:      adminEmail,
      subject: `${icon} [${event.severity}] Security Alert — ${event.action}`,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    await recordEmailDelivery({
      status: 'sent',
      senderEmail: process.env.MAILDEV_INCOMING_USER,
      toRecipients,
      ccRecipients: [],
      subject: `${icon} [${event.severity}] Security Alert — ${event.action}`,
      emailType: 'security_alert',
      source: 'lib/security-alert',
      durationMs: Date.now() - startedAt,
      providerMessageId: String(info?.messageId ?? ''),
      smtpResponse: String(info?.response ?? ''),
      metadata: {
        severity: event.severity,
        action: event.action,
        auditEventId: event.id ?? null,
      },
    });
  } catch (err) {
    await recordEmailDelivery({
      status: 'failed',
      senderEmail: process.env.MAILDEV_INCOMING_USER,
      toRecipients,
      ccRecipients: [],
      subject: `${icon} [${event.severity}] Security Alert — ${event.action}`,
      emailType: 'security_alert',
      source: 'lib/security-alert',
      durationMs: Date.now() - startedAt,
      error: err,
      metadata: {
        severity: event.severity,
        action: event.action,
        auditEventId: event.id ?? null,
      },
    });
    console.error('[SecurityAlert] Email failed:', (err as Error).message);
  }
}
