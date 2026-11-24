import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile,GameEvent} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,completeProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {showdownImages,imageFrom,imageProfile,imagePlay,type ShowdownHand} from '../../src/bots/image';
import {scareCard,texturePlay} from '../../src/bots/texture';
import {cashImages} from '../../src/session/human-context';
import {NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V210,supportedTournamentPolicy,policyUsesImages} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'im',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),priya=regularProfile('priya','high');
/** Seat 3 opens, the big blind (seat 2) calls; flop dealt with seat 2 to act. */
function headsUp(id:string){let s=startHand({handId:id,button:0,profile:rules,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});s=act(s,{type:'raise',to:600});while(s.actor!==2)s=act(s,{type:'fold'});return act(s,{type:'call'});}
const see=(s:GameState,board:string[],cards:string[],p:BotProfile=hiro):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.board=board as Card[];o.ownCards=cards as Card[];return o;};
const ev=(seatId:number,street:string,action:Action):GameEvent=>({id:`e${Math.random()}`,handId:'h',revision:0,type:'action',seatId,street,action} as GameEvent);
const showdown=(bluffer:number,winner:number):ShowdownHand=>({events:[ev(winner,'flop',{type:'raise',to:800}),ev(bluffer,'flop',{type:'call'}),ev(bluffer,'river',{type:'raise',to:3000}),ev(winner,'river',{type:'call'})],
 board:['Kd','8c','4h','8s','Jc'],payouts:{[winner]:7000},revealed:[{id:bluffer,hole:['7d','6d']},{id:winner,hole:['Kh','Ks']}]});

describe('table image from showdowns',()=>{
 it('a losing river bettor with air is caught bluffing; a betting monster is shown; images fade',()=>{
  const m=showdownImages(showdown(3,2));expect(m.get(3)).toEqual({bluff:true,monster:false});expect(m.get(2)).toEqual({bluff:false,monster:true});
  expect(showdownImages({...showdown(3,2),board:['Kd','8c','4h']}).size).toBe(0);
  const filler:ShowdownHand={events:[],board:[],payouts:{},revealed:[]};
  const fresh=imageFrom([showdown(3,2)],()=>3),old=imageFrom([showdown(3,2),...Array(40).fill(filler)],()=>3);
  expect(fresh.bluff).toBeCloseTo(1,6);expect(old.bluff).toBeLessThan(.3);expect(imageFrom([showdown(3,2)],()=>null).bluff).toBe(0);
 });
 it('call a caught bluffer lighter, respect a shown monster, and own a loose image (skilled players)',()=>{
  let s=headsUp('i1');for(let i=0;i<4;i++)s=act(s,{type:'check'});s=act(s,{type:'check'});s=act(s,{type:'raise',to:1200});
  const o=see(s,['Kd','8c','4h','2s','Jc'],['8h','7s']);expect(o.actingSeat).toBe(2);
  const base=completeProfile(hiro);
  expect(completeProfile(imageProfile(o,hiro,{3:{bluff:1,monster:0}}).profile).traits.riverCuriosity).toBeGreaterThan(base.traits.riverCuriosity);
  expect(completeProfile(imageProfile(o,hiro,{3:{bluff:0,monster:1}}).profile).traits.riverCuriosity).toBeLessThan(base.traits.riverCuriosity);
  expect(imageProfile(o,hiro,{3:{bluff:0,monster:0}}).effect).toBeNull();
  expect(rate(300,i=>imagePlay(o,hiro,{type:'fold'},{3:{bluff:1,monster:0}},seedStream(i)).play==='look-up-bluffer')).toBeGreaterThan(.35);
  expect(rate(300,i=>imagePlay(o,hiro,{type:'call'},{3:{bluff:0,monster:1}},seedStream(i)).play==='respect-monster')).toBeGreaterThan(.25);
  expect(imagePlay(o,hiro,{type:'fold'},null,seedStream(1)).play).toBeNull();
  for(let i=0;i<50;i++){const r=imagePlay(o,hiro,{type:'fold'},{3:{bluff:1,monster:0}},seedStream(i));expect(()=>act(s,r.action)).not.toThrow();}
  // Own image: checked to on the river after being caught bluffing.
  let q=headsUp('i2');for(let i=0;i<4;i++)q=act(q,{type:'check'});q=act(q,{type:'check'});const own=see(q,['Kd','8c','4h','2s','Jc'],['7d','6d']);expect(own.actingSeat).toBe(3);
  expect(completeProfile(imageProfile(own,hiro,{3:{bluff:1,monster:0}}).profile).traits.bluffFrequency).toBeLessThan(base.traits.bluffFrequency);
  expect(imageProfile(own,earl,{3:{bluff:1,monster:0}}).effect).toBeNull();
 });
});

