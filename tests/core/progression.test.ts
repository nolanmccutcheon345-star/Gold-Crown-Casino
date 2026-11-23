import {describe,it,expect} from 'vitest';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,nextHand,projectView,startHand} from '../../src/core/engine';
import {standardDeck} from '../../src/core/deck';

const profile:RuleProfile={id:'practice-cash',version:'0.1.0',mode:'cash',smallBlind:1,bigBlind:2,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const begin=(stacks=[100,100,100],ids=stacks.map((_,i)=>i),button=ids[0])=>startHand({handId:'first',profile,button,seats:stacks.map((stack,i)=>({id:ids[i],name:`Seat ${ids[i]}`,stack}))});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`${s.handId}-${s.revision}`,action});
function finish(s:GameState):GameState {for(let i=0;s.street!=='complete'&&i<100;i++)s=act(s,legalActions(s).check?{type:'check'}:{type:'call'});expect(s.street).toBe('complete');return s;}
function rig(s:GameState,holes:string[][],board=['2c','3d','7s','8c','9h']):GameState {
 const copy=structuredClone(s);const used=[...holes.flat(),...board];const rest=standardDeck().filter(c=>!used.includes(c));
 expect(new Set(used).size).toBe(used.length);
 copy.seats.forEach((seat,i)=>seat.hole=holes[i]);copy.deck=[...holes.flat(),rest.shift()!,...board.slice(0,3),rest.shift()!,board[3],rest.shift()!,board[4],...rest];copy.deckCursor=holes.length*2;return copy;
}

describe('authoritative cash hand succession',()=>{
 it('alternates heads-up positions for twenty actual hands and carries exact settled stacks',()=>{
  let s=begin([1000,1000],[2,8]);
  for(let i=0;i<20;i++) {
   expect(s.button).toBe(i%2===0?2:8);expect(s.smallBlindSeat).toBe(s.button);expect(s.actor).toBe(s.button);
   const old=act(s,{type:'fold'});const snapshot=structuredClone(old);const carried=old.seats.map(p=>p.stack);
   s=nextHand(old,`hand-${i+1}`);expect(old).toEqual(snapshot);expect(s.seats.map(p=>p.startingStack)).toEqual(carried);
   expect(s.initialTotal).toBe(old.seats.reduce((n,p)=>n+p.stack,0));assertAccounting(s);
  }
 });
 it('rotates the practice cash button among funded sparse physical seats',()=>{
  let s=begin([100,100,100,100],[1,4,7,9],7);
  while(s.street!=='complete') s=act(s,{type:'fold'});
  const n=nextHand(s,'second');expect(n.button).toBe(9);expect(n.smallBlindSeat).toBe(1);expect(n.bigBlindSeat).toBe(4);expect(n.actor).toBe(7);
  expect(n.seats.map(p=>p.id)).toEqual([1,4,7,9]);
 });
 it.each([
  {busted:'button',stacks:[20,30,100],holes:[['Qs','Qh'],['As','Ah'],['Ks','Kh']],open:20,raise:30,expected:[1,2],bb:1,button:2},
  {busted:'small blind',stacks:[30,20,100],holes:[['As','Ah'],['Ks','Kh'],['Qs','Qh']],open:30,raise:null,expected:[0,2],bb:0,button:2},
  {busted:'big blind',stacks:[100,30,20],holes:[['Ks','Kh'],['As','Ah'],['Qs','Qh']],open:30,raise:null,expected:[0,1],bb:0,button:1},
 ])('preserves next BB obligation when the $busted busts in 3-to-2 transition',({stacks,holes,open,raise,expected,bb,button})=>{
  let s=rig(begin(stacks),holes);s=act(s,{type:'raise',to:open});s=act(s,raise===null?{type:'call'}:{type:'raise',to:raise});s=act(s,{type:'call'});
  expect(s.street).toBe('complete');const n=nextHand(s,'heads-up');expect(n.seats.map(p=>p.id)).toEqual(expected);
  expect(n.bigBlindSeat).toBe(bb);expect(n.button).toBe(button);expect(n.smallBlindSeat).toBe(button);expect(n.actor).toBe(button);
 });
 it('rejects unfinished, reused-ID and one-survivor continuation',()=>{
  const s=begin([100,100]);expect(()=>nextHand(s,'new')).toThrow('Finish');const folded=act(s,{type:'fold'});expect(()=>nextHand(folded,'first')).toThrow('fresh');
  let allin=rig(begin([100,100]),[['As','Ah'],['Ks','Kh']]);allin=act(allin,{type:'raise',to:100});allin=act(allin,{type:'call'});
  expect(()=>nextHand(allin,'finished')).toThrow('two funded');
 });
 it('carries house rake out of the next hand initial total instead of recreating it',()=>{
  const p=structuredClone(profile);p.rake={basisPoints:1000,cap:100,noFlopNoDrop:true};
  let s=startHand({handId:'raked',profile:p,button:0,seats:[{id:0,name:'A',stack:100},{id:1,name:'B',stack:100}]});
  s=act(s,{type:'raise',to:10});s=act(s,{type:'call'});s=finish(s);expect(s.rake).toBe(2);
  const n=nextHand(s,'raked-next');expect(n.initialTotal).toBe(198);expect(n.profile).toEqual(p);assertAccounting(n);
 });
});

