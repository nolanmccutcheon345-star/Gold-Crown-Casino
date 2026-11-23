/** Patch 94: more table life. Words aimed at you, players needling each other by name, gestures between hands,
 * mutters during a long think, and answers when you say something. Talk only: lines come from names, personalities
 * and public events (pots, shown cards, how often you have played), never from hidden cards, and nothing here
 * reaches a decision. */
import type {GameState} from '../contracts';
import type {Chatter,TalkLine} from './talk';
import {personaFor} from './personas';
import {replyTo,threadFor,turnsFor} from './conversations';
import {callbackLine,dealerLine,grudgeLine,moodLine,type Showdown} from './table-life';

const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;return (h^(h>>>15))>>>0;};
const unit=(seed:string)=>hash(seed)/4294967296;
const pick=<T>(list:readonly T[],seed:string)=>list[hash(seed)%list.length];
type Moment='heroBigWin'|'heroBigLoss'|'heroCardDead'|'heroAggro'|'heroRiver'|'heroAllInWin'|'heroAllInLoss'|'heroHeater'|'heroColdDeck';
/** What each personality says to you; `any` is used by everyone. */
const TO_HERO:Record<Moment,Partial<Record<string,string[]>>&{any:string[]}>={
 heroBigWin:{any:['Nice pot.','Somebody’s running good.','Okay, okay, I see you.','You can buy the next round.','Well played.','Look at that stack.','Stack those up, friend.','Big one.','I’ll get those back.','That’s a lot of chips.'],
  comedian:['Can I borrow some of that?','Leave some for the rest of us!','Do you take Venmo? Asking for me.','I’ll be your best friend now.'],grinder:['Nice.','Good pot.'],'old-timer':['Reminds me of me, forty years ago.','Now that’s how you play a hand.'],tourist:['Wow! Is that a lot? That looks like a lot!','Can I take a picture of that pile?'],needler:['Lucky.','Even a broken clock.','Enjoy it while it lasts.','Don’t spend it all at once.'],storyteller:['That one’s going in the stories.','I saw a guy win a pot like that in Biloxi. Bought a boat.'],superstitious:['Your seat is hot. I want that seat.','Don’t move. Don’t change anything.'],cowboy:['Well, shoot. Nice pot, partner.','You roped that one good.'],coach:['Good sizing on that one.','Value-bet the river. That’s the money.'],rookie:['How do you know when to do that?','Teach me!'],'high-roller':['Cute. Now do it at 25/50.','Nice. Tip money.'],zen:['Well played.','Good.']},
 heroBigLoss:{any:['Ouch.','Tough spot.','That’s poker.','Unlucky.','Next one’s yours.','Brutal.','Oof.','Rough one.','That hurt to watch.','Shake it off.'],
  comedian:['Look at the bright side: you can’t lose that one again.','Want a tissue? I’ve got a whole box from earlier.'],needler:['Ha! Should’ve folded.','Thanks for the chips.','That was a lot to call with that.','Ouch. For you.'],'old-timer':['Happens to the best of us.','I’ve lost bigger. Keep your head up.'],coach:['Right play, wrong card.','You were ahead when the money went in. That’s all you can do.'],superstitious:['Change your card protector. Trust me.','Did you cross your legs? Never cross your legs.'],cowboy:['Got bucked off that one.','Dust yourself off, partner.'],zen:['It’s fine.','Breathe.'],tourist:['Oh no! Are you okay?'],rookie:['Oh no. I’m so sorry.'],storyteller:['Reminds me of the worst beat I ever took. Want to hear it?']},
 heroCardDead:{any:['You gonna play a hand tonight?','Somebody wake up seat one.','Folding all night, huh?','Waiting for aces?','You still with us?','Patient one, aren’t you.'],
  comedian:['Are you even playing, or just here for the chairs?','You’ve folded more than my laundry.'],needler:['Tightest player in Oklahoma.','Rock alert.'],tourist:['Do you ever get good cards? I don’t either!'],coach:['Patience is a skill. So is stealing blinds.'],'old-timer':['Patience. I like it.','Waiting on the good ones. Smart.'],cowboy:['You fixin’ to play one, partner?'],superstitious:['Your cards are cold. Knock on the table.'],grinder:['Card dead. Happens.']},
 heroAggro:{any:['Easy there, captain.','Another raise? Of course.','Somebody’s feeling frisky.','You raise every hand?','Here we go again.','You’re running this table.'],
  needler:['I’m calling you down next time. Promise.','You can’t have it every time.'],comedian:['Do you have a raise button stuck?','Somebody had coffee.'],coach:['Wide range. I respect it.','Applying pressure. Good.'],'old-timer':['In my day we called that maniac play.'],tourist:['You’re so brave!'],'high-roller':['Finally, somebody playing for real.'],cowboy:['Wild horse over here.'],superstitious:['Don’t make the cards mad.']},
 heroRiver:{any:['Wow, the river.','Of course it was the river.','Dealer, why?','River’s got a mind of its own.'],needler:['Runner-runner. Unbelievable.','The river loves you, huh?'],superstitious:['I knew that river was coming. I felt it.'],comedian:['The river is my ex. Always shows up at the worst time.'],cowboy:['River done washed me away.']},
 heroAllInWin:{any:['You had to have it!','Gutsy.','Ship it!','Good call.','Big double.','That took guts.'],coach:['Good shove. Great spot.'],needler:['Of course it held.'],tourist:['That was so exciting!'],cowboy:['Ride ’em, cowboy!'],comedian:['My heart can’t take this.']},
 heroAllInLoss:{any:['Tough one.','That’s the game.','Rebuy?','Unlucky, friend.','Brutal spot.','You had to go with it.'],needler:['See you next time.','Gonna reload?'],'old-timer':['Shake it off and rebuy.'],coach:['Can’t fold there. You did it right.'],comedian:['Rebuy! The water’s fine!'],zen:['Next one.']},
 heroHeater:{any:['You’re on a heater.','Somebody’s running hot.','Can’t miss tonight, huh?','Save some for the rest of us.'],superstitious:['Don’t talk about it. You’ll break it.'],needler:['Heaters end.'],comedian:['Are you counting cards? This isn’t blackjack.'],'old-timer':['Ride it while it lasts.']},
 heroColdDeck:{any:['Rough night, huh?','It’ll turn.','Cards owe you one.','Hang in there.'],superstitious:['Change seats. Trust me.'],needler:['Maybe try a lower game.'],coach:['Short-term results. Keep making good decisions.'],comedian:['Want me to call you a cab? Or a therapist?']},
};
/** One player to another, by name, after a showdown. */
const RIVAL={beat:['Nice hand, {n}.','You got me, {n}.','Good call, {n}.','Every time, {n}. Every time.','I’ll get you back, {n}.','How did you call that, {n}?','Really, {n}? With that?','Okay, {n}. I see you.','You always have it, {n}.','I’m watching you, {n}.','That’s twice now, {n}.','Fine, {n}. Fine.'],
 win:['Sorry, {n}.','Had to, {n}.','Gotta be lucky to be good.','Thanks for the chips, {n}.','Next time, {n}.','Ha! Not today.','You played it right, {n}.','I’ll buy you a drink, {n}.','Don’t take it personal, {n}.','Somebody had to win it.'],
 byPersona:{needler:{beat:['Lucky river, {n}.','You don’t even know what you had, {n}.'],win:['Easy money, {n}.','Thanks, {n}. Come again.']},comedian:{beat:['{n}, I thought we were friends.','I’m telling your mother, {n}.'],win:['Don’t cry, {n}. It’s just money.']},coach:{beat:['Good line, {n}.'],win:['You were priced in, {n}. Right call.']},'old-timer':{beat:['Well played, young {n}.'],win:['Experience, {n}. Experience.']},cowboy:{beat:['You got me roped, {n}.'],win:['Sorry, partner. {n}, next round’s on me.']},zen:{beat:['Well played.'],win:['Good hand, {n}.']},superstitious:{beat:['{n}, did you touch my chips?'],win:['It’s the socks, {n}.']},tourist:{beat:['Aww, {n}! Nice one!'],win:['Sorry, {n}! I didn’t mean to!']}} as Partial<Record<string,{beat:string[];win:string[]}>>};
