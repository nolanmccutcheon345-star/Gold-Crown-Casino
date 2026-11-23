import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {RuleProfile} from '../../src/contracts';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {startHand,applyCommand,legalActions,projectView} from '../../src/core/engine';
import * as deck from '../../src/core/deck';
import * as policy from '../../src/bots/policy';
import {canonical,digest,validateData,migrateData,publicHistory,parsePublicHistory,seal,GENESIS} from '../../src/storage/integrity';
import {auditSnapshot} from '../../src/storage/verified';
import {prepareSegments,restoreSegments} from '../../src/storage/segments';
import {prepareFastCommit,restoreFastState,FAST_HEAD_KEY} from '../../src/storage/financial-checkpoint';
import {compactRecoveryHooks} from '../../src/storage/recovery-contracts';
import {packHandGraph,unpackHandGraph} from '../../src/storage/packed-hand';

class Port implements PersistencePort{value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(next);}close(){}}
const rules:RuleProfile={id:'compat54',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
afterEach(()=>vi.restoreAllMocks());
async function finish(c:SessionController){for(let guard=0;c.data!.active!.game.street!=='complete'&&guard<100;guard++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}
async function straddled(){
 const original=policy.chooseDecision;vi.spyOn(policy,'chooseDecision').mockImplementation((o,p,r)=>({...original(o,p,r),action:{type:o.legal.check?'check':'fold'}}));
 const port=new Port();let c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:4,liveStraddle:true,seatStacks:{0:20000,1:20000,2:20000,3:20000}});expect(c.error).toBe('');
 // Controlled check/fold actions isolate persistence from authored decision overlays.
 delete port.value!.active!.humanLayer;c.close();c=new SessionController(port);await c.init();await c.setHeroStraddle(true);await finish(c);await c.nextHand();expect(c.error).toBe('');
 expect(c.data!.active!.game.straddleSeat).toBe(0);expect(c.data!.active!.game.engineVersion).toBe('0.6.0');return {c,port};
}

describe('independent straddle persistence and frozen replay compatibility',()=>{
 it('keeps exact Version53 non-straddle states and public frames for a frozen deck and action trace',async()=>{
  vi.spyOn(deck,'secureDeck').mockImplementation(()=>deck.standardDeck());
  let g=startHand({handId:'fixed54',button:0,profile:rules,seats:[0,2,5,8].map(id=>({id,name:`P${id}`,stack:20000}))});const states=[g],frames=[projectView(g,0)];
  while(g.street!=='complete'){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`d:${g.revision}`,action:{type:legalActions(g).check?'check':'call'}});states.push(g);frames.push(projectView(g,0));}
  // Captured by executing exact source515a5670e11a4967010da67bc83f3e622b35824b; 17states/frames.
  expect(states).toHaveLength(17);expect(await digest(states)).toBe('34ead3240b9de5ee6c85591cb4db54d11031c14a237e80f5989b7c8471cbc883');expect(await digest(frames)).toBe('65dcbf1e2b7ecae1492d948150a00742c8dc86799c2d4c7192c618372d9e663d');
  expect(g.engineVersion).toBe('0.4.0');expect(frames.every(f=>f.engineVersion===undefined)).toBe(true);
 });
 it('still migrates the authentic populated0.3 save without rewriting its engine label or financial bytes',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')),old=fixture.streets.flop,before=canonical(old);
  const restored=await migrateData(old);expect(canonical(old)).toBe(before);expect(restored.active!.game.engineVersion).toBe('0.3.0');expect(restored.ledger).toEqual(old.ledger);expect(restored.hands).toEqual(old.hands);
 });
 it('preserves a prepared straddled hand exactly through controller, packed segments and compact recovery',async()=>{
  const setup=await straddled(),port=setup.port;let c=setup.c;
  await c.prepareBot();expect(c.error).toBe('');const saved=structuredClone(c.data!);expect(saved.active!.pending?.decision).toBeTruthy();
  c.close();c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(c.data).toEqual(saved);
  const prepared=await prepareSegments(saved,null,null,{packHands:true}),rows=new Map<string,unknown>([...prepared.writes,...prepared.replicas??[]].map(w=>[w.key,structuredClone(w.entry)]));
  const restored=await restoreSegments(structuredClone(prepared.envelope),async keys=>keys.map(k=>structuredClone(rows.get(k))));expect(restored).toEqual(saved);
  const fast=await prepareFastCommit(saved,prepared.envelope,null,compactRecoveryHooks);for(const w of fast.writes)rows.set(w.key,structuredClone(w.value));
  const compact=await restoreFastState(rows.get(FAST_HEAD_KEY),structuredClone(prepared.envelope),async keys=>keys.map(k=>structuredClone(rows.get(k))),compactRecoveryHooks);expect(compact.payload.data.active).toEqual(saved.active);expect(compact.payload.data.wallet).toBe(saved.wallet);c.close();
 });
 it('exports and imports straddled public history with capability intact and rejects resealed stripped markers',async()=>{
  const {c}=await straddled();await finish(c);const saved=c.data!,history=await publicHistory(saved.hands),straddle=history.hands.find(h=>h.view.straddleSeat===0)!;
  expect(straddle.view.engineVersion).toBe('0.6.0');expect(straddle.frames.every(f=>f.engineVersion==='0.6.0')).toBe(true);expect(await parsePublicHistory(JSON.stringify(history))).toEqual(history.hands);
  expect(unpackHandGraph(packHandGraph(saved.hands.at(-1)))).toEqual(saved.hands.at(-1));
  const forged=structuredClone(straddle);delete forged.view.engineVersion;for(const f of forged.frames)delete f.engineVersion;forged.previousHash=GENESIS;
  await expect(parsePublicHistory(JSON.stringify({...history,hands:[await seal(forged)]}))).rejects.toThrow(/engine version/);
  const before=saved.wallet;await c.importHistory(JSON.stringify(history));expect(c.error).toBe('');expect(c.data!.wallet).toBe(before);expect(c.data!.importedHands).toHaveLength(history.hands.length);c.close();
 });
 it('rejects mislabeled active and archived straddle capabilities even after valid hashes are recomputed',async()=>{
  const {c}=await straddled(),active=structuredClone(c.data!);active.active!.game.engineVersion='0.4.0';await expect(validateData(active)).rejects.toThrow(/engine version/);
  await finish(c);await c.cashOut();const out=structuredClone(c.data!);const last=out.hands.at(-1)!;delete last.view.engineVersion;for(const f of last.frames)delete f.engineVersion;out.hands[out.hands.length-1]=await seal(last);
  await expect(auditSnapshot(out)).rejects.toThrow(/engine version/);c.close();
 });
});
