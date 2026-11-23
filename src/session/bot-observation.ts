import type { BotObservation, BotProfile, GameEvent, PublicMemoryHand, RuleProfile } from '../contracts';
import type { StoredHand } from './types';
import { isVerifiedHistory } from '../storage/verified';
import { buildOpponentMemory } from '../bots/policy';

const publicCache=new WeakMap<readonly StoredHand[],Map<string,PublicMemoryHand[]>>();
const memoryCache=new WeakMap<readonly StoredHand[],Map<string,ReturnType<typeof buildOpponentMemory>>>();
const checkpointCache=new WeakMap<PublicMemoryCheckpoint,Map<string,ReturnType<typeof buildOpponentMemory>>>();
const checkedPublicShapes=new WeakSet<object>();
const MEMORY_GENESIS='0'.repeat(64);
export interface PublicMemoryIndexEntry {id:string;sessionId:string;hash:string;seats:number[];}
/** Public projections only. This type and its frozen objects confer no financial
 * or canonical-history trust; the recovery owner must verify their commitment. */
export interface PublicMemoryCheckpoint {
 version:1;activeSessionId:string|null;processedLastHandId:string|null;processedLastHandHash:string;
 bySeat:Record<number,PublicMemoryHand[]>;
}

/** These graphs contain only freshly copied, allowlisted public fields. Their
 * immutability does not confer canonical-history or financial-checkpoint trust.
 * A local traversal set avoids growing the storage freezer's long-lived set
 * with temporary bot-memory projections. Accessors remain rejected unread. */
function freezePublicProjection<T extends object>(root:T):T {
 const visited=new WeakSet<object>(),pending:object[]=[root];
 while(pending.length){
  const value=pending.pop()!;if(visited.has(value))continue;visited.add(value);
  for(const key of Reflect.ownKeys(value)){
   const property=Object.getOwnPropertyDescriptor(value,key)!;
   if(property.get||property.set)throw new Error('Public memory projection cannot contain accessors.');
   if(property.value&&typeof property.value==='object')pending.push(property.value);
  }
  Object.freeze(value);
 }
 return root;
}

/** Hand histories are Hero projections, so Hero's hole cards are NOT public by default.
 * Read hole cards only after the engine's actual-reveal label and nonfolded guards.
 * Imported study records, private policy vectors and hidden/mucked cards never enter memory. */
export function publicMemoryHands(hands:readonly StoredHand[],sessionId:string,observingSeat:number):PublicMemoryHand[] {
 const trusted=isVerifiedHistory(hands),key=`${sessionId}:${observingSeat}`,cached=trusted?publicCache.get(hands)?.get(key):undefined;if(cached)return cached;
 const selected:StoredHand[]=[];for(let i=hands.length-1;i>=0&&selected.length<120;i--){const h=hands[i];if(h.sessionId===sessionId&&h.view.seats.some(s=>s.id===observingSeat))selected.push(h);}
 const result=selected.reverse().map(publicHand);
 if(trusted){const map=publicCache.get(hands)??new Map<string,PublicMemoryHand[]>();map.set(key,freezePublicProjection(result));publicCache.set(hands,map);}return result;
}
function publicHand(h:StoredHand):PublicMemoryHand {return {
  handId:h.id,
  seats:h.view.seats.map(s=>({id:s.id,revealedCards:h.view.street==='complete'&&h.view.board.length===5&&!s.folded&&Object.hasOwn(h.view.handLabels,s.id)?[...s.hole]:[]})),
  events:h.view.events.filter(e=>e.type==='action'||e.type==='blind'||e.type==='street').map(publicEvent),
 };}
