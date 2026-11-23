import {describe,it,expect} from 'vitest';
import type {Action,BotProfile,HeroViewModel,RuleProfile} from '../../src/contracts';
import type {CashSession,StoredHand} from '../../src/session/types';
import {applyCommand,legalActions,projectView,startHand} from '../../src/core/engine';
import {standardDeck} from '../../src/core/deck';
import {contributedRake,deriveCashStats,frozenPolicyVersions,heroPosition} from '../../src/stats/cash';
const profile:RuleProfile={id:'practice',version:'0.2.0',mode:'cash',chipUnit:1,smallBlind:1,bigBlind:2,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
let serial=0;
function fixture(stacks=[100,100,100],button=0,p=profile){
 let state=startHand({handId:`stats-${++serial}`,profile:p,button,seats:stacks.map((stack,id)=>({id,name:`Seat ${id}`,stack}))});
 if(state.street!=='complete'){
  const holes=[['As','Ah'],['Ks','Kh'],['Qs','Qh'],['Js','Jh']].slice(0,stacks.length),board=['2c','3d','7s','8c','9h'];
  const used=[...holes.flat(),...board],rest=standardDeck().filter(c=>!used.includes(c));
  state.seats.forEach((seat,i)=>seat.hole=holes[i]);state.deck=[...holes.flat(),rest.shift()!,...board.slice(0,3),rest.shift()!,board[3],rest.shift()!,board[4],...rest];state.deckCursor=holes.length*2;
 }
 const frames:HeroViewModel[]=[projectView(state,0)];
 return {
  get state(){return state;},
  act(action:Action){state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:`${state.handId}:${state.revision}`,action});frames.push(projectView(state,0));},
  finish(){for(let n=0;state.street!=='complete'&&n<100;n++)this.act(legalActions(state).check?{type:'check'}:{type:'call'});expect(state.street).toBe('complete');return this.record();},
  record():StoredHand{const view=projectView(state,0);return {id:state.handId,sessionId:'session1',epoch:0,number:1,startedAt:'2026-10-31T00:00:00Z',endedAt:'2026-10-31T00:01:00Z',view,frames,net:state.seats[0].stack-state.seats[0].startingStack,privateProfiles:{},previousHash:'',hash:'hash'};},
 };
}
function session(hands:StoredHand[],overrides:Partial<CashSession>={}):CashSession{return {id:'session1',epoch:0,startedAt:'2026-10-31T00:00:00Z',endedAt:'2026-10-31T01:00:00Z',settings:{seats:3,stake:'custom',smallBlind:1,bigBlind:2,buyIn:100,archetypes:['tag','tag'],rakeMode:'none',rakeBasisPoints:0,rakeCap:0,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:100,allowTopUp:true},profile,buyIns:100,cashOut:100,activeMs:3600000,lastActiveAt:null,handIds:hands.map(h=>h.id),...overrides};}
function stat(hand:StoredHand){return deriveCashStats([hand],[session([hand])],0);}

