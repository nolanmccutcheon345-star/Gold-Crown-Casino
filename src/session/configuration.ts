import type { BotProfile, GameState, OpponentConfig, RuleProfile } from '../contracts';
import { createProfile, POLICY_VERSION, resolveConfig } from '../bots/profiles';
import { regularFor, isRegularName, regularById } from '../bots/regulars';
import { pokerStarsProfile } from '../rules/pokerstars';
import { appendMoney, canonical, cents, requireData } from '../storage/integrity';
import type { AppData, CashSettings } from './types';
import { assertSupportedCashScope } from './release-scope';

/** Capacity is the physical ring; seats is the number of occupied positions.
 * Opponent settings are indexed by physical seat ID minus one, never by order in
 * the occupied list. Absent additions retain the schema-4 contiguous layout. */
export type TableSettings = CashSettings;
export type NamedTablePreset = NonNullable<AppData['namedPresets']>[number];
export type QueuedTableConfiguration = NonNullable<NonNullable<AppData['active']>['queuedConfiguration']>;
export type ConfigurationData = AppData;
export type SeedForSeat = (seatId:number)=>number;
const seedForSeat:SeedForSeat = ()=>crypto.getRandomValues(new Uint32Array(1))[0];
const NAMES=['You','Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'];
const textId=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=160;
function timestamp(value:string):void { requireData(typeof value==='string'&&Number.isFinite(Date.parse(value)),'Invalid configuration timestamp.'); }

export function occupiedSeatIds(settings:TableSettings):number[] {
 const capacity=settings.capacity??settings.seats;
 requireData(Number.isInteger(capacity)&&capacity>=2&&capacity<=10,'Choose a table capacity from 2 to 10.');
 requireData(Number.isInteger(settings.seats)&&settings.seats>=2&&settings.seats<=capacity,'Choose 2 or more occupied seats within the table capacity.');
 const ids=settings.occupiedSeatIds??Array.from({length:settings.seats},(_,id)=>id);
 requireData(Array.isArray(ids)&&ids.length===settings.seats&&new Set(ids).size===ids.length&&ids.includes(0)&&ids.every(id=>Number.isInteger(id)&&id>=0&&id<capacity),'Occupied seat IDs must be unique, include Hero, and fit the capacity.');
 return [...ids].sort((a,b)=>a-b);
}

/** Resolves identity once before queueing/saving. Random selections thereafter
 * restore the same personality; only an explicit new seed changes an identity. */
