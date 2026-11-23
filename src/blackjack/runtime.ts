/** B2 storage contract. Canonical closed shoes are immutable records; the hot checkpoint is bounded to one shoe. */
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {canonical} from '../storage/integrity';
import {applyBlackjack,assertAccounting,blackjackView,createBlackjackState,restoreBlackjack,type BlackjackState,type BlackjackPlay} from './engine';
import {BLACKJACK_STARTING_BALANCE} from './presets';
import type {BlackjackSession} from './view-model';
export const BLACKJACK_SAVE_VERSION='blackjack-save-1';
export const GENESIS_HASH='0'.repeat(64);
export const demand=(condition:unknown,message:string):void=>{if(!condition)throw Error(message);};
export const digest=(value:unknown):string=>bytesToHex(sha256(new TextEncoder().encode(canonical(value))));
export const emptySession=():BlackjackSession=>({rounds:0,wagered:0,fees:0,net:0,blackjacks:0,decisions:0,mistakes:0,sideBetNet:0});
export interface DecisionReview {commandId:string;revision:number;roundId:string;played:BlackjackPlay;suggested:BlackjackPlay;reason:string;model:'approx-strategy-0.1';cards:string[];dealerUp:string;}
export interface BlackjackActive {id:string;sessionId:string;startedAt:string;engine:BlackjackState;reviews:DecisionReview[];prior:BlackjackSession;}
export interface RecordHead {sequence:number;hash:string;balance:number;}
export interface BlackjackData {schemaVersion:1;version:typeof BLACKJACK_SAVE_VERSION;revision:number;balance:number;head:RecordHead;active:BlackjackActive|null;lastSession:BlackjackSession|null;}
export interface SegmentBody {kind:'segment';id:string;sessionId:string;startedAt:string;finishedAt:string;engine:BlackjackState;reviews:DecisionReview[];closedSession:boolean;}
export interface AdjustmentBody {kind:'adjustment';id:string;at:string;before:number;after:number;note:string;}
export type RecordBody=SegmentBody|AdjustmentBody;
export interface BlackjackRecord {sequence:number;previousHash:string;body:RecordBody;hash:string;}
export interface BlackjackCheckpoint {format:typeof BLACKJACK_SAVE_VERSION;revision:number;payload:BlackjackData;hash:string;}
export interface BlackjackAnchor {format:'blackjack-anchor-1';revision:number;checkpointHash:string;sequence:number;recordHash:string;}
export interface BlackjackSnapshot {checkpoint:BlackjackCheckpoint;anchor:BlackjackAnchor;records:BlackjackRecord[];}
export interface BlackjackPort {load():Promise<BlackjackData|null>;commit(expected:number|null,next:BlackjackData,records:BlackjackRecord[]):Promise<void>;snapshot(previous?:boolean):Promise<BlackjackSnapshot|null>;close():void;}
export class BlackjackConflictError extends Error {constructor(){super('Another tab changed blackjack. Reload the committed save before playing.');}}
export function initialBlackjackData():BlackjackData{return{schemaVersion:1,version:BLACKJACK_SAVE_VERSION,revision:0,balance:BLACKJACK_STARTING_BALANCE,head:{sequence:0,hash:GENESIS_HASH,balance:BLACKJACK_STARTING_BALANCE},active:null,lastSession:null};}
export function addStats(a:BlackjackSession,b:BlackjackSession):BlackjackSession {const n=emptySession();for(const key of Object.keys(n) as (keyof BlackjackSession)[])n[key]=a[key]+b[key];return n;}
export function segmentStats(engine:BlackjackState,reviews:DecisionReview[]):BlackjackSession {
 const result=emptySession();result.rounds=engine.completed.length;result.net=engine.completed.reduce((sum,r)=>sum+r.net!,0);
 result.wagered=engine.completed.reduce((sum,r)=>sum+r.hands.reduce((s,h)=>s+h.bet,0)+r.insuranceBet,0);result.fees=engine.completed.reduce((sum,r)=>sum+r.ante,0);
 result.blackjacks=engine.completed.reduce((sum,r)=>sum+r.hands.filter(h=>h.result==='blackjack').length,0);
 result.decisions=reviews.length;result.mistakes=reviews.filter(r=>r.played!==r.suggested).length;return result;
}
export function reviewFor(engine:BlackjackState,commandId:string,played:BlackjackPlay,suggested:BlackjackPlay,reason:string):DecisionReview {
 const v=blackjackView(engine),r=v.round;demand(r&&v.legalActions.includes(suggested),'A model suggestion must be a currently legal action');
 demand(typeof reason==='string'&&reason.length<=600,'Invalid coach explanation');
 return{commandId,revision:engine.revision,roundId:r!.id,played,suggested,reason,model:'approx-strategy-0.1',cards:r!.hands[Math.max(0,r!.actor)].cards,dealerUp:r!.dealer[0]!,};
}
function validateReviews(engine:BlackjackState,reviews:DecisionReview[]):void {
 demand(Array.isArray(reviews)&&new Set(reviews.map(r=>r.commandId)).size===reviews.length,'Duplicate decision reviews');
 const byId=new Map(reviews.map(r=>[r.commandId,r]));let replay=createBlackjackState(engine.rules,engine.initialShoe,{balance:engine.initialBalance,ante:engine.ante,...(engine.seating===undefined?{}:{seating:engine.seating})});
 for(const command of engine.commands){const review=byId.get(command.id);if(review){demand(command.type!=='deal'&&command.type!=='shuffle','Review is not a player action');const expected=reviewFor(replay,command.id,command.type as BlackjackPlay,review.suggested,review.reason);demand(canonical(expected)===canonical(review),'Decision review public context mismatch');byId.delete(command.id);}replay=applyBlackjack(replay,command);}
 demand(byId.size===0,'Review refers to a missing decision');
}
export function validateHot(data:BlackjackData):void {
 demand(data?.schemaVersion===1&&data.version===BLACKJACK_SAVE_VERSION,'Unsupported blackjack save version');
 demand(Number.isSafeInteger(data.revision)&&data.revision>=0&&Number.isSafeInteger(data.balance)&&data.balance>=0,'Invalid blackjack financial checkpoint');
 demand(Number.isSafeInteger(data.head?.sequence)&&data.head.sequence>=0&&/^[a-f0-9]{64}$/.test(data.head.hash)&&Number.isSafeInteger(data.head.balance)&&data.head.balance>=0,'Invalid blackjack record head');
 if(data.active){const a=data.active;demand(typeof a.id==='string'&&a.id.length>0&&typeof a.sessionId==='string'&&a.sessionId.length>0&&typeof a.startedAt==='string','Invalid active blackjack identity');assertAccounting(a.engine);demand(a.engine.initialBalance===data.head.balance&&a.engine.balance===data.balance,'Active blackjack balance disagrees with archived ledger');demand(!a.engine.commands.some(c=>c.type==='shuffle'),'A blackjack checkpoint must contain one shoe only');demand(Array.isArray(a.reviews),'Missing decision reviews');for(const val of Object.values(a.prior))demand(Number.isSafeInteger(val),'Invalid prior session summary');}
 else demand(data.balance===data.head.balance,'Inactive blackjack wallet disagrees with archived ledger');
}
export function checkpoint(data:BlackjackData):BlackjackCheckpoint {validateHot(data);const payload=structuredClone(data);return{format:BLACKJACK_SAVE_VERSION,revision:data.revision,payload,hash:digest(payload)};}
export function anchorFor(c:BlackjackCheckpoint):BlackjackAnchor{return{format:'blackjack-anchor-1',revision:c.revision,checkpointHash:c.hash,sequence:c.payload.head.sequence,recordHash:c.payload.head.hash};}
export function checkedCheckpoint(value:unknown,anchor?:unknown):BlackjackCheckpoint {
 const c=value as BlackjackCheckpoint;demand(c?.format===BLACKJACK_SAVE_VERSION&&c.revision===c.payload?.revision&&c.hash===digest(c.payload),'Blackjack save integrity could not be verified. Data was preserved.');validateHot(c.payload);
 if(anchor!==undefined)demand(canonical(anchorFor(c))===canonical(anchor),'Blackjack committed head disagrees with the checkpoint. Data was preserved.');return c;
}
export function recordAfter(head:RecordHead,body:RecordBody):BlackjackRecord {const payload={sequence:head.sequence+1,previousHash:head.hash,body};return{...payload,hash:digest(payload)};}
export function recordBalance(record:BlackjackRecord):number {return record.body.kind==='segment'?record.body.engine.balance:record.body.after;}
export function appendRecord(data:BlackjackData,record:BlackjackRecord):void {demand(record.sequence===data.head.sequence+1&&record.previousHash===data.head.hash,'Record append is not consecutive');data.head={sequence:record.sequence,hash:record.hash,balance:recordBalance(record)};}
/** Full replay deliberately reads every canonical archived shoe only on recovery/audit/export. */
export function auditSnapshot(snapshot:BlackjackSnapshot):BlackjackData {
 const c=checkedCheckpoint(snapshot.checkpoint,snapshot.anchor),data=c.payload;demand(Array.isArray(snapshot.records)&&snapshot.records.length===data.head.sequence,'Missing or extra blackjack financial records');
 let prior:RecordHead={sequence:0,hash:GENESIS_HASH,balance:BLACKJACK_STARTING_BALANCE};const sessions=new Map<string,BlackjackSession>();let lastSession:BlackjackSession|null=null;const ids=new Set<string>();
 for(const record of snapshot.records){const {hash,...payload}=record;demand(record.sequence===prior.sequence+1&&record.previousHash===prior.hash&&hash===digest(payload),'Missing, reordered or corrupted blackjack financial record');demand(!ids.has(record.body.id),'Duplicate blackjack archive identity');ids.add(record.body.id);
  if(record.body.kind==='segment'){const b=record.body,e=restoreBlackjack(b.engine);demand(e.initialBalance===prior.balance&&(!e.round||e.round.phase==='settled'),'Archived blackjack segment financial mismatch');demand(!e.commands.some(cmd=>cmd.type==='shuffle'),'Archived segment contains multiple shoes');validateReviews(e,b.reviews);const total=addStats(sessions.get(b.sessionId)??emptySession(),segmentStats(e,b.reviews));sessions.set(b.sessionId,total);if(b.closedSession)lastSession=total;
  }else{const b=record.body;demand(b.kind==='adjustment'&&b.before===prior.balance&&Number.isSafeInteger(b.after)&&b.after>=0&&typeof b.note==='string'&&b.note.trim().length>0&&b.note.length<=300,'Invalid blackjack balance adjustment');}
  prior={sequence:record.sequence,hash:record.hash,balance:recordBalance(record)};
 }
 demand(canonical(prior)===canonical(data.head),'Blackjack checkpoint and journal head disagree');
 if(data.active){restoreBlackjack(data.active.engine);validateReviews(data.active.engine,data.active.reviews);demand(canonical(data.active.prior)===canonical(sessions.get(data.active.sessionId)??emptySession()),'Incremental blackjack session statistics disagree with full replay');}
 demand(canonical(data.lastSession)===canonical(lastSession),'Finished blackjack session summary disagrees with full replay');return structuredClone(data);
}
export function verifyTransition(current:BlackjackCheckpoint|null,next:BlackjackCheckpoint,records:BlackjackRecord[],expected:number|null):void {
 demand(next.revision===(expected??-1)+1,'Invalid blackjack commit revision');if((current?.revision??null)!==expected)throw new BlackjackConflictError();
 let head=current?.payload.head??{sequence:0,hash:GENESIS_HASH,balance:BLACKJACK_STARTING_BALANCE};
 for(const record of records){const{hash,...payload}=record;demand(record.sequence===head.sequence+1&&record.previousHash===head.hash&&hash===digest(payload),'Invalid appended blackjack record');const b=record.body;demand((b.kind==='segment'?b.engine.initialBalance:b.before)===head.balance,'Appended record balance mismatch');head={sequence:record.sequence,hash:record.hash,balance:recordBalance(record)};}
 demand(canonical(head)===canonical(next.payload.head),'Checkpoint omitted or duplicated financial records');
}
