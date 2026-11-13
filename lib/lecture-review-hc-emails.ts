import { renderTemplate } from '@/app/api/emails/render'
import nodemailer from 'nodemailer'
import {
  ensureEmailLogoInHtml,
  prepareEmailForSend,
} from '@/lib/email-branding'
import {
  normalizeEmailRecipients,
  recordEmailDelivery,
} from '@/lib/email-delivery-log'
import {
  getLectureReviewHcRecipient,
  resolveLectureReviewHcArea,
  type LectureReviewHcArea,
  type LectureReviewHcRecipient,
} from '@/lib/lecture-review-hc-routing'

export {
  getLectureReviewHcRecipient,
  resolveLectureReviewHcArea,
} from '@/lib/lecture-review-hc-routing'

const LECTURE_REVIEW_EMAIL_SOURCE = 'app/api/lecture-review-applications'

type LectureReviewMailSendResult = {
  sent: boolean
  warning?: string
  messageId?: string
  response?: string
  durationMs: number
  senderEmail?: string
}

type LectureReviewEmailSender = {
  accountKey: string
  email: string
  appPassword: string
  displayName: string
}

type LectureReviewMailPayload = {
  to: string | string[]
  subject: string
  html: string
  metadata?: Record<string, unknown>
}

function normalizeAppPassword(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '')
}

export type LectureReviewHcInvitationData = {
  applicationId: number | string
  candidateName: string
  lmsCode: string
  reviewDate: string
  reviewTime: string
  teachingBlock: string
  centerId: number
  centerName: string
  roomName: string
  centerRegion?: string | null
  leaderName: string
  reviewerName: string
  registeredByName: string
  registeredByEmail: string
  participationLink?: string
}

export type LectureReviewHcEmailResult = {
  ok: boolean
  sent: boolean
  area: LectureReviewHcArea
  recipient: LectureReviewHcRecipient
  warning?: string
  error?: string
  messageId?: string
  senderEmail?: string
  durationMs?: number
}

const BLOCK_LABELS: Record<string, string> = {
  coding: 'Coding (C4K; C4T)',
  art: 'Art (XART)',
  robotics: 'Robotics (ROB)',
  age_4_plus: '4+ (KIND/ROB4)',
}

const AREA_LABELS: Record<LectureReviewHcArea, string> = {
  hn: 'Hà Nội',
  hcm: 'Hồ Chí Minh',
  province: 'Tỉnh',
}

function formatReviewDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toEmailResult(
  sendResult: LectureReviewMailSendResult,
  area: LectureReviewHcArea,
  recipient: LectureReviewHcRecipient,
): LectureReviewHcEmailResult {
  return {
    ok: true,
    sent: sendResult.sent,
    area,
    recipient,
    warning: sendResult.warning,
    messageId: sendResult.messageId,
    senderEmail: sendResult.senderEmail,
    durationMs: sendResult.durationMs,
  }
}

/**
 * Chỉ dùng cho mail duyệt giảng. Đọc credential trực tiếp từ environment của
 * instance hiện tại, không đồng bộ hoặc thay đổi trạng thái tài khoản email
 * trong database dùng chung với luồng xin nghỉ.
 */
function getLectureReviewEmailSender(): LectureReviewEmailSender | null {
  const candidates: LectureReviewEmailSender[] = [
    {
      accountKey: 'lecture-review-dedicated',
      email: String(process.env.LECTURE_REVIEW_EMAIL_USER || '').trim(),
      appPassword: normalizeAppPassword(
        process.env.LECTURE_REVIEW_EMAIL_APP_PASSWORD,
      ),
      displayName:
        String(process.env.LECTURE_REVIEW_EMAIL_SENDER_NAME || '').trim() ||
        'TPS Teaching',
    },
    {
      accountKey: 'env-secondary',
      email: String(process.env.EMAIL_ACCOUNT_2_USER || '').trim(),
      appPassword: normalizeAppPassword(
        process.env.EMAIL_ACCOUNT_2_APP_PASSWORD,
      ),
      displayName:
        String(process.env.EMAIL_ACCOUNT_2_NAME || '').trim() ||
        'TPS HR Teaching',
    },
    {
      accountKey: 'env-primary',
      email: String(
        process.env.GMAIL_USER || process.env.MAILDEV_INCOMING_USER || '',
      ).trim(),
      appPassword: normalizeAppPassword(
        process.env.GMAIL_APP_PASSWORD ||
          process.env.MAILDEV_INCOMING_PASS ||
          '',
      ),
      displayName:
        String(process.env.EMAIL_ACCOUNT_1_NAME || '').trim() ||
        'TPS Teaching',
    },
  ]

  return (
    candidates.find((candidate) => candidate.email && candidate.appPassword) ||
    null
  )
}

