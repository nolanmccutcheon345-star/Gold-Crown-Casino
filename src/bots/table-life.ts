/** Patch 96: more table life. Players remember who beat them at showdown this session, talk about running hot or
 * cold, tip and blame the dealer, needle the player who re-raised them, and do something with their time after they
 * fold. Talk only: every line comes from names, personalities, public actions, payouts and cards shown at showdown,
 * never from hidden cards, and nothing here reaches a decision. */
import type {GameState} from '../contracts';
import type {TalkLine} from './talk';
import {personaFor} from './personas';

const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;return (h^(h>>>15))>>>0;};
const unit=(seed:string)=>hash(seed)/4294967296;
type Pools=Partial<Record<string,string[]>>&{any:string[]};
const from=(pools:Pools,persona:string,seed:string)=>{const own=pools[persona]??[],all=[...own,...own,...pools.any];return all[hash(seed)%all.length];};
type NameOf=(seatId:number)=>{name:string;regular?:string}|undefined;
const personaOf=(who:NameOf,id:number)=>{const p=who(id);return p?personaFor(p.name,p.regular).id:'';};

/* ---------- Grudges with you ---------- */
/** One earlier showdown between you and other players this session: who was there and who won. */
export interface Showdown {seats:readonly number[];winners:readonly number[];}
/** The showdowns you reached in a list of finished hands (cards were shown, so nothing hidden is used). */
export function heroShowdowns(games:readonly {street:string;seats:readonly {id:number;folded:boolean}[];payouts?:Record<number,number>}[]):Showdown[] {
 return games.filter(g=>g.street==='complete').flatMap(g=>{const live=g.seats.filter(s=>!s.folded).map(s=>s.id);if(live.length<2||!live.includes(0))return [];return [{seats:live,winners:live.filter(id=>(g.payouts?.[id]??0)>0)}];});
}
const PAYBACK:Pools={any:['Payback!','That’s for earlier.','Told you I’d get you back.','We’re even now.','How’s that feel?','Revenge is sweet.'],needler:['Remember that one next time.','Not so easy now, huh?'],comedian:['Revenge tour, night one.','I’ve been waiting all night for that.'],zen:['Even.'],'old-timer':['Patience pays.'],cowboy:['Evened up the score, partner.'],superstitious:['The luck came back around!'],tourist:['I got you back!']};
const AGAIN:Pools={any:['You again?!','Twice in one night.','Okay, you’ve got my number.','I’m moving seats.','Not again.','You’re killing me tonight.'],needler:['Enjoy it. It won’t last.'],comedian:['Can I get a restraining order?'],coach:['You’re playing me well.'],zen:['Again.'],superstitious:['You’re cursed. Or I am.'],'high-roller':['Fine. Keep it.']};
const FIRST:Pools={any:['Nice hand.','You got me.','Good call.','Okay. I see you.','I’ll remember that.'],needler:['Lucky.'],zen:['Mm.']};
/** After a showdown between you and one player: payback if they had lost to you before, "you again" if they keep
 * losing to you. */
export function grudgeLine(game:GameState,before:readonly Showdown[],who:NameOf,taken:readonly number[]):TalkLine|null {
 if(game.street!=='complete')return null;
 const live=game.seats.filter(s=>!s.folded),pay=game.payouts??{};
 if(live.length<2||!live.some(s=>s.id===0))return null;
 const heroWon=(pay[0]??0)>0,seed=`${game.handId}:grudge`;
 const rivals=live.filter(s=>s.id!==0&&!taken.includes(s.id)&&who(s.id));if(!rivals.length)return null;
 const r=rivals[hash(`${seed}:who`)%rivals.length],persona=personaOf(who,r.id);
 const lostToHero=before.filter(x=>x.seats.includes(r.id)&&x.winners.includes(0)&&!x.winners.includes(r.id)).length;
 if(!heroWon&&(pay[r.id]??0)>0&&lostToHero>=1&&unit(seed)<.7)return {seatId:r.id,text:from(PAYBACK,persona,`${seed}:line`)};
 if(heroWon&&!(pay[r.id]??0)&&lostToHero>=1&&unit(seed)<.6)return {seatId:r.id,text:from(AGAIN,persona,`${seed}:line`)};
 if(heroWon&&!(pay[r.id]??0)&&lostToHero===0&&unit(seed)<.15)return {seatId:r.id,text:from(FIRST,persona,`${seed}:line`)};
 return null;
}

