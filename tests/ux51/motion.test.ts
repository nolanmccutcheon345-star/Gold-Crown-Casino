import {describe,it,expect,vi,beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {dealClass,readMotion,saveMotion,turnTitle,MOTION_KEY} from '../../src/ui/motion';
import {sampleView} from '../tournament/fixtures';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {projectSpectatorView,startHand} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';

const rules:RuleProfile={id:'ux51',version:'1',mode:'tournament',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
const source=(handNumber:number):TournamentPlaySource=>{
 const game=startHand({handId:`ux-${handNumber}`,profile:rules,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`Player ${id}`,stack:3000}))});
 return {status:'ready',busy:false,error:'',data:{active:{entrants:6,handNumber,paused:false,status:'running',history:[],finishes:[]}},view:{...sampleView({entrants:6,playersLeft:6,level:1,heroRank:null}),status:'running'},gameView:projectSpectatorView(game),act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})} as unknown as TournamentPlaySource;
};
const css=readFileSync('src/ui/polish.css','utf8');
const app=readFileSync('src/ui/app.ts','utf8');

describe('patch 51 motion preference',()=>{
 beforeEach(()=>{try{localStorage.removeItem(MOTION_KEY);}catch{/* no storage in this runner */}});
 it('is on by default and remembers when the player turns it off',()=>{
  expect(readMotion()).toBe(true);
  saveMotion(false);
  if(typeof localStorage!=='undefined')expect(readMotion()).toBe(false);
  saveMotion(true);expect(readMotion()).toBe(true);
 });
 it('alternates the deal class every hand so reused card elements replay the deal',()=>{
  expect(dealClass(1)).toBe('deal-1');expect(dealClass(2)).toBe('deal-0');expect(dealClass(3)).not.toBe(dealClass(4));
 });
 it('marks the tab title only while Hero has a decision',()=>{
  expect(turnTitle('Poker Night AI',true)).toBe('● Your turn · Poker Night AI');
  expect(turnTitle('Poker Night AI',false)).toBe('Poker Night AI');
 });
 it('honours the device reduced-motion setting and the in-app switch',()=>{
  expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{[^}]*animation:none!important/);
  expect(css).toContain('.motion-off *');
  expect(app).toContain("box('table-motion', motion, 'Animations')");expect(app).toContain("motion?'':' motion-off'");
 });
 it('animates only presentation classes: no game logic reads the motion preference',()=>{
  for(const file of ['src/session/controller.ts','src/tournament/controller.ts','src/core/engine.ts']){
   const text=readFileSync(file,'utf8');
   expect(text).not.toMatch(/motion|dealClass/);
  }
 });
});

describe('patch 51 tournament table markup',()=>{
 it('gives hole cards a per-hand deal class',()=>{
  expect(tournamentPlayMarkup(source(4))).toContain('hole-cards deal-0');
  expect(tournamentPlayMarkup(source(5))).toContain('hole-cards deal-1');
 });
 it('offers the same animation preference at tournament tables',()=>{
  expect(tournamentPlayMarkup(source(4),'',{motion:true})).toContain('id="table-motion" checked');
  expect(tournamentPlayMarkup(source(4),'',{motion:false})).toContain('id="table-motion" >Animations');
  expect(app).toContain('talkOn:tableTalk,motion,watchToResult:');
  expect(css).toContain('.t-action-panel.your-action{animation:pna-rise');
 });
});

describe('patch 51 layout fixes',()=>{
 it('keeps session versions available but folded away',()=>{
  expect(app).toMatch(/<details class="provenance-details"><summary>Session versions<\/summary><p class="muted" data-testid="session-provenance"/);
 });
 it('stacks the session cards on a phone and repairs the footer note',()=>{
  expect(css).toMatch(/@media\(max-width:700px\)\{[\s\S]*\.session-rail[^{]*\{display:flex;flex-direction:column/);
  expect(css).toMatch(/@media\(max-width:950px\)\{[\s\S]*\.build-note\{display:block\}/);
 });
 it('asks before Skip to result runs past an open re-entry',()=>{
  expect(app).toContain('You can still re-enter this tournament.');
  expect(app).toContain('Skip stopped: you can re-enter this tournament.');
 });
});
