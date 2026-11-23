import {describe,it,expect} from 'vitest';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {canonical,migrateData,parsePublicHistory,publicHistory,seal} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,verifyTransition} from '../../src/storage/verified';
import {deriveCashStats} from '../../src/stats/cash';
import {CashStatsProjection} from '../../src/stats/projection';
import {deriveConfigurationHistory,rowForHandConfiguration} from '../../src/stats/configuration-history';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import {previewPublicStudyImport} from '../../src/storage/study-import';
import {describeHandProvenance} from '../../src/session/hand-provenance';
class Memory implements PersistencePort {
 data:AppData|null=null;fail=false;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){if(this.fail){this.fail=false;throw Error('interrupted configuration boundary');}if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}
 close(){}
}
async function open(port=new Memory()){const c=new SessionController(port);await c.init();expect(c.error).toBe('');if(!c.data!.active)await c.startSession({...DEFAULT_SETTINGS,seats:2,population:'low',opponents:[{selection:'unknown',baseArchetype:'station',personalitySeed:51514}]});expect(c.error).toBe('');return{c,port};}
async function finish(c:SessionController){for(let i=0;c.data!.active!.game.street!=='complete'&&i<120;i++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}
function expectedStats(c:SessionController,projection=new CashStatsProjection()){const actual=projection.derive(c.data!.hands,c.data!.sessions,0);expect(actual).toEqual(deriveCashStats(c.data!.hands,c.data!.sessions,0));return actual;}
function nextSettings(c:SessionController){return {...c.data!.sessions.at(-1)!.settings,smallBlind:100,bigBlind:300,population:'mid' as const,rakeMode:'custom' as const,rakeBasisPoints:500,rakeCap:400,opponents:[{selection:'custom' as const,baseArchetype:'stronger-reg' as const,personalitySeed:991517}]};}
async function queue(c:SessionController){const a=c.data!.active!;await c.queueConfiguration(nextSettings(c),a.sessionId,a.game.handId);expect(c.error).toBe('');}
const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};