/* ---------- Moods out loud ---------- */
const HOT:Pools={any:['I can’t lose tonight.','Running like a god.','Somebody stop me.','Everything’s hitting.','Don’t wake me up.'],grinder:['Good session.'],comedian:['I should buy a lottery ticket on the way home.'],superstitious:['Not changing my socks for a week.'],'high-roller':['This is what happens upstairs too.'],needler:['Who’s next?'],zen:['Good night.'],tourist:['Is it always this easy?!'],cowboy:['Riding high tonight.']};
const TILT:Pools={any:['I can’t win a hand.','Unbelievable night.','Every single time.','I need a break.','This deck hates me.','I’m done. One more. Then I’m done.'],comedian:['Can somebody check if I’m cursed?'],needler:['This game is rigged.'],grinder:['Bad run. It happens.'],coach:['Variance. Just variance.'],superstitious:['I knew I shouldn’t have changed seats.'],zen:['Breathe.'],'old-timer':['Worst night since ’95.'],tourist:['Maybe I should try the slots.'],cowboy:['Been thrown off three times tonight.'],'high-roller':['Whatever. It’s nothing.']};
/** A player running hot or steaming says so, now and then. `mood` is the same public session mood the table uses. */
export function moodLine(seatId:number,name:string,regular:string|undefined,mood:{tilt:number;heater:number},seed:string):TalkLine|null {
 const persona=personaFor(name,regular).id;
 if(mood.tilt>=.5&&unit(`${seed}:tilt`)<.25)return {seatId,text:from(TILT,persona,`${seed}:tline`)};
 if(mood.heater>=.5&&unit(`${seed}:hot`)<.2)return {seatId,text:from(HOT,persona,`${seed}:hline`)};
 return null;
}

/* ---------- The dealer ---------- */
const TOKE:Pools={any:['*tosses the dealer a chip*','Thanks, dealer.','One for the dealer.','*tips the dealer*','Dealer, that one’s yours.'],'high-roller':['*tosses the dealer a big chip*'],grinder:['*tips a dollar*'],comedian:['Dealer, you’re my favourite person tonight.'],cowboy:['Much obliged, dealer. *tips hat*'],tourist:['Thank you so much, dealer!']};
const BLAME:Pools={any:['Dealer, why do you hate me?','New deck, please.','Dealer, I thought we were friends.','Can we get a new dealer?','*glares at the dealer*'],superstitious:['Dealer, can you shuffle with the other hand?'],comedian:['Dealer, I’m not mad. I’m just disappointed.'],zen:['Not your fault, dealer.'],coach:['Not the dealer’s fault, folks.'],needler:['Dealer’s in on it.']};
/** The winner of a big pot tips or thanks the dealer; the loser of a big one blames them. */
export function dealerLine(game:GameState,who:NameOf,taken:readonly number[]):TalkLine|null {
 if(game.street!=='complete')return null;
 const pay=game.payouts??{},bb=game.profile.bigBlind,pot=Object.values(pay).reduce((a,b)=>a+b,0)/bb,seed=`${game.handId}:dealer`;
 if(pot<20)return null;
 const winner=game.seats.find(s=>s.id!==0&&(pay[s.id]??0)>0&&!taken.includes(s.id)&&who(s.id));
 if(winner&&unit(seed)<.28)return {seatId:winner.id,text:from(TOKE,personaOf(who,winner.id),`${seed}:toke`)};
 const loser=game.seats.find(s=>s.id!==0&&!s.folded&&!(pay[s.id]??0)&&!taken.includes(s.id)&&who(s.id));
 if(loser&&pot>=40&&unit(`${seed}:b`)<.25)return {seatId:loser.id,text:from(BLAME,personaOf(who,loser.id),`${seed}:blame`)};
 return null;
}

