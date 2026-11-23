import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions,assertAccounting} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {REGULARS,regularProfile,regularById} from '../../src/bots/regulars';
import {habitsOf,applyHabits,applyMinRaise} from '../../src/bots/habits';
import {HUMAN_LAYER_V12} from '../../src/bots/human';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V25,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {drawField,regularPool,regularCount,validateField,fieldNames,fieldPopulation,FIELD_VERSION_1} from '../../src/tournament/field';
import {EVENT_PRESETS} from '../../src/tournament/presets';
import {seatRegulars,cashStake,initializeOpponentSettings} from '../../src/ui/opponent-setup';
import {regularFor} from '../../src/bots/regulars';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';

class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'habits',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
const table=(button:number,id:string,bb=60)=>startHand({handId:id,button,profile:rules,seats:Array.from({length:6},(_,seat)=>({id:seat,name:`S${seat}`,stack:bb*200}))});
const H=(id:string)=>habitsOf(regularProfile(id,'mid'),regularById(id)!.habits);
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
/** Observation for the actor with chosen own cards and board. */
function view(s:GameState,cards:Card[]):BotObservation {const o=observeBot(s,s.actor!,regularProfile('dot','mid').policyVersion,'v');o.ownCards=cards;return o;}
const legal=(s:GameState,a:Action)=>{expect(()=>act(s,a)).not.toThrow();};
/** Flop dealt heads-up: seat 3 (UTG) raises, seat 2 (big blind) calls; the board is then whatever was dealt. */
function headsUpFlop(id:string){let s=table(0,id);s=act(s,{type:'raise',to:500});while(s.actor!==2)s=act(s,{type:'fold'});s=act(s,{type:'call'});return s;}
/** Top pair with the best free kicker. */
const pairWith=(board:string[])=>{const order='23456789TJQKA',top=[...board].sort((a,b)=>order.indexOf(b[0])-order.indexOf(a[0]))[0],used=new Set(board),free=(r:string)=>{for(const x of 'shdc'){const c=`${r}${x}`;if(!used.has(c)){used.add(c);return c;}}return null;};const kicker=[...order].reverse().find(r=>r!==top[0]&&!board.some(c=>c[0]===r))!;return [free(top[0]),free(kicker)] as Card[];};

