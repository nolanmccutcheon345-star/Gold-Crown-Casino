import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {createProfile,seedStream,completeProfile} from '../../src/bots/profiles';
import {REGULARS,regularProfile,REGULAR_BUY_IN} from '../../src/bots/regulars';
import {HUMAN_LAYER_V14} from '../../src/bots/human';
import {buyInStyle,styleBuyIn,depthProfile,depthPlay,effectiveBB} from '../../src/bots/depth';
import {emptyPlayerRead,playerType,tableReadsProfile,isolate,answerRaise,keyOpponent,type PlayerRead} from '../../src/bots/table-reads';
import {cashTableReads} from '../../src/session/human-context';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V26,TOURNAMENT_POLICY_V27,policyUsesTableReads,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'habits',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
const table=(id:string,stacks:number[],button=0)=>startHand({handId:id,button,profile:rules,seats:stacks.map((stack,seat)=>({id:seat,name:`S${seat}`,stack}))});
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const pro=regularProfile('priya','high'),fish=regularProfile('big-earl','low');
function view(s:GameState,cards:Card[],p:BotProfile=pro):BotObservation {const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards;return o;}
/** A read with the given rates over `hands` hands. */
function read(hands:number,vpip:number,pfr:number,limp:number,agg:number,wtsd:number):PlayerRead {
 const r=emptyPlayerRead(),n=(x:number)=>({count:Math.round(x*hands),chances:hands});
 r.hands=hands;r.vpip=n(vpip);r.pfr=n(pfr);r.limp=n(limp);r.reads.hands=hands;r.reads.aggression=n(agg);r.reads.wtsd=n(wtsd);return r;
}
const MANIAC=read(60,.6,.45,.05,.6,.35),NIT=read(60,.1,.08,.02,.4,.2),STATION=read(60,.5,.08,.1,.12,.55),LIMPER=read(60,.45,.06,.35,.3,.3),SOLID=read(60,.24,.18,.04,.38,.28);

