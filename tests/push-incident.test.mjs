import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,deps) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {exports,console,Error,require:name=>{assert.ok(name in deps,`Unexpected dependency ${name}`);return deps[name];}});
  return exports;
}
function incidentHarness({exists=false,telegramFails=false}={}) {
  const queries=[],notifications=[];let released=false;
  const client={release(){released=true;},query:async(sql,values)=>{
    queries.push({sql,values});
    return {rows:sql.includes('SELECT id')?(exists?[{id:1}]:[]):sql.includes('RETURNING *')?[{id:2,content:'System push failure'}]:[]};
  }};
  const api=load('lib/push-incident.ts',{'@/lib/db':{default:{connect:async()=>client}},
    '@/lib/feedback-telegram':{notifyFeedbackTelegram:async ticket=>{assert.equal(released,true);notifications.push(ticket);if(telegramFails)throw Error('down');}}});
  return {api,queries,notifications};
}
test('new push failures create a system ticket and alert Telegram after releasing DB connection',async()=>{
  const h=incidentHarness();await h.api.reportPushIncident('authentication',403);
  assert.equal(h.notifications.length,1);
  const insert=h.queries.find(q=>q.sql.includes('INSERT INTO feedback_tickets'));
  assert.equal(insert.values[0],'SYSTEM_PUSH_AUTHENTICATION');assert.match(insert.values[1],/403/);
  assert.ok(h.queries.some(q=>q.sql.includes('pg_advisory_xact_lock')));
});
test('existing open incidents are reused without duplicate tickets or alerts',async()=>{
  const h=incidentHarness({exists:true});await h.api.reportPushIncident('network');
  assert.equal(h.notifications.length,0);assert.ok(!h.queries.some(q=>q.sql.includes('INSERT INTO')));
  assert.ok(h.queries.some(q=>q.sql.includes("status IN ('new', 'in_progress')")));
});
test('Telegram outage does not fail the original push request',async()=>{
  const h=incidentHarness({telegramFails:true});await h.api.reportPushIncident('quota',429);
  assert.ok(h.queries.some(q=>q.sql==='COMMIT'));assert.equal(h.notifications.length,1);
});
function deliveryHarness(result,error) {
  const incidents=[];
  const api=load('lib/web-push-delivery.ts',{'@/lib/web-push':{sendWebPush:async()=>{if(error)throw error;return result;}},
    '@/lib/push-incident':{reportPushIncident:async(...args)=>incidents.push(args)}});
  const send=()=>api.sendMonitoredWebPush({endpoint:'PRIVATE_ENDPOINT',auth:'PRIVATE_AUTH',p256dh:'PRIVATE_KEY'},{title:'PRIVATE_TITLE',body:'PRIVATE_BODY'});
  return {send,incidents};
}
test('healthy deliveries and expired subscriptions create no incident',async()=>{
  for(const status of [201,404,410]){const h=deliveryHarness({ok:status===201,status,skipped:false});await h.send();assert.equal(h.incidents.length,0);}
});
test('configuration, authentication, quota and provider failures are classified without private data',async()=>{
  for(const [status,skipped,kind] of [[0,true,'configuration'],[403,false,'authentication'],[429,false,'quota'],[503,false,'provider']]){
    const h=deliveryHarness({ok:false,status,skipped});await h.send();assert.deepEqual(h.incidents[0],[kind,status]);
    assert.ok(!JSON.stringify(h.incidents).includes('PRIVATE'));
  }
});
test('network uncertainty creates an incident without retrying push',async()=>{
  const h=deliveryHarness(null,Error('timeout PRIVATE_ENDPOINT'));const result=await h.send();
  assert.equal(result.ok,false);assert.deepEqual(h.incidents,[['network']]);
});
