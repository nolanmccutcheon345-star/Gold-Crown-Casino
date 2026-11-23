import { describe, expect, it } from 'vitest';
import { assertAccounting, nextHand, projectView, reconfigureTable } from '../../src/core/engine';
import { applyQueuedConfiguration, normalizeTableSettings, queueTableConfiguration, validateConfigurationData, type ConfigurationData, type TableSettings } from '../../src/session/configuration';
import { DEFAULT_SETTINGS, rules, SessionController } from '../../src/session/controller';
import type { AppData, PersistencePort } from '../../src/session/types';
import { appendMoney, canonical, parsePublicHistory, publicHistory, validateData } from '../../src/storage/integrity';
import { deriveCashStats } from '../../src/stats/cash';
import { pokerStarsProfile } from '../../src/rules/pokerstars';
import { POLICY_VERSION } from '../../src/bots/profiles';
import { recordConfigurationBoundary } from '../../src/session/configuration-history';

const AT='2026-11-01T12:00:00.000Z',seed=(id:number)=>10000+id;
class Store implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw new Error('Revision changed');this.data=structuredClone(next);}
 close(){}
}
async function complete(){
 const controller=new SessionController(new Store());await controller.init();await controller.startSession({...structuredClone(DEFAULT_SETTINGS),seats:2});
 const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);expect(controller.error).toBe('');expect(controller.data!.hands).toHaveLength(1);
 return structuredClone(controller.data!) as ConfigurationData;
}
function request(data:ConfigurationData,changes:Partial<TableSettings>={},id='configure-settled'){
 const active=data.active!,previous=data.sessions.find(session=>session.id===active.sessionId)!.settings;
 return queueTableConfiguration(data,{id,settings:{...structuredClone(previous),...changes},expectedSessionId:active.sessionId,expectedHandId:active.game.handId,at:AT},seed);
}
async function applyAndDeal(data:ConfigurationData,handId='reconfigured-hand'){
 const changed=await applyQueuedConfiguration(data,{reconfigure:reconfigureTable,rules:settings=>({...rules(settings),chipUnit:settings.chipUnit??1}),at:AT});
 const active=data.active!;active.game=nextHand(active.game,handId);active.number++;active.startedAt=AT;active.frames=[projectView(active.game,0)];active.pending=null;
 recordConfigurationBoundary(data,changed);
 validateConfigurationData(data);await validateData(data);assertAccounting(active.game);
}
function independentWalletAudit(data:ConfigurationData){
 const game=data.active!.game,hero=game.seats.find(seat=>seat.id===0)!;
 expect(data.wallet).toBe(data.ledger.reduce((n,event)=>n+event.walletDelta,0));
 expect(hero.stack+(game.street==='complete'?0:hero.totalCommitted)).toBe(data.ledger.reduce((n,event)=>n+event.tableDelta,0));
 expect(data.wallet+hero.stack+(game.street==='complete'?0:hero.totalCommitted)).toBe(1000000+data.hands.reduce((n,hand)=>n+hand.net,0));
 expect(data.ledger.filter(event=>event.kind!=='hand-net').every(event=>event.pokerNet===0)).toBe(true);
 expect(new Set(data.ledger.map(event=>event.id)).size).toBe(data.ledger.length);
}

