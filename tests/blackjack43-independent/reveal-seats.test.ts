import {expect,it} from 'vitest';
import {applyBlackjack,blackjackView,createBlackjackState,orderedBlackjackShoe,type ShoeCard,type TableSeating} from '../../src/blackjack/engine';
import {seatRevealLayouts} from '../../src/blackjack/reveal-seats';
import {BLACKJACK_TABLES} from '../../src/blackjack/presets';
import {fullTableSeating} from '../../src/blackjack/controller';
import {SEAT_RULES_VERSION} from '../../src/blackjack/table-players';
const table=BLACKJACK_TABLES.find(t=>t.id==='casino-5')!;
const seating:TableSeating={rules:SEAT_RULES_VERSION,heroSeat:2,players:[{seat:1,id:'p1',name:'Ann',style:'gambler',betUnits:1}]};
function shoe(faces:string[]):ShoeCard[]{const rest=orderedBlackjackShoe(6);return [...faces.map(f=>rest.splice(rest.findIndex(c=>c.endsWith(':'+f)),1)[0]),...rest];}
const faces=(groups:ShoeCard[][])=>groups.map(cards=>cards.map(c=>c.split(':')[1]));
it('reconstructs an ordinary split and double without placing the second opening card in a future hand',()=>{
 const s=applyBlackjack(createBlackjackState(table,shoe(['8c','Tc','9d','8h','9h','7s','3c','Td','2c','Kd']),{seating}),{id:'d',revision:0,type:'deal',bet:500});
 const layouts=seatRevealLayouts(s.round!,s.shoe.slice(0,s.cursor));
 expect(faces(layouts.get(s.shoe[3])!)).toEqual([['8c','8h']]);
 expect(faces(layouts.get(s.shoe[6])!)).toEqual([['8c','3c'],['8h']]);
 expect(faces(layouts.get(s.shoe[7])!)).toEqual([['8c','3c','Td'],['8h']]);
 expect(faces(layouts.get(s.shoe[9])!)).toEqual(s.round!.others![0].hands.map(h=>h.cards.map(c=>c.split(':')[1])));
});
it('records repeated splits only when their next cards arrive',()=>{
 const s=applyBlackjack(createBlackjackState(table,shoe(['8c','Tc','9d','8h','9h','7s','8s','3c','Td','2c','Kd','9c']),{seating}),{id:'d',revision:0,type:'deal',bet:500});
 expect(s.round!.others![0].hands.length).toBe(3);
 const layouts=seatRevealLayouts(s.round!,s.shoe.slice(0,s.cursor));
 expect(faces(layouts.get(s.shoe[3])!)).toEqual([['8c','8h']]);
 expect(faces(layouts.get(s.shoe[6])!)).toEqual([['8c','8s'],['8h']]);
 expect(faces(layouts.get(s.shoe[7])!)).toEqual([['8c','3c'],['8s'],['8h']]);
});
it('reconstructs 300 mixed full-table rounds including implicit draws and resplits without adding any physical cards',()=>{
 let seed=4423;const random=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
 const shuffled=(decks:number)=>{const cards=orderedBlackjackShoe(decks);for(let i=cards.length-1;i>0;i--){const j=random(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;};
 for(const id of ['casino-5','casino-10-double','high-100']){
  const rules=BLACKJACK_TABLES.find(t=>t.id===id)!;
  let s=createBlackjackState(rules,shuffled(rules.decks),{seating:fullTableSeating({others:6,heroSeat:4},random),balance:10000000});
  for(let r=0;r<100;r++){
   if(blackjackView(s).shuffleRequired)s=applyBlackjack(s,{id:'s'+s.revision,revision:s.revision,type:'shuffle',shoe:shuffled(rules.decks)});
   s=applyBlackjack(s,{id:'d'+s.revision,revision:s.revision,type:'deal',bet:rules.minBet});
   while(s.round!.phase!=='settled'){const acts=blackjackView(s).legalActions;s=applyBlackjack(s,{id:'a'+s.revision,revision:s.revision,type:acts[random(acts.length)]});}
   const drawn=s.shoe.slice(s.round!.firstCardIndex,s.cursor),layouts=seatRevealLayouts(s.round!,drawn),seen=new Set<ShoeCard>();
   for(const card of drawn){seen.add(card);const groups=layouts.get(card);if(groups)for(const shown of groups.flat())expect(seen.has(shown)).toBe(true);}
   expect(layouts.size).toBe(s.round!.others!.flatMap(o=>o.hands.flatMap(h=>h.cards)).length);
  }
 }
});