/** Things players do between hands. */
const GESTURES:Partial<Record<string,string[]>>&{any:string[]}={
 any:['*stacks chips*','*sips a drink*','*checks phone*','*stretches*','*shuffles chips*','*taps the table*','*orders a coffee*','*cracks knuckles*','*yawns*','*riffles two chip stacks together*','*adjusts chair*','*rubs eyes*','*glances at the TV*','*straightens their chip stacks*','*waves to the cocktail waitress*','*checks the time*','*rolls shoulders*','*drums fingers on the rail*'],
 comedian:['*makes a face at the dealer*','*does a chip trick, drops a chip*','*pretends to cry into a napkin*','*mimes a drumroll*'],grinder:['*adjusts headphones*','*counts chips again*','*scrolls through a hand tracker*','*sips an energy drink*'],'old-timer':['*leans back with a sigh*','*squints at the board*','*polishes reading glasses*','*tells the dealer about 1987*'],tourist:['*takes a selfie with the chips*','*waves at a friend at the bar*','*texts a friend: “I’m winning!”*','*looks around the room, wide-eyed*'],needler:['*smirks*','*stares at you*','*shakes head slowly*','*leans back, arms crossed*'],storyteller:['*leans over to tell the dealer a story*','*starts a story, forgets the ending*'],superstitious:['*taps the table three times*','*rearranges the card protector*','*kisses a lucky chip*','*blows on the cards*'],cowboy:['*tips hat*','*adjusts belt buckle*','*leans back, boots out*'],coach:['*nods slowly*','*writes something in a notebook*','*mouths “pot odds”*'],rookie:['*reads the hand rankings card*','*checks a poker app under the table*','*looks around nervously*'],'high-roller':['*checks a gold watch*','*flicks a chip*','*takes a call: “Buy it.”*','*tosses the dealer a toke*'],zen:['*closes eyes for a moment*','*breathes slowly*','*sips tea*']};
