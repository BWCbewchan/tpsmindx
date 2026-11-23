import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { sendTelegramPhotos } from '../lib/telegram-delivery.mjs';

function harness(fail = false) {
  const messages = [], photos = [], signed = [], exports = {};
  const dependencies = {
    '@/lib/supabase-s3': {
      parseStoragePath: value => { const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(value); return m ? {bucket:m[1],key:m[2]} : null; },
      getSignedObjectUrl: async (bucket,key) => { signed.push({bucket,key}); return `https://storage.example/${key}`; },
    },
    './telegram-delivery.mjs': {
      telegramHtml: value => String(value).replaceAll('<','&lt;'),
      sendTelegramMessage: async message => { messages.push(message); return {messageId:21}; },
      sendTelegramPhotos: async message => { photos.push(message); if (fail) throw Error('Failed'); },
    },
  };
  const code = ts.transpileModule(fs.readFileSync('lib/feedback-telegram.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports,encodeURIComponent,process:{env:{TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'dev'}},require:name=>dependencies[name]});
  return {api:exports,messages,photos,signed};
}
const ticket = {id:4,user_email:'teacher@example.test',content:'<script>test</script>',status:'new',image_urls:['s3://feedback-images/feedback/a.png'],admin_image_urls:['s3://feedback-images/feedback/admin.png']};
test('new ticket sends escaped text and attaches image as reply',async()=>{
  const h=harness(); await h.api.notifyFeedbackTelegram(ticket,'created');
  assert.match(h.messages[0].text,/&lt;script>/); assert.equal(h.photos.length,1); assert.equal(h.photos[0].replyToMessageId,21);
});
test('updates attach admin images rather than replay original attachments',async()=>{
  const h=harness(); await h.api.notifyFeedbackTelegram({...ticket,admin_reply:'Fixed'},'updated','dev@example.test');
  assert.match(h.messages[0].text,/Fixed/); assert.equal(h.signed[0].key,'feedback/admin.png');
});
test('text survives image failure with fallback to ticket page',async()=>{
  const h=harness(true); await h.api.notifyFeedbackTelegram(ticket,'created');
  assert.equal(h.messages.length,2); assert.match(h.messages[1].text,/chưa gửi được 1 ảnh/);
});
test('private bucket objects and arbitrary URLs are never signed',async()=>{
  const h=harness(); await h.api.notifyFeedbackTelegram({...ticket,image_urls:['s3://private/secret','https://internal.example/image']},'created');
  assert.equal(h.signed.length,0); assert.equal(h.photos.length,0);
});
test('albums split at ten photos and duplicate references are removed',async()=>{
  const h=harness(); const refs=Array.from({length:12},(_,i)=>`s3://feedback-images/feedback/${i}.png`);
  await h.api.notifyFeedbackTelegram({...ticket,image_urls:[...refs,refs[0]]},'created');
  assert.deepEqual(h.photos.map(x=>x.photos.length),[10,2]);
});
test('tickets without images only send text',async()=>{
  const h=harness(); await h.api.notifyFeedbackTelegram({...ticket,image_urls:[]},'created');
  assert.equal(h.messages.length,1); assert.equal(h.photos.length,0);
});
test('single photos and albums use respective Telegram endpoints',async()=>{
  for (const count of [1,2]) {
    let call;
    await sendTelegramPhotos({token:'test',chatId:'dev',photos:Array.from({length:count},(_,i)=>`https://example.test/${i}.png`),caption:'Test',replyToMessageId:21},{fetchImpl:async(url,options)=>{
      call={url,body:JSON.parse(options.body)}; return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};
    }});
    assert.ok(call.url.endsWith(count===1?'sendPhoto':'sendMediaGroup')); assert.equal(call.body.reply_parameters.message_id,21);
  }
});
test('ambiguous photo failure does not retry',async()=>{
  let calls=0;
  await assert.rejects(sendTelegramPhotos({token:'test',chatId:'dev',photos:['https://example.test/a.png'],caption:'Test'},{fetchImpl:async()=>{calls++;throw Error('timeout');}}));
  assert.equal(calls,1);
});
test('GET never sends historical notifications; POST schedules after insert',()=>{
  const source=fs.readFileSync('app/api/feedback/route.ts','utf8');
  assert.ok(!source.slice(source.indexOf('export const GET'),source.indexOf('export const POST')).includes('notifyFeedbackTelegram'));
  const post=source.slice(source.indexOf('export const POST'),source.indexOf('export const PATCH'));
  assert.ok(post.indexOf('notifyFeedbackTelegram')>post.indexOf('INSERT INTO feedback_tickets')); assert.match(post,/after\(async/);
});
