import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {assertAccounting,legalActions,projectView} from '../../src/core/engine';
import {act,practiceProfile,seededHand} from '../verification/helpers';
import {rng} from '../step5a-pricing/fixtures';

const oracle=process.env.RUN_ORACLE==='1'?describe:describe.skip;
interface Snapshot {actor:number|null;street:string;stacks:number[];streetCommitted:number[];refunds:number[];awards:number[];wager:number|null;pots:{amount:number;eligible:number[]}[]|null;}
interface TraceCase {id:string;seed:number;unit:number;stacks:number[];profile:RuleProfile;engineVersion:string;smallBlind:number;bigBlind:number;holes:string[][];board:string[];burns:string[];actions:(Action&{seatId:number})[];}
function snapshot(state:GameState,wager:number|null=null):Snapshot{
 const amounts=(type:'refund'|'award')=>state.seats.map(s=>state.events.filter(e=>e.type===type&&e.seatId===s.id).reduce((n,e)=>n+(e.amount??0),0));
 return {actor:state.actor,street:state.street,stacks:state.seats.map(s=>s.stack),streetCommitted:state.seats.map(s=>s.streetCommitted),refunds:amounts('refund'),awards:amounts('award'),wager,
  pots:projectView(state,0).pots.map(({amount,eligible})=>({amount,eligible}))};
}
oracle('V502 sequential independent PokerKit 0.7.7 state/payout trace',()=>{
 it('compares every actor, actual wager, stack, collected-pot eligibility, refund and award in 18 seeded full hands',()=>{
  const cases:TraceCase[]=[],expected:Snapshot[][]=[];
  for(const count of [2,3,6])for(const unit of [1,5,100])for(const trial of [0,1]){
   const seed=0x502000+count*100+unit+trial,random=rng(seed),profile={...practiceProfile(),chipUnit:unit,smallBlind:unit,bigBlind:unit*2};
   const stacks=Array.from({length:count},(_,i)=>(30+(i*83+trial*47)%271)*unit);
   let state=seededHand(stacks,seed,profile);const initial=structuredClone(state),actions:(Action&{seatId:number})[]=[],states=[snapshot(state)];
   let steps=0;
   while(state.street!=='complete'&&steps++<200){
    const legal=legalActions(state),n=random();let action:Action;
    // Keep two contenders so settlement maps exactly to PokerKit's showdown
    // award/refund protocol. Folded dead money still appears at 3/6 seats.
    if(n<.15&&state.seats.filter(s=>!s.folded).length>2)action={type:'fold'};
    else if(n<.35&&legal.canRaise)action={type:'raise',to:legal.shortAllInTo??(trial?legal.maxRaiseTo!:legal.minRaiseTo!)};
    else action={type:legal.check?'check':'call'};
    actions.push({...action,seatId:state.actor!});state=act(state,action);assertAccounting(state);
    states.push(snapshot(state,state.events.filter(e=>e.type==='action').at(-1)!.amount??0));
   }
   expect(state.street).toBe('complete');expect(state.board).toHaveLength(5);
   cases.push({id:`seed-${seed}-unit-${unit}-seats-${count}`,seed,unit,stacks,profile,engineVersion:initial.engineVersion,smallBlind:profile.smallBlind,bigBlind:profile.bigBlind,
    holes:initial.seats.map(s=>s.hole),board:state.board,burns:state.burned,actions});expected.push(states);
  }
  const result=JSON.parse(execFileSync(process.env.ORACLE_PYTHON??'python3',['tests/step5b-engine/pokerkit_trace.py'],{input:JSON.stringify({cases}),encoding:'utf8'})) as {version:string;traces:{id:string;snapshots:Snapshot[]}[]};
  expect(result.version).toBe('0.7.7');let decisions=0,potCheckpoints=0,refundHands=0,sidePotHands=0,folds=0;
  result.traces.forEach((trace,index)=>{
   const wanted=expected[index];expect(trace.snapshots).toHaveLength(wanted.length);
   trace.snapshots.forEach((actual,step)=>{
    expect(actual.actor,`${trace.id}:${step}:actor`).toBe(wanted[step].actor);expect(actual.street).toBe(wanted[step].street);
    expect(actual.wager,`${trace.id}:${step}:wager`).toBe(wanted[step].wager);expect(actual.stacks,`${trace.id}:${step}:stacks`).toEqual(wanted[step].stacks);
    // Engine retains final-street commitment evidence after settlement; PokerKit
    // zeroes its betting working array. Compare active streets exactly.
    if(actual.street!=='complete')expect(actual.streetCommitted).toEqual(wanted[step].streetCommitted);
    expect(actual.refunds,`${trace.id}:${step}:refunds`).toEqual(wanted[step].refunds);expect(actual.awards,`${trace.id}:${step}:awards`).toEqual(wanted[step].awards);
    if(actual.pots!==null){expect(actual.pots,`${trace.id}:${step}:eligible-pots`).toEqual(wanted[step].pots);potCheckpoints++;}
    if(step>0)decisions++;
   });
   const last=wanted.at(-1)!;if(last.refunds.some(n=>n>0))refundHands++;if(last.pots!.length>1)sidePotHands++;folds+=cases[index].actions.filter(a=>a.type==='fold').length;
  });
  expect(refundHands).toBeGreaterThan(0);expect(sidePotHands).toBeGreaterThan(0);expect(folds).toBeGreaterThan(0);expect(potCheckpoints).toBeGreaterThan(18);
  if(process.env.STEP5B_TRACE_REPORT==='1')writeFileSync(new URL('./pokerkit-trace-evidence.json',import.meta.url),JSON.stringify({oracle:'PokerKit',version:result.version,node:process.version,platform:process.platform,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hands:cases.length,decisions,potCheckpoints,refundHands,sidePotHands,folds,
   scope:'No-rake NLHE cash showdown; unit 1/5/100 cents; fixed starting button. Rake, antes, straddles, tournament/dead button and all-fold pull/refund representation are explicitly outside this adapter.',cases,expected,actual:result.traces},null,2)+'\n');
 });
});
