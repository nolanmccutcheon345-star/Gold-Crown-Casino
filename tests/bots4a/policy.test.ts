import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {BotObservation,BotMemory,RuleProfile,Action,GameState,PublicMemoryHand} from '../../src/contracts';
import {startHand,observeBot,applyCommand} from '../../src/core/engine';
import * as legacy from '../../src/bots/legacy-v0';
import {ARCHETYPES,POLICY_VERSION,LEGACY_POLICY_VERSION,DEFAULT_CUSTOM_TRAITS,createProfile,defaultProfile,supportedPolicy,chooseDecision,policyDistribution,analyzeDecision,handFeatures,DecisionCache,buildOpponentMemory} from '../../src/bots/policy';
import {seedStream,TRAIT_KEYS} from '../../src/bots/profiles';
const rules:RuleProfile={id:'test',version:'1',mode:'cash',smallBlind:1,bigBlind:2,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const make=()=>startHand({handId:'4a-test',profile:rules,button:0,seats:Array.from({length:6},(_,id)=>({id,name:`Seat ${id}`,stack:200}))});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d-${s.revision}`,action});
const obs=(s=make()):BotObservation=>observeBot(s,s.actor!,POLICY_VERSION,`bot-${s.revision}`);
const rates=(count:number,opportunities=40)=>({count,opportunities});
const memory=(seatId=4):BotMemory=>({windowHands:40,opponents:[{seatId,hands:40,vpip:rates(20),pfr:rates(10),aggression:rates(30),foldToBet:rates(30),showdowns:[['As','Kd']]}]});

describe('Step4A stable personalities and version isolation',()=>{
 it('preserves the full legacy source byte-for-byte and exact legacy sampled decisions/hash',()=>{
  expect(createHash('sha256').update(readFileSync('src/bots/legacy-v0.ts')).digest('hex')).toBe('7b952a1a294d0b1ee9e9035aa1c4f01699aaf4e8d4f11d147f5528f547314723');
  expect(supportedPolicy(LEGACY_POLICY_VERSION)).toBe(true);expect(supportedPolicy(POLICY_VERSION)).toBe(true);expect(supportedPolicy('invented')).toBe(false);
  for(const type of ARCHETYPES){const p=legacy.defaultProfile(type),o=obs();o.policyVersion=p.policyVersion;
   Object.defineProperty(o,'memory',{get(){throw new Error('Legacy must not read newly introduced memory');}});
   for(let seed=0;seed<32;seed++)expect(chooseDecision(o,p,seedStream(seed))).toEqual(legacy.chooseDecision(o,p,seedStream(seed)));
   expect(policyDistribution(o,p)).toEqual(legacy.policyDistribution(o,p));
  }
 });
 it('creates stable individual variation without mutating configuration or deriving skill from environment',()=>{
  const config={selection:'tag' as const},copy=structuredClone(config),a=createProfile(config,42,'low');
  expect(createProfile(config,42,'low')).toEqual(a);expect(createProfile(config,43,'low')).not.toEqual(a);expect(config).toEqual(copy);
  const high=createProfile(config,42,'high');expect(high.skill).toBe(a.skill);expect(high.traits).toEqual(a.traits);expect(high.archetype).toBe(a.archetype);
  for(const key of TRAIT_KEYS)expect(a.traits![key]).toBeGreaterThanOrEqual(0);
 });
 it('applies explicit custom controls exactly and retains hidden Unknown construction identity',()=>{
  const controls={...DEFAULT_CUSTOM_TRAITS,bluffFrequency:.91,drawCalling:.13};
  const p=createProfile({selection:'custom',baseArchetype:'station',aggression:.7,looseness:.3,skill:.8,traits:controls},18,'neutral');
  expect(p.traits).toEqual(controls);expect(p.aggression).toBe(.7);expect(p.looseness).toBe(.3);expect(p.skill).toBe(.8);
  const unknown=createProfile({selection:'unknown'},18,'low');expect(unknown.unknown).toBe(true);expect(ARCHETYPES).toContain(unknown.archetype);expect(createProfile({selection:'unknown'},18,'low')).toEqual(unknown);
  expect(()=>createProfile({selection:'tag',traits:{bluffFrequency:NaN}},1,'neutral')).toThrow();
 });
 it('population selection changes designed mixes while explicit skill remains independent',()=>{
  const totals={low:0,high:0};
  for(const environment of ['low','high'] as const)for(let seed=0;seed<800;seed++){
   const p=createProfile({selection:'random',skill:.5},seed,environment);expect(p.skill).toBe(.5);
   if(p.archetype==='station'||p.archetype==='passive-reg')totals[environment]++;
  }
  expect(totals.low).toBeGreaterThan(totals.high*2);
 });
 it('uses complete profile and allowed memory/rake in the fixed decision identity',()=>{
  const p=defaultProfile('tag'),o=obs();o.memory=memory();o.rake={basisPoints:500,cap:20,noFlopNoDrop:true};
  const cache=new DecisionCache(()=>.99);cache.getOrCreate(o,p);
  for(const changed of [{...p,skill:.99},{...p,environment:'high' as const},{...p,unknown:true},{...p,personalityId:'other'},{...p,traits:{...p.traits!,slowPlay:.99}}])expect(()=>cache.getOrCreate(o,changed)).toThrow(/reused/);
  const changed=structuredClone(o);changed.memory!.opponents[0].foldToBet.count=5;expect(()=>cache.getOrCreate(changed,p)).toThrow(/reused/);
  expect(()=>cache.getOrCreate({...o,rake:{...o.rake!,cap:30}},p)).toThrow(/reused/);
 });
});

describe('Step4A meaningful visible features and decision context',()=>{
 it('distinguishes made hands, board-only strength and live draw families',()=>{
  expect(handFeatures(['Ah','Kd'],['As','7c','2d']).handClass).toBe('top-pair');
  expect(handFeatures(['9h','9d'],['Ks','Jc','2d']).handClass).toBe('underpair');
  expect(handFeatures(['Qh','Jh'],['Th','9h','2c']).drawClass).toBe('combo');
  expect(handFeatures(['Qc','Jd'],['Th','9s','2c']).drawClass).toBe('open-ended');
  expect(handFeatures(['Ac','5d'],['2h','3s','Kc']).drawClass).toBe('gutshot');
  expect(handFeatures(['Kh','7h'],['Ah','2h','9c']).nutDraw).toBe(true);
  expect(handFeatures(['Ac','Kd'],['7c','7d','7h']).handClass).toBe('board-trips');
  expect(handFeatures(['3c','2d'],['Qh','Jh','Th','9h','8h']).playsBoard).toBe(true);
  expect(handFeatures(['Ah','7h'],['Kh','2h','9c','4s','Jd']).draw).toBe(0);
 });
 it('finds limp, isolation, squeeze, three-bet and four-bet contexts from public action order',()=>{
  let s=make();expect(analyzeDecision(obs(s),defaultProfile('tag')).context.preflopNode).toBe('unopened');
  expect(analyzeDecision(obs(s),defaultProfile('tag')).context.playersBehind).toBe(5);
  s=act(s,{type:'call'});let a=analyzeDecision(obs(s),defaultProfile('tag'));expect(a.context.limpers).toBe(1);expect(a.context.preflopNode).toBe('limped');expect(a.sizing.some(x=>x.label==='Isolation raise')).toBe(true);
  s=make();s=act(s,{type:'raise',to:6});s=act(s,{type:'call'});a=analyzeDecision(obs(s),defaultProfile('tag'));expect(a.context.squeeze).toBe(true);expect(a.sizing.some(x=>x.label==='Squeeze')).toBe(true);
  s=act(s,{type:'raise',to:20});expect(analyzeDecision(obs(s),defaultProfile('tag')).context.preflopNode).toBe('facing-3bet');
  s=act(s,{type:'raise',to:50});expect(analyzeDecision(obs(s),defaultProfile('tag')).context.preflopNode).toBe('facing-4bet');
 });
 it('sizing is a normalized legal raise-to distribution, including 25–300% pot families',()=>{
  const o=obs();o.street='river';o.board=['2c','5d','7h','9s','Tc'];o.ownCards=['As','Ah'];o.pot=100;
  o.legal={actor:o.actingSeat,fold:true,check:true,callAmount:0,canRaise:true,reopened:true,minRaiseTo:2,maxRaiseTo:1000,shortAllInTo:null};
  o.seats=o.seats.map(s=>({...s,stack:1000,streetCommitted:0}));
  const a=analyzeDecision(o,defaultProfile('lag'));expect(a.sizing.reduce((n,s)=>n+s.weight,0)).toBeCloseTo(1,12);
  expect(a.sizing.some(s=>s.label==='25% pot')).toBe(true);expect(a.sizing.some(s=>s.label==='300% pot')).toBe(true);
  for(const size of a.sizing){expect(size.raiseTo).toBeGreaterThanOrEqual(2);expect(size.raiseTo).toBeLessThanOrEqual(1000);expect(Number.isSafeInteger(size.raiseTo)).toBe(true);}
 });
 it('uses only explicit public memory and shrinks low-opportunity behavior updates',()=>{
  const o=obs();o.street='flop';o.board=['2c','5d','9h'];o.ownCards=['Ks','Jd'];o.memory=memory();
  const p=defaultProfile('stronger-reg'),a=analyzeDecision(o,p);expect(a.memoryAdjustment.bluff).toBeGreaterThan(0);
  const tiny=structuredClone(o);tiny.memory!.opponents[0].foldToBet={count:1,opportunities:1};
  expect(analyzeDecision(tiny,p).memoryAdjustment.bluff).toBeLessThan(a.memoryAdjustment.bluff);
  const noAdapt={...p,traits:{...p.traits!,adaptation:0}};expect(analyzeDecision(o,noAdapt).memoryAdjustment).toEqual({call:0,bluff:0});
  Object.defineProperty(o.memory!.opponents[0],'privateCards',{get(){throw new Error('private memory read');}});
  expect(()=>chooseDecision(o,p,()=>.4)).not.toThrow();
 });
});

function publicHand(id:string):PublicMemoryHand{return {handId:id,seats:[{id:0,revealedCards:[]},{id:1,revealedCards:[]},{id:2,revealedCards:['As','Kh']}],events:[
 {id:`${id}:0`,handId:id,revision:0,type:'blind',seatId:1,amount:1},
 {id:`${id}:1`,handId:id,revision:0,type:'blind',seatId:2,amount:2},
 {id:`${id}:2`,handId:id,revision:1,type:'action',street:'preflop',seatId:0,action:{type:'raise',to:6},amount:6},
 {id:`${id}:3`,handId:id,revision:2,type:'action',street:'preflop',seatId:1,action:{type:'call'},amount:5},
 {id:`${id}:4`,handId:id,revision:3,type:'action',street:'preflop',seatId:2,action:{type:'call'},amount:4},
 {id:`${id}:5`,handId:id,revision:3,type:'street',street:'flop',cards:['2c','7d','Th']},
 {id:`${id}:6`,handId:id,revision:4,type:'action',street:'flop',seatId:1,action:{type:'check'},amount:0},
 {id:`${id}:7`,handId:id,revision:5,type:'action',street:'flop',seatId:2,action:{type:'raise',to:10},amount:10},
 {id:`${id}:8`,handId:id,revision:6,type:'action',street:'flop',seatId:0,action:{type:'fold'},amount:0},
 {id:`${id}:9`,handId:id,revision:7,type:'action',street:'flop',seatId:1,action:{type:'fold'},amount:0},
]};}
describe('Step4A bounded observable memory with honest denominators',()=>{
 it('counts decision opportunities, resets streets, excludes observer and forced-blind-only hands',()=>{
  const h=publicHand('m1'),forced:PublicMemoryHand={handId:'forced',seats:[{id:0,revealedCards:[]},{id:1,revealedCards:[]}],events:[{id:'forced:0',handId:'forced',revision:0,type:'blind',seatId:1,amount:1}]};
  const m=buildOpponentMemory([h,forced],0,1),one=m.opponents.find(x=>x.seatId===1)!;
  expect(m.opponents.some(x=>x.seatId===0)).toBe(false);expect(one.hands).toBe(2);expect(one.vpip).toEqual({count:1,opportunities:1});expect(one.pfr).toEqual({count:0,opportunities:1});expect(one.aggression).toEqual({count:0,opportunities:2});expect(one.foldToBet).toEqual({count:1,opportunities:1});
  expect(m.opponents.find(x=>x.seatId===2)!.showdowns).toEqual([['As','Kh']]);
 });
 it('bounds retention and public showdowns, deduplicates repeated hands/events, and never accepts folded private cards',()=>{
  const hands=Array.from({length:150},(_,i)=>publicHand(`h${i}`));
  const last=hands.at(-1)!;last.seats[1].revealedCards=['Qc','Qd'];last.events.push({...last.events[3]});
  Object.defineProperty(last.seats[1],'hole',{get(){throw new Error('Hidden card read');}});Object.defineProperty(last,'deck',{get(){throw new Error('Deck read');}});
  const m=buildOpponentMemory([...hands,last],0,1);expect(m.windowHands).toBe(120);expect(m.opponents.find(x=>x.seatId===1)!.vpip).toEqual({count:120,opportunities:120});expect(m.opponents.find(x=>x.seatId===1)!.showdowns).toEqual([]);expect(m.opponents.find(x=>x.seatId===2)!.showdowns).toHaveLength(8);
  expect(buildOpponentMemory(hands,0,.5).windowHands).toBe(60);expect(buildOpponentMemory(hands,0,0)).toEqual({windowHands:0,opponents:[]});
 });
 it('does not mutate provided hand projections',()=>{const hand=publicHand('immutable'),copy=structuredClone(hand);buildOpponentMemory([hand],0,1);expect(hand).toEqual(copy);});
});

describe('Step4A critical strategy safeguards',()=>{
 it('never folds pocket aces unopened or royal-flush nuts to any legal price',()=>{
  for(const archetype of ARCHETYPES){const p=defaultProfile(archetype),o=obs();o.ownCards=['As','Ad'];expect(policyDistribution(o,p).fold).toBe(0);
   const royal=obs();royal.street='river';royal.ownCards=['As','Ks'];royal.board=['Qs','Js','Ts','4d','8c'];royal.pot=100;royal.seats.forEach(s=>{s.streetCommitted=0;s.stack=1000;});royal.legal={actor:royal.actingSeat,fold:true,check:false,callAmount:300,minRaiseTo:600,maxRaiseTo:1000,canRaise:true,shortAllInTo:null,reopened:true};
   expect(policyDistribution(royal,p).fold).toBe(0);for(let seed=0;seed<32;seed++)expect(chooseDecision(royal,p,seedStream(seed)).action.type).not.toBe('fold');
  }
 });
 it('identifies heads-up and three-handed blind positions before late-position rules',()=>{
  for(const count of [2,3]){let s=startHand({handId:`positions${count}`,profile:rules,button:0,seats:Array.from({length:count},(_,id)=>({id,name:`S${id}`,stack:200}))});
   const first=analyzeDecision(obs(s),defaultProfile('tag')).context;expect(first.position).toBe('late');
   s=act(s,{type:'call'});expect(analyzeDecision(obs(s),defaultProfile('tag')).context.position).toBe('blinds');
   if(count===3){s=act(s,{type:'call'});expect(analyzeDecision(obs(s),defaultProfile('tag')).context.position).toBe('blinds');}
  }
 });
 it('retains callable effective stack against an opponent already all-in',()=>{
  let s=startHand({handId:'all-in-depth',profile:rules,button:0,seats:[{id:0,name:'A',stack:100},{id:1,name:'B',stack:200}]});
  s=act(s,{type:'raise',to:100});const context=analyzeDecision(obs(s),defaultProfile('tag')).context;expect(context.effectiveStackBB).toBe(49);expect(context.spr).toBeGreaterThan(0);
 });
 it('does not mistake shared board structures or board-only straight draws for private strength',()=>{
  expect(handFeatures(['Ac','Kd'],['7c','7d','7h']).handClass).toBe('board-trips');
  expect(handFeatures(['9c','8d'],['Kc','Kd','Qh','Qs']).handClass).toBe('board-two-pair');
  const quads=handFeatures(['Kc','Jd'],['7c','7d','7h','7s']);expect(quads.handClass).toBe('board-quads');expect(quads.strength).toBeLessThan(.7);
  expect(handFeatures(['8c','2d'],['8h','9s','Th','Jc']).drawClass).toBe('none');
 });
 it('identifies nut-suit and preflop A/K blockers without using hidden cards',()=>{
  expect(handFeatures(['Ac','5d'],[]).blockerStrength).toBeGreaterThan(handFeatures(['9c','5d'],[]).blockerStrength);
  expect(handFeatures(['Kh','5d'],['Ah','Jh','7h']).blockerStrength).toBeGreaterThan(handFeatures(['Kc','5d'],['Ah','Jh','7h']).blockerStrength);
 });
});

describe('Step4A structural value, draw-price and hostile-board behavior',()=>{
 function river(ownCards:string[],board:string[]):BotObservation {
  const o=obs();o.street='river';o.ownCards=ownCards;o.board=board;o.pot=600;
  o.seats=[{id:o.actingSeat,stack:2000,streetCommitted:0,totalCommitted:200,folded:false,allIn:false},{id:4,stack:1600,streetCommitted:400,totalCommitted:600,folded:false,allIn:false}];o.button=o.actingSeat;
  o.legal={actor:o.actingSeat,fold:true,check:false,callAmount:400,minRaiseTo:800,maxRaiseTo:2000,canRaise:true,shortAllInTo:null,reopened:true};return o;
 }
 it('competent aggressive profiles raise when entering unopened premium hands and value-raise unbeatable river hands',()=>{
  for(const type of ['tag','stronger-reg'] as const){const p=defaultProfile(type),o=obs();o.ownCards=['As','Ad'];expect(policyDistribution(o,p).raise).toBeGreaterThan(.9);
   const nuts=river(['As','Ks'],['Qs','Js','Ts','4d','8c']);expect(analyzeDecision(nuts,p).features.absoluteNuts).toBe(true);expect(policyDistribution(nuts,p).raise).toBe(1);
  }
 });
 it('compares live draw outs and pot price instead of treating an affordable draw like unpaired air',()=>{
  const o=obs();o.street='turn';o.ownCards=['Ah','Kh'];o.board=['Qh','7h','2c','3d'];o.pot=2200;o.button=o.actingSeat;
  o.seats=[{id:o.actingSeat,stack:200,streetCommitted:0,totalCommitted:1000,folded:false,allIn:false},{id:4,stack:0,streetCommitted:200,totalCommitted:1200,folded:false,allIn:true}];
  o.legal={actor:o.actingSeat,fold:true,check:false,callAmount:200,minRaiseTo:null,maxRaiseTo:null,canRaise:false,shortAllInTo:null,reopened:false};
  for(const type of ['tag','stronger-reg'] as const){const a=analyzeDecision(o,defaultProfile(type));expect(a.context.price).toBeCloseTo(1/12);expect(a.features.cleanOuts).toBeGreaterThan(7);expect(a.distribution.fold).toBeLessThan(.1);}
 });
 it('distinguishes weak four-flush contribution from exact nut flush and weak shared full house from private quads',()=>{
  const weak=river(['4h','7d'],['Ah','Kh','8h','3h','2c']),nut=river(['Qh','7d'],['Ah','Kh','8h','3h','2c']);
  for(const type of ['tag','stronger-reg','station'] as const){const p=defaultProfile(type),w=analyzeDecision(weak,p),n=analyzeDecision(nut,p);expect(w.features.strength).toBeLessThan(n.features.strength);expect(w.features.absoluteNuts).toBe(false);expect(n.features.absoluteNuts).toBe(true);expect(w.distribution.fold).toBeGreaterThan(.05);expect(n.distribution.fold).toBe(0);}
  const shared=river(['2s','2d'],['7c','7d','7h','Ac','Kd']),quads=river(['7s','2d'],['7c','7d','7h','Ac','Kd']);
  const p=defaultProfile('tag');expect(analyzeDecision(shared,p).features.strength).toBeLessThan(.7);expect(analyzeDecision(quads,p).features.absoluteNuts).toBe(true);expect(policyDistribution(shared,p).fold).toBeGreaterThan(policyDistribution(quads,p).fold);
 });
 it('measures cold river-rank checks and constant-context memo without private information',()=>{
  const cases=[{own:['4h','7d'],board:['Ah','Kh','8h','3h','2c']},{own:['Qh','7d'],board:['Ah','Kh','8h','3h','2c']},{own:['7s','2d'],board:['7c','7d','7h','Ac','Kd']},{own:['2s','2d'],board:['7c','7d','7h','Ac','Kd']}];
  const timings:number[]=[];
  for(let run=0;run<8;run++)for(const c of cases){const start=performance.now();handFeatures(c.own,c.board);timings.push(performance.now()-start);}
  timings.sort((a,b)=>a-b);const last=cases.at(-1)!,start=performance.now();for(let i=0;i<1000;i++)handFeatures(last.own,last.board);
  console.log(JSON.stringify({measurement:'Node river visible-rank check',samples:timings.length,p95_ms:timings[Math.floor(timings.length*.95)],max_ms:timings.at(-1),memo1000_ms:performance.now()-start}));
  expect(timings.every(Number.isFinite)).toBe(true);
 });
});