describe('cash profitability and attribution',()=>{
 it('excludes transfer/manual money by deriving only settled hand net, with weighted mixed-stake BB/100',()=>{
  const a=fixture([100,100]);a.act({type:'fold'});const h1=a.record();expect(h1.net).toBe(-1);
  const b=fixture([100,100],0,{...profile,smallBlind:5,bigBlind:10});b.act({type:'fold'});const h2=b.record();expect(h2.net).toBe(-5);
  const s=session([h1,h2],{buyIns:999999,cashOut:888888});const x=deriveCashStats([h1,h2],[s]);
  expect(x.profit).toBe(-6);expect(x.bb100).toBe(-50);expect(x.mixedStakes).toBe(true);expect(x.stakes.map(g=>g.bb100)).toEqual([-50,-50]);
  expect(x.perHour).toBe(-6);expect(x.losingSessions).toBe(1);expect(x.winningSessions).toBe(0);
  expect(deriveCashStats([h1,h2],[{...s,buyIns:1,cashOut:987654321,epoch:5}]).profit).toBe(-6);
 });

 it('G01/G02/G03: computes +20, −10 and mixed +5 BB/100 from 200 actual legal settled hands',()=>{
  const oneTwo={...profile,smallBlind:100,bigBlind:200},twoFive={...profile,smallBlind:200,bigBlind:500};
  const first:StoredHand[]=[];const second:StoredHand[]=[];
  for(let i=0;i<100;i++){
   const f=fixture([10000,10000],i<70?1:0,oneTwo);f.act({type:'fold'});first.push(f.record());
   const g=fixture([10000,10000],i<2||i>=61?1:0,twoFive);
   if(i<2){g.act({type:'call'});g.act({type:'check'});g.act({type:'fold'});}else g.act({type:'fold'});
   second.push({...g.record(),sessionId:'session2'});
  }
  expect(deriveCashStats(first,[]).profit).toBe(4000);expect(deriveCashStats(first,[]).bb100).toBe(20);
  expect(deriveCashStats(second,[]).profit).toBe(-5000);expect(deriveCashStats(second,[]).bb100).toBe(-10);
  const all=deriveCashStats([...first,...second],[]);expect(all.profit).toBe(-1000);expect(all.hands).toBe(200);expect(all.bb100).toBeCloseTo(5);expect(all.mixedStakes).toBe(true);
 });
 it('excludes active hands and separates active/closed sessions with actual active time',()=>{
  const f=fixture([100,100]);f.act({type:'fold'});const h=f.record(),active=fixture().record();
  const x=deriveCashStats([h,active],[session([h],{endedAt:null,activeMs:1000,lastActiveAt:5000})],6000);
  expect(x.hands).toBe(1);expect(x.activeMs).toBe(2000);expect(x.perHour).toBe(-1800);expect(x.losingSessions).toBe(0);expect(x.activeSession?.profit).toBe(-1);
  const paused=deriveCashStats([h],[session([h],{endedAt:null,activeMs:1000,lastActiveAt:null})],999999);expect(paused.activeMs).toBe(1000);
 });
 it('returns absent metrics as null and rejects duplicate canonical hands',()=>{
  const empty=deriveCashStats([],[]);expect(empty.bb100).toBe(null);expect(empty.perHour).toBe(null);expect(empty.metrics.vpip).toMatchObject({percent:null,denominator:0,status:'NO_OPPORTUNITIES'});
  const f=fixture([100,100]);f.act({type:'fold'});const h=f.record();expect(()=>deriveCashStats([h,h],[])).toThrow('Duplicate');
 });
 it('allocates rake to all contributions including folded dead money, excluding refunded excess, without extra profit debit',()=>{
  const f=fixture([100,100,100],0,{...profile,rake:{basisPoints:1000,cap:100,noFlopNoDrop:true}});
  f.act({type:'raise',to:10});f.act({type:'fold'});f.act({type:'call'});const h=f.finish();
  expect(h.view.rake).toBe(2);expect(h.view.seats.map(s=>s.totalCommitted)).toEqual([10,1,10]);
  const shares=contributedRake(h.view);expect(Object.values(shares).reduce((a,b)=>a+b,0)).toBe(2);
  // Floors are zero; two remaining cents clockwise after BTN go to SB and BB.
  expect(shares).toEqual({0:0,1:1,2:1});expect(stat(h).rake).toBe(0);expect(stat(h).profit).toBe(h.net);
 });
 it('separates saved policy versions in configuration results without altering financial totals or sealed records',()=>{
  const a=fixture([100,100]);a.act({type:'fold'});const h1=a.record();
  const b=fixture([100,100]);b.act({type:'fold'});const h2=b.record();
  h1.privateProfiles={1:{archetype:'tag',policyVersion:'synthetic-0.1.0',aggression:0.5,looseness:0.4}};
  h2.privateProfiles={1:{archetype:'tag',policyVersion:'synthetic-0.2.0',aggression:0.5,looseness:0.4}};
  const before=JSON.stringify([h1,h2]),result=deriveCashStats([h1,h2],[session([h1,h2])]);
  expect(result.configurations).toHaveLength(2);
  expect(result.configurations.map(group=>group.label)).toEqual([expect.stringContaining('Policies synthetic-0.1.0'),expect.stringContaining('Policies synthetic-0.2.0')]);
  expect(result.configurations.every(group=>group.label.includes('Rules practice@0.2.0'))).toBe(true);
  expect(result.configurations.reduce((sum,group)=>sum+group.profit,0)).toBe(result.profit);
  expect(result.profit).toBe(-2);expect(result.bb100).toBe(-50);expect(result.rake).toBe(0);
  expect(JSON.stringify([h1,h2])).toBe(before);
 });
 it('groups the same distinct policy-version set regardless of seat ordering or duplicate profiles',()=>{
  const a=fixture([100,100,100]);a.act({type:'fold'});const h1=a.finish();
  const b=fixture([100,100,100]);b.act({type:'fold'});const h2=b.finish();
  const old={archetype:'tag' as const,policyVersion:'policy-a',aggression:0.5,looseness:0.4},latest={...old,policyVersion:'policy-b'};
  h1.privateProfiles={1:latest,2:old};h2.privateProfiles={1:old,2:latest,3:latest};
  const result=deriveCashStats([h1,h2],[]);
  expect(frozenPolicyVersions(h1.privateProfiles)).toEqual(['policy-a','policy-b']);
  expect(result.configurations).toHaveLength(1);expect(result.configurations[0].hands).toBe(2);
  expect(result.configurations[0].label).toContain('Policies policy-a, policy-b');
 });
 it('projects only policyVersion and explicitly labels missing provenance without reading hidden profile fields',()=>{
  const f=fixture([100,100]);f.act({type:'fold'});const hand=f.record();
  expect(stat(hand).configurations[0].label).toContain('Policies unrecorded');
  const profile={policyVersion:'public-version'} as BotProfile;
  for(const field of ['archetype','traits','skill','personalityId','aggression','looseness'])Object.defineProperty(profile,field,{get(){throw new Error(`Private field read: ${field}`);}});
  hand.privateProfiles={1:profile};
  expect(frozenPolicyVersions(hand.privateProfiles)).toEqual(['public-version']);
  expect(stat(hand).configurations[0].label).toContain('Policies public-version');
 });
 it('groups exact seat/rules configurations and physical positions',()=>{
  const f=fixture([100,100]);f.act({type:'fold'});const h=f.record();
  expect(stat(h).positions[0].label).toBe('BTN/SB');expect(stat(h).configurations[0].label).toContain('2 seats');
  for(const [n,button,expected] of [[3,0,'BTN'],[3,1,'BB'],[3,2,'SB'],[6,1,'CO'],[6,2,'HJ'],[6,3,'LJ'],[9,3,'LJ'],[9,4,'UTG+2']] as const){
   const view=structuredClone(h.view);view.seats=Array.from({length:n},(_,id)=>({...h.view.seats[0],id}));view.button=button;view.smallBlindSeat=(button+1)%n;view.bigBlindSeat=(button+2)%n;expect(heroPosition(view)).toBe(expected);
  }
 });
});

