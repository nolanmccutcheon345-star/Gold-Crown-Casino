import { describe, expect, it } from 'vitest';
import { compareRanks, evaluate } from '../../src/core/evaluator';
import { scenarios } from './scenarios';
import { analyzeDecision, createProfile } from '../../src/bots/policy';
import { observeBot } from '../../src/core/engine';

describe('Independent conservative forced-draw payoff bound',()=>{
 it('counts at least seven winning heart rivers against every legal opponent holding, above the forced all-in price',()=>{
  const own=['Ah','Kh'],board=['Qh','7h','2c','3d'];
  const unseen=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(card=>![...own,...board].includes(card));
  const hearts=unseen.filter(c=>c[1]==='h');let minimum=99,holdings=0;
  for(let a=0;a<unseen.length;a++)for(let b=a+1;b<unseen.length;b++){
   const opponent=[unseen[a],unseen[b]];let winningHearts=0;
   for(const river of hearts)if(!opponent.includes(river)&&compareRanks(evaluate([...own,...board,river]),evaluate([...opponent,...board,river]))>0)winningHearts++;
   minimum=Math.min(minimum,winningHearts);holdings++;
  }
  expect(holdings).toBe(1035);expect(minimum).toBe(7);
  const scenario=scenarios().find(s=>s.id==='turn-cheap-forced-flushdraw')!;const p=createProfile({selection:'tag'},7,'neutral');const o=observeBot(scenario.state,0,p.policyVersion,'bound');
  expect(o.legal.callAmount).toBe(200);expect(o.pot+o.legal.callAmount).toBe(2400);expect(o.seats.find(s=>s.id===1)!.allIn).toBe(true);
  expect(minimum/44).toBeGreaterThan(o.legal.callAmount/(o.pot+o.legal.callAmount));
  expect((minimum/44)*(o.pot+o.legal.callAmount)-o.legal.callAmount).toBeGreaterThan(181);
 },20000);
 it('competent profiles do not systematically discard the strictly profitable forced call',()=>{
  const scenario=scenarios().find(s=>s.id==='turn-cheap-forced-flushdraw')!;
  for(const archetype of ['tag','stronger-reg'] as const){const p=createProfile({selection:archetype},1001+(archetype==='tag'?2:7),'neutral');
   const o=observeBot(scenario.state,0,p.policyVersion,'bound-action');expect(analyzeDecision(o,p).distribution.fold).toBeLessThanOrEqual(.1);}
 });
});
