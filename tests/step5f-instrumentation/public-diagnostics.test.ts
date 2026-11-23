import {afterEach,describe,expect,it} from 'vitest';
import {startPublicPerformanceDiagnostics,PERFORMANCE_SAMPLE_EVENT,type PublicTimingSample} from '../../src/performance/public-diagnostics';
import {observeTimings,timed,timedAsync} from '../../src/performance/timing';

function target(search='?measurePerformance=1'){
 const node=Object.assign(new EventTarget(),{location:{search}}),samples:PublicTimingSample[]=[];
 node.addEventListener(PERFORMANCE_SAMPLE_EVENT,event=>samples.push((event as CustomEvent<PublicTimingSample>).detail));
 return{node,samples,target:node as unknown as Parameters<typeof startPublicPerformanceDiagnostics>[0]};
}
afterEach(()=>observeTimings(null));
describe('explicit timing-only candidate instrumentation',()=>{
 it.each(['','?measurePerformance=0','?measurePerformance=true'])('is disabled for %s without installing a sampler',search=>{
  const t=target(search);startPublicPerformanceDiagnostics(t.target);expect(timed('bot.policy',()=>42)).toBe(42);expect(t.samples).toEqual([]);
 });
 it('records measured intervals for synchronous and asynchronous work without its return values',async()=>{
  const t=target();const stop=startPublicPerformanceDiagnostics(t.target);
  const secret={holeCards:['As','Ah'],wallet:12345,policy:{bluff:0.7}};
  expect(timed('bot.policy',()=>secret)).toBe(secret);expect(await timedAsync('persistence.transaction',async()=>secret)).toBe(secret);
  expect(t.samples.map(s=>s.name)).toEqual(['bot.policy','persistence.transaction']);
  for(const [index,s] of t.samples.entries()){
   expect(Object.keys(s).sort()).toEqual(['version','name','milliseconds','startTime','endTime','sequence'].sort());
   expect(s.sequence).toBe(index+1);expect(s.milliseconds).toBe(s.endTime-s.startTime);expect(s.milliseconds).toBeGreaterThanOrEqual(0);expect(Object.isFrozen(s)).toBe(true);
  }
  expect(JSON.stringify(t.samples)).not.toMatch(/holeCards|wallet|bluff|As|Ah/);stop();
 });
 it('does not expose unrecognized timing names or payloads',()=>{
  const t=target();startPublicPerformanceDiagnostics(t.target);timed('private:As-Ah:profile',()=>7);expect(t.samples).toEqual([]);
 });
 it('keeps failure semantics and stops on pagehide or explicit disposal',async()=>{
  const t=target();const stop=startPublicPerformanceDiagnostics(t.target),failure=new Error('original');
  expect(()=>timed('bot.policy',()=>{throw failure;})).toThrow(failure);
  await expect(timedAsync('persistence.transaction',async()=>{throw failure;})).rejects.toBe(failure);
  expect(t.samples).toHaveLength(2);t.node.dispatchEvent(new Event('pagehide'));timed('bot.policy',()=>9);stop();expect(t.samples).toHaveLength(2);
 });
 it('never turns a diagnostic delivery failure into a game or persistence failure',async()=>{
  const t=target();Object.assign(t.node,{dispatchEvent:()=>{throw Error('test diagnostic transport failure');}});startPublicPerformanceDiagnostics(t.target);
  expect(timed('bot.policy',()=>11)).toBe(11);expect(await timedAsync('persistence.transaction',async()=>12)).toBe(12);
 });
});
