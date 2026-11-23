import {beforeAll,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {BrowserPersistence} from '../../src/storage/browser';
import {auditSnapshot,getArchiveContext,isVerifiedSnapshot,totalHandCount} from '../../src/storage/verified';
import {prepareSegments} from '../../src/storage/segments';
import {canonical,publicHistory} from '../../src/storage/integrity';
import {AsyncCashStats} from '../../src/ui/async-cash-stats';
import {transactionReference} from '../step36/transaction-reference';
import {financialInput,referenceFinancial} from '../step5e-independent/financial-reference';
class Memory implements PersistencePort {data:AppData|null=null;async load(){return this.data;}async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=next;}close(){}}
let original:AppData;
beforeAll(async()=>{const c=new SessionController(new Memory());await c.init();for(let i=0;i<124;i++){await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');}original=c.data!;c.close();},30000);
async function fixture(){const owner='step5h-resident-audit',p=await prepareSegments(original,null,null,{packHands:true}),records=new Map<string,unknown>([['current',p.envelope],['lease',{owner,expires:Date.now()+12000}]]);for(const row of [...p.writes,...p.replicas??[]])records.set(row.key,row.entry);const storage=transactionReference(records);Object.assign(storage.db,{close:()=>{}});const port=new BrowserPersistence('ai-texas-step5h-resident-test');Object.assign(port,{db:storage.db,owner,writable:true});await port.load();const c=new SessionController(port);await c.init();expect(c.status).toBe('ready');expect(c.data!.hands).toHaveLength(120);return{c,port,...storage};}
const proof=(data:AppData)=>referenceFinancial({...financialInput(data),...(getArchiveContext(data)?{handIndex:getArchiveContext(data)!.handIndex}:{})});
describe('Step5H explicit maintenance releases materialized history before full independent reconstruction',()=>{
 it.each(['audit','compact'] as const)('uses the exact verified compact predecessor before %s, preserving all financial and history evidence',async mode=>{
  const {c,port,records}=await fixture(),compact=c.data!,ledger=compact.ledger,expected=proof(compact),before=canonical([...records].filter(([key])=>key.startsWith('v2:'))),stats=new AsyncCashStats(()=>{}).readData(compact,0);
  await c.loadFullHistory();expect(c.historyLoaded).toBe(true);expect(c.data!.hands).toHaveLength(124);
  const observed:number[]=[];c.subscribe(()=>observed.push(c.data!.hands.length));
  const assertReleased=()=>{expect(c.busy).toBe(true);expect(c.data).toBe(compact);expect(c.data!.ledger).toBe(ledger);expect(isVerifiedSnapshot(c.data!)).toBe(true);expect(c.historyLoaded).toBe(false);expect(proof(c.data!)).toEqual(expected);};
  const audit=port.auditCanonicalArchive.bind(port),optimize=port.optimizeStorage.bind(port);
  const spy=mode==='audit'?vi.spyOn(port,'auditCanonicalArchive').mockImplementation(async()=>{assertReleased();return audit();}):vi.spyOn(port,'optimizeStorage').mockImplementation(async()=>{assertReleased();return optimize();});
  if(mode==='audit')expect((await c.auditSavedArchive()).hands).toBe(124);else expect((await c.compactSavedHistory()).hands).toBe(124);
  expect(spy).toHaveBeenCalledOnce();spy.mockRestore();expect(observed).toContain(120);expect(c.data).toBe(compact);expect(c.busy).toBe(false);expect(c.status).toBe('ready');expect(totalHandCount(c.data!)).toBe(124);expect(canonical([...records].filter(([key])=>key.startsWith('v2:')))).toBe(before);expect(new AsyncCashStats(()=>{}).readData(c.data,0)).toEqual(stats);
  await c.loadFullHistory();expect(c.data!.hands).toEqual(original.hands);expect(proof(c.data!)).toEqual(expected);expect(await c.exportHistory()).toEqual(await publicHistory(original.hands));c.close();
 });
 it('compacts a verified full snapshot without a read predecessor using the existing private capability',async()=>{
  const {c,port}=await fixture();c.data=await port.loadFullHistory();const ledger=c.data.ledger,expected=proof(c.data),method=port.auditCanonicalArchive.bind(port);
  vi.spyOn(port,'auditCanonicalArchive').mockImplementation(async()=>{expect(c.data!.hands).toHaveLength(120);expect(c.data!.ledger).toBe(ledger);expect(isVerifiedSnapshot(c.data!)).toBe(true);expect(proof(c.data!)).toEqual(expected);return method();});
  await c.auditSavedArchive();expect(c.historyLoaded).toBe(false);await c.loadFullHistory();expect(c.data!.hands).toEqual(original.hands);c.close();
 });
 it.each(['audit','compact'] as const)('preserves the recoverable compact commitment after %s failure and retries without payouts',async mode=>{
  const {c,port,records}=await fixture(),compact=c.data!,before=canonical([...records]),expected=proof(compact);await c.loadFullHistory();const method=mode==='audit'?'auditCanonicalArchive':'optimizeStorage';
  const spy=vi.spyOn(port,method).mockRejectedValueOnce(Error('Injected archive/quota failure'));
  await expect(mode==='audit'?c.auditSavedArchive():c.compactSavedHistory()).rejects.toThrow(/Injected/);expect(c.data).toBe(compact);expect(c.busy).toBe(false);expect(proof(c.data!)).toEqual(expected);expect(canonical([...records])).toBe(before);spy.mockRestore();
  if(mode==='compact'){expect(c.status).toBe('error');await c.adjustBankroll(9000000,'Must be blocked');expect(proof(c.data!)).toEqual(expected);await c.retry();}
  expect(c.status).toBe('ready');expect((await c.auditSavedArchive()).status).toBe('verified');await c.loadFullHistory();expect(c.data!.hands).toEqual(original.hands);expect(proof(c.data!)).toEqual(expected);c.close();
 });
 it('never reuses a predecessor after a committed manual adjustment and retains the latest non-poker event',async()=>{
  const {c,port}=await fixture();await c.loadFullHistory();await c.adjustBankroll(c.data!.wallet+10000,'After full history load');expect(c.error).toBe('');const expected=proof(c.data!),wallet=c.data!.wallet,ledger=c.data!.ledger;await c.auditSavedArchive();expect(c.data!.wallet).toBe(wallet);expect(c.data!.ledger).toBe(ledger);expect(proof(c.data!)).toEqual(expected);expect(expected.poker).toBe(proof(original).poker);expect((await port.loadFullHistory()).wallet).toBe(wallet);c.close();
 });
 it('blocks an unverified replacement before audit rather than blessing a truncated history cache',async()=>{
  const {c,port}=await fixture();await c.loadFullHistory();c.data=structuredClone(c.data);const spy=vi.spyOn(port,'auditCanonicalArchive');await expect(c.auditSavedArchive()).rejects.toThrow(/must be verified/);expect(spy).not.toHaveBeenCalled();expect(c.data!.hands).toHaveLength(124);expect(c.busy).toBe(false);c.close();
 });
 it('rejects changed non-hand metadata during expansion, without reverting notes or presets later',async()=>{
  const {c,port}=await fixture(),compact=c.data!;const changed=structuredClone(original);changed.initialBankroll+=1;await auditSnapshot(changed);vi.spyOn(port,'loadFullHistory').mockResolvedValue(changed);await expect(c.loadFullHistory()).rejects.toThrow(/Saved state changed/);expect(c.data).toBe(compact);c.close();
 });
 it('rejects ownership loss after resident release and before independent audit completion',async()=>{
  const {c,port}=await fixture(),compact=c.data!,work=port.auditCanonicalArchive.bind(port);await c.loadFullHistory();vi.spyOn(port,'auditCanonicalArchive').mockImplementation(async()=>{const result=await work();port.writable=false;return result;});await expect(c.auditSavedArchive()).rejects.toThrow(/revision changed/);expect(c.data).toBe(compact);expect(proof(c.data!)).toEqual(proof(original));expect(c.busy).toBe(false);c.close();
 });
 it('releases hidden Study, filtered Results and pending statistics caches synchronously on the compact snapshot notification',()=>{
  const source=readFileSync('src/ui/app.ts','utf8'),sync=source.slice(source.indexOf('function syncBody()'),source.indexOf('async function run('));expect(sync).toContain('if(historyWasFullyLoaded&&!controller.historyLoaded)');for(const statement of ['historySource=null','reviewCache=[]','originCache=new WeakMap()','filteredCache=null','statsProjection.reset()'])expect(sync).toContain(statement);expect(sync.indexOf('statsProjection.reset()')).toBeLessThan(sync.indexOf('render();'));expect(sync).toContain('historyWasFullyLoaded=controller.historyLoaded');
 });
});
