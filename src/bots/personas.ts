/** Patch 86: table personalities. Every player who is not a regular gets one of these from their name, so the same
 * stranger always sounds the same: the comedian cracks jokes, the old-timer tells stories, the needler gets under your
 * skin. Regulars keep their own voices (talk.ts) and also get the personality closest to theirs, for small talk.
 * Presentation only. A personality is chosen from the name alone, never from how the player plays, so it says nothing
 * about their style; nothing here reaches a decision. */
export type TalkBank='win'|'loss'|'bust'|'compliment'|'showBluff'|'showStrong';
export type TalkAction='fold'|'check'|'call'|'bet'|'raise'|'allin';
export interface TablePersona {id:string;label:string;blurb:string;
 /** How often they talk, against an average player (1). */
 chatty:number;
 lines:Partial<Record<TalkBank,string[]>>;actions:Partial<Record<TalkAction,string[]>>;
 /** Between-hand small talk they start: a line and the kind of answer it invites. */
 openers:string[];
 /** How they answer someone else's small talk. */
 answers:string[];}

export const PERSONAS:readonly TablePersona[]=[
 {id:'comedian',label:'The comedian',blurb:'Always has a joke, especially when losing.',chatty:1.5,
  lines:{win:['Drinks are on… somebody else.','I’d like to thank my cards and my agent.','Finally, my kids can eat.','That’s what we call a business plan.'],loss:['I’m not losing, I’m investing.','My accountant is going to love this.','That’s fine. I didn’t need that rent money.','Somebody call my mom.'],bust:['Well, I’ll be at the bar telling everyone I won.','That’s my cue. Tip your dealer!'],compliment:['Show-off.','Okay, Phil Ivey.'],showBluff:['Surprise!','I call that the Texas Tuxedo.'],showStrong:['I know, I know. Hold your applause.']},
  actions:{fold:['I fold like a lawn chair.','Folding. I’m a lover, not a fighter.'],call:['I’ll call. For science.'],raise:['Let’s make this expensive.'],allin:['Hold my drink.','YOLO, as the kids say.']},
  openers:['You know what they call a poker player with no money? A tourist.','Dealer, any chance of a good hand this time? Just once.','I came here to have fun. So far, I’ve had the fun of donating.','My wife thinks I’m at bowling.'],
  answers:['Ha! Good one.','Stop, you’re killing me.','Every table needs one of you.','That’s the best thing I’ve heard all night.']},
 {id:'grinder',label:'The grinder',blurb:'Headphones half on. Talks about volume and sessions.',chatty:.45,
  lines:{win:['Good pot.','Booked.','Solid.'],loss:['Standard.','It happens.','Variance.'],bust:['Rebuy.','Back tomorrow.'],compliment:['Nice.'],showStrong:['Had it.']},
  actions:{fold:['Fold.'],check:['Check.'],call:['Call.'],raise:['Raise.']},
  openers:['Third session this week. Need the hours.','What’s the game tomorrow, anyone know?','This seat’s been good to me.'],
  answers:['Yeah.','Mm.','Fair.','Sure.']},
 {id:'old-timer',label:'The old-timer',blurb:'Has seen it all, and will tell you about it.',chatty:1.25,
  lines:{win:['Old dog, new tricks.','Still got it.','Back in ’88 that’d be a monster pot.'],loss:['In my day, you’d fold that.','These young folks and their raises.','Lost a bigger one in Reno once.'],bust:['That’s enough for one night. Good luck, kids.'],compliment:['Played that like a pro, son.','Good. Real good.'],showStrong:['Patience. Learn it.']},
  actions:{fold:['Not a hand for an old man.'],call:['I’ll take a look.'],raise:['Raise. Like the old days.'],allin:['Let’s see what you young folks have.']},
  openers:['I played my first game at the Horseshoe in ’79. Smoke so thick you couldn’t see the cards.','Used to play seven-card stud here every Thursday.','Remember when the buy-in was forty bucks?','Doyle once told me never to play a hand I wouldn’t bet on.'],
  answers:['Here we go, another story.','Back in your day, huh?','I could listen to this all night.','You’ve been playing longer than I’ve been alive.']},
 {id:'tourist',label:'The tourist',blurb:'In town for the weekend and loving every minute.',chatty:1.35,
  lines:{win:['Wait till I tell my friends!','I love this place!','Is it always this fun?'],loss:['Oh well, that’s Vegas money.','Worth it for the story.'],bust:['Best night of the trip! Thanks, everyone!'],compliment:['Wow, you’re good!','How did you know?'],showBluff:['I had nothing! Is that allowed?'],showStrong:['I think this is good, right?']},
  actions:{call:['I’ll play!','Why not, I’m on vacation.'],raise:['Is this a raise? Okay, raise!'],allin:['When in Rome!'],fold:['Okay, I’ll sit this one out.']},
  openers:['First time playing in a real casino. Everyone’s so nice!','We drove six hours to get here. Totally worth it.','Does anyone know a good steak place nearby?','My buddy said I couldn’t last an hour at a real table.'],
  answers:['Welcome! Glad you came.','Try the buffet, it’s great.','Enjoy it while it lasts!','You’re doing fine.']},
 {id:'needler',label:'The needler',blurb:'Talks to get a reaction. Don’t give him one.',chatty:1.45,
  lines:{win:['Thanks for the donation.','Too easy.','Knew you had nothing.'],loss:['Lucky.','You call with that?','Wow. Just wow.'],bust:['Rigged. Whatever.'],compliment:['Even a blind squirrel.'],showBluff:['Thanks for folding, champ.','Scared money.'],showStrong:['Should’ve called. Oh wait.']},
  actions:{bet:['Bet. Go ahead, think about it.'],raise:['Raise. You look nervous.'],call:['I don’t believe you.'],allin:['All in. Your move, tough guy.']},
  openers:['Anyone here actually good at this?','Some of you play like it’s your first time.','I’ve seen better plays at a home game.'],
  answers:['Sure you have.','Says the guy who just lost a buy-in.','Relax, it’s just a game.','Ignore him, everyone.']},
 {id:'storyteller',label:'The storyteller',blurb:'Every hand reminds them of another hand.',chatty:1.3,
  lines:{win:['This reminds me of a pot I won in Tunica.','Just like the time I rivered a flush in Biloxi.'],loss:['Same thing happened to me last month. Same card!','That’s going in the bad beat story collection.'],compliment:['That’s going in my stories.'],showStrong:['Story of my night: always the nuts.']},
  actions:{call:['This is just like that hand in Tunica.'],fold:['I folded this once and regretted it for years. Fold.']},
  openers:['So I’m at a 2/5 game in Tunica, right? Guy shoves with a gutshot…','You will not believe the hand I saw last night.','My cousin once won a seat to the Main Event with a twenty-dollar satellite.'],
  answers:['And then what happened?','Wait, is this the Tunica story again?','That’s wild.','No way.']},
 {id:'superstitious',label:'The superstitious one',blurb:'Lucky card protector, lucky chair, lucky everything.',chatty:1.1,
  lines:{win:['My lucky chip came through.','Never changing this seat.','It’s the socks. I knew it.'],loss:['Somebody touched my card protector.','It’s this seat. It’s cursed.','The dealer changed. That’s why.'],bust:['I knew I shouldn’t have changed seats.'],compliment:['You must have a lucky charm.']},
  actions:{fold:['Bad vibes. Fold.'],call:['I’ve got a feeling about this one.'],allin:['Lucky number seven, here we go.']},
  openers:['Nobody say the word “cooler” at this table.','Dealer, can you shuffle twice? For luck.','I always tap the table three times. Don’t judge.','Had a dream I hit quads tonight.'],
  answers:['Don’t jinx it!','Knock on wood.','That stuff is real, I swear.','Whatever works.']},
 {id:'cowboy',label:'The cowboy',blurb:'Big hat, big laugh, bigger stories.',chatty:1.2,
  lines:{win:['Yeehaw!','That’s how we do it in Texas.','Pull up the wagon, I’m taking it home.'],loss:['Got bucked off that one.','Ain’t that a kick in the head.'],bust:['Well, that’s the rodeo. Y’all have fun.'],compliment:['Well done, partner.'],showBluff:['Ain’t got a lick of nothing.']},
  actions:{raise:['Let’s rodeo.'],call:['I’ll ride along.'],allin:['Saddle up, I’m all in.'],fold:['Not my horse.']},
  openers:['Drove in from Amarillo this morning.','Y’all ever been to the State Fair? Fried everything.','My granddaddy played Texas Hold’em before it had a name.'],
  answers:['Sure thing, partner.','You don’t say.','Amarillo, huh? Nice.','Yee-haw to that.']},
 {id:'coach',label:'The table coach',blurb:'Explains everyone’s hands, whether they ask or not.',chatty:1.3,
  lines:{win:['Textbook. Position and pot odds.','That’s a standard value line.'],loss:['Right play, wrong result. Can’t control the river.','I was priced in. Correct call.'],compliment:['Good sizing on that river.','That’s a sharp fold, actually.'],showBluff:['Blockers. Look it up.'],showStrong:['Merged range, folks.']},
  actions:{call:['Pot odds say call.'],raise:['Isolation raise.'],fold:['Disciplined fold.'],bet:['Protection bet.']},
  openers:['Most people limp way too much at this stake.','The biggest leak at these tables? Calling too much on the river.','Position is everything in this game.'],
  answers:['Thanks, coach.','Nobody asked, coach.','Okay, professor.','He’s not wrong, though.']},
 {id:'rookie',label:'The newcomer',blurb:'Says they are new here and asks a lot of questions.',chatty:.9,
  lines:{win:['Oh! That’s me? Thank you!','I can’t believe that worked.'],loss:['Oh no. Was that bad?','I think I messed that up.'],bust:['Okay, that’s my budget. Thanks, everyone!'],compliment:['How did you know to do that?','Wow, that was smart.'],showStrong:['Is a straight good? I think it’s good.']},
  actions:{check:['Um, check?'],call:['I’ll… call?'],raise:['Is it my turn? Raise!'],fold:['Fold. Sorry.']},
  openers:['Sorry if I’m slow, I’m still learning.','Does a flush beat a straight? Just checking.','I watched a lot of poker on TV before coming here.'],
  answers:['You’re doing great.','Take your time.','We all started somewhere.','Flush beats a straight, yes.']},
 {id:'high-roller',label:'The high roller',blurb:'Says they usually play bigger games. Lets everyone know.',chatty:1.1,
  lines:{win:['Cute pot.','Tip money.'],loss:['Pocket change.','I lose more than that at lunch.'],bust:['I’ll go upstairs to a real game.'],compliment:['Not bad for this stake.'],showStrong:['Always.']},
  actions:{raise:['Let’s make it worth my time.'],call:['Sure, why not.'],allin:['All in. It’s nothing.']},
  openers:['The 25/50 game had a waitlist, so here I am.','Just killing time before my flight.','Anyone know if the high-limit room is open yet?'],
  answers:['Must be nice.','Good for you.','Upstairs is that way.','Sure, buddy.']},
 {id:'zen',label:'The calm one',blurb:'Never rattled. Says very little.',chatty:.5,
  lines:{win:['Good.','Nice.'],loss:['It’s fine.','Next one.'],bust:['Good game.'],compliment:['Well played.']},
  actions:{},
  openers:['Nice night for cards.','Good table tonight.'],
  answers:['Agreed.','Indeed.','Mm.','True.']},
];
const BY_ID=new Map(PERSONAS.map(p=>[p.id,p]));
/** Regulars get the personality that matches their voice, for small talk. */
const REGULAR_PERSONA:Record<string,string>={'big-earl':'storyteller',vince:'needler',nina:'grinder',marco:'needler',dot:'tourist',priya:'grinder',hank:'old-timer',tess:'zen',rocco:'coach',lena:'comedian',gus:'cowboy',mei:'zen',duke:'high-roller',sal:'rookie',ruth:'zen',theo:'coach',ivy:'grinder',frank:'superstitious',ana:'coach',walt:'old-timer',bubba:'cowboy',rosie:'tourist',tex:'cowboy',gloria:'old-timer',mikey:'grinder',lou:'old-timer',kenny:'grinder',dante:'zen',yuki:'grinder',brenda:'needler',omar:'coach',pete:'comedian',carla:'grinder',jules:'storyteller',viktor:'zen',sasha:'needler',hiro:'zen',elena:'coach',monty:'high-roller',nadia:'grinder'};
const hash=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;};
/** A player's table personality: a regular's own, otherwise one picked from the name. */
export function personaFor(name:string,regular?:string):TablePersona {
 const fixed=regular?REGULAR_PERSONA[regular]:undefined;
 return (fixed&&BY_ID.get(fixed))||PERSONAS[hash(name.trim().toLowerCase())%PERSONAS.length];
}
export const personaById=(id:string)=>BY_ID.get(id);

