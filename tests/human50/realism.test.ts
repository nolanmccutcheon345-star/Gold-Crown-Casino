import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {createProfile,seedStream,completeProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {HUMAN_LAYER_V11,moodProfile,sessionMood,stackMood,CALM} from '../../src/bots/human';
import {readsFromHands,readsProfile,lean,exploitStrength,emptyReads,validReads,REFERENCE,type HeroReads} from '../../src/bots/reads';
import {handChatter,regularOfProfile,QUIET} from '../../src/bots/talk';
import {chatterFor} from '../../src/ui/table-talk';
import {cashReads,cashSessionFacts} from '../../src/session/human-context';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V23,TOURNAMENT_POLICY_V24,policyUsesReads} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentReads} from '../../src/tournament/runtime';

class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'real',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
/** Six-handed; Hero is seat 0; `button` chooses where Hero sits relative to it. */
const table=(button:number,id:string,bb=40,stacks:Record<number,number>={})=>startHand({handId:id,button,profile:rules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:seat===0?'You':`P${seat}`,stack:(stacks[seat]??bb)*200}))});
function play(s:GameState,script:Record<number,Action[]>):GameState {for(let n=0;s.street!=='complete'&&n<200;n++){let next=script[s.actor!]?.shift();if(next?.type==='call'&&legalActions(s).check)next={type:'check'};s=act(s,next??(legalActions(s).check?{type:'check'}:{type:'fold'}));}return s;}
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
/** Reads of a Hero who folds every blind to a steal and folds to every continuation bet. */
function foldyHero():HeroReads {
 const hands:GameState[]=[];
 // Button 4 → SB 5, BB 0 (Hero). Seat 4 steals, Hero folds.
 for(let i=0;i<30;i++)hands.push(play(table(4,`steal${i}`),{4:[{type:'raise',to:450}]}));
 // Hero calls a steal in the BB, then folds to the flop bet.
 for(let i=0;i<30;i++)hands.push(play(table(4,`cbet${i}`),{4:[{type:'raise',to:450},{type:'raise',to:400}],0:[{type:'call'},{type:'check'},{type:'fold'}]}));
 return readsFromHands(hands,0);
}

describe('reads on Hero',()=>{
 it('count what Hero did in public actions',()=>{
  const r=foldyHero();
  expect(r.hands).toBe(60);expect(r.foldBlinds.chances).toBe(60);expect(r.foldBlinds.count).toBe(30);
  expect(r.foldToCbet).toEqual({count:30,chances:30});expect(validReads(r)).toBe(true);
  // Short-stack shoves and all-in calls.
  const shoves=Array.from({length:10},(_,i)=>play(table(1,`sh${i}`,40,{0:8}),{0:[{type:'raise',to:1600}]}));
  const calls=Array.from({length:10},(_,i)=>play(table(1,`ca${i}`,40,{4:10}),{4:[{type:'raise',to:2000}],0:[i<3?{type:'call'}:{type:'fold'}]}));
  const s=readsFromHands([...shoves,...calls],0);expect(s.shortShove).toEqual({count:10,chances:10});expect(s.callAllIn).toEqual({count:3,chances:10});
  expect(validReads({...s,foldBlinds:{count:5,chances:2}})).toBe(false);expect(validReads({...s,extra:1})).toBe(false);
 });
 it('make adaptive players steal more from a Hero who gives up blinds, and leave weak players alone',()=>{
  const reads:HeroReads={...foldyHero(),foldBlinds:{count:48,chances:50}};expect(lean(reads.foldBlinds,REFERENCE.foldBlinds)).toBeCloseTo(.48,5);
  const spot=table(4,'spot'),reg=regularProfile('priya','mid'),station=regularProfile('big-earl','mid');let s=spot;while(s.actor!==4)s=act(s,{type:'fold'});
  const o=observeBot(s,4,reg.policyVersion,'o');
  const adjusted=readsProfile(o,reg,reads);expect(adjusted.effect?.applied).toContain('steal');expect(completeProfile(adjusted.profile).looseness).toBeGreaterThan(completeProfile(reg).looseness);
  expect(exploitStrength(reg)).toBeGreaterThan(exploitStrength(station)*5);
  expect(readsProfile(o,reg,emptyReads()).effect).toBeNull();expect(readsProfile(o,reg,null).profile).toBe(reg);
  // Measured: opening from the button against a blind-folding Hero, policy 2.4.0.
  const st={playersLeft:30,paid:4,stacks:[...s.seats.map(x=>x.startingStack),...Array(24).fill(8000)]};
  const opens=(r:HeroReads|null)=>rate(400,i=>{const o2=observeBot(s,4,reg.policyVersion,'o');o2.ownCards=[(['2','3','4','5','6','7','8','9','T','J','Q','K','A'][i%13]+'s') as never,(['2','3','4','5','6','7','8','9','T','J','Q','K','A'][(i*5+3)%13]+'h') as never];return chooseTournamentDecision(o2,reg,seedStream(i),TOURNAMENT_POLICY_V24,st,[],r).action.type==='raise';});
  expect(opens(reads)).toBeGreaterThan(opens(null)+.05);
 });
 it('policy 2.4.0 makes the same kind of decision as 2.3.0 with no reads and an ordinary stack',()=>{
  const p=createProfile({selection:'tag'},3,'mid');let compared=0,same=0;
  for(let seed=0;seed<30;seed++){let s=table(seed%6,`eq${seed}`,25);const st={playersLeft:30,paid:4,stacks:[...s.seats.map(x=>x.startingStack),...Array(24).fill(5000)]};
   for(let n=0;s.street!=='complete'&&n<100;n++){const o=observeBot(s,s.actor!,p.policyVersion,`e${n}`),a=chooseTournamentDecision(o,p,seedStream(seed*99+n),TOURNAMENT_POLICY_V24,st,[],null),b=chooseTournamentDecision(o,p,seedStream(seed*99+n),TOURNAMENT_POLICY_V23,st,[]);compared++;if(JSON.stringify(a.action)===JSON.stringify(b.action))same++;s=applyCommand(s,a);}}
  expect(same).toBe(compared);
 });
});

