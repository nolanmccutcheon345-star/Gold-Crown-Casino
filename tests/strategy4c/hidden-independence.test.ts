import {describe,expect,it} from 'vitest';
import type {Card,GameState} from '../../src/contracts';
import {startHand,observeBot} from '../../src/core/engine';
import {analyzeDecision,chooseDecision} from '../../src/bots/policy';
import {ARCHETYPES,defaultProfile,seedStream} from '../../src/bots/profiles';
import {practiceProfile,rig} from '../verification/helpers';
import {action} from './fixtures';
function stateAt(street:'flop'|'turn'|'river'){
 let s=rig(startHand({handId:'4c-hidden',button:0,profile:practiceProfile(),seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Opponent',stack:20000}]}),[['Kc','Qs'],['Ah','Jd']],['Qh','6h','2c','9d','3s']);
 s=action(s,{type:'call'});s=action(s,{type:'check'});while(s.street!==street)s=action(s,{type:'check'});return s;
}
function swap(s:GameState,a:Card,b:Card){
 const convert=(c:Card)=>c===a?b:c===b?a:c;
 s.deck=s.deck.map(convert);s.burned=s.burned.map(convert);s.board=s.board.map(convert);for(const seat of s.seats)seat.hole=seat.hole.map(convert);
}
describe('real sealed-state hidden-card counterfactuals',()=>{
 it.each(['flop','turn','river'] as const)('changing Hero holes and future cards does not change any profile distribution on %s',street=>{
  const s=stateAt(street),changed=structuredClone(s);expect(s.actor).toBe(1);
  swap(changed,'Kc','8d');
  const [futureA,futureB]=changed.deck.slice(changed.deckCursor).filter(c=>!changed.seats.flatMap(s=>s.hole).includes(c)).slice(0,2);swap(changed,futureA,futureB);
  for(const archetype of ARCHETYPES){const p=defaultProfile(archetype),a=observeBot(s,1,p.policyVersion,'same-current-decision'),b=observeBot(changed,1,p.policyVersion,'same-current-decision');
   expect(a).toEqual(b);expect(analyzeDecision(a,p)).toEqual(analyzeDecision(b,p));
   for(let seed=70;seed<86;seed++)expect(chooseDecision(a,p,seedStream(seed))).toEqual(chooseDecision(b,p,seedStream(seed)));
  }
 });
 it('relabeling Hero and bot seats leaves conditional play unchanged',()=>{
  const s=stateAt('river');
  for(const archetype of ARCHETYPES){const p=defaultProfile(archetype),o=observeBot(s,1,p.policyVersion,'original'),mirrored=structuredClone(o),ids=new Map([[0,9],[1,5]]);
   mirrored.actingSeat=ids.get(o.actingSeat)!;mirrored.button=ids.get(o.button)!;mirrored.legal.actor=mirrored.actingSeat;
   for(const seat of mirrored.seats)seat.id=ids.get(seat.id)!;for(const e of mirrored.publicEvents)if(e.seatId!==undefined)e.seatId=ids.get(e.seatId)!;
   const a=analyzeDecision(o,p),b=analyzeDecision(mirrored,p);expect(b.distribution).toEqual(a.distribution);expect(b.postflop).toEqual(a.postflop);
   for(let seed=301;seed<317;seed++)expect(chooseDecision(mirrored,p,seedStream(seed)).action).toEqual(chooseDecision(o,p,seedStream(seed)).action);
  }
 });
});
