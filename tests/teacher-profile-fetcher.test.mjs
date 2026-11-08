import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('app/admin/page1/page.tsx','utf8');
const start=source.indexOf('const createSecureFetcher =');
const end=source.indexOf('const profileFetcher =',start);
const code=ts.transpileModule(source.slice(start,end)+'\nexports.fetcher=createSecureFetcher();',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
async function run(status,body) {
  const exports={};
  vm.runInNewContext(code,{exports,localStorage:{getItem:()=>null},fetch:async()=>({ok:status===200,status,json:async()=>body})});
  return exports.fetcher('/test');
}
test('teacher profile fetcher displays API permission error and status',async()=>{
  await assert.rejects(run(403,{error:'Không có quyền truy vấn dữ liệu cho mã giáo viên này'}),e=>e.status===403&&e.message==='Không có quyền truy vấn dữ liệu cho mã giáo viên này');
});
test('teacher profile fetcher has Vietnamese fallback for missing error details',async()=>{
  await assert.rejects(run(403,{}),e=>e.message==='Bạn chưa có quyền xem dữ liệu giáo viên này.');
  await assert.rejects(run(503,{error:42}),e=>e.message==='Chưa thể tải dữ liệu. Vui lòng thử lại.');
});
test('teacher profile fetcher preserves successful responses',async()=>{
  const response={success:true,exists:true};assert.equal(await run(200,response),response);
});
