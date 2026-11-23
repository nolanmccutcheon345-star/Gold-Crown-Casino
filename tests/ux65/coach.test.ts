import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {Card} from '../../src/contracts';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import {legalActions} from '../../src/core/engine';
import {heroPosition} from '../../src/stats/cash';
import {findLeaks,heroDecisions,positionOf} from '../../src/stats/leaks';
import {buildDrills,answerDrill,equityVsRange,observedStyle} from '../../src/stats/drills';

/* Patch 65: leak finder and spot drills. */
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(_e:number|null,n:AppData){this.value=n;}close(){}}
async function play(hands:number){
  const c=new SessionController(new Port());await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6});
  let r=7;const rand=()=>{r=(r*16807)%2147483647;return r/2147483647;};
  for(let h=0;h<hands;h++){for(let i=0;i<600&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;
    if(g.actor===0){const l=legalActions(g);
      // A leaky player: calls almost everything, never bets, folds most river bets.
      const a=g.street==='river'&&l.callAmount>0?(rand()<.8?{type:'fold'}:{type:'call'}):l.check?{type:'check'}:rand()<.8?{type:'call'}:{type:'fold'};
      await c.act(a as never,g.handId,g.revision);}else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}}
   if(h<hands-1){if(c.data!.active!.game.seats.find(s=>s.id===0)!.stack<4000)await c.topUp(DEFAULT_SETTINGS.buyIn);await c.nextHand();}}
  return c.data!;
}
let data:AppData;
describe('leak finder',()=>{
  it('finds the leaks a calling, never-betting, river-folding player has, worst first, with real hands',async()=>{
    data=await play(120);
    const leaks=findLeaks(data.hands),ids=leaks.map(l=>l.id);
    expect(ids).toContain('too-loose');expect(ids).toContain('passive');expect(ids).toContain('river-overfold');
    for(let i=1;i<leaks.length;i++)expect(leaks[i].bb).toBeGreaterThanOrEqual(leaks[i-1].bb);
    for(const l of leaks){expect(l.handIds.length).toBeGreaterThan(0);for(const id of l.handIds)expect(data.hands.some(h=>h.id===id)).toBe(true);expect(l.count).toBeLessThanOrEqual(l.of);}
    const river=leaks.find(l=>l.id==='river-overfold')!;expect(river.finding).toMatch(/You folded to \d+ of \d+ river bets \(\d+%\)\./);
  },400000);
  it('says nothing about a handful of hands',()=>{expect(findLeaks(data.hands.slice(0,3))).toEqual([]);});
  it('decisions use the exact view before each action, and positions match',()=>{
    for(const hand of data.hands.slice(0,40))for(const d of heroDecisions(hand)){
      expect(d.frame.actor).toBe(0);expect(d.frame.revision).toBe(d.event.revision-1);expect(d.board).toEqual(d.frame.board);
      expect(d.toCall).toBe(d.frame.legal.callAmount);expect(positionOf(hand.view,0)).toBe(heroPosition(hand.view));
      if(d.toCall>0&&!(d.street==='preflop'&&d.raisesBefore===0))expect(d.villain).not.toBeNull();
    }
  });
});
describe('spot drills',()=>{
  it('builds drills from decisions facing a bet, one per hand, with what happened',()=>{
    const drills=buildDrills(data.hands);expect(drills.length).toBeGreaterThan(0);expect(drills.length).toBeLessThanOrEqual(10);
    expect(new Set(drills.map(d=>d.handId)).size).toBe(drills.length);
    for(const d of drills){
      expect(d.toCall).toBeGreaterThan(0);expect(['fold','call','raise']).toContain(d.did);expect(d.board.length).toBe({preflop:0,flop:3,turn:4,river:5}[d.street as 'flop']);
      expect(d.prompt).toContain('to call');const hand=data.hands.find(h=>h.id===d.handId)!;expect(d.net).toBe(hand.net);
      if(d.shown)expect(Object.keys(hand.view.handLabels).map(Number)).toContain(d.villain.seat);
    }
  });
  it('answers are deterministic and explain the price and the chance to win',()=>{
    const d=buildDrills(data.hands)[0],a=answerDrill(d,data.hands),b=answerDrill(d,data.hands);
    expect(answerDrill(d,data.hands.filter(h=>h.number<d.number))).toEqual(a);expect(a).toEqual(b);expect(a.why).toMatch(/You need \d+% to call/);expect(a.needed).toBeCloseTo(d.toCall/(d.pot+d.toCall));
    expect(answerDrill({...d,canRaise:false},data.hands).best).not.toBe('raise');expect(a.equity).toBeGreaterThanOrEqual(0);expect(a.equity).toBeLessThanOrEqual(1);
  });
  it('equity sanity',()=>{
    expect(equityVsRange(['Ac','Ad'] as Card[],[],1,'s')).toBeGreaterThan(.8);
    expect(equityVsRange(['Ac','Kc'] as Card[],['Qc','Jc','Tc','2d','3h'] as Card[],.3,'s')).toBe(1);
    expect(equityVsRange(['7c','2d'] as Card[],['Kh','Kd','9s','9c','4h'] as Card[],.25,'s')).toBeLessThan(.05);
    expect(observedStyle([],3,'Nobody').label).toBe('not much seen yet');
  });
  it('the app has a Coach page, recap leaks and a link into the drills',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');
    expect(app).toContain("{ view: 'coach', label: 'Leaks and drills'");expect(app).toContain('data-coach-session=');expect(app).toContain('data-drill-choice=');expect(app).toContain('<h4>Where you lost money</h4>');
  });
});
