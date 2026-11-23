import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {Action,BotObservation,Card,GameEvent,GameState,RuleProfile} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {HUMAN_LAYER_V120} from '../../src/bots/human';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {riverReadFrom,rememberPlay,greetingFor,riverDigest} from '../../src/bots/hero-memory';
import {cashMemoryReads} from '../../src/session/human-context';
import {seatRegulars} from '../../src/ui/opponent-setup';
import {tempoOf} from '../../src/bots/tempo-reads';
import {LADDER,startCareer,careerStatus,changeLevel,newMilestones,validCareer,stakeName,MOVE_UP_HANDS} from '../../src/ui/career';

/* Patch 68: bots remember you (cash human-1.21.0) and career mode. */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(_e:number|null,n:AppData){this.value=structuredClone(n);}close(){}}
const cash:RuleProfile={id:'m',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const ev=(seatId:number,street:string,action:Action):GameEvent=>({id:'e',handId:'h',revision:1,type:'action',seatId,street:street as never,action,amount:0,decisionId:seatId===0?'hero:h:1':'d'});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
describe('what they remember of your river bets',()=>{
  it('counts shown-down river bets only, from witnessed hands',()=>{
    const strong={events:[ev(0,'river',{type:'raise',to:900})],board:['Kh','7s','2d','9c','3h'],revealed:[{id:0,hole:['Kc','Kd']}]};
    const bluff={events:[ev(0,'river',{type:'raise',to:900})],board:['Kh','Qs','8d','Jc','2h'],revealed:[{id:0,hole:['4c','3d']}]};
    const noBet={...bluff,events:[ev(0,'river',{type:'call'})]};
    expect(riverReadFrom([strong,bluff,bluff,noBet,{...bluff,revealed:[]}],()=>true)).toEqual({strong:1,weak:2});
    expect(riverReadFrom([strong],()=>false)).toEqual({strong:0,weak:0});expect(riverDigest({strong:3,weak:1})).toBe('3/1');
  });
  it('a player who remembers your river bluffs calls lighter; one who has seen only strength folds more',()=>{
    const hand=()=>{let s:GameState=startHand({handId:'mr',button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
      const a=(x:Action)=>{s=applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:x});};
      for(const x of [{type:'fold'},{type:'fold'},{type:'fold'},{type:'raise',to:500},{type:'fold'},{type:'call'},{type:'check'},{type:'check'},{type:'check'},{type:'check'},{type:'check'}] as Action[])a(x);
      expect(s.street).toBe('river');expect(s.actor).toBe(0);a({type:'raise',to:900});return s;};
    const s=hand(),hiro=regularProfile('hiro','high'),see=(cards:string[]):BotObservation=>{const o=observeBot(s,s.actor!,hiro.policyVersion,'v');o.ownCards=cards as Card[];o.board=['Kh','9c','4d','2s','7h'] as Card[];return o;};
    let calls=0,folds=0;
    for(let i=0;i<300;i++){
      const c=rememberPlay(see(['9d','8d']),hiro,{type:'fold'},{strong:2,weak:3},seedStream(mix(i)));if(c.play==='remember-call'){calls++;expect(()=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:'x',action:c.action})).not.toThrow();}
      if(rememberPlay(see(['Kc','Jd']),hiro,{type:'call'},{strong:6,weak:0},seedStream(mix(i))).play==='remember-fold')folds++;
      expect(rememberPlay(see(['9d','8d']),hiro,{type:'fold'},{strong:1,weak:2},seedStream(mix(i))).play).toBeNull();
      expect(rememberPlay(see(['9d','8d']),createProfile({selection:'station'},3,'neutral'),{type:'fold'},{strong:2,weak:3},seedStream(mix(i))).play).toBeNull();
    }
    expect(calls/300).toBeGreaterThan(.5);expect(folds/300).toBeGreaterThan(.5);
  });
  it('greetings follow what they remember',()=>{
    const t0={snapStrong:0,snapWeak:0,tankStrong:0,tankWeak:0};
    expect(greetingFor({...t0,snapStrong:4},{strong:0,weak:0},10)).toContain('snap-betting');
    expect(greetingFor(t0,{strong:2,weak:2},10)).toContain('bluffs rivers');
    expect(greetingFor(t0,{strong:5,weak:0},10)).toContain('I believe you');
    expect(greetingFor(t0,{strong:0,weak:0},80)).toBe('Good to see you again.');expect(greetingFor(t0,{strong:0,weak:0},5)).toBeNull();
  });
});
async function play(c:SessionController,hands:number,tempo?:(i:number)=>'snap'|'tank'){
  let i=0;
  for(let h=0;h<hands;h++){for(let k=0;k<600&&c.data!.active!.game.street!=='complete';k++){const g=c.data!.active!.game;
    if(g.actor===0){i++;await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision,tempo?.(i));}else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
   if(h<hands-1){if(c.data!.active!.game.seats.find(x=>x.id===0)!.stack<4000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}
}
describe('across sessions',()=>{
  it('regulars carry what they saw into the next session; strangers start fresh; decisions record it',async()=>{
    const c=new SessionController(new Port());await c.init();
    await c.startSession(seatRegulars({...DEFAULT_SETTINGS,seats:6},n=>0%n));expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    await play(c,12,i=>i%2?'snap':'tank');
    const firstRegulars=new Set(c.data!.active!.game.seats.filter(s=>s.id!==0).map(s=>s.name));
    await c.cashOut();
    await c.startSession(seatRegulars({...DEFAULT_SETTINGS,seats:6},n=>0%n));
    const a=c.data!.active!;let remembered=0;
    for(const seat of a.game.seats.filter(s=>s.id!==0)){const m=cashMemoryReads(c.data!.hands,a,seat.id)!;if(firstRegulars.has(seat.name))expect(m.together).toBeGreaterThan(0);if(m.together>0)remembered++;}
    expect(remembered).toBeGreaterThan(0);
    const ids=c.data!.hands.flatMap(h=>h.view.events.filter(e=>e.seatId===0&&e.type==='action').map(e=>tempoOf(e)));expect(ids).toContain('snap');expect(ids).toContain('tank');
    expect(c.data!.hands.flatMap(h=>h.view.events.filter(e=>e.seatId===0&&e.type==='action').map(e=>e.decisionId)).some(id=>id?.endsWith(':undefined'))).toBe(false);
    let tagged=0;
    for(let k=0;k<300&&c.data!.active!.game.street!=='complete';k++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();if(c.data!.active!.pending!.decision!.observationHash.includes(':memory:'))tagged++;await c.commitBot(g.handId,g.revision);}}
    expect(tagged).toBeGreaterThan(0);
    // A stranger table: nobody has met you before.
    await c.cashOut();await c.startSession({...DEFAULT_SETTINGS,seats:6});const b=c.data!.active!;
    for(const seat of b.game.seats.filter(s=>s.id!==0))expect(cashMemoryReads(c.data!.hands,b,seat.id)!.together).toBe(0);
  },600000);
  it('a 1.20.0 table records nothing new',async()=>{
    const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});
    const v=structuredClone(port.value!);v.active!.humanLayer=HUMAN_LAYER_V120;port.value=v;await c.init();
    for(let k=0;k<200&&c.data!.active!.game.street!=='complete';k++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision,'snap');else{await c.prepareBot();expect(c.data!.active!.pending!.decision!.observationHash).not.toContain(':memory:');await c.commitBot(g.handId,g.revision);}}
  },200000);
});
describe('career mode',()=>{
  it('starts at $1/$2, moves up only with the bankroll, the hands and a win, and keeps a story',async()=>{
    const c=new SessionController(new Port());await c.init();
    const career=startCareer(c.data!.wallet,'2000-01-01T00:00:00.000Z');expect(validCareer(career)).toBe(true);expect(stakeName(0)).toBe('$1/$2');expect(LADDER.length).toBe(7);
    const st=careerStatus(c.data!,career);expect(st.stake).toBe('$1/$2');expect(st.canMoveUp).toBe(false);expect(st.needHands).toBe(MOVE_UP_HANDS);expect(st.mustMoveDown).toBe(false);
    expect(st.needBankroll).toBe(30*300*100);
    const up=changeLevel(career,1,st,'2000-01-02T00:00:00.000Z');expect(up.level).toBe(1);expect(up.story.at(-1)!.text).toContain('Moved up to $1/$3');
    expect(careerStatus(c.data!,{...up,level:6}).nextStake).toBeNull();
    const rich=careerStatus({...c.data!,wallet:1000},{...up,level:3});expect(rich.mustMoveDown).toBe(true);
    expect(newMilestones(c.data!,career)).toEqual([]);
    expect(validCareer({...career,level:9})).toBe(false);
  });
});
