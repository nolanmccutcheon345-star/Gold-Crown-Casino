/** Phase 2 (2026-11-23): career statistics across every game the app offers.
 * Pure projections only — this module never writes game state, balances or saves
 * (the tournament-stats boundary is the model). Every figure is derived from
 * records the games already keep:
 *  - cash / tournaments / blackjack / Omaha: their saved hand, event and round archives;
 *  - slots: the per-machine records in the slots save (all-time aggregates);
 *  - roulette / craps / baccarat / races: the per-game records in the casino save (all-time aggregates).
 * Nothing is estimated or back-filled: a game with no saved record reports zeros,
 * and `since` is the earliest timestamp the archives actually carry (the slots and
 * casino saves keep no start date, so they never move `since` earlier than the
 * dated archives support). */
import type {StoredHand} from '../session/types';
import type {EventResult} from '../tournament/stats';
import type {SlotsState} from '../slots/state';
import type {CasinoState,CasinoGame} from '../casino/wallet';

export type CareerGameId='cash'|'tournaments'|'blackjack'|'omaha'|'slots'|'roulette'|'craps'|'baccarat'|'races';
export const CAREER_GAMES:readonly CareerGameId[]=['cash','tournaments','blackjack','omaha','slots','roulette','craps','baccarat','races'];
export const CAREER_LABELS:Record<CareerGameId,string>={cash:'Cash games',tournaments:'Tournaments',blackjack:'Blackjack',omaha:'Pot-Limit Omaha',slots:'Slots',roulette:'Roulette',craps:'Craps',baccarat:'Baccarat',races:'Horse racing'};
export const CAREER_UNITS:Record<CareerGameId,string>={cash:'hands',tournaments:'events',blackjack:'rounds',omaha:'hands',slots:'spins',roulette:'rounds',craps:'rounds',baccarat:'rounds',races:'rounds'};

export interface CareerGameTotals {
 game:CareerGameId;label:string;unit:string;
 /** Hands / events / rounds / spins actually played, all-time. */
 samples:number;
 /** Cents put at risk, where the game tracks it. Null where a per-round stake is
  * not a meaningful career figure (cash and Omaha buy-ins are table transfers,
  * not wagers, so no figure is invented for them). */
 wagered:number|null;
 /** Net result in cents (won minus lost). */
 net:number;
 /** Biggest single win in cents, with each game's own meaning: biggest hand net
  * (cash/Omaha), biggest prize (tournaments), biggest round net (blackjack),
  * biggest single-spin payout, gross (slots), biggest round profit (casino games).
  * Null when nothing has been played. */
 biggest:number|null;
}
export interface CareerStats {
 games:Record<CareerGameId,CareerGameTotals>;
 /** Rounds of play across every game (hands + events + rounds + spins). */
 totalSamples:number;
 /** Net across every game, in cents. The games use separate practice balances;
  * this is a results total, not a balance. */
 totalNet:number;
 /** Earliest dated evidence in the archives (cash hand start / tournament finish), or null. */
 since:string|null;
}
export interface CareerSources {
 cashHands:readonly StoredHand[];
 tournamentEvents:readonly EventResult[];
 blackjackRounds:readonly {net:number;bet:number}[];
 omahaHands:readonly {net:number;stakes:string}[];
 slots:SlotsState;
 casino:CasinoState;
}
const empty=(game:CareerGameId):CareerGameTotals=>({game,label:CAREER_LABELS[game],unit:CAREER_UNITS[game],samples:0,wagered:null,net:0,biggest:null});
const maxOrNull=(values:readonly number[]):number|null=>values.length?Math.max(...values):null;

export function careerStats(sources:CareerSources):CareerStats {
 const games={} as Record<CareerGameId,CareerGameTotals>;
 const completed=sources.cashHands.filter(h=>h.view.street==='complete');
 games.cash={...empty('cash'),samples:completed.length,net:sources.cashHands.reduce((a,h)=>a+h.net,0),biggest:maxOrNull(completed.map(h=>h.net))};
 const events=sources.tournamentEvents;
 games.tournaments={...empty('tournaments'),samples:events.length,wagered:events.reduce((a,e)=>a+e.cost,0),net:events.reduce((a,e)=>a+e.net,0),biggest:maxOrNull(events.map(e=>e.prize))};
 const played=sources.blackjackRounds.filter(r=>r.bet>0);
 games.blackjack={...empty('blackjack'),samples:played.length,wagered:played.reduce((a,r)=>a+r.bet,0),net:played.reduce((a,r)=>a+r.net,0),biggest:maxOrNull(played.map(r=>r.net))};
 games.omaha={...empty('omaha'),samples:sources.omahaHands.length,net:sources.omahaHands.reduce((a,h)=>a+h.net,0),biggest:maxOrNull(sources.omahaHands.map(h=>h.net))};
 const machines=Object.values(sources.slots.machines),spins=machines.reduce((a,m)=>a+m.spins,0),wagered=machines.reduce((a,m)=>a+m.wagered,0),won=machines.reduce((a,m)=>a+m.won,0);
 games.slots={...empty('slots'),samples:spins,wagered,net:won-wagered,biggest:maxOrNull(machines.map(m=>m.biggest))};
 for(const game of ['roulette','craps','baccarat','races'] as const) {
  const r=sources.casino.games[game as CasinoGame];
  games[game]=r?{...empty(game),samples:r.rounds,wagered:r.wagered,net:r.returned-r.wagered,biggest:r.rounds?r.biggest:null}:empty(game);
 }
 const dated=[...completed.map(h=>h.startedAt),...events.map(e=>e.finishedAt)].filter(t=>Number.isFinite(Date.parse(t))).sort();
 return {games,totalSamples:CAREER_GAMES.reduce((a,g)=>a+games[g].samples,0),totalNet:CAREER_GAMES.reduce((a,g)=>a+games[g].net,0),since:dated[0]??null};
}

/** Per-machine slots detail for the stats page: the records the slots save already keeps. */
export interface MachineLine {id:string;spins:number;wagered:number;won:number;net:number;biggest:number;features:number;payback:number|null}
export function slotsMachines(slots:SlotsState):MachineLine[] {
 return Object.entries(slots.machines).map(([id,m])=>({id,spins:m.spins,wagered:m.wagered,won:m.won,net:m.won-m.wagered,biggest:m.biggest,features:m.features,payback:m.wagered>0?100*m.won/m.wagered:null}))
  .sort((a,b)=>b.spins-a.spins);
}
