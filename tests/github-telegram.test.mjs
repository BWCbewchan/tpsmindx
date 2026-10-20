import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { formatGitHubNotification as format, verifyGitHubSignature as verify } from '../lib/github-telegram.mjs';

const repository = { full_name: 'BWCbewchan/tpsmindx', html_url: 'https://github.com/BWCbewchan/tpsmindx' };
const wrap = extra => ({ repository, sender: { login: 'developer' }, ...extra });

test('signature accepts exact raw body and rejects tampering, malformed signatures and missing secrets', () => {
  const body = '{"test":true}', secret = 'test-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verify(body, signature, secret), true);
  assert.equal(verify(body + ' ', signature, secret), false);
  assert.equal(verify(body, 'invalid', secret), false);
  assert.equal(verify(body, signature, ''), false);
});
test('push escapes HTML, rejects unsafe links and bounds long commit messages', () => {
  const message = format('push', wrap({ ref: 'refs/heads/<main>', commits: Array.from({ length: 10 }, () => ({ id: 'abcdef123', message: '<script>&"'.repeat(1000), url: 'javascript:alert(1)' })) }));
  assert.ok(message.includes('&lt;main&gt;'));
  assert.ok(!message.includes('<script>'));
  assert.ok(!message.includes('javascript:'));
  assert.ok(message.length < 4096);
});
test('release merge is distinct from closed unmerged PR', () => {
  const pull_request = { number: 123, title: 'Release', head: { ref: 'preview', sha: 'abc1234' }, base: { ref: 'main' }, merged: true };
  assert.match(format('pull_request', wrap({ action: 'closed', pull_request })), /Đã merge PR phát hành/);
  assert.match(format('pull_request', wrap({ action: 'closed', pull_request: { ...pull_request, merged: false } })), /Đóng PR/);
});
test('CI reports failures and rerun attempt with log link', () => {
  const message = format('workflow_run', wrap({ action: 'completed', workflow_run: { name: 'Build', conclusion: 'failure', head_branch: 'preview', run_attempt: 2, html_url: 'https://github.com/run/1' } }));
  assert.match(message, /Thất bại/);
  assert.match(message, /lần thử 2/);
  assert.match(message, /https:\/\/github.com\/run\/1/);
});
test('deploy uses actual environment even when ref is SHA and does not claim an auto merge', () => {
  const p = wrap({ deployment: { ref: 'abc1234', sha: 'abc1234', environment: 'Preview' }, deployment_status: { state: 'success', environment_url: 'https://example.vercel.app' } });
  assert.match(format('deployment_status', p), /Deploy Preview/);
  assert.match(format('deployment_status', p), /Trạng thái merge được báo riêng/);
  assert.match(format('deployment_status', { ...p, deployment: { ...p.deployment, production_environment: true } }), /Deploy Production/);
  assert.equal(format('deployment_status', { ...p, deployment_status: { state: 'inactive' } }), null);
});
test('unknown and noisy events are ignored', () => {
  assert.equal(format('workflow_run', wrap({ action: 'completed', workflow_run: { name: 'Automatic delivery', event: 'schedule', conclusion: 'success' } })), null);
  assert.equal(format('issues', wrap({})), null);
  assert.equal(format('pull_request', wrap({ action: 'labeled', pull_request: {} })), null);
  assert.equal(format('push', null), null);
});