/** Mutters during a long think. Neutral on purpose: they say nothing about the hand. */
const MUTTERS:Partial<Record<string,string[]>>&{any:string[]}={
 any:['Hmm…','Let me think.','What do you have…','Decisions, decisions.','Okay… okay.','Give me a second.','I don’t know about this.','Ugh.','Why do you do this to me.','Let me see here.','Hmm. Hmm.','Tough one.'],
 comedian:['Phone a friend?','Can I get a lifeline?'],coach:['Let me count the combos.','What’s the range here…','Pot odds… pot odds…'],tourist:['Oh boy. Um.','This is so stressful!'],superstitious:['Come on, give me a sign.','Lucky chip, talk to me.'],cowboy:['Well, now.','Hold your horses.'],'old-timer':['Back in my day…','Let an old man think.'],needler:['You don’t have it.','You’re not that brave.'],grinder:['…','Okay.'],'high-roller':['Is this even worth it?','So small. Fine.'],rookie:['Um… what do I do…','Is it still me?'],storyteller:['This is like that hand in Tunica…'],zen:['…','Breathe.']};
/** Players who are out of the hand react to a big bet or an all-in. */
const SPECTATE:Partial<Record<string,string[]>>&{any:string[]}={
 any:['Ooh.','Here we go!','Big bet.','Somebody’s got it.','*leans in*','*whistles*','Uh oh.','Now it’s a hand.','*stops stacking chips to watch*','Oh boy.'],
 comedian:['Popcorn, anyone?','This is better than TV.'],tourist:['Oh my gosh!','This is so exciting!'],needler:['Call. Call. Call.','Somebody’s bluffing.'],coach:['Big decision.','Polarized.'],'old-timer':['Now we’re playing poker.'],superstitious:['Don’t look at the board. Don’t look.'],cowboy:['Yeehaw, here we go.'],zen:['*watches quietly*'],grinder:['*glances up from phone*']};
const say=(pools:Partial<Record<string,string[]>>&{any:string[]},persona:string,seed:string)=>{const own=pools[persona]??[];return pick([...own,...own,...pools.any],seed);};

export interface HeroHistory {
 /** Your last finished hands this session, oldest first: did you put money in voluntarily, did you raise preflop. */
 recent:{played:boolean;raised:boolean;won?:boolean}[];
}
type NameOf=(seatId:number)=>{name:string;regular?:string}|undefined;
/** Something said to you at the end of a hand, if anything. */
export function heroBanter(game:GameState,who:NameOf,history:HeroHistory,taken:readonly number[]):TalkLine|null {
 if(game.street!=='complete')return null;
 const hero=game.seats.find(s=>s.id===0);if(!hero)return null;
 const bb=game.profile.bigBlind,net=((game.payouts?.[0]??0)-hero.totalCommitted)/bb;
 const recent=history.recent.slice(-12),seed=`${game.handId}:hero-banter`;
 let moment:Moment|null=null;
 const riverWin=net>=25&&game.board.length===5&&game.events.some(e=>e.type==='action'&&e.street==='river');
 const allIn=hero.allIn||(hero.stack===0&&hero.totalCommitted>0),wins=recent.slice(-6).filter(h=>h.won).length,losses=recent.slice(-6).filter(h=>h.played&&h.won===false).length;
 if(allIn&&net>0)moment='heroAllInWin';
 else if(allIn&&net<0)moment='heroAllInLoss';
 else if(net>=40)moment=riverWin&&unit(`${seed}:river`)<.4?'heroRiver':'heroBigWin';
 else if(net<=-40)moment='heroBigLoss';
 else if(net>0&&wins>=3)moment='heroHeater';
 else if(net<0&&losses>=4)moment='heroColdDeck';
 else if(recent.length>=12&&recent.every(h=>!h.played))moment='heroCardDead';
 else if(recent.slice(-8).filter(h=>h.raised).length>=5)moment='heroAggro';
 const odds=moment==='heroCardDead'||moment==='heroAggro'||moment==='heroHeater'||moment==='heroColdDeck'?.35:.6;
 if(!moment||unit(`${seed}:chance`)>=odds)return null;
 const seats=game.seats.filter(s=>s.id!==0&&!taken.includes(s.id)&&who(s.id));if(!seats.length)return null;
 const speaker=seats[hash(`${seed}:who`)%seats.length],p=who(speaker.id)!;
 const persona=personaFor(p.name,p.regular).id,pool=TO_HERO[moment];
 return {seatId:speaker.id,text:withNick(pick([...(pool[persona]??[]),...(pool[persona]??[]),...pool.any],`${seed}:line`),heroNickname(history.recent),seed)};
}
/** After a showdown between two computer players: the loser says something to the winner, who may answer. */
export function rivalBanter(game:GameState,who:NameOf,taken:readonly number[]):TalkLine[] {
 if(game.street!=='complete')return [];
 const live=game.seats.filter(s=>!s.folded&&s.id!==0);if(live.length<2||game.seats.find(s=>s.id===0&&!s.folded))return [];
 const won=live.filter(s=>(game.payouts?.[s.id]??0)>0),lost=live.filter(s=>!(game.payouts?.[s.id]??0));
 if(won.length!==1||!lost.length)return [];
 const w=won[0],l=lost[0],pot=Object.values(game.payouts??{}).reduce((a,b)=>a+b,0)/game.profile.bigBlind,seed=`${game.handId}:rival`;
 if(taken.includes(w.id)||taken.includes(l.id)||pot<15||unit(seed)>=.45)return [];
 const wn=who(w.id),ln=who(l.id);if(!wn||!ln)return [];
 const first=(name:string)=>name.split(' ')[0],lp=personaFor(ln.name,ln.regular).id,wp=personaFor(wn.name,wn.regular).id;
 const lb=RIVAL.byPersona[lp]?.beat??[],ww=RIVAL.byPersona[wp]?.win??[];
 const out=[{seatId:l.id,text:pick([...lb,...lb,...RIVAL.beat],`${seed}:l`).replace('{n}',first(wn.name))}];
 if(unit(`${seed}:reply`)<.6)out.push({seatId:w.id,text:pick([...ww,...ww,...RIVAL.win],`${seed}:w`).replace('{n}',first(ln.name))});
 return out;
}
/** A gesture between hands from someone who said nothing. */
export function gestureLine(game:GameState,who:NameOf,taken:readonly number[]):TalkLine|null {
 if(game.street!=='complete'||unit(`${game.handId}:gesture`)>=.22)return null;
 const seats=game.seats.filter(s=>s.id!==0&&!taken.includes(s.id)&&who(s.id)&&s.stack>0);if(!seats.length)return null;
 const s=seats[hash(`${game.handId}:gesture:who`)%seats.length],p=who(s.id)!;
 return {seatId:s.id,text:say(GESTURES,personaFor(p.name,p.regular).id,`${game.handId}:gesture:line`)};
}
/** A mutter while a player takes a long time. */
export function mutterFor(name:string,regular:string|undefined,seed:string):string {return say(MUTTERS,personaFor(name,regular).id,seed);}

