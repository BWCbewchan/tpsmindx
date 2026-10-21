import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrafficMonitor, trafficTier, trafficSample, formatTrafficAlert, TRAFFIC_SAMPLE_SQL } from '../lib/traffic-monitor.mjs';

const row = (connections = 30) => ({ max_connections: 60, reserved_connections: 3, connections,
  active_users: 42, busy_connections: 5, idle_connections: connections - 5, lock_waiters: 1 });

test('threshold boundaries preserve exact percentages and do not cap overload', () => {
  for (const [percent, expected] of [[0,0],[50,0],[50.1,50],[70,50],[70.1,70],[90,70],[90.1,90],[100,100],[124,100],[125,125],[151,150]]) {
    assert.equal(trafficTier(percent), expected);
  }
  assert.throws(() => trafficTier(NaN));
  assert.throws(() => trafficSample({}));
  assert.throws(() => trafficSample({...row(),max_connections:3}));
  assert.match(TRAFFIC_SAMPLE_SQL,/count\(DISTINCT lower\(trim\(user_id\)\)\)/);
  assert.ok(!TRAFFIC_SAMPLE_SQL.includes('session_tracking'));
});

test('messages state distinct people and actual connection budget, not a fictional user capacity', () => {
  const sample = trafficSample(row(58));
  assert.equal(sample.budget,57);
  const text = formatTrafficAlert(sample);
  assert.match(text,/42/); assert.match(text,/58\/57 \(101.8%\)/);
  assert.match(text,/Vượt ngân sách kết nối: <b>1/);
  assert.match(text,/không phải CPU\/RAM/);
});

function fixture() {
  let time=1_000_000, checked=-Infinity, delivered=-Infinity, tier=0, lease=null;
  let current=row(), fail=false, rejectSample=false;
  const messages=[], calls=[];
  const query=async(sql,values=[])=>{
    calls.push(sql);
    if(sql.includes('traffic:sample-claim')) {
      if(time-checked<60_000)return {rows:[]};
      checked=time;return {rows:[{monitor_key:'database'}]};
    }
    if(sql===TRAFFIC_SAMPLE_SQL) {if(rejectSample)throw new Error('DB unavailable');return {rows:[current]};}
    if(sql.includes('traffic:delivery-claim')) {
      const [,next,percent,token]=values;
      const due=next>tier||(next===0&&tier>0&&percent<=45)||(next>0&&time-delivered>900_000);
      if(!lease&&due)lease=token;
      return {rows:[{delivery_token:lease}]};
    }
    if(sql.includes('traffic:delivered')) {tier=values[0];delivered=time;lease=null;}
    if(sql.includes('traffic:release'))lease=null;
    return {rows:[]};
  };
  const send=async text=>{if(fail)throw new Error('Telegram unavailable');messages.push(text);};
  return { monitor:()=>createTrafficMonitor({query,send,clock:()=>time}),messages,calls,
    advance:ms=>time+=ms, set:n=>current=row(n), fail:v=>fail=v, rejectSample:v=>rejectSample=v };
}

test('cross-instance throttling, escalation and reminder cooldown', async () => {
  const f=fixture(), a=f.monitor(), b=f.monitor();
  assert.equal((await a()).notified,true);
  assert.equal((await b()).status,'throttled');
  f.advance(61_000); assert.equal((await b()).notified,false);
  f.set(41); f.advance(61_000); assert.equal((await a()).notified,true);
  assert.match(f.messages.at(-1),/mốc 70%/);
  f.set(52); f.advance(61_000); assert.equal((await b()).notified,true);
  f.advance(61_000); assert.equal((await a()).notified,false);
  f.advance(901_000); assert.equal((await a()).notified,true);
});

test('recovery has hysteresis and is sent once',async()=>{
  const f=fixture(),check=f.monitor();await check();
  f.set(28);f.advance(61_000);assert.equal((await check()).notified,false);
  f.set(20);f.advance(61_000);assert.equal((await check()).notified,true);
  assert.match(f.messages.at(-1),/đã giảm/);
  f.advance(61_000);assert.equal((await check()).notified,false);
});

test('failed delivery releases claim and never advances successful state', async()=>{
  const f=fixture(),check=f.monitor();f.fail(true);
  await assert.rejects(check(),/Telegram unavailable/);
  assert.ok(f.calls.some(sql=>sql.includes('traffic:release')));
  assert.ok(!f.calls.some(sql=>sql.includes('traffic:delivered')));
  f.fail(false);f.advance(61_000);assert.equal((await check()).notified,true);
});

test('database failures never produce a false recovery alert',async()=>{
  const f=fixture(),check=f.monitor();f.rejectSample(true);
  await assert.rejects(check(),/DB unavailable/);assert.equal(f.messages.length,0);
});
