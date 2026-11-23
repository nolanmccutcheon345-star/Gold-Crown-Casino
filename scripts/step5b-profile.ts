import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpus} from 'node:os';
import {applyCommand,projectView,startHand,observeBot} from '../src/core/engine';
import {rig} from '../tests/verification/helpers';
import {appendMoney,validateData,seal,GENESIS,checkChain,digest} from '../src/storage/integrity';
import {SessionController,DEFAULT_SETTINGS} from '../src/session/controller';
import {deriveCashStats} from '../src/stats/cash';
import {withPublicContext} from '../src/session/bot-observation';
import {chooseDecision} from '../src/bots/policy';
import type {AppData,PersistencePort,StoredHand} from '../src/session/types';
import type {sessionBlock} from '../tests/step5a-release/population';
import * as frozenRuntime from '../tests/browser/step5b-baseline.js';
import {observeTimings,type TimingSample} from '../src/performance/timing';
const frozen=frozenRuntime as unknown as {SessionController:typeof SessionController;DEFAULT_SETTINGS:typeof DEFAULT_SETTINGS},paired=process.env.PROFILE_PAIRED==='1';
const phase=process.env.PROFILE_PHASE??'baseline',max=Number(process.env.PROFILE_MAX??5000),output=`tests/step5b-performance/evidence/${phase}`;mkdirSync(output,{recursive:true});
const corpusPath='tests/step5a-release/evidence/candidate-1.3/sessions.json.gz';
const blocks=JSON.parse(gunzipSync(readFileSync(corpusPath)).toString()) as ReturnType<typeof sessionBlock>[];
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started=new Date().toISOString();
const sourceFiles=Object.fromEntries(['scripts/step5b-profile.ts','src/session/controller.ts','src/storage/integrity.ts','src/storage/browser.ts','src/session/bot-observation.ts','src/stats/cash.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const at='2026-11-01T00:00:00.000Z';
// Replays genuine full public action sequences from the frozen Step5A corpus, never shortened frames.
const templates:StoredHand[]=[];
for(const h of blocks.filter(b=>b.configuration==='tough-six-max').slice(0,1).flatMap(b=>b.hands)){
 const holes=h.initial.map(s=>s.cards),reserved=[...holes.flat(),...h.board],fill=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.includes(c));
 let g=rig(startHand({handId:h.handId,button:h.button,profile:h.profile,seats:h.initial.map(s=>({id:s.id,name:`Stable ${s.id}`,stack:s.stack}))}),holes,[...h.board,...fill].slice(0,5));
 const frames=[projectView(g,0)];for(const e of h.events.filter(e=>e.type==='action')){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:e.seatId!,decisionId:e.decisionId!,action:e.action!});frames.push(projectView(g,0));}
 if(g.street!=='complete'||JSON.stringify(g.payouts)!==JSON.stringify(h.payouts))throw Error('Corpus replay differs');
 templates.push({id:h.handId,sessionId:'',epoch:0,number:1,startedAt:at,endedAt:at,view:projectView(g,0),frames,net:g.seats[0].stack-g.seats[0].startingStack,privateProfiles:Object.fromEntries(h.profiles.slice(1).map((p,i)=>[i+1,p])),previousHash:GENESIS,hash:''});
}
if(process.env.PROFILE_TEMPLATES){writeFileSync('tests/step5b-performance/profile-templates.json',JSON.stringify(templates));process.exit(0);}
const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1e12,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
await appendMoney(data,{id:'profile-initial',at,epoch:0,kind:'adjustment',walletDelta:1e12,tableDelta:0,pokerNet:0,note:'Isolated profiling corpus'});
// Reference port deliberately does no serialization. This isolates actual controller preparation,
// while serialization/digest/clone and browser IndexedDB are separately measured, never conflated.
class Port implements PersistencePort { constructor(public data:AppData){} async load(){return this.data;} async commit(rev:number|null,next:AppData){if(rev!==this.data.revision)throw Error('stale');this.data=next;}close(){} }
const quantiles=(x:number[])=>{const a=x.slice().sort((a,b)=>a-b),q=(p:number)=>a[Math.max(0,Math.ceil(p*a.length)-1)];return {samples:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)};};
async function measure(work:()=>unknown|Promise<unknown>,count:number){const out=[];for(let i=0;i<count;i++){const t=performance.now();await work();out.push(performance.now()-t);}return quantiles(out);}
const measurements:unknown[]=[], save=()=>writeFileSync(`${output}/latencies.json`,JSON.stringify({phase,paired,started,finished:new Date().toISOString(),sourceCommit,sourceFiles,environment:{node:process.version,cpu:cpus()[0]?.model,logicalCPUs:cpus().length,device:'Node container; no browser/device emulation'},methodology:'Wall-clock performance.now; nearest-rank quantiles; no intentional think time. Matched frozen 25-hand six-max corpus repeated with unique identities and independent funding/cashouts; canonical full action frames retained. 2/6/10 are current table seats. Reference CAS port retains snapshot without serialization; separately reports full persistence payload costs. Small sample tails are observed maxima, not population estimates. CPU profile samples actual production code plus setup; inspect function self time. Large-history sample counts capped explicitly. Paired mode creates one exact active snapshot using frozen9d937a3 policy1.3 then measures both runtimes on identical snapshot SHA256; each fresh private draw remains naturally stochastic. Earlier separate-phase runs matched corpus/table sizes but did not fix the active random deal. Shared reference host may contain other work; no dedicated/physical device claim.',measurements},null,2));
for(let n=0;n<=max;n++){
 if([0,100,500,1000,5000].includes(n)){
  await validateData(data);const samples=n<=100?20:n<=500?5:n<=1000?3:1;
  const row={hands:n,frames:data.hands.reduce((n,h)=>n+h.frames.length,0),bytes:Buffer.byteLength(JSON.stringify(data)),snapshotSHA256:await digest(data),fullAudit:await measure(()=>validateData(data),Math.min(samples,3)),handHashes:await measure(()=>checkChain(data.hands),1),clone:await measure(()=>structuredClone(data),1),serialize:await measure(()=>JSON.stringify(data),1),snapshotHash:await measure(()=>digest(data),1),stats:await measure(()=>deriveCashStats(data.hands,data.sessions),Math.min(samples,3)),tables:[] as unknown[]};
  for(const seats of [2,6,10]){
   const FixtureController=paired?frozen.SessionController:SessionController,c=new FixtureController(new Port(structuredClone(data)));await c.init();await c.startSession({...frozen.DEFAULT_SETTINGS,seats,buyIn:100000});
   if(c.error)throw Error(c.error);
   // Heads-up initial actor is Hero; take a legal call to reach a bot turn.
   if(c.data!.active!.game.actor===0){const a=c.data!.active!;await c.act({type:'call'},a.game.handId,a.game.revision);}
   const before=c.data!,segments:TimingSample[]=[],preparations:Record<string,ReturnType<typeof quantiles>>={};c.close();
   for(const runtime of paired?['baseline','candidate']:['candidate']){
    const Controller=runtime==='baseline'?frozen.SessionController:SessionController,times:number[]=[];
    for(let sample=0;sample<samples;sample++){
     const run=new Controller(new Port(before));await run.init();observeTimings(s=>segments.push(s));const start=performance.now();await run.prepareBot();times.push(performance.now()-start);observeTimings(null);if(run.error)throw Error(run.error);run.close();
    }
    preparations[runtime]=quantiles(times);
   }
   const a=before.active!,p=a.profiles[a.game.actor!],o=observeBot(a.game,a.game.actor!,p.policyVersion,'profile');const context=withPublicContext(o,a.game.profile.rake,p,before.hands,a.sessionId);
   row.tables.push({seats,activeSnapshotSHA256:await digest(before),prepare:preparations.candidate,...(paired?{baselinePrepare:preparations.baseline}:{}),publicMemory:await measure(()=>withPublicContext(o,a.game.profile.rake,p,before.hands,a.sessionId),samples),policy:await measure(()=>chooseDecision(context,p,()=>.37),samples),segments:Object.fromEntries([...new Set(segments.map(s=>s.name))].map(name=>[name,quantiles(segments.filter(s=>s.name===name).map(s=>s.milliseconds))]))});
  }
  measurements.push(row);save();process.stdout.write(JSON.stringify(row)+'\n');
 }
 if(n===max)break;
 const template=templates[n%templates.length],handId=`profile-hand-${n}`,sid=`profile-session-${n}`;
 const row=JSON.parse(JSON.stringify(template).replaceAll(template.id,handId)) as StoredHand;row.id=handId;row.sessionId=sid;row.previousHash=data.hands.at(-1)?.hash??GENESIS;
 const hero=row.view.seats[0];data.hands.push(await seal(row));data.sessions.push({id:sid,epoch:0,startedAt:at,endedAt:at,settings:{...DEFAULT_SETTINGS,seats:6,buyIn:hero.startingStack},profile:row.view.profile,buyIns:hero.startingStack,cashOut:hero.stack,activeMs:10000,lastActiveAt:null,handIds:[handId]});
 await appendMoney(data,{id:`buy-in:${sid}`,kind:'buy-in',at,epoch:0,walletDelta:-hero.startingStack,tableDelta:hero.startingStack,pokerNet:0,sessionId:sid,note:'Corpus funding'});
 await appendMoney(data,{id:`settle:${handId}`,kind:'hand-net',at,epoch:0,walletDelta:0,tableDelta:row.net,pokerNet:row.net,sessionId:sid,handId,note:'Corpus settlement'});
 await appendMoney(data,{id:`cash-out:${sid}`,kind:'cash-out',at,epoch:0,walletDelta:hero.stack,tableDelta:-hero.stack,pokerNet:0,sessionId:sid,note:'Corpus cashout'});
}
