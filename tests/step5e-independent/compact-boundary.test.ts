import {beforeAll,describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {prepareSegments,type SegmentedEnvelope} from '../../src/storage/segments';
import {compactRecoveryHooks,type CompactArchiveContext,type CompactContextDelta} from '../../src/storage/recovery-contracts';
import {auditCompactSnapshot,auditSnapshot,isVerifiedSnapshot,getArchiveContext,prepareCompactSnapshot} from '../../src/storage/verified';
import {prepareFastCommit,restoreFastState,FAST_HEAD_KEY,checkpointKey,journalKey,fastHeadMatches,type FastState,type FastPrepared,type RecoveryHead,type FinancialCheckpoint,type RecoveryJournal} from '../../src/storage/financial-checkpoint';
import {projectView} from '../../src/core/engine';
import {rig,act} from '../verification/helpers';
import {referenceHash,referenceEncode,referenceFinancial,financialInput,referenceFullHands} from './financial-reference';

class RecordingPort implements PersistencePort {
 data:AppData|null=null;snapshots:AppData[]=[];
 async load(){return this.data;}
 async commit(expected:number|null,data:AppData){expect(this.data?.revision??null).toBe(expected);this.data=data;this.snapshots.push(data);}
 close(){}
}
async function finishFold(c:SessionController){
 for(let i=0;c.data!.active!.game.street!=='complete'&&i<20;i++){
  const g=c.data!.active!.game;
  if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
  expect(c.error).toBe('');
 }expect(c.data!.active!.game.street).toBe('complete');
}
type Store={rows:Map<string,unknown>;manifest:SegmentedEnvelope;head:RecoveryHead;expected:AppData};
let initial:Store,latest:Store;
beforeAll(async()=>{
 const port=new RecordingPort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,buyIn:100000,maxBuyInBB:1000});
 try{
  for(let i=0;i<126;i++){await finishFold(c);if(i<125)await c.nextHand();}
  expect(c.data!.hands).toHaveLength(126);const first=c.data!;port.snapshots=[];
  for(let i=0;i<3;i++){await c.nextHand();await finishFold(c);}
  await c.topUp(1000);await c.adjustBankroll(777777,'Independent checkpoint manual reset',true);await c.cashOut();
  await c.startSession({...DEFAULT_SETTINGS,seats:3,smallBlind:200,bigBlind:500,buyIn:50000,seatStacks:{0:5000,1:10000,2:20000},maxBuyInBB:1000,rakeMode:'custom',rakeBasisPoints:500,rakeCap:300});expect(c.error).toBe('');
  const rows=new Map<string,unknown>();let state:FastState<CompactArchiveContext>|null=null,manifest:SegmentedEnvelope|null=null,prior:AppData|null=null;
  for(const [i,data] of [first,...port.snapshots].entries()){
   const canonical=await prepareSegments(data,prior,manifest);manifest=canonical.envelope;
   for(const w of canonical.writes)rows.set(w.key,structuredClone(w.entry));
   const fast:FastPrepared<CompactArchiveContext>=await prepareFastCommit(data,manifest,state,compactRecoveryHooks);for(const w of fast.writes)rows.set(w.key,structuredClone(w.value));state=fast.state;prior=data;
   if(i===0)initial={rows:structuredClone(rows),manifest:structuredClone(manifest),head:structuredClone(state.head),expected:data};
  }
  latest={rows,manifest:manifest!,head:state!.head,expected:c.data!};
 }finally{c.close();}
},120000);
const clone=(source=latest):Store=>({...source,rows:structuredClone(source.rows),head:structuredClone(source.head),manifest:structuredClone(source.manifest)});
const reader=(s:Store)=>async(keys:string[])=>keys.map(k=>structuredClone(s.rows.get(k)));
const restore=(s:Store)=>restoreFastState(s.head,s.manifest,reader(s),compactRecoveryHooks);
function reseal<T extends {checksum:string}>(value:T){const body={...value} as Partial<T>;delete body.checksum;value.checksum=referenceHash(body);}
function resealCheckpoint(s:Store,checkpoint:FinancialCheckpoint<CompactArchiveContext>){
 reseal(checkpoint);s.head.checkpointHash=checkpoint.checksum;s.head.checkpointKey=checkpointKey(checkpoint.revision,checkpoint.checksum);s.head.tail=checkpoint.checksum;reseal(s.head);s.rows.set(s.head.checkpointKey,checkpoint);s.rows.set(FAST_HEAD_KEY,s.head);
}
function resealLastJournal(s:Store,row:RecoveryJournal<CompactContextDelta>){reseal(row);s.head.tail=row.checksum;reseal(s.head);s.rows.set(journalKey(s.head.checkpointHash,s.head.sequence),row);s.rows.set(FAST_HEAD_KEY,s.head);}

