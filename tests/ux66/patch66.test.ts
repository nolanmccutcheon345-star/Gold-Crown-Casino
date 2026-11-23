import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {legalActions} from '../../src/core/engine';
import {leakMetrics,leakTrends,METRIC_TARGETS} from '../../src/stats/leaks';
import {interval,verdict,moreNeeded,cashResult,tournamentResult,blackjackResult} from '../../src/stats/by-game';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {tournamentCoachHands,findTournamentLeaks,pushDrills} from '../../src/stats/tournament-coach';
import {answerDrill,buildDrills} from '../../src/stats/drills';
import {heroDecisions} from '../../src/stats/leaks';
import {auditTournamentData} from '../../src/tournament/runtime';
import {tempoOf} from '../../src/bots/tempo-reads';

/* Patch 66: leak trends, tournament leaks and drills, tournament tells, results by game. */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(_e:number|null,n:AppData){this.value=structuredClone(n);}close(){}}
async function cash(sessions:number,hands:number){
  const c=new SessionController(new Port());await c.init();
  for(let s=0;s<sessions;s++){await c.startSession({...DEFAULT_SETTINGS,seats:6});
    for(let h=0;h<hands;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
      if(g.actor===0){const l=legalActions(g);await c.act(l.check?{type:'check'}:{type:'call'},g.handId,g.revision);}else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
     if(h<hands-1){if(c.data!.active!.game.seats.find(x=>x.id===0)!.stack<4000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}
    await c.cashOut();expect(c.error).toBe('');}
  return c.data!;
}
describe('leak trends',()=>{
  it('measures each session and lines them up oldest first',async()=>{
    const data=await cash(3,25);expect(data.sessions.length).toBe(3);
    const m=leakMetrics(data.hands.filter(h=>h.sessionId===data.sessions[0].id));expect(m.map(x=>x.id)).toEqual(METRIC_TARGETS.map(x=>x.id));
    const vpip=m.find(x=>x.id==='vpip')!;expect(vpip.value).not.toBeNull();expect(vpip.value!).toBeGreaterThan(50);// this player calls everything
    const t=leakTrends(data.hands,data.sessions);const v=t.find(x=>x.metric.id==='vpip')!;expect(v.points.length).toBe(3);
    expect(v.points.map(p=>p.sessionId)).toEqual(data.sessions.map(s=>s.id));
    for(const x of m)if(x.value!==null){expect(x.value).toBeGreaterThanOrEqual(0);expect(x.value).toBeLessThanOrEqual(100);}
    expect(leakMetrics([]).every(x=>x.value===null)).toBe(true);
  },600000);
});
describe('results by game',()=>{
  it('ranges and verdicts',()=>{
    expect(interval([1])).toBeNull();const i=interval([1,2,3,4,5])!;expect(i.mean).toBe(3);expect(i.low).toBeLessThan(3);expect(i.high).toBeGreaterThan(3);
    expect(verdict({n:10,mean:5,low:1,high:9})).toBe('winning');expect(verdict({n:10,mean:-5,low:-9,high:-1})).toBe('losing');expect(verdict({n:10,mean:1,low:-3,high:5})).toBe('too-early');
    expect(moreNeeded({n:100,mean:1,low:-3,high:5})).toBe(1500);expect(moreNeeded({n:100,mean:5,low:1,high:9})).toBe(0);
    const bj=blackjackResult([{net:100,bet:100},{net:-100,bet:100},{net:150,bet:100},{net:-100,bet:100},{net:0,bet:0}]);expect(bj.samples).toBe(4);expect(bj.rate!.mean).toBeCloseTo(12.5);expect(bj.net).toBe(50);
    const t=tournamentResult([{cost:1000,net:-1000},{cost:1000,net:3000},{cost:1000,net:-1000}] as never);expect(t.rate!.mean).toBeCloseTo(100/3);expect(t.net).toBe(1000);
    expect(cashResult([]).rate).toBeNull();expect(cashResult([]).verdict).toBe('too-early');expect(bj.verdict).toBe('too-early');expect(bj.minimum).toBe(200);
  });
});
describe('tournaments: coach hands, leaks, drills and tells',()=>{
  it('a 2.23.0 event records snap and slow actions, passes the audit, and its hands feed the coach',async()=>{
    const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',9,'fast');expect(c.error).toBe('');
    expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
    let i=0,tempo=0;
    for(let guard=0;guard<30000&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
      if(a.game.street==='complete'){await c.nextHand();continue;}
      if(a.game.actor===0){i++;await c.act(g.legal.check?{type:'check'}:g.legal.callAmount<=a.game.profile.bigBlind*3?{type:'call'}:{type:'fold'},g.handId,g.revision,i%2?'snap':'tank');}
      else{await c.prepareBot();if(c.data!.active!.pending!.decision!.observationHash.includes(':tempo:'))tempo++;await c.commitBot(a.game.handId,a.game.revision);}
      expect(c.error).toBe('');}
    expect(tempo).toBeGreaterThan(0);expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
    const hands=tournamentCoachHands(c.data!.active!);expect(hands.length).toBeGreaterThan(0);
    const ids=hands.flatMap(h=>h.view.events.filter(e=>e.seatId===0&&e.type==='action')).map(e=>tempoOf(e));expect(ids).toContain('snap');expect(ids).toContain('tank');
    for(const h of hands.slice(0,20)){expect(h.sessionId).toBe(c.data!.active!.id);expect(heroDecisions(h).length).toBeGreaterThan(0);}
    expect(tournamentCoachHands(c.data!.active!)[0]).toBe(hands[0]);// cached
    for(const l of findTournamentLeaks(hands))for(const id of l.handIds)expect(hands.some(h=>h.id===id)).toBe(true);
    for(const d of [...pushDrills(hands),...buildDrills(hands)]){const a=answerDrill(d,hands);expect(['fold','call','raise']).toContain(a.best);expect(a.why.length).toBeGreaterThan(20);
      if(d.push){expect(d.push.stack).toBeLessThanOrEqual(12);expect(a.why).toContain('shoving range');}}
    c.close();
  },600000);
  it('the app wires tournament tells, the Coach tournament scope and the By game page',()=>{
    const app=readFileSync('src/ui/app.ts','utf8'),tp=readFileSync('src/ui/tournament-play.ts','utf8');
    expect(app).toContain('function tournamentCue()');expect(app).toContain('function tournamentQuip()');expect(app).toContain('heroTempo:(handId,revision)=>');
    expect(tp).toContain("const tempo=options.heroTempo?.(shown.handId,shown.revision)??null;");expect(tp).toContain('cue?:{seatId:number;text:string}|null');
    expect(app).toContain('<option value="tournaments"');expect(app).toContain("{ view: 'by-game', label: 'Results by game'");expect(app).toContain('function trendMarkup()');
  });
});
