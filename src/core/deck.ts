import type { Card } from '../contracts';

export function standardDeck(): Card[] {
  return [...'23456789TJQKA'].flatMap(rank => [...'cdhs'].map(suit => rank + suit));
}

/** Uniform bounded integer by rejection sampling, with no insecure fallback. */
export function secureIndex(bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000) throw new Error('Invalid random bound');
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness unavailable. Use a supported secure browser.');
  const limit = Math.floor(0x100000000 / bound) * bound;
  const word = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % bound;
}

export function secureDeck(): Card[] {
  const deck = standardDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
