import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead,type PlayerRead} from '../../src/bots/table-reads';
import {dynamicsPlay,neighbour,aggressiveOpener} from '../../src/bots/dynamics';
import {HUMAN_LAYER_V114} from '../../src/bots/human';
import {checkMtt,createMtt,heroTable,heroCanReEnter,playerAt,playOtherTables,requestHeroReEntry,seatDecision,settleRound} from '../../src/tournament/multi-table';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V217,TOURNAMENT_BOT_POLICY_VERSION} from '../../src/tournament/bot-policy';
import {blindSchedule,EVENT_PRESETS,entryCost,payoutLadder} from '../../src/tournament/presets';
import {lateReserve,reEntryChance} from '../../src/tournament/mtt-event';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentRecords} from '../../src/tournament/runtime';

/* Patch 46: Hero's re-entry (T09) and table dynamics (cash human-1.14.0, tournament 2.17.0). */
const cash:RuleProfile={id:'td',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const mix=(i:number,salt=0)=>(Math.imul(i+1,2654435761)^Math.imul(salt+7,40503))>>>0;
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),earl=regularProfile('big-earl','low');
const see=(s:GameState,cards:string[],p:BotProfile,board?:string[]):BotObservation=>{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards as Card[];if(board)o.board=board as Card[];return o;};
const hand=(id:string)=>startHand({handId:id,button:0,profile:cash,seats:Array.from({length:6},(_,k)=>({id:k,name:`S${k}`,stack:20000}))});
const read=(hands:number,pfr:number):PlayerRead=>{const r=emptyPlayerRead();r.hands=hands;r.pfr={count:Math.round(hands*pfr),chances:hands};r.vpip={count:Math.round(hands*(pfr+.08)),chances:hands};return r;};
const LOOSE=read(40,.4),TIGHT=read(40,.12);

