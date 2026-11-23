import {execFileSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
import {legalActions,nextHand} from '../../src/core/engine';
import {act,checkDown,hand,practiceProfile,rig} from '../verification/helpers';
import type {GameState} from '../../src/contracts';
const suite=process.env.RUN_ORACLE==='1'?describe:describe.skip;
const profile=()=>({...practiceProfile(),smallBlind:1,bigBlind:2});
function flop(stacks:number[]):GameState{
 let s=hand(stacks,0,profile());
 while(s.street==='preflop')s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});return s;
}
interface Results {
 B05:{increment:number;next_min_raise_to:number};
 B07_B08:{b:number;c:number;can_raise:boolean;next_min_raise_to:number|null}[];
 C01_C02:{pots:{amount:number;eligible_positions:number[]}[];stacks_sb_bb_utg_btn:number[];settled:boolean};
 heads_up:{preflop_position:number;postflop_position:number;position_definition:string};
}
suite('Step 2 PokerKit 0.7.7 compatible exact scenarios',()=>{
 it('independently matches exact raises, cumulative reopening, four-way eligibility and heads-up action order',()=>{
  const response=JSON.parse(execFileSync(process.env.ORACLE_PYTHON??'python3',['tests/oracle/pokerkit_oracle.py'],{input:JSON.stringify({mode:'step2'}),encoding:'utf8'})) as {version:string;step2:Results};
  expect(response.version).toBe('0.7.7');const expected=response.step2;
  let s=flop([1000,1000]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:260});
  expect(s.minFullRaiseIncrement).toBe(expected.B05.increment);expect(legalActions(s).minRaiseTo).toBe(expected.B05.next_min_raise_to);
  for(const row of expected.B07_B08){
   s=flop([1000,1000,row.b+2,row.c+2]);s=act(s,{type:'raise',to:100});s=act(s,{type:'raise',to:row.b});s=act(s,{type:'raise',to:row.c});s=act(s,{type:'call'});
   expect(legalActions(s).canRaise).toBe(row.can_raise);expect(legalActions(s).minRaiseTo).toBe(row.next_min_raise_to);
  }
  s=rig(hand([50,120,300,300],0,profile()),[['As','Ad'],['Ks','Kd'],['Qs','Qd'],['Jh','Jd']],['2c','4h','7s','9d','Tc']);
  s=act(s,{type:'call'});s=act(s,{type:'raise',to:50});s=act(s,{type:'raise',to:120});s=act(s,{type:'raise',to:300});s=act(s,{type:'call'});
  expect(s.pots.map(p=>({amount:p.amount,eligible:p.eligible}))).toEqual(expected.C01_C02.pots.map(p=>({amount:p.amount,eligible:p.eligible_positions.map(i=>(i+1)%4).sort((a,b)=>a-b)})));
  expect([1,2,3,0].map(i=>s.seats[i].stack)).toEqual(expected.C01_C02.stacks_sb_bb_utg_btn);expect(s.street==='complete').toBe(expected.C01_C02.settled);
  // PokerKit fixes positions inside a hand. It does not independently choose next-hand seats/button.
  s=hand([20000,20000],0,profile());
  for(let i=0;i<20;i++){
   const toPosition=(seat:number|null)=>seat===s.bigBlindSeat?0:seat===s.smallBlindSeat?1:-1;
   expect(toPosition(s.actor)).toBe(expected.heads_up.preflop_position);
   s=act(s,{type:'call'});s=act(s,{type:'check'});expect(toPosition(s.actor)).toBe(expected.heads_up.postflop_position);s=checkDown(s);
   if(i<19)s=nextHand(s,`oracle-hu-${i+1}`);
  }
 });
});