/** Patch 94: what you can say at the table, and how they answer. Patch 95: more phrases and answers. */
export const HERO_PHRASES=['Nice hand','Good luck','Unlucky','Wow','Time?','Ship it!','Nice bluff?','One more orbit'] as const;
export type HeroPhrase=typeof HERO_PHRASES[number];
type Pools=Partial<Record<string,string[]>>&{any:string[]};
const ANSWERS:Record<HeroPhrase,Pools>={
 'Nice hand':{any:['Thanks!','Appreciate it.','Got lucky.','Thank you, thank you.','Thanks, friend.','I’ll take it.','Had to get there sometime.'],needler:['I know.','Obviously.'],comedian:['I’ll be signing autographs later.','Please, no photos.'],zen:['Thanks.'],'old-timer':['Kind of you.','Thank you, young man.'],cowboy:['Much obliged.','Thank ya kindly.'],tourist:['Really? Thank you!!'],rookie:['Was it? I wasn’t sure!'],'high-roller':['Small one.'],coach:['Thanks. Just took the value line.']},
 'Good luck':{any:['You too.','Same to you.','Thanks, I’ll need it.','Good luck, friend.','Luck’s got nothing to do with it.','May the river be kind.'],needler:['You’ll need it more.','I don’t need luck.'],superstitious:['Don’t say that! You’ll jinx it!','Knock on wood. Knock on wood.'],tourist:['Thank you! You too!'],grinder:['Mm. You too.'],comedian:['I need more than luck. I need a miracle.']},
 'Unlucky':{any:['Tell me about it.','That’s poker.','Thanks.','It happens.','Every time.','I’m used to it.'],needler:['Wasn’t luck. You just got there.'],superstitious:['It’s this seat, I swear.'],comedian:['Story of my life.','My middle name.'],coach:['I was ahead when the money went in. That’s all I can do.'],zen:['It’s fine.'],'old-timer':['Seen worse.'],cowboy:['That’s the rodeo.']},
 'Wow':{any:['Right?','Crazy game.','Never seen that before.','Wild.','Unbelievable.','That’s poker for you.'],storyteller:['That reminds me of a hand in Tunica…'],tourist:['Is that normal?!'],'old-timer':['Seen it a thousand times.'],coach:['Happens about four percent of the time.'],comedian:['I need to sit down. Oh wait, I am.']},
 'Time?':{any:['Okay, okay!','Sorry, sorry.','Hold your horses.','Relax, I’m going.','Give me a second!','Big decision here.'],needler:['I’ll take as long as I want.','Call the clock, then.'],zen:['…'],rookie:['Sorry! I’m new!'],cowboy:['Easy, partner.'],comedian:['I’m thinking! It’s a new experience for me.'],'old-timer':['At my age, everything takes time.']},
 'Ship it!':{any:['Ha!','Somebody’s happy.','Enjoy it.','Calm down, it’s not the Main Event.','Nice pot.','Let’s go!'],needler:['Don’t get used to it.'],comedian:['Ship me some too!'],'high-roller':['Adorable.'],tourist:['Woo!'],cowboy:['Yeehaw!']},
 'Nice bluff?':{any:['Wouldn’t you like to know.','Never.','I always have it.','Maybe. Maybe not.','You’ll never know.','I’ll show you next time.'],needler:['Call next time and find out.'],coach:['Balanced range. That’s all I’ll say.'],tourist:['I don’t even know what I had!'],comedian:['A magician never reveals.'],rookie:['What’s a bluff? Kidding.'],zen:['…'],'old-timer':['Never bluffed in my life. Mostly.']},
 'One more orbit':{any:['That’s what they all say.','Sure you will.','One more. Uh huh.','See you at sunrise.','Famous last words.'],grinder:['Nobody ever leaves after one orbit.'],needler:['Leaving while you’re ahead? Smart.'],comedian:['I said that four hours ago.'],superstitious:['Never announce you’re leaving. Bad luck.'],'old-timer':['Said that in 1982. Still here.']},
};
/** Who answers you, and what they say. `prefer` is someone it makes sense to answer (the last winner, or the player
 * who is thinking). */
