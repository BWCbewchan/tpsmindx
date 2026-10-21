import pool from '@/lib/db';
import { createTrafficMonitor } from './traffic-monitor.mjs';
import { sendTelegramMessage } from './telegram-delivery.mjs';

const monitor = createTrafficMonitor({
  query: (sql, values) => pool.query(sql, values),
  send: text => sendTelegramMessage({ token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID, text, parseMode: 'HTML' }),
});

/** Called in Next after(), which keeps delivery alive after the HTTP response. */
export async function checkSessionTraffic() {
  if (process.env.VERCEL_ENV === 'preview' || process.env.TRAFFIC_ALERTS_ENABLED === 'false') return;
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  try { return await monitor(); }
  catch { console.error('[SessionMonitor] Traffic sample/delivery failed; retry on next activity.'); }
}
