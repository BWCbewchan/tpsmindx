import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { formatGitHubNotification as format, verifyGitHubSignature as verify, getCIFailures } from '../lib/github-telegram.mjs';

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

test('ordinary Actions events are silent',()=>{
 for(const event of ['workflow_run','workflow_job']) assert.equal(format(event,wrap({ref:'refs/heads/main',workflow_run:{status:'completed',conclusion:'success'}})),null);
});

test('only completed failed CI announces branch, commit author and actionable errors', async () => {
 const p=wrap({action:'completed',workflow_run:{id:123,run_attempt:2,name:'CI',conclusion:'failure',head_branch:'haibang',head_sha:'abcdef123',
  head_commit:{author:{name:'Hai Bang'}},actor:{login:'developer'},html_url:'https://github.com/run/123'}});
 const requests=[];
 p.ci_failures=await getCIFailures(p,{token:'test-read-token',fetchImpl:async(url,options)=>{
  requests.push(url);assert.equal(options.headers.Authorization,'Bearer test-read-token');
  return Response.json(url.includes('/annotations')?[{annotation_level:'failure',path:'app/page.tsx',start_line:16,message:"Cannot find module '<image>.jpg'"}]:
   {jobs:[{name:'CI',conclusion:'failure',check_run_url:'https://api.github.com/repos/BWCbewchan/tpsmindx/check-runs/99'}]});
 }});
 assert.match(requests[0],/attempts\/2\/jobs/);
 const message=format('workflow_run',p);assert.match(message,/haibang/);assert.match(message,/Hai Bang/);
 assert.match(message,/app\/page.tsx:16/);assert.match(message,/&lt;image&gt;/);assert.match(message,/sửa và push lại/);
 for(const conclusion of ['success','cancelled','skipped',null])assert.equal(format('workflow_run',{...p,workflow_run:{...p.workflow_run,conclusion}}),null);
 assert.equal(format('workflow_run',{...p,action:'requested'}),null);
 assert.equal(format('workflow_run',{...p,workflow_run:{...p.workflow_run,name:'Automatic delivery'}}),null);
 assert.deepEqual(await getCIFailures(p,{fetchImpl:async()=>{throw new Error('unavailable');}}),[]);
 assert.match(format('workflow_run',{...p,ci_failures:[]}),/Không lấy được chi tiết lỗi/);
});

test('push reports actor, branch, escaped commits and release branch changes', () => {
 for (const branch of ['kydai', 'preview', 'main']) {
  const message = format('push', wrap({ref:`refs/heads/${branch}`,after:'abcdef123',compare:'https://github.com/compare',
   commits: Array.from({length:7},()=>({id:'123456789',message:'Fix <script>\nprivate body',author:{name:'A & B'}}))}));
  assert.match(message,/Người push: developer/);
  assert.ok(message.includes(branch)); assert.match(message,/Fix &lt;script&gt;/);
  assert.match(message,/4 commit khác/);
  assert.ok(!message.includes('private body'));
  if(branch !== 'kydai') assert.match(message,/Đã lên nhánh/);
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

test('preview success is silent, failures alert and main success links staging',()=>{
 for(const branch of ['preview','main']) {
  const p=wrap({deployment:{ref:branch,sha:'abcdef123',environment:branch==='main'?'Production':'Preview'},deployment_status:{state:'success',environment_url:'https://example.test'}});
  if(branch==='preview') assert.equal(format('deployment_status',p),null);
  else {const message=format('deployment_status',p);assert.match(message,/sẵn sàng trên staging/);assert.ok(message.includes('href="https://tmsmindx.vercel.app/"'));assert.ok(!message.includes('https://example.test'));}
  for(const state of ['failure','error']) assert.match(format('deployment_status',{...p,deployment_status:{state,log_url:'https://example.test/log'}}),/build không thành công/);
  for(const state of ['pending','in_progress','inactive']) assert.equal(format('deployment_status',{...p,deployment_status:{state}}),null);
 }
 assert.equal(format('deployment_status',wrap({deployment:{ref:'personal',environment:'Preview'},deployment_status:{state:'failure'}})),null);
});
test('automation branches and main-to-preview sync pushes are silent',()=>{
 for(const branch of ['automation/sync-main-abcd','dependabot/npm','renovate/deps']) assert.equal(format('push',wrap({ref:`refs/heads/${branch}`})),null);
 assert.equal(format('push',wrap({sender:{login:'github-actions[bot]'},ref:'refs/heads/preview',head_commit:{message:'Merge pull request #373 from BWCbewchan/automation/sync-main-abc'}})),null);
 assert.ok(format('push',wrap({sender:{login:'github-actions[bot]'},ref:'refs/heads/preview',head_commit:{message:'Merge pull request #374 from BWCbewchan/developer'}})));
});

test('mismatched environment and unknown branches are never called ready',()=>{
 assert.equal(format('deployment_status',wrap({deployment:{ref:'main',environment:'Preview'},deployment_status:{state:'success'}})),null);
 assert.equal(format('deployment_status',wrap({deployment:{ref:'abcdef123',environment:'Preview'},deployment_status:{state:'success'}})),null);
});