/* ---------- Needles in the hand ---------- */
const RERAISED:Pools={any:['Again, {n}?','Every time I raise, {n}.','Of course you raise, {n}.','Okay, {n}. Okay.','Really, {n}?','You and me again, {n}.'],needler:['You don’t have it, {n}.','Nice try, {n}.'],comedian:['{n}, what did I ever do to you?'],coach:['Light three-bet, {n}?'],zen:['Hm.'],'old-timer':['Easy there, {n}.'],cowboy:['Whoa there, {n}.'],tourist:['{n}! So mean!']};
const WAR:Pools={any:['Raising war!','Here we go.','Somebody’s got it.','Ooh, this is getting big.','*leans back to watch*'],comedian:['Get the popcorn.'],coach:['Four-bet pot. Big hands.'],tourist:['This is like TV!']};
/** When one computer player re-raises another, the first one sometimes says something to them by name; a raising
 * war gets a remark from someone watching. Only computer players are needled here; you have the needles you
 * already know. */
export function reraiseLine(game:GameState,who:NameOf):TalkLine|null {
 if(game.street==='complete')return null;
 const acts=game.events.filter(e=>e.type==='action'),last=acts.at(-1);
 if(!last||last.action?.type!=='raise'||last.seatId===undefined||last.seatId===0)return null;
 const street=acts.filter(e=>e.street===last.street&&e.action?.type==='raise'),prev=street.at(-2),seed=`${game.handId}:${acts.length}:reraise`;
 if(street.length>=3){const watchers=game.seats.filter(s=>s.folded&&s.id!==0&&who(s.id));if(watchers.length&&unit(seed)<.4){const w=watchers[hash(`${seed}:w`)%watchers.length];return {seatId:w.id,text:from(WAR,personaOf(who,w.id),`${seed}:war`)};}}
 if(!prev||prev.seatId===undefined||prev.seatId===0||prev.seatId===last.seatId||!who(prev.seatId)||!who(last.seatId))return null;
 if(unit(`${seed}:needle`)>=.3)return null;
 const name=who(last.seatId)!.name.split(' ')[0];
 return {seatId:prev.seatId,text:from(RERAISED,personaOf(who,prev.seatId),`${seed}:line`).replace('{n}',name)};
}

/* ---------- What players do after they fold ---------- */
const IDLE:Pools={any:['on the phone','watching the TV','stacking chips','talking to the waitress','stretching','checking scores','sipping a drink','looking around the room','eating a snack','texting','shuffling chips','people-watching'],
 comedian:['joking with the dealer','making faces at a neighbour'],grinder:['headphones on','checking a hand tracker','watching another table'],'old-timer':['reading the paper','telling the dealer a story'],tourist:['taking photos','waving to friends at the bar'],needler:['staring at the action','smirking'],storyteller:['telling a neighbour a story'],superstitious:['rearranging a lucky charm','tapping the table'],cowboy:['adjusting hat','leaning back'],coach:['writing in a notebook','watching the hand closely'],rookie:['reading the hand rankings card','watching closely'],'high-roller':['on a call','checking a gold watch'],zen:['eyes closed','sitting quietly']};
