import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,deps={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,console,Error,AbortSignal,Uint8Array,atob,setTimeout,clearTimeout,...globals,require:name=>{assert.ok(name in deps,name);return deps[name];}});
  return exports;
}
const platform=load('lib/push-notifications.ts');
const adapter=(globals={})=>load('lib/device-push-client.ts',{'@/lib/auth-headers':{authHeaders:()=>({Authorization:'Bearer test'})},'@/lib/push-notifications':platform},globals);
test('iPhone browser needs installation even without exposed Notification API',()=>{
  assert.equal(platform.getPushPlatformState({configured:true,secureContext:true,ios:true,standalone:false,notificationSupported:false,serviceWorkerSupported:true,pushManagerSupported:false}).reason,'ios-install-required');
});
test('subscription key mismatch is detected before reusing an old registration',()=>{
  const api=adapter(); assert.equal(api.subscriptionUsesKey({options:{applicationServerKey:Uint8Array.from([1,2,3]).buffer}},'AQID'),true);
  assert.equal(api.subscriptionUsesKey({options:{applicationServerKey:Uint8Array.from([4,5,6]).buffer}},'AQID'),false);
});
test('HTTP failures never mark a device registered; expired flag propagates',async()=>{
  const api=adapter({fetch:async()=>({ok:false,json:async()=>({success:false,error:'Expired',requiresResubscribe:true})})});
  await assert.rejects(api.pushApi('token',{action:'test'}),error=>error.requiresResubscribe===true);
});
test('saving subscription is authenticated and includes browser keys',async()=>{
  let request; const api=adapter({fetch:async(url,options)=>{request=options;return {ok:true,json:async()=>({success:true})};}});
  await api.savePushSubscription('token',{endpoint:'https://push.example/1',toJSON:()=>({keys:{p256dh:'public',auth:'secret'}})});
  assert.equal(request.headers.Authorization,'Bearer test'); assert.equal(JSON.parse(request.body).keys.auth,'secret');
});
test('incomplete browser subscriptions fail before a network call',async()=>{
  const api=adapter({fetch:()=>assert.fail('No network expected')});
  await assert.rejects(api.savePushSubscription('token',{toJSON:()=>({keys:{}})}));
});
test('service worker readiness is bounded and returns the active registration',async()=>{
  const registration={pushManager:{}};
  const api=adapter({navigator:{serviceWorker:{register:async()=>{},ready:Promise.resolve(registration)}}});
  assert.equal(await api.readyPushRegistration(),registration);
});

function providerHarness({permission='default',existing=null,failSave=false,off=false,auth={user:{email:'teacher@example.test'},token:'token',isLoading:false}}={}) {
  const values=[],calls=[],refs=[];let stateIndex=0;
  const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,useEffect:()=>{},useCallback:fn=>fn,
    useRef:value=>{const ref={current:value};refs.push(ref);return ref;},
    useState:initial=>{const index=stateIndex++;values[index]=index===0?{...initial,checking:false,publicKey:'AQID',permission}:initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];}};
  const subscription={endpoint:'https://push.example/1',options:{applicationServerKey:Uint8Array.from([1,2,3]).buffer},unsubscribe:async()=>true};
  const registration={pushManager:{getSubscription:async()=>existing,subscribe:async()=>{calls.push('subscribe');return subscription;}}};
  const api=load('components/notifications/DevicePushProvider.tsx',{
    react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    '@/lib/auth-context':{useAuth:()=>auth},'@/lib/app-toast':{toast:{success:()=>{},error:()=>{}}},
    '@/lib/push-notifications':platform,
    '@/lib/device-push-client':{pushApi:async()=>{calls.push('config');return {configured:true,public_key:'AQID'};},readyPushRegistration:async()=>registration,subscriptionUsesKey:()=>true,
      savePushSubscription:async()=>{calls.push('save');if(failSave)throw Error('Database unavailable');}},
    '@/components/ui/modal':{Modal:'Modal'},'./InstallTpsApp':{InstallTpsApp:'Install'},swr:{default:()=>({data:null})},'@/lib/auth-headers':{authHeaders:()=>({})},
  },{Notification:{permission,requestPermission:()=>{calls.push('permission');return Promise.resolve('granted');}},
    navigator:{userAgent:'Chrome',maxTouchPoints:0,serviceWorker:{getRegistration:async()=>registration}},
    window:{isSecureContext:true,Notification:{},PushManager:{},matchMedia:()=>({matches:false})},
    localStorage:{getItem:()=>off?'1':null,setItem:()=>{},removeItem:()=>{}},
  });
  const rendered=api.DevicePushProvider({children:null});return {actions:rendered.props.value,values,calls};
}
test('native permission is requested directly from enable action before network',async()=>{
  const h=providerHarness();const pending=h.actions.enable();assert.equal(h.calls[0],'permission');await pending;
  assert.equal(h.values[0].enabled,true);assert.equal(h.values[1],false);
});
test('database failure never produces enabled UI even with browser permission granted',async()=>{
  const h=providerHarness({permission:'granted',failSave:true});await h.actions.enable();assert.equal(h.values[0].enabled,false);assert.match(h.values[0].error,/Database/);
});
test('refresh reconciles existing device with database and suppresses reminder when ready',async()=>{
  const h=providerHarness({permission:'granted',existing:{endpoint:'https://push.example/1'}});await h.actions.refresh();assert.ok(h.calls.includes('save'));assert.equal(h.values[0].enabled,true);assert.equal(h.values[1],false);
});
test('reminder occurs once per document visit instead of every refresh',async()=>{
  const h=providerHarness();await h.actions.refresh();assert.equal(h.values[1],true);h.values[1]=false;await h.actions.refresh();assert.equal(h.values[1],false);
});
test('explicit disable preference and anonymous sessions do not trigger reminders',async()=>{
  const h=providerHarness({off:true});await h.actions.refresh();assert.equal(h.values[1],false);
  const anonymous=providerHarness({auth:{user:null,token:null,isLoading:false}});await anonymous.actions.refresh();assert.equal(anonymous.calls.length,0);
});
