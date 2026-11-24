import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';

test('VAPID configuration validates a matching key pair and rejects corrupt configuration',()=>{
  const exports={},env={},key=crypto.createECDH('prime256v1');key.generateKeys();
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/web-push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Buffer,URL,process:{env},require:name=>{assert.equal(name,'node:crypto');return crypto;}});
  assert.equal(exports.getVapidConfig(),null);
  env.VAPID_PUBLIC_KEY=key.getPublicKey().toString('base64url');env.VAPID_PRIVATE_KEY=key.getPrivateKey().toString('base64url');
  assert.ok(exports.getVapidConfig());env.VAPID_PRIVATE_KEY='invalid';assert.equal(exports.getVapidConfig(),null);
});

async function clickNotification(url){
  const events={},opened=[],promises=[];
  const self={location:{origin:'https://www.tpsmindx.com'},navigator:{clearAppBadge:async()=>{}},addEventListener:(name,fn)=>events[name]=fn,
    clients:{matchAll:async()=>[],openWindow:async target=>opened.push(target)}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});
  events.notificationclick({notification:{data:{url},close(){}},waitUntil:promise=>promises.push(promise)});
  await Promise.all(promises);return opened[0];
}
test('notification clicks allow app links but never open an external origin',async()=>{
  assert.equal(await clickNotification('/admin/thong-bao?tab=unread'),'https://www.tpsmindx.com/admin/thong-bao?tab=unread');
  assert.equal(await clickNotification('https://evil.example/'),'https://www.tpsmindx.com/user/thong-bao');
  assert.equal(await clickNotification('javascript:alert(1)'),'https://www.tpsmindx.com/user/thong-bao');
});
