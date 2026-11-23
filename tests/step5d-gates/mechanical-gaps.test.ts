import {describe,expect,it} from 'vitest';
import {applyCommand,assertAccounting,legalActions,startHand} from '../../src/core/engine';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';

describe('Step5D exact original cash fixture evidence',()=>{
 it('D04: nine-handed $1/$2 with $300 Hero starts at150BB and applies exact blinds and full-raise increments',()=>{
  const profile=rules({...DEFAULT_SETTINGS,seats:9,smallBlind:100,bigBlind:200,buyIn:30000});
  const state=startHand({handId:'step5d-D04-exact',button:0,profile,seats:Array.from({length:9},(_,id)=>({id,name:id===0?'Hero':`Opponent ${id}`,stack:30000}))});
  expect(state.seats[0].startingStack/state.profile.bigBlind).toBe(150);
  expect(state.seats.map(seat=>seat.startingStack)).toEqual(Array(9).fill(30000));
  expect(state.seats.map(seat=>seat.stack)).toEqual([30000,29900,29800,30000,30000,30000,30000,30000,30000]);
  expect([state.button,state.smallBlindSeat,state.bigBlindSeat,state.actor]).toEqual([0,1,2,3]);
  expect(state.events.filter(event=>event.type==='blind').map(event=>[event.seatId,event.amount])).toEqual([[1,100],[2,200]]);
  expect(state.pot).toBe(300);
  expect(legalActions(state)).toMatchObject({actor:3,callAmount:200,minRaiseTo:400,maxRaiseTo:30000});
  const command={handId:state.handId,revision:state.revision,seatId:3,decisionId:'D04-open',action:{type:'raise' as const,to:1600}};
  const snapshot=structuredClone(state);
  const raised=applyCommand(state,command);
  expect(raised.seats[3]).toMatchObject({stack:28400,streetCommitted:1600,totalCommitted:1600});
  expect(raised.pot).toBe(1900);
  expect(legalActions(raised)).toMatchObject({actor:4,callAmount:1600,minRaiseTo:3000,maxRaiseTo:30000});
  expect(state).toEqual(snapshot);
  expect(applyCommand(raised,command)).toBe(raised);
  assertAccounting(state);assertAccounting(raised);
 });
});
