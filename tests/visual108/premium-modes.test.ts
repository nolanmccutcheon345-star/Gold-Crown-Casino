import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=(p:string)=>readFileSync(new URL(p,root),'utf8');
const css=read('src/ui/casino-visual108.css');

describe('Patch 108 — refined premium in-play styling across every game',()=>{
 it('loads after 107 and after all base responsive rules',()=>{
  const app=read('src/ui/app.ts');
  expect(app).toContain("import './casino-visual108.css'");
  expect(app.indexOf("import './casino-visual108.css'")).toBeGreaterThan(app.indexOf("import './casino-visual107.css'"));
  expect(app.indexOf("import './casino-visual107.css'")).toBeGreaterThan(app.indexOf("import './landscape.css'"));
 });
 it('targets actual Holdem, tournament, heads-up and Omaha components',()=>{
  const poker=read('src/ui/app.ts');
  const tournament=read('src/ui/tournament-play.ts');
  for(const s of ['.table-panel','.table-rail','.felt','.seat-label','.pot-display','.action-panel','.t-action-panel','.tournament-hud','.hu-ladder','.plo-felt','.plo-actions'])expect(css).toContain(s);
  for(const c of ['table-panel','table-rail','pot-display','action-panel','seat-label'])expect(poker).toContain(c);
  expect(tournament).toContain('seat-label');
 });
 it('styles live Blackjack and Slots controls without replacing them',()=>{
  const bj=read('src/blackjack/screens.ts'),slots=read('src/slots/view.ts');
  for(const c of ['bj-actions','bj-felt','bj-dealer','bj-hand','bj-strategy-card']){expect(css).toContain(c);expect(bj).toContain(c)}
  for(const c of ['slot-window','slot-deck','slot-spin-button','slot-meters','slot-card']){expect(css).toContain(c);expect(slots).toContain(c)}
  expect(slots).toContain('id="slots-spin"');
  expect(slots).toContain('${reels}');
  expect(slots).toContain('data-count-key="slots-balance"');
 });
 it('addresses all four live casino tables and their game-specific controls',()=>{
  const game=read('src/casino/view.ts');
  for(const c of ['roulette','craps','baccarat','races','rl-wheel-wrap','rl-layout','cr-puck','cr-dice','bc-hand','bc-shoe-box','rc-track','rc-caller','cz-actions','cz-wallet','cz-rounds']){
   expect(css).toContain(c);expect(game).toContain(c);
  }
 });
 it('preserves usability on phones and OS accessibility settings',()=>{
  for(const marker of ['max-width:760px','max-width:420px','prefers-reduced-motion:reduce','forced-colors:active','focus-visible','min-height:48px'])expect(css).toContain(marker);
  expect(css).not.toMatch(/pointer-events\s*:\s*none[^}]*\.cz-actions/);
 });
});