describe('eligible preflop opportunities',()=>{
 it('counts voluntary calls but not forced blinds or folds; legal raise opportunities use their own denominator',()=>{
  const f=fixture([100,100]);f.act({type:'call'});const x=stat(f.finish());
  expect(x.metrics.vpip).toMatchObject({numerator:1,denominator:1,percent:100});expect(x.metrics.pfr).toMatchObject({numerator:0,denominator:1});
  const forced=fixture([1,1]);expect(forced.state.street).toBe('complete');const y=stat(forced.record());expect(y.metrics.vpip.denominator).toBe(0);expect(y.metrics.pfr.denominator).toBe(0);
  const walk=fixture([100,100,100],1);walk.act({type:'fold'});walk.act({type:'fold'});expect(stat(walk.record()).metrics.vpip.denominator).toBe(0);
 });
 it('counts a genuine 3-bet once, and preserves the original opener fold-to-3-bet opportunity',()=>{
  const f=fixture([100,100,100],2);f.act({type:'raise',to:6});f.act({type:'raise',to:18});f.act({type:'fold'});f.act({type:'call'});
  const x=stat(f.finish());expect(x.metrics.threeBet).toMatchObject({numerator:1,denominator:1,percent:100});expect(x.metrics.pfr.numerator).toBe(1);
  const g=fixture();g.act({type:'raise',to:6});g.act({type:'call'});g.act({type:'raise',to:18});g.act({type:'fold'});g.act({type:'call'});
  const y=stat(g.finish());expect(y.metrics.foldToThreeBet).toMatchObject({numerator:1,denominator:1});expect(y.metrics.threeBet.denominator).toBe(0);
 });
 it('excludes forced all-in calls from 3-bet/PFR opportunities but counts legal short all-in raises',()=>{
  const f=fixture([6,100,100],2);f.act({type:'raise',to:6});expect(legalActions(f.state).canRaise).toBe(false);f.act({type:'call'});
  const x=stat(f.finish());expect(x.metrics.threeBet.denominator).toBe(0);expect(x.metrics.pfr.denominator).toBe(0);expect(x.metrics.vpip.numerator).toBe(1);
  const g=fixture([7,100,100],2);g.act({type:'raise',to:6});expect(legalActions(g.state).shortAllInTo).toBe(7);g.act({type:'raise',to:7});
  const y=stat(g.finish());expect(y.metrics.threeBet).toMatchObject({numerator:1,denominator:1});
 });
 it('excludes already-all-in openers and fourth bets from fold-to-3-bet opportunities',()=>{
  const f=fixture([6,100,100]);f.act({type:'raise',to:6});f.act({type:'raise',to:18});f.act({type:'call'});
  expect(stat(f.finish()).metrics.foldToThreeBet.denominator).toBe(0);
  const g=fixture();g.act({type:'raise',to:6});g.act({type:'raise',to:18});g.act({type:'raise',to:40});g.act({type:'fold'});g.act({type:'call'});
  expect(stat(g.finish()).metrics.foldToThreeBet.denominator).toBe(0);
 });
 it('retains call/fold opportunity facing a short re-raise even though raising did not reopen',()=>{
  const f=fixture([100,14,100]);f.act({type:'raise',to:10});f.act({type:'raise',to:14});f.act({type:'call'});expect(legalActions(f.state).canRaise).toBe(false);f.act({type:'fold'});
  expect(stat(f.finish()).metrics.foldToThreeBet).toMatchObject({numerator:1,denominator:1});
 });
 it('reports missing pre-action evidence instead of manufacturing denominators',()=>{
  const f=fixture([100,100]);const h=f.finish();h.frames=[];const x=stat(h);
  expect(x.metrics.vpip.denominator).toBe(0);expect(x.opportunityCoverage).toEqual({completeHands:0,missingFrames:1});
 });
});

