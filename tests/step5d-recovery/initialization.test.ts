import {afterEach,describe,expect,it} from 'vitest';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {canonical,digest,validateData} from '../../src/storage/integrity';
import type {SegmentedEnvelope} from '../../src/storage/segments';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
const owner='step5d-initialization-owner',ports:BrowserPersistence[]=[];
function attach(db:IDBDatabase){const p=new BrowserPersistence('step5d-initialization');Object.assign(p as unknown as {db:IDBDatabase;owner:string},{db,owner});p.writable=true;ports.push(p);return p;}
function setup(){const store=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]]));return {...store,port:attach(store.db)};}
afterEach(()=>{for(const p of ports.splice(0))p.close();});
describe('Step5D packed initialization preserves concurrent-read and migration invariants',()=>{
 it('fresh zero-hand save establishes its descriptor once without replacing its initial ledger identity on another read',async()=>{
  const s=setup(),c=new SessionController(s.port);await c.init();expect(c.error).toBe('');const first=c.data!.ledger[0],current=s.records.get('current') as SegmentedEnvelope;
  expect(current.packedHands).toEqual({version:1,count:0,tail:current.segments.hands.tail});const bytes=canonical([...s.records]),reader=attach(s.db),loaded=await reader.load();
  expect(canonical([...s.records])).toBe(bytes);expect(loaded!.ledger).toHaveLength(1);expect(loaded!.ledger[0]).toEqual(first);expect(loaded!.hands).toHaveLength(0);
  await c.adjustBankroll(987654,'Original writer remains current after an inert read');expect(c.error).toBe('');expect(c.data!.wallet).toBe(987654);expect(c.data!.ledger[0]).toEqual(first);await validateData(c.data!);
 });
 it('existing populated v2 upgrade preserves previous and repeated same-owner reads are inert',async()=>{
  const s=setup(),c=new SessionController(s.port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');
  const current=structuredClone(s.records.get('current')) as SegmentedEnvelope;delete current.packedHands;const {checksum:oldChecksum,...body}=current;expect(oldChecksum).toBeTruthy();current.checksum=await digest(body);s.records.set('current',current);
  const prior=s.records.get('previous'),ledger=canonical(c.data!.ledger),reader=attach(s.db),upgraded=await reader.load();expect((s.records.get('current') as SegmentedEnvelope).packedHands?.count).toBe(1);expect(s.records.get('previous')).toEqual(prior);expect(canonical(upgraded!.ledger)).toBe(ledger);
  const bytes=canonical([...s.records]);expect(await reader.load()).toEqual(upgraded);expect(await attach(s.db).load()).toEqual(upgraded);expect(canonical([...s.records])).toBe(bytes);await validateData(upgraded!);
 });
});