/* Patch 96: more for every personality to say, merged into the lists above when this module loads. Each line is
 * still chosen from the name and the hand only. */
const MORE:Record<string,{lines?:Partial<Record<TalkBank,string[]>>;actions?:Partial<Record<TalkAction,string[]>>;openers?:string[];answers?:string[]}>={
 comedian:{lines:{win:['I’d like to thank the academy.','Put it on my tab. Oh wait, I won.'],loss:['That was a tactical donation.','I meant to do that.']},actions:{check:['Check, like my bank balance.'],bet:['Bet. Don’t tell my wife.'],call:['Call. I have no idea why.'],fold:['Folding faster than a cheap tent.']},openers:['Why do they call it a poker face? Mine just looks worried.'],answers:['I’m stealing that one.']},
 grinder:{lines:{win:['Good.','Booked a win.'],loss:['Cooler.','Next.']},actions:{bet:['Bet.'],allin:['All in.']},openers:['Anyone know when the next table opens?'],answers:['Yep.']},
 'old-timer':{lines:{win:['Not bad for an old man.','Still got a few tricks.'],loss:['That one stung.','Kids these days.']},actions:{check:['I’ll check, thank you.'],bet:['A little bet.'],call:['Alright, I’ll pay.']},openers:['They used to give you free cigars at this table.'],answers:['Those were the days.']},
 tourist:{lines:{win:['I’m telling everyone back home!','Is this real life?!'],loss:['Easy come, easy go!']},actions:{check:['Check! Did I do that right?'],bet:['A bet! How much? This much!']},openers:['Is it rude to take pictures in here?'],answers:['That’s so cool!']},
 needler:{lines:{win:['Read you like a book.','Thanks for playing.'],loss:['You got lucky and you know it.']},actions:{check:['Check. Go ahead, bet.'],fold:['Fold. Enjoy it.'],raise:['Raise. Prove it.']},openers:['Who here actually thinks they’re good?'],answers:['Nobody asked.']},
 storyteller:{lines:{win:['Just like Biloxi, ’09!'],loss:['That’s the second-worst beat I’ve ever taken.']},actions:{raise:['This reminds me of a raise I made in Tunica. Raise.'],check:['Check. Long story.']},openers:['Did I ever tell you about the guy who played blind for an hour?'],answers:['I’ve got one better.']},
 superstitious:{lines:{win:['The chip! It’s the chip!'],loss:['Somebody said “cooler,” didn’t they.']},actions:{check:['Check. Tapping wood.'],raise:['Lucky raise.'],bet:['Bet for luck.']},openers:['Anybody else have a lucky shirt? Mine’s in the wash.'],answers:['Don’t mess with the luck.']},
 cowboy:{lines:{win:['That’s a full saddlebag.'],loss:['Throwed me clean off.']},actions:{check:['Check, partner.'],bet:['Bet. Giddyup.'],call:['I’ll see that.']},openers:['Anybody here ever ride a horse? A real one?'],answers:['Well, I’ll be.']},
 coach:{lines:{win:['Thin value, but value.'],loss:['Cooler. Nothing to learn there.']},actions:{check:['Pot control.'],allin:['Shove. Fold equity.']},openers:['Hot take: most players don’t three-bet enough.'],answers:['Interesting point.']},
 rookie:{lines:{win:['Did I win? I won!'],loss:['I think I understand now. Maybe.']},actions:{bet:['Is this enough? Okay, bet.'],allin:['All in! Wait, is that allowed?']},openers:['What’s a check-raise? Someone just did one to me.'],answers:['Oh, interesting!']},
 'high-roller':{lines:{win:['Rounding error.'],loss:['Couldn’t care less.']},actions:{check:['Check.'],bet:['Bet. Whatever.'],fold:['Not worth my time.']},openers:['My driver’s waiting, so let’s keep it moving.'],answers:['Cute.']},
 zen:{lines:{win:['Mm.'],loss:['Okay.']},actions:{check:['Check.'],call:['Call.'],fold:['Fold.']},openers:['Quiet table. I like it.'],answers:['Yes.']},
};
for(const p of PERSONAS){const m=MORE[p.id];if(!m)continue;
 for(const [k,v] of Object.entries(m.lines??{}))(p.lines as Record<string,string[]>)[k]=[...(p.lines[k as TalkBank]??[]),...v!];
 for(const [k,v] of Object.entries(m.actions??{}))(p.actions as Record<string,string[]>)[k]=[...(p.actions[k as TalkAction]??[]),...v!];
 if(m.openers)p.openers.push(...m.openers);if(m.answers)p.answers.push(...m.answers);}
