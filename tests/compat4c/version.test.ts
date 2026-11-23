import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chooseDecision,policyDistribution,DecisionCache,supportedPolicy,POLICY_VERSION,VERSION_TWO_POLICY_VERSION} from '../../src/bots/policy';
import * as v1 from '../../src/bots/v2/policy';
import {seedStream} from '../../src/bots/v2/profiles';
import {scenarios} from '../step4a/scenarios';
import {observeBot,legalActions,assertAccounting} from '../../src/core/engine';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {withPublicContext} from '../../src/session/bot-observation';
import {canonical,validateData} from '../../src/storage/integrity';
import type {AppData,PersistencePort} from '../../src/session/types';
class Port implements PersistencePort {
 value:AppData|null=null;fail=false;
 async load(){return structuredClone(this.value);}
 async commit(expected:number|null,next:AppData){if(this.fail)throw Error('Interrupted write');if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}
 close(){}
}
function storedRandom(seed:number){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
async function finish(c:SessionController){for(let n=0;n<400&&c.data!.active!.game.street!=='complete';n++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}
describe('Step4C preserves Version 6 policy and active sessions',()=>{
 it('freezes each 1.1 source byte-for-byte except relative imports against the published source commit',()=>{
  for(const name of ['policy','profiles','strategy','features','memory','boundary','preflop','ranges','range-contract']){
   const original=execFileSync('git',['show',`92072fb46e48f6acbc321d91348bf9b0aac196c0:src/bots/${name}.ts`],{encoding:'utf8'});
   const frozen=readFileSync(`src/bots/v2/${name}.ts`,'utf8').replaceAll("'../../contracts'","'../contracts'").replaceAll("'../../core/evaluator'","'../core/evaluator'").replaceAll("'../legacy-v0'","'./legacy-v0'").replaceAll("'../v1/","'./v1/");
   expect(frozen).toBe(original);
  }
 });
 it('routes every old scenario/profile to exact old probabilities, entropy consumption, hash and sampled action',()=>{
  expect(VERSION_TWO_POLICY_VERSION).toBe('synthetic-cash-1.1.0');expect(POLICY_VERSION).toBe('synthetic-cash-1.6.0');expect(supportedPolicy(VERSION_TWO_POLICY_VERSION)).toBe(true);
  for(const fixture of scenarios())for(const archetype of v1.ARCHETYPES){
   const p=v1.defaultProfile(archetype),o=observeBot(fixture.state,fixture.state.actor!,p.policyVersion,`compat:${fixture.id}`);
   expect(policyDistribution(o,p)).toEqual(v1.policyDistribution(o,p));
   for(let seed=0;seed<3;seed++){const rng=seedStream(seed),reference=seedStream(seed);expect(chooseDecision(o,p,rng)).toEqual(v1.chooseDecision(o,p,reference));expect(rng()).toBe(reference());}
   const cache=new DecisionCache(seedStream(17));expect(cache.getOrCreate(o,p)).toEqual(v1.chooseDecision(o,p,seedStream(17)));expect(cache.getOrCreate(o,p)).toEqual(cache.getOrCreate(o,p));
  }
 });
 it('restores an unsampled 1.1 reservation, retries a failed commit, settles once, preserves history and opens a current-policy session',async()=>{
  const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2,opponents:[{selection:'tag',personalitySeed:678}]});
  // Test-only populated prior-version save: configuration provenance was not recorded in that version.
  delete port.value!.active!.configuration;delete port.value!.sessions[0].configurationHistory;
  port.value!.active!.profiles[1]=v1.createProfile({selection:'tag'},678,'low');
  const restored=new SessionController(port);await restored.init();let g=restored.data!.active!.game;await restored.act({type:'call'},g.handId,g.revision);g=restored.data!.active!.game;
  await restored.prepareBot();const pending=structuredClone(restored.data!.active!.pending!);port.value!.active!.pending!.decision=null;
  const unsampled=new SessionController(port);await unsampled.init();const a=unsampled.data!.active!;
  const o=withPublicContext(observeBot(g,1,VERSION_TWO_POLICY_VERSION,pending.decisionId),g.profile.rake,a.profiles[1],unsampled.data!.hands,a.sessionId);
  const expected=v1.chooseDecision(o,a.profiles[1],storedRandom(pending.drawToken));await unsampled.prepareBot();expect(unsampled.data!.active!.pending!.decision).toEqual(expected);
  port.fail=true;await unsampled.commitBot(g.handId,g.revision);expect(unsampled.status).toBe('error');port.fail=false;
  const retry=new SessionController(port);await retry.init();await retry.commitBot(g.handId,g.revision);const once=canonical(retry.data!.active!.game);await retry.commitBot(g.handId,g.revision);expect(canonical(retry.data!.active!.game)).toBe(once);
  await finish(retry);assertAccounting(retry.data!.active!.game);await validateData(retry.data!);expect(retry.data!.hands).toHaveLength(1);expect(retry.data!.hands[0].privateProfiles[1].policyVersion).toBe(VERSION_TWO_POLICY_VERSION);
  await retry.cashOut();const ledger=canonical(retry.data!.ledger),history=canonical(retry.data!.hands);await retry.cashOut();expect(canonical(retry.data!.ledger)).toBe(ledger);
  await retry.startSession({...DEFAULT_SETTINGS,seats:2});expect(retry.data!.active!.profiles[1].policyVersion).toBe(POLICY_VERSION);expect(canonical(retry.data!.hands)).toBe(history);await validateData(retry.data!);
 });
});
