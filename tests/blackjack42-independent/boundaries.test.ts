import { describe, it, expect } from 'vitest';
import * as old from './legacy-v41-engine';
import { applyBlackjack, blackjackView, createBlackjackState, orderedBlackjackShoe, restoreBlackjack, type BlackjackState, type TableSeating, type BlackjackCommand } from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { SEAT_RULES_VERSION } from '../../src/blackjack/table-players';
const rules = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!;
const seating: TableSeating = { rules: SEAT_RULES_VERSION, heroSeat: 4, players: [1,2,3,5,6,7].map(seat => ({seat,id:`p${seat}`,name:`Player ${seat}`,style:'mimic-dealer',betUnits:1})) };
const command = (s: BlackjackState, type: BlackjackCommand['type'], more = {}) => ({id:`command-${s.revision}`,revision:s.revision,type,...more});
const finish = (s: BlackjackState) => { while(s.round?.phase !== 'settled') s=applyBlackjack(s,command(s,s.round?.phase==='insurance'?'decline-insurance':'stand')); return s; };
describe('independent full table qualification boundaries', () => {
 it('replays V41 saves byte for byte across all eight classic tables', () => {
  for(const table of BLACKJACK_TABLES.filter(t => t.variant === 'classic')) {
   let s=old.createBlackjackState(table,old.orderedBlackjackShoe(table.decks),{balance:10000000});
   for(let n=0;n<4;n++) {
    s=old.applyBlackjack(s,command(s,'deal',{bet:table.minBet}));
    expect(restoreBlackjack(s)).toEqual(s);
    while(s.round?.phase !== 'settled') s=old.applyBlackjack(s,command(s,s.round?.phase==='insurance'?'decline-insurance':'stand'));
    expect(JSON.stringify(restoreBlackjack(s))).toBe(JSON.stringify(s));
   }
  }
 });
 it('V41 rejects new full-table states rather than accepting a divergent replay', () => {
  const s=applyBlackjack(createBlackjackState(rules,orderedBlackjackShoe(6),{seating}),{id:'deal',revision:0,type:'deal',bet:500});
  expect(() => old.restoreBlackjack(s)).toThrow();
 });
 it('duplicate settling commands return the same state and never credit a second payout', () => {
  let s=applyBlackjack(createBlackjackState(rules,orderedBlackjackShoe(6),{seating}),{id:'deal',revision:0,type:'deal',bet:500});
  s=finish(s); const last=s.commands.at(-1)!;
  const repeated=applyBlackjack(s,last);
  expect(repeated).toBe(s); expect(repeated.ledger.filter(e=>e.kind==='settle')).toHaveLength(1);
  expect(()=>applyBlackjack(s,{...last,type:'hit'})).toThrow(/identity/);
  expect(restoreBlackjack(s)).toEqual(s);
 });
 it('public state never exposes the hole or unseen shoe and is independent of its face before peek', () => {
  const shoe=orderedBlackjackShoe(6);
  // Seven occupied seats: dealer up at 7, hole at 15. Ace up keeps all seats waiting.
  const ace=shoe.findIndex(c=>c.endsWith(':Ac')); [shoe[7],shoe[ace]]=[shoe[ace],shoe[7]];
  const alternate=[...shoe]; [alternate[15],alternate[30]]=[alternate[30],alternate[15]];
  const make=(cards:typeof shoe)=>applyBlackjack(createBlackjackState(rules,cards,{seating}),{id:'d',revision:0,type:'deal',bet:500});
  const a=make(shoe),b=make(alternate); expect(a.round?.phase).toBe('insurance');
  expect(blackjackView(a)).toEqual(blackjackView(b));
  expect(blackjackView(a).round?.dealer[1]).toBeNull();
  const view=blackjackView(a); expect(view).not.toHaveProperty('shoe'); expect(view).not.toHaveProperty('commands'); expect(view).not.toHaveProperty('initialShoe');
 });
 it('each physical card at a seven-seat settled table comes from this round exactly once',()=>{
  const s=finish(applyBlackjack(createBlackjackState(rules,orderedBlackjackShoe(6),{seating}),{id:'d',revision:0,type:'deal',bet:500}));
  const r=s.round!;const cards=[...r.dealer,...r.hands.flatMap(h=>h.cards),...r.others!.flatMap(o=>o.hands.flatMap(h=>h.cards))];
  expect(cards.length).toBe(s.cursor);expect(new Set(cards).size).toBe(cards.length);expect(new Set(cards)).toEqual(new Set(s.shoe.slice(0,s.cursor)));
  const corrupt=structuredClone(s);corrupt.round!.others![0].hands[0].cards[0]=corrupt.round!.dealer[0];expect(()=>restoreBlackjack(corrupt)).toThrow();
 });
 it('rejects duplicate identities and seats, fractional seats, invalid stakes and unknown frozen policies',()=>{
  const bad=[{...seating,heroSeat:1.5},{...seating,rules:'future'},{...seating,players:[seating.players[0],seating.players[0]]},{...seating,players:[{...seating.players[0],betUnits:0}]},{...seating,players:[{...seating.players[0],style:'cheat'}]}];
  for(const config of bad)expect(()=>createBlackjackState(rules,orderedBlackjackShoe(6),{seating:config as TableSeating})).toThrow();
 });
});
