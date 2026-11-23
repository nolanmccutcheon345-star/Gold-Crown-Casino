import {describe,expect,it} from 'vitest';
import {legalActions} from '../../src/core/engine';
import {buildGateFixture} from '../browser/step5b-gates-fixtures';

describe('Legal fixture prefixes for remaining actual-browser gates',()=>{
 it.each([2,3,4,5,6,7,8,9,10])('creates %i occupied seats at Hero preflop and flop without altering engine authority',async seats=>{
  for(const kind of ['layout-preflop','layout-flop'] as const){
   const {data}=await buildGateFixture({kind,seats}),game=data.active!.game;
   expect(game.seats).toHaveLength(seats);expect(game.actor).toBe(0);expect(game.street).toBe(kind==='layout-flop'?'flop':'preflop');
   expect(game.pot).toBe(kind==='layout-flop'?seats*200:seats<=3?300:300+(seats-3)*200);
  }
 });
 it('reaches genuine short all-in and closed reopening states through legal actions',async()=>{
  const jam=(await buildGateFixture({kind:'short-jam',seats:3})).data.active!.game;
  expect(legalActions(jam)).toMatchObject({callAmount:400,minRaiseTo:1000,maxRaiseTo:700,shortAllInTo:700});expect(jam.pot).toBe(1400);
  const closed=(await buildGateFixture({kind:'raise-closed',seats:3})).data.active!.game;
  expect(legalActions(closed)).toMatchObject({callAmount:100,canRaise:false,reopened:false,shortAllInTo:null});expect(closed.pot).toBe(2000);
 });
 it('creates independent $1/$3 denomination and ten-max side-pot states',async()=>{
  const mixed=(await buildGateFixture({kind:'mixed-granularity',seats:3,smallBlind:100,bigBlind:300,chipUnit:100})).data.active!.game;
  expect(mixed.pot).toBe(6300);expect(legalActions(mixed)).toMatchObject({callAmount:1800,minRaiseTo:4500});
  const side=(await buildGateFixture({kind:'side-pot',seats:10})).data.active!.game;expect(side.pot).toBe(11700);expect(side.seats.filter(seat=>seat.allIn).map(seat=>seat.id)).toEqual([3,5]);expect(side.actor).toBe(0);
 });
 it.each([[100,300,45000],[200,500,75000],[5000,10000,1500000],[300,700,35000]])('retains exact %i/%i stakes and %i starting stack',async(smallBlind,bigBlind,buyIn)=>{
  const {data}=await buildGateFixture({kind:'stake',seats:6,smallBlind,bigBlind,buyIn}),game=data.active!.game;
  expect(game.profile).toMatchObject({smallBlind,bigBlind});expect(game.seats[0].startingStack).toBe(buyIn);expect(legalActions(game).minRaiseTo).toBe(bigBlind*2);
 });
 it('opens a custom $3/$7 flop with a minimum $7 bet',async()=>{
  const game=(await buildGateFixture({kind:'stake',seats:6,smallBlind:300,bigBlind:700,buyIn:35000,street:'flop'})).data.active!.game;
  expect(game.pot).toBe(4200);expect(game.seats[0].stack).toBe(34300);expect(legalActions(game)).toMatchObject({callAmount:0,minRaiseTo:700});
 });
});
