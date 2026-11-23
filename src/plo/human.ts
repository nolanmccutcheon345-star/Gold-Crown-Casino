/** Patch 75: what makes the Omaha players feel like people. Everything here uses only what the table saw: a player's
 * own cards, the board, the betting, and hands turned face up. Nothing reads another player's hidden cards.
 *
 * - Think time and timing tells: recreational players snap-call draws and tank before betting big hands; the pros
 *   keep a steady rhythm and sometimes fake it (a long think with the nuts).
 * - Moods: losing a big pot with a strong hand tilts a player for a while (looser, more aggressive, more bluffs);
 *   winning a big pot puts them on a heater (looser, more confident).
 * - Memory of you: how often you raise and whether your big bets turned out to be bluffs, across sessions. Players who
 *   pay attention call your bets lighter when you bluff a lot and fold more when you never do.
 * - Table talk, and mucking: a beaten hand is often thrown away unseen, more by the pros than by the fun players. */
import type {Card} from '../contracts';
import type {PloHand} from './engine';
import type {PloPersonality} from './bots';

export type PloMood='tilt'|'heater';
export interface PloMoodState {mood:PloMood;hands:number}
/** Hero, as the table has seen Hero play. */
export interface PloReads {actions:number;raises:number;bigBets:number;bigBetsShownWeak:number;bigBetsShownStrong:number}
export const EMPTY_READS:PloReads={actions:0,raises:0,bigBets:0,bigBetsShownWeak:0,bigBetsShownStrong:0};

/** Whether a player is a seasoned pro (steady, observant) or plays for fun. */
export const isPro=(p:PloPersonality)=>p.id==='birdie'||p.id==='mae'||p.id==='cash';
/** How much this player watches other players. */
export const attention=(p:PloPersonality)=>isPro(p)?.9:p.id==='quinn'||p.id==='zora'?.5:.25;

/** A personality as it plays right now: moods and what it knows about Hero shift it. `facingHero` is true when the bet
 * to answer is Hero's. */
export function adjusted(p:PloPersonality,mood:PloMoodState|undefined,reads:PloReads,facingHero:boolean):PloPersonality {
 let {looseness,aggression,bluff,stubborn}=p;
 if(mood?.mood==='tilt'){looseness+=.2;aggression+=.2;bluff+=.12;stubborn+=.15;}
 if(mood?.mood==='heater'){looseness+=.12;aggression+=.08;}
 if(facingHero&&reads.bigBets>=4){
  const shown=reads.bigBetsShownWeak+reads.bigBetsShownStrong;
  const bluffy=shown>=3?reads.bigBetsShownWeak/shown:null,raisy=reads.actions>=30?reads.raises/reads.actions:null;
  const k=attention(p);
  if(bluffy!==null&&bluffy>=.4)stubborn+=.25*k;else if(bluffy!==null&&bluffy===0)stubborn-=.2*k;
  if(raisy!==null&&raisy>.35)stubborn+=.1*k;
 }
 const c=(x:number)=>Math.max(0,Math.min(1,x));
 return {...p,looseness:c(looseness),aggression:c(aggression),bluff:c(bluff),stubborn:c(stubborn)};
}

/** Bet sizes people actually use. Fun players like half pot and small bets; the pros mostly pot it. */
export function sizeChoice(p:PloPersonality,min:number,max:number,strong:boolean,u:number):number {
 if(max<=min)return max;
 const frac=isPro(p)?(u<.7?1:.66):p.id==='otto'||p.id==='rusty'?(u<.5?.5:u<.8?.33:1):p.id==='quinn'?(strong?1:.5):(u<.5?.66:u<.8?.5:1);
 const to=Math.round((min+(max-min)*frac)/50)*50;
 return Math.max(min,Math.min(max,to));
}

export type Tempo='snap'|'normal'|'tank';
/** How long a decision takes and how it looks. `strength` is 0–1, `big` is a decision worth a third of the stack or
 * more. Pros mostly keep a steady rhythm and sometimes tank on purpose with a big hand. */
