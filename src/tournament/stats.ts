/** Tournament statistics: results across finished events and how Hero played, compared with the
 * computer players in the same hands. Pure functions of saved tournament data. */
import type {GameState} from '../contracts';
import type {EventTier} from './presets';
import {entryCost} from './presets';
import {allHeroHands} from './mtt-event';
import type {TournamentData,TournamentEvent} from './runtime';

export type StatsFormat='all'|'single'|'multi';
export interface StatsFilter {format:StatsFormat;tier:'all'|EventTier;recent:'all'|'20';}
export const DEFAULT_STATS_FILTER:StatsFilter={format:'all',tier:'all',recent:'all'};

export interface EventResult {id:string;name:string;tier:EventTier;entrants:number;multi:boolean;place:number;cost:number;prize:number;net:number;hands:number;finishedAt:string;}
export interface ResultGroup {label:string;events:number;cashes:number;cost:number;prizes:number;net:number;roi:number|null;itm:number|null;}
export interface Rate {count:number;chances:number;}
/** Who a playing statistic describes. */
export type Who='hero'|'field'|'strong'|'regulars';
export interface PlayStat {key:string;label:string;help:string;rates:Record<Who,Rate>;}
export interface TournamentStats {
 filter:StatsFilter;events:EventResult[];totals:ResultGroup;
 wins:number;finalTables:number;multiEvents:number;averageFinish:number|null;bestFinish:{place:number;entrants:number;name:string}|null;biggestCash:number;
 groups:{format:ResultGroup[];tier:ResultGroup[];field:ResultGroup[]};
 hands:number;play:PlayStat[];
}

const TIER_ORDER:EventTier[]=['home','casino','series','sng','satellite'];
const TIER_NAMES:Record<EventTier,string>={home:'Home games',casino:'Casino dailies',series:'Series events',sng:'Sit & go',satellite:'Satellites'};
function group(label:string,rows:EventResult[]):ResultGroup {
 const cost=rows.reduce((s,r)=>s+r.cost,0),prizes=rows.reduce((s,r)=>s+r.prize,0),cashes=rows.filter(r=>r.prize>0).length;
 return {label,events:rows.length,cashes,cost,prizes,net:prizes-cost,roi:cost>0?(prizes-cost)/cost:null,itm:rows.length?cashes/rows.length:null};
}
/** Events in which Hero has a final place, oldest first. */
export function finishedEvents(data:TournamentData):TournamentEvent[] {
 return [...data.completed,...data.active?[data.active]:[]].filter(event=>event.finishes.some(row=>row.seatId===0));
}
/** Hands Hero was dealt into (a single-table event keeps recording hands after Hero is out). */
export const heroDealtHands=(event:TournamentEvent)=>allHeroHands(event).filter(hand=>hand.state.seats.some(seat=>seat.id===0&&seat.name==='You'&&seat.startingStack>0));
function eventResult(event:TournamentEvent,data:TournamentData):EventResult {
 const hero=event.finishes.find(row=>row.seatId===0)!,cost=entryCost(event.preset);
 return {id:event.id,name:event.preset.name,tier:event.preset.tier,entrants:event.mtt?.state.players.length??event.entrants,multi:event.entrants>9,place:hero.place,cost,prize:hero.prize,net:hero.prize-cost,hands:heroDealtHands(event).length,
  finishedAt:event.finishedAt??data.ledger.find(row=>row.id===`prize:${event.id}`)?.at??event.history.find(hand=>hand.state.handId===hero.handId)?.settledAt??event.startedAt};
}

// ---- Playing statistics from hand records ----
const STATS:{key:string;label:string;help:string}[]=[
 {key:'vpip',label:'Voluntarily in pot',help:'Hands where the player called or raised before the flop.'},
 {key:'pfr',label:'Raised before the flop',help:'Hands where the player raised before the flop.'},
 {key:'steal',label:'Steal attempts',help:'Raised first in from the cutoff, button or small blind when everyone folded to them.'},
 {key:'threebet',label:'Re-raised an opening raise',help:'Raised again when facing exactly one raise before the flop.'},
 {key:'bbdefend',label:'Big blind defence',help:'Called or raised in the big blind against a single raise with no callers.'},
 {key:'shortshove',label:'All-in first in, 12 BB or less',help:'With 12 big blinds or less and everyone folded to them (not in the big blind): went all-in rather than folding, limping or making a smaller raise.'},
 {key:'shortlimp',label:'Limped or min-raised, 12 BB or less',help:'Same spots as above: entered without going all-in. Usually a leak at this depth.'},
 {key:'callallin',label:'Called an all-in before the flop',help:'Called (or re-shoved) when facing an all-in before the flop.'},
 {key:'cbet',label:'Flop continuation bet',help:'Bet the flop as the last preflop raiser when checked to or first to act.'},
 {key:'wtsd',label:'Went to showdown',help:'Reached showdown after seeing the flop.'},
 {key:'wsd',label:'Won at showdown',help:'Won chips at showdown when reaching it.'},
];
type Who2=Who;
function blank():Record<Who2,Rate>{return {hero:{count:0,chances:0},field:{count:0,chances:0},strong:{count:0,chances:0},regulars:{count:0,chances:0}};}

