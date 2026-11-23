/** Patch 65: your leak finder. Reads your saved hands only (your own cards, public actions, and cards shown
 * at showdown) and lists the spots where your play loses money most. Screen only.
 * The reference ranges are rough guides for solid live cash play, designed rather than fitted, so each
 * finding says how many hands it rests on and links to them. */
import type {Card,GameEvent,HeroViewModel} from '../contracts';
import type {StoredHand} from '../session/types';
import {heroPosition} from './cash';
import {handFeatures} from '../bots/features';

export interface HeroDecision {
 hand:StoredHand;event:GameEvent;frame:HeroViewModel;street:string;
 /** Chips to call (0 when Hero could check). */
 toCall:number;
 /** The pot before Hero acted, including this street's bets. */
 pot:number;bb:number;position:string;
 /** The player whose bet or raise Hero faces, if any. */
 villain:number|null;
 /** Preflop raises before this decision. */
 raisesBefore:number;
 /** Whether Hero made the first raise preflop. */
 heroOpened:boolean;
 hole:Card[];board:Card[];
}
const CARDS:Record<string,number>={preflop:0,flop:3,turn:4,river:5};
/** Every decision Hero made in a hand, with the exact view Hero had before acting. */
export function heroDecisions(hand:StoredHand):HeroDecision[] {
 const view=hand.view,frames=new Map(hand.frames.map(f=>[`${f.revision}:${f.actor}`,f])),out:HeroDecision[]=[];
 const hole=view.seats.find(s=>s.id===0)?.hole??[];if(hole.length!==2)return out;
 let street='',lastRaiser:number|null=null,preRaises=0,opener:number|null=null;
 for(const e of view.events){
  if(e.type!=='action'||!e.action)continue;
  const st=e.street??'preflop';if(st!==street){street=st;lastRaiser=null;}
  if(e.seatId===0){
   const frame=frames.get(`${e.revision-1}:0`);
   if(frame)out.push({hand,event:e,frame,street:st,toCall:frame.legal.callAmount,pot:frame.pot,bb:view.profile.bigBlind,position:heroPosition(view),
    villain:frame.legal.callAmount>0?lastRaiser:null,raisesBefore:preRaises,heroOpened:opener===0,hole:hole as Card[],board:view.board.slice(0,CARDS[st]??0) as Card[]});
  }
  if(e.action.type==='raise'){lastRaiser=e.seatId??null;if(st==='preflop'){if(preRaises===0)opener=e.seatId??null;preRaises++;}}
 }
 return out;
}
export interface Leak {
 id:string;title:string;finding:string;guide:string;
 /** Your result in the hands behind this leak, in big blinds. */
 bb:number;count:number;of:number;handIds:string[];
}
const pct=(a:number,b:number)=>Math.round(100*a/b);
const sumBB=(hands:Iterable<StoredHand>)=>{let t=0;for(const h of hands)t+=h.net/h.view.profile.bigBlind;return Math.round(t*10)/10;};
const ids=(hands:Iterable<StoredHand>)=>[...new Set([...hands].map(h=>h.id))];
/** In position against `villain` after the flop: Hero acts after them. */
function heroInPosition(view:HeroViewModel,villain:number):boolean {
 const order=(id:number)=>{const ids=view.seats.map(s=>s.id).sort((a,b)=>a-b),i=ids.indexOf(view.button);return (ids.indexOf(id)-i-1+ids.length)%ids.length;};
 return order(0)>order(villain);
}

