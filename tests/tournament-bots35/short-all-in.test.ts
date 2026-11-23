import {it,expect} from 'vitest';
import {startHand,legalActions,observeBot,applyCommand,assertAccounting} from '../../src/core/engine';
import {createProfile,seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_BOT_POLICY_VERSION} from '../../src/tournament/bot-policy';
it('canRaise includes a legal incomplete 1.5 BB shove and the tournament overlay submits it',()=>{
 const profile=createProfile({selection:'stronger-reg'},35,'neutral');
 const game=startHand({handId:'short-raise-contract',button:0,profile:{id:'short-raise-test',version:'1',mode:'tournament',smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}},seats:Array.from({length:6},(_,id)=>({id,name:`Seat ${id}`,stack:id===3?150:1000}))});
 const legal=legalActions(game);expect(game.actor).toBe(3);expect(legal.canRaise).toBe(true);expect(legal.minRaiseTo).toBe(200);expect(legal.maxRaiseTo).toBe(150);expect(legal.shortAllInTo).toBe(150);
 // Own cards only: the legality assertion does not require a rigged engine deck.
 const observation=observeBot(game,3,profile.policyVersion,'short-shove');observation.ownCards=['As','Ah'];
 const decision=chooseTournamentDecision(observation,profile,seedStream(35),TOURNAMENT_BOT_POLICY_VERSION);
 expect(decision.action).toEqual({type:'raise',to:150});const next=applyCommand(game,decision);expect(next.seats.find(s=>s.id===3)!.allIn).toBe(true);expect(next.currentBet).toBe(150);expect(next.minFullRaiseIncrement).toBe(100);assertAccounting(next);
});