export function answerHero(phrase:HeroPhrase,seats:readonly {id:number;name:string;regular?:string}[],seed:string,prefer?:number):TalkLine|null {
 if(!seats.length)return null;
 const s=seats.find(x=>x.id===prefer)??seats[hash(`${seed}:who`)%seats.length];
 const persona=personaFor(s.name,s.regular);
 if(persona.chatty<.6&&unit(`${seed}:quiet`)<.5)return {seatId:s.id,text:'*nods*'};
 return {seatId:s.id,text:say(ANSWERS[phrase]??{any:['Ha.']},persona.id,`${seed}:line`)};
}
/** Patch 95: a second player sometimes chimes in after the first answer. */
export function chimeIn(phrase:HeroPhrase|BjPhrase,seats:readonly {id:number;name:string;regular?:string}[],first:number,seed:string):TalkLine|null {
 const rest=seats.filter(s=>s.id!==first);if(!rest.length||unit(`${seed}:chime`)>=.35)return null;
 const s=rest[hash(`${seed}:chime:who`)%rest.length],persona=personaFor(s.name,s.regular).id;
 return {seatId:s.id,text:say({any:['Ha!','*laughs*','Here we go.','*shakes head, smiling*','Classic.','He’s not wrong.','Don’t encourage them.','*rolls eyes*'],comedian:['Can we get that on a T-shirt?'],needler:['Don’t encourage him.'],tourist:['I love this table!']},persona,`${seed}:chime:line`)};
}

/** Patch 95: blackjack quick chat. */
export const BJ_PHRASES=['Good luck','Nice!','Come on, dealer!','Ugh','Hot table!','Thanks, dealer'] as const;
export type BjPhrase=typeof BJ_PHRASES[number];
const BJ_ANSWERS:Record<BjPhrase,Pools>={
 'Good luck':{any:['You too!','Let’s all win one.','Good luck, everybody.','Need it tonight.'],superstitious:['Don’t jinx us!'],needler:['Luck won’t save this shoe.'],tourist:['Thank you! Is this how it works?']},
 'Nice!':{any:['Thanks!','Finally!','About time.','I’ll take it.'],comedian:['Write that down. Never happens.'],'high-roller':['Small potatoes.']},
 'Come on, dealer!':{any:['Bust! Bust! Bust!','Come on, six-card twenty-two!','Give us a ten!','Break, break, break.'],superstitious:['*taps the table three times*'],cowboy:['Buck ’em off, dealer!'],zen:['…'],tourist:['Bust! Is that what we say?']},
 'Ugh':{any:['This dealer is hot.','Same.','Brutal shoe.','Every time.'],coach:['Variance. Keep playing it right.'],comedian:['I need a new dealer and a new life.']},
 'Hot table!':{any:['Don’t say it!','Nobody move!','Keep it coming!','Ride it!'],superstitious:['Don’t SAY it! You’ll cool it off!'],'old-timer':['Seen hot shoes go cold fast.'],tourist:['Woo!']},
 'Thanks, dealer':{any:['Best dealer in the house.','She’s been good to us.','Toke her!','Yeah, thanks!'],'high-roller':['*tosses a chip to the dealer*'],grinder:['Mm.']},
};
export function answerBlackjack(phrase:BjPhrase,seats:readonly {id:number;name:string}[],seed:string):TalkLine|null {
 if(!seats.length)return null;
 const s=seats[hash(`${seed}:who`)%seats.length],persona=personaFor(s.name);
 if(persona.chatty<.6&&unit(`${seed}:quiet`)<.5)return {seatId:s.id,text:'*nods*'};
 return {seatId:s.id,text:say(BJ_ANSWERS[phrase]??{any:['Ha.']},persona.id,`${seed}:line`)};
}

