import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../../src/contracts';
import { legalActions, projectView } from '../../src/core/engine';
import * as policy from '../../src/bots/policy';
import { SessionController, DEFAULT_SETTINGS } from '../../src/session/controller';
import type { AppData, CashSettings, PersistencePort } from '../../src/session/types';
import { rig } from '../verification/helpers';

/** Independent copy-on-write/CAS transaction model, including lost acknowledgements. */
class Store implements PersistencePort {
 data:AppData|null=null; writes:AppData[]=[]; attempts=0; failAt:number|null=null; loseAckAt:number|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  this.attempts++;
  if(this.failAt===this.attempts){this.failAt=null;throw new Error('TEST storage quota failure');}
  if((this.data?.revision??null)!==expected)throw new Error('TEST revision changed');
  this.data=structuredClone(next);this.writes.push(structuredClone(next));
  if(this.loseAckAt===this.attempts){this.loseAckAt=null;throw new Error('TEST acknowledgement lost');}
 }
 close(){}
}
const settings=(overrides:Partial<CashSettings>={}):CashSettings=>({...structuredClone(DEFAULT_SETTINGS),seats:2,buyIn:20000,archetypes:['station'],...overrides});
async function open(store=new Store()) {const c=new SessionController(store);await c.init();expect(c.status).toBe('ready');return{c,store};}
const active=(c:SessionController)=>{expect(c.data?.active).toBeTruthy();return c.data!.active!;};
async function act(c:SessionController,action:Action){const g=active(c).game;await c.act(action,g.handId,g.revision);expect(c.error).toBe('');}
async function bot(c:SessionController){const g=active(c).game;expect(g.actor).not.toBe(0);await c.prepareBot();expect(c.error).toBe('');await c.commitBot(g.handId,g.revision);expect(c.error).toBe('');}
async function step(c:SessionController){const g=active(c).game;if(g.actor===0)await act(c,legalActions(g).check?{type:'check'}:{type:'call'});else await bot(c);}
async function playToCompletion(c:SessionController){for(let i=0;c.data!.active&&active(c).game.street!=='complete'&&i<100;i++)await step(c);expect(!c.data!.active||active(c).game.street==='complete').toBe(true);}
async function request(c:SessionController,mode:'finish'|'fold'){const a=active(c);await c.requestEndSession(mode,a.sessionId,a.game.handId);}
function audit(c:SessionController){
 const d=c.data!;expect(d.wallet).toBe(d.ledger.reduce((sum,e)=>sum+e.walletDelta,0));
 expect(new Set(d.ledger.map(e=>e.id)).size).toBe(d.ledger.length);
 const hero=d.active?.game.seats.find(s=>s.id===0),g=d.active?.game;
 const table=hero?hero.stack+(g!.street==='complete'?0:hero.totalCommitted):0;
 expect(d.ledger.reduce((sum,e)=>sum+e.tableDelta,0)).toBe(table);
 expect(d.ledger.reduce((sum,e)=>sum+e.pokerNet,0)).toBe(d.hands.reduce((sum,h)=>sum+h.net,0));
 expect(d.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
}
const productionChoose=policy.chooseDecision;
let samples=0;
beforeEach(()=>{
 samples=0;const original=productionChoose;
 vi.spyOn(policy,'chooseDecision').mockImplementation((obs,p,rng)=>{samples++;return{...original(obs,p,rng),action:obs.legal.check?{type:'check' as const}:{type:'call' as const}};});
});
afterEach(()=>vi.restoreAllMocks());

describe('independent end-session authority and conservation',()=>{
 it('fold-and-leave immediately applies a legal Hero fold and atomically settles/cashes out once',async()=>{
  const {c}=await open();await c.startSession(settings());const before=structuredClone(active(c).game);await request(c,'fold');
  expect(c.error).toBe('');expect(c.data!.active).toBeNull();expect(c.data!.wallet).toBe(999900);
  expect(c.data!.hands).toHaveLength(1);expect(c.data!.hands[0].view.events.filter(e=>e.type==='action'&&e.seatId===0)).toMatchObject([{action:{type:'fold'},amount:0}]);
  expect(c.data!.hands[0].net).toBe(-100);expect(c.data!.hands[0].view.handId).toBe(before.handId);
  expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);audit(c);
 });
 it('finish-hand preserves Hero choice and committed chips until ordinary complete settlement',async()=>{
  const opened=await open();await opened.c.startSession(settings());
  // This exit-authority fixture requires the mocked calls/checks policy to reach
  // showdown. Later human/depth overlays may legitimately fold random hole cards.
  delete opened.store.data!.active!.humanLayer;
  const {c}=await open(opened.store);const before=structuredClone(active(c).game);await request(c,'finish');
  expect(active(c).game).toEqual(before);expect(active(c).exitMode).toBe('finish');expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(0);
  await act(c,{type:'raise',to:600});await playToCompletion(c);expect(c.data!.active).toBeNull();expect(c.data!.hands).toHaveLength(1);
  expect(c.data!.hands[0].view.board).toHaveLength(5);expect(c.data!.hands[0].view.events.some(e=>e.type==='action'&&e.seatId===0&&e.action?.type==='raise')).toBe(true);
  expect(c.data!.wallet).toBe(1000000+c.data!.hands[0].net);audit(c);
 });
 it('queued fold preserves a prepared bot sample and waits for Hero turn, including fold when check is legal',async()=>{
  const {c}=await open();await c.startSession(settings());await act(c,{type:'call'});await c.prepareBot();
  const pending=structuredClone(active(c).pending),g=structuredClone(active(c).game),count=samples;await request(c,'fold');
  expect(active(c).pending).toEqual(pending);expect(active(c).game).toEqual(g);expect(samples).toBe(count);
  await c.commitBot(g.handId,g.revision);expect(active(c).game.street).toBe('flop');expect(active(c).game.actor).toBe(1);
  await bot(c);expect(c.data!.active).toBeNull();const h=c.data!.hands[0];
  expect(h.net).toBe(-200);expect(h.view.events.filter(e=>e.type==='action'&&e.seatId===0).map(e=>e.action?.type)).toEqual(['call','fold']);
  expect(h.view.events.find(e=>e.type==='action'&&e.seatId===0&&e.action?.type==='fold')?.street).toBe('flop');audit(c);
 });

 it('preserves an already sampled opponent fold even when Hero wins before the queued fold gets a turn',async()=>{
  const opened=await open();await opened.c.startSession(settings());
  // This fixture forces a base-policy fold; personality overlays may legitimately replace it.
  delete opened.store.data!.active!.humanLayer;
  const {c}=await open(opened.store);await act(c,{type:'raise',to:600});
  vi.mocked(policy.chooseDecision).mockImplementationOnce((obs,p,rng)=>{samples++;return{...productionChoose(obs,p,rng),action:{type:'fold'}};});
  await c.prepareBot();const pending=structuredClone(active(c).pending);await request(c,'fold');expect(active(c).pending).toEqual(pending);
  const g=active(c).game;await c.commitBot(g.handId,g.revision);expect(c.data!.active).toBeNull();const h=c.data!.hands[0];
  expect(h.net).toBe(200);expect(c.data!.wallet).toBe(1000200);expect(h.view.events.filter(e=>e.type==='action'&&e.seatId===0).map(e=>e.action?.type)).toEqual(['raise']);
  expect(h.view.events.filter(e=>e.type==='refund')).toMatchObject([{seatId:0,amount:400}]);audit(c);
 });
 it('an all-in Hero cannot be folded; bots finish runout and actual payout is cashed out',async()=>{
  // Equal stacks isolate all-in exit authority; random short buy-ins add an uncalled refund.
  const {c}=await open();await c.startSession(settings({seatStacks:{0:20000,1:20000}}));await act(c,{type:'raise',to:20000});
  expect(active(c).game.seats[0].allIn).toBe(true);await request(c,'fold');await bot(c);
  expect(c.data!.active).toBeNull();const h=c.data!.hands[0];expect(h.view.board).toHaveLength(5);
  expect(h.view.events.filter(e=>e.type==='action'&&e.seatId===0).map(e=>e.action?.type)).toEqual(['raise']);
  expect(h.view.payouts[0]??0).toBe(h.view.seats[0].stack);expect(c.data!.wallet).toBe(1000000+h.net);audit(c);
 });
 it('already folded multiway Hero is not folded twice and opponents finish the genuine hand',async()=>{
  const {c}=await open();await c.startSession(settings({seats:3,archetypes:['station','station']}));await act(c,{type:'fold'});await request(c,'fold');
  await playToCompletion(c);expect(c.data!.active).toBeNull();const h=c.data!.hands[0];expect(h.view.board).toHaveLength(5);
  expect(h.view.events.filter(e=>e.type==='action'&&e.seatId===0&&e.action?.type==='fold')).toHaveLength(1);expect(h.net).toBe(0);audit(c);
 });
 it('end request resumes a paused table without replacing a sampled decision',async()=>{
  const {c}=await open();await c.startSession(settings());await act(c,{type:'call'});await c.prepareBot();const pending=structuredClone(active(c).pending);
  await c.setPaused(true);expect(active(c).paused).toBe(true);await request(c,'finish');expect(active(c).paused).toBe(false);expect(active(c).pending).toEqual(pending);
  await playToCompletion(c);expect(c.data!.active).toBeNull();audit(c);
 });
 it('a request on an already completed hand cashes out without creating a second settlement or next hand',async()=>{
  const {c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const h=structuredClone(c.data!.hands),a=active(c),sid=a.sessionId,hid=a.game.handId;
  await Promise.all([c.requestEndSession('finish',sid,hid),c.requestEndSession('fold',sid,hid)]);
  await c.requestEndSession('finish',sid,hid);expect(c.data!.active).toBeNull();expect(c.data!.hands).toEqual(h);expect(c.data!.sessions).toHaveLength(1);
  expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);audit(c);
 });

 it('serializes concurrent new-hand and end-session clicks without dealing into a closed session',async()=>{
  const {c}=await open();await c.startSession(settings());await act(c,{type:'fold'});const first=active(c);
  await Promise.all([c.nextHand(),c.requestEndSession('finish',first.sessionId,first.game.handId)]);
  expect(active(c).game.handId).not.toBe(first.game.handId);expect(active(c).exitMode).toBeNull();expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(0);
  await playToCompletion(c);const second=active(c);await Promise.all([c.requestEndSession('finish',second.sessionId,second.game.handId),c.nextHand()]);
  expect(c.data!.active).toBeNull();expect(c.data!.hands).toHaveLength(2);expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);audit(c);
 });
 it('stale hand/session confirmation cannot close a newly dealt hand or new session',async()=>{
  const {c}=await open();await c.startSession(settings());const old=active(c),sid=old.sessionId,hid=old.game.handId;await act(c,{type:'fold'});await c.nextHand();
  const next=structuredClone(active(c));await c.requestEndSession('fold',sid,hid);expect(c.error).not.toBe('');expect(active(c)).toEqual(next);
  await playToCompletion(c);await c.cashOut();await c.startSession(settings());const newer=structuredClone(active(c));
  await c.requestEndSession('fold',sid,hid);expect(c.error).not.toBe('');expect(active(c)).toEqual(newer);audit(c);
 });
 it('rejects table transfers, deals and early replacement session while end request is pending',async()=>{
  const {c}=await open();await c.startSession(settings());await request(c,'finish');const before=structuredClone(active(c)),wallet=c.data!.wallet,ledger=structuredClone(c.data!.ledger);
  await c.topUp(100);expect(active(c)).toEqual(before);expect(c.data!.wallet).toBe(wallet);
  await c.nextHand();expect(active(c)).toEqual(before);await c.startSession(settings());expect(active(c)).toEqual(before);expect(c.data!.ledger).toEqual(ledger);
  await playToCompletion(c);await Promise.all([c.startSession(settings()),c.startSession(settings())]);
  expect(c.data!.sessions).toHaveLength(2);expect(c.data!.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(2);audit(c);
 });

 it('late Hero and bot callbacks from an exited hand cannot act in a replacement session',async()=>{
  const {c}=await open();await c.startSession(settings());await act(c,{type:'call'});await c.prepareBot();const old=structuredClone(active(c).game);
  await request(c,'fold');await playToCompletion(c);await c.startSession(settings());const next=structuredClone(active(c)),ledger=structuredClone(c.data!.ledger);
  await c.commitBot(old.handId,old.revision);expect(active(c)).toEqual(next);expect(c.data!.ledger).toEqual(ledger);
  await c.act({type:'fold'},old.handId,0);expect(active(c)).toEqual(next);expect(c.data!.ledger).toEqual(ledger);audit(c);
 });
 it('wallet-only adjustments during queued exit remain external to poker profit',async()=>{
  const {c}=await open();await c.startSession(settings());await request(c,'finish');const game=structuredClone(active(c).game);
  await c.adjustBankroll(400000,'Independent bankroll correction');expect(active(c).game).toEqual(game);expect(active(c).exitMode).toBe('finish');
  await act(c,{type:'fold'});expect(c.data!.wallet).toBe(419900);expect(c.data!.hands[0].net).toBe(-100);audit(c);
 });
});

