import { describe, expect, it } from 'vitest';
import type { AppData, PersistencePort } from '../../src/session/types';
import { DEFAULT_SETTINGS, SessionController } from '../../src/session/controller';
import { startHand, legalActions, observeBot } from '../../src/core/engine';
import { canonical, validateData } from '../../src/storage/integrity';
import { rules } from '../../src/session/controller';
import { cancelQueuedConfiguration, cloneNamedPreset, LIVE_ONE_TWO_DISCLOSURE, loadNamedPreset, normalizeTableSettings, occupiedSeatIds, queueTableConfiguration, saveNamedPreset, syntheticLiveOneTwoPreset, tableParticipants, tableProfiles, validateConfigurationData, type ConfigurationData, type TableSettings } from '../../src/session/configuration';

const AT='2026-11-01T12:00:00.000Z';
const seed=(id:number)=>0x6000+id;
const settings=(overrides:Partial<TableSettings>={}):TableSettings=>({...structuredClone(DEFAULT_SETTINGS),...overrides});
class Store implements PersistencePort {
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw new Error('Revision changed');this.data=structuredClone(next);}
 close(){}
}
async function fixture(active=false){
 const store=new Store(),controller=new SessionController(store);await controller.init();
 if(active)await controller.startSession(settings({seats:2,archetypes:['station']}));
 expect(controller.error).toBe('');
 return {controller,store,data:structuredClone(controller.data!) as ConfigurationData};
}
function queue(data:ConfigurationData,config=settings(),id='queue-1'){
 return queueTableConfiguration(data,{id,settings:config,expectedSessionId:data.active!.sessionId,expectedHandId:data.active!.game.handId,at:AT},seed);
}

describe('D02 independent physical table capacity and occupied seats',()=>{
 it('legacy settings keep contiguous occupied IDs and create no invented capacity',()=>{
  expect(occupiedSeatIds(settings({seats:3}))).toEqual([0,1,2]);
  const result=normalizeTableSettings(settings({seats:3}),seed);
  expect(result.capacity).toBe(3);expect(result.occupiedSeatIds).toEqual([0,1,2]);
 });
 it('a ten-position ring with six occupied positions deals only six unique hands',()=>{
  const input=settings({capacity:10,seats:6,occupiedSeatIds:[9,0,6,1,8,3]});
  const resolved=normalizeTableSettings(input,seed),participants=tableParticipants(resolved),profiles=tableProfiles(resolved);
  const game=startHand({handId:'sparse-D02',button:0,profile:rules(resolved),seats:participants});
  expect(game.seats.map(seat=>seat.id)).toEqual([0,1,3,6,8,9]);
  expect(Object.keys(profiles).map(Number)).toEqual([1,3,6,8,9]);
  expect(game.seats.flatMap(seat=>seat.hole)).toHaveLength(12);expect(new Set(game.seats.flatMap(seat=>seat.hole)).size).toBe(12);
  expect(game.smallBlindSeat).toBe(1);expect(game.bigBlindSeat).toBe(3);expect(legalActions(game).actor).toBe(6);
  expect(observeBot(game,6,profiles[6].policyVersion,'private-D02').seats.map(seat=>seat.id)).toEqual([0,1,3,6,8,9]);
  expect(input.opponents).toBeUndefined();
 });
 it.each([
  {capacity:5,seats:6}, {capacity:11}, {capacity:10,seats:6,occupiedSeatIds:[0,1,1,3,4,5]},
  {capacity:10,seats:6,occupiedSeatIds:[1,2,3,4,5,6]}, {capacity:6,seats:6,occupiedSeatIds:[0,1,2,3,4,9]},
  {capacity:10,seats:6,occupiedSeatIds:[0,1,2,3,4]},
 ])('rejects invalid occupancy without silently moving/removing players: %j',overrides=>{
  expect(()=>normalizeTableSettings(settings(overrides),seed)).toThrow();
 });
 it('per-seat stacks respect cents, occupied IDs, and fresh buy-in limits',()=>{
  const config=normalizeTableSettings(settings({capacity:10,seats:2,occupiedSeatIds:[0,9],seatStacks:{0:30000,9:50000}}),seed);
  expect(tableParticipants(config).map(seat=>seat.stack)).toEqual([30000,50000]);
  const invalidStacks:Record<number,number>[]=[{2:30000},{0:1},{0:1.5},{0:1000000}];
  for(const seatStacks of invalidStacks)expect(()=>normalizeTableSettings(settings({seats:2,seatStacks}),seed)).toThrow();
 });
 it('preserves legitimate won/lost carried stacks while a new seat receives its configured buy-in',()=>{
  const old=normalizeTableSettings(settings({seats:2}),seed),game=startHand({handId:'carried',button:0,profile:rules(old),seats:[{id:0,name:'You',stack:100},{id:1,name:'Alex',stack:200000}]});
  const config=normalizeTableSettings(settings({seats:3,minBuyInBB:50,maxBuyInBB:100,buyIn:20000}),seed);
  expect(tableParticipants(config,game).map(seat=>seat.stack)).toEqual(game.seats.map(seat=>seat.stack).concat(20000));
 });
});

