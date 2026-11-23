import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import {seededHand,act} from '../tests/verification/helpers';
import {observeBot} from '../src/core/engine';
import {createProfile,chooseDecision,buildOpponentMemory} from '../src/bots/policy';
import {analyzeRanges} from '../src/bots/ranges';
import {analyzeRanges as previousRanges} from '../src/bots/v4/ranges';
import {publicMemoryHands} from '../src/session/bot-observation';
import type {BotObservation} from '../src/contracts';
import type {StoredHand} from '../src/session/types';
const directory=`tests/step5b-performance/evidence/${process.env.POSTFLOP_PHASE??'postflop-policy'}`;mkdirSync(directory,{recursive:true});
const templates=JSON.parse(readFileSync('tests/step5b-performance/profile-templates.json','utf8')) as StoredHand[];
const history=Array.from({length:120},(_,i)=>{const h=templates[i%templates.length];return {...h,id:`memory-${i}`,sessionId:'public-memory-fixture',view:{...h.view,events:h.view.events.map(e=>({...e,handId:`memory-${i}`,id:`memory-${i}:${e.id}`}))}};});
const q=(a:number[])=>{a.sort((a,b)=>a-b);const n=(p:number)=>a[Math.ceil(p*a.length)-1];return{samples:a.length,p50:n(.5),p95:n(.95),p99:n(.99),max:a.at(-1)}};
const sample=(work:(i:number)=>unknown)=>{const out:number[]=[];for(let i=0;i<30;i++){const t=performance.now();work(i);out.push(performance.now()-t);}return q(out);};
const rows:unknown[]=[],profile=createProfile({selection:'stronger-reg'},314159,'high');
for(const seats of [2,6,10]){
 let game=seededHand(Array(seats).fill(20000),123456+seats);
 for(const street of ['flop','turn','river']){
  while(game.street!==street&&game.street!=='complete'){const s=game.seats.find(s=>s.id===game.actor)!;game=act(game,{type:s.streetCommitted<game.currentBet?'call':'check'});}
  if(game.street==='complete')throw Error('Unexpected terminal probe');
  const projection=()=>buildOpponentMemory(publicMemoryHands(history,'public-memory-fixture',game.actor!),game.actor!,1),memory=projection(),o={...observeBot(game,game.actor!,profile.policyVersion,'profile-postflop'),memory,rake:{...game.profile.rake}};
  const fresh=(kind:string,i:number):BotObservation=>{const id=`${seats}:${street}:${kind}:${i}`;return{...o,handId:id,decisionId:id,publicEvents:o.publicEvents.map(e=>({...e,handId:id,id:`${id}:${e.id}`}))};};
  const row={seats,street,policyVersion:profile.policyVersion,currentPublicEvents:o.publicEvents.length,memoryHands:memory.windowHands,opponentPublicActionProcessing:sample(()=>projection()),previousColdRangeUpdateAndEquity:sample(i=>previousRanges(fresh('range',i),profile)),coldRangeUpdateAndEquity:sample(i=>analyzeRanges(fresh('range',i),profile)),coldFullPolicy:sample(i=>chooseDecision(fresh('policy',i),profile,()=>.37)),warmFullPolicy:sample(()=>chooseDecision(o,profile,()=>.37))};rows.push(row);process.stdout.write(JSON.stringify(row)+'\n');
 }
}
writeFileSync(`${directory}/latencies.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(['src/bots/ranges.ts','src/bots/strategy.ts','src/bots/policy.ts','src/session/bot-observation.ts','scripts/step5b-profile-postflop.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{node:process.version,cpu:cpus()[0]?.model},methodology:'Actual production range/postflop functions; profiles are labeled by their actual runtime version in each row. PreviousColdRange invokes frozen-v4 range source, exactly the prior priced-key sampler, on the same permitted observations/profile; it does not invoke historical policy dispatch. Deterministic seeded legal engine checkdown probes on flop/turn/river,2/6/10seats. 120prior permitted public action histories from frozen mixed-hand corpus; no hidden-card inputs. 30samples each. Coldrange/fullpolicy rename public event/hand identities percall to force full analysis-cachemiss; board-shape caches remain allowed, as in an actual street. Fullpolicy andrange have distinct IDs toprevent range measurement prewarmingpolicy. Warmrepeat uses sameobservation; firstwarmcallcold included. Memoryprojection intentionallyuntrusted rawrecordinput toforce publicprojection+counterrebuild eachcall; immutable productionmemorycache measuredseparately. Nodeonly, nobrowser/network/thinktime; nearest-rankquantiles.',rows},null,2));
