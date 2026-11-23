import pool from '@/lib/db'
import { alertEmailFailure } from '@/lib/email-failure-alert'
import {
  classifyEmailError,
  type EmailErrorCategory,
} from '@/lib/email-monitoring'

export type EmailDeliveryStatus = 'sent' | 'failed' | 'skipped'

export interface EmailDeliveryLogInput {
  status: EmailDeliveryStatus
  senderAccountId?: number | null
  senderEmail?: string | null
  toRecipients: string[]
  ccRecipients: string[]
  subject: string
  emailType?: string
  source?: string
  durationMs: number
  providerMessageId?: string | null
  smtpResponse?: string | null
  error?: unknown
  metadata?: Record<string, unknown>
}

function truncate(value: unknown, maxLength: number): string | null {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, maxLength) : null
}

export function normalizeEmailRecipients(
  value: string | string[] | undefined,
): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of raw) {
    for (const candidate of String(item).split(',')) {
      const email = candidate.trim()
      const key = email.toLowerCase()
      if (!email || seen.has(key)) continue
      seen.add(key)
      result.push(email.slice(0, 320))
    }
  }

  return result
}

export async function recordEmailDelivery(
  input: EmailDeliveryLogInput,
): Promise<void> {
  try {
    const errorDetails = input.error
      ? classifyEmailError(input.error)
      : {
          category: null as EmailErrorCategory | null,
          code: null,
          message: null,
          responseCode: null,
          retryable: false,
        }

    const result = await pool.query(
      `INSERT INTO email_delivery_logs (
        status,
        sender_account_id,
        sender_email,
        to_recipients,
        cc_recipients,
        recipient_count,
        to_recipient_count,
        cc_recipient_count,
        subject,
        email_type,
        source,
        duration_ms,
        provider_message_id,
        smtp_response,
        error_code,
        error_category,
        error_message,
        response_code,
        retryable,
        metadata,
        completed_at
      ) VALUES (
        $1, $2, $3, $4::text[], $5::text[], $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, CURRENT_TIMESTAMP
      ) RETURNING id`,
      [
        input.status,
        input.senderAccountId || null,
        truncate(input.senderEmail, 255),
        input.toRecipients,
        input.ccRecipients,
        input.toRecipients.length + input.ccRecipients.length,
        input.toRecipients.length,
        input.ccRecipients.length,
        truncate(input.subject, 1000) || '',
        truncate(input.emailType, 120) || 'unknown',
        truncate(input.source, 255) || 'unknown',
        Math.max(0, Math.round(input.durationMs)),
        truncate(input.providerMessageId, 500),
        truncate(input.smtpResponse, 2000),
        truncate(errorDetails.code, 100),
        errorDetails.category,
        truncate(errorDetails.message, 2000),
        errorDetails.responseCode,
        errorDetails.retryable,
        JSON.stringify(input.metadata || {}),
      ],
    )
    const logId = Number(result.rows[0]?.id)
    if ((input.status === 'failed' || input.status === 'skipped' ||
      (Array.isArray(input.metadata?.rejected) && input.metadata.rejected.length > 0)) && logId) {
      await alertEmailFailure(input.status === 'sent' ? {
        ...input,
        error: { code: 'PARTIAL_RECIPIENT_REJECTION', message: 'recipient address rejected', responseCode: 550 },
      } : input, logId).catch(() => {
        console.error('[email-monitor] Telegram alert failed; delivery log retained:', logId)
      })
    }
  } catch (error) {
    console.error('[email-monitor] Failed to write delivery log:', error)
  }
}
