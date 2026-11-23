/** Patch 66: the leak finder and spot drills for tournaments. Tournament hands are read the same way as cash
 * hands (your cards, public actions, cards shown at showdown), plus tournament checks: missed all-in shoves when
 * short, calling all-ins too light, and passing up steals once the antes start. The shove and call lines are
 * the same push/fold chart the computer players use; rough guides, not an ICM calculation. Screen only. */
import type {Card} from '../contracts';
import type {StoredHand} from '../session/types';
import type {TournamentEvent} from '../tournament/runtime';
import {allHeroHands} from '../tournament/mtt-event';
import {tournamentGameView} from '../tournament/runtime';
import {replayTournamentHand} from '../core/engine';
import {handRank,pushRange,callRange} from '../tournament/push-fold';
import {heroDecisions,findLeaks,positionOf,type HeroDecision,type Leak} from './leaks';
import type {Drill} from './drills';

const cache=new WeakMap<object,StoredHand>();
/** Hero's dealt hands in an event, shaped like saved cash hands so the same readers work. */
export function tournamentCoachHands(event:TournamentEvent):StoredHand[] {
 return allHeroHands(event).filter(hand=>hand.state.street==='complete'&&hand.state.seats.some(s=>s.id===0&&s.startingStack>0)).map(hand=>{
  const hit=cache.get(hand);if(hit)return hit;
  const view=tournamentGameView(hand.state),hero=hand.state.seats.find(s=>s.id===0)!;
  const stored={id:`${event.id}:${hand.state.handId}`,sessionId:event.id,epoch:0,number:hand.number,startedAt:hand.settledAt,endedAt:hand.settledAt,
   net:hero.stack-hero.startingStack,view,frames:hand.frames.length?hand.frames:replayTournamentHand(hand.state)} as unknown as StoredHand;
  cache.set(hand,stored);return stored;
 });
}
const total=(d:HeroDecision,id:number)=>{const s=d.frame.seats.find(x=>x.id===id);return s?s.stack+s.streetCommitted:0;};
/** Effective stack in big blinds against the deepest player still in. */
function effective(d:HeroDecision):number {const me=total(d,0),others=d.frame.seats.filter(s=>s.id!==0&&!s.folded).map(s=>total(d,s.id));return Math.min(me,Math.max(0,...others))/d.bb;}
/** Players still to act behind Hero before the flop. */
function behind(d:HeroDecision):number {
 const acted=new Set(d.hand.view.events.filter(e=>e.type==='action'&&e.street==='preflop'&&e.revision<d.event.revision).map(e=>e.seatId));
 return d.frame.seats.filter(s=>s.id!==0&&!s.folded&&!s.allIn&&!acted.has(s.id)).length;
}
const firstIn=(d:HeroDecision)=>d.street==='preflop'&&d.raisesBefore===0&&!d.hand.view.events.some(e=>e.type==='action'&&e.street==='preflop'&&e.revision<d.event.revision&&e.action?.type==='call');
const hasAnte=(d:HeroDecision)=>d.hand.view.events.some(e=>e.type==='ante');
const pct=(a:number,b:number)=>Math.round(100*a/b);
const ids=(list:readonly HeroDecision[])=>[...new Set(list.map(d=>d.hand.id))];
const sumBB=(list:readonly HeroDecision[])=>{let t=0;for(const h of new Set(list.map(d=>d.hand)))t+=h.net/h.view.profile.bigBlind;return Math.round(t*10)/10;};

