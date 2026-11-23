import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SessionController,DEFAULT_SETTINGS,rules} from '../src/session/controller';
import {startHand,applyCommand,nextHand,projectView,reconfigureTable} from '../src/core/engine';
import {createProfile} from '../src/bots/profiles';
import {appendMoney,seal,GENESIS,validateData,digest} from '../src/storage/integrity';
import type {AppData,PersistencePort,StoredHand} from '../src/session/types';
// Actual frozen Step5A source bundle, also used by the independent browser comparison.
import * as frozen from '../tests/browser/step5b-baseline.js';
const baseline=frozen as unknown as {SessionController:typeof SessionController};
const dir='tests/step5b-performance/evidence/open-session';mkdirSync(dir,{recursive:true});
const at='2026-11-01T00:00:00.000Z',initialStack=1000000,settings={...DEFAULT_SETTINGS,seats:6,buyIn:initialStack,maxBuyInBB:10000},profile=rules(settings),sid='continuous-fold-session';
const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1e12,ledger:[],sessions:[{id:sid,epoch:0,startedAt:at,endedAt:null,settings,profile,buyIns:initialStack,cashOut:0,activeMs:0,lastActiveAt:null,handIds:[]}],hands:[],active:null,importedHands:[]};
await appendMoney(data,{id:'initial',at,epoch:0,kind:'adjustment',walletDelta:1e12,tableDelta:0,pokerNet:0,note:'Isolated natural continuous-hand stress'});await appendMoney(data,{id:'buy-in',at,epoch:0,kind:'buy-in',walletDelta:-initialStack,tableDelta:initialStack,pokerNet:0,sessionId:sid,note:'Single session funding'});
let game=startHand({handId:'stress-hand-1',profile,button:0,seats:Array.from({length:6},(_,id)=>({id,name:`Seat${id}`,stack:initialStack}))});
const checkpoints:{hands:number;data:AppData;lastGame:typeof game}[]=[];
const keep=(count:number)=>checkpoints.push({hands:count,data:{...data,hands:data.hands.slice(),ledger:data.ledger.slice(),sessions:[{...data.sessions[0],handIds:data.sessions[0].handIds.slice()}]},lastGame:game});
keep(0);
for(let n=1;n<=5000;n++){
 const frames=[projectView(game,0)];while(game.street!=='complete'){game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`fold:${n}:${game.revision}`,action:{type:'fold'}});frames.push(projectView(game,0));}
 const view=projectView(game,0),hero=view.seats.find(s=>s.id===0)!,net=hero.stack-hero.startingStack,row:StoredHand={id:game.handId,sessionId:sid,epoch:0,number:n,startedAt:at,endedAt:at,view,frames,net,privateProfiles:{},previousHash:data.hands.at(-1)?.hash??GENESIS,hash:''};data.hands.push(await seal(row));data.sessions[0].handIds.push(row.id);await appendMoney(data,{id:`settle:${row.id}`,at,epoch:0,kind:'hand-net',walletDelta:0,tableDelta:net,pokerNet:net,sessionId:sid,handId:row.id,note:'Actual engine settlement'});
 if([100,1000,5000].includes(n))keep(n);if(n<5000)game=nextHand(game,`stress-hand-${n+1}`);
}
class Port implements PersistencePort {constructor(public data:AppData){}async load(){return this.data;}async commit(rev:number|null,data:AppData){if(this.data.revision!==rev)throw Error('CAS');this.data=data;}close(){}}
const q=(times:number[])=>{const x=times.slice().sort((a,b)=>a-b),v=(p:number)=>x[Math.ceil(x.length*p)-1];return{samples:x.length,p50:v(.5),p95:v(.95),p99:v(.99),max:x.at(-1)}};
const output:{hands:number;seats:number;bytes:number;fixtureSHA256:string;baseline:unknown;candidate:unknown}[]=[],report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(['src/session/controller.ts','src/storage/verified.ts','src/storage/integrity.ts','scripts/step5b-profile-open-session.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{node:process.version,cpu:cpus()[0]?.model},methodology:'One actual continuous six-seat session, one buy-in, 5000 complete engine-owned all-fold hands with moved blinds and carried stacks; no fabricated histories/restarted stacks. Current table safely reconfigured to2/6/10 seats betweenhands byengine without Hero transfer. Same canonical snapshot baseline/candidate. Histories sparse/allfold, distinct from detailed mixed25hand corpus. Reference CAS port excludes persistence serialization; samples20 at0/100,3 at1000,1 at5000. Nearest-rank observed quantiles; 1sampletails not population estimates. Shared Node container, concurrent system/browser work may contend. Full audits deliberately outside preparation timer; actualCPU sampled separately.',output};
for(const c of checkpoints)for(const seats of [2,6,10]){
 let g=c.hands?nextHand(reconfigureTable(c.lastGame,Array.from({length:seats},(_,id)=>({id,name:`Seat${id}`,stack:c.lastGame.seats.find(s=>s.id===id)?.stack??initialStack})),profile,`stress-config-${c.hands}-${seats}`),`stress-active-${c.hands}-${seats}`):startHand({handId:`stress-active-0-${seats}`,profile,button:0,seats:Array.from({length:seats},(_,id)=>({id,name:`Seat${id}`,stack:initialStack}))});
 const frames=[projectView(g,0)];if(g.actor===0){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:0,decisionId:'hero-before-profile',action:{type:'call'}});frames.push(projectView(g,0));}
 const value:AppData={...c.data,sessions:[{...c.data.sessions[0],settings:{...settings,seats}}],active:{sessionId:sid,game:g,profiles:Object.fromEntries(Array.from({length:seats-1},(_,i)=>[i+1,createProfile({selection:'tag'},123+i,'neutral')])),number:c.hands+1,startedAt:at,frames,paused:false,pending:null,exitMode:null}};await validateData(value);
 const row={hands:c.hands,seats,bytes:Buffer.byteLength(JSON.stringify(value)),fixtureSHA256:await digest(value),baseline:null as unknown,candidate:null as unknown};
 for(const phase of ['baseline','candidate'] as const){const Controller=phase==='baseline'?baseline.SessionController:SessionController,times:number[]=[],samples=c.hands<=100?20:c.hands<=1000?3:1;
  for(let i=0;i<samples;i++){const app=new Controller(new Port(value));await app.init();if(app.error)throw Error(app.error);const start=performance.now();await app.prepareBot();times.push(performance.now()-start);if(app.error)throw Error(app.error);app.close();}row[phase]=q(times);
 }
 output.push(row);writeFileSync(`${dir}/latencies.json`,JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(row)+'\n');
}
