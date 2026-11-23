import {describe,it,expect,vi,afterEach} from 'vitest';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {canonical,parsePublicHistory,validateData} from '../../src/storage/integrity';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
const opened:BrowserPersistence[]=[];
function attach(db:IDBDatabase,owner='quota-owner'){const port=new BrowserPersistence('ai-texas-step5b-quota-reference');Object.assign(port,{db,owner,writable:true});opened.push(port);return port;}
function setup(){const reference=idbReference(new Map<string,unknown>([['lease',{owner:'quota-owner',expires:Date.now()+12000}]]));const fault={quotaKey:null as string|null};const db={close(){},transaction(...args:Parameters<IDBDatabase['transaction']>){const tx=reference.db.transaction(...args),store=tx.objectStore('kv'),put=store.put.bind(store);store.put=((value:unknown,key?:IDBValidKey)=>{if(key===fault.quotaKey){fault.quotaKey=null;throw new DOMException('Injected private snapshot quota exhaustion','QuotaExceededError');}return put(value,key);}) as typeof store.put;return tx;}} as IDBDatabase;return {...reference,db,fault,port:attach(db)};}
async function ready(){const s=setup(),c=new SessionController(s.port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});let g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();await c.startSession({...DEFAULT_SETTINGS,seats:2});g=c.data!.active!.game;expect(g.actor).toBe(0);expect(c.data!.hands).toHaveLength(1);return {...s,c,handId:g.handId,revision:g.revision};}
afterEach(()=>{for(const port of opened.splice(0))port.close();vi.unstubAllGlobals();});
describe('V708 actual port quota/stale ownership recovery, automated reference only',()=>{
 it.each(['v2:hands:000000000001','current'])('quota failure at %s pauses actions, retains exportable committed history and retries settlement once',async key=>{
  const s=await ready(),before=canonical([...s.records]),old=s.c.data!;s.fault.quotaKey=key;await s.c.act({type:'fold'},s.handId,s.revision);expect(s.c.status).toBe('error');expect(s.c.error).toMatch(/QuotaExceededError/);expect(s.c.data).toBe(old);expect(canonical([...s.records])).toBe(before);
  await s.c.act({type:'fold'},s.handId,s.revision);await s.c.prepareBot();await s.c.nextHand();expect(canonical([...s.records])).toBe(before);expect(s.c.data).toBe(old);
  const exported=await s.c.exportHistory(),parsed=await parsePublicHistory(JSON.stringify(exported));expect(parsed).toHaveLength(1);expect(parsed[0].handId).toBe(old.hands[0].id);expect(JSON.stringify(exported)).not.toContain('privateProfiles');expect(JSON.stringify(exported)).not.toContain('personalitySeed');
  await s.c.retry();expect(s.c.status).toBe('ready');expect(s.c.data!.hands).toHaveLength(2);expect(s.c.data!.ledger.filter(e=>e.handId===s.handId&&e.kind==='hand-net')).toHaveLength(1);const settled=canonical(s.c.data);await s.c.retry();expect(canonical(s.c.data)).toBe(settled);
  const reopened=new SessionController(attach(s.db));await reopened.init();expect(reopened.status).toBe('ready');expect(canonical(reopened.data)).toBe(settled);await validateData(reopened.data!);
 });
 it('reload after quota failure before Retry restores the last committed active hand without erasing bankroll or existing history',async()=>{
  const s=await ready(),before=s.c.data!;s.fault.quotaKey='current';await s.c.act({type:'fold'},s.handId,s.revision);expect(s.c.status).toBe('error');const reopened=new SessionController(attach(s.db));await reopened.init();expect(reopened.status).toBe('ready');expect(canonical(reopened.data)).toBe(canonical(before));await reopened.act({type:'fold'},s.handId,s.revision);expect(reopened.data!.hands).toHaveLength(2);expect(reopened.data!.ledger.filter(e=>e.handId===s.handId)).toHaveLength(1);await validateData(reopened.data!);
 });
 it('lost acknowledgement after a committed payout reloads and clears the retry candidate without double settlement',async()=>{
  const s=await ready(),commit=s.port.commit.bind(s.port);vi.spyOn(s.port,'commit').mockImplementationOnce(async(expected,next)=>{await commit(expected,next);throw new Error('Injected lost acknowledgement after payout');});await s.c.act({type:'fold'},s.handId,s.revision);expect(s.c.status).toBe('error');expect(s.c.data!.hands).toHaveLength(1);await s.c.retry();expect(s.c.status).toBe('ready');expect(s.c.data!.hands).toHaveLength(2);expect(s.c.data!.ledger.filter(e=>e.handId===s.handId)).toHaveLength(1);const bytes=canonical([...s.records]);await s.c.retry();expect(canonical([...s.records])).toBe(bytes);
 });
 it('cross-tab lease theft during failed settlement keeps old tab read-only and allows export before takeover recovery',async()=>{
  vi.stubGlobal('navigator',{});const s=await ready(),otherPort=attach(s.db,'second-owner');await otherPort.takeOver();const before=canonical([...s.records]);await s.c.act({type:'fold'},s.handId,s.revision);expect(s.c.status).toBe('readonly');expect(s.c.error).toMatch(/Another tab/);expect(canonical([...s.records])).toBe(before);expect((await parsePublicHistory(JSON.stringify(await s.c.exportHistory())))).toHaveLength(1);
  const other=new SessionController(otherPort);await other.init();await other.act({type:'fold'},s.handId,s.revision);expect(other.data!.hands).toHaveLength(2);await s.c.takeOver();expect(s.c.status).toBe('ready');expect(canonical(s.c.data)).toBe(canonical(other.data));expect(s.c.data!.ledger.filter(e=>e.handId===s.handId)).toHaveLength(1);await validateData(s.c.data!);
 });
});
