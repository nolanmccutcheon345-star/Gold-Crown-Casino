import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {AT_HERO,REPLIES,handChatter,regularOfProfile} from '../../src/bots/talk';
import {regularProfile} from '../../src/bots/regulars';
import {avatarSvg} from '../../src/ui/avatars';
import {FELTS,normalizeStyle} from '../../src/ui/table-style';
import {hand,act,rig} from '../verification/helpers';
import type {GameState} from '../../src/contracts';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');
const chatty=regularProfile('vince','mid');
const personas=Object.fromEntries([1,2,3].map(id=>[id,{name:`P${id}`,profile:chatty,regular:regularOfProfile(chatty)}]));
function playOut(seed:number,heroAllIn:boolean):GameState {
 let s=rig({...hand([20000,20000,20000,20000],1),handId:`b${seed}`},[['As','Ad'],['Kc','Kd'],['7h','2c'],['Qs','Js']],['Ah','Kh','9s','4d','3c']);
 for(let k=0;k<20&&s.street!=='complete';k++){
  const seat=s.seats.find(x=>x.id===s.actor)!;
  const action=seat.id===0?(heroAllIn?{type:'raise' as const,to:20000}:{type:'fold' as const}):seat.id===1?{type:'call' as const}:{type:'fold' as const};
  try{s=act(s,action);}catch{s=act(s,{type:'call'});}
 }
 return s;
}
describe('patch 60 banter and talk to Hero',()=>{
 it('keeps at most two lines, deterministic, never Hero',()=>{
  for(let i=0;i<120;i++){const s=playOut(i,i%2===0);if(s.street!=='complete')continue;const c=handChatter(s,personas);
   expect(c.lines.length).toBeLessThanOrEqual(2);expect(handChatter(s,personas)).toEqual(c);for(const l of c.lines)expect(l.seatId).not.toBe(0);}
 });
 it('sometimes answers a line with a reply from another player in the pot',()=>{
  const replies:string[]=[...REPLIES.toWin,...REPLIES.toLoss];let seen=0;
  for(let i=0;i<400;i++){
   let s=rig({...hand([20000,20000,20000],1),handId:`r${i}`},[['2c','3d'],['As','Ad'],['Kc','Kd']],['Ah','Kh','9s','4d','8c']);
   for(let k=0;k<20&&s.street!=='complete';k++){const seat=s.seats.find(x=>x.id===s.actor)!;try{s=act(s,seat.id===0?{type:'fold'}:{type:'raise',to:20000});}catch{s=act(s,{type:'call'});}}
   const c=handChatter(s,personas);
   if(c.lines.length===2&&replies.includes(c.lines[1].text)){seen++;expect(c.lines[1].seatId).not.toBe(c.lines[0].seatId);}
  }
  expect(seen).toBeGreaterThan(0);
 });
 it('speaks to Hero after a big pot between them',()=>{
  const lines=[...AT_HERO.heroWon,...AT_HERO.heroLost];let seen=0;
  for(let i=0;i<300;i++){const s=playOut(i,true);if(s.street!=='complete')continue;if(handChatter(s,personas).lines.some(l=>lines.includes(l.text as never)))seen++;}
  expect(seen).toBeGreaterThan(0);
 });
});

describe('patch 60 talk history, reveal, think bar, looks and counting',()=>{
 it('keeps the last 20 lines, only with table talk on',()=>{
  expect(app).toContain('if (talkLog.length > 20) talkLog.shift();');
  expect(app).toContain("if (!tableTalk) return '';");
 });
 it('turns shown hands over one at a time with the winners last, and waits to celebrate',()=>{
  expect(app).toContain('shownIds.sort((a, b) => Number((shown.payouts[a] ?? 0) > 0) - Number((shown.payouts[b] ?? 0) > 0) || order(a) - order(b))');
  expect(css).toContain('.hole-cards.revealed .playing-card{animation:pna-reveal .38s ease-out both;animation-delay:calc(var(--reveal-i,0) * .55s)}');
  expect(css).toContain('.board-cards.has-winner .playing-card{transition:filter .4s ease calc(var(--reveal-n,0) * .55s + .3s)}');
  expect(css).toMatch(/\.pitch \.seat:not\(\.folded\) \.hole-cards\.deal-0:not\(\.shown-hand\):not\(\.revealed\)/);
 });
 it('shows a think bar instead of the ring',()=>{
  expect(app).not.toContain('think-ring');expect(css).toContain('animation:pna-think-bar var(--think-ms,1s) linear forwards');
 });
 it('adds Casino night and Kitchen table looks',()=>{
  expect(FELTS.map(([id])=>id)).toEqual(['green','blue','burgundy','charcoal','casino','kitchen']);
  expect(normalizeStyle({felt:'kitchen'}).felt).toBe('kitchen');
  expect(css).toContain('.felt-casino .table-rail{');expect(css).toContain('.felt-kitchen .table-panel .felt');
 });
 it('blinks and tilts faces at a per-player offset, still with motion off rules',()=>{
  const svg=avatarSvg('Riley');
  expect(svg).toMatch(/style="--blink-delay:[\d.]+s;--tilt-delay:[\d.]+s"/);expect(svg).toContain('<g class="eyes">');expect(svg).toContain('<g class="head">');
  expect(avatarSvg('Riley')).toBe(svg);
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.face \.eyes,\.face \.head\{animation:none\}/);
 });
 it('counts stacks without changing the element text that screen readers and tests read',()=>{
  expect(app).toContain("el.setAttribute('data-tick',");
  expect(css).toContain('.seat-label strong[data-tick]::after{content:attr(data-tick)');
  expect(app).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches) return;");
 });
});