describe('live-player habits',()=>{
 it('follow personality: recreational players limp, donk and overbet; strong regulars float and fire later',()=>{
  const dot=H('dot'),bubba=H('bubba'),hiro=H('hiro'),kenny=H('kenny'),nina=H('nina'),viktor=H('viktor'),pete=H('pete'),jules=H('jules');
  expect(bubba.limpCall).toBeGreaterThan(.7);expect(dot.limpCall).toBeGreaterThan(.7);expect(hiro.limpCall).toBeLessThan(.05);
  expect(kenny.donk).toBeGreaterThan(hiro.donk+.4);expect(nina.trap).toBeGreaterThan(.6);expect(pete.overbetTell).toBeGreaterThan(.4);expect(hiro.overbetTell).toBe(0);
  expect(viktor.float).toBeGreaterThan(.3);expect(viktor.delayedBet).toBeGreaterThan(.3);expect(H('sal').float).toBe(0);expect(jules.minRaise).toBeGreaterThan(.7);
  for(const r of REGULARS)for(const v of Object.values(H(r.id)))expect(v>=0&&v<=1).toBe(true);
 });
 it('limp instead of opening, and limp-call small raises',()=>{
  let s=table(0,'limp');const o=view(s,['9s','8d']),bubba=regularProfile('bubba','mid');
  const limps=rate(200,i=>{const r=applyHabits(o,bubba,{type:'raise',to:500},H('bubba'),seedStream(i));if(r.habit)legal(s,r.action);return r.action.type==='call';});
  expect(limps).toBeGreaterThan(.7);expect(rate(200,i=>applyHabits(o,regularProfile('hiro','mid'),{type:'raise',to:500},H('hiro'),seedStream(i)).action.type==='call')).toBeLessThan(.05);
  expect(applyHabits(view(s,['As','Ah']),bubba,{type:'raise',to:500},H('bubba'),seedStream(1)).action.type).toBe('raise');
  // Seat 3 limps, the button raises; seat 3 would fold but limp-calls.
  s=act(s,{type:'call'});while(s.actor!==0)s=act(s,{type:'fold'});s=act(s,{type:'raise',to:600});while(s.actor!==3)s=act(s,{type:'fold'});
  const back=view(s,['Js','9s']);const calls=rate(200,i=>applyHabits(back,bubba,{type:'fold'},H('bubba'),seedStream(i)).action.type==='call');expect(calls).toBeGreaterThan(.5);legal(s,{type:'call'});
 });
 it('lead into the preflop raiser with a piece, out of position',()=>{
  const s=headsUpFlop('donk');expect(s.actor).toBe(2);const o=view(s,pairWith(s.board));
  const leads=rate(200,i=>{const r=applyHabits(o,regularProfile('kenny','mid'),{type:'check'},H('kenny'),seedStream(i));if(r.habit==='donk')legal(s,r.action);return r.habit==='donk';});
  expect(leads).toBeGreaterThan(.5);expect(rate(200,i=>applyHabits(o,regularProfile('hiro','mid'),{type:'check'},H('hiro'),seedStream(i)).habit==='donk')).toBeLessThan(.15);
 });
 it('check strong hands first, then check-raise',()=>{
  let s=headsUpFlop('trap');const board=s.board as Card[],set=[`${board[0][0]}${'shdc'.split('').find(x=>!board.some(c=>c===`${board[0][0]}${x}`))!}`,`${board[0][0]}${'cdhs'.split('').find(x=>!board.some(c=>c===`${board[0][0]}${x}`)&&x!=='shdc'.split('').find(y=>!board.some(c=>c===`${board[0][0]}${y}`)))!}`] as Card[];
  const o=view(s,set),nina=regularProfile('nina','mid');
  expect(rate(200,i=>applyHabits(o,nina,{type:'raise',to:400},H('nina'),seedStream(i)).habit==='trap')).toBeGreaterThan(.3);
  s=act(s,{type:'check'});s=act(s,{type:'raise',to:400});const facing=view(s,set);
  const raises=rate(200,i=>{const r=applyHabits(facing,nina,{type:'call'},H('nina'),seedStream(i));if(r.habit)legal(s,r.action);return r.action.type==='raise';});expect(raises).toBeGreaterThan(.4);
 });
 it('overbet the river with a monster (weak players), min-raise (min-raisers), and stay legal',()=>{
  let s=headsUpFlop('river');while(s.street!=='river'&&s.street!=='complete')s=act(s,{type:'check'});expect(s.street).toBe('river');
  // Fixed quads: a random set is not necessarily a river monster.
  const o=view(s,['As','Ah']);o.board=['Ac','Ad','7h','3c','2d'];
  const out=applyHabits(o,regularProfile('pete','mid'),{type:'raise',to:o.legal.minRaiseTo!},H('pete'),seedStream(3));
  const many=rate(200,i=>applyHabits(o,regularProfile('pete','mid'),{type:'raise',to:o.legal.minRaiseTo!+200},H('pete'),seedStream(i)).habit==='overbetTell');expect(many).toBeGreaterThan(.2);
  if(out.habit==='overbetTell'){legal(s,out.action);expect((out.action as {to:number}).to).toBeGreaterThan(o.pot);}
  const pre=table(0,'mr'),po=view(pre,['Ks','Qd']);const mins=rate(200,i=>applyMinRaise(po,{type:'raise',to:600},H('jules'),seedStream(i)).action.type==='raise'&&(applyMinRaise(po,{type:'raise',to:600},H('jules'),seedStream(i)).action as {to:number}).to===po.legal.minRaiseTo);
  expect(mins).toBeGreaterThan(.3);expect(applyMinRaise(po,{type:'call'},H('jules'),seedStream(1)).action).toEqual({type:'call'});
 });
 it('policy 2.5.0 plays complete legal hands for every regular and stays supported',()=>{
  expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V25)).toBe(true);
  let decisions=0;
  for(const r of REGULARS){const p=regularProfile(r.id,'mid');
   for(let seed=0;seed<3;seed++){let s=startHand({handId:`${r.id}:${seed}`,button:seed%6,profile:rules,seats:Array.from({length:6},(_,i)=>({id:i,name:`S${i}`,stack:200*(8+((seed*7+i*11)%70))}))});
    const st={playersLeft:20,paid:3,stacks:[...s.seats.map(x=>x.startingStack),...Array(14).fill(6000)]};
    for(let n=0;s.street!=='complete'&&n<200;n++){const o=observeBot(s,s.actor!,p.policyVersion,`h${n}`),d=chooseTournamentDecision(o,p,seedStream(seed*999+n),TOURNAMENT_POLICY_V25,st,[],null);expect(d.observationHash.startsWith(TOURNAMENT_POLICY_V25+':')).toBe(true);decisions++;s=applyCommand(s,d);assertAccounting(s);}
    expect(s.street).toBe('complete');}}
  // Legal-hand coverage must not depend on which habits happen in a random deal.
  // Dedicated fixed-observation tests above check each habit's frequency.
  expect(decisions).toBeGreaterThan(REGULARS.length*3);
 });
});

