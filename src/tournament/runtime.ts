import type {Image} from '../bots/image';
import type {PlayerRead} from '../bots/table-reads';
/** Tournament-only event records. Cash ledgers and cash statistics never consume these. */
import type {BotDecision,BotProfile,GameState,HeroViewModel,RuleProfile} from '../contracts';
import {assertAccounting,applyCommand,projectView,projectSpectatorView,replayTournamentHand,observeBot} from '../core/engine';
import {supportedPolicy} from '../bots/policy';
import {TOURNAMENT_POLICY_V222,TOURNAMENT_POLICY_V223} from './bot-policy-v2';
import {chooseTournamentDecision,supportedTournamentPolicy,policyUsesStandings,policyUsesMood,policyUsesIcm,policyUsesReads,policyUsesTableReads,policyUsesImages,policyUsesGrudges,policyUsesInsight,type TournamentGrudges,type TournamentContext,type HandResult,type HeroReads} from './bot-policy';
import {recentResultsByName,tournamentReadsFor,tournamentTableReadsFor,tournamentImagesFor,tournamentGrudgesFor,tournamentInsightFor,tournamentSizeReadsFor,tournamentTempoReadFor} from './human-context';
import {validEventReads,type EventHeroReads} from './human-context';
import type {TableInsight} from '../bots/insight';
import {mttStandings,standingsAtTable} from './multi-table';
import {validateField,markRegulars,type EventField} from './field';
import {seedStream} from '../bots/profiles';
import {blindSchedule,entryCost,handsPerLevel,payoutLadder,ladderFor,type EventPreset,type EventPace,type BlindLevel} from './presets';
import type {TournamentView,TournamentRecord} from './view-model';
import {allHeroHands,mttProfileAt,mttTournamentView,validateMttEvent,type TournamentEventMtt} from './mtt-event';
import {seatTargetOf} from './presets';
import type {MTT_VERSION} from './multi-table';
export const TOURNAMENT_VERSION='single-table-freezeout-1.0.0';
export const INITIAL_TOURNAMENT_BALANCE=200_000;
export const TOURNAMENT_GENESIS_VERSION='virtual-tournament-2000-1' as const;
const LEGACY_TOURNAMENT_BALANCE=10_000_000;
const verifiedArchives=new WeakSet<TournamentEvent>();
function freezeArchive(value:unknown):void {if(value&&typeof value==='object'){for(const child of Object.values(value))freezeArchive(child);if(!Object.isFrozen(value))Object.freeze(value);}}
/** Only fully validated, deeply immutable archives can skip repeated per-action structural checks. */
export function sealTournamentArchives(data:TournamentData):void {validateTournamentData(data);for(const event of data.completed)if(!verifiedArchives.has(event)){freezeArchive(event);verifiedArchives.add(event);}}
export interface TournamentMoney {id:string;sequence:number;kind:'initial'|'adjustment'|'entry'|'prize';amount:number;balance:number;eventId?:string;at:string;note:string;}
export interface TournamentFinish {seatId:number;name:string;place:number;ties:number;prize:number;handId:string;}
/** Archived frames may be empty: canonical state/actions reconstruct them exactly on demand. Legacy expanded frames remain readable. */
export interface TournamentHand {number:number;settledAt:string;state:GameState;frames:HeroViewModel[];}
export interface TournamentEvent {
 id:string;version:typeof TOURNAMENT_VERSION|typeof MTT_VERSION;tournamentPolicyVersion?:string;preset:EventPreset;entrants:number;pace:EventPace;levels:BlindLevel[];handsPerLevel:number;
 startedAt:string;finishedAt:string|null;status:'running'|'hero-out'|'complete';game:GameState;handNumber:number;paused:boolean;
 profiles:Record<number,BotProfile>;/** Regulars and population for events started since patch 30. */field?:EventField;/** Reads on Hero carried in from earlier events (policy 2.4.0); only regulars use them. */heroReads?:EventHeroReads;pending:{token:number;handId:string;revision:number;decision:BotDecision|null}|null;
 history:TournamentHand[];frames:HeroViewModel[];finishes:TournamentFinish[];ladder:number[];prizePool:number;feeTotal:number;
 /** Multi-table events only: every table, the seating and the other tables' hands. */
 mtt?:TournamentEventMtt;
}
export interface TournamentData {schemaVersion:1;genesisVersion?:typeof TOURNAMENT_GENESIS_VERSION;revision:number;balance:number;ledger:TournamentMoney[];active:TournamentEvent|null;completed:TournamentEvent[];}
export interface TournamentPort {load():Promise<TournamentData|null>;commit(expected:number|null,data:TournamentData):Promise<void>;close():void;recoveryBackup?():Promise<TournamentData|null>;}
export function demand(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
/** What the acting player has seen Hero do, for policies that use reads. */
/** Reads on everyone at Hero's table (policy 2.7.0 and later). */
export function tournamentTableReads(event:TournamentEvent,seat=event.game.actor??0):Record<number,PlayerRead>|undefined {return policyUsesTableReads(event.tournamentPolicyVersion)?tournamentTableReadsFor(event,seat):undefined;}
export function tournamentImages(event:TournamentEvent,seat:number):Record<number,Image>|undefined {return policyUsesImages(event.tournamentPolicyVersion)?tournamentImagesFor(event,seat):undefined;}
/** Only this actor's witnessed rivalry evidence, using stable unique event identities. */
export function tournamentGrudges(event:TournamentEvent,seat=event.game.actor??0):TournamentGrudges|undefined {return policyUsesGrudges(event.tournamentPolicyVersion)?{grudges:tournamentGrudgesFor(event,seat),identityOf:id=>event.game.seats.find(s=>s.id===id)?.name}:undefined;}
/** Policy 2.16.0: what the acting player has noticed at Hero's table, and its own steam. */
export function tournamentInsight(event:TournamentEvent,seat:number,profile:BotProfile):TableInsight|undefined {
 if(!policyUsesInsight(event.tournamentPolicyVersion))return undefined;
 const insight=tournamentInsightFor(event,seat,profile)??undefined;
 // 2.22.0 adds size reads; earlier policies keep their exact insight object.
 if(insight&&event.tournamentPolicyVersion===TOURNAMENT_POLICY_V223)return {...insight,sizes:tournamentSizeReadsFor(event,seat),tempo:tournamentTempoReadFor(event,seat)};
 return insight&&event.tournamentPolicyVersion===TOURNAMENT_POLICY_V222?{...insight,sizes:tournamentSizeReadsFor(event,seat)}:insight;
}
export function tournamentReads(event:TournamentEvent,seat:number):HeroReads|null|undefined {
 if(!policyUsesReads(event.tournamentPolicyVersion))return undefined;
 const name=event.game.seats.find(s=>s.id===seat)?.name;return name===undefined?null:tournamentReadsFor(event,name);
}
/** The acting player's recent results (mood), for policies that use them. */
export function tournamentRecent(event:TournamentEvent,seat:number):HandResult[]|undefined {
 if(!policyUsesMood(event.tournamentPolicyVersion))return undefined;
 const name=event.game.seats.find(s=>s.id===seat)?.name;return name===undefined?[]:recentResultsByName(event).get(name)??[];
}
/** Public standings for a computer decision in this event, or nothing for policies that ignore them. */
export function tournamentStandings(event:TournamentEvent):TournamentContext|undefined {
 if(!policyUsesStandings(event.tournamentPolicyVersion))return undefined;
 const icm=policyUsesIcm(event.tournamentPolicyVersion);
 if(event.mtt){const context=mttStandings(event.mtt.state,icm);if(!icm)return context;const table=event.mtt.state.tables.find(t=>t.game.handId===event.game.handId);demand(table,'Missing current tournament table');return standingsAtTable(context,table!);}
 const stacks=event.game.seats.filter(seat=>seat.startingStack>0).map(seat=>seat.startingStack);
 const context:TournamentContext={playersLeft:stacks.length,paid:event.ladder.filter(prize=>prize>0).length,stacks};
 if(icm){context.prizes=event.ladder.slice(0,stacks.length);context.playerIds=event.game.seats.filter(seat=>seat.startingStack>0).map(seat=>seat.id);context.seatPlayers=Object.fromEntries(context.playerIds.map(id=>[id,id]));}
 return context;
}
export function tournamentProfile(event:Pick<TournamentEvent,'levels'|'handsPerLevel'>,handNumber:number):RuleProfile {
 const level=event.levels[Math.min(event.levels.length-1,Math.floor((handNumber-1)/event.handsPerLevel))];
 return {id:'single-table-freezeout',version:TOURNAMENT_VERSION,mode:'tournament',smallBlind:level.smallBlind,bigBlind:level.bigBlind,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:level.ante,antePriority:'blind-first',buttonRule:'dead-button'}};
}
export function addMoney(data:TournamentData,input:Omit<TournamentMoney,'sequence'|'balance'>):void {
 demand(!data.ledger.some(row=>row.id===input.id),'Duplicate tournament financial event');
 demand(Number.isSafeInteger(input.amount),'Invalid tournament financial amount');
 const balance=data.balance+input.amount;demand(Number.isSafeInteger(balance)&&balance>=0,'Insufficient tournament balance');
 data.balance=balance;data.ledger.push({...input,sequence:data.ledger.length,balance});
}
/** At equal starting stacks, simultaneous finishers split the prizes for their occupied ranks.
 * A fractional-cent remainder goes in physical seat order; there is no random tie-break. */
