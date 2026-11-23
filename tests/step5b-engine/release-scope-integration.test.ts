import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {assertAccounting,startHand} from '../../src/core/engine';
import {normalizeTableSettings} from '../../src/session/configuration';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {canonical,migrateData,validateData} from '../../src/storage/integrity';
import {auditSnapshot,draftSnapshot,isVerifiedSnapshot,verifyTransition} from '../../src/storage/verified';
import {practiceProfile} from '../verification/helpers';

/** Actual public entry points; no production engine, policy, audit or storage
 * validator is mocked. This independent CAS port only isolates user saves. */
class Port implements PersistencePort {
 data:AppData|null=null;commits=0;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){
  if(expected!==(this.data?.revision??null))throw Error('Revision changed');
  this.data=structuredClone(data);this.commits++;
 }
 close(){}
}
const settings={...DEFAULT_SETTINGS,seats:2,opponents:[{selection:'station' as const,personalitySeed:71921}]};
const routes:{name:string;flags:Record<string,unknown>}[]=[
 {name:'run it twice',flags:{runItTwice:true}},
 {name:'bomb pots',flags:{bombPots:true}},
 {name:'additional poker games',flags:{gameType:'omaha'}},
 {name:'tournaments',flags:{mode:'tournament'}},
 {name:'multiplayer',flags:{multiplayer:true}},
 {name:'table chat',flags:{tableChat:true}},
 {name:'dealer errors',flags:{dealerErrors:true}},
 {name:'real-time assistance',flags:{realTimeAssistance:true}},
 {name:'multiple boards',flags:{boardCount:2}},
 {name:'nested feature flags',flags:{featureFlags:{bombPots:true}}},
 {name:'unknown experimental variant',flags:{experimental:{unknownVariant:true}}},
];
const scopeError=/unsupported|Only cash|Only No-Limit/i;
function altered<T extends object>(value:T,flags:Record<string,unknown>):T{return Object.assign(structuredClone(value),flags);}
async function open(active=false){
 const port=new Port(),c=new SessionController(port);await c.init();expect(c.error).toBe('');
 if(active){await c.startSession(settings);expect(c.error).toBe('');}
 return {c,port};
}
function checkMoney(data:AppData){
 expect(data.wallet).toBe(data.ledger.reduce((n,event)=>n+event.walletDelta,0));
 expect(data.ledger.reduce((n,event)=>n+event.pokerNet,0)).toBe(data.hands.reduce((n,hand)=>n+hand.net,0));
 expect(new Set(data.ledger.map(event=>event.id)).size).toBe(data.ledger.length);
 if(data.active)assertAccounting(data.active.game);
}
function inject(candidate:AppData,flags:Record<string,unknown>,target:'profile'|'settings'){
 if(target==='profile'){
  candidate.active!.game=structuredClone(candidate.active!.game);
  candidate.active!.game.profile=altered(candidate.active!.game.profile,flags);
 }else{
  const session=candidate.sessions.find(s=>s.id===candidate.active!.sessionId)!;
  session.settings=altered(session.settings,flags);
 }
}