describe('table dynamics',()=>{
  it('knows who sits on each side and who opens too much',()=>{
    let s=hand('n');s=act(s,{type:'fold'});expect(s.actor).toBe(4);const o=see(s,['2c','3d'],hiro);
    expect(neighbour(o,'right')).toBe(3);expect(neighbour(o,'left')).toBe(5);
    expect(aggressiveOpener(LOOSE)).toBe(true);expect(aggressiveOpener(TIGHT)).toBe(false);expect(aggressiveOpener(read(8,.6))).toBe(false);
  });
  it('3-bets and flats more against the habitual opener on the right; legal; not against a tight opener',()=>{
    let s=hand('p3');s=act(s,{type:'fold'});s=act(s,{type:'raise',to:500});expect(s.actor).toBe(5);
    const r=[...Array(400).keys()].map(i=>dynamicsPlay(see(s,['Qc','Tc'],hiro),hiro,{type:'fold'},{4:LOOSE},seedStream(mix(i))));
    expect(rate(400,i=>r[i].play==='position-3bet')).toBeGreaterThan(.2);expect(rate(400,i=>r[i].play==='position-flat')).toBeGreaterThan(.05);
    for(const x of r.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
    expect(r.find(x=>x.play==='position-3bet')!.action).toEqual({type:'raise',to:1500});
    expect(rate(400,i=>dynamicsPlay(see(s,['Qc','Tc'],hiro),hiro,{type:'fold'},{4:TIGHT},seedStream(mix(i))).play!==null)).toBe(0);
    expect(rate(400,i=>dynamicsPlay(see(s,['Qc','Tc'],earl),earl,{type:'fold'},{4:LOOSE},seedStream(mix(i))).play!==null)).toBeLessThan(rate(400,i=>r[i].play!==null));
  });
  it('opens fewer marginal hands with an aggressive player on the left; premiums still open',()=>{
    const s=hand('rl');expect(s.actor).toBe(3);
    expect(rate(400,i=>dynamicsPlay(see(s,['Kd','9c'],hiro),hiro,{type:'raise',to:500},{4:LOOSE},seedStream(mix(i))).play==='respect-left')).toBeGreaterThan(.25);
    expect(rate(400,i=>dynamicsPlay(see(s,['Kc','Qd'],hiro),hiro,{type:'raise',to:500},{4:LOOSE},seedStream(mix(i))).play!==null)).toBe(0);
  });
  it('floats the opener on the right in position after the flop',()=>{
    let s=hand('fl');for(const a of [{type:'fold'},{type:'raise',to:500},{type:'call'},{type:'fold'},{type:'fold'},{type:'fold'}] as Action[])s=act(s,a);
    expect(s.street).toBe('flop');expect(s.actor).toBe(4);s=act(s,{type:'raise',to:700});expect(s.actor).toBe(5);
    const f=[...Array(400).keys()].map(i=>dynamicsPlay(see(s,['Ac','5d'],hiro,['Kh','7d','2c']),hiro,{type:'fold'},{4:LOOSE},seedStream(mix(i))));
    expect(rate(400,i=>f[i].play==='position-float')).toBeGreaterThan(.2);for(const x of f.filter(x=>x.play))expect(()=>act(s,x.action)).not.toThrow();
  });
});

function deps(seed:number){let s=seed>>>0;const next=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s;};let id=0;return {random:(n:number)=>next()%n,handId:()=>`hr-${seed}-${++id}`,token:()=>next()};}
const preset=EVENT_PRESETS.find(p=>p.id==='daily-125')!;
/** Hero shoves every hand until knocked out, re-enters once, then plays normally. */
function heroRun(seed:number){
  const d=deps(seed),entrants=27,closes=20,names=Array.from({length:entrants},(_,i)=>i===0?'You':`Player ${i}`);
  const state=createMtt({entrants,startingStack:preset.startingStack,levels:blindSchedule(preset),handsPerLevel:5,ladder:payoutLadder(preset.buyIn*entrants,entrants),names,registration:{closesAfterRound:closes,maxEntriesPerPerson:2,reserve:lateReserve(names,closes,d.random)}},d);
  const profiles:Record<number,BotProfile>={};for(let p=0;p<entrants;p++)profiles[p]=createProfile({selection:ARCHETYPES[(p+1)%ARCHETYPES.length]},d.token(),'neutral');
  const hooks={reEnters:(p:number)=>d.random(1000)<1000*reEntryChance(profiles[p]),ladderFor:(n:number)=>payoutLadder(preset.buyIn*n,n)};
  const isComplete=()=>state.status==='complete';
  let reEntered=false,guard=0;const log:string[]=[];
  while(state.status!=='complete'&&guard++<4000){
    if(state.status==='hero-out'&&heroCanReEnter(state)&&!reEntered){requestHeroReEntry(state);reEntered=true;expect(heroCanReEnter(state)).toBe(false);log.push(`requested ${state.round}`);}
    const table=state.status==='running'?heroTable(state):null;
    if(table){let game=table.game;const token=d.token();
      while(game.street!=='complete'){const seat=game.actor!;
        if(playerAt(table,seat)===0){const o=observeBot(game,seat,profiles[0].policyVersion,`h:${game.handId}:${game.revision}`);game=applyCommand(game,!reEntered&&o.legal.canRaise?{handId:game.handId,revision:game.revision,seatId:seat,decisionId:`hero:${game.revision}`,action:{type:'raise',to:o.legal.maxRaiseTo!}}:chooseTournamentDecision(o,profiles[0],seedStream((token^game.revision)>>>0),TOURNAMENT_BOT_POLICY_VERSION));}
        else game=applyCommand(game,seatDecision(game,table,profiles,token,TOURNAMENT_BOT_POLICY_VERSION));}
      table.game=game;}
    playOtherTables(state,profiles,TOURNAMENT_BOT_POLICY_VERSION,d);settleRound(state,d,hooks);
    for(const e of state.registration!.entries)if(!profiles[e.player])profiles[e.player]=e.kind==='re-entry'?structuredClone(profiles[e.parent!]):e.kind==='hero-bullet'?structuredClone(profiles[0]):createProfile({selection:'random'},d.token(),'neutral');
    if(!isComplete()){checkMtt(state);const entered=state.registration!.entries.filter(e=>e.kind!=='hero-bullet'&&e.round<=state.round).length+(state.registration!.heroReEntries?.filter(h=>h.round<=state.round).length??0);expect(state.players.reduce((a,p)=>a+p.stack,0)).toBe(entered*state.startingStack);}
  }
  return {state,reEntered,log};
}

