import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import type {RuleProfile,BotObservation} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seededHand,act} from '../verification/helpers';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V211,TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V215,NEW_EVENT_TOURNAMENT_POLICY,supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'independent55',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
function reads(){const r=emptyPlayerRead();r.hands=48;r.vpip={count:32,chances:48};r.pfr={count:25,chances:48};r.limp={count:7,chances:48};r.reads.hands=48;r.reads.foldToCbet={count:14,chances:24};return {0:r};}
const standings={playersLeft:18,paid:3,stacks:Array(18).fill(10000)};
function flop():BotObservation {let g=seededHand(Array(6).fill(20000),5511,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return observeBot(g,g.actor!,regularProfile('hiro','high').policyVersion,'postflop55');}
function baselineDigest(){const rows:unknown[]=[];const streets:Record<string,number>={};
 for(const id of ['hiro','tess','big-earl'])for(const seed of [11,22])for(const depth of [2000,20000]){
  const p=regularProfile(id,'mid');let g=seededHand([depth,depth*2,depth,depth*3,depth,depth],seed,rules);
  for(let n=0;g.street!=='complete'&&n<200;n++){
   const o=observeBot(g,g.actor!,p.policyVersion,`golden55:${id}:${seed}:${depth}:${n}`),rng=seedStream(seed*100+n),d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V211,standings,[{deltaBB:-18,showdownLoss:true,share:-.3}],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}});
   rows.push([d,rng()]);streets[o.street]=(streets[o.street]??0)+1;g=applyCommand(g,d);
  }expect(g.street).toBe('complete');
 }
 const o=flop();for(const id of ['hiro','tess','big-earl'])for(let n=0;n<30;n++){const p=regularProfile(id,'mid'),rng=seedStream(n);const d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V211,standings,[],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}});rows.push([d,rng()]);}
 return {digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),decisions:rows.length,streets};
}

it('preserves literal V57 2.11 decisions, image/read hashes and next RNG draws',()=>{
 // Captured before integration from a02dfca0cf093c3588fbfd5332fb408ce25e64df.
 expect(baselineDigest()).toEqual({digest:'b84b35dd845726382152eaeb792345dc3839eb6b91a884038b577faa6653db70',decisions:188,streets:{preflop:83,flop:5,turn:5,river:5}});
});

it('enables all previous context capabilities only under the explicitly stored new policy',()=>{
 expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
 for(const version of [TOURNAMENT_POLICY_V211,TOURNAMENT_POLICY_V212])for(const capability of [supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages])expect(capability(version)).toBe(true);
 expect(supportedTournamentPolicy('synthetic-tournament-2.99.0')).toBe(false);
});
it('keeps sub-threshold image evidence bound to 2.12 and ignores hidden fields',()=>{
 const p=regularProfile('hiro','high'),o=flop(),a={0:{bluff:.05,monster:.01}},b={0:{bluff:.06,monster:.01}};
 const choose=(images:typeof a)=>chooseTournamentDecision(o,p,seedStream(17),TOURNAMENT_POLICY_V212,standings,[],null,reads(),images);
 const first=choose(a);expect(first.observationHash).not.toBe(choose(b).observationHash);
 const digest=createHash('sha256').update('[[0,0.05,0.01]]').digest('hex');expect(first.observationHash).toContain(`:image:${digest}`);
 Object.defineProperty(a[0],'privateCards',{enumerable:true,get(){throw Error('Hidden data read');}});expect(choose(a)).toEqual(first);
});
it('preserves short-stack push/fold actions and RNG between 2.11 and 2.12',()=>{
 const p=regularProfile('hiro','high');let g=seededHand([2000,8000,8000,8000],5521,rules);g=act(g,{type:'fold'});
 const o={...observeBot(g,g.actor!,p.policyVersion,'pf57'),ownCards:['As','Ad']};
 for(let seed=0;seed<20;seed++){
  const a=seedStream(seed),b=seedStream(seed),old=chooseTournamentDecision(o,p,a,TOURNAMENT_POLICY_V211,standings,[],null,reads()),next=chooseTournamentDecision(o,p,b,TOURNAMENT_POLICY_V212,standings,[],null,reads());
  expect(next.observationHash).toContain(':pf:');expect(next.action).toEqual(old.action);expect(a()).toBe(b());
  expect(next.observationHash.replace(TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V211)).toBe(old.observationHash);
 }
});
