import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import type {RuleProfile,BotObservation} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seededHand,act} from '../verification/helpers';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V214,TOURNAMENT_POLICY_V215,NEW_EVENT_TOURNAMENT_POLICY,supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages,policyUsesGrudges} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'independent55',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
function reads(){const r=emptyPlayerRead();r.hands=48;r.vpip={count:32,chances:48};r.pfr={count:25,chances:48};r.limp={count:7,chances:48};r.reads.hands=48;r.reads.foldToCbet={count:14,chances:24};return {0:r};}
const standings={playersLeft:18,paid:3,stacks:Array(18).fill(10000)};
function flop():BotObservation {let g=seededHand(Array(6).fill(20000),5511,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return observeBot(g,g.actor!,regularProfile('hiro','high').policyVersion,'postflop55');}
function baselineDigest(){const rows:unknown[]=[];const streets:Record<string,number>={};
 for(const id of ['hiro','tess','big-earl'])for(const seed of [11,22])for(const depth of [2000,20000]){
  const p=regularProfile(id,'mid');let g=seededHand([depth,depth*2,depth,depth*3,depth,depth],seed,rules);
  for(let n=0;g.street!=='complete'&&n<200;n++){
   const o=observeBot(g,g.actor!,p.policyVersion,`golden55:${id}:${seed}:${depth}:${n}`),rng=seedStream(seed*100+n),d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V214,standings,[{deltaBB:-18,showdownLoss:true,share:-.3}],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}},{grudges:{['p'+o.actingSeat]:{p0:.8,p1:.6,p2:.01}},identityOf:seat=>'p'+seat});
   rows.push([d,rng()]);streets[o.street]=(streets[o.street]??0)+1;g=applyCommand(g,d);
  }expect(g.street).toBe('complete');
 }
 const o=flop();for(const id of ['hiro','tess','big-earl'])for(let n=0;n<30;n++){const p=regularProfile(id,'mid'),rng=seedStream(n);const d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V214,standings,[],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}},{grudges:{['p'+o.actingSeat]:{p0:.8,p1:.6,p2:.01}},identityOf:seat=>'p'+seat});rows.push([d,rng()]);}
 return {digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),decisions:rows.length,streets};
}

it('preserves190 captured Version60 2.14 decisions, hashes and next RNG draws',()=>{expect(baselineDigest()).toEqual({digest:'4020ec1990fb988a07342cdef29e3798bc0a6823ee1da69c57668339e09ad270',decisions:190,streets:{preflop:85,flop:5,turn:5,river:5}});});
it('enables the complete prior public context only under the explicit new policy version',()=>{
 expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
 for(const capability of [supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages,policyUsesGrudges])expect(capability(TOURNAMENT_POLICY_V215)).toBe(true);
 expect(supportedTournamentPolicy('synthetic-tournament-2.99.0')).toBe(false);
});
it('new policy binds numeric image/grudge/standings evidence without serializing private fields',()=>{
 const o=flop(),p=regularProfile('hiro','high'),holder='p'+o.actingSeat,identityOf=(seat:number)=>'p'+seat;
 const images={0:{bluff:.01,monster:.02}},grudges={[holder]:{p0:.01}},context={...standings,stacks:Array(18).fill(20000)};
 const choose=()=>chooseTournamentDecision(o,p,seedStream(17),TOURNAMENT_POLICY_V215,context,[],null,reads(),images,{grudges,identityOf});
 const first=choose();expect(first.observationHash).toContain(':stage-profile:');expect(first.observationHash).toContain(':showdown:');
 images[0].bluff=.02;expect(choose().observationHash).not.toBe(first.observationHash);images[0].bluff=.01;
 grudges[holder].p0=.02;expect(choose().observationHash).not.toBe(first.observationHash);grudges[holder].p0=.01;
 context.stacks[0]++;expect(choose().observationHash).not.toBe(first.observationHash);context.stacks[0]--;
 for(const target of [images,images[0],grudges,grudges[holder]])Object.defineProperty(target,'privateCards',{enumerable:true,get(){throw Error('Private field read');}});
 expect(choose()).toEqual(first);
});
