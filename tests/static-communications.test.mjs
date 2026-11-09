import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/static-communications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
const {TEACHER_BEHIND_TEACHER_POST:post,getStaticCommunication,mergeStaticCommunications}=exports;
test('announcement is available without any database or network dependency',()=>{
 assert.equal(getStaticCommunication(post.slug),post);
 assert.equal(mergeStaticCommunications([])[0],post);
 assert.equal(getStaticCommunication('other'),null);
 assert.ok(fs.existsSync('public'+post.featured_image));
});
test('static announcement preserves event dates and both locations',()=>{
 for(const text of ['18/11/2026','16/11/2026','17h30','261 Vũ Tông Phan','524 Lê Quang Định','Giáo viên và Trợ giảng MindX']) assert.ok(post.content.includes(text),text);
});
test('listing preserves remote posts and deduplicates the static slug',()=>{
 const remote={slug:'other'};
 const result=mergeStaticCommunications([{slug:post.slug},remote]);
 assert.equal(result.length,2);assert.equal(result[0],post);assert.equal(result[1],remote);
});
test('admin search and status filters also apply to the static announcement',()=>{
 assert.equal(mergeStaticCommunications([],{status:'draft'}).length,0);
 assert.equal(mergeStaticCommunications([],{status:'hidden'}).length,0);
 assert.equal(mergeStaticCommunications([],{status:'published',search:'TEACHER BEHIND TEACHER'}).length,1);
 assert.equal(mergeStaticCommunications([],{search:'unrelated'}).length,0);
});
