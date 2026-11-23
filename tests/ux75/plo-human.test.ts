import {describe,expect,it} from 'vitest';
import {adjusted,sizeChoice,thinkTime,shownAtShowdown,nextMood,updateReads,EMPTY_READS,isPro,line} from '../../src/plo/human';
import {PLO_PLAYERS,ploPlayer,ploDecideDetailed} from '../../src/plo/bots';
import {PloTable,freshPlo} from '../../src/plo/table';
import {legalPlo,assertChips,startPloHand,applyPlo,ploView,type PloHand} from '../../src/plo/engine';
import {standardDeck} from '../../src/core/deck';

function mulberry(seed:number){return (n:number)=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return Math.floor(((t^t>>>14)>>>0)/4294967296*n);};}
const otto=ploPlayer('otto')!,mae=ploPlayer('mae')!,birdie=ploPlayer('birdie')!;

describe('Patch 75 Omaha moods, memory and sizing',()=>{
 it('tilt loosens a player up and a heater makes them braver',()=>{
  const t=adjusted(mae,{mood:'tilt',hands:5},EMPTY_READS,false),h=adjusted(mae,{mood:'heater',hands:5},EMPTY_READS,false);
  expect(t.looseness).toBeGreaterThan(mae.looseness);expect(t.bluff).toBeGreaterThan(mae.bluff);expect(t.stubborn).toBeGreaterThan(mae.stubborn);
  expect(h.looseness).toBeGreaterThan(mae.looseness);expect(adjusted(mae,undefined,EMPTY_READS,false)).toEqual(mae);
 });
 it('players who pay attention call a bluffer lighter and fold more to someone who never bluffs',()=>{
  const bluffer={actions:60,raises:25,bigBets:8,bigBetsShownWeak:3,bigBetsShownStrong:2},honest={actions:60,raises:10,bigBets:8,bigBetsShownWeak:0,bigBetsShownStrong:5};
  expect(adjusted(mae,undefined,bluffer,true).stubborn-mae.stubborn).toBeGreaterThan(adjusted(otto,undefined,bluffer,true).stubborn-otto.stubborn);
  expect(adjusted(mae,undefined,honest,true).stubborn).toBeLessThan(mae.stubborn);
  expect(adjusted(mae,undefined,bluffer,false)).toEqual(mae);// only against Hero's bets
  expect(adjusted(mae,undefined,{...bluffer,bigBets:2},true)).toEqual(mae);// not enough seen yet
 });
 it('sizes bets the way each kind of player does, always within the pot limit',()=>{
  for(const p of PLO_PLAYERS)for(let u=0;u<1;u+=.05){const to=sizeChoice(p,400,2400,u>.5,u);expect(to).toBeGreaterThanOrEqual(400);expect(to).toBeLessThanOrEqual(2400);}
  const potShare=(p:typeof mae)=>Array.from({length:20},(_,i)=>sizeChoice(p,400,2400,true,i/20)).filter(x=>x===2400).length;
  expect(potShare(birdie)).toBeGreaterThan(potShare(otto));
 });
 it('fun players snap-call draws and tank their big bets; pros keep a steady rhythm',()=>{
  const snaps=Array.from({length:50},(_,i)=>thinkTime(otto,'call',.4,false,i/50)).filter(x=>x.tempo==='snap').length;expect(snaps).toBeGreaterThan(20);
  const tanks=Array.from({length:50},(_,i)=>thinkTime(otto,'raise',.9,true,i/50)).filter(x=>x.tempo==='tank').length;expect(tanks).toBeGreaterThan(20);
  expect(Array.from({length:50},(_,i)=>thinkTime(mae,'call',.4,false,i/50)).every(x=>x.tempo==='normal')).toBe(true);
  for(const p of PLO_PLAYERS)for(const a of ['fold','check','call','raise'] as const){const t=thinkTime(p,a,.5,true,.5);expect(t.ms).toBeGreaterThan(200);expect(t.ms).toBeLessThan(5100);}
  expect(isPro(mae)).toBe(true);expect(isPro(otto)).toBe(false);
 });
 it('moods start on big pots and fade',()=>{
  expect(nextMood(undefined,-9000,200,true,.5)?.mood).toBe('tilt');expect(nextMood(undefined,-9000,200,false,.5)).toBeUndefined();
  expect(nextMood(undefined,9000,200,false,.5)?.mood).toBe('heater');expect(nextMood({mood:'tilt',hands:1},0,200,false,.5)).toBeUndefined();
  expect(nextMood({mood:'tilt',hands:4},0,200,false,.5)).toEqual({mood:'tilt',hands:3});
  for(const p of PLO_PLAYERS)for(const k of ['hello','bigWin','badBeat','needle','tank','tilt'] as const)expect(line(p,k,.99)).toBeTruthy();
 });
});