export function normalizeTableSettings(settings:TableSettings,randomSeed:SeedForSeat=seedForSeat):TableSettings {
 assertSupportedCashScope(settings);
 requireData(settings&&typeof settings==='object','Table settings are required.');
 const occupied=occupiedSeatIds(settings),capacity=settings.capacity??settings.seats,chipUnit=settings.chipUnit??1;
 requireData(cents(chipUnit)&&chipUnit>0,'Chip denomination must be a positive integer number of cents.');
 requireData(cents(settings.smallBlind)&&settings.smallBlind>0&&cents(settings.bigBlind)&&settings.bigBlind>=settings.smallBlind,'Invalid blinds.');
 requireData(cents(settings.minBuyInBB)&&settings.minBuyInBB>=1&&cents(settings.maxBuyInBB)&&settings.maxBuyInBB>=settings.minBuyInBB&&settings.maxBuyInBB<=10000,'Invalid table buy-in limits.');
 const minimum=settings.minBuyInBB*settings.bigBlind,maximum=settings.maxBuyInBB*settings.bigBlind;
 requireData(Number.isSafeInteger(maximum)&&cents(settings.buyIn)&&settings.buyIn>=minimum&&settings.buyIn<=maximum,'Buy-in is outside the configured table limits.');
 requireData(settings.smallBlind%chipUnit===0&&settings.bigBlind%chipUnit===0&&settings.buyIn%chipUnit===0,'Blinds and buy-in must use whole chip denominations.');
 requireData(['none','custom','pokerstars-usd-2026'].includes(settings.rakeMode),'Unsupported rake mode.');
 if(settings.rakeMode==='pokerstars-usd-2026'){requireData(chipUnit===1,'The sourced USD rake profile requires one-cent chips.');pokerStarsProfile(settings.smallBlind,settings.bigBlind);}
 requireData(cents(settings.rakeBasisPoints)&&settings.rakeBasisPoints<=10000&&cents(settings.rakeCap)&&typeof settings.noFlopNoDrop==='boolean','Invalid rake settings.');
 requireData(settings.rakeMode!=='custom'||settings.rakeCap%chipUnit===0,'Custom rake cap must use whole chip denominations.');
 requireData(!Object.prototype.hasOwnProperty.call(settings,'straddle'),'Use the liveStraddle setting, not a raw straddle rule.');
 requireData(settings.liveStraddle===undefined||typeof settings.liveStraddle==='boolean','Invalid straddle setting.');
 requireData(typeof settings.allowTopUp==='boolean'&&typeof settings.stake==='string'&&settings.stake.length<=160,'Invalid table settings.');
 requireData(Array.isArray(settings.archetypes)&&settings.archetypes.length<=9,'Invalid archetype settings.');
 requireData(settings.opponents===undefined||(Array.isArray(settings.opponents)&&settings.opponents.length<=9),'Invalid opponent settings.');
 const population=settings.population??'neutral',tableMode=settings.tableMode??'live';
 requireData(['low','mid','high','neutral'].includes(population),'Unknown synthetic population preset.');
 requireData(tableMode==='live'||tableMode==='study','Unknown table mode.');
 requireData(validChallenge(settings.challenge),'Invalid heads-up challenge.');
 if(settings.seatNames!==undefined){
  requireData(settings.seatNames!==null&&typeof settings.seatNames==='object'&&!Array.isArray(settings.seatNames),'Invalid seat names.');
  for(const [key,name] of Object.entries(settings.seatNames)){const regular=regularFor(settings.opponents?.[Number(key)-1]);requireData(!regular||name===regular.name,'A regular must keep their own name.');requireData(/^[1-9]$/.test(key)&&occupied.includes(Number(key))&&typeof name==='string'&&name.trim().toLowerCase()!=='you'&&name.trim().length>=1&&name.length<=24,'A new seat name must belong to an occupied opponent seat and have 1–24 characters.');}
  requireData(new Set(Object.values(settings.seatNames)).size===Object.keys(settings.seatNames).length,'New seat names must be unique.');
 }
 if(settings.seatStacks!==undefined){
  requireData(settings.seatStacks!==null&&typeof settings.seatStacks==='object'&&!Array.isArray(settings.seatStacks),'Invalid seat stack settings.');
  for(const [key,stack] of Object.entries(settings.seatStacks))requireData(/^[0-9]$/.test(key)&&occupied.includes(Number(key))&&cents(stack)&&stack>=minimum&&stack<=maximum&&stack%chipUnit===0,'An explicit seat stack must belong to an occupied seat and satisfy buy-in limits and chip denomination.');
 }
 const opponents:OpponentConfig[]=Array.from({length:capacity-1},(_,index)=>{
  const config=settings.opponents?.[index]??{selection:settings.archetypes[index]??'tag'};
  return resolveConfig(config,config.personalitySeed??randomSeed(index+1));
 });
 return {...structuredClone(settings),capacity,occupiedSeatIds:occupied,population,tableMode,opponents};
}

/** Carried stacks may legitimately fall below a fresh buy-in minimum or exceed
 * its maximum. Only explicit new stack targets are constrained by those limits. */
export function tableParticipants(settings:TableSettings,previous?:GameState):{id:number;name:string;stack:number}[] {
 const unit=settings.chipUnit??1;
 return occupiedSeatIds(settings).map(id=>{const old=previous?.seats.find(seat=>seat.id===id),regular=id>0?regularFor(settings.opponents?.[id-1]):undefined;
  // A seated regular always shows their own name; a seat that stops being a regular goes back to its default name.
  const name=settings.seatNames?.[id]??regular?.name??(old&&!isRegularName(old.name)?old.name:NAMES[id]);return {id,name,stack:settings.seatStacks?.[id]??(old?Math.floor(old.stack/unit)*unit:settings.buyIn)};});
}
export function tableProfiles(settings:TableSettings,previousSettings?:TableSettings,previousProfiles?:Record<number,BotProfile>):Record<number,BotProfile> {
 const profiles:Record<number,BotProfile>={};
 for(const id of occupiedSeatIds(settings).filter(id=>id!==0)){
  const config=settings.opponents?.[id-1];
  requireData(config&&config.personalitySeed!==undefined,'Resolve opponent identities before creating a table.');
  const unchanged=previousProfiles?.[id]&&((settings.chipUnit??1)===1||previousProfiles[id].policyVersion===POLICY_VERSION)&&(previousSettings?.population??'neutral')===(settings.population??'neutral')&&canonical(previousSettings?.opponents?.[id-1])===canonical(config);
  profiles[id]=unchanged?structuredClone(previousProfiles[id]):createProfile(config,config.personalitySeed,settings.population??'neutral');
 }
 return profiles;
}

