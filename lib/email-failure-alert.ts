import pool from '@/lib/db'
import type { EmailDeliveryLogInput } from '@/lib/email-delivery-log'
import { classifyEmailError, type EmailErrorCategory } from '@/lib/email-monitoring'
import { sendTelegramMessage, telegramHtml } from './telegram-delivery.mjs'

const GUIDANCE: Record<EmailErrorCategory, string> = {
  authentication: 'Kiểm tra hoặc thay App Password tại Email Monitor; kiểm tra bảo mật Google Workspace.',
  configuration: 'Kiểm tra tài khoản đang bật, App Password trong database và khóa mã hóa của deployment.',
  network: 'Kiểm tra DNS, kết nối SMTP và mạng máy chủ. Xem nhật ký trước khi gửi lại nếu timeout sau DATA.',
  quota: 'Kiểm tra hạn mức Gmail; chờ quota phục hồi hoặc dùng tài khoản dự phòng.',
  recipient: 'Kiểm tra địa chỉ người nhận và chính sách nhận mail của tên miền.',
  provider: 'Kiểm tra mã SMTP và trạng thái nhà cung cấp trong nhật ký.',
  unknown: 'Mở nhật ký theo Log ID để kiểm tra lỗi và nguồn gọi; không gửi lại khi chưa rõ kết quả.',
}

/** One alert per sender/category/code/source/type in five minutes, across instances. */
export async function alertEmailFailure(input: EmailDeliveryLogInput, logId: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.EMAIL_ALERT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const error = classifyEmailError(input.error)
  const key = JSON.stringify([input.senderEmail || input.senderAccountId || 'unconfigured', error.category, error.code, input.source || 'unknown', input.emailType || 'unknown'])
  const client = await pool.connect()
  let claimed = false
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key])
    const recent = await client.query(
      `SELECT 1 FROM email_delivery_logs
       WHERE completed_at > NOW() - INTERVAL '5 minutes'
         AND metadata->>'emailAlertKey' = $1
         AND metadata->>'emailAlertClaimedAt' IS NOT NULL LIMIT 1`, [key],
    )
    if (!recent.rows.length) {
      const result = await client.query(
        `UPDATE email_delivery_logs SET metadata = COALESCE(metadata, '{}'::jsonb) ||
           jsonb_build_object('emailAlertKey', $1::text, 'emailAlertClaimedAt', NOW()) WHERE id = $2 RETURNING id`, [key, logId],
      )
      claimed = result.rows.length > 0
    }
    await client.query('COMMIT')
  } catch (failure) {
    await client.query('ROLLBACK')
    throw failure
  } finally {
    client.release()
  }
  if (!claimed) return
  // Only allowlisted diagnostics leave the application: no subject, recipients,
  // message body, arbitrary error text, metadata or SMTP credentials.
  const url = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://www.tpsmindx.com').replace(/\/$/, '')}/admin/email-monitor?tab=logs${input.senderAccountId ? `&account=${input.senderAccountId}` : ''}`
  const text = [
    '🔴 <b>EMAIL DELIVERY ALERT</b>',
    `Tài khoản: ${telegramHtml(input.senderEmail || 'Chưa chọn được tài khoản')}`,
    `Trạng thái: ${telegramHtml(input.status)} | Loại: ${telegramHtml(error.category)}`,
    `Mã lỗi: <code>${telegramHtml(error.code, 50)}</code> | SMTP: ${error.responseCode ?? 'N/A'}`,
    `Nguồn: ${telegramHtml(input.source || 'unknown', 150)}`,
    `Loại mail: ${telegramHtml(input.emailType || 'unknown', 100)}`,
    `Log ID: #${logId} | Thời gian xử lý: ${Math.round(input.durationMs)}ms`,
    `Xử lý: ${telegramHtml(GUIDANCE[error.category])}`,
    'Đây là lỗi của một lần gửi; xem nhật ký để biết tài khoản dự phòng có gửi thành công không.',
    `Nhật ký: ${telegramHtml(url, 350)}`,
    `Thời gian: ${telegramHtml(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}`,
    'Lỗi cùng nhóm được giới hạn một cảnh báo trong 5 phút.',
  ].join('\n')
  const deadline = AbortSignal.timeout(4000)
  try {
    await sendTelegramMessage({ token, chatId, text, parseMode: 'HTML' }, {
      fetchImpl: (url, options) => fetch(url, { ...options, signal: deadline }),
    })
  } catch (failure) {
    // Allow the next failed email to try alerting again. Never send via email:
    // that would recurse when the mail provider itself is unavailable.
    await pool.query(`UPDATE email_delivery_logs SET metadata = metadata - 'emailAlertClaimedAt' WHERE id = $1`, [logId])
    throw failure
  }
}
