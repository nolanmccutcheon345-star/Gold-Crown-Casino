import {expect} from 'vitest';
import {applyCommand,legalActions,projectView,startHand} from '../../src/core/engine';
import {standardDeck} from '../../src/core/deck';
import type {Action,HeroViewModel,RuleProfile} from '../../src/contracts';
import type {CashSession,StoredHand} from '../../src/session/types';
export const profile:RuleProfile={id:'stats-reference',version:'1',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
let serial=0;
export function fixture(stacks=[100,100],button=1,p=profile) {
 let game=startHand({handId:`step5b-stat-${++serial}`,profile:p,button,seats:stacks.map((stack,id)=>({id,name:`Seat ${id}`,stack}))});
 if(game.street!=='complete') {
  // Known test-only deal: AA wins against KK/QQ/JJ on an unpaired low board.
  const holes=[['As','Ah'],['Ks','Kh'],['Qs','Qh'],['Js','Jh'],['Ts','Th'],['9s','9h'],['8s','8h'],['7s','7h'],['6s','6h'],['5s','5h']].slice(0,stacks.length);
  const board=['2c','3d','4s','8c','9d'];const rest=standardDeck().filter(c=>![...holes.flat(),...board].includes(c));
  game.seats.forEach((seat,i)=>seat.hole=holes[i]);
  game.deck=[...holes.flat(),rest.shift()!,...board.slice(0,3),rest.shift()!,board[3],rest.shift()!,board[4],...rest];game.deckCursor=holes.length*2;
 }
 const frames:HeroViewModel[]=[projectView(game,0)];
 return {
  get game(){return game;},
  step(seat:number,action:Action){expect(game.actor).toBe(seat);this.act(action);},
  act(action:Action){game=applyCommand(game,{handId:game.handId,revision:game.revision,seatId:game.actor!,decisionId:`${game.handId}:${game.revision}`,action});frames.push(projectView(game,0));},
  finish(){for(let n=0;game.street!=='complete'&&n<200;n++)this.act(legalActions(game).check?{type:'check'}:{type:'call'});expect(game.street).toBe('complete');return this.record();},
  record():StoredHand{return {id:game.handId,sessionId:'s1',epoch:0,number:1,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T00:01:00Z',view:projectView(game,0),frames,net:game.seats[0].stack-game.seats[0].startingStack,privateProfiles:{},previousHash:'0'.repeat(64),hash:game.handId};},
 };
}
export function session(hands:readonly StoredHand[],overrides:Partial<CashSession>={}):CashSession {
 return {id:'s1',epoch:0,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T01:00:00Z',settings:{seats:2,stake:'custom',smallBlind:1,bigBlind:2,buyIn:100,archetypes:['tag'],rakeMode:'none',rakeBasisPoints:0,rakeCap:0,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:100,allowTopUp:true},profile,buyIns:100,cashOut:100,activeMs:3600000,lastActiveAt:null,handIds:hands.map(h=>h.id),...overrides};
}
export function freeze<T>(value:T):T {
 if(value!==null&&typeof value==='object'){for(const entry of Object.values(value))freeze(entry);Object.freeze(value);}return value;
}
export function chain(hands:StoredHand[]):StoredHand[] {
 let previous='0'.repeat(64);const numbers=new Map<string,number>();
 return hands.map(hand=>{const number=(numbers.get(hand.sessionId)??0)+1;numbers.set(hand.sessionId,number);const next={...hand,number,previousHash:previous,hash:`fixture-${hand.id}-${number}`};previous=next.hash;return next;});
}
