import {afterEach,describe,expect,it} from 'vitest';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {DELETE_PRACTICE_CONFIRMATION,PracticeDataDeletedError} from '../../src/storage/erasure';
import {draftSnapshot} from '../../src/storage/verified';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
import {encode} from './reference';
const owner='step5d-independent-lifecycle',ports:BrowserPersistence[]=[];
function attach(db:IDBDatabase){const port=new BrowserPersistence('step5d-independent-lifecycle');Object.assign(port,{db,owner,writable:true});ports.push(port);return port;}
afterEach(()=>{for(const p of ports.splice(0))p.close();});
async function setup(){const fake=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]])),port=attach(fake.db),c=new SessionController(port);await c.init();return {...fake,port,c};}
describe('Step5D independent read-side representation lifecycle',()=>{
 it('keeps fresh creation load inert before any hand so the originating controller can commit',async()=>{
  const {records,db,c}=await setup(),bytes=encode([...records]),second=attach(db);await second.load();
  expect(encode([...records])).toBe(bytes);await c.adjustBankroll(900000,'owner continues after another reader');expect(c.status).toBe('ready');expect(c.error).toBe('');expect(c.data!.wallet).toBe(900000);
 });
 it('commits actual deletion after a second loaded port and then rejects resurrection against its marker',async()=>{
  const {records,db,c}=await setup();await c.startSession({...DEFAULT_SETTINGS,seats:2});const game=c.data!.active!.game;await c.act({type:'fold'},game.handId,game.revision);await c.cashOut();
  const second=attach(db),before=await second.load(),next=draftSnapshot(before!);next.revision++;
  await c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(c.status).toBe('deleted');expect(c.error).toBe('');expect([...records.keys()].sort()).toEqual(['erasure','lease']);
  const bytes=encode([...records]);await expect(second.commit(before!.revision,next)).rejects.toBeInstanceOf(PracticeDataDeletedError);expect(encode([...records])).toBe(bytes);
 });
 it('keeps explicitly restarted revision-zero load inert and never revives the previous wallet identity',async()=>{
  const {records,db,c}=await setup(),oldId=c.data!.ledger[0].id;await c.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);await c.startFreshPracticeData();expect(c.status).toBe('ready');
  const newId=c.data!.ledger[0].id,bytes=encode([...records]);expect(newId).not.toBe(oldId);await attach(db).load();expect(encode([...records])).toBe(bytes);
  await c.adjustBankroll(777777,'explicitly restarted owner continues');expect(c.status).toBe('ready');expect(c.data!.wallet).toBe(777777);expect(c.data!.ledger[0].id).toBe(newId);
 });
});
