import {afterAll,describe,expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import type {BotObservation,GameState,RuleProfile} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot} from '../../src/core/engine';
import {contestablePricing} from '../../src/bots/pricing';
import {analyzeDecision,ARCHETYPES,chooseDecision,defaultProfile,POLICY_VERSION} from '../../src/bots/policy';
import {pokerStarsProfile} from '../../src/rules/pokerstars';
import {act,hand,practiceProfile,rig,seededHand} from '../verification/helpers';
import {rng} from '../step5a-pricing/fixtures';

/** Independent public contribution-layer oracle. No engine or pricing arithmetic
 * is called here; half-even uses decimal comparison and denomination units. */
function reference(o:BotObservation){
 const me=o.seats.find(s=>s.id===o.actingSeat)!,cost=o.legal.callAmount,unit=o.chipUnit??1;
 const final=o.seats.map(s=>({...s,amount:s.totalCommitted+(s.id===me.id?cost:0)}));
 const levels=[...new Set(final.map(s=>s.amount).filter(n=>n>0))].sort((a,b)=>a-b);
 const pools:{amount:number;eligible:number[]}[]=[],refunds:Record<number,number>={};let previous=0;
 for(const level of levels){
  const contributors=final.filter(s=>s.amount>=level),amount=(level-previous)*contributors.length;previous=level;
  if(contributors.length===1){refunds[contributors[0].id]=(refunds[contributors[0].id]??0)+amount;continue;}
  const eligible=contributors.filter(s=>!s.folded).map(s=>s.id).sort((a,b)=>a-b),last=pools.at(-1);
  if(last&&JSON.stringify(last.eligible)===JSON.stringify(eligible))last.amount+=amount;else pools.push({amount,eligible});
 }
 const matched=pools.reduce((n,p)=>n+p.amount,0),eligible=pools.filter(p=>p.eligible.includes(me.id)).reduce((n,p)=>n+p.amount,0);
 const active=o.seats.filter(s=>!s.folded),funded=active.filter(s=>s.stack-(s.id===me.id?cost:0)>0);
 const streetTotal=(s:typeof me)=>s.streetCommitted+(s.id===me.id?cost:0);
 const runout=active.length>=2&&(funded.length===0||(funded.length===1&&active.every(s=>streetTotal(s)<=streetTotal(funded[0]))));
 const charged=!!o.rake&&(!o.rake.noFlopNoDrop||o.board.length>=3||(o.street==='preflop'&&runout));
 const decimal=matched*(o.rake?.basisPoints??0)/10000/unit,lower=Math.floor(decimal),fraction=decimal-lower;
 const rounded=o.rake?.rounding==='half-even'?(fraction>0.5?lower+1:fraction<0.5?lower:lower%2?lower+1:lower):lower;
 const rake=charged?Math.min(o.rake!.cap,rounded*unit):0;
 const netPools=structuredClone(pools);let remaining=rake;
 for(const pool of netPools){const taken=Math.min(pool.amount,remaining);pool.amount-=taken;remaining-=taken;}
 const eligibleNet=netPools.filter(p=>p.eligible.includes(me.id)).reduce((n,p)=>n+p.amount,0);
 const payouts:Record<number,number>={};
 for(const pool of netPools){
  const winners=[...pool.eligible.filter(id=>id>o.button),...pool.eligible.filter(id=>id<=o.button)],chips=pool.amount/unit;
  const each=Math.floor(chips/winners.length),odd=chips-each*winners.length;
  winners.forEach((id,index)=>{payouts[id]=(payouts[id]??0)+(each+(index<odd?1:0))*unit;});
 }
 return {cost,matched,eligible,eligibleNet,rake,excluded:o.pot+cost-eligible,price:cost===0?0:cost/Math.max(1,eligible),rakePrice:cost===0?0:cost/Math.max(1,eligibleNet),pools:netPools,refunds,payouts};
}
function observation(state:GameState):BotObservation{return {...observeBot(state,state.actor!,POLICY_VERSION,`5b-price:${state.handId}:${state.revision}`),rake:state.profile.rake};}
function compare(state:GameState){
 const o=observation(state),before=structuredClone(o),actual=contestablePricing(o),expected=reference(o);
 expect(actual.callAmount).toBe(expected.cost);expect(actual.contestableAfterCall).toBe(expected.eligible);expect(actual.excludedChips).toBe(expected.excluded);
 expect(actual.estimatedRake).toBe(expected.rake);expect(actual.price).toBeCloseTo(expected.price,13);expect(actual.rakeAdjustedPrice).toBeCloseTo(expected.rakePrice,13);expect(o).toEqual(before);
 return {o,actual,expected};
}
function boardHand(stacks:number[],profile:RuleProfile,button=0){
 const board=['Ac','Kc','Qc','Jc','Tc'];const unused='23456789TJQKA'.split('').flatMap(r=>'cdhs'.split('').map(s=>r+s)).filter(c=>!board.includes(c));
 return rig(hand(stacks,button,profile),stacks.map((_,i)=>unused.slice(i*2,i*2+2)),board);
}
function toStreet(state:GameState,street:'flop'|'river'){
 while(state.street!==street)state=act(state,legalActions(state).check?{type:'check'}:{type:'call'});return state;
}
const evidence:{cases:unknown[];simulation:{hands:number;decisions:number;raises:number;calls:number;excludedCalls:number}}={cases:[],simulation:{hands:0,decisions:0,raises:0,calls:0,excludedCalls:0}};
afterAll(()=>{if(process.env.STEP5B_BOT_PRICING_REPORT==='1')writeFileSync(new URL('./bot-pricing-denomination-evidence.json',import.meta.url),JSON.stringify({policy:POLICY_VERSION,sourceVersion:'2026-11-01',...evidence},null,2)+'\n');});