describe('buy-in styles',()=>{
 it('styles come from personality, regulars can name one, amounts respect the table limits',()=>{
  const styles={short:0,standard:0,deep:0};for(let i=1;i<=600;i++)styles[buyInStyle(createProfile({selection:'random'},i,'neutral'))]++;
  expect(styles.short).toBeGreaterThan(30);expect(styles.deep).toBeGreaterThan(30);expect(styles.standard).toBeGreaterThan(200);
  const nits=rate(300,i=>buyInStyle(createProfile({selection:'nit'},i,'neutral'))==='short'),pros=rate(300,i=>buyInStyle(createProfile({selection:'stronger-reg'},i,'neutral'))==='deep');
  const nitDeep=rate(300,i=>buyInStyle(createProfile({selection:'nit'},i,'neutral'))==='deep');
  expect(nits).toBeGreaterThan(nitDeep);expect(pros).toBeGreaterThan(.2);
  for(const [id,style] of Object.entries(REGULAR_BUY_IN)){expect(REGULARS.some(r=>r.id===id)).toBe(true);expect(buyInStyle(regularProfile(id,'mid'),style)).toBe(style);}
  const s={buyIn:20000,bigBlind:200,minBuyInBB:1,maxBuyInBB:500};
  expect(styleBuyIn('short',s)).toBe(8000);expect(styleBuyIn('standard',s)).toBe(20000);expect(styleBuyIn('deep',s)).toBe(40000);
  expect(styleBuyIn('deep',{...s,maxBuyInBB:100})).toBe(20000);expect(styleBuyIn('short',{...s,minBuyInBB:50})).toBe(10000);
 });
 it('new cash tables (1.4.0 and later) seat opponents with their own buy-ins; Hero buys in as chosen',async()=>{
  const c=new SessionController(new Port());await c.init();const before=c.data!.wallet;await c.startSession({...DEFAULT_SETTINGS,seats:9});expect(c.error).toBe('');
  const a=c.data!.active!;expect(Number(a.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(4);void HUMAN_LAYER_V14;
  const hero=a.game.seats.find(s=>s.id===0)!,bots=a.game.seats.filter(s=>s.id!==0);
  expect(hero.startingStack).toBe(DEFAULT_SETTINGS.buyIn);expect(before-c.data!.wallet).toBe(DEFAULT_SETTINGS.buyIn);
  for(const b of bots)expect([8000,20000,40000]).toContain(b.startingStack);
  for(const b of bots)expect(b.startingStack).toBe(styleBuyIn(buyInStyle(a.profiles[b.id]),{...DEFAULT_SETTINGS}));
  expect(c.data!.sessions.at(-1)!.settings.seatStacks).toBeUndefined();
  // The setup screen sends an empty set of seat stacks; a stack typed for a seat is kept.
  const d=new SessionController(new Port());await d.init();await d.startSession({...DEFAULT_SETTINGS,seats:6,seatStacks:{2:12300}});expect(d.error).toBe('');
  const g=d.data!.active!.game;expect(g.seats.find(s=>s.id===2)!.startingStack).toBe(12300);
  for(const b of g.seats.filter(s=>s.id!==0&&s.id!==2))expect(b.startingStack).toBe(styleBuyIn(buyInStyle(d.data!.active!.profiles[b.id]),{...DEFAULT_SETTINGS}));
  const e=new SessionController(new Port());await e.init();await e.startSession({...DEFAULT_SETTINGS,seats:9,seatStacks:{}});
  expect(new Set(e.data!.active!.game.seats.filter(s=>s.id!==0).map(s=>s.startingStack)).size).toBeGreaterThanOrEqual(1);
  for(const b of e.data!.active!.game.seats.filter(s=>s.id!==0))expect(b.startingStack).toBe(styleBuyIn(buyInStyle(e.data!.active!.profiles[b.id]),{...DEFAULT_SETTINGS}));
 });
});

describe('stack depth',()=>{
 it('short stacks tighten and commit lighter; deep stacks chase implied odds and respect big pots',()=>{
  const short=view(table('d1',Array(6).fill(6000)),['Ah','9c']),deep=view(table('d2',Array(6).fill(60000)),['Ah','9c']),mid=view(table('d3',Array(6).fill(20000)),['Ah','9c']);
  expect(effectiveBB(short)).toBe(30);expect(effectiveBB(deep)).toBe(300);
  expect(depthProfile(mid,pro).effect).toBeNull();
  const s=completeProfile(depthProfile(short,pro).profile),d=completeProfile(depthProfile(deep,pro).profile),base=completeProfile(pro);
  expect(s.looseness).toBeLessThan(base.looseness);expect(s.traits.riskTolerance).toBeGreaterThan(base.traits.riskTolerance);expect(s.traits.drawCalling).toBeLessThan(base.traits.drawCalling);
  expect(d.traits.drawCalling).toBeGreaterThan(base.traits.drawCalling);expect(d.traits.riskTolerance).toBeLessThan(base.traits.riskTolerance);
 });
 it('set-mining more the deeper it is, raise-or-fold for short-stackers, none at 70 BB',()=>{
  // UTG (seat 3) opens to 3 BB; the next player faces one raise.
  const facing=(stacks:number[])=>{let s=table('sm',stacks);s=act(s,{type:'raise',to:600});return s;};
  const deep=facing(Array(6).fill(50000)),set=rate(200,i=>depthPlay(view(deep,['5c','5d']),pro,'standard',{type:'fold'},seedStream(i)).play==='set-mine');
  expect(set).toBeGreaterThan(.6);
  expect(depthPlay(view(deep,['Kc','4d']),pro,'standard',{type:'fold'},seedStream(1)).play).toBeNull();
  const mid=facing(Array(6).fill(14000));expect(rate(100,i=>depthPlay(view(mid,['5c','5d']),pro,'standard',{type:'fold'},seedStream(i)).play!==null)).toBe(0);
  const hundred=facing(Array(6).fill(20000)),h=rate(300,i=>depthPlay(view(hundred,['5c','5d']),pro,'standard',{type:'fold'},seedStream(i)).play==='set-mine');expect(h).toBeGreaterThan(.2);expect(h).toBeLessThan(set);
  const short=facing([8000,8000,8000,20000,8000,8000]);
  const jam=depthPlay(view(short,['Ac','Kd'],fish),fish,'short',{type:'call'},seedStream(2));expect(jam.play).toBe('shove');expect(jam.action).toEqual({type:'raise',to:view(short,['Ac','Kd']).legal.maxRaiseTo});
  expect(()=>act(short,jam.action)).not.toThrow();
  expect(rate(200,i=>depthPlay(view(short,['9c','8d'],fish),fish,'short',{type:'call'},seedStream(i)).play==='raise-or-fold')).toBeGreaterThan(.5);
  expect(depthPlay(view(short,['9c','8d'],fish),fish,'standard',{type:'call'},seedStream(2)).play).toBeNull();
 });
});

describe('players read each other',()=>{
 it('labels the obvious types once there are enough hands',()=>{
  expect(playerType(MANIAC)).toBe('maniac');expect(playerType(NIT)).toBe('nit');expect(playerType(STATION)).toBe('station');expect(playerType(LIMPER)).toBe('limper');expect(playerType(SOLID)).toBe('solid');
  expect(playerType(read(8,.9,.8,0,.9,.5))).toBe('unknown');expect(playerType(undefined)).toBe('unknown');
 });
 it('adjusts to the opponent who matters: widen vs a maniac raise, fold more to a nit raise, steal from nits',()=>{
  let s=table('r1',Array(6).fill(20000));s=act(s,{type:'raise',to:600});// seat 3 opens
  const o=view(s,['Ah','Tc']);expect(keyOpponent(o)).toBe(3);
  const base=completeProfile(pro);
  const vm=completeProfile(tableReadsProfile(o,pro,{3:MANIAC}).profile),vn=completeProfile(tableReadsProfile(o,pro,{3:NIT}).profile);
  expect(vm.looseness).toBeGreaterThan(base.looseness);expect(vn.looseness).toBeLessThan(base.looseness);
  expect(tableReadsProfile(o,pro,{3:SOLID}).effect).toBeNull();
  // Weak players notice obvious types too, but less.
  const fishBase=completeProfile(fish),fv=completeProfile(tableReadsProfile(view(s,['Ah','Tc'],fish),fish,{3:MANIAC}).profile);
  expect(fv.looseness-fishBase.looseness).toBeGreaterThan(0);expect(fv.looseness-fishBase.looseness).toBeLessThan(vm.looseness-base.looseness);
  // Folded to the button: the big blind (seat 2) is the key opponent; steal more from a nit.
  let b=table('r2',Array(6).fill(20000));while(b.actor!==0)b=act(b,{type:'fold'});
  const ob=view(b,['Kh','7c']);expect(keyOpponent(ob)).toBe(2);
  expect(completeProfile(tableReadsProfile(ob,pro,{2:NIT}).profile).looseness).toBeGreaterThan(base.looseness);
 });
 it('after the flop: stop bluffing a station, call a maniac down, believe a nit',()=>{
  let s=table('p1',Array(6).fill(20000));s=act(s,{type:'raise',to:600});while(s.actor!==2)s=act(s,{type:'fold'});s=act(s,{type:'call'});
  // Flop: big blind (seat 2) acts first, heads-up against seat 3.
  expect(s.street).toBe('flop');const checkedTo=view(act(s,{type:'check'}),['Ah','Kd']);expect(keyOpponent(checkedTo)).toBe(2);
  const base=completeProfile(pro);
  expect(completeProfile(tableReadsProfile(checkedTo,pro,{2:STATION}).profile).traits.bluffFrequency).toBeLessThan(base.traits.bluffFrequency);
  const bet=act(act(s,{type:'check'}),{type:'raise',to:800}),afterBet=act(bet,{type:'raise',to:2400});// seat 3 bets, seat 2 raises
  const facing=view(afterBet,['Ah','Kd']);expect(keyOpponent(facing)).toBe(2);
  expect(completeProfile(tableReadsProfile(facing,pro,{2:MANIAC}).profile).traits.riverCuriosity).toBeGreaterThan(base.traits.riverCuriosity);
  expect(completeProfile(tableReadsProfile(facing,pro,{2:NIT}).profile).traits.riverCuriosity).toBeLessThan(base.traits.riverCuriosity);
 });
 it('isolates weak limpers with playable hands, legally; never without a read',()=>{
  let s=table('i1',Array(6).fill(20000));s=act(s,{type:'call'});// seat 3 limps
  const o=view(s,['Ad','Jc']);
  const iso=rate(300,i=>isolate(o,pro,{type:'call'},{3:LIMPER},seedStream(i)).isolated);expect(iso).toBeGreaterThan(.4);
  const one=[...Array(50).keys()].map(i=>isolate(o,pro,{type:'call'},{3:LIMPER},seedStream(i))).find(r=>r.isolated)!;
  expect(one.action).toEqual({type:'raise',to:1000});expect(()=>act(s,one.action)).not.toThrow();
  expect(rate(100,i=>isolate(o,pro,{type:'call'},{3:SOLID},seedStream(i)).isolated)).toBe(0);
  expect(rate(100,i=>isolate(o,pro,{type:'call'},null,seedStream(i)).isolated)).toBe(0);
  expect(rate(100,i=>isolate(view(s,['7d','2c']),pro,{type:'fold'},{3:LIMPER},seedStream(i)).isolated)).toBe(0);
 });
 it('answers an obvious type\'s open: fight a maniac with good hands, give up non-premiums to a nit',()=>{
  let s=table('ar',Array(6).fill(20000));s=act(s,{type:'raise',to:600});const o=view(s,['Ad','9c']);
  const fights=[...Array(300).keys()].map(i=>answerRaise(o,pro,{type:'fold'},{3:MANIAC},seedStream(i)));
  expect(fights.filter(r=>r.play).length/300).toBeGreaterThan(.4);for(const r of fights)if(r.play)expect(()=>act(s,r.action)).not.toThrow();
  expect(fights.some(r=>r.play==='3bet-maniac')).toBe(true);
  expect(rate(100,i=>answerRaise(view(s,['7d','2c']),pro,{type:'fold'},{3:MANIAC},seedStream(i)).play!==null)).toBe(0);
  expect(rate(300,i=>answerRaise(o,pro,{type:'call'},{3:NIT},seedStream(i)).play==='fold-to-nit')).toBeGreaterThan(.4);
  expect(rate(100,i=>answerRaise(view(s,['Ad','Ac']),pro,{type:'call'},{3:NIT},seedStream(i)).play!==null)).toBe(0);
  expect(rate(100,i=>answerRaise(o,pro,{type:'fold'},{3:SOLID},seedStream(i)).play!==null)).toBe(0);
 });
 it('cash: reads build from real hands and follow the player in the seat',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9});
  for(let h=0;h<25;h++){for(let i=0;i<500&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<24){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  const d=c.data!,a=d.active!,reads=cashTableReads(d.hands,a);
  expect(reads[0].hands).toBe(d.hands.filter(h=>h.sessionId===a.sessionId).length);
  for(const [seat,r] of Object.entries(reads)){expect(r.vpip.chances).toBeLessThanOrEqual(r.hands);expect(r.vpip.count).toBeLessThanOrEqual(r.hands);if(Number(seat)!==0)expect(r.hands).toBeLessThanOrEqual(reads[0].hands);}
  // Hero only checked or folded: never voluntarily in, never raised.
  expect(reads[0].vpip.count).toBe(0);expect(reads[0].pfr.count).toBe(0);
  expect(cashTableReads(d.hands,a)).toEqual(reads);
 },120000);
});

describe('tournament policy 2.7.0',()=>{
 it('reads on other players reach tournament decisions; 2.6.0 stays supported and ignores them',()=>{
  expect(policyUsesTableReads(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V26)).toBe(true);
  expect(policyUsesTableReads(TOURNAMENT_POLICY_V26)).toBe(false);
  let s=table('t1',Array(6).fill(20000));s=act(s,{type:'raise',to:600});const o=view(s,['Ah','Tc']);
  const ctx={playersLeft:30,paid:4,stacks:Array(30).fill(20000)};
  const d=chooseTournamentDecision(o,pro,seedStream(5),TOURNAMENT_POLICY_V27,ctx,[],null,{3:MANIAC});
  expect(d.observationHash).toMatch(/:table:[a-f0-9]{64}$/);
  expect(d.observationHash).not.toBe(chooseTournamentDecision(o,pro,seedStream(5),TOURNAMENT_POLICY_V27,ctx,[],null,{}).observationHash);
  const old=chooseTournamentDecision(o,pro,seedStream(5),TOURNAMENT_POLICY_V26,ctx,[],null,{3:MANIAC} as never),plain=chooseTournamentDecision(o,pro,seedStream(5),TOURNAMENT_POLICY_V26,ctx,[],null);
  expect(JSON.stringify(old)).toBe(JSON.stringify(plain));
  const calls=(reads:Record<number,PlayerRead>)=>rate(300,i=>chooseTournamentDecision(o,pro,seedStream(i),TOURNAMENT_POLICY_V27,ctx,[],null,reads).action.type!=='fold');
  expect(calls({3:MANIAC})).toBeGreaterThan(calls({3:NIT}));
 });
 it('new events use table reads and pass the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=14&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },180000);
});