describe('D08 and V706 staged configuration freezes the current hand',()=>{
 it('queues blind/rake/roster/stack/personality changes without touching the live hand, money, bot sample, or histories',async()=>{
  const {data}=await fixture(true),before=structuredClone(data),config=settings({capacity:10,seats:3,occupiedSeatIds:[0,4,9],seatStacks:{0:30000,4:40000,9:50000},smallBlind:200,bigBlind:500,rakeMode:'custom',rakeBasisPoints:300,rakeCap:600});
  expect(queue(data,config)).toBe(true);
  expect(data.active!.game).toEqual(before.active!.game);expect(data.active!.profiles).toEqual(before.active!.profiles);expect(data.active!.pending).toEqual(before.active!.pending);
  expect(data.hands).toEqual(before.hands);expect(data.sessions).toEqual(before.sessions);expect(data.ledger).toEqual(before.ledger);expect(data.wallet).toBe(before.wallet);
  expect(data.active!.queuedConfiguration?.settings.occupiedSeatIds).toEqual([0,4,9]);validateConfigurationData(data);await validateData(data);
 });
 it('retrying the same request preserves personality seeds and creates no duplicate queue',async()=>{
  const {data}=await fixture(true);queue(data);const first=structuredClone(data);
  const active=data.active!;
  expect(queueTableConfiguration(data,{id:'queue-1',settings:settings(),expectedSessionId:active.sessionId,expectedHandId:active.game.handId,at:AT},()=>{throw Error('Must not reroll');})).toBe(false);
  expect(data).toEqual(first);
 });
 it('conflicting duplicate configuration IDs fail without replacing the first requested settings',async()=>{
  const {data}=await fixture(true);queue(data);const before=structuredClone(data);
  expect(()=>queue(data,settings({buyIn:30000}))).toThrow('Conflicting');expect(data).toEqual(before);
 });
 it('queue survives a serialized reload unchanged, then can be cancelled exactly once',async()=>{
  const {data}=await fixture(true);queue(data);const restored=JSON.parse(JSON.stringify(data)) as ConfigurationData;
  validateConfigurationData(restored);expect(restored.active!.queuedConfiguration).toEqual(data.active!.queuedConfiguration);
  const before=structuredClone(restored);expect(cancelQueuedConfiguration(restored,restored.active!.sessionId,'queue-1')).toBe(true);
  expect(cancelQueuedConfiguration(restored,restored.active!.sessionId,'queue-1')).toBe(false);expect(restored.active!.game).toEqual(before.active!.game);expect(restored.ledger).toEqual(before.ledger);
 });
 it('rejects stale session/hand/cancel identities and leaves the queued settings intact',async()=>{
  const {data}=await fixture(true);queue(data);const before=structuredClone(data),a=data.active!;
  expect(()=>queueTableConfiguration(data,{id:'stale',settings:settings(),expectedSessionId:'old',expectedHandId:a.game.handId,at:AT},seed)).toThrow('changed');
  expect(()=>queueTableConfiguration(data,{id:'stale',settings:settings(),expectedSessionId:a.sessionId,expectedHandId:'old',at:AT},seed)).toThrow('changed');
  expect(()=>cancelQueuedConfiguration(data,a.sessionId,'different')).toThrow('changed');expect(data).toEqual(before);
 });
 it('does not allow a configuration edit to undo a committed session exit',async()=>{
  const {data}=await fixture(true);data.active!.exitMode='finish';const before=structuredClone(data);
  expect(()=>queue(data)).toThrow('ending');expect(data).toEqual(before);
 });
 it('keeps unchanged opponent identities and older policy versions; only edited seats receive a new profile',()=>{
  const old=normalizeTableSettings(settings({seats:3}),seed),profiles=tableProfiles(old);profiles[1].policyVersion='synthetic-cash-1.2.0';
  const changed=structuredClone(old);changed.opponents![1]={selection:'maniac',personalitySeed:999};
  const next=tableProfiles(changed,old,profiles);
  expect(next[1]).toEqual(profiles[1]);expect(next[1]).not.toBe(profiles[1]);expect(next[2].archetype).toBe('maniac');expect(next[2].personalityId).not.toBe(profiles[2].personalityId);
 });
 it('legacy saved schema-4 data with absent configuration fields still validates',async()=>{
  const {data}=await fixture(true);expect(data.namedPresets).toBeUndefined();expect(data.active!.queuedConfiguration).toBeUndefined();validateConfigurationData(data);await validateData(data);
 });
 it('detects corrupt or obsolete persisted queues instead of repairing silently',async()=>{
  const {data}=await fixture(true);queue(data);data.active!.queuedConfiguration!.requestedHandId='obsolete';expect(()=>validateConfigurationData(data)).toThrow('Obsolete');
 });
});

