import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import type {RuleProfile,BotObservation} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seededHand,act} from '../verification/helpers';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead,type PlayerRead} from '../../src/bots/table-reads';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V28,TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V215,NEW_EVENT_TOURNAMENT_POLICY,supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'independent55',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
function reads(){const r=emptyPlayerRead();r.hands=48;r.vpip={count:32,chances:48};r.pfr={count:25,chances:48};r.limp={count:7,chances:48};r.reads.hands=48;r.reads.foldToCbet={count:14,chances:24};return {0:r};}
const standings={playersLeft:18,paid:3,stacks:Array(18).fill(10000)};
function flop():BotObservation {let g=seededHand(Array(6).fill(20000),5511,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return observeBot(g,g.actor!,regularProfile('hiro','high').policyVersion,'postflop55');}
function baselineDigest(){const rows:unknown[]=[];const streets:Record<string,number>={};
 for(const id of ['hiro','tess','big-earl'])for(const seed of [11,22])for(const depth of [2000,20000]){
  const p=regularProfile(id,'mid');let g=seededHand([depth,depth*2,depth,depth*3,depth,depth],seed,rules);
  for(let n=0;g.street!=='complete'&&n<200;n++){
   const o=observeBot(g,g.actor!,p.policyVersion,`golden55:${id}:${seed}:${depth}:${n}`),rng=seedStream(seed*100+n),d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V28,standings,[{deltaBB:-18,showdownLoss:true,share:-.3}],null,reads());
   rows.push([d,rng()]);streets[o.street]=(streets[o.street]??0)+1;g=applyCommand(g,d);
  }expect(g.street).toBe('complete');
 }
 const o=flop();for(const id of ['hiro','tess','big-earl'])for(let n=0;n<30;n++){const p=regularProfile(id,'mid'),rng=seedStream(n);const d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V28,standings,[],null,reads());rows.push([d,rng()]);}
 return {digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),decisions:rows.length,streets};
}
describe('Version55 independent tournament integration',()=>{
 it('keeps literal Version54 policy2.8 decisions, fingerprints and RNG consumption',()=>{// Captured from unmodified Version54 commit 1cf32654eeebaf74e8a1ed062c0b168d1af1c8d0.
  expect(baselineDigest()).toEqual({digest:'fe2ea8b023c663292bd89004967707fdad680144b1659e789fb7641616318ecc',decisions:179,streets:{preflop:83,flop:2,turn:2,river:2}});});
 it('opts new events into all prior capabilities and the new policy',()=>{
  expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
  for(const version of [TOURNAMENT_POLICY_V28,TOURNAMENT_POLICY_V29])for(const capability of [supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads])expect(capability(version)).toBe(true);
 });
 it('retains reviewed push/fold decisions and RNG with numeric public-read hashes',()=>{
  const p=regularProfile('hiro','high');let g=seededHand([2000,8000,8000,8000],5521,rules);g=act(g,{type:'fold'});
  const o={...observeBot(g,g.actor!,p.policyVersion,'pf55'),ownCards:['As','Ad']};
  for(let seed=0;seed<20;seed++){
   const a=seedStream(seed),b=seedStream(seed),old=chooseTournamentDecision(o,p,a,TOURNAMENT_POLICY_V28,standings,[],null,reads()),next=chooseTournamentDecision(o,p,b,TOURNAMENT_POLICY_V29,standings,[],null,reads());
   expect(next.observationHash).toContain(':pf:');expect(next.action).toEqual(old.action);expect(a()).toBe(b());
   expect(next.observationHash.replace(TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V28)).toBe(old.observationHash);
  }
 });
 it('includes numeric reads without inspecting caller private fields on both new branches',()=>{
  const p=regularProfile('hiro','high');let g=seededHand([2000,8000,8000,8000],5522,rules);g=act(g,{type:'fold'});
  const short={...observeBot(g,g.actor!,p.policyVersion,'pf55'),ownCards:['As','Ad']};
  for(const o of [short,flop()]){
   const a=reads(),b=structuredClone(a);b[0].vpip.count--;
   const choose=(r:Record<number,PlayerRead>)=>chooseTournamentDecision(o,p,seedStream(5),TOURNAMENT_POLICY_V29,standings,[],null,r);
   const clean=choose(a);expect(clean.observationHash).not.toBe(choose(b).observationHash);expect(clean.observationHash).toContain(':table:');
   if(o.street==='flop')expect(clean.observationHash).toMatch(/:table:[a-f0-9]{64}:[^:]+\/[^:]+$/);
   Object.defineProperty(a[0],'privateCards',{enumerable:true,get(){throw Error('Private data read');}});expect(choose(a)).toEqual(clean);
  }
 });
});
