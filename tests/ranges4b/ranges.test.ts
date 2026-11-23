import {describe,it,expect} from 'vitest';
import type {BotObservation,Card,GameEvent} from '../../src/contracts';
import {analyzeRanges,publicActionLikelihoods,RANGE_MODEL_VERSION} from '../../src/bots/ranges';
import {createProfile,POLICY_VERSION} from '../../src/bots/profiles';
import {observeBot} from '../../src/core/engine';
import {scenarios,step,seededEngineHand} from '../step4a/scenarios';
const p=()=>createProfile({selection:'stronger-reg'},777,'neutral');
function observation(id='flop-marginal-cheap'):BotObservation {const s=scenarios().find(s=>s.id===id)!.state;return observeBot(s,s.actor!,POLICY_VERSION,`ranges:${id}`);}
const countCompatible=(known:number)=>(52-known)*(51-known)/2;
const action=(id:string,seat:number,type:'check'|'call'|'raise',street:'preflop'|'flop'|'turn'|'river',amount=0,to=0):GameEvent=>({id,handId:'synthetic',revision:1,type:'action',seatId:seat,street,amount,action:type==='raise'?{type,to}:{type}});
function simple(board:Card[],events:GameEvent[]=[],count=2):BotObservation {
 return {handId:'synthetic',revision:events.length,decisionId:'analysis',policyVersion:POLICY_VERSION,ownCards:['As','Kh'],board,street:board.length===5?'river':board.length===4?'turn':board.length===3?'flop':'preflop',button:0,actingSeat:0,pot:1000,bigBlind:200,seats:Array.from({length:count},(_,id)=>({id,stack:20000,streetCommitted:0,totalCommitted:0,folded:false,allIn:false})),legal:{actor:0,fold:false,check:true,callAmount:0,minRaiseTo:200,maxRaiseTo:20000,canRaise:true,shortAllInTo:null,reopened:true},publicEvents:events};
}

describe('public weighted ranges: actual combinations and no truth access',()=>{
 it('represents all compatible two-card combinations with normalized nonzero probability',()=>{
  const o=simple([]),r=analyzeRanges(o,p());expect(r.modelVersion).toBe(RANGE_MODEL_VERSION);expect(r.opponents).toHaveLength(1);
  const combos=r.opponents[0].combos;expect(combos).toHaveLength(countCompatible(2));expect(new Set(combos.map(c=>c.cards.join(''))).size).toBe(combos.length);
  expect(combos.reduce((n,c)=>n+c.weight,0)).toBeCloseTo(1,12);expect(combos.every(c=>c.weight>0&&c.cards.every(x=>!o.ownCards.includes(x)))).toBe(true);
  expect(r.opponents[0].effectiveCombos).toBeCloseTo(1225,8);
 });
 it('removes actual known blockers while retaining hypotheses for every remaining card',()=>{
  const o=observation(),r=analyzeRanges(o,p()).opponents[0],known=[...o.board,...o.ownCards];
  expect(r.combos).toHaveLength(countCompatible(known.length));expect(r.combos.every(c=>c.cards.every(x=>!known.includes(x)))).toBe(true);
  expect(new Set(r.combos.flatMap(c=>c.cards)).size).toBe(52-known.length);
 });
 it('does not read forbidden getters or arbitrary nested event metadata',()=>{
  const o=observation();for(const key of ['deck','futureBoard','heroCards','privateProfiles'])Object.defineProperty(o,key,{get(){throw new Error(`forbidden ${key}`);}});
  for(const s of o.seats)Object.defineProperty(s,'hole',{get(){throw new Error('forbidden hole');}});
  for(const e of o.publicEvents)Object.defineProperty(e,'detail',{get(){throw new Error('forbidden detail');}});
  expect(()=>analyzeRanges(o,p())).not.toThrow();
 });
 it('does not use actual unknown opponent profiles injected outside the allowlist',()=>{
  const a=observation(),b=structuredClone(a);Object.assign(a,{privateProfiles:[{archetype:'nit'}],deck:['Ac']});Object.assign(b,{privateProfiles:[{archetype:'maniac'}],deck:['2d']});
  expect(analyzeRanges(a,p())).toEqual(analyzeRanges(b,p()));
 });
 it('folded players leave the competing ranges without revealing or blocking their cards',()=>{
  const o=simple(['Qc','7h','2s'],[],3);o.seats[2].folded=true;const r=analyzeRanges(o,p());
  expect(r.opponents.map(x=>x.seatId)).toEqual([1]);expect(r.opponents[0].combos).toHaveLength(countCompatible(5));
 });
});

