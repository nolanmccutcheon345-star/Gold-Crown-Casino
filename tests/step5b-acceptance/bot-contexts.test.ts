import {describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Archetype,Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {scenarios,seededRandom} from '../step4a/scenarios';
import {act,hand,rig} from '../verification/helpers';
function view(g:GameState,p:ReturnType<typeof createProfile>){const o=observeBot(g,g.actor!,p.policyVersion,`context:${g.handId}:${g.revision}`);o.rake=g.profile.rake;return o;}
function write(name:string,value:unknown){const out=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,name),JSON.stringify(value,null,2));}
function setup(id:string,own:Card[],board:Card[],stack=20000){const g=rig(hand([stack,stack]),[own,['Ac','Ad']],board);g.handId=id;g.events=g.events.map(e=>({...e,handId:id}));return g;}
function legalSamples(g:GameState,p:ReturnType<typeof createProfile>,n=128,seed=0x55d012){const o=view(g,p),count={fold:0,check:0,call:0,raise:0},sizes:number[]=[];const seen=new Set<string>();for(let i=0;i<n;i++){const d=chooseDecision(o,p,seededRandom(seed+i));count[d.action.type]++;if(d.action.type==='raise')sizes.push(d.action.to);const key=JSON.stringify(d.action);if(!seen.has(key)){seen.add(key);assertAccounting(applyCommand(g,d));}}return{opportunities:n,count,sizes};}
type Distribution=Record<'fold'|'check'|'call'|'raise',number>;
const distance=(a:Distribution,b:Distribution)=>(['fold','check','call','raise'] as const).reduce((n,k)=>n+Math.abs(a[k]-b[k]),0);

describe('Remaining conditional bot acceptance on actual legal public histories',()=>{
 it.each(['station','tag'] as Archetype[])('F14/R02/Y02: two stable %s identities retain broad phenotype and repeatable action/size differences',archetype=>{
  const selected=scenarios().filter(s=>['early-jto','button-jto','unopened-97s','limped-97s','open-kjs','threebet-kjs','flop-marginal-cheap','flop-marginal-overbet','flop-flushdraw','heads-up-air','river-marginal-halfpot','turn-delayed-cbet'].includes(s.id));
  const profiles=[createProfile({selection:archetype},70119,'neutral'),createProfile({selection:archetype},99117,'neutral')],contrast=createProfile({selection:archetype==='station'?'nit':'station'},70119,'neutral');
  const saved=JSON.stringify(profiles);let within=0,between=0,different=0;const rows=[];
  for(const s of selected){
   const a=analyzeDecision(view(s.state,profiles[0]),profiles[0]),b=analyzeDecision(view(s.state,profiles[1]),profiles[1]),other=analyzeDecision(view(s.state,contrast),contrast);
   within+=distance(a.distribution,b.distribution);between+=distance(a.distribution,other.distribution);different+=Number(JSON.stringify(a.distribution)!==JSON.stringify(b.distribution)||JSON.stringify(a.sizing)!==JSON.stringify(b.sizing));
   const batches=profiles.map(p=>[legalSamples(s.state,p,128,0x3b1011),legalSamples(s.state,p,128,0x6a9123)]);
   for(let i=0;i<2;i++)expect(legalSamples(s.state,JSON.parse(JSON.stringify(profiles[i])),128,0x3b1011)).toEqual(batches[i][0]);
   rows.push({scenario:s.id,expectedDistributions:[a.distribution,b.distribution],sizing:[a.sizing,b.sizing],batches});
  }
  expect(different).toBeGreaterThan(0);expect(within).toBeLessThan(between);expect(JSON.stringify(profiles)).toBe(saved);expect(createProfile({selection:archetype},70119,'neutral')).toEqual(profiles[0]);
  write(`personality-${archetype}.json`,{claim:'Synthetic within-archetype heterogeneity; not human-calibrated frequencies',profiles,scenarioCount:selected.length,independentBatches:2,opportunitiesPerIdentityPerContextPerBatch:128,repeatSameSeedChecks:'exact actions/sizes after JSON recovery',differentContexts:different,totalDistributionL1Within:within,totalDistributionL1Contrast:between,rows});
 });
 it('F16: turn flush completion changes range-conditioned action and sizing weights after the same legal flop line',()=>{
  const states=[['3h','flush'],['3s','dry']].map(([turn,label])=>{let g=setup(`turn-${label}`,['Kd','Qc'],['Kh','7h','2c',turn,'9d']);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});g=act(g,{type:'check'});g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});g=act(g,{type:'check'});expect(g.street).toBe('turn');expect(g.actor).toBe(0);return g;});
  const p=createProfile({selection:'stronger-reg'},0x5bc019,'neutral'),analyses=states.map(g=>analyzeDecision(view(g,p),p));
  expect(analyses[0].postflop!.runout.flushCompletion).toBe(true);expect(analyses[1].postflop!.runout.flushCompletion).toBe(false);expect(analyses[0].distribution).not.toEqual(analyses[1].distribution);expect(analyses[0].sizing).not.toEqual(analyses[1].sizing);
  write('turn-board-development.json',{profiles:p,rows:states.map((g,i)=>({board:g.board,publicEvents:g.events,analysis:analyses[i],sample:legalSamples(g,p)}))});
 });
 it('F17: shallow/deep nut draws retain price but alter implied odds, SPR and legal jam sizes',()=>{
  const states=[4000,40000].map(stack=>{let g=setup(`draw-depth-${stack}`,['Ah','3h'],['Qh','7h','2c','8d','Ks'],stack);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});g=act(g,{type:'raise',to:1000});return g;});
  const p=createProfile({selection:'tag'},71716,'neutral'),a=states.map(g=>analyzeDecision(view(g,p),p));
  expect(a[0].context.price).toBe(a[1].context.price);expect(a[0].features.drawClass).toBe(a[1].features.drawClass);expect(a[1].context.spr).toBeGreaterThan(a[0].context.spr);expect(a[1].postflop!.impliedOdds).toBeGreaterThan(a[0].postflop!.impliedOdds);expect(a[0].distribution).not.toEqual(a[1].distribution);expect(a[0].sizing).not.toEqual(a[1].sizing);
  write('draw-stack-depth.json',{profile:p,rows:states.map((g,i)=>({stack:g.seats[0].startingStack,board:g.board,publicEvents:g.events,analysis:a[i],sample:legalSamples(g,p)}))});
 });
 it('F19: same private cards and board use different range updates and SPR after limped versus three-bet preflop history',()=>{
  const states=[false,true].map(threeBet=>{let g=setup(`prior-line-${threeBet}`,['Kh','Js'],['Qh','7s','2c','8d','3h']);if(threeBet){g=act(g,{type:'raise',to:600});g=act(g,{type:'raise',to:1800});g=act(g,{type:'call'});}else{g=act(g,{type:'call'});g=act(g,{type:'check'});}g=act(g,{type:'check'});expect(g.street).toBe('flop');expect(g.actor).toBe(0);return g;});
  const p=createProfile({selection:'stronger-reg'},6117,'neutral'),a=states.map(g=>analyzeDecision(view(g,p),p));expect(a[0].context.spr).toBeGreaterThan(a[1].context.spr);expect(a[0].ranges!.opponents[0].updates).not.toEqual(a[1].ranges!.opponents[0].updates);expect(a[0].distribution).not.toEqual(a[1].distribution);
  write('prior-line-ranges.json',{profile:p,rows:states.map((g,i)=>({ownCards:g.seats[0].hole,board:g.board,publicEvents:g.events,analysis:a[i],sample:legalSamples(g,p)}))});
 });
});
