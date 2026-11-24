import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import type {RuleProfile,BotObservation} from '../../src/contracts';
import {applyCommand,observeBot,legalActions} from '../../src/core/engine';
import {seededHand,act} from '../verification/helpers';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {emptyPlayerRead} from '../../src/bots/table-reads';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V29,TOURNAMENT_POLICY_V210} from '../../src/tournament/bot-policy';
const rules:RuleProfile={id:'independent55',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
function reads(){const r=emptyPlayerRead();r.hands=48;r.vpip={count:32,chances:48};r.pfr={count:25,chances:48};r.limp={count:7,chances:48};r.reads.hands=48;r.reads.foldToCbet={count:14,chances:24};return {0:r};}
const standings={playersLeft:18,paid:3,stacks:Array(18).fill(10000)};
function flop():BotObservation {let g=seededHand(Array(6).fill(20000),5511,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return observeBot(g,g.actor!,regularProfile('hiro','high').policyVersion,'postflop55');}
function baselineDigest(){const rows:unknown[]=[];const streets:Record<string,number>={};
 for(const id of ['hiro','tess','big-earl'])for(const seed of [11,22])for(const depth of [2000,20000]){
  const p=regularProfile(id,'mid');let g=seededHand([depth,depth*2,depth,depth*3,depth,depth],seed,rules);
  for(let n=0;g.street!=='complete'&&n<200;n++){
   const o=observeBot(g,g.actor!,p.policyVersion,`golden55:${id}:${seed}:${depth}:${n}`),rng=seedStream(seed*100+n),d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V29,standings,[{deltaBB:-18,showdownLoss:true,share:-.3}],null,reads());
   rows.push([d,rng()]);streets[o.street]=(streets[o.street]??0)+1;g=applyCommand(g,d);
  }expect(g.street).toBe('complete');
 }
 const o=flop();for(const id of ['hiro','tess','big-earl'])for(let n=0;n<30;n++){const p=regularProfile(id,'mid'),rng=seedStream(n);const d=chooseTournamentDecision(o,p,rng,TOURNAMENT_POLICY_V29,standings,[],null,reads());rows.push([d,rng()]);}
 return {digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),decisions:rows.length,streets};
}

it('preserves literal V55 2.9 decisions, numeric hashes and next RNG draws',()=>{
 // Independently captured from unmodified b46f6ae7a44354a5afc9845c2ee10213d59b3e1f.
 expect(baselineDigest()).toEqual({digest:'d8257196dfff5f2b31491571d46c755f3ab6d9afe4178e293c3529a29d33174d',decisions:186,streets:{preflop:84,flop:4,turn:4,river:4}});
});
it('fingerprints full numeric image evidence but ignores unrelated private properties',()=>{
 const p=regularProfile('hiro','high'),o=flop(),a={0:{bluff:.05,monster:.01}},b={0:{bluff:.06,monster:.01}};
 const choose=(images:typeof a,version=TOURNAMENT_POLICY_V210)=>chooseTournamentDecision(o,p,seedStream(17),version,standings,[],null,reads(),images);
 const first=choose(a),second=choose(b);expect(first.action).toEqual(second.action);expect(first.observationHash).not.toBe(second.observationHash);
 const digest=createHash('sha256').update('[[0,0.05,0.01]]').digest('hex');expect(first.observationHash).toContain(`:image:${digest}`);
 Object.defineProperty(a[0],'privateCards',{enumerable:true,get(){throw Error('Hidden data read');}});expect(choose(a)).toEqual(first);
 expect(choose(a,TOURNAMENT_POLICY_V29)).toEqual(choose(b,TOURNAMENT_POLICY_V29));
});

import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
it.each([['home-50',9],['daily-125',27]] as const)('new policy prepared %s decision survives reload and full audit',async(preset,entrants)=>{
 const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();await c.startEvent(preset,entrants,'fast');
 expect(c.error).toBe('');expect(c.data!.active!.tournamentPolicyVersion).toBe('synthetic-tournament-2.23.0');
 for(let i=0;c.data!.active!.game.actor===0&&i<10;i++){const e=c.data!.active!;await c.act(legalActions(e.game).check?{type:'check'}:{type:'fold'},e.game.handId,e.game.revision);}
 await c.prepareBot();expect(c.error).toBe('');const pending=structuredClone(c.data!.active!.pending);expect(pending?.decision?.observationHash).toContain(':image:');expect(()=>auditTournamentData(c.data!)).not.toThrow();c.close();
 const loaded=new TournamentController(port);await loaded.init();expect(loaded.error).toBe('');expect(loaded.data!.active!.pending).toEqual(pending);await loaded.prepareBot();expect(loaded.data!.active!.pending).toEqual(pending);
 const e=loaded.data!.active!;await loaded.commitBot(e.game.handId,e.game.revision);expect(loaded.error).toBe('');expect(()=>auditTournamentData(loaded.data!)).not.toThrow();loaded.close();
});
