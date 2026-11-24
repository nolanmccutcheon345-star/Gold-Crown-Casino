/** Phase 2 (2026-11-23): player-facing stats snapshots and the reset point.
 * Kept in its own versioned local record, following the slots/casino save pattern
 * (a strict check on load, a plain-language notice instead of silent loss). It is
 * additive and separate from the poker save: nothing here touches hand archives,
 * game records or balances.
 *
 * Semantics:
 *  - A snapshot is a named, dated copy of the career aggregates at save time.
 *  - "Reset counters" only records a baseline: the career aggregates and archive
 *    cursors at that moment. Current-period stats are career minus baseline, so
 *    resetting never deletes a hand, a game record, a snapshot or a career total —
 *    and clearing the baseline restores the full career as the current view.
 *  - Records (biggest wins) are career-only: a period biggest cannot be derived
 *    from aggregates, so period views report null instead of inventing one. */
import {CAREER_GAMES,CAREER_LABELS,CAREER_UNITS,type CareerGameId,type CareerStats,type CareerGameTotals,type CareerSources} from './career';

export const STATS_BOOK_KEY='poker-night-ai:stats-book';
export const MAX_SNAPSHOTS=100;
export interface StatsSnapshot {id:string;name:string;at:string;career:CareerStats}
export interface ArchiveCursors {cash:number;cashLastId:string|null;tournaments:number;blackjack:number;omaha:number}
export interface StatsBaseline {at:string;career:CareerStats;cursors:ArchiveCursors}
export interface StatsBook {version:1;snapshots:StatsSnapshot[];baseline:StatsBaseline|null}
export const freshStatsBook=():StatsBook=>({version:1,snapshots:[],baseline:null});

const int=(n:unknown)=>Number.isSafeInteger(n),nonNeg=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
const dateString=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s));
function checkCareer(value:unknown):CareerStats {
 const v=value as CareerStats;
 if(!v||typeof v!=='object'||!v.games||typeof v.games!=='object'||!nonNeg(v.totalSamples)||!int(v.totalNet)||!(v.since===null||dateString(v.since)))throw new Error('Saved career statistics are damaged.');
 const games={} as Record<CareerGameId,CareerGameTotals>;
 for(const game of CAREER_GAMES) {
  const g=(v.games as Record<string,unknown>)[game] as CareerGameTotals|undefined;
  if(!g||!nonNeg(g.samples)||!(g.wagered===null||nonNeg(g.wagered))||!int(g.net)||!(g.biggest===null||int(g.biggest)))throw new Error('Saved career statistics are damaged.');
  games[game]={game,label:CAREER_LABELS[game],unit:CAREER_UNITS[game],samples:g.samples,wagered:g.wagered,net:g.net,biggest:g.biggest};
 }
 return {games,totalSamples:v.totalSamples,totalNet:v.totalNet,since:v.since};
}
function checkCursors(value:unknown):ArchiveCursors {
 const c=value as ArchiveCursors;
 if(!c||![c.cash,c.tournaments,c.blackjack,c.omaha].every(nonNeg)||!(c.cashLastId===null||typeof c.cashLastId==='string'))throw new Error('Saved stats reset point is damaged.');
 return {cash:c.cash,cashLastId:c.cashLastId,tournaments:c.tournaments,blackjack:c.blackjack,omaha:c.omaha};
}
export function checkStatsBook(value:unknown):StatsBook {
 const v=value as StatsBook;
 if(!v||typeof v!=='object'||v.version!==1||!Array.isArray(v.snapshots)||v.snapshots.length>MAX_SNAPSHOTS)throw new Error('Saved stats snapshots are damaged.');
 const snapshots=v.snapshots.map(s=>{
  if(!s||typeof s.id!=='string'||!s.id||typeof s.name!=='string'||!dateString(s.at))throw new Error('Saved stats snapshots are damaged.');
  return {id:s.id,name:s.name.slice(0,60),at:s.at,career:checkCareer(s.career)};
 });
 const baseline=v.baseline===null||v.baseline===undefined?null:(()=>{const b=v.baseline as StatsBaseline;if(!dateString(b.at))throw new Error('Saved stats reset point is damaged.');return {at:b.at,career:checkCareer(b.career),cursors:checkCursors(b.cursors)};})();
 return {version:1,snapshots,baseline};
}
export function readStatsBook(store:Pick<Storage,'getItem'>|null=globalThis.localStorage??null):{book:StatsBook;notice:string} {
 try{const raw=store?.getItem(STATS_BOOK_KEY);return {book:raw?checkStatsBook(JSON.parse(raw)):freshStatsBook(),notice:''};}
 catch{return {book:freshStatsBook(),notice:'Your saved stats snapshots could not be read, so the snapshot list starts empty. Your game records and career totals are stored separately and were not changed.'};}
}
export function saveStatsBook(book:StatsBook,store:Pick<Storage,'setItem'>|null=globalThis.localStorage??null):void {try{store?.setItem(STATS_BOOK_KEY,JSON.stringify(book));}catch{/* this visit only */}}

