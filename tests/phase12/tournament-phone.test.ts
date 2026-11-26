import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {projectView,startHand} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {coachMarkup,freshCoachUi} from '../../src/coach/view';
import {lobbyMarkup} from '../../src/tournament/screens';
import {sampleView} from '../tournament/fixtures';
const profile:RuleProfile={id:'ui-fixture',version:'1',mode:'cash',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function source(count=6):TournamentPlaySource {
 const game=startHand({handId:'display',profile,seats:Array.from({length:count},(_,id)=>({id,name:id===0?'You':`Player ${id}`,stack:3000})),button:count-3});
 return {status:'ready',busy:false,error:'',data:{active:{entrants:count,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:sampleView({entrants:count,playersLeft:count,level:1}),gameView:projectView(game,0),act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})};
}
describe('Phase 12: tournament phone parity',()=>{
 it('T-F05: the All-in size button is a setter — pressed state tracks the draft, like its siblings',()=>{
  const c=source(),max=c.gameView!.legal.maxRaiseTo!;
  const plain=tournamentPlayMarkup(c);
  expect(plain).toMatch(/id="t-all-in" aria-pressed="false"/);
  const set=tournamentPlayMarkup(c,String(max));
  expect(set).toMatch(/class="button secondary selected" id="t-all-in" aria-pressed="true"/);
  expect(set).toContain(`All-in<small>${max.toLocaleString('en-US')}</small>`);
 });
 it('T-F06: an all-in Hero gets an honest waiting state, not a live-looking dead Call button',()=>{
  const c=source();
  c.gameView={...c.gameView!,actor:1,seats:c.gameView!.seats.map(seat=>seat.id===0?{...seat,allIn:true,stack:0}:seat)};
  const html=tournamentPlayMarkup(c);
  expect(html).toContain('data-testid="t-waiting-state"');
  expect(html).toContain('waiting for the hand to finish');
  expect(html).not.toContain('id="t-call"');expect(html).not.toContain('id="t-fold"');expect(html).not.toContain('id="t-raise"');
 });
 it('T-F06: a folded Hero gets the waiting state too',()=>{
  const c=source();
  c.gameView={...c.gameView!,actor:1,seats:c.gameView!.seats.map(seat=>seat.id===0?{...seat,folded:true}:seat)};
  const html=tournamentPlayMarkup(c);
  expect(html).toContain('data-testid="t-waiting-state"');
  expect(html).toContain('You folded.');
  expect(html).not.toContain('id="t-call"');
 });
 it('T-F06: a waiting Hero who can still act keeps the (disabled) controls and Check/Fold',()=>{
  const c=source();
  c.gameView={...c.gameView!,actor:1,legal:{...c.gameView!.legal,actor:1}};
  const html=tournamentPlayMarkup(c,'',{preCheckFold:true});
  expect(html).not.toContain('t-waiting-state');
  expect(html).toMatch(/id="t-call"[^>]*disabled/);
 });
 it('T-F01/F02: the helper markup renders after the action buttons, and the app wraps it in the capped helper zone',()=>{
  const c=source(),html=tournamentPlayMarkup(c,'',{oddsHelper:'<div class="coach-row">coach</div>'});
  expect(html).toContain('<div class="coach-row">coach</div>');
  expect(html.indexOf('id="t-raise"')).toBeLessThan(html.indexOf('coach-row'));
  const app=readFileSync('src/ui/app.ts','utf8');
  expect(app).toContain('`<div class="t-panel-extra" id="t-panel-extra">${inner}</div>`');
 });
 it('T-F09: the tournament coach row carries no promo teaser when the coach is off; cash keeps it',()=>{
  const ui=freshCoachUi();ui.on=false;
  expect(coachMarkup(ui,null,{waiting:false,tournament:true})).not.toContain('reads each decision');
  expect(coachMarkup(ui,null,{waiting:false,tournament:true})).toContain('id="coach-on"');
  expect(coachMarkup(ui,null,{waiting:false,tournament:false})).toContain('reads each decision');
 });
 it('T-F08: lobby cards state the real level rule — hands per level, never minutes',()=>{
  const html=lobbyMarkup({tier:'home',presetId:'home-20',entrants:6,pace:'fast'},{available:true,reason:''});
  expect(html).toContain('4–8 hands');
  expect(html).not.toContain(' min</b>');
 });
});