/** Patch 95: a short conversation between two (sometimes three) players, from names alone. */
export function smallTalk(seats:readonly {id:number;name:string;regular?:string}[],seed:string,turns=true):TalkLine[] {
 if(seats.length<2)return [];
 const a=seats[hash(`${seed}:a`)%seats.length],rest=seats.filter(s=>s.id!==a.id),b=rest[hash(`${seed}:b`)%rest.length];
 const pa=personaFor(a.name,a.regular).id,pb=personaFor(b.name,b.regular).id,t=threadFor(pa,`${seed}:thread`);
 const out:TalkLine[]=[{seatId:a.id,text:t.open},{seatId:b.id,text:replyTo(t,pb,`${seed}:reply`)}];
 // Patch 97: back and forth. The first player comes back, and the other sometimes has the last word.
 const more=turns?turnsFor(t.open):undefined;
 if(more&&unit(`${seed}:turns`)<.6){out.push({seatId:a.id,text:more.follow[hash(`${seed}:follow`)%more.follow.length]});if(unit(`${seed}:back`)<.7)out.push({seatId:b.id,text:more.back[hash(`${seed}:backline`)%more.back.length]});return out;}
 const third=seats.filter(s=>s.id!==a.id&&s.id!==b.id);
 if(third.length&&unit(`${seed}:third`)<.4){const c=third[hash(`${seed}:c`)%third.length],line=replyTo(t,personaFor(c.name,c.regular).id,`${seed}:c:reply`);if(line!==out[1].text)out.push({seatId:c.id,text:line});}
 return out;
}
/** Patch 95: players out of the hand react when someone bets big or goes all in. */
export function spectatorLine(game:GameState,who:NameOf):TalkLine|null {
 if(game.street==='complete')return null;
 const acts=game.events.filter(e=>e.type==='action'),last=acts.at(-1);if(!last?.action||last.seatId===undefined)return null;
 const seat=game.seats.find(s=>s.id===last.seatId);if(!seat)return null;
 const allIn=seat.allIn,bb=game.profile.bigBlind,big=last.action.type==='raise'&&(last.action.to>=30*bb||allIn);
 if(!big)return null;
 const seed=`${game.handId}:${acts.length}:spectate`;if(unit(seed)>=(last.seatId===0?.55:.35))return null;
 const watchers=game.seats.filter(s=>s.folded&&s.id!==0&&s.id!==last.seatId&&who(s.id));if(!watchers.length)return null;
 const w=watchers[hash(`${seed}:who`)%watchers.length],p=who(w.id)!;
 return {seatId:w.id,text:say(SPECTATE,personaFor(p.name,p.regular).id,`${seed}:line`)};
}

/** What you did in a finished hand, from the public action list (and the payouts, when given). */
export function heroHandOf(game:{events:readonly {type:string;seatId?:number;street?:string;action?:{type:string}}[];payouts?:Record<number,number>}):{played:boolean;raised:boolean;won?:boolean} {
 const mine=game.events.filter(e=>e.type==='action'&&e.seatId===0);
 const out:{played:boolean;raised:boolean;won?:boolean}={played:mine.some(e=>e.action?.type==='call'||e.action?.type==='raise'),raised:mine.some(e=>e.street==='preflop'&&e.action?.type==='raise')};
 if(game.payouts)out.won=(game.payouts[0]??0)>0;
 return out;
}
/** Adds the Patch 94/95 lines to a finished hand's chatter: one to you, a rival exchange, small talk or a gesture.
 * At most four lines. */
