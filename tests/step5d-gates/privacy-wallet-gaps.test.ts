import {describe,expect,it} from 'vitest';
import type {Card,GameState} from '../../src/contracts';
import {assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {ARCHETYPES} from '../../src/bots/profiles';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {validateData} from '../../src/storage/integrity';
import {act,hand,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';

class Port implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){
  if(expected!==(this.data?.revision??null))throw Error('Independent test CAS conflict');
  this.data=structuredClone(next);
 }
 close(){}
}

/** Consistent permutation keeps all 52 cards unique. No public or observing
 * player's card is one of the swapped ranks/suits in these declared fixtures. */
function swapPrivate(state:GameState,left:Card,right:Card):void{
 const swap=(card:Card)=>card===left?right:card===right?left:card;
 state.deck=state.deck.map(swap);state.burned=state.burned.map(swap);state.board=state.board.map(swap);
 for(const seat of state.seats)seat.hole=seat.hole.map(swap);
}

describe('Step5D exact private-villain and reversible-wallet requirements',()=>{
 it.each(['live','folded'] as const)('V609: perturbing a %s villain leaves another villain observation, beliefs and decisions exact',kind=>{
  let original=rig(hand([30000,30000,30000],0),[['Ac','Kc'],['Ad','Kh'],['Jh','Ts']],['Qh','7h','2c','3s','8d']);
  original=act(original,{type:'raise',to:600});
  original=act(original,{type:'call'});original=act(original,{type:'call'});
  expect(original.actor).toBe(1);expect(original.street).toBe('flop');
  if(kind==='folded'){
   original=act(original,{type:'check'});original=act(original,{type:'fold'});original=act(original,{type:'check'});
   expect(original.actor).toBe(1);expect(original.street).toBe('turn');expect(original.seats[2].folded).toBe(true);
  }
  const variant=structuredClone(original),originalBytes=JSON.stringify(original);
  swapPrivate(variant,'Jh','6c');swapPrivate(variant,'Ts','9d');
  expect(variant.seats[2].hole).toEqual(['6c','9d']);
  expect(variant.seats[0].hole).toEqual(original.seats[0].hole);
  expect(variant.seats[1].hole).toEqual(original.seats[1].hole);
  expect(variant.board).toEqual(original.board);expect(variant.events).toEqual(original.events);
  expect(new Set(variant.deck).size).toBe(52);assertAccounting(variant);
  for(const [index,archetype] of ARCHETYPES.entries()){
   const profile=createProfile({selection:archetype},0x609d00+index,'neutral');
   const a=observeBot(original,1,profile.policyVersion,'V609-same-public-decision');
   const b=observeBot(variant,1,profile.policyVersion,'V609-same-public-decision');
   expect(b).toEqual(a);
   const first=analyzeDecision(a,profile),second=analyzeDecision(b,profile);
   expect(first.ranges).toBeDefined();expect(second.ranges).toEqual(first.ranges);
   expect(second).toEqual(first);
   for(let draw=0;draw<32;draw++)expect(chooseDecision(b,profile,seededRandom(0x609000+draw))).toEqual(chooseDecision(a,profile,seededRandom(0x609000+draw)));
  }
  expect(JSON.stringify(original)).toBe(originalBytes);
 });

 it('V519: a mid-hand manual wallet adjustment reverses through a new ledger event and survives reload without touching pending poker state',async()=>{
  const port=new Port(),controller=new SessionController(port);await controller.init();
  try{
   await controller.startSession({...DEFAULT_SETTINGS,seats:2,opponents:[{selection:'tag',personalitySeed:0x519d00}]});
   const game=controller.data!.active!.game;expect(game.actor).toBe(0);
   await controller.act({type:'call'},game.handId,game.revision);await controller.prepareBot();
   expect(controller.error).toBe('');expect(controller.data!.active!.pending?.decision).toBeTruthy();
   const before=structuredClone(controller.data!),active=JSON.stringify(before.active),history=JSON.stringify(before.hands);
   const startingWallet=before.wallet,adjustment=43210;
   await controller.adjustBankroll(startingWallet+adjustment,'V519 explicit correction');
   expect(controller.error).toBe('');expect(controller.data!.wallet).toBe(startingWallet+adjustment);
   expect(JSON.stringify(controller.data!.active)).toBe(active);
   await controller.adjustBankroll(startingWallet,'V519 reverse earlier correction');
   expect(controller.error).toBe('');expect(controller.data!.wallet).toBe(startingWallet);
   const after=controller.data!,appended=after.ledger.slice(before.ledger.length);
   expect(appended).toHaveLength(2);expect(new Set(appended.map(event=>event.id)).size).toBe(2);
   expect(appended.map(event=>event.walletDelta)).toEqual([adjustment,-adjustment]);
   expect(appended.every(event=>event.kind==='adjustment'&&event.pokerNet===0&&event.tableDelta===0)).toBe(true);
   expect(after.ledger.slice(0,before.ledger.length)).toEqual(before.ledger);
   expect(JSON.stringify(after.active)).toBe(active);expect(JSON.stringify(after.hands)).toBe(history);
   // Normal visible-session elapsed time still accrues during cashier use;
   // every identity, rule, stake, result, buy-in and cashout field stays exact.
   expect(after.sessions.map(session=>({...session,activeMs:0}))).toEqual(before.sessions.map(session=>({...session,activeMs:0})));
   expect(after.sessions[0].activeMs).toBeGreaterThanOrEqual(before.sessions[0].activeMs);
   expect(after.wallet).toBe(after.ledger.reduce((sum,event)=>sum+event.walletDelta,0));
   assertAccounting(after.active!.game);await validateData(after);
   controller.close();const reopened=new SessionController(port);
   try{
    await reopened.init();expect(reopened.error).toBe('');expect(reopened.status).toBe('ready');
    expect(reopened.data).toEqual(after);await reopened.prepareBot();
    expect(reopened.data!.active!.pending).toEqual(before.active!.pending);
    expect(reopened.data!.ledger).toEqual(after.ledger);expect(reopened.data!.wallet).toBe(startingWallet);
   }finally{reopened.close();}
  }finally{controller.close();}
 });
});
