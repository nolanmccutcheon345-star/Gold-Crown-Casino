import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile,GameEvent} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {HUMAN_LAYER_V118} from '../../src/bots/human';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {craft,floatPlay,floatBetPlay,probePlay,blindDefensePlay,sizeReadPlay,multiwayPreflopPlay,sizeReadsFrom,sizeReadsDigest,bigBetsHonest,smallBetsWeak,type SizeRead} from '../../src/bots/table-craft';
import {lateStealPlay,reStealPlay,payJump,payJumpPlay,desperationPlay} from '../../src/tournament/late-game';
import {handRank} from '../../src/tournament/push-fold';
import {NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {planChurn} from '../../src/session/churn';

/* Patch 62: table craft (cash human-1.19.0) and late-game tournament play (2.22.0). */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'tc',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const play=(s:GameState,list:Action[])=>{for(const a of list)s=act(s,a);return s;};
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),station=createProfile({selection:'station'},3,'neutral'),nit=createProfile({selection:'nit'},3,'neutral');
const see=(s:GameState,cards:string[],p:BotProfile,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
const hand=(id:string,stack=20000)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack}))});
const F={type:'fold'} as Action,C={type:'call'} as Action,X={type:'check'} as Action;
const legalAll=(s:GameState,r:{action:Action;play:unknown}[])=>{for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();};
const runs=(n:number,f:(r:()=>number)=>{action:Action;play:unknown})=>[...Array(n).keys()].map(i=>f(seedStream(mix(i))));

describe('who plays the thinking game',()=>{
  it('craft follows skill and aggression',()=>{expect(craft(hiro)).toBeGreaterThan(.4);expect(craft(earl)).toBe(0);expect(craft(station)).toBe(0);});
});

describe('float and probe',()=>{
  // CO (seat 5) opens, the button calls, the blinds fold; on the flop CO c-bets half pot.
  const flopBet=(id:string)=>play(hand(id),[F,F,{type:'raise',to:500},C,F,F,{type:'raise',to:800}]);
  it('floats a c-bet in position with some equity; legal; never for players without craft',()=>{
    const s=flopBet('f1');expect(s.street).toBe('flop');expect(s.actor).toBe(0);const B=['9h','7c','2d'];
    const r=runs(400,x=>floatPlay(see(s,['Ac','Jd'],hiro,B),hiro,F,x));
    expect(rate(400,i=>r[i].play==='float')).toBeGreaterThan(.2);legalAll(s,r);
    expect(rate(400,i=>!!floatPlay(see(s,['Ac','Jd'],earl,B),earl,F,seedStream(mix(i))).play)).toBe(0);
    // No equity at all: no float.
    expect(rate(400,i=>!!floatPlay(see(s,['4c','3d'],hiro,['Kh','Qc','8d']),hiro,F,seedStream(mix(i))).play)).toBe(0);
  });
  it('bets the turn after floating when the raiser checks',()=>{
    const s=play(flopBet('f2'),[C,X]);expect(s.street).toBe('turn');expect(s.actor).toBe(0);
    const r=runs(400,x=>floatBetPlay(see(s,['Ac','Jd'],hiro,['9h','7c','2d','3s']),hiro,X,x));
    expect(rate(400,i=>r[i].play==='float-bet')).toBeGreaterThan(.4);legalAll(s,r);
  });
  it('probes the turn out of position after the raiser checks back the flop',()=>{
    const s=play(hand('p1'),[F,F,{type:'raise',to:500},F,F,C,X,X]);expect(s.street).toBe('turn');expect(s.actor).toBe(2);
    const r=runs(400,x=>probePlay(see(s,['8c','7d'],hiro,['9h','7c','2d','3s']),hiro,X,x));
    expect(rate(400,i=>r[i].play==='probe')).toBeGreaterThan(.15);legalAll(s,r);
    expect(rate(400,i=>!!probePlay(see(s,['8c','7d'],station,['9h','7c','2d','3s']),station,X,seedStream(mix(i))).play)).toBe(0);
  });
});

