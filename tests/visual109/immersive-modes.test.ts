import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const css=read('src/ui/casino-visual109.css');
const app=read('src/ui/app.ts');
const casino=read('src/casino/view.ts');

describe('Patch 109 - real casino mode presentation',()=>{
 it('loads the new final paint layer after 108',()=>{
  expect(app.indexOf("import './casino-visual109.css';")).toBeGreaterThan(app.indexOf("import './casino-visual108.css';"));
 });
 it('renders a title on each of the four real casino game screens',()=>{
  for(const mode of ['roulette','craps','baccarat','races']) {
   expect(casino).toContain(`roomMarquee('${mode}')`);
   expect(casino).toContain(`data-testid="${mode}"`);
  }
  expect(casino).toContain('class="cz-mode-banner"');
  expect(casino).toContain('class="cz-mode-copy"');
  expect(casino).not.toContain('fake-balance');
 });
 it('keeps every game mode distinct while respecting real live view classes',()=>{
  for(const selector of ['.table-panel','.tournament-table','.hu-stack-bar','.plo-felt','.blackjack-play','.slot-card','.slot-cabinet','.roulette','.craps','.baccarat','.races'])expect(css).toContain(selector);
  for(const selector of ['.seat-label','.board-slot','.pot-display','.bj-seat','.bj-actions','.slot-reel','.slot-meters','.rl-cell','.cr-puck','.bc-road','.rc-caller'])expect(css).toContain(selector);
 });
 it('keeps mode marquee content informational, not replacing game input or results',()=>{
  const fragment=casino.split('function roomMarquee(')[1]?.split('\n}\n')[0]??'';
  expect(fragment).toContain('<h2>${TITLES[game]}</h2>');
  expect(fragment).not.toContain('<button');
  expect(fragment).not.toContain('money(');
  expect(fragment).not.toContain('chipMark(');
  expect(fragment).not.toContain('data-rbet');
 });
 it('keeps touch, focus, reduced motion, and forced-color fallbacks',()=>{
  for(const x of ['min-height:48px','focus-visible','max-width:760px','max-width:420px','prefers-reduced-motion:reduce','forced-colors:active','.motion-off'])expect(css).toContain(x);
 });
});
