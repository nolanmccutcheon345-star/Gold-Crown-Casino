import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { evaluate } from '../../src/core/evaluator';
import { legalActions } from '../../src/core/engine';
import {act, checkDown, hand, lexCompare, practiceProfile, rig} from '../verification/helpers';

/** Explicit opt-in: absence of Python must never be represented as an oracle pass. */
const oracleSuite = process.env.RUN_ORACLE==='1' ? describe : describe.skip;
function oracle(request:unknown):Record<string,unknown>{
 return JSON.parse(execFileSync(process.env.ORACLE_PYTHON??'python3',['tests/oracle/pokerkit_oracle.py'],{input:JSON.stringify(request),encoding:'utf8'}));
}
oracleSuite('Pinned independent PokerKit 0.7.7 comparisons',()=>{
 it('agrees on 240 seeded five/seven-card comparisons plus analytical ties and wheel',()=>{
  const deck='23456789TJQKA'.split('').flatMap(r=>'cdhs'.split('').map(s=>r+s));
  const draws=fc.sample(fc.uniqueArray(fc.integer({min:0,max:51}),{minLength:14,maxLength:14}),{seed:30286,numRuns:240});
  const cases=draws.map((d,i)=>({a:d.slice(0,i%2?7:5).map(j=>deck[j]),b:d.slice(7,i%2?14:12).map(j=>deck[j])}));
  cases.push({a:['As','2d','3h','4c','5s'],b:['2s','3d','4h','5c','6s']});
  cases.push({a:['As','Ks','Qs','Js','Ts','2d','3c'],b:['Ac','Kc','Qc','Jc','Tc','5d','6h']});
  const result=oracle({mode:'compare',cases});expect(result.version).toBe('0.7.7');
  expect(cases.map(c=>lexCompare(evaluate(c.a),evaluate(c.b)))).toEqual(result.comparisons);
 });
 it('DEF-003 matches PokerKit for tied winners with differently sized folded contributions',()=>{
  const result=oracle({mode:'rules'});
  const expected=result.folded_tie as {stacks_sb_bb_utg_co_btn:number[];settled:boolean};
  const p=practiceProfile();p.smallBlind=1;p.bigBlind=2;
  let s=rig(hand([100,100,100,100,100],0,p),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
  s=act(s,{type:'raise',to:5});s=act(s,{type:'call'});s=act(s,{type:'call'});
  s=act(s,{type:'fold'});s=act(s,{type:'fold'});
  s=act(s,{type:'raise',to:2});s=act(s,{type:'fold'});s=act(s,{type:'call'});s=checkDown(s);
  expect([1,2,3,4,0].map(i=>s.seats[i].stack)).toEqual(expected.stacks_sb_bb_utg_co_btn);
  expect(s.street==='complete').toBe(expected.settled);
 });
 it('matches independent PokerKit all-in main/side pot and short opening semantics',()=>{
  const result=oracle({mode:'rules'});
  const expectedSide=result.sidepot as {stacks_sb_bb_btn:number[];actors_sb_bb_btn:number[];settled:boolean};
  const p=practiceProfile();p.smallBlind=1;p.bigBlind=2;
  let s=rig(hand([100,200,300],0,p),[['As','Ad'],['Ks','Kd'],['Qs','Qd']],['2c','4h','7s','9d','Jc']);
  const actors=[s.actor];s=act(s,{type:'raise',to:100});actors.push(s.actor);
  s=act(s,{type:'raise',to:200});actors.push(s.actor);s=act(s,{type:'call'});
  expect([s.seats[1].stack,s.seats[2].stack,s.seats[0].stack]).toEqual(expectedSide.stacks_sb_bb_btn);
  expect(actors.map(id=>(id!+2)%3)).toEqual(expectedSide.actors_sb_bb_btn);
  expect(s.street==='complete').toBe(expectedSide.settled);
  const expected=result.short_opening as {next_min_raise_to:number;prior_checker_min_raise_to:number;prior_checker_can_raise_3:boolean};
  s=rig(hand([100,100,3],0,p),[['Qs','Qc'],['As','Ac'],['Ks','Kc']],['2c','3d','4h','8s','9h']);
  s=act(s,{type:'call'});s=act(s,{type:'call'});s=act(s,{type:'check'});
  s=act(s,{type:'check'});s=act(s,{type:'raise',to:1});
  expect(legalActions(s).minRaiseTo).toBe(expected.next_min_raise_to);
  s=act(s,{type:'call'});
  expect(legalActions(s).minRaiseTo).toBe(expected.prior_checker_min_raise_to);
  expect(legalActions(s).canRaise).toBe(expected.prior_checker_can_raise_3);
 });
});
