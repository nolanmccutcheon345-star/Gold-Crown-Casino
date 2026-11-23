/** Signature leaks (cash layer human-1.12.0, tournament policy 2.15.0). Real players are not just
 * looser or tighter versions of each other: most have one or two lasting flaws that show up in the
 * same spots, hand after hand, and that an observant opponent can exploit. Each computer player gets
 * one or two leaks, fixed for its personality (the named regulars have hand-picked ones). How often a
 * leak shows in its spot falls with skill: a weak player shows it most of the time, a strong one now
 * and then. Designed, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {seatsFromButton} from './preflop';
import {regularProfile} from './regulars';

export type Leak='overpair-love'|'pays-off-rivers'|'scared-money'|'draw-chaser'|'auto-cbet'|'slowplays-monsters'|'river-bluffer'|'one-and-done';
export const LEAKS:readonly Leak[]=Object.freeze(['overpair-love','pays-off-rivers','scared-money','draw-chaser','auto-cbet','slowplays-monsters','river-bluffer','one-and-done']);
/** What an observant player would say about the leak. */
export const LEAK_READS:Readonly<Record<Leak,string>>=Object.freeze({
 'overpair-love':'Never folds an overpair or top pair, however big the bet.',
 'pays-off-rivers':'Calls river bets with any pair.',
 'scared-money':'Folds medium hands to big turn and river bets.',
 'draw-chaser':'Calls with any draw, whatever the price.',
 'auto-cbet':'Bets every flop after raising before it.',
 'slowplays-monsters':'Checks and calls with very strong hands.',
 'river-bluffer':'Bluffs missed draws on the river when checked to.',
 'one-and-done':'Bets the flop, then gives up on the turn without a hand.',
});
/** Hand-picked leaks for the named regulars, matching their written reads. */
export const REGULAR_LEAKS:Readonly<Record<string,readonly Leak[]>>=Object.freeze({
 'big-earl':['pays-off-rivers','draw-chaser'],nina:['slowplays-monsters'],marco:['river-bluffer'],dot:['pays-off-rivers'],vince:['river-bluffer','auto-cbet'],
 priya:['auto-cbet'],hank:['scared-money'],tess:['slowplays-monsters'],rocco:['one-and-done','scared-money'],lena:['river-bluffer'],gus:['overpair-love'],
 mei:['overpair-love'],duke:['auto-cbet'],sal:['pays-off-rivers','overpair-love'],ruth:['scared-money'],theo:['auto-cbet'],ivy:['draw-chaser'],
 frank:['river-bluffer','overpair-love'],ana:['one-and-done'],walt:['pays-off-rivers'],bubba:['draw-chaser','pays-off-rivers'],rosie:['pays-off-rivers','draw-chaser'],
 tex:['draw-chaser','river-bluffer'],gloria:['scared-money','slowplays-monsters'],mikey:['one-and-done'],lou:['scared-money'],kenny:['overpair-love'],
 dante:['auto-cbet'],yuki:['river-bluffer'],brenda:['overpair-love'],omar:['one-and-done'],pete:['draw-chaser','river-bluffer'],carla:['scared-money'],
 jules:['one-and-done','pays-off-rivers'],viktor:['river-bluffer'],sasha:['auto-cbet'],hiro:['overpair-love'],elena:['auto-cbet'],monty:['overpair-love','draw-chaser'],
 nadia:['pays-off-rivers'],
});
/** The leak line shown with a named regular's read. */
export function leakRead(regularId:string):string {const l=REGULAR_LEAKS[regularId];return l?.length?`Leak: ${l.map(x=>LEAK_READS[x].replace(/\.$/,'').replace(/^./,c=>c.toLowerCase())).join('; ')}.`:'';}
/** Which leaks suit which kind of player (relative weights). */
const FIT:Readonly<Record<string,Partial<Record<Leak,number>>>>={
 nit:{'scared-money':4,'slowplays-monsters':3,'overpair-love':2,'one-and-done':1},
 station:{'pays-off-rivers':4,'draw-chaser':4,'overpair-love':2,'slowplays-monsters':1},
 tag:{'auto-cbet':3,'overpair-love':3,'one-and-done':2,'river-bluffer':1,'slowplays-monsters':1},
 lag:{'river-bluffer':3,'auto-cbet':3,'draw-chaser':2,'overpair-love':1},
 'fit-or-fold':{'one-and-done':4,'scared-money':3,'auto-cbet':2},
 maniac:{'river-bluffer':4,'draw-chaser':3,'overpair-love':2,'auto-cbet':2},
 'passive-reg':{'pays-off-rivers':3,'overpair-love':3,'scared-money':2,'slowplays-monsters':2},
 'stronger-reg':{'auto-cbet':2,'overpair-love':2,'river-bluffer':2,'one-and-done':2},
};
function hash(text:string):number {let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
/** The player's leaks: hand-picked for a named regular, otherwise one or two drawn from the player's
 * type, fixed by its personality id (or its numbers, for profiles without one). Weaker players more
 * often have two. */
export function leaksOf(profile:BotProfile,regularId?:string|null):Leak[] {
 if(regularId&&REGULAR_LEAKS[regularId]){
  const actual=completeProfile(profile),expected=completeProfile(regularProfile(regularId,profile.environment??'neutral'));
  const same=(a:unknown,b:unknown):boolean=>{if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>same(x[k],y[k]));}return a===b;};
  if(same(actual,expected))return [...REGULAR_LEAKS[regularId]];
 }
 const p=completeProfile(profile),fit=FIT[p.archetype]??FIT.tag,key=p.personalityId??`${p.archetype}:${p.aggression.toFixed(4)}:${p.looseness.toFixed(4)}:${p.skill.toFixed(4)}`;
 let h=hash(key);const next=()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;};
 const pick=(exclude:Leak[]):Leak=>{const pool=(Object.entries(fit) as [Leak,number][]).filter(([l])=>!exclude.includes(l)),total=pool.reduce((s,[,w])=>s+w,0);let r=next()*total;for(const [l,w] of pool){r-=w;if(r<0)return l;}return pool.at(-1)![0];};
 const first=pick([]);return next()<clamp(.75-.8*p.skill,.1,.6)?[first,pick([first])]:[first];
}
/** How often the leak shows when its spot comes up: most of the time for weak players, now and then for strong ones. */
export function leakStrength(profile:BotProfile):number {const p=completeProfile(profile);return clamp(.2+.7*(1-p.skill),.2,.85);}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const acts=(o:BotObservation,street?:string)=>o.publicEvents.filter(e=>e.type==='action'&&(street===undefined||e.street===street));
function bet(o:BotObservation,fraction:number):Action|null {
 if(!o.legal.canRaise)return null;const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*fraction)/u)*u;
 return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))};
}
/** Apply the player's leaks to the chosen action. The first leak whose spot this is decides. */
export function leakPlay(o:BotObservation,profile:BotProfile,action:Action,leaks:readonly Leak[],random:()=>number):{action:Action;play:Leak|null} {
 const keep={action,play:null as Leak|null};
 if(o.street==='preflop'||!o.ownCards||o.ownCards.length!==2||!leaks.length)return keep;
 const f=handFeatures(o.ownCards,o.board),facing=!o.legal.check&&o.legal.callAmount>0,betSize=facing?o.legal.callAmount/Math.max(1,o.pot-o.legal.callAmount):0;
 const pre=acts(o,'preflop').filter(e=>e.action?.type==='raise'),pfr=pre.at(-1)?.seatId,here=acts(o,o.street),noBet=o.legal.check;
 const responders=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn),others=responders.filter(s=>s.id!==o.actingSeat);
 const checkedTo=responders.at(-1)?.id===o.actingSeat&&others.length>0&&here.length===others.length&&new Set(here.map(e=>e.seatId)).size===others.length&&others.every(s=>here.some(e=>e.seatId===s.id&&e.action?.type==='check'));
 const missedDraw=o.street==='river'&&handFeatures(o.ownCards,o.board.slice(0,4)).draw>=.3;
 const live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length,own=o.seats.find(s=>s.id===o.actingSeat)!,strength=leakStrength(profile);
 const show=(l:Leak,result:Action|null):{action:Action;play:Leak|null}|null=>result&&draw(random)<strength?{action:result,play:l}:null;
 for(const leak of leaks){
  let r:{action:Action;play:Leak|null}|null=null;
  switch(leak){
   case 'overpair-love':
    if(facing&&action.type==='fold'&&(f.handClass==='overpair'||(f.handClass==='top-pair'&&f.strength>=.5)))r=show(leak,{type:'call'});break;
   case 'pays-off-rivers':
    if(o.street==='river'&&facing&&action.type==='fold'&&f.made&&f.strength>=.25&&!f.playsBoard)r=show(leak,{type:'call'});break;
   case 'scared-money':
    if(o.street!=='flop'&&facing&&action.type==='call'&&betSize>=.7&&!f.absoluteNuts&&f.strength<.6&&f.draw<.3)r=show(leak,{type:'fold'});break;
   case 'draw-chaser':
    if(o.street!=='river'&&facing&&action.type==='fold'&&f.draw>=.3&&o.legal.callAmount<=Math.max(o.pot,own.stack*.35))r=show(leak,{type:'call'});break;
   case 'auto-cbet':
    if(o.street==='flop'&&noBet&&action.type==='check'&&pfr===o.actingSeat&&live<=2&&!here.some(e=>e.action?.type==='raise'))r=show(leak,bet(o,.5));break;
   case 'slowplays-monsters':
    if(o.street!=='river'&&f.made&&!f.playsBoard&&f.strength>=.8&&action.type==='raise'&&action.to<o.legal.maxRaiseTo!)r=show(leak,noBet?{type:'check'}:{type:'call'});break;
   case 'river-bluffer':
    if(o.street==='river'&&noBet&&action.type==='check'&&live===1&&!f.made&&f.strength<.35&&checkedTo&&missedDraw)r=show(leak,bet(o,.7));break;
   case 'one-and-done':{
    const betFlop=acts(o,'flop').some(e=>e.seatId===o.actingSeat&&e.action?.type==='raise');
    if(o.street==='turn'&&betFlop&&noBet&&action.type==='raise'&&f.strength<.5&&f.draw<.3)r=show(leak,{type:'check'});
    else if(o.street==='turn'&&betFlop&&facing&&action.type==='call'&&!f.absoluteNuts&&f.strength<.45&&f.draw<.3&&draw(random)<.5)r=show(leak,{type:'fold'});
    break;}
  }
  if(r)return r;
 }
 return keep;
}