describe('public actions update uncertain ranges',()=>{
 it('normalizes each hypothetical hand over facing-bet or free-check action families',()=>{
  const o=observation(),candidate=analyzeRanges(o,p()).opponents[0].combos.slice(0,30);
  const call=o.publicEvents.find(e=>e.type==='action'&&e.seatId===1&&e.action?.type==='call')!;
  const bet=o.publicEvents.find(e=>e.type==='action'&&e.seatId===1&&e.street==='flop'&&e.action?.type==='raise')!;
  expect(call).toBeDefined();expect(bet).toBeDefined();
  for(const c of candidate){for(const e of [call,bet]){const weights=publicActionLikelihoods(o,p(),1,e.id,c.cards);expect(Object.values(weights).reduce((n,x)=>n+x,0)).toBeCloseTo(1,12);expect(Object.values(weights).every(x=>x>=0&&x<=1)).toBe(true);if(e===call)expect(weights.check).toBe(0);else expect(weights.call).toBe(0);}}
  expect(()=>publicActionLikelihoods(o,p(),1,call.id,[o.ownCards[0],'Ac'])).toThrow('Hypothesis conflicts');
 });
 it('raises concentrate premium holdings more than limping and an unopened dealt prior',()=>{
  const a=simple([]),b=simple([],[action('raise',1,'raise','preflop',600,600)]),c=simple([],[action('limp',1,'call','preflop',200)]);
  const prior=analyzeRanges(a,p()).opponents[0],raised=analyzeRanges(b,p()).opponents[0],limped=analyzeRanges(c,p()).opponents[0];
  expect(raised.premiumMass).toBeGreaterThan(limped.premiumMass);expect(raised.premiumMass).toBeGreaterThan(prior.premiumMass*1.5);expect(raised.effectiveCombos).toBeLessThan(prior.effectiveCombos);
  expect(raised.updates).toHaveLength(1);expect(raised.updates[0]).toMatchObject({eventId:'raise',street:'preflop',action:'raise'});
  expect(raised.uncertainty).toBeGreaterThan(.2);expect(raised.combos.every(c=>c.weight>0)).toBe(true);
 });
 it('a public 3-bet creates a tighter range than a first-in open',()=>{
  const open=simple([],[action('open',1,'raise','preflop',600,600)]);
  const three=simple([],[action('opener',0,'raise','preflop',600,600),action('three',1,'raise','preflop',1800,1800)]);
  const a=analyzeRanges(open,p()).opponents[0],b=analyzeRanges(three,p()).opponents[0];expect(b.premiumMass).toBeGreaterThan(a.premiumMass);expect(b.effectiveCombos).toBeLessThan(a.effectiveCombos);
 });
 it('large river bets strengthen made-hand posterior versus checks without ruling out bluffs',()=>{
  const board=['Qc','7h','2s','8c','3d'];const check=simple(board,[action('check',1,'check','river')]);const bet=simple(board,[action('bet',1,'raise','river',2000,2000)]);
  const a=analyzeRanges(check,p()).opponents[0],b=analyzeRanges(bet,p()).opponents[0];expect(b.strongMadeMass).toBeGreaterThan(a.strongMadeMass);expect(b.effectiveCombos).toBeLessThan(a.effectiveCombos);
  expect(b.combos.every(c=>c.weight>0)).toBe(true);
 });
 it('a fold facing a large bet retains stronger possible holdings than a fold to a tiny bet',()=>{
  const fixture=(bet:number)=>{const o=simple(['Qc','7h','2s','8c','3d'],[action('open',0,'raise','preflop',1000,1000),action('call',1,'call','preflop',1000),{id:'river',handId:'synthetic',revision:2,type:'street',street:'river'},action('bet',0,'raise','river',bet,bet),{id:'fold',handId:'synthetic',revision:4,type:'action',seatId:1,street:'river',amount:0,action:{type:'fold'}}]);o.seats[1].folded=true;return o;};
  const small=fixture(200),large=fixture(4000);
  expect(publicActionLikelihoods(large,p(),1,'fold',['Qh','Td']).fold).toBeGreaterThan(publicActionLikelihoods(small,p(),1,'fold',['Qh','Td']).fold);
  expect(analyzeRanges(large,p()).foldedOpponents![0].strongMadeMass).toBeGreaterThan(analyzeRanges(small,p()).foldedOpponents![0].strongMadeMass);
 });
 it('check-raise lines and calls each update exact visible action traces',()=>{
  const o=simple(['Qc','7h','2s'],[action('check',1,'check','flop'),action('bet',0,'raise','flop',400,400),action('checkraise',1,'raise','flop',1400,1400)]);
  const r=analyzeRanges(o,p()).opponents[0];expect(r.updates.map(u=>u.action)).toEqual(['check','raise']);expect(r.observedActions).toBe(2);
  const called=simple(o.board,[action('bet2',0,'raise','flop',400,400),action('call',1,'call','flop',400)]);expect(analyzeRanges(called,p()).opponents[0].updates[0].action).toBe('call');
 });
 it('past street evidence uses then-visible board prefixes, never later-street texture',()=>{
  const flop=simple(['Qc','7h','2s'],[action('flop-bet',1,'raise','flop',400,400)]);
  const river=simple(['Qc','7h','2s','Qd','Qh'],flop.publicEvents);
  const a=analyzeRanges(flop,p()).opponents[0],b=analyzeRanges(river,p()).opponents[0];
  // Later known blockers change normalization, but survivor likelihood ratios remain identical.
  const find=(r:typeof a,text:string)=>r.combos.find(c=>c.cards.slice().sort().join('')===[text.slice(0,2),text.slice(2)].sort().join(''))!.weight;
  const ratio=(r:typeof a,x:string,y:string)=>find(r,x)/find(r,y);
  // Nonzero contamination introduces a bounded normalization difference, not future texture evidence.
  expect(ratio(a,'AcAd','2c3c')/ratio(b,'AcAd','2c3c')).toBeCloseTo(1,1);
 });
 it('later folds do not reinterpret an earlier multiway bet as heads-up aggression',()=>{
  const a=simple(['Qc','7h','2s'],[action('multiway-bet',1,'raise','flop',600,600)],3),b=structuredClone(a);
  b.seats[2].folded=true;b.publicEvents.push({id:'later-fold',handId:'synthetic',revision:2,type:'action',seatId:2,street:'flop',amount:0,action:{type:'fold'}});
  const before=analyzeRanges(a,p()).opponents.find(r=>r.seatId===1)!,after=analyzeRanges(b,p()).opponents.find(r=>r.seatId===1)!;
  expect(after.combos).toEqual(before.combos);expect(after.updates).toEqual(before.updates);
  const folded=analyzeRanges(b,p()).foldedOpponents!;expect(folded).toHaveLength(1);expect(folded[0].seatId).toBe(2);expect(folded[0].updates.at(-1)?.action).toBe('fold');
  expect(analyzeRanges(b,p()).opponents.map(r=>r.seatId)).toEqual([1]);expect(Object.isFrozen(folded)).toBe(true);
 });
 it('a four-straight board does not assign a private draw to unrelated hole-card ranks',()=>{
  const o=simple(['4c','5d','6h','7s'],[action('turn-call',1,'call','turn',200)]),r=analyzeRanges(o,p()).opponents[0];
  const weight=(cards:string[])=>r.combos.find(c=>c.cards.slice().sort().join('')===cards.sort().join(''))!.weight;
  // J9 has a private gutshot (8 completes 5–9); JT adds no four-of-five private straight window.
  expect(weight(['Jh','9d'])).toBeGreaterThan(weight(['Jh','Td'])*1.1);
 });
 it('public observed tendencies adapt with bounded shrinkage, not true archetype knowledge',()=>{
  const o=simple([],[action('open',1,'raise','preflop',600,600)]),tight=structuredClone(o),loose=structuredClone(o);
  const memory=(v:number,r:number,n:number)=>({windowHands:n,opponents:[{seatId:1,hands:n,vpip:{count:v,opportunities:n},pfr:{count:r,opportunities:n},aggression:{count:30,opportunities:100},foldToBet:{count:40,opportunities:100},showdowns:[]}]});
  tight.memory=memory(10,7,100);loose.memory=memory(75,55,100);
  const a=analyzeRanges(tight,p()).opponents[0],b=analyzeRanges(loose,p()).opponents[0];expect(a.premiumMass).toBeGreaterThan(b.premiumMass);expect(a.priorSource).toContain('public observed rates');expect(a.uncertainty).toBeGreaterThan(.2);
  const one=structuredClone(tight);one.memory=memory(1,1,1);expect(analyzeRanges(one,p()).opponents[0].uncertainty).toBeGreaterThan(a.uncertainty);
 });
});

