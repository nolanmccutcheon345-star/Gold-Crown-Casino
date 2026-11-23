/** Short-stack push/fold for tournaments (policy 2.8.0). Under about 15 big blinds good players stop
 * limping and min-raising: they move all-in first in or fold, call all-ins by the price and the
 * shover's likely range, and re-shove over late-position opens. The ranges are a designed
 * approximation for short-stack play with antes, not a solved equilibrium. Skilled players
 * follow them closely; weaker players follow them less often and keep their own habits (limping
 * short, calling too wide or too tight). Risk-takers widen, cautious players tighten, and prize
 * pressure (bubble or ICM) narrows everyone. Public information and own cards only. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from '../bots/profiles';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition} from '../bots/preflop';
import {contestablePricing} from '../bots/pricing';
import {bubbleFactor,type TournamentContext} from './bot-policy-v2';

// Short-stack hand order (the same ordinal score the 1.0.0 short-stack overlay uses): pairs and
// aces gain, small speculative hands lose. Expressly an ordering, not equity.
const classes=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
const score=(handClass:string)=>{const c=classes.get(handClass)!;return c.baseScore+(c.pair?12:c.highRank===14?12:0)-(c.speculative*(c.highRank===14?0:7));};
const ORDER=[...PREFLOP_CLASSES].map(c=>({score:score(c.handClass),combos:c.comboCount}));
/** Share of starting hands ranked above this one (0 = best). */
export function handRank(cards:readonly string[]):number {const s=score(classifyStartingHand(cards));return ORDER.reduce((sum,c)=>sum+(c.score>s?c.combos:c.score===s?c.combos/2:0),0)/1326;}

/** Chart share of hands to move all-in first in, with `behind` players left to act and antes in play. */
export function pushRange(stackBB:number,behind:number,ante=true):number {
 const base=1.02*Math.exp(-.075*(Math.max(1,stackBB)-2)),position=2.6/(Math.max(1,behind)+.6);
 return clamp(base*position*(ante?1:.8),.02,.88);
}
/** Chart share of hands to call an all-in with: the shover's likely range scaled by the price
 * (`price` = call ÷ pot after calling), tighter with players still to act behind. */
export function callRange(shoverRange:number,price:number,behind:number):number {
 return clamp(shoverRange*(1.75-2.3*price)*Math.pow(.7,Math.max(0,behind)),.02,.95);
}
/** Typical opening ranges by position, for re-shoves. Designed reference values. */
const OPEN:Record<string,number>={UTG:.13,MP:.18,CO:.27,BTN:.4,SB:.45,BB:.2};

/** How far a personality bends the chart: risk-takers and loose players wider, cautious tighter;
 * skilled players bend it less. */
export function chartBend(profile:BotProfile):number {
 const p=completeProfile(profile),m=clamp(Math.exp(1*(p.traits.riskTolerance-.5)+.6*(p.looseness-.4)),.6,1.6);
 return 1+(m-1)*(1-.6*p.skill);
}
/** How often a personality plays by the chart at all (otherwise the earlier policy decides). */
export function chartUse(profile:BotProfile):number {const p=completeProfile(profile);return clamp((p.skill-.25)/.5);}

const total=(o:BotObservation,id:number)=>{const s=o.seats.find(x=>x.id===id)!;return s.stack+s.streetCommitted;};
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}

export interface PushFoldResult {action:Action;play:'shove'|'fold'|'call'|'reshove';range:number;rank:number;}
/** A push/fold decision for this spot, or null when the spot is not a push/fold spot or this player
 * does not play it by the chart this time. */