export function settleTournamentHand(data:TournamentData,event:TournamentEvent,at:string):void {
 /* Multi-table: Hero's finished hand is kept; knockouts and prizes wait for the whole round (applyMttRound). */
 if(event.mtt){const game=event.game;if(event.status==='running'&&game.street==='complete'&&!event.history.some(hand=>hand.state.handId===game.handId))event.history.push({number:event.mtt.state.round,settledAt:at,state:structuredClone(game),frames:[]});event.pending=null;return;}
 const game=event.game;if(game.street!=='complete'||event.history.some(hand=>hand.state.handId===game.handId))return;
 event.history.push({number:event.handNumber,settledAt:at,state:structuredClone(game),frames:[]});
 const survivors=game.seats.filter(seat=>seat.stack>0),busted=game.seats.filter(seat=>seat.stack===0).sort((a,b)=>(b.startingStack-(b.deadAnte??0))-(a.startingStack-(a.deadAnte??0))||a.id-b.id);
 let place=survivors.length+1;
 for(let i=0;i<busted.length;){const group=busted.slice(i).filter(seat=>seat.startingStack-(seat.deadAnte??0)===busted[i].startingStack-(busted[i].deadAnte??0)).sort((a,b)=>a.id-b.id);const total=Array.from({length:group.length},(_,n)=>event.ladder[place+n-1]??0).reduce((a,b)=>a+b,0);
  group.forEach((seat,n)=>event.finishes.push({seatId:seat.id,name:seat.name,place,ties:group.length,prize:Math.floor(total/group.length)+(n<total%group.length?1:0),handId:game.handId}));place+=group.length;i+=group.length;
 }
 if(survivors.length===1){const seat=survivors[0];event.finishes.push({seatId:seat.id,name:seat.name,place:1,ties:1,prize:event.ladder[0],handId:game.handId});event.status='complete';event.finishedAt=at;event.paused=true;}
 else if(event.finishes.some(row=>row.seatId===0))event.status='hero-out';
 const hero=event.finishes.find(row=>row.seatId===0),prizeId=`prize:${event.id}`;
 if(hero&&!data.ledger.some(row=>row.id===prizeId))addMoney(data,{id:prizeId,kind:'prize',amount:hero.prize,eventId:event.id,at,note:`Tournament finish ${hero.place}${hero.ties>1?' (tied)':''}`});
 event.pending=null;
}
export function tournamentGameView(game:GameState):HeroViewModel{return game.seats.some(seat=>seat.id===0)?projectView(game,0):projectSpectatorView(game);}
export function tournamentView(event:TournamentEvent):TournamentView {
 if(event.mtt)return mttTournamentView(event);
 const current=event.levels[Math.min(event.levels.length-1,Math.floor((event.handNumber-1)/event.handsPerLevel))],live=event.game.seats.filter(seat=>seat.stack>0||event.game.street!=='complete'&&!seat.folded),finished=new Set(event.finishes.map(row=>row.seatId));
 const remaining=event.entrants-event.finishes.filter(row=>row.place!==1).length;
 const stacks=event.game.seats.filter(seat=>!finished.has(seat.id)).sort((a,b)=>(b.stack+(event.game.street==='complete'?0:b.totalCommitted))-(a.stack+(event.game.street==='complete'?0:a.totalCommitted))||a.id-b.id),hero=stacks.find(seat=>seat.id===0),result=event.finishes.find(row=>row.seatId===0);
 return {...seatTargetOf(event.preset),eventName:event.preset.name,status:event.status,current,next:event.levels[current.level]??null,handsToNextLevel:event.handsPerLevel-((event.handNumber-1)%event.handsPerLevel),entrants:event.entrants,playersLeft:remaining,tablesLeft:1,placesPaid:event.ladder.length,prizePool:event.prizePool,ladder:event.ladder,averageStack:Math.floor(event.preset.startingStack*event.entrants/Math.max(1,remaining)),hero:hero?{stack:hero.stack,rank:stacks.indexOf(hero)+1,table:1,seat:hero.id+1}:null,handForHand:false,finalTable:true,pendingMove:null,standings:markRegulars(event.field,[...stacks.map(seat=>({name:seat.name,isHero:seat.id===0,stack:seat.stack,table:1,finished:null,prize:0})),...event.finishes.slice().sort((a,b)=>a.place-b.place||a.seatId-b.seatId).map(row=>({name:row.name,isHero:row.seatId===0,stack:row.place===1?live.find(seat=>seat.id===row.seatId)?.stack??0:0,table:null,finished:row.place,prize:row.prize}))]),result:result?{place:result.place,entrants:event.entrants,prize:result.prize,cost:entryCost(event.preset),handsPlayed:event.history.filter(hand=>hand.state.seats.some(seat=>seat.id===0)).length}:null};
}
export function tournamentRecords(data:TournamentData):TournamentRecord[]{return [...data.completed,...data.active?[data.active]:[]].flatMap(event=>{const hero=event.finishes.find(row=>row.seatId===0);return hero?[{eventName:event.preset.name,entrants:event.mtt?.state.players.length??event.entrants,place:hero.place,cost:entryCost(event.preset)*(1+(event.mtt?.state.registration?.heroReEntries?.length??0)),prize:hero.prize,finishedAt:event.finishedAt??event.history.find(hand=>hand.state.handId===hero.handId)?.settledAt??event.startedAt}]:[];});}
export function validateTournamentData(data:TournamentData,full=false):void {
 demand(data&&data.schemaVersion===1&&Number.isSafeInteger(data.revision)&&data.revision>=0,'Unknown tournament save schema or revision');
 demand(Array.isArray(data.ledger)&&data.ledger.length>0&&data.ledger[0].kind==='initial','Tournament ledger genesis missing');let balance=0;const ids=new Set<string>();
 for(const [i,row]of data.ledger.entries()){demand(typeof row.id==='string'&&['initial','adjustment','entry','prize'].includes(row.kind)&&Number.isFinite(Date.parse(row.at))&&row.sequence===i&&!ids.has(row.id),'Missing, duplicate or reordered tournament ledger event');ids.add(row.id);demand(Number.isSafeInteger(row.amount),'Invalid tournament ledger amount');balance+=row.amount;demand(Number.isSafeInteger(balance)&&balance>=0&&balance===row.balance,'Tournament financial reconciliation failed');if(i>0)demand(row.kind!=='initial','Duplicate tournament genesis');}
 demand(data.genesisVersion===undefined||data.genesisVersion===TOURNAMENT_GENESIS_VERSION,'Unknown tournament genesis version');
 demand(data.ledger[0].amount===(data.genesisVersion===TOURNAMENT_GENESIS_VERSION?INITIAL_TOURNAMENT_BALANCE:LEGACY_TOURNAMENT_BALANCE)&&balance===data.balance,'Tournament balance differs from ledger');
 demand(data.completed.every(event=>event.status==='complete'),'An unfinished tournament was archived');
 const events=[...data.completed,...data.active?[data.active]:[]];demand(new Set(events.map(event=>event.id)).size===events.length,'Duplicate tournament');
 for(const event of events){
  if(!full&&verifiedArchives.has(event)&&data.completed.includes(event)){
   const entries=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='entry'),hero=event.finishes.find(row=>row.seatId===0),prizes=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='prize');
   demand(entries.length>=1&&entries.length===1+(event.mtt?.state.registration?.heroReEntries?.length??0)&&entries.every((row,i)=>row.id===(i===0?`entry:${event.id}`:`entry:${event.id}:${i+1}`)&&row.amount===-entryCost(event.preset)),'Tournament entry reconciliation failed');
   demand(hero&&prizes.length===1&&prizes[0].id===`prize:${event.id}`&&prizes[0].amount===hero.prize,'Tournament payout reconciliation failed');continue;
  }
  if(event.mtt){validateMttEvent(data,event,full);continue;}
  demand(event.version===TOURNAMENT_VERSION&&[6,9].includes(event.entrants)&&supportedTournamentPolicy(event.tournamentPolicyVersion),'Unsupported tournament version, policy or field');
  demand(event.levels.length===40&&JSON.stringify(event.levels)===JSON.stringify(blindSchedule(event.preset))&&event.handsPerLevel===handsPerLevel(event.preset,event.pace),'Tournament structure changed');
  demand(event.prizePool===event.preset.buyIn*event.entrants&&event.feeTotal===event.preset.fee*event.entrants&&JSON.stringify(event.ladder)===JSON.stringify(ladderFor(event.preset,event.prizePool,event.entrants)),'Tournament prize structure changed');
  const entries=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='entry');demand(entries.length===1&&entries[0].id===`entry:${event.id}`&&entries[0].amount===-entryCost(event.preset),'Tournament entry reconciliation failed');
  demand(Object.keys(event.profiles).length===event.entrants&&Object.values(event.profiles).every(profile=>supportedPolicy(profile.policyVersion)),'Unsupported tournament policy');
  demand(event.heroReads===undefined||validEventReads(event.heroReads),'Invalid saved reads');
  if(event.field)validateField(event,event.history[0]?.state.seats.map(seat=>seat.name)??event.game.seats.map(seat=>seat.name));
  assertAccounting(event.game);demand(event.game.initialTotal===event.preset.startingStack*event.entrants,'Tournament chip conservation failed');
  demand(event.game.profile.mode==='tournament'&&JSON.stringify(event.game.profile)===JSON.stringify(tournamentProfile(event,event.handNumber)),'Tournament rules changed');
  demand(event.frames.length===event.game.revision+1&&JSON.stringify(event.frames.at(-1))===JSON.stringify(tournamentGameView(event.game)),'Current tournament frames disagree');
  if(event.game.street==='complete')demand(JSON.stringify(event.game)===JSON.stringify(event.history.at(-1)?.state),'Completed current game differs from canonical history');
  demand(event.handNumber===event.history.length+(event.game.street==='complete'?0:1),'Tournament hand sequence disagreement');
  demand(new Set(event.history.map(hand=>hand.state.handId)).size===event.history.length,'Duplicate tournament hand');
  event.history.forEach((hand,index)=>{demand(hand.number===index+1&&hand.state.street==='complete'&&Number.isFinite(Date.parse(hand.settledAt)),'Missing or reordered tournament hand');assertAccounting(hand.state);demand(hand.state.initialTotal===event.game.initialTotal,'Historical tournament chips disagree');demand(JSON.stringify(hand.state.profile)===JSON.stringify(tournamentProfile(event,hand.number)),'Historical tournament rules changed');demand(Array.isArray(hand.frames),'Historical tournament frame format missing');if(hand.frames.length)demand(hand.frames.length===hand.state.revision+1&&JSON.stringify(hand.frames.at(-1))===JSON.stringify(tournamentGameView(hand.state)),'Historical tournament frames disagree');});
  const chronological=[...event.history.map(hand=>hand.state),...(event.game.street==='complete'?[]:[event.game])];
  chronological.forEach((game,index)=>{const expected=index?chronological[index-1].seats.filter(seat=>seat.stack>0).map(seat=>({id:seat.id,name:seat.name,stack:seat.stack})):Array.from({length:event.entrants},(_,id)=>({id,name:game.seats[id]?.name,stack:event.preset.startingStack}));demand(JSON.stringify(game.seats.map(seat=>({id:seat.id,name:seat.name,stack:seat.startingStack})))===JSON.stringify(expected),'Tournament hand continuity failed');});
  const replayed:TournamentEvent={...event,history:[],finishes:[],pending:null,status:'running',finishedAt:null};const reconciliation:TournamentData={schemaVersion:1,revision:0,balance:0,ledger:[],active:replayed,completed:[]};
  for(const hand of event.history){replayed.game=hand.state;replayed.handNumber=hand.number;replayed.frames=hand.frames;settleTournamentHand(reconciliation,replayed,hand.settledAt);}
  demand(JSON.stringify(replayed.finishes)===JSON.stringify(event.finishes),'Tournament standings or prizes differ from canonical hand reconstruction');
  demand(replayed.status===event.status&&replayed.finishedAt===event.finishedAt,'Tournament terminal status differs from canonical hands');
  demand(new Set(event.finishes.map(row=>row.seatId)).size===event.finishes.length,'Duplicate tournament finish');
  const hero=event.finishes.find(row=>row.seatId===0),prizes=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='prize');demand(prizes.length===(hero?1:0)&&(!hero||prizes[0].id===`prize:${event.id}`&&prizes[0].amount===hero.prize),'Tournament payout reconciliation failed');
  if(event.status==='complete')demand(event.finishes.length===event.entrants&&event.finishes.filter(row=>row.place===1).length===1&&event.finishes.reduce((sum,row)=>sum+row.prize,0)===event.prizePool&&!!event.finishedAt,'Incomplete tournament prize liabilities');
  if(event.pending){demand(Number.isInteger(event.pending.token)&&event.pending.token>=0&&event.pending.token<=0xffffffff&&event.pending.handId===event.game.handId&&event.pending.revision===event.game.revision&&event.game.actor!==null&&event.game.actor!==0,'Stale pending tournament decision');if(event.pending.decision){const d=event.pending.decision;demand(d.handId===event.game.handId&&d.revision===event.game.revision&&d.seatId===event.game.actor&&d.policyVersion===event.profiles[d.seatId].policyVersion,'Pending tournament policy or identity changed');applyCommand(event.game,d);}}
  demand(tournamentGameView(event.game).handId===event.game.handId,'Invalid tournament game');
 }
 for(const row of data.ledger)if(row.kind==='entry'||row.kind==='prize')demand(events.some(event=>event.id===row.eventId),'Orphaned tournament financial event');
}

