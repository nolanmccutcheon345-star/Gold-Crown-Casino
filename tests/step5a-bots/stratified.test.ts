import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {observeBot,applyCommand,assertAccounting} from '../../src/core/engine';
import {defaultProfile,analyzeDecision,chooseDecision,buildOpponentMemory} from '../../src/bots/policy';
import {rng,wilson} from '../step4c/audit';
import {fixture,reference,observedHistories} from './reference';

const cases=[
 {id:'river-nuts',own:['Kc','Kd'],board:['Ks','9h','4c','2d','7s']},
 {id:'river-strong-set',own:['9c','9d'],board:['Ks','9h','4c','2d','7s']},
 {id:'river-two-pair',own:['Kc','9d'],board:['Ks','9h','4c','2d','7s']},
 {id:'river-medium-catcher',own:['Qc','Qd'],board:['Ks','9h','4c','2d','7s']},
 {id:'river-weak-air',own:['Jc','Tc'],board:['Ks','9h','4c','2d','7s']},
 {id:'river-ace-flush-blocker',own:['Ah','Qd'],board:['Kh','9h','4h','2d','7s']},
 {id:'river-no-flush-blocker',own:['Ac','Qd'],board:['Kh','9h','4h','2d','7s']},
 {id:'turn-nut-flush-draw',own:['Ah','Qh'],board:['Ks','9h','4c','2h'],street:'turn' as const},
 {id:'turn-weak-draw',own:['Jc','Tc'],board:['Ks','9h','4c','2h'],street:'turn' as const},
];
it('runs frozen independent stratified range sensitivities and 27000 legal policy samples',()=>{
 const p=defaultProfile('stronger-reg'),histories={
  'value-heavy':observedHistories('value-heavy'),mixed:observedHistories('mixed'),overbluffing:observedHistories('overbluffing')};
 const rows=[];
 for(const [ci,c] of cases.entries()){
  const game=fixture(c.own,c.board,c.street),initial=observeBot(game,game.actor!,p.policyVersion,`${c.id}-baseline`);initial.rake=game.profile.rake;
  const exact=reference(initial);expect(exact.groups.value.combos).toBeGreaterThan(0);expect(exact.groups.bluff.combos).toBeGreaterThan(0);
  for(const [mi,mode] of (['value-heavy','mixed','overbluffing'] as const).entries()){
   const o=structuredClone(initial);o.memory=buildOpponentMemory(histories[mode],o.actingSeat,p.traits!.memoryRetention);
   const a=analyzeDecision(o,p),random=rng(0x5a125000+ci*100+mi),counts={fold:0,check:0,call:0,raise:0};
   for(let i=0;i<1000;i++){const decision=chooseDecision(o,p,random);counts[decision.action.type]++;const next=applyCommand(game,decision);assertAccounting(next);}
   const continuation=counts.call+counts.raise;
   rows.push({case:c,mode,observedMemory:o.memory,reference:exact,policy:{distribution:a.distribution,features:a.features,postflop:a.postflop,context:a.context,rangeEquity:a.ranges?.equity,rangeStdError:a.ranges?.equityStdError,rangeSamples:a.ranges?.equitySamples},sample:{counts,opportunities:1000,continue:continuation,conditionalWilson95:wilson(continuation,1000)},observation:o});
  }
 }
 const catcher=rows.find(r=>r.case.id==='river-medium-catcher')!;
 expect(catcher.reference.mixes[0].callEV).toBeCloseTo(-600,8);expect(catcher.reference.mixes[1].callEV).toBeCloseTo(0,8);expect(catcher.reference.mixes[2].callEV).toBeCloseTo(600,8);
 expect(rows.filter(r=>r.case.id==='river-nuts').every(r=>r.policy.distribution.fold===0)).toBe(true);
 const blocker=rows.find(r=>r.case.id==='river-ace-flush-blocker')!,unblocked=rows.find(r=>r.case.id==='river-no-flush-blocker')!;
 expect(blocker.reference.groups.value.combos).not.toBe(unblocked.reference.groups.value.combos);
 if(process.env.STEP5A_MATRIX==='1'){
  writeFileSync('tests/step5a-bots/evidence/stratified-matrix.json.gz',gzipSync(JSON.stringify({policy:p,rows,histories})));
  writeFileSync('tests/step5a-bots/evidence/stratified-summary.json',JSON.stringify(rows.map(({observation:_observation,observedMemory:_memory,policy,...r})=>({...r,policy:{distribution:policy.distribution,rangeEquity:policy.rangeEquity,continue:1-policy.distribution.fold}})),null,2));
 }
},120000);
