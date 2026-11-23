import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import type {Action,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand,ENGINE_VERSION} from '../../src/core/engine';
import {chooseDecision,createProfile,POLICY_VERSION,analyzeDecision} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import {combos,seven,utility,RANGE_WEIGHTS,type RangeName} from '../step5c-gates/river-reference';
export const FAMILIES=[
 {id:'four-hearts-low',board:['Qh','8h','6h','2h','3c'],holdings:[['Ah','As'],['9h','9c']]},
 {id:'four-clubs-high',board:['Kc','Jc','7c','3c','2d'],holdings:[['Ac','Ad'],['9c','9d']]},
 {id:'broadway-four-straight',board:['Ac','Kd','Qh','Js','3c'],holdings:[['Tc','Td'],['Ah','Ad']]},
 {id:'middle-four-straight',board:['7c','8d','9h','Ts','2h'],holdings:[['Jc','Jd'],['9c','9d']]},
 {id:'paired-heart-board',board:['Jd','Jh','8h','4h','2c'],holdings:[['Js','8c'],['Ah','Qh']]},
 {id:'triple-kings',board:['Kc','Kd','Kh','9s','2d'],holdings:[['Ac','Ad'],['Qs','Qd']]},
 {id:'double-paired-queens',board:['Qc','Qd','7h','7s','3c'],holdings:[['Qs','2s'],['Ac','Ad']]},
 {id:'river-spade-completion',board:['Qs','9s','6d','3c','2s'],holdings:[['As','Ks'],['Qh','Qd']]},
 {id:'river-jack-straight-completion',board:['8c','9d','Th','4s','Jc'],holdings:[['Qh','Qs'],['8s','8d']]},
 {id:'board-full-house',board:['9c','9d','9h','5s','5c'],holdings:[['As','Ad'],['Kh','Kd']]},
 {id:'three-hearts-ace-high',board:['Ah','9h','5h','4c','2d'],holdings:[['Kh','Qh'],['As','Ad']]},
 {id:'paired-ten-straight',board:['Td','Th','9c','8d','7s'],holdings:[['Ts','9s'],['Jc','Js']]},
];
const contexts=[0,.33,1.5,3],depths=[40,150],archetypes=['stronger-reg','passive-reg'] as const;
function apply(g:GameState,action:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`prefix:${g.revision}`,action});}
function state(board:string[],own:string[],name:string,depth:number,fraction:number){
 const known=new Set([...board,...own]),other=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!known.has(c)).slice(0,2);
 let g=rig(startHand({handId:`5d:F10:${name}:${depth}:${fraction}`,button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`Seat ${id}`,stack:depth*200}))}),[own,other],board);
 g=apply(g,{type:'raise',to:1000});g=apply(g,{type:'call'});while(g.street!=='river')g=apply(g,{type:'check'});
 g=apply(g,fraction?{type:'raise',to:Math.round(g.pot*fraction)}:{type:'check'});expect(g.actor).toBe(0);return g;
}
it('F10 held-out dangerous-river diagnostic retains every conditional outcome and executes only legal actions',()=>{
 const output=resolve(process.env.STEP5D_GATE_EVIDENCE_DIR??'tests/step5d-gates/evidence/current-run'),started=Date.now();mkdirSync(output,{recursive:true});
 const rows:{family:string;holding:number;depth:number;fraction:number;range:RangeName;ownRank:number[];differenceCents:number;strongCents:number;weakCents:number;bestCents:number;conditionalActions:unknown[]}[]=[],situations:unknown[]=[];let legalCount=0;
 for(const family of FAMILIES)for(let h=0;h<2;h++){
  const own=family.holdings[h],enumerated=combos(family.board,own);expect(enumerated).toHaveLength(990);expect(new Set([...family.board,...own]).size).toBe(7);
  for(const depth of depths)for(const fraction of contexts){
   const g=state(family.board,own,`${family.id}:${h}`,depth,fraction),legal=legalActions(g),candidate=new Map<string,Action>();
   const add=(a:Action)=>candidate.set(JSON.stringify(a),a);if(legal.check)add({type:'check'});if(legal.fold)add({type:'fold'});if(legal.callAmount)add({type:'call'});
   if(legal.canRaise){for(const f of [.25,.5,.75,1,1.5,2,3])add({type:'raise',to:Math.round(Math.max(legal.minRaiseTo!,Math.min(legal.maxRaiseTo!,legal.callAmount+(g.pot+legal.callAmount)*f)))});add({type:'raise',to:legal.minRaiseTo!});add({type:'raise',to:legal.maxRaiseTo!});}
   const samples:{archetype:string;identitySeed:number;actions:Record<string,number>;analysis:unknown;profile:unknown}[]=[];
   for(const archetype of archetypes)for(let identity=0;identity<4;identity++){
    const identitySeed=0x5dabc000+identity*313,profile=createProfile({selection:archetype,skill:archetype==='stronger-reg'?.9:.25},identitySeed,'neutral'),o=observeBot(g,0,profile.policyVersion,`${g.handId}:${identity}`),actions:Record<string,number>={};
    for(let draw=0;draw<32;draw++){const decision=chooseDecision(o,profile,seededRandom(0x5d913000^draw^(identity*10103)));assertAccounting(applyCommand(g,decision));const key=JSON.stringify(decision.action);actions[key]=(actions[key]??0)+1;add(decision.action);legalCount++;}
    samples.push({archetype,identitySeed,actions,analysis:analyzeDecision(o,profile),profile});
   }
   for(const range of Object.keys(RANGE_WEIGHTS) as RangeName[]){const values=new Map([...candidate].map(([key,a])=>[key,utility(g,a,range,enumerated)]));const mean=(archetype:string)=>samples.filter(s=>s.archetype===archetype).reduce((sum,s)=>sum+Object.entries(s.actions).reduce((n,[action,count])=>n+values.get(action)!*count,0),0)/128;const strong=mean('stronger-reg'),weak=mean('passive-reg');rows.push({family:family.id,holding:h,depth,fraction,range,ownRank:seven([...family.board,...own]),differenceCents:strong-weak,strongCents:strong,weakCents:weak,bestCents:Math.max(...values.values()),conditionalActions:[...candidate].map(([key,a])=>({action:a,utilityCents:values.get(key)}))});}
   situations.push({family:family.id,holding:h,depth,fraction,own,board:family.board,publicObservation:observeBot(g,0,POLICY_VERSION,`${g.handId}:reference`),events:g.events,legal,samples});
  }
 }
 const mean=(r:typeof rows)=>r.reduce((n,x)=>n+x.differenceCents,0)/r.length;
 const clusters=FAMILIES.map(f=>({family:f.id,meanCents:mean(rows.filter(r=>r.family===f.id))})),bootstrap:number[]=[],random=seededRandom(0x5d0bcafe);for(let b=0;b<10000;b++){let sum=0;for(let i=0;i<clusters.length;i++)sum+=clusters[Math.floor(random()*clusters.length)].meanCents;bootstrap.push(sum/clusters.length);}bootstrap.sort((a,b)=>a-b);
 const sourcePaths=['tests/step5d-gates/F10_PROTOCOL.md','tests/step5d-gates/river-heldout.test.ts','tests/step5c-gates/river-reference.ts','src/bots/strategy.ts','src/bots/profiles.ts'];
 const result={format:'step5d-heldout-F10-v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},engine:ENGINE_VERSION,policy:POLICY_VERSION,room:practiceProfile(),sourceHashes:Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),seeds:{identity:'0x5dabc000 + identity*313, identity0..3',decision:'0x5d913000 ^ draw ^ (identity*10103), draw0..31',bootstrap:0x5d0bcafe},expected:{legalDecisions:49152,situations:192,cells:576,criterion:'Strong reg adjusts size/line more accurately on average; avoid unconditional "always best" claims',hypothesis:'Positive mean stronger-reg minus weak recreational utility, with all negative cells and uncertainty retained; not asserted as a foregone result'},observed:{legalDecisions:legalCount,situations:situations.length,cells:rows.length,meanDifferenceCents:mean(rows),boardFamilyBootstrap95:[bootstrap[249],bootstrap[9749]],positiveCells:rows.filter(r=>r.differenceCents>0).length,negativeCells:rows.filter(r=>r.differenceCents<0).length,rangeMeans:Object.fromEntries(Object.keys(RANGE_WEIGHTS).map(range=>[range,mean(rows.filter(r=>r.range===range))])),contextMeans:Object.fromEntries(contexts.map(fraction=>[fraction,mean(rows.filter(r=>r.fraction===fraction))])),depthMeans:Object.fromEntries(depths.map(depth=>[depth,mean(rows.filter(r=>r.depth===depth))])),rankMeans:Object.fromEntries([...new Set(rows.map(r=>r.ownRank[0]))].map(rank=>[rank,mean(rows.filter(r=>r.ownRank[0]===rank))]))},clusters,elapsedMs:Date.now()-started,limitations:['Synthetic one-node utility, no re-raises, no measured human priors, no expert/solver validation.','Bootstrap resamples twelve stipulated board families and is descriptive only.','This fixture and policy use no actual opponent hidden cards in the observation.','All outcomes retained; a positive average alone does not certify general accuracy or change acceptance status.'],rows,situations};
 writeFileSync(resolve(output,'F10-heldout.json.gz'),gzipSync(JSON.stringify(result,null,2)));expect(legalCount).toBe(49152);expect(situations).toHaveLength(192);expect(rows).toHaveLength(576);expect(Number.isFinite(mean(rows))).toBe(true);
},240000);
