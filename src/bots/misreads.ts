/** Hand-reading mistakes (cash layer human-1.18.0, tournament policy 2.21.0). Weaker players
 * sometimes misread the board, the way people really do at a live table:
 * - they miss a flush or straight that the board itself makes possible (four of a suit, or four
 *   cards to a straight) and keep calling, or bet a hand that is no longer good;
 * - on a paired board they think the board pair is "their" pair (a hand that only plays the board)
 *   and call or bet with nothing.
 * How often: none for skilled players; for the weakest, careless ones about a quarter of the time
 * when facing a bet (up to three-quarters of the pot) and somewhat more when checked to, and only
 * in the spots where the misread changes the action. Tuned down after the first audit, where
 * stronger settings pushed calling stations back above 50% to showdown. After a lost showdown, the misreader
 * sometimes says so ("Didn't see the flush."). Designed, not fitted. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';

const RANKS='23456789TJQKA';
const rankOf=(c:string)=>RANKS.indexOf(c[0])+2;
/** How often this player misreads a board when it matters: 0 for skilled players. */
export function misreadChance(profile:BotProfile):number {const p=completeProfile(profile);if(p.skill>=.6)return 0;return clamp((.5-p.skill)*1.2+.25*p.traits.mistakeRate,0,.4);}
/** What the board itself threatens. `flushSuit`: four or more of one suit on board; `straight`: four
 * board cards within five ranks (the ace also counts low); `paired`: a rank appears twice. */
export function boardThreats(board:readonly string[]):{flushSuit:string|null;straight:boolean;paired:boolean} {
 const suits=new Map<string,number>();for(const c of board)suits.set(c[1],(suits.get(c[1])??0)+1);
 const flushSuit=[...suits.entries()].find(([,n])=>n>=4)?.[0]??null;
 const ranks=[...new Set(board.flatMap(c=>{const r=rankOf(c);return r===14?[14,1]:[r];}))].sort((a,b)=>a-b);
 let straight=false;for(const r of ranks)if(ranks.filter(x=>x>=r&&x<=r+4).length>=4)straight=true;
 return {flushSuit,straight,paired:new Set(board.map(c=>c[0])).size<board.length};
}
function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
export type Misread='missed-board-flush'|'missed-board-straight'|'board-pair-is-mine'|null;
/** The misread this hand would invite, if any: the board threatens something the player's hand does not beat. */
export function invitedMisread(own:readonly string[],board:readonly string[]):Misread {
 if(board.length<3)return null;
 const t=boardThreats(board),f=handFeatures(own as never,board as never);
 if(t.flushSuit&&!own.some(c=>c[1]===t.flushSuit)&&f.strength>=.45&&!['flush','full-house','quads','straight-flush'].includes(f.handClass))return 'missed-board-flush';
 if(t.straight&&f.strength>=.45&&!['straight','flush','full-house','quads','straight-flush'].includes(f.handClass))return 'missed-board-straight';
 if(t.paired&&['board-pair','board-two-pair'].includes(f.handClass))return 'board-pair-is-mine';
 return null;
}
export function misreadPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:Misread} {
 const keep={action,play:null as Misread};
 if(o.street==='preflop'||!o.ownCards||o.ownCards.length!==2)return keep;
 const m=misreadChance(profile);if(m<=0)return keep;
 const kind=invitedMisread(o.ownCards,o.board);if(!kind)return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1;
 const bet=(fraction:number):Action|null=>o.legal.canRaise?{type:'raise',to:Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round((own.streetCommitted+o.pot*fraction)/u)*u))}:null;
 // Facing a bet: the misreader thinks the hand is still good and calls (not for more than the pot, or more than a third of the stack).
 if(!o.legal.check&&action.type==='fold'&&o.legal.callAmount<=Math.min(.75*(o.pot-o.legal.callAmount),Math.max(own.stack*.35,o.bigBlind*10))&&draw(random)<.6*m)return {action:{type:'call'},play:kind};
 // Checked to: the misreader bets for "value".
 if(o.legal.check&&action.type==='check'&&draw(random)<m*(kind==='board-pair-is-mine'?.4:.6)){const b=bet(kind==='board-pair-is-mine'?.35:.6);if(b)return {action:b,play:kind};}
 return keep;
}
/** After a showdown loss in a spot the board warned about. */
export const MISREAD_LINES:Readonly<Record<Exclude<Misread,null>,readonly string[]>>={'missed-board-flush':['Didn’t see the flush.','Four of a suit. Missed that.','I never even looked at the suits.'],'missed-board-straight':['Missed the straight on board.','Wait, that’s a straight?','How did I not see that?'],'board-pair-is-mine':['I thought I had a pair.','That pair was on the board, wasn’t it.']};
