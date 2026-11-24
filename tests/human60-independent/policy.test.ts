import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import type {RuleProfile,BotObservation} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seededHand,act} from '../verification/helpers';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V212,TOURNAMENT_POLICY_V213,NEW_EVENT_TOURNAMENT_POLICY,supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages,policyUsesGrudges} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'independent55',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
function reads(){const r=emptyPlayerRead();r.hands=48;r.vpip={count:32,chances:48};r.pfr={count:25,chances:48};r.limp={count:7,chances:48};r.reads.hands=48;r.reads.foldToCbet={count:14,chances:24};return {0:r};}
const standings={playersLeft:18,paid:3,stacks:Array(18).fill(10000)};
function flop():BotObservation {let g=seededHand(Array(6).fill(20000),5511,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return observeBot(g,g.actor!,regularProfile('hiro','high').policyVersion,'postflop55');}
function baselineDigest(){const rows:unknown[]=[];const streets:Record<string,number>={};
 for(const id of ['hiro','tess','big-earl'])for(const seed of [11,22])for(const depth of [2000,20000]){
  const p=regularProfile(id,'mid');let g=seededHand([depth,depth*2,depth,depth*3,depth,depth],seed,rules);
  for(let n=0;g.street!=='complete'&&n<200;n++){
   const o=observeBot(g,g.actor!,p.policyVersion,`golden55:${id}:${seed}:${depth}:${n}`),rng=seedStream(seed*100+n),d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V212,standings,[{deltaBB:-18,showdownLoss:true,share:-.3}],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}});
   rows.push([d,rng()]);streets[o.street]=(streets[o.street]??0)+1;g=applyCommand(g,d);
  }expect(g.street).toBe('complete');
 }
 const o=flop();for(const id of ['hiro','tess','big-earl'])for(let n=0;n<30;n++){const p=regularProfile(id,'mid'),rng=seedStream(n);const d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V212,standings,[],null,reads(),{0:{bluff:.4,monster:.1},2:{bluff:.1,monster:.8}});rows.push([d,rng()]);}
 return {digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),decisions:rows.length,streets};
}

it('preserves 188 literal Version58 2.12 decisions, public hashes and subsequent RNG draws',()=>{
 // Captured from original Version58 commit384ce64b2f753ef23c9649c9dfd44dd6f58efadb.
 expect(baselineDigest()).toEqual({digest:'787f859b4d8f0acabdf1c5f96f91cbef8ae19d486087fd742c87cd04bc8a9f8c',decisions:188,streets:{preflop:83,flop:5,turn:5,river:5}});
});
it('enables all prior public context and explicit rivalry only for the new policy',()=>{
 expect(NEW_EVENT_TOURNAMENT_POLICY).toBe('synthetic-tournament-2.23.0');
 for(const capability of [supportedTournamentPolicy,policyUsesMood,policyUsesReads,policyUsesStandings,policyUsesIcm,policyUsesTableReads,policyUsesImages,policyUsesGrudges])expect(capability(TOURNAMENT_POLICY_V213)).toBe(true);
 expect(policyUsesGrudges(TOURNAMENT_POLICY_V212)).toBe(false);expect(supportedTournamentPolicy('synthetic-tournament-2.99.0')).toBe(false);
});
it('binds numeric sub-threshold rivalry and identity mapping while never serializing private fields',()=>{
 const o=flop(),p=regularProfile('hiro','high'),holder='p'+o.actingSeat;
 const a={[holder]:{p0:.01}},b={[holder]:{p0:.02}},identityOf=(seat:number)=>'p'+seat;
 const choose=(g:typeof a,identity=identityOf)=>chooseTournamentDecision(o,p,seedStream(17),TOURNAMENT_POLICY_V213,standings,[],null,reads(),null,{grudges:g,identityOf:identity});
 const first=choose(a);expect(first.observationHash).toContain(':grudge:');expect(first.observationHash).not.toBe(choose(b).observationHash);
 expect(first.observationHash).not.toBe(choose(a,seat=>'changed'+seat).observationHash);
 Object.defineProperty(a,'privateCards',{enumerable:true,get(){throw Error('Private field read');}});Object.defineProperty(a[holder],'privateCards',{enumerable:true,get(){throw Error('Private field read');}});
 expect(choose(a)).toEqual(first);
});

import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
for(const count of [9,27])it(`preserves new ${count}-player prepared decisions across reload and audit`,async()=>{
 const port=new MemoryTournamentPersistence();let c=new TournamentController(port);await c.init();await c.startEvent(count===9?'home-20':'daily-125',count,'fast');
 expect(c.error).toBe('');expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
 for(let step=0;step<8;step++){
  const e=c.data!.active!;if(e.game.street==='complete'){await c.nextHand();continue;}
  if(e.game.actor===0){await c.act({type:c.gameView!.legal.check?'check':'fold'},e.game.handId,e.game.revision);continue;}
  await c.prepareBot();expect(c.error).toBe('');const pending=structuredClone(c.data!.active!.pending);expect(pending?.decision?.observationHash).toContain(':grudge:');
  c.close();c=new TournamentController(port);await c.init();expect(c.error).toBe('');expect(c.data!.active!.pending).toEqual(pending);
  expect(()=>auditTournamentData(c.data!)).not.toThrow();await c.commitBot(c.data!.active!.game.handId,c.data!.active!.game.revision);expect(c.error).toBe('');
 }
 c.close();
});