/** Seat id → who that player is, for one hand. */
type Classify=(seatId:number,name:string)=>Who[];
function classifier(event:TournamentEvent):Classify {
 const byName=new Map<string,number>();
 if(event.mtt)event.mtt.state.players.forEach(player=>byName.set(player.name,player.id));
 const regulars=new Set(Object.keys(event.field?.regulars??{}).map(Number));
 return (seatId,name)=>{
  const player=event.mtt?byName.get(name):seatId;if(player===undefined)return [];
  if(player===0)return ['hero'];
  const profile=event.profiles[player],out:Who[]=['field'];
  if(profile?.archetype==='stronger-reg')out.push('strong');
  if(regulars.has(player))out.push('regulars');
  return out;
 };
}
function positions(game:GameState):Map<number,string> {
 const dealt=game.seats.filter(seat=>seat.startingStack>0),out=new Map(dealt.map(seat=>[seat.id,'EP']));
 // Tournament buttons and small blinds can be empty. The engine's blind seats,
 // not an index into the remaining players, are authoritative.
 if(out.has(game.button))out.set(game.button,'BTN');
 if(out.has(game.smallBlindSeat))out.set(game.smallBlindSeat,'SB');
 if(out.has(game.bigBlindSeat))out.set(game.bigBlindSeat,'BB');
 const capacity=game.tournamentSeatCount??Math.max(game.button,...dealt.map(seat=>seat.id))+1;
 const before=dealt.filter(seat=>seat.id!==game.button).sort((a,b)=>((b.id-game.button+capacity)%capacity)-((a.id-game.button+capacity)%capacity))[0];
 if(before&&out.get(before.id)==='EP')out.set(before.id,'CO');
 return out;
}
/** Count every statistic in one hand for every seat. */
function countHand(game:GameState,who:Classify,tally:Map<string,Record<Who2,Rate>>):void {
 const bb=game.profile.bigBlind,pos=positions(game),actions=game.events.filter(e=>e.type==='action');
 const seats=game.seats.filter(seat=>seat.startingStack>0),groups=new Map(seats.map(seat=>[seat.id,who(seat.id,seat.name)]));
 const add=(key:string,seatId:number,hit:boolean)=>{const g=groups.get(seatId);if(!g?.length)return;const row=tally.get(key)!;for(const w of g){row[w].chances++;if(hit)row[w].count++;}};
 const pre=actions.filter(e=>e.street==='preflop');
 let raises=0,limps=0,allInFacing=false,lastRaiser:number|null=null;const seen=new Set<number>(),facedAllIn=new Set<number>(),callersSinceRaise:number[]=[];
 const committedAllIn=(seatId:number,to:number)=>{const s=game.seats.find(x=>x.id===seatId)!;return to>=s.startingStack-(s.deadAnte??0)-1e-9||to>=s.startingStack;};
 for(const e of pre){
  const id=e.seatId!,type=e.action!.type,first=!seen.has(id);seen.add(id);
  if(first){
   const depth=game.seats.find(s=>s.id===id)!.startingStack/bb,p=pos.get(id);
   if(raises===0&&limps===0&&['CO','BTN','SB'].includes(p??''))add('steal',id,type==='raise');
   if(raises===0&&limps===0&&p!=='BB'&&depth<=12){add('shortshove',id,type==='raise'&&committedAllIn(id,e.action!.type==='raise'?e.action!.to:0));add('shortlimp',id,type==='call'||(type==='raise'&&!committedAllIn(id,e.action!.type==='raise'?e.action!.to:0)));}
   if(raises===1&&!allInFacing)add('threebet',id,type==='raise');
   if(raises===1&&!allInFacing&&p==='BB'&&callersSinceRaise.length===0)add('bbdefend',id,type!=='fold');
  }
  if(allInFacing&&!facedAllIn.has(id)){add('callallin',id,type!=='fold');facedAllIn.add(id);}
  if(type==='raise'){raises++;lastRaiser=id;callersSinceRaise.length=0;if(committedAllIn(id,e.action!.type==='raise'?e.action!.to:0))allInFacing=true;}
  else if(type==='call'){if(raises===0)limps++;else callersSinceRaise.push(id);}
 }
 for(const seat of seats){const mine=pre.filter(e=>e.seatId===seat.id);add('vpip',seat.id,mine.some(e=>e.action!.type==='call'||e.action!.type==='raise'));add('pfr',seat.id,mine.some(e=>e.action!.type==='raise'));}
 const flop=actions.filter(e=>e.street==='flop');
 if(lastRaiser!==null&&flop.length){const at=flop.findIndex(e=>e.seatId===lastRaiser);if(at>=0&&flop.slice(0,at).every(e=>e.action!.type==='check'))add('cbet',lastRaiser,flop[at].action!.type==='raise');}
 const sawFlop=game.board.length>=3?seats.filter(seat=>!pre.some(e=>e.seatId===seat.id&&e.action!.type==='fold')&&(seat.totalCommitted>0||!seat.folded)):[];
 const showdown=seats.filter(seat=>!seat.folded).length>=2;
 for(const seat of sawFlop){const reached=showdown&&!seat.folded;add('wtsd',seat.id,reached);if(reached)add('wsd',seat.id,(game.payouts?.[seat.id]??0)>0);}
}