/** What a player who folded is doing while the hand plays out, if anything (about four in ten). */
/* Patch 104: more things players do while they wait. */
for(const [k,v] of Object.entries({any:['ordering a drink','riffling chips','counting their stack','reading the menu','watching the high-limit table','yawning','chatting with a neighbour','checking the waitlist board','cracking their knuckles','tipping the cocktail waitress','putting on a jacket','scrolling photos'],comedian:['doing an impression of the floor man','telling a joke to the dealer'],grinder:['taking notes on a phone','watching the turn card from a distance'],'old-timer':['cleaning their glasses','talking about the old card room'],tourist:['posting a selfie','asking the dealer about the rules'],needler:['rolling their eyes at a neighbour','muttering about the last hand'],storyteller:['halfway through a long story'],superstitious:['blowing on a lucky coin','straightening a card protector'],zen:['breathing slowly, eyes closed'],cowboy:['adjusting a hat'],'high-roller':['peeling off a tip for the dealer'],coach:['explaining a hand to a neighbour'],rookie:['reading a strategy card under the table']} as Record<string,string[]>))(IDLE as Record<string,string[]>)[k]=[...((IDLE as Record<string,string[]>)[k]??[]),...v];
export function idleActivity(name:string,regular:string|undefined,seed:string):string|null {
 if(unit(`${seed}:idle`)>=.42)return null;
 return from(IDLE,personaFor(name,regular).id,`${seed}:what`);
}

/* ---------- Heads-up ---------- */
const HU:Record<'heroBig'|'villainBig'|'lead'|'chat',Pools>={
 heroBig:{any:['Nice pot.','Okay, you got that one.','Well played.','I’ll get it back.','Hm. Good hand.'],needler:['Lucky.'],comedian:['Ouch. My wallet felt that.'],coach:['Good line.'],zen:['Mm.']},
 villainBig:{any:['Thank you.','I’ll take that.','Sorry, had it.','That’s heads-up.','Gotta pay to see.'],needler:['Too easy.'],comedian:['I promise I’m not this good usually.'],cowboy:['Yeehaw.'],zen:['Good.']},
 lead:{any:['Close match.','Back and forth.','Anyone’s game.','This is fun.','Long way to go.'],coach:['Good match so far.'],tourist:['This is so intense!']},
 chat:{any:['How long have you been playing?','You play here a lot?','Good match.','Want a drink? I’m getting one.','I like heads-up. No hiding.'],comedian:['Just you and me. Like a bad first date.'],'old-timer':['Heads-up was all we played in my day.'],superstitious:['I always win the third hand. Watch.']},
};
/** A heads-up opponent's word after a hand that matchLine left quiet. `netBB` is your result on the hand. */
export function headsUpExtra(name:string,regular:string|undefined,netBB:number,heroShare:number,seed:string):string|null {
 const persona=personaFor(name,regular).id;
 if(netBB>=15&&unit(`${seed}:hb`)<.45)return from(HU.heroBig,persona,`${seed}:l`);
 if(netBB<=-15&&unit(`${seed}:vb`)<.45)return from(HU.villainBig,persona,`${seed}:l`);
 if(Math.abs(heroShare-.5)<.08&&unit(`${seed}:lead`)<.1)return from(HU.lead,persona,`${seed}:l`);
 if(unit(`${seed}:chat`)<.07)return from(HU.chat,persona,`${seed}:l`);
 return null;
}

/* ---------- Patch 98: when you take a long time ---------- */
const WAITING:Pools={any:['Take your time.','Big decision.','No rush.','*waits*','Whenever you’re ready.','Somebody’s thinking hard.'],needler:['Clock’s ticking…','Any day now.','We’re not getting younger.'],comedian:['Should I order dinner?','I’ll just take a nap then.'],coach:['Tough spot. Think it through.'],zen:['…'],'old-timer':['Take all the time you need, kid.'],grinder:['*sighs*'],tourist:['Ooh, suspense!'],'high-roller':['Tick tock.'],cowboy:['Ain’t no rush, partner.']};
const CALL_TIME:Pools={any:['Time?','Clock, please. Kidding. Mostly.','Dealer, can we get a clock?','Hello?','Did you fall asleep?'],needler:['Clock! Clock!'],zen:['*looks at the clock*'],comedian:['I aged a year.']};
/** Somebody at the table speaks up while you think: after ~9 seconds a remark, after ~22 seconds a playful "time".
 * Only players with a name and a seat speak; the one closest in the order after you is likeliest. */