export interface ConfigurationRequest { id:string; settings:TableSettings; expectedSessionId:string; expectedHandId:string; at:string }
export function queueTableConfiguration(data:ConfigurationData,request:ConfigurationRequest,randomSeed:SeedForSeat=seedForSeat):boolean {
 const active=data.active;
 requireData(active&&active.sessionId===request.expectedSessionId&&active.game.handId===request.expectedHandId,'This session or hand has changed. Review the current table before configuring it.');
 requireData(!active.exitMode,'This session is ending; finish it before configuring another session.');
 requireData(textId(request.id),'Configuration identity required.');timestamp(request.at);
 if(active.lastAppliedConfigurationId===request.id)return false;
 const prior=active.queuedConfiguration;
 const currentSettings=data.sessions.find(session=>session.id===active.sessionId)?.settings;
 const normalized=normalizeTableSettings(request.settings,id=>(prior?.id===request.id?prior.settings.opponents?.[id-1]?.personalitySeed:currentSettings?.opponents?.[id-1]?.personalitySeed)??randomSeed(id));
 if(prior?.id===request.id){requireData(canonical(prior.settings)===canonical(normalized),'Conflicting configuration identity.');return false;}
 active.queuedConfiguration={id:request.id,sessionId:active.sessionId,requestedHandId:active.game.handId,settings:normalized,queuedAt:request.at};
 return true;
}
export function cancelQueuedConfiguration(data:ConfigurationData,expectedSessionId:string,requestId:string):boolean {
 requireData(data.active?.sessionId===expectedSessionId,'The session changed before cancelling its configuration.');
 const queued=data.active.queuedConfiguration;if(!queued)return false;
 requireData(queued.id===requestId,'The queued configuration changed. Review it before cancelling.');
 delete data.active.queuedConfiguration;return true;
}

export interface ConfigurationBoundary {
 reconfigure:(previous:GameState,seats:{id:number;name:string;stack:number}[],profile:RuleProfile,transferId:string)=>GameState;
 rules:(settings:CashSettings)=>RuleProfile; at:string;
}
/** Internal controller operation only. Invoke immediately before engine.nextHand
 * in the SAME atomic candidate; never persist/render its transitional game. The
 * settled StoredHand remains immutable; all financial changes are external
 * table transfers and cannot enter poker P&L. */
export async function applyQueuedConfiguration(data:ConfigurationData,boundary:ConfigurationBoundary):Promise<boolean> {
 const active=data.active,queued=active?.queuedConfiguration;if(!active||!queued)return false;
 requireData(active.game.street==='complete'&&active.game.actor===null,'Finish and settle the current hand before applying its queued configuration.');
 requireData(!active.exitMode&&queued.sessionId===active.sessionId&&queued.requestedHandId===active.game.handId,'Queued configuration is obsolete.');
 requireData(data.hands.some(hand=>hand.id===active.game.handId&&hand.sessionId===active.sessionId),'Record the completed hand before reconfiguring the table.');
 requireData(active.lastAppliedConfigurationId!==queued.id,'Configuration was already applied.');
 timestamp(boundary.at);
 const session=data.sessions.find(session=>session.id===active.sessionId&&session.endedAt===null);requireData(session,'Active session is missing.');
 const settings=normalizeTableSettings(queued.settings,()=>{throw new Error('Queued opponent identity is missing.');});
 const seats=tableParticipants(settings,active.game);
 if(settings.seatNames)requireData(new Set(seats.map(seat=>seat.name)).size===seats.length,'Newcomer names must be unique at the table.');
 const hero=active.game.seats.find(seat=>seat.id===0)!;
 const heroTarget=seats.find(seat=>seat.id===0)!.stack,delta=heroTarget-hero.stack;
 requireData(Number.isSafeInteger(delta)&&data.wallet>=delta,'Insufficient wallet funds for the queued Hero stack. Adjust or cancel the queued configuration.');
 requireData(seats.filter(seat=>seat.stack>0).length>=2&&heroTarget>0,'At least two funded seats including Hero are required. Set a new stack for a busted seat.');
 // Complete validation and engine calculation before publishing any candidate
 // changes. Persist failure is handled by SessionController's existing CAS.
 const profiles=tableProfiles(settings,session.settings,active.profiles),profile=boundary.rules(settings),transferId=`configuration:${queued.id}`;
 requireData(!data.ledger.some(event=>event.id===transferId),'Configuration transfer was already recorded.');
 const game=boundary.reconfigure(active.game,seats,profile,transferId);
 if(delta!==0){
  await appendMoney(data,{id:transferId,at:boundary.at,epoch:data.epoch,kind:'table-adjustment',walletDelta:-delta,tableDelta:delta,pokerNet:0,sessionId:session.id,note:'Next-hand Hero stack adjustment; external transfer, not poker winnings'});
  if(delta>0)session.buyIns+=delta;else session.tableWithdrawals=(session.tableWithdrawals??0)-delta;
 }
 active.game=game;active.profiles=profiles;active.pending=null;
 session.settings=structuredClone(settings);session.profile=structuredClone(profile);
 // Stack targets are consumed commands, not a recurring reset of earned stacks.
 // Named presets separately retain exact initial buy-in targets for future tables.
 delete session.settings.seatStacks;delete session.settings.seatNames;
 active.lastAppliedConfigurationId=queued.id;delete active.queuedConfiguration;
 return true;
}

