import {it,expect} from 'vitest';
import {applyBlackjack,blackjackTotal,blackjackView,createBlackjackState,orderedBlackjackShoe,type TableSeating} from '../../src/blackjack/engine';
import {BLACKJACK_TABLES} from '../../src/blackjack/presets';
import {SEAT_RULES_VERSION} from '../../src/blackjack/table-players';
it('does not force a mimic-dealer to stand below 17 near the cut card',()=>{
 const rules=BLACKJACK_TABLES.find(t=>t.id==='high-100-double')!;
 const seating:TableSeating={rules:SEAT_RULES_VERSION,heroSeat:7,players:[1,2,3,4,5,6].map(seat=>({seat,id:`p${seat}`,name:`P${seat}`,style:'mimic-dealer',betUnits:1}))};
 let seed=123;
 const shuffle=()=>{const cards=orderedBlackjackShoe(2);for(let i=cards.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;};
 let s=createBlackjackState(rules,shuffle(),{seating,balance:10000000});
 for(let n=0;n<30;n++){
  if(blackjackView(s).shuffleRequired)s=applyBlackjack(s,{id:`c${s.revision}`,revision:s.revision,type:'shuffle',shoe:shuffle()});
  const start=s.cursor;
  s=applyBlackjack(s,{id:`c${s.revision}`,revision:s.revision,type:'deal',bet:10000});
  while(s.round?.phase!=='settled')s=applyBlackjack(s,{id:`c${s.revision}`,revision:s.revision,type:s.round?.phase==='insurance'?'decline-insurance':'stand'});
  for(const other of s.round!.others!)for(const hand of other.hands)if(hand.status==='stood')expect(blackjackTotal(hand.cards).total,`round ${n+1}, start ${start}, cursor ${s.cursor}, seat ${other.seat}, cards ${hand.cards}`).toBeGreaterThanOrEqual(17);
 }
});
