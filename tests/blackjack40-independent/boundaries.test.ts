import { describe, expect, it } from 'vitest';
import { otherSeatsMarkup } from '../../src/blackjack/full-table';
import { seatLineup, seatPlay, type PlayerStyle } from '../../src/blackjack/table-players';
import { blackjackTableMarkup } from '../../src/blackjack/screens';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { settleSideBet, sideBetNet, type SideBetContext } from '../../src/blackjack/side-bets';
import { SAMPLE_BLACKJACK } from '../blackjack/fixtures';
import type { Card } from '../../src/contracts';

const table = BLACKJACK_TABLES.find(t => t.id === 'casino-5')!;
const styles: PlayerStyle[] = ['by-the-book','never-bust','mimic-dealer','gambler'];
const ctx = (player: [Card, Card], up: Card, dealerFinal: Card[] | null = null): SideBetContext => ({decks:6,player,up,dealerBlackjack:null,dealerFinal});

describe('independent Patch20 presentation and decision boundaries', () => {
  it('escapes opponent names in both attribute and text contexts', () => {
    const html = otherSeatsMarkup({pace:'casino',actingSeat:1,seats:[{seat:1,kind:'player',name:'<img src=x onerror="alert(1)"> & Dana',style:null,hands:[],bet:500,lastAction:null}]});
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Dana');
  });
  it('disables every Hero action while another player acts, even with stale legal flags', () => {
    const view = SAMPLE_BLACKJACK.player();
    const html = blackjackTableMarkup(view,{waitingFor:'Lou is playing',coach:true});
    const buttons = [...html.matchAll(/<button\b[^>]*data-blackjack-action="[^"]+"[^>]*>/g)].map(m=>m[0]);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(button=>/\bdisabled\b/.test(button))).toBe(true);
    expect(html).not.toContain('id="bj-hint"');
  });
  it('rejects an empty action set rather than returning undefined as a legal play', () => {
    for (const style of styles) expect(()=>seatPlay(style,[10,6],10,table,[])).toThrow();
  });
  it('rejects an invalid random index instead of silently inserting an undefined or unintended seat', () => {
    for (const invalid of [-1,8,1.5,NaN,Infinity]) expect(()=>seatLineup(4,1,()=>invalid)).toThrow();
  });
  it('uses only the requested nonempty legal set for unusual restricted decisions', () => {
    for (const style of styles) for(const legal of [['hit'],['stand'],['double']] as const) expect(legal).toContain(seatPlay(style,[5,6],6,table,legal));
  });
});

describe('independent configured side-bet arithmetic (not casino paytable verification)', () => {
  it('compares all rank triples against an independently constructed straight set', () => {
    const ranks='A23456789TJQK',straights=new Set(['A23','234','345','456','567','678','789','89T','9TJ','TJQ','JQK','QKA'].map(s=>[...s].sort().join('')));
    for(const a of ranks) for(const b of ranks) for(const c of ranks){
      const expected=(a===b&&b===c)||straights.has([a,b,c].sort().join(''));
      const result=settleSideBet('twenty-one-plus-three',ctx([`${a}c`,`${b}d`],`${c}h`));
      expect(result?.to1??0).toBe(expected?9:0);
    }
  });
  it('does not pay a dealer side bet until final dealer information exists', () => {
    const pending=ctx(['Ts','8d'],'6h');
    expect(settleSideBet('buster',pending)).toBeUndefined();
    expect(settleSideBet('push-22',pending)).toBeUndefined();
    const final={...pending,dealerFinal:['Ac','Ad','Ts']};
    expect(settleSideBet('buster',final)).toBeNull();
    expect(settleSideBet('push-22',final)).toBeNull();
  });
  it('computes dealer ace-adjusted totals before identifying 22 or bust', () => {
    const c=ctx(['Ts','8d'],'6h',['Ac','Ad','Tc','Th']);
    expect(settleSideBet('push-22',c)?.to1).toBe(11);
    expect(settleSideBet('buster',c)?.to1).toBe(2);
    expect(sideBetNet(500,settleSideBet('push-22',c)!)).toBe(5500);
  });
  it('adds each Match-the-Dealer card independently without multiplying the returned stake twice', () => {
    const result=settleSideBet('match-the-dealer',ctx(['Kh','Kd'],'Kh'))!;
    expect(result?.to1).toBe(15);
    expect(sideBetNet(500,result)).toBe(7500);
    const gross=500+sideBetNet(500,result);
    expect(gross).toBe(8000);
  });
  it('keeps exact Queen-heart blackjack status unresolved until known', () => {
    const c=ctx(['Qh','Qh'],'As');
    expect(settleSideBet('lucky-ladies',c)).toBeUndefined();
    expect(settleSideBet('lucky-ladies',{...c,dealerBlackjack:false})?.to1).toBe(200);
    expect(settleSideBet('lucky-ladies',{...c,dealerBlackjack:true})?.to1).toBe(1000);
  });
});
