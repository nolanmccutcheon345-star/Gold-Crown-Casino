/** Calling stations and barrels (cash layer human-1.17.0, tournament policy 2.20.0).
 *
 * The patch-47 and patch-48 audits found calling stations still reached showdown about half the
 * time after seeing a flop (live trackers put loose-passive players nearer 40-45%). Two changes:
 * - Stations and passive regulars call one bet light, but a second or third big bet (half the pot
 *   or more, on the turn or river, after they already called an earlier street) gets them to let
 *   go of weak pairs and ace-high. A pair they like, or a real draw on the turn, still calls.
 * - Thinking players value-bet a known calling station harder: they bet turns and rivers with
 *   medium-strong hands when checked to, and size their value bets up. "Known" comes from the
 *   public table reads (the station type), and how much a player adjusts follows its skill and how
 *   long the reads have run.
 * Designed, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {handFeatures} from './features';
import {stationLike} from './calibration';
import {keyOpponent,playerType,typeStrength,type PlayerRead} from './table-reads';

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
const acts=(o:BotObservation,street:string)=>o.publicEvents.filter(e=>e.type==='action'&&e.street===street);
/** How strongly a player behaves like a caller who gives up to repeated pressure: stations most, passive regulars a little less, nobody else. */
export function barrelCaller(profile:BotProfile):number {const p=completeProfile(profile);return p.archetype==='station'||stationLike(profile)?.5:p.archetype==='passive-reg'?.4:0;}

export type BarrelPlay='give-up-to-barrel'|null;
/** A caller facing a second or third big bet lets go of a weak hand. */
export function barrelFoldPlay(o:BotObservation,profile:BotProfile,action:Action,random:()=>number):{action:Action;play:BarrelPlay} {
 const keep={action,play:null as BarrelPlay};
 if((o.street!=='turn'&&o.street!=='river')||action.type!=='call'||o.legal.check||o.legal.callAmount<=0||!o.ownCards||o.ownCards.length!==2)return keep;
 const base=barrelCaller(profile);if(base<=0)return keep;
 const size=o.legal.callAmount/Math.max(1,o.pot-o.legal.callAmount);if(size<.5)return keep;
 const earlier=o.street==='turn'?['flop']:['flop','turn'];
 const called=earlier.filter(st=>acts(o,st).some(e=>e.seatId===o.actingSeat&&e.action?.type==='call'));
 if(!called.length)return keep;
 const f=handFeatures(o.ownCards,o.board);
 if(f.playsBoard||(o.street==='turn'&&f.draw>=.3)||f.strength>=(o.street==='river'?.48:.42))return keep;
 const chance=clamp(base*(called.length>=2?1.3:1));
 return draw(random)<chance?{action:{type:'fold'},play:'give-up-to-barrel'}:keep;
}

export type StationValuePlay='value-station'|'size-up-station'|null;
/** Against a known calling station: bet medium-strong hands when checked to, and size value bets up. */
export function stationValuePlay(o:BotObservation,profile:BotProfile,action:Action,reads:Readonly<Record<number,PlayerRead>>|null|undefined,random:()=>number):{action:Action;play:StationValuePlay} {
 const keep={action,play:null as StationValuePlay};
 if(!reads||(o.street!=='turn'&&o.street!=='river')||!o.legal.check||!o.legal.canRaise||!o.ownCards||o.ownCards.length!==2)return keep;
 const live=o.seats.filter(s=>s.id!==o.actingSeat&&!s.folded);if(live.length>2)return keep;
 const target=keyOpponent(o);if(target===null||playerType(reads[target])!=='station')return keep;
 const k=typeStrength(profile,reads[target]!),f=handFeatures(o.ownCards,o.board);if(k<=0||f.playsBoard)return keep;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,u=o.chipUnit??1,bet=(fraction:number)=>Math.min(o.legal.maxRaiseTo!,Math.max(o.legal.minRaiseTo!,Math.round((own.streetCommitted+o.pot*fraction)/u)*u));
 if(action.type==='check'&&f.strength>=.52&&draw(random)<.5*k)return {action:{type:'raise',to:bet(.7)},play:'value-station'};
 if(action.type==='raise'&&f.strength>=.6){const to=bet(.85);if(to>action.to&&draw(random)<.5*k)return {action:{type:'raise',to},play:'size-up-station'};}
 return keep;
}
