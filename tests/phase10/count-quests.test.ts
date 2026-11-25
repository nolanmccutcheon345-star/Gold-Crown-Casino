import { describe, expect, it } from 'vitest';
import { countState, countSystem } from '../../src/blackjack/counting';
import { checkCountQuestBook, freshCountQuestBook, shoeStoryMarkup, updateCountQuests } from '../../src/blackjack/count-quests';
import type { Card } from '../../src/contracts';

const hiLo = countSystem('hi-lo');
const cards = (spec: string): Card[] => spec.split(' ').filter(Boolean) as Card[];

describe('count quests (fun #12)', () => {
  it('completes penetration quests from seen cards only', () => {
    const seen = cards('2s 3s 4s 5s 6s 2h 3h 4h 5h 6h 2d 3d 4d 5d 6d 2c 3c 4c 5c 6c 7s 8s 9s 7h 8h 9h'); // 26 cards = quarter of 2 decks
    const { quests } = updateCountQuests(freshCountQuestBook(), countState(hiLo, seen, 2), 2);
    expect(quests.find(q => q.id === 'shoe-quarter')?.done).toBe(true);
    expect(quests.find(q => q.id === 'shoe-half')?.done).toBe(false);
  });
  it('tracks the peak true count across updates within a shoe', () => {
    let book = freshCountQuestBook();
    const low = cards('Ts Js Qs Ks As Th Jh'); // very negative
    book = updateCountQuests(book, countState(hiLo, low, 1), 1).book;
    const high = cards('2s 3s 4s 5s 6s 2h 3h 4h 5h 6h'); // +10 running early in the shoe
    const r = updateCountQuests(book, countState(hiLo, high, 1), 1);
    expect(r.quests.find(q => q.id === 'count-warm')?.done).toBe(true);
    expect(r.book.lifetime).toBeGreaterThan(0);
  });
  it('a new shoe banks the story and resets per-shoe progress', () => {
    let book = freshCountQuestBook();
    const deep = Array.from({ length: 30 }, (_, i) => (['2s', '3s', '4s', '5s', '6s'] as Card[])[i % 5]);
    book = updateCountQuests(book, countState(hiLo, deep, 1), 1).book;
    const fresh = cards('Ts');
    const r = updateCountQuests(book, countState(hiLo, fresh, 1), 1);
    expect(r.book.lastShoe?.seen).toBe(30);
    expect(r.book.completed).toEqual([]);
    expect(shoeStoryMarkup(r.book)).toContain('30 of 52 cards dealt');
    expect(shoeStoryMarkup(r.book)).toContain('penetration');
  });
  it('the stored record round-trips and rejects damage', () => {
    const book = freshCountQuestBook();
    book.lastShoe = { seen: 40, total: 52, peakTrue: 3, aces: 5 };
    expect(checkCountQuestBook(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(() => checkCountQuestBook({ version: 2 })).toThrow();
  });
});
