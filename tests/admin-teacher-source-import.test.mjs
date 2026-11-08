import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, console:{error(){}}, require:name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }});
  return exports;
}
const source = {Code:'baotc01','Full name':'Teacher','Work email':'teacher@example.test'};
function harness({auth=true,permission=true,csrf=false,limited=false,existing={},matches=[source],outage=false,query='baotc01'}={}) {
  const reads=[],writes=[];
  const route=load('app/api/admin/teacher-profiles/import-missing/route.ts', {
    'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},
    '@/lib/api-security':{requireSameOriginMutation:()=>csrf?{status:403}:null},
    '@/lib/datasource-api-auth':{requireBearerSession:async()=>auth?{ok:true,sessionEmail:'admin@example.test',resolvedAccess:{}}:{ok:false,response:{status:401}}},
    '@/lib/menu-permissions':{checkHrefPermission:()=>permission},
    '@/lib/rate-limit-memory':{rateLimitOr429Async:async()=>limited?{status:429}:null},
    '@/lib/teacher-profile-bundle':{findTeacherRowByLookupQuery:async()=>existing},
    '@/lib/teacher-onboarding-source':{loadTeacherOnboardingMatches:async q=>{reads.push(q);if(outage)throw Error('timeout');return matches;}},
    '@/lib/teacher-source-import':{insertMissingTeacherFromSource:async(_pool,row)=>{writes.push(row);return {rows:[{code:row.Code}]};}},
    '@/lib/db':{default:{}},
  });
  return {reads,writes,run:()=>route.POST({json:async()=>({query,onboardingData:{Code:'forged'}})})};
}
test('source import requires session, screen grant, same-origin and rate limit',async()=>{
  for(const options of [{auth:false},{permission:false},{csrf:true},{limited:true}]) {
    const h=harness(options);assert.ok([401,403,429].includes((await h.run()).status));assert.equal(h.reads.length,0);assert.equal(h.writes.length,0);
  }
});
test('existing teacher is returned without source read or overwrite',async()=>{
  const h=harness({existing:{row:{code:'baotc01'}}});assert.equal((await h.run()).body.imported,false);assert.equal(h.reads.length,0);assert.equal(h.writes.length,0);
});
test('missing teacher imports trusted source only, ignoring browser data',async()=>{
  const h=harness();const result=await h.run();assert.equal(result.body.code,'baotc01');assert.equal(h.writes[0],source);assert.deepEqual(h.reads,['baotc01']);
});
test('ambiguous matches ask for selection without creating profiles',async()=>{
  const h=harness({matches:[source,{...source,Code:'GV02'}]});assert.equal((await h.run()).body.chooseTeacher,true);assert.equal(h.writes.length,0);
});
test('not found, outages, invalid and duplicate sources never write',async()=>{
  for(const [options,status] of [[{matches:[]},404],[{outage:true},503],[{matches:[source,source]},409],[{query:'a'},400],[{matches:[{...source,'Work email':''}]},422],[{matches:Array.from({length:13},(_,i)=>({...source,Code:String(i)}))},422]]) {
    const h=harness(options);assert.equal((await h.run()).status,status);assert.equal(h.writes.length,0);
  }
});
test('database insertion never overwrites a concurrent confirmation or account permissions',async()=>{
  const {insertMissingTeacherFromSource}=load('lib/teacher-source-import.ts');let captured;
  await insertMissingTeacherFromSource({query:async(sql,values)=>{captured={sql,values};return {rows:[]};}},source);
  assert.match(captured.sql,/ON CONFLICT \(code\) DO NOTHING/);
  assert.doesNotMatch(captured.sql,/DO UPDATE|app_users|user_roles|app_permissions/);
  assert.equal(captured.values[0],'baotc01');assert.equal(captured.values[3],source['Work email']);
});
test('source lookup prioritizes exact code and supports accent-insensitive names',()=>{
  const {findOnboardingMatches,ONBOARDING_HEADERS}=load('lib/teacher-onboarding-source.ts');
  const rows=[source,{...source,Code:'GV02','Full name':'Đặng Bảo'}];
  const csv='title\nheaders\n'+rows.map(r=>ONBOARDING_HEADERS.map(h=>'"'+String(r[h]||'').replaceAll('"','""')+'"').join(',')).join('\n');
  assert.equal(findOnboardingMatches(csv,' BAOTC01 ')[0].Code,'baotc01');
  assert.equal(findOnboardingMatches(csv,'dang bao')[0].Code,'GV02');
});
