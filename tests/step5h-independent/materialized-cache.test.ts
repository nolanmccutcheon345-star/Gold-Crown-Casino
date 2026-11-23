import {beforeAll,describe,expect,it} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {prepareSegments} from '../../src/storage/segments';
import {auditSnapshot,totalHandCount} from '../../src/storage/verified';
import {transactionReference} from '../step36/transaction-reference';
import {encode,hash} from '../step5d-independent/reference';
import {replayAccounting} from '../step5c-independent/accounting-reference';

const HANDS=124,owner='step5h-independent-memory-owner';
class Memory implements PersistencePort {data:AppData|null=null;async load(){return this.data;}async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=next;}close(){}}
let original:AppData,store:Map<string,unknown>;
function attach(db:IDBDatabase){Object.assign(db,{close:()=>{}});const p=new BrowserPersistence('ai-texas-step5h-independent-memory');Object.assign(p,{db,owner,writable:true});return p;}
const bytes=(rows:Map<string,unknown>)=>encode([...rows].sort(([a],[b])=>a.localeCompare(b)));
beforeAll(async()=>{
 const c=new SessionController(new Memory());await c.init();
 for(let i=0;i<HANDS;i++){await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');}
 original=c.data!;c.close();const p=await prepareSegments(original,null,null,{packHands:true});store=new Map<string,unknown>([['current',p.envelope],['lease',{owner,expires:Date.now()+12000}]]);
 for(const w of [...p.writes,...(p.replicas??[])])store.set(w.key,w.entry);
},60000);
async function setup(){const s=transactionReference(store);await attach(s.db).load();const port=attach(s.db),controller=new SessionController(port);await controller.init();expect(controller.data!.hands).toHaveLength(120);return {...s,port,controller};}

describe('Step5H independent materialized-history release before a second full scan',()=>{
 it('returns to the exact verified compact predecessor before audit storage executes, preserving every financial and historical byte',async()=>{
  const s=await setup(),compact=s.controller.data!,stored=bytes(s.records),audit=s.port.auditCanonicalArchive.bind(s.port);await s.controller.loadFullHistory();expect(s.controller.historyLoaded).toBe(true);let calls=0;
  Object.assign(s.port,{auditCanonicalArchive:async()=>{calls++;expect(s.controller.data).toBe(compact);expect(s.controller.data!.hands).toHaveLength(120);expect(s.controller.busy).toBe(true);return audit();}});
  const receipt=await s.controller.auditSavedArchive();expect(receipt.hands).toBe(HANDS);expect(calls).toBe(1);expect(s.controller.historyLoaded).toBe(false);expect(bytes(s.records)).toBe(stored);
  expect(hash(await s.port.loadFullHistory())).toBe(hash(original));expect(replayAccounting(await s.port.loadFullHistory())).toEqual(replayAccounting(original));
 });
 it('drops only disposable full-history residency when audit fails and preserves the saved account for retry',async()=>{
  const s=await setup(),compact=s.controller.data!,stored=bytes(s.records);await s.controller.loadFullHistory();
  Object.assign(s.port,{auditCanonicalArchive:async()=>{expect(s.controller.data).toBe(compact);throw Error('Independent injected archive read failure');}});
  await expect(s.controller.auditSavedArchive()).rejects.toThrow(/injected archive read failure/);expect(s.controller.data).toBe(compact);expect(s.controller.busy).toBe(false);expect(bytes(s.records)).toBe(stored);
  expect(replayAccounting(await s.port.loadFullHistory())).toEqual(replayAccounting(original));
 });
 it('releases full-history residency before explicit maintenance, keeps mutations locked, then verifies the same committed state',async()=>{
  const s=await setup(),compact=s.controller.data!,maintenance=s.port.optimizeStorage.bind(s.port);await s.controller.loadFullHistory();let called=0;
  Object.assign(s.port,{optimizeStorage:async()=>{called++;expect(s.controller.data).toBe(compact);expect(s.controller.busy).toBe(true);await s.controller.adjustBankroll(999999999,'must stay blocked');expect(s.controller.data).toBe(compact);await maintenance();}});
  const receipt=await s.controller.compactSavedHistory();expect(called).toBe(1);expect(receipt).toEqual({revision:original.revision,hands:HANDS,wallet:original.wallet,currentState:'verified-unchanged'});
  expect(s.controller.data).toBe(compact);expect(hash(await s.port.loadFullHistory())).toBe(hash(original));
 });
 it('rejects same-revision nonfinancial header substitution before remembering a compact predecessor',async()=>{
  const s=await setup(),compact=s.controller.data!,read=s.port.loadFullHistory.bind(s.port);
  Object.assign(s.port,{loadFullHistory:async()=>{const full=structuredClone(await read());full.userNotes={version:1,revision:0,entries:[]};return auditSnapshot(full);}});
  await expect(s.controller.loadFullHistory()).rejects.toThrow(/state changed|header|snapshot/i);expect(s.controller.data).toBe(compact);expect(s.controller.busy).toBe(false);expect(totalHandCount(s.controller.data!)).toBe(HANDS);
 });
 it('rejects a valid but different canonical hand chain with identical finances instead of binding it to the old compact history',async()=>{
  const s=await setup(),compact=s.controller.data!,read=s.port.loadFullHistory.bind(s.port);
  Object.assign(s.port,{loadFullHistory:async()=>{
   const full=structuredClone(await read());full.hands[0].startedAt='2000-01-01T00:00:00.000Z';let previous='0'.repeat(64);
   for(const hand of full.hands){hand.previousHash=previous;const {hash:_,...body}=hand;void _;hand.hash=hash(body);previous=hand.hash;}
   const verified=await auditSnapshot(full);expect(replayAccounting(verified)).toEqual(replayAccounting(original));return verified;
  }});
  await expect(s.controller.loadFullHistory()).rejects.toThrow(/state changed|history|hand|snapshot/i);expect(s.controller.data).toBe(compact);expect(s.controller.busy).toBe(false);
 });
 it('audit refusal during an active cash session leaves its committed cards, chips and pending state untouched',async()=>{
  const s=await setup();await s.controller.startSession({...DEFAULT_SETTINGS,seats:2});const before=hash(s.controller.data),stored=bytes(s.records);
  await expect(s.controller.auditSavedArchive()).rejects.toThrow(/End and cash out/);await expect(s.controller.compactSavedHistory()).rejects.toThrow(/End and cash out/);
  expect(hash(s.controller.data)).toBe(before);expect(bytes(s.records)).toBe(stored);
 });
});
