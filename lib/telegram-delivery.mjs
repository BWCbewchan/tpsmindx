export class TelegramDeliveryError extends Error {
  constructor(code, status = 0) {
    super(`Telegram delivery failed: ${code}`);
    this.name = 'TelegramDeliveryError';
    this.code = code;
    this.status = status;
  }
}

export const telegramHtml = (value, limit = 300) => String(value ?? '').slice(0, limit)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Retry only explicit server/rate-limit rejections. Network timeouts have an
// ambiguous delivery result and must not automatically duplicate a message.
/**
 * @param {{token?: string, chatId?: string|number, text: string, parseMode?: string, replyMarkup?: unknown, replyToMessageId?: number}} message
 * @param {{fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<unknown>}} options
 */
export async function sendTelegramMessage({ token, chatId, text, parseMode, replyMarkup, replyToMessageId }, options = {}) {
  if (!token?.trim() || !String(chatId ?? '').trim()) throw new TelegramDeliveryError('NOT_CONFIGURED');
  if (!text || text.length > 16000) throw new TelegramDeliveryError('INVALID_MESSAGE');
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const payload = { chat_id: chatId, text, disable_web_page_preview: true,
    ...(parseMode ? { parse_mode: parseMode } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    let response, data;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token.trim()}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(7000), body: JSON.stringify(payload),
      });
      data = await response.json();
    } catch {
      throw new TelegramDeliveryError('DELIVERY_UNCONFIRMED');
    }
    if (response.ok && data.ok === true) return { messageId: data.result?.message_id };
    const status = data.error_code || response.status;
    if (status === 400 && payload.parse_mode && /parse entities|unsupported start tag|can't find end/i.test(data.description || '')) {
      delete payload.parse_mode;
      continue;
    }
    const delay = status === 429 ? Number(data.parameters?.retry_after) * 1000 : 500 * (attempt + 1);
    if (attempt < 2 && ((status === 429 && delay > 0 && delay <= 2000) || status >= 500)) {
      await sleep(delay);
      continue;
    }
    throw new TelegramDeliveryError(status === 429 ? 'RATE_LIMITED' : status === 401 ? 'INVALID_TOKEN'
      : status === 403 ? 'CHAT_FORBIDDEN' : 'API_REJECTED', status);
  }
  throw new TelegramDeliveryError('RETRY_LIMIT');
}
