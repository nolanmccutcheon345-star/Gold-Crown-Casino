import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import type {Action,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand,ENGINE_VERSION} from '../../src/core/engine';
import {chooseDecision,createProfile,POLICY_VERSION,analyzeDecision} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import {combos,compare,seven,utility,RANGE_WEIGHTS,type RangeName} from './river-reference';
interface RiverIdentity {identity:number;meanUtilityCents:number;actions:Record<string,number>;}
interface RiverRow {fixture:string;facing:boolean;range:RangeName;ownRank:number[];bestCents:number;actions:{action:Action;utilityCents:number|undefined}[];perArchetype:{archetype:string;opportunities:number;identities:RiverIdentity[];meanUtilityCents:number;regretCents:number}[];differenceStrongMinusWeakCents:number;}
const fixtures=[
 {id:'third-flush',board:['Ah','Kh','8h','4h','2s'],own:['Qh','Qc']},
 {id:'aces-four-flush',board:['Ah','Kh','8h','4h','2s'],own:['As','Ad']},
 {id:'king-straight',board:['9c','Td','Jh','Qs','2c'],own:['Kh','Kd']},
 {id:'trips-flush-board',board:['Qh','Qd','7h','3h','2s'],own:['Qc','Jc']},
 {id:'aces-paired-board',board:['Kc','Ks','9d','5h','2s'],own:['Ac','Ad']},
 {id:'full-house',board:['Qh','Qd','7h','3h','2s'],own:['Qc','7c']},
 {id:'low-flush',board:['Ah','Kh','8h','4h','2s'],own:['6h','6c']},
 {id:'set-four-straight',board:['9c','Td','Jh','Qs','2c'],own:['Qc','Qd']},
];
function apply(g:GameState,action:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`prefix:${g.revision}`,action});}
function state(f:typeof fixtures[number],facing:boolean){const known=new Set([...f.board,...f.own]),other=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!known.has(c)).slice(0,2);let g=rig(startHand({handId:`F10:${f.id}:${facing}`,button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`Seat ${id}`,stack:30000}))}),[f.own,other],f.board);g=apply(g,{type:'raise',to:1000});g=apply(g,{type:'call'});while(g.street!=='river')g=apply(g,{type:'check'});g=apply(g,facing?{type:'raise',to:3000}:{type:'check'});expect(g.actor).toBe(0);return g;}
function output(){const path=resolve(process.env.STEP5C_GATE_EVIDENCE_DIR??'tests/step5c-gates/evidence');mkdirSync(path,{recursive:true});return path;}
it('independent river evaluator validates all hand classes and ties without production evaluator imports',()=>{
 const hands=[['As','Kd','9c','7h','2s'],['As','Ad','9c','7h','2s'],['As','Ad','9c','9h','2s'],['As','Ad','Ac','7h','2s'],['9s','8d','7c','6h','5s'],['As','Js','9s','7s','2s'],['As','Ad','Ac','7h','7s'],['As','Ad','Ac','Ah','2s'],['As','Ks','Qs','Js','Ts']];hands.forEach((h,i)=>expect(seven(h)[0]).toBe(i));expect(compare(seven(['As','2d','3c','4h','5s']),seven(['2s','3d','4c','5h','6s']))).toBe(-1);expect(compare(seven(['As','Ks','Qs','Js','Ts','2c','3d']),seven(['As','Ks','Qs','Js','Ts','4c','5d']))).toBe(0);
});
it('F10 evaluates predeclared dangerous-river size and line choices against independent conditional response models',()=>{
 const started=Date.now(),rows:RiverRow[]=[],games=[],profileRows=[];let legalDecisions=0;
 for(const f of fixtures)for(const facing of [false,true]){
  const g=state(f,facing),o0=observeBot(g,0,POLICY_VERSION,`${g.handId}:probe`),combinations=combos(f.board,f.own);expect(combinations).toHaveLength(990);const legal=legalActions(g),candidate=new Map<string,Action>();
  const add=(a:Action)=>candidate.set(JSON.stringify(a),a);if(legal.check)add({type:'check'});if(legal.fold)add({type:'fold'});if(legal.callAmount)add({type:'call'});
  if(legal.canRaise)for(const fraction of [.25,.5,.75,1,1.5,2,3])add({type:'raise',to:Math.round(Math.max(legal.minRaiseTo!,Math.min(legal.maxRaiseTo!,legal.callAmount+(g.pot+legal.callAmount)*fraction)))});if(legal.canRaise){add({type:'raise',to:legal.minRaiseTo!});add({type:'raise',to:legal.maxRaiseTo!});}
  const samples=[];
  for(const archetype of ['stronger-reg','passive-reg'] as const)for(let identity=0;identity<4;identity++){
   const identitySeed=0x5c1000+identity*101,profile=createProfile({selection:archetype,skill:archetype==='stronger-reg'?.9:.25},identitySeed,'neutral'),o=observeBot(g,0,profile.policyVersion,`${g.handId}:${identity}`),diagnostic=analyzeDecision(o,profile);profileRows.push({fixture:f.id,facing,archetype,identitySeed,profile,analysis:diagnostic});
   const actions:Action[]=[];for(let draw=0;draw<64;draw++){const d=chooseDecision(o,profile,seededRandom(0x5c7650^draw^(identity*7919)));assertAccounting(applyCommand(g,d));actions.push(d.action);add(d.action);legalDecisions++;}samples.push({archetype,identity,actions});
  }
  for(const range of Object.keys(RANGE_WEIGHTS) as RangeName[]){const values=new Map([...candidate].map(([key,a])=>[key,utility(g,a,range,combinations)])),best=Math.max(...values.values()),perArchetype=[];
   for(const archetype of ['stronger-reg','passive-reg'] as const){const identities=samples.filter(s=>s.archetype===archetype).map(s=>({identity:s.identity,meanUtilityCents:s.actions.reduce((n,a)=>n+values.get(JSON.stringify(a))!,0)/s.actions.length,actions:s.actions.reduce((m,a)=>{const k=JSON.stringify(a);m[k]=(m[k]??0)+1;return m;},{} as Record<string,number>)}));const meanUtilityCents=identities.reduce((n,i)=>n+i.meanUtilityCents,0)/identities.length;perArchetype.push({archetype,opportunities:256,identities,meanUtilityCents,regretCents:best-meanUtilityCents});}
   rows.push({fixture:f.id,facing,range,ownRank:seven([...f.board,...f.own]),bestCents:best,actions:[...candidate].map(([key,a])=>({action:a,utilityCents:values.get(key)})),perArchetype,differenceStrongMinusWeakCents:perArchetype[0].meanUtilityCents-perArchetype[1].meanUtilityCents});
  }games.push({fixture:f,publicObservation:o0,events:g.events,legal});
 }
 const mean=rows.reduce((n,r)=>n+r.differenceStrongMinusWeakCents,0)/rows.length,byRange=Object.fromEntries(Object.keys(RANGE_WEIGHTS).map(range=>[range,rows.filter(r=>r.range===range).reduce((n,r)=>n+r.differenceStrongMinusWeakCents,0)/16]));
 const clusters=fixtures.map(f=>rows.filter(r=>r.fixture===f.id).reduce((n,r)=>n+r.differenceStrongMinusWeakCents,0)/6),bootstrap:number[]=[],bootstrapRandom=seededRandom(0x5c88cc);for(let b=0;b<2000;b++){let value=0;for(let i=0;i<clusters.length;i++)value+=clusters[Math.floor(bootstrapRandom()*clusters.length)];bootstrap.push(value/clusters.length);}bootstrap.sort((a,b)=>a-b);
 const result={format:'step5c-F10-independent-river-v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),runtime:{node:process.version,platform:process.platform,arch:process.arch},versions:{engine:ENGINE_VERSION,policy:POLICY_VERSION,rules:games[0].publicObservation.rake??'practice-no-rake'},sourceHashes:Object.fromEntries(['tests/step5c-gates/PROTOCOL.md','tests/step5c-gates/river-reference.ts','tests/step5c-gates/river.test.ts','src/bots/strategy.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),expected:'All8192 sampled decisions legal; positive average strong-minus-weak utility is a separate measured hypothesis, not forced by a test output target.',legalDecisions,elapsedMs:Date.now()-started,averageDifferenceCents:mean,averageDifferenceByRange:byRange,boardClusterMeans:clusters,boardClusterBootstrap95:[bootstrap[49],bootstrap[1949]],intervalCaveat:'Descriptive resampling of eight stipulated board/hand clusters; neither human confidence interval nor exhaustive strategy guarantee.',positiveCells:rows.filter(r=>r.differenceStrongMinusWeakCents>0).length,negativeCells:rows.filter(r=>r.differenceStrongMinusWeakCents<0).length,hypothesisStatus:mean>0?'SUPPORTED_IN_DECLARED_SYNTHETIC_MODEL':'NOT_SUPPORTED_IN_DECLARED_SYNTHETIC_MODEL',rows,games,profileRows,limitations:'Finite fixed boards and four identities, artificial opponent priors and no re-raises; no human calibration, expert review, solver optimum, complete decision EV or real-world profitability claim. Enumerated opponent combinations are possibilities, never authoritative hidden cards.'};writeFileSync(resolve(output(),'F10-river.json'),JSON.stringify(result,null,2));expect(legalDecisions).toBe(8192);expect(rows).toHaveLength(48);expect(Number.isFinite(mean)).toBe(true);
},240000);

it('independent utility uses exact future call cost, tie split and added opponent chips',()=>{
 const checked=state(fixtures[0],false),facing=state(fixtures[0],true);for(const [result,wanted]of [[1,3000],[0,1000],[-1,-1000]])expect(utility(checked,{type:'raise',to:1000},'broad',[{cards:['2c','2d'],rank:[8,14],result}])).toBe(wanted);for(const [result,wanted]of [[1,5000],[0,1000],[-1,-3000]])expect(utility(facing,{type:'call'},'broad',[{cards:['2c','2d'],rank:[8,14],result}])).toBe(wanted);expect(utility(facing,{type:'fold'},'broad',[])).toBe(0);
});
