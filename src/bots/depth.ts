/** Buy-in styles and stack depth (cash layer human-1.4.0). Live players buy in differently: short
 * stackers sit with about 40 big blinds and play raise-or-fold, most players buy in for the
 * table's standard amount, and strong or loose-aggressive players buy in deep. Everyone plays
 * differently with 40 big blinds behind than with 250: short stacks stop calling speculative hands
 * and get it in lighter; deep stacks set-mine and stop stacking off with one pair.
 * Deterministic per personality. Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

export type BuyInStyle='short'|'standard'|'deep';
export const STYLE_NAMES:Record<BuyInStyle,string>={short:'short-stacker',standard:'standard buy-in',deep:'buys in deep'};
const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};

/** A personality's buy-in habit: weaker tight players lean short, strong and loose-aggressive
 * players lean deep. A regular may name one. */
export function buyInStyle(profile:BotProfile,override?:BuyInStyle):BuyInStyle {
 if(override)return override;
 const p=completeProfile(profile),roll=unit(`buy-in:${profile.personalityId??`${p.archetype}:${p.skill}:${p.looseness}`}`);
 const short=clamp(.04+.22*(1-p.skill)*(1-p.looseness)+(p.archetype==='nit'||p.archetype==='fit-or-fold'?.08:0),0,.3);
 const deep=clamp(.08+.45*Math.max(0,p.skill-.5)+.25*Math.max(0,p.aggression-.55),0,.5);
 return roll<short?'short':roll<short+deep?'deep':'standard';
}
/** Chips this style sits down with, inside the table's buy-in limits. */
export function styleBuyIn(style:BuyInStyle,settings:{buyIn:number;bigBlind:number;minBuyInBB:number;maxBuyInBB:number;chipUnit?:number}):number {
 const bb=settings.bigBlind,u=settings.chipUnit??1;
 if(![bb,u,settings.buyIn,settings.minBuyInBB,settings.maxBuyInBB].every(n=>Number.isSafeInteger(n)&&n>0)||settings.maxBuyInBB<settings.minBuyInBB)throw Error('Invalid styled buy-in limits');
 const min=Math.ceil(settings.minBuyInBB*bb/u)*u,max=Math.floor(settings.maxBuyInBB*bb/u)*u;
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max)throw Error('No legal styled buy-in denomination');
 const want=style==='short'?Math.min(40*bb,Math.round(settings.buyIn*.4)):style==='deep'?Math.max(settings.buyIn*2,200*bb):settings.buyIn;
 return clamp(Math.floor(want/u)*u,min,max);
}

/** Effective chips against the live bettor when facing a bet; otherwise the biggest live
 * opponent. Earlier-street contributions and antes are already in the pot, not implied odds. */
export function effectiveBB(o:BotObservation):number {
 const own=o.seats.find(s=>s.id===o.actingSeat)!,mine=own.stack+own.streetCommitted;
 const live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded&&s.stack+s.totalCommitted>0);
 const lastRaise=!o.legal.check?o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street&&e.action?.type==='raise'&&e.seatId!==o.actingSeat).at(-1):undefined;
 const target=lastRaise?live.find(s=>s.id===lastRaise.seatId):undefined;
 const theirs=target?target.stack+target.streetCommitted:Math.max(0,...live.map(s=>s.stack+s.streetCommitted));
 return Math.min(mine,theirs)/o.bigBlind;
}
export interface DepthEffect {depthBB:number;applied:string[];}
/** The same player adjusted for how deep the money is. */
export function depthProfile(o:BotObservation,profile:BotProfile):{profile:BotProfile;effect:DepthEffect|null} {
 const depth=effectiveBB(o),p=completeProfile(profile),t={...p.traits},applied:string[]=[];let looseness=p.looseness,aggression=p.aggression;
 if(depth<=45){
  // Short: fewer speculative calls, raise-or-fold, commit lighter.
  const k=clamp((45-depth)/25)*.8+.2;
  looseness=clamp(looseness-.08*k);aggression=clamp(aggression+.06*k);t.drawCalling=clamp(t.drawCalling-.12*k);t.riskTolerance=clamp(t.riskTolerance+.15*k);applied.push('short-stack');
 }else if(depth>=150){
  // Deep: implied odds for small pairs and suited connectors; one pair is not enough for stacks.
  const k=clamp((depth-150)/100)*.7+.3;
  t.drawCalling=clamp(t.drawCalling+.1*k);t.riskTolerance=clamp(t.riskTolerance-.18*k*(.4+p.skill));t.sizeSensitivity=clamp(t.sizeSensitivity+.15*k*p.skill);applied.push('deep-stack');
 }
 if(!applied.length)return {profile,effect:null};
 return {profile:{...p,looseness,aggression,traits:t},effect:{depthBB:depth,applied}};
}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const RANKS='23456789TJQKA';
/** Depth plays applied after the decision:
 * - set-mine: 80 big blinds or deeper (more often the deeper), facing one small raise with a small pair or suited connector, call instead of folding;
 * - raise-or-fold: a short-stacker facing a raise before the flop shoves good hands and folds the rest instead of calling. */
export function depthPlay(o:BotObservation,profile:BotProfile,style:BuyInStyle,action:Action,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};if(o.street!=='preflop'||!o.ownCards||o.ownCards.length!==2||o.legal.check)return keep;
 const raises=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise');if(!raises.length)return keep;
 const p=completeProfile(profile),depth=effectiveBB(o),own=o.seats.find(s=>s.id===o.actingSeat)!;
 const [a,b]=o.ownCards,ra=RANKS.indexOf(a[0]),rb=RANKS.indexOf(b[0]),pair=ra===rb,suitedConnector=a[1]===b[1]&&Math.abs(ra-rb)===1&&Math.min(ra,rb)>=3;
 const price=o.legal.callAmount/o.bigBlind;
 if(action.type==='fold'&&raises.length===1&&depth>=80&&((pair&&ra<=5)||suitedConnector)&&price*15<=depth&&draw(random)<(.35+.5*p.skill)*clamp((depth-60)/90))return {action:{type:'call'},play:'set-mine'};
 if(style==='short'&&action.type==='call'&&own.stack/o.bigBlind<=45&&o.legal.canRaise){
  const strength=handFeatures(o.ownCards,o.board).strength;
  if(strength>=.72)return {action:{type:'raise',to:o.legal.maxRaiseTo!},play:'shove'};
  if(strength<.6&&draw(random)<.7)return {action:{type:'fold'},play:'raise-or-fold'};
 }
 return keep;
}
