import {describe,it,expect} from 'vitest';
import type {Action,BotProfile,GameEvent,GameState,HeroViewModel} from '../../src/contracts';
import type {ActiveTable,StoredHand} from '../../src/session/types';
import type {TournamentEvent,TournamentHand} from '../../src/tournament/runtime';
import {cashTableReads} from '../../src/session/human-context';
import {tournamentTableReadsFor} from '../../src/tournament/human-context';
import {addPlayerHand,emptyPlayerRead,keyOpponent,playerType} from '../../src/bots/table-reads';
import {startHand,observeBot,applyCommand} from '../../src/core/engine';
import {regularProfile} from '../../src/bots/regulars';
import type {ReadableHand} from '../../src/bots/reads';

const profile=(id:string)=>({personalityId:id} as BotProfile);
const active=(one='observer',two='target'):Pick<ActiveTable,'sessionId'|'profiles'>=>({sessionId:'session',profiles:{1:profile(one),2:profile(two)}});
function publicHand(actions:[number,Action][],names=['You','Observer','Target']):ReadableHand&{seats:{id:number;name:string;startingStack:number;folded:boolean}[]} {
 const events:GameEvent[]=actions.map(([seatId,action],i)=>({id:`a${i}`,handId:'hand',revision:i,type:'action',street:'preflop',seatId,action}));
 return {events,seats:names.map((name,id)=>({id,name,startingStack:10000,folded:false})),button:0,smallBlindSeat:1,bigBlindSeat:2,board:[],profile:{bigBlind:100}};
}
function stored(id:number,one='observer',two='target',actions:[number,Action][]=[[0,{type:'fold'}],[1,{type:'fold'}],[2,{type:'raise',to:300}]]):StoredHand {
 return {id:`hand-${id}`,sessionId:'session',hash:`hash-${id}`,view:publicHand(actions) as HeroViewModel,privateProfiles:{1:profile(one),2:profile(two)}} as unknown as StoredHand;
}
function history(number:number,state:ReadableHand):TournamentHand{return {number,settledAt:'2026-11-18',state:state as GameState,frames:[]};}
function event(current:ReadableHand,hands:TournamentHand[]):TournamentEvent{return {id:'event',game:current,history:hands} as unknown as TournamentEvent;}

