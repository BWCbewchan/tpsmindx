import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('lib/datasource-api-auth.ts','utf8');
const start=source.indexOf('export async function rejectIfDatasourceLookupForbidden(');
const end=source.indexOf('/** Alias',start);
const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function harness(granted, own=false) {
 const exports={};let centerChecks=0;
 vm.runInNewContext(code,{exports,NextResponse:{json:(body,init)=>({body,status:init.status})},
 pool:{query:async()=>({rows:[]})},resolveAppUserAccessForEmail:async()=>({permissions:granted?['teacher-profile']:[]}),
 checkHrefPermission:(_href,access)=>access.permissions.includes('teacher-profile'),
 findTeacherRowByLookupQuery:async()=>({row:{code:'thanhlqp'}}),findTeacherRowByEmailOrCode:async()=>({code:'thanhlqp'}),
 teacherRowWorkEmail:()=>own?'admin@example.test':'teacher@example.test',getAccessibleCenters:async()=>{centerChecks++;return [];},teacherMatchesAccessibleCenters:()=>false});
 return {run:(email='',code='thanhlqp',session='admin@example.test')=>exports.rejectIfDatasourceLookupForbidden(session,false,email,code),centers:()=>centerChecks};
}
test('teacher-profile grant permits lookup across centers by code and email',async()=>{
 const h=harness(true);assert.equal(await h.run(),null);assert.equal(await h.run('teacher@example.test',''),null);assert.equal(h.centers(),0);
});
test('without teacher-profile grant cross-center lookup remains forbidden',async()=>{
 assert.equal((await harness(false).run()).status,403);
});
test('own teacher profile remains accessible without admin screen grant',async()=>{
 assert.equal(await harness(false,true).run(),null);
});
test('screen grant does not bypass candidate isolation',async()=>{
 const h=harness(true);assert.equal((await h.run('','candidate-9')).status,403);
 assert.equal((await h.run('','thanhlqp','candidate-1@candidate.local')).status,403);
});
