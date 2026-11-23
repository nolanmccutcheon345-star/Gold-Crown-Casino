import {describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import type {Archetype,BotObservation,BotProfile,GameState} from '../../src/contracts';
import {startHand,observeBot,applyCommand} from '../../src/core/engine';
import * as prior from '../../src/bots/v2/policy';
import * as current from '../../src/bots/policy';
import {rangeWeights as oldWeights,preflopPosition as oldPosition} from '../../src/bots/v2/preflop';
import {rangeWeights as newWeights,preflopPosition as newPosition,physicalPosition} from '../../src/bots/preflop';
import {allHandClasses} from '../step4b/preflop-fixtures';
import {practiceProfile} from '../verification/helpers';

// Independent physical combinations and RNG: no sampling/classification code imported from policy.
const groups=allHandClasses(),combos=groups.flatMap(g=>g.combos);
function random(seed:number){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function scenario(seats:number,seat:number,depth:number,rake=0):GameState{
 let s=startHand({handId:`preflop4c:${seats}:${seat}:${depth}:${rake}`,button:0,profile:{...practiceProfile(),rake:{basisPoints:rake,cap:rake?800:0,noFlopNoDrop:true}},seats:Array.from({length:seats},(_,id)=>({id,name:`P${id}`,stack:depth*200}))});
 let guard=0;while(s.actor!==seat){if(s.actor===null||guard++>10)throw Error('Not a genuine first-in position');s=applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor,decisionId:`fold:${s.revision}`,action:{type:'fold'}});}return s;
}
function obs(s:GameState,p:BotProfile,cards:string[]):BotObservation{const o=observeBot(s,s.actor!,p.policyVersion,'measurement');o.ownCards=cards;o.rake=s.profile.rake;return o;}
const sum=(rows:ReturnType<typeof oldWeights>,key:'continueWeight'|'raiseWeight'|'callWeight')=>rows.reduce((n,r)=>n+r.comboCount*r[key]/1326,0);
function exact(s:GameState,p:BotProfile,version:'before'|'after'){
 const analyze=version==='before'?prior.analyzeDecision:current.analyzeDecision;
 const result={entry:0,raise:0,limp:0,fold:0,check:0};
 for(const g of groups){const a=analyze(obs(s,p,g.combos[0]),p).distribution;result.entry+=g.weight*(a.call+a.raise)/1326;result.raise+=g.weight*a.raise/1326;result.limp+=g.weight*a.call/1326;result.fold+=g.weight*a.fold/1326;result.check+=g.weight*a.check/1326;}return result;
}
function wilson(count:number,n:number){const z=1.95996398454,d=1+z*z/n,c=(count/n+z*z/(2*n))/d,h=z*Math.sqrt(count/n*(1-count/n)/n+z*z/(4*n*n))/d;return[Math.max(0,c-h),Math.min(1,c+h)];}
function sampled(s:GameState,p:BotProfile,version:'before'|'after',seed:number,n:number){
 const cardRandom=random(seed),choose=version==='before'?prior.chooseDecision:current.chooseDecision;
 const counts={raise:0,limp:0,fold:0,check:0};let totalSize=0,cardSequenceHash=0x811c9dc5;
 for(let i=0;i<n;i++){const cards=combos[Math.floor(cardRandom()*1326)];for(const char of cards.join(''))cardSequenceHash=Math.imul(cardSequenceHash^char.charCodeAt(0),16777619);const actionRandom=random((seed^Math.imul(i+1,0x9e3779b9))>>>0),a=choose(obs(s,p,cards),p,actionRandom).action;if(a.type==='raise'){counts.raise++;totalSize+=a.to;}else if(a.type==='call')counts.limp++;else counts[a.type]++;}
 return{trials:n,seed,cardSequenceHash:(cardSequenceHash>>>0).toString(16),entropy:'Independent card RNG; per-trial action seed = seed XOR imul(trial+1,0x9e3779b9). Same cards/action entropy before and after regardless of prior size draws.',counts,entry:counts.raise+counts.limp,raiseCI95:wilson(counts.raise,n),entryCI95:wilson(counts.raise+counts.limp,n),meanOpenBB:counts.raise?totalSize/counts.raise/200:null};
}

