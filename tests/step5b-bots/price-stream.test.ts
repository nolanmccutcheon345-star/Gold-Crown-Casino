import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createProfile,analyzeDecision,chooseDecision} from '../../src/bots/policy';
import {analyzeRanges as frozenRanges} from '../../src/bots/v4/ranges';
import {observeBot,applyCommand,assertAccounting} from '../../src/core/engine';
import {hand,rig,act} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import type {DrawResponseStreet,GameState} from '../../src/contracts';
const discovery={oesd:{own:['9c','8d'],board:['6h','7s','Kc','2d','Qh']},combo:{own:['9h','8h'],board:['6h','7h','Kc','2d','Qs']}};
// Held out before candidate run; separate suits/ranks from the discovery inputs.
const heldout=[{id:'straight-jt',own:['Jc','Td'],board:['9h','8s','3c','2d','Ah']},{id:'combo-76',own:['7h','6h'],board:['5h','8h','Qc','2d','Ks']},{id:'gutshot-98',own:['9s','8d'],board:['6h','Tc','2s','Kd','4h']},{id:'nut-flush-a5',own:['Ad','5d'],board:['Kd','9d','2c','3h','Qs']}];
function fixture(c:{own:string[];board:string[]},street:DrawResponseStreet,fraction:number):GameState {const dead=[...c.own,...c.board],available=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!dead.includes(c));let g=rig(hand([100000,100000]),[c.own,available.slice(0,2)],c.board);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});while(g.street!==street)g=act(g,{type:'check'});return act(g,{type:'raise',to:Math.round(2000*fraction)});}
describe('Price-conditioned ranges with common equity random numbers',()=>{
 it.each([['oesd','flop',1.5,2],['oesd','turn',.5,.75],['combo','turn',.5,.75]] as const)('repairs discovery %s/%s increasing-price reversal without forced defense quotas', (kind,street,low,high)=>{
  const p=createProfile({selection:'tag'},555,'neutral'),a=fixture(discovery[kind],street,low),b=fixture(discovery[kind],street,high),first=analyzeDecision(observeBot(a,0,p.policyVersion,'low'),p),last=analyzeDecision(observeBot(b,0,p.policyVersion,'high'),p);
  expect(last.postflop!.rakeAdjustedPrice).toBeGreaterThan(first.postflop!.rakeAdjustedPrice);expect(1-last.distribution.fold).toBeLessThan(1-first.distribution.fold);
 });
 it('preserves the complete priced posterior and recomputes changed weights instead of reusing an unpriced cache',()=>{
  const p=createProfile({selection:'tag'},555,'neutral');let prior:ReturnType<typeof analyzeDecision>|null=null;
  for(const price of [.25,.5,.75,1,1.5,2,3]){const game=fixture(discovery.oesd,'turn',price),o=observeBot(game,0,p.policyVersion,'range'),actual=analyzeDecision(o,p),old=frozenRanges(o,p);expect(actual.ranges!.opponents).toEqual(old.opponents);expect(actual.ranges!.foldEquity).toBe(old.foldEquity);if(prior&&price<=2)expect(actual.ranges!.opponents[0].combos).not.toEqual(prior.ranges!.opponents[0].combos);prior=actual;}
 });
 it('160 held-out one-cent changes below saturation keep the priced posterior responsive without abrupt defense jumps',()=>{
  let pairs=0;
  for(const c of heldout)for(const archetype of ['tag','stronger-reg'] as const)for(const seed of [17,193])for(const street of ['flop','turn'] as const)for(const price of [.25,.5,.75,1,1.5]){
   const p=createProfile({selection:archetype},seed,'neutral'),g=fixture(c,street,price),h=fixture(c,street,price+.0005),a=analyzeDecision(observeBot(g,0,p.policyVersion,'low'),p),b=analyzeDecision(observeBot(h,0,p.policyVersion,'high'),p);
   expect(b.ranges!.opponents[0].combos).not.toEqual(a.ranges!.opponents[0].combos);expect(Math.abs(a.distribution.fold-b.distribution.fold)).toBeLessThan(.005);expect(b.postflop!.rakeAdjustedPrice).toBeGreaterThan(a.postflop!.rakeAdjustedPrice);pairs++;
  }
  expect(pairs).toBe(160);
 });
 it('96 held-out one-cent overbet pairs keep identical-posterior equity fixed and have bounded smooth legal defense',()=>{
  const rows:unknown[]=[];let opportunities=0;
  for(const c of heldout)for(const archetype of ['tag','stronger-reg'] as const)for(const seed of [17,193])for(const street of ['flop','turn'] as const)for(const price of [2,2.25,2.5]){
   const p=createProfile({selection:archetype},seed,'neutral'),a=fixture(c,street,price),b=fixture(c,street,price+.0005),o=observeBot(a,0,p.policyVersion,'paired'),v=observeBot(b,0,p.policyVersion,'paired'),before=analyzeDecision(o,p),after=analyzeDecision(v,p);
   expect(after.ranges!.opponents).toEqual(before.ranges!.opponents);expect(after.ranges!.equity).toBe(before.ranges!.equity);expect(after.ranges!.equityStdError).toBe(before.ranges!.equityStdError);
   const delta=(1-after.distribution.fold)-(1-before.distribution.fold);expect(Math.abs(delta)).toBeLessThan(.005);expect(delta).toBeLessThanOrEqual(1e-12);
   const actions=[{fold:0,check:0,call:0,raise:0},{fold:0,check:0,call:0,raise:0}],seen=[new Set<string>(),new Set<string>()];
   for(let draw=0;draw<256;draw++)for(const [index,observation,game]of [[0,o,a],[1,v,b]]as const){const proposal=chooseDecision(observation,p,seededRandom(65000+draw));actions[index][proposal.action.type]++;opportunities++;const key=JSON.stringify(proposal.action);if(!seen[index].has(key)){seen[index].add(key);assertAccounting(applyCommand(game,proposal));}}
   rows.push({fixture:c.id,archetype,seed,street,price,priceAfter:price+.0005,opportunitiesPerSide:256,actions,continuationBefore:1-before.distribution.fold,continuationAfter:1-after.distribution.fold,delta,equity:before.ranges!.equity,equityStdError:before.ranges!.equityStdError,posteriorIdentical:true});
  }
  expect(rows).toHaveLength(96);expect(opportunities).toBe(49152);mkdirSync('tests/step5b-performance/evidence/price-investigation',{recursive:true});writeFileSync('tests/step5b-performance/evidence/price-investigation/heldout-one-cent.json',JSON.stringify({method:'Held-out paired one-cent changes on $20 pots:4draw contexts×2archetypes×2stable personalities×2streets×3overbet sizes. Synthetic current range likelihood saturates over2pot, permitting an exact equal-posterior comparison; no globalmonotonic assertion imposed on changing ranges. All distinct sampled actions were committed to actual engine clones;49,152 seeded proposals. These are simulator conditionals, not human calibration.',opportunities,rows},null,2));
 },60000);
});
