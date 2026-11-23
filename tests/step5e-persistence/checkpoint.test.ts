import {describe,expect,it} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {auditSnapshot} from '../../src/storage/verified';
import {digest,requireData} from '../../src/storage/integrity';
import {prepareSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {CHECKPOINT_INTERVAL,FAST_HEAD_KEY,FAST_PREVIOUS_KEY,prepareFastCommit,restoreFastState,journalKey,fastHeadMatches,obsoleteRecoveryKeys,type CompactHooks,type FastState,type FastPrepared,type RecoveryHead,type RecoveryJournal} from '../../src/storage/financial-checkpoint';

type Context={ids:string[];net:number};
type Delta={ids:string[];net:number};
const hooks:CompactHooks<Context,Delta>={
 async compact(data){return {data,context:{ids:data.hands.map(h=>h.id),net:data.hands.reduce((sum,h)=>sum+h.net,0)}};},
 async audit(data,context){requireData(context.ids.join('|')===data.hands.map(h=>h.id).join('|')&&context.net===data.hands.reduce((sum,h)=>sum+h.net,0),'Independent test context differs.');return auditSnapshot(data);},
 contextDelta(before,after){return{ids:after.ids.slice(before.ids.length),net:after.net-before.net};},
 applyContext(before,delta){return{ids:[...before.ids,...delta.ids],net:before.net+delta.net};},
};
class RecordingPort implements PersistencePort {
 data:AppData|null=null;snapshots:AppData[]=[];
 async load(){return this.data;}
 async commit(expected:number|null,data:AppData){expect(this.data?.revision??null).toBe(expected);this.data=data;this.snapshots.push(data);}
 close(){}
}
async function snapshots(hands=2){
 const port=new RecordingPort(),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});
 for(let i=0;i<hands;i++){
  const game=controller.data!.active!.game;
  if(game.actor!==0){await controller.prepareBot();await controller.commitBot(game.handId,game.revision);}
  const current=controller.data!.active!.game;if(current.street!=='complete')await controller.act({type:'fold'},current.handId,current.revision);
  if(i<hands-1&&controller.data!.active!.game.street==='complete')await controller.nextHand();
 }
 expect(controller.error).toBe('');controller.close();return port.snapshots;
}
async function stored(data:AppData[]){
 const rows=new Map<string,unknown>();let state:FastState<Context>|null=null,manifest:SegmentedEnvelope|null=null,prior:AppData|null=null;
 for(const value of data){const prepared=await prepareSegments(value,prior,manifest);manifest=prepared.envelope;const next:FastPrepared<Context>=await prepareFastCommit(value,manifest,state,hooks);for(const row of next.writes)rows.set(row.key,structuredClone(row.value));state=next.state;prior=value;}
 return {rows,state:state!,manifest:manifest!,read:async(keys:string[])=>keys.map(key=>structuredClone(rows.get(key)))};
}
async function reseal(value:{checksum:string}){const body={...value} as {checksum?:string};delete body.checksum;value.checksum=await digest(body);}
describe('Step5E independently audited bounded checkpoint and exactly-once journal',()=>{
 it('replays actual engine-produced decisions, settlement and wallet exactly once',async()=>{
  const source=await snapshots(),s=await stored(source),restored=await restoreFastState(s.rows.get(FAST_HEAD_KEY),s.manifest,s.read,hooks);
  expect(restored.payload.data).toEqual(source.at(-1));expect(restored.payload.context.ids).toEqual(source.at(-1)!.hands.map(h=>h.id));
  const repeated=await restoreFastState(s.rows.get(FAST_HEAD_KEY),s.manifest,s.read,hooks);expect(repeated.payload.data.ledger).toEqual(restored.payload.data.ledger);
 });
 it.each(['missing','duplicate','reordered','corrupt','stale-head','checkpoint-corrupt','offset-resealed','wallet-resealed'] as const)('rejects %s without mutating stored original records',async fault=>{
  const s=await stored(await snapshots()),head=structuredClone(s.rows.get(FAST_HEAD_KEY)) as RecoveryHead,key=journalKey(head.checkpointHash,head.sequence),row=structuredClone(s.rows.get(key)) as RecoveryJournal<Delta>;
  if(fault==='missing')s.rows.delete(key);
  if(fault==='duplicate')s.rows.set(key,s.rows.get(journalKey(head.checkpointHash,head.sequence-1)));
  if(fault==='reordered'){const first=journalKey(head.checkpointHash,1),second=journalKey(head.checkpointHash,2),value=s.rows.get(first);s.rows.set(first,s.rows.get(second));s.rows.set(second,value);}
  if(fault==='corrupt'){row.delta.header.wallet++;s.rows.set(key,row);}
  if(fault==='stale-head')head.revision--;
  if(fault==='checkpoint-corrupt'){const checkpoint=structuredClone(s.rows.get(head.checkpointKey)) as {payload:{data:AppData}};checkpoint.payload.data.wallet++;s.rows.set(head.checkpointKey,checkpoint);}
  if(fault==='offset-resealed'||fault==='wallet-resealed'){
   if(fault==='offset-resealed')row.delta.ledgerOffset++;else row.delta.header.wallet++;
   await reseal(row);head.tail=row.checksum;await reseal(head);s.rows.set(key,row);
  }
  const before=JSON.stringify([...s.rows]);await expect(restoreFastState(head,s.manifest,s.read,hooks)).rejects.toThrow();expect(JSON.stringify([...s.rows])).toBe(before);
 });
 it('detects an old reader advancing the canonical manifest and never mistakes it for current acceleration data',async()=>{
  const s=await stored(await snapshots());expect(fastHeadMatches(s.state.head,s.manifest)).toBe(true);
  const advanced=structuredClone(s.manifest);advanced.data.revision++;await reseal(advanced);expect(fastHeadMatches(s.state.head,advanced)).toBe(false);
  await expect(restoreFastState(s.state.head,advanced,s.read,hooks)).rejects.toThrow(/stale/);
 });
 it('checkpoints at64 revisions and retains previous checkpoint/journal rows',async()=>{
  const port=new RecordingPort(),controller=new SessionController(port);await controller.init();for(let i=0;i<CHECKPOINT_INTERVAL+2;i++)await controller.adjustBankroll(1000001+i,'manual benchmark adjustment');controller.close();
  const s=await stored(port.snapshots);expect(s.state.head.sequence).toBe(2);expect(s.rows.has(FAST_PREVIOUS_KEY)).toBe(true);
  const previous=s.rows.get(FAST_PREVIOUS_KEY) as RecoveryHead;expect(previous.sequence).toBe(63);expect(s.rows.has(previous.checkpointKey)).toBe(true);expect(s.rows.has(journalKey(previous.checkpointHash,63))).toBe(true);
  const restored=await restoreFastState(s.state.head,s.manifest,s.read,hooks);expect(restored.payload.data).toEqual(port.data);
 });
 it('checks ordered commit revisions before producing write records',async()=>{
  const s=await stored(await snapshots());await expect(prepareFastCommit(s.state.payload.data,s.manifest,s.state,hooks)).rejects.toThrow(/exactly one revision/);
 });
 it('retirement can only name verified obsolete acceleration keys, never canonical or protected generations',async()=>{
  const s=await stored(await snapshots()),head=s.state.head,keys=await obsoleteRecoveryKeys(head,[]);expect(keys).toContain(head.checkpointKey);expect(keys.every(key=>key.startsWith('recovery-v1:'))).toBe(true);
  expect(await obsoleteRecoveryKeys(head,[head.checkpointKey])).toEqual([]);
  expect(await obsoleteRecoveryKeys({...head,checkpointKey:'v2:hands:000000000000'},[])).toEqual([]);
  expect(await obsoleteRecoveryKeys({...head,checksum:'0'.repeat(64)},[])).toEqual([]);
 });
});
