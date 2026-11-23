import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {AppData,MoneyEvent,StoredHand} from '../../src/session/types';

/** Independent test oracle. No production hashing, checkpoints, engine, integrity,
 * accounting, statistics or projection code is imported. Hashes detect accidental
 * corruption; this deliberately makes no claim about an attacker resealing data. */
export function referenceEncode(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(referenceEncode).join(',')}]`;
 if(value!==null&&typeof value==='object')return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${referenceEncode(v)}`).join(',')}}`;
 return JSON.stringify(value);
}
export const referenceHash=(value:unknown)=>createHash('sha256').update(referenceEncode(value)).digest('hex');
const genesis='0'.repeat(64),maximum=BigInt(Number.MAX_SAFE_INTEGER);
const money=(n:number)=>{assert.ok(Number.isSafeInteger(n),'Noninteger or unsafe monetary value');return BigInt(n);};
const bounded=(n:bigint)=>assert.ok(n>=0n&&n<=maximum,'Negative or unsafe balance');
const sum=(values:bigint[])=>values.reduce((a,b)=>a+b,0n);

export interface ReferenceHandIndex {
 id:string;sessionId:string;epoch:number;net:number;hash:string;previousHash:string;
}
export interface FinancialSnapshot {
 wallet:number;ledger:readonly MoneyEvent[];sessions:AppData['sessions'];active:AppData['active'];
 handIndex:readonly ReferenceHandIndex[];
}
interface SessionTotals {funded:bigint;withdrawn:bigint;out:bigint;net:bigint;balance:bigint;buys:number;outs:number;hands:string[]}

/** Reconcile all *canonical financial events*, not their cached totals. Compact
 * hand indexes bind a unique settlement to its session/net and historical hash.
 * Full hand-body verification is a separate, explicitly required audit below. */
export function referenceFinancial(snapshot:FinancialSnapshot) {
 let wallet=0n,table=0n,poker=0n,manual=0n,previous=genesis;
 const ids=new Set<string>(),settlements=new Map<string,MoneyEvent>(),sessions=new Map<string,SessionTotals>();
 const registered=new Map(snapshot.sessions.map(s=>[s.id,s]));
 assert.equal(registered.size,snapshot.sessions.length,'Duplicate session');
 for(const [index,event] of snapshot.ledger.entries()){
  assert.equal(event.index,index,'Financial sequence gap or reorder');
  assert.ok(typeof event.id==='string'&&event.id&&!ids.has(event.id),'Duplicate or missing financial identity');ids.add(event.id);
  const {hash,...body}=event;assert.equal(event.previousHash,previous,'Financial predecessor disagreement');assert.equal(hash,referenceHash(body),'Financial checksum mismatch');previous=hash;
  const walletDelta=money(event.walletDelta),tableDelta=money(event.tableDelta),net=money(event.pokerNet);
  wallet+=walletDelta;table+=tableDelta;bounded(wallet);bounded(table);
  if(event.kind==='adjustment'||event.kind==='reset'){
   assert.equal(tableDelta,0n);assert.equal(net,0n);assert.equal(event.handId,undefined);manual+=walletDelta;continue;
  }
  assert.ok(event.sessionId&&registered.has(event.sessionId),'Unknown financial session');
  let s=sessions.get(event.sessionId);if(!s){s={funded:0n,withdrawn:0n,out:0n,net:0n,balance:0n,buys:0,outs:0,hands:[]};sessions.set(event.sessionId,s);}
  assert.equal(s.outs,0,'Event after terminal cashout');
  if(event.kind==='hand-net'){
   assert.equal(event.epoch,registered.get(event.sessionId)!.epoch,'Settlement session epoch mismatch');
   assert.equal(walletDelta,0n);assert.equal(tableDelta,net);
   assert.ok(event.handId&&!settlements.has(event.handId),'Duplicate or missing settlement');settlements.set(event.handId,event);s.hands.push(event.handId);
   assert.equal(s.buys,1,'Settlement without initial buy-in');s.net+=net;poker+=net;
  }else{
   assert.equal(net,0n);assert.equal(walletDelta+tableDelta,0n,'Transfer creates money');assert.equal(event.handId,undefined);
   if(event.kind==='buy-in'){assert.ok(tableDelta>0n);assert.equal(s.buys++,0,'Duplicate buy-in');s.funded+=tableDelta;}
   else if(event.kind==='top-up'){assert.equal(s.buys,1);assert.ok(tableDelta>=0n);s.funded+=tableDelta;}
   else if(event.kind==='table-adjustment'){assert.equal(s.buys,1);if(tableDelta>=0n)s.funded+=tableDelta;else s.withdrawn-=tableDelta;}
   else if(event.kind==='cash-out'){assert.equal(s.buys,1);assert.ok(tableDelta<=0n);s.out-=tableDelta;s.outs++;}
   else assert.fail('Unknown financial kind');
  }
  s.balance+=tableDelta;bounded(s.balance);
 }
 assert.equal(wallet,money(snapshot.wallet),'Saved wallet disagrees with canonical ledger');
 assert.equal(wallet+table,manual+poker,'Manual and poker result reconciliation');
 const hands=new Set<string>();let last=genesis,netFromHands=0n;
 for(const h of snapshot.handIndex){
  assert.ok(!hands.has(h.id),'Duplicate hand index identity');hands.add(h.id);
  assert.equal(h.previousHash,last,'Hand index predecessor disagreement');assert.match(h.hash,/^[0-9a-f]{64}$/);last=h.hash;
  const settled=settlements.get(h.id);assert.ok(settled,'Index without settlement');assert.equal(settled.sessionId,h.sessionId);assert.equal(settled.epoch,h.epoch);assert.equal(settled.pokerNet,h.net);netFromHands+=money(h.net);
 }
 assert.equal(hands.size,settlements.size,'Missing settlement index');assert.equal(netFromHands,poker);
 let open=0;
 for(const s of snapshot.sessions){
  const actual=sessions.get(s.id);assert.ok(actual,'Session without financial events');
  assert.equal(money(s.buyIns),actual.funded);assert.equal(money(s.tableWithdrawals??0),actual.withdrawn);assert.equal(money(s.cashOut),actual.out);
  assert.equal(actual.buys,1);assert.deepEqual(s.handIds,actual.hands,'Session hand order mismatch');
  assert.equal(actual.outs,s.endedAt===null?0:1);
  if(s.endedAt!==null)assert.equal(actual.balance,0n,'Closed session retains chips');else{open++;assert.equal(snapshot.active?.sessionId,s.id,'Open session does not own active table');}
 }
 assert.equal(table,sum([...sessions.values()].map(s=>s.balance)));
 if(snapshot.active){
  assert.equal(open,1);const active=snapshot.active,hero=active.game.seats.find(s=>s.id===0);assert.ok(hero);
  assert.equal(table,money(hero.stack)+(active.game.street==='complete'?0n:money(hero.totalCommitted)),'Active Hero stack differs from financial ledger');
  if(active.game.street==='complete'){assert.ok(hands.has(active.game.handId),'Completed hand missing from settlement index');assert.ok(settlements.has(active.game.handId));}
 }else{assert.equal(open,0);assert.equal(table,0n);}
 return {wallet:Number(wallet),table:Number(table),poker:Number(poker),manual:Number(manual),hands:hands.size,sessions:sessions.size,financialEvents:ids.size};
}

export function financialInput(data:AppData):FinancialSnapshot {
 return {...data,handIndex:data.hands.map(h=>({id:h.id,sessionId:h.sessionId,epoch:h.epoch,net:h.net,hash:h.hash,previousHash:h.previousHash}))};
}

/** Replay canonical hand events with BigInt. This audit is not substituted by an
 * index, frame summary, checkpoint digest or previously calculated hand net. */
export function referenceFullHands(hands:readonly StoredHand[],expectedPreviousHash=genesis) {
 let previous=expectedPreviousHash,profit=0n,totalRake=0n;const seen=new Set<string>();
 for(const hand of hands){
  assert.ok(!seen.has(hand.id));seen.add(hand.id);const {hash,...body}=hand;
  assert.equal(hand.previousHash,previous);assert.equal(hash,referenceHash(body));previous=hash;
  const stacks=new Map(hand.view.seats.map(s=>[s.id,money(s.startingStack)]));assert.equal(stacks.size,hand.view.seats.length);
  const events=new Set<string>();let debits=0n,refunds=0n,awards=0n,rake=0n;
  for(const e of hand.view.events){
   assert.equal(e.handId,hand.id);assert.ok(!events.has(e.id));events.add(e.id);
   if(!['blind','action','refund','award','rake'].includes(e.type))continue;
   assert.ok(e.amount!==undefined);const amount=money(e.amount);assert.ok(amount>=0n);
   if(e.type==='rake'){rake+=amount;continue;}
   assert.ok(e.seatId!==undefined&&stacks.has(e.seatId));const debit=e.type==='blind'||e.type==='action';
   stacks.set(e.seatId,stacks.get(e.seatId)!+(debit?-amount:amount));bounded(stacks.get(e.seatId)!);
   if(debit)debits+=amount;else if(e.type==='refund')refunds+=amount;else awards+=amount;
  }
  for(const s of hand.view.seats)assert.equal(stacks.get(s.id),money(s.stack),'Canonical event payout mismatch');
  assert.equal(debits-refunds,awards+rake);assert.equal(rake,money(hand.view.rake));
  assert.equal(sum(Object.values(hand.view.payouts).map(money)),awards);
  const hero=hand.view.seats.find(s=>s.id===0);assert.ok(hero);assert.equal(stacks.get(0)!-money(hero.startingStack),money(hand.net));
  profit+=money(hand.net);totalRake+=rake;
 }
 return {hands:seen.size,poker:Number(profit),totalRake:Number(totalRake)};
}
