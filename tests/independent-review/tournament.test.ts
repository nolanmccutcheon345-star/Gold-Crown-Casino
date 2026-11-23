import {describe,it,expect} from 'vitest';
import {startHand,applyCommand,legalActions,nextTournamentHand,assertAccounting,projectSpectatorView,observeBot} from '../../src/core/engine';
import type {GameState,RuleProfile} from '../../src/contracts';
const p:RuleProfile={id:'review',version:'1',mode:'tournament',smallBlind:50,bigBlind:100,chipUnit:1,tournament:{bigBlindAnte:100,antePriority:'blind-first',buttonRule:'dead-button'},rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
function finish(s:GameState){let n=0;while(s.street!=='complete'&&n++<200){const l=legalActions(s);s=applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`review:${s.handId}:${s.revision}`,action:l.check?{type:'check'}:{type:'call'}});assertAccounting(s);}expect(s.street).toBe('complete');return s;}
function setup(count:number,busted:number[]){const s=finish(startHand({handId:'initial',profile:p,button:0,seats:Array.from({length:count},(_,id)=>({id,name:`p${id}`,stack:100000}))}));let removed=0;for(const seat of s.seats)if(busted.includes(seat.id)){removed+=seat.stack;seat.stack=0;}s.seats.find(seat=>seat.stack>0)!.stack+=removed;assertAccounting(s);return s;}
describe('independent tournament sparse ring review',()=>{
 it.each([
  {count:9,busted:[3,4,5],expected:[1,2,6]},
  {count:9,busted:[2,3,4,5],expected:[1,2,6]},
  {count:10,busted:[1,3,4,5,7,8],expected:[1,2,6]},
 ])('preserves prior BB anchor despite gaps $count $busted',({count,busted,expected})=>{const s=nextTournamentHand(setup(count,busted),'next',p);expect([s.button,s.smallBlindSeat,s.bigBlindSeat]).toEqual(expected);expect(s.tournamentSeatCount).toBe(count);expect(s.events.filter(e=>e.type==='blind'&&e.seatId===2).length).toBe(busted.includes(2)?0:1);});
 it('ten-seat physical ring visits each surviving big blind once per orbit',()=>{let s=setup(10,[1,3,4,5,7,8]);const blinds:number[]=[];for(let i=0;i<8;i++){s=nextTournamentHand(s,`orbit-${i}`,p);blinds.push(s.bigBlindSeat);expect(s.tournamentSeatCount).toBe(10);s=finish(s);}expect(blinds).toEqual([6,9,0,2,6,9,0,2]);});
 it('spectator and bot views omit private deck and other private hole cards after hero bust',()=>{const s=nextTournamentHand(setup(10,[0,2,3,4,5,7]),'spectate',p);const view=projectSpectatorView(s);expect(view.seats.every(seat=>seat.hole.length===0)).toBe(true);expect(view.legal.actor).toBeNull();const bot=observeBot(s,s.actor!,'synthetic-cash-1.6.0','review');expect(Object.keys(bot)).not.toContain('deck');for(const seat of bot.seats)expect(Object.keys(seat)).not.toContain('hole');});
});
