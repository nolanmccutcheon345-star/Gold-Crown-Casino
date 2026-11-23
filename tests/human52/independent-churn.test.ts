import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {legalActions} from '../../src/core/engine';
import {planChurn} from '../../src/session/churn';
import {normalizeTableSettings,validateConfigurationData} from '../../src/session/configuration';
import {regularConfig} from '../../src/bots/regulars';
import {HUMAN_LAYER_V12,HUMAN_LAYER_V13} from '../../src/bots/human';

class Port implements PersistencePort {
 value:AppData|null=null;
 async load(){return structuredClone(this.value);}
 async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(next);}
 close(){}
}
async function start(short=false){const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:9,...(short?{minBuyInBB:1,seatStacks:Object.fromEntries(Array.from({length:8},(_,i)=>[i+1,DEFAULT_SETTINGS.bigBlind]))}:{} )});expect(c.error).toBe('');return {c,port};}
async function finish(c:SessionController){for(let step=0;c.data!.active!.game.street!=='complete'&&step<300;step++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}

describe('independent cash churn integrity',()=>{
 it('uses real controller transfers, retains historical names and reloads exactly without moving Hero money',async()=>{
  const started=await start(true),port=started.port;let c=started.c,churns=0;
  for(let hand=0;hand<18;hand++){
   await finish(c);if(c.data!.active!.game.seats[0].stack===0)await c.topUp(DEFAULT_SETTINGS.buyIn);
   const before=c.data!,wallet=before.wallet,ledger=JSON.stringify(before.ledger),hero=before.active!.game.seats[0].stack,history=JSON.stringify(before.hands);
   await c.nextHand();expect(c.error).toBe('');const after=c.data!;
   expect(after.wallet).toBe(wallet);expect(JSON.stringify(after.ledger)).toBe(ledger);expect(after.active!.game.seats[0].startingStack).toBe(hero);
   expect(JSON.stringify(after.hands)).toBe(history);expect(after.sessions.at(-1)!.settings.seatNames).toBeUndefined();expect(after.sessions.at(-1)!.settings.seatStacks).toBeUndefined();
   expect(new Set(after.active!.game.seats.map(s=>s.name)).size).toBe(after.active!.game.seats.length);
   if(after.active!.churnNews){churns++;const expected=JSON.stringify(after);c.close();c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(JSON.stringify(c.data)).toBe(expected);}
  }
  expect(churns).toBeGreaterThan(0);c.close();
 },120000);
 it('never leaves a busted occupied bot unfunded merely because one replacement already happened',async()=>{
  const {c}=await start(),d=structuredClone(c.data!),a=d.active!;for(const seat of a.game.seats)if(seat.id!==0)seat.stack=0;
  for(let seed=0;seed<25;seed++){a.game.handId=`simultaneous-bust:${seed}`;const plan=planChurn(d,a)!;expect(plan.settings.seatStacks?.[0]).toBeUndefined();expect(plan.news.filter(s=>s.includes('sits down')).length).toBeLessThanOrEqual(1);
   for(const seat of a.game.seats.filter(s=>s.id!==0))expect(plan.settings.seatStacks?.[seat.id],`unfunded seat ${seat.id}, seed ${seed}`).toBe(DEFAULT_SETTINGS.buyIn);
  }c.close();
 });
 it('uses cumulative verified session facts after the resident hand tail was compacted',async()=>{
  const {c}=await start(),d=structuredClone(c.data!),a=d.active!;d.hands=[];d.humanMemory!.sessionId=a.sessionId;
  for(const [seat,p]of Object.entries(a.profiles)){d.humanMemory!.facts[p.personalityId!]={hands:250,netBB:150};a.game.seats.find(s=>s.id===Number(seat))!.stack=DEFAULT_SETTINGS.buyIn;}
  let found=false;for(let seed=0;seed<2000&&!found;seed++){a.game.handId=`cumulative-churn:${seed}`;const plan=planChurn(d,a);found=!!plan?.news.some(line=>line.includes('sits down'));}expect(found).toBe(true);c.close();
 });
 it('validates one-time names and rejects ambiguous participant identities',()=>{
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,seats:3,seatNames:{0:'Replacement'}})).toThrow();
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,seats:3,seatNames:{1:'You'}})).toThrow();
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,seats:3,seatNames:{1:'Same',2:'Same'}})).toThrow();
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,seats:3,opponents:[regularConfig('priya'),regularConfig('sal')],seatNames:{1:'Other person'}})).toThrow();
 });
 it('consumes an explicit stranger name at session start and preserves it after reload',async()=>{
  const port=new Port();let c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:3,seatNames:{1:'Ray'}});expect(c.error).toBe('');
  expect(c.data!.active!.game.seats.find(seat=>seat.id===1)!.name).toBe('Ray');expect(c.data!.sessions.at(-1)!.settings.seatNames).toBeUndefined();c.close();
  c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(c.data!.active!.game.seats.find(seat=>seat.id===1)!.name).toBe('Ray');expect(c.data!.sessions.at(-1)!.settings.seatNames).toBeUndefined();c.close();
 });
 it('rejects a new name colliding with an unchanged seat before taking Hero buy-in',async()=>{
  const c=new SessionController(new Port());await c.init();const wallet=c.data!.wallet;await c.startSession({...DEFAULT_SETTINGS,seats:3,seatNames:{1:'Morgan'}});expect(c.error).toMatch(/unique/);expect(c.data!.active).toBeNull();expect(c.data!.wallet).toBe(wallet);c.close();
 });
 it('respects disabled top-ups and does not change fractional chip denominations',async()=>{
  const {c}=await start(),d=structuredClone(c.data!),a=d.active!;d.sessions.at(-1)!.settings.allowTopUp=false;d.sessions.at(-1)!.settings.chipUnit=100;
  for(const seat of a.game.seats)if(seat.id!==0)seat.stack=1000;
  for(let seed=0;seed<50;seed++){a.game.handId=`disabled-topup:${seed}`;expect(planChurn(d,a)).toBeNull();}
  // Explicit name commands do not make illegal stack targets legal.
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,seats:3,chipUnit:100,seatNames:{1:'Ray'},seatStacks:{1:20001}})).toThrow(/denomination/);c.close();
 });
 it('rejects malformed or stale persisted table-news metadata before rendering',async()=>{
  const {c}=await start();for(const news of [{handId:c.data!.active!.game.handId,lines:'bad'},{handId:'old-hand',lines:['Nina rebuys.']},{handId:c.data!.active!.game.handId,lines:[null]}]){
   const bad=structuredClone(c.data!);bad.active!.churnNews=news as never;expect(()=>validateConfigurationData(bad)).toThrow();
  }c.close();
 });
 it('keeps a saved 1.2 table frozen across a prepared action reload and hand boundary',async()=>{
  const {c:first,port}=await start();port.value!.active!.humanLayer=HUMAN_LAYER_V12;first.close();let c=new SessionController(port);await c.init();expect(c.error).toBe('');
  while(c.data!.active!.game.actor===0){const g=c.data!.active!.game;await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);}
  await c.prepareBot();const pending=structuredClone(c.data!.active!.pending),profiles=structuredClone(c.data!.active!.profiles);c.close();c=new SessionController(port);await c.init();expect(c.error).toBe('');expect(c.data!.active!.pending).toEqual(pending);expect(c.data!.active!.profiles).toEqual(profiles);
  await finish(c);const prior=c.data!.active!,names=prior.game.seats.map(s=>s.name),stacks=prior.game.seats.map(s=>s.stack);if(stacks[0]===0)await c.topUp(DEFAULT_SETTINGS.buyIn);
  await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.humanLayer).toBe(HUMAN_LAYER_V12);expect(c.data!.active!.humanLayer).not.toBe(HUMAN_LAYER_V13);expect(c.data!.active!.churnNews).toBeUndefined();expect(c.data!.active!.game.seats.map(s=>s.name)).toEqual(names);expect(c.data!.active!.profiles).toEqual(profiles);c.close();
 },60000);
});
