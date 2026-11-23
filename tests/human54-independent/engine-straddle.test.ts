import {describe,it,expect} from 'vitest';
import type {Action,GameState,HeroViewModel,RuleProfile,StartHandInput} from '../../src/contracts';
import {startHand,applyCommand,legalActions,nextHand,nextHandStraddleSeat,reconfigureTable,projectView,validatePublicReplay,assertPublicReplayVersion,assertAccounting,STRADDLE_ENGINE_VERSION} from '../../src/core/engine';
import {assertSupportedCashScope} from '../../src/session/release-scope';
const plain:RuleProfile={id:'independent-straddle',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:50,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const allowed:RuleProfile={...plain,straddle:{kind:'utg-live',multiple:2}};
const seats=(ids=[0,1,2,3,4,5])=>ids.map(id=>({id,name:`Seat ${id}`,stack:20000}));
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`independent:${g.revision}`,action});
const opening=(overrides:Record<number,number>={})=>startHand({handId:'independent',button:0,profile:allowed,seats:seats().map(s=>({...s,stack:overrides[s.id]??s.stack})),straddle:{seatId:3}});
function finish(g:GameState){const frames=[projectView(g,0)];for(let n=0;g.street!=='complete'&&n<80;n++){g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});frames.push(projectView(g,0));}expect(g.street).toBe('complete');return {g,frames};}

