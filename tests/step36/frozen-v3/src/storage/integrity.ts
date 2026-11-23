import { assertAccounting, projectView } from '../core/engine';
import { validatePublicReplay } from '../core/replay';
import { sha256 } from '@noble/hashes/sha2.js';
import type { AppData, MoneyEvent, PublicHand, PublicHistory, StoredHand } from '../session/types';

export const GENESIS = '0'.repeat(64);
export function requireData(ok: unknown, message:string):asserts ok { if (!ok) throw new Error(message); }
export const cents = (n:unknown):n is number => Number.isSafeInteger(n) && (n as number)>=0;
export function canonical(value:unknown):string {
 if(value===null || typeof value!=='object') return JSON.stringify(value);
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 const record=value as Record<string,unknown>;
 return '{'+Object.keys(record).filter(k=>record[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(record[k])).join(',')+'}';
}
export async function digest(value:unknown):Promise<string> {
 // Identical SHA-256 on HTTPS and the managed HTTP preview. This does not
 // replace production CSPRNG; getRandomValues still fails closed for dealing.
 const bytes=sha256(new TextEncoder().encode(canonical(value)));
 return [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function seal<T extends {hash:string}>(record:T):Promise<T> { const body={...record} as Partial<T>; delete body.hash; return {...record,hash:await digest(body)}; }
export async function checkChain(records:({hash:string;previousHash:string})[]):Promise<void> {
 let previous=GENESIS;
 for(const item of records){ requireData(item.previousHash===previous,'History chain is broken.');const {hash,...body}=item;requireData(hash===await digest(body),'Saved record integrity check failed.');previous=hash; }
}
export async function validateData(data:AppData):Promise<void> {
 requireData(data?.schemaVersion===3 && cents(data.revision) && cents(data.epoch) && cents(data.wallet),'Unsupported or invalid saved data. No reset was performed.');
 requireData(Array.isArray(data.ledger)&&Array.isArray(data.sessions)&&Array.isArray(data.hands)&&Array.isArray(data.importedHands),'Incomplete saved data.');
 await checkChain(data.ledger);await checkChain(data.hands);
 requireData(new Set(data.ledger.map(e=>e.id)).size===data.ledger.length,'Duplicate financial event.');
 requireData(new Set(data.hands.map(h=>h.id)).size===data.hands.length,'Duplicate settled hand.');
 requireData(new Set(data.sessions.map(s=>s.id)).size===data.sessions.length,'Duplicate session.');
 let wallet=0;let table=0;
 for(const [index,event] of data.ledger.entries()){
  requireData(event.index===index&&Number.isSafeInteger(event.walletDelta)&&Number.isSafeInteger(event.tableDelta)&&Number.isSafeInteger(event.pokerNet),'Invalid financial amount.');
  if(event.kind==='hand-net') requireData(event.walletDelta===0&&event.pokerNet===event.tableDelta&&!!event.handId,'Invalid settlement ledger.');
  else requireData(event.pokerNet===0,'Manual adjustments/transfers cannot count as poker profit.');
  if(event.kind==='buy-in'||event.kind==='top-up'||event.kind==='cash-out')requireData(event.walletDelta+event.tableDelta===0,'Transfer does not conserve funds.');
  if(event.kind==='adjustment'||event.kind==='reset')requireData(event.tableDelta===0,'Wallet adjustment cannot change table chips.');
  wallet+=event.walletDelta;table+=event.tableDelta;
  requireData(cents(wallet)&&cents(table),'Negative or unsafe account balance.');
 }
 requireData(wallet===data.wallet,'Wallet does not reconcile to ledger.');
 const settlements=data.ledger.filter(e=>e.kind==='hand-net');
 requireData(settlements.length===data.hands.length,'Settlement/history count mismatch.');
 for(const hand of data.hands){
  const hero=hand.view.seats.find(s=>s.id===0);
  requireData(hero&&hand.view.street==='complete'&&hand.net===hero.stack-hero.startingStack,'Invalid completed hand.');
  const entry=settlements.find(e=>e.handId===hand.id);
  requireData(entry?.pokerNet===hand.net&&entry.sessionId===hand.sessionId,'Hand result does not reconcile.');
 }
 if(data.active){
  const active=data.active; assertAccounting(active.game);
  requireData(data.sessions.some(s=>s.id===active.sessionId&&s.endedAt===null),'Active session missing.');
  const hero=active.game.seats.find(s=>s.id===0);
  requireData(hero,'Hero seat missing.');
  const funds=hero.stack+(active.game.street==='complete'?0:hero.totalCommitted);
  requireData(table===funds,'Seated chips do not reconcile to ledger.');
  requireData(canonical(active.frames.at(-1))===canonical(projectView(active.game,0))||!!active.game.tableTransfers?.length,'Latest public frame differs from game.');
  if(active.pending)requireData(active.pending.handId===active.game.handId&&active.pending.revision===active.game.revision&&active.pending.seatId===active.game.actor,'Obsolete pending decision.');
 }else requireData(table===0,'Unseated table funds remain.');
 for(const session of data.sessions){
  requireData(cents(session.activeMs)&&cents(session.buyIns)&&cents(session.cashOut),'Invalid session totals.');
  requireData(session.handIds.length===data.hands.filter(h=>h.sessionId===session.id).length,'Session hand count mismatch.');
 }
}
export async function publicHistory(hands:StoredHand[]):Promise<PublicHistory>{
 let previousHash=GENESIS;const output:PublicHand[]=[];
 for(const h of hands){
  const item=await seal<PublicHand>({version:'0.3.0',kind:'public-redacted',handId:h.id,sessionId:h.sessionId,number:h.number,startedAt:h.startedAt,endedAt:h.endedAt,view:structuredClone(h.view),frames:structuredClone(h.frames),net:h.net,previousHash,hash:''});
  output.push(item);previousHash=item.hash;
 }
 return {format:'ai-texas-hold-em-public-history',version:'0.3.0',disclosure:'Public redacted study history. Not a resumable save or financial import. Never credits bankroll or results.',hands:output};
}
const privateKeys=new Set(['deck','deckCursor','burned','privateProfiles','profiles','drawToken','pending','ownCards','seed','policyVersion','archetype','observationHash','lastActedBet']);
function checkPrivate(value:unknown):void{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){requireData(!privateKeys.has(key),'Private information is not permitted in a public history import.');checkPrivate(item);}}
function validatePublicHand(hand:PublicHand):void{
 requireData(hand.version==='0.3.0'&&hand.kind==='public-redacted','Unsupported public hand record.');
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
 data.ledger.push(record);data.wallet+=entry.walletDelta;
}
/** Version 2 draft had the same ledger/session model but no imported study shelf. */
export async function migrateData(input:unknown):Promise<AppData>{
 requireData(input&&typeof input==='object','Saved data is invalid.');
 const source=input as Record<string,unknown>;
 requireData(source.schemaVersion===2||source.schemaVersion===3,'Unknown saved-data version. Export existing records before resetting.');
 const data=structuredClone(source) as unknown as AppData;
 if(source.schemaVersion===2){data.schemaVersion=3;data.importedHands=[];}
 await validateData(data);return data;
}
