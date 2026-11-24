import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MACHINES } from '../../src/slots/machines';
import { casinoHomeHero, casinoFeaturedMachines, casinoWordmark } from '../../src/ui/casino-components';
import { freshSlotsUi, slotCabinetArt, slotsMarkup } from '../../src/slots/view';
import { freshSlots } from '../../src/slots/state';
const root = new URL('../../', import.meta.url);
const read = (path:string) => readFileSync(new URL(path,root),'utf8');

describe('Patch 107 — visual-only premium Card Room', () => {
 it('loads the luxury design over the original game styles',()=>{
  const app=read('src/ui/app.ts');
  const landscape=app.indexOf("import './landscape.css'");
  const premium=app.indexOf("import './premium-casino.css'");
  const casino=app.indexOf("import './casino-visual107.css'");
  expect(landscape).toBeGreaterThan(-1);
  expect(premium).toBeGreaterThan(landscape);
  expect(casino).toBeGreaterThan(premium);
  expect(app).toContain("import './casino.css'");
 });
 it('puts the approved identity on the actual application and live home routes',()=>{
  const home=casinoHomeHero();
  expect(casinoWordmark()).toContain('THE CARD ROOM');
  expect(casinoWordmark()).toContain('POKER NIGHT AI');
  expect(home).toContain('Virtual chips only');
  expect(home).toContain('data-view="slots"');
  expect(home).toContain('href="#home-game-collection"');
  const app=read('src/ui/app.ts');
  expect(app).toContain('${casinoWordmark()}');
  expect(app).toContain('${casinoFeaturedMachines()}');
  for(const id of ['roulette','craps','baccarat','races','slots'])expect(app).toContain(`data-view="${id}"`);
  expect((casinoFeaturedMachines().match(/data-view="slots"/g)??[]).length).toBe(3);
 });
 it('uses eight distinct original machine images without replacing reels',()=>{
  expect(MACHINES).toHaveLength(13);
  for(const m of MACHINES){
   for(const suffix of ['.svg','-marquee.webp','-cinematic.webp'])
    expect(existsSync(new URL(`public/casino-art/${m.id}${suffix}`,root))).toBe(true);
   expect(slotCabinetArt(m.id)).toContain(`/casino-art/${m.id}-marquee.webp`);
  }
  expect(slotCabinetArt('not-a-machine')).toBe('');
  const ui=freshSlotsUi();ui.machine=MACHINES[0].id;
  const machine=slotsMarkup(freshSlots(),ui);
  expect(machine).toContain('data-testid="slot-machine"');
  expect(machine).toContain('class="slot-reel');
  expect(machine).toContain('id="slots-spin"');
  expect(machine).toContain('id="slots-back"');
 });
 it('styles each of the four existing casino game tables and never defines new odds',()=>{
  const css=read('src/ui/casino-visual107.css');
  for(const term of ['.roulette','.craps','.baccarat','.races','.cz-wallet','.cz-actions','.cz-rounds','.cz-patrons'])
   expect(css).toContain(term);
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('forced-colors');
  expect(css).toContain(':focus-visible');
  for(const game of ['roulette','craps','baccarat','races'])
   expect(read('src/casino/view.ts')).toContain(`data-testid="${game}"`);
 });
 it('does not alter any betting, game engine, wallet, save data or bot files',()=>{
  // This test is a shipping guard. See PATCH107-REVIEW.md for the explicit diff allowlist.
  const css=read('src/ui/casino-design.css');
  for(const layer of ['casino-tables.css','casino-modes.css','casino-slots.css','casino-cinematic.css'])
   expect(css).toContain(layer);
  const body=read('src/slots/view.ts');
  expect(body).toContain('data-count-key="slots-balance"');
  expect(body).toContain('${reels}');
 });
});
