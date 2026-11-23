/** Patch 100: other players at the casino tables. They put their own chips down and react to what happens, in
 * their own personalities. Display only: their chips are not in play against you, nothing they do touches your
 * balance or the result, and every pick and line comes from the round's id. */
import {personaFor} from '../bots/personas';

export interface Patron {name:string;persona:string;colour:string}
export interface PatronLine {name:string;text:string;mood:'win'|'lose'|'talk'|'act'|'you'|'hero';
 /** Patch 104: who the line answers (another player's name), if anyone. */
 to?:string}
const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;return (h^(h>>>15))>>>0;};
const unit=(seed:string)=>hash(seed)/4294967296;
const pick=<T>(list:readonly T[],seed:string)=>list[hash(seed)%list.length];
const NAMES:Record<string,string[]>={roulette:['Dot','Gloria','Monty','Frank','Rosie','Lou','Marisol','Vince','Opal','Ray'],craps:['Big Earl','Tex','Hank','Brenda','Sal','Gus','Darlene','Moose','Rico','Tammy'],baccarat:['Mei','Duke','Viktor','Elena','Hiro','Nadia','Sofia','Kwan','Ari','Lena'],races:['Walt','Bubba','Rosie','Kenny','Jules','Pete','Hazel','Dewey','Marge','Clint']};
/** Patch 104: the first six names are the regulars a table starts with; the rest are people who wander in later. */
const REGULARS=6;
const COLOURS=['#c62828','#1565c0','#2e7d32','#f9a825','#6a1b9a','#00838f'];
/** Three or four players for a table, the same people for the same day's table. */
export function patronsFor(game:string,seed:string):Patron[] {
 const pool=(NAMES[game]??NAMES.roulette).slice(0,REGULARS),n=3+(hash(`${seed}:n`)%2),start=hash(`${seed}:start`)%pool.length;
 return Array.from({length:n},(_,i)=>{const name=pool[(start+i)%pool.length];return {name,persona:personaFor(name).id,colour:COLOURS[(start+i)%COLOURS.length]};});
}
type Pools=Partial<Record<string,string[]>>&{any:string[]};
const say=(pools:Pools,persona:string,seed:string)=>{const own=pools[persona]??[];return pick([...own,...own,...pools.any],seed);};
const LINES:Record<string,Partial<Record<'win'|'lose'|'big'|'start'|'miss'|'dark',Pools>>>={
 roulette:{
  start:{any:['Come on, {b}!','Daddy needs a {b}.','{b}, baby!','Here we go…','Lucky {b}!'],superstitious:['{b}. Always {b}. It’s my birthday.'],tourist:['I picked {b} because it’s my room number!']},
  win:{any:['Yes! Pay me!','There it is!','Told you!','Ha! Thank you, wheel!','Winner!'],comedian:['I’m a genius. Write that down.'],zen:['Nice.']},
  lose:{any:['Ugh.','Next time.','So close.','Of course.','That wheel hates me.'],superstitious:['Somebody bumped the table.'],needler:['Rigged.']},
  big:{any:['STRAIGHT UP! Woo!','Thirty-five to one, baby!','Somebody hold me!'],'high-roller':['Finally, a real payout.']}},
 craps:{
  start:{any:['Come on, shooter!','Let’s go, dice!','Yo, yo, yo!','No sevens!','Hit that point!'],superstitious:['Blow on ’em first!'],cowboy:['Roll ’em, partner!']},
  win:{any:['Pay the line!','Winner winner!','That’s what I’m talking about!','Hot shooter!','Ka-ching!'],comedian:['I love this game. Today.']},
  lose:{any:['Seven out… brutal.','There goes the table.','Who brought the sevens?','Line away. Ouch.'],superstitious:['Somebody said seven. I heard it.'],needler:['Cold dice. Cold, cold dice.']},
  miss:{any:['Ugh.','Not like that.','Wrong way, dice.','Come on now.','Craps. Figures.'],needler:['I’m on the wrong side tonight.']},
  dark:{any:['Dark side pays!','Thank you, seven.','Pay the don’t!','Wrong way, right way.'],needler:['Told you. Bet the don’t.']},
  big:{any:['{b}! Pay me!','{b}! Woo!','{b}! Now we’re rolling!','There’s the {b}!']}},
 baccarat:{
  start:{any:['Banker again.','Player this time. I can feel it.','Following the road.','Squeeze it slow.'],superstitious:['Four reds in a row. Switch to Player.'],'high-roller':['Max bet on Banker.']},
  win:{any:['Banker! Again!','Player wins! Yes!','I knew it.','Natural!','Thank you, dealer.'],zen:['Good.']},
  lose:{any:['Banker again?!','Ugh, a three-card win.','Chopped.','The road lied to me.'],needler:['This shoe is cursed.']},
  big:{any:['TIE! Eight to one!','A pair! Look at that!']}},
 races:{
  start:{any:['Come on, number {b}!','{b}, {b}, {b}!','Let’s go, {b}!','Ride that horse!'],tourist:['I picked {b} because I like the name!'],coach:['{b} has the speed figures.']},
  win:{any:['THAT’S MY HORSE!','Paid! Paid!','Never a doubt!','Cash that ticket!'],cowboy:['Yeehaw! Ride ’em!']},
  lose:{any:['Run, you donkey!','Glue factory.','Next race.','Tore up another ticket.'],comedian:['My horse is still running. Probably.']},
  big:{any:['Longshot! LONGSHOT!','Hit the exacta! Woo!']}},
};
/** What a player says, before or after the round. `outcome` is whether their own pick won. `bet` fills {b}. */
export function patronLine(game:string,p:Patron,when:'start'|'win'|'lose'|'big'|'miss'|'dark',bet:string,seed:string):string {
 return say(LINES[game][when]??LINES[game].lose!,p.persona,`${seed}:${p.name}:${when}`).replace(/\{b\}/g,bet);
}
/** Each player's pick for a round, from the round's seed: an index into `options`. */
export const pickFor=(p:Patron,seed:string,options:number)=>hash(`${seed}:${p.name}:pick`)%options;
/** Most rounds, one or two players speak. */
export const speaks=(p:Patron,seed:string,odds=.45)=>unit(`${seed}:${p.name}:speak`)<odds;