describe('scare cards and textures',()=>{
 it('names what the newest card did',()=>{
  expect(scareCard(['Kh','7h','2c'])).toBeNull();expect(scareCard(['Kh','7h','2c','5h'])).toBe('flush');expect(scareCard(['Kh','7h','2c','3d'])).toBeNull();
  expect(scareCard(['Kh','7h','2c','Ac'])).toBe('overcard');expect(scareCard(['Kh','7h','2c','7d'])).toBe('pair');expect(scareCard(['9h','6c','2d','8s'])).toBe('straight');
  expect(scareCard(['Kh','7h','2c','3d','5h'])).toBe('flush');
 });
 it('barrels scare cards, gives up blanks, slows down and folds one pair on a flush card; dry c-bets and wet give-ups on the flop',()=>{
  // Flop: big blind checks to the raiser (seat 3).
  let f=headsUp('t1');f=act(f,{type:'check'});
  const dry=see(f,['Ks','7d','2c'],['5d','4c']),wet=see(f,['Jh','Th','8c'],['5d','3c']);
  const dc=[...Array(300).keys()].map(i=>texturePlay(dry,hiro,{type:'check'},seedStream(i))).filter(r=>r.play==='dry-cbet');expect(dc.length/300).toBeGreaterThan(.4);
  for(const r of dc){expect(r.action.type==='raise'&&r.action.to).toBeLessThan(dry.pot*.5);expect(()=>act(f,r.action)).not.toThrow();}
  expect(rate(300,i=>texturePlay(wet,hiro,{type:'raise',to:800},seedStream(i)).play==='wet-giveup')).toBeGreaterThan(.3);
  expect(rate(300,i=>texturePlay(dry,earl,{type:'check'},seedStream(i)).play!==null)).toBeLessThan(.15);
  // Turn: seat 3 bet the flop and was called; checked to seat 3.
  let t=headsUp('t2');t=act(t,{type:'check'});t=act(t,{type:'raise',to:800});t=act(t,{type:'call'});t=act(t,{type:'check'});
  const flush=see(t,['Kh','7h','2c','5h'],['Qd','Jc']),blank=see(t,['Kh','7h','2c','3d'],['Qd','Jc']);
  const bar=rate(300,i=>texturePlay(flush,priya,{type:'check'},seedStream(i)).play==='scare-barrel');expect(bar).toBeGreaterThan(.3);
  expect(rate(300,i=>texturePlay(blank,priya,{type:'check'},seedStream(i)).play!==null)).toBe(0);
  expect(rate(300,i=>texturePlay(blank,priya,{type:'raise',to:1400},seedStream(i)).play==='blank-giveup')).toBeGreaterThan(.2);
  expect(rate(300,i=>texturePlay(see(t,['Kh','7h','2c','5h'],['Kc','9d']),hiro,{type:'raise',to:1400},seedStream(i)).play==='slow-down')).toBeGreaterThan(.5);
  // Facing a turn bet with top pair on the flush card.
  let b=headsUp('t3');b=act(b,{type:'check'});b=act(b,{type:'raise',to:800});b=act(b,{type:'call'});b=act(b,{type:'check'});b=act(b,{type:'raise',to:1600});
  const facing=see(b,['Kh','7h','2c','5h'],['Kc','9d']);expect(facing.actingSeat).toBe(2);
  const folds=rate(300,i=>texturePlay(facing,hiro,{type:'call'},seedStream(i)).play==='scare-fold'),fishFolds=rate(300,i=>texturePlay(facing,earl,{type:'call'},seedStream(i)).play==='scare-fold');
  expect(folds).toBeGreaterThan(.25);expect(fishFolds).toBeLessThan(folds);
 });
});

describe('versions',()=>{
 it('new cash tables use 1.9.0, keep images per seat and play complete legal hands',async()=>{
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
  for(let h=0;h<30;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<29){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  const imgs=cashImages(c.data!.hands,c.data!.active!,0);for(const s of c.data!.active!.game.seats){expect(imgs[s.id]).toBeDefined();expect(imgs[s.id].bluff).toBeGreaterThanOrEqual(0);}
  expect(cashImages(c.data!.hands,c.data!.active!,0)).toEqual(imgs);
 },240000);
 it('tournament 2.13.0 is the new-event policy, 2.9.0 stays supported, and new events pass the audit',async()=>{
  expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');expect(TOURNAMENT_POLICY_V210).toBe('synthetic-tournament-2.10.0');
  expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V29)).toBe(true);expect(policyUsesImages(TOURNAMENT_POLICY_V29)).toBe(false);
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },240000);
});
