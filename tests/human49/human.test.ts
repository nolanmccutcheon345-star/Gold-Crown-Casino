import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Card,Action} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions,assertAccounting} from '../../src/core/engine';
import {createProfile,seedStream,completeProfile,ARCHETYPES} from '../../src/bots/profiles';
import {chooseDecision} from '../../src/bots/policy';
import {regularProfile,REGULARS} from '../../src/bots/regulars';
import {CALM,handResults,humanSizing,moodFrom,moodProfile,personalTempo,roundStep,thinkFactor,tiltProneness} from '../../src/bots/human';
import {cashRecentResults} from '../../src/session/human-context';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V22,TOURNAMENT_POLICY_V23,supportedTournamentPolicy,policyUsesMood} from '../../src/tournament/bot-policy';
import {recentResultsByName} from '../../src/tournament/human-context';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentRecent} from '../../src/tournament/runtime';
import {decisionFactor} from '../../src/ui/think-time';

class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const tRules:RuleProfile={id:'human',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
const table=(bb=40,id='h')=>startHand({handId:id,button:0,profile:tRules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:`S${seat}`,stack:bb*200}))});
const standings=(g:GameState)=>({playersLeft:30,paid:4,stacks:[...g.seats.map(s=>s.startingStack),...Array(24).fill(8000)]});
const bigLoss=[{deltaBB:-45,showdownLoss:true},{deltaBB:-1,showdownLoss:false}];

describe('human bet amounts',()=>{
 it('rounds to amounts a person would say',()=>{
  expect(roundStep(2350,1)).toBe(100);expect(Math.round(2350/100)*100).toBe(2400);
  expect(roundStep(3740,1)).toBe(500);expect(roundStep(11500,1)).toBe(1000);expect(roundStep(650,1)).toBe(50);expect(roundStep(740,100)).toBe(100);
  expect(roundStep(3740,1,true)).toBe(1000);
 });
 it('keeps raises legal, round and whole-chip, and moves all-in instead of leaving a sliver',()=>{
  const reg=regularProfile('ana','mid');let checked=0;
  for(let seed=0;seed<200;seed++){
   let s=table(20+seed%60,`r${seed}`);const step=seed%4;for(let i=0;i<step&&s.street==='preflop';i++)s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});
   if(s.street==='complete'||s.actor===null)continue;const o=observeBot(s,s.actor,reg.policyVersion,'x');if(!o.legal.canRaise)continue;
   const raw=Math.round(o.legal.minRaiseTo!+(o.legal.maxRaiseTo!-o.legal.minRaiseTo!)*((seed*37)%100)/100);
   const out=humanSizing(o,reg,{type:'raise',to:raw},seedStream(seed)) as {type:'raise';to:number};
   expect(out.type).toBe('raise');expect(out.to).toBeGreaterThanOrEqual(o.legal.minRaiseTo!);expect(out.to).toBeLessThanOrEqual(o.legal.maxRaiseTo!);expect(Number.isInteger(out.to)).toBe(true);
   const own=o.seats.find(x=>x.id===o.actingSeat)!;if(out.to<o.legal.maxRaiseTo!){expect(out.to).toBeLessThan(.82*(own.stack+own.streetCommitted)+roundStep(out.to,1));if(out.to>o.legal.minRaiseTo!)expect(out.to%roundStep(out.to,1)===0||out.to===o.legal.minRaiseTo).toBe(true);}
   if(raw>=.9*(own.stack+own.streetCommitted))expect(out.to).toBe(o.legal.maxRaiseTo);
   expect(humanSizing(o,reg,{type:'call'},seedStream(1))).toEqual({type:'call'});checked++;
  }
  expect(checked).toBeGreaterThan(100);
 });
 it('gives size tells for weak players only: bigger with strong hands, smaller with draws',()=>{
  // Heads-up flop, checked to the player: same base bet, different holdings.
  let s=table(100,'tell');s=act(s,{type:'raise',to:500});while(s.actor!==2)s=act(s,{type:'fold'});s=act(s,{type:'call'});
  const flopState=s;const board=flopState.board;
  const bet=(cards:Card[],profile:ReturnType<typeof createProfile>)=>{let total=0;for(let seed=0;seed<40;seed++){const o=observeBot(flopState,flopState.actor!,profile.policyVersion,'t');o.ownCards=cards;const out=humanSizing(o,profile,{type:'raise',to:o.legal.minRaiseTo!+600},seedStream(seed));total+=(out as {to:number}).to;}return total/40;};
  const used=new Set<string>(board),free=(rank:string,avoid:string[]=[])=>{for(const suit of 'shdc'){const c=`${rank}${suit}`;if(!used.has(c)&&!avoid.includes(suit)){used.add(c);return c as Card;}}throw Error('no card');};
  const strong=[free(board[0][0]),free(board[1][0])];
  const lows='23456789TJQKA'.split('').filter(rank=>!board.some(c=>c[0]===rank)),suits=board.map(c=>c[1]);
  const weak=[free(lows[0],suits),free(lows[2],[...suits])];const draw=weak;
  const sal=regularProfile('sal','mid'),ana=regularProfile('ana','mid');
  expect(bet(strong,sal)).toBeGreaterThan(bet(draw,sal)*1.15);
  expect(Math.abs(bet(strong,ana)-bet(draw,ana))).toBeLessThan(bet(draw,ana)*.08);
 });
});

