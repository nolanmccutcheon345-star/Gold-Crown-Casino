import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {defaultProfile,createProfile,POLICY_VERSION} from '../../src/bots/profiles';
import {PREFLOP_CLASSES,classifyStartingHand,comboCountForClass,combosForClass,enumerateStartingCombos,preflopPosition,depthBracket,rangeWeights,analyzePreflop} from '../../src/bots/preflop';
const rules:RuleProfile={id:'test',version:'1',mode:'cash',smallBlind:1,bigBlind:2,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function hand(n=6,bb=100,button=0):GameState{return startHand({handId:'preflop4b',profile:rules,button,seats:Array.from({length:n},(_,id)=>({id,name:`Seat${id}`,stack:bb*2}))});}
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d${s.revision}`,action});
function observation(s=hand(),cards=['As','Ah']):BotObservation {const o=observeBot(s,s.actor!,POLICY_VERSION,`decision${s.revision}`);o.ownCards=cards;return o;}
function firstIn(seat:number,bb=100,cards=['As','Ah']):BotObservation {let s=hand(6,bb);while(s.actor!==seat)s=act(s,{type:'fold'});return observation(s,cards);}
const validMix=(o:BotObservation)=>{const a=analyzePreflop(o,defaultProfile('tag')),d=a.distribution;expect(Object.values(d).every(x=>Number.isFinite(x)&&x>=0&&x<=1)).toBe(true);expect(Object.values(d).reduce((x,y)=>x+y,0)).toBeCloseTo(1,12);if(!o.legal.canRaise)expect(d.raise).toBe(0);for(const size of a.sizing){expect(Number.isSafeInteger(size.raiseTo)).toBe(true);expect(size.raiseTo).toBeLessThanOrEqual(o.legal.maxRaiseTo!);expect(size.raiseTo>=o.legal.minRaiseTo!||size.raiseTo===o.legal.shortAllInTo).toBe(true);}return a;};

describe('versioned169-class combinatorics',()=>{
 it('enumerates all169 unique classes and exactly1326 unique unordered card combinations',()=>{
  expect(PREFLOP_CLASSES).toHaveLength(169);expect(new Set(PREFLOP_CLASSES.map(c=>c.handClass)).size).toBe(169);expect(PREFLOP_CLASSES.reduce((n,c)=>n+c.comboCount,0)).toBe(1326);
  const combos=enumerateStartingCombos();expect(combos).toHaveLength(1326);expect(new Set(combos.map(c=>[...c.cards].sort().join(''))).size).toBe(1326);
  for(const c of PREFLOP_CLASSES){const expanded=combosForClass(c.handClass);expect(expanded).toHaveLength(c.comboCount);expect(expanded.every(x=>classifyStartingHand(x)===c.handClass)).toBe(true);}
  expect(comboCountForClass('AA')).toBe(6);expect(comboCountForClass('AKs')).toBe(4);expect(comboCountForClass('AKo')).toBe(12);
 });
 it('removes only known dead cards and rejects malformed combinations',()=>{
  expect(enumerateStartingCombos(['As','Kh'])).toHaveLength(1225);expect(combosForClass('AA',['As'])).toHaveLength(3);expect(combosForClass('AKs',['As'])).toHaveLength(3);
  expect(()=>classifyStartingHand(['As','As'])).toThrow();expect(()=>combosForClass('XX')).toThrow();expect(()=>enumerateStartingCombos(['XX'])).toThrow();
 });
 it('provides actualcombo-weighted range masses rather than equally weighted169 cells',()=>{
  const rows=rangeWeights(defaultProfile('tag'),'UTG','unopened',100);
  expect(rows).toHaveLength(169);const probability=rows.reduce((n,r)=>n+r.comboCount*r.continueWeight,0)/1326;
  expect(probability).toBeGreaterThan(0);expect(probability).toBeLessThan(1);expect(rows.every(r=>Math.abs(r.continueWeight-r.raiseWeight-r.callWeight)<1e-12)).toBe(true);
 });
});

describe('physicalposition and public preflop sequence',()=>{
 it('uses explicitblindroles, correct6-maxMP, and stablephysicalclockwise order for2–10seats',()=>{
  for(const n of [2,3,4,5,6,7,8,9,10]){const o=observation(hand(n));expect(preflopPosition(o,0)).toBe('BTN');expect(preflopPosition(o,1)).toBe(n===2?'BB':'SB');if(n>=3)expect(preflopPosition(o,2)).toBe('BB');if(n>=4)expect(preflopPosition(o,n-1)).toBe('CO');}
  const o=observation();expect(preflopPosition(o,3)).toBe('UTG');expect(preflopPosition(o,4)).toBe('MP');expect(preflopPosition(o,5)).toBe('CO');
  const shifted=structuredClone(o);shifted.seats=shifted.seats.map(s=>({...s,id:(s.id+2)%6}));shifted.button=2;shifted.actingSeat=5;expect(preflopPosition(shifted)).toBe('UTG');
 });
 it('detects limps, overlimps, squeeze/coldcalls, threebet and fourbet from authoritativeactions',()=>{
  let s=hand();s=act(s,{type:'call'});let a=validMix(observation(s,['9h','7h']));expect(a.node).toBe('limped');expect(a.diagnostics.limpers).toBe(1);
  s=act(s,{type:'call'});a=validMix(observation(s,['9h','7h']));expect(a.diagnostics.limpers).toBe(2);expect(a.sizing.some(x=>x.label==='Isolation raise')).toBe(true);
  s=hand();s=act(s,{type:'raise',to:6});s=act(s,{type:'call'});a=validMix(observation(s,['Ah','5h']));expect(a.node).toBe('facing-open');expect(a.diagnostics.squeeze).toBe(1);expect(a.diagnostics.coldCallers).toBe(1);expect(a.sizing.some(x=>x.label==='Squeeze')).toBe(true);
  s=act(s,{type:'raise',to:20});expect(validMix(observation(s)).node).toBe('facing-3bet');s=act(s,{type:'raise',to:50});expect(validMix(observation(s)).node).toBe('facing-4bet');
 });
 it('useslegal shortallin/freecheck/closedraise sets without creating authority',()=>{
  let s=startHand({handId:'short',profile:rules,button:0,seats:[200,14,200].map((stack,id)=>({id,name:`S${id}`,stack}))});s=act(s,{type:'raise',to:10});const a=validMix(observation(s));expect(a.sizing).toEqual([{label:'Short all-in',raiseTo:14,weight:1}]);
  s=hand(2);s=act(s,{type:'call'});const free=validMix(observation(s,['7c','2d']));expect(free.distribution.fold).toBe(0);expect(free.distribution.call).toBe(0);
  s=hand(2,20);s=act(s,{type:'raise',to:40});const closed=validMix(observation(s));expect(closed.sizing).toEqual([]);expect(closed.effectiveStackBB).toBe(20);
 });
});

describe('prospective designed behavior guards, not human frequency claims',()=>{
 it('valueinitiative spansAAKKQQAK with boundedtrapping and satisfies registeredfirstin guards',()=>{
  for(const type of ['nit','station','passive-reg','tag','stronger-reg'] as const){const p=defaultProfile(type),minimum=type==='nit'?.9:type==='station'||type==='passive-reg'?.8:.95;
   for(const cards of [['As','Ah'],['Ks','Kh']]){const a=analyzePreflop(firstIn(3,100,cards),p);expect(a.distribution.raise,`${type} ${cards}`).toBeGreaterThanOrEqual(minimum);expect(a.distribution.fold).toBe(0);expect(Number(a.diagnostics.trapProbability)).toBeGreaterThan(0);}
   for(const cards of [['Qs','Qh'],['As','Ks'],['As','Kd']]){const a=analyzePreflop(firstIn(3,100,cards),p);expect(a.distribution.raise,`${type} ${cards}`).toBeGreaterThan(.7);}
  }
 });
 it('nit JTo genuinely leaves the early range while remaining a position-dependent boundary hand',()=>{
  const p=defaultProfile('nit'),early=analyzePreflop(firstIn(3,100,['Jh','Td']),p),button=analyzePreflop(firstIn(0,100,['Jh','Td']),p);
  expect(1-early.distribution.fold).toBeLessThan((1-button.distribution.fold)/2);expect(early.distribution.fold).toBeGreaterThan(.95);expect(button.distribution.raise).toBeGreaterThan(early.distribution.raise);
 });
 it('interpolatesallstackanchors and increases affordable speculativeplay asstackdepthgrows',()=>{
  for(const bb of [20,40,60,100,150,200,250]){const d=depthBracket(bb);expect(d.lowerBB).toBeLessThanOrEqual(bb);expect(d.upperBB).toBeGreaterThanOrEqual(bb);}
  expect(depthBracket(80).suitedConnectors).toBe(-2);expect(depthBracket(250).suitedConnectors).toBe(10.5);
  const p=defaultProfile('tag'),entries=[20,40,60,100,150,250].map(bb=>1-analyzePreflop(firstIn(5,bb,['9h','7h']),p).distribution.fold);
  for(let i=1;i<entries.length;i++)expect(entries[i]).toBeGreaterThan(entries[i-1]);
  expect(entries.at(-1)!-entries[0]).toBeGreaterThan(.2);
 });
 it('pricepressure tightens nonpremium continuation and aggression changes mix without altering classidentity',()=>{
  let s=hand();s=act(s,{type:'raise',to:6});const cheap=observation(s,['Jh','Th']),expensive=structuredClone(cheap);expensive.legal.callAmount=20;expensive.legal.minRaiseTo=40;expensive.pot+=14;
  const p=defaultProfile('tag');expect(analyzePreflop(expensive,p).distribution.fold).toBeGreaterThan(analyzePreflop(cheap,p).distribution.fold);
  const c={selection:'custom' as const,baseArchetype:'tag' as const,aggression:.1},a=createProfile(c,3,'neutral'),b=createProfile({...c,aggression:.9},3,'neutral'),o=firstIn(0,100,['Qh','Jh']);
  expect(analyzePreflop(o,b).distribution.raise).toBeGreaterThan(analyzePreflop(o,a).distribution.raise);expect(analyzePreflop(o,a).comboCount).toBe(4);
 });
 it('rejects invalid advisory parameters and renormalizes a restricted no-fold legalset',()=>{
  const p=defaultProfile('tag');expect(()=>rangeWeights(p,'UTG','unopened',100,{price:NaN})).toThrow(/modifiers/);expect(()=>rangeWeights(p,'UTG','unopened',100,{seats:1})).toThrow(/modifiers/);expect(()=>rangeWeights(p,'UTG','unopened',Infinity)).toThrow(/effective/);
  const o=firstIn(3,100,['7c','2d']);o.legal.fold=false;const d=analyzePreflop(o,p).distribution;expect(d.fold).toBe(0);expect(Object.values(d).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
 });
 it('normalizesall169classes overeightbaselineprofiles and allnodes without forbiddenreads/mutation',()=>{
  let s=hand();const nodes=[s];s=act(s,{type:'call'});nodes.push(s);s=act(s,{type:'raise',to:6});nodes.push(s);s=act(s,{type:'raise',to:20});nodes.push(s);s=act(s,{type:'raise',to:50});nodes.push(s);
  for(const state of nodes)for(const type of ['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg'] as const)for(const c of PREFLOP_CLASSES){const o=observation(state,combosForClass(c.handClass)[0]);Object.defineProperty(o,'deck',{get(){throw new Error('Forbidden deck');}});const before=JSON.stringify(o),a=analyzePreflop(o,defaultProfile(type));expect(Object.values(a.distribution).reduce((x,y)=>x+y,0)).toBeCloseTo(1,12);expect(Object.values(a.distribution).every(x=>x>=0&&x<=1)).toBe(true);expect(JSON.stringify(o)).toBe(before);}
 });
});