describe('Hero re-entry (T09)',()=>{
  const runs=[1,2,3,4,5,6].map(heroRun),used=runs.filter(r=>r.reEntered);
  it('offers re-entry only after a knockout while registration is open; Hero sits down with a fresh stack',()=>{
    expect(used.length).toBeGreaterThan(0);
    for(const {state} of used){const reg=state.registration!,h=reg.heroReEntries![0];
      expect(reg.heroReEntries).toHaveLength(1);expect(h.round).toBeLessThanOrEqual(reg.closesAfterRound+1);
      expect(reg.entries[h.bullet]).toMatchObject({kind:'hero-bullet',name:'You (1)'});expect(state.players[h.bullet].stack).toBe(0);
      expect(reg.entries.filter(e=>e.name.replace(/ \(\d+\)$/,'')==='You')).toHaveLength(2);}
  });
  it('places both of Hero\'s entries once, the knocked-out one at the close, and the prizes add up',()=>{
    for(const {state} of used){const n=state.players.length,reg=state.registration!,bullet=reg.heroReEntries![0].bullet;
      expect(state.finishes).toHaveLength(n);expect(new Set(state.finishes.map(f=>f.player)).size).toBe(n);
      const b=state.finishes.find(f=>f.player===bullet)!,hero=state.finishes.find(f=>f.player===0)!;expect(b.round).toBeLessThanOrEqual(reg.closesAfterRound);expect(b.prize).toBe(0);expect(hero.place).toBeLessThan(b.place);
      expect(state.finishes.reduce((a,f)=>a+f.prize,0)).toBe(preset.buyIn*n);}
  });
});

describe('Hero re-entry through the controller',()=>{
  it('charges a second entry, seats Hero next round, keeps the ledger and the audit, and survives a reload',async()=>{
    const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();const start=c.data!.balance;await c.startEvent('daily-125',27,'fast');
    let reEntered=false;
    for(let guard=0;guard<20000&&c.data!.active&&c.data!.active.status!=='complete';guard++){const a=c.data!.active!,g=c.gameView!;
      if(a.status==='hero-out'&&!reEntered&&c.view?.registration?.heroReEntry?.available){await c.reEnter();expect(c.error).toBe('');reEntered=true;
        expect(c.view!.registration!.heroReEntry!.pending).toBe(true);expect(c.data!.balance).toBe(start-2*entryCost(preset));}
      if(a.game.street==='complete'||a.status!=='running'){await c.nextHand();expect(c.error).toBe('');continue;}
      if(g.actor===0){const raise=!reEntered&&g.legal.canRaise;await c.act(raise?{type:'raise',to:g.legal.maxRaiseTo!}:{type:g.legal.check?'check':'call'},g.handId,g.revision);}
      else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');
      if(reEntered&&c.data!.active!.handNumber%40===0)expect(auditTournamentData(c.data!)).toBeGreaterThan(0);}
    expect(reEntered).toBe(true);expect(c.data!.active!.status).toBe('complete');
    // Total re-entry spend must appear on the result screen, not only in history.
    expect(c.view!.result!.cost).toBe(2*entryCost(preset));
    const e=c.data!.active!,ledger=c.data!.ledger.filter(r=>r.eventId===e.id&&r.kind==='entry');
    expect(ledger.map(r=>r.id)).toEqual([`entry:${e.id}`,`entry:${e.id}:2`]);
    expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
    const reload=new TournamentController(port);await reload.init();expect(reload.error).toBe('');
    await reload.finishEvent();expect(reload.error).toBe('');expect(tournamentRecords(reload.data!).at(-1)!.cost).toBe(2*entryCost(preset));
  },600000);
  it('new events use 2.17.0 and new cash tables 1.14.0',()=>{expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(Number(TOURNAMENT_POLICY_V217.split('.')[1]));expect(HUMAN_LAYER_V114).toBe('human-1.14.0');});
});
