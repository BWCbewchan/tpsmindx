import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, console:{error(){}}, require:name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }});
  return exports;
}
const { parseOnboardingCsv, ONBOARDING_HEADERS } = load('../lib/teacher-onboarding-source.ts');
const email = 'teacher@example.test';
const source = {Code:'GV01','Full name':'Teacher','Work email':email,'Rank':'Level 2'};
const csvRow = row => ONBOARDING_HEADERS.map(h => '"'+String(row[h] || '').replaceAll('"','""')+'"').join(',');
const csv = rows => 'title\r\nheaders\r\n' + rows.map(csvRow).join('\r\n');

test('source matching uses exact normalized work email, including quoted CSV fields', () => {
  const row = parseOnboardingCsv(csv([{...source,'Full name':'Teacher, "A"\nNew line'}]), ' TEACHER@EXAMPLE.TEST ');
  assert.equal(row['Full name'], 'Teacher, "A"\nNew line');
  assert.equal(row.Code, 'GV01');
  assert.equal(parseOnboardingCsv(csv([source]), 'someone@example.test'), null);
});
test('ambiguous or malformed source data is rejected instead of overwriting a profile', () => {
  assert.throws(() => parseOnboardingCsv(csv([source,source]), email));
  assert.throws(() => parseOnboardingCsv('title\nheaders\n"unterminated', email));
});

function harness({allowed=true, csrf=false, limited=false, row=source, outage=false, exists=true} = {}) {
  const reads=[], writes=[];
  const route = load('../app/api/user/teacher-profile/refresh/route.ts', {
    'next/server': {NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},
    '@/lib/api-security':{requireSameOriginMutation:()=>csrf?{status:403}:null},
    '@/lib/datasource-api-auth':{requireBearerSession:async()=>allowed?{ok:true,sessionEmail:email}:{ok:false,response:{status:401}}},
    '@/lib/rate-limit-memory':{rateLimitOr429Async:async()=>limited?{status:429}:null},
    '@/lib/teacher-onboarding-source':{loadTeacherOnboarding:async identity=>{reads.push(identity);if(outage)throw new Error('timeout');return row;}},
    '@/lib/db':{default:{query:async(sql,values)=>{writes.push({sql,values});return {rows:exists?[{code:'GV01',updated_at:'2026-10-28'}]:[]};}}},
  });
  return {reads,writes,run:()=>route.POST({json:async()=>({userEmail:'victim@example.test',onboardingData:{Rank:'Fake'}})})};
}

test('refresh uses only session identity and authoritative source, never browser profile values', async () => {
  const h = harness(); const result = await h.run();
  assert.equal(result.status, 200);
  assert.deepEqual(h.reads, [email]);
  const {sql,values} = h.writes[0];
  assert.equal(values.at(-1), email);
  assert.ok(values.includes('Level 2'));
  assert.ok(!values.includes('Fake'));
  assert.match(sql,/UPDATE teachers SET/);
  assert.doesNotMatch(sql,/UPDATE app_users|user_roles|app_permissions|"code"\s*=/);
  assert.equal('teacher' in result.body, false);
});
test('authentication, same-origin checks and throttling reject before source reads/writes', async () => {
  for (const options of [{allowed:false},{csrf:true},{limited:true}]) {
    const h=harness(options); const result=await h.run();
    assert.ok([401,403,429].includes(result.status));
    assert.equal(h.reads.length,0);assert.equal(h.writes.length,0);
  }
});
test('missing, incomplete or wrong-identity source leaves database unchanged', async () => {
  for (const row of [null,{...source,Code:''},{...source,'Full name':''},{...source,'Work email':'other@example.test'}]) {
    const h=harness({row});assert.equal((await h.run()).status,422);assert.equal(h.writes.length,0);
  }
});
test('upstream outage returns a retriable failure without writing to the database', async () => {
  const h=harness({outage:true});assert.equal((await h.run()).status,503);assert.equal(h.writes.length,0);
});
test('blank source fields preserve current profile values and are excluded from snapshot merge', async () => {
  const h=harness({row:{...source,'Personal email':'','Phone number':'','Teacher point':''}});
  assert.equal((await h.run()).status,200);
  const {sql,values}=h.writes[0];
  assert.match(sql,/"personal_email" = COALESCE\(NULLIF\(\$\d+, ''\), "personal_email"\)/);
  assert.match(sql,/onboarding_snapshot = COALESCE/);
  const snapshot=JSON.parse(values.at(-2));
  assert.equal('Teacher point' in snapshot,false);
  assert.equal(snapshot.Rank,'Level 2');
});
test('refresh does not create a teacher record if onboarding has not completed', async () => {
  const h=harness({exists:false});assert.equal((await h.run()).status,404);
  assert.ok(h.writes.every(w=>!w.sql.includes('INSERT')));
});
