import {describe,it,expect} from 'vitest';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {Action,BotObservation,BotProfile,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {pushFold,pushRange,chartBend} from '../../src/tournament/push-fold';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V27,TOURNAMENT_POLICY_V28} from '../../src/tournament/bot-policy';
import {chooseTournamentV2,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {contestablePricing} from '../../src/bots/pricing';
import {humanSizing,moodFrom,moodProfile,stackMood} from '../../src/bots/human';
import {readsProfile} from '../../src/bots/reads';
import {emptyPlayerRead,tableReadsProfile,isolate,answerRaise,type PlayerRead} from '../../src/bots/table-reads';
import {habitsOf,applyHabits,applyMinRaise} from '../../src/bots/habits';
const profile=regularProfile('hiro','high');
const rule:RuleProfile={id:'independent54',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const start=(stacks:number[],id='independent54')=>startHand({handId:id,button:0,profile:rule,seats:stacks.map((stack,id)=>({id,name:`P${id}`,stack}))});
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`a:${g.revision}`,action});
const view=(g:GameState)=>({...observeBot(g,g.actor!,profile.policyVersion,'pf'),ownCards:['As','Ad']});
function versusShove(){let g=start([4000,8000,600,8000]);g=act(g,{type:'fold'});g=act(g,{type:'raise',to:4000});g=act(g,{type:'fold'});return view(g);}
function rows(){const r=emptyPlayerRead();r.hands=40;r.vpip={count:30,chances:40};r.pfr={count:20,chances:40};r.limp={count:10,chances:40};r.reads.hands=40;return {0:r};}
// Frozen Version53 2.7 dispatch, including numeric-read fingerprint and draw consumption.
function frozen27(o:BotObservation,p:BotProfile,random:()=>number,st:TournamentContext,reads:Record<number,PlayerRead>){
 const own=o.seats.find(s=>s.id===o.actingSeat)!,total=own.stack+own.totalCommitted,average=st.stacks.reduce((a,b)=>a+b,0)/st.playersLeft;
 const mood={...moodFrom([],p),...stackMood(total/o.bigBlind,total/average)},read=readsProfile(o,moodProfile(p,mood),null),table=tableReadsProfile(o,read.profile,reads),d=chooseTournamentV2(o,table.profile,random,st,true,true);
 const hash=`${TOURNAMENT_POLICY_V27}:${d.observationHash.slice(d.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}/${(mood.desperate??0).toFixed(3)}/${(mood.bigStack??0).toFixed(3)}:${read.effect?.applied.join('+')??'-'}`;
 const habits=habitsOf(p,regularHabitsForProfile(p)),habit=applyHabits(o,p,d.action,habits,random),iso=isolate(o,p,habit.action,reads,random),answer=answerRaise(o,p,iso.action,reads,random),seen=table.effect?`${table.effect.target}/${table.effect.type}/${table.effect.applied.join('+')}`:'-';
 const text=JSON.stringify(Object.entries(reads).sort(([a],[b])=>Number(a)-Number(b)).map(([seat,r])=>[Number(seat),r.hands,[r.vpip.count,r.vpip.chances],[r.pfr.count,r.pfr.chances],[r.limp.count,r.limp.chances],r.reads.hands,...(['foldBlinds','foldToCbet','foldTo3bet','callAllIn','shortShove','aggression','wtsd'] as const).map(k=>[r.reads[k].count,r.reads[k].chances])]));
 return {...d,observationHash:`${hash}:${habit.habit??'-'}:${seen}:${iso.isolated?'iso':answer.play??'-'}:table:${bytesToHex(sha256(new TextEncoder().encode(text)))}`,action:applyMinRaise(o,humanSizing(o,p,answer.action,random),habits,random).action};
}

