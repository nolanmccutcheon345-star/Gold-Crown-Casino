import {describe,it,expect} from 'vitest';
import type {GameEvent} from '../../src/contracts';
import {readsFromHands,type ReadableHand} from '../../src/bots/reads';
import {tournamentReadsFor} from '../../src/tournament/human-context';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {handChatter} from '../../src/bots/talk';
import {regularProfile} from '../../src/bots/regulars';
import {startHand,applyCommand} from '../../src/core/engine';

const event=(seatId:number,action:NonNullable<GameEvent['action']>,revision:number):GameEvent=>({id:`public:${revision}`,handId:'public',revision,type:'action',seatId,action,street:'preflop'});
const rules={id:'independent50',version:'1',mode:'cash' as const,smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative' as const,oddChipOrder:'clockwise-from-button' as const};
function fixture():ReadableHand{return {button:1,smallBlindSeat:2,bigBlindSeat:0,profile:{bigBlind:100},board:[],seats:[{id:0,startingStack:2000,folded:true},{id:1,startingStack:1000,folded:false},{id:2,startingStack:2000,folded:true}],events:[event(1,{type:'raise',to:900},1),event(2,{type:'fold'},2),event(0,{type:'fold'},3)]};}

describe('independent Version50 public-read and display boundaries',()=>{
 it('does not mistake a near-stack raise for an actual all-in',()=>{
  const r=readsFromHands([fixture()]);
  expect(r.callAllIn).toEqual({count:0,chances:0});
  expect(r.foldBlinds).toEqual({count:1,chances:1});
 });
 it('uses actual posted blind seats when the button occupies an empty seat',()=>{
  const h:ReadableHand={button:1,profile:{bigBlind:100},board:[],seats:[0,1,2,3,4].map(id=>({id,startingStack:id===1?0:2000,folded:id!==0})),events:[{id:'sb',handId:'public',revision:0,type:'blind',seatId:2,amount:50},{id:'bb',handId:'public',revision:0,type:'blind',seatId:3,amount:100},event(0,{type:'raise',to:250},1),event(2,{type:'fold'},2),event(3,{type:'fold'},3)]};
  expect(readsFromHands([h],3).foldBlinds).toEqual({count:1,chances:1});
 });
 it('does not read Hero hole cards or future deck data when extracting reads',()=>{
  const h=fixture();Object.defineProperty(h.seats[0],'hole',{get(){throw Error('private Hero cards read');}});Object.defineProperty(h,'deck',{get(){throw Error('private deck read');}});
  expect(()=>readsFromHands([h])).not.toThrow();
 });
 it('does not credit an eliminated player with observing later dealt hands',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-20',6,'fast');
  const e=structuredClone(c.data!.active!);c.close();e.id='independent50-eliminated-observer';
  let state=startHand({handId:'independent50-absent',button:0,profile:rules,seats:[{id:0,name:'You',stack:2000},{id:2,name:'Present observer',stack:2000}]});
  state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:'complete',action:{type:'fold'}});expect(state.street).toBe('complete');
  state.seats.push({...structuredClone(state.seats[0]),id:1,name:'Absent observer',startingStack:0,stack:0,hole:[],streetCommitted:0,totalCommitted:0,folded:true,allIn:true});
  e.history=[{number:1,settledAt:'2026-11-18T00:00:00.000Z',state,frames:[]}];
  expect(tournamentReadsFor(e,'Absent observer')?.hands).toBe(0);
 });
 it('table talk is deterministic and never mutates canonical state or exposes a folded hand',()=>{
  const p=regularProfile('vince','mid');let sawShow=false;
  for(let i=0;i<80;i++){
   let g=startHand({handId:`independent50-talk:${i}`,button:0,profile:rules,seats:[{id:0,name:'You',stack:2000},{id:1,name:'Vince',stack:2000}]});
   g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'fold',action:{type:'fold'}});
   const before=JSON.stringify(g),personas={1:{name:'Vince',profile:p,regular:'vince'}};
   const talk=handChatter(g,personas);expect(handChatter(g,personas)).toEqual(talk);expect(JSON.stringify(g)).toBe(before);expect(talk.lines.length).toBeLessThanOrEqual(2);
   for(const shown of talk.shows){sawShow=true;const seat=g.seats.find(s=>s.id===shown.seatId)!;expect(seat.folded).toBe(false);expect(g.payouts[seat.id]).toBeGreaterThan(0);expect(shown.cards).toEqual(seat.hole);expect(shown.cards).not.toBe(seat.hole);expect(seat.id).not.toBe(0);}
  }
  expect(sawShow).toBe(true);
 });
});
