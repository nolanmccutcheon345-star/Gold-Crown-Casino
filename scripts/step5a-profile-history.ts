import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpus} from 'node:os';
import {applyCommand,projectView,startHand} from '../src/core/engine';
import {rig} from '../tests/verification/helpers';
import {appendMoney,validateData,seal,GENESIS,checkChain,digest,publicHistory} from '../src/storage/integrity';
import {SessionController,DEFAULT_SETTINGS} from '../src/session/controller';
import {deriveCashStats} from '../src/stats/cash';
import type {AppData,PersistencePort,StoredHand} from '../src/session/types';
import type {sessionBlock} from '../tests/step5a-release/population';
const corpusPath='tests/step5a-release/evidence/candidate-1.3/sessions.json.gz';
const blocks=JSON.parse(gunzipSync(readFileSync(corpusPath)).toString()) as ReturnType<typeof sessionBlock>[];
const started=new Date().toISOString(),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const shaFile=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceFiles=Object.fromEntries(['scripts/step5a-profile-history.ts','src/session/controller.ts','src/storage/integrity.ts','src/storage/browser.ts','src/stats/cash.ts'].map(path=>[path,shaFile(path)]));
const records=blocks.filter(b=>b.configuration==='nine-handed').slice(0,4).flatMap(b=>b.hands);
const at='2026-11-01T00:00:00.000Z';
const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:10000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};
await appendMoney(data,{id:'profile-initial',at,epoch:0,kind:'adjustment',walletDelta:10000000,tableDelta:0,pokerNet:0,note:'Isolated profiling corpus'});
class Port implements PersistencePort{constructor(public data:AppData){} async load(){return structuredClone(this.data);} async commit(rev:number|null,next:AppData){if(rev!==this.data.revision)throw Error('stale');this.data=structuredClone(next);}close(){}}
async function measured(work:()=>unknown|Promise<unknown>,samples=5){const times:number[]=[];for(let i=0;i<samples;i++){const t=performance.now();await work();times.push(performance.now()-t);}times.sort((a,b)=>a-b);return{samples,medianMs:times[Math.floor(times.length/2)],minMs:times[0],maxMs:times.at(-1)};}
const measurements:unknown[]=[];
for(const h of records){
 const holes=h.initial.map(s=>s.cards),reserved=[...holes.flat(),...h.board],fill=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.includes(c));
 let g=rig(startHand({handId:h.handId,button:h.button,profile:h.profile,seats:h.initial.map(s=>({id:s.id,name:`Stable ${s.id}`,stack:s.stack}))}),holes,[...h.board,...fill].slice(0,5));
 const frames=[projectView(g,0)];for(const e of h.events.filter(e=>e.type==='action')){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:e.seatId!,decisionId:e.decisionId!,action:e.action!});frames.push(projectView(g,0));}
 const hero=g.seats.find(s=>s.id===0)!,sid=`profile:${h.handId}`,net=hero.stack-hero.startingStack;
 if(g.street!=='complete'||JSON.stringify(g.payouts)!==JSON.stringify(h.payouts))throw Error('Corpus replay differs');
 const row:StoredHand={id:h.handId,sessionId:sid,epoch:0,number:1,startedAt:at,endedAt:at,view:projectView(g,0),frames,net,privateProfiles:Object.fromEntries(h.profiles.slice(1).map((p,i)=>[i+1,p])),previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};
 data.hands.push(await seal(row));data.sessions.push({id:sid,epoch:0,startedAt:at,endedAt:at,settings:{...DEFAULT_SETTINGS,seats:9,buyIn:hero.startingStack},profile:h.profile,buyIns:hero.startingStack,cashOut:hero.stack,activeMs:10000,lastActiveAt:null,handIds:[h.handId]});
 await appendMoney(data,{id:`buy-in:${sid}`,kind:'buy-in',at,epoch:0,walletDelta:-hero.startingStack,tableDelta:hero.startingStack,pokerNet:0,sessionId:sid,note:'Independent corpus hand funding'});
 await appendMoney(data,{id:`settle:${h.handId}`,kind:'hand-net',at,epoch:0,walletDelta:0,tableDelta:net,pokerNet:net,sessionId:sid,handId:h.handId,note:'Replayed actual hand'});
 await appendMoney(data,{id:`cash-out:${sid}`,kind:'cash-out',at,epoch:0,walletDelta:hero.stack,tableDelta:-hero.stack,pokerNet:0,sessionId:sid,note:'Independent corpus hand cashout'});
 if(![10,25,50,75,100].includes(data.hands.length))continue;
 await validateData(data);
 const n=data.hands.length,rows={hands:n,frames:data.hands.reduce((n,h)=>n+h.frames.length,0),serializedBytes:Buffer.byteLength(JSON.stringify(data)),snapshotSHA256:await digest(data),validated:true,validateData:await measured(()=>validateData(data)),hashAllHands:await measured(()=>checkChain(data.hands)),structuredClone:await measured(()=>structuredClone(data)),fullSnapshotHash:await measured(()=>digest(data)),exportAllHands:await measured(()=>publicHistory(data.hands)),deriveStats:await measured(()=>deriveCashStats(data.hands,data.sessions)),prepareBot:null as unknown};
 const times:number[]=[];for(let sample=0;sample<3;sample++){
  const c=new SessionController(new Port(structuredClone(data)));await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9,buyIn:100000});if(c.error)throw Error(c.error);
  const started=performance.now();await c.prepareBot();times.push(performance.now()-started);if(c.error)throw Error(c.error);c.close();
 }
 times.sort((a,b)=>a-b);rows.prepareBot={samples:3,medianMs:times[1],minMs:times[0],maxMs:times[2]};measurements.push(rows);process.stdout.write(JSON.stringify(rows)+'\n');
}
writeFileSync('tests/step5a-release/evidence/history-cost-profile.json',JSON.stringify({started,finished:new Date().toISOString(),sourceCommit,sourceFiles,corpusPath,corpusGzipSHA256:shaFile(corpusPath),environment:{node:process.version,platform:process.platform,arch:process.arch,cpuModel:cpus()[0]?.model,logicalCPUs:cpus().length},description:'Node diagnostic, no UI or physical device. One hundred completed nine-seat synthetic records replayed with complete legal public frames, each independently wallet-funded and cashed out, then one new nine-seat session. This preserves representative frame/history shape and validates all hashes/ledgers; it does not claim same-session public-memory cost. Five samples per pure operation, three bot preparations. Bot preparation has no UI, no exportHistory, no DOM and no IndexedDB. Memory CAS port deep-copies saves but performs no full-snapshot digest. No production source modified.',measurements},null,2));
