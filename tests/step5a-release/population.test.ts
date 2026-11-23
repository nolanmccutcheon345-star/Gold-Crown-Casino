import {describe,expect,it} from 'vitest';
import {sessionBlock,CONFIGURATIONS} from './population';
describe('Step5A continuous-session population accounting harness',()=>{
 it.each(CONFIGURATIONS.map((c,i)=>[c.id,i] as const))('%s retains stacks and reconciles independently across three actual hands',(_,i)=>{
  const b=sessionBlock(i,0,3);expect(b.hands).toHaveLength(3);expect(b.endingTable+b.endingWallet+b.rake).toBe(b.initialTable+b.initialWallet);
  expect(new Set(b.transfers.map(t=>t.id)).size).toBe(b.transfers.length);
  for(let h=1;h<b.hands.length;h++)for(const s of b.hands[h].initial){const prior=b.hands[h-1].final.find(x=>x.id===s.id)!;expect(s.stack).toBe(prior.stack+b.transfers.filter(t=>t.afterHand===h-1&&t.seatId===s.id).reduce((n,t)=>n+t.amount,0));}
  expect(b.hands.every(h=>h.profiles===b.profiles)).toBe(true);
 });
 it('reproduces exact public actions and settlements for a fixed seed independent of compute timing',()=>{
  const a=sessionBlock(0,1,3),b=sessionBlock(0,1,3);expect(a.hands).toEqual(b.hands);expect(a.transfers).toEqual(b.transfers);expect(a.metrics).toEqual(b.metrics);
 });
});
