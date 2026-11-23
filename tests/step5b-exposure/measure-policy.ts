import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import {analyzeDecision,createProfile} from '../../src/bots/policy';
import {analyzeDecision as historicalAnalyze} from '../../src/bots/v6/strategy';
import {observeBot} from '../../src/core/engine';
import {hand,rig,act} from '../verification/helpers';
const rows=[];const q=(values:number[])=>{const x=values.slice().sort((a,b)=>a-b),p=(n:number)=>x[Math.ceil(n*x.length)-1];return{samples:x.length,p50:p(.5),p95:p(.95),p99:p(.99),max:x.at(-1)}};
for(const players of [2,6,10])for(const street of ['flop','turn','river'] as const){
 const own=['7h','6h'],board=['5h','8h','Qc','2d','Ks'],focus=players===2?0:1,known=[...own,...board],deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!known.includes(c));let offset=0,g=rig(hand(Array.from({length:players},(_,i)=>i===focus?4000:100000)),Array.from({length:players},(_,i)=>i===focus?own:deck.slice(offset*2,++offset*2)),board);g=act(g,{type:'raise',to:400});while(g.street==='preflop')g=act(g,{type:'call'});while(g.street!==street)g=act(g,{type:'check'});if(players>2)while(g.actor!==0)g=act(g,{type:'check'});g=act(g,{type:'raise',to:3599});const profile=createProfile({selection:'stronger-reg'},77123,'neutral'),oldProfile={...profile,policyVersion:'synthetic-cash-1.5.0'},base=observeBot(g,g.actor!,profile.policyVersion,'cold-policy'),old:number[]=[],candidate:number[]=[];
 for(let n=0;n<40;n++)for(const phase of n%2?['candidate','old']:['old','candidate']){const id=`cold-${phase}-${n}`,o={...base,decisionId:id,publicEvents:base.publicEvents.map(e=>({...e,id:`${id}:${e.id}`}))},start=performance.now();if(phase==='old')historicalAnalyze({...o,policyVersion:oldProfile.policyVersion},oldProfile);else analyzeDecision(o,profile);(phase==='old'?old:candidate).push(performance.now()-start);}
 rows.push({players,street,previousPolicy:oldProfile.policyVersion,candidatePolicy:profile.policyVersion,old:q(old),candidate:q(candidate)});
}
const report={method:'40paired cold-analysis samples per2/6/10players×flop/turn/river, rotating order. Unique public-event identities force analysis-cache misses; normal shape cache retained. All paired inputs share a legal near-stack-cap engine context. Shared Node host while independent resource stress is also running; measurements are not isolated CPU or browser/device claims.',node:process.version,cpu:cpus()[0]?.model,sourceHashes:Object.fromEntries(['src/bots/strategy.ts','src/bots/v6/strategy.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),rows};writeFileSync('tests/step5b-exposure/evidence/policy-timing.json',JSON.stringify(report,null,2));console.log(JSON.stringify(rows));