describe('showdown denominators and uncertainty',()=>{
 it('counts Hero seeing flop and winning showdown; skips preflop folds when other players see board',()=>{
  const f=fixture([100,100]);const x=stat(f.finish());expect(x.metrics.wtsd).toMatchObject({numerator:1,denominator:1});expect(x.metrics.wsd).toMatchObject({numerator:1,denominator:1});expect(x.metrics.wwsf).toMatchObject({numerator:1,denominator:1});
  const g=fixture();g.act({type:'fold'});const y=stat(g.finish());expect(y.metrics.wtsd.denominator).toBe(0);expect(y.metrics.wwsf.denominator).toBe(0);expect(y.metrics.wsd.denominator).toBe(0);
 });
 it('counts postflop fold as saw-flop without showdown and postflop uncontested win as WWSF',()=>{
  const f=fixture([100,100]);f.act({type:'call'});f.act({type:'check'});f.act({type:'check'});f.act({type:'raise',to:4});f.act({type:'fold'});
  const x=stat(f.record());expect(x.metrics.wwsf).toMatchObject({numerator:1,denominator:1});expect(x.metrics.wtsd).toMatchObject({numerator:0,denominator:1});expect(x.metrics.wsd.denominator).toBe(0);
  const g=fixture([100,100]);g.act({type:'call'});g.act({type:'check'});g.act({type:'raise',to:4});g.act({type:'fold'});const y=stat(g.record());expect(y.metrics.wtsd).toMatchObject({numerator:0,denominator:1});expect(y.metrics.wwsf.numerator).toBe(0);
 });
 it('counts a split award as W$SD even with a negative net due to rake',()=>{
  const f=fixture([100,100]);const h=f.finish();h.view.payouts={0:1,1:2};h.view.handLabels={0:'Royal flush',1:'Royal flush'};h.net=-1;
  const x=stat(h);expect(x.metrics.wsd).toMatchObject({numerator:1,denominator:1});expect(x.profit).toBe(-1);
 });
 it('labels small samples and supplies descriptive Wilson bounds',()=>{
  const f=fixture([100,100]);const x=stat(f.finish());expect(x.metrics.vpip.status).toBe('INSUFFICIENT_SAMPLE');expect(x.metrics.vpip.ci95![0]).toBeCloseTo(20.6549,3);expect(x.metrics.vpip.ci95![1]).toBe(100);expect(x.disclosure).toContain('correlated');
 });
});
