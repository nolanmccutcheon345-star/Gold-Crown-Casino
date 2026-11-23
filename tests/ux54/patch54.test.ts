import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {cashMilestones,sessionResults,sessionStreaks,tournamentMilestones} from '../../src/ui/achievements';
import {tournamentFlags,tournamentMoment} from '../../src/ui/moments';
import {DEFAULT_STYLE,normalizeStyle,styleClasses} from '../../src/ui/table-style';
import {vibrateFor} from '../../src/ui/sounds';
import type {AppData,MoneyEvent} from '../../src/session/types';
import type {TournamentRecord,TournamentView} from '../../src/tournament/view-model';

const app=readFileSync('src/ui/app.ts','utf8'),css=readFileSync('src/ui/polish.css','utf8');
const ev=(i:number,sessionId:string,net:number):MoneyEvent=>({id:`e${i}`,index:i,at:'',epoch:0,kind:'hand-net',walletDelta:0,tableDelta:0,pokerNet:net,sessionId,note:'',previousHash:'',hash:''});
function data(sessions:{id:string;nets:number[];ended?:boolean;start:string}[],hands:{net:number;bb?:number;showdownWin?:boolean}[]=[]):AppData {
 let i=0;
 return {
  ledger:sessions.flatMap(s=>s.nets.map(n=>ev(i++,s.id,n))),
  sessions:sessions.map(s=>({id:s.id,startedAt:s.start,endedAt:s.ended===false?null:'x',handIds:s.nets.map((_,k)=>`${s.id}-${k}`)})),
  hands:hands.map((h,k)=>({id:`h${k}`,net:h.net,view:{profile:{bigBlind:h.bb??200},handLabels:h.showdownWin?{0:'Pair of aces'}:{},payouts:h.showdownWin?{0:h.net+100}:{}}})),
 } as unknown as AppData;
}

describe('patch 54 streaks',()=>{
 it('counts winning-session runs; break-even or losing ends a run',()=>{
  expect(sessionStreaks([100,200,-5,300,1,2])).toEqual({current:3,best:3,completed:6});
  expect(sessionStreaks([100,0,100])).toEqual({current:1,best:1,completed:3});
  expect(sessionStreaks([])).toEqual({current:0,best:0,completed:0});
 });
 it('orders sessions by start, sums results from the ledger and skips the running session',()=>{
  const d=data([{id:'b',nets:[-50],start:'2026-02'},{id:'a',nets:[100,20],start:'2026-01'},{id:'c',nets:[5],start:'2026-03',ended:false}]);
  expect(sessionResults(d)).toEqual([120,-50]);
 });
});

describe('patch 54 milestones',()=>{
 it('counts hands from session records and pots from loaded hands',()=>{
  const d=data([{id:'a',nets:Array(120).fill(1),start:'1'}],[{net:5000},{net:30000,showdownWin:true}]);
  const m=Object.fromEntries(cashMilestones(d).map(x=>[x.id,x]));
  expect(m['hands-100'].earned).toBe(true);
  expect(m['hands-1000']).toMatchObject({earned:false,progress:{have:120,need:1000}});
  expect(m['pot-25'].earned).toBe(true);expect(m['pot-100'].earned).toBe(true);expect(m.showdown.earned).toBe(true);
  expect(m['session-win'].earned).toBe(true);expect(m['streak-3'].earned).toBe(false);
 });
 it('caps progress at the goal',()=>{
  const d=data([{id:'a',nets:Array(5).fill(1),start:'1'}]);
  expect(cashMilestones(d).find(x=>x.id==='hands-1')?.progress).toEqual({have:1,need:1});
 });
 it('reads tournament records',()=>{
  const r=(place:number,entrants:number,prize:number):TournamentRecord=>({eventName:'x',entrants,place,cost:2000,prize,finishedAt:''});
  const ids=(records:TournamentRecord[])=>tournamentMilestones(records).filter(m=>m.earned).map(m=>m.id);
  expect(ids([])).toEqual([]);
  expect(ids([r(12,27,0)])).toEqual(['t-first']);
  expect(ids([r(6,27,3000)])).toEqual(['t-first','t-cash','t-final']);
  expect(ids([r(1,6,6000)])).toEqual(['t-first','t-cash','t-win']);
 });
 it('uses neutral wording with no prompts to keep playing',()=>{
  const text=JSON.stringify([...cashMilestones(data([])),...tournamentMilestones([])]);
  expect(text).not.toMatch(/don.t break|keep (it|going)|hurry|daily|reward/i);
 });
});