/* ---------- Patch 104: the players notice you, answer each other, do things, come and go, and talk back ---------- */
export type HeroEvent='heroWin'|'heroBig'|'heroLose'|'sameBet'|'heroShooter'|'heroPoint'|'heroSevenOut'|'heroHot';
const HERO:Record<HeroEvent,Pools>={
 heroWin:{any:['Nice one!','There you go!','Look at you!','Somebody’s lucky.','Get paid!','Good bet.'],comedian:['Teach me your ways.'],needler:['Even a broken clock…'],zen:['Good.'],tourist:['Yay! Go you!'],'old-timer':['Atta kid.']},
 heroBig:{any:['WHOA! Big hit!','Look at that payout!','Somebody’s buying drinks!','Hey! Share the luck!','That’s a big one!'],comedian:['Can I rub your shoulder for luck?'],needler:['Don’t get used to it.'],superstitious:['Don’t move. Don’t change a thing.'],'high-roller':['Now that’s a real hit.'],tourist:['Oh my gosh, can I take a picture?']},
 heroLose:{any:['Next one’s yours.','Tough luck.','It’ll turn.','Hang in there.','Ugh, sorry.'],comedian:['Welcome to the club. Meetings are every night.'],needler:['Happens to the best of us. And to you.'],zen:['Let it go.'],coach:['Stick to your plan.']},
 sameBet:{any:['You’re on {b} too? Let’s ride!','Twins on {b}!','{b}? Great minds.','We’re on {b} together.'],superstitious:['Two on {b}. That’s a sign.'],needler:['Now {b} will never come.']},
 heroShooter:{any:['Come on, shooter!','Your dice! Make it rain!','Let’s go, new shooter!','Hot hands, hot hands!'],superstitious:['Don’t let the dice touch the chips.'],cowboy:['Roll ’em, partner!']},
 heroPoint:{any:['Winner! Point made!','That’s the shooter!','Pay the line! Great roll!','Do it again!'],comedian:['I take back everything I said about you.'],'old-timer':['That’s how you shoot dice.']},
 heroSevenOut:{any:['Good roll, shooter.','Nice try, shooter.','You gave it a run.','Next time, shooter.'],needler:['Thanks for nothing.'],zen:['It happens.']},
 heroHot:{any:['Keep rolling! Don’t stop!','This shooter’s on fire!','Nobody touch the shooter!','Hot dice! Hot dice!'],superstitious:['Same throw. Exactly the same throw.']},
};
/** What a player says to you. {b} is your bet, where it matters. */
export function heroLine(p:Patron,ev:HeroEvent,bet:string,seed:string):string {return say(HERO[ev],p.persona,`${seed}:${p.name}:${ev}`).replace(/\{b\}/g,bet);}
const REPLY:Record<'win'|'lose'|'talk',Pools>={
 win:{any:['Nice one, {n}!','Good for you, {n}.','{n}’s hot tonight.','Save some for us, {n}.','Get paid, {n}!'],needler:['Lucky, {n}. Pure luck.'],comedian:['{n}, you’re buying the next round.'],zen:['Well done, {n}.']},
 lose:{any:['Hang in there, {n}.','Same here, {n}.','You and me both, {n}.','Next one, {n}.'],needler:['Told you, {n}.'],comedian:['{n}, we should start a support group.'],superstitious:['{n}, change your seat.']},
 talk:{any:['I’m with you, {n}.','Here we go.','Let’s do it, {n}.','From your lips, {n}.','Yeah, yeah.'],needler:['Sure, {n}. Sure.'],comedian:['{n} says that every time.'],'old-timer':['Heard that one before, {n}.']},
};
/** One player answering another. */
export function replyLine(p:Patron,to:PatronLine,seed:string):PatronLine {
 const mood=to.mood==='win'||to.mood==='lose'?to.mood:'talk';
 return {name:p.name,text:say(REPLY[mood],p.persona,`${seed}:${p.name}:re`).replace(/\{n\}/g,to.name),mood:'talk',to:to.name};
}
const ACTS:Record<string,Pools>={
 roulette:{any:['stacks chips on the layout','spins a chip on the rail','watches the ball like a hawk','kisses a chip and puts it on the number','checks the board for hot numbers','scribbles on a scorecard'],superstitious:['taps the rail three times','rubs a lucky charm'],'high-roller':['slides a stack of black chips out'],tourist:['takes a photo of the wheel']},
 craps:{any:['blows on the dice','racks up chips','leans over the rail','claps twice','shakes the dice by the ear','sets the dice just so'],superstitious:['taps the dice on the felt for luck','won’t look at the dice'],cowboy:['tips his hat to the stickman'],comedian:['pretends to whisper to the dice']},
 baccarat:{any:['bends the corner of a card','squeezes a card slowly','marks the scorecard','rubs the felt','stares down the shoe'],superstitious:['blows on the cards','turns the card sideways first'],'high-roller':['pushes out a tall stack'],zen:['closes both eyes for the squeeze']},
 races:{any:['studies the racing form','circles a horse in pen','checks the tote board','tears up a ticket','peers at the big screen','folds a ticket into a pocket'],'old-timer':['squints through binoculars'],tourist:['asks how an exacta works'],coach:['checks the speed figures again']},
};
/** Something a player does, as words: "blows on the dice". */
export function actLine(game:string,p:Patron,seed:string):PatronLine {return {name:p.name,text:say(ACTS[game]??ACTS.roulette,p.persona,`${seed}:${p.name}:act`),mood:'act'};}
const LEAVE:Pools={any:['colors up and heads for the buffet','racks up and calls it a night','says goodnight and leaves','checks the time and cashes out','waves goodbye and wanders off'],'high-roller':['tips the dealer and heads upstairs'],needler:['grumbles and leaves'],tourist:['runs off to meet friends at the show']};
const HELLO:Pools={any:['Room for one more?','Evening, everybody.','This the lucky table?','Mind if I join?','Hi, all. How’s it running?'],comedian:['Don’t worry, I’m only here to lose.'],superstitious:['Is this seat lucky? It looks lucky.'],cowboy:['Howdy, folks.'],tourist:['First time playing this! Be nice!']};
/** Now and then (about one round in twelve) a player leaves and someone new sits down in that seat. `keep` is a
 * seat that must not change (the craps shooter). The newcomer is someone not already at the table. */
