import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {allInSpotlight,rivalsOf,sessionRecap,sparkline,stackBaselines,stackTrend} from '../../src/ui/recap';
import {DEFAULT_STYLE,normalizeStyle} from '../../src/ui/table-style';
import type {HeroViewModel} from '../../src/contracts';
import type {AppData,StoredHand} from '../../src/session/types';

const app=readFileSync('src/ui/app.ts','utf8');
type S={id:number;name:string;start:number;end:number;folded?:boolean;allIn?:boolean;paid?:number;committed?:number};
function hand(number:number,seats:S[],opts:{label?:string;board?:number}={},sessionId='s1'):StoredHand {
 const hero=seats.find(s=>s.id===0)!;
 return {id:`h${number}`,sessionId,number,net:hero.end-hero.start,view:{handId:`h${number}`,street:'complete',actor:null,board:Array(opts.board??5).fill('2c'),profile:{bigBlind:200},
  handLabels:opts.label?{0:opts.label}:{},payouts:Object.fromEntries(seats.filter(s=>s.paid).map(s=>[s.id,s.paid])),
  seats:seats.map(s=>({id:s.id,name:s.name,startingStack:s.start,stack:s.end,folded:!!s.folded,allIn:!!s.allIn,totalCommitted:s.committed??1}))}} as unknown as StoredHand;
}
const data=(hands:StoredHand[]):AppData=>({hands} as unknown as AppData);

describe('patch 57 session recap',()=>{
 const hands=[
  hand(1,[{id:0,name:'You',start:30000,end:35000,paid:10000},{id:1,name:'Riley',start:30000,end:25000}],{label:'Two pair, aces and kings'}),
  hand(2,[{id:0,name:'You',start:35000,end:33000,folded:true},{id:1,name:'Riley',start:25000,end:25600,paid:4000},{id:2,name:'Casey',start:30000,end:31400,paid:2000}],{board:0}),
  hand(3,[{id:0,name:'You',start:33000,end:33000,folded:true},{id:1,name:'Riley',start:25600,end:25600}]),
 ];
 it('counts pots and showdowns, and finds the biggest swings and key hands',()=>{
  const r=sessionRecap(data(hands),'s1')!;
  expect(r).toMatchObject({hands:3,won:1,showdowns:1,showdownsWon:1});
  expect(r.biggestWin).toMatchObject({number:1,net:5000,label:'Two pair, aces and kings'});
  expect(r.biggestLoss).toMatchObject({number:2,net:-2000,label:'Folded preflop'});
  expect(r.keyHands.map(h=>h.number)).toEqual([1,2]);
  expect(r.curve).toEqual([0,5000,3000,3000]);
 });
 it('splits each result between the opponents it came from, rounded to the dollar',()=>{
  const rivals=rivalsOf(hands);
  expect(rivals).toEqual([{name:'Riley',net:3700},{name:'Casey',net:-700}]);
 });
 it('returns nothing for a session with no saved hands',()=>{
  expect(sessionRecap(data(hands),'other')).toBeNull();
 });
 it('draws a sparkline only with two or more points',()=>{
  expect(sparkline([0])).toBe('');expect(sparkline([0,5,-3])).toContain('<polyline');
 });
 it('links each key hand to its replay in History',()=>{
  expect(app).toContain('data-recap-hand="${escape(h.id)}"');
  expect(app).toContain("replayId = button.dataset.recapHand!; replayFrame = 0; view = 'study';");
  expect(app).toContain('Partial recap: ${r.hands} of ${expectedHands} hands are currently loaded');
 });
});

describe('patch 57 all-in spotlight',()=>{
 const v=(seats:Partial<{folded:boolean;allIn:boolean;totalCommitted:number}>[],street='river',actor:number|null=null)=>({street,actor,seats:seats.map((s,id)=>({id,folded:false,allIn:false,totalCommitted:100,...s}))}) as unknown as HeroViewModel;
 it('lights up once an all-in is called and no decisions remain, or at settlement',()=>{
  expect(allInSpotlight(v([{allIn:true},{},{folded:true}]))).toBe(true);
  expect(allInSpotlight(v([{allIn:true},{}],'complete',null))).toBe(true);
 });
 it('stays off while someone still has to act, with one player left, or with no all-in',()=>{
  expect(allInSpotlight(v([{allIn:true},{}],'flop',1))).toBe(false);
  expect(allInSpotlight(v([{allIn:true},{folded:true}]))).toBe(false);
  expect(allInSpotlight(v([{},{}]))).toBe(false);
  expect(allInSpotlight(null)).toBe(false);
 });
});

describe('patch 57 stack trend arrows',()=>{
 it('use the first saved stack for the same player in the same seat',()=>{
  const base=stackBaselines(data([hand(2,[{id:0,name:'You',start:20000,end:20000},{id:1,name:'Ann',start:9000,end:9000}]),hand(1,[{id:0,name:'You',start:30000,end:30000},{id:1,name:'Bob',start:30000,end:30000}])]),'s1');
  expect(base.get('0:You')).toBe(30000);expect(base.get('1:Bob')).toBe(30000);expect(base.get('1:Ann')).toBe(9000);
 });
 it('show only after ten big blinds of movement',()=>{
  expect(stackTrend(32000,30000,200)).toBe('up');expect(stackTrend(31999,30000,200)).toBe('');
  expect(stackTrend(28000,30000,200)).toBe('down');expect(stackTrend(28000,undefined,200)).toBe('');
 });
 it('are on by default, can be turned off, and are announced to screen readers',()=>{
  expect(DEFAULT_STYLE.trends).toBe(true);expect(normalizeStyle({trends:false}).trends).toBe(false);
  expect(app).toContain('<span class="sr-only">, ${trend} this session</span>');
 });
});
