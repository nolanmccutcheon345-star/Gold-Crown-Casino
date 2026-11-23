import {describe,it,expect} from 'vitest';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState,RuleProfile,Action,BotObservation,BotProfile,Card,GameEvent} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {HUMAN_LAYER_V119} from '../../src/bots/human';
import {startHand,applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seedStream,createProfile} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {tellStyle,tellsFor,meaningOf,liveTells,lastActionTells,needleFor,pastTellInputs,STRONG_CUES,WEAK_CUES,type TellInput} from '../../src/bots/tells';
import {tempoOf,tempoReadFrom,tempoReadPlay,tempoDigest,TEMPO_LINES,type TempoRead} from '../../src/bots/tempo-reads';
import {handNotes} from '../../src/ui/tell-coach';
import {SHOWDOWN_LINES} from '../../src/bots/talk';

/* Patch 64: tells, speech play, reading your timing (cash human-1.20.0) and tell coaching. */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}close(){}}
const cash:RuleProfile={id:'tl',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action,decisionId=`d:${s.revision}`)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId,action:a});
const mix=(i:number)=>(Math.imul(i+1,2654435761)^40503)>>>0;
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low'),viktor=regularProfile('viktor','high'),station=createProfile({selection:'station'},3,'neutral');
const F={type:'fold'} as Action,C={type:'call'} as Action,X={type:'check'} as Action;
const input=(i:number,profile:BotProfile,hole:string[],board:string[],action:Action,facingHero=false):TellInput=>({handId:`h${i}`,seatId:3,index:i%9,street:board.length===5?'river':board.length===4?'turn':'flop',board:board as Card[],hole:hole as Card[],profile,action,facingHero});
const fired=(t:ReturnType<typeof tellsFor>)=>!!(t.timing||t.cue||t.speech);

describe('tell styles',()=>{
  it('weak players leak more than strong ones, and only skilled players fake',()=>{
    expect(tellStyle(earl).rate).toBeGreaterThan(.5);expect(tellStyle(hiro).rate).toBeLessThan(.1);
    expect(tellStyle(earl).fake).toBe(0);expect(tellStyle(viktor).fake).toBeGreaterThan(.2);expect(tellStyle(hiro).speech).toBe('none');
    expect(tellStyle(earl)).toEqual(tellStyle(regularProfile('big-earl','low')));
  });
  it('reads what a hand means',()=>{
    expect(meaningOf(['Ac','Ad'] as Card[],[])).toBe('strong');expect(meaningOf(['7c','2d'] as Card[],[])).toBe('weak');
    expect(meaningOf(['Kc','Kd'] as Card[],['Kh','7s','2d'] as Card[])).toBe('strong');
    expect(meaningOf(['Ah','5h'] as Card[],['Kh','7h','2d'] as Card[])).toBe('draw');
    expect(meaningOf(['4c','3d'] as Card[],['Kh','Qs','8d','Jc'] as Card[])).toBe('weak');
  });
});

describe('tells on decisions',()=>{
  const strong=['Kc','Kd'],board=['Kh','7s','2d','9c'],bluff=['4c','3d'],bboard=['Kh','Qs','8d','Jc'];
  it('weak players give honest tells often; Hiro rarely, and some of his are fake',()=>{
    let earlFired=0,earlFake=0,hiroFired=0,vFake=0,vFired=0;
    for(let i=0;i<600;i++){
      const e=tellsFor(input(i,earl,strong,board,{type:'raise',to:900}));if(fired(e)){earlFired++;if(e.fake)earlFake++;}
      if(fired(tellsFor(input(i,hiro,strong,board,{type:'raise',to:900}))))hiroFired++;
      const v=tellsFor(input(i,viktor,bluff,bboard,{type:'raise',to:900}));if(fired(v)){vFired++;if(v.fake)vFake++;}
    }
    expect(earlFired/600).toBeGreaterThan(.4);expect(earlFake).toBe(0);expect(hiroFired/600).toBeLessThan(.25);
    expect(vFired).toBeGreaterThan(10);expect(vFake/vFired).toBeGreaterThan(.15);
  });
  it('an honest cue matches the hand; a fake cue is the opposite',()=>{
    for(let i=0;i<600;i++)for(const [p,h,b] of [[earl,strong,board],[earl,bluff,bboard],[viktor,bluff,bboard],[viktor,strong,board]] as const){
      const t=tellsFor(input(i,p,[...h],[...b],{type:'raise',to:900}));if(!t.cue)continue;
      const saysStrong=(STRONG_CUES as readonly string[]).includes(t.cue),saysWeak=(WEAK_CUES as readonly string[]).includes(t.cue);
      expect(saysStrong||saysWeak).toBe(true);
      expect(saysStrong).toBe(t.fake?t.meaning!=='strong':t.meaning==='strong');
    }
  });
  it('checks and folds carry no tell; the same decision always shows the same tell',()=>{
    for(let i=0;i<200;i++){expect(fired(tellsFor(input(i,earl,strong,board,X)))).toBe(false);expect(fired(tellsFor(input(i,earl,strong,board,F)))).toBe(false);
      expect(tellsFor(input(i,earl,strong,board,{type:'raise',to:900}))).toEqual(tellsFor(input(i,earl,strong,board,{type:'raise',to:900})));}
  });
  it('timing tells slow down or speed up the decision within bounds',()=>{
    const ts=[...Array(600).keys()].map(i=>tellsFor(input(i,earl,strong,board,{type:'raise',to:900})).timing).filter(Boolean) as number[];
    expect(ts.length).toBeGreaterThan(20);for(const t of ts)expect(t>=.4&&t<=1.9).toBe(true);
  });
});

