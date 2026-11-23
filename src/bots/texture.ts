/** Scare cards and board texture (cash layer human-1.7.0, tournament policy 2.10.0). Live players
 * react to the runout: when the turn or river completes a flush or a straight, or brings a big
 * overcard, the player who has been betting often keeps firing as a bluff (the scare card is good for
 * their story), medium hands slow down, and one-pair hands give up facing a bet. On the flop, good
 * players continuation-bet small on dry boards and give up air on wet ones. Skilled players react
 * fully; recreational players barely notice. Public board and own cards only. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

const RANKS='23456789TJQKA';
const rankOf=(c:string)=>RANKS.indexOf(c[0])+2;
/** Can some straight be made with three board cards? */
function straightPossible(board:readonly string[]):boolean {
 const r=new Set(board.map(rankOf));if(r.has(14))r.add(1);
 for(let low=1;low<=10;low++){let n=0;for(let x=low;x<low+5;x++)if(r.has(x))n++;if(n>=3)return true;}
 return false;
}
export type Scare='flush'|'straight'|'overcard'|'pair'|null;
/** What the newest board card did (turn or river), most frightening first. */
export function scareCard(board:readonly string[]):Scare {
 if(board.length<4)return null;
 const before=board.slice(0,-1),card=board.at(-1)!;
 if(before.filter(c=>c[1]===card[1]).length===2)return 'flush';
 if(straightPossible(board)&&!straightPossible(before))return 'straight';
 if(before.some(c=>c[0]===card[0]))return 'pair';
 if(rankOf(card)>=12&&before.every(c=>rankOf(c)<rankOf(card)))return 'overcard';
 return null;
}
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const lastRaiser=(o:BotObservation,street:string)=>[...o.publicEvents].reverse().find(e=>e.type==='action'&&e.street===street&&e.action?.type==='raise')?.seatId;
const previousStreet:Record<string,string>={flop:'preflop',turn:'flop',river:'turn'};
const bet=(o:BotObservation,fraction:number):Action=>{const own=o.seats.find(s=>s.id===o.actingSeat)!,unit=o.chipUnit??1,to=Math.round((own.streetCommitted+o.pot*fraction)/unit)*unit;return {type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,to))};};

/** Texture plays applied after the decision. */
export function texturePlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:string|null} {
 const keep={action,play:null};
 if(o.street==='preflop'||!o.ownCards||o.ownCards.length!==2)return keep;
 const p=completeProfile(profile),f=handFeatures(o.ownCards,o.board),noBet=o.legal.check,headsUp=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded).length===1;
 const littleDraw=f.draw<.3&&!['open-ended','double-gutshot'].includes(f.drawClass);
 const air=f.strength<.4&&littleDraw,medium=f.strength>=.5&&f.strength<.75,onePair=['top-pair','overpair','middle-pair','underpair'].includes(f.handClass),aggressor=lastRaiser(o,previousStreet[o.street])===o.actingSeat;
 if(f.absoluteNuts)return keep;
 if(o.street==='flop'){
  // Dry flop: a small continuation bet with air; wet flop: give it up heads-up.
  if(!aggressor||!headsUp||!noBet||!air)return keep;
  if(action.type==='check'&&f.wetness<.25&&o.legal.canRaise&&draw(random)<clamp(.55*p.skill*(.5+p.aggression)))return {action:bet(o,.33),play:'dry-cbet'};
  if(action.type==='raise'&&f.wetness>=.5&&draw(random)<clamp(.45*p.skill))return {action:{type:'check'},play:'wet-giveup'};
  return keep;
 }
 const scare=scareCard(o.board);
 // A blank changes nothing for the story: good players give up more air there and save barrels for scare cards.
 if(!scare){if(aggressor&&headsUp&&noBet&&air&&action.type==='raise'&&draw(random)<clamp(.4*p.skill))return {action:{type:'check'},play:'blank-giveup'};return keep;}
 if(scare==='pair')return keep;
 // The bettor keeps firing on a scare card heads-up with air.
 if(aggressor&&headsUp&&noBet&&air&&action.type==='check'&&o.legal.canRaise&&draw(random)<clamp(.7*p.skill*p.aggression))return {action:bet(o,.66),play:'scare-barrel'};
 if(scare==='overcard')return keep;
 // A flush or straight card: medium hands stop betting, and one pair gives up facing a bet.
 if(noBet&&medium&&action.type==='raise'&&draw(random)<clamp(.2+.6*p.skill))return {action:{type:'check'},play:'slow-down'};
 if(!noBet&&action.type==='call'&&onePair&&f.strength>=.4&&f.strength<.65&&littleDraw&&draw(random)<clamp(.05+.4*p.skill))return {action:{type:'fold'},play:'scare-fold'};
 return keep;
}
