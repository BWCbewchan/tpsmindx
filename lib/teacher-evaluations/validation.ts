import {
  LMS_FEEDBACK_TOPICS,
  LMS_TICKET_PRIORITIES,
  LMS_TICKET_STATUSES,
} from './constants'
import type { LmsTicketUpdate } from './lms'

type UpdateInput = Record<string, unknown>

function optionalEnum(
  value: unknown,
  allowed: readonly string[],
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined
  const normalized = String(value).trim().toUpperCase()
  if (!allowed.includes(normalized)) throw new Error(`${fieldName} không hợp lệ.`)
  return normalized
}

export function validateTicketUpdate(id: string, value: unknown): LmsTicketUpdate {
  if (!id.trim()) throw new Error('Thiếu mã phiếu LMS.')
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dữ liệu cập nhật không hợp lệ.')
  }
  const input = value as UpdateInput
  const update: LmsTicketUpdate = {
    id,
    status: optionalEnum(input.status, LMS_TICKET_STATUSES, 'Trạng thái'),
    priority: optionalEnum(input.priority, LMS_TICKET_PRIORITIES, 'Mức độ ưu tiên'),
    feedbackTopic: optionalEnum(input.feedbackTopic, LMS_FEEDBACK_TOPICS, 'Chủ đề'),
  }
  if (input.assigneeId !== undefined) {
    const assigneeId = String(input.assigneeId).trim()
    if (assigneeId.length > 160) throw new Error('Mã người xử lý không hợp lệ.')
    update.assigneeId = assigneeId
  }
  if (
    update.status === undefined &&
    update.priority === undefined &&
    update.feedbackTopic === undefined &&
    update.assigneeId === undefined
  ) {
    throw new Error('Chưa chọn trường cần cập nhật.')
  }
  return update
}
