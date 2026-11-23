/** Table craft (cash layer human-1.19.0, tournament policy 2.22.0). Things thinking players do that
 * weaker players do not, and one tell that weaker players give away:
 * - Float: call a flop c-bet in position with a little equity, planning to take the pot later.
 * - Float bet: after floating, bet the turn when the preflop raiser checks to them.
 * - Probe: out of position, bet the turn (or river) when the preflop raiser has checked the street before.
 * - Blind defense: the blinds defend wider against a late-position steal and 3-bet some of it;
 *   nits fold their blinds more; loose recreational players call from the big blind because they are already in.
 * - Size reads: a player who has been seen betting big only with strong hands is believed when they
 *   bet big again, and called lighter when they bet small. Evidence is what this observer witnessed.
 * - Multiway preflop: fewer loose cold calls and light 3-bets when several players are already in.
 * How often each happens follows the player's skill and aggression. Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile,GameEvent} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {PREFLOP_CLASSES,classifyStartingHand,preflopPosition} from './preflop';
import {multiwayDiscipline} from './multiway';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const SCORES=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
export const startingScore=(cards:readonly string[])=>SCORES.get(classifyStartingHand(cards as never))?.baseScore??0;
const actions=(o:BotObservation,street:string)=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street);
const preflopRaiser=(o:BotObservation):number|undefined=>actions(o,'preflop').filter(e=>e.action?.type==='raise').at(-1)?.seatId;
const live=(o:BotObservation)=>o.seats.filter(s=>!s.folded);
function betTo(o:BotObservation,fraction:number):Action|null {
 if(!o.legal.canRaise||o.legal.minRaiseTo===null||o.legal.maxRaiseTo===null)return null;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1;
 return {type:'raise',to:Math.min(o.legal.maxRaiseTo,Math.max(o.legal.minRaiseTo,Math.round((own.streetCommitted+o.pot*fraction)/u)*u))};
}
/** How much a player plays the "thinking" game: floats, probes and steals back. */
export function craft(profile:BotProfile):number {const p=completeProfile(profile);return clamp(.8*p.skill+.5*p.aggression-.42);}

export type CraftPlay='float'|'float-bet'|'probe'|'defend'|'already-in'|'resteal-3bet'|'nit-fold'|'size-fold'|'size-call'|'mw-fold'|'mw-flat'|null;

/** Flop: call a c-bet in position, heads-up, with some equity. */
export function floatPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if(o.street!=='flop'||action.type!=='fold'||o.legal.check||!o.ownCards||o.ownCards.length!==2||live(o).length!==2)return keep;
 const raiser=preflopRaiser(o),flop=actions(o,'flop');
 if(raiser===undefined||raiser===o.actingSeat||flop.length!==1||flop[0].seatId!==raiser||flop[0].action?.type!=='raise')return keep;
 if(o.legal.callAmount>.75*(o.pot-o.legal.callAmount))return keep;
 const f=handFeatures(o.ownCards,o.board),equity=f.strength>=.2||f.draw>=.15||f.overcards>=2;
 const k=craft(profile);
 return equity&&k>0&&draw(random)<Math.min(.85,1.2*k)?{action:{type:'call'},play:'float'}:keep;
}
/** Turn: the preflop raiser c-bet the flop, we called in position, and now they check. */
export function floatBetPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if(o.street!=='turn'||action.type!=='check'||!o.legal.check||live(o).length!==2)return keep;
 const raiser=preflopRaiser(o),flop=actions(o,'flop'),turn=actions(o,'turn');
 if(raiser===undefined||raiser===o.actingSeat)return keep;
 const floated=flop.length===2&&flop[0].seatId===raiser&&flop[0].action?.type==='raise'&&flop[1].seatId===o.actingSeat&&flop[1].action?.type==='call';
 if(!floated||turn.length!==1||turn[0].seatId!==raiser||turn[0].action?.type!=='check')return keep;
 const k=craft(profile),b=betTo(o,.6);
 return b&&k>0&&draw(random)<.75*k+.1?{action:b,play:'float-bet'}:keep;
}
/** Turn or river, out of position: the preflop raiser checked the street before; lead into them. */
export function probePlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if((o.street!=='turn'&&o.street!=='river')||action.type!=='check'||!o.legal.check||!o.ownCards||o.ownCards.length!==2||live(o).length!==2)return keep;
 const raiser=preflopRaiser(o),prev=o.street==='turn'?'flop':'turn',before=actions(o,prev),now=actions(o,o.street);
 if(raiser===undefined||raiser===o.actingSeat||now.length!==0)return keep;
 if(!before.length||before.some(e=>e.action?.type!=='check'))return keep;
 const f=handFeatures(o.ownCards,o.board),k=craft(profile);
 const chance=(f.strength>=.35||f.draw>=.2?.7:.4)*Math.min(1,1.5*k);
 const b=betTo(o,f.strength>=.6?.6:.45);
 return b&&k>0&&draw(random)<chance?{action:b,play:'probe'}:keep;
}