describe('patch 54 tournament moments',()=>{
 const view=(over:Partial<TournamentView>):TournamentView=>({eventName:'Daily $125',status:'running',entrants:27,playersLeft:5,placesPaid:4,ladder:[50000,30000,20000,10000],hero:{stack:1,rank:1,table:1,seat:0},finalTable:true,result:null,registration:{open:false,closesAfterLevel:4,entries:27,reEntries:0,late:0},...over}) as unknown as TournamentView;
 const money=(c:number)=>`$${c/100}`;
 it('fires in the money once, with the minimum cash',()=>{
  const before=tournamentFlags(view({})),after=tournamentFlags(view({playersLeft:4}));
  expect(tournamentMoment(before,after,view({playersLeft:4}),money)).toEqual({kind:'win',title:'In the money',detail:'Every player left is paid at least $100.'});
  expect(tournamentMoment(after,after,view({playersLeft:4}),money)).toBeNull();
 });
 it('never says in the money while registration is open',()=>{
  expect(tournamentFlags(view({playersLeft:3,registration:{open:true,closesAfterLevel:4,entries:27,reEntries:0,late:0}})).itm).toBe(false);
 });
 it('marks the final table only for multi-table events, and the win',()=>{
  expect(tournamentFlags(view({entrants:9})).finalTable).toBe(false);
  const before=tournamentFlags(view({finalTable:false,playersLeft:10}));
  expect(tournamentMoment(before,tournamentFlags(view({playersLeft:9})),view({playersLeft:9}),money)?.title).toBe('Final table');
  const won=view({status:'complete',hero:null,result:{place:1,entrants:27,prize:50000,cost:12500,handsPlayed:300}});
  expect(tournamentMoment(tournamentFlags(view({})),tournamentFlags(won),won,money)).toEqual({kind:'win',title:'Champion',detail:'You won Daily $125 · $500.'});
 });
 it('stays quiet on the first look at an event',()=>{
  expect(tournamentMoment(null,tournamentFlags(view({playersLeft:4})),view({playersLeft:4}),money)).toBeNull();
 });
});

describe('patch 54 settings, tour, ring and light theme',()=>{
 it('defaults to the dark theme with vibration off and repairs bad values',()=>{
  expect(DEFAULT_STYLE.theme).toBe('dark');expect(DEFAULT_STYLE.vibrate).toBe(false);
  expect(normalizeStyle({theme:'neon',vibrate:1}).theme).toBe('dark');
  expect(styleClasses({...DEFAULT_STYLE,theme:'light'})).toContain(' theme-light');
 });
 it('vibrates only for your turn and wins, and never throws without support',()=>{
  expect(()=>vibrateFor(['turn','win','chip'])).not.toThrow();
 });
 it('shows the getting-started tour only before any hands, and remembers it was finished',()=>{
  expect(app).toContain("${played === 0 ? tourMarkup() : ''}");
  expect(app).toContain("localStorage.setItem(TOUR_KEY, 'done')");
  expect(app).toContain("const TOUR_KEY = 'poker-night-ai:welcome-tour';");
 });
 it('draws the thinking indicator for bots only, over the real delay, and hides it without motion (a bar since patch 60)',()=>{
  expect(app).toContain('active && id !== 0 && game && thinkFor?.token');
  expect(app).toContain('thinkFor = { token, ms: delay }');
  expect(app).toContain('<i class="think-bar" style="--think-ms:${thinkFor.ms}ms" aria-hidden="true"></i>');
  expect(css).toContain('.motion-off .think-bar{display:none}');
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.think-bar\{display:none\}/);
 });
 it('keeps the table look in the light theme',()=>{
  expect(css).toContain('.theme-light .table-scene,.theme-light .tournament-play .table-scene{color:#e8eae6}');
  expect(css).toMatch(/\.theme-light main \*:not\(\.table-scene,\.table-scene \*/);
 });
});
