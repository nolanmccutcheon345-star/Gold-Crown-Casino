import {afterEach,expect,it,vi} from 'vitest';
import {legalActions,projectView,assertAccounting} from '../../src/core/engine';
import * as policy from '../../src/bots/policy';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {canonical,validateData} from '../../src/storage/integrity';
import {referenceFinancial,financialInput,referenceFullHands} from '../step5e-independent/financial-reference';
import {rig} from '../verification/helpers';

class Store implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){expect(this.data?.revision??null).toBe(expected);this.data=structuredClone(next);}
 close(){}
}

const choose=policy.chooseDecision;
afterEach(()=>vi.restoreAllMocks());

/** Explicit test-only dealt-card fixture. No production entropy, state or browser
 * is modified. Real legal controller actions then create both bust settlements. */
async function dealtQuadsFixture(controller:SessionController,store:Store){
 const fixture=structuredClone(controller.data!),active=fixture.active!,board=['Ac','Ad','7h','9s','Jd'];
 const remaining='23456789TJQKA'.split('').flatMap(rank=>'cdhs'.split('').map(suit=>rank+suit)).filter(card=>!['As','Ah',...board].includes(card));
 const holes=active.game.seats.map(seat=>seat.id===0?['As','Ah']:[remaining.shift()!,remaining.shift()!]);
 active.game=rig(active.game,holes,board);active.frames=[projectView(active.game,0)];
 await validateData(fixture);controller.close();store.data=fixture;
 const restored=new SessionController(store);await restored.init();expect(restored.error).toBe('');return restored;
}

async function completeAllIn(controller:SessionController){
 for(let actions=0;controller.data!.active!.game.street!=='complete'&&actions<40;actions++){
  const game=controller.data!.active!.game;
  if(game.actor===0){const legal=legalActions(game);await controller.act(legal.callAmount?{type:'call'}:{type:'check'},game.handId,game.revision);}
  else{await controller.prepareBot();expect(controller.error).toBe('');await controller.commitBot(game.handId,game.revision);}
  expect(controller.error).toBe('');assertAccounting(controller.data!.active!.game);
 }
 expect(controller.data!.active!.game.street).toBe('complete');
 expect(controller.data!.active!.game.seats.find(seat=>seat.id===8)!.stack).toBe(0);
}

it('fresh identical $200 targets replenish the same busted seat twice, including a queued reload, with one transfer per boundary',async()=>{
 vi.spyOn(policy,'chooseDecision').mockImplementation((observation,profile,random)=>({
  ...choose(observation,profile,random),
  action:observation.legal.canRaise?{type:'raise',to:observation.legal.maxRaiseTo!}:observation.legal.callAmount?{type:'call'}:{type:'check'},
 }));
 const store=new Store();let controller=new SessionController(store);await controller.init();
 await controller.startSession({...structuredClone(DEFAULT_SETTINGS),seats:10,capacity:10});
 expect(controller.error).toBe('');const targets=Object.fromEntries(Array.from({length:9},(_,index)=>[index+1,20000]));
 const requestIds:string[]=[];
 for(let cycle=0;cycle<2;cycle++){
  controller=await dealtQuadsFixture(controller,store);await completeAllIn(controller);
  const before=controller.data!,active=before.active!,oldHistory=canonical(before.hands),wallet=before.wallet;
  const priorFinancial=referenceFinancial(financialInput(before));
  await controller.queueConfiguration({...structuredClone(before.sessions[0].settings),seatStacks:targets},active.sessionId,active.game.handId);
  expect(controller.error).toBe('');const queued=controller.data!.active!.queuedConfiguration!;
  expect(queued.settings.seatStacks).toEqual(targets);expect(controller.data!.active!.game.seats.find(seat=>seat.id===8)!.stack).toBe(0);requestIds.push(queued.id);
  if(cycle===1){controller.close();controller=new SessionController(store);await controller.init();expect(controller.error).toBe('');expect(controller.data!.active!.queuedConfiguration).toEqual(queued);}
  await controller.nextHand();expect(controller.error).toBe('');
  const next=controller.data!,game=next.active!.game;
  expect(game.seats).toHaveLength(10);expect(game.seats.find(seat=>seat.id===8)!.startingStack).toBe(20000);
  expect(next.active!.queuedConfiguration).toBeUndefined();expect(next.sessions[0].settings.seatStacks).toBeUndefined();
  expect(canonical(next.hands)).toBe(oldHistory);expect(next.wallet).toBe(wallet);
  expect(referenceFinancial(financialInput(next))).toEqual(priorFinancial);
  const prefix=`configuration:${`configuration:${queued.id}`.length}:configuration:${queued.id}:seat:`;
  expect(game.tableTransfers!.filter(transfer=>transfer.id===prefix+'8')).toEqual([{id:prefix+'8',seatId:8,amount:20000}]);
  await validateData(next);assertAccounting(game);
 }
 expect(new Set(requestIds).size).toBe(2);expect(controller.data!.hands).toHaveLength(2);
 expect(controller.data!.ledger.filter(event=>event.kind==='hand-net')).toHaveLength(2);
 const replay=referenceFullHands(controller.data!.hands);expect(replay.poker).toBe(referenceFinancial(financialInput(controller.data!)).poker);
 controller.close();
});
