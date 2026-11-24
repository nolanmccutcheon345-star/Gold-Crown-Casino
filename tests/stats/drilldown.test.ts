/** Phase 7: drill-down aggregates. Fixtures are record-shaped literals carrying
 * exactly the fields each function reads, with hand-computed expectations. */
import {describe,it,expect} from 'vitest';
import type {StoredHand} from '../../src/session/types';
import type {BlackjackRound} from '../../src/blackjack/engine';
import type {PloHandRecord,PloSession} from '../../src/plo/table';
import type {SlotsState} from '../../src/slots/state';
import type {EventResult} from '../../src/tournament/stats';
import type {CasinoRecent} from '../../src/stats/drilldown';
import {stakesTierGroups,heroVsOpponents,biggestPots,headsUpHands,buyInTierGroups,biggestCashes,ploDrill,blackjackDrill,rouletteDrill,baccaratDrill,crapsDrill,racesDrill,slotsDrill} from '../../src/stats/drilldown';

/* A settled cash hand: hero (seat 0) plus named opponents. */
function hand(opts:{id:string;bb?:number;net:number;seats?:{name:string;committed:number;payout:number;folded?:boolean}[];heroCommitted?:number;heroPayout?:number;labels?:number[]}):StoredHand {
 const seats=[{id:0,name:'You',totalCommitted:opts.heroCommitted??0,folded:false},...(opts.seats??[]).map((s,i)=>({id:i+1,name:s.name,totalCommitted:s.committed,folded:s.folded??false}))];
 const payouts:Record<number,number>={0:opts.heroPayout??0};(opts.seats??[]).forEach((s,i)=>{payouts[i+1]=s.payout;});
 const handLabels:Record<number,string>={};(opts.labels??[]).forEach(id=>{handLabels[id]='Two pair';});
 return {id:opts.id,number:1,startedAt:'2026-11-01T00:00:00Z',net:opts.net,
  view:{street:'complete',profile:{bigBlind:opts.bb??200,smallBlind:(opts.bb??200)/2,mode:'cash'},seats,payouts,handLabels,board:[],events:[]}} as unknown as StoredHand;
}

describe('cash drill-downs',()=>{
 it('splits results into low/mid/high stakes tiers by the hand big blind',()=>{
  const hands=[
   hand({id:'a',bb:200,net:400}),hand({id:'b',bb:200,net:-200}),
   hand({id:'c',bb:1000,net:500}),hand({id:'d',bb:5000,net:-2500}),
  ];
  const tiers=stakesTierGroups(hands);
  expect(tiers.map(t=>t.tier)).toEqual(['low','mid','high']);
  expect(tiers[0]).toMatchObject({hands:2,net:200,bb100:50});
  expect(tiers[1]).toMatchObject({hands:1,net:500,bb100:50});
  expect(tiers[2]).toMatchObject({hands:1,net:-2500,bb100:-50});
  expect(stakesTierGroups([])).toEqual([]);
 });
 it('attributes hero results per opponent, with showdown record only when both showed',()=>{
  const hands=[
   hand({id:'a',net:300,heroCommitted:100,heroPayout:400,seats:[{name:'Rex',committed:100,payout:0}],labels:[0,1]}),
   hand({id:'b',net:-100,heroCommitted:100,heroPayout:0,seats:[{name:'Rex',committed:50,payout:150},{name:'Ada',committed:50,payout:0}],labels:[0,1]}),
   hand({id:'c',net:50,heroCommitted:20,heroPayout:70,seats:[{name:'Rex',committed:20,payout:0,folded:true}]}),
  ];
  const vs=heroVsOpponents(hands);
  expect(vs.map(v=>v.name)).toEqual(['Rex','Ada']);
  expect(vs[0]).toMatchObject({hands:3,heroNet:250,oppNet:-20,showdowns:2,heroShowdownWins:1});
  expect(vs[0].heroBb100).toBeCloseTo(100*(300/200-100/200+50/200)/3);
  expect(vs[1]).toMatchObject({hands:1,heroNet:-100,oppNet:-50,showdowns:0});
 });
 it('ranks biggest pots won and lost by hero result, with the pot total',()=>{
  const hands=[
   hand({id:'a',net:900,heroPayout:1000,seats:[{name:'Rex',committed:100,payout:100}]}),
   hand({id:'b',net:-400,heroPayout:0,seats:[{name:'Rex',committed:400,payout:400}]}),
   hand({id:'c',net:100,heroPayout:100,seats:[]}),
  ];
  const pots=biggestPots(hands);
  expect(pots.won.map(p=>p.id)).toEqual(['a','c']);
  expect(pots.won[0]).toMatchObject({pot:1100,net:900});
  expect(pots.lost.map(p=>p.id)).toEqual(['b']);
 });
 it('keeps only two-seat hands for heads-up',()=>{
  const hu=hand({id:'hu',net:10,seats:[{name:'Rex',committed:0,payout:0}]});
  const ring=hand({id:'ring',net:10,seats:[{name:'Rex',committed:0,payout:0},{name:'Ada',committed:0,payout:0}]});
  expect(headsUpHands([hu,ring]).map(h=>h.id)).toEqual(['hu']);
 });
});

