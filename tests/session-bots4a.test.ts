import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AppData,PersistencePort} from '../src/session/types';
import {DEFAULT_SETTINGS,SessionController} from '../src/session/controller';
import {migrateData,canonical,publicHistory,parsePublicHistory,seal} from '../src/storage/integrity';
import {observeBot,legalActions} from '../src/core/engine';
import {POLICY_VERSION,defaultProfile} from '../src/bots/policy';
import {chooseDecision as legacyDecision} from '../src/bots/legacy-v0';
import fixture from './step36/fixtures/populated-v3.json';
class Port implements PersistencePort {
 value:AppData|null=null; fail=false; failDecision=false; failedProposal:AppData|null=null;
 async load(){return structuredClone(this.value);}
 async commit(expected:number|null,next:AppData){if(this.fail||(this.failDecision&&next.active?.pending?.decision)){this.failedProposal=structuredClone(next);throw Error('Test interrupted write');}if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}
 close(){}
}
function random(seed:number){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
async function opened(port=new Port()){const c=new SessionController(port);await c.init();expect(c.status).toBe('ready');return{c,port};}
async function finish(c:SessionController){for(let i=0;i<400&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();expect(c.error).toBe('');await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}
afterEach(()=>vi.restoreAllMocks());
describe('Step4A persisted opponent integration without changing money authority',()=>{
 it('resolves individual seeds once and retains identical profiles through UI copies, hands, reload and copied new-session settings',async()=>{
  const {c,port}=await opened();await c.startSession({...DEFAULT_SETTINGS,seats:3,population:'high',opponents:[{selection:'tag',skill:.2,personalitySeed:123},{selection:'tag',skill:.8,personalitySeed:456}]});
  expect(c.error).toBe('');const profiles=structuredClone(c.data!.active!.profiles),settings=structuredClone(c.data!.sessions[0].settings);
  expect(profiles[1].policyVersion).toBe(POLICY_VERSION);expect(profiles[1]).not.toEqual(profiles[2]);
  const restored=new SessionController(port);await restored.init();expect(restored.data!.active!.profiles).toEqual(profiles);
  await finish(restored);expect(restored.data!.hands[0].privateProfiles).toEqual(profiles);if(restored.data!.active!.game.seats.find(s=>s.id===0)!.stack===0)await restored.topUp(settings.buyIn);await restored.nextHand();expect(restored.data!.active!.profiles).toEqual(profiles);
  await finish(restored);await restored.cashOut();const history=canonical(restored.data!.hands),wallet=restored.data!.wallet;
  await restored.startSession(settings);expect(restored.data!.active!.profiles).toEqual(profiles);expect(canonical(restored.data!.hands)).toBe(history);expect(restored.data!.wallet).toBe(wallet-settings.buyIn);
 });
 it('old saved policy and unsampled reservation retain exactly the old decision after new release',async()=>{
  const port=new Port();port.value=await migrateData(fixture.streets.flop);const before=structuredClone(port.value);port.value.active!.pending!.decision=null;
  const {c}=await opened(port),a=c.data!.active!,pending=structuredClone(a.pending!);const profile=a.profiles[pending.seatId];
  const expected=legacyDecision(observeBot(a.game,pending.seatId,profile.policyVersion,pending.decisionId),profile,random(pending.drawToken));
  await c.prepareBot();expect(c.error).toBe('');expect(c.data!.active!.pending!.decision).toEqual(expected);expect(c.data!.active!.profiles).toEqual(before.active!.profiles);expect(c.data!.hands).toEqual(before.hands);expect(c.data!.ledger).toEqual(before.ledger);
 });
 it('new pending decision preserves personality and public-memory fingerprint after interrupted write and reload',async()=>{
  const {c,port}=await opened();await c.startSession({...DEFAULT_SETTINGS,seats:2,opponents:[{selection:'stronger-reg',personalitySeed:87}]});
  let g=c.data!.active!.game;await c.act({type:'call'},g.handId,g.revision);g=c.data!.active!.game;expect(g.actor).toBe(1);
  port.failDecision=true;await c.prepareBot();expect(c.status).toBe('error');
  // The persistence boundary includes every current human overlay, not just the
  // base policy. Recompute this complete failed proposal from its durable token.
  const pending=structuredClone(port.failedProposal!.active!.pending!),profiles=structuredClone(c.data!.active!.profiles),reservation=structuredClone(port.value!.active!.pending!);
  expect(pending.decision).toBeTruthy();expect(reservation).toEqual({...pending,decision:null});
  port.failDecision=false;const retried=new SessionController(port);await retried.init();await retried.prepareBot();expect(retried.error).toBe('');expect(retried.data!.active!.pending).toEqual(pending);
  expect(retried.data!.active!.profiles).toEqual(profiles);expect(retried.data!.active!.game).toEqual(g);
  port.fail=true;await retried.commitBot(g.handId,g.revision);expect(retried.status).toBe('error');expect(retried.data!.active!.pending).toEqual(pending);
  port.fail=false;const restored=new SessionController(port);await restored.init();await restored.prepareBot();expect(restored.data!.active!.pending).toEqual(pending);await restored.commitBot(g.handId,g.revision);const after=canonical(restored.data!.active!.game);await restored.commitBot(g.handId,g.revision);expect(canonical(restored.data!.active!.game)).toBe(after);expect(restored.data!.active!.profiles).toEqual(profiles);
 });
 it('rejects malformed persona seed before any buy-in',async()=>{const {c}=await opened();const wallet=c.data!.wallet;await c.startSession({...DEFAULT_SETTINGS,opponents:[{selection:'tag',personalitySeed:NaN}]});expect(c.error).toMatch(/personality/);expect(c.data!.wallet).toBe(wallet);expect(c.data!.sessions).toHaveLength(0);expect(c.data!.active).toBeNull();});
 it('public exports and reimports never expose or accept new private personality or memory data',async()=>{
  const d=await migrateData(fixture.streets.river);const history=await publicHistory(d.hands);expect(JSON.stringify(history)).not.toMatch(/personalitySeed|traits|privateProfiles|memoryRetention/);
  const bad=structuredClone(history);Object.assign(bad.hands[0],{traits:defaultProfile('tag').traits});bad.hands[0]=await seal(bad.hands[0]);
  await expect(parsePublicHistory(JSON.stringify(bad))).rejects.toThrow(/Private information/);
 });
});
