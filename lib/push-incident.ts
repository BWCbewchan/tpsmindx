import pool from '@/lib/db'
import { notifyFeedbackTelegram, type FeedbackNotification } from '@/lib/feedback-telegram'

type PushIncident = 'configuration' | 'authentication' | 'quota' | 'network' | 'provider'
const GUIDANCE: Record<PushIncident, string> = {
  configuration: 'Kiểm tra VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY và VAPID_SUBJECT của deployment. Dùng cặp khóa hợp lệ và ổn định.',
  authentication: 'Kiểm tra chữ ký VAPID, cặp khóa và đăng ký thiết bị có dùng đúng public key không.',
  quota: 'Kiểm tra giới hạn của dịch vụ push, giảm tốc độ gửi và kiểm tra Retry-After trước khi thử lại.',
  network: 'Kiểm tra DNS, kết nối mạng và timeout tới dịch vụ push. Chưa rõ kết quả thì không tự gửi lại để tránh trùng.',
  provider: 'Kiểm tra mã HTTP và tình trạng dịch vụ push. Không tự gửi lại nếu chưa rõ kết quả.',
}

/** Create one open system ticket per failure group, and notify Telegram only.
 * Never include subscription endpoints, keys, message content or recipients.
 */
export async function reportPushIncident(kind: PushIncident, status = 0): Promise<void> {
  const code = `SYSTEM_PUSH_${kind.toUpperCase()}`
  let created: FeedbackNotification | undefined
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL statement_timeout = '5s'")
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [code])
      const open = await client.query(
        `SELECT id FROM feedback_tickets WHERE user_email = 'system@tpsmindx.com'
         AND user_code = $1 AND status IN ('new', 'in_progress') LIMIT 1`, [code],
      )
      if (!open.rows.length) {
        const result = await client.query(
          `INSERT INTO feedback_tickets (user_email, user_name, user_code, screen_path, content, suggestion)
           VALUES ('system@tpsmindx.com', 'TPS — Giám sát Web Push', $1, '/thong-bao?tab=settings', $2, $3)
           RETURNING *`,
          [code, `Sự cố Web Push: ${kind}. Mã HTTP: ${status || 'không có phản hồi'}. Thời gian: ${new Date().toISOString()}.`, GUIDANCE[kind]],
        )
        created = result.rows[0]
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
    if (created) await notifyFeedbackTelegram(created, 'created')
  } catch {
    // Do not use push or email as fallback: that could recurse on an outage.
    console.error('[push-incident] Unable to report incident:', code, status)
  }
}
