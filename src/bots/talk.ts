/** Table talk and voluntarily shown cards after a hand. Screen only: nothing here changes a
 * decision or the saved hand. Deterministic per hand, so a redraw shows the same lines.
 * Short, friendly, in-character lines; designed flavour, not a model of real players. */
import {personaFor} from './personas';
import type {Archetype,BotProfile,Card,GameState} from '../contracts';
import {completeProfile} from './profiles';
import {handFeatures} from './features';
import {handResults,tiltProneness} from './human';
import {REGULARS} from './regulars';
import {GRUDGE_LINES,bigPot} from './rivalry';
import {beatIn,revealedAtShowdown} from './insight';
import {MISREAD_LINES,invitedMisread,misreadChance} from './misreads';
/** What players say right after a bad beat or a cooler (patch 45). */
export const BEAT_LINES={'bad-beat':['Unbelievable. On the river.','How do you call that?','Every single time.','You needed one card.','Of course it comes.'],cooler:['Nothing I could do.','Cooler.','Set over set. Sick.','Can’t get away from that one.']};

/** Patch 64: showdown reactions to a bluff caught either way. */
export const SHOWDOWN_LINES={caught:['You caught me.','Worth a shot.','Had to try.','Yeah, I had nothing.'],readHero:['Knew it.','I had a feeling about that one.','You looked nervous.','Not this time.']};
export interface Persona {name:string;profile:BotProfile;regular?:string;}
export interface TalkLine {seatId:number;text:string;}
export interface ShownHand {seatId:number;cards:Card[];why:'bluff'|'strong';}
export interface Chatter {lines:TalkLine[];shows:ShownHand[];}
export const QUIET:Chatter=Object.freeze({lines:[],shows:[]}) as Chatter;

