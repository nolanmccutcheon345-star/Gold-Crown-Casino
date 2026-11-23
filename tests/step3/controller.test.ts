import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../../src/contracts';
import { legalActions, projectView } from '../../src/core/engine';
import * as policy from '../../src/bots/policy';
import { SessionController } from '../../src/session/controller';
import type { AppData, CashSettings, PersistencePort, PublicHistory } from '../../src/session/types';
import { rig } from '../verification/helpers';

/** Transactional reference store: copy-on-read/write and an independent CAS. */
class MemoryPort implements PersistencePort {
 data:AppData|null=null; commits:AppData[]=[]; failedProposal:AppData|null=null; attempts=0; failAt:number|null=null; lostAckAt:number|null=null;
 async load(){ return structuredClone(this.data); }
 async commit(expected:number|null,next:AppData){
  this.attempts++;
  if(this.failAt===this.attempts){this.failedProposal=structuredClone(next);this.failAt=null;throw new Error('TEST quota write failed');}
  if((this.data?.revision??null)!==expected)throw new Error('TEST stale revision conflict');
  this.data=structuredClone(next);this.commits.push(structuredClone(next));
  if(this.lostAckAt===this.attempts){this.lostAckAt=null;throw new Error('TEST commit acknowledgement lost');}
 }
 close(){}
}
const settings=(overrides:Partial<CashSettings>={}):CashSettings=>({seats:2,stake:'0',smallBlind:100,bigBlind:200,buyIn:30000,
 archetypes:['station','tag','nit','lag','station','tag','nit','lag','station'],rakeMode:'none',rakeBasisPoints:500,rakeCap:500,noFlopNoDrop:true,
 minBuyInBB:1,maxBuyInBB:1000,allowTopUp:true,...overrides});
const state=(c:SessionController)=>{expect(c.data?.active).not.toBeNull();return c.data!.active!.game;};
const heroStack=(c:SessionController)=>state(c).seats.find(s=>s.id===0)!.stack;
const pokerNet=(c:SessionController)=>c.data!.hands.reduce((sum,h)=>sum+h.net,0);
function auditMoney(c:SessionController){
 const data=c.data!;expect(new Set(data.ledger.map(e=>e.id)).size).toBe(data.ledger.length);
 expect(data.wallet).toBe(data.ledger.reduce((sum,e)=>sum+e.walletDelta,0));
 expect(data.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
 expect(data.ledger.reduce((sum,e)=>sum+e.pokerNet,0)).toBe(pokerNet(c));
 const game=data.active?.game;const hero=game?.seats.find(s=>s.id===0);
 const table=hero?hero.stack+(game!.street==='complete'?0:hero.totalCommitted):0;
 expect(data.ledger.reduce((sum,e)=>sum+e.tableDelta,0)).toBe(table);
 expect(data.wallet).toBeGreaterThanOrEqual(0);expect(table).toBeGreaterThanOrEqual(0);
}
async function open(port=new MemoryPort()){
 const controller=new SessionController(port);await controller.init();expect(controller.status).toBe('ready');return {controller,port};
}
async function act(c:SessionController,action:Action){const game=state(c);expect(game.actor).toBe(0);await c.act(action,game.handId,game.revision);expect(c.error).toBe('');}
async function step(c:SessionController){
 const game=state(c);if(game.street==='complete')return;
 if(game.actor===0)await act(c,legalActions(game).check?{type:'check'}:{type:'call'});
 else {await c.prepareBot();expect(c.error).toBe('');await c.commitBot(game.handId,game.revision);expect(c.error).toBe('');}
}
async function finish(c:SessionController){for(let i=0;state(c).street!=='complete'&&i<100;i++)await step(c);expect(state(c).street).toBe('complete');}
async function reopenRigged(port:MemoryPort){
 const candidate=structuredClone(port.data!);candidate.active!.game=rig(candidate.active!.game,[['2c','3d'],['As','Ah']],['4c','7d','9h','Js','Qc']);
 // This fixed-dollar ledger fixture uses the calls/checks test policy, not the new
 // depth/read action overlays. Their independent tests exercise the live layered path.
 delete candidate.active!.humanLayer;
 candidate.active!.frames=[projectView(candidate.active!.game,0)];port.data=candidate;
 const controller=new SessionController(port);await controller.init();expect(controller.status).toBe('ready');return controller;
}
function stable(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 const item=value as Record<string,unknown>;return '{'+Object.keys(item).filter(k=>item[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(item[k])).join(',')+'}';
}
function rehash(payload:PublicHistory):void{
 let previous='0'.repeat(64);
 for(const hand of payload.hands){hand.previousHash=previous;const body:Record<string,unknown>={...hand};delete body.hash;hand.hash=createHash('sha256').update(stable(body)).digest('hex');previous=hand.hash;}
}
let sampleCount=0;
beforeEach(()=>{
 sampleCount=0;const original=policy.chooseDecision;
 vi.spyOn(policy,'chooseDecision').mockImplementation((observation,profile,random)=>{
  sampleCount++;
  // Test policy calls/checks only; production observation hashing still executes.
  const decision={...original(observation,profile,random),action:observation.legal.check?{type:'check' as const}:{type:'call' as const}};return decision;
 });
});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();});

