import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {parsePublicHistory} from '../../src/storage/integrity';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
import {referenceEncode,referenceFinancial,financialInput,referenceFullHands} from '../step5e-independent/financial-reference';

const owner='independent-step5f-quota';
function attach(db:IDBDatabase){const port=new BrowserPersistence('ai-texas-step5f-quota');Object.assign(port,{db,owner,writable:true});return port;}
function evidence(name:string,value:unknown){const output=process.env.STEP5F_INDEPENDENT_EVIDENCE;if(!output)return;mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`${name}.json`),JSON.stringify(value,null,2)+'\n');}

describe('Step5F independent interrupted-write and export boundaries',()=>{
 it('preserves committed canonical hands and read-only export after failed settlement write, then retries exactly once',async()=>{
  const s=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]])),c=new SessionController(attach(s.db));
  try{
   await c.init();await c.adjustBankroll(2345678,'Independent manual adjustment');await c.startSession({...DEFAULT_SETTINGS,seats:2});
   let g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);expect(c.data!.hands).toHaveLength(1);await c.cashOut();await c.startSession({...DEFAULT_SETTINGS,seats:2});
   g=c.data!.active!.game;expect(g.street).not.toBe('complete');const before=referenceFinancial(financialInput(c.data!)),canonicalBefore=referenceEncode([...s.records]),oldHand=c.data!.hands[0];
   s.fault.put='current';await c.act({type:'fold'},g.handId,g.revision);expect(c.status).toBe('error');expect(referenceEncode([...s.records])).toBe(canonicalBefore);expect(c.data!.hands).toHaveLength(1);
   const exported=await c.exportHistoryBatch(),imported=await parsePublicHistory(exported.text);expect(imported).toHaveLength(1);expect(imported[0].handId).toBe(oldHand.id);expect(c.status).toBe('error');expect(referenceEncode([...s.records])).toBe(canonicalBefore);
   await c.retry();expect(c.status).toBe('ready');expect(c.data!.hands).toHaveLength(2);expect(c.data!.ledger.filter(e=>e.kind==='hand-net'&&e.handId===g.handId)).toHaveLength(1);
   const after=referenceFinancial(financialInput(c.data!)),audit=referenceFullHands(c.data!.hands);expect(after.poker).toBe(audit.poker);expect(after.manual).toBe(2345678);
   await c.cashOut();const closed=referenceFinancial(financialInput(c.data!));await c.cashOut();expect(referenceFinancial(financialInput(c.data!))).toEqual(closed);expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(2);
   evidence('failed-write-export-retry',{method:'Actual BrowserPersistence against serialized transactional reference with injected final-current put failure; independent BigInt financial and canonical event/hash replay.',before,after,closed,audit,priorHandPreserved:c.data!.hands[0].hash===oldHand.hash,studyExportImported:imported.length,settlementsForRetriedHand:c.data!.ledger.filter(e=>e.kind==='hand-net'&&e.handId===g.handId).length,cashouts:c.data!.ledger.filter(e=>e.kind==='cash-out').length});
  }finally{c.close();}
 });
 for(const change of ['erase','replace'] as const)it(`rejects a stale all-resident batch after another reader observes an account ${change}`,async()=>{
  const s=idbReference(new Map<string,unknown>([['lease',{owner,expires:Date.now()+12000}]])),writer=attach(s.db),c=new SessionController(writer);
  let reader:SessionController|null=null;
  try{
   await writer.takeOver();await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const game=c.data!.active!.game;await c.act({type:'fold'},game.handId,game.revision);await c.cashOut();
   const port=attach(s.db);Object.assign(port,{owner:'independent-other-readonly',writable:false});reader=new SessionController(port);await reader.init();expect(reader.status).toBe('readonly');expect(reader.data!.hands).toHaveLength(1);
   const before=referenceEncode([...s.records]),prior=referenceFinancial(financialInput(reader.data!));const allowed=await reader.exportHistoryBatch();expect((await parsePublicHistory(allowed.text)).length).toBe(1);expect(referenceEncode([...s.records])).toBe(before);
   if(change==='erase')await writer.erase(c.data!.revision);else await c.adjustBankroll(3456789,'Other writer revision after readonly snapshot');
   const changed=referenceEncode([...s.records]);await expect(reader.exportHistoryBatch()).rejects.toThrow(/missing|revision changed/i);expect(referenceEncode([...s.records])).toBe(changed);expect(reader.status).toBe('readonly');expect(referenceFinancial(financialInput(reader.data!))).toEqual(prior);expect(reader.busy).toBe(false);
   evidence(`bounded-export-${change}-fence`,{method:'Production controller and BrowserPersistence with actual readonly second owner; one resident hand; serialized IDB protocol reference.',prior,ordinaryReadonlyExportHands:allowed.history.hands.length,staleExportRejected:true,storageUnchangedByExport:true,cachedReaderFinancialUnchanged:true,limitation:'This verifies application protocol behavior, not a native browser multitasking or storage eviction result.'});
  }finally{reader?.close();c.close();}
 });
});