describe('V514 immutable synthetic preset/population configuration provenance',()=>{
 it('sums integer cents before converting fractional big blinds for configuration result rows',async()=>{
  const {c}=await open();await finish(c);const base=structuredClone(c.data!.hands[0]);delete base.configuration;base.net=100;base.view.profile.bigBlind=300;
  expect(rowForHandConfiguration(base).bb100).toBe(100*(100/300));
  const rows=deriveConfigurationHistory(Array.from({length:31},(_,i)=>({...base,number:i+1,net:i===30?-100:100})),[]);
  expect(rows).toHaveLength(1);expect(rows[0].profit).toBe(2900);expect(rows[0].bb100).toBe(100*(2900/300)/31);c.close();
 });
 it('records initial public selection/environment/rake/rule facts before first settlement without resolving Unknown identity',async()=>{
  const {c}=await open(),row=expectedStats(c).configurationHistory[0];expect(row).toMatchObject({status:'RECORDED',population:'low',selectionMix:[{selection:'unknown',count:1}],hands:0,lastHandNumber:null,evidenceStatus:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED',changeReason:'session-start'});
  expect(JSON.stringify(row)).not.toMatch(/station|personalitySeed|personalityId|baseArchetype|traits|aggression/);expect(row.ruleVersion).toBe(c.data!.active!.game.profile.version);expect(row.rake).toEqual(c.data!.active!.game.profile.rake);c.close();
 });
 it('queues a change without retagging the active hand, then logs it once at next hand and segments realized results',async()=>{
  const {c}=await open(),projection=new CashStatsProjection(),initial=c.data!.active!.configuration!;expectedStats(c,projection);await queue(c);
  expect(c.data!.active!.configuration).toBe(initial);expect(c.data!.sessions[0].configurationHistory).toHaveLength(1);await finish(c);const first=c.data!.hands[0],hash=first.hash,ledgerBefore=c.data!.ledger,firstBytes=canonical(first);expectedStats(c,projection);
  await c.nextHand();expect(c.error).toBe('');expect(c.data!.hands[0]).toBe(first);expect(c.data!.ledger).toBe(ledgerBefore);expect(c.data!.sessions[0].configurationHistory).toHaveLength(2);
  const started=expectedStats(c,projection).configurationHistory;expect(started.map(row=>[row.population,row.hands])).toEqual([['low',1],['mid',0]]);expect(started[1]).toMatchObject({selectionMix:[{selection:'custom',count:1}],firstHandNumber:2,lastHandNumber:null,bigBlind:300,changeReason:'next-hand-configuration'});
  await finish(c);const stats=expectedStats(c,projection);expect(stats.configurationHistory.map(row=>row.hands)).toEqual([1,1]);expect(stats.configurationHistory.map(row=>row.profit)).toEqual(c.data!.hands.map(hand=>hand.net));
  expect(stats.configurationHistory.reduce((sum,row)=>sum+row.profit,0)).toBe(c.data!.ledger.reduce((sum,event)=>sum+event.pokerNet,0));expect(c.data!.hands[0].hash).toBe(hash);expect(canonical(c.data!.hands[0])).toBe(firstBytes);
  expect(stats.configurationHistory[0].rake.basisPoints).toBe(0);expect(stats.configurationHistory[1].rake.basisPoints).toBe(500);expect(stats.configurationHistory[0].ruleVersion).not.toBe(stats.configurationHistory[1].ruleVersion);
  const out=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'test-results/step5b-statistics');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'V514-configuration-history.json'),JSON.stringify({method:'Actual controller safe-boundary change; current and prior records preserved',rows:stats.configurationHistory,hashes:c.data!.hands.map(hand=>hand.hash),handNets:c.data!.hands.map(hand=>hand.net),ledgerPokerNet:c.data!.ledger.reduce((sum,event)=>sum+event.pokerNet,0),sourceDisclosure:'Host selections only; no resolved Unknown/Random identity, seeds or private traits'},null,2)+'\n');c.close();
 });
 it('keeps boundary capture idempotent across failed persistence/retry/reload and ordinary subsequent hands',async()=>{
  const {c,port}=await open();await finish(c);await queue(c);const before=c.data!;port.fail=true;await c.nextHand();expect(c.status).toBe('error');expect(c.data).toBe(before);await c.retry();expect(c.error).toBe('');expect(c.data!.sessions[0].configurationHistory).toHaveLength(2);
  const recovered=(await open(port)).c;expect(recovered.data!.sessions[0].configurationHistory).toEqual(c.data!.sessions[0].configurationHistory);await finish(recovered);const captured=recovered.data!.sessions[0].configurationHistory!;await recovered.nextHand();expect(recovered.error).toBe('');expect(recovered.data!.sessions[0].configurationHistory).toBe(captured);expectedStats(recovered);c.close();recovered.close();
 });
 it('keeps population-only changes separate even when rules, stakes, selection mix and policy versions are identical',async()=>{
  const {c}=await open(),projection=new CashStatsProjection();await finish(c);const first=c.data!.hands[0],a=c.data!.active!;
  await c.queueConfiguration({...c.data!.sessions[0].settings,population:'high'},a.sessionId,a.game.handId);await c.nextHand();expect(c.error).toBe('');await finish(c);
  const rows=expectedStats(c,projection).configurationHistory;expect(rows).toHaveLength(2);expect(rows.map(row=>row.population)).toEqual(['low','high']);expect(rows[0].ruleVersion).toBe(rows[1].ruleVersion);expect(rows[0].policyVersions).toEqual(rows[1].policyVersions);expect(rows[0].selectionMix).toEqual(rows[1].selectionMix);expect(rows[0].key).not.toBe(rows[1].key);expect(c.data!.hands[0]).toBe(first);c.close();
 });
 it('does not reconstruct legacy population or selections from mutable current settings or hidden old profiles',async()=>{
  const data=await migrateData(fixture.streets.flop),bytes=canonical(data.hands),first=deriveCashStats(data.hands,data.sessions,0).configurationHistory;
  expect(first.every(row=>row.status==='LEGACY_UNKNOWN'&&row.population===null&&row.selectionMix===null&&row.capacity===null)).toBe(true);
  const sessions=structuredClone(data.sessions);for(const session of sessions){session.settings.population='high';session.settings.archetypes=['maniac'];}
  expect(deriveCashStats(data.hands,sessions,0).configurationHistory).toEqual(first);expect(canonical(data.hands)).toBe(bytes);const exported=await publicHistory(data.hands);expect((await parsePublicHistory(JSON.stringify(exported))).every(hand=>hand.configuration===undefined)).toBe(true);
 });
 it('public export/import retains original safe configuration records and hashes but never credits imported profits',async()=>{
  const {c}=await open();await finish(c);const before=canonical(c.data!.hands),wallet=c.data!.wallet,stats=expectedStats(c),payload=await c.exportHistory();
  expect(JSON.stringify(payload.hands[0].configuration)).not.toMatch(/station|personalitySeed|baseArchetype|traits|privateProfiles/);expect(payload.hands[0].configuration).toEqual(c.data!.hands[0].configuration);
  const preview=await previewPublicStudyImport(JSON.stringify(payload));expect(preview.validCount).toBe(1);expect(await parsePublicHistory(JSON.stringify(payload))).toEqual(payload.hands);await c.importSelectedStudyHands(preview,[0]);expect(c.error).toBe('');
  expect(c.data!.importedHands[0].hash).toBe(payload.hands[0].hash);expect(c.data!.wallet).toBe(wallet);expect(canonical(c.data!.hands)).toBe(before);expect(expectedStats(c).configurationHistory).toEqual(stats.configurationHistory);c.close();
 });
 it('preserves boundary and hand metadata through segmented storage without old canonical rewrites',async()=>{
  const {c}=await open();await finish(c);const before=c.data!,prepared=await prepareSegments(before,null,null),store=new Map(prepared.writes.map(write=>[write.key,write.entry]));await queue(c);await c.nextHand();expect(c.error).toBe('');
  const delta=await prepareSegments(c.data!,before,prepared.envelope);expect(delta.writes).toEqual([]);expect(await restoreSegments(delta.envelope,async keys=>keys.map(key=>structuredClone(store.get(key))))).toEqual(c.data);c.close();
 });
 it('fails closed on an unknown saved configuration version without resetting money or rewriting stored bytes',async()=>{
  const {c,port}=await open();port.data!.sessions[0].configurationHistory![0].version=99 as 1;const before=canonical(port.data),restored=new SessionController(port);await restored.init();expect(restored.status).toBe('error');expect(restored.error).toContain('configuration');expect(canonical(port.data)).toBe(before);c.close();restored.close();
 });
 it.each(['removed','reordered','modified'] as const)('rejects %s immutable configuration prefixes before granting an incremental checkpoint',async attack=>{
  const {c}=await open();await finish(c);await queue(c);await c.nextHand();const prior=c.data!,next=draftSnapshot(prior);next.revision++;const entries=next.sessions[0].configurationHistory!;
  if(attack==='removed')next.sessions[0].configurationHistory=entries.slice(1);if(attack==='reordered')next.sessions[0].configurationHistory=[...entries].reverse();if(attack==='modified')next.sessions[0].configurationHistory=[{...entries[0],population:'high'},entries[1]];
  await expect(verifyTransition(prior,next)).rejects.toThrow(/Configuration/);c.close();
 });
 it.each(['human-label','unknown-resolved-field','rules-mismatch','bad-count'] as const)('rejects independently resealed public metadata containing %s',async attack=>{
  const {c}=await open();await finish(c);const payload=await c.exportHistory(),config=payload.hands[0].configuration!;
  if(attack==='human-label')config.evidenceStatus='HUMAN_CALIBRATED' as typeof config.evidenceStatus;if(attack==='unknown-resolved-field')Object.assign(config,{resolvedArchetype:'station'});if(attack==='rules-mismatch')config.rules.bigBlind++;if(attack==='bad-count')config.selectionMix[0].count++;
  payload.hands[0]=await seal(payload.hands[0]);const preview=await previewPublicStudyImport(JSON.stringify(payload));expect(preview.validCount).toBe(0);await expect(parsePublicHistory(JSON.stringify(payload))).rejects.toThrow();c.close();
 });
 it('records full sourced rake assumptions and first-hand all-in settlement without inventing a legacy origin',async()=>{
  const port=new Memory(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,rakeMode:'pokerstars-usd-2026'});expect(c.error).toBe('');expect(c.data!.active!.configuration!.rules.rake.source?.currency).toBe('USD');await auditSnapshot(structuredClone(c.data!));c.close();
  const other=new SessionController(new Memory());await other.init();await other.startSession({...DEFAULT_SETTINGS,seats:2,smallBlind:200,bigBlind:200,buyIn:200});expect(other.error).toBe('');expect(other.data!.hands).toHaveLength(1);expect(other.data!.hands[0].configuration!.effectiveHandNumber).toBe(1);expect(describeHandProvenance(other.data!.hands[0],'cash').source).toBe('csprng');other.close();
 });
});
