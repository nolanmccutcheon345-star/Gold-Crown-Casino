import { describe, expect, it } from 'vitest';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { blackjackTableMarkup, chipStackMarkup } from '../../src/blackjack/screens';
import { SAMPLE_BLACKJACK } from './fixtures';

const chips = (html: string) => [...html.matchAll(/data-chip="(\d+)"/g)].map(match => Number(match[1]));
describe('chip stacks', () => {
  it('breaks an amount into casino chips, largest at the bottom', () => {
    expect(chips(chipStackMarkup(1500))).toEqual([500, 500, 500]); expect(chips(chipStackMarkup(3700))).toEqual([2500, 500, 500, 100, 100]);
    expect(chips(chipStackMarkup(160000))).toEqual([100000, 50000, 10000]); expect(chips(chipStackMarkup(250))).toEqual([100, 100]);
  });
  it('caps the stack and draws nothing for zero', () => { expect(chips(chipStackMarkup(9900))).toHaveLength(6); expect(chips(chipStackMarkup(9900, 3))).toHaveLength(3); expect(chipStackMarkup(0)).toBe(''); });
  it('is decorative', () => { expect(chipStackMarkup(500)).toContain('aria-hidden="true"'); });
});
describe('table finish', () => {
  const html = blackjackTableMarkup(SAMPLE_BLACKJACK.player());
  it('prints the felt as curved lettering with no ids, keeping the words for screen readers', () => {
    expect(html).toContain('class="bj-felt-print"'); expect(html).not.toMatch(/\sid="bj-arc/); expect(html).toContain('BLACKJACK PAYS 3 TO 2<span>');
    const svg = html.split('<svg class="bj-felt-print"')[1].split('</svg>')[0];
    expect(svg).toContain('aria-hidden="true"'); expect(svg.match(/<text /g)).toHaveLength(3); expect(svg.match(/<path /g)).toHaveLength(2);
    for (const text of svg.match(/<text [^>]*>[^<]*<\/text>/g)!) { const content = text.replace(/<[^>]*>/g, ''), xs = text.match(/ x="([^"]*)"/)![1].split(' '); expect(xs).toHaveLength([...content].length); expect(xs.map(Number).every(x => x > 0 && x < 400)).toBe(true); }
  });
  it('prints the rules of the table it is drawn for', () => {
    const sixFive = blackjackTableMarkup({ ...SAMPLE_BLACKJACK.player(), table: BLACKJACK_TABLES.find(table => table.blackjackPays === '6:5')! });
    const standing = blackjackTableMarkup({ ...SAMPLE_BLACKJACK.player(), table: BLACKJACK_TABLES.find(table => !table.dealerHitsSoft17)! });
    const letters = (markup: string) => markup.split('<svg class="bj-felt-print"')[1].split('</svg>')[0].match(/>([^<]+)<\/text>/g)!.join(' ');
    expect(letters(sixFive)).toContain('PAYS 6 TO 5'); expect(letters(html)).toContain('DEALER MUST HIT SOFT 17'); expect(letters(standing)).toContain('DEALER MUST STAND ON ALL 17s');
  });
  it('draws card corners at both ends, court panels and aces', () => {
    const view = { ...SAMPLE_BLACKJACK.player(), hands: [{ ...SAMPLE_BLACKJACK.player().hands[0], cards: ['Kh', 'As'] }] }, markup = blackjackTableMarkup(view);
    expect(markup).toContain('class="playing-card bj-card red-card bj-court" role="img" aria-label="King of hearts"><b aria-hidden="true">K<i>♥</i></b><span aria-hidden="true">K<i>♥</i></span><b class="bj-index-low" aria-hidden="true">K<i>♥</i></b>');
    expect(markup).toContain('class="playing-card bj-card bj-ace" role="img" aria-label="Ace of spades"><b aria-hidden="true">A<i>♠</i></b><span aria-hidden="true">♠</span>');
    expect(markup).toContain('aria-label="Hidden card"');
  });
  it("shows the shoe's depth and the discards on the dealer's side, and the bet as chips", () => {
    const view = SAMPLE_BLACKJACK.player(), left = Math.round(view.shoe.remaining / view.shoe.cards * 100);
    expect(html).toContain(`<span class="bj-shoe-box"><i style="width:${left}%"></i></span>`); expect(html).toContain(`<span class="bj-discard"><i style="height:${100 - left}%"></i></span>`);
    expect(html.indexOf('bj-dealer-rail')).toBeLessThan(html.indexOf('>DEALER<'));
    expect(html.split('data-bj-hand="0"')[1]).toContain('class="bj-stack"');
    expect(blackjackTableMarkup(SAMPLE_BLACKJACK.betting())).toMatch(/aria-label="Main bet \$15"><span class="bj-stack" aria-hidden="true">/);
  });
});

it('exposes the dealer rule outside the decorative SVG', () => {
 const text=blackjackTableMarkup(SAMPLE_BLACKJACK.player()).match(/<p class="bj-felt-text">([\s\S]*?)<\/p>/)?.[1];
 expect(text).toMatch(/DEALER MUST (HIT SOFT 17|STAND ON ALL 17s)/);
});
