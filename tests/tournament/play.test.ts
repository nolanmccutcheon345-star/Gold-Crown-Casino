import {describe,expect,it,vi} from 'vitest';
import {projectView,startHand} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';
import {canPreCheckFold,tournamentAnnouncement,tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {sampleView} from './fixtures';
const profile:RuleProfile={id:'ui-fixture',version:'1',mode:'cash',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function source(count=6):TournamentPlaySource {
 const game=startHand({handId:'display',profile,seats:Array.from({length:count},(_,id)=>({id,name:id===0?'You':`Player ${id}`,stack:3000})),button:count-3});
 return {status:'ready',busy:false,error:'',data:{active:{entrants:count,handNumber:1,paused:false,status:'running',history:[],finishes:[]}},view:sampleView({entrants:count,playersLeft:count,level:1}),gameView:projectView(game,0),act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})};
}
describe('playable tournament public presentation',()=>{
 it.each([6,9])('keeps all %i physical seats and hero bottom; only hero cards are visible',count=>{
  const c=source(count),html=tournamentPlayMarkup(c);
  expect(html.match(/data-t-seat=/g)).toHaveLength(count);
  expect(html).toContain('hero-seat');expect(html).toContain('--compact-x:0.5;--compact-y:1');
  expect(html.match(/aria-label="Hidden card"/g)).toHaveLength((count-1)*2);
  expect(html).toContain('Single-table freezeout');expect(html).toContain('not tournament-calibrated');
  expect(html).toContain('id="t-fold" >Fold');expect(html).toContain('id="t-call" >Call 50');
  expect(html).toContain('Raise to 100');expect(html).not.toContain('Raise to $');
 });
 it('retains dead dealer and small-blind markers on eliminated physical seats',()=>{
  const c=source(9);c.gameView={...c.gameView!,seats:c.gameView!.seats.filter(seat=>seat.id!==2),button:2,smallBlindSeat:2};
  const html=tournamentPlayMarkup(c),empty=html.match(/<article class="seat empty-seat"[^]*?<\/article>/)?.[0];
  expect(empty).toContain('data-t-seat="2"');expect(empty).toContain('Dealer button');expect(empty).toContain('Small blind');
  expect(html.match(/data-t-seat=/g)).toHaveLength(9);
 });
 it('never enables action controls for spectators, paused games or readonly ownership',()=>{
  for(const scenario of ['spectator','paused','readonly']){const c=source();if(scenario==='spectator')c.data!.active!.status='hero-out';else if(scenario==='paused')c.data!.active!.paused=true;else c.status='readonly';const html=tournamentPlayMarkup(c);for(const id of ['t-fold','t-call','t-raise','t-all-in'])expect(html).toMatch(new RegExp(`id="${id}"[^>]*disabled`));}
 });
 it('rejects illegal raise drafts without changing game state',()=>{
  const c=source(),original=JSON.stringify(c.gameView);
  for(const value of ['0','99','3001','1.5','NaN','<script>'])expect(tournamentPlayMarkup(c,value)).toMatch(/id="t-raise" disabled/);
  expect(JSON.stringify(c.gameView)).toBe(original);expect(c.act).not.toHaveBeenCalled();
 });
 it('offers raise shortcuts, steppers and Hero cards beside the decision, and nothing extra when not acting',()=>{
  const c=source(),html=tournamentPlayMarkup(c,'125');
  expect(html).toContain('data-t-to="125" data-size="bb-2.5" aria-pressed="true"');expect(html).toContain('data-t-to="150" data-size="bb-3" aria-pressed="false"');
  expect(html).toContain('id="t-less"');expect(html).toContain('id="t-more"');expect(html).toContain('class="t-hero-cards" role="img" aria-label="Your cards: ');
  expect(html).toContain('3,000 · 60 BB');expect(html).not.toContain('id="t-pre-check-fold"');expect(html).not.toContain('Contribution level');expect(html).not.toContain('Uncalled:');expect(html).not.toContain('Final table');
  c.gameView={...c.gameView!,actor:1,legal:{...c.gameView!.legal,actor:1}};const waiting=tournamentPlayMarkup(c,'',{preCheckFold:true});
  expect(canPreCheckFold(c)).toBe(true);expect(waiting).toContain('id="t-pre-check-fold" aria-pressed="true"');expect(waiting).not.toContain('data-t-to=');expect(waiting).toContain('waiting-action');expect(waiting).toMatch(/id="t-less"[^>]*disabled/);
  c.data!.active!.paused=true;expect(canPreCheckFold(c)).toBe(false);
 });
 it('labels seats with this street\'s action in plain words',()=>{
  const c=source(),html=tournamentPlayMarkup(c);
  expect(html).toContain('<span class="seat-action">Blind</span>');expect(html).toContain('<span class="seat-action">Your turn</span>');expect(html).not.toContain('>Hand complete<');expect(html).not.toContain('>Eliminated<');
 });
 it('offers auto-deal only while Hero is still in the event',()=>{
  const c=source();c.gameView={...c.gameView!,street:'complete',actor:null};
  const manual=tournamentPlayMarkup(c);expect(manual).toContain('id="t-auto-deal" type="checkbox" >');expect(manual).toContain('>Deal next tournament hand<');expect(manual).not.toContain('t-auto-hold');
  const auto=tournamentPlayMarkup(c,'',{autoDeal:true,autoDealSeconds:2});expect(auto).toContain('<span class="t-deal-count">Next hand in <span id="t-auto-count">2</span>s</span>');expect(auto).toContain('id="t-auto-hold"');expect(auto).toContain('id="t-next"');
  expect(tournamentPlayMarkup(c,'',{autoDeal:true,autoDealHeld:true})).toContain('>Deal next tournament hand<');
  c.data!.active!.status='hero-out';const out=tournamentPlayMarkup(c,'',{autoDeal:true});expect(out).not.toContain('t-auto-deal');expect(out).toContain('id="t-watch-result"');
 });
 it('announces current decision, board and chip pot accessibly',()=>{
  const c=source();expect(tournamentAnnouncement(c)).toContain('Your turn. Call 50 chips.');expect(tournamentAnnouncement(c)).toContain('Pot 75 chips.');expect(tournamentPlayMarkup(c)).toContain('role="status" aria-live="polite" aria-atomic="true"');
 });
 it('offers watch-to-result only after elimination without executing actions',()=>{
  const c=source();expect(tournamentPlayMarkup(c)).not.toContain('id="t-watch-result"');c.data!.active!.status='hero-out';
  const html=tournamentPlayMarkup(c,'',{watchToResult:true,externalAnnouncement:true});expect(html).toMatch(/id="t-watch-result" type="checkbox" checked/);expect(html).toContain('Pause stops play');expect(html).not.toContain('aria-live');expect(c.nextHand).not.toHaveBeenCalled();
 });
 it('projects compact canonical history safely with no saved frames',()=>{
  const c=source(),state=startHand({handId:'archive',profile,seats:[{id:0,name:'You',stack:3000},{id:1,name:'Opponent',stack:3000}],button:0});
  c.data!.active!.history=[{number:9,frames:[],state}];const html=tournamentPlayMarkup(c);expect(html).toContain('Hand 9 ·');expect(html).not.toMatch(/<p>[^<]*Opponent:/);
 });
 it('reads compact final public history without requiring frame archives',()=>{
  const c=source();c.data!.active!.history=[{number:8,frames:[],finalView:c.gameView!}];expect(tournamentPlayMarkup(c)).toContain('Hand 8 ·');
 });
 it('history only renders supplied public frames and escapes user-visible names',()=>{
  const c=source();c.gameView!.seats[1].name='<img src=x onerror=alert(1)>';
  c.data!.active!.history=[{number:1,frames:[c.gameView!]}];const html=tournamentPlayMarkup(c);
  expect(html).toContain('Saved tournament hands · 1');expect(html).not.toContain('<img');expect(html).toContain('&lt;img');expect(html).not.toContain('policyVersion');
 });
});
