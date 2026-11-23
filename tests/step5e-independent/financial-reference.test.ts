import {beforeAll,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {migrateData} from '../../src/storage/integrity';
import type {AppData,MoneyEvent,StoredHand} from '../../src/session/types';
import {AtomicPort} from '../step5d-independent/reference';
import {financialInput,referenceFinancial,referenceFullHands,referenceHash,type FinancialSnapshot} from './financial-reference';

let originals:Record<string,AppData>;
beforeAll(async()=>{
 const source=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
 originals=Object.fromEntries(await Promise.all(Object.entries(source.streets).map(async([street,data])=>[street,await migrateData(data)])));
});
function clone(){return structuredClone(financialInput(originals.flop));}
function resealLedger(data:FinancialSnapshot){let previous='0'.repeat(64);for(const [index,event] of data.ledger.entries()){event.index=index;event.previousHash=previous;const body:Partial<MoneyEvent>={...event};delete body.hash;event.hash=referenceHash(body);previous=event.hash;}}
function changedEvent(data:FinancialSnapshot,kind:MoneyEvent['kind']){const event=data.ledger.find(e=>e.kind===kind);if(!event)throw Error(`Missing fixture ${kind}`);return event;}

describe('Step5E independent minimal financial recovery oracle',()=>{
 it.each(['preflop','flop','turn','river'])('agrees with complete canonical action/payout replay at %s recovery',street=>{
  const data=originals[street],small=referenceFinancial(financialInput(data)),full=referenceFullHands(data.hands);
  expect(small).toMatchObject({wallet:190000,table:10000,poker:150,hands:3,sessions:3});
  expect(full).toEqual({hands:3,poker:150,totalRake:50});
  expect(small.poker).toBe(full.poker);
 });
 it('does not count imported study copies as income or hands',()=>{
  const data=structuredClone(originals.flop);expect(data.importedHands.length).toBeGreaterThan(0);
  const baseline=referenceFinancial(financialInput(data));data.importedHands.push(...data.importedHands);
  expect(referenceFinancial(financialInput(data))).toEqual(baseline);
 });
 it.each(['missing','duplicate','reorder','index','hash','previousHash'] as const)('detects raw financial %s corruption',kind=>{
  const data=clone(),ledger=data.ledger as MoneyEvent[];
  if(kind==='missing')ledger.splice(2,1);
  if(kind==='duplicate')ledger.splice(2,0,structuredClone(ledger[2]));
  if(kind==='reorder')[ledger[2],ledger[3]]=[ledger[3],ledger[2]];
  if(kind==='index')ledger[2].index++;
  if(kind==='hash')ledger[2].hash='1'.repeat(64);
  if(kind==='previousHash')ledger[2].previousHash='2'.repeat(64);
  expect(()=>referenceFinancial(data)).toThrow();
 });
 it.each(['wallet','net','session','duplicate-id','double-settlement','double-cashout','cashout-value','manual-poker','transfer','unsafe-number'] as const)('detects %s inconsistency even with independently recomputed event hashes',kind=>{
  const data=clone(),ledger=data.ledger as MoneyEvent[];
  if(kind==='wallet')data.wallet++;
  if(kind==='net')changedEvent(data,'hand-net').pokerNet++;
  if(kind==='session')changedEvent(data,'buy-in').sessionId='absent-session';
  if(kind==='duplicate-id')ledger[2].id=ledger[1].id;
  if(kind==='double-settlement'){const event=structuredClone(changedEvent(data,'hand-net'));event.id+=':duplicate';ledger.push(event);}
  if(kind==='double-cashout'){const event=structuredClone(changedEvent(data,'cash-out'));event.id+=':duplicate';event.walletDelta=0;event.tableDelta=0;ledger.push(event);}
  if(kind==='cashout-value')changedEvent(data,'cash-out').tableDelta++;
  if(kind==='manual-poker')changedEvent(data,'adjustment').pokerNet=10;
  if(kind==='transfer')changedEvent(data,'top-up').walletDelta++;
  if(kind==='unsafe-number')changedEvent(data,'adjustment').walletDelta=Number.MAX_SAFE_INTEGER+1;
  resealLedger(data);expect(()=>referenceFinancial(data)).toThrow();
 });
 it.each(['missing','duplicate','reordered','net','session','epoch','predecessor'] as const)('detects settlement index %s disagreement',kind=>{
  const data=clone(),index=[...data.handIndex];data.handIndex=index;
  if(kind==='missing')index.pop();
  if(kind==='duplicate')index.push(structuredClone(index[0]));
  if(kind==='reordered')[index[0],index[1]]=[index[1],index[0]];
  if(kind==='net')index[0].net++;
  if(kind==='session')index[0].sessionId=index.at(-1)!.sessionId;
  if(kind==='epoch')index[0].epoch++;
  if(kind==='predecessor')index[1].previousHash='0'.repeat(64);
  expect(()=>referenceFinancial(data)).toThrow();
 });
 it.each(['buyins','withdrawals','cashout','order','closed-balance','open-session','hero-stack'] as const)('detects saved %s disagreement against financial replay',kind=>{
  const data=clone();
  if(kind==='buyins')data.sessions[0].buyIns++;
  if(kind==='withdrawals')data.sessions[0].tableWithdrawals=1;
  if(kind==='cashout')data.sessions[0].cashOut++;
  if(kind==='order')data.sessions[0].handIds.reverse();
  if(kind==='closed-balance')data.sessions.at(-1)!.endedAt=new Date(0).toISOString();
  if(kind==='open-session')data.active=null;
  if(kind==='hero-stack')data.active!.game.seats.find(s=>s.id===0)!.stack++;
  expect(()=>referenceFinancial(data)).toThrow();
 });
 it.each(['award','refund','rake','stack','net'] as const)('full audit detects %s hand-body corruption after independently resealing hand chain',kind=>{
  const hands=structuredClone(originals.flop.hands),hand=hands.at(-1)!;
  if(kind==='award')hand.view.events.find(e=>e.type==='award')!.amount!++;
  if(kind==='refund')hand.view.events.push({id:'bogus-refund',handId:hand.id,type:'refund',seatId:0,amount:1,street:'complete',revision:0});
  if(kind==='rake')hand.view.rake++;
  if(kind==='stack')hand.view.seats[0].stack++;
  if(kind==='net')hand.net++;
  let previous='0'.repeat(64);for(const h of hands){h.previousHash=previous;const body:Partial<StoredHand>={...h};delete body.hash;h.hash=referenceHash(body);previous=h.hash;}
  expect(()=>referenceFullHands(hands)).toThrow();
 });
 it('preserves bankroll reset/adjustment separation while an active session retains its original epoch',async()=>{
  const port=new AtomicPort(),c=new SessionController(port);try{
   await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});
   await c.adjustBankroll(222222,'Independent manual reset',true);
   const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);expect(c.error).toBe('');
   await c.topUp(100);await c.cashOut();expect(c.error).toBe('');
   const before=referenceFinancial(financialInput(c.data!));expect(before.poker).toBe(-100);expect(before.table).toBe(0);
   await c.adjustBankroll(333333,'Independent manual edit');
   const after=referenceFinancial(financialInput(c.data!));expect(after.poker).toBe(before.poker);expect(after.wallet).toBe(333333);
   expect(referenceFullHands(c.data!.hands).poker).toBe(after.poker);
  }finally{c.close();}
 });
});
