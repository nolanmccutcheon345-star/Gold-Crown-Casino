import {describe,it,expect,vi} from 'vitest';
import {sampleView} from '../tournament/fixtures';
import {levelStripMarkup,lobbyMarkup,standingsMarkup,tournamentBannerMarkup} from '../../src/tournament/screens';
import {tournamentPlayMarkup,tournamentAnnouncement,type TournamentPlaySource} from '../../src/ui/tournament-play';
import {projectSpectatorView,startHand} from '../../src/core/engine';
import type {RuleProfile} from '../../src/contracts';
import {tournamentStats} from '../../src/tournament/stats';
import {EVENT_PRESETS} from '../../src/tournament/presets';
import type {TournamentData,TournamentEvent} from '../../src/tournament/runtime';

const openView=()=>({...sampleView({entrants:27,playersLeft:3,level:4,heroRank:null}),status:'hero-out' as const,hero:null,result:null,registration:{open:true,closesAfterLevel:4,entries:30,reEntries:1,late:2},handForHand:true,finalTable:true});
const rules:RuleProfile={id:'ui60',version:'1',mode:'tournament',chipUnit:1,smallBlind:25,bigBlind:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};

describe('independent late-registration presentation',()=>{
 it('labels opening payouts and does not call the multi-table lobby single-table',()=>{
  const html=lobbyMarkup({tier:'casino',presetId:'daily-125',entrants:27},{available:true,reason:''});
  expect(html).toContain('Playable multi-table');expect(html).not.toContain('Playable single-table');expect(html).toContain('Opening prize pool');expect(html).toContain('Opening payouts');expect(html).toContain('you get one entry');
  const single=lobbyMarkup({tier:'home',presetId:'home-20',entrants:9},{available:true,reason:''});expect(single).toContain('Playable single-table');expect(single).toContain('Freezeout: one entry, no rebuys.');expect(single).not.toContain('Late registration');
 });
 it('never promises bubble money or a final prize while registration is open, even after Hero busts',()=>{
  const view=openView(),html=tournamentBannerMarkup(view);
  expect(html).toContain('30 entries so far, 1 of them re-entries');expect(html).not.toMatch(/On the bubble|Final table|In the money|Hand for hand/);
  expect(levelStripMarkup(view)).toContain('late reg to level 4');
  expect(tournamentBannerMarkup({...view,status:'complete'})).toBe('');
  const old=sampleView({playersLeft:8,level:9});expect(tournamentBannerMarkup(old)).toContain('On the bubble');expect(levelStripMarkup(old)).not.toContain('late reg');expect(tournamentBannerMarkup({...old,status:'hero-out'})).toBe('');expect(standingsMarkup(old)).not.toContain('Provisional');
 });
 it('lists deferred eliminations without inventing a live rank or a paid prize',()=>{
  const view=openView();view.standings=[{name:'Live',isHero:false,stack:10000,table:1,finished:null,prize:0},{name:'You',isHero:true,stack:0,table:null,finished:null,prize:0,awaitingPlace:true}];
  const html=standingsMarkup(view);expect(html).toContain('Out · place pending');expect(html).toContain('<th scope="row">Pending</th>');expect(html).not.toContain('<td>Paid</td>');expect(html).toContain('Provisional until registration closes.');expect(html).not.toContain('Nobody has been eliminated yet.');
  // Deferred rows themselves prevent the no-eliminations footer even during a count refresh.
  expect(standingsMarkup({...view,playersLeft:view.entrants})).not.toContain('Nobody has been eliminated yet.');
 });
 it('keeps watch and skip controls available before Hero has a final place, without another player appearing as Hero',()=>{
  const game=startHand({handId:'spectating',profile:rules,button:3,seats:Array.from({length:6},(_,id)=>({id,name:`Opponent ${id}`,stack:3000}))});
  expect(game.actor).toBe(0);
  const c:TournamentPlaySource={status:'ready',busy:false,error:'',data:{active:{entrants:27,handNumber:2,paused:false,status:'hero-out',history:[],finishes:[]}},view:openView(),gameView:projectSpectatorView(game),act:vi.fn(async()=>{}),nextHand:vi.fn(async()=>{}),setPaused:vi.fn(async()=>{}),finishEvent:vi.fn(async()=>{})};
  const html=tournamentPlayMarkup(c);expect(html).toContain('You are out · place pending');expect(html).toContain('id="t-fast-forward"');expect(html).toContain('id="t-watch-result"');expect(html).not.toContain('Your decision');expect(html).not.toContain('Your cards:');expect(html).not.toContain('You finished');expect(tournamentAnnouncement(c)).not.toContain('Your turn');expect(c.act).not.toHaveBeenCalled();
 });
 it('uses total entries for Stats finish percentages and preserves old single-table denominators',()=>{
  // Pure result projection fixture: no history or money mutation is being simulated here.
  const base={id:'grown',preset:EVENT_PRESETS.find(p=>p.id==='daily-125')!,entrants:27,startedAt:'2026-11-19T00:00:00Z',finishedAt:'2026-11-19T01:00:00Z',finishes:[{seatId:0,name:'You',place:34,prize:0}],history:[],profiles:{},mtt:{blocks:[],state:{players:Array.from({length:34},(_,id)=>({id,name:id===0?'You':`P${id}`}))}}} as unknown as TournamentEvent;
  const data={completed:[base],active:null,ledger:[]} as unknown as TournamentData;const stats=tournamentStats(data);
  expect(stats.events[0].entrants).toBe(34);expect(stats.averageFinish).toBe(1);expect(stats.bestFinish?.entrants).toBe(34);expect(stats.groups.field.find(g=>g.label==='28–54 players')?.events).toBe(1);
  const old={...base,entrants:9,mtt:undefined,finishes:[{...base.finishes[0],place:5}]};const prior=tournamentStats({...data,completed:[old]});expect(prior.events[0].entrants).toBe(9);expect(prior.averageFinish).toBe(.5);
 });
});