/** Full authoritative action replay, separate from financial/sequence validation on each write. */
export function auditTournamentData(data:TournamentData):number {
 validateTournamentData(data,true);let hands=0;
 for(const event of [...data.completed,...data.active?[data.active]:[]]){
  for(const hand of event.mtt?allHeroHands(event):event.history){const frames=replayTournamentHand(hand.state);if(hand.frames.length)demand(JSON.stringify(frames)===JSON.stringify(hand.frames),'Archived tournament replay disagrees');hands++;}
  /* A multi-table event shows a spectator view once Hero is out; its tables were replayed by the full validation above. */
  if(!event.mtt||event.status==='running'){const current=replayTournamentHand(event.game);demand(JSON.stringify(current)===JSON.stringify(event.frames),'Current tournament replay disagrees');}
  if(event.pending?.decision){const seat=event.game.actor!,profile=event.mtt?mttProfileAt(event,seat):event.profiles[seat],decision=chooseTournamentDecision(observeBot(event.game,seat,profile.policyVersion,`tournament-bot:${event.game.handId}:${event.game.revision}:${seat}`),profile,seedStream(event.pending.token),event.tournamentPolicyVersion,tournamentStandings(event),tournamentRecent(event,seat),tournamentReads(event,seat),tournamentTableReads(event,seat),tournamentImages(event,seat),tournamentGrudges(event,seat),tournamentInsight(event,seat,profile));demand(JSON.stringify(decision)===JSON.stringify(event.pending.decision),'Prepared tournament decision differs from committed entropy');}
 }
 return hands;
}
/** Policy 2.19.0: the tournament moment a completed hand marks, for table talk: the bubble (one
 * player from the money), the bubble bursting, or the final table forming. */
export function tournamentMoment(event:TournamentEvent):'bubble'|'burst'|'final-table'|null {
 const v=event.tournamentPolicyVersion;if(!v?.startsWith('synthetic-tournament-2.')||Number(v.split('.')[1])<19||event.game.street!=='complete')return null;
 const paid=event.ladder.filter(x=>x>0).length;
 if(event.mtt){
  const state=event.mtt.state;
  if(state.status!=='running'||state.registration&&state.round<=state.registration.closesAfterRound)return null;
  const left=state.players.filter(p=>p.table!==null&&p.stack>0).length;
  // Only settled rounds include the results from every table.
  const lastRound=state.round-1;
  const eliminated=state.finishes.filter(f=>f.round===lastRound).length;
  if(left<=paid&&left+eliminated>paid)return 'burst';
  if(left===paid+1)return 'bubble';
  if(state.moves.some(m=>m.round===lastRound&&m.reason==='final-table'))return 'final-table';
  return null;
 }
 const left=event.game.seats.filter(s=>s.stack>0).length;
 const before=event.game.seats.filter(s=>s.startingStack>0).length;
 if(left<=paid&&before>paid)return 'burst';
 if(left===paid+1)return 'bubble';
 return null;
}