export function thinkTime(p:PloPersonality,action:'fold'|'check'|'call'|'raise',strength:number,big:boolean,u:number):{ms:number;tempo:Tempo} {
 const steady=isPro(p);
 let tempo:Tempo='normal';
 if(steady){if(big&&strength>.8&&u<.35)tempo='tank';else if(big&&u<.2)tempo='tank';}
 else{
  if((action==='call'&&strength<.6&&strength>.25)||(action==='fold'&&!big)||(action==='check'&&strength<.3))tempo=u<.6?'snap':'normal';
  if(action==='raise'&&strength>.75&&big)tempo=u<.65?'tank':'normal';
  if(action==='raise'&&strength<.3)tempo=u<.5?'snap':'normal';
 }
 const ms=tempo==='snap'?250+u*350:tempo==='tank'?2600+u*2400:steady?1100+u*700:600+u*1400;
 return {ms:Math.round(ms),tempo};
}

/* Table talk. Short lines in the player's own voice; one line at a time at most. */
const LINES:Record<string,{hello:string[];bigWin:string[];badBeat:string[];needle:string[];tank:string[];tilt:string[]}>={
 otto:{hello:['Any four can win, right?','Deal me in, deal me in.','Four cards, four times the fun.','Who’s ready to gamble?'],bigWin:['Told you. Any four!','Wheel draw comes through!','Any four, I keep telling you!','Nine-high double-suited, baby!'],badBeat:['Of course the river pairs.','Omaha giveth…','…Omaha taketh.','I had twenty-two outs!'],needle:['Pot it again, see if I care.','I call everything, you know that.','You sure you have it?','I’ll call you down, you know that.'],tank:['Ehh… I gotta see it.','So many ways to win…','Let me count my outs.'],tilt:['Next hand I’m potting blind.','Give me any four. Any four!']},
 birdie:{hello:['Evening.','Good to see everyone.'],bigWin:['Nuts are nice.','Pleasant.','That’ll do.'],badBeat:['That’s Omaha.','Unfortunate.','So it goes.'],needle:['Interesting sizing.','Bold.'],tank:['…','Hmm.'],tilt:['Fine.','Noted.']},
 cash:{hello:['Pot, pot, pot, let’s go.','Johnny’s here, pot it up.'],bigWin:['Pot-pot-pot, baby!','Should’ve folded, friend.','Can’t stop the pot train!','Johnny gets paid!'],badBeat:['Unreal. Unreal.','Every single time.','Ring of fire, man.','Walk the line, river. Walk the line.'],needle:['You can’t pot me off a hand.','Pot. Your move.','Pot it, coward.','Gonna fold again?'],tank:['I know you have it… do you?','Johnny’s thinking. Rare event.'],tilt:['Pot. Every hand. Watch.','Pot, pot, POT.']},
 mae:{hello:['Hi all.','Evening, everyone.'],bigWin:['Thank you.','Lucky me.','Oh, lovely.'],badBeat:['Nice hand.','Well played.','That’s alright.'],needle:['Hm.','Mm-hm.'],tank:['Let me think about this one.','One moment, please.'],tilt:['Taking a breath.','I’ll be fine.']},
 rusty:{hello:['Aces are aces, right?','Anybody got aces? I got aces. Just kidding.'],bigWin:['Pocket aces, never fails!','Aces hold up! Write it down!'],badBeat:['How are aces no good again?','I had the overpair!','Aces cracked AGAIN.','Why do I even play aces?'],needle:['That’s a lot for a pair of kings.','You can’t have it every time.'],tank:['I’ve got a big pair here…','Overpair’s good… right?'],tilt:['Omaha is rigged, I swear.','Next time I’m folding aces. Watch.']},
 zora:{hello:['Double-suited, here we come.','Suits, suits, suits.'],bigWin:['Flush! Ha!','Nut flush, sorry not sorry.'],badBeat:['Wrong flush. Again.','Counterfeited…','Board paired. Of course it paired.','Second-nut flush. Classic.'],needle:['Pretty draw-heavy board for that bet.','That board scares me. Does it scare you?'],tank:['So many draws…','Flush draw, wrap, pair… ugh.'],tilt:['I want my suits back.','I’m only playing rainbow from now on.']},
 'big-al':{hello:['Who wants to gamble?','Big Al’s in the house!','Let’s get it on!'],bigWin:['Big Al eats tonight!','Stack it up!','Al wins! Al always wins!','Somebody count this for me.'],badBeat:['Bring it back next hand.','Oof. Rebuy, honey.','Al don’t care. Al rebuy.','Bad beat, good times.'],needle:['That all you got?','Raise it, I dare you.','Scared money, friend.','You gonna fold to Big Al again?'],tank:['Hmm, hmm, hmm…','Al’s thinking. Gimme a sec.'],tilt:['Straddle me up, I’m running it back.','Al’s mad now. Al’s potting.']},
 quinn:{hello:['Hello.','Hi, sorry, I’m new.'],bigWin:['Oh! Thank you.','Really? Me?','Oh my goodness.'],badBeat:['Oh dear.','That seems unfair.','Oh, I thought I had it.'],needle:['Goodness.','Is that a lot?'],tank:['I don’t know…','Um, sorry, thinking.'],tilt:['Maybe I should go home.','I think I need a break.']},
};
export function line(p:PloPersonality,kind:keyof (typeof LINES)['otto'],u:number):string|null {const set=LINES[p.id]?.[kind];return set?.length?set[Math.floor(u*set.length)%set.length]:null;}

