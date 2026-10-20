import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTelegramMessage, telegramHtml } from '../lib/telegram-delivery.mjs';

const input = { token: 'test-token', chatId: '-1', text: 'Test', parseMode: 'HTML' };
test('success returns message ID and routes the configured chat', async () => {
  const result = await sendTelegramMessage(input, { fetchImpl: async (_url, opts) => {
    assert.equal(JSON.parse(opts.body).chat_id, '-1');
    return Response.json({ ok: true, result: { message_id: 42 } });
  } });
  assert.equal(result.messageId, 42);
});
test('rate limit retries only a short retry_after delay', async () => {
  let calls = 0; const delays = [];
  await sendTelegramMessage(input, { sleep: async ms => delays.push(ms), fetchImpl: async () => ++calls === 1
    ? Response.json({ ok: false, error_code: 429, parameters: { retry_after: 1 } }, { status: 429 })
    : Response.json({ ok: true }) });
  assert.equal(calls, 2); assert.deepEqual(delays, [1000]);
  await assert.rejects(sendTelegramMessage(input, { fetchImpl: async () => Response.json({ ok: false, error_code: 429, parameters: { retry_after: 60 } }, { status: 429 }) }), { code: 'RATE_LIMITED' });
});
test('explicit server errors retry at most three requests', async () => {
  let calls = 0;
  await assert.rejects(sendTelegramMessage(input, { sleep: async () => {}, fetchImpl: async () => {
    calls++; return Response.json({ ok: false, error_code: 500 }, { status: 500 });
  } }), { code: 'API_REJECTED' });
  assert.equal(calls, 3);
});
test('network failures do not retry or leak the secret in errors', async () => {
  let calls = 0;
  await assert.rejects(sendTelegramMessage(input, { fetchImpl: async () => { calls++; throw new Error('test-token'); } }), error => error.code === 'DELIVERY_UNCONFIRMED' && !error.message.includes('test-token'));
  assert.equal(calls, 1);
});
test('invalid markup retries as plain text, but permission errors do not retry', async () => {
  const bodies = [];
  await sendTelegramMessage(input, { fetchImpl: async (_url, opts) => {
    bodies.push(JSON.parse(opts.body));
    return bodies.length === 1 ? Response.json({ ok: false, error_code: 400, description: "can't parse entities" }, { status: 400 }) : Response.json({ ok: true });
  } });
  assert.equal(bodies[1].parse_mode, undefined);
  await assert.rejects(sendTelegramMessage(input, { fetchImpl: async () => Response.json({ ok: false, error_code: 403 }, { status: 403 }) }), { code: 'CHAT_FORBIDDEN' });
});
test('missing configuration is explicit and HTML is escaped', async () => {
  await assert.rejects(sendTelegramMessage({ ...input, token: '' }), { code: 'NOT_CONFIGURED' });
  assert.equal(telegramHtml('<a>&"'), '&lt;a&gt;&amp;&quot;');
});
