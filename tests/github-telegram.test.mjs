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

test('push and Actions events are silent',()=>{
 for(const event of ['push','workflow_run','workflow_job']) assert.equal(format(event,wrap({ref:'refs/heads/main',workflow_run:{status:'completed',conclusion:'success'}})),null);
});
test('merge messages retain branch names, PR links and escaped titles',()=>{
 const pr={number:12,title:'Fix <script>',html_url:'https://github.com/pr/12',head:{ref:'kydai',sha:'abcdef1'},base:{ref:'preview'},merged:true};
 const message=format('pull_request',wrap({action:'closed',pull_request:pr}));
 assert.match(message,/Đã merge PR/);assert.match(message,/kydai/);assert.match(message,/preview/);assert.match(message,/&lt;script&gt;/);
 assert.equal(format('pull_request',wrap({action:'closed',pull_request:{...pr,merged:false}})),null);
});
test('only successful preview and main deployments announce the next version',()=>{
 for(const branch of ['preview','main']){
 const p=wrap({deployment:{ref:branch,sha:'abcdef123',environment:branch==='main'?'Production':'Preview'},deployment_status:{state:'success',environment_url:'https://example.test'}});
 const message=format('deployment_status',p);assert.match(message,/build thành công/);assert.match(message,/Phiên bản tiếp theo/);assert.ok(message.includes('https://example.test'));
 for(const state of ['pending','in_progress','failure','error','inactive'])assert.equal(format('deployment_status',{...p,deployment_status:{state}}),null);
 }
 assert.equal(format('deployment_status',wrap({deployment:{ref:'kydai',environment:'Preview'},deployment_status:{state:'success'}})),null);
});
test('mismatched environment and unknown branches are never called ready',()=>{
 assert.equal(format('deployment_status',wrap({deployment:{ref:'main',environment:'Preview'},deployment_status:{state:'success'}})),null);
 assert.equal(format('deployment_status',wrap({deployment:{ref:'abcdef123',environment:'Preview'},deployment_status:{state:'success'}})),null);
});
