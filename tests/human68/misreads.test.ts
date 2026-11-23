import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,completeProfile,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {boardThreats,invitedMisread,misreadChance,misreadPlay,MISREAD_LINES} from '../../src/bots/misreads';
import {NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';

/* Patch 50: hand-reading mistakes (cash human-1.18.0, tournament 2.21.0). */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'mr',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const rate=(n:number,f:(i:number)=>boolean|string|null)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const earl=regularProfile('big-earl','low'),hiro=regularProfile('hiro','high'),station=createProfile({selection:'station'},3,'neutral');
const see=(s:GameState,cards:string[],p:BotProfile,board:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];o.board=board as Card[];return o;};
const hand=(id:string)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
/** Seat 5 opens, the big blind (seat 2) calls, both check the flop and the turn; on the river seat 2 checks and seat 5 bets. */
function riverBet(id:string){let s=hand(id);for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'},{type:'check'},{type:'check'},{type:'check'},{type:'check'},{type:'raise',to:800}] as Action[])s=act(s,a);return s;}

describe('reading the board',()=>{
  it('spots four-flush, four-straight and paired boards',()=>{
    expect(boardThreats(['Kh','9h','4h','2h','Jc']).flushSuit).toBe('h');expect(boardThreats(['Kh','9h','4h','2c']).flushSuit).toBeNull();
    expect(boardThreats(['9c','8d','7h','6s','2c']).straight).toBe(true);expect(boardThreats(['Ac','2d','3h','4s','9c']).straight).toBe(true);expect(boardThreats(['Kc','9d','6h','3s','2c']).straight).toBe(false);
    expect(boardThreats(['Kc','7d','7h']).paired).toBe(true);
  });
  it('knows which misread a hand invites',()=>{
    expect(invitedMisread(['Kc','Kd'],['Kh','9h','4h','2h','Jc'])).toBe('missed-board-flush');
    expect(invitedMisread(['Kc','Ah'],['Kh','9h','4h','2h','Jc'])).toBeNull();
    expect(invitedMisread(['Ac','Ad'],['9c','8d','7h','6s','2c'])).toBe('missed-board-straight');
    expect(invitedMisread(['Ac','Qd'],['Kc','7d','7h'])).toBe('board-pair-is-mine');
    expect(invitedMisread(['Kc','Qd'],['Kh','7d','2c','4s','9h'])).toBeNull();
  });
  it('only weaker, careless players misread',()=>{expect(misreadChance(earl)).toBeGreaterThan(.2);expect(misreadChance(hiro)).toBe(0);expect(misreadChance(station)).toBeGreaterThan(0);expect(misreadChance({...earl,skill:.9,traits:{...completeProfile(earl).traits,mistakeRate:1}})).toBe(0);});
});

describe('misread plays',()=>{
  it('calls a river bet with a hand the board has beaten; legal; never for skilled players',()=>{
    const s=riverBet('m1');expect(s.street).toBe('river');expect(s.actor).toBe(2);const B=['Kh','9h','4h','2h','Jc'];
    const r=[...Array(400).keys()].map(i=>misreadPlay(see(s,['Kc','Kd'],earl,B),earl,{type:'fold'},seedStream(mix(i))));
    expect(rate(400,i=>r[i].play==='missed-board-flush')).toBeGreaterThan(.2);for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
    expect(rate(400,i=>misreadPlay(see(s,['Kc','Kd'],hiro,B),hiro,{type:'fold'},seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>misreadPlay(see(s,['Kc','Kd'],earl,['Kh','9d','4c','2s','Jc']),earl,{type:'fold'},seedStream(mix(i))).play)).toBe(0);
  });
  it('bets into a paired board with nothing when checked to',()=>{
    let s=hand('m2');for(const a of [{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'fold'},{type:'call'},{type:'check'}] as Action[])s=act(s,a);expect(s.actor).toBe(5);
    const r=[...Array(400).keys()].map(i=>misreadPlay(see(s,['Ac','Qd'],earl,['Kc','7d','7h']),earl,{type:'check'},seedStream(mix(i))));
    expect(rate(400,i=>r[i].play==='board-pair-is-mine')).toBeGreaterThan(.05);for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
  });
  it('every misread has talk lines',()=>{for(const k of ['missed-board-flush','missed-board-straight','board-pair-is-mine'] as const)expect(MISREAD_LINES[k].length).toBeGreaterThan(1);});
});

describe('versions and full runs',()=>{
  it('new cash tables use 1.18.0 and play complete legal hands',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    for(let h=0;h<40;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<39){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
  },400000);
  it('a 2.21.0 event runs to the end and passes the audit',async()=>{
    expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',9,'fast');expect(c.error).toBe('');
    for(let guard=0;guard<20000&&c.data!.active!.status!=='complete';guard++){const a=c.data!.active!,g=c.gameView!;
     if(a.game.street==='complete'){await c.nextHand();expect(c.error).toBe('');continue;}
     if(a.game.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
    expect(c.data!.active!.status).toBe('complete');expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
  },600000);
});
