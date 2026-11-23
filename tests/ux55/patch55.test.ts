import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {avatarSvg,faceFor,nameHash,HAIR_STYLES,EXTRAS} from '../../src/ui/avatars';
import {BREAK_CHOICES,DEFAULT_STYLE,breaksDue,normalizeStyle,styleClasses} from '../../src/ui/table-style';
import {sampleView} from '../tournament/fixtures';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {projectView,startHand,applyCommand} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');

describe('patch 55 drawn avatars',()=>{
 it('gives the same name the same face, and varies across names',()=>{
  expect(faceFor('Riley')).toEqual(faceFor('Riley'));expect(faceFor(' riley ')).toEqual(faceFor('Riley'));
  expect(nameHash('Riley')).toBe(nameHash('Riley'));
  const faces=new Set(['Riley','Casey','Jordan','Taylor','Morgan','Drew','Alex','Quinn','Sam','Vince','Rosie','Dot'].map(n=>JSON.stringify(faceFor(n))));
  expect(faces.size).toBeGreaterThan(8);
 });
 it('uses every hair style and accessory across names',()=>{
  const names=Array.from({length:400},(_,i)=>`Player ${i}`);
  expect(new Set(names.map(n=>faceFor(n).hair)).size).toBe(HAIR_STYLES);
  expect(new Set(names.map(n=>faceFor(n).extra)).size).toBe(EXTRAS);
 });
 it('is a decorative, self-contained SVG coloured by the seat',()=>{
  const svg=avatarSvg('Riley');
  expect(svg).toMatch(/^<svg class="face mood-neutral" viewBox="0 0 40 40" aria-hidden="true"/);
  expect(svg).toContain('var(--avatar');expect(svg).not.toMatch(/<image|href=|<script/);
 });
 it('can be switched back to letters',()=>{
  expect(DEFAULT_STYLE.avatars).toBe(true);
  expect(app).toContain("faceArt(seatName(id,shown), faceMood(shown, id), id === 0, 'seat', shown, id)");
 });
});

describe('patch 55 session timer and breaks',()=>{
 it('counts a reminder each time playing time passes another interval',()=>{
  expect(breaksDue(29*60000,30)).toBe(0);expect(breaksDue(30*60000,30)).toBe(1);expect(breaksDue(95*60000,30)).toBe(3);
  expect(breaksDue(500*60000,0)).toBe(0);
 });
 it('offers off, 30, 60, 90 and 120 minutes, off by default, and repairs bad values',()=>{
  expect([...BREAK_CHOICES]).toEqual([0,30,60,90,120]);expect(DEFAULT_STYLE.breakEvery).toBe(0);
  expect(normalizeStyle({breakEvery:45}).breakEvery).toBe(0);expect(normalizeStyle({breakEvery:60}).breakEvery).toBe(60);
 });
 it('uses the session\'s tracked playing time, never pauses on its own, and remembers a dismissal',()=>{
  expect(app).toContain('ms: session.activeMs');
  expect(app).toContain("on('#break-dismiss', () => { ackBreak(); render(); });");
  expect(app).toMatch(/on\('#break-pause', \(\) => \{ ackBreak\(\); if \(!paused/);
  expect(app).toContain("sessionStorage.setItem(BREAK_KEY");
 });
});

describe('patch 55 dealer glide and chip slide',()=>{
 const rules:RuleProfile={id:'ux55',version:'1',mode:'tournament',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
 const source=(view:ReturnType<typeof projectView>)=>({status:'ready',busy:false,error:'',data:{active:{entrants:6,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:{...sampleView({entrants:6,playersLeft:6,level:1,heroRank:null}),status:'running'},gameView:view,act:async()=>{},nextHand:async()=>{},setPaused:async()=>{},finishEvent:async()=>{}}) as unknown as TournamentPlaySource;
 it('puts one dealer chip on the button seat, positioned like a seat',()=>{
  const game=startHand({handId:'ux55',profile:rules,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`P${id}`,stack:3000}))});
  const html=tournamentPlayMarkup(source(projectView(game,0)));
  expect(html.match(/class="seat-anchor dealer-glide"/g)).toHaveLength(1);
  expect(html).toContain('seat-layer has-dealer-glide');
  expect(html).not.toContain('pot-fly');
 });
 it('sends pot chips to each paid seat once the hand is settled',()=>{
  let game=startHand({handId:'ux55b',profile:rules,button:2,seats:Array.from({length:3},(_,id)=>({id,name:`P${id}`,stack:3000}))});
  let guard=0;
  while(game.street!=='complete'&&guard++<20){const actor=game.actor!;game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:actor,decisionId:`d${guard}`,action:{type:'fold'}});}
  const html=tournamentPlayMarkup(source(projectView(game,0)));
  const paid=Object.values(game.payouts).filter(v=>v>0).length;
  expect(paid).toBeGreaterThan(0);
  expect(html.match(/class="seat-anchor pot-fly"/g)).toHaveLength(paid);
 });
 it('mirrors every seat position rule, hides the per-seat chip, and respects motion settings',()=>{
  const seatRules=(css.match(/\.perimeter-table \.seat-anchor\{--seat-x:var\(--(wide|compact|short)-x\)/g)??[]).length;
  expect(seatRules).toBeGreaterThanOrEqual(4);
  expect(css).toContain('.has-dealer-glide .seat .dealer-button{visibility:hidden}');
  expect(css).toContain('.motion-off .pot-fly{display:none}'.replace('.motion-off .pot-fly','.no-chips .pot-fly,.motion-off .pot-fly'));
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.pot-fly\{display:none\}/);
 });
});

describe('patch 55 text size',()=>{
 it('offers standard, large and larger, applied as a zoom class',()=>{
  expect(styleClasses({...DEFAULT_STYLE,textSize:'large'})).toContain(' text-large');
  expect(styleClasses(DEFAULT_STYLE)).not.toContain('text-');
  expect(normalizeStyle({textSize:'huge'}).textSize).toBe('normal');
  expect(css).toContain('.text-large{zoom:1.12}');expect(css).toContain('.text-larger{zoom:1.25}');
 });
});
