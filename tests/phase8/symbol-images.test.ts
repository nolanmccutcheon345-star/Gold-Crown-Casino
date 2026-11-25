import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { MACHINES } from '../../src/slots/machines';
import { SYMBOL_IMAGES, symbolImage } from '../../src/slots/symbol-images';
import { symbolArt, symbolMarkup } from '../../src/slots/view';
import type { Machine } from '../../src/slots/engine';
const root = new URL('../../', import.meta.url);

/* Phase 8 slice 1: photographic symbol art. Every non-blank symbol on every machine has a
 * sliced sheet asset on disk; the renderer uses it, and anything without an asset falls back
 * to the code-drawn art (which stays intact in art.ts). */
describe('Phase 8 — photographic slot symbols', () => {
 it('covers every non-blank symbol of every machine', () => {
  for (const m of MACHINES) {
   for (const [sym, d] of Object.entries(m.symbols)) {
    if (d.tone === 'blank') continue;
    expect(symbolImage(m.id, d.art), `${m.id} ${sym} (${d.art})`).toBeTruthy();
   }
  }
 });
 it('points every manifest entry at a real file under public/', () => {
  for (const [machine, arts] of Object.entries(SYMBOL_IMAGES)) {
   for (const [art, path] of Object.entries(arts)) {
    expect(path, `${machine}/${art}`).toBe(`/casino-art/symbols/${machine}/${art}.webp`);
    expect(existsSync(new URL(`public${path}`, root)), `${machine}/${art}`).toBe(true);
   }
  }
 });
 it('renders the photo asset in reel markup, labelled for assistive tech', () => {
  const m = MACHINES.find(x => x.id === 'gold-rush')!;
  const html = symbolMarkup(m, 'pick');
  expect(html).toContain('<img class="slot-art-img" src="/casino-art/symbols/gold-rush/pickaxe.webp"');
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('aria-label="Pickaxe"');
 });
 it('keeps the blank symbol blank (no image, hidden tone)', () => {
  const m = MACHINES.find(x => x.id === 'lucky-sevens')!;
  const html = symbolMarkup(m, '-');
  expect(html).toContain('tone-blank');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<svg');
 });
 it('falls back to the code-drawn art when a machine has no sheet asset', () => {
  const ghost = { id: 'no-such-machine', symbols: {} } as unknown as Machine;
  expect(symbolArt(ghost, 'seven')).toContain('<svg class="slot-art"');
 });
 it('renders multiplier bombs from the machine sheet', () => {
  const m = MACHINES.find(x => x.id === 'gem-cascade')!;
  const html = symbolMarkup(m, 'bomb:25');
  expect(html).toContain('/casino-art/symbols/gem-cascade/bomb.webp');
  expect(html).toContain('×25');
 });
});
