/** Compact public-action memory. Never stores cards, decks or frames. The latest400 table hands
 * are shared by personalities; session result counters continue beyond that rolling window. */
import {emptyReads,mergeReads,readsFromHands,validReads,type HeroReads} from '../bots/reads';
import {handResults,type SessionFacts} from '../bots/human';
import type {ActiveTable,StoredHand} from './types';
export interface HumanMemoryRow {id:string;hash:string;reads:HeroReads;observers:string[];}
export interface HumanMemory {version:1;processed:number;lastId:string|null;lastHash:string|null;recent:HumanMemoryRow[];sessionId:string|null;facts:Record<string,SessionFacts>;}
export const emptyHumanMemory=(processed=0):HumanMemory=>({version:1,processed,lastId:null,lastHash:null,recent:[],sessionId:null,facts:{}});
export function appendHumanMemory(before:HumanMemory,hand:StoredHand):HumanMemory {
 if(before.lastId===hand.id){if(before.lastHash!==hand.hash)throw Error('Human memory hand hash changed');return before;}
 const results=handResults(hand.view.seats,hand.view.profile.bigBlind),facts:Record<string,SessionFacts>={},observers:string[]=[];
 for(const seat of hand.view.seats){const identity=hand.privateProfiles[seat.id]?.personalityId,r=results.get(seat.id);if(seat.id===0||seat.startingStack<=0||!identity||!r)continue;
  observers.push(identity);const old=before.sessionId===hand.sessionId?before.facts[identity]:undefined;
  facts[identity]={hands:(old?.hands??0)+1,netBB:(old?.netBB??0)+r.deltaBB};
 }
 const row={id:hand.id,hash:hand.hash,reads:readsFromHands([hand.view]),observers};
 return {version:1,processed:before.processed+1,lastId:hand.id,lastHash:hand.hash,recent:[...before.recent,row].slice(-400),sessionId:hand.sessionId,facts};
}
export function memoryReads(memory:HumanMemory,active:Pick<ActiveTable,'profiles'>,seat:number):HeroReads {
 const identity=active.profiles[seat]?.personalityId;return memory.recent.reduce((r,row)=>identity&&row.observers.includes(identity)?mergeReads(r,row.reads):r,emptyReads());
}
export function memoryFacts(memory:HumanMemory,active:Pick<ActiveTable,'profiles'|'sessionId'>,seat:number):SessionFacts {
 return memory.sessionId===active.sessionId?memory.facts[active.profiles[seat]?.personalityId??'']??{hands:0,netBB:0}:{hands:0,netBB:0};
}
export function validHumanMemory(value:unknown):value is HumanMemory {
 if(!value||typeof value!=='object')return false;const m=value as HumanMemory;
 return m.version===1&&Number.isSafeInteger(m.processed)&&m.processed>=0&&Array.isArray(m.recent)&&m.recent.length<=400&&m.recent.length<=m.processed&&
 (m.lastId===null||typeof m.lastId==='string')&&(m.lastHash===null||typeof m.lastHash==='string')&&(m.sessionId===null||typeof m.sessionId==='string')&&
 !!m.facts&&typeof m.facts==='object'&&Object.values(m.facts).every(f=>Number.isSafeInteger(f.hands)&&f.hands>=0&&f.hands<=m.processed&&Number.isFinite(f.netBB))&&
 m.recent.every(r=>typeof r.id==='string'&&typeof r.hash==='string'&&validReads(r.reads)&&Array.isArray(r.observers)&&r.observers.every(id=>typeof id==='string'))&&
 new Set(m.recent.map(r=>r.id)).size===m.recent.length&&(!m.recent.length||m.recent.at(-1)!.id===m.lastId&&m.recent.at(-1)!.hash===m.lastHash);
}
/** Check the projection against the available canonical tail; a full audit also checks session totals. */
function assertMemoryPrefix(memory:HumanMemory|undefined,hands:readonly StoredHand[],offset=0):void {
 if(memory===undefined)return;
 if(!validHumanMemory(memory)||memory.processed!==offset+hands.length||memory.recent.length!==Math.min(400,memory.processed))throw Error('Invalid public opponent memory');
 for(let i=Math.max(offset,memory.processed-400);i<memory.processed;i++){
  const hand=hands[i-offset],row=memory.recent[i-(memory.processed-memory.recent.length)],expected=appendHumanMemory(emptyHumanMemory(),hand).recent[0];
  if(JSON.stringify(row)!==JSON.stringify(expected))throw Error('Public opponent memory differs from saved hand');
 }
 if(offset===0&&memory.sessionId!==null){let rebuilt=emptyHumanMemory();
  for(let i=hands.length-1;i>=0;i--){if(hands[i].sessionId!==memory.sessionId){rebuilt=emptyHumanMemory(i+1);for(const hand of hands.slice(i+1))rebuilt=appendHumanMemory(rebuilt,hand);break;}if(i===0)for(const hand of hands)rebuilt=appendHumanMemory(rebuilt,hand);}
  if(rebuilt.sessionId!==memory.sessionId||JSON.stringify(rebuilt.facts)!==JSON.stringify(memory.facts))throw Error('Session mood facts differ from saved hands');
 }
}

/** Older compatible writers preserve the optional header but do not advance it.
 * Validate its exact canonical prefix before replaying only missing public summaries.
 * A compact tail that cannot verify that prefix must fall back to a full audit. */
export function catchUpHumanMemory(memory:HumanMemory,hands:readonly StoredHand[],offset=0):HumanMemory {
 const count=offset+hands.length;
 if(memory.processed===count)return memory;
 if(!validHumanMemory(memory)||memory.processed<offset||memory.processed>count)throw Error('Invalid public opponent memory');
 assertMemoryPrefix(memory,hands.slice(0,memory.processed-offset),offset);
 let current=memory;for(const hand of hands.slice(memory.processed-offset))current=appendHumanMemory(current,hand);return current;
}
export function assertHumanMemory(memory:HumanMemory|undefined,hands:readonly StoredHand[],offset=0):void {
 if(memory!==undefined){if(memory.processed===offset+hands.length)assertMemoryPrefix(memory,hands,offset);else catchUpHumanMemory(memory,hands,offset);}
}
