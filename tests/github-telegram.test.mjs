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

test('Actions events are silent',()=>{
 for(const event of ['workflow_run','workflow_job']) assert.equal(format(event,wrap({ref:'refs/heads/main',workflow_run:{status:'completed',conclusion:'success'}})),null);
});

test('push reports actor, branch, escaped commits and release branch changes', () => {
 for (const branch of ['kydai', 'preview', 'main']) {
  const message = format('push', wrap({ref:`refs/heads/${branch}`,after:'abcdef123',compare:'https://github.com/compare',
   commits: Array.from({length:7},()=>({id:'123456789',message:'Fix <script>\nprivate body',author:{name:'A & B'}}))}));
  assert.match(message,/Người push: developer/);
  assert.ok(message.includes(branch)); assert.match(message,/Fix &lt;script&gt;/);
  assert.match(message,/A &amp; B/); assert.match(message,/2 commit khác/);
  assert.ok(!message.includes('private body'));
  if(branch !== 'kydai') assert.match(message,/có thay đổi/);
 }
 assert.equal(format('push',wrap({ref:'refs/tags/v1'})),null);
});
test('all PR lifecycle events are silent', () => {
 for (const action of ['opened','reopened','synchronize','ready_for_review','converted_to_draft','closed']) {
  for (const merged of [false,true]) {
   assert.equal(format('pull_request',wrap({action,pull_request:{number:1,merged,head:{ref:'preview'},base:{ref:'main'}}})),null);
   assert.equal(format('pull_request',wrap({action,pull_request:{number:2,merged,head:{ref:'personal'},base:{ref:'preview'}}})),null);
  }
 }
});

test('only successful preview and main deployments announce the next version',()=>{
 for(const branch of ['preview','main']){
 const p=wrap({deployment:{ref:branch,sha:'abcdef123',environment:branch==='main'?'Production':'Preview'},deployment_status:{state:'success',environment_url:'https://example.test'}});
 const message=format('deployment_status',p);assert.match(message,/build thành công/);assert.match(message,/Phiên bản tiếp theo/);
 if(branch==='main') {
  assert.ok(message.includes('href="https://tmsmindx.vercel.app/"'));
  assert.ok(!message.includes('https://example.test'));
  assert.match(message,/staging.*Thành viên thực hiện chức năng vui lòng test lại/);
  assert.equal(format('deployment_status',{...p,deployment_status:{state:'success'}}),message);
 } else assert.ok(message.includes('https://example.test'));
 for(const state of ['pending','in_progress','failure','error','inactive'])assert.equal(format('deployment_status',{...p,deployment_status:{state}}),null);
 }
 assert.equal(format('deployment_status',wrap({deployment:{ref:'kydai',environment:'Preview'},deployment_status:{state:'success'}})),null);
});
test('mismatched environment and unknown branches are never called ready',()=>{
 assert.equal(format('deployment_status',wrap({deployment:{ref:'main',environment:'Preview'},deployment_status:{state:'success'}})),null);
 assert.equal(format('deployment_status',wrap({deployment:{ref:'abcdef123',environment:'Preview'},deployment_status:{state:'success'}})),null);
});