export function tournamentStats(data:TournamentData,filter:StatsFilter=DEFAULT_STATS_FILTER):TournamentStats {
 let events=finishedEvents(data).map(event=>({event,result:eventResult(event,data)})).sort((a,b)=>a.result.finishedAt.localeCompare(b.result.finishedAt));
 events=events.filter(({result})=>(filter.format==='all'||(filter.format==='multi')===result.multi)&&(filter.tier==='all'||result.tier===filter.tier));
 if(filter.recent==='20')events=events.slice(-20);
 const results=events.map(item=>item.result);
 const tally=new Map(STATS.map(s=>[s.key,blank()]));let hands=0;
 for(const {event} of events){const who=classifier(event);for(const hand of heroDealtHands(event)){countHand(hand.state,who,tally);hands++;}}
 const best=results.length?results.reduce((a,b)=>b.place/b.entrants<a.place/a.entrants||(b.place/b.entrants===a.place/a.entrants&&b.entrants>a.entrants)?b:a):null;
 return {
  filter,events:results,totals:group('All',results),
  wins:results.filter(r=>r.place===1).length,finalTables:results.filter(r=>r.multi&&r.place<=9).length,multiEvents:results.filter(r=>r.multi).length,
  averageFinish:results.length?results.reduce((s,r)=>s+(r.entrants===1?0:(r.place-1)/(r.entrants-1)),0)/results.length:null,
  bestFinish:best?{place:best.place,entrants:best.entrants,name:best.name}:null,biggestCash:Math.max(0,...results.map(r=>r.prize)),
  groups:{
   format:[group('Single table',results.filter(r=>!r.multi)),group('Multi-table',results.filter(r=>r.multi))].filter(g=>g.events),
   tier:TIER_ORDER.map(tier=>group(TIER_NAMES[tier],results.filter(r=>r.tier===tier))).filter(g=>g.events),
   field:[group('6–9 players',results.filter(r=>r.entrants<=9)),group('10–27 players',results.filter(r=>r.entrants>9&&r.entrants<=27)),group('28–54 players',results.filter(r=>r.entrants>27&&r.entrants<=54)),group('55+ players',results.filter(r=>r.entrants>54))].filter(g=>g.events),
  },
  hands,play:STATS.map(s=>({...s,rates:tally.get(s.key)!})),
 };
}
/** Playing statistics for a list of hands, with a caller-supplied seat classifier (used by tests). */
export function playStats(games:readonly GameState[],who:(seatId:number,name:string)=>Who[]):PlayStat[] {
 const tally=new Map(STATS.map(s=>[s.key,blank()]));for(const game of games)countHand(game,who,tally);
 return STATS.map(s=>({...s,rates:tally.get(s.key)!}));
}