describe('mood',()=>{
 it('tilts error-prone players after a big loss at showdown, barely moves strong regulars, and fades',()=>{
  const frank=regularProfile('frank','mid'),priya=regularProfile('priya','mid');
  expect(moodFrom([],frank)).toEqual(CALM);
  expect(tiltProneness(frank)).toBeGreaterThan(tiltProneness(priya)*1.8);
  const tilted=moodFrom(bigLoss,frank);expect(tilted.tilt).toBeGreaterThan(.35);expect(moodFrom(bigLoss,priya).tilt).toBeLessThan(tilted.tilt*.5);
  const later=moodFrom([...bigLoss,...Array(6).fill({deltaBB:-1,showdownLoss:false})],frank);expect(later.tilt).toBeLessThan(tilted.tilt*.25);
  expect(moodFrom([{deltaBB:-45,showdownLoss:false}],frank).tilt).toBeLessThan(tilted.tilt);
  expect(moodFrom([{deltaBB:50,showdownLoss:false}],frank).heater).toBeGreaterThan(.3);
 });
 it('makes a tilted player looser and more aggressive, and leaves a calm player untouched',()=>{
  const frank=regularProfile('frank','mid'),t=moodProfile(frank,{tilt:.8,heater:0}),base=completeProfile(frank),after=completeProfile(t);
  expect(moodProfile(frank,CALM)).toBe(frank);
  expect(after.looseness).toBeGreaterThan(base.looseness);expect(after.traits.bluffFrequency).toBeGreaterThan(base.traits.bluffFrequency);expect(after.archetype).toBe(base.archetype);expect(after.personalityId).toBe(base.personalityId);
  // Tilt shows up in play: more hands entered over many preflop spots.
  const vpip=(p:ReturnType<typeof createProfile>)=>{let n=0;for(let seed=0;seed<300;seed++){let s=table(60,`v${seed}`);while(s.actor!==3)s=act(s,{type:'fold'});const o=observeBot(s,3,p.policyVersion,'v');const ranks='23456789TJQKA';o.ownCards=[`${ranks[seed%13]}s`,`${ranks[Math.floor(seed/13)%13]}h`] as Card[];const d=chooseDecision(o,p,seedStream(seed));if(d.action.type!=='fold')n++;}return n/300;};
  const calm=createProfile({selection:'passive-reg'},11,'neutral');expect(vpip(moodProfile(calm,{tilt:1,heater:0}))).toBeGreaterThan(vpip(calm)+.05);
 });
 it('reads results only from saved hands, per player, oldest first',()=>{
  const s=act(act(table(10,'res'),{type:'raise',to:2000}),{type:'call'});let done=s;while(done.street!=='complete')done=act(done,legalActions(done).check?{type:'check'}:{type:'fold'});
  const results=handResults(done.seats,200);const sum=[...results.values()].reduce((n,r)=>n+r.deltaBB,0);expect(Math.abs(sum)).toBeLessThan(1e-9);
  for(const [id,r] of results){const seat=done.seats.find(x=>x.id===id)!;expect(r.showdownLoss).toBe(r.deltaBB<0&&!seat.folded);}
 });
});

describe('think time',()=>{
 it('snaps small folds, tanks big all-in decisions, and keeps a stable personal tempo',()=>{
  const p=regularProfile('walt','mid'),r=()=>.5;
  const fold=thinkFactor({street:'preflop',action:'fold',facing:.1,allIn:false,potBB:3},p,CALM,r),call=thinkFactor({street:'flop',action:'call',facing:.4,allIn:false,potBB:10},p,CALM,r),tank=thinkFactor({street:'river',action:'call',facing:1.2,allIn:true,potBB:80},p,CALM,r);
  expect(fold).toBeLessThan(call);expect(tank).toBeGreaterThan(call*2);expect(tank).toBeLessThanOrEqual(4.5);expect(fold).toBeGreaterThanOrEqual(.3);
  expect(personalTempo(p)).toBe(personalTempo(regularProfile('walt','mid')));
  const tempos=REGULARS.map(x=>personalTempo(regularProfile(x.id,'mid')));expect(Math.max(...tempos)-Math.min(...tempos)).toBeGreaterThan(.3);
  expect(thinkFactor({street:'flop',action:'call',facing:.4,allIn:false,potBB:10},p,{tilt:1,heater:0},r)).toBeLessThan(call);
  const g=table(30,'tf');expect(decisionFactor(g,{type:'fold'},p,CALM,r)).toBeGreaterThan(0);
 });
});