/** Save the current career aggregates as a named snapshot. The career itself is untouched. */
export function takeSnapshot(book:StatsBook,career:CareerStats,id:string,at:string,name?:string):StatsBook {
 if(book.snapshots.length>=MAX_SNAPSHOTS)throw new Error(`You already have ${MAX_SNAPSHOTS} snapshots. Delete one before saving another.`);
 const label=(name??'').trim().slice(0,60)||`Snapshot ${book.snapshots.length+1}`;
 return {...book,snapshots:[...book.snapshots,{id,name:label,at,career}]};
}
export function deleteSnapshot(book:StatsBook,id:string):StatsBook {
 return {...book,snapshots:book.snapshots.filter(s=>s.id!==id)};
}
/** Record the reset point. Snapshots and the underlying archives are never touched. */
export function resetCounters(book:StatsBook,career:CareerStats,cursors:ArchiveCursors,at:string):StatsBook {
 return {...book,baseline:{at,career,cursors}};
}
/** Undo a reset: the current view becomes the full career again. Snapshots stay. */
export function clearBaseline(book:StatsBook):StatsBook {
 return {...book,baseline:null};
}
/** Where each archive had got to when the counters were reset. */
export function cursorsFromSources(sources:CareerSources):ArchiveCursors {
 return {cash:sources.cashHands.length,cashLastId:sources.cashHands.at(-1)?.id??null,tournaments:sources.tournamentEvents.length,blackjack:sources.blackjackRounds.length,omaha:sources.omahaHands.length};
}
const sub=(a:number|null,b:number|null):number|null=>a===null||b===null?null:Math.max(0,a-b);
/** Career minus the reset baseline: what has happened since the reset.
 * With no baseline, the current period is the whole career. */
export function periodStats(career:CareerStats,baseline:StatsBaseline|null):CareerStats {
 if(!baseline)return career;
 const games={} as Record<CareerGameId,CareerGameTotals>;
 for(const game of CAREER_GAMES) {
  const c=career.games[game],b=baseline.career.games[game];
  games[game]={...c,samples:Math.max(0,c.samples-b.samples),wagered:sub(c.wagered,b.wagered),net:c.net-b.net,biggest:null};
 }
 return {games,totalSamples:Math.max(0,career.totalSamples-baseline.career.totalSamples),totalNet:career.totalNet-baseline.career.totalNet,since:baseline.at};
}
export interface PeriodArchives {cashHands:CareerSources['cashHands'];tournamentEvents:CareerSources['tournamentEvents'];blackjackRounds:CareerSources['blackjackRounds'];omahaHands:CareerSources['omahaHands'];located:Record<'cash'|'tournaments'|'blackjack'|'omaha',boolean>}
/** The per-sample records that fall after the reset point, for period rates.
 * A boundary that cannot be placed in the records currently loaded (a partial
 * hand archive, or Omaha's capped hand list) reports located:false for that game
 * rather than guessing — the period totals still come from the aggregates. */
export function periodArchives(sources:CareerSources,cursors:ArchiveCursors):PeriodArchives {
 const cashAt=cursors.cashLastId===null?-1:sources.cashHands.findIndex(h=>h.id===cursors.cashLastId);
 const cashLocated=cursors.cashLastId===null?cursors.cash===0:cashAt>=0||sources.cashHands.length>=cursors.cash;
 const cashHands=cashAt>=0?sources.cashHands.slice(cashAt+1):sources.cashHands.length>=cursors.cash?sources.cashHands.slice(cursors.cash):[];
 const slice=<T,>(all:readonly T[],n:number)=>({items:all.length>=n?all.slice(n):[] as T[],located:all.length>=n});
 const t=slice(sources.tournamentEvents,cursors.tournaments),b=slice(sources.blackjackRounds,cursors.blackjack),o=slice(sources.omahaHands,cursors.omaha);
 return {cashHands,tournamentEvents:t.items,blackjackRounds:b.items,omahaHands:o.items,located:{cash:cashLocated,tournaments:t.located,blackjack:b.located,omaha:o.located}};
}
