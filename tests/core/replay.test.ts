import {describe,it,expect} from 'vitest';
import type {Action,GameState,HeroViewModel,RuleProfile} from '../../src/contracts';
import {applyCommand,legalActions,projectView,startHand} from '../../src/core/engine';
import {validatePublicReplay} from '../../src/core/replay';
const profile:RuleProfile={id:'practice',version:'0.2.0',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:500,cap:10,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
let serial=0;
function capture(stacks=[100,100],button=0){
 let state:GameState=startHand({handId:`replay-${++serial}`,profile,button,seats:stacks.map((stack,id)=>({id,name:`Seat ${id}`,stack}))});
 const frames:HeroViewModel[]=[projectView(state,0)];
 return {frames,get state(){return state;},act(action:Action){state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:`action-${state.revision}`,action});frames.push(projectView(state,0));},finish(){for(let i=0;state.street!=='complete'&&i<100;i++)this.act(legalActions(state).check?{type:'check'}:{type:'call'});expect(state.street).toBe('complete');return frames;}};
}
describe('authoritative public replay validation',()=>{
 it('accepts checked-down natural deals with exact cards and payouts, without mutation',()=>{
  const f=capture();const frames=f.finish(),before=structuredClone(frames);expect(()=>validatePublicReplay(frames)).not.toThrow();expect(frames).toEqual(before);
 });
 it('accepts all-fold endings without needing mucked holes or future boards',()=>{
  const f=capture([100,100,100]);f.act({type:'fold'});f.act({type:'fold'});expect(f.state.street).toBe('complete');expect(()=>validatePublicReplay(f.frames)).not.toThrow();
 });
 it('accepts multiway all-in side pots and rake through the same engine',()=>{
  const f=capture([50,120,300,300]);f.act({type:'raise',to:300});f.act({type:'call'});f.act({type:'call'});f.act({type:'call'});expect(f.state.pots).toHaveLength(3);expect(()=>validatePublicReplay(f.frames)).not.toThrow();
 });
 it('accepts automatic forced-blind all-in completion at revision zero',()=>{
  const f=capture([1,1]);expect(f.frames).toHaveLength(1);expect(f.state.street).toBe('complete');expect(()=>validatePublicReplay(f.frames)).not.toThrow();
 });
 it('rejects a negative raise even if public stacks/ledger balances are left plausible',()=>{
  const f=capture();f.act({type:'raise',to:6});const frames=f.finish();for(const frame of frames){const action=frame.events.find(e=>e.type==='action');if(action)action.action={type:'raise',to:-5};}
  expect(()=>validatePublicReplay(frames)).toThrow();
 });
 it('rejects early complete frames and premature opponent reveal, independent of external hashes',()=>{
  const f=capture();const frames=f.finish();const earlyComplete=structuredClone(frames);earlyComplete[1]={...structuredClone(frames.at(-1)!),revision:1};expect(()=>validatePublicReplay(earlyComplete)).toThrow();
  const earlyReveal=structuredClone(frames);earlyReveal[0].seats[1].hole=[...frames.at(-1)!.seats[1].hole];expect(()=>validatePublicReplay(earlyReveal)).toThrow('Initial replay');
 });
 it('rejects rebalanced forged payouts, impossible action order, skipped frames and stale revisions',()=>{
  const f=capture();const frames=f.finish();const paid=structuredClone(frames),last=paid.at(-1)!;last.seats[0].stack+=1;last.seats[1].stack-=1;expect(()=>validatePublicReplay(paid)).toThrow('authoritative action');
  const reordered=structuredClone(frames);reordered[1].events.find(e=>e.type==='action')!.seatId=1;expect(()=>validatePublicReplay(reordered)).toThrow('identity');
  expect(()=>validatePublicReplay(frames.filter((_,i)=>i!==1))).toThrow('discontinuity');
  const stale=structuredClone(frames);stale[1].revision=0;expect(()=>validatePublicReplay(stale)).toThrow('discontinuity');
 });
 it('rejects changed rules, fabricated legal metadata and repeated cards',()=>{
  const f=capture();const frames=f.finish();const changed=structuredClone(frames);changed[1].profile.bigBlind=4;expect(()=>validatePublicReplay(changed)).toThrow('authoritative action');
  const legal=structuredClone(frames);legal[0].legal.callAmount=99;expect(()=>validatePublicReplay(legal)).toThrow('Initial replay');
  const duplicated=structuredClone(frames);duplicated.at(-1)!.board[0]=duplicated[0].seats[0].hole[0];expect(()=>validatePublicReplay(duplicated)).toThrow('Repeated');
 });
 it('rejects appended settlement and never accepts an unfinished hand',()=>{
  const f=capture();expect(()=>validatePublicReplay(f.frames)).toThrow('finish settled');const frames=f.finish();expect(()=>validatePublicReplay([...frames,structuredClone(frames.at(-1)!)])).toThrow('continues after');
 });
});