export function heroTankLine(game:GameState,who:NameOf,seconds:number):TalkLine|null {
 if(game.street==='complete'||game.actor!==0||seconds<9)return null;
 const seed=`${game.handId}:${game.revision}:tank`,late=seconds>=22;
 if(unit(`${seed}:${late?'late':'early'}`)>=(late?.75:.55))return null;
 const seats=game.seats.filter(s=>s.id!==0&&who(s.id)&&s.stack+s.totalCommitted>0);if(!seats.length)return null;
 const s=seats[hash(`${seed}:${late?'l':'e'}:who`)%seats.length];
 return {seatId:s.id,text:from(late?CALL_TIME:WAITING,personaOf(who,s.id),`${seed}:${late}`)};
}

/* ---------- Patch 98: sweating an all-in ---------- */
const SWEAT:Pools={any:['One time!','Blank, blank!','Come on…','Dealer, be nice.','Don’t do it, dealer.','*can’t look*','*stands up*','Here we go…','*holds breath*','Please, please, please.'],superstitious:['*taps the table three times*','Lucky chip, now!'],comedian:['I can’t watch. Tell me when it’s over.'],zen:['*watches calmly*'],cowboy:['Hold on tight…'],tourist:['Oh my gosh, oh my gosh!'],needler:['Run it. Go ahead.'],'old-timer':['Seen this movie before.'],grinder:['*stares at the board*']};
/** While an all-in runs out on the turn or river, a computer player in it reacts. The words say nothing about who
 * is ahead. */
export function sweatLine(game:GameState,who:NameOf):TalkLine|null {
 if(game.street!=='turn'&&game.street!=='river')return null;
 const live=game.seats.filter(s=>!s.folded);if(live.length<2||live.filter(s=>!s.allIn&&s.stack>0).length>1||!live.some(s=>s.allIn))return null;
 const seed=`${game.handId}:${game.board.length}:sweat`;if(unit(seed)>=.6)return null;
 const bots=live.filter(s=>s.id!==0&&who(s.id));if(!bots.length)return null;
 const s=bots[hash(`${seed}:who`)%bots.length];
 return {seatId:s.id,text:from(SWEAT,personaOf(who,s.id),`${seed}:line`)};
}

/* ---------- Patch 98: hellos and goodbyes ---------- */
const BYE:Pools={any:['See ya, {n}.','Bye, {n}! Drive safe.','Later, {n}.','Take care, {n}.','Good luck, {n}.'],needler:['Don’t let the door hit you, {n}.'],comedian:['{n}, you forgot your dignity!'],'old-timer':['Good night, {n}.'],cowboy:['Happy trails, {n}.'],zen:['Bye.'],tourist:['Bye, {n}! So nice to meet you!']};
const WELCOME:Pools={any:['Welcome, {m}.','Hey, {m}. Good luck.','Fresh face! Welcome, {m}.','Pull up a chair, {m}.','Evening, {m}.'],needler:['Welcome, {m}. Bring money?'],comedian:['{m}! We were just talking about you.'],cowboy:['Howdy, {m}.'],grinder:['Hey.'],zen:['Welcome.']};
const REBUY:Pools={any:['Back for more?','Rebuy! That’s the spirit.','Round two.','Here we go again.'],needler:['Thanks for the reload.'],comedian:['The ATM is working, I see.'],coach:['Fresh stack, fresh start.'],zen:['Good luck.']};
/** At the start of a hand after the table changed: someone says goodbye to the player who left and welcomes the one
 * who sat down, or remarks on a rebuy. `news` is the table's own announcement ("X leaves. Y sits down.", "X rebuys."). */