export function turnover(game:string,table:readonly Patron[],seed:string,keep=-1):{seat:number;leaving:Patron;arriving:Patron;lines:PatronLine[]}|null {
 if(unit(`${seed}:turnover`)>=1/12||table.length<2)return null;
 const seats=table.map((_,i)=>i).filter(i=>i!==keep);if(!seats.length)return null;
 const seat=seats[hash(`${seed}:who-leaves`)%seats.length],leaving=table[seat];
 const free=(NAMES[game]??NAMES.roulette).filter(n=>!table.some(p=>p.name===n));if(!free.length)return null;
 const name=free[hash(`${seed}:who-arrives`)%free.length],arriving:Patron={name,persona:personaFor(name).id,colour:COLOURS[hash(`${seed}:colour`)%COLOURS.length]};
 return {seat,leaving,arriving,lines:[{name:leaving.name,text:say(LEAVE,leaving.persona,`${seed}:leave`),mood:'act'},{name,text:say(HELLO,arriving.persona,`${seed}:hello`),mood:'talk'}]};
}
/* What you can say at each table, and how the players answer. */
export interface ChatOption {key:string;text:string}
export const CHAT:Record<string,ChatOption[]>={
 roulette:[{key:'luck',text:'Good luck, everybody!'},{key:'pick',text:'What’s everyone playing?'},{key:'nice',text:'Nice hit!'},{key:'cold',text:'This wheel is cold tonight.'},{key:'hot',text:'Feeling lucky tonight!'}],
 craps:[{key:'luck',text:'Good luck, everybody!'},{key:'dice',text:'Let’s go, shooter!'},{key:'nice',text:'Nice hit!'},{key:'cold',text:'These dice are cold.'},{key:'hot',text:'Feeling lucky tonight!'}],
 baccarat:[{key:'luck',text:'Good luck, everybody!'},{key:'road',text:'Banker or Player? What’s the road say?'},{key:'nice',text:'Nice hit!'},{key:'cold',text:'This shoe is cold.'},{key:'hot',text:'Feeling lucky tonight!'}],
 races:[{key:'luck',text:'Good luck, everybody!'},{key:'tips',text:'Who do you like this race?'},{key:'nice',text:'Nice ticket!'},{key:'cold',text:'Can’t pick a winner tonight.'},{key:'hot',text:'Feeling lucky tonight!'}],
};
const ANSWER:Record<string,Pools>={
 luck:{any:['You too!','Thanks, same to you.','We’ll need it.','Good luck, friend.'],needler:['Luck’s for amateurs.'],comedian:['I’ll take all of it, thanks.'],zen:['And to you.'],cowboy:['Back at ya.']},
 pick:{any:['Black. Always black.','My kids’ birthdays.','Seventeen, every spin.','Whatever’s hot on the board.','Red and the first dozen.'],superstitious:['Never zero. Zero is a curse.'],'high-roller':['Everything. Every number.'],tourist:['I just close my eyes and point!']},
 dice:{any:['Yo! Let’s go!','Hot hands!','No sevens!','Make your point!'],superstitious:['Don’t say the S word.'],comedian:['Dice can’t hear you. I’ve tried.']},
 road:{any:['Banker’s been streaking.','Player’s due. I can feel it.','It’s chopping. Follow the chop.','I just bet Banker. Less thinking.'],needler:['The road is a lie. Bet Banker.'],coach:['It’s all random. Banker’s the best bet.'],superstitious:['Never bet against a streak.']},
 tips:{any:['I like #{h}.','#{h}. Look at that horse.','Going with #{h} again.','#{h}, on a hunch.'],coach:['#{h} has the best numbers.'],tourist:['#{h}! I like the name!'],'old-timer':['#{h}. Trust an old man.']},
 nice:{any:['Thanks!','Finally!','About time.','Ha! I’ll take it.'],comedian:['I’d buy you a drink but I need it all.'],zen:['Thank you.'],needler:['Skill. Pure skill.']},
 cold:{any:['Tell me about it.','It’ll turn.','Ice cold.','Stick with it.'],superstitious:['Don’t say that! You’ll make it worse.'],coach:['That’s variance. Ride it out.'],comedian:['Cold? I’ve got frostbite.']},
 hot:{any:['Love that energy!','Let’s go!','I’ll ride with you.','Me too!'],needler:['Famous last words.'],superstitious:['Don’t jinx it!'],tourist:['Woo! Me too!']},
};
/** Who answers what you said (one or two players) and what they say. `pickOf` gives a player's horse, for tips. */
export function chatAnswers(game:string,table:readonly Patron[],key:string,seed:string,pickOf?:(p:Patron)=>number):PatronLine[] {
 const pool=ANSWER[key];if(!pool)return [];
 const order=[...table].sort((a,b)=>hash(`${seed}:${a.name}:ans`)-hash(`${seed}:${b.name}:ans`)),n=key==='pick'||key==='tips'||key==='road'?2:1+(hash(`${seed}:n`)%2);
 return order.slice(0,n).map(p=>({name:p.name,text:say(pool,p.persona,`${seed}:${p.name}:${key}`).replace(/\{h\}/g,String(pickOf?.(p)??1)),mood:'talk' as const,to:'You'}));
}
/** Shared helpers for the controller: a yes/no from a seed, and a pick from a list. */
export const chanceOf=(seed:string,odds:number)=>unit(seed)<odds;
export const chooseOf=<T>(list:readonly T[],seed:string):T|undefined=>list.length?list[hash(seed)%list.length]:undefined;