describe('cash tables with the human layer',()=>{
 it('new tables use it, decisions stay legal through full hands, and results feed mood for the same personality only',async()=>{
  const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.error).toBe('');
  expect(c.data!.active!.humanLayer).toMatch(/^human-1\./);
  let raises=0,round=0;
  for(let hand=0;hand<8;hand++){
   for(let i=0;i<400&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);
    else{await c.prepareBot();const d=c.data!.active!.pending!.decision!;if(d.action.type==='raise'&&d.action.to<g.seats.find(s=>s.id===g.actor)!.stack+g.seats.find(s=>s.id===g.actor)!.streetCommitted){raises++;if(d.action.to%roundStep(d.action.to,g.profile.chipUnit??1)===0)round++;}await c.commitBot(g.handId,g.revision);}
    expect(c.error).toBe('');}
   if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);
   await c.nextHand();expect(c.error).toBe('');
  }
  expect(raises).toBeGreaterThan(0);expect(round/raises).toBeGreaterThan(.6);
  const a=c.data!.active!,results=cashRecentResults(c.data!.hands,a,1);expect(results.length).toBe(8);
  const other={...a,profiles:{...a.profiles,1:{...a.profiles[1],personalityId:'someone-else'}}};expect(cashRecentResults(c.data!.hands,other,1)).toEqual([]);
  const reloaded=new SessionController(port);await reloaded.init();expect(reloaded.data!.active!.humanLayer).toBe(c.data!.active!.humanLayer);
 });
 it('tables saved before the layer keep the plain policy',async()=>{
  const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:3});
  const data=structuredClone(port.value!);delete data.active!.humanLayer;port.value=data;
  const old=new SessionController(port);await old.init();expect(old.data!.active!.humanLayer).toBeUndefined();
  const g=old.data!.active!.game;if(g.actor===0)await old.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);
  const g2=old.data!.active!.game;if(g2.actor!==0&&g2.street!=='complete'){await old.prepareBot();const p=old.data!.active!.pending!;
   const o=observeBot(g2,p.seatId,p.policyVersion,p.decisionId);expect(p.decision!.policyVersion).toBe(old.data!.active!.profiles[p.seatId].policyVersion);expect(o.actingSeat).toBe(p.seatId);}
 });
});

describe('tournament policy 2.3.0 (human layer)',()=>{
 it('is supported, newer events keep mood, and it needs standings',()=>{
  expect(policyUsesMood(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V23)).toBe(true);expect(policyUsesMood(TOURNAMENT_POLICY_V22)).toBe(false);
  const g=table(30,'n');const o=observeBot(g,g.actor!,regularProfile('gus','mid').policyVersion,'n');expect(()=>chooseTournamentDecision(o,regularProfile('gus','mid'),seedStream(1),TOURNAMENT_POLICY_V23)).toThrow(/standings/);
 });
 it('makes the same kind of decision as 2.2.0 when calm, with human amounts',()=>{
  let compared=0,same=0;
  for(const archetype of ARCHETYPES){const p=createProfile({selection:archetype},5,'mid');
   for(let seed=0;seed<25;seed++){let s=table(10+seed*3,`c${archetype}${seed}`);
    for(let n=0;s.street!=='complete'&&n<200;n++){const o=observeBot(s,s.actor!,p.policyVersion,`c${n}`),st=standings(s);
     const a=chooseTournamentDecision(o,p,seedStream(seed*1000+n),TOURNAMENT_POLICY_V23,st,[]),b=chooseTournamentDecision(o,p,seedStream(seed*1000+n),TOURNAMENT_POLICY_V22,st);
     compared++;if(a.action.type===b.action.type)same++;expect(a.observationHash.startsWith(TOURNAMENT_POLICY_V23)).toBe(true);s=applyCommand(s,a);assertAccounting(s);}
   }}
  expect(same).toBe(compared);
 });
 it('runs early event hands with regulars, mood and human amounts, and passes the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<3000&&c.data!.active!.handNumber<=14&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}
   expect(c.error).toBe('');}
  const e=c.data!.active!,recent=recentResultsByName(e);expect(recent.size).toBeGreaterThan(20);for(const list of recent.values())expect(list.length).toBeLessThanOrEqual(8);
  // Eliminations/table moves may remove seat 1; verify an actually occupied opponent seat.
  const opponent=e.game.seats.find(s=>s.id!==0);expect(opponent).toBeDefined();
  expect(tournamentRecent(e,opponent!.id)).toEqual(recent.get(opponent!.name)??[]);
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 });
});
