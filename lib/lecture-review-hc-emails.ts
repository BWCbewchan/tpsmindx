import { renderTemplate } from '@/app/api/emails/render'
import { sendMail } from '@/app/api/emails/transporter'
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

type LectureReviewMailPayload = {
  to: string | string[]
  subject: string
  html: string
  metadata?: Record<string, unknown>
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

async function sendLectureReviewMail(payload: LectureReviewMailPayload): Promise<LectureReviewMailSendResult> {
  return sendMail({ ...payload, emailType: 'lecture_review_hc_invitation', source: LECTURE_REVIEW_EMAIL_SOURCE })
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
