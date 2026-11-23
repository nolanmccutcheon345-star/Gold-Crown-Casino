import {afterEach,describe,it,expect,vi} from 'vitest';
import {createHash,webcrypto} from 'node:crypto';
import {auditSnapshot,freezeSnapshot,isVerifiedSnapshot} from '../../src/storage/verified';
import {canonical,digest} from '../../src/storage/integrity';
import {SessionController} from '../../src/session/controller';
import {observeTimings} from '../../src/performance/timing';
import {readFileSync} from 'node:fs';
import {migrateData} from '../../src/storage/integrity';
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
import type {AppData,PersistencePort} from '../../src/session/types';
afterEach(()=>{vi.unstubAllGlobals();observeTimings(null);});
describe('Step5C verified recovery reuse and byte-compatible hashing',()=>{
 it.each(['native','fallback'])('matches independent SHA256 including Unicode and large payloads via %s',async path=>{
  vi.stubGlobal('crypto',path==='native'?webcrypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)});
  for(const v of ['', '🎴 ♥ \u0000 \ud800', {z:1,a:[null,true,2]},'x'.repeat(200000)])expect(await digest(v)).toBe(createHash('sha256').update(canonical(v)).digest('hex'));
 });
 it('retains original canonical byte ordering and edge cases',()=>{
  const original=(v:unknown):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(original).join(',')+']':'{'+Object.keys(v).filter(k=>(v as Record<string,unknown>)[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+original((v as Record<string,unknown>)[k])).join(',')+'}';
  const sparse=[undefined,undefined,NaN,Infinity,-0];delete sparse[1];
  const cases=[{10:'ten',2:'two',z:undefined,a:sparse},new Date(0),{'\u0000':true,'🎴':false},...Array.from({length:600},(_,i)=>({[`key-${i}`]:i})),{['x'.repeat(256)]:42}];for(const value of cases)expect(canonical(value)).toBe(original(value));
 });
 it('rejects accessors without invoking them, including nonenumerable and symbol keys',()=>{
  for(const key of ['x',Symbol('x')]){let invoked=0;const o={};Object.defineProperty(o,key,{get(){invoked++;return 1;}});expect(()=>freezeSnapshot(o)).toThrow(/accessors/);expect(invoked).toBe(0);}
 });
 it('freezes nested data and does not trust arbitrary frozen data',()=>{
  const o=freezeSnapshot({a:[{x:1}]});expect(Object.isFrozen(o.a[0])).toBe(true);expect(()=>{o.a[0].x=2;}).toThrow();expect(isVerifiedSnapshot(Object.freeze({}) as AppData)).toBe(false);
 });
 it('performs exactly one full audit across a verified port load and controller initialization',async()=>{
  const samples:string[]=[];observeTimings(s=>samples.push(s.name));const port:PersistencePort={load:async()=>auditSnapshot(await migrateData(fixture.streets.flop)),commit:async()=>{},close(){}};
  const c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(samples.filter(s=>s==='integrity.fullAudit')).toHaveLength(1);c.close();
 });
 it('still fully audits an untrusted custom port and fails closed on corruption',async()=>{
  const input=await migrateData(fixture.streets.flop);input.wallet++;const port:PersistencePort={load:async()=>input,commit:async()=>{},close(){}};const c=new SessionController(port);await c.init();expect(c.status).toBe('error');expect(c.error).toMatch(/Wallet/);expect(isVerifiedSnapshot(input)).toBe(false);c.close();
 });
});