describe('Step 3 independent wallet and table conservation',()=>{
 it('creates a $10,000 virtual wallet once and restores it without a second initial credit',async()=>{
  const {controller:c,port}=await open();expect(c.data!.wallet).toBe(1000000);
  const snapshot=structuredClone(c.data);const restored=await open(port);expect(restored.controller.data!.wallet).toBe(1000000);
  expect(restored.controller.data!.ledger).toEqual(snapshot!.ledger);expect(restored.controller.data!.hands).toEqual([]);
 });
 it('C11: $1200, buy $300, lose $40, external +$1000, top up $40 yields wallet $1860/table $300/P&L -$40',async()=>{
  const {controller:initial,port}=await open();await initial.adjustBankroll(120000,'C11 baseline');await initial.startSession(settings({seatStacks:{0:30000,1:30000}}));
  const c=await reopenRigged(port);await act(c,{type:'raise',to:4000});await finish(c);
  expect(heroStack(c)).toBe(26000);expect(pokerNet(c)).toBe(-4000);
  const historical=structuredClone(c.data!.hands);await c.adjustBankroll(190000,'External +$1000');await c.topUp(4000);
  expect(c.error).toBe('');expect(c.data!.wallet).toBe(186000);expect(heroStack(c)).toBe(30000);expect(pokerNet(c)).toBe(-4000);
  auditMoney(c);expect(c.data!.wallet+heroStack(c)).toBe(216000);expect(c.data!.hands).toEqual(historical);
  expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);
 });
 it('wallet edit during open pot preserves every game field and never creates winnings; reset begins a retained-history epoch',async()=>{
  const {controller:c}=await open();await c.startSession(settings());const before=structuredClone(state(c));
  await c.adjustBankroll(456789,'Manual correction');expect(state(c)).toEqual(before);expect(pokerNet(c)).toBe(0);
  await act(c,{type:'fold'});const history=structuredClone(c.data!.hands);const epoch=c.data!.epoch;
  await c.adjustBankroll(50000,'New baseline',true);expect(c.data!.epoch).toBe(epoch+1);expect(c.data!.wallet).toBe(50000);expect(c.data!.hands).toEqual(history);
  expect(c.data!.ledger.at(-1)).toMatchObject({kind:'reset',pokerNet:0});expect(pokerNet(c)).toBe(-100);
  expect(c.data!.sessions[0].epoch).toBe(epoch);expect(c.data!.hands[0].epoch).toBe(epoch); // Session cohort stays frozen; wallet epoch advances.
 });
 it('deduplicates concurrent buy-ins/top-ups/cashouts and permits later intentional top-ups',async()=>{
  const {controller:c}=await open();await Promise.all([c.startSession(settings()),c.startSession(settings())]);
  expect(c.data!.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(1);expect(c.data!.wallet).toBe(970000);
  await act(c,{type:'fold'});await Promise.all([c.topUp(100),c.topUp(100)]);
  expect(c.data!.ledger.filter(e=>e.kind==='top-up')).toHaveLength(1);expect(heroStack(c)).toBe(30000);
  await c.topUp(100);expect(heroStack(c)).toBe(30100);expect(c.data!.wallet).toBe(969800);
  await Promise.all([c.cashOut(),c.cashOut()]);await c.cashOut();expect(c.data!.wallet).toBe(999900);expect(c.data!.active).toBeNull();
  auditMoney(c);expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);expect(new Set(c.data!.ledger.map(e=>e.id)).size).toBe(c.data!.ledger.length);
 });
 it('rejects unaffordable/negative buys and active-hand top-ups/cashout without financial mutation',async()=>{
  const {controller:c}=await open();await c.adjustBankroll(100,'small baseline');const before=structuredClone(c.data);
  await c.startSession(settings());expect(c.data!.wallet).toBe(before!.wallet);expect(c.data!.active).toBeNull();expect(c.error).not.toBe('');
  await c.adjustBankroll(100000,'fund table');await c.startSession(settings());const active=structuredClone(c.data);
  await c.topUp(100);expect(c.data!.wallet).toBe(active!.wallet);expect(state(c)).toEqual(active!.active!.game);
  await c.cashOut();expect(c.data!.wallet).toBe(active!.wallet);expect(state(c)).toEqual(active!.active!.game);
 });
 it('respects a frozen top-up permission and maximum stack',async()=>{
  const {controller:c}=await open();await c.startSession(settings({allowTopUp:false}));await act(c,{type:'fold'});
  const before=structuredClone(c.data);await c.topUp(100);expect(c.data!.wallet).toBe(before!.wallet);expect(state(c)).toEqual(before!.active!.game);
  await c.cashOut();await c.startSession(settings({maxBuyInBB:150}));await act(c,{type:'fold'});const beforeCap=structuredClone(c.data);
  await c.topUp(101);expect(c.data!.wallet).toBe(beforeCap!.wallet);expect(state(c)).toEqual(beforeCap!.active!.game);
 });
 it('new session preserves earlier history, completed-session accounting and wallet without a baseline reset',async()=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const first=structuredClone(c.data!.hands[0]);
  await c.cashOut();const epoch=c.data!.epoch;await c.startSession(settings({stake:'2',smallBlind:200,bigBlind:500,buyIn:50000}));
  expect(c.data!.sessions).toHaveLength(2);expect(c.data!.sessions[0].endedAt).not.toBeNull();expect(c.data!.hands[0]).toEqual(first);
  expect(c.data!.epoch).toBe(epoch);expect(c.data!.wallet).toBe(949900);expect(pokerNet(c)).toBe(-100);auditMoney(c);
 });
 it('tracks actual active time while excluding explicit pause and time spent with the browser closed',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-31T20:00:00.000Z'));
  const {controller:c,port}=await open();await c.startSession(settings());vi.setSystemTime(new Date('2026-10-31T20:00:05.000Z'));await c.setPaused(true);
  expect(c.data!.sessions[0].activeMs).toBe(5000);vi.setSystemTime(new Date('2026-10-31T20:01:05.000Z'));await c.setPaused(false);
  expect(c.data!.sessions[0].activeMs).toBe(5000);vi.setSystemTime(new Date('2026-10-31T20:01:10.000Z'));await c.tick();expect(c.data!.sessions[0].activeMs).toBe(10000);
  vi.setSystemTime(new Date('2026-11-01T20:01:10.000Z'));const restored=(await open(port)).controller;await restored.tick();expect(restored.data!.sessions[0].activeMs).toBe(10000);
 });
 it('rake-on settlement reconciles table+house and remains one immutable hand after top-up and cashout',async()=>{
  const {controller:initial,port}=await open();await initial.startSession(settings({rakeMode:'custom',seatStacks:{0:30000,1:30000}}));const c=await reopenRigged(port);await finish(c);
  const done=structuredClone(state(c));expect(done.rake).toBe(20);expect(done.seats.reduce((sum,s)=>sum+s.stack,0)+done.rake).toBe(60000);
  expect(c.data!.hands[0].view.rake).toBe(20);const history=structuredClone(c.data!.hands);
  await c.topUp(200);await c.cashOut();expect(c.data!.wallet).toBe(999800);expect(pokerNet(c)).toBe(-200);expect(c.data!.hands).toEqual(history);
 });
});

