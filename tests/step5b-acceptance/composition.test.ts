import {describe,it,expect} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {Archetype,PublicMemoryHand} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,buildOpponentMemory,chooseDecision,createProfile} from '../../src/bots/policy';
import {HandAudit,DEFINITIONS,clusteredRate,reconcile,rng,type Counters} from '../step4c/audit';
import {makeGame} from '../step4c/population';
import {probeAction,type Probe} from '../step4c/probes';
import {rig} from '../verification/helpers';
const mixes:Record<string,Archetype[]>={loosePassive:['station','station','passive-reg','fit-or-fold'],tight:['nit','tag','nit','tag'],aggressive:['lag','maniac','lag','maniac']};
const policies:Probe[]=['never-fold','stack-pressure'];
const full=process.env.STEP5B_COMPOSITION_FULL==='1',blocks=full?8:2,handsPerBlock=full?20:2;
const dir=()=>{const d=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(d,{recursive:true});return d;};
const save=(name:string,value:unknown,zip=false)=>writeFileSync(resolve(dir(),name),zip?gzipSync(JSON.stringify(value)):JSON.stringify(value,null,2)+'\n');
const add=(to:Counters,from:Counters)=>{for(const [key,v]of Object.entries(from)){to[key]??={count:0,opportunities:0};to[key].count+=v.count;to[key].opportunities+=v.opportunities;}};
const fixed=createProfile({selection:'stronger-reg'},0x5418af,'neutral');
describe('V418 fixed strong profile across table composition and independent Hero policy',()=>{
 it('completes matched controlled hands and reports actual conditional deltas without action quotas',async()=>{
  const started=Date.now(),results:{mix:string;hero:Probe;block:number;rake:boolean;hands:number;netBB:number;metrics:Counters;segments:Record<string,Counters>;sizing:HandAudit['sizing'];records:unknown[]}[]=[],source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();let decisionCount=0;
  for(const [mix,styles]of Object.entries(mixes))for(const hero of policies)for(let block=0;block<blocks;block++){
   const profiles=[createProfile({selection:'tag'},0x541801,'neutral'),fixed,...styles.map((selection,i)=>createProfile({selection},0x541820+i,'neutral'))],frozen=JSON.stringify(profiles),history:PublicMemoryHand[]=[],metrics:Counters={},segments:Record<string,Counters>={},records=[],sizing=[];let netBB=0;
   for(let h=0;h<handsPerBlock;h++){
    const seed=0x54180000+block*1000+h,id=`composition:${mix}:${hero}:${block}:${h}`;let g=makeGame(id,6,seed,100,block%2===1,h%6,h%5===4?3:null),steps=0;const audit=new HandAudit(g.seats.map(s=>s.id)),initial=g.seats.map(s=>({id:s.id,cards:s.hole,stack:s.stack}));
    while(g.street!=='complete'){
     expect(steps++).toBeLessThan(300);const actor=g.actor!,profile=profiles[actor],o=observeBot(g,actor,profile.policyVersion,`${id}:${g.revision}`);o.rake=g.profile.rake;o.memory=buildOpponentMemory(history,actor,profile.traits?.memoryRetention??.5);
     const decision=actor===0?{handId:g.handId,revision:g.revision,seatId:actor,decisionId:o.decisionId,action:probeAction(hero,o)}:chooseDecision(o,profile,rng(seed^Math.imul(actor+1,0x71e142bd)^Math.imul(g.revision+1,0x9e3779b9)));
     audit.record(g,decision.action);g=applyCommand(g,decision);audit.after(g);assertAccounting(g);decisionCount++;
    }
    const financial=reconcile(g),counters=audit.finish(g);add(metrics,counters.get(1)!);for(const s of audit.segments.filter(s=>s.seat===1)){const key=`${s.street}|${s.node}|${s.texture}|${s.players>2?'multiway':'heads-up'}`;segments[key]??={};add(segments[key],{[s.metric]:{count:s.count,opportunities:s.opportunities}});}sizing.push(...audit.sizing.filter(s=>s.seat===1));
    netBB+=(g.seats[1].stack-g.seats[1].startingStack)/g.profile.bigBlind;records.push({seed,button:g.button,initial,board:g.board,events:g.events,pots:g.pots,payouts:g.payouts,ending:g.seats.map(s=>({id:s.id,stack:s.stack})),financial});history.push({handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events});if(history.length>100)history.shift();expect(JSON.stringify(profiles)).toBe(frozen);
   }
   results.push({mix,hero,block,rake:block%2===1,hands:records.length,netBB,metrics,segments,sizing,records});await new Promise<void>(resolve=>setImmediate(resolve));
  }
  const summaries=Object.keys(mixes).flatMap(mix=>policies.map(hero=>{const group=results.filter(r=>r.mix===mix&&r.hero===hero),keys=[...new Set(group.flatMap(r=>Object.keys(r.metrics)))],nodes=[...new Set(group.flatMap(r=>Object.keys(r.segments)))];return{mix,hero,hands:group.reduce((n,r)=>n+r.hands,0),blocks:group.length,netBB:group.reduce((n,r)=>n+r.netBB,0),rates:Object.fromEntries(keys.map(k=>[k,clusteredRate(group.map(r=>r.metrics[k]??{count:0,opportunities:0}))])),conditional:Object.fromEntries(nodes.map(n=>{const ks=[...new Set(group.flatMap(r=>Object.keys(r.segments[n]??{})))];return[n,Object.fromEntries(ks.map(k=>[k,clusteredRate(group.map(r=>r.segments[n]?.[k]??{count:0,opportunities:0}))]))];})),sizing:group.flatMap(r=>r.sizing)};}));
  const deltas=Object.keys(mixes).map(mix=>{const a=summaries.find(s=>s.mix===mix&&s.hero===policies[0])!,b=summaries.find(s=>s.mix===mix&&s.hero===policies[1])!;const keys=[...new Set([...Object.keys(a.conditional),...Object.keys(b.conditional)])];return{mix,comparison:`${policies[1]} minus ${policies[0]}`,nodes:keys.map(node=>({node,rates:Object.fromEntries([...new Set([...Object.keys(a.conditional[node]??{}),...Object.keys(b.conditional[node]??{})])].map(metric=>{const x=a.conditional[node]?.[metric],y=b.conditional[node]?.[metric];return[metric,{first:x??null,second:y??null,observedDelta:x?.opportunities&&y?.opportunities?y.count/y.opportunities-x.count/x.opportunities:null}];}))}))};});
  const summary={sourceCommit:source,runtime:fixed.policyVersion,node:process.version,at:new Date().toISOString(),full,completedHands:results.reduce((n,r)=>n+r.hands,0),decisions:decisionCount,elapsedMs:Date.now()-started,focusProfile:fixed,modelCardHash:createHash('sha256').update(readFileSync('src/bots/MODEL_CARDS.md')).digest('hex'),opportunityDefinitions:DEFINITIONS,summaries,deltas,limitations:'Synthetic controlled trials; starting stacks reset each hand. Different reached nodes are observational conditional deltas, not causal utility estimates. Eight block intervals remain broad; sparse nodes insufficient. No human calibration, no independent-strategy-optimality gold standard and no real-profit claim.'};
  expect(summary.completedHands).toBe(3*2*blocks*handsPerBlock);expect(summaries.every(s=>s.hands===blocks*handsPerBlock)).toBe(true);save('composition-blocks.json.gz',results,true);save('composition-summary.json',summary);
 },300000);
 it('rejects a hand-insensitive preflop quota in matched premium and trash nodes',()=>{
  const profiles=Object.keys(mixes).flatMap(mix=>policies.map(hero=>({mix,hero}))),rows=[];
  for(const cell of profiles){
   const own=[['As','Ah'],['7c','2d']],analyses=own.map(cards=>{const seeded=makeGame(`quota:${cell.mix}:${cell.hero}:${cards.join('')}`,6,0x5418,100,false,0);const other=[['Qc','Jd'],['4s','5s'],['6h','8h'],['9c','Tc'],['Kd','Qd']];let n=0;const state=rig(seeded,seeded.seats.map(s=>s.id===seeded.actor?cards:other[n++]),['3h','8d','Ts','6c','9h']);return analyzeDecision(observeBot(state,state.actor!,fixed.policyVersion,'quota'),fixed).distribution;});
   expect(analyses[0].raise).toBeGreaterThan(analyses[1].raise+.2);expect(analyses[0].fold).toBeLessThan(analyses[1].fold);rows.push({...cell,own,distributions:analyses});
  }
  save('composition-quota-guard.json',{profile:fixed,rows,scope:'Matched legal state/hand-dependence check, not frequency target or empirical range validation'});
 });
});
