/** Reproduce: node_modules/.bin/vite-node tests/step5b-statistics/profile.ts */
import {performance} from 'node:perf_hooks';
import {deepStrictEqual} from 'node:assert';
import {writeFileSync,mkdirSync} from 'node:fs';
import {cpus} from 'node:os';
import {applyCommand,projectView,startHand} from '../../src/core/engine';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';
import type {StoredHand} from '../../src/session/types';
import type {HeroViewModel,RuleProfile} from '../../src/contracts';
const profile:RuleProfile={id:'microbenchmark',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function freeze<T>(value:T):T {if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function histories(seats:number,count:number):StoredHand[] {
 let game=startHand({handId:'template',button:0,profile,seats:Array.from({length:seats},(_,id)=>({id,name:`Seat ${id}`,stack:20000}))});
 const frames=[projectView(game,0)];
 while(game.street!=='complete'){game=applyCommand(game,{handId:game.handId,seatId:game.actor!,revision:game.revision,decisionId:`template:${game.revision}`,action:{type:'fold'}});frames.push(projectView(game,0));}
 let previousHash='0'.repeat(64);
 return freeze(Array.from({length:count},(_,i)=>{
  const id=`stats-bench-${seats}-${i}`;
  const rename=(view:HeroViewModel):HeroViewModel=>({...view,handId:id,events:view.events.map(event=>({...event,id:event.id.replaceAll('template',id),handId:id,decisionId:event.decisionId?.replaceAll('template',id)}))});
  const hand:StoredHand={id,sessionId:'benchmark',epoch:0,number:i+1,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T00:01:00Z',view:rename(projectView(game,0)),frames:frames.map(rename),net:game.seats[0].stack-game.seats[0].startingStack,privateProfiles:{},previousHash,hash:`fixture-${i}`};previousHash=hand.hash;return hand;
 }));
}
function measure(work:()=>unknown,samples=30) {
 const times:number[]=[];for(let i=0;i<samples;i++){const start=performance.now();work();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
 const q=(p:number)=>times[Math.ceil(times.length*p)-1];return {samples,p50:q(.5),p95:q(.95),p99:q(.99),max:times.at(-1)!};
}
const results=[];
for(const seats of [2,6,10]) {
 const all=histories(seats,5001);
 for(const count of [0,100,500,1000,5000]) {
  const hands=freeze(all.slice(0,count));const projection=new CashStatsProjection();const start=performance.now();const projected=projection.derive(hands,[],0);const cold=performance.now()-start;
  const reference=deriveCashStats(hands,[],0);deepStrictEqual(projected,reference);
  const full=measure(()=>deriveCashStats(hands,[],0)),cached=measure(()=>projection.derive(hands,[],0));
  const next=freeze(all.slice(0,count+1)),before=performance.now();const appended=projection.derive(next,[],0);const appendMs=performance.now()-before;
  deepStrictEqual(appended,deriveCashStats(next,[],0));
  results.push({seats,savedHands:count,recordBytes:JSON.stringify(hands).length,coldProjectionMs:cold,appendOneMs:appendMs,fullReplayMs:full,cachedProjectionMs:cached,agreement:true});
 }
}
mkdirSync('tests/step5b-statistics/evidence',{recursive:true});
const report={timestamp:new Date().toISOString(),methodology:'Node performance.now; 30 consecutive samples each. Canonical legal preflop-fold walk templates repeated with distinct IDs and sequence links. All comparisons include opportunity calculation, rake attribution and grouping. Frozen structural sharing of unchanged public fields. This is only a statistics microbenchmark: excludes engine dealing, browser rendering, storage and cryptographic validation. Does not establish browser or bot-preparation targets.',conditions:{node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model},results};
writeFileSync('tests/step5b-statistics/evidence/stats-microbenchmark.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