describe('Step 3 crash-safe commit and exact resume',()=>{
 it.each(['preflop','flop','turn','river'] as const)('restores exact committed %s state, deck cursor, private cards and frozen policies',async street=>{
  const {controller:c,port}=await open();await c.startSession(settings());for(let i=0;state(c).street!==street&&i<100;i++)await step(c);
  expect(state(c).street).toBe(street);auditMoney(c);const before=structuredClone(c.data!.active);const wallet=c.data!.wallet;
  const restored=(await open(port)).controller;expect(restored.data!.active!.game).toEqual(before!.game);
  expect(restored.data!.active!.profiles).toEqual(before!.profiles);expect(restored.data!.active!.frames).toEqual(before!.frames);expect(restored.data!.wallet).toBe(wallet);
 });
 it('persists a random reservation before sampled bot action and restores the same pending action without reroll',async()=>{
  const {controller:c,port}=await open();await c.startSession(settings());await act(c,{type:'call'});expect(state(c).actor).toBe(1);
  const offset=port.commits.length;await c.prepareBot();const prepared=structuredClone(c.data!.active!.pending);expect(prepared?.decision).toBeTruthy();
  expect(port.commits[offset].active!.pending).toMatchObject({decision:null,decisionId:prepared!.decisionId,drawToken:prepared!.drawToken});
  const samples=sampleCount;const restored=(await open(port)).controller;await restored.prepareBot();expect(restored.data!.active!.pending).toEqual(prepared);expect(sampleCount).toBe(samples);
  const game=state(restored);await restored.commitBot(game.handId,game.revision);await restored.commitBot(game.handId,game.revision);
  expect(state(restored).events.filter(e=>e.decisionId===prepared!.decisionId)).toHaveLength(1);expect(restored.data!.wallet).toBe(970000);
 });
 it('failed pending-decision write retains reservation and retry commits the original sampled action',async()=>{
  const {controller:c,port}=await open();await c.startSession(settings());await act(c,{type:'call'});
  port.failAt=port.attempts+2;await c.prepareBot();expect(c.status).toBe('error');const reserved=structuredClone(port.data!.active!.pending);expect(reserved?.decision).toBeNull();
  const samples=sampleCount;await c.retry();expect(c.status).toBe('ready');await c.prepareBot();expect(sampleCount).toBe(samples);
  expect(c.data!.active!.pending!.drawToken).toBe(reserved!.drawToken);expect(c.data!.active!.pending!.decision).toBeTruthy();
 });
 it('crash after durable reservation reconstructs the same sampled action from its original token',async()=>{
  const {controller:c,port}=await open();await c.startSession(settings());await act(c,{type:'call'});
  port.failAt=port.attempts+2;await c.prepareBot();expect(c.status).toBe('error');
  // Compare the complete proposed persistence boundary, including all current
  // depth/read/habit overlays and the observation hash, not the inner base policy.
  const attempted=structuredClone(port.failedProposal?.active?.pending?.decision);expect(attempted).toBeTruthy();
  const reservation=structuredClone(port.data!.active!.pending);expect(reservation?.decision).toBeNull();
  const restored=(await open(port)).controller;await restored.prepareBot();expect(restored.error).toBe('');
  expect(restored.data!.active!.pending!.drawToken).toBe(reservation!.drawToken);expect(restored.data!.active!.pending!.decision).toEqual(attempted);
  const game=state(restored);await restored.commitBot(game.handId,game.revision);expect(state(restored).events.filter(e=>e.decisionId===reservation!.decisionId)).toHaveLength(1);
 });
 it('failed write before payout exposes no speculative payout; retry and fresh load settle exactly once',async()=>{
  const {controller:c,port}=await open();await c.startSession(settings());const before=structuredClone(c.data);port.failAt=port.attempts+1;
  await actIgnoringFailure(c,{type:'fold'});expect(c.status).toBe('error');expect(c.data).toEqual(before);expect(port.data).toEqual(before);
  await c.retry();expect(c.status).toBe('ready');expect(c.data!.hands).toHaveLength(1);expect(pokerNet(c)).toBe(-100);
  const restored=(await open(port)).controller;expect(restored.data!.hands).toHaveLength(1);expect(restored.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);
  const snapshot=structuredClone(restored.data);await restored.act({type:'fold'},before!.active!.game.handId,before!.active!.game.revision);expect(restored.data).toEqual(snapshot);
 });
 it('lost commit acknowledgement reconciles the stored payout instead of paying it again',async()=>{
  const {controller:c,port}=await open();await c.startSession(settings());port.lostAckAt=port.attempts+1;await actIgnoringFailure(c,{type:'fold'});
  expect(port.data!.hands).toHaveLength(1);await c.retry();expect(c.status).toBe('ready');expect(c.data!.hands).toHaveLength(1);
  expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);expect(pokerNet(c)).toBe(-100);
 });
 it('stale simultaneous writer cannot replace committed bankroll or hand state',async()=>{
  const {controller:a,port}=await open();const b=(await open(port)).controller;await a.adjustBankroll(123456,'writer A');
  await b.adjustBankroll(777777,'stale B');expect(port.data!.wallet).toBe(123456);expect(b.status).not.toBe('ready');
  await b.retry();expect(b.data!.wallet).toBe(123456);expect(port.data!.ledger.filter(e=>e.note==='stale B')).toHaveLength(0);
 });
 it('a back-forward-cache page restore reopens persistence instead of leaving a permanently closed writer',async()=>{
  const reload=vi.fn();const fakeWindow=Object.assign(new EventTarget(),{location:{reload}});
  const fakeDocument=Object.assign(new EventTarget(),{visibilityState:'visible'});
  vi.stubGlobal('window',fakeWindow);vi.stubGlobal('document',fakeDocument);
  const {controller:c}=await open();
  fakeWindow.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));
  fakeWindow.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));
  expect(reload).toHaveBeenCalledTimes(1);c.close();
 });
 it('old pending bot callback after advancement cannot mutate current street or a later session',async()=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'call'});const old=structuredClone(state(c));
  await c.prepareBot();await c.commitBot(old.handId,old.revision);const current=structuredClone(c.data);await c.commitBot(old.handId,old.revision);expect(c.data).toEqual(current);
  await finish(c);await c.cashOut();await c.startSession(settings());const later=structuredClone(c.data);await c.commitBot(old.handId,old.revision);expect(c.data).toEqual(later);
 });
});
async function actIgnoringFailure(c:SessionController,action:Action){const game=state(c);await c.act(action,game.handId,game.revision);}