describe('blind defense',()=>{
  const steal=(id:string)=>play(hand(id),[F,F,{type:'raise',to:500},F,F]);
  it('the big blind defends wider against a cutoff steal and re-steals some',()=>{
    const s=steal('b1');expect(s.actor).toBe(2);
    const r=runs(400,x=>blindDefensePlay(see(s,['Kc','7d'],hiro),hiro,F,x));
    expect(rate(400,i=>r[i].play==='defend')).toBeGreaterThan(.2);legalAll(s,r);
    const r2=runs(400,x=>blindDefensePlay(see(s,['Ac','Qc'],hiro),hiro,F,x));
    expect(rate(400,i=>r2[i].play==='resteal-3bet')).toBeGreaterThan(.05);legalAll(s,r2);
  });
  it('nits give up their blinds; no defense against an early-position open',()=>{
    const s=steal('b2');
    expect(rate(400,i=>blindDefensePlay(see(s,['Jc','8d'],nit),nit,C,seedStream(mix(i))).play==='nit-fold')).toBeGreaterThan(.2);
    const early=play(hand('b3'),[{type:'raise',to:500},F,F,F,F]);expect(early.actor).toBe(2);
    expect(rate(400,i=>!!blindDefensePlay(see(early,['Kc','7d'],hiro),hiro,F,seedStream(mix(i))).play)).toBe(0);
  });
});

