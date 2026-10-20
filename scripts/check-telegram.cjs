const fs = require('node:fs');
const dotenv = require('dotenv');

async function main() {
  const config = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    if (fs.existsSync(file)) Object.assign(config, dotenv.parse(fs.readFileSync(file)));
  }
  let failed = false;
  for (const [role, tokenKey, chatKey] of [['Security', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], ['GitHub', 'GITHUB_TELEGRAM_BOT_TOKEN', 'GITHUB_TELEGRAM_CHAT_ID']]) {
    const token = config[tokenKey]?.trim(), chatId = config[chatKey]?.trim();
    if (!token || !chatId) { console.log(JSON.stringify({ role, configured: false })); failed = true; continue; }
    const call = async (method, data = {}) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(`Telegram ${method}: HTTP ${response.status}, code ${result.error_code || 0}`);
      return result.result;
    };
    try {
      const bot = await call('getMe');
      const member = await call('getChatMember', { chat_id: chatId, user_id: bot.id });
      const webhook = await call('getWebhookInfo');
      const blocked = ['left', 'kicked', 'restricted'].includes(member.status);
      const webhookUrl = webhook.url ? new URL(webhook.url) : null;
      console.log(JSON.stringify({ role, username: bot.username, membership: member.status,
        webhook: webhookUrl ? webhookUrl.origin + webhookUrl.pathname : null,
        pendingUpdates: webhook.pending_update_count, hasWebhookError: Boolean(webhook.last_error_message),
        signingSecretConfigured: Boolean(config[role === 'Security' ? 'TELEGRAM_WEBHOOK_SECRET' : 'GITHUB_WEBHOOK_SECRET']),
        blocked,
      }));
      if (blocked || (role === 'Security' && (!webhook.url || !config.TELEGRAM_WEBHOOK_SECRET))) failed = true;
    } catch {
      // Never print raw network errors containing the bot token URL.
      console.log(JSON.stringify({ role, error: 'BOT_OR_CHAT_CHECK_FAILED' })); failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Telegram diagnostics failed'); process.exitCode = 1; });