const STEAL_SPOTS=['CO','BTN','SB'];
/** Preflop in the blinds against a single late-position open: defend wider, re-steal some, or (nits) fold more. */
export function blindDefensePlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||o.legal.check)return keep;
 let me:string,them:string;try{me=preflopPosition(o);}catch{return keep;}
 if(me!=='SB'&&me!=='BB')return keep;
 const pre=actions(o,'preflop'),raises=pre.filter(e=>e.action?.type==='raise');
 if(raises.length!==1||pre.some(e=>e.action?.type==='call'))return keep;
 const raiser=raises[0].seatId!;try{them=preflopPosition(o,raiser);}catch{return keep;}
 if(!STEAL_SPOTS.includes(them)||raiser===o.actingSeat)return keep;
 const size=(raises[0].action as {to:number}).to/o.bigBlind;if(size>4)return keep;
 const p=completeProfile(profile),score=startingScore(o.ownCards),k=craft(profile);
 const cls=SCORES.get(classifyStartingHand(o.ownCards as never));
 // Nits give up their blinds.
 if(p.looseness<.3&&action.type==='call'&&score<58&&draw(random)<.5)return {action:{type:'fold'},play:'nit-fold'};
 // Re-steal: a light 3-bet with hands that play well when called.
 const restealHand=!!cls&&(cls.suited&&cls.highRank>=12||cls.pair&&cls.highRank<=9||cls.suited&&cls.highRank-cls.lowRank===1&&cls.lowRank>=5);
 if((action.type==='fold'||action.type==='call')&&restealHand&&p.aggression>=.55&&o.legal.canRaise&&draw(random)<.35*k){
  const to=Math.round(((raises[0].action as {to:number}).to*(me==='BB'?3.6:4))/(o.chipUnit??1))*(o.chipUnit??1);
  return {action:{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))},play:'resteal-3bet'};
 }
 // Defend wider: a thinking player calls with more of the hands that do well against a steal.
 const floor=me==='BB'?22:44,cheap=o.legal.callAmount<=(me==='BB'?3.1:3.6)*o.bigBlind;
 if(action.type==='fold'&&score>=floor&&cheap&&draw(random)<Math.min(.95,1.6*k))return {action:{type:'call'},play:'defend'};
 // Loose recreational players defend too, for a different reason: they are already in the pot.
 if(action.type==='fold'&&me==='BB'&&p.looseness>.55&&score>=12&&cheap&&draw(random)<1.4*(p.looseness-.4))return {action:{type:'call'},play:'already-in'};
 return keep;
}

/** What one player has been seen to do with big and small bets that reached a showdown. */
export interface SizeRead {bigStrong:number;bigWeak:number;smallStrong:number;smallWeak:number}
/** Big bets are believed once at least three have been shown down and at least 80% were strong. */
export const bigBetsHonest=(r:SizeRead|undefined)=>!!r&&r.bigStrong+r.bigWeak>=3&&r.bigStrong/(r.bigStrong+r.bigWeak)>=.8;
export const smallBetsWeak=(r:SizeRead|undefined)=>!!r&&r.smallStrong+r.smallWeak>=3&&r.smallWeak/(r.smallStrong+r.smallWeak)>=.7;
/** Facing a turn or river bet from someone whose sizing has given them away. */
export function sizeReadPlay(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,SizeRead>>|null|undefined,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if(!reads||(o.street!=='turn'&&o.street!=='river')||o.legal.check||!o.ownCards||o.ownCards.length!==2)return keep;
 const last=actions(o,o.street).filter(e=>e.action?.type==='raise').at(-1);
 if(!last||last.seatId===undefined||last.seatId===o.actingSeat)return keep;
 const p=completeProfile(profile);if(p.skill<.5)return keep;
 // The displayed pot already includes the outstanding bet. Subtract it exactly once to get the pre-bet pot.
 const before=o.pot-o.legal.callAmount,fraction=o.legal.callAmount/Math.max(1,before),f=handFeatures(o.ownCards,o.board),read=reads[last.seatId];
 if(fraction>=.7&&action.type==='call'&&f.strength<.72&&bigBetsHonest(read)&&draw(random)<.8*p.skill)return {action:{type:'fold'},play:'size-fold'};
 if(fraction<=.4&&action.type==='fold'&&f.strength>=.35&&smallBetsWeak(read)&&draw(random)<.8*p.skill)return {action:{type:'call'},play:'size-call'};
 return keep;
}