describe('independent push/fold exposure and compatibility',()=>{
 it('dead ante is sunk money, not extra stack depth; prior limpers still respond to a shove',()=>{
  let g=start([8000,8000,3200,8000]);g=act(g,{type:'call'});g=act(g,{type:'fold'});g=act(g,{type:'call'});
  const o=view(g);expect(o.actingSeat).toBe(2);const result=pushFold(o,profile,undefined,()=>0)!;
  expect(result).not.toBeNull();expect(result.action.type).toBe('raise');expect(()=>act(g,result.action)).not.toThrow();
  expect(result.range).toBeCloseTo(pushRange(15,2,true)*.8**2*chartBend(profile),10);
  const withoutDead=structuredClone(o),own=withoutDead.seats.find(s=>s.id===2)!;own.totalCommitted-=own.deadAnte!;own.deadAnte=0;
  expect(pushFold(withoutDead,profile,undefined,()=>0)).toEqual(result);
 });
 it('unwinnable side-pot and unmatched excess never improve the capped callers price',()=>{
  const o=versusShove(),folded=o.seats.find(s=>s.id===1)!;
  // Construct two public contribution projections with the same reachable main pot.
  o.pot+=300;folded.totalCommitted=400;folded.streetCommitted=400;
  const excess=structuredClone(o);excess.seats.find(s=>s.id===1)!.totalCommitted+=6000;excess.seats.find(s=>s.id===1)!.streetCommitted+=6000;excess.pot+=6000;
  expect(contestablePricing(o).callAmount).toBe(200);expect(contestablePricing(o).contestableAfterCall).toBe(1400);
  expect(contestablePricing(excess).price).toBe(contestablePricing(o).price);
  expect(pushFold(excess,profile,undefined,()=>0)).toEqual(pushFold(o,profile,undefined,()=>0));
 });
 it('a deep player behind prevents a nominally short-opener re-shove',()=>{
  let g=start([4000,40000,40000,8000]);g=act(g,{type:'fold'});g=act(g,{type:'raise',to:440});
  const sb=view(g);expect(pushFold(sb,profile,undefined,()=>0)).toBeNull();
  g=act(g,{type:'fold'});const bb=view(g),decision=pushFold(bb,profile,undefined,()=>0)!;
  expect(decision.play).toBe('reshove');expect(()=>act(g,decision.action)).not.toThrow();
 });
 it('final-table pressure uses player IDs rather than guessing by equal chip counts',()=>{
  let g=start([2000,10000,3000,1000]);g=act(g,{type:'fold'});g=act(g,{type:'raise',to:2000});g=act(g,{type:'fold'});const o=view(g);
  const st:TournamentContext={playersLeft:4,paid:3,stacks:[1000,2000,10000,3000],prizes:[5000,3000,2000],playerIds:[55,10,25,40],seatPlayers:{0:10,1:25,2:40,3:55}};
  const mapped=pushFold(o,profile,st,()=>0)!,noPrize=pushFold(o,profile,{...st,prizes:undefined},()=>0)!;
  expect(mapped.range).not.toBe(noPrize.range);
  const reordered={...st,stacks:[3000,10000,2000,1000],playerIds:[40,25,10,55]};const same=pushFold(o,profile,reordered,()=>0)!;expect(same.action).toEqual(mapped.action);expect(same.range).toBeCloseTo(mapped.range,12);
 });
 it('new push/fold decisions retain the complete numeric public-read fingerprint',()=>{
  let g=start([2000,8000,8000,8000]);g=act(g,{type:'fold'});const o=view(g),a=rows(),b=structuredClone(a);b[0].vpip.count--;
  const st={playersLeft:20,paid:3,stacks:Array(20).fill(8000)};
  const choose=(r:Record<number,PlayerRead>)=>chooseTournamentDecision(o,profile,seedStream(5),TOURNAMENT_POLICY_V28,st,[],null,r);
  expect(choose(a).observationHash).toContain(':pf:');expect(choose(a).observationHash).not.toBe(choose(b).observationHash);
  Object.defineProperty(a[0],'privateCards',{enumerable:true,get(){throw Error('Private data read');}});expect(()=>choose(a)).not.toThrow();
 });
 it('old 2.7 exact decisions, hashes and random consumption survive complete hands',()=>{
  let count=0;
  for(const id of ['hiro','dot','priya'])for(let seed=0;seed<3;seed++){
   const p=regularProfile(id,'high');let g=start([2000,5000,3000,10000],`legacy54:${id}:${seed}`);const st={playersLeft:20,paid:3,stacks:Array(20).fill(5000)};
   for(let i=0;g.street!=='complete'&&i<200;i++){
    const o=observeBot(g,g.actor!,p.policyVersion,`d:${i}`),a=seedStream(seed*100+i),b=seedStream(seed*100+i),reads=rows();
    const actual=chooseTournamentDecision(o,p,a,TOURNAMENT_POLICY_V27,st,[],null,reads);expect(actual).toEqual(frozen27(o,p,b,st,reads));expect(a()).toBe(b());g=applyCommand(g,actual);count++;
   }expect(g.street).toBe('complete');
  }expect(count).toBeGreaterThan(30);
 });
});
