import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {BotObservation,GameEvent} from '../../src/contracts';
import type {RangeAnalysis} from '../../src/bots/range-contract';
const controlled=vi.hoisted(()=>({equity:.5,foldEquity:.5,rangeAdvantage:0,nutAdvantage:0,uncertainty:.4,equitySamples:1000,equityStdError:.01}));
vi.mock('../../src/bots/ranges',()=>({analyzeRanges:():RangeAnalysis=>({modelVersion:'independent-test-prior',opponents:[],assumptions:['Synthetic fixed prior for strategy-isolation tests'],...controlled})}));
import {analyzeDecision} from '../../src/bots/strategy';
import {defaultProfile,POLICY_VERSION,ARCHETYPES} from '../../src/bots/profiles';
import {runoutFeatures} from '../../src/bots/features';
function observation(street:'flop'|'turn'|'river'='flop',call=500):BotObservation {
 const board=['Qh','7c','2s','8d','3c'].slice(0,street==='flop'?3:street==='turn'?4:5);
 return {handId:'controlled-postflop',revision:8,actingSeat:4,decisionId:'decision-8',policyVersion:POLICY_VERSION,ownCards:['Qd','Jc'],board,street,button:4,pot:1000+call,bigBlind:100,
  seats:[{id:4,stack:10000,streetCommitted:0,totalCommitted:500,folded:false,allIn:false},{id:7,stack:10000-call,streetCommitted:call,totalCommitted:500+call,folded:false,allIn:false}],
  legal:{actor:4,fold:true,check:call===0,callAmount:call,minRaiseTo:Math.max(100,call*2),maxRaiseTo:10000,canRaise:true,reopened:true,shortAllInTo:null},publicEvents:[]};
}
function event(o:BotObservation,seatId:number,street:'preflop'|'flop'|'turn'|'river',type:'raise'|'call'|'check',revision:number):GameEvent{return {id:`e${revision}`,handId:o.handId,revision,type:'action',seatId,street,action:type==='raise'?{type,to:500}:{type},amount:type==='raise'||type==='call'?500:0};}
beforeEach(()=>Object.assign(controlled,{equity:.5,foldEquity:.5,rangeAdvantage:0,nutAdvantage:0,uncertainty:.4,equitySamples:1000,equityStdError:.01}));
describe('range-aware postflop response with an independent controlled advisory prior',()=>{
 it('changes calls and value raises when the public range estimate changes while cards and legal actions remain identical',()=>{
  const o=observation('river'),p=defaultProfile('stronger-reg');controlled.equity=.12;const weak=analyzeDecision(o,p);controlled.equity=.88;const strong=analyzeDecision(o,p);
  expect(strong.distribution.fold).toBeLessThan(weak.distribution.fold);expect(strong.distribution.raise).toBeGreaterThan(weak.distribution.raise);
  expect(weak.ranges?.modelVersion).toBe('independent-test-prior');expect(strong.postflop?.showdownEquity).toBe(.88);
 });
 it('does not treat a zero-sample equity fallback as evidence and discounts noisy estimates',()=>{
  const o=observation('river'),p=defaultProfile('stronger-reg');controlled.equitySamples=0;controlled.equity=.99;
  const noSamples=analyzeDecision(o,p);controlled.equity=.01;
  expect(noSamples.postflop!.rangeWeight).toBe(0);expect(analyzeDecision(o,p).distribution).toEqual(noSamples.distribution);
  controlled.equitySamples=96;controlled.equityStdError=.03;const supported=analyzeDecision(o,p);
  controlled.equityStdError=.4;expect(analyzeDecision(o,p).postflop!.rangeWeight).toBeLessThan(supported.postflop!.rangeWeight);
 });
 it('separates immediate pot odds from rake-adjusted price and future-street cost',()=>{
  const o=observation(),p=defaultProfile('tag'),base=analyzeDecision(o,p);o.rake={basisPoints:1000,cap:500,noFlopNoDrop:true};const raked=analyzeDecision(o,p);
  expect(base.postflop!.potOdds).toBe(.25);expect(raked.postflop!.rakeAdjustedPrice).toBeGreaterThan(base.postflop!.potOdds);
  expect(raked.distribution.fold).toBeGreaterThan(base.distribution.fold);expect(base.postflop!.futureCost).toBeGreaterThan(0);
  const closed=observation();closed.seats[1].stack=0;closed.seats[1].allIn=true;const allIn=analyzeDecision(closed,p);
  expect(allIn.postflop!.futureBettingClosed).toBe(true);expect(allIn.postflop!.futureCost).toBe(0);expect(allIn.postflop!.realization).toBe(1);
 });
 it('uses position and stack depth for realization instead of assigning the same plan to every stack',()=>{
  const o=observation(),p=defaultProfile('stronger-reg'),ip=analyzeDecision(o,p);o.button=7;const oop=analyzeDecision(o,p);
  expect(ip.postflop!.realization).toBeGreaterThan(oop.postflop!.realization);expect(ip.postflop!.futureCost).toBeLessThan(oop.postflop!.futureCost);
  const short=observation();short.seats[0].stack=600;short.seats[1].stack=100;short.legal.maxRaiseTo=600;short.legal.minRaiseTo=1000;short.legal.shortAllInTo=600;
  const shallow=analyzeDecision(short,p);expect(shallow.context.spr).toBeLessThan(ip.context.spr);expect(shallow.sizing).toEqual([{label:'Short all-in',raiseTo:600,weight:1}]);
 });
 it('suppresses weak bluffs in a multiway field even at a fixed advisory equity/fold estimate',()=>{
  controlled.equity=.15;const o=observation('flop',0);o.ownCards=['9d','8c'];const p=defaultProfile('lag'),headsUp=analyzeDecision(o,p);
  o.seats.push(...[1,2,3].map(id=>({id,stack:10000,streetCommitted:0,totalCommitted:500,folded:false,allIn:false})));
  const multi=analyzeDecision(o,p);expect(multi.families.bluff).toBeLessThan(headsUp.families.bluff);expect(multi.distribution.raise).toBeLessThan(headsUp.distribution.raise);
 });
 it('distinguishes public initiative, delayed c-bets, barrels and checked-then-raised opportunities',()=>{
  const p=defaultProfile('lag'),o=observation('flop',0);o.publicEvents=[event(o,4,'preflop','raise',1),event(o,7,'preflop','call',2),event(o,7,'flop','check',3)];
  const cbet=analyzeDecision(o,p);expect(cbet.postflop!.continuationBet).toBe(true);expect(cbet.families.cbet).toBeGreaterThan(0);
  const delayed=observation('turn',0);delayed.publicEvents=[...o.publicEvents,event(o,4,'flop','check',4),event(o,7,'turn','check',5)];
  expect(analyzeDecision(delayed,p).families.delayedCbet).toBeGreaterThan(0);
  const barrel=observation('turn',0);barrel.publicEvents=[event(o,4,'flop','raise',4),event(o,7,'flop','call',5),event(o,7,'turn','check',6)];
  expect(analyzeDecision(barrel,p).families.barrel).toBeGreaterThan(0);
  const xr=observation();xr.publicEvents=[event(xr,4,'flop','check',1),event(xr,7,'flop','raise',2)];
  expect(analyzeDecision(xr,p).families.checkRaise).toBeGreaterThan(0);
 });
 it('uses blockers and fold equity to select some missed-draw bluffs without automatically bluffing the river',()=>{
  controlled.equity=.1;const o=observation('river',0);o.ownCards=['Ah','Jh'];o.board=['Kh','8h','2s','7c','3d'];const p=defaultProfile('lag');
  const a=analyzeDecision(o,p);expect(a.postflop!.runout.missedDraw).toBe(true);expect(a.features.draw).toBe(0);expect(a.families.semiBluff).toBe(0);
  expect(a.distribution.raise).toBeGreaterThan(0);expect(a.distribution.raise).toBeLessThan(.5);
  controlled.foldEquity=.02;expect(analyzeDecision(o,p).families.bluff).toBeLessThan(a.families.bluff);
 });
 it('keeps archetype errors contextual: station overcalls marginal pairs, maniac pressures air, nit overfolds',()=>{
  const o=observation('river',1000);controlled.equity=.3;
  expect(analyzeDecision(o,defaultProfile('station')).distribution.fold).toBeLessThan(analyzeDecision(o,defaultProfile('nit')).distribution.fold);
  o.legal.callAmount=0;o.legal.check=true;o.ownCards=['9d','6c'];o.board=['Kh','8h','2s','7c','3d'];controlled.equity=.1;
  expect(analyzeDecision(o,defaultProfile('maniac')).families.bluff).toBeGreaterThan(analyzeDecision(o,defaultProfile('station')).families.bluff);
 });
 it('adjusts trap, thin-value and oversized sizing components without assigning one compulsory line',()=>{
  const o=observation('flop',0),p=defaultProfile('tag');o.ownCards=['Qd','Qc'];controlled.equity=.94;
  const patient={...p,traits:{...p.traits!,slowPlay:1}},direct={...p,traits:{...p.traits!,slowPlay:0}};
  expect(analyzeDecision(o,patient).families.trap).toBeGreaterThan(analyzeDecision(o,direct).families.trap);
  expect(analyzeDecision(o,patient).distribution.check).toBeGreaterThan(analyzeDecision(o,direct).distribution.check);
  controlled.equity=.68;expect(analyzeDecision(observation('river',0),p).families.thinValue).toBeGreaterThan(0);
  controlled.equity=.94;controlled.nutAdvantage=-.8;const ordinary=analyzeDecision(observation('river',0),p);
  controlled.nutAdvantage=.8;const advantage=analyzeDecision(observation('river',0),p);
  const oversized=(a:typeof ordinary)=>a.sizing.filter(size=>size.raiseTo>=1500).reduce((sum,size)=>sum+size.weight,0);
  expect(oversized(advantage)).toBeGreaterThan(oversized(ordinary));
 });
 it('reduces marginal-pair continuation smoothly across small bets, pot bets and extreme overbets',()=>{
  controlled.equity=.48;const p=defaultProfile('tag');
  const folds=[100,250,500,1000,2000,3000].map(call=>analyzeDecision(observation('river',call),p).distribution.fold);
  // Explicit bounded probability floors permit equal endpoint probabilities.
  for(let i=1;i<folds.length;i++)expect(folds[i]).toBeGreaterThanOrEqual(folds[i-1]);
  expect(folds.at(-1)).toBeGreaterThan(folds[0]);
 });
 it('all eight styles preserve legal normalized distributions and cannot consume external action entropy',()=>{
  const rng=vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('External action RNG forbidden');});
  try{for(const type of ARCHETYPES){const a=analyzeDecision(observation(),defaultProfile(type));expect(Object.values(a.distribution).reduce((sum,n)=>sum+n,0)).toBeCloseTo(1,12);expect(a.sizing.reduce((sum,size)=>sum+size.weight,0)).toBeCloseTo(1,12);for(const size of a.sizing){expect(size.raiseTo).toBeGreaterThanOrEqual(1000);expect(size.raiseTo).toBeLessThanOrEqual(10000);}}}finally{rng.mockRestore();}
 });
});
describe('already-dealt runout interpretation',()=>{
 it('separates missed draws, private draw completion and public scare-card changes',()=>{
  expect(runoutFeatures(['Ah','Jh'],['Kh','8h','2s','7c','3d']).missedDraw).toBe(true);
  expect(runoutFeatures(['Ah','Jh'],['Kh','8h','2s','7c','3h']).drawCompleted).toBe(true);
  expect(runoutFeatures(['9c','8d'],['7h','6s','2c','Th']).drawCompleted).toBe(true);
  expect(runoutFeatures(['Ac','Jd'],['Kh','8h','2s','2d']).pairingCard).toBe(true);
  expect(runoutFeatures(['Ac','Jd'],['Kh','8h','2s','3h']).flushCompletion).toBe(true);
 });
});