describe('D10 / U09 named preset save, load, clone and U01 synthetic one-click setup',()=>{
 it('round trips exact seat profiles, seeds, stack targets and rake without creating a session or moving money',async()=>{
  const {data}=await fixture(),before=structuredClone(data),config=settings({capacity:10,seats:3,occupiedSeatIds:[0,3,8],seatStacks:{0:30000,3:40000,8:45000},rakeMode:'custom',rakeBasisPoints:550,rakeCap:700});
  const saved=saveNamedPreset(data,{id:'preset-1',name:'My mixed game',settings:config,at:AT},seed),loaded=loadNamedPreset(data,'preset-1');
  expect(loaded).toEqual(saved.settings);expect(tableProfiles(loaded)).toEqual(tableProfiles(saved.settings));
  expect(data.wallet).toBe(before.wallet);expect(data.active).toBeNull();expect(data.sessions).toEqual(before.sessions);expect(data.hands).toEqual(before.hands);expect(data.ledger).toEqual(before.ledger);
  loaded.buyIn=40000;loaded.opponents![2].selection='nit';expect(data.namedPresets![0].settings).toEqual(saved.settings);validateConfigurationData(data);await validateData(data);
 });
 it('clone and modified rake preserve the original preset and unrelated canonical records byte for byte',async()=>{
  const {data}=await fixture(true),history=canonical(data.hands),live=canonical(data.active);
  saveNamedPreset(data,{id:'source',name:'Original',settings:settings({rakeMode:'custom'}),at:AT},seed);const original=structuredClone(data.namedPresets![0]);
  cloneNamedPreset(data,'source',{id:'copy',name:'Lower rake',at:AT});const modified=loadNamedPreset(data,'copy');modified.rakeBasisPoints=250;modified.rakeCap=100;
  saveNamedPreset(data,{id:'copy',name:'Lower rake',settings:modified,at:'2026-11-01T13:00:00.000Z'},seed);
  expect(data.namedPresets!.find(preset=>preset.id==='source')).toEqual(original);expect(loadNamedPreset(data,'copy').rakeCap).toBe(100);expect(canonical(data.active)).toBe(live);expect(canonical(data.hands)).toBe(history);
 });
 it('updating a saved preset with unresolved input reuses its identities, while explicitly changed seeds are honored',async()=>{
  const {data}=await fixture();const input=settings({seats:2,opponents:[{selection:'random'}]});
  saveNamedPreset(data,{id:'saved',name:'Stable',settings:input,at:AT},seed);const first=loadNamedPreset(data,'saved');
  saveNamedPreset(data,{id:'saved',name:'Stable',settings:input,at:AT},()=>{throw Error('Rerolled identity');});expect(loadNamedPreset(data,'saved')).toEqual(first);
  input.opponents![0].personalitySeed=123;saveNamedPreset(data,{id:'saved',name:'Stable',settings:input,at:AT},seed);expect(loadNamedPreset(data,'saved').opponents![0].personalitySeed).toBe(123);
 });
 it('rejects ambiguous names and cloned duplicate IDs without overwriting existing presets',async()=>{
  const {data}=await fixture();saveNamedPreset(data,{id:'one',name:'Original',settings:settings(),at:AT},seed);const before=structuredClone(data);
  expect(()=>saveNamedPreset(data,{id:'two',name:' original ',settings:settings(),at:AT},seed)).toThrow('name');
  expect(()=>cloneNamedPreset(data,'one',{id:'one',name:'Another',at:AT})).toThrow('identity');expect(data).toEqual(before);
 });
 it('synthetic live $1/$2 preset is nine handed, $300, editable, and explicitly not venue-calibrated',()=>{
  const input=settings({capacity:10,seats:2,occupiedSeatIds:[0,9],seatStacks:{0:50000,9:60000},bigBlind:1000,smallBlind:500,buyIn:50000}),before=structuredClone(input);
  const preset=syntheticLiveOneTwoPreset(input,seed);expect(preset).toMatchObject({capacity:9,seats:9,smallBlind:100,bigBlind:200,buyIn:30000,population:'low'});expect(preset.occupiedSeatIds).toEqual([0,1,2,3,4,5,6,7,8]);
  expect(preset.seatStacks).toBeUndefined();expect(LIVE_ONE_TWO_DISCLOSURE).toMatch(/Synthetic.*not measured/);preset.rakeCap=800;expect(input).toEqual(before);
 });
 it('persisted duplicate presets are rejected without deleting any saved records',async()=>{
  const {data}=await fixture();saveNamedPreset(data,{id:'one',name:'Original',settings:settings(),at:AT},seed);data.namedPresets!.push(structuredClone(data.namedPresets![0]));const before=structuredClone(data);
  expect(()=>validateConfigurationData(data)).toThrow('Duplicate');expect(data).toEqual(before);
 });
});