/** The leaks in these hands, worst first. Hands of the same session or across sessions both work. */
export function findLeaks(hands:readonly StoredHand[]):Leak[] {
 const leaks:Leak[]=[],all=hands.filter(h=>h.view.street==='complete');
 const decisions=all.flatMap(heroDecisions);
 // River: facing a bet.
 const riverFacing=decisions.filter(d=>d.street==='river'&&d.toCall>0);
 const riverFolds=riverFacing.filter(d=>d.event.action?.type==='fold');
 if(riverFacing.length>=5&&riverFolds.length/riverFacing.length>=.6)leaks.push({id:'river-overfold',title:'You fold too often to river bets',
  finding:`You folded to ${riverFolds.length} of ${riverFacing.length} river bets (${pct(riverFolds.length,riverFacing.length)}%).`,
  guide:'Folding more than about half the time on the river lets players bluff you profitably. Call more often with hands that beat a bluff, especially against aggressive players.',
  bb:sumBB(new Set(riverFolds.map(d=>d.hand))),count:riverFolds.length,of:riverFacing.length,handIds:ids(riverFolds.map(d=>d.hand))});
 const riverCalls=riverFacing.filter(d=>d.event.action?.type==='call'),riverLost=riverCalls.filter(d=>d.hand.net<0);
 if(riverCalls.length>=5&&riverLost.length/riverCalls.length>=.7)leaks.push({id:'river-overcall',title:'You pay off river bets',
  finding:`You called ${riverCalls.length} river bets and lost ${riverLost.length} of them (${pct(riverLost.length,riverCalls.length)}%).`,
  guide:'When most of your river calls lose, those bets are mostly value. Against players who rarely bluff, fold your weaker one-pair hands.',
  bb:sumBB(new Set(riverCalls.map(d=>d.hand))),count:riverLost.length,of:riverCalls.length,handIds:ids(riverLost.map(d=>d.hand))});
 // Flop c-bets: facing the preflop raiser's first flop bet.
 const cbets=decisions.filter(d=>{if(d.street!=='flop'||d.toCall<=0||d.villain===null)return false;
  const pre=d.hand.view.events.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise').at(-1);
  const flopBets=d.hand.view.events.filter(e=>e.type==='action'&&e.street==='flop'&&e.action?.type==='raise'&&e.revision<d.event.revision);
  return pre?.seatId===d.villain&&flopBets.length===1;});
 const cbetFolds=cbets.filter(d=>d.event.action?.type==='fold');
 if(cbets.length>=6&&cbetFolds.length/cbets.length>=.65)leaks.push({id:'cbet-overfold',title:'You give up too easily on the flop',
  finding:`You folded to ${cbetFolds.length} of ${cbets.length} flop continuation bets (${pct(cbetFolds.length,cbets.length)}%).`,
  guide:'Many players bet the flop with any two cards. Folding two-thirds of the time or more hands them the pot; continue with pairs, draws and good overcards, and raise some.',
  bb:sumBB(new Set(cbetFolds.map(d=>d.hand))),count:cbetFolds.length,of:cbets.length,handIds:ids(cbetFolds.map(d=>d.hand))});
 // Calling 3-bets out of position.
 const facing3=decisions.filter(d=>d.street==='preflop'&&d.heroOpened&&d.raisesBefore===2&&d.toCall>0&&d.villain!==null);
 const oopCalls=facing3.filter(d=>d.event.action?.type==='call'&&!heroInPosition(d.hand.view,d.villain!));
 const oopBB=sumBB(new Set(oopCalls.map(d=>d.hand)));
 if(oopCalls.length>=3&&oopBB<0)leaks.push({id:'three-bet-oop',title:'You call 3-bets too wide out of position',
  finding:`You called ${oopCalls.length} of ${facing3.length} 3-bets out of position and lost ${Math.abs(oopBB)} big blinds in those hands.`,
  guide:'Out of position after a 3-bet, calling with medium hands is costly. 4-bet your best hands, call only strong suited or paired hands, and fold the rest.',
  bb:oopBB,count:oopCalls.length,of:facing3.length,handIds:ids(oopCalls.map(d=>d.hand))});
 // Preflop looseness and limping.
 const pre=all.map(h=>({h,acts:h.view.events.filter(e=>e.type==='action'&&e.street==='preflop'&&e.seatId===0)}));
 const vpip=pre.filter(x=>x.acts.some(e=>(e.action?.type==='call'||e.action?.type==='raise')&&(e.amount??0)>0));
 if(all.length>=30){
  const rate=vpip.length/all.length,lost=vpip.filter(x=>x.h.net<0).map(x=>x.h);
  if(rate>=.4)leaks.push({id:'too-loose',title:'You play too many hands',finding:`You put money in before the flop in ${vpip.length} of ${all.length} hands (${pct(vpip.length,all.length)}%).`,
   guide:'Around 20–30% is typical for a solid six-handed player. Cut the weakest calls first: offsuit hands out of position and calls of raises with small cards.',bb:sumBB(vpip.map(x=>x.h)),count:vpip.length,of:all.length,handIds:ids(lost).slice(-30)});
  else if(rate<=.13)leaks.push({id:'too-tight',title:'You play too few hands',finding:`You put money in before the flop in only ${vpip.length} of ${all.length} hands (${pct(vpip.length,all.length)}%).`,
   guide:'The blinds keep coming. Open more hands from the cutoff and button, and defend your big blind against small raises.',bb:sumBB(all),count:vpip.length,of:all.length,handIds:ids(vpip.map(x=>x.h)).slice(-30)});
 }
 const limps=decisions.filter(d=>d.street==='preflop'&&d.raisesBefore===0&&d.event.action?.type==='call'&&d.position!=='BB');
 if(all.length>=20&&limps.length>=3&&limps.length/all.length>=.06)leaks.push({id:'limping',title:'You limp into pots',
  finding:`You just called the blind first in ${limps.length} times.`,guide:'Limping lets the blinds in cheaply and gives up the initiative. Raise the hands you want to play, or fold them.',
  bb:sumBB(new Set(limps.map(d=>d.hand))),count:limps.length,of:all.length,handIds:ids(limps.map(d=>d.hand))});
 // Big blind against steals.
 const steals=decisions.filter(d=>d.street==='preflop'&&d.position==='BB'&&d.raisesBefore===1&&d.villain!==null&&['CO','BTN','SB'].includes(positionOf(d.hand.view,d.villain))&&d.toCall<=3*d.bb);
 const stealFolds=steals.filter(d=>d.event.action?.type==='fold');
 if(steals.length>=5&&stealFolds.length/steals.length>=.75)leaks.push({id:'blind-overfold',title:'You give up your big blind too often',
  finding:`You folded your big blind to ${stealFolds.length} of ${steals.length} late-position raises (${pct(stealFolds.length,steals.length)}%).`,
  guide:'Against a small raise from the cutoff, button or small blind you already have a blind in and get a good price. Defend with most suited hands, pairs and connected cards.',
  bb:sumBB(new Set(stealFolds.map(d=>d.hand))),count:stealFolds.length,of:steals.length,handIds:ids(stealFolds.map(d=>d.hand))});
 // Passive after the flop.
 const post=decisions.filter(d=>d.street!=='preflop'),aggressive=post.filter(d=>d.event.action?.type==='raise'),calls=post.filter(d=>d.event.action?.type==='call');
 if(calls.length>=10&&aggressive.length/calls.length<.6)leaks.push({id:'passive',title:'You call much more than you bet',
  finding:`After the flop you called ${calls.length} times and bet or raised only ${aggressive.length} times.`,
  guide:'Calling wins only at showdown; betting also wins when they fold. Bet your strong hands and good draws instead of calling with them.',
  bb:sumBB(new Set(calls.map(d=>d.hand))),count:aggressive.length,of:calls.length,handIds:ids(calls.map(d=>d.hand)).slice(-30)});
 // Chasing draws at a bad price on the turn.
 const chases=decisions.filter(d=>d.street==='turn'&&d.toCall>0&&d.event.action?.type==='call'&&d.board.length===4&&(()=>{const f=handFeatures(d.hole,d.board);return f.strength<.35&&f.draw>=.25;})()&&d.toCall/(d.pot+d.toCall)>.24);
 const chaseBB=sumBB(new Set(chases.map(d=>d.hand)));
 if(chases.length>=3&&chaseBB<0)leaks.push({id:'chasing',title:'You chase draws at a bad price',
  finding:`You called ${chases.length} turn bets with only a draw when the price was worse than your chance to hit.`,
  guide:'A flush or open-ended straight draw hits the river about 1 time in 5. Call when the bet is small next to the pot; otherwise raise as a semi-bluff or fold.',
  bb:chaseBB,count:chases.length,of:chases.length,handIds:ids(chases.map(d=>d.hand))});
 // Big pots lost with one pair.
 const onePair=all.filter(h=>Object.hasOwn(h.view.handLabels,0)&&h.net/h.view.profile.bigBlind<=-40&&/^(Pair of|[A-Za-z]+ high$)/.test(h.view.handLabels[0]??''));
 if(onePair.length>=2)leaks.push({id:'one-pair-big-pots',title:'You lose big pots with one pair',
  finding:`${onePair.length} times you lost 40 big blinds or more at showdown with one pair or less.`,
  guide:'One pair is rarely good in a big pot. When the betting gets large on the turn and river, slow down unless the player bluffs a lot.',
  bb:sumBB(onePair),count:onePair.length,of:onePair.length,handIds:ids(onePair)});
 // Tilt: looser play right after a big loss.
 const sorted=[...all].sort((a,b)=>a.number-b.number),after:StoredHand[]=[];
 sorted.forEach((h,i)=>{if(h.net/h.view.profile.bigBlind<=-50)after.push(...sorted.slice(i+1,i+11));});
 const afterSet=[...new Set(after)];
 if(afterSet.length>=8&&all.length>=30){
  const v=(list:readonly StoredHand[])=>list.filter(h=>vpip.some(x=>x.h===h)).length/list.length,gap=v(afterSet)-v(all);
  if(gap>=.15)leaks.push({id:'tilt',title:'You loosen up after a big loss',
   finding:`In the 10 hands after losing 50 big blinds or more, you played ${pct(v(afterSet)*afterSet.length,afterSet.length)}% of hands, against ${pct(vpip.length,all.length)}% overall.`,
   guide:'Big losses push most people into chasing them back. After one, tighten up for a few orbits or take a short break.',
   bb:sumBB(afterSet),count:afterSet.length,of:afterSet.length,handIds:ids(afterSet)});
 }
 return leaks.sort((a,b)=>a.bb-b.bb);
}
/** Position name for any seat, the same names as heroPosition. */
export function positionOf(view:HeroViewModel,seat:number):string {
 if(view.seats.length===2)return view.button===seat?'BTN/SB':'BB';
 if(view.button===seat)return 'BTN';if(view.smallBlindSeat===seat)return 'SB';if(view.bigBlindSeat===seat)return 'BB';
 const ids=view.seats.map(s=>s.id).sort((a,b)=>a-b),i=ids.indexOf(view.bigBlindSeat);
 const others=[...ids.slice(i+1),...ids.slice(0,i+1)].filter(id=>![view.button,view.smallBlindSeat,view.bigBlindSeat].includes(id));
 const index=others.indexOf(seat),fromEnd=others.length-index;
 if(fromEnd===1)return 'CO';if(fromEnd===2)return 'HJ';if(fromEnd===3)return 'LJ';
 return index===0?'UTG':`UTG+${index}`;
}