describe('Step 3 immutable public replay and import boundary',()=>{
 it('exports only permitted cards and public frames, strips private profiles, and preserves completed history',async()=>{
  const {controller:c}=await open();await c.startSession(settings());const activeExport=await c.exportHistory();expect(activeExport.hands).toHaveLength(0);
  await act(c,{type:'fold'});const saved=structuredClone(c.data!.hands);const exported=await c.exportHistory();expect(exported.hands).toHaveLength(1);
  const text=JSON.stringify(exported);for(const key of ['privateProfiles','drawToken','deckCursor','"deck"','"burned"','observationHash','aggression','looseness'])expect(text).not.toContain(key);
  for(const frame of exported.hands[0].frames)expect(frame.seats.find(s=>s.id===1)!.hole).toEqual([]);
  expect(exported.hands[0].view).toEqual(saved[0].view);await c.cashOut();await c.startSession(settings({archetypes:['maniac']}));expect(c.data!.hands).toEqual(saved);
 });
 it('round-trip public import is study-only and cannot credit wallets, winnings or live sessions',async()=>{
  const {controller:source}=await open();await source.startSession(settings());await act(source,{type:'fold'});const payload=await source.exportHistory();
  const {controller:target}=await open();const wallet=target.data!.wallet;await target.importHistory(JSON.stringify(payload));expect(target.error).toBe('');
  expect(target.data!.importedHands).toHaveLength(1);expect(target.data!.wallet).toBe(wallet);expect(target.data!.hands).toEqual([]);expect(target.data!.active).toBeNull();
  await target.importHistory(JSON.stringify(payload));expect(target.data!.importedHands).toHaveLength(1);expect(pokerNet(target)).toBe(0);
 });
 it('rejects corrupted hashes, malformed fields and injected private records without changing stored data',async()=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const payload=await c.exportHistory();
  const variants=[{...payload,version:'999'},JSON.parse(JSON.stringify(payload)),{...payload,hands:[{...payload.hands[0],privateProfiles:{1:{archetype:'nit'}}}]}];
  variants[1].hands[0].net=900000;
  for(const bad of variants){const before=structuredClone(c.data);await c.importHistory(JSON.stringify(bad));expect(c.error).not.toBe('');expect(c.data).toEqual(before);}
 });
 it('rejects rehashed public replay that marks an early frame complete to reveal opponent cards',async()=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const payload=await c.exportHistory();
  payload.hands[0].frames[0].street='complete';payload.hands[0].frames[0].seats.find(s=>s.id===1)!.hole=['As','Ah'];rehash(payload);
  const before=structuredClone(c.data);await c.importHistory(JSON.stringify(payload));expect(c.error).not.toBe('');expect(c.data).toEqual(before);
 });
 it('rejects rehashed balanced public record with an impossible negative raise-to action',async()=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const payload=await c.exportHistory();
  const item=payload.hands[0];item.view.events.find(e=>e.type==='action')!.action={type:'raise',to:-100};
  for(const frame of item.frames){const action=frame.events.find(e=>e.type==='action');if(action)action.action={type:'raise',to:-100};}
  rehash(payload);const before=structuredClone(c.data);await c.importHistory(JSON.stringify(payload));expect(c.error).not.toBe('');expect(c.data).toEqual(before);
 });
 it.each([
  {name:'empty session identity',change:(payload:PublicHistory)=>{payload.hands[0].sessionId='';}},
  {name:'negative hand number',change:(payload:PublicHistory)=>{payload.hands[0].number=-1;}},
  {name:'malformed start timestamp',change:(payload:PublicHistory)=>{payload.hands[0].startedAt='not-a-date';}},
  {name:'end timestamp before start',change:(payload:PublicHistory)=>{payload.hands[0].startedAt='2026-10-31T20:00:00.000Z';payload.hands[0].endedAt='2026-10-30T20:00:00.000Z';}},
 ])('rejects rehashed $name metadata without changing saved data',async({change})=>{
  const {controller:c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const payload=await c.exportHistory();change(payload);rehash(payload);
  const before=structuredClone(c.data);await c.importHistory(JSON.stringify(payload));expect(c.error).not.toBe('');expect(c.data).toEqual(before);
 });
 it('rejects oversized or non-JSON input without losing saved history',async()=>{
  const {controller:c}=await open();const before=structuredClone(c.data);await c.importHistory('{broken');expect(c.error).not.toBe('');expect(c.data).toEqual(before);
  await c.importHistory(' '.repeat(12*1024*1024));expect(c.error).not.toBe('');expect(c.data).toEqual(before);
 });
});