describe('session and stack moods',()=>{
 it('make stuck tilters chase, winning pros lock up, winning amateurs splash, and long sessions sloppy',()=>{
  const frank=regularProfile('frank','mid'),mei=regularProfile('mei','mid'),sal=regularProfile('sal','mid');
  const stuck=sessionMood({hands:80,netBB:-160},frank);expect(stuck.stuck).toBeGreaterThan(.6);expect(sessionMood({hands:80,netBB:-160},mei).stuck).toBeLessThan(stuck.stuck!);
  expect(completeProfile(moodProfile(frank,{...CALM,...stuck})).looseness).toBeGreaterThan(completeProfile(frank).looseness);
  const up={...CALM,...sessionMood({hands:60,netBB:200},mei)};expect(completeProfile(moodProfile(mei,up)).looseness).toBeLessThan(completeProfile(mei).looseness);
  const upSal={...CALM,...sessionMood({hands:60,netBB:200},sal)};expect(completeProfile(moodProfile(sal,upSal)).looseness).toBeGreaterThan(completeProfile(sal).looseness);
  const tired={...CALM,...sessionMood({hands:400,netBB:0},sal)};expect(tired.fatigue).toBeGreaterThan(.5);expect(completeProfile(moodProfile(sal,tired)).traits.mistakeRate).toBeGreaterThan(completeProfile(sal).traits.mistakeRate);
  expect(sessionMood({hands:20,netBB:5},sal)).toEqual({stuck:0,winning:0,fatigue:0});
 });
 it('make weak short stacks panic or freeze by temperament, and big stacks loosen',()=>{
  expect(stackMood(30,1)).toEqual({desperate:0,bigStack:0});expect(stackMood(6,.3).desperate).toBeGreaterThan(.8);expect(stackMood(40,4).bigStack).toBe(1);
  const gus=regularProfile('gus','mid'),hank=regularProfile('hank','mid'),d={...CALM,...stackMood(5,.3)};
  expect(completeProfile(moodProfile(gus,d)).looseness).toBeGreaterThan(completeProfile(gus).looseness);
  expect(completeProfile(moodProfile(hank,d)).looseness).toBeLessThan(completeProfile(hank).looseness);
 });
});

