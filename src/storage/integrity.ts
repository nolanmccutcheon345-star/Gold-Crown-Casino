import {assertHumanMemory} from '../session/human-memory';
import { assertAccounting, projectView } from '../core/engine';
import { validatePublicReplay } from '../core/replay';
import { sha256 } from '@noble/hashes/sha2.js';
import type { AppData, MoneyEvent, PublicHand, PublicHistory, StoredHand } from '../session/types';
import {assertCashHandProvenance,validateHandProvenance} from '../session/hand-provenance';
import {validateUserNotes} from '../session/notes';
import {validateConfigurationHistory,validateHandConfiguration} from '../session/configuration-history';
import { validateConfigurationData } from '../session/configuration';
import { frozenPolicyVersions } from '../stats/cash';
import { assertSupportedCashScope } from '../session/release-scope';
import {recoveryScheduler} from './recovery-scheduler';
import {timedAsync} from '../performance/timing';
import {isPackedImmutableNode} from './packed-hand';

export const GENESIS = '0'.repeat(64);
export function requireData(ok: unknown, message:string):asserts ok { if (!ok) throw new Error(message); }
export const cents = (n:unknown):n is number => Number.isSafeInteger(n) && (n as number)>=0;
// Cache only JSON encodings of short property names, never values, histories,
// hashes or verification outcomes. Bound memory independently of saved hand count.
const canonicalKeys=new Map<string,string>();
function quotedKey(key:string):string {
 const known=canonicalKeys.get(key);if(known!==undefined)return known;
 const encoded=JSON.stringify(key);if(key.length<128&&canonicalKeys.size<512)canonicalKeys.set(key,encoded);return encoded;
}
function canonicalWriter():(value:unknown)=>string {
 // A call-scoped byte cache only for codec-constructed, recursively immutable
 // nodes. Repeated frame events/profiles keep exact original canonical bytes.
 // No persisted checksum, caller freeze, hash outcome or financial result grants
 // this provenance; ordinary mutable objects retain the original traversal.
 const memo=new WeakMap<object,string>();
 function write(item:unknown):string {
  if(item===null||typeof item!=='object')return JSON.stringify(item);
  const reusable=isPackedImmutableNode(item),known=reusable?memo.get(item):undefined;if(known!==undefined)return known;
  const result=Array.isArray(item)?'['+item.map(write).join(',')+']':'{'+Object.keys(item).filter(k=>(item as Record<string,unknown>)[k]!==undefined).sort().map(k=>quotedKey(k)+':'+write((item as Record<string,unknown>)[k])).join(',')+'}';
  if(reusable)memo.set(item,result);return result;
 }
 return write;
}
export function canonical(value:unknown):string{return canonicalWriter()(value);}
async function hashCanonical(text:string):Promise<string> {
 // Identical SHA-256 on HTTPS and the managed HTTP preview. Native hashing
 // avoids blocking compression for large records; small records avoid native
 // dispatch overhead. Neither path changes canonical bytes or CSPRNG dealing.
 const input=new TextEncoder().encode(text);
 const bytes=input.length>=4096&&globalThis.crypto?.subtle?new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',input)):sha256(input);
 return [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function digest(value:unknown):Promise<string>{return hashCanonical(canonical(value));}
const checkedPackedHandHashes=new WeakSet<object>();
/** Execute BOTH original hashes with one ephemeral encoding context. The only
 * reusable result is a private identity proof for the exact immutable hand whose
 * inner hash was just compared. No bytes or financial/semantic outcome is cached. */
export async function digestPackedHandSegment(record:{index:number;previousHash:string;value:unknown},expectedOuterHash:string):Promise<string>{
 const hand=record.value as StoredHand;
 requireData(hand&&typeof hand==='object'&&isPackedImmutableNode(hand),'Packed hand hashing requires private immutable codec provenance.');
 const {hash,...body}=hand,write=canonicalWriter();
 const outerText=write(record),innerText=write(body);
 const [outer,inner]=await Promise.all([hashCanonical(outerText),hashCanonical(innerText)]);
 if(inner!==hash||outer!==expectedOuterHash)checkedPackedHandHashes.delete(hand);
 requireData(inner===hash,'Saved hand integrity check failed.');requireData(outer===expectedOuterHash,'Saved storage segment integrity check failed.');checkedPackedHandHashes.add(hand);return outer;
}
export async function seal<T extends {hash:string}>(record:T):Promise<T> { const body={...record} as Partial<T>; delete body.hash; return {...record,hash:await digest(body)}; }
export async function checkChain(records:({hash:string;previousHash:string})[],reusePackedHandHashes=false):Promise<void> {
 let previous=GENESIS;const cooperate=recoveryScheduler();
 for(const item of records){ requireData(item.previousHash===previous,'History chain is broken.');const {hash,...body}=item;requireData(reusePackedHandHashes&&checkedPackedHandHashes.has(item)||hash===await digest(body),'Saved record integrity check failed.');previous=hash;await cooperate(); }
}
export interface SessionMoney {buyIns:number;withdrawals:number;cashOut:number;net:number;balance:number;buyInEvents:number;cashOutEvents:number}
export const emptySessionMoney=():SessionMoney=>({buyIns:0,withdrawals:0,cashOut:0,net:0,balance:0,buyInEvents:0,cashOutEvents:0});
export function validateMoneyEvent(event:MoneyEvent,index:number):void {
 requireData(['adjustment','reset','buy-in','top-up','hand-net','cash-out','table-adjustment'].includes(event.kind),'Unknown financial event kind.');
 requireData(event.index===index&&Number.isSafeInteger(event.walletDelta)&&Number.isSafeInteger(event.tableDelta)&&Number.isSafeInteger(event.pokerNet),'Invalid financial amount.');
 if(event.kind==='hand-net')requireData(event.walletDelta===0&&event.pokerNet===event.tableDelta&&!!event.handId,'Invalid settlement ledger.');
 else requireData(event.pokerNet===0,'Manual adjustments/transfers cannot count as poker profit.');
 if(['buy-in','top-up','cash-out','table-adjustment'].includes(event.kind))requireData(event.walletDelta+event.tableDelta===0,'Transfer does not conserve funds.');
 if(event.kind==='buy-in'||event.kind==='top-up')requireData(event.tableDelta>=0,'Funding cannot withdraw table chips.');
 if(event.kind==='cash-out')requireData(event.tableDelta<=0,'Cashout cannot buy table chips.');
 if(event.kind==='adjustment'||event.kind==='reset')requireData(event.tableDelta===0,'Wallet adjustment cannot change table chips.');
 else requireData(typeof event.sessionId==='string'&&event.sessionId.length>0,'Financial session identity is required.');
}
export function addSessionMoney(prior:SessionMoney,event:MoneyEvent):SessionMoney {
 requireData(prior.cashOutEvents===0,'Financial event appended after session cashout.');
 const out={...prior};out.balance+=event.tableDelta;
 if(event.kind==='buy-in'||event.kind==='top-up'||event.kind==='table-adjustment'&&event.tableDelta>0)out.buyIns+=event.tableDelta;
 if(event.kind==='table-adjustment'&&event.tableDelta<0)out.withdrawals-=event.tableDelta;
 if(event.kind==='cash-out'){out.cashOut-=event.tableDelta;out.cashOutEvents++;}
 if(event.kind==='hand-net')out.net+=event.pokerNet;
 if(event.kind==='buy-in')out.buyInEvents++;
 requireData(cents(out.balance),'Session chips do not reconcile.');return out;
}
export function validateSessionMoney(session:AppData['sessions'][number],money:SessionMoney):void {
 requireData(cents(session.buyIns)&&cents(session.cashOut)&&cents(session.tableWithdrawals??0),'Invalid session financial totals.');
 requireData(session.buyIns===money.buyIns&&(session.tableWithdrawals??0)===money.withdrawals&&session.cashOut===money.cashOut,'Session financial totals do not reconcile to ledger.');
 requireData(money.buyInEvents===1&&money.cashOutEvents===(session.endedAt===null?0:1),'Session funding/cashout count mismatch.');
 requireData(session.endedAt===null||money.balance===0,'Closed session retains table chips.');
}
export function validatePolicyViolations(data:AppData,prior?:AppData):void {
 const records=data.policyViolations;if(records===undefined||records===prior?.policyViolations)return;
 requireData(Array.isArray(records),'Invalid policy violation log.');const ids=new Set<string>();
 const action=(value:unknown):boolean=>{if(!value||typeof value!=='object')return false;const a=value as {type?:unknown;to?:unknown};return a.type==='raise'?Object.keys(a).length===2&&Number.isSafeInteger(a.to):['fold','check','call'].includes(String(a.type))&&Object.keys(a).length===1;};
 for(let i=0;i<records.length;i++){
  const v=records[i];requireData(v&&typeof v.id==='string'&&v.id.length>0&&!ids.has(v.id),'Duplicate or invalid policy violation identity.');ids.add(v.id);
  if(prior?.policyViolations?.[i]===v)continue;
  requireData(Object.keys(v).every(key=>['id','at','handId','revision','seatId','policyVersion','proposedAction','fallback','reason'].includes(key)),'Unexpected private payload in policy violation.');
  requireData(typeof v.at==='string'&&Number.isFinite(Date.parse(v.at))&&typeof v.handId==='string'&&v.handId.length>0&&cents(v.revision)&&Number.isInteger(v.seatId)&&v.seatId>=1&&v.seatId<=9,'Invalid policy violation context.');
  requireData(typeof v.policyVersion==='string'&&v.policyVersion.length>0&&typeof v.reason==='string'&&v.reason.length>0&&v.reason.length<=500,'Invalid policy violation metadata.');
  requireData((v.proposedAction===null||action(v.proposedAction))&&action(v.fallback)&&['check','fold'].includes(v.fallback.type),'Invalid policy violation action.');
 }
}
export function assertLatestPublicFrame(data:AppData):void {
 const active=data.active;if(!active)return;
 // Even a zero-net settlement must have its canonical hand and financial event.
 // Balance equality alone cannot detect both records missing from a torn save.
 if(active.game.street==='complete'){
  const hand=data.hands.find(h=>h.id===active.game.handId&&h.sessionId===active.sessionId);
  const settlement=data.ledger.find(e=>e.kind==='hand-net'&&e.handId===active.game.handId&&e.sessionId===active.sessionId);
  requireData(hand&&settlement&&hand.net===settlement.pokerNet,'Completed active hand is missing its canonical settlement.');
  requireData(canonical(active.frames.at(-1))===canonical(hand.view),'Completed active hand differs from its canonical settlement.');
 }
 const frame=active.frames.at(-1),actual=projectView(active.game,0);
 if(canonical(frame)===canonical(actual))return;
 // Legacy completed-hand saves retain their final replay frame after a top-up.
 // Accept only the exact engine/ledger-backed transfer delta, never a blanket
 // exception merely because a previous hand once had a table transfer.
 requireData(frame&&active.game.street==='complete'&&frame.street==='complete','Latest public frame differs from game.');
 const record=data.hands.find(h=>h.id===active.game.handId&&h.sessionId===active.sessionId),settled=data.ledger.findIndex(e=>e.kind==='hand-net'&&e.handId===active.game.handId);
 requireData(record&&settled>=0&&canonical(frame)===canonical(record.view),'Latest public frame differs from saved settlement.');
 const transfers=data.ledger.slice(settled+1).filter(e=>e.sessionId===active.sessionId&&e.kind==='top-up');
 requireData(transfers.length>0&&transfers.every(e=>active.game.tableTransfers?.some(t=>t.id===e.id&&t.seatId===0&&t.amount===e.tableDelta)),'Latest public frame has no matching table transfer.');
 const expected=structuredClone(frame),hero=expected.seats.find(s=>s.id===0)!;hero.stack+=transfers.reduce((n,e)=>n+e.tableDelta,0);hero.allIn=hero.stack===0;expected.revision+=transfers.length;
 requireData(canonical(expected)===canonical(actual),'Latest public frame differs from exact top-up result.');
}
export async function validateImportedRecords(records:PublicHand[],start=0):Promise<void>{
 const ids=new Set<string>(),cooperate=recoveryScheduler();
 for(let i=0;i<records.length;i++){
  const hand=records[i];requireData(!ids.has(hand.handId),'Duplicate imported hand.');ids.add(hand.handId);if(i<start)continue;
  checkPrivate(hand);const {hash,...body}=hand;requireData(typeof hand.previousHash==='string'&&/^[0-9a-f]{64}$/.test(hand.previousHash)&&hash===await digest(body),'Imported record integrity check failed.');validatePublicHand(hand);await cooperate();
 }
 // Each import file is independently chain-checked by parsePublicHistory.
 // The deduplicated shelf legitimately combines multiple chains; its storage
 // segment chain, not each source file's previousHash, establishes shelf order.
}
export async function validateData(data:AppData,options:{reusePackedHandHashes?:boolean}={}):Promise<void> {
 requireData(data?.schemaVersion===4 && cents(data.revision) && cents(data.epoch) && cents(data.wallet),'Unsupported or invalid saved data. No reset was performed.');
 requireData(Array.isArray(data.ledger)&&Array.isArray(data.sessions)&&Array.isArray(data.hands)&&Array.isArray(data.importedHands),'Incomplete saved data.');
 validateUserNotes(data);const cooperate=recoveryScheduler();
 await timedAsync('recovery.ledgerChain',()=>checkChain(data.ledger));await timedAsync('recovery.handChain',()=>checkChain(data.hands,options.reusePackedHandHashes));
 requireData(new Set(data.ledger.map(e=>e.id)).size===data.ledger.length,'Duplicate financial event.');
 requireData(new Set(data.hands.map(h=>h.id)).size===data.hands.length,'Duplicate settled hand.');
 const knownSessions=new Set(data.sessions.map(s=>s.id));requireData(knownSessions.size===data.sessions.length,'Duplicate session.');
 let wallet=0;let table=0;const financialSessions=new Map<string,SessionMoney>();
 await timedAsync('recovery.financialSemantics',async()=>{for(const [index,event] of data.ledger.entries()){
  validateMoneyEvent(event,index);
  if(event.sessionId&&event.kind!=='adjustment'&&event.kind!=='reset')financialSessions.set(event.sessionId,addSessionMoney(financialSessions.get(event.sessionId)??emptySessionMoney(),event));
  wallet+=event.walletDelta;table+=event.tableDelta;
  requireData(cents(wallet)&&cents(table),'Negative or unsafe account balance.');await cooperate();
 }});
 requireData(wallet===data.wallet,'Wallet does not reconcile to ledger.');
 const settlements=data.ledger.filter(e=>e.kind==='hand-net');
 const settlementByHand=new Map(settlements.map(e=>[e.handId,e]));
 requireData(settlementByHand.size===settlements.length,'Duplicate hand settlement.');
 const handsBySession=new Map<string,string[]>();
 for(const hand of data.hands){const ids=handsBySession.get(hand.sessionId)??[];ids.push(hand.id);handsBySession.set(hand.sessionId,ids);await cooperate();}
 requireData(settlements.length===data.hands.length,'Settlement/history count mismatch.');
 await timedAsync('recovery.handSemantics',async()=>{for(const hand of data.hands){
  assertCashHandProvenance(hand);
  const hero=hand.view.seats.find(s=>s.id===0);
  requireData(hero&&hand.view.street==='complete'&&hand.net===hero.stack-hero.startingStack,'Invalid completed hand.');
  const entry=settlementByHand.get(hand.id);
  requireData(entry?.pokerNet===hand.net&&entry.sessionId===hand.sessionId,'Hand result does not reconcile.');await cooperate();
 }});
 if(data.active){
  const active=data.active; assertAccounting(active.game);assertSupportedCashScope(active.game.profile);
  requireData(active.exitMode===null||active.exitMode==='finish'||active.exitMode==='fold','Invalid saved session exit intent.');
  requireData(data.sessions.some(s=>s.id===active.sessionId&&s.endedAt===null),'Active session missing.');
  const hero=active.game.seats.find(s=>s.id===0);
  requireData(hero,'Hero seat missing.');
  const funds=hero.stack+(active.game.street==='complete'?0:hero.totalCommitted);
  requireData(table===funds,'Seated chips do not reconcile to ledger.');
  assertLatestPublicFrame(data);
  if(active.pending)requireData(active.pending.handId===active.game.handId&&active.pending.revision===active.game.revision&&active.pending.seatId===active.game.actor,'Obsolete pending decision.');
 }else requireData(table===0,'Unseated table funds remain.');
 requireData([...financialSessions.keys()].every(id=>knownSessions.has(id)),'Financial event references missing session.');
 for(const session of data.sessions){
  validateSessionMoney(session,financialSessions.get(session.id)??emptySessionMoney());
  requireData(cents(session.activeMs)&&cents(session.buyIns)&&cents(session.cashOut),'Invalid session totals.');
  requireData(canonical(session.handIds)===canonical(handsBySession.get(session.id)??[]),'Session hand count mismatch.');await cooperate();
 }
 await timedAsync('recovery.configurationSemantics',async()=>{validateConfigurationData(data);await cooperate();validatePolicyViolations(data);await cooperate();validateConfigurationHistory(data);await cooperate();await validateImportedRecords(data.importedHands);});
 assertHumanMemory(data.humanMemory,data.hands);
}
export async function publicHistory(hands:StoredHand[]):Promise<PublicHistory>{
 let previousHash=GENESIS;const output:PublicHand[]=[];
 for(const h of hands){
  const versions=frozenPolicyVersions(h.privateProfiles);validatePolicyVersions(versions);
  const item=await seal<PublicHand>({version:'0.3.0',kind:'public-redacted',handId:h.id,sessionId:h.sessionId,number:h.number,startedAt:h.startedAt,endedAt:h.endedAt,view:structuredClone(h.view),frames:structuredClone(h.frames),net:h.net,...(h.provenance?{provenance:structuredClone(h.provenance)}:{}),...(h.configuration?{configuration:structuredClone(h.configuration)}:{}),...(versions.length?{policyVersions:versions}:{}),previousHash,hash:''});
  output.push(item);previousHash=item.hash;
 }
 return {format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'Public redacted study history. Not a resumable save or financial import. Never credits bankroll or results.',hands:output};
}
const privateKeys=new Set(['deck','deckCursor','burned','privateProfiles','profiles','drawToken','pending','ownCards','seed','policyVersion','archetype','observationHash','lastActedBet','personalityId','personalitySeed','traits','memory','opponents','skill','aggression','looseness','ranges','foldedOpponents','rangeAnalysis','weightedCombos','distribution','diagnostics','preflop']);
function checkPrivate(value:unknown):void{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){requireData(!privateKeys.has(key),'Private information is not permitted in a public history import.');checkPrivate(item);}}
/** Public version labels do not load code or disclose any per-seat policy data.
 * Unknown future versions remain readable; malformed metadata is never repaired
 * on import because normalization would invalidate the supplied hash chain. */
function validatePolicyVersions(value:unknown):void{
 if(value===undefined)return;
 requireData(Array.isArray(value)&&value.length<=10&&value.every((version,index)=>
  typeof version==='string'&&/^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(version)&&
  (index===0||value[index-1]<version)),'Invalid public policy version metadata.');
}
function validatePublicHand(hand:PublicHand):void{
 validateHandConfiguration(hand);
 validateHandProvenance(hand);
 requireData(hand.version==='0.3.0'&&hand.kind==='public-redacted','Unsupported public hand record.');
 validatePolicyVersions(hand.policyVersions);
 requireData(typeof hand.handId==='string'&&hand.handId.length>0&&hand.handId.length<=160&&typeof hand.sessionId==='string'&&hand.sessionId.length>0&&hand.sessionId.length<=160,'Invalid hand/session identity.');
 requireData(Number.isSafeInteger(hand.number)&&hand.number>0&&Number.isSafeInteger(hand.net),'Invalid hand metadata.');
 requireData(typeof hand.startedAt==='string'&&typeof hand.endedAt==='string'&&Number.isFinite(Date.parse(hand.startedAt))&&Number.isFinite(Date.parse(hand.endedAt))&&Date.parse(hand.endedAt)>=Date.parse(hand.startedAt),'Invalid hand timestamps.');
 const view=hand.view;requireData(view?.street==='complete'&&view.handId===hand.handId&&Array.isArray(hand.frames)&&hand.frames.length>0,'Only completed public hand records can be imported.');
 validatePublicReplay(hand.frames);
 requireData(view.seats.length>=2&&view.seats.length<=10&&view.actor===null&&view.pot===0,'Invalid settled table.');
 const ids=new Set(view.seats.map(s=>s.id));requireData(ids.size===view.seats.length&&ids.has(0),'Invalid public seats.');
 const cards=[...view.board,...view.seats.flatMap(s=>s.hole)];requireData(new Set(cards).size===cards.length&&cards.every(c=>/^[2-9TJQKA][cdhs]$/.test(c)),'Invalid public cards.');
 const sums=new Map(view.seats.map(s=>[s.id,s.startingStack]));let paid=0,refund=0,award=0,rake=0;
 const events=new Set<string>();const decisions=new Set<string>();
 for(const e of view.events){
  requireData(e.handId===hand.handId&&!events.has(e.id),'Invalid event identity.');events.add(e.id);
  if(e.type==='action'){requireData(e.decisionId&&!decisions.has(e.decisionId),'Duplicate action.');decisions.add(e.decisionId);}
  if(['blind','action','refund','award','rake'].includes(e.type)){
   requireData(cents(e.amount),'Invalid event amount.');const amount=e.amount;
   if(e.type==='rake'){rake+=amount;continue;}
   requireData(e.seatId!==undefined&&sums.has(e.seatId),'Unknown event seat.');
   const debit=e.type==='blind'||e.type==='action';const next=sums.get(e.seatId)!+(debit?-amount:amount);requireData(cents(next),'Event creates invalid stack.');sums.set(e.seatId,next);
   if(debit)paid+=amount;else if(e.type==='refund')refund+=amount;else award+=amount;
  }
 }
 requireData(paid-refund===award+rake&&rake===view.rake,'Imported pot does not reconcile.');
 requireData(view.seats.every(s=>cents(s.stack)&&cents(s.startingStack)&&sums.get(s.id)===s.stack),'Imported final stacks differ from events.');
 requireData(view.pots.reduce((n,p)=>n+p.amount,0)===award&&Object.values(view.payouts).reduce((n,x)=>n+x,0)===award,'Imported awards differ from pots.');
 const hero=view.seats.find(s=>s.id===0)!;requireData(hand.net===hero.stack-hero.startingStack,'Imported net result is invalid.');
 requireData(canonical(hand.frames.at(-1))===canonical(view),'Replay final frame mismatch.');
 let revision=-1;let eventCount=0;
 for(const frame of hand.frames){
  requireData(frame.handId===hand.handId&&frame.revision>revision&&frame.events.length>=eventCount,'Replay revisions are not increasing.');
  requireData(canonical(frame.profile)===canonical(view.profile)&&frame.button===view.button,'Replay rules changed.');
  requireData(canonical(frame.events)===canonical(view.events.slice(0,frame.events.length)),'Replay event prefix changed.');
  requireData(canonical(frame.board)===canonical(view.board.slice(0,frame.board.length)),'Replay board changed.');
  for(const seat of frame.seats)if(seat.id!==0&&frame.street!=='complete')requireData(seat.hole.length===0,'Replay reveals private cards prematurely.');
  revision=frame.revision;eventCount=frame.events.length;
 }
}
export async function parsePublicHistory(text:string):Promise<PublicHand[]>{
 requireData(text.length<=10_000_000,'Import is limited to 10 MB.');
 const payload=JSON.parse(text) as PublicHistory;
 requireData(payload.format==='ai-texas-hold-em-public-history'&&payload.version==='0.3.0'&&Array.isArray(payload.hands)&&payload.hands.length<=10000,'Unsupported history format/version.');
 checkPrivate(payload);await checkChain(payload.hands);const ids=new Set<string>();
 for(const hand of payload.hands){requireData(!ids.has(hand.handId),'Duplicate imported hand.');ids.add(hand.handId);validatePublicHand(hand);}
 return structuredClone(payload.hands);
}
export async function appendMoney(data:AppData,entry:Omit<MoneyEvent,'index'|'previousHash'|'hash'>):Promise<void>{
 requireData(!data.ledger.some(e=>e.id===entry.id),'Duplicate financial event.');
 const record=await seal({...entry,index:data.ledger.length,previousHash:data.ledger.at(-1)?.hash??GENESIS,hash:''});
 data.ledger=[...data.ledger,record];data.wallet+=entry.walletDelta;
}
/** Migrations clone before changing structure. Ledger/hand records and hashes are untouched.
 * v4 makes durable session exit intent explicit so the shipped v3 reader fails closed. */
export async function migrateData(input:unknown):Promise<AppData>{
 requireData(input&&typeof input==='object','Saved data is invalid.');
 const source=input as Record<string,unknown>;
 requireData(source.schemaVersion===2||source.schemaVersion===3||source.schemaVersion===4,'Unknown saved-data version. Existing data was preserved; use a compatible application version.');
 const data=structuredClone(source) as unknown as AppData;
 if(source.schemaVersion===2)data.importedHands=[];
 if(source.schemaVersion===2||source.schemaVersion===3){
  data.schemaVersion=4;
  if(data.active)data.active.exitMode=null;
 }
 await validateData(data);return data;
}