/** Tournament leaks: the cash checks plus the tournament ones, worst first. */
export function findTournamentLeaks(hands:readonly StoredHand[]):Leak[] {
 const leaks=findLeaks(hands).filter(l=>l.id!=='too-loose'&&l.id!=='too-tight'&&l.id!=='tilt');
 const d=hands.filter(h=>h.view.street==='complete').flatMap(heroDecisions);
 // Short and first in: hands the chart shoves that you folded.
 const shortFirst=d.filter(x=>firstIn(x)&&effective(x)<=12&&x.position!=='BB');
 const shoveSpots=shortFirst.filter(x=>handRank(x.hole)<pushRange(effective(x),behind(x),hasAnte(x))),missed=shoveSpots.filter(x=>x.event.action?.type==='fold');
 if(shoveSpots.length>=4&&missed.length/shoveSpots.length>=.35)leaks.push({id:'missed-shoves',title:'You fold too often when short',
  finding:`With 12 big blinds or less and folded to you, you folded ${missed.length} of ${shoveSpots.length} hands that are standard all-in shoves (${pct(missed.length,shoveSpots.length)}%).`,
  guide:'Short stacks lose value every orbit they wait. When it is folded to you with 12 big blinds or less, move all-in with the chart range for your stack and position instead of folding or limping.',
  bb:sumBB(missed),count:missed.length,of:shoveSpots.length,handIds:ids(missed)});
 // Calling an all-in too light.
 const facingAllIn=d.filter(x=>x.street==='preflop'&&x.toCall>0&&x.villain!==null&&x.frame.seats.find(s=>s.id===x.villain)?.allIn&&x.toCall>=.4*total(x,0));
 const light=facingAllIn.filter(x=>{if(x.event.action?.type!=='call')return false;const shover=total(x,x.villain!)/x.bb,price=x.toCall/(x.pot+x.toCall);
  return handRank(x.hole)>callRange(pushRange(shover,3),price,behind(x))*1.15;});
 const lightBB=sumBB(light);
 if(light.length>=3&&lightBB<0)leaks.push({id:'light-calls',title:'You call all-ins too light',
  finding:`You called ${light.length} all-ins for a big part of your stack with hands below the calling line, and lost ${Math.abs(lightBB)} big blinds in them.`,
  guide:'Calling an all-in needs a stronger hand than shoving does, because they chose to shove and you can be knocked out. Near the money and at final tables, tighten further.',
  bb:lightBB,count:light.length,of:facingAllIn.length,handIds:ids(light)});
 // Passing up steals with antes in.
 const steal=d.filter(x=>firstIn(x)&&hasAnte(x)&&['CO','BTN','SB'].includes(x.position)&&effective(x)>=15&&effective(x)<=40&&handRank(x.hole)<({CO:.27,BTN:.4,SB:.36} as Record<string,number>)[x.position]);
 const passed=steal.filter(x=>x.event.action?.type==='fold');
 if(steal.length>=5&&passed.length/steal.length>=.4)leaks.push({id:'missed-steals',title:'You pass up steals once the antes start',
  finding:`Folded to you in the cutoff, button or small blind with antes in, you folded ${passed.length} of ${steal.length} hands that are normal opens there (${pct(passed.length,steal.length)}%).`,
  guide:'With antes in, the blinds and antes are worth picking up. Open these hands, usually to a small size.',
  bb:sumBB(passed),count:passed.length,of:steal.length,handIds:ids(passed)});
 return leaks.sort((a,b)=>a.bb-b.bb);
}
/** Push/fold drills: short and folded to you. The best answer follows the chart. */
export function pushDrills(hands:readonly StoredHand[],limit=5):Drill[] {
 const d=hands.filter(h=>h.view.street==='complete').flatMap(heroDecisions).filter(x=>firstIn(x)&&x.frame.legal.canRaise&&effective(x)<=12&&effective(x)>=2&&x.position!=='BB'&&(x.event.action?.type==='fold'||(x.event.action?.type==='raise'&&x.event.action.to===total(x,0))));
 // Closest to the line first: those are the ones worth practising.
 const ranked=d.map(x=>({x,gap:Math.abs(handRank(x.hole)-pushRange(effective(x),behind(x),hasAnte(x)))})).sort((a,b)=>a.gap-b.gap);
 const used=new Set<string>(),out:Drill[]=[];
 for(const {x} of ranked){if(used.has(x.hand.id))continue;used.add(x.hand.id);
  const bb=effective(x),n=behind(x),ante=hasAnte(x),line=pushRange(bb,n,ante),stack=Math.round(10*bb)/10;
  out.push({id:`${x.hand.id}:${x.event.revision}`,handId:x.hand.id,sessionId:x.hand.sessionId,number:x.hand.number,street:'preflop',position:x.position,hole:x.hole as Card[],board:[],pot:x.pot,toCall:x.toCall,bb:x.bb,canRaise:x.frame.legal.canRaise,
   villain:{seat:-1,name:'',position:'',style:''},did:x.event.action!.type==='raise'?'raise':'fold',net:x.hand.net,shown:null,shownLabel:null,
   prompt:`Folded to you with ${stack} big blinds${ante?', antes in':''}; ${n} player${n===1?'':'s'} left to act. Shove all-in or fold?`,
   push:{rank:handRank(x.hole),line,stack,behind:n}});
  if(out.length>=limit)break;}
 return out;
}
export {positionOf};
