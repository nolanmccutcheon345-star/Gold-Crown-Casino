import {describe,expect,it} from 'vitest';
import type {Action,GameState,HeroViewModel} from '../../src/contracts';
import {assertAccounting,projectView} from '../../src/core/engine';
import {canonical,GENESIS,parsePublicHistory,publicHistory,seal} from '../../src/storage/integrity';
import {makeCashHandProvenance} from '../../src/session/hand-provenance';
import {act,hand,practiceProfile,rig} from '../verification/helpers';

function fixture(stacks=[50,120,300,300,100]){
 const profile={...practiceProfile(),smallBlind:1,bigBlind:2};
 const game=rig(hand(stacks,0,profile),[['2c','3d'],['4c','5d'],['6c','7d'],['8c','9d'],['Tc','Jd']],['As','Ks','Qs','Js','Ts']);
 return {game,frames:[projectView(game,0)]};
}
function actions(state:ReturnType<typeof fixture>,list:Action[]){for(const action of list){state.game=act(state.game,action);state.frames.push(projectView(state.game,0));}return state;}
function foldedDeadMoneyLock(){
 return actions(fixture(),[{type:'call'},{type:'call'},{type:'raise',to:50},{type:'raise',to:120},{type:'raise',to:300},{type:'call'},{type:'fold'}]);
}
async function stored(game:GameState,frames:HeroViewModel[]){
 const hero=game.seats[0];return seal({id:game.handId,sessionId:'exposure-session',epoch:0,number:1,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T00:00:01Z',view:projectView(game,0),frames,net:hero.stack-hero.startingStack,privateProfiles:{},provenance:makeCashHandProvenance(game.profile),previousHash:GENESIS,hash:''});
}
describe('U07 / X12 permitted replay disclosure and locked side pots',()=>{
 it('keeps the folded fifth player in no eligible pot and splits the locked main plus two side pots exactly',()=>{
  const {game,frames}=foldedDeadMoneyLock();expect(game.street).toBe('complete');expect(game.burned).toHaveLength(3);expect(game.board).toHaveLength(5);assertAccounting(game);
  expect(game.pots).toEqual([{amount:202,eligible:[0,1,2,3],winners:[0,1,2,3]},{amount:210,eligible:[1,2,3],winners:[1,2,3]},{amount:360,eligible:[2,3],winners:[2,3]}]);
  expect(game.payouts).toEqual({0:50,1:121,2:301,3:300});expect(game.payouts[4]).toBeUndefined();
  expect(frames.at(-1)!.seats[4].hole).toEqual([]);expect(frames.at(-1)!.handLabels[4]).toBeUndefined();
  for(const frame of frames.slice(0,-1)){expect(frame.seats.slice(1).every(seat=>seat.hole.length===0)).toBe(true);expect(frame.board).toHaveLength(0);}
 });
 it('does not expose an all-in opponent while other players still act on a side pot',()=>{
  const state=actions(fixture([300,50,120,300,100]),[{type:'call'},{type:'call'},{type:'raise',to:50},{type:'call'},{type:'call'},{type:'call'},{type:'fold'}]);
  expect(state.game.street).toBe('flop');expect(state.game.seats[1].allIn).toBe(true);expect(state.game.seats.filter(s=>!s.folded&&!s.allIn)).toHaveLength(3);
  const before=canonical(state.game),view=projectView(state.game,0);expect(view.seats[1].hole).toEqual([]);expect(view.seats[4].hole).toEqual([]);expect(view.seats[0].hole).toHaveLength(2);expect(canonical(state.game)).toBe(before);
  actions(state,[{type:'raise',to:70},{type:'call'},{type:'raise',to:250},{type:'call'}]);expect(state.game.street).toBe('complete');assertAccounting(state.game);
  for(const frame of state.frames.filter(f=>f.street!=='complete'))expect(frame.seats.slice(1).every(s=>s.hole.length===0)).toBe(true);
  expect(state.frames.at(-1)!.seats[1].hole).toHaveLength(2);expect(state.frames.at(-1)!.seats[4].hole).toEqual([]);
 });
 it('exports and imports only permitted cards at every selectable replay frame, without changing source state',async()=>{
  const {game,frames}=foldedDeadMoneyLock(),record=await stored(game,frames),before=canonical(record),payload=await publicHistory([record]);
  const imported=await parsePublicHistory(JSON.stringify(payload));expect(imported).toHaveLength(1);expect(canonical(record)).toBe(before);
  for(const frame of imported[0].frames){
   expect(frame.seats[4].hole).toEqual([]);if(frame.street!=='complete')expect(frame.seats.slice(1).every(s=>s.hole.length===0)).toBe(true);
   expect('deck' in frame).toBe(false);expect('privateProfiles' in frame).toBe(false);
  }
  expect(imported[0].view.pots).toEqual(game.pots);expect(imported[0].view.payouts).toEqual(game.payouts);
 });
 it('rejects rehashed replay that attempts to reveal a folded card or show an all-in card early',async()=>{
  const {game,frames}=foldedDeadMoneyLock(),payload=await publicHistory([await stored(game,frames)]);
  const early=structuredClone(payload);early.hands[0].frames[0].seats[1].hole=[...game.seats[1].hole];early.hands[0]=await seal(early.hands[0]);await expect(parsePublicHistory(JSON.stringify(early))).rejects.toThrow();
  const folded=structuredClone(payload);folded.hands[0].view.seats[4].hole=[...game.seats[4].hole];folded.hands[0].frames.at(-1)!.seats[4].hole=[...game.seats[4].hole];folded.hands[0]=await seal(folded.hands[0]);await expect(parsePublicHistory(JSON.stringify(folded))).rejects.toThrow();
 });
});
