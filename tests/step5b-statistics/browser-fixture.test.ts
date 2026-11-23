import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ENGINE_VERSION} from '../../src/core/engine';
import {execFileSync} from 'node:child_process';
import {createStatsBrowserFixture,createStationBrowserFixture} from './browser-fixture';
import {deriveCashStats,projectLivePace} from '../../src/stats/cash';
import {validateData} from '../../src/storage/integrity';
it('builds 300 actual engine hands, with independently specified +$60 cashout and +10BB/100, for isolated real-UI pace verification',async()=>{
 const data=await createStatsBrowserFixture();await validateData(data);
 const frequencies=new Map<number,number>();for(const hand of data.hands)frequencies.set(hand.net,(frequencies.get(hand.net)??0)+1);
 expect([...frequencies].sort((a,b)=>a[0]-b[0])).toEqual([[-100,150],[100,90],[200,60]]);
 expect(data.sessions[0].cashOut).toBe(26000);expect(data.wallet).toBe(1006000);expect(data.hands.map(h=>h.view.button)).toEqual(Array.from({length:300},(_,i)=>i%2));
 const stats=deriveCashStats(data.hands,data.sessions);expect(stats.hands).toBe(300);expect(stats.bb100).toBe(10);expect(stats.profit).toBe(6000);expect(stats.perHour).toBe(6000);
 expect(projectLivePace(stats,30)).toMatchObject({liveEquivalentHours:10,projectedBBPerHour:3,projectedProfitPerHour:600});
 const slower={...data,sessions:data.sessions.map(s=>({...s,activeMs:36000000}))};await validateData(slower);expect(deriveCashStats(slower.hands,slower.sessions).perHour).toBe(600);
},30000);

it('G05 generates100 actualstation-policy completedhands with stableprivatepolicy and exacttransfer-excluded results',async()=>{
 const data=await createStationBrowserFixture();await validateData(data);const stats=deriveCashStats(data.hands,data.sessions);
 expect(data.hands).toHaveLength(100);expect(stats.hands).toBe(100);expect(data.hands.every(h=>h.privateProfiles[1].archetype==='station')).toBe(true);
 expect(new Set(data.hands.map(h=>h.privateProfiles[1].personalityId)).size).toBe(1);
 expect(data.wallet-data.initialBankroll).toBe(stats.profit);expect(data.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(100);
 expect(data.hands.every(h=>h.view.street==='complete'&&h.view.events.filter(e=>e.type==='action'&&e.seatId===1).every(e=>e.decisionId?.startsWith('station-fixture:')))).toBe(true);
 const evidenceDirectory=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(evidenceDirectory,{recursive:true});writeFileSync(resolve(evidenceDirectory,'G05-station-hands.json'),JSON.stringify({criterion:'G05',scope:'Executed100realenginehands againstcurrentstationpolicy; warningDOMverification remainsseparate',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,engineVersion:ENGINE_VERSION,sourceSha256:Object.fromEntries(['src/core/engine.ts','src/bots/policy.ts','tests/step5b-statistics/browser-fixture.ts','tests/step5b-statistics/browser-fixture.test.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),executedAt:new Date().toISOString(),method:'ProductionCSPRNGcards; Hero checks/calls; station chooseDecision seed=0x605000+handNumber*997+revision; stablepersonality1705. Betweenhand replenishments are separateengine transfers. Noherooutcomes forced; recorded profit is simulator-specific.',policyVersions:[...new Set(data.hands.map(h=>h.privateProfiles[1].policyVersion))],hands:stats.hands,net:stats.profit,wallet:data.wallet,initialBankroll:data.initialBankroll,sessionBuyIns:data.sessions[0].buyIns,sessionCashout:data.sessions[0].cashOut,records:data.hands.map(h=>({number:h.number,id:h.id,hash:h.hash,net:h.net,actions:h.view.events.filter(e=>e.type==='action').length,stationActions:h.view.events.filter(e=>e.type==='action'&&e.seatId===1).length,heroStart:h.view.seats.find(s=>s.id===0)!.startingStack,heroEnd:h.view.seats.find(s=>s.id===0)!.stack}))},null,2)+'\n');
},30000);
