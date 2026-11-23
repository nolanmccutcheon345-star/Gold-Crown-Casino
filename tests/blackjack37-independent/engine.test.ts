import { describe, expect, it } from 'vitest';
import { applyBlackjack, blackjackLegalActions, blackjackView, createBlackjackState, orderedBlackjackShoe, restoreBlackjack, type BlackjackState, type BlackjackCommand, type ShoeCard } from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';

const profile = (id = 'casino-5') => BLACKJACK_TABLES.find(t => t.id === id)!;
function shoe(faces: string[], decks = 6): ShoeCard[] {
  const remainder = orderedBlackjackShoe(decks);
  return [...faces.map(face => { const at = remainder.findIndex(c => c.slice(c.indexOf(':') + 1) === face); if (at < 0) throw Error('Fixture unavailable'); return remainder.splice(at, 1)[0]; }), ...remainder];
}
function begin(faces: string[], id = 'casino-5', balance = 200000) {
  const rules = profile(id);
  return applyBlackjack(createBlackjackState(rules, shoe(faces, rules.decks), { balance }), { id: 'initial-deal', revision: 0, type: 'deal', bet: rules.minBet });
}
function act(state: BlackjackState, type: BlackjackCommand['type']) {
  const cmd = { id: `cmd-${state.revision}`, revision: state.revision, type };
  const restored = restoreBlackjack(JSON.parse(JSON.stringify(state)));
  const next = applyBlackjack(restored, cmd);
  expect(applyBlackjack(next, cmd)).toBe(next);
  expect(restoreBlackjack(JSON.parse(JSON.stringify(next)))).toEqual(next);
  return next;
}
const displayCards = (state: BlackjackState) => blackjackView(state).round!.hands.map(h => h.cards);

describe('Version37 independent classic round boundary fixtures', () => {
  it.each(BLACKJACK_TABLES.filter(t => t.variant === 'classic').map(t => t.id))('%s: insured mutual naturals net one base bet minus one ante, including replay', id => {
    const table = profile(id), ante = table.group === 'home' ? 0 : 50;
    let state = begin(['Ac','Ad','Kh','Qs'], id);
    expect(state.round!.phase).toBe('insurance');
    const before = state.balance;
    state = act(state, 'insurance');
    // Independent arithmetic: base wager pushes; insurance .5B returns 1.5B.
    expect(state.balance - before).toBe(table.minBet * 2);
    expect(state.balance).toBe(200000 + table.minBet - ante);
    expect(state.round!.hands[0].result).toBe('push');
    expect(state.ledger.filter(e => e.kind === 'settle')).toHaveLength(1);
  });

  it('split/double branch restores before every action and charges only one ante', () => {
    // Player 8,8; dealer 6,T; first split draws 3 then double T; second draws 2 then double Q; dealer draws 9 and busts.
    let state = begin(['8c','6c','8d','Tc','3c','Th','2c','Qh','9s']);
    state = act(state, 'split');
    expect(displayCards(state)).toEqual([['8c','3c'],['8d']]);
    state = act(state, 'double');
    expect(displayCards(state)).toEqual([['8c','3c','Th'],['8d','2c']]);
    state = act(state, 'double');
    expect(state.balance).toBe(201950); // Four $5 units won, less one 50c fee.
    expect(state.round!.hands.map(h => h.payout)).toEqual([2000,2000]);
    expect(state.ledger.map(e => [e.kind,e.amount])).toEqual([
      ['bet',-500],['ante',-50],['split',-500],['double',-500],['double',-500],['settle',4000],
    ]);
  });

  it('insurance loss plus split results reconcile without applying insurance to each hand', () => {
    // 8,8 vs A,6; insurance loses. Split first 18 stands; second draws 3 then hits 9 for 20; dealer H17 draws 2 to 19.
    let state = begin(['8c','Ac','8d','6c','Tc','3h','9h','2s']);
    state = act(state, 'insurance');
    state = act(state, 'split');
    state = act(state, 'stand');
    state = act(state, 'hit');
    state = act(state, 'stand');
    // First loses $5, second wins $5, insurance loses $2.50, ante $0.50.
    expect(state.balance).toBe(199700);
    expect(state.round!.insuranceBet).toBe(250);
    expect(state.round!.hands.map(h => h.result)).toEqual(['loss','win']);
    expect(state.ledger.filter(e => e.kind === 'insurance')).toHaveLength(1);
    expect(state.ledger.filter(e => e.kind === 'ante')).toHaveLength(1);
  });

  it('an exactly covered opening wager cannot create unfunded insurance, split or double', () => {
    let state = begin(['8c','Ac','8d','6c'], 'casino-5', 550);
    expect(state.balance).toBe(0);
    expect(blackjackLegalActions(state)).toEqual(['decline-insurance']);
    const frozen = JSON.stringify(state);
    expect(() => applyBlackjack(state,{id:'bad',revision:state.revision,type:'insurance'})).toThrow();
    expect(JSON.stringify(state)).toBe(frozen);
    state = act(state,'decline-insurance');
    expect(blackjackLegalActions(state)).toEqual(['hit','stand']);
  });

  it('new command identity at an old revision cannot execute another hit after recovery', () => {
    const original = begin(['2c','6c','3d','Tc','4h']);
    const hit = act(original,'hit');
    const recovered = restoreBlackjack(hit), before = JSON.stringify(recovered);
    expect(() => applyBlackjack(recovered,{id:'second-tab-hit',revision:original.revision,type:'hit'})).toThrow('Stale');
    expect(JSON.stringify(recovered)).toBe(before);
    expect(recovered.round!.hands[0].cards).toHaveLength(3);
  });

  it('public projections cannot mutate private hand cards and do not expose future cards or command journals', () => {
    const state = begin(['8c','6c','8d','Tc','3h']);
    const publicState = blackjackView(state), before = JSON.stringify(state);
    publicState.round!.hands[0].cards.push('Ac');
    publicState.round!.dealer[0] = '2c';
    publicState.legalActions.length = 0;
    expect(JSON.stringify(state)).toBe(before);
    const fresh = blackjackView(state);
    expect(fresh.round!.dealer).toEqual(['6c',null]);
    expect(JSON.stringify(fresh)).not.toContain('Tc');
    expect(JSON.stringify(fresh)).not.toContain('3h');
    expect(Object.keys(fresh).sort()).toEqual(['ante','balance','cardsRemaining','legalActions','revision','round','shuffleRequired','table','version'].sort());
  });

  it('settlement is tied to the original command and cannot be applied as a second new stand', () => {
    const active = begin(['Tc','6c','8d','Tc','8h']);
    const settled = act(active,'stand');
    const before = JSON.stringify(settled);
    expect(() => applyBlackjack(settled,{id:'duplicate-settlement',revision:settled.revision,type:'stand'})).toThrow('Illegal');
    expect(JSON.stringify(settled)).toBe(before);
    expect(settled.ledger.filter(e => e.kind === 'settle')).toHaveLength(1);
  });
});
