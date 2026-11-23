import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {analyzeDecision as historicalAnalyze} from '../../src/bots/v6/strategy';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {applyCommand,assertAccounting,observeBot} from '../../src/core/engine';
import {hand,rig,act} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import type {GameState} from '../../src/contracts';
const discovery={own:['9c','7d'],board:['5h','8h','Js','2c','3d']};
const heldout=[
 {id:'gutshot',own:['9s','8d'],board:['6h','Tc','2s','Kd','4h']},
 {id:'oesd',own:['Jc','Td'],board:['9h','8s','3c','2d','Ah']},
 {id:'combo',own:['7h','6h'],board:['5h','8h','Qc','2d','Ks']},
 {id:'nut-flush-draw',own:['Ad','5d'],board:['Kd','9d','2c','3h','Qs']},
 {id:'top-pair',own:['As','Qd'],board:['Ah','7c','2d','3s','8h']},
 {id:'air',own:['9c','4d'],board:['As','Kh','7s','3c','2h']},
 {id:'private-nuts',own:['As','Ks'],board:['Qs','Js','Ts','2c','3d']},
];
function fixture(cards:{own:string[];board:string[]},players:number,depthBB:number,street:'flop'|'turn'|'river',wager:number,opponentExtra?:number):GameState{
 const focus=players===2?0:1,dead=[...cards.own,...cards.board],available=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!dead.includes(c));let n=0;const stacks=Array.from({length:players},(_,id)=>id===focus?depthBB*200:opponentExtra===undefined?100000:400+wager+opponentExtra),holes=stacks.map((_,id)=>id===focus?cards.own:available.slice(n*2,++n*2));let g=rig(hand(stacks),holes,cards.board);g=act(g,{type:'raise',to:400});while(g.street==='preflop')g=act(g,{type:'call'});while(g.street!==street)g=act(g,{type:'check'});if(players===3){g=act(g,{type:'check'});g=act(g,{type:'check'});}g=act(g,{type:'raise',to:wager});expect(g.actor).toBe(focus);return g;
}
function analyze(game:GameState,archetype:'nit'|'tag'|'station'|'stronger-reg'='stronger-reg',seed=0x8e01){const profile=createProfile({selection:archetype},seed,'neutral'),o=observeBot(game,game.actor!,profile.policyVersion,'exposure-check');return{analysis:analyzeDecision(o,profile),profile,observation:o};}
const record=(file:string,value:unknown)=>{mkdirSync('tests/step5b-exposure/evidence',{recursive:true});writeFileSync(`tests/step5b-exposure/evidence/${file}`,JSON.stringify(value,null,2));};
describe('Independent remaining-effective-exposure boundary verification',()=>{
 it('scaled reproduction one-cent call versus all-in no longer causes a large defense jump',()=>{
  const a=analyze(fixture(discovery,3,20,'flop',3599)),b=analyze(fixture(discovery,3,20,'flop',3600));expect(Math.abs(a.analysis.distribution.fold-b.analysis.distribution.fold)).toBeLessThan(.005);
 });
 it('repairs the exact recorded three-way2999→3000 discovery while preserving both eligible prices',()=>{
  const rows=[];for(const wager of [2999,3000]){let g=rig(hand([100000,4000,100000]),[['Ac','Ad'],discovery.own,['Kc','Kd']],discovery.board);g=act(g,{type:'raise',to:1000});while(g.street==='preflop')g=act(g,{type:'call'});g=act(g,{type:'check'});g=act(g,{type:'check'});g=act(g,{type:'raise',to:wager});const {analysis}=analyze(g,'stronger-reg',0x59000);rows.push({wager,analysis});}
  expect(rows[0].analysis.postflop!.contestableAfterCall).toBe(8998);expect(rows[1].analysis.postflop!.contestableAfterCall).toBe(9000);expect(rows[0].analysis.ranges!.equity).toBe(rows[1].analysis.ranges!.equity);expect(Math.abs(rows[0].analysis.distribution.fold-rows[1].analysis.distribution.fold)).toBeLessThan(.005);record('exact-discovery.json',{rows});
 });
 it('held-out cents and 5BB/20BB/100BB stack boundaries are smooth without changing legal payouts',()=>{
  const rows:unknown[]=[];let decisions=0,maxDelta=0;
  for(const cards of heldout)for(const players of [2,3])for(const depth of [5,20,100])for(const street of ['flop','turn'] as const)for(const archetype of ['tag','stronger-reg'] as const){
   const remaining=depth*200-400,games=[fixture(cards,players,depth,street,remaining-1),fixture(cards,players,depth,street,remaining),fixture(cards,players,depth,street,remaining+1)],analyses=games.map(g=>analyze(g,archetype));
   const delta=Math.abs(analyses[0].analysis.distribution.fold-analyses[1].analysis.distribution.fold);maxDelta=Math.max(maxDelta,delta);expect(delta,`${cards.id}/${players}/${depth}/${street}/${archetype}`).toBeLessThan(.005);
   expect(analyses[0].observation.legal.callAmount).toBe(remaining-1);expect(analyses[1].observation.legal.callAmount).toBe(remaining);expect(analyses[2].observation.legal.callAmount).toBe(remaining);
   for(const [index,{analysis,profile,observation}] of analyses.entries()){expect(analysis.postflop!.realization).toBeGreaterThan(.99);if(cards.id==='private-nuts')expect(analysis.distribution.fold).toBe(0);const seen=new Set<string>();for(let sample=0;sample<16;sample++){const proposal=chooseDecision(observation,profile,seededRandom(0x40000+sample));decisions++;const key=JSON.stringify(proposal.action);if(!seen.has(key)){seen.add(key);assertAccounting(applyCommand(games[index],proposal));}}}
   rows.push({fixture:cards.id,players,depth,street,archetype,delta,prices:analyses.map(a=>a.analysis.context.price),equity:analyses.map(a=>a.analysis.ranges!.equity),continuation:analyses.map(a=>1-a.analysis.distribution.fold),realization:analyses.map(a=>a.analysis.postflop!.realization)});
  }
  expect(rows).toHaveLength(168);expect(decisions).toBe(8064);record('heldout-boundaries.json',{method:'Predeclared7heldout hand/board contexts×2/3players×5/20/100BB×flop/turn×TAG/stronger-reg; each at stack cap minus1cent,cap,plus1cent;16seeded proposals/context; all distinct proposals engine/accounting checked. No empirical human or solver calibration.',pairs:rows.length,decisions,maxDelta,rows});
 },120000);
 it('retains meaningful price response away from the stack cap for draws, value and air',()=>{
  for(const cards of heldout.filter(c=>c.id!=='private-nuts')){const low=analyze(fixture(cards,2,100,'flop',200)),high=analyze(fixture(cards,2,100,'flop',2400));expect(high.analysis.context.price).toBeGreaterThan(low.analysis.context.price);expect(1-high.analysis.distribution.fold).toBeLessThan(1-low.analysis.distribution.fold);}
 });
 it('uses the opponent remaining stack as the future exposure cap',()=>{
  const p=createProfile({selection:'stronger-reg'},0x8e01,'neutral');for(const extra of [0,1,200,1000]){const g=fixture(discovery,2,100,'flop',1000,extra),o=observeBot(g,g.actor!,p.policyVersion,'opponent-cap'),a=analyzeDecision(o,p);expect(a.postflop!.remainingEffectiveExposure).toBe(extra);if(extra<=1){expect(a.postflop!.realization).toBeGreaterThan(.99);expect(a.postflop!.futureCost).toBeLessThan(.0001);}}
 }); 
 it('a player behind has to fund the current call before chips can count as future effective exposure',()=>{
  for(const extra of [0,1,200]){const g=fixture(discovery,3,100,'flop',1000,extra),a=analyze(g).analysis;expect(a.postflop!.remainingEffectiveExposure).toBe(extra);expect(a.postflop!.futureBettingClosed).toBe(extra===0);if(extra===0){expect(a.postflop!.realization).toBe(1);expect(a.postflop!.futureCost).toBe(0);}}
 });

 it('all-in and river decisions exactly preserve the frozen1.5 distributions and financial inputs',()=>{
  let cases=0;for(const cards of heldout)for(const players of [2,3])for(const street of ['flop','turn','river'] as const)for(const depth of [5,100]){const g=fixture(cards,players,depth,street,depth*200-400),{analysis,profile,observation}=analyze(g),before=historicalAnalyze({...observation,policyVersion:'synthetic-cash-1.5.0'},{...profile,policyVersion:'synthetic-cash-1.5.0'});expect(analysis.distribution).toEqual(before.distribution);expect(analysis.postflop!.rakeAdjustedPrice).toBe(before.postflop!.rakeAdjustedPrice);expect(analysis.postflop!.realizedEquity).toBe(before.postflop!.realizedEquity);expect(analysis.postflop!.drawContinue).toBe(before.postflop!.drawContinue);cases++;}expect(cases).toBe(84);
 });

});
