import nodemailer from 'nodemailer'
import { canSafelyFailoverEmail } from '@/lib/email-delivery-policy'
import { classifyEmailError } from '@/lib/email-monitoring'

import { ensureEmailLogoInHtml, prepareEmailForSend } from '@/lib/email-branding'
import {
  getEmailAccountConfigurationSummary,
  getEmailSenderAccount,
  getFirstActiveEmailSenderAccount,
  recordEmailAccountVerification,
  selectNextEmailSenderAccount,
  type ResolvedEmailSenderAccount,
  type EmailSenderAccountListItem,
} from '@/lib/email-accounts'
import {
  normalizeEmailRecipients,
  recordEmailDelivery,
} from '@/lib/email-delivery-log'

export interface MailPayload {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  emailType?: string
  source?: string
  metadata?: Record<string, unknown>
  senderAccountId?: number
}

export interface MailSendResult {
  sent: boolean
  warning?: string
  messageId?: string
  response?: string
  durationMs: number
  senderAccountId?: number
  senderEmail?: string
}

function createAccountTransporter(account: ResolvedEmailSenderAccount) {
  return nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
    dnsTimeout: 5_000,
    auth: {
      user: account.email,
      pass: account.appPassword,
    },
  })
}

export async function getMailTransportConfiguration(accounts?: EmailSenderAccountListItem[]) {
  const ready = accounts?.filter(account => account.isActive && account.credentialConfigured)
  const summary = accounts && ready ? {
    configured: ready.length > 0, senderEmail: ready[0]?.email || null,
    activeAccountCount: ready.length, totalAccountCount: accounts.length,
  } : await getEmailAccountConfigurationSummary()
  return {
    configured: summary.configured,
    userConfigured: summary.configured,
    passwordConfigured: summary.configured,
    senderEmail: summary.senderEmail,
    provider: 'gmail',
    activeAccountCount: summary.activeAccountCount,
    totalAccountCount: summary.totalAccountCount,
  }
}

export async function verifyMailTransport(accountId?: number): Promise<{
  ok: boolean
  durationMs: number
  error?: string
  accountId?: number
  senderEmail?: string
}> {
  const startedAt = Date.now()
  let account: ResolvedEmailSenderAccount | null = null
  let transport: ReturnType<typeof createAccountTransporter> | null = null
  try {
    account = accountId ? await getEmailSenderAccount(accountId) : await getFirstActiveEmailSenderAccount()
    if (!account) return { ok: false, durationMs: Date.now() - startedAt, error: 'Chưa có tài khoản gửi mail đủ cấu hình.' }
    transport = createAccountTransporter(account)
    await transport.verify()
    await recordEmailAccountVerification(account.id, true)
    return { ok: true, durationMs: Date.now() - startedAt, accountId: account.id, senderEmail: account.email }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (accountId || account) await recordEmailAccountVerification(account?.id || accountId!, false, message)
    return { ok: false, durationMs: Date.now() - startedAt, error: message, accountId: account?.id || accountId, senderEmail: account?.email }
  } finally {
    transport?.close()
  }
}

export async function sendMail(payload: MailPayload): Promise<MailSendResult> {
  return sendMailAttempt(payload, [])
}

async function sendMailAttempt(payload: MailPayload, excludedIds: number[]): Promise<MailSendResult> {
  const startedAt = Date.now()
  const toRecipients = normalizeEmailRecipients(payload.to)
  const ccRecipients = normalizeEmailRecipients(payload.cc)
  const {
    emailType = 'unknown',
    source = 'app/api/emails',
    metadata,
    senderAccountId,
    ...mailOptions
  } = payload

  let account: ResolvedEmailSenderAccount | null = null
  try {
    account = senderAccountId
      ? await getEmailSenderAccount(senderAccountId)
      : await selectNextEmailSenderAccount(excludedIds)
    if (account && !account.isActive) throw Object.assign(new Error('Tài khoản gửi mail đang tắt. Hãy bật tài khoản trước khi gửi.'), { code: 'GMAIL_NOT_CONFIGURED' })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'skipped',
      senderAccountId: senderAccountId || null,
      senderEmail: null,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error,
      metadata,
    })
    throw error
  }

  if (!account) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'skipped',
      senderEmail: null,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error: {
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'No active Gmail account is configured',
      },
      metadata,
    })
    return { sent: false, warning: 'GMAIL_NOT_CONFIGURED', durationMs }
  }

  const transport = createAccountTransporter(account)
  try {
    const html = ensureEmailLogoInHtml(mailOptions.html)
    const { html: preparedHtml, attachments } = prepareEmailForSend(html)
    const info = await transport.sendMail({
      from: `"${account.displayName}" <${account.email}>`,
      ...mailOptions,
      html: preparedHtml,
      ...(attachments.length > 0 ? { attachments } : {}),
    })
    const durationMs = Date.now() - startedAt
    const messageId = String(info?.messageId ?? '')
    const response = String(info?.response ?? '')
    const rejected = Array.isArray(info?.rejected) ? info.rejected : []
    const accepted = Array.isArray(info?.accepted) ? info.accepted : []
    if (rejected.length > 0 && accepted.length === 0) {
      throw Object.assign(new Error('SMTP từ chối toàn bộ người nhận.'), { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 })
    }

    await recordEmailAccountVerification(account.id, true).catch(() => {})
    await recordEmailDelivery({
      status: 'sent',
      senderAccountId: account.id,
      senderEmail: account.email,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      providerMessageId: messageId,
      smtpResponse: response,
      metadata: {
        ...metadata,
        senderAccountKey: account.accountKey,
        senderAccountSource: account.source,
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
        pending: Array.isArray(info?.pending) ? info.pending : [],
      },
    })

    return {
      sent: true,
      ...(rejected.length ? { warning: 'PARTIAL_RECIPIENT_REJECTION' } : {}),
      messageId: messageId || undefined,
      response: response || undefined,
      durationMs,
      senderAccountId: account.id,
      senderEmail: account.email,
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const failure = classifyEmailError(error)
    if (['authentication', 'network', 'quota'].includes(failure.category)) {
      // Pause routing briefly, without changing the administrator's is_active flag.
      await recordEmailAccountVerification(account.id, false, failure.message).catch(() => {})
    }
    await recordEmailDelivery({
      status: 'failed',
      senderAccountId: account.id,
      senderEmail: account.email,
      toRecipients,
      ccRecipients,
      subject: payload.subject,
      emailType,
      source,
      durationMs,
      error,
      metadata: {
        ...metadata,
        senderAccountKey: account.accountKey,
        senderAccountSource: account.source,
      },
    })
    if (!senderAccountId && excludedIds.length < 1 && canSafelyFailoverEmail(error)) {
      transport.close()
      const fallback = await sendMailAttempt(payload, [...excludedIds, account.id])
      if (fallback.sent) return fallback
    }
    throw error
  } finally {
    transport.close()
  }
}