/** Preflop with two or more players already in: fewer loose cold calls and light 3-bets. */
export function multiwayPreflopPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:CraftPlay} {
 const keep={action,play:null as CraftPlay};
 if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||o.legal.check)return keep;
 const pre=actions(o,'preflop'),raises=pre.filter(e=>e.action?.type==='raise');
 if(raises.length!==1)return keep;
 const callers=pre.filter(e=>e.action?.type==='call'&&e.revision>raises[0].revision).length;
 if(callers<1)return keep;
 const d=multiwayDiscipline(profile),score=startingScore(o.ownCards),cls=SCORES.get(classifyStartingHand(o.ownCards as never));
 const setMine=!!cls?.pair,suitedPlayable=!!cls&&cls.suited&&(cls.highRank>=13||cls.highRank-cls.lowRank<=1);
 if(action.type==='call'&&score<60&&!setMine&&!suitedPlayable&&draw(random)<d*(.35+.15*Math.min(2,callers)))return {action:{type:'fold'},play:'mw-fold'};
 if(action.type==='raise'&&score<62&&!setMine&&draw(random)<d*.5)return {action:score>=48&&o.legal.callAmount<=3*o.bigBlind?{type:'call'}:{type:'fold'},play:score>=48&&o.legal.callAmount<=3*o.bigBlind?'mw-flat':'mw-fold'};
 return keep;
}

/** Size reads from finished hands an observer watched: big (two-thirds pot or more) and small (a third or less)
 * turn and river bets, and whether the bettor's shown-down hand was strong. */
export interface SizeHand {events:readonly GameEvent[];board:readonly string[];revealed:readonly {id:number;hole:readonly string[]}[]}
export function sizeReadsFrom(hands:readonly SizeHand[],seatIn:(index:number,seat:number)=>number|null,seats:readonly number[]):Record<number,SizeRead> {
 const out:Record<number,SizeRead>={};
 hands.forEach((hand,index)=>{
  // Pot before each bet, from public chip amounts (blinds, antes and actions); a bet's size is its chips over that pot.
  let pot=0;const shown=new Map(hand.revealed.map(r=>[r.id,r.hole])),lastBet=new Map<number,number>();
  for(const e of hand.events){
   if(e.type==='blind'||e.type==='ante'){pot+=e.amount??0;continue;}
   if(e.type!=='action'||!e.action||e.seatId===undefined)continue;
   const add=e.amount??0;
   if(e.action.type==='raise'&&(e.street==='turn'||e.street==='river')&&pot>0)lastBet.set(e.seatId,add/pot);
   pot+=add;
  }
  for(const seat of seats){
   const hist=seatIn(index,seat);if(hist===null)continue;
   const bet=lastBet.get(hist),hole=shown.get(hist);if(bet===undefined||!hole||hole.length!==2||hand.board.length<4)continue;
   const strong=handFeatures(hole as never,hand.board as never).strength>=.68;
   const r=out[seat]??={bigStrong:0,bigWeak:0,smallStrong:0,smallWeak:0};
   if(bet>=.66){if(strong)r.bigStrong++;else r.bigWeak++;}
   else if(bet<=.34){if(strong)r.smallStrong++;else r.smallWeak++;}
  }
 });
 return out;
}
export const sizeReadsDigest=(reads:Readonly<Record<number,SizeRead>>|null|undefined)=>reads?Object.entries(reads).sort((a,b)=>Number(a[0])-Number(b[0])).map(([s,r])=>`${s}=${r.bigStrong}/${r.bigWeak}/${r.smallStrong}/${r.smallWeak}`).join(','):'-';
