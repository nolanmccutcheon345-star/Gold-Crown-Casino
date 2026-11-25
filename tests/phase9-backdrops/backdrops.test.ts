import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

/* Phase 9 backdrops: Nolan's room photos wired into the Phase 8 --game-backdrop slot.
 * Presentation only — these tests pin the wiring hooks and assets, never game behaviour. */
let queue: (() => void)[] = [];
const intervals = new Map<number, () => void>();
let ids = 0;
(globalThis as Record<string, unknown>).window = { setTimeout: (f: () => void) => { queue.push(f); return ++ids; }, clearTimeout: () => {}, setInterval: (f: () => void) => { const id = ++ids; intervals.set(id, f); return id; } };
(globalThis as Record<string, unknown>).clearInterval = (id: number) => { intervals.delete(id); };
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
const { CasinoPlayer, RACE_FRAMES } = await import('../../src/casino/play');
const { casinoMarkup } = await import('../../src/casino/view');
const { freshSlotsUi, slotsMarkup } = await import('../../src/slots/view');
const { freshSlots } = await import('../../src/slots/state');
const { machineById } = await import('../../src/slots/machines');
const seq = (seed: number) => { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return Math.floor((s >>> 0) / 4294967296 * n); }; };
const flush = () => { for (let i = 0; i < 400 && queue.length; i++) queue.shift()!(); };
const runIntervals = () => { for (let i = 0; i < RACE_FRAMES + 5 && intervals.size; i++) for (const f of [...intervals.values()]) f(); };
const player = (seed = 1) => { store.clear(); queue = []; intervals.clear(); return new CasinoPlayer({ render() {}, sound() {}, active: () => true }, seq(seed)); };

const WIRED: [string, string][] = [
 ['.cz-game.roulette', 'backdrop-roulette.webp'],
 ['.cz-game.baccarat', 'backdrop-baccarat.webp'],
 ['.cz-game.craps', 'backdrop-craps.webp'],
 ['.cz-game.races', 'backdrop-racing.webp'],
 ['.panel.plo', 'backdrop-poker.webp'], // Omaha plays in the poker room — no backdrop of its own
 ['.panel.career', 'backdrop-lobby-staircase.webp'],
 ['.panel.heads-up', 'backdrop-heads-up-duel.webp'],
 ['.bj-screen', 'backdrop-blackjack.webp'],
 ['.game-layout .table-panel', 'backdrop-poker.webp'],
];

describe('Phase 9 — backdrop wiring', () => {
 it('assigns one backdrop per destination through the Phase 8 slot', () => {
  const css = read('src/ui/casino.css');
  for (const [selector, file] of WIRED) expect(css).toContain(`${selector}{--game-backdrop:url('/casino-art/${file}')}`);
  expect(css).toContain('.tournament-play,.tournament-lobby{--game-backdrop:url(\'/casino-art/backdrop-poker.webp\')}');
  // The Phase 8 slot rule itself is untouched.
  expect(css).toContain('.panel.cz-game,.panel.slots{background-image:var(--game-backdrop,none)');
  // The shell theme's .panel shorthand (higher specificity, imported last) would erase
  // the slot on panels, so the dark theme repaints them above it, scrim over the photo.
  expect(css).toContain('.app-shell:not(.theme-light) .panel.cz-game');
  expect(css).toContain('var(--game-backdrop,none);background-size:cover');
 });
 it('ships every wired asset on disk under public/casino-art', () => {
  for (const file of [...new Set(WIRED.map(([, f]) => f)), 'winners-circle.webp', 'jackpot-celebration.webp'])
   expect(existsSync(new URL(`public/casino-art/${file}`, root)), file).toBe(true);
 });
 it('wraps the blackjack screens in the backdrop wrapper', () => {
  expect(read('src/ui/app.ts')).toContain('<div class="bj-screen">');
 });
});

describe('Phase 9 — winner’s circle (racing)', () => {
 it('shows the banner only when the player’s race returns more than was wagered', () => {
  let sawWin = false, sawNoWin = false;
  for (let seed = 1; seed <= 60 && !(sawWin && sawNoWin); seed++) {
   const p = player(seed);
   const fav = [...p.ui.races.card.runners].filter(r => !r.scratched).sort((x, y) => y.p - x.p)[0].no;
   p.pickRunner(fav);
   p.startRace(); runIntervals(); flush();
   const h = p.ui.races, html = casinoMarkup(p, 'races');
   if (h.returned > h.wagered) { expect(html).toContain('rc-winners-circle'); expect(html).toContain('/casino-art/winners-circle.webp'); sawWin = true; }
   else if (h.phase === 'done') { expect(html).not.toContain('rc-winners-circle'); sawNoWin = true; }
  }
  expect(sawWin).toBe(true);
  expect(sawNoWin).toBe(true);
 });
});

describe('Phase 9 — jackpot celebration (slots EPIC tier)', () => {
 const machine = machineById('lucky-sevens')!;
 const uiWith = (total: number, bet: number) => {
  const ui = freshSlotsUi();
  ui.machine = machine.id;
  ui.phase = 'done';
  ui.result = { grid: machine.reels.map(s => s.slice(0, machine.rows)), wins: [], total, bet, lineTotal: 0, scatterWin: 0 } as never;
  return ui;
 };
 it('EPIC (100x+) composites the jackpot banner with screen blending, never as a cutout', () => {
  const html = slotsMarkup(freshSlots(), uiWith(15000, 100));
  expect(html).toContain('slot-jackpot-burst');
  expect(html).toContain('/casino-art/jackpot-celebration.webp');
  const css = read('src/ui/slots.css');
  expect(css).toContain('.slot-jackpot-burst{position:absolute;inset:0');
  expect(css).toContain('mix-blend-mode:screen');
  expect(css).toContain('.motion-off .slot-jackpot-burst{display:none}');
  expect(css).toContain('@media (prefers-reduced-motion:reduce){.slot-jackpot-burst{display:none}}');
 });
 it('BIG (15x) does not fire the jackpot banner', () => {
  const html = slotsMarkup(freshSlots(), uiWith(2000, 100));
  expect(html).not.toContain('slot-jackpot-burst');
 });
});