function presetName(name:string):string { requireData(typeof name==='string'&&name.trim().length>0&&name.trim().length<=80,'Enter a preset name of 1–80 characters.');return name.trim(); }
export function saveNamedPreset(data:ConfigurationData,input:{id:string;name:string;settings:TableSettings;at:string},randomSeed:SeedForSeat=seedForSeat):NamedTablePreset {
 requireData(textId(input.id),'Preset identity required.');timestamp(input.at);const name=presetName(input.name),presets=data.namedPresets??[];
 requireData(!presets.some(preset=>preset.id!==input.id&&preset.name.toLowerCase()===name.toLowerCase()),'A preset with this name already exists.');
 const prior=presets.find(preset=>preset.id===input.id),settings=normalizeTableSettings(input.settings,id=>prior?.settings.opponents?.[id-1]?.personalitySeed??randomSeed(id));
 const saved:NamedTablePreset={id:input.id,name,version:1,createdAt:prior?.createdAt??input.at,updatedAt:input.at,settings};
 data.namedPresets=[...presets.filter(preset=>preset.id!==input.id),saved];return structuredClone(saved);
}
export function loadNamedPreset(data:ConfigurationData,presetId:string):TableSettings {
 const preset=data.namedPresets?.find(preset=>preset.id===presetId);requireData(preset,'Saved preset was not found.');
 return structuredClone(preset.settings);
}
export function cloneNamedPreset(data:ConfigurationData,sourceId:string,input:{id:string;name:string;at:string}):NamedTablePreset {
 requireData(input.id!==sourceId&&!data.namedPresets?.some(preset=>preset.id===input.id),'A cloned preset needs a fresh identity.');
 return saveNamedPreset(data,{...input,settings:loadNamedPreset(data,sourceId)});
}

export const LIVE_ONE_TWO_DISCLOSURE='Synthetic live-style $1/$2 lineup; designed for practice, not measured venue data. All settings are editable.';
export function syntheticLiveOneTwoPreset(base:TableSettings,randomSeed:SeedForSeat=seedForSeat):TableSettings {
 // Live $1/$2 is played with $1 chips. Keep the base unit only where a saved rake rule needs finer chips.
 const chipUnit=base.rakeMode==='pokerstars-usd-2026'||(base.rakeMode==='custom'&&base.rakeCap%100!==0)?base.chipUnit:100;
 return normalizeTableSettings({...structuredClone(base),chipUnit,seats:9,capacity:9,occupiedSeatIds:[0,1,2,3,4,5,6,7,8],seatStacks:undefined,stake:'0',smallBlind:100,bigBlind:200,buyIn:30000,population:'low',archetypes:['station','passive-reg','nit','tag','station','fit-or-fold','maniac','passive-reg'],opponents:undefined,minBuyInBB:Math.min(base.minBuyInBB,150),maxBuyInBB:Math.max(base.maxBuyInBB,150)},randomSeed);
}