describe('size reads',()=>{
  it('counts what witnessed big and small bets turned out to be',()=>{
    const e=(type:GameEvent['type'],seatId:number,amount:number,action?:Action,street='preflop'):GameEvent=>({id:'x',handId:'h',revision:0,type,seatId,amount,action,street:street as never});
    const big={events:[e('blind',1,100),e('blind',2,200),e('action',3,500,{type:'raise',to:500}),e('action',2,300,C),e('action',3,900,{type:'raise',to:900},'river'),e('action',2,900,C,'river')],board:['Kh','9c','4d','2s','7h'],revealed:[{id:3,hole:['Kc','Kd']}]};
    const small={...big,events:[...big.events.slice(0,4),e('action',3,250,{type:'raise',to:250},'river'),e('action',2,250,C,'river')],revealed:[{id:3,hole:['6c','5d']}]};
    const reads=sizeReadsFrom([big,big,big,small,small,small],(_i,seat)=>seat,[2,3]);
    expect(reads[3]).toEqual({bigStrong:3,bigWeak:0,smallStrong:0,smallWeak:3});expect(reads[2]).toBeUndefined();
    expect(bigBetsHonest(reads[3])).toBe(true);expect(smallBetsWeak(reads[3])).toBe(true);
    expect(sizeReadsDigest(reads)).toBe('3=3/0/0/3');expect(sizeReadsDigest(null)).toBe('-');
    // A player not witnessed gives no evidence.
    expect(sizeReadsFrom([big],()=>null,[3])).toEqual({});
  });
  it('uses the pre-bet pot once: half-pot is not a big bet, and 36%-pot is small',()=>{
    const s=play(hand('sizing-boundary'),[F,F,{type:'raise',to:500},F,F,C,X,X,X,X,X]);
    expect(s.street).toBe('river');
    const middle=act(s,{type:'raise',to:500}),small=act(s,{type:'raise',to:400});
    const history:Record<number,SizeRead>={5:{bigStrong:4,bigWeak:0,smallStrong:0,smallWeak:4}};
    const B=['Kh','9c','4d','2s','7h'];
    // Both raises are legal, but neither is a 70%-pot bet at this pot size.
    expect(sizeReadPlay(see(middle,['Kc','Jd'],hiro,B),hiro,C,history,()=>0).play).toBeNull();
    // At 400 into 1,100, the decision is below the 40%-pot small-bet threshold.
    expect(sizeReadPlay(see(small,['9d','8d'],hiro,B),hiro,F,history,()=>0).play).toBe('size-call');
  });
  it('a skilled player folds to an honest big bet and calls a weak small one',()=>{
    const s=play(hand('s1'),[F,F,{type:'raise',to:500},F,F,C,X,X,X,X,X]);expect(s.street).toBe('river');expect(s.actor).toBe(5);
    const big=act(s,{type:'raise',to:900}),small=act(s,{type:'raise',to:300});expect(big.actor).toBe(2);
    const honest:Record<number,SizeRead>={5:{bigStrong:4,bigWeak:0,smallStrong:0,smallWeak:4}};const B=['Kh','9c','4d','2s','7h'];
    const r=runs(400,x=>sizeReadPlay(see(big,['Kc','Jd'],hiro,B),hiro,C,honest,x));expect(rate(400,i=>r[i].play==='size-fold')).toBeGreaterThan(.5);legalAll(big,r);
    const r2=runs(400,x=>sizeReadPlay(see(small,['9d','8d'],hiro,B),hiro,F,honest,x));expect(rate(400,i=>r2[i].play==='size-call')).toBeGreaterThan(.5);legalAll(small,r2);
    expect(rate(400,i=>!!sizeReadPlay(see(big,['Kc','Jd'],earl,B),earl,C,honest,seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>!!sizeReadPlay(see(big,['Kc','Jd'],hiro,B),hiro,C,{},seedStream(mix(i))).play)).toBe(0);
  });
});

describe('multiway preflop',()=>{
  it('a disciplined player folds a loose cold call behind a raise and a caller',()=>{
    const s=play(hand('m1'),[{type:'raise',to:500},C]);expect(s.actor).toBe(5);
    const r=runs(400,x=>multiwayPreflopPlay(see(s,['Kc','9d'],hiro),hiro,C,x));
    expect(rate(400,i=>r[i].play==='mw-fold')).toBeGreaterThan(.3);legalAll(s,r);
    expect(rate(400,i=>!!multiwayPreflopPlay(see(s,['7c','7d'],hiro),hiro,C,seedStream(mix(i))).play)).toBe(0);
  });
});

describe('late-game tournament play',()=>{
  const withAnte=(o:BotObservation)=>{o.publicEvents=[{id:'a',handId:o.handId,revision:0,type:'ante',seatId:2,amount:200} as GameEvent,...o.publicEvents];return o;};
  it('steals wider late with antes in, legal, and only in the stack window',()=>{
    const s=play(hand('l1',6000),[F,F,F]);expect(s.actor).toBe(0);
    const pick=['Kc','8d'];expect(handRank(pick)).toBeGreaterThan(.42);
    const r=runs(400,x=>lateStealPlay(withAnte(see(s,pick,hiro)),hiro,F,x));
    expect(rate(400,i=>r[i].play==='late-steal')).toBeGreaterThan(.3);legalAll(s,r);
    expect(rate(400,i=>!!lateStealPlay(see(s,pick,hiro),hiro,F,seedStream(mix(i))).play)).toBe(0);// no ante
    const deep=play(hand('l2',20000),[F,F,F]);
    expect(rate(400,i=>!!lateStealPlay(withAnte(see(deep,pick,hiro)),hiro,F,seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>!!lateStealPlay(withAnte(see(s,pick,earl)),earl,F,seedStream(mix(i))).play)).toBe(0);
  });
  it('re-steals all-in with 15–25 big blinds over a late open',()=>{
    const s=play(hand('r1',4000),[F,F,{type:'raise',to:450}]);expect(s.actor).toBe(0);
    const r=runs(400,x=>reStealPlay(see(s,['Kc','Qd'],hiro),hiro,F,x));
    expect(rate(400,i=>r[i].play==='resteal-shove')).toBeGreaterThan(.4);legalAll(s,r);
    for(const x of r.filter(x=>x.play))expect(x.action).toEqual({type:'raise',to:4000});
    expect(rate(400,i=>!!reStealPlay(see(s,['7c','4d'],hiro),hiro,F,seedStream(mix(i))).play)).toBe(0);
  });
  it('a medium stack folds marginal calls at a final table when the pay jump is real',()=>{
    const ctx={playersLeft:6,paid:6,stacks:[9000,9000,9000,6000,3000,30000],prizes:[4000,2600,1700,1200,900,700]};
    expect(payJump(ctx)).toBeCloseTo(200/4000);expect(payJump({...ctx,prizes:undefined})).toBe(0);
    const s=play(hand('j1',9000),[{type:'raise',to:9000},F,F,F,F]);expect(s.actor).toBe(2);
    const r=runs(400,x=>payJumpPlay(see(s,['Ac','9d'],hiro),hiro,C,ctx,x));
    expect(rate(400,i=>r[i].play==='pay-jump-fold')).toBeGreaterThan(.3);legalAll(s,r);
    expect(rate(400,i=>!!payJumpPlay(see(s,['Ac','Ad'],hiro),hiro,C,ctx,seedStream(mix(i))).play)).toBe(0);
    expect(rate(400,i=>!!payJumpPlay(see(s,['Ac','9d'],hiro),hiro,C,{...ctx,playersLeft:20,stacks:Array(20).fill(5000),paid:3,prizes:[5000,3000,2000]},seedStream(mix(i))).play)).toBe(0);
  });
  it('short stacks: the skilled shove wider before the blinds, the weak wait too long',()=>{
    const s=play(hand('d1',1200),[F,F]);expect(s.actor).toBe(5);
    const pf={action:F,play:'fold' as const,range:.3,rank:.36};
    const r=runs(400,x=>desperationPlay(see(s,['Qc','7d'],hiro),hiro,pf,x));
    expect(rate(400,i=>r[i].play==='desperate-shove')).toBeGreaterThan(.4);legalAll(s,r);
    const shove={action:{type:'raise',to:1200} as Action,play:'shove' as const,range:.4,rank:.3};
    const r2=runs(400,x=>desperationPlay(see(s,['Qc','7d'],earl),earl,shove,x));
    expect(rate(400,i=>r2[i].play==='waits-too-long')).toBeGreaterThan(.1);legalAll(s,r2);
    expect(rate(400,i=>!!desperationPlay(see(s,['Qc','7d'],hiro),hiro,shove,seedStream(mix(i))).play)).toBe(0);
  });
});

describe('hit-and-run and rebuys',()=>{
  it('regulars top up sooner under 1.19.0',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6,allowTopUp:true});expect(c.error).toBe('');
    const d=structuredClone(c.data!),a=d.active!;a.profiles[3]=hiro;const seat=a.game.seats.find(s=>s.id===3)!;
    // This player's own buy-in is what they top up to when nearly broke.
    seat.stack=1;let own=0;for(let k=0;k<40&&!own;k++){a.game.handId=`own:${k}`;const p=planChurn(d,a,true);if(p?.news.includes(`${seat.name} tops up.`))own=p.settings.seatStacks?.[3]??0;}expect(own).toBeGreaterThan(0);seat.stack=Math.round(.7*own);
    let withCraft=0,without=0;
    for(let k=0;k<60;k++){a.game.handId=`topup:${k}`;
     const p1=planChurn(d,a,true,true,true,true),p0=planChurn(d,a,true,true,true,false);
     if(p1?.settings.seatStacks?.[3]!==undefined&&p1.news.includes(`${seat.name} tops up.`))withCraft++;if(p0?.settings.seatStacks?.[3]!==undefined)without++;}
    expect(withCraft).toBeGreaterThan(20);expect(without).toBe(0);c.close();
  });
});