type Bank='win'|'loss'|'bust'|'compliment'|'showBluff'|'showStrong';
const GENERIC:Record<Bank,string[]>={
 win:['Ship it.','I’ll take that.','Finally.','That’ll play.','Thanks, everyone.'],
 loss:['Unreal.','Every time.','Of course.','Wow. Okay.','Can’t win one.'],
 bust:['GG, all.','Good game, everyone.','That’s me. Good luck.'],
 compliment:['Nice hand.','Good call.','Well played.'],
 showBluff:['Had to show that one.','I had nothing.','Your move.'],
 showStrong:['Had it.','Just so you know.','I always have it.'],
};
const STYLE:Partial<Record<Archetype,Partial<Record<Bank,string[]>>>>={
 maniac:{win:['Raise it up!','Who’s next?'],showBluff:['Any two cards.','Keep folding.']},
 station:{loss:['I had to see it.'],compliment:['I had to see it.']},
 'passive-reg':{win:['Oh nice, me?'],loss:['Oh well, it’s only chips.']},
 nit:{win:['Finally a hand.']},
};
const REGULAR_LINES:Record<string,Partial<Record<Bank,string[]>>>={
 'big-earl':{win:['Told you I was calling.'],loss:['I had to see it.']},
 vince:{win:['Raise it up!'],showBluff:['Any two cards, baby.']},
 nina:{win:['Finally a hand.']},
 marco:{showBluff:['Too big for you?']},
 dot:{loss:['Oh well, it’s only chips.']},
 priya:{win:['Good pot.']},
 hank:{loss:['I knew I should have folded.']},
 tess:{win:['Slow and steady.']},
 rocco:{loss:['Should’ve given up on the turn.']},
 lena:{showBluff:['Bet you thought I had it.']},
 gus:{win:['Double up!'],bust:['Shoved too soon again. GG.']},
 mei:{win:['Nice.']},
 duke:{win:['Keep folding, folks.']},
 sal:{win:['Beginner’s luck!'],loss:['Was that bad?']},
 ruth:{win:['Told you.']},
 theo:{win:['Button’s mine.']},
 ivy:{win:['Got there.']},
 frank:{loss:['This deck hates me.','Unbelievable.']},
 ana:{showBluff:['Balanced.']},
 walt:{loss:['Had to keep you honest.']},
};
/** Patch 59: more lines per regular so each sounds like themselves. Screen-only flavour, merged with the lines above. */
export const VOICES:Record<string,Partial<Record<Bank,string[]>>>={
 'big-earl':{win:['See? Gotta pay to play.','Earl eats tonight.','Never fold, never lose.'],loss:['I just had a feeling.','Somebody had to look.'],compliment:['You got me fair.'],showStrong:['Earl don’t bluff.']},
 vince:{win:['Too easy!','Stack ’em up!','Who wants some more?'],loss:['Run it back!','Lucky.','I’ll get it back.'],showBluff:['Air ball!','Seven-deuce, baby.'],compliment:['Okay, okay. Nice.']},
 nina:{win:['I’ll take it.','Patience pays.'],loss:['Hm.','Fine.'],compliment:['Good hand.']},
 marco:{win:['Easy money.','Thought so.'],loss:['Not again.','Luckbox.'],showBluff:['Read that one.','Thanks for folding.'],showStrong:['Pay me next time.']},
 dot:{win:['Oh! Is that mine?','Lovely!','Look at that.'],loss:['Oh dear.','Never mind.'],compliment:['Well done, dear.']},
 priya:{win:['Thanks.','Mm-hm.'],loss:['Okay.','Close.'],compliment:['Nicely played.']},
 hank:{win:['Huh. Didn’t expect that.','Well, I’ll be.'],loss:['Should’ve folded.','Every darn time.'],compliment:['You had it.']},
 tess:{win:['Steady wins.','One at a time.'],loss:['That’s poker.'],compliment:['Good call.']},
 rocco:{win:['Knew it.','Called it.'],loss:['I had you on the turn.','Brutal river.'],compliment:['Fair enough.']},
 lena:{win:['Gotcha.','Thought you’d fold.'],loss:['Sneaky.','Okay, you win that one.'],showBluff:['Never had it.','Keep guessing.']},
 gus:{win:['All day!','Shove life!'],loss:['Too early again.','Classic Gus.'],bust:['That’s Gus for you. GG.']},
 mei:{win:['Okay.','Mm.'],loss:['Unlucky.']},
 duke:{win:['Fold more, folks.','The Duke abides.'],loss:['Even the Duke loses one.'],showStrong:['You’re welcome.']},
 sal:{win:['Wait, I won?','Is this good?','Woo!'],loss:['Was that bad?','I thought flushes were good.'],compliment:['Teach me that!']},
 ruth:{win:['As expected.'],loss:['Mm.'],compliment:['Good.']},
 theo:{win:['Position, people.','Button magic.'],loss:['Out of position. Should know better.']},
 ivy:{win:['There it is.','Got there.'],loss:['So close.']},
 frank:{win:['About time.','Finally, this deck.'],loss:['Rigged, I swear.','Story of my life.','Who shuffled this?'],compliment:['Sure, sure. Nice.']},
 ana:{win:['Expected value.','Math wins.'],loss:['Variance.','Within range.'],showBluff:['Polarized.']},
 walt:{win:['Had to see it. Glad I did.'],loss:['Kept you honest.','Worth a look.']},
 bubba:{win:['Friday night, baby!','Yeehaw.'],loss:['Aw, shucks.','Next one’s mine.'],compliment:['Good one, partner.']},
 rosie:{win:['Ooh, lucky me!','How fun!'],loss:['Oh well, I wanted to see it.'],compliment:['Lovely hand!']},
 tex:{win:['Let it ride!','Big Tex likes big pots.'],loss:['Win some, lose some.','Easy come, easy go.'],showBluff:['Never had a thing.']},
 gloria:{win:['Only play the good ones.','Aces, dear.'],loss:['Hmph.'],showStrong:['I only play premiums.']},
 mikey:{win:['Hit it.','Flop was good to me.'],loss:['Missed. Moving on.']},
 lou:{win:['Old school.','Tight is right.'],loss:['Back in my day…'],compliment:['Well played, son.']},
 kenny:{win:['Lead and win.','Took it down.'],loss:['Should’ve checked.']},
 dante:{win:['Good pot.','Solid.'],loss:['That’s the game.'],compliment:['Nice.']},
 yuki:{win:['The turn is mine.','Pressure works.'],loss:['Too many barrels.']},
 brenda:{win:['Gotcha with the check-raise.','Check, then boom.'],loss:['You didn’t bet!']},
 omar:{win:['Fundamentals.','Textbook.'],loss:['Right play, wrong result.'],compliment:['Well reasoned.']},
 pete:{win:['Action Pete strikes!','Splash it around!'],loss:['Worth it for the fun.','Pete’s bank is open.']},
 carla:{win:['Three-bet and done.'],loss:['Should’ve four-bet.']},
 jules:{win:['Small raise, big pot.'],loss:['Min-raise, max pain.']},
 viktor:{win:['Again.','Keep coming.'],loss:['Next hand.']},
 sasha:{win:['Light three-bet works.'],loss:['Caught.'],showBluff:['Too light? Maybe.']},
 hiro:{win:['As planned.'],loss:['Acceptable variance.'],compliment:['Precise.']},
 elena:{win:['Found your leak.','Noted.'],loss:['Adjusting.']},
 monty:{win:['Drinks on me!','Money, money!'],loss:['Plenty more where that came from.','Put it on my tab.']},
 nadia:{win:['Thin value.','Every chip counts.'],loss:['Ouch, thin.']},
};
/** Patch 59: what a talkative regular might say as they act, mid-hand. Chosen from the action alone, never the cards. */
export type ActionKind='fold'|'check'|'call'|'bet'|'raise'|'allin';
export const ACTION_LINES:Record<ActionKind,string[]>={
 fold:['Too rich for me.','I’m out.','Not this time.','Fold.'],
 check:['Check.','I’ll check.','Your go.'],
 call:['I call.','Fine, I’ll look.','Call.','Let’s see one.'],
 bet:['Bet.','Let’s make it interesting.','A little something.'],
 raise:['Raise.','Make it more.','Up it goes.'],
 allin:['All in.','Everything.','Let’s gamble.','I’m all in.'],
};
const VOICE_ACTIONS:Record<string,Partial<Record<ActionKind,string[]>>>={
 vince:{raise:['Raise it up!','More!'],allin:['Ship it in!']},
 sal:{call:['Is calling good here?'],check:['Uh… check?']},
 'big-earl':{call:['Earl calls.','Gotta see it.']},
 frank:{fold:['Garbage again.'],call:['Fine. Probably beat.']},
 dot:{call:['Oh, I’ll play along.'],check:['Check, dear.']},
 gus:{allin:['Shove!','All of it!']},
 duke:{bet:['Bet. Try me.']},
 marco:{raise:['Too big for you?']},
 theo:{raise:['Raising on the button.']},
};
/** Patch 60: lines aimed at Hero after a big pot between them, and replies between two computer players. */
export const AT_HERO={heroWon:['Nice hand. You got me.','Okay, you win that one.','Good call. I was bluffing.','You had it. Fair enough.','I’ll remember that.'],heroLost:['Sorry, had to.','Thanks for the chips.','Better luck next time.','Gotcha.','Tough spot for you.']} as const;
export const REPLIES={toWin:['Enjoy it while it lasts.','Lucky river.','I’ll get you back.','Sure, sure.','Next time.'],toLoss:['That’s poker.','Thanks for paying me.','Should’ve folded.','Rough one.','I had to.'],toCompliment:['Thanks.','Appreciate it.','You too.']} as const;
/** Patch 61: what the regulars call each other in banter. */
export const NICKNAMES:Record<string,string>={'big-earl':'Earl',vince:'Vin',dot:'Dottie',priya:'Pri',rocco:'Rocky',gus:'Gussie',duke:'Duke',theo:'Teddy',frank:'Frankie',walt:'Sheriff',bubba:'Bub',rosie:'Rose',gloria:'Glo',mikey:'Mike',kenny:'Ken',dante:'D',brenda:'Bren',pete:'Pete',viktor:'Vik',monty:'Monty',lou:'Lou',tex:'Tex',hank:'Hank'};
/** Puts a name before a line's closing punctuation: "Lucky river." → "Lucky river, Vin." */
export function withName(line:string,name:string):string {
 const m=/^(.*?)([.!?…]+)$/.exec(line);
 return m?`${m[1]}, ${name}${m[2]}`:`${line}, ${name}`;
}
const ACTION_CHANCE:Record<ActionKind,number>={fold:.05,check:.04,call:.07,bet:.09,raise:.12,allin:.45};
/** Chatty players talk often, quiet ones rarely. */
const TALKATIVE:Record<string,number>={vince:1.6,sal:1.5,'big-earl':1.4,frank:1.5,dot:1.3,gus:1.3,marco:1.2,mei:.35,ruth:.35,priya:.5,nina:.4,ana:.6};
/** Patch 86: a regular's own talkativeness, otherwise their table personality's. */
const chattiness=(persona:Persona)=>persona.regular?TALKATIVE[persona.regular]??1:personaFor(persona.name).chatty;

