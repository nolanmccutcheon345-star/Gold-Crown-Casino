/** Preflop raising wars (cash layer human-1.8.0, tournament policy 2.11.0, deeper than 30 big blinds).
 * Good regulars 3-bet light from late position and the blinds with suited aces and suited connectors,
 * squeeze over an open and a call, defend their opens against 3-bets instead of over-folding, and
 * sometimes 4-bet bluff with an ace blocker. Recreational players 3-bet only their very best hands
 * (they flat the rest) and call 3-bets too wide. Public actions and own cards only. Designed
 * frequencies, not a solver. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition,seatsFromButton} from './preflop';

const classes=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
const ORDER=[...PREFLOP_CLASSES].map(c=>({score:c.baseScore,combos:c.comboCount}));
/** Share of starting hands ranked above this one by the deep-stack preflop score (0 = AA). */
export function deepRank(cards:readonly string[]):number {const c=classes.get(classifyStartingHand(cards))!,s=c.baseScore;return ORDER.reduce((sum,x)=>sum+(x.score>s?x.combos:x.score===s?x.combos/2:0),0)/1326;}
/** Hands good players 3-bet or 4-bet as bluffs: suited wheel aces, suited connectors and suited broadways outside the value range. */
export function bluffCandidate(cards:readonly string[]):boolean {
 const c=classes.get(classifyStartingHand(cards))!;if(!c.suited||c.pair)return false;
 return (c.highRank===14&&c.lowRank<=5)||(c.highRank-c.lowRank===1&&c.lowRank>=5)||(c.highRank>=12&&c.lowRank>=10);
}
/** How readily a personality fights preflop: skilled aggressive players most. */
export function warriorness(profile:BotProfile):number {const p=completeProfile(profile);return clamp((p.skill-.45)*2)*(.3+.7*p.aggression);}

const LATE=new Set(['CO','BTN','SB','BB']);
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const total=(o:BotObservation,id:number)=>{const s=o.seats.find(x=>x.id===id)!;return s.stack+s.streetCommitted;};
const sized=(o:BotObservation,to:number):Action=>{const u=o.chipUnit??1;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round(to/u)*u))};};
/** Acts after the player's first position (are they in position on the opener after the flop?). */
const inPositionOn=(o:BotObservation,opener:number)=>{const order=seatsFromButton(o);return order.findIndex(s=>s.id===o.actingSeat)>order.findIndex(s=>s.id===opener);};

export function threeBetPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2)return keep;
 const me=o.actingSeat,own=o.seats.find(s=>s.id===me)!;if(o.legal.callAmount>=own.stack&&o.legal.callAmount>0)return keep;
 const live=o.seats.filter(s=>!s.folded&&s.id!==me);if(!live.length)return keep;
 const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raises=pre.filter(e=>e.action?.type==='raise');
 // A deep unrelated player cannot turn a short opener/shover into a deep-stack spot.
 const aggressor=o.seats.find(s=>s.id===raises.at(-1)?.seatId);
 if(!aggressor||aggressor.id===me||aggressor.folded||aggressor.allIn)return keep;
 const depth=Math.min(total(o,me),total(o,aggressor.id))/o.bigBlind;if(depth<=30)return keep;
 const p=completeProfile(profile),w=warriorness(profile),rank=deepRank(o.ownCards),bluff=bluffCandidate(o.ownCards);
 if(raises.length===1&&raises[0].seatId!==me){
  const opener=raises[0].seatId!,open=(raises[0].action as {to:number}).to,callers=pre.filter(e=>e.action?.type==='call'&&e.revision>raises[0].revision).length;
  // Passive recreational players 3-bet only the very top and flat the rest (maniacs keep raising).
  if(action.type==='raise'&&!['AA','KK','QQ','AKs','AKo'].includes(classifyStartingHand(o.ownCards))&&p.skill<.5&&p.aggression<.55&&draw(random)<clamp((.5-p.skill)*2.2))return o.legal.callAmount>0?{action:{type:'call'},play:'flat-not-3bet'}:keep;
  // Light 3-bets and squeezes from late position and the blinds.
  if(action.type!=='raise'&&o.legal.canRaise&&bluff&&rank>.035&&LATE.has(preflopPosition(o))){
   const late=LATE.has(preflopPosition(o,opener))&&preflopPosition(o,opener)!=='BB';
   if(draw(random)<clamp(w*(late?.75:.25)*(callers?1.2:1))){const ip=inPositionOn(o,opener);return {action:sized(o,open*(ip?3:4)+open*callers),play:callers?'squeeze':'light-3bet'};}
  }
  return keep;
 }
 if(raises.length===2&&raises[0].seatId===me&&raises[1].seatId!==me&&!pre.some(e=>e.action?.type==='call'&&e.revision>raises[1].revision)){
  const threeBettor=raises[1].seatId!,three=(raises[1].action as {to:number}).to,ip=inPositionOn(o,threeBettor);
  if(action.type==='fold'&&o.legal.canRaise&&bluff&&(o.ownCards[0][0]==='A'||o.ownCards[1][0]==='A')&&draw(random)<clamp(w*.3))return {action:sized(o,three*(ip?2.3:2.6)),play:'4bet-bluff'};
  // Defend opens against 3-bets: strong hands, pairs and suited broadways, more in position.
  const c=classes.get(classifyStartingHand(o.ownCards))!,defend=rank<=.12||(c.pair&&(ip||c.highRank>=6)&&depth>=80)||(bluff&&(ip||c.highRank>=12));
  if(action.type==='fold'&&defend&&o.legal.callAmount>0&&draw(random)<clamp((.45+.5*p.skill)*(ip?1:.8)))return {action:{type:'call'},play:'defend-3bet'};
 }
 return keep;
}
