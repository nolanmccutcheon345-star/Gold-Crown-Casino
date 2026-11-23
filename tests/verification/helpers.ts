import type { Action, Card, GameState, RuleProfile } from '../../src/contracts';
import { applyCommand, startHand } from '../../src/core/engine';

export const practiceProfile = (): RuleProfile => ({
  id:'practice-cash', version:'0.1.0', mode:'cash', smallBlind:100, bigBlind:200, chipUnit:1,
  rake:{basisPoints:0,cap:0,noFlopNoDrop:true}, shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',
});
export function hand(stacks:number[] = [20000,20000,20000], button=0, profile=practiceProfile()):GameState {
  return startHand({handId:'independent-fixture',button,profile,seats:stacks.map((stack,id)=>({id,name:`Seat ${id}`,stack}))});
}
export function act(state:GameState, action:Action):GameState {
  if(state.actor === null) throw new Error('Fixture tried acting after settlement');
  return applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor,decisionId:`fixture-${state.revision}`,action});
}
/** Test-only sealed-state control. Never exported by production or browser bundle. */
export function rig(state:GameState,holes:Card[][],board:Card[]):GameState {
  const copy=structuredClone(state);
  const all='23456789TJQKA'.split('').flatMap(rank=>'cdhs'.split('').map(suit=>rank+suit));
  const reserved=[...holes.flat(),...board];
  if(new Set(reserved).size!==reserved.length) throw new Error('Duplicate fixture card');
  const unused=all.filter(card=>!reserved.includes(card));
  const burns=unused.splice(0,3);
  copy.seats.forEach((seat,i)=>{seat.hole=[...holes[i]];});
  copy.deck=[...holes.flat(),burns[0],...board.slice(0,3),burns[1],board[3],burns[2],board[4],...unused];
  copy.deckCursor=holes.length*2;
  return copy;
}
export const lexCompare=(a:number[],b:number[]):number=>{
  for(let i=0;i<Math.max(a.length,b.length);i++) if((a[i]??0)!==(b[i]??0)) return Math.sign((a[i]??0)-(b[i]??0));
  return 0;
};
export function checkDown(state:GameState):GameState {
  let next=state;
  for(let safety=0;next.street!=='complete' && safety<100;safety++) {
    const seat=next.seats.find(s=>s.id===next.actor);
    if(!seat) throw new Error('Missing actor');
    next=act(next,{type:seat.streetCommitted<next.currentBet?'call':'check'});
  }
  if(next.street!=='complete') throw new Error('Check-down did not terminate');
  return next;
}

/** Seeded fixture dealing stays in the test tree. Production always uses secureDeck. */
export function seededHand(stacks:number[],seed:number,profile=practiceProfile()):GameState {
 const s=hand(stacks,0,profile); const deck='23456789TJQKA'.split('').flatMap(r=>'cdhs'.split('').map(suit=>r+suit));
 let cursor=(seed|0)||1;
 const draw=()=>{cursor^=cursor<<13;cursor^=cursor>>>17;cursor^=cursor<<5;return cursor>>>0;};
 for(let i=deck.length-1;i>0;i--){const j=draw()%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 const holes=stacks.map((_,i)=>deck.slice(i*2,i*2+2));
 return rig(s,holes,deck.slice(stacks.length*2,stacks.length*2+5));
}
