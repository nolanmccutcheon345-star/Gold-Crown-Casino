import {describe,expect,it} from 'vitest';
import type {Action,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,startHand} from '../../src/core/engine';
import {evaluate} from '../../src/core/evaluator';
import {act,practiceProfile,rig,seededHand} from '../verification/helpers';

function permutations(items:string[]):string[][] {
 return items.length ? items.flatMap((item,index)=>permutations(items.filter((_,i)=>i!==index)).map(rest=>[item,...rest])) : [[]];
}
function renameSuits(source:GameState,suits:string[]):GameState {
 const state=structuredClone(source), rename=(card:string)=>card[0]+suits['cdhs'.indexOf(card[1])];
 state.deck=state.deck.map(rename);state.board=state.board.map(rename);state.burned=state.burned.map(rename);
 state.seats.forEach(seat=>seat.hole=seat.hole.map(rename));
 state.events.forEach(event=>{if(event.cards)event.cards=event.cards.map(rename);});
 return state;
}
function moneyAndRights(state:GameState,scale=1) {
 const legal=legalActions(state), amount=(n:number|null)=>n===null?null:n/scale;
 return {street:state.street,actor:state.actor,button:state.button,pending:state.pending,
  currentBet:state.currentBet/scale,minFullRaiseIncrement:state.minFullRaiseIncrement/scale,
  pot:state.pot/scale,rake:state.rake/scale,initialTotal:state.initialTotal/scale,
  seats:state.seats.map(seat=>({id:seat.id,stack:seat.stack/scale,startingStack:seat.startingStack/scale,streetCommitted:seat.streetCommitted/scale,totalCommitted:seat.totalCommitted/scale,folded:seat.folded,allIn:seat.allIn,lastActedBet:amount(seat.lastActedBet)})),
  pots:state.pots.map(pot=>({...pot,amount:pot.amount/scale})),payouts:Object.fromEntries(Object.entries(state.payouts).map(([id,n])=>[id,n/scale])),
  legal:{...legal,callAmount:legal.callAmount/scale,minRaiseTo:amount(legal.minRaiseTo),maxRaiseTo:amount(legal.maxRaiseTo),shortAllInTo:amount(legal.shortAllInTo)},
  events:state.events.map(event=>({type:event.type,seatId:event.seatId,amount:event.amount===undefined?undefined:event.amount/scale,street:event.street,action:event.action?.type==='raise'?{...event.action,to:event.action.to/scale}:event.action}))};
}
function nextAction(state:GameState,iteration:number):Action {
 const legal=legalActions(state);
 if(iteration%7===1 && legal.canRaise && legal.maxRaiseTo!==null)return {type:'raise',to:legal.maxRaiseTo};
 if(iteration%5===2 && legal.fold)return {type:'fold'};
 if(iteration%3===1 && (legal.canRaise || legal.shortAllInTo!==null))return {type:'raise',to:(legal.shortAllInTo??legal.minRaiseTo)!};
 return {type:legal.check?'check':'call'};
}

