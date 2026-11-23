import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {encodeTournament,decodeTournament} from '../../src/tournament/persistence';
import {auditTournamentData,type TournamentData} from '../../src/tournament/runtime';
import {replayTournamentHand} from '../../src/core/engine';
it('preserves canonical histories and exact public replay while removing duplicated archived frames',()=>{const rows=[];for(const seats of [6,9]){const expanded=JSON.parse(gunzipSync(readFileSync(`tests/tournament-runtime/fixtures/expanded-${seats}.json.gz`)).toString()) as TournamentData;
const compact=structuredClone(expanded);for(const hand of compact.active!.history)hand.frames=[];
for(const [index,hand]of compact.active!.history.entries()){expect(hand.state).toEqual(expanded.active!.history[index].state);expect(replayTournamentHand(hand.state)).toEqual(expanded.active!.history[index].frames);}
expect(compact.ledger).toEqual(expanded.ledger);expect(compact.balance).toBe(expanded.balance);expect(compact.active!.finishes).toEqual(expanded.active!.finishes);
const measurement=(data:TournamentData)=>{const samples=[];for(let i=0;i<5;i++){const t=performance.now();expect(decodeTournament(encodeTournament(data))).toEqual(data);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {logicalSnapshotBytes:Buffer.byteLength(JSON.stringify(encodeTournament(data))),encodeDecodeAndEqualityMs:{p50:samples[2],max:samples.at(-1)}};};
const before=measurement(expanded),after=measurement(compact);expect(after.logicalSnapshotBytes).toBeLessThan(before.logicalSnapshotBytes/3);const t=performance.now();const auditedHands=auditTournamentData(compact);const auditMs=performance.now()-t;
rows.push({seats,hands:compact.active!.history.length,actions:compact.active!.history.reduce((n,h)=>n+h.state.revision,0),before,after,auditedHands,auditMs,method:'Identical immutable complete legal check/call events, five encode/decode/equality samples in Node. Logical payload, not browser origin usage. Full canonical states retained; old expanded frames supported.'});}
writeFileSync('tests/tournament-runtime/footprint-results.json',JSON.stringify({rows},null,2)+'\n');});