async function sendLectureReviewMail(
  payload: LectureReviewMailPayload,
): Promise<LectureReviewMailSendResult> {
  const startedAt = Date.now()
  const toRecipients = normalizeEmailRecipients(payload.to)
  const sender = getLectureReviewEmailSender()

  if (!sender) {
    const durationMs = Date.now() - startedAt
    const error = Object.assign(
      new Error('Không có Gmail credential trên instance gửi mail duyệt giảng.'),
      { code: 'LECTURE_REVIEW_GMAIL_NOT_CONFIGURED' },
    )
    await recordEmailDelivery({
      status: 'skipped',
      senderEmail: null,
      toRecipients,
      ccRecipients: [],
      subject: payload.subject,
      emailType: 'lecture_review_hc_invitation',
      source: LECTURE_REVIEW_EMAIL_SOURCE,
      durationMs,
      error,
      metadata: payload.metadata,
    })
    return {
      sent: false,
      warning: 'LECTURE_REVIEW_GMAIL_NOT_CONFIGURED',
      durationMs,
    }
  }

  try {
    const html = ensureEmailLogoInHtml(payload.html)
    const { html: preparedHtml, attachments } = prepareEmailForSend(html)
    const info = await nodemailer
      .createTransport({
        service: 'gmail',
        auth: {
          user: sender.email,
          pass: sender.appPassword,
        },
      })
      .sendMail({
        from: `"${sender.displayName}" <${sender.email}>`,
        to: toRecipients,
        subject: payload.subject,
        html: preparedHtml,
        ...(attachments.length > 0 ? { attachments } : {}),
      })
    const durationMs = Date.now() - startedAt
    const messageId = String(info?.messageId ?? '')
    const response = String(info?.response ?? '')

    await recordEmailDelivery({
      status: 'sent',
      senderEmail: sender.email,
      toRecipients,
      ccRecipients: [],
      subject: payload.subject,
      emailType: 'lecture_review_hc_invitation',
      source: LECTURE_REVIEW_EMAIL_SOURCE,
      durationMs,
      providerMessageId: messageId,
      smtpResponse: response,
      metadata: {
        ...payload.metadata,
        senderAccountKey: sender.accountKey,
        senderAccountSource: 'instance_environment',
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
        pending: Array.isArray(info?.pending) ? info.pending : [],
      },
    })

    return {
      sent: true,
      messageId: messageId || undefined,
      response: response || undefined,
      durationMs,
      senderEmail: sender.email,
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await recordEmailDelivery({
      status: 'failed',
      senderEmail: sender.email,
      toRecipients,
      ccRecipients: [],
      subject: payload.subject,
      emailType: 'lecture_review_hc_invitation',
      source: LECTURE_REVIEW_EMAIL_SOURCE,
      durationMs,
      error,
      metadata: {
        ...payload.metadata,
        senderAccountKey: sender.accountKey,
        senderAccountSource: 'instance_environment',
      },
    })
    throw error
  }
}

export async function sendLectureReviewHcInvitation(
  data: LectureReviewHcInvitationData,
  metadata?: Record<string, unknown>,
): Promise<LectureReviewHcEmailResult> {
  const area = resolveLectureReviewHcArea({
    region: data.centerRegion,
    name: data.centerName,
  })
  const recipient = getLectureReviewHcRecipient(area)
  const formattedDate = formatReviewDate(data.reviewDate)
  const subject = `[TPS] Mời tham gia duyệt giảng - ${data.candidateName} - ${formattedDate}`

  try {
    const html = renderTemplate('lecture-review-hc-invitation', {
      hc_area: escapeHtml(AREA_LABELS[area]),
      candidate_name: escapeHtml(data.candidateName),
      lms_code: escapeHtml(data.lmsCode),
      review_date: escapeHtml(formattedDate),
      review_time: escapeHtml(data.reviewTime),
      center_name: escapeHtml(data.centerName),
      room_name: escapeHtml(data.roomName),
      reviewer_name: escapeHtml(data.reviewerName),
      registered_by_name: escapeHtml(data.registeredByName),
    })
    const sendResult = await sendLectureReviewMail({
      to: recipient.email,
      subject,
      html,
      metadata: {
        applicationId: String(data.applicationId),
        centerId: data.centerId,
        centerRegion: data.centerRegion || null,
        hcArea: area,
        hcName: recipient.name,
        candidateLmsCode: data.lmsCode,
        reviewDate: data.reviewDate,
        reviewTime: data.reviewTime,
        roomName: data.roomName,
        teachingBlock:
          BLOCK_LABELS[data.teachingBlock] || data.teachingBlock,
        ...metadata,
      },
    })
    const result = toEmailResult(sendResult, area, recipient)
    console.info('[lecture-review-hc-email]', {
      applicationId: data.applicationId,
      area,
      recipient: recipient.email,
      sent: result.sent,
      warning: result.warning,
      messageId: result.messageId,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[lecture-review-hc-email] failed', {
      applicationId: data.applicationId,
      area,
      recipient: recipient.email,
      error: message,
    })
    return {
      ok: false,
      sent: false,
      area,
      recipient,
      error: message,
    }
  }
}