describe('R1 independent metamorphic release evidence',()=>{
 it('V503: all 24 suit permutations preserve legal actions, ranks, pots and complete outcomes across 54 seeded mixed-stack hands',()=>{
  for(let seed=51000;seed<51054;seed++){
   const count=2+seed%9,stacks=Array.from({length:count},(_,i)=>200+(i+seed)%5*250);
   const source=seededHand(stacks,seed),states=permutations([...'cdhs']).map(suits=>renameSuits(source,suits));
   let step=0;
   while(states[0].street!=='complete'){
    const action=nextAction(states[0],step+seed);
    for(let i=0;i<states.length;i++)states[i]=act(states[i],action);
    for(const state of states){assertAccounting(state);expect(moneyAndRights(state)).toEqual(moneyAndRights(states[0]));}
    expect(++step).toBeLessThan(200);
   }
   if(states[0].board.length===5)for(let seat=0;seat<count;seat++)for(const state of states)expect(evaluate([...state.seats[seat].hole,...state.board])).toEqual(evaluate([...states[0].seats[seat].hole,...states[0].board]));
  }
 });

 it('V504: 2x, 5x and 100x integer scaling preserves every legal transition and settlement in 54 rake-free mixed-stack hands',()=>{
  for(let seed=53000;seed<53054;seed++){
   const n=2+seed%9,stacks=Array.from({length:n},(_,i)=>200+(i+seed)%7*200),factors=[1,2,5,100];
   const states=factors.map(scale=>seededHand(stacks.map(n=>n*scale),seed,{...practiceProfile(),smallBlind:100*scale,bigBlind:200*scale}));
   let step=0;
   while(states[0].street!=='complete'){
    const action=nextAction(states[0],seed+step);
    for(let i=0;i<states.length;i++)states[i]=act(states[i],action.type==='raise'?{type:'raise',to:action.to*factors[i]}:action);
    for(let i=0;i<states.length;i++){assertAccounting(states[i]);expect(moneyAndRights(states[i],factors[i])).toEqual(moneyAndRights(states[0]));}
    expect(++step).toBeLessThan(200);
   }
  }
 });

 it('V504: capped rake and unmatched refunds scale exactly when all rounding is integral',()=>{
  const results=[1,2,5,100].map(scale=>{
   const profile={...practiceProfile(),smallBlind:100*scale,bigBlind:200*scale,rake:{basisPoints:500,cap:500*scale,noFlopNoDrop:true}};
   let state=rig(startHand({handId:'scale-rake',button:0,profile,seats:[30000,10000].map((stack,id)=>({id,name:String(id),stack:stack*scale}))}),[['As','Ah'],['Ks','Kh']],['2c','3d','7s','8c','9h']);
   state=act(state,{type:'raise',to:30000*scale});state=act(state,{type:'call'});assertAccounting(state);
   expect(state.events.filter(event=>event.type==='refund').map(event=>event.amount)).toEqual([20000*scale]);
   expect(state.rake).toBe(500*scale);expect(state.payouts).toEqual({0:19500*scale});
   return moneyAndRights(state,scale);
  });
  for(const result of results)expect(result).toEqual(results[0]);
 });

 it('B02: every button at every supported 3–10 count has exact clockwise preflop and postflop order without a straddle',()=>{
  for(let n=3;n<=10;n++)for(let button=0;button<n;button++){
   let state=startHand({handId:`order-${n}-${button}`,button,profile:practiceProfile(),seats:Array.from({length:n},(_,id)=>({id,name:String(id),stack:10000}))});
   expect([state.smallBlindSeat,state.bigBlindSeat]).toEqual([(button+1)%n,(button+2)%n]);
   for(const street of ['preflop','flop','turn','river']){
    const expected=Array.from({length:n},(_,i)=>(button+(street==='preflop'?3:1)+i)%n),actual:number[]=[];
    while(state.street===street){actual.push(state.actor!);state=act(state,{type:legalActions(state).check?'check':'call'});}
    expect(actual).toEqual(expected);assertAccounting(state);
   }
   expect(state.street).toBe('complete');
  }
 });

 it('B10: incomplete raise rejected without mutation except an exact capped short all-in',()=>{
  const original=seededHand([20000,350,20000],56001);
  for(const to of [201,250,349,350,399])expect(()=>act(original,{type:'raise',to})).toThrow();
  const afterCall=act(original,{type:'call'});expect(afterCall.actor).toBe(1);
  for(const to of [201,250,349])expect(()=>act(afterCall,{type:'raise',to})).toThrow();
  const copy=structuredClone(afterCall),jam=act(afterCall,{type:'raise',to:350});
  expect(afterCall).toEqual(copy);expect(jam.seats[1].stack).toBe(0);expect(jam.seats[1].allIn).toBe(true);
  const stale={handId:jam.handId,revision:jam.revision-1,seatId:jam.actor!,decisionId:'stale-other-id',action:{type:'call'} as Action};
  expect(()=>applyCommand(jam,stale)).toThrow('Stale');assertAccounting(jam);
 });

 it('V407 cash component: three unequal commitment tiers split separately, with folded dead-money odd chips clockwise after button',()=>{
  const profile={...practiceProfile(),smallBlind:1,bigBlind:2};
  let state=rig(startHand({handId:'cash-odd-three-tiers',button:0,profile,seats:[50,120,300,300,100].map((stack,id)=>({id,name:String(id),stack}))}),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
  for(const action of [{type:'call'},{type:'call'},{type:'raise',to:50},{type:'raise',to:120},{type:'raise',to:300},{type:'call'},{type:'fold'}] as Action[])state=act(state,action);
  expect(state.street).toBe('complete');
  expect(state.pots).toEqual([{amount:202,eligible:[0,1,2,3],winners:[0,1,2,3]},{amount:210,eligible:[1,2,3],winners:[1,2,3]},{amount:360,eligible:[2,3],winners:[2,3]}]);
  expect(state.payouts).toEqual({0:50,1:121,2:301,3:300});expect(state.seats.map(seat=>seat.stack)).toEqual([50,121,301,300,98]);assertAccounting(state);
 });
});