describe('Step5B independent bot pricing and whole-chip authority',()=>{
 it.each([2,3,5])('source caps at %i dealt-in players exclude inaccessible tiers and settle exact ties',count=>{
  const stacks=[3000,10000,7000,1000,1500].slice(0,count);let state=toStreet(boardHand(stacks,pokerStarsProfile(100,200)),'flop');
  state=act(state,{type:'raise',to:legalActions(state).maxRaiseTo!});while(state.actor!==0)state=act(state,{type:'call'});
  const {o,expected}=compare(state);expect(expected.rake).toBe(count<=3?125:275);expect(expected.excluded).toBeGreaterThan(0);
  const final=act(state,{type:'call'});expect(final.street).toBe('complete');expect(final.rake).toBe(expected.rake);expect(final.payouts).toEqual(expected.payouts);
  expect(final.pots.map(({amount,eligible})=>({amount,eligible}))).toEqual(expected.pools);assertAccounting(final);
  evidence.cases.push({kind:'source-sidepot',count,observation:o,expected,payouts:final.payouts});
 });
 it.each([[5,0],[15,2],[25,2],[35,4],[45,4]])('prices a known runout with %i cents each and source half-even rake %i',(stack,rake)=>{
  let state=boardHand([stack,stack],pokerStarsProfile(1,2));state=act(state,{type:'raise',to:stack});
  const {o,expected}=compare(state);expect(expected.rake).toBe(rake);
  const final=act(state,{type:'call'});expect(final.rake).toBe(rake);expect(final.payouts).toEqual(expected.payouts);assertAccounting(final);
  evidence.cases.push({kind:'source-half-even',stack,observation:o,expected,payouts:final.payouts});
 });
 it.each([1,5,25,100])('custom denomination %i prices short calls and exact whole-chip side-pot ties',unit=>{
  const profile={...practiceProfile(),chipUnit:unit,smallBlind:unit,bigBlind:unit*2,rake:{basisPoints:500,cap:7*unit,noFlopNoDrop:true}};
  let state=toStreet(boardHand([17,101,83].map(n=>n*unit),profile),'flop');state=act(state,{type:'raise',to:legalActions(state).maxRaiseTo!});state=act(state,{type:'call'});
  const {o,expected}=compare(state);expect(expected.eligible).toBe(51*unit);expect(expected.rake).toBe(7*unit);expect(expected.cost).toBe(15*unit);
  const final=act(state,{type:'call'});expect(final.rake).toBe(expected.rake);expect(final.payouts).toEqual(expected.payouts);assertAccounting(final);
  expect(final.seats.every(s=>s.stack%unit===0)).toBe(true);evidence.cases.push({kind:'unit-sidepot',unit,observation:o,expected,payouts:final.payouts});
 });
 it('honors half-even rounding at the declared unit in a supported custom rule profile',()=>{
  const profile:RuleProfile={...practiceProfile(),chipUnit:5,smallBlind:5,bigBlind:10,rake:{basisPoints:500,cap:100,noFlopNoDrop:true,rounding:'half-even'}};
  let state=boardHand([75,75],profile);state=act(state,{type:'raise',to:75});
  const {expected}=compare(state);expect(expected.rake).toBe(10);
  const final=act(state,{type:'call'});expect(final.rake).toBe(10);assertAccounting(final);
 });
 it.each([1,5,25,100])('guaranteed river chop EV uses odd %i-cent chips, for both positions',unit=>{
  for(const callerIsButton of [true,false])for(const capUnits of [3,5]){
   const button=0,profile={...practiceProfile(),chipUnit:unit,smallBlind:unit,bigBlind:unit*2,rake:{basisPoints:2000,cap:capUnits*unit,noFlopNoDrop:true}};
   let state=toStreet(boardHand([17,17].map(n=>n*unit),profile,button),'river');if(!callerIsButton)state=act(state,{type:'check'});state=act(state,{type:'raise',to:legalActions(state).maxRaiseTo!});
   const {o,expected}=compare(state),analysis=analyzeDecision(o,defaultProfile('stronger-reg'));
   const exactEV=expected.payouts[o.actingSeat]-expected.cost;expect(analysis.postflop?.guaranteedChopCallEV).toBe(exactEV);expect(analysis.distribution.fold).toBe(exactEV<0?1:0);
   const final=act(state,{type:'call'});expect(final.payouts).toEqual(expected.payouts);assertAccounting(final);
   evidence.cases.push({kind:'guaranteed-chop',unit,button,callerIsButton,capUnits,observation:o,exactEV,payouts:final.payouts});
  }
 });
 it('does not read hidden data when source or denomination information is present',()=>{
  let state=toStreet(boardHand([3000,10000,7000],pokerStarsProfile(100,200)),'flop');state=act(state,{type:'raise',to:legalActions(state).maxRaiseTo!});state=act(state,{type:'call'});
  const o=observation(state),expected=contestablePricing(o);
  for(const key of ['deck','futureBoard','otherHoleCards','privateProfiles'])Object.defineProperty(o,key,{get(){throw new Error(`Forbidden ${key}`);}});
  for(const seat of o.seats)Object.defineProperty(seat,'hole',{get(){throw new Error('Forbidden hole');}});
  expect(contestablePricing(o)).toEqual(expected);
 });
 it.each([1,5,25,100].flatMap(unit=>[2,6,10].map(count=>({unit,count}))))('current bots submit legal actions: $unit-cent units, $count players',({unit,count})=>{
  const profile:RuleProfile={...practiceProfile(),chipUnit:unit,smallBlind:unit,bigBlind:unit*2,rake:{basisPoints:500,cap:7*unit,noFlopNoDrop:true}};
  for(let trial=0;trial<3;trial++){
   const seed=0x5b1400+unit*100+count*10+trial,random=rng(seed),stacks=Array.from({length:count},(_,i)=>(20+(i*29+trial*17)%181)*unit);
   let state=seededHand(stacks,seed,profile),steps=0;
   while(state.street!=='complete'&&steps++<300){
    const {o,expected}=compare(state),personality=defaultProfile(ARCHETYPES[(state.actor!+trial)%ARCHETYPES.length]),decision=chooseDecision(o,personality,random);
    if(decision.action.type==='raise'){expect(decision.action.to%unit).toBe(0);evidence.simulation.raises++;}
    if(decision.action.type==='call'){evidence.simulation.calls++;if(expected.excluded>0)evidence.simulation.excludedCalls++;}
    const before=state;state=applyCommand(state,decision);assertAccounting(state);expect(applyCommand(state,decision)).toBe(state);
    expect(before.revision+1).toBe(state.revision);expect(state.seats.every(s=>s.stack%unit===0)).toBe(true);evidence.simulation.decisions++;
   }
   expect(state.street).toBe('complete');assertAccounting(state);evidence.simulation.hands++;
  }
 },60000);
 it('completed the predeclared seeded matrix with actual raises and calls',()=>{
  expect(evidence.simulation.hands).toBe(36);expect(evidence.simulation.raises).toBeGreaterThan(0);expect(evidence.simulation.calls).toBeGreaterThan(0);
 });
});
