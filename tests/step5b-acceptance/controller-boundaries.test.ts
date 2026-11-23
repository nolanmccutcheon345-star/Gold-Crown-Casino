import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,projectView} from '../../src/core/engine';
import * as policy from '../../src/bots/policy';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';

/** Durable CAS oracle: copy boundaries and injected acknowledgement loss are
 * independent of BrowserPersistence and never touch a real user's saves. */
class Memory implements PersistencePort {
 data:AppData|null=null;failAfterCommit=false;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if((this.data?.revision??null)!==expected)throw Error('Revision changed');
  this.data=structuredClone(next);this.commits++;
  if(this.failAfterCommit){this.failAfterCommit=false;throw Error('Injected acknowledgement loss');}
 }
 close(){}
}
const game=(c:SessionController)=>c.data!.active!.game;
const settings={...DEFAULT_SETTINGS,seats:2,buyIn:20000,opponents:[{selection:'station' as const,personalitySeed:71921}]};
let botMode:'passive'|'fold'='passive';let samples=0;
beforeEach(()=>{
 samples=0;botMode='passive';const choose=policy.chooseDecision;
 vi.spyOn(policy,'chooseDecision').mockImplementation((o,p,r)=>{samples++;const d=choose(o,p,r);return{...d,action:botMode==='fold'?{type:'fold'}:o.legal.check?{type:'check'}:{type:'call'}};});
});
afterEach(()=>vi.restoreAllMocks());
async function open(port=new Memory()) {const c=new SessionController(port);await c.init();expect(c.error).toBe('');return{c,port};}
async function start(){const x=await open();await x.c.startSession(settings);expect(x.c.error).toBe('');return x;}
async function step(c:SessionController){const g=game(c);if(g.actor===0)await c.act(legalActions(g).check?{type:'check'}:{type:'call'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}
async function heroAt(c:SessionController,street:GameState['street']){for(let i=0;i<40&&(game(c).street!==street||game(c).actor!==0);i++)await step(c);expect(game(c).street).toBe(street);expect(game(c).actor).toBe(0);}
function financial(c:SessionController){const d=c.data!;expect(d.wallet).toBe(d.ledger.reduce((n,e)=>n+e.walletDelta,0));expect(d.hands.reduce((n,h)=>n+h.net,0)).toBe(d.ledger.reduce((n,e)=>n+e.pokerNet,0));expect(new Set(d.ledger.map(e=>e.id)).size).toBe(d.ledger.length);assertAccounting(game(c));}

describe('Step5B remaining cash controller acceptance boundaries',()=>{
 it.each(['preflop','flop','turn','river'] as const)('U05: repeated pause/resume and rejected bot callbacks preserve waiting Hero decision on %s',async street=>{
  const {c,port}=await start();await heroAt(c,street);const frozen=structuredClone(game(c)),ledger=structuredClone(c.data!.ledger),hands=structuredClone(c.data!.hands),calls=samples;
  for(let round=0;round<4;round++){
   await c.setPaused(true);await c.act({type:'fold'},frozen.handId,frozen.revision);await c.prepareBot();await c.commitBot(frozen.handId,frozen.revision);await c.tick();
   expect(game(c)).toEqual(frozen);await c.setPaused(false);await c.prepareBot();await c.tick();expect(game(c)).toEqual(frozen);
  }
  expect(samples).toBe(calls);expect(c.data!.ledger).toEqual(ledger);expect(c.data!.hands).toEqual(hands);
  const recovered=(await open(port)).c;expect(game(recovered)).toEqual(frozen);expect(projectView(game(recovered),0).legal).toEqual(legalActions(frozen));financial(recovered);c.close();recovered.close();
 });
 it('V701 controller component: 100 repeated preparations, view projections and pause/resume retain one decision and one engine event',async()=>{
  const {c,port}=await start();const first=game(c);await c.act({type:'call'},first.handId,first.revision);await c.prepareBot();
  const g=structuredClone(game(c)),pending=structuredClone(c.data!.active!.pending),sampled=samples,wallet=c.data!.wallet,ledger=structuredClone(c.data!.ledger);
  for(let i=0;i<100;i++){expect(projectView(game(c),0)).toEqual(projectView(g,0));await c.prepareBot();}
  await c.setPaused(true);await c.commitBot(g.handId,g.revision);expect(game(c)).toEqual(g);await c.setPaused(false);
  const restored=(await open(port)).c;await restored.prepareBot();expect(restored.data!.active!.pending).toEqual(pending);expect(samples).toBe(sampled);
  await Promise.all([restored.commitBot(g.handId,g.revision),restored.commitBot(g.handId,g.revision)]);await restored.commitBot(g.handId,g.revision);
  expect(game(restored).events.filter(e=>e.decisionId===pending!.decisionId)).toHaveLength(1);expect(restored.data!.wallet).toBe(wallet);expect(restored.data!.ledger).toEqual(ledger);financial(restored);c.close();restored.close();
 });
 it.each(['bot-command','street-close','refund-and-payout'] as const)('V430 controller component: acknowledgement loss after %s restores exactly the uninterrupted engine state and one settlement',async boundary=>{
  const {c:initial,port}=await start();let c=initial;const first=game(c);
  if(boundary==='refund-and-payout'){botMode='fold';await c.act({type:'raise',to:600},first.handId,first.revision);}
  else if(boundary==='bot-command')await c.act({type:'raise',to:600},first.handId,first.revision);
  else await c.act({type:'call'},first.handId,first.revision);
  await c.prepareBot();
  // Exercise recovery from a specific legal, durably prepared command.
  // Current adaptive policies can override the base policy's scripted action.
  const prepared=port.data!.active!.pending!.decision!;
  prepared.action=boundary==='refund-and-payout'?{type:'fold'}:legalActions(game(c)).check?{type:'check'}:{type:'call'};
  c.close();c=(await open(port)).c;
  const before=structuredClone(game(c)),pending=structuredClone(c.data!.active!.pending!);
  const expected=applyCommand(before,pending.decision!);port.failAfterCommit=true;await c.commitBot(before.handId,before.revision);expect(c.status).toBe('error');
  // Recovery starts from committed durable bytes, not the abandoned in-memory candidate.
  const restored=(await open(port)).c;expect(game(restored)).toEqual(expected);const history=structuredClone(restored.data!.hands),ledger=structuredClone(restored.data!.ledger);
  await restored.commitBot(before.handId,before.revision);await restored.retry();expect(game(restored)).toEqual(expected);
  expect(restored.data!.hands).toEqual(history);expect(restored.data!.ledger).toEqual(ledger);expect(expected.events.filter(e=>e.decisionId===pending.decisionId)).toHaveLength(1);
  if(boundary==='street-close')expect(expected.street).toBe('flop');
  if(boundary==='refund-and-payout'){
   expect(expected.street).toBe('complete');expect(expected.events.filter(e=>e.type==='refund').map(e=>e.amount)).toEqual([400]);expect(expected.payouts).toEqual({0:400});
   expect(expected.seats.map(s=>s.stack)).toEqual([20200,19800]);expect(restored.data!.hands).toHaveLength(1);expect(restored.data!.hands[0].net).toBe(200);expect(restored.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);
  }
  financial(restored);c.close();restored.close();
 });
 it('V605 controller component: secure entropy absence refuses a normal deal without charging the wallet',async()=>{
  const {c}=await open();const original=structuredClone(c.data);const secure=crypto.getRandomValues.bind(crypto);const spy=vi.spyOn(crypto,'getRandomValues').mockImplementation(()=>{throw Error('Secure entropy unavailable');});
  await c.startSession(settings);expect(c.error).toContain('Secure entropy unavailable');expect(c.data).toEqual(original);expect(c.data!.active).toBeNull();expect(c.data!.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(0);spy.mockRestore();expect(secure(new Uint32Array(1))).toHaveLength(1);c.close();
 });
});