describe('Patch 75 showdown and the table',()=>{
 function showdownHand(seed:number):PloHand {
  const r=mulberry(seed);const d=standardDeck();for(let i=d.length-1;i>0;i--){const j=r(i+1);[d[i],d[j]]=[d[j],d[i]];}
  let h=startPloHand({handId:`s${seed}`,button:0,smallBlind:100,bigBlind:200,seats:[0,1,2,3].map(id=>({id,name:`P${id}`,stack:20000})),deck:d});
  while(h.street!=='complete'){const l=legalPlo(h)!;h=applyPlo(h,l.check?{type:'check'}:{type:'call'});}return h;
 }
 it('winners and You always show; beaten pros muck more often than fun players',()=>{
  let proShown=0,funShown=0,proSeen=0,funSeen=0;const r=mulberry(4);
  for(let i=0;i<300;i++){const h=showdownHand(i);expect(h.showdown).toHaveLength(4);
   const winners=new Set(h.pots.flatMap(p=>p.winners));
   const pros=shownAtShowdown(h,{1:mae,2:mae,3:mae},r),fun=shownAtShowdown(h,{1:otto,2:otto,3:otto},r);
   for(const list of [pros,fun]){expect(list).toContain(0);for(const w of winners)expect(list).toContain(w);}
   for(const id of [1,2,3])if(!winners.has(id)){proSeen++;funSeen++;if(pros.includes(id))proShown++;if(fun.includes(id))funShown++;}
  }
  expect(proShown/proSeen).toBeLessThan(.3);expect(funShown/funSeen).toBeGreaterThan(.5);
 });
 it('remembers your actions and the big bets you showed down',()=>{
  const h=showdownHand(1);const reads=updateReads(EMPTY_READS,h,h.showdown,[1,10]);expect(reads.actions).toBe(h.events.filter(e=>e.kind==='action'&&e.seatId===0).length);
 });
 it('plays human hands at the table: timing tells, talk, moods and mucking, every chip accounted for',()=>{
  const t=new PloTable(freshPlo());t.sit('1-2',100,5);let tempos=0,hands=0,mucked=0,talk=0;
  for(;hands<40;hands++){
   for(let i=0;i<400&&t.state.active!.hand.street!=='complete';i++){
    if(t.heroTurn){const l=legalPlo(t.state.active!.hand)!;t.act(l.check?{type:'check'}:l.call<=600?{type:'call'}:{type:'fold'});}
    else{const ms=t.planBot();expect(ms).toBeGreaterThan(0);t.botStep();}
    assertChips(t.state.active!.hand);
   }
   const a=t.state.active!,h=a.hand;tempos+=h.events.filter(e=>e.tempo).length;talk=Math.max(talk,(a.talk??[]).length);
   const v=ploView(h,0);for(const s of v.seats)if(s.id!==0&&!h.showdown.includes(s.id))expect(s.hole.every(c=>c==='')).toBe(true);
   mucked+=Object.keys(h.labels).map(Number).filter(id=>!h.showdown.includes(id)).length;
   if(a.stacks[0]<=0)t.rebuy();t.nextHand();
  }
  expect(tempos).toBeGreaterThan(5);expect(t.state.reads!.actions).toBeGreaterThan(20);
  expect(talk+mucked).toBeGreaterThan(0);
 },120000);
 it('decides from its own cards: changing hidden cards of others never changes the decision',()=>{
  const r=mulberry(8);const d=standardDeck();for(let i=d.length-1;i>0;i--){const j=r(i+1);[d[i],d[j]]=[d[j],d[i]];}
  const h=startPloHand({handId:'x',button:0,smallBlind:100,bigBlind:200,seats:[0,1,2].map(id=>({id,name:`P${id}`,stack:20000})),deck:d});
  const other=structuredClone(h);const actor=h.actor!;const notMe=other.seats.find(s=>s.id!==actor)!;notMe.hole=other.deck.splice(10,4);
  expect(ploDecideDetailed(h,mae,mulberry(1)).action).toEqual(ploDecideDetailed(other,mae,mulberry(1)).action);
 });
});
