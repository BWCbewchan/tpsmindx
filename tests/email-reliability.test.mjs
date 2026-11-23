import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, console, ...globals, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`); return dependencies[name];
  }});
  return exports;
}
const policy = load('lib/email-delivery-policy.ts');
const sender = id => ({id,email:`sender${id}@example.test`,displayName:'TPS',accountKey:`db-${id}`,source:'database',appPassword:'test-only',isActive:true});
function mailHarness({errors=[],accounts=[sender(1),sender(2)],info={accepted:['recipient@example.test'],rejected:[],messageId:'mock-id'},verificationError=null}={}) {
  const sent=[],logs=[],verified=[],transports=[];
  const api=load('app/api/emails/transporter.ts', {
    nodemailer:{default:{createTransport:options=>{
      const transport={options,closed:false,close(){this.closed=true;},verify:async()=>{if(verificationError)throw verificationError;},sendMail:async mail=>{sent.push(mail);const error=errors[sent.length-1];if(error)throw error;return info;}};
      transports.push(transport);return transport;
    }}},
    '@/lib/email-delivery-policy':policy,
    '@/lib/email-monitoring':load('lib/email-monitoring.ts'),
    '@/lib/email-branding':{ensureEmailLogoInHtml:x=>x,prepareEmailForSend:html=>({html,attachments:[]})},
    '@/lib/email-accounts':{
      getEmailAccountConfigurationSummary:async()=>({configured:true}),
      getEmailSenderAccount:async id=>accounts.find(a=>a.id===id)||null,
      getFirstActiveEmailSenderAccount:async()=>accounts[0]||null,
      selectNextEmailSenderAccount:async excluded=>accounts.find(a=>!excluded.includes(a.id))||null,
      recordEmailAccountVerification:async(...args)=>verified.push(args),
    },
    '@/lib/email-delivery-log':{normalizeEmailRecipients:x=>x?(Array.isArray(x)?x:[x]):[],recordEmailDelivery:async log=>logs.push(log)},
  });
  const payload={to:'recipient@example.test',subject:'Mock test',html:'<p>Test</p>'};
  return {api,payload,sent,logs,verified,transports};
}
test('definite authentication failure fails over once and logs both outcomes',async()=>{
  const h=mailHarness({errors:[Object.assign(new Error('auth'),{code:'EAUTH',command:'AUTH PLAIN'})]});
  const result=await h.api.sendMail(h.payload);
  assert.equal(result.sent,true);assert.equal(result.senderAccountId,2);
  assert.equal(h.sent.length,2);assert.deepEqual(h.logs.map(l=>l.status),['failed','sent']);
  assert.ok(h.transports.every(t=>t.closed));
  assert.equal(h.transports[0].options.connectionTimeout,8000);
  assert.equal(h.transports[0].options.socketTimeout,15000);
});
test('ambiguous DATA timeout never retries or risks duplicate delivery',async()=>{
  const failure=Object.assign(new Error('timeout after DATA'),{code:'ETIMEDOUT',command:'DATA'});
  const h=mailHarness({errors:[failure]});await assert.rejects(h.api.sendMail(h.payload));
  assert.equal(h.sent.length,1);assert.equal(h.logs[0].status,'failed');assert.ok(h.transports[0].closed);
});
test('explicit sender quota rejection can use a different sender',async()=>{
  const h=mailHarness({errors:[Object.assign(new Error('daily user sending limit exceeded'),{code:'EMESSAGE',command:'DATA',responseCode:452})]});
  assert.equal((await h.api.sendMail(h.payload)).senderAccountId,2);assert.equal(h.sent.length,2);
});
test('explicit sender test never silently changes account',async()=>{
  const h=mailHarness({errors:[Object.assign(new Error('auth'),{code:'EAUTH'})]});
  await assert.rejects(h.api.sendMail({...h.payload,senderAccountId:1}));assert.equal(h.sent.length,1);
});
test('failover is bounded even when all available senders fail',async()=>{
  const auth=Object.assign(new Error('auth'),{code:'EAUTH'});
  const h=mailHarness({errors:[auth,auth,auth],accounts:[sender(1),sender(2),sender(3)]});
  await assert.rejects(h.api.sendMail(h.payload));assert.equal(h.sent.length,2);
});
test('partial acceptance reports warning and never resends accepted recipients',async()=>{
  const h=mailHarness({info:{accepted:['a@example.test'],rejected:['b@example.test']}});
  const result=await h.api.sendMail(h.payload);assert.equal(result.sent,true);assert.equal(result.warning,'PARTIAL_RECIPIENT_REJECTION');assert.equal(h.sent.length,1);
});
test('no eligible sender is logged as skipped without SMTP connection',async()=>{
  const h=mailHarness({accounts:[]});assert.equal((await h.api.sendMail(h.payload)).sent,false);assert.equal(h.transports.length,0);assert.equal(h.logs[0].status,'skipped');
});
test('verification records failure and closes SMTP without sending mail',async()=>{
  const h=mailHarness({verificationError:new Error('Invalid login')});
  assert.equal((await h.api.verifyMailTransport(1)).ok,false);assert.equal(h.verified[0][1],false);assert.equal(h.sent.length,0);assert.ok(h.transports[0].closed);
});
const router=load('lib/email-account-router.ts');
const row={id:1,account_key:'env-secondary',email:'hr-teaching@mindx.edu.vn',display_name:'HR',source:'env',is_active:true,encrypted_app_password:null};
function accountsHarness(rows=[row],env={}) {
  const queries=[];
  const client={release(){},query:async(sql,values)=>{
    queries.push({sql,values});
    if(sql.includes('FROM email_sender_accounts'))return {rows};
    if(sql.includes('last_account_id'))return {rows:[{last_account_id:null}]};
    return {rows:[]};
  }};
  const api=load('lib/email-accounts.ts',{
    '@/lib/db':{default:{...client,connect:async()=>client}},
    '@/lib/email-account-crypto':{decryptEmailCredential:()=> 'stored-secret',encryptEmailCredential:x=>`encrypted:${x}`},
    '@/lib/email-account-router':router,
  },{process:{env}});
  return {api,queries};
}
test('missing env credentials never turn off the administrator activation preference',async()=>{
  const h=accountsHarness();await h.api.listEmailSenderAccountsWithQuota();assert.ok(!h.queries.some(q=>/is_active\s*=\s*FALSE/i.test(q.sql)));
  const accounts=await h.api.listEmailSenderAccountsWithQuota();assert.equal(accounts[0].isActive,true);assert.equal(accounts[0].credentialConfigured,false);assert.match(accounts[0].configurationError,/App Password/);
});
test('public account diagnostics never expose encrypted or decrypted credentials',async()=>{
  const h=accountsHarness([{...row,encrypted_app_password:'cipher'}],{EMAIL_CREDENTIAL_ENCRYPTION_KEY:'test-key'});
  const accounts=await h.api.listEmailSenderAccountsWithQuota();assert.equal(accounts[0].credentialConfigured,true);
  assert.ok(!JSON.stringify(accounts).includes('cipher'));assert.ok(!JSON.stringify(accounts).includes('stored-secret'));assert.ok(!('encryptedAppPassword' in accounts[0]));
  assert.equal(accounts[0].credentialSource,'database');
});
test('temporary sender cooldown keeps activation on and expires after two minutes',async()=>{
  const h=accountsHarness([{...row,last_verified_at:'2026-11-23T00:00:00Z',last_verify_ok:false}],{});
  const accounts=await h.api.listEmailSenderAccountsWithQuota();assert.equal(accounts[0].isActive,true);assert.equal(accounts[0].cooldownUntil,'2026-11-23T00:02:00.000Z');
  await h.api.selectNextEmailSenderAccount([]);
  assert.ok(h.queries.some(q=>q.sql.includes("INTERVAL '2 minutes'")));
});
test('legacy env credentials cannot bypass database credential configuration',async()=>{
  const h=accountsHarness([{...row,account_key:'env-secondary'}],{GMAIL_USER:row.email,GMAIL_APP_PASSWORD:'ab cd'});
  await assert.rejects(h.api.getEmailSenderAccount(1),/App Password trong database/);
});
test('routing skips missing credentials and excluded senders',async()=>{
  const h=accountsHarness([row,{...row,id:2,source:'database',encrypted_app_password:'cipher'}],{EMAIL_CREDENTIAL_ENCRYPTION_KEY:'test-key'});
  assert.equal((await h.api.selectNextEmailSenderAccount([])).id,2);
  assert.equal(await h.api.selectNextEmailSenderAccount([2]),null);
});
test('admin can save an encrypted credential for an env account without enabling it implicitly',async()=>{
  const h=accountsHarness([row],{EMAIL_CREDENTIAL_ENCRYPTION_KEY:'test-key'});
  await h.api.updateEmailSenderAccount({accountId:1,appPassword:'ab cd'});
  const update=h.queries.find(q=>q.sql.includes('UPDATE email_sender_accounts')&&q.sql.includes('encrypted_app_password'));
  assert.ok(update);assert.ok(update.values.includes('encrypted:abcd'));assert.doesNotMatch(update.sql,/is_active\s*=/);
});
test('adding a duplicate email directs the admin to edit the existing account',async()=>{
  const h=accountsHarness([row],{EMAIL_CREDENTIAL_ENCRYPTION_KEY:'test-key'});
  await assert.rejects(h.api.createDatabaseEmailSenderAccount({email:row.email,displayName:'HR',appPassword:'test'}),/đã có trong danh sách/);
});
test('ordinary missing sessions differ from permission violations and repeated failures',()=>{
  const {classifyUnauthorizedAccess:classify}=load('lib/unauthorized-access-policy.ts');
  assert.equal(classify(false,1).severity,'WARNING');assert.equal(classify(false,10).action,'AUTH_FAILURE_BURST');
  assert.equal(classify(false,11,true).severity,'WARNING');assert.equal(classify(true).severity,'HIGH');assert.equal(classify(true).eventType,'PRIVILEGE_ESCALATION');
});
test('monitoring API still rejects unauthenticated reads and mutations before database or SMTP access',async()=>{
  const denied={status:401};
  const api=load('app/api/admin/email-monitor/route.ts',{
    '@/app/api/emails/transporter':{},
    '@/lib/auth-server':{requireBearerSuperAdmin:async()=>({ok:false,response:denied}),requireBearerSuperAdminMutation:async()=>({ok:false,response:denied})},
    '@/lib/db':{default:{query:()=>assert.fail('Database must not be called')}},
    '@/lib/email-accounts':{},'@/lib/email-monitoring':{},'next/server':{},
  });
  for(const method of ['GET','POST','PATCH','DELETE']) assert.equal(await api[method]({}),denied);
});
test('audit logging preserves rejected access and alerts once for a repeated anonymous burst',async()=>{
  const accessPolicy=load('lib/unauthorized-access-policy.ts');
  for(const [failures,alerted,expectedSeverity,expectedAlerts] of [[0,0,'WARNING',0],[9,0,'HIGH',1],[15,1,'WARNING',0]]) {
    const inserts=[],alerts=[];
    const api=load('lib/audit-logger.ts',{
      '@/lib/db':{default:{query:async(sql,values)=>{
        if(sql.startsWith('SELECT'))return {rows:[{failures,alerted}]};
        inserts.push(values);return {rows:[]};
      }}},
      '@/lib/unauthorized-access-policy':accessPolicy,
      '@/lib/security-identity':{normalizeAuthenticatedEmail:value=>value||null},
      '@/lib/security-alert':{sendSecurityAlert:event=>alerts.push(event)},
      'next/server':{},
    });
    api.logUnauthorizedAccess({email:null,ip:'192.0.2.1',userAgent:'Mozilla/5.0',endpoint:'GET /api/leave-requests',requiredRole:'admin|manager'});
    await new Promise(setImmediate);
    assert.equal(inserts.length,1);assert.equal(inserts[0][2],expectedSeverity);assert.equal(alerts.length,expectedAlerts);
  }
});

test('lecture review mail uses the shared database sender and preserves routing metadata',async()=>{
  const calls=[];
  const api=load('lib/lecture-review-hc-emails.ts',{
    '@/app/api/emails/render':{renderTemplate:()=>'<p>Invitation</p>'},
    '@/app/api/emails/transporter':{sendMail:async payload=>{calls.push(payload);return {sent:true,durationMs:1,senderEmail:'hr-teaching@mindx.edu.vn'};}},
    '@/lib/lecture-review-hc-routing':{resolveLectureReviewHcArea:()=> 'hn',getLectureReviewHcRecipient:()=>({name:'HC',email:'hc@example.test'})},
  });
  const result=await api.sendLectureReviewHcInvitation({applicationId:1,candidateName:'Test',reviewDate:'2026-11-23',reviewTime:'09:00',centerName:'HN',centerId:1,roomName:'1',teachingBlock:'coding'});
  assert.equal(result.sent,true);assert.equal(calls.length,1);assert.equal(calls[0].emailType,'lecture_review_hc_invitation');assert.equal(calls[0].to,'hc@example.test');
});