export function farewellLine(game:GameState,news:readonly string[],who:NameOf):TalkLine|null {
 const seed=`${game.handId}:farewell`;if(unit(seed)>=.55)return null;
 for(const line of news){
  const sat=/^((?:[A-Z][^\s]*\s)+)[a-z][^.]*\. (.+?) sits down\./.exec(line);
  if(sat){const leaver=sat[1].trim(),arrived=sat[2].trim(),newSeat=game.seats.find(s=>s.name===arrived)?.id;
   const others=game.seats.filter(s=>s.id!==0&&s.id!==newSeat&&who(s.id));if(!others.length)continue;
   const s=others[hash(`${seed}:who`)%others.length],p=personaOf(who,s.id);
   const text=unit(`${seed}:which`)<.5?from(BYE,p,`${seed}:bye`).replace('{n}',leaver.split(' ')[0]):from(WELCOME,p,`${seed}:hi`).replace('{m}',arrived.split(' ')[0]);
   return {seatId:s.id,text};}
  const re=/^(.+?) rebuys\./.exec(line);
  if(re){const id=game.seats.find(s=>s.name===re[1].trim())?.id,others=game.seats.filter(s=>s.id!==0&&s.id!==id&&who(s.id));if(!others.length)continue;
   const s=others[hash(`${seed}:rwho`)%others.length];return {seatId:s.id,text:from(REBUY,personaOf(who,s.id),`${seed}:rebuy`)};}
 }
 return null;
}

/* ---------- Patch 98: they remember what you told them ---------- */
const CALLBACK:Record<string,string[][]>={
 from:[['How long you lived around here?','Born and raised here?'],['How’s the trip going?','Enjoying our little town?'],['Still not telling, huh?','Mystery guest strikes again.']],
 often:[['See you next week, I guess.','Same time next week?'],['Not bad for your first time here.','How’s the first night treating you?'],['Told you, this place grows on you.','Too much, you said? Ha.']],
 game:[['Cash player, huh? Makes sense now.'],['Got a tournament this week?'],['Doing a bit of everything tonight.']],
 team:[['Boomer Sooner, right?'],['Go Pokes, right?'],['You’re the only sane one here.']],
 night:[['Still going good?','Still running good?'],['Still a rough one?','Turning around yet?'],['Still having fun?','Fun’s the point, right?']],
 learn:[['Family game coming in handy tonight.'],['You play fast, online player.'],['Seen this on TV, have you?']],
 drink:[['Coffee kicking in yet?'],['Sure you don’t want anything?'],['Water’s on me.']],
 work:[['Secret agent stuff going well?'],['What do you coach, anyway?'],['Long day at the office, pro?']],
};
/** Later in the session, a player brings up something you told them. `answers` are your answers so far. */
export function callbackLine(game:GameState,answers:readonly {question:string;answer:number}[],who:NameOf,taken:readonly number[]):TalkLine|null {
 if(game.street!=='complete'||!answers.length)return null;
 const seed=`${game.handId}:callback`;if(unit(seed)>=.06)return null;
 const a=answers[hash(`${seed}:which`)%answers.length],pool=CALLBACK[a.question]?.[a.answer];if(!pool?.length)return null;
 const seats=game.seats.filter(s=>s.id!==0&&!taken.includes(s.id)&&who(s.id));if(!seats.length)return null;
 const s=seats[hash(`${seed}:who`)%seats.length];
 return {seatId:s.id,text:pool[hash(`${seed}:line`)%pool.length]};
}