export interface BanterExtra {
 /** Patch 96: your showdowns earlier this session, for grudges. */
 showdowns?:readonly Showdown[];
 /** Patch 96: each computer player's public session mood, for talk about running hot or cold. */
 moodAt?:(seatId:number)=>{tilt:number;heater:number}|undefined;
 /** Patch 97: a player may ask you something (only where you can answer). */
 ask?:boolean;
 /** Patch 98: what you answered earlier this session, for callbacks. */
 answers?:readonly {question:string;answer:number}[];
}
export function withBanter(chatter:Chatter,game:GameState|null|undefined,who:NameOf,history:HeroHistory|null,extra:BanterExtra={}):Chatter {
 if(!game||game.street!=='complete'||chatter.lines.length>=3)return chatter;
 const lines=[...chatter.lines],taken=()=>lines.map(l=>l.seatId);
 if(extra.showdowns){const g=grudgeLine(game,extra.showdowns,who,taken());if(g)lines.push(g);}
 if(history&&lines.length<3){const h=heroBanter(game,who,history,taken());if(h)lines.push(h);}
 if(lines.length<3)for(const l of rivalBanter(game,who,taken()))if(lines.length<4)lines.push(l);
 if(lines.length<3){const d=dealerLine(game,who,taken());if(d)lines.push(d);}
 if(extra.moodAt&&lines.length<3)for(const s of game.seats){if(s.id===0||taken().includes(s.id)||lines.length>=3)continue;const p=who(s.id),m=extra.moodAt(s.id);if(!p||!m)continue;const l=moodLine(s.id,p.name,p.regular,m,`${game.handId}:${s.id}:mood`);if(l){lines.push(l);break;}}
 if(!lines.length&&unit(`${game.handId}:smalltalk`)<.18){
  const seats=game.seats.filter(s=>s.id!==0&&who(s.id)&&s.stack>0).map(s=>({id:s.id,...who(s.id)!}));
  lines.push(...smallTalk(seats,`${game.handId}:smalltalk`));
 }
 // Patch 98: you took it down without a showdown; somebody wants to see a card.
 const pay=game.payouts??{},live=game.seats.filter(s=>!s.folded);
 if(extra.ask&&lines.length<2&&live.length===1&&live[0].id===0&&(pay[0]??0)>0&&unit(`${game.handId}:showone`)<.2){const askers=game.seats.filter(s=>s.id!==0&&!taken().includes(s.id)&&who(s.id)&&s.totalCommitted>0);if(askers.length){const a=askers[hash(`${game.handId}:showone:who`)%askers.length];lines.push({seatId:a.id,text:say(SHOW_ONE.ask,personaFor(who(a.id)!.name,who(a.id)!.regular).id,`${game.handId}:showone:line`)});}}
 if(extra.answers&&lines.length<3){const c=callbackLine(game,extra.answers,who,taken());if(c)lines.push(c);}
 if(extra.ask&&lines.length<2&&game.seats.some(s=>s.id===0)&&!lines.some(l=>questionOf(l.text))){const seats=game.seats.filter(s=>s.id!==0&&!taken().includes(s.id)&&who(s.id)&&s.stack>0).map(s=>({id:s.id,...who(s.id)!}));const q=heroQuestionLine(seats,`${game.handId}:question`);if(q)lines.push(q.line);}
 if(lines.length<2){const g=gestureLine(game,who,taken());if(g)lines.push(g);}
 return lines.length===chatter.lines.length?chatter:{...chatter,lines:lines.slice(0,4)};
}
/** A gesture is shown as an action, not as a quote. */
export const isGesture=(text:string)=>/^\*.+\*$/.test(text);
/** Patch 95: the same lines for tables that keep their own seats (Omaha), from a name. */
export function lineToHero(moment:'heroBigWin'|'heroBigLoss'|'heroAllInWin'|'heroAllInLoss',name:string,seed:string):string {
 const pool=TO_HERO[moment],persona=personaFor(name).id;return pick([...(pool[persona]??[]),...(pool[persona]??[]),...pool.any],`${seed}:line`);
}
export function rivalPair(loser:string,winner:string,seed:string):[string,string|null] {
 const first=(name:string)=>name.split(' ')[0],lp=personaFor(loser).id,wp=personaFor(winner).id,lb=RIVAL.byPersona[lp]?.beat??[],ww=RIVAL.byPersona[wp]?.win??[];
 return [pick([...lb,...lb,...RIVAL.beat],`${seed}:l`).replace('{n}',first(winner)),pick([...ww,...ww,...RIVAL.win],`${seed}:w`).replace('{n}',first(loser))];
}
export const gestureFor=(name:string,seed:string)=>say(GESTURES,personaFor(name).id,seed);

