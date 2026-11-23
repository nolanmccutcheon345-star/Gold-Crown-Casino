import type {OpponentConfig,PopulationPreset,RuleProfile} from '../contracts';
import type {AppData,CashSettings,PublicHand,StoredHand} from './types';
import {ruleProfileFingerprint} from './hand-provenance';
import {validateRake} from '../rules/rake';

export type ConfigurationChangeReason='session-start'|'next-hand-configuration'|'next-hand-table-change'|'first-recorded-boundary';
export interface RecordedCashConfiguration {
 version:1;id:string;sequence:number;sessionId:string;effectiveHandNumber:number;effectiveHandId:string;recordedAt:string;reason:ConfigurationChangeReason;
 evidenceStatus:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED';population:PopulationPreset;tableMode:'live'|'study';capacity:number;occupiedSeatIds:number[];
 selectionMix:{selection:OpponentConfig['selection'];count:number}[];
 rules:{id:string;version:string;fingerprint:string;smallBlind:number;bigBlind:number;chipUnit:number;rake:RuleProfile['rake']};
 policyVersions:string[];
}
const selections=['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg','random','unknown','custom'];
const reasons=['session-start','next-hand-configuration','next-hand-table-change','first-recorded-boundary'];
const keys=['version','id','sequence','sessionId','effectiveHandNumber','effectiveHandId','recordedAt','reason','evidenceStatus','population','tableMode','capacity','occupiedSeatIds','selectionMix','rules','policyVersions'];
function requireHistory(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const integer=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
const identity=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=200;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function exact(value:unknown,expected:string[]):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===expected.length&&Object.keys(value).every(key=>expected.includes(key));}
function description(settings:CashSettings,game:NonNullable<AppData['active']>['game'],profiles:NonNullable<AppData['active']>['profiles']){
 const occupiedSeatIds=game.seats.map(seat=>seat.id).sort((a,b)=>a-b),counts=new Map<OpponentConfig['selection'],number>();
 for(const seat of occupiedSeatIds.filter(id=>id!==0)){const selection=settings.opponents?.[seat-1]?.selection??settings.archetypes[seat-1]??'tag';counts.set(selection,(counts.get(selection)??0)+1);}
 const p=game.profile;
 return {evidenceStatus:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED' as const,population:settings.population??'neutral',tableMode:settings.tableMode??'live',capacity:settings.capacity??settings.seats,occupiedSeatIds,
  selectionMix:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([selection,count])=>({selection,count})),
  rules:{id:p.id,version:p.version,fingerprint:ruleProfileFingerprint(p),smallBlind:p.smallBlind,bigBlind:p.bigBlind,chipUnit:p.chipUnit,rake:structuredClone(p.rake)},
  policyVersions:[...new Set(occupiedSeatIds.filter(id=>id!==0).map(id=>profiles[id]?.policyVersion).filter((version):version is string=>typeof version==='string'))].sort(),
 };
}
function facts(entry:RecordedCashConfiguration){return {evidenceStatus:entry.evidenceStatus,population:entry.population,tableMode:entry.tableMode,capacity:entry.capacity,occupiedSeatIds:entry.occupiedSeatIds,selectionMix:entry.selectionMix,rules:entry.rules,policyVersions:entry.policyVersions};}
/** Call only after the actual engine has started a new hand. No settings change
 * is recorded for the old hand while a request is merely queued. */
