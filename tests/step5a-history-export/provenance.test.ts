import {describe,it,expect} from 'vitest';
import type {BotProfile,HeroViewModel} from '../../src/contracts';
import type {AppData,PersistencePort,PublicHand,PublicHistory,StoredHand} from '../../src/session/types';
import {SessionController} from '../../src/session/controller';
import {applyCommand,projectView,startHand} from '../../src/core/engine';
import {canonical,checkChain,GENESIS,parsePublicHistory,publicHistory,seal} from '../../src/storage/integrity';
import {parsePublicHistory as legacyParse,publicHistory as legacyExport} from '../step36/frozen-v3/src/storage/integrity';
import {practiceProfile} from '../verification/helpers';

import type {StoredHand as LegacyHand} from '../step36/frozen-v3/src/session/types';
async function legacySource():Promise<LegacyHand>{const hand=await source();expect(hand.view.profile.chipUnit).toBe(1);expect(hand.frames.every(f=>f.profile.chipUnit===1)).toBe(true);return hand as LegacyHand;}
type WithVersions=PublicHand&{policyVersions?:string[]};
class MemoryPort implements PersistencePort {
 value:AppData|null=null;
 async load(){return structuredClone(this.value);}
 async commit(expected:number|null,data:AppData){if((this.value?.revision??null)!==expected)throw Error('Revision changed');this.value=structuredClone(data);}
 close(){}
}
const profile=(policyVersion:string):BotProfile=>({policyVersion,archetype:'tag',aggression:.6,looseness:.3});
async function source():Promise<StoredHand>{
 let g=startHand({handId:'history-version-fixture',button:0,profile:practiceProfile(),seats:[0,1,2,3].map(id=>({id,name:`Seat ${id}`,stack:20000}))});
 const frames:HeroViewModel[]=[projectView(g,0)];
 while(g.street!=='complete'){g=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`export-proof:${g.revision}`,action:{type:'fold'}});frames.push(projectView(g,0));}
 const view=projectView(g,0),hero=view.seats.find(s=>s.id===0)!;
 return seal({id:g.handId,sessionId:'history-session',epoch:1,number:1,startedAt:'2026-11-01T00:00:00Z',endedAt:'2026-11-01T00:01:00Z',view,frames,net:hero.stack-hero.startingStack,privateProfiles:{1:profile('synthetic-cash-1.3.0'),2:profile('synthetic-cash-1.0.0'),3:profile('synthetic-cash-1.3.0')},previousHash:GENESIS,hash:''});
}
async function withMetadata(value:unknown):Promise<PublicHistory>{
 const history=await legacyExport([await legacySource()]);Object.assign(history.hands[0],{policyVersions:value});history.hands[0]=await seal(history.hands[0]);return history;
}
describe('Step5A public history policy provenance without private opponent disclosures',()=>{
 it('exports only sorted unique historical version strings without modifying source records or hashes',async()=>{
  const hand=await source(),before=canonical(hand),history=await publicHistory([hand]);
  expect((history.hands[0] as WithVersions).policyVersions).toEqual(['synthetic-cash-1.0.0','synthetic-cash-1.3.0']);
  expect(canonical(hand)).toBe(before);await expect(checkChain([hand])).resolves.toBeUndefined();
  await expect(checkChain(history.hands)).resolves.toBeUndefined();expect(history.hands[0].hash).not.toBe(hand.hash);
  expect(JSON.stringify(history)).not.toMatch(/privateProfiles|archetype|traits|personality|aggression|looseness|drawToken|"policyVersion"/);
 });
 it('round-trips new exports with provenance and identical permitted replay frames',async()=>{
  const hand=await source(),history=await publicHistory([hand]),parsed=await parsePublicHistory(JSON.stringify(history));
  expect(parsed).toEqual(history.hands);expect((parsed[0] as WithVersions).policyVersions).toEqual(['synthetic-cash-1.0.0','synthetic-cash-1.3.0']);
  expect(parsed[0].frames).toEqual(hand.frames);expect(parsed[0].view).toEqual(hand.view);
 });
 it('accepts actual legacy exports without adding metadata, normalizing or changing their checksums',async()=>{
  const history=await legacyExport([await legacySource()]),text=JSON.stringify(history),hash=history.hands[0].hash;
  const imported=await parsePublicHistory(text);expect(imported).toEqual(history.hands);expect(imported[0].hash).toBe(hash);
  expect(Object.hasOwn(imported[0],'policyVersions')).toBe(false);expect(JSON.stringify(history)).toBe(text);
 });
 it('keeps the additive public format readable by the previous application importer',async()=>{
  const history=await publicHistory([await source()]);expect(await legacyParse(JSON.stringify(history))).toEqual(history.hands);
 });
 it('accepts a well-formed unknown future label as historical text without loading that policy',async()=>{
  const history=await withMetadata(['phase0-0.1','synthetic-cash-99.2.1+archived']);
  expect(await parsePublicHistory(JSON.stringify(history))).toEqual(history.hands);
 });
 it('reads only the version property of each stored private profile',async()=>{
  const hand=await source(),safe={policyVersion:'synthetic-cash-1.3.0'} as BotProfile;
  for(const key of ['archetype','traits','skill','personalityId','aggression','looseness'])Object.defineProperty(safe,key,{get(){throw Error('Private '+key);}});
  hand.privateProfiles={1:safe};const history=await publicHistory([hand]);expect((history.hands[0] as WithVersions).policyVersions).toEqual(['synthetic-cash-1.3.0']);
 });
 it('leaves genuinely unrecorded legacy provenance absent rather than inventing the current version',async()=>{
  const hand=await source();hand.privateProfiles={};const history=await publicHistory([hand]);
  expect(Object.hasOwn(history.hands[0],'policyVersions')).toBe(false);await expect(parsePublicHistory(JSON.stringify(history))).resolves.toEqual(history.hands);
 });
 it('protects the new metadata with the public hash chain',async()=>{
  const history=await withMetadata(['synthetic-cash-1.3.0']);(history.hands[0] as WithVersions).policyVersions=['synthetic-cash-99.0.0'];
  await expect(parsePublicHistory(JSON.stringify(history))).rejects.toThrow(/integrity/);
 });
 it('retains provenance in study-only import without wallet credit, canonical history changes or duplicate imports',async()=>{
  const c=new SessionController(new MemoryPort());await c.init();expect(c.status).toBe('ready');
  const before=canonical({wallet:c.data!.wallet,ledger:c.data!.ledger,sessions:c.data!.sessions,hands:c.data!.hands});
  const history=await publicHistory([await source()]),text=JSON.stringify(history);await c.importHistory(text);await c.importHistory(text);
  expect(c.error).toBe('');expect(c.data!.importedHands).toEqual(history.hands);
  expect((c.data!.importedHands[0] as WithVersions).policyVersions).toEqual(['synthetic-cash-1.0.0','synthetic-cash-1.3.0']);
  expect(canonical({wallet:c.data!.wallet,ledger:c.data!.ledger,sessions:c.data!.sessions,hands:c.data!.hands})).toBe(before);
 });
 const malformed:[string,unknown][]=[['null',null],['string','synthetic-cash-1.3.0'],['object',[{label:'version'}]],['number',[1]],['empty label',['']],['oversized label',['v'.repeat(81)]],['too many labels',Array.from({length:11},(_,i)=>`v${String(i).padStart(2,'0')}`)],['duplicate',['v1','v1']],['unsorted',['v2','v1']],['HTML',['<img src=x onerror=alert(1)>']],['newline',['v1\nv2']],['whitespace',[' v1']],['JSON',['{"traits":0.7}']]];
 it.each(malformed)('rejects %s policy metadata even when resealed',async(_name,value)=>{
  const history=await withMetadata(value);await expect(parsePublicHistory(JSON.stringify(history))).rejects.toThrow(/policy version metadata/i);
 });
 it.each(['policyVersion','privateProfiles','traits','archetype'])('still rejects private %s alongside allowed provenance',async key=>{
  const history=await withMetadata(['synthetic-cash-1.3.0']);Object.assign(history.hands[0],{[key]:'not-public'});history.hands[0]=await seal(history.hands[0]);
  await expect(parsePublicHistory(JSON.stringify(history))).rejects.toThrow(/Private information/);
 });
});
