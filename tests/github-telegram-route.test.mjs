import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import ts from 'typescript';

// Exercise the real route with mocked Telegram transport; never send live messages.
const routePath = new URL('../app/api/github/webhook/route.ts', import.meta.url);
const helperUrl = new URL('../lib/github-telegram.mjs', import.meta.url).href;
const source = fs.readFileSync(routePath, 'utf8')
  .replace("'next/server'", JSON.stringify(import.meta.resolve('next/server.js')))
  .replace("'@/lib/telegram-delivery.mjs'", JSON.stringify(new URL('../lib/telegram-delivery.mjs', import.meta.url).href))
  .replace("'@/lib/github-telegram.mjs'", JSON.stringify(helperUrl));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { POST } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('notification route preserves legacy configuration and enforces configured signatures', async t => {
  const names = ['GITHUB_WEBHOOK_SECRET', 'GITHUB_TELEGRAM_BOT_TOKEN', 'GITHUB_TELEGRAM_CHAT_ID'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });
  process.env.GITHUB_TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.GITHUB_TELEGRAM_CHAT_ID = 'test-chat';
  const body = JSON.stringify({ repository: { full_name: 'BWCbewchan/tpsmindx' }, action: 'opened', pull_request: { number: 1, title: 'fix: notification regression', head: { ref: 'preview', sha: 'abcdef123' }, base: { ref: 'main' } } });
  const request = (raw = body, event = 'pull_request', signature = '') => new Request('https://example.test/api/github/webhook', {
    method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-github-event': event, 'x-hub-signature-256': signature },
  });
  let sent = [];
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return Response.json({ ok: true });
  };
  await t.test('legacy PR without a configured signing secret reaches Telegram', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    assert.equal((await POST(request())).status, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /main/);
    assert.match(sent[0].text, /notification regression/);
  });
  await t.test('configured secret rejects unsigned and forged requests without sending', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    sent = [];
    assert.equal((await POST(request())).status, 401);
    assert.equal((await POST(request(body, 'pull_request', 'sha256=' + '0'.repeat(64)))).status, 401);
    assert.equal(sent.length, 0);
  });
  await t.test('valid signature sends; tampered body is rejected', async () => {
    const signature = 'sha256=' + createHmac('sha256', 'test-secret').update(body).digest('hex');
    assert.equal((await POST(request(body, 'pull_request', signature))).status, 200);
    assert.equal((await POST(request(body + ' ', 'pull_request', signature))).status, 401);
  });
  await t.test('ping and malformed JSON do not send messages', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    sent = [];
    assert.equal((await POST(request('{}', 'ping'))).status, 200);
    assert.equal((await POST(request('{'))).status, 400);
    assert.equal(sent.length, 0);
  });
  await t.test('missing Telegram credentials is still an explicit failure', async () => {
    delete process.env.GITHUB_TELEGRAM_BOT_TOKEN;
    assert.equal((await POST(request())).status, 503);
    process.env.GITHUB_TELEGRAM_BOT_TOKEN = 'test-token';
  });
  await t.test('SHA deployments resolve only the latest preview commit before sending', async () => {
    const sha = 'a'.repeat(40);
    const payload = JSON.stringify({ repository: { full_name: 'BWCbewchan/tpsmindx' },
      deployment: { ref: sha, sha, environment: 'Preview' },
      deployment_status: { state: 'success', environment_url: 'https://preview.example.test' } });
    sent = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).startsWith('https://api.github.com/')) return Response.json({ commit: { sha } });
      sent.push(JSON.parse(options.body)); return Response.json({ ok: true });
    };
    assert.equal((await POST(request(payload, 'deployment_status'))).status, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /preview build thành công/);
    globalThis.fetch = async () => Response.json({ commit: { sha: 'b'.repeat(40) } });
    const stale = await POST(request(payload, 'deployment_status'));
    assert.equal((await stale.json()).message, 'Event ignored');
  });
  await t.test('Telegram rejection is not reported as successful delivery', async () => {
    globalThis.fetch = async () => Response.json({ ok: false, error_code: 400 }, { status: 400 });
    assert.equal((await POST(request())).status, 502);
  });
});