/** A strength from 0 to 1 for timing, from the made hand class at showdown or the player's estimate in a hand. */
export const rankStrength=(rank:number[])=>Math.min(1,rank[0]/8+.06);

/** Players who reach showdown: the last aggressor and anyone who wins shows; a beaten hand may be mucked. */
export function shownAtShowdown(h:PloHand,players:Record<number,PloPersonality>,u:(n:number)=>number):number[] {
 if(!h.showdown.length)return[];
 const winners=new Set(h.pots.flatMap(p=>p.winners)),lastAggressor=[...h.events].reverse().find(e=>e.kind==='action'&&e.action?.type==='raise')?.seatId;
 return h.showdown.filter(id=>{
  if(id===0||winners.has(id)||id===lastAggressor)return true;
  const p=players[id];if(!p)return true;
  return u(100)<(isPro(p)?15:p.id==='otto'||p.id==='big-al'||p.id==='rusty'?70:40);
 });
}

/** After a hand: Hero's actions and any of Hero's big bets the table saw at showdown. */
export function updateReads(reads:PloReads,h:PloHand,shown:number[],heroRank:number[]|null):PloReads {
 const next={...reads};
 const heroActions=h.events.filter(e=>e.kind==='action'&&e.seatId===0);
 next.actions+=heroActions.length;next.raises+=heroActions.filter(e=>e.action?.type==='raise').length;
 const potAt=(i:number)=>h.events.slice(0,i).reduce((a,e)=>a+(e.kind==='blind'?e.amount??0:0),0);
 const big=h.events.some((e,i)=>e.kind==='action'&&e.seatId===0&&e.action?.type==='raise'&&h.street==='complete'&&(e.amount??0)>=Math.max(4*h.bigBlind,potAt(i)));
 if(big){next.bigBets++;if(shown.includes(0)&&heroRank){if(heroRank[0]<=1)next.bigBetsShownWeak++;else if(heroRank[0]>=4)next.bigBetsShownStrong++;}}
 return next;
}

/** Mood after a hand for one player. A strong hand (two pair or better at showdown) that lost 40+ big blinds tilts;
 * winning 40+ big blinds is a heater. Moods fade after some hands. */
export function nextMood(prev:PloMoodState|undefined,net:number,bigBlind:number,lostStrong:boolean,u:number):PloMoodState|undefined {
 if(net<=-40*bigBlind&&lostStrong)return {mood:'tilt',hands:6+Math.floor(u*8)};
 if(net>=40*bigBlind)return {mood:'heater',hands:5+Math.floor(u*6)};
 if(!prev)return undefined;
 return prev.hands>1?{...prev,hands:prev.hands-1}:undefined;
}
export type {Card};