/* ---------- Patch 97: players ask you things ---------- */
export interface HeroQuestion {id:string;ask:Pools;answers:{label:string;react:Pools}[];}
export const QUESTIONS:readonly HeroQuestion[]=[
 {id:'from',ask:{any:['Where you from?','You local?','You from around here?'],cowboy:['Where you from, partner?']},answers:[
  {label:'Right around here',react:{any:['Local! Nice.','Then you know the good barbecue.','Me too, more or less.'],tourist:['Lucky! I love it here!']}},
  {label:'Out of town',react:{any:['Welcome! Enjoy it.','Long drive?','Glad you found us.'],tourist:['Me too! Tourist buddies!']}},
  {label:'Not telling',react:{any:['Mysterious. I like it.','Fair enough.','Ha! Okay, okay.'],needler:['Witness protection?']}}]},
 {id:'often',ask:{any:['You play here a lot?','Regular here?','Haven’t seen you before. You play often?']},answers:[
  {label:'Every week',react:{any:['A regular! That explains it.','Then you know all of us.','Respect.'],grinder:['Same.']}},
  {label:'First time',react:{any:['Welcome! Don’t let us scare you.','First time? Could’ve fooled me.','You picked a good table.'],needler:['Fresh money!']}},
  {label:'Too much',react:{any:['Ha! Aren’t we all.','Join the club.','Honest answer.'],comedian:['My wife says the same about me.']}}]},
 {id:'game',ask:{any:['What’s your game? Cash or tournaments?','You play tournaments too?']},answers:[
  {label:'Cash',react:{any:['Smart. Leave whenever you want.','Cash game player, huh.','Me too.'],coach:['Better hourly, usually.']}},
  {label:'Tournaments',react:{any:['Chasing the big score!','Brave. Too much variance for me.','Any good finishes?'],storyteller:['I won a satellite once. Long story.']}},
  {label:'Both',react:{any:['Best of both.','The well-rounded type.','Respect.']}}]},
 {id:'team',ask:{any:['Who you got Saturday, Sooners or Cowboys?','You a Thunder fan?']},answers:[
  {label:'Sooners',react:{any:['Boomer!','Good choice.','Ugh. We can’t be friends.'],cowboy:['Wrong answer, partner.']}},
  {label:'Cowboys',react:{any:['Go Pokes!','Orange power!','Bold.'],'old-timer':['Stillwater, class of ’71.']}},
  {label:'Not a sports fan',react:{any:['Fair. More time for poker.','Nothing wrong with that.','Lucky you. Less stress.']}}]},
 {id:'night',ask:{any:['How’s your night going?','You up or down tonight?','Having a good night?']},answers:[
  {label:'Pretty good',react:{any:['Glad somebody is.','Keep it rolling.','Nice.'],superstitious:['Don’t say it out loud!']}},
  {label:'Rough one',react:{any:['It’ll turn around.','Hang in there.','Same here.'],coach:['Long run, friend. Long run.']}},
  {label:'Just here for fun',react:{any:['That’s the right attitude.','Best way to play.','Love it.']}}]},
 {id:'learn',ask:{any:['How’d you learn to play?','Who taught you poker?'],rookie:['How did you learn? I’m still learning.']},answers:[
  {label:'Family games',react:{any:['The best way to learn.','Kitchen-table poker. Classic.','Grandma taught me too.'],'old-timer':['That’s how it’s done.']}},
  {label:'Online',react:{any:['An internet kid.','That explains the speed.','Lots of hands that way.'],'old-timer':['Back in my day…']}},
  {label:'TV and practice',react:{any:['Same as half this table.','Ha! Me too.','Nothing wrong with that.'],rookie:['Me too!']}}]},
 {id:'drink',ask:{any:['I’m ordering. Want anything?','Waitress is coming. Need anything?']},answers:[
  {label:'Coffee, thanks',react:{any:['Coffee it is.','Good call.','Coming up.']}},
  {label:'I’m good',react:{any:['Suit yourself.','More for me.','Okay.']}},
  {label:'Water',react:{any:['Responsible.','Hydration. Smart.','Water it is.'],zen:['Good choice.']}}]},
 {id:'work',ask:{any:['What do you do when you’re not playing cards?','What do you do for work?']},answers:[
  {label:'Can’t talk about it',react:{any:['Ooh, secret agent.','Okay, mystery person.','Fair enough.'],comedian:['CIA? You can tell me.']}},
  {label:'Coaching',react:{any:['Coaching what?','Teacher at heart.','That’s great.'],coach:['A fellow coach!']}},
  {label:'This is my job',react:{any:['A pro! Uh oh.','Should I be worried?','Respect the grind.'],grinder:['Same. Long hours.']}}]},
];
/** Patch 98: asked when you take a pot without a showdown. */
export const SHOW_ONE:HeroQuestion={id:'show',ask:{any:['Show one?','Show us one?','Come on, show one card.','What did you have?'],needler:['Show the bluff.'],tourist:['Can we see? Pretty please?'],coach:['Show? For science.']},answers:[
 {label:'Nope',react:{any:['Worth a shot.','Fair enough.','Didn’t think so.','Next time.'],needler:['Must’ve been a bluff.'],comedian:['Cold. Ice cold.']}},
 {label:'Pay to see it',react:{any:['Ha! Next time I will.','Oh, it’s like that?','Noted.','Okay, okay.'],needler:['I’ll be calling you down, then.'],cowboy:['Fair deal, partner.']}},
 {label:'Maybe next time',react:{any:['I’ll hold you to that.','Sure you will.','Ha. Okay.'],superstitious:['Smart. Never show. Bad luck.']}}]};
/** Now and then, after a hand, a player asks you something (cash, tournaments and Omaha). */
export function heroQuestionLine(seats:readonly {id:number;name:string;regular?:string}[],seed:string,odds=.07,only?:readonly string[]):{line:TalkLine;question:HeroQuestion}|null {
 if(!seats.length||unit(`${seed}:ask`)>=odds)return null;
 const pool=only?QUESTIONS.filter(q=>only.includes(q.id)):QUESTIONS;if(!pool.length)return null;
 const s=seats[hash(`${seed}:asker`)%seats.length],q=pool[hash(`${seed}:q`)%pool.length];
 return {line:{seatId:s.id,text:say(q.ask,personaFor(s.name,s.regular).id,`${seed}:askline`)},question:q};
}
/** Which question a line asks, if it is one. */
export function questionOf(text:string):HeroQuestion|undefined {return [...QUESTIONS,SHOW_ONE].find(q=>Object.values(q.ask).some(list=>list?.includes(text)));}
/** The asker's reaction to your answer. */
export function reactTo(question:HeroQuestion,answer:number,asker:{id:number;name:string;regular?:string},seed:string):TalkLine|null {
 const a=question.answers[answer];if(!a)return null;
 return {seatId:asker.id,text:say(a.react,personaFor(asker.name,asker.regular).id,`${seed}:react`)};
}

/* ---------- Patch 97: the nickname the table gives you ---------- */
/** Once your session shows a pattern, the table names you for it: lots of raising, lots of folding, or lots of
 * winning. From your own public actions and results only. */
export function heroNickname(recent:readonly {played:boolean;raised:boolean;won?:boolean}[]):string|null {
 const r=recent.slice(-12);if(r.length<10)return null;
 const raised=r.filter(h=>h.raised).length,played=r.filter(h=>h.played).length,won=r.filter(h=>h.won).length;
 if(raised>=6)return 'Action';
 if(won>=5)return 'Hot Hand';
 if(played<=1)return 'Patience';
 return null;
}
const withNick=(text:string,nick:string|null,seed:string)=>!nick||unit(`${seed}:nick`)>=.4||!/[.!?]$/.test(text)||/\{n\}/.test(text)?text:text.replace(/([.!?])$/,`, ${nick}$1`);