describe('short forced-bet boundaries',()=>{
 it('retains nominal bring-in and BB-sized minimum raise when a multiway BB underposts',()=>{
  let s=rig(begin([100,100,1]),[['Ks','Kh'],['Qs','Qh'],['As','Ah']]);
  expect(s.currentBet).toBe(2);expect(legalActions(s).callAmount).toBe(2);expect(legalActions(s).minRaiseTo).toBe(4);
  s=act(s,{type:'call'});expect(legalActions(s).callAmount).toBe(1);s=act(s,{type:'call'});
  expect(s.street).toBe('flop');expect(projectView(s,0).pots).toEqual([{amount:3,eligible:[0,1,2],winners:[]},{amount:2,eligible:[0,1],winners:[]}]);
  s=finish(s);expect(s.seats.map(p=>p.stack)).toEqual([100,98,3]);assertAccounting(s);
 });
 it('does not remove the full BB option when the SB posts all-in short',()=>{
  const p=structuredClone(profile);p.smallBlind=2;p.bigBlind=4;
  let s=startHand({handId:'short-sb',profile:p,button:0,seats:[{id:0,name:'BTN',stack:100},{id:1,name:'SB',stack:1},{id:2,name:'BB',stack:100}]});
  expect(s.actor).toBe(0);expect(legalActions(s).callAmount).toBe(4);s=act(s,{type:'call'});
  expect(s.actor).toBe(2);expect(legalActions(s).check).toBe(true);expect(legalActions(s).minRaiseTo).toBe(8);
  s=act(s,{type:'check'});expect(s.street).toBe('flop');expect(projectView(s,0).pots.map(p=>p.amount)).toEqual([3,6]);
 });
 it('returns a heads-up unmatched blind before rake when the BB cannot fund the bring-in',()=>{
  const p=structuredClone(profile);p.smallBlind=2;p.bigBlind=4;p.rake={basisPoints:1000,cap:100,noFlopNoDrop:false};
  const s=startHand({handId:'short-hu',profile:p,button:0,seats:[{id:0,name:'BTN',stack:100},{id:1,name:'BB',stack:1}]});
  expect(s.street).toBe('complete');expect(s.events.find(e=>e.type==='refund')).toMatchObject({seatId:0,amount:1});
  expect(s.pots.reduce((n,p)=>n+p.amount,0)).toBe(2);expect(s.rake).toBe(0);expect(projectView(s,0).uncalledBet).toBe(null);assertAccounting(s);
 });
});

describe('engine-owned pot and showdown projection',()=>{
 it('excludes uniquely unmatched excess from provisional pot tiers without moving chips',()=>{
  const s=begin([100,100,100]);const snapshot=structuredClone(s);const v=projectView(s,0);
  expect(v.uncalledBet).toEqual({seatId:2,amount:1});expect(v.pots).toEqual([{amount:2,eligible:[1,2],winners:[]}]);expect(v.pot).toBe(3);
  expect(v.pots.reduce((n,p)=>n+p.amount,0)+v.uncalledBet!.amount).toBe(v.pot);expect(s).toEqual(snapshot);
  v.pots[0].amount=999;expect(s.pot).toBe(3);
 });
 it('shows exact provisional side pots at unequal all-in levels and keeps pending excess separate',()=>{
  let s=begin([50,120,300,300]);s=act(s,{type:'raise',to:300});s=act(s,{type:'call'});s=act(s,{type:'call'});
  const v=projectView(s,0);expect(v.uncalledBet).toEqual({seatId:3,amount:180});
  expect(v.pots).toEqual([{amount:8,eligible:[0,1,2,3],winners:[]},{amount:144,eligible:[0,1,3],winners:[]},{amount:140,eligible:[1,3],winners:[]}]);
  expect(v.pots.reduce((n,p)=>n+p.amount,0)+v.uncalledBet!.amount).toBe(s.pot);
  s=act(s,{type:'call'});const ended=projectView(s,0);expect(ended.uncalledBet).toBe(null);expect(ended.pots.map(p=>p.amount)).toEqual([200,210,360]);
 });
 it('does not create multiple side pots at folded-player contribution thresholds',()=>{
  let s=rig(begin([100,100,100,100,100]),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
  s=act(s,{type:'raise',to:5});s=act(s,{type:'call'});s=act(s,{type:'call'});s=act(s,{type:'fold'});s=act(s,{type:'fold'});
  s=act(s,{type:'raise',to:2});s=act(s,{type:'call'});s=act(s,{type:'fold'});
  const v=projectView(s,0);expect(v.pots).toEqual([{amount:22,eligible:[3,4],winners:[]}]);expect(v.uncalledBet).toBe(null);
 });
 it('only labels legally revealed showdown holdings, including all-board ties',()=>{
  let s=rig(begin([100,100,100]),[['2c','3d'],['4c','5d'],['6c','7d']],['As','Ks','Qs','Js','Ts']);
  expect(projectView(s,0).handLabels).toEqual({});s=act(s,{type:'fold'});s=finish(s);
  const v=projectView(s,0);expect(v.handLabels).toEqual({1:'Royal flush',2:'Royal flush'});expect(v.seats[0].hole).toEqual(['2c','3d']);expect('0' in v.handLabels).toBe(false);
  let folded=begin([100,100]);folded=act(folded,{type:'fold'});expect(projectView(folded,0).handLabels).toEqual({});
 });
 it('labels actual best-five ranks rather than just private pairs',()=>{
  let s=rig(begin([100,100]),[['As','Ah'],['Ks','Kh']],['Ac','Kd','7s','7c','2h']);s=finish(s);
  expect(projectView(s,0).handLabels).toEqual({0:'Full house, aces over sevens',1:'Full house, kings over sevens'});
 });
});
