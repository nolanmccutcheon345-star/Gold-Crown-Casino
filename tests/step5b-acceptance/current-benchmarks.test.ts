import {it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {Archetype,PublicMemoryHand} from '../../src/contracts';
import {applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {createProfile,chooseDecision,buildOpponentMemory} from '../../src/bots/policy';
import {makeGame} from '../step4c/population';
import {HandAudit,reconcile,rng,clusteredRate,DEFINITIONS,type Counters} from '../step4c/audit';
import {referenceAction,REFERENCE_POLICIES,REFERENCE_ASSUMPTIONS} from './reference-agents';
const cells=[{name:'hu100',seats:2,depth:100,rake:false,styles:['tag']},{name:'loose625',seats:6,depth:25,rake:true,styles:['station','station','passive-reg','fit-or-fold']},{name:'tight6200',seats:6,depth:200,rake:false,styles:['nit','tag','nit','stronger-reg']},{name:'mixed9100',seats:9,depth:100,rake:true,styles:['nit','station','tag','lag','fit-or-fold','passive-reg','maniac']},{name:'aggressive9250',seats:9,depth:250,rake:false,styles:['lag','maniac','tag','lag','stronger-reg','maniac','lag']},{name:'mixed1050',seats:10,depth:50,rake:true,styles:['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg']},{name:'paired-hu100-rake',seats:2,depth:100,rake:true,styles:['tag'],seedIndex:0},{name:'paired-tight625',seats:6,depth:25,rake:true,styles:['nit','tag','nit','stronger-reg'],seedIndex:1}] as const;
const paired=process.env.STEP5B_REFERENCE_PAIRED==='1',selectedCells=paired?cells.slice(6):cells.slice(0,6);
const full=process.env.STEP5B_REFERENCE_FULL==='1',blockCount=full?8:1,handCount=full?12:1;
const out=()=>{const p=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(p,{recursive:true});return p;};
const save=(name:string,value:unknown,zip=false)=>writeFileSync(resolve(out(),name),zip?gzipSync(JSON.stringify(value)):JSON.stringify(value,null,2)+'\n');
const add=(to:Counters,from:Counters)=>{for(const[k,v]of Object.entries(from)){to[k]??={count:0,opportunities:0};to[k].count+=v.count;to[k].opportunities+=v.opportunities;}};
function outcome(blocks:number[][]){const means=blocks.map(a=>a.reduce((n,v)=>n+v,0)/a.length),r=rng(0x5b77),samples:number[]=[];if(blocks.length>=8)for(let t=0;t<1000;t++){let n=0;for(let i=0;i<means.length;i++)n+=means[Math.floor(r()*means.length)];samples.push(n/means.length);}samples.sort((a,b)=>a-b);return{hands:blocks.reduce((n,a)=>n+a.length,0),blocks:blocks.length,meanBBPerHand:means.reduce((n,v)=>n+v,0)/means.length,blockMeans:means,blockBootstrap95:samples.length?[samples[24],samples[974]]:null,warning:'Descriptive synthetic block interval; rare heavy tails and finite clusters limit inference.'};}
it('runs frozen independent benchmark agents across matched unfamiliar rake/depth/lineup cells',async()=>{
 const started=Date.now(),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),summary=[],referenceHashes=Object.fromEntries(['tests/step5b-acceptance/reference-agents.ts','tests/step5b-acceptance/CURRENT_BENCHMARK_PROTOCOL.md','src/bots/MODEL_CARDS.md'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));let totalHands=0,totalActions=0;
 for(const[localCellIndex,cell]of selectedCells.entries())for(const reference of REFERENCE_POLICIES){const cellIndex='seedIndex' in cell?cell.seedIndex:localCellIndex,records=[],metricBlocks:Counters[]=[],segmentBlocks:Record<string,Counters>[]=[],outcomeBlocks:number[][]=[];let policyVersion='';
  for(let block=0;block<blockCount;block++){
   const profiles=Array.from({length:cell.seats},(_,seat)=>createProfile({selection:seat===1?'stronger-reg':seat===0?'tag':cell.styles[(seat-2)%cell.styles.length] as Archetype,skill:seat===1?.86:(seat+cellIndex)%2?.4:.75},0x5b77aa00+cellIndex*100+seat,'neutral'));policyVersion=profiles[1].policyVersion;const fixed=JSON.stringify(profiles),history:PublicMemoryHand[]=[],metrics:Counters={},segments:Record<string,Counters>={},nets:number[]=[];
   for(let h=0;h<handCount;h++){
    const seed=0x5b770000+cellIndex*10000+block*100+h,id=`reference:${cell.name}:${reference}:${block}:${h}`;let g=makeGame(id,cell.seats,seed,cell.depth,cell.rake,h%cell.seats,h%5===4?(h+2)%cell.seats:null),guard=0;const initial=g.seats.map(s=>({id:s.id,cards:s.hole,stack:s.stack})),audit=new HandAudit(g.seats.map(s=>s.id));
    while(g.street!=='complete'){
     expect(guard++).toBeLessThan(300);const actor=g.actor!,p=profiles[actor],o=observeBot(g,actor,p.policyVersion,`${id}:${g.revision}`);o.rake=g.profile.rake;o.memory=buildOpponentMemory(history,actor,p.traits?.memoryRetention??.5);const random=rng(seed^Math.imul(actor+1,0x71e142bd)^Math.imul(g.revision+1,0x9e3779b9));
     for(const key of ['deck','futureBoard','heroHole','privateProfiles'])Object.defineProperty(o,key,{get(){throw Error(`Forbidden reference observation ${key}`);}});
     const d=actor===0?{handId:g.handId,revision:g.revision,seatId:actor,decisionId:o.decisionId,action:referenceAction(reference,o,random)}:chooseDecision(o,p,random);audit.record(g,d.action);g=applyCommand(g,d);audit.after(g);assertAccounting(g);totalActions++;
    }
    const money=reconcile(g);add(metrics,audit.finish(g).get(1)!);for(const s of audit.segments.filter(s=>s.seat===1)){const key=`${s.street}|${s.node}|${s.texture}|${s.players>2?'multiway':'heads-up'}`;segments[key]??={};add(segments[key],{[s.metric]:{count:s.count,opportunities:s.opportunities}});}nets.push((g.seats[1].stack-g.seats[1].startingStack)/g.profile.bigBlind);records.push({seed,block,initial,button:g.button,profile:g.profile,profiles,board:g.board,events:g.events,pots:g.pots,payouts:g.payouts,final:g.seats.map(s=>({id:s.id,stack:s.stack})),money,sizing:audit.sizing.filter(s=>s.seat===1)});history.push({handId:id,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events});if(history.length>100)history.shift();expect(JSON.stringify(profiles)).toBe(fixed);totalHands++;
   }
   metricBlocks.push(metrics);segmentBlocks.push(segments);outcomeBlocks.push(nets);await new Promise<void>(resolve=>setImmediate(resolve));
  }
  const keys=[...new Set(metricBlocks.flatMap(b=>Object.keys(b)))],nodes=[...new Set(segmentBlocks.flatMap(b=>Object.keys(b)))];const row={cell,reference,policyVersion,assumption:REFERENCE_ASSUMPTIONS[reference],outcome:outcome(outcomeBlocks),rates:Object.fromEntries(keys.map(k=>[k,clusteredRate(metricBlocks.map(b=>b[k]??{count:0,opportunities:0}))])),conditional:Object.fromEntries(nodes.map(n=>{const keys=[...new Set(segmentBlocks.flatMap(b=>Object.keys(b[n]??{})))];return[n,Object.fromEntries(keys.map(k=>[k,clusteredRate(segmentBlocks.map(b=>b[n]?.[k]??{count:0,opportunities:0}))]))];})),rawArtifact:`${cell.name}-${reference}.json.gz`};summary.push(row);save(row.rawArtifact,records,true);
 }
 expect(totalHands).toBe(selectedCells.length*7*blockCount*handCount);save('current-benchmark-summary.json',{sourceCommit:source,at:new Date().toISOString(),node:process.version,full,paired,totalHands,totalActions,elapsedMs:Date.now()-started,referenceHashes,opportunityDefinitions:DEFINITIONS,summary,limitations:'Independent frozen heuristics, not strategically optimal references; no human or solver calibration. Controlled hand resets, not ecology churn. Same seed/button cards matched across agent cells; reached histories differ. Losses retained; no model tuned on this cohort.'});
},600000);