function publicEvent(e:GameEvent):GameEvent {
 return {id:e.id,handId:e.handId,revision:e.revision,type:e.type,seatId:e.seatId,amount:e.amount,street:e.street,
  action:e.action?(e.action.type==='raise'?{type:'raise',to:e.action.to}:{type:e.action.type}):undefined};
}
function memoryAssert(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(`Public memory checkpoint: ${message}`);}
function fields(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
 memoryAssert(value!==null&&typeof value==='object'&&!Array.isArray(value),'invalid object');
 memoryAssert(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null,'invalid object prototype');
 for(const key of Reflect.ownKeys(value)){
  memoryAssert(typeof key==='string'&&keys.includes(key),'unexpected private or unknown field');
  const p=Object.getOwnPropertyDescriptor(value,key)!;memoryAssert(!p.get&&!p.set,'accessor field');
 }
}
function safeArray(value:unknown):asserts value is unknown[] {
 memoryAssert(Array.isArray(value),'invalid array');
 memoryAssert(Object.getPrototypeOf(value)===Array.prototype,'invalid array prototype');
 for(const key of Reflect.ownKeys(value)){
  memoryAssert(key==='length'||typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key),'unexpected array field');
  const p=Object.getOwnPropertyDescriptor(value,key)!;memoryAssert(!p.get&&!p.set,'array accessor');
 }
 memoryAssert(Object.keys(value).length===value.length,'sparse array');
}
const validSeat=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=9;
const validAmount=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function checkPublicShape(value:unknown):asserts value is PublicMemoryCheckpoint {
 if(value&&typeof value==='object'&&checkedPublicShapes.has(value))return;
 fields(value,['version','activeSessionId','processedLastHandId','processedLastHandHash','bySeat']);
 memoryAssert(value.version===1,'unsupported version');memoryAssert(value.activeSessionId===null||typeof value.activeSessionId==='string'&&value.activeSessionId.length>0,'invalid active session');
 memoryAssert(value.processedLastHandId===null||typeof value.processedLastHandId==='string'&&value.processedLastHandId.length>0,'invalid cursor identity');
 memoryAssert(typeof value.processedLastHandHash==='string'&&/^[0-9a-f]{64}$/.test(value.processedLastHandHash),'invalid cursor hash');
 memoryAssert(value.processedLastHandId!==null||value.processedLastHandHash===MEMORY_GENESIS,'empty cursor disagreement');
 fields(value.bySeat,value.activeSessionId===null?[]:Array.from({length:10},(_,i)=>String(i)));
 memoryAssert(Object.keys(value.bySeat).length===(value.activeSessionId===null?0:10),'missing observing seat');
 for(const rows of Object.values(value.bySeat)){
  safeArray(rows);memoryAssert(rows.length<=120,'unbounded memory');const ids=new Set<string>();
  for(const row of rows){
   fields(row,['handId','seats','events']);memoryAssert(typeof row.handId==='string'&&row.handId.length>0&&!ids.has(row.handId),'duplicate or invalid hand');ids.add(row.handId);
   safeArray(row.seats);const seats=new Set<number>();memoryAssert(row.seats.length>=2&&row.seats.length<=10,'invalid seat count');
   for(const seat of row.seats){fields(seat,['id','revealedCards']);memoryAssert(validSeat(seat.id)&&!seats.has(Number(seat.id)),'invalid or duplicate seat');seats.add(Number(seat.id));safeArray(seat.revealedCards);memoryAssert(seat.revealedCards.length===0||seat.revealedCards.length===2,'invalid reveal count');memoryAssert(seat.revealedCards.every(c=>typeof c==='string'&&/^[2-9TJQKA][cdhs]$/.test(c))&&new Set(seat.revealedCards).size===seat.revealedCards.length,'invalid revealed cards');}
   safeArray(row.events);const events=new Set<string>();
   for(const event of row.events){
    fields(event,['id','handId','revision','type','seatId','amount','street','action']);
    memoryAssert(typeof event.id==='string'&&!events.has(event.id),'duplicate event');events.add(event.id);memoryAssert(event.handId===row.handId&&validAmount(event.revision),'invalid event identity');
    memoryAssert(event.type==='action'||event.type==='blind'||event.type==='street','nonpublic event type');memoryAssert(event.seatId===undefined||validSeat(event.seatId)&&seats.has(Number(event.seatId)),'event seat mismatch');memoryAssert(event.amount===undefined||validAmount(event.amount),'invalid amount');memoryAssert(event.street===undefined||['preflop','flop','turn','river','complete'].includes(String(event.street)),'invalid street');
    if(event.action!==undefined){fields(event.action,['type','to']);memoryAssert(['fold','check','call','raise'].includes(String(event.action.type)),'invalid action');memoryAssert(event.action.type==='raise'?validAmount(event.action.to):event.action.to===undefined,'invalid raise amount');}
    memoryAssert(event.type!=='action'||event.action!==undefined,'missing action');
   }
  }
 }
 freezePublicProjection(value);checkedPublicShapes.add(value);
}

/** Validate the exact last120 matching hands for each observing seat, including
 * absent seats that may rejoin later. Raw checkpoints are never trusted merely
 * because they resemble this interface. Recovery separately verifies the hash. */
export function validatePublicMemoryCheckpoint(value:unknown,index:readonly PublicMemoryIndexEntry[],activeSessionId:string|null):asserts value is PublicMemoryCheckpoint {
 checkPublicShape(value);memoryAssert(value.activeSessionId===activeSessionId,'session mismatch');
 const last=index.at(-1);memoryAssert(value.processedLastHandId===(last?.id??null)&&value.processedLastHandHash===(last?.hash??MEMORY_GENESIS),'global history cursor mismatch');
 if(activeSessionId===null)return;
 for(let seat=0;seat<10;seat++){
  const expected:PublicMemoryIndexEntry[]=[];for(let i=index.length-1;i>=0&&expected.length<120;i--){const h=index[i];if(h.sessionId===activeSessionId&&h.seats.includes(seat))expected.push(h);}expected.reverse();
  const actual=value.bySeat[seat];memoryAssert(actual.length===expected.length,'missing matching hand');
  for(let i=0;i<actual.length;i++){
   memoryAssert(actual[i].handId===expected[i].id,'hand order mismatch');
   const actualSeats=actual[i].seats.map(s=>s.id).sort((a,b)=>a-b),expectedSeats=[...expected[i].seats].sort((a,b)=>a-b);
   memoryAssert(actualSeats.length===expectedSeats.length&&actualSeats.every((id,j)=>id===expectedSeats[j]),'hand seat membership mismatch');
  }
 }
}