describe('D08 / V706 authoritative next-hand reconfiguration and independent ledgers',()=>{
 it('applies new sparse roster, stacks, rules and profiles only to the next hand; completed history remains replayable',async()=>{
  const data=await complete(),oldHand=canonical(data.hands),oldFrames=canonical(data.hands[0].frames),oldNet=data.hands[0].net;
  request(data,{seats:3,capacity:10,occupiedSeatIds:[0,4,9],seatStacks:{0:30000,4:40000,9:50000},smallBlind:200,bigBlind:500,buyIn:30000,rakeMode:'custom',rakeBasisPoints:300,rakeCap:600});
  await applyAndDeal(data);const active=data.active!,session=data.sessions[0];
  expect(active.game.seats.map(seat=>seat.id)).toEqual([0,4,9]);expect(active.game.profile).toMatchObject({smallBlind:200,bigBlind:500,rake:{basisPoints:300,cap:600}});expect(Object.keys(active.profiles)).toEqual(['4','9']);
  expect(active.game.profile.version).toMatch(/^0\.3\.0\+cfg\.[0-9a-f]{64}$/);expect(active.game.profile.version).not.toBe(data.hands[0].view.profile.version);
  expect(active.game.seats.map(seat=>seat.startingStack)).toEqual([30000,40000,50000]);expect(active.queuedConfiguration).toBeUndefined();expect(active.lastAppliedConfigurationId).toBe('configure-settled');
  expect(canonical(data.hands)).toBe(oldHand);expect(canonical(data.hands[0].frames)).toBe(oldFrames);expect(data.hands[0].view.profile.bigBlind).toBe(200);expect(data.hands[0].net).toBe(oldNet);
  const imported=await parsePublicHistory(JSON.stringify(await publicHistory(data.hands)));expect(imported[0].net).toBe(oldNet);
  expect(data.ledger.filter(event=>event.kind==='table-adjustment')).toMatchObject([{walletDelta:-10100,tableDelta:10100,pokerNet:0}]);expect(session.buyIns).toBe(30100);independentWalletAudit(data);
  expect(session.settings.seatStacks).toBeUndefined();
 });
 it('returns a reduced Hero target to wallet without counting it as winnings or modifying buy-in history',async()=>{
  const data=await complete(),before=deriveCashStats(data.hands,data.sessions);
  request(data,{seatStacks:{0:10000}});await applyAndDeal(data);
  expect(data.wallet).toBe(989900);expect(data.sessions[0].buyIns).toBe(20000);expect(data.sessions[0].tableWithdrawals).toBe(9900);
  expect(data.ledger.filter(event=>event.kind==='table-adjustment')).toMatchObject([{walletDelta:9900,tableDelta:-9900,pokerNet:0}]);
  expect(deriveCashStats(data.hands,data.sessions).profit).toBe(before.profit);expect(deriveCashStats(data.hands,data.sessions).bb100).toBe(before.bb100);independentWalletAudit(data);
 });
 it('reapplying an acknowledged request is inert and reload does not duplicate a transfer',async()=>{
  const data=await complete();request(data,{seatStacks:{0:30000}});
  const restored=JSON.parse(JSON.stringify(data)) as ConfigurationData;await applyAndDeal(restored);const before=structuredClone(restored);
  expect(await applyQueuedConfiguration(restored,{reconfigure:reconfigureTable,rules,at:AT})).toBe(false);expect(restored).toEqual(before);
  expect(restored.ledger.filter(event=>event.id==='configuration:configure-settled')).toHaveLength(1);independentWalletAudit(restored);
 });
 it('insufficient wallet after intervening losses fails atomically while preserving the requested configuration',async()=>{
  const data=await complete();await appendMoney(data,{id:'manual-zero',at:AT,epoch:data.epoch,kind:'adjustment',walletDelta:-data.wallet,tableDelta:0,pokerNet:0,note:'Manual wallet edit'});
  request(data,{seatStacks:{0:30000}});const before=structuredClone(data);
  await expect(applyQueuedConfiguration(data,{reconfigure:reconfigureTable,rules,at:AT})).rejects.toThrow('Insufficient');expect(data).toEqual(before);await validateData(data);
 });
 it('does not apply a configuration during an active hand or before its hand is recorded',async()=>{
  const data=await complete();request(data);data.hands=[];const before=structuredClone(data);
  await expect(applyQueuedConfiguration(data,{reconfigure:reconfigureTable,rules,at:AT})).rejects.toThrow('Record');expect(data).toEqual(before);
  const active=await complete();active.active!.game=nextHand(active.active!.game,'playing');active.active!.frames=[projectView(active.active!.game,0)];request(active);const activeBefore=structuredClone(active);
  await expect(applyQueuedConfiguration(active,{reconfigure:reconfigureTable,rules,at:AT})).rejects.toThrow('Finish');expect(active).toEqual(activeBefore);
 });
 it('engine rejection does not debit wallet or replace any settings',async()=>{
  const data=await complete();request(data,{seatStacks:{0:30000}});const before=structuredClone(data);
  await expect(applyQueuedConfiguration(data,{reconfigure:()=>{throw Error('Engine validation failed');},rules,at:AT})).rejects.toThrow('Engine validation');expect(data).toEqual(before);
 });
 it('a rules-only edit creates no artificial table transfer and never rerolls unchanged personalities',async()=>{
  const data=await complete(),profiles=structuredClone(data.active!.profiles),ledger=canonical(data.ledger);request(data,{rakeMode:'custom',rakeBasisPoints:400,rakeCap:600});await applyAndDeal(data);
  expect(data.active!.profiles).toEqual(profiles);expect(canonical(data.ledger)).toBe(ledger);independentWalletAudit(data);
 });
 it('records opponent removal/replacement as external simulation transfers, never Hero money or poker profit',async()=>{
  const data=await complete(),wallet=data.wallet,profit=deriveCashStats(data.hands,data.sessions).profit;
  // Opponents may buy in for different amounts (layer human-1.4.0): the removal returns exactly seat 1's stack.
  const seat1=data.active!.game.seats.find(seat=>seat.id===1)!.stack;expect(seat1).toBeGreaterThan(0);
  request(data,{capacity:10,seats:2,occupiedSeatIds:[0,9],seatStacks:{9:35000}});await applyAndDeal(data);
  const transfers=data.active!.game.tableTransfers!;
  expect(transfers.find(transfer=>transfer.seatId===1)?.amount).toBe(-seat1);expect(transfers.find(transfer=>transfer.seatId===9)?.amount).toBe(35000);
  expect(data.wallet).toBe(wallet);expect(deriveCashStats(data.hands,data.sessions).profit).toBe(profit);expect(data.ledger.filter(event=>event.kind==='table-adjustment')).toHaveLength(0);independentWalletAudit(data);
 });
 it('sourced rake can be queued only for an explicitly supported exact stake pair',async()=>{
  const data=await complete(),settings=data.sessions[0].settings;
  const resolved=normalizeTableSettings({...settings,rakeMode:'pokerstars-usd-2026',smallBlind:100,bigBlind:200},seed);
  expect(pokerStarsProfile(resolved.smallBlind,resolved.bigBlind).rake.source).toBeDefined();
  expect(()=>normalizeTableSettings({...settings,rakeMode:'pokerstars-usd-2026',smallBlind:125,bigBlind:250},seed)).toThrow();
 });
 it('changing denomination returns residual cents explicitly and preserves old cent-based hand replay and identities',async()=>{
  const data=await complete(),history=canonical(data.hands),wallet=data.wallet,personality=data.active!.profiles[1].personalityId;
  // Opponents may buy in for different amounts (layer human-1.4.0); seat 1 keeps its own stack in whole new chips.
  const seat1=data.active!.game.seats.find(seat=>seat.id===1)!.stack;expect(seat1%200).toBe(100);
  data.active!.profiles[1].policyVersion='synthetic-cash-1.2.0';
  request(data,{chipUnit:200,smallBlind:200,bigBlind:400,buyIn:20000});await applyAndDeal(data);
  expect(data.active!.game.profile.chipUnit).toBe(200);expect(data.active!.game.seats.map(seat=>seat.startingStack)).toEqual([19800,seat1-100]);
  expect(data.active!.game.profile.version).not.toBe(data.hands[0].view.profile.version);
  expect(data.wallet).toBe(wallet+100);expect(data.sessions[0].tableWithdrawals).toBe(100);
  expect(data.active!.game.tableTransfers!.filter(transfer=>transfer.id.includes('configuration:configure-settled')).map(transfer=>transfer.amount)).toEqual([-100,-100]);
  expect(data.active!.profiles[1].policyVersion).toBe(POLICY_VERSION);expect(data.active!.profiles[1].personalityId).toBe(personality);expect(canonical(data.hands)).toBe(history);independentWalletAudit(data);
  await parsePublicHistory(JSON.stringify(await publicHistory(data.hands)));
 });
 it('invalid new denominations and explicit non-unit stacks are rejected before queueing',async()=>{
  const data=await complete(),before=structuredClone(data);
  for(const changes of [{chipUnit:0},{chipUnit:1.5},{chipUnit:300},{chipUnit:100,seatStacks:{0:30001}},{chipUnit:100,rakeMode:'pokerstars-usd-2026' as const}])expect(()=>request(data,changes)).toThrow();
  expect(data).toEqual(before);
 });
});
