import { getSignedObjectUrl, parseStoragePath } from '@/lib/supabase-s3'
import { sendTelegramMessage, sendTelegramPhotos, telegramHtml } from './telegram-delivery.mjs'

export interface FeedbackNotification {
  id: number
  user_email: string
  user_name?: string | null
  user_code?: string | null
  screen_path?: string | null
  content: string
  suggestion?: string | null
  status: string
  admin_reply?: string | null
  image_urls?: unknown
  admin_image_urls?: unknown
}

/** Called only after a successful new mutation, never while reading existing tickets. */
export async function notifyFeedbackTelegram(ticket: FeedbackNotification, event: 'created' | 'updated', actor?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const labels: Record<string, string> = { new: 'Mới', in_progress: 'Đang xử lý', done: 'Hoàn thành' }
  const url = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://www.tpsmindx.com').replace(/\/$/, '')}/admin/feedback?search=${encodeURIComponent(ticket.user_email)}`
  const message = await sendTelegramMessage({ token, chatId, parseMode: 'HTML', text: [
    `${event === 'created' ? '🎫 <b>TICKET MỚI' : '🛠️ <b>CẬP NHẬT TICKET'} #${Number(ticket.id)}</b>`,
    `Người gửi: ${telegramHtml(ticket.user_name || ticket.user_email, 100)} (${telegramHtml(ticket.user_email, 150)})`,
    ticket.user_code ? `Mã: ${telegramHtml(ticket.user_code, 60)}` : '',
    `Màn hình: ${telegramHtml(ticket.screen_path || 'Không có', 180)}`,
    `Trạng thái: ${telegramHtml(labels[ticket.status] || ticket.status)}`,
    `Nội dung: ${telegramHtml(ticket.content, 900)}`,
    ticket.suggestion ? `Đề xuất: ${telegramHtml(ticket.suggestion, 450)}` : '',
    event === 'updated' && ticket.admin_reply ? `Phản hồi: ${telegramHtml(ticket.admin_reply, 600)}` : '',
    actor ? `Người cập nhật: ${telegramHtml(actor, 150)}` : '',
    `Chi tiết: ${telegramHtml(url, 500)}`,
    `Thời gian: ${telegramHtml(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}`,
  ].filter(Boolean).join('\n') })
  const raw = event === 'created' ? ticket.image_urls : ticket.admin_image_urls
  let images: unknown = raw
  if (typeof images === 'string') { try { images = JSON.parse(images) } catch { images = [] } }
  const refs = Array.isArray(images) ? [...new Set(images.filter((value): value is string => typeof value === 'string'))] : []
  let failed = 0
  const photos: string[] = []
  for (const ref of refs) {
    // Only sign the feedback attachment bucket, never arbitrary storage objects.
    const parsed = parseStoragePath(ref)
    if (!parsed || parsed.bucket !== 'feedback-images' || !parsed.key.startsWith('feedback/')) { failed++; continue }
    try { photos.push(await getSignedObjectUrl(parsed.bucket, parsed.key, 3600)) }
    catch { failed++ }
  }
  for (let index = 0; index < photos.length; index += 10) {
    const batch = photos.slice(index, index + 10)
    try {
      await sendTelegramPhotos({ token, chatId, photos: batch,
        caption: `Ticket #${ticket.id} — ${event === 'created' ? 'Ảnh người gửi' : 'Ảnh phản hồi admin'}`,
        replyToMessageId: message.messageId })
    } catch { failed += batch.length }
  }
  if (failed) await sendTelegramMessage({ token, chatId,
    text: `Ticket #${ticket.id}: chưa gửi được ${failed} ảnh. Vui lòng xem ảnh trong trang quản trị: ${url}`,
    replyToMessageId: message.messageId })
}