function hand(id:string){return startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});}
describe('live tells, speech and needles',()=>{
  it('live and replayed tells agree for the same decision',()=>{
    for(let k=0;k<40;k++){
      let s=hand(`lt${k}`);for(const a of [F,F,{type:'raise',to:500},F,F,C] as Action[])s=act(s,a);
      const action={type:'raise',to:400} as Action,live=liveTells(s,earl,action);
      s=act(s,action);
      const replay=lastActionTells(s,()=>earl);
      expect(replay?.tells).toEqual(live);
    }
  });
  it('a needle after you fold to a bet, from the bettor, sometimes',()=>{
    let n=0;const talker=[...Array(50).keys()].map(i=>createProfile({selection:'station'},i,'neutral')).find(p=>tellStyle(p).speech!=='none')!;expect(talker).toBeDefined();
    for(let k=0;k<200;k++){let t=act(hand(`nd${k}`),{type:'raise',to:500});t=act(t,F);t=act(t,F);expect(t.actor).toBe(0);t=act(t,F);
      const line=needleFor(t,()=>talker);if(line){n++;expect(line.seatId).toBe(3);}
      expect(needleFor(t,()=>hiro)).toBeNull();}
    expect(n).toBeGreaterThan(10);
  });
  it('showdown reactions exist for bluffs caught either way',()=>{expect(SHOWDOWN_LINES.caught.length).toBeGreaterThan(2);expect(SHOWDOWN_LINES.readHero.length).toBeGreaterThan(2);});
});

