import { createHash, randomBytes } from 'node:crypto'

import { renderTemplate } from '@/app/api/emails/render'
import { sendMail, type MailSendResult } from '@/app/api/emails/transporter'
import { recordEmailDelivery } from '@/lib/email-delivery-log'
import { getPublicBaseUrl } from '@/lib/public-base-url'

const QC_EMAIL_SOURCE = 'app/api/admin/quan-ly-qc'
const QC_SIGNATURE_TOKEN_BYTES = 32

export type QCSignatureEmailResult = {
  ok: boolean
  sent: boolean
  warning?: string
  error?: string
  recipients?: { to: string[]; cc?: string[] }
  messageId?: string
  senderEmail?: string
  durationMs?: number
}

export type QCSignatureRecordLike = {
  id: number | string
  template_title?: string | null
  class_name?: string | null
  center_name?: string | null
  teacher_name?: string | null
  teacher_email?: string | null
  teacher_code?: string | null
  session_index?: number | string | null
  session_date?: string | Date | null
  total_score?: string | number | null
  max_score?: string | number | null
  result_label?: string | null
  created_by_email?: string | null
  created_by_name?: string | null
  general_note?: string | null
}

function toText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim()
}

export function escapeHtml(value: unknown): string {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(value: unknown): string {
  const text = toText(value)
  if (!text) return '—'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatScore(score: unknown, maxScore: unknown): string {
  const total = Number(score)
  const max = Number(maxScore) || 10
  const display = max > 0 && max !== 10 ? (total / max) * 10 : total
  if (!Number.isFinite(display)) return '—'
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(display)} / 10`
}

function uniqueEmails(...raw: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  raw.forEach((value) => {
    const email = toText(value)
    if (!email) return
    const key = email.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(email)
  })
  return out
}

function splitEnvEmails(value: string | undefined): string[] {
  return uniqueEmails(...toText(value).split(/[;,]/).map((item) => item.trim()))
}

function toEmailResult(
  sendResult: MailSendResult,
  recipients: { to: string[]; cc?: string[] },
): QCSignatureEmailResult {
  return {
    ok: true,
    sent: sendResult.sent,
    warning: sendResult.warning,
    recipients,
    messageId: sendResult.messageId,
    senderEmail: sendResult.senderEmail,
    durationMs: sendResult.durationMs,
  }
}

export function createQCSignatureToken(): { token: string; tokenHash: string } {
  const token = randomBytes(QC_SIGNATURE_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashQCSignatureToken(token) }
}

export function hashQCSignatureToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function getQCSignatureUrl(token: string): string {
  return `${getPublicBaseUrl()}/public/quan-ly-qc/signature/${encodeURIComponent(token)}`
}

export function resolveTeacherMindxEmail(record: QCSignatureRecordLike): string {
  const teacherEmail = toText(record.teacher_email)
  if (teacherEmail.toLowerCase().endsWith('@mindx.net.vn')) return teacherEmail

  return ''
}

export function qcEmailResultToStatus(result: QCSignatureEmailResult): {
  status: 'sent' | 'failed' | 'skipped'
  error: string | null
} {
  if (result.sent) return { status: 'sent', error: null }
  if (result.warning) return { status: 'skipped', error: result.warning }
  return { status: 'failed', error: result.error || 'Không gửi được email ký xác nhận QC' }
}

export async function sendQCSignatureRequestEmail(
  record: QCSignatureRecordLike,
  token: string,
  metadata?: Record<string, unknown>,
): Promise<QCSignatureEmailResult> {
  const teacherEmail = resolveTeacherMindxEmail(record)
  const subject = `[MindX | Biên bản QC] Xác nhận phiếu QC - ${toText(record.class_name, 'Lớp học')}`

  if (!teacherEmail) {
    const warning = 'MISSING_TEACHER_MINDX_NET_EMAIL'
    await recordEmailDelivery({
      status: 'skipped',
      senderEmail: null,
      toRecipients: [],
      ccRecipients: [],
      subject,
      emailType: 'qc_signature_request',
      source: QC_EMAIL_SOURCE,
      durationMs: 0,
      error: { code: warning, message: 'Phiếu QC thiếu email giáo viên @mindx.net.vn' },
      metadata: {
        qcRecordId: record.id,
        teacherEmail: record.teacher_email || null,
        teacherCode: record.teacher_code || null,
        ...metadata,
      },
    })
    return { ok: false, sent: false, warning }
  }

  const signatureUrl = getQCSignatureUrl(token)
  const html = renderTemplate('qc-signature-request', {
    teacher_name: escapeHtml(record.teacher_name || 'Giáo viên MindX'),
    teacher_email: escapeHtml(teacherEmail),
    teacher_code: escapeHtml(record.teacher_code || '—'),
    class_name: escapeHtml(record.class_name || '—'),
    center_name: escapeHtml(record.center_name || '—'),
    template_title: escapeHtml(record.template_title || 'Phiếu QC'),
    session_label: escapeHtml(record.session_index ? `Buổi ${record.session_index}` : '—'),
    session_date: escapeHtml(formatDateTime(record.session_date)),
    score: escapeHtml(formatScore(record.total_score, record.max_score)),
    result_label: escapeHtml(record.result_label || '—'),
    leader_name: escapeHtml(record.created_by_name || record.created_by_email || 'Leader/TE'),
    leader_email: escapeHtml(record.created_by_email || '—'),
    general_note: escapeHtml(record.general_note || '—'),
    signature_url: signatureUrl,
  })

  const recipients = { to: [teacherEmail] }

  try {
    const sendResult = await sendMail({
      to: recipients.to,
      subject,
      html,
      emailType: 'qc_signature_request',
      source: QC_EMAIL_SOURCE,
      metadata: {
        qcRecordId: record.id,
        className: record.class_name,
        teacherEmail,
        signatureUrl,
        ...metadata,
      },
    })
    return toEmailResult(sendResult, recipients)
  } catch (error) {
    return {
      ok: false,
      sent: false,
      error: error instanceof Error ? error.message : String(error),
      recipients,
    }
  }
}

export async function sendQCAppealNotificationEmail(
  record: QCSignatureRecordLike,
  appealNote: string,
  metadata?: Record<string, unknown>,
): Promise<QCSignatureEmailResult> {
  const to = uniqueEmails(record.created_by_email)
  const cc = splitEnvEmails(process.env.QC_APPEAL_CC_EMAILS)
    .filter((email) => !to.some((item) => item.toLowerCase() === email.toLowerCase()))
  const subject = `[MindX | Phúc khảo QC] ${toText(record.teacher_name, 'Giáo viên')} - ${toText(record.class_name, 'Lớp học')}`

  if (to.length === 0) {
    return {
      ok: false,
      sent: false,
      warning: 'MISSING_QC_APPEAL_RECIPIENT',
    }
  }

  const html = renderTemplate('qc-appeal-notification', {
    teacher_name: escapeHtml(record.teacher_name || '—'),
    teacher_email: escapeHtml(record.teacher_email || '—'),
    teacher_code: escapeHtml(record.teacher_code || '—'),
    class_name: escapeHtml(record.class_name || '—'),
    center_name: escapeHtml(record.center_name || '—'),
    template_title: escapeHtml(record.template_title || 'Phiếu QC'),
    session_label: escapeHtml(record.session_index ? `Buổi ${record.session_index}` : '—'),
    session_date: escapeHtml(formatDateTime(record.session_date)),
    score: escapeHtml(formatScore(record.total_score, record.max_score)),
    result_label: escapeHtml(record.result_label || '—'),
    leader_name: escapeHtml(record.created_by_name || record.created_by_email || 'Leader/TE'),
    appeal_note: escapeHtml(appealNote),
  })

  const recipients = { to, ...(cc.length > 0 ? { cc } : {}) }

  try {
    const sendResult = await sendMail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      html,
      emailType: 'qc_appeal_requested',
      source: QC_EMAIL_SOURCE,
      metadata: {
        qcRecordId: record.id,
        className: record.class_name,
        teacherEmail: record.teacher_email,
        ...metadata,
      },
    })
    return toEmailResult(sendResult, recipients)
  } catch (error) {
    return {
      ok: false,
      sent: false,
      error: error instanceof Error ? error.message : String(error),
      recipients,
    }
  }
}
