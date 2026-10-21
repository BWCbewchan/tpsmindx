import pool from './db';
import { getPublicBaseUrl } from './public-base-url';
import { sendWebPush } from './web-push';
import { sendTelegramMessage } from './telegram-delivery.mjs';

interface NotificationPayload {
  recipientEmail: string;
  title: string;
  content: string;
  type: string;
  link?: string;
}

async function deliverPushNotifications(
  recipientEmail: string | null,
  payload: Omit<NotificationPayload, 'recipientEmail'>,
) {
  try {
    const subscriptions = await pool.query(
      `SELECT id, endpoint, p256dh, auth_secret
       FROM push_subscriptions
       ${recipientEmail ? 'WHERE LOWER(recipient_email) = $1' : ''}
       ORDER BY id`,
      recipientEmail ? [recipientEmail] : [],
    );

    for (let index = 0; index < subscriptions.rows.length; index += 20) {
      const batch = subscriptions.rows.slice(index, index + 20);
      await Promise.allSettled(
        batch.map(async (subscription) => {
          const result = await sendWebPush(
            {
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth_secret,
            },
            {
              title: payload.title,
              body: payload.content,
              link: payload.link || '/user/thong-bao',
              tag: `tps-${payload.type}`,
            },
          );

          if (result.ok) {
            await pool.query(
              `UPDATE push_subscriptions
               SET last_success_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [subscription.id],
            );
          } else if (result.status === 404 || result.status === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [
              subscription.id,
            ]);
          }
        }),
      );
    }
  } catch (err: any) {
    if (err?.code !== '42P01') {
      console.error('[NotificationService] Web Push delivery failed:', err);
    }
  }
}

/**
 * Creates an in-app notification for a user.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  const { recipientEmail, title, content, type, link } = payload;
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  let created = false;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO notifications (recipient_email, title, content, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
      [normalizedEmail, title, content, type, link || null]
    );
    created = true;
  } catch (err) {
    console.error('[NotificationService] Failed to create in-app notification:', err);
  } finally {
    client?.release();
  }

  if (created) {
    await deliverPushNotifications(normalizedEmail, {
      title,
      content,
      type,
      link,
    });
  }
}

/**
 * Creates an in-app notification for all active users.
 */
export async function createNotificationForEveryone(payload: Omit<NotificationPayload, 'recipientEmail'>): Promise<void> {
  const { title, content, type, link } = payload;
  let created = false;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query<{ inserted_count: number }>(
      `WITH active_recipients AS (
         SELECT LOWER(TRIM(email)) AS recipient_email
         FROM app_users
         WHERE is_active IS TRUE
           AND NULLIF(TRIM(email), '') IS NOT NULL

         UNION

         SELECT LOWER(
           TRIM(
             COALESCE(
               NULLIF(TRIM(work_email), ''),
               NULLIF(TRIM("Work email"), '')
             )
           )
         ) AS recipient_email
         FROM teachers
         WHERE LOWER(
           TRIM(
             COALESCE(
               NULLIF(TRIM(status), ''),
               NULLIF(TRIM("Status"), ''),
               'active'
             )
           )
         ) NOT IN ('deactive', 'inactive', 'disabled')
       ),
       inserted AS (
         INSERT INTO notifications (
           recipient_email,
           title,
           content,
           type,
           link,
           is_read,
           created_at
         )
         SELECT
           recipient_email,
           $1,
           $2,
           $3,
           $4,
           FALSE,
           NOW()
         FROM active_recipients
         WHERE recipient_email IS NOT NULL
           AND POSITION('@' IN recipient_email) > 1
         RETURNING id
       )
       SELECT COUNT(*)::int AS inserted_count
       FROM inserted`,
      [title, content, type, link || null]
    );

    console.info(
      `[NotificationService] Created notification for ${result.rows[0]?.inserted_count || 0} active recipients`
    );
    created = true;
  } catch (err) {
    console.error('[NotificationService] Failed to create notifications for everyone:', err);
  } finally {
    client?.release();
  }

  if (created) {
    await deliverPushNotifications(null, { title, content, type, link });
  }
}

/**
 * Sends an email notification via the internal /api/emails API.
 * This is ONLY called for leave request results (approvals/rejections/substitute confirmations).
 */
export async function sendEmailNotification(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    const baseUrl = getPublicBaseUrl();
    const internalSecret =
      process.env.INTERNAL_API_SECRET ||
      process.env.EMAIL_INTERNAL_API_SECRET ||
      '';
    await fetch(`${baseUrl}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret
          ? { 'x-internal-api-secret': internalSecret }
          : {}),
      },
      body: JSON.stringify({ type, data }),
    });
  } catch (err) {
    console.error('[NotificationService] Email send failed:', err);
  }
}

/**
 * Sends a Telegram notification to the administrator group.
 * Useful for alerting admins about critical requests (e.g. salary deals or new leave requests).
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    await sendTelegramMessage({ token, chatId, text: message, parseMode: 'Markdown' });
  } catch (err) {
    console.error('[NotificationService] Telegram send failed:', err instanceof Error ? err.message : 'UNKNOWN');
  }
}