export function pushFold(o:BotObservation,profile:BotProfile,context:TournamentContext|undefined,random:()=>number,personal=true):PushFoldResult|null {
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2)return null;
 const me=o.actingSeat,bb=o.bigBlind,mine=total(o,me),live=o.seats.filter(s=>s.id!==me&&!s.folded);
 if(!live.length)return null;
 const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raises=pre.filter(e=>e.action?.type==='raise');
 // An earlier limper still responds to a shove: having acted does not remove exposure.
 const behind=live.filter(s=>!s.allIn&&s.stack>0).length;
 const ante=o.publicEvents.some(e=>e.type==='ante');
 const biggestSeat=live.reduce((a,b)=>total(o,a.id)>=total(o,b.id)?a:b),biggest=total(o,biggestSeat.id),effective=Math.min(mine,biggest)/bb;
 const rank=handRank(o.ownCards),bend=chartBend(profile);
 const pressure=(theirs:number,power:number,opponentSeat:number)=>{
  if(!context)return 1;
  const meId=context.seatPlayers?.[me],opponentId=context.seatPlayers?.[opponentSeat];
  const players=meId===undefined||opponentId===undefined?undefined:{me:meId,opponent:opponentId};
  return Math.pow(bubbleFactor(context,profile,mine,theirs,bb,personal,true,players),power);
 };
 const shove:Action|null=o.legal.canRaise?{type:'raise',to:o.legal.maxRaiseTo!}:null;
 const use=()=>draw(random)<chartUse(profile);
 if(!raises.length){
  // First in (or over limpers): shove or fold. A big blind with no limpers simply checks.
  if(effective>15||!shove)return null;
  const limpers=pre.filter(e=>e.action?.type==='call').length;if(o.legal.check&&!limpers)return null;
  if(!use())return null;
  const range=clamp(pushRange(effective,behind,ante)*Math.pow(.8,limpers)*bend/pressure(biggest,.8,biggestSeat.id),.01,.92);
  return rank<range?{action:shove,play:'shove',range,rank}:{action:o.legal.check?{type:'check'}:{type:'fold'},play:'fold',range,rank};
 }
 if(raises.length!==1||pre.some(e=>e.action?.type==='call'&&e.revision>raises[0].revision))return null;
 const raiser=raises[0].seatId!,r=o.seats.find(s=>s.id===raiser)!,theirs=total(o,raiser),theirsBB=theirs/bb;
 if(r.allIn||(raises[0].action as {to:number}).to>=theirs){
  // Facing an all-in: call by price and the shover's likely range.
  if(theirsBB>25||o.legal.callAmount<=0)return null;
  if(!use())return null;
  // Reconstruct who could respond when the shove was made. Earlier limpers still count;
  // folded players and players already forced all-in do not. Amounts are public chip deltas.
  const prior=o.publicEvents.filter(e=>e.revision<raises[0].revision),foldedBefore=new Set(prior.filter(e=>e.action?.type==='fold').map(e=>e.seatId));
  const behindShover=o.seats.filter(s=>s.id!==raiser&&!foldedBefore.has(s.id)&&s.stack+s.totalCommitted-prior.filter(e=>e.seatId===s.id&&['blind','ante','action'].includes(e.type)).reduce((n,e)=>n+(e.amount??0),0)>0).length;
  const shoverRange=pushRange(theirsBB,behindShover,ante)*1.05;
  // A capped caller cannot win unmatched excess or the deeper opponents' side pot.
  const price=contestablePricing(o).rakeAdjustedPrice,range=clamp(callRange(shoverRange,price,behind)*bend/pressure(theirs,1.3,raiser),.01,.95);
  return rank<range?{action:{type:'call'},play:'call',range,rank}:{action:{type:'fold'},play:'fold',range,rank};
 }
 // Facing one open from late position with 8–25 big blinds: re-shove or leave it to the earlier policy.
 const position=preflopPosition(o,raiser);
 // Remaining deep players can still call the re-shove; do not risk a deep stack
 // merely because the opener is short. Folded opponents and inert all-ins add no new risk.
 const versusOpener=Math.min(mine,Math.max(theirs,...live.filter(s=>!s.allIn&&s.stack>0).map(s=>total(o,s.id))))/bb;
 if(!shove||versusOpener<8||versusOpener>25||!['CO','BTN','SB'].includes(position))return null;
 if(!use())return null;
 const range=clamp((OPEN[position]??.2)*(.62-.012*versusOpener)*bend/pressure(theirs,1,raiser),.01,.4);
 return rank<range?{action:shove,play:'reshove',range,rank}:null;
}
