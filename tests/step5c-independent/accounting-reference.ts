import assert from 'node:assert/strict';
import type {AppData} from '../../src/session/types';

/** Independent test oracle. Deliberately imports no engine, integrity, projection,
 * hash, or production accounting function. Replays monetary event amounts and
 * each completed hand's public debits/refunds/awards with integer arithmetic. */
export function replayAccounting(data:AppData){
 let wallet=0,table=0,poker=0,manual=0;
 const moneyIds=new Set<string>(),settled=new Map<string,number>();
 const perSession=new Map<string,{funded:number;withdrawn:number;cashedOut:number;net:number;cashouts:number}>();
 for(const [index,event] of data.ledger.entries()){
  assert.ok(['adjustment','reset','buy-in','top-up','cash-out','hand-net','table-adjustment'].includes(event.kind));
  assert.equal(event.index,index);assert.ok(!moneyIds.has(event.id));moneyIds.add(event.id);
  for(const amount of [event.walletDelta,event.tableDelta,event.pokerNet])assert.ok(Number.isSafeInteger(amount));
  wallet+=event.walletDelta;table+=event.tableDelta;
  assert.ok(wallet>=0&&table>=0);
  if(event.kind==='adjustment'||event.kind==='reset'){
   assert.equal(event.tableDelta,0);assert.equal(event.pokerNet,0);manual+=event.walletDelta;
  }else{
   assert.ok(event.sessionId);let session=perSession.get(event.sessionId);
   if(!session){session={funded:0,withdrawn:0,cashedOut:0,net:0,cashouts:0};perSession.set(event.sessionId,session);}
   assert.equal(session.cashouts,0);
   if(event.kind==='hand-net'){
    assert.ok(event.handId);assert.ok(!settled.has(event.handId));settled.set(event.handId,event.pokerNet);
    assert.equal(event.walletDelta,0);assert.equal(event.tableDelta,event.pokerNet);
    poker+=event.pokerNet;session.net+=event.pokerNet;
   }else{
    assert.equal(event.walletDelta+event.tableDelta,0);assert.equal(event.pokerNet,0);
    if(event.kind==='cash-out'){session.cashedOut-=event.tableDelta;session.cashouts++;}
    else if(event.tableDelta>=0)session.funded+=event.tableDelta;
    else session.withdrawn-=event.tableDelta;
   }
  }
 }
 assert.equal(wallet,data.wallet);assert.equal(wallet+table,manual+poker);
 const handIds=new Set<string>();let handProfit=0,totalRake=0;
 for(const hand of data.hands){
  assert.ok(!handIds.has(hand.id));handIds.add(hand.id);
  const balances=new Map(hand.view.seats.map(seat=>[seat.id,seat.startingStack]));
  const eventIds=new Set<string>();let contributed=0,refunds=0,awards=0,rake=0;
  for(const event of hand.view.events){
   assert.equal(event.handId,hand.id);assert.ok(!eventIds.has(event.id));eventIds.add(event.id);
   if(!['blind','action','refund','award','rake'].includes(event.type))continue;
   assert.ok(Number.isSafeInteger(event.amount)&&event.amount!>=0);
   const amount=event.amount!;
   if(event.type==='rake'){rake+=amount;continue;}
   assert.ok(event.seatId!==undefined&&balances.has(event.seatId));
   const debit=event.type==='blind'||event.type==='action';
   balances.set(event.seatId,balances.get(event.seatId)!+(debit?-amount:amount));
   assert.ok(balances.get(event.seatId)!>=0);
   if(debit)contributed+=amount;else if(event.type==='refund')refunds+=amount;else awards+=amount;
  }
  for(const seat of hand.view.seats)assert.equal(balances.get(seat.id),seat.stack);
  assert.equal(contributed-refunds,awards+rake);assert.equal(rake,hand.view.rake);
  assert.equal(Object.values(hand.view.payouts).reduce((sum,value)=>sum+value,0),awards);
  const hero=hand.view.seats.find(seat=>seat.id===0)!;
  const actual=balances.get(0)!-hero.startingStack;
  assert.equal(hand.net,actual);assert.equal(settled.get(hand.id),actual);
  handProfit+=actual;totalRake+=rake;
 }
 assert.equal(handIds.size,settled.size);assert.equal(handProfit,poker);
 for(const session of data.sessions){
  const summary=perSession.get(session.id)!;assert.ok(summary);
  assert.equal(session.buyIns,summary.funded);assert.equal(session.tableWithdrawals??0,summary.withdrawn);assert.equal(session.cashOut,summary.cashedOut);
  assert.equal(summary.cashouts,session.endedAt===null?0:1);
  if(session.endedAt!==null)assert.equal(summary.funded-summary.withdrawn+summary.net-summary.cashedOut,0);
 }
 if(data.active){const hero=data.active.game.seats.find(seat=>seat.id===0)!;assert.equal(table,hero.stack+(data.active.game.street==='complete'?0:hero.totalCommitted));if(data.active.game.street==='complete')assert.ok(handIds.has(data.active.game.handId)&&settled.has(data.active.game.handId),'Completed active hand is absent from canonical settlement.');}
 else assert.equal(table,0);
 return{wallet,table,poker,manual,totalRake,hands:handIds.size,financialEvents:moneyIds.size,sessions:data.sessions.length};
}