describe('X15 / V521 / V615 real authority and persistence release-scope boundaries',()=>{
 it.each(routes)('engine refuses $name before card entropy or blind transfers',({flags})=>{
  const input={handId:'scope-rejection',button:0,profile:altered(practiceProfile(),flags),seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Opponent',stack:20000}]};
  const before=canonical(input),random=vi.spyOn(crypto,'getRandomValues');
  try{expect(()=>startHand(input)).toThrow(scopeError);expect(random).not.toHaveBeenCalled();expect(canonical(input)).toBe(before);}
  finally{random.mockRestore();}
 });
 it.each(routes)('configuration refuses $name before resolving opponent identities',({flags})=>{
  const input=altered(settings,flags),before=canonical(input),seed=vi.fn(()=>42);
  expect(()=>normalizeTableSettings(input,seed)).toThrow(scopeError);expect(seed).not.toHaveBeenCalled();expect(canonical(input)).toBe(before);
 });
 it.each(routes)('startSession rejects $name with no buy-in, new session or durable write',async({flags})=>{
  const {c,port}=await open();
  try{
   const before=canonical(c.data),durable=canonical(port.data),commits=port.commits;
   await c.startSession(altered(settings,flags));expect(c.error).toMatch(scopeError);expect(canonical(c.data)).toBe(before);expect(canonical(port.data)).toBe(durable);expect(port.commits).toBe(commits);checkMoney(c.data!);
   // A validation failure must not strand the guest session or change ordinary play.
   await c.startSession(settings);expect(c.error).toBe('');expect(c.status).toBe('ready');expect(c.data!.sessions).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(1);checkMoney(c.data!);
  }finally{c.close();}
 });
 it.each(routes)('full and incremental audits reject $name in either active rules or saved settings',async({flags})=>{
  const {c,port}=await open(true);
  try{
   const original=c.data!,before=canonical(original),durable=canonical(port.data),commits=port.commits;
   expect(isVerifiedSnapshot(original)).toBe(true);
   for(const target of ['profile','settings'] as const){
    const restored=structuredClone(original);inject(restored,flags,target);
    await expect(auditSnapshot(restored)).rejects.toThrow(scopeError);expect(isVerifiedSnapshot(restored)).toBe(false);
    const next=draftSnapshot(original);next.revision++;inject(next,flags,target);
    await expect(verifyTransition(original,next)).rejects.toThrow(scopeError);expect(isVerifiedSnapshot(next)).toBe(false);
    expect(canonical(original)).toBe(before);expect(canonical(port.data)).toBe(durable);expect(port.commits).toBe(commits);checkMoney(original);
   }
   const ordinary=draftSnapshot(original);ordinary.revision++;await expect(verifyTransition(original,ordinary)).resolves.toBe(ordinary);await validateData(ordinary);
  }finally{c.close();}
 });
 it('queued changes and named presets reject every unsupported route without disturbing active cards or pending work',async()=>{
  const {c,port}=await open(true);
  try{
   const g=c.data!.active!.game;await c.act({type:'call'},g.handId,g.revision);await c.prepareBot();expect(c.error).toBe('');expect(c.data!.active!.pending?.decision).toBeTruthy();
   const before=canonical(c.data),durable=canonical(port.data),commits=port.commits;
   for(const {flags} of routes){
    const a=c.data!.active!;await c.queueConfiguration(altered(settings,flags),a.sessionId,a.game.handId);expect(c.error).toMatch(scopeError);
    expect(canonical(c.data)).toBe(before);expect(canonical(port.data)).toBe(durable);expect(port.commits).toBe(commits);
    await c.savePreset('Unsupported request',altered(settings,flags));expect(c.error).toMatch(scopeError);expect(canonical(c.data)).toBe(before);expect(canonical(port.data)).toBe(durable);expect(port.commits).toBe(commits);
   }
   checkMoney(c.data!);
  }finally{c.close();}
 });
 it('explicitly disabled old flags and ordinary cash settings remain valid through engine and controller',async()=>{
  const off={runItTwice:false,bombPots:'off',featureFlags:{omaha:false},boardCount:1};
  const g=startHand({handId:'legacy-off-flags',button:0,profile:altered(practiceProfile(),off),seats:[{id:0,name:'Hero',stack:20000},{id:1,name:'Opponent',stack:20000}]});
  assertAccounting(g);expect(g.board).toEqual([]);expect(g.seats.every(seat=>seat.hole.length===2)).toBe(true);expect(g.pot).toBe(300);
  const {c}=await open();try{await c.startSession(altered(settings,off));expect(c.error).toBe('');expect(c.data!.active?.game.street).toBe('preflop');checkMoney(c.data!);await validateData(c.data!);}finally{c.close();}
 });
});

const legacy=JSON.parse(readFileSync(new URL('../step36/fixtures/populated-v3.json',import.meta.url),'utf8')) as {streets:Record<string,AppData>};
describe('release-scope guard preserves populated legacy policy and immutable financial records',()=>{
 it.each(['preflop','flop','turn','river'])('restores and commits the original pending policy on %s without rewriting historical bytes',async street=>{
  const saved=legacy.streets[street],source=canonical(saved),historical=canonical(saved.hands),ledger=canonical(saved.ledger),profiles=canonical(saved.active!.profiles);
  const migrated=await migrateData(saved);await auditSnapshot(migrated);
  expect(canonical(saved)).toBe(source);expect(canonical(migrated.hands)).toBe(historical);expect(canonical(migrated.ledger)).toBe(ledger);expect(canonical(migrated.active!.profiles)).toBe(profiles);
  const port=new Port();port.data=structuredClone(migrated);const c=new SessionController(port);
  try{
   await c.init();expect(c.error).toBe('');const a=c.data!.active!,pending=a.pending!;expect(pending.policyVersion).toBe('synthetic-phase0-0.1.0');
   await c.prepareBot();expect(c.error).toBe('');expect(c.data!.active!.pending).toEqual(pending);
   await c.commitBot(a.game.handId,a.game.revision);expect(c.error).toBe('');expect(c.data!.active!.game.events.filter(e=>e.decisionId===pending.decisionId)).toHaveLength(1);
   expect(canonical(c.data!.hands.slice(0,saved.hands.length))).toBe(historical);expect(canonical(c.data!.ledger.slice(0,saved.ledger.length))).toBe(ledger);expect(canonical(c.data!.active!.profiles)).toBe(profiles);checkMoney(c.data!);await validateData(c.data!);
  }finally{c.close();}
 });
});