/** Optional schema-4 fields are validated on load, not silently repaired. */
export function validateConfigurationData(data:ConfigurationData,prior?:ConfigurationData):void {
 if(data.namedPresets!==undefined&&data.namedPresets!==prior?.namedPresets){
  requireData(Array.isArray(data.namedPresets)&&new Set(data.namedPresets.map(preset=>preset.id)).size===data.namedPresets.length,'Duplicate or invalid saved preset identities.');
  requireData(new Set(data.namedPresets.map(preset=>preset.name?.trim().toLowerCase())).size===data.namedPresets.length,'Duplicate saved preset names.');
  for(const preset of data.namedPresets){requireData(preset.version===1&&textId(preset.id),'Unsupported saved preset.');presetName(preset.name);timestamp(preset.createdAt);timestamp(preset.updatedAt);normalizeTableSettings(preset.settings,()=>{throw new Error('Saved preset identity is missing.');});}
 }
 for(let i=0;i<data.sessions.length;i++){
  const session=data.sessions[i];if(prior?.sessions[i]===session)continue;
  const settings=session.settings;
  requireData(settings.liveStraddle===undefined||typeof settings.liveStraddle==='boolean','Invalid saved live straddle setting.');
  requireData(!Object.prototype.hasOwnProperty.call(settings,'straddle'),'Unexpected saved straddle rule in table settings.');
  requireData(validChallenge(settings.challenge),'Invalid saved heads-up challenge.');
  if(settings!==prior?.sessions[i]?.settings)assertSupportedCashScope(settings);
  if(settings!==prior?.sessions[i]?.settings&&(settings.capacity!==undefined||settings.occupiedSeatIds!==undefined||settings.seatStacks!==undefined||settings.seatNames!==undefined))normalizeTableSettings(settings,()=>0);
  requireData(session.tableWithdrawals===undefined||cents(session.tableWithdrawals),'Invalid table withdrawal total.');
 }
 requireData(data.active?.heroStraddle===undefined||typeof data.active.heroStraddle==='boolean','Invalid Hero straddle preference.');
 const news=data.active?.churnNews;
 if(news!==undefined)requireData(news!==null&&typeof news==='object'&&(data.active?.humanLayer==='human-1.3.0'||data.active?.humanLayer==='human-1.4.0'||data.active?.humanLayer==='human-1.5.0'||data.active?.humanLayer==='human-1.6.0'||data.active?.humanLayer==='human-1.7.0'||data.active?.humanLayer==='human-1.8.0'||data.active?.humanLayer==='human-1.9.0'||data.active?.humanLayer==='human-1.10.0'||data.active?.humanLayer==='human-1.11.0'||data.active?.humanLayer==='human-1.12.0'||data.active?.humanLayer==='human-1.13.0'||data.active?.humanLayer==='human-1.14.0'||data.active?.humanLayer==='human-1.15.0'||data.active?.humanLayer==='human-1.16.0'||data.active?.humanLayer==='human-1.17.0'||data.active?.humanLayer==='human-1.18.0'||data.active?.humanLayer==='human-1.19.0'||data.active?.humanLayer==='human-1.20.0'||data.active?.humanLayer==='human-1.21.0')&&news.handId===data.active.game.handId&&Array.isArray(news.lines)&&news.lines.length>0&&news.lines.length<=9&&news.lines.every(line=>typeof line==='string'&&line.length>0&&line.length<=160),'Invalid table news.');
 const orbit=data.active?.lastOrbit;
 if(orbit!==undefined)requireData(orbit!==null&&typeof orbit==='object'&&!Array.isArray(orbit)&&data.active?.humanLayer!==undefined&&Number(data.active.humanLayer.split('.')[1])>=15&&Object.entries(orbit).every(([seat,o])=>/^[1-9]$/.test(seat)&&o!==null&&typeof o==='object'&&typeof o.personalityId==='string'&&o.personalityId.length>0&&Number.isSafeInteger(o.until)&&o.until>=0&&['racks up and leaves','calls it a night','leaves the table','books the win and leaves'].includes(o.why)),'Invalid announced last orbit.');
 const queued=data.active?.queuedConfiguration;
 if(queued){
  requireData(textId(queued.id)&&queued.sessionId===data.active!.sessionId&&queued.requestedHandId===data.active!.game.handId,'Obsolete or invalid queued configuration.');timestamp(queued.queuedAt);
  if(queued!==prior?.active?.queuedConfiguration)normalizeTableSettings(queued.settings,()=>{throw new Error('Queued opponent identity is missing.');});
 }
 requireData(data.active?.lastAppliedConfigurationId===undefined||textId(data.active.lastAppliedConfigurationId),'Invalid applied configuration identity.');
}

/** Patch 73: a heads-up challenge names its ladder rung and its one opponent, a known regular. */
export function validChallenge(challenge:unknown):boolean {
 if(challenge===undefined)return true;
 const c=challenge as {rung?:unknown;opponent?:unknown};
 return !!c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).length===2&&Number.isInteger(c.rung)&&(c.rung as number)>=0&&(c.rung as number)<20&&typeof c.opponent==='string'&&!!regularById(c.opponent);
}