describe('versions and full runs',()=>{
  it('new cash tables (1.20.0) record craft plays, and play complete legal hands',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    let tagged=0;
    for(let h=0;h<40;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();if(c.data!.active!.pending?.decision?.observationHash.includes(':human-1.21.0:')&&c.data!.active!.pending?.decision?.observationHash.includes(':craft:'))tagged++;await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<39){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
    expect(tagged).toBeGreaterThan(0);
  },400000);
  it('a 1.18.0 table keeps its decisions free of the new plays',async()=>{
    const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});
    const v=structuredClone(port.value!);v.active!.humanLayer=HUMAN_LAYER_V118;port.value=v;await c.init();expect(c.data!.active!.humanLayer).toBe('human-1.18.0');
    for(let i=0;i<200&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();const h=c.data!.active!.pending!.decision!.observationHash;expect(h).not.toContain(':craft:');expect(h).not.toContain(':human-1.21.0:');await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
  },200000);
  it('a 2.22.0 event runs to the end and passes the audit',async()=>{
    expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',9,'fast');expect(c.error).toBe('');
    let late=0;
    for(let guard=0;guard<20000&&c.data!.active!.status!=='complete';guard++){const a=c.data!.active!,g=c.gameView!;
     if(a.game.street==='complete'){await c.nextHand();expect(c.error).toBe('');continue;}
     if(a.game.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();if(c.data!.active!.pending?.decision?.observationHash.includes(':late:'))late++;await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
    expect(c.data!.active!.status).toBe('complete');expect(late).toBeGreaterThan(0);expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
  },600000);
});
