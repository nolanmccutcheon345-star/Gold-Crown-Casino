import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,legalActions} from '../../src/core/engine';
import {playStats,tournamentStats,finishedEvents,type Who} from '../../src/tournament/stats';
import {tournamentStatsMarkup,netChart} from '../../src/tournament/stats-screen';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {tournamentRecords} from '../../src/tournament/runtime';
import {tournamentTotals} from '../../src/tournament/view-model';
import {allHeroHands} from '../../src/tournament/mtt-event';

const rules:RuleProfile={id:'stats-hands',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
type Act=Parameters<typeof applyCommand>[1]['action'];
const act=(s:GameState,action:Act)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
const table=(stacks:number[],button=0,id='h')=>startHand({handId:id,button,profile:rules,seats:stacks.map((bb,seat)=>({id:seat,name:seat===0?'You':`P${seat}`,stack:bb*200}))});
/** Play `script` (seat → actions in order) until the hand ends; seats with no script fold, or check when they can. */
function play(s:GameState,script:Record<number,Act[]>):GameState {for(let n=0;s.street!=='complete'&&n<200;n++){const next=script[s.actor!]?.shift();s=act(s,next??(legalActions(s).check?{type:'check'}:{type:'fold'}));}return s;}
const who=(seatId:number):Who[]=>seatId===0?['hero']:seatId===2?['field','strong']:['field'];
const get=(stats:ReturnType<typeof playStats>,key:string)=>stats.find(s=>s.key===key)!.rates;

describe('tournament playing statistics',()=>{
 it('counts a button steal, a big blind defence and a continuation bet',()=>{
  // Hero on the button raises first in; the big blind (seat 2) calls; Hero bets the flop and the big blind folds.
  const s=play(table(Array(9).fill(40)),{0:[{type:'raise',to:450},{type:'raise',to:600}],2:[{type:'call'},{type:'check'},{type:'fold'}]});
  const stats=playStats([s],who);
  expect(get(stats,'steal').hero).toEqual({count:1,chances:1});expect(get(stats,'pfr').hero).toEqual({count:1,chances:1});expect(get(stats,'vpip').hero).toEqual({count:1,chances:1});
  expect(get(stats,'cbet').hero).toEqual({count:1,chances:1});
  expect(get(stats,'bbdefend').strong).toEqual({count:1,chances:1});expect(get(stats,'bbdefend').field).toEqual({count:1,chances:1});
  expect(get(stats,'vpip').field).toEqual({count:1,chances:8});expect(get(stats,'threebet').field.count).toBe(0);
  expect(get(stats,'wtsd').hero).toEqual({count:0,chances:1});
 });
 it('separates short-stack all-ins from limps and small raises, and counts all-in calls',()=>{
  // Hero under the gun with 10 BB: all-in. The button calls; showdown follows.
  const shove=play(table([10,40,40,40,40,40,40,40,40],1,'s1'),{0:[{type:'raise',to:2000}],1:[{type:'call'}]});
  const limp=play(table([10,40,40,40,40,40,40,40,40],1,'s2'),{0:[{type:'raise',to:400}]});
  const stats=playStats([shove,limp],who);
  expect(get(stats,'shortshove').hero).toEqual({count:1,chances:2});expect(get(stats,'shortlimp').hero).toEqual({count:1,chances:2});
  expect(get(stats,'callallin').field.count).toBe(1);expect(get(stats,'wtsd').hero.count).toBeGreaterThanOrEqual(1);
  for(const stat of stats)for(const rate of Object.values(stat.rates))expect(rate.count).toBeLessThanOrEqual(rate.chances);
 });
 describe.sequential('saved event statistics in bounded action phases',()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());
  beforeAll(async()=>{await c.init();await c.startEvent('home-50',9,'fast');expect(c.error).toBe('');});
  afterAll(()=>c.close());
  for(let batch=0;batch<40;batch++)it(`action phase ${batch+1}`,async()=>{
   for(let step=0;step<50&&c.data!.active!.status==='running';step++){
    const a=c.data!.active!,g=c.gameView!;
    if(a.game.street==='complete')await c.nextHand();
    else if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);
    else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}
    expect(c.error).toBe('');
   }
  });
  it('summarises the finish, filters it and renders the page',()=>{
  const data=c.data!,events=finishedEvents(data);expect(events.length).toBeGreaterThanOrEqual(1);
  const stats=tournamentStats(data),totals=tournamentTotals(tournamentRecords(data));
  expect(stats.totals.events).toBe(totals.events);expect(stats.totals.net).toBe(totals.net);expect(stats.totals.cashes).toBe(totals.cashes);
  expect(stats.hands).toBe(events.reduce((n,e)=>n+allHeroHands(e).filter(h=>h.state.seats.some(x=>x.id===0&&x.startingStack>0)).length,0));expect(stats.hands).toBeLessThanOrEqual(events.reduce((n,e)=>n+allHeroHands(e).length,0));
  expect(get(stats.play,'vpip').hero.count).toBe(0);expect(get(stats.play,'vpip').hero.chances).toBe(stats.hands);
  expect(get(stats.play,'vpip').field.chances).toBeGreaterThan(stats.hands);
  expect(tournamentStats(data,{format:'multi',tier:'all',recent:'all'}).totals.events).toBe(0);
  expect(tournamentStats(data,{format:'single',tier:'home',recent:'20'}).totals.events).toBe(stats.totals.events);
  const page=tournamentStatsMarkup(stats);expect(page).toContain('data-testid="tournament-stats"');expect(page).toContain('How you play');expect(page).not.toContain('undefined');expect(page).not.toContain('NaN');
  expect(tournamentStatsMarkup(tournamentStats(data,{format:'multi',tier:'all',recent:'all'}))).toContain('No finished tournaments match');
  });
 });
 it('draws the running net chart with a zero line and a point title for each event',()=>{
  const events=[{net:-1000},{net:5000},{net:-1000}].map((e,i)=>({id:`e${i}`,name:`Event <${i}>`,tier:'home' as const,entrants:9,multi:false,place:3,cost:1000,prize:1000+e.net,net:e.net,hands:20,finishedAt:'2026-11-18T00:00:00Z'}));
  const svg=netChart(events);expect(svg).toContain('tstats-zero');expect((svg.match(/<title>/g)??[]).length).toBe(3);expect(svg).toContain('+$30');expect(svg).not.toContain('<0>');expect(netChart(events.slice(0,1))).toBe('');
 });
});
