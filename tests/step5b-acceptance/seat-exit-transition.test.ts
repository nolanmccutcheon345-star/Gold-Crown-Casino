import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applyCommand,assertAccounting,legalActions,nextHand,reconfigureTable,startHand} from '../../src/core/engine';
import {pokerStarsProfile} from '../../src/rules/pokerstars';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import * as policy from '../../src/bots/policy';
import type {AppData,PersistencePort} from '../../src/session/types';
import type {GameState} from '../../src/contracts';

class Memory implements PersistencePort{
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw Error('Revision changed');this.data=structuredClone(next);}
 close(){}
}
const audit=(g:GameState)=>{assertAccounting(g);expect(g.seats.reduce((n,s)=>n+s.stack,0)+g.pot+g.rake).toBe(g.initialTotal);};
function finish(g:GameState){while(g.street!=='complete'){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`nine-prefix:${g.revision}`,action:legalActions(g).check?{type:'check'}:{type:'call'}});audit(g);}return g;}
afterEach(()=>vi.restoreAllMocks());
describe('B19 exact nine-handed to heads-up transition',()=>{
 it.each([0,1,2,3,4,5,6,7,8])('preserves next big-blind obligation from old button%s for every surviving opponent',oldButton=>{
  const previous=finish(startHand({handId:`B19:button-${oldButton}`,button:oldButton,profile:pokerStarsProfile(100,200),seats:Array.from({length:9},(_,id)=>({id,name:`P${id}`,stack:20000}))}));
  const frozen=JSON.stringify(previous),oldBigBlind=(oldButton+2)%9;expect(previous.bigBlindSeat).toBe(oldBigBlind);expect(previous.profile.rake.cap).toBe(275);
  for(let opponent=1;opponent<=8;opponent++){
   // Independent physical-ring calculation: advance the old BB obligation to
   // the next surviving occupied seat, then designate the other seat BTN/SB.
   const ids=[0,opponent];let expectedBB=-1;for(let distance=1;distance<=9;distance++){const physical=(oldBigBlind+distance)%9;if(ids.includes(physical)){expectedBB=physical;break;}}
   const expectedButton=ids.find(id=>id!==expectedBB)!;
   const configured=reconfigureTable(previous,ids.map(id=>({id,name:`P${id}`,stack:20000})),pokerStarsProfile(100,200),`exit:${oldButton}:${opponent}`);
   let g=nextHand(configured,`B19:heads-up:${oldButton}:${opponent}`);
   expect(g.button).toBe(expectedButton);expect(g.smallBlindSeat).toBe(expectedButton);expect(g.bigBlindSeat).toBe(expectedBB);expect(g.actor).toBe(expectedButton);
   expect(g.profile.rake.cap).toBe(125);expect(g.profile.rake.dealtIn).toBe(2);
   expect(g.events.filter(e=>e.type==='blind').map(e=>[e.seatId,e.amount])).toEqual([[expectedButton,100],[expectedBB,200]]);
   expect(new Set(g.seats.flatMap(s=>s.hole)).size).toBe(4);audit(g);
   g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'heads-up-limp',action:{type:'call'}});g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:'big-blind-check',action:{type:'check'}});
   expect(g.street).toBe('flop');expect(g.actor).toBe(expectedBB);audit(g);expect(JSON.stringify(previous)).toBe(frozen);
  }
 });
 it('queues nine-to-two during real controller action, restores, settles once and consumes the change at one next-hand boundary',async()=>{
  const choose=policy.chooseDecision;vi.spyOn(policy,'chooseDecision').mockImplementation((o,p,r)=>({...choose(o,p,r),action:{type:'fold'}}));
  const port=new Memory(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9,capacity:9,occupiedSeatIds:[0,1,2,3,4,5,6,7,8],buyIn:30000,rakeMode:'pokerstars-usd-2026'});
  expect(c.error).toBe('');const a=c.data!.active!,gameBefore=structuredClone(a.game),sessionId=a.sessionId;
  const queued={...c.data!.sessions[0].settings,seats:2,capacity:9,occupiedSeatIds:[0,8]};await c.queueConfiguration(queued,sessionId,a.game.handId);expect(c.error).toBe('');expect(c.data!.active!.game).toEqual(gameBefore);
  const queuedId=c.data!.active!.queuedConfiguration!.id;const restored=new SessionController(port);await restored.init();expect(restored.error).toBe('');expect(restored.data!.active!.game).toEqual(gameBefore);
  for(let n=0;restored.data!.active!.game.street!=='complete'&&n<30;n++){
   const g=restored.data!.active!.game;if(g.actor===0)await restored.act({type:'fold'},g.handId,g.revision);else{await restored.prepareBot();await restored.commitBot(g.handId,g.revision);}expect(restored.error).toBe('');
  }
  expect(restored.data!.hands).toHaveLength(1);const record=structuredClone(restored.data!.hands[0]),wallet=restored.data!.wallet;
  await Promise.all([restored.nextHand(),restored.nextHand()]);expect(restored.error).toBe('');const g=restored.data!.active!.game;
  expect(g.seats.map(s=>s.id)).toEqual([0,8]);expect(g.bigBlindSeat).toBe(8);expect(g.button).toBe(0);expect(g.smallBlindSeat).toBe(0);expect(g.actor).toBe(0);expect(g.profile.rake.cap).toBe(125);expect(restored.data!.active!.lastAppliedConfigurationId).toBe(queuedId);
  expect(restored.data!.active!.queuedConfiguration).toBeUndefined();expect(restored.data!.hands).toEqual([record]);expect(restored.data!.wallet).toBe(wallet);expect(restored.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);audit(g);
  const snapshot=structuredClone(restored.data);await restored.nextHand();expect(restored.data).toEqual(snapshot);const again=new SessionController(port);await again.init();expect(again.data!.active!.game).toEqual(g);expect(again.data!.hands).toEqual([record]);
  const directory=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'B19-controller.json'),JSON.stringify({source:process.env.STEP5B_SOURCE_COMMIT??'recorded by invoking run manifest',handId:record.id,previousProfile:record.view.profile,queuedConfigurationId:queuedId,nextHandId:g.handId,nextProfile:g.profile,button:g.button,smallBlindSeat:g.smallBlindSeat,bigBlindSeat:g.bigBlindSeat,historyCount:again.data!.hands.length,settlementCount:again.data!.ledger.filter(e=>e.kind==='hand-net').length,walletBefore:wallet,walletAfter:again.data!.wallet},null,2));
  c.close();restored.close();again.close();
 });
});
