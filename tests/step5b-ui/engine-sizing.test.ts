import {expect,it} from 'vitest';
import {applyCommand,legalActions,startHand} from '../../src/core/engine';
import {DEFAULT_SETTINGS,rules} from '../../src/session/controller';
import type {Action} from '../../src/contracts';
import {potSizing} from '../../src/ui/bet-sizing';

it('matches independently calculated three-bet amounts against the actual authoritative engine fixture',()=>{
 let game=startHand({handId:'threebet-mobile-sizing',button:0,profile:rules(DEFAULT_SETTINGS),seats:[0,1,2].map(id=>({id,name:`Player ${id}`,stack:30000}))});
 const prefix:Action[]=[{type:'raise',to:600},{type:'raise',to:1800},{type:'fold'}];
 for(const [seatId,action] of prefix.entries())game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId,decisionId:`prefix-${seatId}`,action});
 const legal=legalActions(game),hero=game.seats[0];
 expect(game.actor).toBe(0);expect(game.pot).toBe(2600);
 expect(legal).toMatchObject({callAmount:1200,minRaiseTo:3000,maxRaiseTo:30000});
 expect(hero.streetCommitted).toBe(600);
 const context={pot:game.pot,streetCommitted:hero.streetCommitted,bigBlind:200,chipUnit:1,legal};
 expect([25,33,50,75,100,150,200].map(percent=>potSizing(context,percent).to)).toEqual([2750,3054,3700,4650,5600,7500,9400]);
 expect(potSizing(context,25).legal).toBe(false);
 expect(()=>applyCommand(game,{handId:game.handId,revision:game.revision,seatId:0,decisionId:'bad-quarter',action:{type:'raise',to:2750}})).toThrow();
 const next=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:0,decisionId:'full-pot',action:{type:'raise',to:5600}});
 expect(next.pot).toBe(7600);expect(next.seats[0].stack).toBe(24400);
 expect(game.pot).toBe(2600);expect(game.seats[0].stack).toBe(29400);
});