describe('bigger cast by stakes',()=>{
 it('fills cash tables with the regulars of the table\'s stakes first',()=>{
  expect(cashStake(200)).toBe('low');expect(cashStake(500)).toBe('mid');expect(cashStake(2000)).toBe('high');
  for(const [bb,stake] of [[200,'low'],[1000,'mid'],[5000,'high']] as const){
   const s=seatRegulars(initializeOpponentSettings({...DEFAULT_SETTINGS,seats:9,smallBlind:bb/2,bigBlind:bb,buyIn:bb*100}),n=>n-1);
   const seated=s.opponents!.slice(0,8).map(c=>regularFor(c)!);expect(new Set(seated.map(r=>r.id)).size).toBe(8);
   expect(seated.every(r=>r.stakes.includes(stake))).toBe(true);
  }
 });
 it('draws tournament regulars from the tier\'s stakes, and still accepts fields saved before patch 33',()=>{
  for(const preset of EVENT_PRESETS){let s=7;const random=(n:number)=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s%n;},token=()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s;};
   const d=drawField(preset,preset.fields.at(-1)!,random,token),pool=regularPool(preset);
   expect(Object.values(d.field.regulars).every(id=>pool.includes(id))).toBe(true);expect(d.field.version).toBe('cast-2');}
  // A cast-1 field: the original twenty, count capped at twenty, any tier.
  const preset=EVENT_PRESETS.find(p=>p.id==='nightly-200')!,entrants=90,old=REGULARS.slice(0,20).map(r=>r.id),count=regularCount(entrants);
  const regulars:Record<string,string>=Object.fromEntries(old.slice(0,count).map((id,i)=>[String(i+1),id]));
  const population=fieldPopulation(preset),field={version:FIELD_VERSION_1,population,regulars} as const,profiles:Record<number,ReturnType<typeof createProfile>>={};
  for(let p=0;p<entrants;p++)profiles[p]=regulars[String(p)]?regularProfile(regulars[String(p)],population):createProfile({selection:'random'},p+1,population);
  expect(()=>validateField({entrants,preset,profiles,field},fieldNames(entrants,field))).not.toThrow();
  const wrong={...field,regulars:{...regulars,'1':'viktor'}};expect(()=>validateField({entrants,preset,profiles:{...profiles,1:regularProfile('viktor',population)},field:wrong},fieldNames(entrants,wrong))).toThrow(/pool/);
 });
});

describe('saved games',()=>{
 it('cash tables play complete legal hands under 1.2.0 habits and later layers',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(Number(c.data!.active!.humanLayer!.split('.')[1])).toBeGreaterThanOrEqual(2);void HUMAN_LAYER_V12;
  for(let h=0;h<6;h++){for(let i=0;i<400&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<5){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}
 });
 it('new tournaments use 2.5.0 or later with stake-drawn regulars and pass the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const e=c.data!.active!;expect(e.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);void TOURNAMENT_POLICY_V25;expect(e.field!.version).toBe('cast-2');
  for(let guard=0;guard<3000&&c.data!.active!.handNumber<=8&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 });
});