function unit(seed:string):number {let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const pick=(lines:readonly string[],seed:string)=>lines[Math.floor(unit(seed)*lines.length)];
function line(persona:Persona,bank:Bank,seed:string):string {
 const fixed=persona.regular?REGULAR_LINES[persona.regular]?.[bank]:undefined,voice=persona.regular?VOICES[persona.regular]?.[bank]:undefined;
 const table=persona.regular?undefined:personaFor(persona.name).lines[bank];
 const own=fixed||voice||table?[...(fixed??[]),...(voice??[]),...(table??[])]:undefined,style=STYLE[persona.profile.archetype]?.[bank];
 const pool=[...(own??[]),...(own?own:[]),...(style??[]),...GENERIC[bank]];
 return pool[Math.floor(unit(`${seed}:pick`)*pool.length)];
}
const strength=(cards:Card[],board:Card[])=>cards.length===2?handFeatures(cards,board).strength:0;

/** What computer players say and show once a hand is complete. `hero` never talks or shows here. */
/** `grudgeAt` (layer 1.10.0): each seat's grudge against Hero, for grudge lines after big pots between them. */
/** Tournament moments (policy 2.19.0): what someone at the table says on the bubble, when it bursts, and at the final table. */
export const MOMENT_LINES={bubble:['Hand for hand.','Come on, somebody bust.','Just need to make the money.','Nobody do anything crazy.','I’m folding everything till the bubble pops.','Who’s the short stack? Just asking.','Min-cash or bust, baby.','Tightest table I’ve ever seen.'],burst:['We’re in the money!','Finally. Locked up a cash.','Now we can play.','Gamble time!','Okay, now I can breathe.','Bubble’s gone, let’s go.'],'final-table':['Final table!','Nine left. Let’s go.','Made the final table.','Somebody take a picture.','Final table. Calling my wife.','Big money time.']} as const;
export type TournamentMoment=keyof typeof MOMENT_LINES;
export function handChatter(game:GameState,personas:Record<number,Persona>,options:{hero?:number;tournament?:boolean;grudgeAt?:(seatId:number)=>number;moment?:TournamentMoment|null;allowMisreadTalk?:boolean}={}):Chatter {
 if(game.street!=='complete')return QUIET;
 const hero=options.hero??0,bb=game.profile.bigBlind,results=handResults(game.seats,bb),live=game.seats.filter(s=>s.startingStack>0&&!s.folded);
 const showdown=live.length>=2,heroWon=(game.payouts[hero]??0)>0;
 const rivalryPot=options.grudgeAt?bigPot({identities:Object.fromEntries(game.seats.map(s=>[s.id,String(s.id)])),committed:Object.fromEntries(game.seats.map(s=>[s.id,s.totalCommitted])),won:game.payouts,bigBlind:bb,pots:game.pots}):null;
 const candidates:{seatId:number;priority:number;text:string}[]=[],shows:ShownHand[]=[];
 for(const seat of game.seats){
  const persona=personas[seat.id];if(seat.id===hero||!persona||seat.startingStack<=0)continue;
  const p=completeProfile(persona.profile),r=results.get(seat.id)!,talk=chattiness(persona),seed=`${game.handId}:${seat.id}`;
  const big=Math.max(Math.abs(r.deltaBB)/20,Math.abs(r.share??0)/.5)>=1,won=(game.payouts[seat.id]??0)>0;
  const say=(bank:Bank,priority:number,chance:number,salt:string)=>{if(unit(`${seed}:${salt}`)<Math.min(.95,chance*talk))candidates.push({seatId:seat.id,priority,text:line(persona,bank,`${seed}:${salt}`)});};
  if(options.tournament&&seat.stack===0){say('bust',5,.6,'bust');continue;}
  // Showing a hand after everyone else folded: loose players flash bluffs, weaker players show strong hands.
  if(won&&!showdown&&seat.hole.length===2){
   const s=strength(seat.hole,game.board),bluffy=p.aggression>.7&&p.looseness>.6?.3:p.traits.bluffFrequency>.6?.22:.03,proud=p.skill<.5?.35:.05;
   const kind=s<.35?'bluff':s>=.75?'strong':null,chance=kind==='bluff'?bluffy:kind==='strong'?proud:0;
   if(kind&&unit(`${seed}:show`)<chance){shows.push({seatId:seat.id,cards:[...seat.hole],why:kind});say(kind==='bluff'?'showBluff':'showStrong',4,.7,'showline');continue;}
  }
  // Rivalries: a big pot against Hero, with a grudge already brewing.
  const g=options.grudgeAt?.(seat.id)??0,heroDelta=results.get(hero)?.deltaBB??0;
  if(g>=.4&&big&&r.deltaBB<0&&heroDelta>0&&rivalryPot?.loser===String(seat.id)&&rivalryPot.winner===String(hero)&&unit(`${seed}:grudge`)<.75){candidates.push({seatId:seat.id,priority:5,text:pick(GRUDGE_LINES.lost,`${seed}:gl`)});continue;}
  if(g>=.3&&big&&won&&heroDelta<0&&rivalryPot?.winner===String(seat.id)&&rivalryPot.loser===String(hero)&&unit(`${seed}:grudge`)<.6){candidates.push({seatId:seat.id,priority:5,text:pick(GRUDGE_LINES.won,`${seed}:gw`)});continue;}
  // Patch 60: a big pot against Hero without a grudge: sometimes a word to Hero.
  if(big&&Math.abs(heroDelta)>=20&&seat.hole.length===2){
   if(r.deltaBB<0&&heroDelta>0&&unit(`${seed}:athero`)<.35*talk){candidates.push({seatId:seat.id,priority:3,text:pick(AT_HERO.heroWon,`${seed}:ah`)});continue;}
   if(won&&heroDelta<0&&unit(`${seed}:athero`)<.3*talk){candidates.push({seatId:seat.id,priority:3,text:pick(AT_HERO.heroLost,`${seed}:ah`)});continue;}
  }
  // Misreads: Patch 50 dialogue is opt-in for new policies only, with publicly revealed showdown cards.
  // A plausible error is not proof that this individual decision was caused by misreadPlay.
  if(options.allowMisreadTalk&&!seat.folded&&game.revealedSeats?.includes(seat.id)&&showdown&&r.deltaBB<0&&seat.hole.length===2&&game.board.length===5&&misreadChance(persona.profile)>0&&game.events.some(e=>e.type==='action'&&e.street==='river'&&e.seatId===seat.id&&e.action?.type==='call')){
   const kind=invitedMisread(seat.hole,game.board);
   if(kind&&unit(`${seed}:misread`)<.5*talk){candidates.push({seatId:seat.id,priority:4,text:pick(MISREAD_LINES[kind],`${seed}:ml`)});continue;}
  }
  // Patch 64: a river bluff that got called, or a call that caught Hero bluffing.
  if(showdown&&seat.hole.length===2&&game.board.length===5){
   const river=game.events.filter(e=>e.type==='action'&&e.street==='river'),hero0=game.seats.find(x=>x.id===hero);
   if(r.deltaBB<0&&river.some(e=>e.seatId===seat.id&&e.action?.type==='raise')&&strength(seat.hole,game.board)<.35&&unit(`${seed}:caught`)<.55*talk){candidates.push({seatId:seat.id,priority:4,text:pick(SHOWDOWN_LINES.caught,`${seed}:cl`)});continue;}
   const heroBet=river.filter(e=>e.action?.type==='raise').at(-1);
   if(won&&heroBet?.seatId===hero&&river.some(e=>e.seatId===seat.id&&e.action?.type==='call'&&e.revision>heroBet.revision)&&hero0?.hole.length===2&&!hero0.folded&&strength(hero0.hole,game.board)<.35&&unit(`${seed}:read`)<.5*talk){candidates.push({seatId:seat.id,priority:4,text:pick(SHOWDOWN_LINES.readHero,`${seed}:rl`)});continue;}
  }
  // Bad beats and coolers (patch 45): the loser says something about it. Showdown cards only.
  const beat=showdown&&r.deltaBB<0?beatIn({events:game.events,board:game.board,payouts:game.payouts,revealed:revealedAtShowdown(game.street,game.revealedSeats??[],game.seats),committed:Object.fromEntries(game.seats.map(s=>[s.id,s.totalCommitted])),bigBlind:game.profile.bigBlind},seat.id):null;
  if(beat&&unit(`${seed}:beat`)<Math.min(.9,.45+.45*tiltProneness(p))*talk){candidates.push({seatId:seat.id,priority:5,text:pick(BEAT_LINES[beat.cause],`${seed}:bl`)});continue;}
  if(showdown&&big&&r.deltaBB<0)say('loss',3,.3*(.6+tiltProneness(p)),'loss');
  else if(showdown&&big&&won)say('win',2,.3,'win');
  else if(showdown&&heroWon&&r.showdownLoss)say('compliment',1,.18,'nice');
 }
 if(options.tournament&&options.moment){const pool=game.seats.filter(seat=>seat.id!==hero&&personas[seat.id]&&seat.stack>0&&!candidates.some(c=>c.seatId===seat.id));
  const bank=MOMENT_LINES[options.moment],chance=options.moment==='bubble'?.35:.8;
  if(pool.length&&unit(`${game.handId}:moment`)<chance){const seat=pool[Math.floor(unit(`${game.handId}:who`)*pool.length)];candidates.push({seatId:seat.id,priority:4,text:bank[Math.floor(unit(`${game.handId}:line`)*bank.length)]});}}
 const lines=candidates.sort((a,b)=>b.priority-a.priority||a.seatId-b.seatId).slice(0,2).map(({seatId,text})=>({seatId,text}));
 // Patch 60: banter. When only one player spoke, another computer player in the pot sometimes answers.
 if(lines.length===1){
  const first=lines[0],speaker=results.get(first.seatId),speakerWon=(game.payouts[first.seatId]??0)>0;
  const others=game.seats.filter(seat=>seat.id!==hero&&seat.id!==first.seatId&&personas[seat.id]&&seat.startingStack>0&&(results.get(seat.id)?.deltaBB??0)!==0);
  const opponent=speakerWon?others.filter(seat=>(results.get(seat.id)?.deltaBB??0)<0).sort((a,b)=>(results.get(a.id)!.deltaBB)-(results.get(b.id)!.deltaBB))[0]:others.filter(seat=>(game.payouts[seat.id]??0)>0)[0];
  if(opponent&&speaker){
   const talk=chattiness(personas[opponent.id]),seed=`${game.handId}:${opponent.id}:reply`;
   const bank=speakerWon?REPLIES.toWin:speaker.deltaBB<0&&(game.payouts[opponent.id]??0)>0?REPLIES.toLoss:null;
   if(bank&&unit(seed)<Math.min(.8,.4*talk)){
    const said=pick(bank,`${seed}:pick`),them=personas[first.seatId],nick=them?.regular?NICKNAMES[them.regular]:undefined;
    lines.push({seatId:opponent.id,text:nick&&unit(`${seed}:nick`)<.55?withName(said,nick):said});
   }
  }
 }
 // Patch 86: small talk between hands when nothing else was said: one player starts, another sometimes answers.
 if(!lines.length){
  const seated=game.seats.filter(seat=>seat.id!==hero&&personas[seat.id]&&seat.stack>0);
  if(seated.length){
   const speaker=seated[Math.floor(unit(`${game.handId}:small:who`)*seated.length)],them=personaFor(personas[speaker.id].name,personas[speaker.id].regular);
   if(unit(`${game.handId}:small`)<Math.min(.4,.11*them.chatty)){
    lines.push({seatId:speaker.id,text:pick(them.openers,`${game.handId}:small:line`)});
    const others=seated.filter(seat=>seat.id!==speaker.id);
    if(others.length&&unit(`${game.handId}:small:reply`)<.6){const other=others[Math.floor(unit(`${game.handId}:small:other`)*others.length)];lines.push({seatId:other.id,text:pick(personaFor(personas[other.id].name,personas[other.id].regular).answers,`${game.handId}:small:answer`)});}
   }
  }
 }
 return {lines,shows};
}
/** The regular a saved profile belongs to (by its fixed seed), if any. */
export function regularOfProfile(profile:BotProfile|undefined):string|undefined {
 const seed=Number.parseInt(profile?.personalityId?.split(':')[1]??'',16),index=seed-0x52454700;
 return Number.isInteger(index)&&index>=0&&index<REGULARS.length?REGULARS[index].id:undefined;
}

/**
 * Patch 59: one short line as a computer player acts during a hand, sometimes. It depends only on the public action
 * (its type, and whether it put the player all-in), the player's talkativeness and a seed from the hand, never on cards.
 */
export function actionChatter(game:GameState,personas:Record<number,Persona>,hero=0):TalkLine|null {
 if(game.street==='complete')return null;
 let last:GameState['events'][number]|undefined;
 for(let i=game.events.length-1;i>=0;i--)if(game.events[i].type==='action'){last=game.events[i];break;}
 if(!last?.action||last.seatId===undefined||last.seatId===hero)return null;
 const persona=personas[last.seatId],seat=game.seats.find(s=>s.id===last!.seatId);
 if(!persona||!seat)return null;
 const streetEvents=game.events.filter(e=>e.type==='action'&&e.street===last!.street);
 const opened=streetEvents.slice(0,streetEvents.indexOf(last)).some(e=>e.action?.type==='raise');
 const kind:ActionKind=last.action.type==='raise'?(seat.allIn?'allin':last.street==='preflop'||opened?'raise':'bet'):last.action.type==='call'&&seat.allIn?'allin':last.action.type;
 const talk=chattiness(persona),seed=`${game.handId}:${last.id}:quip`;
 if(unit(seed)>=Math.min(.6,ACTION_CHANCE[kind]*talk))return null;
 const own=persona.regular?VOICE_ACTIONS[persona.regular]?.[kind]:personaFor(persona.name).actions[kind],pool=[...(own??[]),...(own??[]),...ACTION_LINES[kind]];
 return {seatId:last.seatId,text:pool[Math.floor(unit(`${seed}:pick`)*pool.length)]};
}
