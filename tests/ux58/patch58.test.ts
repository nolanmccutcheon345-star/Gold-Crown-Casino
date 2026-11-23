import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {avatarSvg,faceFor,moodFor,HATS,OUTFITS,HAIR_STYLES} from '../../src/ui/avatars';
import {talkMarkup} from '../../src/ui/table-talk';
import {bestFive,potPile,winningCards} from '../../src/ui/showdown-cards';
import type {Card,HeroViewModel} from '../../src/contracts';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');

describe('patch 58 richer avatars',()=>{
 it('varies hair, hats and outfits across names, and stays stable per name',()=>{
  const names=Array.from({length:500},(_,i)=>`Player ${i}`);
  expect(new Set(names.map(n=>faceFor(n).hair)).size).toBe(HAIR_STYLES);
  expect(new Set(names.map(n=>faceFor(n).hat)).size).toBe(HATS);
  expect(new Set(names.map(n=>faceFor(n).outfit)).size).toBe(OUTFITS);
  expect(avatarSvg('Riley')).toBe(avatarSvg('Riley'));
 });
 it('honors reduced motion for face reactions and pot chips',()=>{expect(css).toContain('.face-badge .face.mood-happy,.face-badge .face.mood-sad,.pot-pile .chip{animation:none!important}');});
 it('draws a different mouth for each mood, decorative and self-contained',()=>{
  const faces=['neutral','happy','sad'].map(m=>avatarSvg('Casey',m as 'neutral'));
  expect(new Set(faces).size).toBe(3);
  for(const svg of faces){expect(svg).toContain('aria-hidden="true"');expect(svg).not.toMatch(/<image|href=|<script/);}
 });
 it('smiles after a win and frowns after losing ten big blinds, only once the hand is settled',()=>{
  expect(moodFor({stack:31000,startingStack:30000},'complete',200)).toBe('happy');
  expect(moodFor({stack:28000,startingStack:30000},'complete',200)).toBe('sad');
  expect(moodFor({stack:29000,startingStack:30000},'complete',200)).toBe('neutral');
  expect(moodFor({stack:31000,startingStack:30000},'river',200)).toBe('neutral');
  expect(moodFor(undefined,'complete',200)).toBe('neutral');
 });
});

describe('patch 58 talk bubbles',()=>{
 const chatter={lines:[{seatId:3,text:'Nice hand'},{seatId:5,text:'Ugh <again>'}],shows:[]} as never;
 it('keeps the seat-talk element, adds typing dots and orders speakers',()=>{
  const first=talkMarkup(chatter,3),second=talkMarkup(chatter,5);
  expect(first).toContain('class="seat-talk" style="--talk-i:0"');expect(second).toContain('--talk-i:1');
  expect(first).toContain('<i class="talk-dots" aria-hidden="true">');
  expect(second).toContain('“Ugh &lt;again&gt;”');
  expect(talkMarkup(chatter,1)).toBe('');
 });
 it('shows the words at once without motion, and keeps bubbles on screen near the edges',()=>{
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.seat-talk,\.talk-text\{animation:none!important\}\.talk-dots\{display:none\}/);
  expect(css).toContain('max(0px,(var(--seat-x,.5) - .72) * 220px)');
 });
});

describe('patch 58 winning hand highlight',()=>{
 const view=(seats:{id:number;hole:Card[];paid?:number;shown?:string}[],board:Card[]):HeroViewModel=>({street:'complete',board,payouts:Object.fromEntries(seats.filter(s=>s.paid).map(s=>[s.id,s.paid])),handLabels:Object.fromEntries(seats.filter(s=>s.shown).map(s=>[s.id,s.shown])),seats:seats.map(s=>({id:s.id,hole:s.hole}))}) as unknown as HeroViewModel;
 it('finds the best five cards',()=>{
  expect(new Set(bestFive(['As','Ks','Qs','Js','Ts','2c','3d']))).toEqual(new Set(['As','Ks','Qs','Js','Ts']));
  expect(bestFive(['As','Ks'])).toEqual([]);
 });
 it('lights the winner\'s five after a shown-down river',()=>{
  const v=view([{id:0,hole:['Ah','Ad'],paid:1000,shown:'Three aces'},{id:2,hole:['Kc','Qc'],shown:'Pair of kings'}],['Ac','Kd','7s','4h','2c']);
  const cards=winningCards(v);
  expect(cards.has('Ah')&&cards.has('Ad')&&cards.has('Ac')).toBe(true);
  expect(cards.has('Kc')).toBe(false);expect(cards.size).toBe(5);
 });
 it('lights nothing when the pot was won without a showdown or before the river',()=>{
  expect(winningCards(view([{id:0,hole:['Ah','Ad'],paid:1000}],['Ac','Kd','7s','4h','2c'])).size).toBe(0);
  expect(winningCards(view([{id:0,hole:['Ah','Ad'],paid:1000,shown:'x'}],['Ac','Kd','7s'])).size).toBe(0);
 });
 it('covers both hands in a split pot',()=>{
  const v=view([{id:0,hole:['Ah','2d'],paid:500,shown:'Straight'},{id:1,hole:['Ad','3c'],paid:500,shown:'Straight'}],['Ks','Qs','Jd','Th','4c']);
  const cards=winningCards(v);expect(cards.has('Ah')&&cards.has('Ad')).toBe(true);
 });
 it('lights the revealed side-pot winner even when the main-pot winner holds a stronger hand',()=>{
  // Short stack wins the main pot with a flush; a second player wins the side pot with queens.
  const v=view([{id:0,hole:['Ah','Kh'],paid:1000,shown:'Flush'},{id:1,hole:['Qc','Qd'],paid:500,shown:'Pair of queens'},{id:2,hole:['Jc','Jd'],shown:'Pair of jacks'}],['2h','5h','9h','4h','3c']);
  const w=winningCards(v);expect(w.has('Ah')&&w.has('Kh')).toBe(true);expect(w.has('Qc')&&w.has('Qd')).toBe(true);expect(w.has('Jc')).toBe(false);
 });
 it('dims the other board cards without the flip animation undoing it',()=>{
  expect(css).toContain('.board-cards.has-winner .playing-card:not(.win-card){filter:brightness(.5) saturate(.6)}');
  expect(css).not.toMatch(/@keyframes pna-flip-in\{[^}]*filter/);
 });
});

describe('patch 58 pot pile, sweep, flip, toss and rail',()=>{
 it('builds up to four stacks of five chips, largest first',()=>{
  expect(potPile(200,200)).toEqual([['white']]);
  expect(potPile(1_000_000,200)).toHaveLength(4);
  expect(potPile(1_000_000,200).flat()).toHaveLength(20);
  expect(potPile(0,200)).toEqual([]);
 });
 it('sweeps the previous street\'s bets into the pot when the street changes',()=>{
  expect(app).toContain('lastBets.street !== game.street && lastBets.bets.length) sweep =');
  expect(app).toContain('class="seat-anchor pot-sweep"');
 });
 it('flips board cards, tosses opponents\' folded cards (not Hero\'s), and draws a stitched rail',()=>{
  expect(css).toContain('.board-cards .playing-card{animation:pna-flip-in');
  expect(css).toContain('.seat.folded:not(.hero-seat) .hole-cards .playing-card{animation:pna-toss');
  expect(css).toContain('.table-rail::after{');
 });
});