/* ---------- Patch 98: the player at the next slot machine ---------- */
const NEIGHBOURS=['Dot','Earl','Rosie','Gloria','Lou','Hank','Frank','Brenda','Sal','Monty'];
const SLOT:Record<'hello'|'big'|'nice'|'feature'|'cold',Pools>={
 hello:{any:['Good luck, hon.','This one paid me last week.','Hope it’s hot for you.','Evening!'],superstitious:['Rub the screen first. For luck.'],'high-roller':['Penny slots? Cute.'],tourist:['First time on this one too!']},
 big:{any:['Whoa! Look at that!','Big winner over here!','Hey! Share the luck!','Now that’s a hit!','You did it!'],comedian:['Can I have your machine when you’re done?'],superstitious:['I KNEW it was hot!'],needler:['Beginner’s luck.'],'old-timer':['Haven’t seen one like that in years.'],tourist:['Oh my gosh! Can I take a picture?']},
 nice:{any:['Nice one.','There you go.','Little win!','Keep it going.'],grinder:['Nice.'],zen:['Good.']},
 feature:{any:['Bonus! Here we go!','Ooh, feature time.','I love that bonus round.'],tourist:['What happens now?!']},
 cold:{any:['This one’s cold tonight.','Try a different machine, maybe.','Mine’s not paying either.','They tightened them up, I swear.'],superstitious:['Switch machines. Trust me.'],comedian:['The machine’s winning. As usual.'],coach:['Lower your bet and ride it out.']},
};
/* Patch 104: small talk from the next machine, and more to say. */
(SLOT as Record<string,Pools>).chat={any:['Been on this machine since lunch.','Do you ever win on these? Honestly?','My other half’s in the poker room.','I like the sounds more than the money.','They just changed the carpet in here.','Want a drink? The waitress is coming.','This one paid me last week. Then nothing.','I’m on my last twenty. Then it’s the buffet.'],comedian:['I’ve fed this thing so much it should call me Mom.'],superstitious:['Rub the screen first. Always rub the screen.'],'old-timer':['Back in my day these had handles.'],tourist:['Is this the one from the commercial?'],needler:['Bet you’re down. Everybody’s down.'],zen:['I just like the lights.'],grinder:['Max bet or nothing. That’s my rule.']};
for(const [k,v] of Object.entries({big:['Ring the bell! Somebody ring the bell!','That’s a hand-pay! Get the attendant!','I’m sitting next to you all night now.'],nice:['Now we’re cooking.','Little by little.','That’ll keep you going.'],feature:['Free spins! Good luck!','Here comes the fun part.','Come on, multipliers!'],cold:['Machine’s on a diet tonight.','Try the one by the door.','Feed it slower.'],hello:['Evening, neighbour.','Good luck on that one.','Mind the noise, mine’s loud.']} as Record<string,string[]>)){const pool=(SLOT as Record<string,Pools>)[k];if(pool)pool.any=[...pool.any,...v];}
/** Who is at the next machine (the same person for a machine), and what they say about your last spin, if anything.
 * `spins` counts your spins this visit; `recent` are your last results. Display only. */
export function slotNeighbour(machine:string,spins:number,last:{total:number;bet:number;feature:boolean;big:boolean},recent:readonly {total:number}[]):{name:string;text:string}|null {
 const name=NEIGHBOURS[hash(`${machine}:neighbour`)%NEIGHBOURS.length],persona=personaFor(name).id,seed=`${machine}:${spins}:nb`;
 let kind:keyof typeof SLOT|null=null;
 if(spins===1&&unit(`${seed}:hi`)<.5)kind='hello';
 else if(last.big)kind=unit(`${seed}:b`)<.85?'big':null;
 else if(last.feature)kind=unit(`${seed}:f`)<.45?'feature':null;
 else if(last.total>=5*last.bet)kind=unit(`${seed}:n`)<.3?'nice':null;
 else if(recent.length>=12&&recent.slice(-12).every(r=>r.total===0))kind=unit(`${seed}:c`)<.25?'cold':null;
 if(!kind&&spins>3&&unit(`${seed}:chat`)<.06)kind='chat' as keyof typeof SLOT;
 return kind?{name,text:from(SLOT[kind],persona,`${seed}:${kind}`)}:null;
}