describe('tournament drill-downs',()=>{
 const ev=(id:string,cost:number,prize:number):EventResult=>({id,name:id,tier:'casino',entrants:50,multi:true,place:prize>0?5:40,cost,prize,net:prize-cost,hands:20,finishedAt:'2026-11-01T00:00:00Z'});
 it('groups events by buy-in tier with ROI and ITM',()=>{
  const groups=buyInTierGroups([ev('a',500,0),ev('b',500,2000),ev('c',2500,0),ev('d',30000,60000)]);
  expect(groups.map(g=>g.label)).toEqual(['Micro · up to $10','Low · $11–$50','High · over $200']);
  expect(groups[0]).toMatchObject({events:2,cashes:1,net:1000,roi:1,itm:.5});
  expect(groups[2]).toMatchObject({events:1,net:30000});
 });
 it('lists biggest cashes biggest first, skipping blanks',()=>{
  expect(biggestCashes([ev('a',500,300),ev('b',500,0),ev('c',500,900)]).map(e=>e.id)).toEqual(['c','a']);
 });
});

describe('omaha drill-down',()=>{
 const ploHand=(id:string,stakes:string,net:number,shown=false):PloHandRecord=>({id,number:1,at:'2026-11-01T00:00:00Z',stakes,hole:[],board:[],net,won:0,summary:[],shown:shown?[{name:'You',hole:[],label:'Flush'}]:[]});
 const bbOf=(label:string)=>({'$0.25/$0.50':50,'$1/$2':200} as Record<string,number>)[label];
 it('computes results depth only: totals, by stakes, shown hands, sessions',()=>{
  const hands=[ploHand('a','$1/$2',300,true),ploHand('b','$1/$2',-100),ploHand('c','$0.25/$0.50',25,true)];
  const sessions:PloSession[]=[{id:'s1',stakes:'plo-1',startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T01:00:00Z',buyIns:20000,cashOut:20400,hands:3}];
  const d=ploDrill(hands,sessions,bbOf);
  expect(d.hands).toBe(3);expect(d.net).toBe(225);
  expect(d.bb100).toBeCloseTo(100*(300/200-100/200+25/50)/3);
  expect(d.winRate).toBeCloseTo(2/3);
  expect(d.byStakes).toHaveLength(2);
  expect(d.shownHands).toBe(2);expect(d.shownWins).toBe(2);
  expect(d.sessions[0]).toMatchObject({net:400});
 });
});

describe('blackjack drill-down',()=>{
 const round=(over:Partial<BlackjackRound>):BlackjackRound=>({id:'r',number:1,firstCardIndex:0,shoeNumber:1,openingBalance:100000,ante:0,baseBet:2500,insuranceBet:0,insuranceReturn:0,hands:[],dealer:['0:Ts','1:6d'],holeRevealed:true,phase:'settled',actor:0,net:0,...over} as BlackjackRound);
 const h=(result:string,over:Partial<BlackjackRound['hands'][number]>={})=>({cards:[],bet:2500,split:false,splitAces:false,doubled:false,status:'stood' as const,payout:0,result,...over} as BlackjackRound['hands'][number]);
 it('counts outcomes, doubles, splits, insurance and splits money by bet size and upcard',()=>{
  const rounds=[
   round({net:2500,baseBet:2500,hands:[h('win')]}),
   round({net:-5000,baseBet:2500,hands:[h('loss',{doubled:true})],dealer:['0:As','1:6d'],insuranceBet:1250,insuranceReturn:0}),
   round({net:3750,baseBet:2500,hands:[h('blackjack')]}),
   round({net:0,baseBet:10000,hands:[h('push',{split:true}),h('win',{split:true})],dealer:['0:Kd','1:6d']}),
  ];
  const d=blackjackDrill(rounds);
  expect(d.rounds).toBe(4);expect(d.hands).toBe(5);expect(d.net).toBe(1250);
  expect(d.outcomes).toMatchObject({win:2,loss:1,push:1,blackjack:1});
  expect(d.doubles).toMatchObject({hands:1,loss:1});
  expect(d.splits).toMatchObject({hands:2,win:1,push:1});
  expect(d.insurance).toMatchObject({rounds:1,wagered:1250,returned:0,net:-1250});
  expect(d.byBetSize).toEqual([
   {label:'$25',rounds:3,net:1250,winRate:2/3},
   {label:'$100',rounds:1,net:0,winRate:0},
  ]);
  expect(d.byUpcard.map(g=>g.label)).toEqual(['10-value','Ace']);
  expect(d.byUpcard[0]).toMatchObject({rounds:3,net:6250});
  expect(d.biggestWin).toBe(3750);expect(d.biggestLoss).toBe(-5000);
 });
 it('is empty-safe',()=>{const d=blackjackDrill([]);expect(d.rounds).toBe(0);expect(d.biggestWin).toBe(0);});
});

describe('casino drill-downs',()=>{
 const recent=(game:CasinoRecent['game'],bet:string,wagered:number,returned:number,result=''):CasinoRecent=>({game,wagered,returned,at:'2026-11-01T00:00:00Z',bet,result});
 it('roulette: distribution from the pocket board, single-bet attribution only',()=>{
  const board=[0,1,2,3,36,37,1,1,12];
  const d=rouletteDrill(board,[recent('roulette','Red',1000,2000),recent('roulette','Red · 17',3000,0),recent('roulette','Dozen 1 + 2 more',5000,0),recent('roulette','17',500,19000)]);
  expect(d.spins).toBe(9);expect(d.green).toBe(2);expect(d.red).toBe(6);expect(d.black).toBe(1);
  expect(d.dozens).toEqual([6,0,1]);expect(d.columns).toEqual([3,1,3]);
  expect(d.hot[0]).toEqual({label:'1',count:3});
  expect(d.byBetType).toEqual([
   {label:'Red',rounds:1,wagered:1000,returned:2000,net:1000},
   {label:'17',rounds:1,wagered:500,returned:19000,net:18500},
  ]);
  expect(d.multiBetRounds).toBe(2);
 });
 it('baccarat: distribution, streaks and single-spot attribution',()=>{
  const board=['P','B','B','B','T','B','P','P'];
  const d=baccaratDrill(board,[recent('baccarat','Player',1000,2000),recent('baccarat','Player · Tie',3000,3000)]);
  expect(d).toMatchObject({coups:8,player:3,banker:4,tie:1,longestBanker:3,longestPlayer:2});
  expect(d.current).toEqual({side:'P',length:2});
  expect(d.bySpot).toEqual([{label:'Player',rounds:1,wagered:1000,returned:2000,net:1000}]);
  expect(d.multiSpotRounds).toBe(1);
 });
 it('craps: exact dice distribution against the 36-way expectation',()=>{
  const board=[[3,4],[1,1],[6,6],[2,2],[5,5]];
  const d=crapsDrill(board,[recent('craps','Pass',1000,2000,'7 (3-4)')]);
  expect(d.rolls).toBe(5);expect(d.sevens).toBe(1);expect(d.doubles).toBe(4);
  expect(d.sums.find(s=>s.sum===7)).toMatchObject({count:1,expected:6/36});
  expect(d.hard).toEqual([{sum:4,count:1},{sum:6,count:0},{sum:8,count:0},{sum:10,count:1}]);
  expect(d.recentNet).toBe(1000);expect(d.bestRoll).toEqual({profit:1000,result:'7 (3-4)'});
 });
 it('races: single-bet attribution, frequency from complete listings, no odds invented',()=>{
  const d=racesDrill([
   recent('races','Win #4',1000,3500,'#4 Star won'),
   recent('races','Win #2 · Place #2',2000,0,'#7 Moon won'),
   recent('races','Exacta #1-#3 + 1 more',1000,0,'#1 Sun won'),
   recent('races','Place #5',1000,1800,'#9 Sky won'),
  ],['Star','Moon','Star']);
  expect(d.rounds).toBe(4);expect(d.net).toBe(300);expect(d.cashed).toBe(2);
  expect(d.byType).toEqual([
   {label:'Win #4',rounds:1,wagered:1000,returned:3500,net:2500},
   {label:'Place #5',rounds:1,wagered:1000,returned:1800,net:800},
  ]);
  expect(d.multiBetRounds).toBe(2);
  expect(d.betFrequency).toEqual([{kind:'Win',rounds:2},{kind:'Place',rounds:2}]);
  expect(d.winners).toEqual([{name:'Star',wins:2},{name:'Moon',wins:1}]);
  expect(d.bestWins[0]).toMatchObject({profit:2500});
 });
 it('slots: per-machine depth plus the labelled recent-window hit rate',()=>{
  const state:SlotsState={balance:100000,reloads:0,
   machines:{'lucky-sevens':{spins:200,wagered:100000,won:94000,biggest:5000,features:4}},
   recent:[{machine:'lucky-sevens',bet:500,total:0,at:'x'},{machine:'lucky-sevens',bet:500,total:1500,at:'x'},{machine:'gold-rush',bet:500,total:0,at:'x'}],
   gamble:{rounds:10,wagered:5000,won:4500}};
  const d=slotsDrill(state);
  expect(d.machines[0]).toMatchObject({id:'lucky-sevens',avgBet:500,featurePct:2});
  expect(d.recentSpins).toBe(3);expect(d.recentHits).toBe(1);expect(d.recentHitPct).toBeCloseTo(100/3);
  expect(d.recentByMachine[0]).toMatchObject({id:'lucky-sevens',spins:2,hits:1});
  expect(d.gamble).toMatchObject({rounds:10,net:-500});
 });
});
