import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('app/admin/email-monitor/page.tsx','utf8');
const start=source.indexOf('  const loadData = useCallback(');
const end=source.indexOf('\n  useEffect(',start);
const code=ts.transpileModule(source.slice(start,end)+'\nexports.load=loadData;', {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness({settingsOpen=false,authLoading=false}={}) {
  const exports={},calls=[],states={errors:[],data:[],settings:[],loading:[]},timers=[];
  vm.runInNewContext(code,{exports,useCallback:f=>f,authLoading,user:{role:'super_admin'},token:'fake',authHeaders:()=>({}),
    category:'',debouncedSearch:'',emailType:'',senderAccount:'55',page:1,period:'24h',status:'',AbortController,DOMException,URLSearchParams,
    activeRequestRef:{current:null},settingsOpenRef:{current:settingsOpen},
    window:{setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){}},
    fetch:async url=>{const d=deferred();calls.push({url,...d});return d.promise;},
    setLoading:x=>states.loading.push(x),setRefreshing(){},setAuthenticationRequired(){},
    setError:x=>states.errors.push(x),setData:x=>states.data.push(x),setSettingsForm:x=>states.settings.push(x),
  });
  const respond=(index,body,status=200)=>calls[index].resolve({ok:status===200,status,json:async()=>body});
  return {load:exports.load,calls,states,timers,respond};
}
test('older results cannot replace a newer search response',async()=>{
  const h=harness();const old=h.load();const latest=h.load();
  h.respond(1,{success:true,version:'new',settings:{}});await latest;
  h.respond(0,{success:true,version:'old',settings:{}});await old;
  assert.deepEqual(h.states.data.map(x=>x.version),['new']);assert.ok(!h.states.errors.some(Boolean));
});
test('intentional abort does not show a timeout while the next request loads',async()=>{
  const h=harness();const old=h.load();const latest=h.load();
  h.calls[0].reject(new DOMException('Cancelled','AbortError'));await old;
  assert.equal(h.states.errors.length,0);
  h.respond(1,{success:true,settings:{}});await latest;
});
test('automatic refresh preserves an open configuration draft',async()=>{
  const h=harness({settingsOpen:true});const pending=h.load(true);
  h.respond(0,{success:true,settings:{dailyMessageLimit:2000}});await pending;
  assert.equal(h.states.data.length,1);assert.equal(h.states.settings.length,0);
});
test('actual timeout is reported and a later refresh can recover',async()=>{
  const h=harness();const pending=h.load();h.timers[0]();h.calls[0].reject(new DOMException('Timeout','AbortError'));await pending;
  assert.match(h.states.errors[0],/30 giây/);
  const next=h.load(true);h.respond(1,{success:true,settings:{}});await next;
  assert.equal(h.states.errors.at(-1),'');assert.equal(h.states.data.length,1);
});
test('no protected request runs until authentication has resolved',async()=>{
  const h=harness({authLoading:true});await h.load();assert.equal(h.calls.length,0);
});
test('account filter is sent to the backend',async()=>{
  const h=harness();const pending=h.load();assert.match(h.calls[0].url,/accountId=55/);h.respond(0,{success:true,settings:{}});await pending;
});