describe('Step5E independent real compact checkpoint/journal boundary',()=>{
 it('recovers126 archived hands from a120-body tail and agrees with independent full canonical payout replay',async()=>{
  const s=clone(initial),result=await restore(s),data=result.payload.data,context=getArchiveContext(data)!;
  expect(isVerifiedSnapshot(data)).toBe(true);expect(data.hands).toHaveLength(120);expect(context.handIndex).toHaveLength(126);expect(context.handOffset).toBe(6);
  const full=referenceFinancial(financialInput(s.expected)),compact=referenceFinancial({...data,handIndex:context.handIndex});
  expect(compact).toEqual(full);expect(referenceFullHands(s.expected.hands).poker).toBe(compact.poker);
  expect(data.hands.map(h=>h.id)).toEqual(s.expected.hands.slice(-120).map(h=>h.id));
  expect(data.humanMemory).toEqual(s.expected.humanMemory);expect(data.humanMemory?.processed).toBe(126);expect(data.humanMemory?.recent).toHaveLength(126);// Churn replaces identities; each current bot remembers its consecutive seated hands.
  // Count those directly from the canonical histories, not from the memory builder.
  for(const [identity,facts] of Object.entries(data.humanMemory!.facts)){
   let witnessed=0;for(const hand of [...s.expected.hands].reverse()){
    if(!hand.view.seats.some(seat=>seat.id!==0&&seat.startingStack>0&&hand.privateProfiles[seat.id]?.personalityId===identity))break;
    witnessed++;
   }expect(facts.hands).toBe(witnessed);
  }
 });
 it('replays engine settlements, top-up, reset, cashout and new-session journals exactly once',async()=>{
  const s=clone(),once=await restore(s),twice=await restore(s);expect(once.payload.data).toEqual(twice.payload.data);expect(once.payload.context).toEqual(twice.payload.context);
  expect(once.payload.context.handIndex).toHaveLength(129);expect(once.payload.data.sessions).toHaveLength(2);
  expect(referenceFinancial({...once.payload.data,handIndex:once.payload.context.handIndex})).toEqual(referenceFinancial(financialInput(s.expected)));
  expect(once.payload.data.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);expect(once.payload.data.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(129);
 });
 it('does not grant private trust to cloned, frozen or caller-shaped compact payloads',async()=>{
  const compact=await prepareCompactSnapshot(initial.expected),copy=structuredClone(compact);Object.freeze(copy.data);Object.freeze(copy.context);
  expect(isVerifiedSnapshot(copy.data)).toBe(false);await expect(auditCompactSnapshot(copy.data,copy.context)).rejects.toThrow(/envelope|durable|provenance/i);
  await expect(prepareCompactSnapshot(copy.data)).rejects.toThrow(/verified/);expect(isVerifiedSnapshot(copy.data)).toBe(false);
 });
 it('rejects a missing or stale checkpoint under a current matching head without falling back to it',async()=>{
  const s=clone(initial);expect(fastHeadMatches(s.head,s.manifest)).toBe(true);
  const checkpoint=structuredClone(s.rows.get(s.head.checkpointKey)) as FinancialCheckpoint<CompactArchiveContext>;checkpoint.revision--;s.rows.set(s.head.checkpointKey,checkpoint);
  expect(await restore(s).then(()=>false,()=>true)).toBe(true);s.rows.delete(s.head.checkpointKey);expect(await restore(s).then(()=>false,()=>true)).toBe(true);
 });
 it.each(['missing-index','duplicate-index','reordered-index','index-net','index-epoch','index-policy','index-rule','offset','stats-profit','stats-hand-id','memory-card-field','memory-missing-row','memory-stale-cursor','ledger-epoch','ledger-duplicate'] as const)('rejects independently resealed checkpoint %s inconsistency',fault=>testCheckpointFault(fault));
 it.each(['missing','duplicate','reorder','ledger-offset','index-offset','session-duplicate','memory-session'] as const)('rejects %s journal without changing saved rows',async fault=>{
  const s=clone(),lastKey=journalKey(s.head.checkpointHash,s.head.sequence),row=structuredClone(s.rows.get(lastKey)) as RecoveryJournal<CompactContextDelta>;
  if(fault==='missing')s.rows.delete(lastKey);
  if(fault==='duplicate')s.rows.set(lastKey,s.rows.get(journalKey(s.head.checkpointHash,s.head.sequence-1)));
  if(fault==='reorder'){const first=journalKey(s.head.checkpointHash,1),second=journalKey(s.head.checkpointHash,2),value=s.rows.get(first);s.rows.set(first,s.rows.get(second));s.rows.set(second,value);}
  if(fault==='ledger-offset'){row.delta.ledgerOffset++;resealLastJournal(s,row);}
  if(fault==='index-offset'){row.delta.context.indexOffset++;resealLastJournal(s,row);}
  if(fault==='session-duplicate'){row.delta.sessions.push(structuredClone(row.delta.sessions[0]));resealLastJournal(s,row);}
  if(fault==='memory-session'){expect(row.delta.context.botMemory).toBeDefined();row.delta.context.botMemory!.activeSessionId='wrong';resealLastJournal(s,row);}
  const before=referenceEncode([...s.rows]);expect(await restore(s).then(()=>false,()=>true)).toBe(true);expect(referenceEncode([...s.rows])).toBe(before);
 });
 it.each(['before-commit','lost-ack'] as const)('recovers all-in side pots/refund/rake exactly once with %s on compact history',async fault=>{
  const source=structuredClone(latest.expected),a=source.active!;
  a.game=rig(a.game,[['As','Ah'],['Ks','Kh'],['Qs','Qh']],['2d','3d','7c','8c','9h']);a.frames=[projectView(a.game,0)];
  for(const action of [{type:'raise',to:5000},{type:'call'},{type:'raise',to:20000}] as const){a.game=act(a.game,action);a.frames.push(projectView(a.game,0));}
  expect(a.game.actor).toBe(1);const decisionId=`independent-compact-allin:${a.game.handId}:${a.game.revision}`,policyVersion=a.profiles[1].policyVersion;
  a.pending={decisionId,handId:a.game.handId,revision:a.game.revision,seatId:1,policyVersion,drawToken:175,decision:{decisionId,handId:a.game.handId,revision:a.game.revision,seatId:1,policyVersion,observationHash:'independent-allin-observation',action:{type:'call'}}};
  await auditSnapshot(source);const port=await AtomicFastPort.create(source),c=new SessionController(port);await c.init();expect(c.error).toBe('');
  const before=referenceFinancial({...c.data!,handIndex:getArchiveContext(c.data!)!.handIndex}),pending=c.data!.active!.pending!;port.fault=fault;
  await c.commitBot(pending.handId,pending.revision);expect(c.status).toBe('error');c.close();
  const recovered=new SessionController(port);try{
   await recovered.init();expect(recovered.status).toBe('ready');if(fault==='before-commit'){expect(referenceFinancial({...recovered.data!,handIndex:getArchiveContext(recovered.data!)!.handIndex})).toEqual(before);await recovered.commitBot(pending.handId,pending.revision);}
   expect(recovered.error).toBe('');const settled=recovered.data!,hand=settled.hands.at(-1)!;
   expect(hand.view.pots.map(p=>p.amount)).toEqual([14700,10000]);expect(hand.view.payouts).toEqual({0:14700,1:10000});expect(hand.view.rake).toBe(300);
   expect(hand.view.events.filter(e=>e.type==='refund').map(e=>[e.seatId,e.amount])).toEqual([[2,10000]]);expect(referenceFullHands([hand],hand.previousHash)).toMatchObject({hands:1,poker:9700,totalRake:300});
   expect(settled.ledger.filter(e=>e.kind==='hand-net'&&e.handId===pending.handId)).toHaveLength(1);const revision=settled.revision;
   await recovered.commitBot(pending.handId,pending.revision);expect(recovered.data!.revision).toBe(revision);await recovered.cashOut();expect(recovered.error).toBe('');
   expect(recovered.data!.ledger.filter(e=>e.kind==='cash-out'&&e.sessionId===a.sessionId)).toHaveLength(1);
   const last=referenceFinancial({...recovered.data!,handIndex:getArchiveContext(recovered.data!)!.handIndex});expect(last.table).toBe(0);expect(last.poker-before.poker).toBe(9700);
   const again=await port.load();expect(referenceFinancial({...again,handIndex:getArchiveContext(again)!.handIndex})).toEqual(last);
  }finally{recovered.close();}
 });
});

/** Atomic storage reference, deliberately not a claim about native IndexedDB. */
class AtomicFastPort implements PersistencePort {
 rows=new Map<string,unknown>();state!:FastState<CompactArchiveContext>;manifest!:SegmentedEnvelope;fault:'before-commit'|'lost-ack'|null=null;
 static async create(source:AppData){const port=new AtomicFastPort(),canonical=await prepareSegments(source,null,null);port.manifest=canonical.envelope;const prepared=await prepareFastCommit(source,port.manifest,null,compactRecoveryHooks);for(const w of canonical.writes)port.rows.set(w.key,structuredClone(w.entry));for(const w of prepared.writes)port.rows.set(w.key,structuredClone(w.value));port.state=prepared.state;return port;}
 async load(){this.state=await restoreFastState(this.rows.get(FAST_HEAD_KEY),this.manifest,async keys=>keys.map(k=>structuredClone(this.rows.get(k))),compactRecoveryHooks);return this.state.payload.data;}
 async commit(expected:number|null,next:AppData){
  expect(expected).toBe(this.manifest.data.revision);const canonical=await prepareSegments(next,this.state.payload.data,this.manifest),prepared=await prepareFastCommit(next,canonical.envelope,this.state,compactRecoveryHooks);
  const fault=this.fault;this.fault=null;if(fault==='before-commit')throw Error('Independent transaction interruption');
  for(const w of canonical.writes)this.rows.set(w.key,structuredClone(w.entry));for(const w of prepared.writes)this.rows.set(w.key,structuredClone(w.value));this.manifest=canonical.envelope;this.state=prepared.state;
  if(fault==='lost-ack')throw Error('Independent acknowledgement interruption');
 }
 close(){}
}

async function testCheckpointFault(fault:string){
 const s=clone(initial),checkpoint=structuredClone(s.rows.get(s.head.checkpointKey)) as FinancialCheckpoint<CompactArchiveContext>,{data,context}=checkpoint.payload;
 if(fault==='missing-index')context.handIndex.splice(0,1);
 if(fault==='duplicate-index')context.handIndex[1]=structuredClone(context.handIndex[0]);
 if(fault==='reordered-index')[context.handIndex[0],context.handIndex[1]]=[context.handIndex[1],context.handIndex[0]];
 if(fault==='index-net')context.handIndex[0].net++;
 if(fault==='index-epoch')context.handIndex[0].epoch++;
 if(fault==='index-policy')context.handIndex[0].policyVersions=['unsupported-policy'];
 if(fault==='index-rule')context.handIndex[0].rules.fingerprint='f'.repeat(64);
 if(fault==='offset')context.handOffset++;
 if(fault==='stats-profit')context.statistics.all.profit++;
 if(fault==='stats-hand-id')context.statistics.handIds[0]='missing-hand';
 if(fault==='memory-card-field')Object.assign(context.botMemory.bySeat[1][0],{hole:['As','Ah']});
 if(fault==='memory-missing-row')context.botMemory.bySeat[1].pop();
 if(fault==='memory-stale-cursor')context.botMemory.processedLastHandHash='f'.repeat(64);
 if(fault==='ledger-epoch')data.ledger.find(e=>e.kind==='hand-net')!.epoch++;
 if(fault==='ledger-duplicate')data.ledger[1].id=data.ledger[0].id;
 if(fault.startsWith('ledger-')){let previous='0'.repeat(64);for(const e of data.ledger){e.previousHash=previous;const body={...e} as Partial<typeof e>;delete body.hash;e.hash=referenceHash(body);previous=e.hash;}}
 resealCheckpoint(s,checkpoint);const before=referenceEncode([...s.rows]);expect(await restore(s).then(()=>false,()=>true)).toBe(true);expect(referenceEncode([...s.rows])).toBe(before);
}
