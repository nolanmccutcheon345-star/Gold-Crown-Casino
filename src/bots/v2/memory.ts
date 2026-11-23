import type {BotMemory,GameEvent,ObservedOpponent,PublicMemoryHand} from '../../contracts';
const rate=()=>({count:0,opportunities:0});
const make=(seatId:number):ObservedOpponent=>({seatId,hands:0,vpip:rate(),pfr:rate(),aggression:rate(),foldToBet:rate(),showdowns:[]});
/** Public committed histories only. Retention is a unit interval; at most 120 unique hands. */
export function buildOpponentMemory(hands:PublicMemoryHand[],observingSeat:number,retention:number):BotMemory {
 if(!Number.isFinite(retention)||retention<0||retention>1)throw new Error('Memory retention must be between 0 and 1.');
 if(!Number.isInteger(observingSeat)||observingSeat<0||observingSeat>9)throw new Error('Invalid observing seat.');
 const limit=Math.ceil(retention*120);if(!limit)return {windowHands:0,opponents:[]};
 const distinct=new Map<string,PublicMemoryHand>();for(const hand of hands)if(!distinct.has(hand.handId))distinct.set(hand.handId,hand);
 const window=[...distinct.values()].slice(-limit),records=new Map<number,ObservedOpponent>();
 for(const hand of window){
  const seats=new Set(hand.seats.map(s=>s.id));const folded=new Set<number>();
  const preActed=new Set<number>(),voluntary=new Set<number>(),raised=new Set<number>();
  const committed=new Map<number,number>();let wager=0,currentStreet='preflop';
  const seen=new Set<string>();
  for(const e of hand.events){
   if(e.handId!==hand.handId||seen.has(e.id))continue;seen.add(e.id);
   if(e.type==='street'){currentStreet=e.street??currentStreet;committed.clear();wager=0;continue;}
   if(e.seatId===undefined||!seats.has(e.seatId))continue;
   const id=e.seatId,amount=Number.isSafeInteger(e.amount)&&e.amount!>=0?e.amount!:0;
   if(e.type==='blind'){committed.set(id,(committed.get(id)??0)+amount);wager=Math.max(wager,committed.get(id)!);continue;}
   if(e.type!=='action'||!e.action)continue;
   const street=e.street??currentStreet,facing=wager>(committed.get(id)??0);
   if(e.action.type==='fold')folded.add(id);
   if(id!==observingSeat){
    const r=records.get(id)??make(id);records.set(id,r);
    if(street==='preflop'){preActed.add(id);if(e.action.type==='raise'||e.action.type==='call'&&amount>0)voluntary.add(id);if(e.action.type==='raise')raised.add(id);}
    else{r.aggression.opportunities++;if(e.action.type==='raise')r.aggression.count++;if(facing){r.foldToBet.opportunities++;if(e.action.type==='fold')r.foldToBet.count++;}}
   }
   if(e.action.type==='raise'){committed.set(id,e.action.to);wager=Math.max(wager,e.action.to);}else if(e.action.type==='call')committed.set(id,(committed.get(id)??0)+amount);
  }
  for(const seat of hand.seats){if(seat.id===observingSeat)continue;const r=records.get(seat.id)??make(seat.id);records.set(seat.id,r);r.hands++;
   if(preActed.has(seat.id)){r.vpip.opportunities++;r.pfr.opportunities++;if(voluntary.has(seat.id))r.vpip.count++;if(raised.has(seat.id))r.pfr.count++;}
   // A public fold always denies a showdown entry, even if malformed input supplies cards.
   if(!folded.has(seat.id)&&seat.revealedCards.length===2&&seat.revealedCards.every(c=>/^[2-9TJQKA][cdhs]$/.test(c))&&new Set(seat.revealedCards).size===2)r.showdowns=[...r.showdowns, [...seat.revealedCards]].slice(-8);
  }
 }
 return {windowHands:window.length,opponents:[...records.values()].sort((a,b)=>a.seatId-b.seatId)};
}
/** Keep only allowed fields. No event details, arbitrary payloads, hole/deck fields or annotations. */
export function publicActionEvents(events:GameEvent[]):GameEvent[]{return events.map(e=>({id:e.id,handId:e.handId,revision:e.revision,type:e.type,seatId:e.seatId,amount:e.amount,action:e.action?(e.action.type==='raise'?{type:'raise' as const,to:e.action.to}:{type:e.action.type}):undefined,street:e.street,decisionId:e.decisionId}));}
