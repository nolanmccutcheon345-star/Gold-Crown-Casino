import {describe,it,expect,vi} from 'vitest';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,projectView,startHand} from '../../src/core/engine';
import {secureDeck,standardDeck} from '../../src/core/deck';
import {evaluate,compareRanks} from '../../src/core/evaluator';

const profile:RuleProfile={id:'practice',version:'0.1.0',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const make=(stacks=[200,200,200],button=0)=>startHand({handId:'test',profile,seats:stacks.map((stack,id)=>({id,name:`Seat ${id}`,stack})),button});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d-${s.revision}`,action});
const passive=(s:GameState)=>act(s,legalActions(s).check?{type:'check'}:{type:'call'});
function finish(s:GameState):GameState {let n=0;while(s.street!=='complete'&&n++<100)s=passive(s);expect(s.street).toBe('complete');return s;}
/** Test-only private fixture override. Production startHand has no deck injection. */
function arrange(s:GameState,hands:string[][],board:string[]):GameState {
  const next=structuredClone(s); hands.forEach((h,i)=>next.seats[i].hole=h);
  const used=[...hands.flat(),...board]; const rest=standardDeck().filter(c=>!used.includes(c));
  const run=[rest.shift()!,...board.slice(0,3),rest.shift()!,board[3],rest.shift()!,board[4]];
  next.deck=[...hands.flat(),...run,...rest]; next.deckCursor=hands.length*2;return next;
}

describe('deck and hand ranking',()=>{
 it('produces all 52 unique valid cards',()=>{const d=secureDeck();expect(new Set(d).size).toBe(52);expect([...d].sort()).toEqual(standardDeck().sort());});
 it('fails closed without secure crypto',()=>{vi.stubGlobal('crypto',undefined);try{expect(secureDeck).toThrow('Secure randomness unavailable');}finally{vi.unstubAllGlobals();}});
 it('evaluates wheel, royal, full house and best of seven',()=>{
  expect(evaluate(['Ac','2d','3h','4s','5c'])).toEqual([4,5]);
  expect(evaluate(['As','Ks','Qs','Js','Ts','2d','2h'])).toEqual([8,14]);
  expect(evaluate(['As','Ah','Ad','Ks','Kh','Kd','2h'])).toEqual([6,14,13]);
  expect(evaluate(['As','Ah','Ks','Kh','Qd','Jc','2s'])).toEqual([2,14,13,12]);
  expect(compareRanks(evaluate(['As','2s','3s','4s','5s']),evaluate(['2s','3s','4s','5s','6s']))).toBe(-1);
 });
 it('rejects duplicate and malformed cards',()=>{expect(()=>evaluate(['As','As','2h','3c','4d'])).toThrow();expect(()=>evaluate(['As','2h','3c','4d','ZZ'])).toThrow();});
});

describe('authoritative betting',()=>{
 it('deals heads-up with button small blind acting first and BB first postflop',()=>{
  let s=make([200,200]); expect(s.smallBlindSeat).toBe(0);expect(s.bigBlindSeat).toBe(1);expect(s.actor).toBe(0);
  s=act(s,{type:'call'});expect(s.actor).toBe(1);s=act(s,{type:'check'});expect(s.street).toBe('flop');expect(s.actor).toBe(1);
 });
 it('starts 2, 6, 9 and 10 seats and terminates complete passive hands',()=>{
  for(const n of [2,6,9,10]){let s=make(Array(n).fill(200));expect(s.actor).toBe(n===2?0:3%n);s=finish(s);assertAccounting(s);expect(s.board.length).toBe(5);expect(s.burned.length).toBe(3);}
 });
 it('rejects illegal raises/checks and stale turns without mutation',()=>{
  const s=make();const original=structuredClone(s);
  expect(()=>act(s,{type:'check'})).toThrow();expect(()=>act(s,{type:'raise',to:3})).toThrow();expect(()=>act(s,{type:'raise',to:4.5})).toThrow();expect(()=>act(s,{type:'raise',to:NaN})).toThrow();
  expect(s).toEqual(original);
  const raised=act(s,{type:'raise',to:8});expect(legalActions(raised).minRaiseTo).toBe(14);
  expect(()=>applyCommand(raised,{handId:raised.handId,revision:0,seatId:raised.actor!,decisionId:'late',action:{type:'call'}})).toThrow('Stale revision');
 });
 it('never mutates the previous revision; duplicate decisions do not pay twice',()=>{
  const s=make([100,100]);const command={handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:'once',action:{type:'fold'} as Action};
  const next=applyCommand(s,command);expect(s.street).toBe('preflop');expect(next.street).toBe('complete');expect(applyCommand(next,command)).toBe(next);expect(next.seats.map(x=>x.stack)).toEqual([99,101]);
 });
 it('does not reopen a short all-in, but cumulative short raises reopen action',()=>{
  let s=make([200,14,20,200]); // actor 3 opens to 10; actor 0 calls; 1 jams 14; 2 jams 20
  s=act(s,{type:'raise',to:10});s=act(s,{type:'call'});s=act(s,{type:'raise',to:14});
  expect(s.actor).toBe(2);s=act(s,{type:'raise',to:20});expect(s.actor).toBe(3);expect(legalActions(s).reopened).toBe(true);expect(legalActions(s).minRaiseTo).toBe(28);
  let t=make([200,14,200]);t=act(t,{type:'raise',to:10});t=act(t,{type:'raise',to:14});t=act(t,{type:'call'});expect(t.actor).toBe(0);expect(legalActions(t).canRaise).toBe(false);expect(()=>act(t,{type:'raise',to:30})).toThrow();
 });
 it('lets a previous checker raise after a short opening all-in, minimum short bet plus BB',()=>{
  let s=make([100,100,3]);s=passive(s);s=passive(s);s=passive(s);expect(s.actor).toBe(1);
  s=act(s,{type:'check'});s=act(s,{type:'raise',to:1});expect(legalActions(s).minRaiseTo).toBe(3);
  s=act(s,{type:'call'});expect(s.actor).toBe(1);expect(legalActions(s).canRaise).toBe(true);expect(legalActions(s).minRaiseTo).toBe(3);
 });
 it('requires matching a short BB only when no other responsive opponent remains',()=>{
  let s=make([100,1]);expect(s.street).toBe('complete');expect(s.seats.reduce((n,p)=>n+p.stack,0)).toBe(101);
  s=make([100,100,1]);expect(s.currentBet).toBe(2);expect(legalActions(s).callAmount).toBe(2);
 });
 it('freezes caller profile data at hand start',()=>{
  const p=structuredClone(profile);const s=startHand({handId:'freeze',profile:p,seats:[{id:0,name:'A',stack:100},{id:1,name:'B',stack:100}],button:0});p.bigBlind=20;p.rake.basisPoints=10000;expect(s.profile.bigBlind).toBe(2);expect(s.profile.rake.basisPoints).toBe(0);
 });
 it('rejects unfunded, duplicated, excess and unsafe seats',()=>{
  expect(()=>make([100,0])).toThrow();expect(()=>make([100])).toThrow();expect(()=>make(Array(11).fill(100))).toThrow();expect(()=>make([Number.MAX_SAFE_INTEGER,10])).toThrow();
 });
});

describe('settlement and privacy',()=>{
 it('rejects raising when every opponent is already all-in',()=>{
  let s=arrange(make([50,100,200]),[['As','Ah'],['Ks','Kh'],['Qs','Qh']],['2c','3d','7s','8c','9h']);
  s=act(s,{type:'raise',to:50});s=act(s,{type:'raise',to:100});
  expect(legalActions(s).canRaise).toBe(false);expect(()=>act(s,{type:'raise',to:200})).toThrow('Illegal raise');
 });
 it('settles main/side pots and refunds a genuinely uncalled raise',()=>{
  let s=arrange(make([50,100,200]),[['As','Ah'],['Ks','Kh'],['Qs','Qh']],['2c','3d','7s','8c','9h']);
  s=act(s,{type:'raise',to:50});s=act(s,{type:'raise',to:100});s=act(s,{type:'call'});
  expect(s.street).toBe('complete');expect(s.pots.map(p=>p.amount)).toEqual([150,100]);expect(s.seats.map(p=>p.stack)).toEqual([150,100,100]);assertAccounting(s);
  let t=arrange(make([200,50]),[['As','Ah'],['Ks','Kh']],['2c','3d','7s','8c','9h']);t=act(t,{type:'raise',to:200});t=act(t,{type:'call'});
  expect(t.events.find(e=>e.type==='refund')?.amount).toBe(150);expect(t.seats.map(p=>p.stack)).toEqual([250,0]);expect(t.pots[0].amount).toBe(100);
 });
 it('keeps folded contributions and awards odd chip clockwise after button',()=>{
  let s=arrange(make([100,100,100]),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
  s=act(s,{type:'raise',to:5});s=act(s,{type:'call'});s=act(s,{type:'call'});
  s=act(s,{type:'raise',to:2});s=act(s,{type:'call'});s=act(s,{type:'fold'});s=finish(s);
  expect(s.pots.map(p=>p.amount)).toEqual([19]);expect(s.seats.map(p=>p.stack)).toEqual([95,103,102]);
  expect(s.revealedSeats).toEqual([1,2]);expect(projectView(s,1).seats[0].hole).toEqual([]);assertAccounting(s);
 });
 it('merges folded contribution tiers before distributing odd chips',()=>{
  let s=arrange(make([100,100,100,100,100]),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
  // UTG and cutoff call/raise to 5; button calls; SB and BB fold at 1 and 2.
  s=act(s,{type:'raise',to:5});s=act(s,{type:'call'});s=act(s,{type:'call'});
  s=act(s,{type:'fold'});s=act(s,{type:'fold'});
  // Flop: UTG bets 2, cutoff calls, button folds. Final contributions: 5,1,2,7,7.
  s=act(s,{type:'raise',to:2});s=act(s,{type:'call'});s=act(s,{type:'fold'});s=finish(s);
  // One 22-chip pot, two tied players: 11 each. Artificial 5/4/9/4 tiers gave 12/10.
  expect(s.payouts).toEqual({3:11,4:11});
  expect(s.pots).toEqual([{amount:22,eligible:[3,4],winners:[3,4]}]);
  expect(s.seats.map(p=>p.stack)).toEqual([95,99,98,104,104]);assertAccounting(s);
 });
 it('rakes once with no flop no drop and conserves house/table chips',()=>{
  let s=make([100,100]);s.profile.rake={basisPoints:500,cap:10,noFlopNoDrop:true};s=act(s,{type:'fold'});expect(s.rake).toBe(0);
  let t=make([100,100]);t.profile.rake={basisPoints:500,cap:10,noFlopNoDrop:true};t=act(t,{type:'raise',to:100});t=act(t,{type:'call'});expect(t.rake).toBe(10);assertAccounting(t);
 });
 it('redacts opponents and future cards; observation objects are detached',()=>{
  const s=make();const hero=projectView(s,0);expect(hero.seats[0].hole).toHaveLength(2);expect(hero.seats[1].hole).toEqual([]);expect('deck' in hero).toBe(false);
  const bot=observeBot(s,s.actor!,'policy-v1','decision-v1');expect(bot.ownCards).toEqual(s.seats.find(p=>p.id===s.actor)!.hole);expect('deck' in bot).toBe(false);expect(bot.seats.every(p=>!('hole' in p))).toBe(true);
  bot.ownCards[0]='ZZ';expect(s.seats[0].hole[0]).not.toBe('ZZ');
  const ended=act(act(s,{type:'fold'}),{type:'fold'});expect(projectView(ended,0).seats[1].hole).toEqual([]);
 });
});
