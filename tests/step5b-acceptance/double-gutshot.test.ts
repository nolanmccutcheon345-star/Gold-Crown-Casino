import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {hand,rig,act} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
function outs(ranks:number[]){const known=new Set(ranks),result:number[]=[];for(let rank=2;rank<=14;rank++){const extended=new Set([...known,rank]);if(extended.has(14))extended.add(1);for(let lo=1;lo<=10;lo++){if(Array.from({length:5},(_,j)=>lo+j).every(r=>extended.has(r))){result.push(rank);break;}}}return result;}
function state(double:boolean,depth:number,players:number,fraction:number):GameState{
 const own=['9c','7d'],board=[double?'5h':'4h','8h','Js','2c','3d'],focus=players===2?0:1,stacks=Array.from({length:players},(_,i)=>i===focus?depth*200:100000);let g=rig(hand(stacks),players===2?[own,['Ac','Ad']]:[['Ac','Ad'],own,['Kc','Kd']],board);
 g=act(g,{type:'raise',to:1000});while(g.street==='preflop')g=act(g,{type:'call'});
 if(players===3){g=act(g,{type:'check'});g=act(g,{type:'check'});}g=act(g,{type:'raise',to:Math.round(g.pot*fraction)});expect(g.actor).toBe(focus);return g;
}
const save=(name:string,value:unknown)=>{const dir=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,name),JSON.stringify(value,null,2)+'\n');};
describe('Y09 independent double-gutshot, price, depth and action-behind conditions',()=>{
 it('independently identifies four vs eight straight outs on the two-tone fixtures',()=>{expect(outs([4,7,8,9,11])).toEqual([10]);expect(outs([5,7,8,9,11])).toEqual([6,10]);});
 it('reports legal conditional price responses with shallow/deep stacks and a live player behind',()=>{
  const rows=[];
  for(const double of [false,true])for(const depth of [20,200])for(const players of [2,3])for(const fraction of [.5,1.5]){
   const g=state(double,depth,players,fraction),profiles=[],knownRanks=[double?5:4,7,8,9,11];let expected=0,continued=0,calls=0,total=0;
   for(const archetype of ['nit','tag','station','stronger-reg'] as const)for(const identity of [0,1]){
    const p=createProfile({selection:archetype},0x59000+identity*317,'neutral'),o=observeBot(g,g.actor!,p.policyVersion,'double-gutshot'),a=analyzeDecision(o,p);expect(a.features.made).toBe(false);expect(a.features.drawClass).toBe(double?'double-gutshot':'gutshot');expect(p.drawResponses).toBeUndefined();expect(o.legal.callAmount).toBeLessThanOrEqual(g.seats[g.actor!].stack);
    expect(a.distribution.call).toBeGreaterThan(0);expect(a.distribution.fold).toBeGreaterThan(0);expected+=1-a.distribution.fold;
    const counts={fold:0,check:0,call:0,raise:0},seen=new Set<string>();for(let i=0;i<256;i++){const d=chooseDecision(o,p,seededRandom(0x590000+identity*317+i));counts[d.action.type]++;total++;continued+=Number(d.action.type!=='fold');calls+=Number(d.action.type==='call');const key=JSON.stringify(d.action);if(!seen.has(key)){seen.add(key);assertAccounting(applyCommand(g,d));}}
    profiles.push({profile:p,features:a.features,context:a.context,postflop:a.postflop,distribution:a.distribution,counts,opportunities:256});
   }
   rows.push({doubleGutshot:double,depthBB:depth,players,actionBehind:players===3,fraction,own:['9c','7d'],board:g.board,independentCompletionRanks:outs(knownRanks),independentStraightOuts:outs(knownRanks).length*4,pot:g.pot,publicEvents:g.events,legal:observeBot(g,g.actor!,profiles[0].profile.policyVersion,'evidence').legal,expectedContinuation:expected/profiles.length,continued,calls,opportunities:total,profiles});
  }
  save('double-gutshot.json',{policy:rows[0].profiles[0].profile.policyVersion,rows,decisions:rows.reduce((n,r)=>n+r.opportunities,0),claim:'Conditional synthetic decisions only. Double-gutshot has its own feature classification; custom draw curves share the eight-out response family. Actual call cost is capped by Hero stack; higher inaccessible bets do not inflate eligible pot. No human-calibrated presets or hard action quotas.',method:'16 legal contexts ×4archetypes ×2stable identities ×256matched samples. Original far-pair monotonic failure is preserved. Monotonic checks compare unchanged future-exposure regimes; all-in transitions explicitly verify eligibility and guaranteed runout instead. Separate one-cent boundary regression rejects a discontinuous realization cliff; every distinct proposal applied to engine.'});
  for(const double of [false,true])for(const depth of [20,200])for(const players of [2,3]){const pair=rows.filter(r=>r.doubleGutshot===double&&r.depthBB===depth&&r.players===players);const crossesAllIn=!pair[0].profiles[0].postflop!.futureBettingClosed&&pair[1].profiles[0].postflop!.futureBettingClosed;
   if(!crossesAllIn){expect(pair[1].expectedContinuation,JSON.stringify({double,depth,players})).toBeLessThan(pair[0].expectedContinuation);expect(pair[1].continued).toBeLessThan(pair[0].continued);}
   else{expect(pair[1].legal.callAmount).toBe(3000);for(const p of pair[1].profiles){expect(p.postflop!.realization).toBe(1);expect(p.postflop!.futureCost).toBe(0);}expect(pair[1].profiles[0].postflop!.contestableAfterCall).toBe(players===3?9000:8000);}
  }
 },120000);
 it('rejects a one-cent continuation cliff where a matching all-in was already legally available',()=>{
  const rows=[];
  for(const archetype of ['station','stronger-reg'] as const)for(const identity of [0,1,2,3]){
   const p=createProfile({selection:archetype},0x59000+identity*317,'neutral'),states=[2999,3000].map(bet=>state(true,20,3,bet/3000)),observations=states.map(g=>observeBot(g,g.actor!,p.policyVersion,'all-in-boundary')),a=observations.map(o=>analyzeDecision(o,p));
   expect(observations[0].legal.canRaise).toBe(true);expect(observations[0].legal.shortAllInTo).toBe(3000);expect(observations[1].legal.callAmount).toBe(3000);expect(observations[1].legal.canRaise).toBe(false);expect(a[1].postflop!.showdownEquity).toBe(a[0].postflop!.showdownEquity);
   const difference=Math.abs(a[1].distribution.fold-a[0].distribution.fold);rows.push({profile:p,bet:[2999,3000],legal:observations.map(o=>o.legal),analysis:a.map(x=>({distribution:x.distribution,context:x.context,postflop:x.postflop})),difference});
  }
  save('near-all-in-boundary.json',{rows,maxAllowedProbabilityDelta:.005,basis:'Pre-fix regression bound on a one-cent input perturbation, not minimum continuation or strategic frequency quota. Same posterior and available all-in exposure; old1.5 defect exceeds this bound by orders of magnitude.'});
  for(const row of rows)expect(row.difference,`${row.profile.archetype}/${row.profile.personalityId}`).toBeLessThanOrEqual(.005);
 });

});