export function recordConfigurationBoundary(data:AppData,explicitChange=false):void {
 const active=data.active;requireHistory(active&&active.frames.length===1&&active.frames[0].handId===active.game.handId,'Configuration provenance requires a newly started hand.');
 const session=data.sessions.find(s=>s.id===active.sessionId);requireHistory(session,'Configuration session is missing.');
 const previous=session.configurationHistory?.at(-1),current=description(session.settings,active.game,active.profiles);
 if(previous&&!explicitChange&&same(facts(previous),current)){active.configuration=previous;return;}
 const sequence=(previous?.sequence??0)+1;
 const entry:RecordedCashConfiguration={version:1,id:`${session.id}:configuration:${sequence}`,sequence,sessionId:session.id,effectiveHandNumber:active.number,effectiveHandId:active.game.handId,recordedAt:active.startedAt,
  reason:previous?explicitChange?'next-hand-configuration':'next-hand-table-change':active.number===1?'session-start':'first-recorded-boundary',...current};
 session.configurationHistory=[...(session.configurationHistory??[]),entry];active.configuration=entry;
}
export function validateRecordedConfiguration(entry:RecordedCashConfiguration):void {
 requireHistory(exact(entry,keys)&&entry.version===1&&identity(entry.id)&&identity(entry.sessionId)&&identity(entry.effectiveHandId)&&integer(entry.sequence)&&entry.sequence>0&&integer(entry.effectiveHandNumber)&&entry.effectiveHandNumber>0,'Invalid recorded configuration identity/version.');
 requireHistory(entry.id===`${entry.sessionId}:configuration:${entry.sequence}`&&typeof entry.recordedAt==='string'&&entry.recordedAt.length<=40&&Number.isFinite(Date.parse(entry.recordedAt))&&reasons.includes(entry.reason),'Invalid recorded configuration boundary.');
 requireHistory(entry.evidenceStatus==='DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED'&&['low','mid','high','neutral'].includes(entry.population)&&['live','study'].includes(entry.tableMode),'Configuration evidence/population status is invalid.');
 requireHistory(integer(entry.capacity)&&entry.capacity>=2&&entry.capacity<=10&&Array.isArray(entry.occupiedSeatIds)&&entry.occupiedSeatIds.length>=2&&entry.occupiedSeatIds.length<=entry.capacity&&entry.occupiedSeatIds.includes(0)&&entry.occupiedSeatIds.every((id,i)=>integer(id)&&id<entry.capacity&&(i===0||entry.occupiedSeatIds[i-1]<id)),'Invalid recorded seat layout.');
 requireHistory(Array.isArray(entry.selectionMix)&&entry.selectionMix.length<=9&&entry.selectionMix.every((mix,i)=>exact(mix,['selection','count'])&&selections.includes(mix.selection)&&integer(mix.count)&&mix.count>0&&(i===0||entry.selectionMix[i-1].selection.localeCompare(mix.selection)<0))&&entry.selectionMix.reduce((sum,mix)=>sum+mix.count,0)===entry.occupiedSeatIds.length-1,'Invalid recorded public selection mix.');
 const r=entry.rules;requireHistory(exact(r,['id','version','fingerprint','smallBlind','bigBlind','chipUnit','rake'])&&identity(r.id)&&identity(r.version)&&typeof r.fingerprint==='string'&&/^[0-9a-f]{64}$/.test(r.fingerprint)&&integer(r.smallBlind)&&r.smallBlind>0&&integer(r.bigBlind)&&r.bigBlind>=r.smallBlind&&integer(r.chipUnit)&&r.chipUnit>0,'Invalid recorded rule provenance.');
 requireHistory(r.rake&&typeof r.rake==='object'&&Object.keys(r.rake).every(key=>['basisPoints','cap','noFlopNoDrop','rounding','capByDealtIn','dealtIn','source'].includes(key)),'Invalid recorded rake assumptions.');validateRake(r.rake);
 if(r.rake.capByDealtIn)requireHistory(exact(r.rake.capByDealtIn,['two','threeFour','fivePlus']),'Invalid recorded rake cap metadata.');
 if(r.rake.source)requireHistory(exact(r.rake.source,['url','retrievedAt','currency','format'])&&typeof r.rake.source.url==='string'&&r.rake.source.url.length<=500&&typeof r.rake.source.retrievedAt==='string'&&r.rake.source.retrievedAt.length<=40&&r.rake.source.currency==='USD'&&r.rake.source.format==='regular-nlhe','Invalid recorded rake source.');
 requireHistory(Array.isArray(entry.policyVersions)&&entry.policyVersions.length<=9&&entry.policyVersions.every((version,i)=>typeof version==='string'&&/^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(version)&&(i===0||entry.policyVersions[i-1]<version)),'Invalid recorded policy-version metadata.');
}
type HandCarrier=Pick<StoredHand,'sessionId'|'number'|'view'|'configuration'>|Pick<PublicHand,'sessionId'|'number'|'view'|'configuration'>;
export function validateHandConfiguration(hand:HandCarrier):void {
 const entry=hand.configuration;if(entry===undefined)return;validateRecordedConfiguration(entry);const p=hand.view.profile;
 requireHistory(entry.sessionId===hand.sessionId&&entry.effectiveHandNumber<=hand.number&&entry.rules.id===p.id&&entry.rules.version===p.version&&entry.rules.fingerprint===ruleProfileFingerprint(p)&&entry.rules.smallBlind===p.smallBlind&&entry.rules.bigBlind===p.bigBlind&&entry.rules.chipUnit===p.chipUnit&&same(entry.rules.rake,p.rake)&&same(entry.occupiedSeatIds,hand.view.seats.map(s=>s.id).sort((a,b)=>a-b)),'Recorded configuration differs from the actual hand.');
}
/** Full audits validate every historical record. Incremental checks inspect only
 * appended boundaries/hands; immutable prefix identity protects old metadata. */
export function validateConfigurationHistory(data:AppData,prior?:AppData):void {
 const bySession=new Map(data.sessions.map(session=>[session.id,session]));
 for(let i=0;i<data.sessions.length;i++){
  const session=data.sessions[i],entries=session.configurationHistory??[],old=prior?.sessions[i]?.configurationHistory??[];
  requireHistory(Array.isArray(entries),'Invalid session configuration history.');
  if(prior&&entries!==old){requireHistory(entries.length>=old.length,'Configuration history lost boundaries.');for(let j=0;j<old.length;j++)requireHistory(entries[j]===old[j],'Configuration history prefix changed.');}
  for(let j=prior?old.length:0;j<entries.length;j++){
   const entry=entries[j];validateRecordedConfiguration(entry);
   requireHistory(entry.sessionId===session.id&&entry.sequence===j+1&&(j===0||entries[j-1].effectiveHandNumber<entry.effectiveHandNumber),'Configuration boundaries are missing, duplicated or out of order.');
   const expected=session.handIds[entry.effectiveHandNumber-1]??(data.active?.sessionId===session.id&&data.active.number===entry.effectiveHandNumber?data.active.game.handId:undefined);
   requireHistory(expected===entry.effectiveHandId,'Configuration boundary has no matching actual hand.');
  }
 }
 for(let i=prior?.hands.length??0;i<data.hands.length;i++){
  const hand=data.hands[i],entries=bySession.get(hand.sessionId)?.configurationHistory??[],expected=[...entries].reverse().find(entry=>entry.effectiveHandNumber<=hand.number);
  validateHandConfiguration(hand);requireHistory(expected?hand.configuration!==undefined&&same(hand.configuration,expected):hand.configuration===undefined,'Hand configuration does not match its immutable session boundary.');
 }
 const active=data.active;
 if(active){const session=bySession.get(active.sessionId)!,last=session?.configurationHistory?.at(-1);
  requireHistory(last?active.configuration!==undefined&&same(active.configuration,last):active.configuration===undefined,'Active hand configuration boundary is missing or changed.');
  if(last)requireHistory(same(facts(last),description(session.settings,active.game,active.profiles)),'Active configuration differs from its recorded boundary.');
 }
}