describe('end-session recovery and exactly-once transfer',()=>{
 it('restores queued exit and prepared bot exactly, then ignores a stale callback after cashout',async()=>{
  const {c,store}=await open();await c.startSession(settings());await act(c,{type:'call'});await c.prepareBot();await request(c,'fold');
  const pending=structuredClone(active(c).pending),old=structuredClone(active(c).game),count=samples;
  const restored=(await open(store)).c;expect(active(restored).exitMode).toBe('fold');expect(active(restored).pending).toEqual(pending);await restored.prepareBot();expect(samples).toBe(count);
  await playToCompletion(restored);expect(restored.data!.active).toBeNull();const ledger=structuredClone(restored.data!.ledger),wallet=restored.data!.wallet;
  await restored.commitBot(old.handId,old.revision);expect(restored.data!.ledger).toEqual(ledger);expect(restored.data!.wallet).toBe(wallet);audit(restored);
  const reopened=(await open(store)).c;expect(reopened.data!.active).toBeNull();expect(reopened.data!.ledger).toEqual(ledger);
 });
 it.each(['fail','lost-ack'] as const)('recovers %s of combined fold/settle/cashout commit without partial money movement',async kind=>{
  const {c,store}=await open();await c.startSession(settings());const before=structuredClone(c.data);
  if(kind==='fail')store.failAt=store.attempts+1;else store.loseAckAt=store.attempts+1;
  await request(c,'fold');expect(c.status).toBe('error');expect(c.data!.wallet).toBe(before!.wallet);expect(c.data!.active!.game).toEqual(before!.active!.game);
  if(kind==='fail'){expect(store.data!.active).not.toBeNull();expect(store.data!.hands).toHaveLength(0);}else{expect(store.data!.active).toBeNull();expect(store.data!.hands).toHaveLength(1);}
  await c.retry();expect(c.status).toBe('ready');expect(c.data!.active).toBeNull();expect(c.data!.wallet).toBe(999900);
  expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);audit(c);
 });
 it('reload before final bot payout retains requested exit and produces a single genuine all-in settlement',async()=>{
  const {c,store}=await open();await c.startSession(settings());
  const d=structuredClone(store.data!);d.active!.game=rig(d.active!.game,[['As','Ah'],['Ks','Kh']],['2c','3d','7s','8c','9h']);d.active!.frames=[projectView(d.active!.game,0)];store.data=d;
  const original=(await open(store)).c;await act(original,{type:'raise',to:20000});await request(original,'fold');await original.prepareBot();const pending=structuredClone(active(original).pending);
  const resumed=(await open(store)).c;expect(active(resumed).pending).toEqual(pending);await bot(resumed);
  expect(resumed.data!.active).toBeNull();expect(resumed.data!.hands[0].net).toBe(20000);expect(resumed.data!.wallet).toBe(1020000);
  expect(resumed.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);expect(resumed.data!.hands[0].view.payouts).toEqual({0:40000});audit(resumed);
 });
});