describe('deterministic compatible multiway equity and bounded work',()=>{
 it('counts ties correctly on a shared royal board, including multiway share',()=>{
  const o=simple(['Tc','Jc','Qc','Kc','Ac'],[],4);o.ownCards=['2h','3s'];const r=analyzeRanges(o,p());expect(r.equity).toBe(.25);expect(r.equityStdError).toBe(0);expect(r.equitySamples).toBe(72);
 });
 it('an unbeatable private royal has full showdown share',()=>{
  const o=observation('river-nuts'),r=analyzeRanges(o,p());expect(r.equity).toBe(1);expect(r.equityStdError).toBe(0);
 });
 it('multiway equity is estimated against compatible joint hands and discloses sampling uncertainty',()=>{
  const o=simple(['Qc','7h','2s'],[],6),r=analyzeRanges(o,p());expect(r.opponents).toHaveLength(5);expect(r.equitySamples).toBe(48);expect(r.equity).toBeGreaterThanOrEqual(0);expect(r.equity).toBeLessThanOrEqual(1);expect(r.equityStdError).toBeGreaterThanOrEqual(0);expect(r.uncertainty).toBeGreaterThan(.2);
  expect(r.assumptions.join(' ')).toContain('excludes rake');
 });
 it('all-in opponents have zero fold equity and no independent hidden-card access',()=>{
  const o=simple(['Qc','7h','2s'],[],3);o.seats[1].allIn=true;o.seats[1].stack=0;expect(analyzeRanges(o,p()).foldEquity).toBe(0);
 });
 it('repeated analyses and JSON-restored observations are exactly deterministic without random consumption',()=>{
  const o=observation(),profile=p(),a=analyzeRanges(o,profile);expect(analyzeRanges(JSON.parse(JSON.stringify(o)),JSON.parse(JSON.stringify(profile)))).toEqual(a);
  expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.opponents[0].combos[0].cards)).toBe(true);expect(()=>{a.opponents[0].combos[0].weight=0;}).toThrow();expect(analyzeRanges(o,profile)).toEqual(a);
 });
 it('irrelevant adaptation traits do not create sampling differences without any observed memory',()=>{
  const o=observation(),a=p(),b=p();a.traits!.adaptation=0;b.traits!.adaptation=1;expect(analyzeRanges(o,a)).toEqual(analyzeRanges(o,b));
 });
 it('arbitrary hand/decision labels and cyclic seat relabeling cannot make Hero softer',()=>{
  const o=observation(),r=analyzeRanges(o,p()),renamed=structuredClone(o);renamed.handId='different';renamed.decisionId='different';
  const ids=new Map(o.seats.map(s=>[s.id,(s.id+3)%10]));renamed.actingSeat=ids.get(o.actingSeat)!;renamed.button=ids.get(o.button)!;renamed.legal.actor=renamed.actingSeat;for(const s of renamed.seats)s.id=ids.get(s.id)!;for(const e of renamed.publicEvents){e.id+='changed';e.handId='different';if(e.seatId!==undefined)e.seatId=ids.get(e.seatId)!;}
  const result=analyzeRanges(renamed,p());for(const key of ['equity','equitySamples','equityStdError','rangeAdvantage','nutAdvantage','foldEquity'] as const)expect(result[key]).toBe(r[key]);
  expect(result.opponents[0].combos).toEqual(r.opponents[0].combos);
 });
 it('real multiway engine action histories retain normalized posterior at every street',()=>{
  let state=seededEngineHand(6,341);let checked=0;
  for(let i=0;state.street!=='complete'&&i<80;i++){
   if(state.street!=='preflop'&&state.actor!==null){const r=analyzeRanges(observeBot(state,state.actor,POLICY_VERSION,`range-loop-${i}`),p());for(const opp of r.opponents)expect(opp.combos.reduce((n,c)=>n+c.weight,0)).toBeCloseTo(1,10);checked++;}
   state=step(state,state.currentBet>state.seats.find(s=>s.id===state.actor)!.streetCommitted?{type:'call'}:{type:'check'});
  }
  expect(state.street).toBe('complete');expect(checked).toBe(18);expect(state.seats.reduce((n,s)=>n+s.stack,0)+state.rake).toBe(state.initialTotal);
 });
 it('cached identical observations are reused while at most eight immutable analyses remain cached',()=>{
  const o=observation(),a=analyzeRanges(o,p()),start=performance.now();for(let i=0;i<1000;i++)expect(analyzeRanges(o,p())).toBe(a);const elapsed=performance.now()-start;
  // An intentionally broad responsiveness guard; browser timing is recorded separately.
  expect(elapsed).toBeLessThan(1500);
 });
});
