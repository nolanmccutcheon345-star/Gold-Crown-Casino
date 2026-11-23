import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {getPlayerNote,savePlayerNote,deletePlayerNote,validateUserNotes,MAX_PLAYER_NOTE_LENGTH,MAX_PLAYER_NOTES} from '../../src/session/notes';
import {canonical,migrateData,publicHistory} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,verifyTransition} from '../../src/storage/verified';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import {observeBot} from '../../src/core/engine';
import {withPublicContext} from '../../src/session/bot-observation';
import {deriveCashStats} from '../../src/stats/cash';
import {BrowserPersistence} from '../../src/storage/browser';
import {DELETE_PRACTICE_CONFIRMATION} from '../../src/storage/erasure';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';

class Memory implements PersistencePort {
 data:AppData|null=null;fail=false;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){if(this.fail){this.fail=false;throw Error('Interrupted note write');}if(expected!==(this.data?.revision??null))throw Error('revision changed');this.data=structuredClone(data);}
 close(){}
}
const controllers:SessionController[]=[];
async function open(port:PersistencePort=new Memory(),seats=2){const c=new SessionController(port);controllers.push(c);await c.init();expect(c.error).toBe('');if(!c.data!.active){await c.startSession({...DEFAULT_SETTINGS,seats});expect(c.error).toBe('');}return c;}
const nonfinancial=(data:AppData)=>canonical({wallet:data.wallet,ledger:data.ledger,hands:data.hands,active:data.active,sessions:data.sessions,stats:deriveCashStats(data.hands,data.sessions,0)});
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());vi.restoreAllMocks();});