describe('independent live-straddle engine boundaries',()=>{
 it('keeps old cash frames unchanged in shape and marks the new rule capability even when no straddle is posted',()=>{
  const old=startHand({handId:'old',button:0,profile:plain,seats:seats()}),enabled=startHand({handId:'enabled',button:0,profile:allowed,seats:seats()});
  expect(old.engineVersion).toBe('0.4.0');expect(projectView(old,0)).not.toHaveProperty('engineVersion');
  expect(enabled.engineVersion).toBe(STRADDLE_ENGINE_VERSION);expect(projectView(enabled,0).engineVersion).toBe('0.6.0');expect(enabled.straddleSeat).toBeUndefined();
  expect(()=>assertAccounting({...enabled,engineVersion:'0.4.0'})).toThrow(/engine version/);expect(()=>assertAccounting({...old,engineVersion:'0.6.0'})).toThrow(/engine version/);
  expect(()=>assertAccounting({...old,engineVersion:'0.3.0'})).not.toThrow();
  const {frames}=finish(enabled);expect(()=>validatePublicReplay(frames)).not.toThrow();
  const missing=structuredClone(frames);for(const f of missing)delete f.engineVersion;expect(()=>validatePublicReplay(missing)).toThrow(/engine version/);
 });
 it('rejects ambiguous or malformed requests and noncanonical aliases without consuming an unsupported variant',()=>{
  for(const straddle of [null,true,[],{seatId:3,amount:400},{seatId:'3'},{seatId:3.5},{seatId:NaN}])expect(()=>startHand({handId:'bad',button:0,profile:allowed,seats:seats(),straddle} as unknown as StartHandInput)).toThrow(/straddle request/);
  for(const key of ['Straddle','strad_dle','enableStraddle','straddleEnabled'])expect(()=>assertSupportedCashScope({[key]:{kind:'utg-live',multiple:2}})).toThrow();
  expect(()=>startHand({handId:'bad',button:0,profile:{...allowed,bigBlind:Number.MAX_SAFE_INTEGER},seats:seats()})).toThrow(/precision/);
 });
 it('gives the option to the straddler after a short raise and keeps the straddle-sized full increment',()=>{
  let g=opening({4:600});expect(g.actor).toBe(4);expect(legalActions(g).shortAllInTo).toBe(600);g=act(g,{type:'raise',to:600});
  for(const id of [5,0,1,2]){expect(g.actor).toBe(id);g=act(g,{type:'call'});}
  expect(g.actor).toBe(3);expect(legalActions(g)).toMatchObject({callAmount:200,canRaise:true,reopened:true,minRaiseTo:1000});
  expect(()=>act(g,{type:'raise',to:800})).toThrow(/minimum/);g=act(g,{type:'raise',to:1000});expect(g.minFullRaiseIncrement).toBe(400);assertAccounting(g);
 });
 it('reopens a caller after two cumulative short raises, but not after only one',()=>{
  let g=opening({5:600,0:800});g=act(g,{type:'call'});expect(g.actor).toBe(5);g=act(g,{type:'raise',to:600});
  const once=(()=>{let a=act(g,{type:'call'});for(const id of [1,2,3]){expect(a.actor).toBe(id);a=act(a,{type:'call'});}return a;})();
  expect(once.actor).toBe(4);expect(legalActions(once)).toMatchObject({callAmount:200,canRaise:false,reopened:false});
  g=act(g,{type:'raise',to:800});for(const id of [1,2,3]){expect(g.actor).toBe(id);g=act(g,{type:'call'});}
  expect(g.actor).toBe(4);expect(legalActions(g)).toMatchObject({callAmount:400,canRaise:true,reopened:true,minRaiseTo:1200});assertAccounting(g);
 });
 it('resets the minimum bet to the original big blind on the flop',()=>{
  let g=opening();for(const id of [4,5,0,1,2]){expect(g.actor).toBe(id);g=act(g,{type:'call'});}expect(g.actor).toBe(3);g=act(g,{type:'check'});
  expect(g.street).toBe('flop');expect(g.actor).toBe(1);expect(g.minFullRaiseIncrement).toBe(200);expect(legalActions(g).minRaiseTo).toBe(200);g=act(g,{type:'raise',to:200});assertAccounting(g);
 });
 it('returns an uncalled straddle and preserves the exact forced-blind profit',()=>{
  let g=opening();const frames=[projectView(g,0)];while(g.street!=='complete'){g=act(g,{type:'fold'});frames.push(projectView(g,0));}
  expect(g.seats.find(s=>s.id===3)!.stack).toBe(20300);expect(g.events.filter(e=>e.type==='refund').map(e=>[e.seatId,e.amount])).toEqual([[3,200]]);expect(g.rake).toBe(0);assertAccounting(g);expect(()=>validatePublicReplay(frames)).not.toThrow();
 });
 it('uses physical sparse seats and does not ask for a straddle below four funded seats',()=>{
  let g=startHand({handId:'sparse',button:8,profile:allowed,seats:seats([0,2,5,8]),straddle:{seatId:5}});expect([g.smallBlindSeat,g.bigBlindSeat,g.straddleSeat,g.actor]).toEqual([0,2,5,8]);
  while(g.street!=='complete')g=act(g,{type:'fold'});expect(nextHandStraddleSeat(g)).toBe(8);
  const asked:number[]=[];const n=nextHand(g,'sparse-next',id=>{asked.push(id);return true;});expect(asked).toEqual([8]);expect(n.actor).toBe(0);expect(n.straddleSeat).toBe(8);
  const configured=reconfigureTable(g,g.seats.filter(s=>s.id!==2).map(s=>({id:s.id,name:s.name,stack:s.stack})),allowed,'remove-seat');expect(nextHandStraddleSeat(configured)).toBeNull();expect(nextHand(configured,'three',()=>{throw Error('must not ask');}).straddleSeat).toBeUndefined();
 });
 it('changes rule capability only at the boundary, while an old settled record remains intact',()=>{
  let g=startHand({handId:'off',button:0,profile:plain,seats:seats()});while(g.street!=='complete')g=act(g,{type:'fold'});const before=structuredClone(g);
  const configured=reconfigureTable(g,g.seats.map(s=>({id:s.id,name:s.name,stack:s.stack})),allowed,'on');expect(configured.engineVersion).toBe('0.6.0');expect(g).toEqual(before);
  let posted=nextHand(configured,'on-next',()=>true);while(posted.street!=='complete')posted=act(posted,{type:'fold'});
  const off=reconfigureTable(posted,posted.seats.map(s=>({id:s.id,name:s.name,stack:s.stack})),plain,'off');expect(off.engineVersion).toBe('0.4.0');expect(nextHand(off,'off-next').straddleSeat).toBeUndefined();
 });
 it('rejects removed, moved, duplicated and altered public forced-bet evidence',()=>{
  const {frames}=finish(opening({1:50,2:150}));expect(()=>validatePublicReplay(frames)).not.toThrow();
  const change=(edit:(f:HeroViewModel)=>void)=>{const copy=structuredClone(frames);for(const f of copy)edit(f);return copy;};
  for(const forged of [change(f=>{delete f.straddleSeat;}),change(f=>{f.straddleSeat=4;}),change(f=>{f.events.find(e=>e.detail==='Live straddle')!.amount=300;}),change(f=>{f.events.push({...f.events.find(e=>e.detail==='Live straddle')!});})]){
   expect(()=>assertPublicReplayVersion(forged[0])).toThrow();expect(()=>validatePublicReplay(forged)).toThrow();
  }
 });
});