/** Patch 66: the measures behind the leaks, for one group of hands (a session), so they can be tracked
 * over time. Null when there are too few spots to say. Targets are the same rough guides as the leaks. */
export interface LeakMetric {id:string;label:string;value:number|null;n:number;low:number;high:number;help:string}
export const METRIC_TARGETS:readonly Omit<LeakMetric,'value'|'n'>[]=[
 {id:'vpip',label:'Hands played',low:20,high:30,help:'Share of hands you put money in before the flop.'},
 {id:'river-fold',label:'Folds to river bets',low:35,high:55,help:'Share of river bets you folded to.'},
 {id:'cbet-fold',label:'Folds to flop c-bets',low:35,high:55,help:'Share of flop continuation bets you folded to.'},
 {id:'bb-fold',label:'Big blind folds to steals',low:40,high:60,help:'Share of late-position raises you folded your big blind to.'},
 {id:'aggression',label:'Bets and raises after the flop',low:40,high:60,help:'Bets and raises as a share of your bets, raises and calls after the flop.'},
 {id:'limp',label:'Limps',low:0,high:3,help:'Times you called the blind first in, per 100 hands.'},
];
export function leakMetrics(hands:readonly StoredHand[]):LeakMetric[] {
 const all=hands.filter(h=>h.view.street==='complete'),d=all.flatMap(heroDecisions);
 const riverFacing=d.filter(x=>x.street==='river'&&x.toCall>0),riverFold=riverFacing.filter(x=>x.event.action?.type==='fold').length;
 const cbets=d.filter(x=>{if(x.street!=='flop'||x.toCall<=0||x.villain===null)return false;
  const pre=x.hand.view.events.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise').at(-1);
  return pre?.seatId===x.villain&&x.hand.view.events.filter(e=>e.type==='action'&&e.street==='flop'&&e.action?.type==='raise'&&e.revision<x.event.revision).length===1;});
 const cbetFold=cbets.filter(x=>x.event.action?.type==='fold').length;
 const steals=d.filter(x=>x.street==='preflop'&&x.position==='BB'&&x.raisesBefore===1&&x.villain!==null&&['CO','BTN','SB'].includes(positionOf(x.hand.view,x.villain))&&x.toCall<=3*x.bb);
 const stealFold=steals.filter(x=>x.event.action?.type==='fold').length;
 const post=d.filter(x=>x.street!=='preflop'),agg=post.filter(x=>x.event.action?.type==='raise').length,calls=post.filter(x=>x.event.action?.type==='call').length;
 const vpip=all.filter(h=>h.view.events.some(e=>e.type==='action'&&e.street==='preflop'&&e.seatId===0&&(e.action?.type==='call'||e.action?.type==='raise')&&(e.amount??0)>0)).length;
 const limps=d.filter(x=>x.street==='preflop'&&x.raisesBefore===0&&x.event.action?.type==='call'&&x.position!=='BB').length;
 const rate=(a:number,b:number,min:number)=>b>=min?Math.round(100*a/b):null;
 const values:Record<string,[number|null,number]>={vpip:[rate(vpip,all.length,15),all.length],'river-fold':[rate(riverFold,riverFacing.length,3),riverFacing.length],
  'cbet-fold':[rate(cbetFold,cbets.length,3),cbets.length],'bb-fold':[rate(stealFold,steals.length,3),steals.length],aggression:[rate(agg,agg+calls,5),agg+calls],limp:[rate(limps,all.length,15),all.length]};
 return METRIC_TARGETS.map(t=>({...t,value:values[t.id][0],n:values[t.id][1]}));
}
/** Each measure across sessions, oldest first: one point per session with enough spots. */
export function leakTrends(hands:readonly StoredHand[],sessions:readonly {id:string;startedAt:string}[],limit=10):{metric:Omit<LeakMetric,'value'|'n'>;points:{sessionId:string;startedAt:string;value:number;n:number}[]}[] {
 const per=sessions.map(s=>({s,m:leakMetrics(hands.filter(h=>h.sessionId===s.id))}));
 return METRIC_TARGETS.map((metric,i)=>({metric,points:per.flatMap(({s,m})=>m[i].value===null?[]:[{sessionId:s.id,startedAt:s.startedAt,value:m[i].value!,n:m[i].n}]).slice(-limit)}));
}