describe('independent Version53 public opponent reads',()=>{
 it('cash gives a newcomer only jointly witnessed hands, including reads on Hero',()=>{
  const hands=[...Array.from({length:20},(_,i)=>stored(i,'old-observer')),...Array.from({length:3},(_,i)=>stored(20+i))];
  const reads=cashTableReads(hands,active(),1);expect(reads[0].hands).toBe(3);expect(reads[2].hands).toBe(3);expect(playerType(reads[2])).toBe('unknown');
  expect(cashTableReads(hands,active(),2)[0].hands).toBe(23);
  expect(cashTableReads(hands,active('brand-new'),1)[2].hands).toBe(0);
 });
 it('cash does not transfer reads from a prior target or past session',()=>{
  const hands=[stored(0,'observer','former-target'),stored(1),stored(2)];
  expect(cashTableReads(hands,active(),1)[2].hands).toBe(2);
  hands[1].sessionId='old-session';expect(cashTableReads(hands,active(),1)[2].hands).toBe(1);
 });
 it('cash fixed window is identical before and after resident-tail compaction',()=>{
  const hands=Array.from({length:145},(_,i)=>stored(i));
  const full=cashTableReads(hands,active(),1),compact=cashTableReads(hands.slice(-120),active(),1);
  expect(full).toEqual(compact);expect(full[2].hands).toBe(120);
 });
 it('same-ID restored histories and changed identities cannot reuse stale cached reads',()=>{
  const hands=[stored(1)];expect(cashTableReads(hands,active(),1)[2].pfr.count).toBe(1);
  const changed=[stored(1,'observer','target',[[2,{type:'fold'}]])];expect(cashTableReads(changed,active(),1)[2].pfr.count).toBe(0);
  expect(cashTableReads(hands,active('new-observer'),1)[2].hands).toBe(0);
  const first=cashTableReads(hands,active(),1);first[2].pfr.count=1000;expect(cashTableReads(hands,active(),1)[2].pfr.count).toBe(1);
 });
 it('tournament reads require both names to be funded participants and follow remapped seats',()=>{
  const earlier=publicHand([[2,{type:'raise',to:300}]],['You','Other','Target']);
  const witnessed=publicHand([[1,{type:'raise',to:300}]],['You','Target','Observer']);
  const current=publicHand([],['You','Observer','Target']);
  const e=event(current,[history(1,earlier),history(2,witnessed)]);
  expect(tournamentTableReadsFor(e,1)[2].hands).toBe(1);expect(tournamentTableReadsFor(e,1)[2].pfr.count).toBe(1);
  witnessed.seats[2].startingStack=0;expect(tournamentTableReadsFor(e,1)[2].hands).toBe(0);
  expect(tournamentTableReadsFor(e,9)[2].hands).toBe(0);
 });
 it('tournament sealed Hero blocks preserve jointly witnessed reads but other tables do not leak',()=>{
  const seen=history(1,publicHand([[2,{type:'raise',to:300}]]));
  const recent=history(2,publicHand([[2,{type:'call'}]]));
  const e=event(publicHand([]),[recent]);
  e.mtt={blocks:[{heroHands:[seen],hands:[{state:publicHand([[2,{type:'raise',to:500}]])}]}],recent:[]} as unknown as NonNullable<TournamentEvent['mtt']>;
  const read=tournamentTableReadsFor(e,1)[2];expect(read.hands).toBe(2);expect(read.pfr.count).toBe(1);
  const flat=event(publicHand([]),[seen,recent]);expect(tournamentTableReadsFor(flat,1)).toEqual(tournamentTableReadsFor(e,1));
 });
 it('tournament reads have a stable 300-hand window and no cross-event cache',()=>{
  const hands=Array.from({length:305},(_,i)=>history(i,publicHand([[2,{type:'raise',to:300}]])));
  const e=event(publicHand([]),hands);expect(tournamentTableReadsFor(e,1)[2].hands).toBe(300);
  const changed=event(publicHand([]),hands.map((h,i)=>history(i,publicHand([[2,{type:'fold'}]]))));
  expect(tournamentTableReadsFor(changed,1)[2].pfr.count).toBe(0);
 });
 it('open-limp rates exclude overlimps, facing raises and big-blind checks',()=>{
  const first=emptyPlayerRead();addPlayerHand(first,publicHand([[0,{type:'fold'}],[1,{type:'call'}],[2,{type:'check'}]]),1);expect(first.limp).toEqual({count:1,chances:1});
  const over=emptyPlayerRead();addPlayerHand(over,publicHand([[0,{type:'call'}],[1,{type:'call'}]]),1);expect(over.limp).toEqual({count:0,chances:0});expect(over.vpip).toEqual({count:1,chances:1});
  const facing=emptyPlayerRead();addPlayerHand(facing,publicHand([[0,{type:'raise',to:300}],[1,{type:'call'}]]),1);expect(facing.limp).toEqual({count:0,chances:0});
  const bb=emptyPlayerRead();addPlayerHand(bb,publicHand([[0,{type:'fold'}],[1,{type:'fold'}],[2,{type:'check'}]]),2);expect(bb.limp).toEqual({count:0,chances:0});
 });
 it('a forced all-in offers no preflop VPIP or PFR decision',()=>{
  const read=emptyPlayerRead();addPlayerHand(read,publicHand([[0,{type:'fold'}],[1,{type:'raise',to:300}]]),2);
  expect(read.hands).toBe(1);expect(read.vpip).toEqual({count:0,chances:0});expect(read.pfr).toEqual({count:0,chances:0});
 });
 it('steal targets exclude folded and all-in blinds',()=>{
  const rules={id:'read53',version:'1',mode:'cash' as const,smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative' as const,oddChipOrder:'clockwise-from-button' as const};
  const p=regularProfile('priya','mid'),g=startHand({handId:'targets',button:0,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`P${id}`,stack:10000}))});
  const o=observeBot(g,g.actor!,p.policyVersion,'target');expect(keyOpponent(o)).toBe(2);
  const limped=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'limp',action:{type:'call'}});
  expect(keyOpponent(observeBot(limped,limped.actor!,p.policyVersion,'limped'))).toBeNull();
  o.seats[2].folded=true;expect(keyOpponent(o)).toBe(1);o.seats[1].allIn=true;o.seats[1].stack=0;expect(keyOpponent(o)).toBeNull();
 });
 it('read aggregation uses public behavior and identity metadata, never hidden cards or traits',()=>{
  const h=stored(1),deny=()=>{throw Error('Private information accessed');};
  Object.defineProperty(h,'state',{get:deny});for(const p of Object.values(h.privateProfiles))Object.defineProperty(p,'skill',{get:deny});
  for(const s of h.view.seats)Object.defineProperty(s,'hole',{get:deny});
  for(const action of h.view.events)Object.defineProperty(action,'cards',{get:deny});
  expect(()=>cashTableReads([h],active(),1)).not.toThrow();
  const state=publicHand([[2,{type:'raise',to:300}]]);Object.defineProperty(state,'deck',{get:deny});for(const s of state.seats)Object.defineProperty(s,'hole',{get:deny});
  expect(()=>tournamentTableReadsFor(event(publicHand([]),[history(1,state)]),1)).not.toThrow();
 });
});
