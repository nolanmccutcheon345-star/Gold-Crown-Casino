import {describe,expect,it,afterEach,vi} from 'vitest';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {DELETE_PRACTICE_CONFIRMATION,ERASURE_KEY,PracticeDataDeletedError,type ErasureMarker} from '../../src/storage/erasure';
import {appendMoney,canonical,validateData} from '../../src/storage/integrity';
import {draftSnapshot} from '../../src/storage/verified';
import type {AppData} from '../../src/session/types';
import {idbReference} from './idb-reference';
const owner='independent-erasure-owner';
const ports:BrowserPersistence[]=[];
function attach(db:IDBDatabase,token=owner){const port=new BrowserPersistence('ai-texas-step5b-independent-erasure');const internals=port as unknown as {db:IDBDatabase;owner:string};internals.db=db;internals.owner=token;port.writable=true;ports.push(port);return port;}
function setup(){const store=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]]));return {...store,port:attach(store.db)};}
async function populated(){const s=setup(),c=new SessionController(s.port);await c.init();await c.adjustBankroll(123456,'Before deletion');await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');expect(c.data!.hands).toHaveLength(1);return {...s,c};}
let initialSequence=0;
async function freshInitial():Promise<AppData>{const data:AppData={schemaVersion:4,revision:0,epoch:0,wallet:0,initialBankroll:1000000,ledger:[],sessions:[],hands:[],active:null,importedHands:[]};await appendMoney(data,{id:`independent-fresh-${++initialSequence}`,at:'2026-11-01T00:00:00.000Z',epoch:0,kind:'adjustment',walletDelta:1000000,tableDelta:0,pokerNet:0,note:'Initial virtual bankroll'});return data;}
const pending=(c:SessionController)=>(c as unknown as {failed:{expected:number|null;next:AppData}|null}).failed;
const marker=():ErasureMarker=>({format:'ai-texas-hold-em-erasure',version:1,id:'independent-erasure-marker',erasedAt:'2026-11-01T00:00:00.000Z'});
afterEach(()=>{for(const port of ports.splice(0))port.close();vi.unstubAllGlobals();});
describe('Independent M12 actual persistence/controller erasure integration',()=>{
 it('clears populated canonical records, segments and snapshots atomically, then explicitly creates an independent wallet',async()=>{
  const s=await populated(),old=s.c.data!,oldIds=old.ledger.map(e=>e.id);expect([...s.records.keys()].some(k=>k.startsWith('v2:hands:'))).toBe(true);
  s.records.set('pre-migration-v3',{private:'old snapshot'});s.records.set('pre-segment-v1',{private:'older snapshot'});
  await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(s.c.status).toBe('deleted');expect(s.c.data).toBeNull();expect(pending(s.c)).toBeNull();expect([...s.records.keys()].sort()).toEqual(['erasure','lease']);
  await s.c.startFreshPracticeData();expect(s.c.status).toBe('ready');expect(s.c.data!.wallet).toBe(1000000);expect(s.c.data!.hands).toEqual([]);expect(s.c.data!.sessions).toEqual([]);expect(s.c.data!.ledger).toHaveLength(1);expect(oldIds).not.toContain(s.c.data!.ledger[0].id);await validateData(s.c.data!);
 });
 it.each(['clear','erasure','lease'] as const)('an actual port abort at %s preserves every populated byte and permits one successful retry',async fail=>{
  const s=await populated(),before=canonical([...s.records]),state=s.c.data;
  if(fail==='clear')s.fault.clear=true;else s.fault.put=fail;
  await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(s.c.error).toMatch(/did not commit/);expect(s.c.status).toBe('ready');expect(s.port.deleted).toBe(false);expect(s.c.data).toBe(state);expect(canonical([...s.records])).toBe(before);
  await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(s.c.status).toBe('deleted');expect([...s.records.keys()].sort()).toEqual(['erasure','lease']);
 });
 it.each(['v2:ledger:000000000000','current','erasure','lease'] as const)('failed fresh-start %s mutation preserves the deletion marker and does not initialize a wallet',async fail=>{
  const s=await populated();await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const before=canonical([...s.records]);if(fail==='erasure')s.fault.delete=fail;else s.fault.put=fail;
  await s.c.startFreshPracticeData();expect(s.c.status).toBe('deleted');expect(s.port.deleted).toBe(true);expect(s.c.data).toBeNull();expect(canonical([...s.records])).toBe(before);
  await s.c.startFreshPracticeData();expect(s.c.status).toBe('ready');expect(s.c.data!.ledger).toHaveLength(1);
 });
 it('a newly opened controller sees deletion without silently creating an initial bankroll',async()=>{
  const s=await populated();await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const before=canonical([...s.records]),port=attach(s.db),c=new SessionController(port);await c.init();expect(c.status).toBe('deleted');expect(c.data).toBeNull();expect(pending(c)).toBeNull();expect(canonical([...s.records])).toBe(before);await c.retry();expect(c.status).toBe('deleted');expect(canonical([...s.records])).toBe(before);
 });
 it('a null-revision failed initial write is discarded when its retry observes deletion',async()=>{
  const s=setup(),old=new SessionController(s.port);s.fault.put='current';await old.init();expect(old.status).toBe('error');expect(pending(old)?.expected).toBeNull();const oldEvent=pending(old)!.next.ledger[0].id;
  const fresh=new SessionController(attach(s.db));await fresh.init();await fresh.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await old.retry();expect(old.status).toBe('deleted');expect(old.data).toBeNull();expect(pending(old)).toBeNull();await old.startFreshPracticeData();expect(old.status).toBe('ready');expect(old.data!.ledger[0].id).not.toBe(oldEvent);
 });
 it('stale loaded writer cannot resurrect old history while the deletion marker exists',async()=>{
  const s=await populated(),stale=attach(s.db),before=await stale.load(),next=draftSnapshot(before!);next.revision++;await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const bytes=canonical([...s.records]);await expect(stale.commit(before!.revision,next)).rejects.toBeInstanceOf(PracticeDataDeletedError);expect(canonical([...s.records])).toBe(bytes);
 });
 it('stale writer cannot resurrect old history after another port explicitly initializes a new wallet',async()=>{
  const s=await populated(),stale=attach(s.db),before=await stale.load(),next=draftSnapshot(before!);next.revision++;await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await s.c.startFreshPracticeData();const bytes=canonical([...s.records]);await expect(stale.commit(before!.revision,next)).rejects.toThrow(/revision changed/);expect(canonical([...s.records])).toBe(bytes);expect((await s.port.load())!.hands).toHaveLength(0);
 });
 it('a cached revision-zero manifest cannot match a new revision-zero wallet',async()=>{
  const s=setup(),c=new SessionController(s.port);await c.init();const stale=attach(s.db),before=await stale.load(),next=draftSnapshot(before!);next.revision++;await c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await c.startFreshPracticeData();expect(c.data!.revision).toBe(0);const bytes=canonical([...s.records]);await expect(stale.commit(0,next)).rejects.toThrow(/revision changed/);expect(canonical([...s.records])).toBe(bytes);
 });
 it.each(['load','commit','erase','startFresh'] as const)('unknown future marker fails closed in %s without altering stored data',async method=>{
  const s=await populated(),before=s.c.data!,candidate=draftSnapshot(before);candidate.revision++;s.records.set(ERASURE_KEY,{...marker(),version:99});const bytes=canonical([...s.records]);
  const operation=method==='load'?s.port.load():method==='commit'?s.port.commit(before.revision,candidate):method==='erase'?s.port.erase(before.revision):s.port.startFresh(await freshInitial());await expect(operation).rejects.toThrow();expect(canonical([...s.records])).toBe(bytes);
 });
 it.each(['erase','startFresh'] as const)('ownership loss inside %s transaction prevents every mutation',async operation=>{
  const s=await populated();if(operation==='startFresh')await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);s.records.set('lease',{owner:'other-tab',expires:Date.now()+12000});const before=canonical([...s.records]);await expect(operation==='erase'?s.port.erase(s.c.data!.revision):s.port.startFresh(await freshInitial())).rejects.toThrow(/Another tab/);expect(canonical([...s.records])).toBe(before);
 });
 it('a stale manifest cannot erase a newer save even when its caller supplies the new revision',async()=>{
  const s=await populated(),stale=attach(s.db);await stale.load();await s.c.adjustBankroll(999999,'Newer state');const before=canonical([...s.records]);await expect(stale.erase(s.c.data!.revision)).rejects.toThrow(/revision changed/);expect(canonical([...s.records])).toBe(before);
 });
 it.each(['','DELETE','delete all practice data',' DELETE ALL PRACTICE DATA '])('confirmation %j is refused without touching persisted data',async confirmation=>{
  const s=await populated(),before=canonical([...s.records]);await s.c.deleteSavedPracticeData(confirmation);expect(s.c.status).toBe('ready');expect(s.c.error).toMatch(/exact deletion confirmation/);expect(canonical([...s.records])).toBe(before);
 });
 it.each(['preflop','complete'] as const)('an active %s table requires legitimate cashout before deletion',async street=>{
  const s=setup(),c=new SessionController(s.port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});if(street==='complete'){const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);}expect(c.data!.active!.game.street).toBe(street);const before=canonical([...s.records]);await c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(c.error).toMatch(/End and cash out/);expect(c.status).toBe('ready');expect(canonical([...s.records])).toBe(before);
 });
 it('start fresh without prior deletion cannot erase or replace an existing save',async()=>{
  const s=await populated(),before=canonical([...s.records]);await s.c.startFreshPracticeData();expect(s.c.error).toMatch(/Delete saved practice data/);expect(s.c.status).toBe('ready');expect(canonical([...s.records])).toBe(before);
 });
 it('a tab that observed deletion can reload an explicitly fresh wallet created in another tab and keep writing',async()=>{
  vi.stubGlobal('navigator',{});
  const s=await populated(),oldPort=attach(s.db,'second-tab'),old=new SessionController(oldPort);await oldPort.takeOver();await old.init();await s.port.takeOver();await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await old.retry();expect(old.status).toBe('deleted');await s.c.startFreshPracticeData();const freshId=s.c.data!.ledger[0].id;
  await oldPort.takeOver();await old.retry();expect(old.status).toBe('ready');expect(old.data!.ledger[0].id).toBe(freshId);await old.adjustBankroll(900000,'After another tab explicitly restarted');expect(old.status).toBe('ready');expect(old.data!.wallet).toBe(900000);
 });
 it('an interrupted explicit fresh start never revives an unseen pre-deletion null-revision pending write',async()=>{
  vi.stubGlobal('navigator',{});
  const s=setup(),old=new SessionController(s.port);s.fault.put='current';await old.init();const oldId=pending(old)!.next.ledger[0].id;
  const freshPort=attach(s.db,'second-tab'),fresh=new SessionController(freshPort);await freshPort.takeOver();await fresh.init();await fresh.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await freshPort.startFresh(await freshInitial()); // Simulate interruption after atomic restart, before the controller reloads it.
  freshPort.close();s.port.writable=false; // Real old port now reacquires the released lease; controller still has its unseen failed write.
  await old.retry();expect(old.data?.ledger.some(event=>event.id===oldId)??false).toBe(false);expect(pending(old)).toBeNull();if(old.status==='ready')await validateData(old.data!);else expect(old.status).toBe('deleted');
 });

 it('a pre-deletion failed ordinary write at revision zero cannot replace a fresh revision-zero wallet on retry',async()=>{
  vi.stubGlobal('navigator',{});
  const s=setup(),old=new SessionController(s.port);await old.init();const oldInitial=old.data!.ledger[0].id;s.fault.put='current';await old.adjustBankroll(123456,'Stale pre-deletion adjustment');expect(old.status).toBe('error');expect(pending(old)?.expected).toBe(0);
  const otherPort=attach(s.db,'second-tab'),other=new SessionController(otherPort);await otherPort.takeOver();await other.init();await other.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await other.startFreshPracticeData();const freshId=other.data!.ledger[0].id;expect(freshId).not.toBe(oldInitial);expect(other.data!.revision).toBe(0);
  await s.port.takeOver();await old.retry();const actual=await s.port.load();expect(actual!.wallet).toBe(1000000);expect(actual!.ledger).toHaveLength(1);expect(actual!.ledger[0].id).toBe(freshId);expect(actual!.ledger.some(e=>e.note==='Stale pre-deletion adjustment')).toBe(false);
  expect(old.status).toBe('ready');expect(old.data!.ledger[0].id).toBe(freshId);expect(pending(old)).toBeNull();
 });

 it('lost acknowledgement after atomic restart recovers the one committed initial event through Retry',async()=>{
  const s=await populated();await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const actual=s.port.startFresh.bind(s.port);vi.spyOn(s.port,'startFresh').mockImplementationOnce(async data=>{await actual(data);throw new Error('Simulated lost acknowledgement');});
  await s.c.startFreshPracticeData();expect(s.c.error).toBe('Simulated lost acknowledgement');expect(s.c.status).toBe('deleted');const saved=await s.port.load();expect(saved!.ledger).toHaveLength(1);const id=saved!.ledger[0].id;await s.c.retry();expect(s.c.status).toBe('ready');expect(s.c.data!.ledger).toHaveLength(1);expect(s.c.data!.ledger[0].id).toBe(id);await s.c.retry();expect(s.c.data!.ledger[0].id).toBe(id);
 });
 it('restart cannot reintroduce an old populated canonical snapshot',async()=>{
  const s=await populated(),old=structuredClone(s.c.data!);old.revision=0;await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const bytes=canonical([...s.records]);await expect(s.port.startFresh(old)).rejects.toThrow(/empty explicitly initialized/);expect(canonical([...s.records])).toBe(bytes);
 });
 it('two concurrent explicit restart attempts commit only one initial event',async()=>{
  const s=await populated();await s.c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);const a=attach(s.db),b=attach(s.db),first=await freshInitial(),second=await freshInitial(),results=await Promise.allSettled([a.startFresh(first),b.startFresh(second)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);const saved=await s.port.load();expect(saved!.ledger).toHaveLength(1);expect([first.ledger[0].id,second.ledger[0].id]).toContain(saved!.ledger[0].id);await validateData(saved!);
 });

});
