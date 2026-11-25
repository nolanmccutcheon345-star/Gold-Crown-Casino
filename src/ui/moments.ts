/** Patch 53: short table moments and the cash-out summary. Display only; they read public results and saved records. */
import type {HeroViewModel} from '../contracts';
import type {AppData} from '../session/types';
import type {TournamentView} from '../tournament/view-model';

/** A pot is "big" from 25 big blinds of profit for Hero. */
export const BIG_POT_BB=25;
export interface Moment {kind:'win'|'bust';title:string;detail:string}

/**
 * The moment for a settled hand, if any. Hero's result is the change in Hero's stack over the hand.
 * `earlierBest` is Hero's best single-hand result earlier in the same session or event, used for "biggest pot".
 */
export function handMoment(view:HeroViewModel|null|undefined,heroId:number,format:(amount:number)=>string,earlierBest:number|null,tournament=false):Moment|null {
 if(!view||view.street!=='complete')return null;
 const hero=view.seats.find(seat=>seat.id===heroId);
 if(!hero)return null;
 if(hero.stack===0)return tournament
  ?{kind:'bust',title:'Knocked out',detail:'Your tournament run ends here. Watch the finish or head back to the lobby.'}
  :{kind:'bust',title:'Felted',detail:'Out of chips. Add chips from the cashier or call it a night.'};
 const net=hero.stack-hero.startingStack;
 if(net<BIG_POT_BB*view.profile.bigBlind)return null;
 const best=earlierBest===null||net>earlierBest;
 return {kind:'win',title:`+${format(net)}`,detail:best&&earlierBest!==null?'Your biggest pot of the session.':`Big pot · ${Math.round(net/view.profile.bigBlind)} big blinds.`};
}

export const momentMarkup=(moment:Moment|null,key:string):string=>moment
 ?`<div class="table-moment moment-${moment.kind}" data-moment="${key}" role="status" aria-live="polite"><strong>${moment.title}</strong><span>${moment.detail}</span></div>`:'';

/** Fewer hands than this make bb/100 noise, so the summary leaves it out. */
export const MIN_BB100_HANDS=10;
export interface SessionSummary {sessionId:string;hands:number;result:number;bb100:number|null;biggestWin:number|null;activeMs:number;buyIns:number;cashOut:number;smallBlind:number;bigBlind:number}
/** Summary of one finished cash session from its saved ledger and hands. */
export function summarizeSession(data:AppData,sessionId:string):SessionSummary|null {
 const session=data.sessions.find(item=>item.id===sessionId);
 if(!session)return null;
 const result=data.ledger.filter(event=>event.sessionId===sessionId&&event.kind==='hand-net').reduce((sum,event)=>sum+event.pokerNet,0);
 const hands=data.hands.filter(hand=>hand.sessionId===sessionId);
 const count=session.handIds.length;
 const bbSum=hands.reduce((sum,hand)=>sum+hand.net/hand.view.profile.bigBlind,0);
 const wins=hands.map(hand=>hand.net).filter(net=>net>0);
 return {sessionId,hands:count,result,bb100:hands.length>=MIN_BB100_HANDS&&hands.length===count?100*bbSum/hands.length:null,biggestWin:hands.length===count&&wins.length?Math.max(...wins):null,activeMs:session.activeMs,buyIns:session.buyIns,cashOut:session.cashOut,smallBlind:session.profile.smallBlind,bigBlind:session.profile.bigBlind};
}
export function durationText(ms:number):string {
 const minutes=Math.round(ms/60000);
 if(minutes<1)return 'under a minute';
 if(minutes<60)return `${minutes} min`;
 return `${Math.floor(minutes/60)} h ${minutes%60} min`;
}

/** Tournament milestones Hero can reach during an event. */
export interface TournamentFlags {itm:boolean;finalTable:boolean;won:boolean;bubble:boolean;bubbleBust:boolean}
export function tournamentFlags(view:TournamentView):TournamentFlags {
 const alive=view.status==='running'&&!!view.hero;
 return {
  // Never while registration is open: the field, and so the paid places, can still grow.
  itm:alive&&!view.registration?.open&&view.placesPaid>0&&view.playersLeft<=view.placesPaid,
  finalTable:alive&&view.entrants>9&&view.finalTable,
  won:view.result?.place===1,
  // Phase 10 (fun #6): the bubble itself — one player between the field and the money,
  // and Hero finishing in exactly that spot.
  bubble:alive&&!view.registration?.open&&view.placesPaid>0&&view.playersLeft===view.placesPaid+1,
  bubbleBust:view.placesPaid>0&&view.result?.place===view.placesPaid+1,
 };
}
/** A moment only when a flag turns on during the same event, so reopening the page does not replay it. */
export function tournamentMoment(prev:TournamentFlags|null,next:TournamentFlags,view:TournamentView,format:(cents:number)=>string):Moment|null {
 if(!prev)return null;
 if(next.won&&!prev.won)return {kind:'win',title:'Champion',detail:`You won ${view.eventName}${view.result&&view.result.prize>0?` · ${format(view.result.prize)}`:''}.`};
 if(next.finalTable&&!prev.finalTable)return {kind:'win',title:'Final table',detail:`${view.playersLeft} players left.`};
 if(next.itm&&!prev.itm){const min=view.ladder[view.playersLeft-1];return {kind:'win',title:'In the money',detail:min?`Every player left is paid at least ${format(min)}.`:'Every player left is paid.'};}
 if(next.bubbleBust&&!prev.bubbleBust)return {kind:'bust',title:'Out on the bubble',detail:`You finished ${view.result?.place}th — one spot from the money.`};
 if(next.bubble&&!prev.bubble)return {kind:'win',title:'On the bubble',detail:`${view.playersLeft} players left and ${view.placesPaid} get paid. The next player out gets nothing.`};
 return null;
}

/** Patch 56: a small emoji reaction from a bot after a big pot. Decorative, shown only with table talk on. */
export const WIN_EMOTES=['😎','🙌','😏','💰'] as const;
export const LOSS_EMOTES=['😩','🤦','😤','😬'] as const;
const emoteHash=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;};
/**
 * About half of the players who win or lose 25+ big blinds in a hand react, chosen by a hash of the hand and seat so
 * a hand always shows the same reactions. Hero never gets one.
 */
export function seatEmote(view:HeroViewModel|null|undefined,seatId:number,heroId:number):string {
 if(!view||view.street!=='complete'||seatId===heroId)return '';
 const seat=view.seats.find(item=>item.id===seatId);
 if(!seat)return '';
 const swing=(seat.stack-seat.startingStack)/view.profile.bigBlind;
 if(Math.abs(swing)<BIG_POT_BB)return '';
 const h=emoteHash(`${view.handId}:${seatId}`);
 if(h%2)return '';
 const set=swing>0?WIN_EMOTES:LOSS_EMOTES;
 return set[(h>>>1)%set.length];
}
export const emoteMarkup=(emoji:string):string=>emoji?`<span class="seat-emote" aria-hidden="true">${emoji}</span>`:'';