/** Merge only the contiguous newly committed suffix. A supplied tail must overlap
 * the old cursor or begin at its immediate hash successor; gaps fail safely. */
export function preparePublicMemoryCheckpoint(hands:readonly StoredHand[],activeSessionId:string|null,prior?:PublicMemoryCheckpoint):PublicMemoryCheckpoint {
 if(prior)checkPublicShape(prior);
 if(!prior&&hands.length)memoryAssert(hands[0].previousHash===MEMORY_GENESIS,'initial memory requires complete committed history');
 let fresh=hands;
 if(prior&&prior.processedLastHandId!==null&&hands.length){
  const cursor=hands.findIndex(h=>h.id===prior.processedLastHandId);
  if(cursor>=0){memoryAssert(hands[cursor].hash===prior.processedLastHandHash,'overlapping cursor hash mismatch');fresh=hands.slice(cursor+1);}
  else memoryAssert(hands[0].previousHash===prior.processedLastHandHash,'missing committed suffix');
 }else if(prior&&prior.processedLastHandId===null&&hands.length)memoryAssert(hands[0].previousHash===MEMORY_GENESIS,'missing initial history');
 let previous=prior?.processedLastHandHash??(hands[0]?.previousHash??MEMORY_GENESIS);const newIds=new Set<string>();
 for(const h of fresh){memoryAssert(h.previousHash===previous&&!newIds.has(h.id),'reordered or duplicate committed suffix');newIds.add(h.id);previous=h.hash;}
 if(prior&&fresh.length===0&&prior.activeSessionId===activeSessionId)return prior;
 const last=fresh.at(-1)??hands.at(-1),bySeat:Record<number,PublicMemoryHand[]>={};
 if(activeSessionId!==null){
  for(let seat=0;seat<10;seat++)bySeat[seat]=prior?.activeSessionId===activeSessionId?[...prior.bySeat[seat]]:[];
  for(const h of fresh){if(h.sessionId!==activeSessionId)continue;const row=publicHand(h);for(const s of row.seats){const rows=bySeat[s.id];memoryAssert(rows!==undefined,'invalid observing seat');memoryAssert(!rows.some(r=>r.handId===h.id),'duplicate remembered hand');bySeat[s.id]=[...rows,row].slice(-120);}}
 }
 const checkpoint:PublicMemoryCheckpoint={version:1,activeSessionId,processedLastHandId:last?.id??prior?.processedLastHandId??null,processedLastHandHash:last?.hash??prior?.processedLastHandHash??MEMORY_GENESIS,bySeat};
 checkPublicShape(checkpoint);return checkpoint;
}

export function withPublicContext(observation:BotObservation,rake:RuleProfile['rake'],profile:BotProfile,hands:readonly StoredHand[],sessionId:string,memoryCheckpoint?:PublicMemoryCheckpoint):BotObservation {
 const retention=profile.traits?.memoryRetention??0.5,key=`${sessionId}:${observation.actingSeat}:${retention}`,trusted=isVerifiedHistory(hands);
 if(memoryCheckpoint){
  const checkpoint=preparePublicMemoryCheckpoint(hands,sessionId,memoryCheckpoint);let memory=checkpointCache.get(checkpoint)?.get(key);
  if(!memory){memory=freezePublicProjection(buildOpponentMemory(checkpoint.bySeat[observation.actingSeat],observation.actingSeat,retention));const map=checkpointCache.get(checkpoint)??new Map<string,ReturnType<typeof buildOpponentMemory>>();map.set(key,memory);checkpointCache.set(checkpoint,map);}
  return {...observation,rake:{...rake},memory};
 }
 let memory=trusted?memoryCache.get(hands)?.get(key):undefined;
 if(!memory){memory=buildOpponentMemory(publicMemoryHands(hands,sessionId,observation.actingSeat),observation.actingSeat,retention);if(trusted){const map=memoryCache.get(hands)??new Map<string,ReturnType<typeof buildOpponentMemory>>();map.set(key,freezePublicProjection(memory));memoryCache.set(hands,map);}}
 return {...observation,rake:{...rake},memory};
}