describe('Step4C independent opening-range audit',()=>{
 it('reproduces the exact published 6-max 100BB entry figures and separates RFI from limping',()=>{
  const p=prior.defaultProfile('tag'),utg=oldWeights(p,'UTG','unopened',100,{seats:6,callBB:1,price:.4}),btn=oldWeights(p,'BTN','unopened',100,{seats:6,callBB:1,price:.4});
  expect(Number((sum(utg,'continueWeight')*100).toFixed(2))).toBe(9.48);expect(Number((sum(btn,'continueWeight')*100).toFixed(2))).toBe(19.99);
  for(const [seat,rows]of [[3,utg],[0,btn]]as const){const a=exact(scenario(6,seat,100),p,'before');expect(a.entry).toBeCloseTo(sum([...rows],'continueWeight'),12);expect(a.raise).toBeCloseTo(sum([...rows],'raiseWeight'),12);expect(a.limp).toBeGreaterThan(0);expect(a.entry).toBeGreaterThan(a.raise);}
  expect(groups.length).toBe(169);expect(combos.length).toBe(1326);expect(new Set(combos.map(c=>[...c].sort().join(''))).size).toBe(1326);
 });
 it('writes a version-paired exhaustive physical-seat/depth report when requested',()=>{
  if(process.env.PREFLOP4C_REPORT!=='1')return;
  const rows=[];
  for(const n of [2,6,9,10])for(const depth of [20,40,60,100,150,200,300])for(const seat of n===2?[0]:[...Array.from({length:n-3},(_,i)=>i+3),0,1])for(const archetype of current.ARCHETYPES){
   const s=scenario(n,seat,depth),beforeP=prior.defaultProfile(archetype),afterP=current.defaultProfile(archetype);
   rows.push({seats:n,seat,physicalPosition:physicalPosition(obs(s,afterP,['As','Kh'])),positionBefore:oldPosition(obs(s,beforeP,['As','Kh'])),positionAfter:newPosition(obs(s,afterP,['As','Kh'])),depthBB:depth,archetype,before:exact(s,beforeP,'before'),after:exact(s,afterP,'after')});
  }
  const controlled=[];
  for(const n of [2,6,9,10])for(const depth of [20,100,250])for(const seat of n===2?[0]:[3,0])for(const archetype of ['tag','stronger-reg']as Archetype[]){
   const s=scenario(n,seat,depth);const seed=(0x4c710000+n*1000+depth*3+seat)>>>0;
   controlled.push({seats:n,seat,depthBB:depth,archetype,expectedBefore:exact(s,prior.defaultProfile(archetype),'before'),expectedAfter:exact(s,current.defaultProfile(archetype),'after'),before:sampled(s,prior.defaultProfile(archetype),'before',seed,4096),after:sampled(s,current.defaultProfile(archetype),'after',seed,4096)});
  }
  for(const row of controlled)expect(row.before.cardSequenceHash).toBe(row.after.cardSequenceHash);
  const ablations=[];
  for(const archetype of ['tag','stronger-reg']as Archetype[])for(const environment of ['neutral','low','mid','high']as const)for(const skill of [.25,.65,.9])for(const rake of [0,500]){
   const s=scenario(6,0,100,rake),seed=0x4c111;
   const beforeP=prior.createProfile({selection:archetype,skill},seed,environment),afterP=current.createProfile({selection:archetype,skill},seed,environment);
   ablations.push({archetype,environment,skill,rakeBasisPoints:rake,rakeCapBB:rake?4:0,personalitySeed:seed,before:exact(s,beforeP,'before'),after:exact(s,afterP,'after')});
  }
  const profiles=current.ARCHETYPES.map(archetype=>({archetype,before:prior.defaultProfile(archetype),after:current.defaultProfile(archetype)}));
  const report={profiles,evidence:'Synthetic conditional decisions; not human observations, complete-hand VPIP or solver output',config:{beforePolicy:prior.POLICY_VERSION,afterPolicy:current.POLICY_VERSION,blinds:[100,200],ante:0,button:0,allStartingStacksEqual:true,publicHistory:'Only earlier players folded; no voluntary contribution before actor',defaultProfiles:'Stable per-archetype default seed; neutral environment and skill from profile',denominator:'Exact mass weights all169 classes by independently enumerated6/4/12 physical combinations. Sample trials independently select uniformly among1326 then draw legal action.',sampleUncertainty:'Wilson95% conditional on a fixed individual/configuration; not population intervals. Repeated configurations are not pooled into independent human samples.'},publishedBaseline:{UTG:exact(scenario(6,3,100),prior.defaultProfile('tag'),'before'),BTN:exact(scenario(6,0,100),prior.defaultProfile('tag'),'before')},rows,controlled,ablations};
  mkdirSync('tests/preflop4c/evidence',{recursive:true});writeFileSync('tests/preflop4c/evidence/opening-audit.json.gz',gzipSync(JSON.stringify(report)));
  const csv=['seats,seat,position,physicalPosition,depthBB,archetype,beforeEntry,beforeRFI,beforeLimp,afterEntry,afterRFI,afterLimp',...rows.map(r=>[r.seats,r.seat,r.positionAfter,r.physicalPosition,r.depthBB,r.archetype,r.before.entry,r.before.raise,r.before.limp,r.after.entry,r.after.raise,r.after.limp].join(','))];writeFileSync('tests/preflop4c/evidence/opening-summary.csv',csv.join('\n')+'\n');
  console.log(JSON.stringify({exactRows:rows.length,physicalClassesPerRow:169,physicalComboDenominator:1326,sampledContexts:controlled.length,decisionTrials:controlled.length*4096*2,publishedBaseline:report.publishedBaseline}));
 },180000);
 it('checks the advisory model directly against actual legal analysis for current first-in cases',()=>{
  for(const archetype of ['tag','stronger-reg']as const)for(const seat of [3,0]){
   const p=current.defaultProfile(archetype),s=scenario(6,seat,100),o=obs(s,p,['As','Kh']),a=exact(s,p,'after');
   const rows=newWeights(p,newPosition(o),'unopened',100,{seats:6,callBB:1,price:.4});
   expect(a.entry).toBeCloseTo(sum(rows,'continueWeight'),12);expect(a.raise).toBeCloseTo(sum(rows,'raiseWeight'),12);
  }
 });
});
