import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import type {Action,GameState} from '../../src/contracts';
import {contestablePricing} from '../../src/bots/pricing';
import {contestablePricing as legacyPricing} from '../../src/bots/v3/pricing';
import {assertAccounting,legalActions} from '../../src/core/engine';
import {independentCall,independentBoardTie} from './reference';
import {act,checkDown,flop,observation,profile,rng,start} from './fixtures';
const evidence:unknown[]=[];
function compare(g:GameState){
 const o=observation(g),copy=structuredClone(o),actual=contestablePricing(o),expected=independentCall(o);
 expect(actual.callAmount).toBe(expected.callAmount);
 for(const field of ['contestableAfterCall','excludedChips','estimatedRake'] as const)expect(actual[field]).toBe(expected[field]);
 expect(actual.price).toBeCloseTo(expected.price,13);expect(actual.rakeAdjustedPrice).toBeCloseTo(expected.rakeAdjustedPrice,13);
 expect(o).toEqual(copy);expect(actual.contestableAfterCall+actual.excludedChips).toBe(o.pot+o.legal.callAmount);
 return{o,actual,expected};
}
function moneyAudit(g:GameState){
 const balances=new Map(g.seats.map(s=>[s.id,s.startingStack]));let paid=0,refund=0,rake=0,awards=0;
 const eventIds=new Set<string>(),decisionIds=new Set<string>();
 for(const e of g.events){expect(eventIds.has(e.id)).toBe(false);eventIds.add(e.id);if(e.type==='action'){expect(decisionIds.has(e.decisionId!)).toBe(false);decisionIds.add(e.decisionId!);}
  if(e.type==='blind'||e.type==='action'){balances.set(e.seatId!,balances.get(e.seatId!)!-(e.amount??0));paid+=e.amount??0;}
  if(e.type==='refund'||e.type==='award'){balances.set(e.seatId!,balances.get(e.seatId!)!+(e.amount??0));if(e.type==='refund')refund+=e.amount??0;else awards+=e.amount??0;}
  if(e.type==='rake')rake+=e.amount??0;
 }
 expect(paid-refund).toBe(awards+rake);for(const s of g.seats)expect(balances.get(s.id)).toBe(s.stack);
 expect(g.seats.reduce((n,s)=>n+s.stack,0)+rake).toBe(g.initialTotal);expect(g.pot).toBe(0);expect(g.street).toBe('complete');
 return{paid,refund,rake,awards,decisions:decisionIds.size};
}
describe('Step5A independent contribution-layer call pricing',()=>{
 it.each(['preflop','flop','turn','river'] as const)('matches legal heads-up min/pot/3pot/shove decisions on %s, rake off/on',street=>{
  for(const raked of [false,true])for(const size of ['min','pot','3pot','shove']){
   let g=street==='preflop'?start([4000,20000],550001,raked):flop([4000,20000],550001,raked);
   if(street==='preflop')g=act(g,{type:'call'});
   while(g.street!==street)g=act(g,{type:'check'});
   const l=legalActions(g),own=g.seats.find(s=>s.id===g.actor)!,base=own.streetCommitted+l.callAmount;
   const target=size==='shove'?l.maxRaiseTo!:size==='min'?l.minRaiseTo!:base+(g.pot+l.callAmount)*(size==='pot'?1:3);
   g=act(g,{type:'raise',to:Math.min(l.maxRaiseTo!,Math.max(l.minRaiseTo!,target))});
   const result=compare(g);expect(result.o.actingSeat).toBe(0);
   if(size==='shove'){expect(result.actual.contestableAfterCall).toBe(8000);expect(result.actual.excludedChips).toBe(16000);expect(result.actual.price).toBe(.475);}
   const settled=checkDown(g);assertAccounting(settled);const accounting=moneyAudit(settled);evidence.push({case:`hu:${street}:${size}:rake-${raked}`,observation:result.o,pricing:result.actual,reference:result.expected,accounting,events:settled.events});
  }
 });
 it.each([2,3,6,9,10])('%i seats: short calls exclude higher layers; royal-board split, dead money, cents and rake independently reconcile',seats=>{
  for(const raked of [false,true]){
   const stacks=Array.from({length:seats},(_,i)=>i===0?3001:i===1?13007:i===2?7003:1001+i*401);let g=flop(stacks,550100+seats,raked,true);
   g=act(g,{type:'raise',to:legalActions(g).maxRaiseTo!});
   while(g.actor!==0){g=act(g,seats>=6&&g.actor===seats-1?{type:'fold'}:{type:'call'});}
   const result=compare(g);expect(result.o.actingSeat).toBe(0);expect(result.actual.callAmount).toBe(2801);
   // Hand-calculated, predeclared totals, independent of either implementation:
   // seat 0 caps its claim at 3001; the last seat contributes only a folded 200 at 6+ seats.
   const exactTotals:Record<number,{gross:number;excluded:number;matched:number;rake:number}>={
    2:{gross:6002,excluded:10006,matched:6002,rake:300},
    3:{gross:9003,excluded:14008,matched:17007,rake:501},
    6:{gross:14012,excluded:14008,matched:22016,rake:501},
    9:{gross:23015,excluded:15226,matched:32237,rake:501},
    10:{gross:26016,excluded:16434,matched:36446,rake:501},
   };
   const numbers=exactTotals[seats];
   expect(result.actual.contestableAfterCall).toBe(numbers.gross);expect(result.actual.excludedChips).toBe(numbers.excluded);
   expect(result.expected.matched).toBe(numbers.matched);expect(result.actual.estimatedRake).toBe(raked?numbers.rake:0);
   const contributions=g.seats.map(s=>({id:s.id,amount:s.totalCommitted+(s.id===0?result.expected.callAmount:0),folded:s.folded}));
   const exact=independentBoardTie(contributions,g.button,result.expected.estimatedRake),settled=act(g,{type:'call'});
   expect(settled.street).toBe('complete');expect(settled.board).toEqual(['Tc','Jc','Qc','Kc','Ac']);
   expect(settled.payouts).toEqual(exact.payouts);expect(settled.rake).toBe(result.actual.estimatedRake);
   expect(settled.pots.map(p=>({amount:p.amount,eligible:p.eligible}))).toEqual(exact.pools);
   const actualRefunds=Object.fromEntries(settled.events.filter(e=>e.type==='refund').map(e=>[e.seatId!,e.amount]));expect(actualRefunds).toEqual(exact.refunds);
   const heroEligible=settled.pots.filter(p=>p.eligible.includes(0)).reduce((n,p)=>n+p.amount,0);expect(heroEligible).toBe(result.expected.eligibleNet);
   evidence.push({case:`${seats}-seat-multi-allin-tie-rake-${raked}`,observation:result.o,pricing:result.actual,reference:result.expected,expectedSettlement:exact,actualSettlement:{payouts:settled.payouts,pots:settled.pots},accounting:moneyAudit(settled),events:settled.events});
  }
 });
 it('never changes the priced call when only excluded higher side-pot money increases below a fixed rake cap',()=>{
  const make=(deep:number)=>{let g=flop([2000,deep,deep],550204,true);g=act(g,{type:'raise',to:deep-200});g=act(g,{type:'call'});return compare(g);};
  const small=make(10000),large=make(50000);expect(small.actual.contestableAfterCall).toBe(6000);expect(large.actual.contestableAfterCall).toBe(6000);
  expect(large.actual.excludedChips).toBeGreaterThan(small.actual.excludedChips);expect(large.actual.price).toBe(small.actual.price);expect(large.actual.rakeAdjustedPrice).toBe(small.actual.rakeAdjustedPrice);
 });
 it('subtracts uncapped rake on matched chips once; higher pots can increase rake expense, never eligible winnings',()=>{
  const rules=profile(true);rules.rake.cap=100000;
  let g=flop([2000,5000,5000],550205,true,false,rules);g=act(g,{type:'raise',to:4800});g=act(g,{type:'call'});const result=compare(g);
  expect(result.actual.contestableAfterCall).toBe(6000);expect(result.actual.estimatedRake).toBe(600);expect(result.expected.eligibleNet).toBe(5400);
  const settled=act(g,{type:'call'});expect(settled.rake).toBe(600);moneyAudit(settled);
 });
 it('charges known rake when a preflop hypothetical call necessarily runs out the board',()=>{
  for(const noFlopNoDrop of [true,false]){
   const rules=profile(true);rules.rake.noFlopNoDrop=noFlopNoDrop;
   let g=start([4000,20000],550206,true,false,rules);g=act(g,{type:'call'});g=act(g,{type:'raise',to:20000});const result=compare(g);
   expect(result.actual.estimatedRake).toBe(400);expect(result.actual.rakeAdjustedPrice).toBe(.5);
   const final=act(g,{type:'call'});expect(final.rake).toBe(400);
   evidence.push({case:`forced-hu-runout-noFlopNoDrop-${noFlopNoDrop}`,observation:result.o,pricing:result.actual,reference:result.expected,accounting:moneyAudit(final),events:final.events});
  }
 });
 it('recognizes a forced runout even if the deeper bettor retains chips after the short call',()=>{
  let g=start([4000,20000],550208,true);g=act(g,{type:'call'});g=act(g,{type:'raise',to:10000});const result=compare(g);
  expect(result.o.seats.find(s=>s.id===1)!.allIn).toBe(false);expect(result.expected.runout).toBe(true);
  expect(result.actual.estimatedRake).toBe(400);expect(result.actual.rakeAdjustedPrice).toBe(.5);
  const final=act(g,{type:'call'});expect(final.rake).toBe(400);
  evidence.push({case:'forced-runout-funded-bettor',observation:result.o,pricing:result.actual,reference:result.expected,accounting:moneyAudit(final),events:final.events});
 });
 it('charges known rake when a third player is already all in and the last call closes betting',()=>{
  let g=start([4000,20000,12000],550209,true);g=act(g,{type:'call'});g=act(g,{type:'raise',to:20000});g=act(g,{type:'call'});const result=compare(g);
  expect(result.expected.runout).toBe(true);expect(result.actual.contestableAfterCall).toBe(12000);expect(result.actual.excludedChips).toBe(24000);
  expect(result.actual.estimatedRake).toBe(501);expect(result.actual.rakeAdjustedPrice).toBeCloseTo(3800/11499,13);
  const final=act(g,{type:'call'});expect(final.rake).toBe(501);
  evidence.push({case:'forced-three-way-runout',observation:result.o,pricing:result.actual,reference:result.expected,accounting:moneyAudit(final),events:final.events});
 });
 it('does not forecast an optional call by a lone remaining chip holder who still owes chips',()=>{
  let g=start([4000,20000,12000],550210,true);g=act(g,{type:'call'});g=act(g,{type:'raise',to:6000});g=act(g,{type:'raise',to:12000});const result=compare(g);
  expect(result.expected.runout).toBe(false);expect(result.actual.estimatedRake).toBe(0);
  g=act(g,{type:'call'});expect(g.street).toBe('preflop');expect(g.actor).toBe(1);expect(legalActions(g).callAmount).toBe(6000);
  const next=compare(g);expect(next.expected.runout).toBe(true);expect(next.actual.estimatedRake).toBe(501);
  const final=act(g,{type:'call'});expect(final.rake).toBe(501);
  evidence.push({case:'unresolved-opponent-call-before-forced-runout',before:result,after:next,accounting:moneyAudit(final),events:final.events});
 });
 it('preserves frozen 1.2 pricing for existing sessions while current pricing charges certain runout rake',()=>{
  let g=start([4000,20000],550206,true);g=act(g,{type:'call'});g=act(g,{type:'raise',to:20000});const o=observation(g);
  expect(legacyPricing(o).estimatedRake).toBe(0);expect(legacyPricing(o).rakeAdjustedPrice).toBe(.475);
  expect(contestablePricing(o).estimatedRake).toBe(400);expect(contestablePricing(o).rakeAdjustedPrice).toBe(.5);
 });
 it('refuses to derive prices from secrets and is invariant to irrelevant hidden getter fields',()=>{
  let g=flop([4000,20000],550207);g=act(g,{type:'raise',to:19800});const o=observation(g),expected=contestablePricing(o);
  for(const key of ['deck','futureBoard','heroCards','privateProfiles','payouts'])Object.defineProperty(o,key,{get(){throw Error('Forbidden '+key);}});
  for(const s of o.seats)Object.defineProperty(s,'hole',{get(){throw Error('Forbidden hole');}});
  expect(contestablePricing(o)).toEqual(expected);expect(independentCall(o).contestableAfterCall).toBe(8000);
 });
 it('differentially checks every reachable decision in 300 seeded complete hands with mixed all-in depths',()=>{
  const counts={hands:0,decisions:0,pricedCalls:0,shortCalls:0,excluded:0,sidePotCalls:0,foldedDeadMoney:0,sidePotSettlements:0,refundSettlements:0,rakedSettlements:0},trials:unknown[]=[];
  const seatCounts=[2,3,6,9,10],depths=[1,7,19,37,75,100,175,300];
  for(const seats of seatCounts)for(const raked of [false,true])for(let trial=0;trial<30;trial++){
   const seed=0x5a110000+seats*10000+Number(raked)*1000+trial,random=rng(seed),stacks=Array.from({length:seats},(_,i)=>Math.round(depths[(trial+i*3)%depths.length]*200)+(i%3));
   let g=start(stacks,seed,raked);const actions:Action[]=[];
   while(g.street!=='complete'&&actions.length<250){
    const {o,expected}=compare(g);counts.decisions++;if(expected.callAmount>0)counts.pricedCalls++;
    const own=o.seats.find(s=>s.id===o.actingSeat)!;
    if(expected.callAmount===own.stack&&own.stack>0)counts.shortCalls++;
    if(expected.excludedChips>0)counts.excluded++;
    if(expected.slices.some(s=>!s.eligible.includes(own.id)))counts.sidePotCalls++;
    if(o.seats.some(s=>s.folded&&s.totalCommitted>0))counts.foldedDeadMoney++;
    const l=legalActions(g),n=random();let a:Action;
    if(n<.12&&l.callAmount>0)a={type:'fold'};
    else if(n<.48&&l.canRaise){const base=own.streetCommitted+l.callAmount,desired=n<.22?l.maxRaiseTo!:base+Math.round((g.pot+l.callAmount)*[.25,1,3][trial%3]);a={type:'raise',to:l.shortAllInTo??Math.min(l.maxRaiseTo!,Math.max(l.minRaiseTo!,desired))};}
    else a=l.check?{type:'check'}:{type:'call'};
    actions.push(a);g=act(g,a);assertAccounting(g);
   }
   const accounting=moneyAudit(g);counts.hands++;if(g.pots.length>1)counts.sidePotSettlements++;if(accounting.refund>0)counts.refundSettlements++;if(accounting.rake>0)counts.rakedSettlements++;
   trials.push({seed,seats,raked,stacks,actions,accounting,payouts:g.payouts,endingStacks:g.seats.map(s=>s.stack)});
  }
  expect(counts.hands).toBe(300);for(const key of ['pricedCalls','shortCalls','sidePotCalls','foldedDeadMoney','sidePotSettlements','refundSettlements','rakedSettlements'] as const)expect(counts[key]).toBeGreaterThan(0);
  evidence.push({generatedReachableStates:counts,trials});console.log(JSON.stringify(counts));
 });
 it('preserves reproducible exact fixtures, independent reference slices and batch seeds as evidence',()=>{
  expect(evidence.length).toBe(48);if(process.env.STEP5A_PRICING_REPORT!=='1')return;
  const raw=JSON.stringify({kind:'Step5A call-pricing and settlement audit',status:'PASS',policy:'synthetic-cash-1.3.0 candidate',note:'No human strategy or future-action EV claim; reference has no production imports.',evidence});
  mkdirSync('tests/step5a-pricing/evidence',{recursive:true});writeFileSync('tests/step5a-pricing/evidence/pricing-audit.json.gz',gzipSync(raw));writeFileSync('tests/step5a-pricing/evidence/manifest.json',JSON.stringify({rawSha256:createHash('sha256').update(raw).digest('hex'),rawBytes:raw.length,caseRecords:evidence.length},null,2)+'\n');
 });
});
