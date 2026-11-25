import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

/* Phase 8 slices 3+4: table dressing, the backdrop slot, and tiered celebrations.
 * Presentation only — these tests pin the rendered hooks, never game behaviour. */
let queue: (() => void)[] = [];
const intervals = new Map<number, () => void>();
let ids = 0;
(globalThis as Record<string, unknown>).window = { setTimeout: (f: () => void) => { queue.push(f); return ++ids; }, clearTimeout: () => {}, setInterval: (f: () => void) => { const id = ++ids; intervals.set(id, f); return id; } };
(globalThis as Record<string, unknown>).clearInterval = (id: number) => { intervals.delete(id); };
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
const { CasinoPlayer } = await import('../../src/casino/play');
const { casinoMarkup } = await import('../../src/casino/view');
const { freshSlotsUi, slotsMarkup } = await import('../../src/slots/view');
const { freshSlots } = await import('../../src/slots/state');
const { machineById } = await import('../../src/slots/machines');
const seq = (seed: number) => { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return Math.floor((s >>> 0) / 4294967296 * n); }; };

describe('Phase 8 — roulette wheel dressing', () => {
 it('renders the dimensional shading: gradient defs, ball shadow, vignette', () => {
  store.clear(); queue = []; intervals.clear();
  const p = new CasinoPlayer({ render() {}, sound() {}, active: () => false }, seq(3));
  const html = casinoMarkup(p, 'roulette');
  for (const hook of ['id="rl-rim-shade"', 'id="rl-cone-shade"', 'id="rl-hub-shade"', 'id="rl-ball-shade"', 'class="rl-ball-shadow"', 'class="rl-vignette"']) expect(html).toContain(hook);
 });
 it('styles the wheel parts from the gradients, not flat fills', () => {
  const css = read('src/ui/casino.css');
  expect(css).toContain('.rl-rim{fill:url(#rl-rim-shade)');
  expect(css).toContain('.rl-cone{fill:url(#rl-cone-shade)');
  expect(css).toContain('.rl-ball{fill:url(#rl-ball-shade)');
 });
});

describe('Phase 8 — craps dressing and the backdrop slot', () => {
 it('dresses the craps felt: weave, wooden rail, stacked chips', () => {
  const css = read('src/ui/casino.css');
  expect(css).toContain('.cr-felt{background-image:radial-gradient(ellipse at 50% 28%');
  expect(css).toContain('0 0 0 11px #4a2e14'); // the wooden rail ring
  expect(css).toContain('.cr-felt .cz-chip{background:repeating-linear-gradient(180deg');
 });
 it('leaves a per-game backdrop slot on the casino and slots sections', () => {
  const css = read('src/ui/casino.css');
  expect(css).toContain('.panel.cz-game,.panel.slots{background-image:var(--game-backdrop,none)');
 });
});

describe('Phase 8 — tiered win celebrations', () => {
 const machine = machineById('lucky-sevens')!;
 const uiWith = (total: number, bet: number) => {
  const ui = freshSlotsUi();
  ui.machine = machine.id;
  ui.phase = 'done';
  ui.result = { grid: machine.reels.map(s => s.slice(0, machine.rows)), wins: [], total, bet, lineTotal: 0, scatterWin: 0 } as never;
  return ui;
 };
 it('EPIC (100x+) gets the crown moment and both burst layers', () => {
  const html = slotsMarkup(freshSlots(), uiWith(15000, 100));
  expect(html).toContain('slot-crown-moment');
  expect(html).toContain('slot-burst coin');
  expect(html).toContain('slot-burst spark');
  expect(html).toContain('epic-win');
 });
 it('BIG (15x) gets coins and sparks but no crown', () => {
  const html = slotsMarkup(freshSlots(), uiWith(1500, 100));
  expect(html).toContain('slot-burst coin');
  expect(html).toContain('slot-burst spark');
  expect(html).not.toContain('slot-crown-moment');
 });
 it('a small win stays quiet: no burst, no crown', () => {
  const html = slotsMarkup(freshSlots(), uiWith(200, 100));
  expect(html).not.toContain('slot-burst');
  expect(html).not.toContain('slot-crown-moment');
 });
 it('keeps every celebration layer still under reduced motion and motion-off', () => {
  const css = read('src/ui/slots.css');
  expect(css).toContain('@media (prefers-reduced-motion:reduce){.slot-crown-moment{display:none}}');
  expect(css).toContain('.motion-off .slot-crown-moment{display:none}');
  const cine = read('src/ui/casino-cinematic.css');
  expect(cine).toContain('@media (prefers-reduced-motion:no-preference)');
  expect(cine).toContain('.motion-off .casino-home-copy h2 em{animation:none!important}');
 });
});