describe('table talk and shown hands',()=>{
 it('is deterministic per hand, at most two lines, and shows only uncontested winners\' cards',()=>{
  const personas=Object.fromEntries([1,2,3,4,5].map(id=>[id,{name:`P${id}`,profile:id%2?regularProfile('vince','mid'):regularProfile('sal','mid'),regular:id%2?'vince':'sal'}]));
  let lines=0,shows=0;
  for(let i=0;i<300;i++){
   const s=i%2?play(table(i%6,`t${i}`),{[(i%5)+1]:[{type:'raise',to:600}]}):play(table(i%6,`t${i}`,40),Object.fromEntries([0,1,2,3,4,5].map(id=>[id,[{type:'call'},{type:'check'},{type:'check'},{type:'check'}]])) as never);
   const c=handChatter(s,personas);expect(c).toEqual(handChatter(s,personas));expect(c.lines.length).toBeLessThanOrEqual(2);
   for(const show of c.shows){const seat=s.seats.find(x=>x.id===show.seatId)!;expect(s.payouts[seat.id]).toBeGreaterThan(0);expect(s.seats.filter(x=>!x.folded&&x.startingStack>0).length).toBe(1);expect(show.cards).toEqual(seat.hole);}
   for(const l of c.lines){expect(l.seatId).not.toBe(0);expect(l.text.length).toBeGreaterThan(2);}
   lines+=c.lines.length;shows+=c.shows.length;
  }
  expect(lines).toBeGreaterThan(5);expect(shows).toBeGreaterThan(2);
  const live=table(0,'live');expect(handChatter(live,personas)).toBe(QUIET);
  expect(regularOfProfile(regularProfile('ivy','mid'))).toBe('ivy');expect(regularOfProfile(createProfile({selection:'tag'},12345,'mid'))).toBeUndefined();
  const done=play(table(2,'off'),{3:[{type:'raise',to:600}]});expect(chatterFor(done,()=>regularProfile('vince','mid'),false,false)).toBe(QUIET);
 });
 it('says goodbye when a player busts in a tournament',()=>{
  const personas={1:{name:'P1',profile:regularProfile('gus','mid'),regular:'gus'}};let busts=0;
  for(let i=0;i<40;i++){const s=play(table(4,`b${i}`,40,{1:5}),{1:[{type:'raise',to:1000}],0:[{type:'call'}]});if(s.seats.find(x=>x.id===1)!.stack===0){const c=handChatter(s,personas,{tournament:true});if(c.lines.some(l=>l.seatId===1))busts++;}}
  expect(busts).toBeGreaterThan(0);
 });
});

describe('saved games',()=>{
 it('new cash tables use the current human layer, reads follow a personality across sessions, and session facts reset when it changes',async()=>{
  const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4});
  expect(['human-1.1.0','human-1.2.0','human-1.3.0','human-1.4.0','human-1.5.0','human-1.6.0','human-1.7.0','human-1.8.0','human-1.9.0','human-1.10.0','human-1.11.0','human-1.12.0','human-1.13.0','human-1.14.0','human-1.15.0','human-1.16.0','human-1.17.0','human-1.18.0','human-1.19.0','human-1.20.0','human-1.21.0']).toContain(c.data!.active!.humanLayer);expect(HUMAN_LAYER_V11).toBe('human-1.1.0');
  const playHands=async(n:number)=>{for(let h=0;h<n;h++){for(let i=0;i<300&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<n-1){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}};
  await playHands(12);const a=c.data!.active!;
  const facts=cashSessionFacts(c.data!.hands,a,1);expect(facts.hands).toBe(12);
  const reads=cashReads(c.data!.hands,a,1)!;expect(reads.hands).toBe(12);
  const settings=structuredClone(c.data!.sessions.at(-1)!.settings);await c.cashOut();expect(c.error).toBe('');expect(c.data!.active).toBeNull();await c.startSession(settings);expect(c.error).toBe('');await playHands(3);
  const b=c.data!.active!;expect(cashReads(c.data!.hands,b,1)!.hands).toBe(15);expect(cashSessionFacts(c.data!.hands,b,1).hands).toBe(3);
 });
 it('new tournaments carry reads from earlier events for regulars only, and pass the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();
  const run=async(stop:(n:number)=>boolean)=>{for(let guard=0;guard<20000&&c.data!.active&&!stop(c.data!.active!.handNumber);guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.status==='complete'){await c.finishEvent();continue;}
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}
   expect(c.error).toBe('');}};
  await c.startEvent('home-50',9,'fast');expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);expect(policyUsesReads(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);
  expect(c.data!.active!.heroReads).toEqual({});
  await run(()=>false);
  expect(c.data!.completed.length+(c.data!.active?1:0)).toBeGreaterThanOrEqual(1);
  expect(c.data!.active).toBeNull();
  await c.startEvent('home-50',9,'fast');const e=c.data!.active!;expect(Object.values(e.heroReads!).some(r=>r.hands>5)).toBe(true);
  await run(n=>n>4);const now=c.data!.active!;
  const regularName=Object.entries(now.field!.regulars).map(([p])=>now.game.seats.find(s=>s.id===Number(p))?.name).find(Boolean);
  const regularSeat=now.game.seats.find(s=>s.name===regularName)?.id,strangerSeat=now.game.seats.find(s=>s.id!==0&&!Object.keys(now.field!.regulars).includes(String(s.id)))?.id;
  if(regularSeat!==undefined)expect(tournamentReads(now,regularSeat)!.hands).toBeGreaterThanOrEqual(now.heroReads![now.field!.regulars[regularSeat]]?.hands??0);
  if(strangerSeat!==undefined)expect(tournamentReads(now,strangerSeat)!.hands).toBeLessThan(10);
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
  const bad=structuredClone(c.data!);bad.active!.heroReads={priya:{...emptyReads(),foldBlinds:{count:9,chances:1}}};expect(()=>auditTournamentData(bad)).toThrow(/reads/);
  c.close();
 },120000);
});