describe('Z14 permitted manual player notes: nonfinancial, versioned and bounded',()=>{
 it.each([2,6,10])('saves user-only notes for %i public seats without cards/persona prefill or financial mutation',async seats=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.now());const c=await open(undefined,seats),sid=c.data!.active!.sessionId,before=nonfinancial(c.data!);
  expect(getPlayerNote(c.data!,sid,seats-1)).toBeUndefined();expect(await c.savePlayerNote(sid,seats-1,'  My observation: called a small bet.  ')).toBe(true);
  expect(getPlayerNote(c.data!,sid,seats-1)).toMatchObject({sessionId:sid,seatId:seats-1,text:'My observation: called a small bet.',revision:1});expect(nonfinancial(c.data!)).toBe(before);
  expect(Object.keys(getPlayerNote(c.data!,sid,seats-1)!).sort()).toEqual(['createdAt','id','revision','seatId','sessionId','text','updatedAt']);await auditSnapshot(structuredClone(c.data!));
 });
 it('retains pending bot identity across note edits and excludes notes from the bot observation and public export',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.now());const c=await open(),initial=c.data!.active!.game;await c.act({type:'call'},initial.handId,initial.revision);await c.prepareBot();expect(c.error).toBe('');
  const before=c.data!,a=before.active!,p=a.profiles[a.game.actor!],observation=withPublicContext(observeBot(a.game,a.game.actor!,p.policyVersion,'fixed-observation'),a.game.profile.rake,p,before.hands,a.sessionId),unchanged=nonfinancial(before);
  expect(await c.savePlayerNote(a.sessionId,1,'USER-MANUAL-ONLY <script>never execute me</script>')).toBe(true);expect(nonfinancial(c.data!)).toBe(unchanged);expect(c.data!.active!.pending).toEqual(a.pending);
  expect(withPublicContext(observeBot(c.data!.active!.game,a.game.actor!,p.policyVersion,'fixed-observation'),a.game.profile.rake,p,c.data!.hands,a.sessionId)).toEqual(observation);
  expect(JSON.stringify(await c.exportHistory())).not.toContain('USER-MANUAL-ONLY');expect(JSON.stringify(observation)).not.toContain('USER-MANUAL-ONLY');
  await c.commitBot(a.game.handId,a.game.revision);expect(c.error).toBe('');expect(c.data!.active!.game.events.filter(event=>event.decisionId===a.pending!.decisionId)).toHaveLength(1);
 });
 it('edits/deletes explicitly, deduplicates identical saves, and prevents stale overwrite or delete/recreate ABA',async()=>{
  const c=await open(),sid=c.data!.active!.sessionId;expect(await c.savePlayerNote(sid,1,'first')).toBe(true);const first=getPlayerNote(c.data!,sid,1)!;
  expect(await c.savePlayerNote(sid,1,'first')).toBe(true);expect(getPlayerNote(c.data!,sid,1)).toBe(first);
  expect(await c.savePlayerNote(sid,1,'second',0)).toBe(false);expect(c.error).toContain('changed');expect(getPlayerNote(c.data!,sid,1)).toBe(first);
  expect(await c.savePlayerNote(sid,1,'second',first.revision)).toBe(true);const second=getPlayerNote(c.data!,sid,1)!;expect(second.revision).toBeGreaterThan(first.revision);expect(second.createdAt).toBe(first.createdAt);
  expect(await c.deletePlayerNote(sid,1,first.revision)).toBe(false);expect(await c.deletePlayerNote(sid,1,second.revision)).toBe(true);expect(await c.deletePlayerNote(sid,1,second.revision)).toBe(true);
  expect(await c.savePlayerNote(sid,1,'recreated')).toBe(true);expect(getPlayerNote(c.data!,sid,1)!.revision).toBeGreaterThan(second.revision);expect(await c.deletePlayerNote(sid,1,second.revision)).toBe(false);expect(getPlayerNote(c.data!,sid,1)!.text).toBe('recreated');
 });
 it('preserves notes through refresh and schema migration without retagging or changing canonical hand hashes',async()=>{
  const port=new Memory(),c=await open(port),sid=c.data!.active!.sessionId;await c.savePlayerNote(sid,1,'persisted note');const note=getPlayerNote(c.data!,sid,1),before=canonical(c.data!.hands);
  const recovered=await open(port);expect(getPlayerNote(recovered.data!,sid,1)).toEqual(note);expect(canonical(recovered.data!.hands)).toBe(before);
  const migrated=await migrateData(structuredClone(recovered.data!));expect(migrated.userNotes).toEqual(recovered.data!.userNotes);expect(canonical(migrated.hands)).toBe(before);
  const legacy=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')).streets.flop;const oldHashes=canonical(legacy.hands);const restored=await migrateData(legacy);expect(restored.userNotes).toBeUndefined();expect(canonical(restored.hands)).toBe(oldHashes);
 });
 it('updates only the v2 header and shares unchanged notes during ordinary game drafts',async()=>{
  const c=await open(),before=c.data!,first=await prepareSegments(before,null,null),store=new Map(first.writes.map(w=>[w.key,w.entry]));await c.savePlayerNote(before.active!.sessionId,1,'header-only note');
  const after=c.data!,delta=await prepareSegments(after,before,first.envelope);expect(delta.writes).toEqual([]);expect(delta.envelope.data.userNotes).toEqual(after.userNotes);
  expect(await restoreSegments(delta.envelope,async keys=>keys.map(key=>structuredClone(store.get(key))))).toEqual(after);
  const draft=draftSnapshot(after);expect(draft.userNotes).toBe(after.userNotes);expect(draft.userNotes!.entries).toBe(after.userNotes!.entries);draft.revision++;await verifyTransition(after,draft);
 });
 it('keeps the committed note on failed writes, then retries once without a duplicate note or financial event',async()=>{
  const port=new Memory(),c=await open(port),sid=c.data!.active!.sessionId;await c.savePlayerNote(sid,1,'committed');const before=c.data!,rev=getPlayerNote(before,sid,1)!.revision;
  port.fail=true;expect(await c.savePlayerNote(sid,1,'retry draft',rev)).toBe(false);expect(c.status).toBe('error');expect(c.data).toBe(before);expect(getPlayerNote(port.data!,sid,1)!.text).toBe('committed');
  await c.retry();expect(c.status).toBe('ready');expect(getPlayerNote(c.data!,sid,1)!.text).toBe('retry draft');expect(c.data!.userNotes!.entries).toHaveLength(1);expect(c.data!.ledger).toEqual(before.ledger);expect(c.data!.hands).toEqual(before.hands);
 });
 it('reports busy/readonly save attempts as unsaved and uses the existing multi-writer CAS guard',async()=>{
  const port=new Memory(),a=await open(port),b=await open(port),sid=a.data!.active!.sessionId;a.busy=true;expect(await a.savePlayerNote(sid,1,'busy draft')).toBe(false);a.busy=false;
  expect(await a.savePlayerNote(sid,1,'first writer')).toBe(true);expect(await b.savePlayerNote(sid,1,'stale writer')).toBe(false);expect(b.status).toBe('readonly');expect(getPlayerNote(port.data!,sid,1)!.text).toBe('first writer');
  expect(await b.savePlayerNote(sid,1,'still stale')).toBe(false);await b.retry();expect(getPlayerNote(b.data!,sid,1)!.text).toBe('first writer');
 });
 it.each(['','   ','x'.repeat(MAX_PLAYER_NOTE_LENGTH+1),'bad\u0000control'])('rejects invalid note text without committing %j',async text=>{
  const c=await open(),before=c.data!;expect(await c.savePlayerNote(before.active!.sessionId,1,text)).toBe(false);expect(c.data).toBe(before);expect(c.error).not.toBe('');
 });
 it('refuses private/absent seat identities and a 201st note instead of silently evicting stored notes',async()=>{
  const c=await open(),d=c.data!,sid=d.active!.sessionId;expect(await c.savePlayerNote('private-personality-not-a-session',1,'no')).toBe(false);expect(await c.savePlayerNote(sid,9,'unoccupied')).toBe(false);expect(c.data).toBe(d);
  const note=savePlayerNote(d,sid,1,'bounded').entries[0],full={...d,userNotes:{version:1 as const,revision:MAX_PLAYER_NOTES,entries:Array.from({length:MAX_PLAYER_NOTES},(_,i)=>({...note,id:`test-capacity-${i}`,sessionId:`old-session-${i}`,revision:i+1}))}};
  expect(()=>savePlayerNote(full,sid,1,'capacity reached')).toThrow('At most 200');expect(full.userNotes.entries).toHaveLength(200);
  expect(()=>validateUserNotes({...full,userNotes:{...full.userNotes,entries:[...full.userNotes.entries,note]}})).toThrow('At most 200');
 });
 it.each(['version','duplicate','private-field','oversized','oversized-metadata','unknown-session'] as const)('full restore and incremental validation reject corrupt note %s without financial changes',async attack=>{
  const c=await open(),sid=c.data!.active!.sessionId;await c.savePlayerNote(sid,1,'valid');const prior=c.data!,next=draftSnapshot(prior);next.revision++;next.userNotes=structuredClone(prior.userNotes!);next.userNotes.revision++;
  if(attack==='version')next.userNotes.version=99 as 1;if(attack==='duplicate')next.userNotes.entries.push(next.userNotes.entries[0]);if(attack==='private-field')Object.assign(next.userNotes.entries[0],{privateProfiles:{bad:true}});if(attack==='oversized')next.userNotes.entries[0].text='x'.repeat(501);if(attack==='unknown-session')next.userNotes.entries[0].sessionId='unknown';
  if(attack==='oversized-metadata')next.userNotes.entries[0].createdAt=' '.repeat(100000)+'2026-01-01';
  await expect(auditSnapshot(structuredClone(next))).rejects.toThrow();await expect(verifyTransition(prior,next)).rejects.toThrow();expect(c.data).toBe(prior);
 });
 it('keeps same-numbered public seats in later sessions distinct and preserves earlier session notes',async()=>{
  const c=await open(),first=c.data!.active!.sessionId;await c.savePlayerNote(first,1,'first session player');let g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();await c.startSession({...DEFAULT_SETTINGS,seats:2});const second=c.data!.active!.sessionId;
  expect(second).not.toBe(first);expect(getPlayerNote(c.data!,second,1)).toBeUndefined();expect(await c.savePlayerNote(second,1,'new session player')).toBe(true);expect(getPlayerNote(c.data!,first,1)!.text).toBe('first session player');
  g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(await c.savePlayerNote(first,1,'revised old observation',getPlayerNote(c.data!,first,1)!.revision)).toBe(true);expect(await publicHistory(c.data!.hands)).not.toHaveProperty('userNotes');
 });
 it('M12 all-data deletion atomically erases notes in current/previous snapshots, then starts without notes',async()=>{
  const owner='note-erasure-test',reference=idbReference(new Map([['lease',{owner,expires:Date.now()+12000}]]));
  const port=new BrowserPersistence('isolated-player-note-erasure');Object.assign(port as unknown as {db:IDBDatabase;owner:string},{db:reference.db,owner});port.writable=true;const c=await open(port),sid=c.data!.active!.sessionId;
  await c.savePlayerNote(sid,1,'PRIVATE MANUAL NOTE TO DELETE');const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');expect(JSON.stringify([...reference.records])).toContain('PRIVATE MANUAL NOTE TO DELETE');
  await c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(c.status).toBe('deleted');expect([...reference.records.keys()].sort()).toEqual(['erasure','lease']);expect(JSON.stringify([...reference.records])).not.toContain('PRIVATE MANUAL NOTE');
  await c.startFreshPracticeData();expect(c.status).toBe('ready');expect(c.data!.userNotes).toBeUndefined();expect(c.data!.wallet).toBe(1000000);
 });
 it('deletion retains monotonic collection revision without rewriting older note creation metadata',async()=>{
  const c=await open(),sid=c.data!.active!.sessionId,d=c.data!,first=savePlayerNote(d,sid,1,'original',0,'2026-11-01T10:00:00.000Z'),withFirst={...d,userNotes:first};
  const second=savePlayerNote(withFirst,sid,1,'clock moved backwards',1,'2026-11-01T09:00:00.000Z');expect(second.entries[0].updatedAt).toBe(first.entries[0].updatedAt);
  const removed=deletePlayerNote({...d,userNotes:second},sid,1,2)!;expect(removed).toEqual({version:1,revision:3,entries:[]});
 });
});
