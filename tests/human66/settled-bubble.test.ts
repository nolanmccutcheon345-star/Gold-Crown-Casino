import {expect,it} from 'vitest';
import {tournamentMoment,type TournamentEvent} from '../../src/tournament/runtime';

function moment(left:number, rounds:number[], open=false) {
 const state={status:'running',round:6,players:Array.from({length:left},()=>({table:1,stack:50})),
  finishes:rounds.map(round=>({round})),moves:[],registration:open?{closesAfterRound:7}:undefined};
 const event={tournamentPolicyVersion:'synthetic-tournament-2.22.0',game:{street:'complete'},
  ladder:[100,60,40],mtt:{state}} as unknown as TournamentEvent;
 return tournamentMoment(event);
}
it('uses committed field-wide results and handles simultaneous eliminations crossing the money',()=>{
 expect(moment(4,[])).toBe('bubble');
 expect(moment(3,[5])).toBe('burst');
 expect(moment(2,[5,5])).toBe('burst');
 expect(moment(3,[4])).toBeNull();
 expect(moment(4,[],true)).toBeNull();
});