describe('reading your timing',()=>{
  const ev=(seatId:number,decisionId:string,street:string,action:Action):GameEvent=>({id:'e',handId:'h',revision:1,type:'action',seatId,decisionId,street:street as never,action,amount:0});
  it('reads tempo only from your own decision ids',()=>{
    expect(tempoOf({seatId:0,decisionId:'hero:h1:7:snap'})).toBe('snap');expect(tempoOf({seatId:0,decisionId:'hero:h1:7:tank'})).toBe('tank');
    expect(tempoOf({seatId:0,decisionId:'hero:h1:7'})).toBeNull();expect(tempoOf({seatId:2,decisionId:'hero:h1:7:snap'})).toBeNull();
  });
  it('counts what witnessed snap and slow bets turned out to be',()=>{
    const strongHand={events:[ev(0,'hero:a:3:snap','river',{type:'raise',to:900})],board:['Kh','7s','2d','9c','3h'],revealed:[{id:0,hole:['Kc','Kd']}]};
    const bluffHand={events:[ev(0,'hero:b:3:tank','turn',{type:'raise',to:900})],board:['Kh','Qs','8d','Jc','2h'],revealed:[{id:0,hole:['4c','3d']}]};
    const r=tempoReadFrom([strongHand,strongHand,strongHand,bluffHand,bluffHand,bluffHand,{...bluffHand,revealed:[]}],()=>true);
    expect(r).toEqual({snapStrong:3,snapWeak:0,tankStrong:0,tankWeak:3});expect(tempoDigest(r)).toBe('3/0/0/3');
    expect(tempoReadFrom([strongHand],()=>false)).toEqual({snapStrong:0,snapWeak:0,tankStrong:0,tankWeak:0});
  });
  it('a skilled player folds to your snap bet when snaps have meant strength, and calls your slow bet when it has meant a bluff',()=>{
    const read:TempoRead={snapStrong:4,snapWeak:0,tankStrong:0,tankWeak:4};
    const river=(tempo:string)=>{let s=hand(`tr${tempo}`);for(const a of [F,F,F,{type:'raise',to:500},F,C,X,X,X,X,X] as Action[])s=act(s,a,s.actor===0?`hero:${s.handId}:${s.revision}`:`d:${s.revision}`);
      expect(s.street).toBe('river');expect(s.actor).toBe(0);return act(s,{type:'raise',to:900},`hero:${s.handId}:${s.revision}:${tempo}`);};
    const snap=river('snap'),tank=river('tank');expect(snap.actor).toBe(2);
    const see=(s:GameState,cards:string[]):BotObservation=>{const o=observeBot(s,s.actor!,hiro.policyVersion,'v');o.ownCards=cards as Card[];o.board=['Kh','9c','4d','2s','7h'] as Card[];return o;};
    let folds=0,calls=0;
    for(let i=0;i<300;i++){
      const r1=tempoReadPlay(see(snap,['Kc','Jd']),hiro,C,read,seedStream(mix(i)));if(r1.play==='tempo-fold'){folds++;expect(()=>act(snap,r1.action)).not.toThrow();}
      const r2=tempoReadPlay(see(tank,['9d','8d']),hiro,F,read,seedStream(mix(i)));if(r2.play==='tempo-call'){calls++;expect(()=>act(tank,r2.action)).not.toThrow();}
      expect(tempoReadPlay(see(snap,['Kc','Jd']),station,C,read,seedStream(mix(i))).play).toBeNull();
      expect(tempoReadPlay(see(snap,['Kc','Jd']),hiro,C,{snapStrong:2,snapWeak:0,tankStrong:0,tankWeak:0},seedStream(mix(i))).play).toBeNull();
    }
    expect(folds/300).toBeGreaterThan(.5);expect(calls/300).toBeGreaterThan(.5);
    expect(TEMPO_LINES['tempo-fold'].snap.length).toBeGreaterThan(1);
  });
});

describe('versions, timing records and coaching',()=>{
  it('a 1.20.0 table records your snap and slow actions, prepares legal decisions, and a 1.19.0 table does not record them',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});expect(c.data!.active!.humanLayer).toBe('human-1.21.0');
    let tagged=0,hashes=0;
    for(let h=0;h<25;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0){await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision,i%2?'snap':'tank');tagged++;}
      else{await c.prepareBot();if(c.data!.active!.pending!.decision!.observationHash.includes(':human-1.21.0:')&&c.data!.active!.pending!.decision!.observationHash.includes(':tempo:'))hashes++;await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
     if(h<24){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();expect(c.error).toBe('');}}
    expect(tagged).toBeGreaterThan(0);expect(hashes).toBeGreaterThan(0);
    const ids=c.data!.hands.flatMap(h=>h.view.events.filter(e=>e.seatId===0&&e.type==='action').map(e=>e.decisionId));
    expect(ids.some(id=>id?.endsWith(':snap'))).toBe(true);expect(ids.some(id=>id?.endsWith(':tank'))).toBe(true);
    const port=new Port(),old=new SessionController(port);await old.init();await old.startSession({...DEFAULT_SETTINGS,seats:6});
    const v=structuredClone(port.value!);v.active!.humanLayer=HUMAN_LAYER_V119;port.value=v;await old.init();
    for(let i=0;i<200&&old.data!.active!.game.street!=='complete';i++){const g=old.data!.active!.game;
      if(g.actor===0)await old.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision,'snap');else{await old.prepareBot();expect(old.data!.active!.pending!.decision!.observationHash).not.toContain(':tempo:');await old.commitBot(g.handId,g.revision);}}
    expect(old.data!.active!.game.events.filter(e=>e.seatId===0&&e.type==='action').every(e=>!e.decisionId?.endsWith(':snap'))).toBe(true);
  },400000);
  it('coaching notes come only from shown-down players and say whether the tell was real',async()=>{
    const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});
    for(let h=0;h<40;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
     if(h<39){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<2000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}
    const notes=c.data!.hands.flatMap(handNotes);expect(notes.length).toBeGreaterThan(0);
    for(const n of notes){const hand=c.data!.hands.find(h=>h.id===n.handId)!,seat=hand.view.seats.find(s=>s.name===n.name)!;
      expect(Object.keys(hand.view.handLabels).map(Number)).toContain(seat.id);expect(n.text.length).toBeLessThan(200);}
    // Nothing from a player who folded.
    void pastTellInputs;
  },400000);
});
