/** Multi-table events inside the tournament save: start, round settlement, validation, replay and the
 * screen view. The rules themselves live in multi-table.ts; the single-table path is untouched.
 *
 * Hero's table is the event's `game`, numbered so Hero is seat 0, and is played action by action as
 * before. Other tables are played between Hero's hands, in memory, and only become part of the save
 * when the whole round settles in one commit. Their hands are kept in sealed blocks of rounds that the
 * persistence layer stores once, as it does finished events, so a long event does not re-hash every
 * hand on every action.
 */
import {auditMttContinuity} from './mtt-audit';
import type {BotProfile,GameState} from '../contracts';
import {applyCommand,assertAccounting,projectSpectatorView,projectView,replayTournamentHand} from '../core/engine';
import {completeProfile,createProfile} from '../bots/profiles';
import {supportedPolicy} from '../bots/policy';
import {NEW_EVENT_TOURNAMENT_POLICY,supportedTournamentPolicy} from './bot-policy';
import {blindSchedule,entryCost,handsPerLevel,payoutLadder,ladderFor,type EventPace,type EventPreset} from './presets';
import {heroCanReEnter,MTT_VERSION,TABLE_SIZE,checkMtt,createMtt,heroTable,mttLevel,mttProfile,mttStandings,mttSummary,playOtherTables,playerAt,seatDecision,settleRound,type MttDeps,type MttHandRecord,type MttState} from './multi-table';
import {policyUsesStandings,policyUsesMood,policyUsesIcm} from './bot-policy';
import {recentResultsByName} from './human-context';
import {validEventReads} from './human-context';
import {drawField,validateField,markRegulars} from './field';
import {addMoney,demand,settleTournamentHand,type TournamentData,type TournamentEvent,type TournamentHand} from './runtime';
import {seatTargetOf} from './presets';
import type {TournamentView} from './view-model';

/** Rounds per sealed block of other tables' hands. */
export const MTT_BLOCK_ROUNDS=5;
/** ...or sooner, once this many other-table hands are waiting (big fields play nine a round). */
export const MTT_BLOCK_HANDS=18;
/** Hero's hands kept live for the table screen's history panel; older ones are sealed with the blocks. */
export const MTT_LIVE_HERO_HANDS=20;
export interface MttBlock {id:string;firstRound:number;lastRound:number;hands:MttHandRecord[];/** Hero's own older hands, moved out of `history`. */heroHands:TournamentHand[];}
export interface TournamentEventMtt {state:MttState;blocks:MttBlock[];recent:MttHandRecord[];}
/** Multi-table fields a preset offers (more than one table's worth). */
export const mttFields=(preset:EventPreset)=>preset.fields.filter(field=>field>TABLE_SIZE);

const FIRST=['Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Avery','Blake','Cameron','Dakota','Emerson','Finley','Harper','Jamie','Kendall','Logan','Parker','Reese','Rowan','Sage','Skyler','Sydney','Tatum','Hayden','Jesse','Kai','Lane','Micah'];
/** "You", then first names, then first names with an initial: unique for up to 108 players. */
export function mttNames(entrants:number):string[] {return Array.from({length:entrants},(_,i)=>i===0?'You':i<=FIRST.length?FIRST[i-1]:`${FIRST[(i-1)%FIRST.length]} ${String.fromCharCode(65+Math.floor((i-1)/FIRST.length)-1)}.`);}

/** Late registration (patch 43): open through this many levels. */
export const LATE_REG_LEVELS=4;
/** Each person may enter this many times in all (the first entry and re-entries). */
export const MAX_ENTRIES_PER_PERSON=2;
const LATE_NAMES=['Ray','Lisa','Carlos','Dee','Marty','Wendy','Sonny','Joan','Hector','Trish','Benny','Gail','Rudy','Nora','Vic','Peggy','Abe','Connie','Luis','Bev','Stan','Irene','Otis','Rita','Gil','Mona','Earl','Dora','Pat','Ned'];
/** Players who register late: about one in eight of the opening field, sitting down at random rounds
 * while registration is open. Names never clash with the field. */
export function lateReserve(names:readonly string[],closesAfterRound:number,random:(n:number)=>number):{name:string;round:number}[] {
 const count=Math.max(1,Math.round(names.length*.12)),taken=new Set(names),out:{name:string;round:number}[]=[];
 for(let i=0;out.length<count&&i<count*20;i++){const base=LATE_NAMES[random(LATE_NAMES.length)],name=taken.has(base)?`${base} ${String.fromCharCode(65+random(26))}.`:base;if(taken.has(name))continue;taken.add(name);out.push({name,round:2+random(closesAfterRound)});}
 return out.sort((a,b)=>a.round-b.round||a.name.localeCompare(b.name));
}
/** How often a computer player re-enters after being knocked out while registration is open:
 * gamblers and recreational players most, disciplined regulars least. */
export function reEntryChance(profile:BotProfile):number {const p=completeProfile(profile);return Math.min(.85,Math.max(.1,.25+.45*p.looseness+.2*p.traits.riskTolerance-.2*p.skill));}
export function createMttEvent(input:{id:string;preset:EventPreset;entrants:number;pace:EventPace;startedAt:string;lateRegistration?:boolean},deps:MttDeps):TournamentEvent {
 const {preset,entrants,pace}=input;demand(mttFields(preset).includes(entrants),`${preset.name} is not offered with ${entrants} players`);
 const levels=blindSchedule(preset),perLevel=handsPerLevel(preset,pace),prizePool=preset.buyIn*entrants,ladder=ladderFor(preset,prizePool,entrants);
 const drawn=drawField(preset,entrants,deps.random,deps.token),profiles=drawn.profiles;
 const closesAfterRound=perLevel*LATE_REG_LEVELS,registration=input.lateRegistration?{closesAfterRound,maxEntriesPerPerson:MAX_ENTRIES_PER_PERSON,reserve:lateReserve(drawn.names,closesAfterRound,deps.random)}:undefined;
 const state=createMtt({entrants,startingStack:preset.startingStack,levels,handsPerLevel:perLevel,ladder,names:drawn.names,...(registration?{registration}:{})},deps);
 const game=heroTable(state)!.game;
 return {id:input.id,version:MTT_VERSION,tournamentPolicyVersion:NEW_EVENT_TOURNAMENT_POLICY,preset:structuredClone(preset),entrants,pace,levels,handsPerLevel:perLevel,startedAt:input.startedAt,finishedAt:null,status:'running',game,handNumber:1,paused:false,profiles,field:drawn.field,pending:null,history:[],frames:[projectView(game,0)],finishes:[],ladder,prizePool,feeTotal:preset.fee*entrants,mtt:{state,blocks:[],recent:[]}};
}
/** What the table screen shows: Hero's view while Hero plays, a spectator view afterwards. */
export function mttGameView(event:TournamentEvent) {return event.status==='running'?projectView(event.game,0):projectSpectatorView(event.game);}
/** The computer player sitting in an engine seat at Hero's table. */
export function mttProfileAt(event:TournamentEvent,seat:number):BotProfile {const table=heroTable(event.mtt!.state);demand(table,'Hero is not seated');return event.profiles[playerAt(table!,seat)];}
/** The table Hero watches once out: the lowest-numbered table still playing. */
const watched=(state:MttState)=>state.tables.reduce((a,b)=>b.number<a.number?b:a);

/** Play the round's other hands on a copy, table by table, yielding between tables so the screen can
 * paint. Nothing here is saved: `applyMttRound` commits the result. */
export async function playMttRound(event:TournamentEvent,deps:MttDeps,yieldToUI:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,0))):Promise<{round:number;records:MttHandRecord[]}> {
 const mtt=event.mtt!;demand(event.game.street==='complete','Finish your hand before the round continues');
 const copy:MttState=structuredClone(mtt.state),records:MttHandRecord[]=[],hero=copy.status==='running'?heroTable(copy):null,recent=policyUsesMood(event.tournamentPolicyVersion)?recentResultsByName(event):undefined;
 for(const table of copy.tables){
  if(table===hero)continue;
  const single:MttState={...copy,tables:[table],status:'hero-out'};
  records.push(...playOtherTables(single,event.profiles,event.tournamentPolicyVersion,deps,recent));await yieldToUI();
 }
 return {round:copy.round,records};
}
/** Which round of other-table hands a result belongs to: the event, the round and every other table's hand. */
export function otherTablesKey(event:TournamentEvent):string|null {
 const state=event.mtt?.state;if(!state||event.status==='complete'||state.status==='complete')return null;
 const hero=state.status==='running'?heroTable(state):null,others=state.tables.filter(table=>table!==hero);
 if(!others.length)return null;
 return `${event.id}:${state.round}:${others.map(table=>`${table.number}=${table.game.handId}`).join(',')}`;
}
/** The same work as `playMttRound`, but it may start while Hero's hand is still being played (the other
 * tables do not depend on it) and it yields to the screen every `sliceMs` milliseconds, between single
 * decisions, so taps stay responsive on a phone. The event is copied before the first yield; nothing is saved. */
export async function playOtherTablesAhead(event:TournamentEvent,deps:MttDeps,options:{sliceMs?:number;yieldToUI?:()=>Promise<void>;cancelled?:()=>boolean;clock?:()=>number}={}):Promise<{round:number;records:MttHandRecord[]}|null> {
 const mtt=event.mtt!,copy:MttState=structuredClone(mtt.state),records:MttHandRecord[]=[],hero=copy.status==='running'?heroTable(copy):null;
 const policy=event.tournamentPolicyVersion,standings=policyUsesStandings(policy)?mttStandings(copy,policyUsesIcm(policy)):undefined,recent=policyUsesMood(policy)?recentResultsByName(event):undefined;
 const yieldToUI=options.yieldToUI??(()=>new Promise<void>(resolve=>setTimeout(resolve,0))),clock=options.clock??(()=>performance.now()),slice=options.sliceMs??6;
 let started=clock();
 for(const table of copy.tables){
  if(table===hero)continue;
  const token=deps.token();let game=table.game;
  while(game.street!=='complete'){
   game=applyCommand(game,seatDecision(game,table,event.profiles,token,policy,standings,recent));
   if(clock()-started>=slice){await yieldToUI();if(options.cancelled?.())return null;started=clock();}
  }
  table.game=game;records.push({round:copy.round,table:table.number,token,state:game});
 }
 return {round:copy.round,records};
}
/** Settle a round in one commit: Hero's finished hand, the other tables' hands, knockouts, prizes,
 * moves and the next deal. Hero's prize is paid the moment Hero's place is known. */
export function applyMttRound(data:TournamentData,event:TournamentEvent,played:{round:number;records:MttHandRecord[]},deps:MttDeps,at:string):void {
 const mtt=event.mtt!,state=mtt.state;demand(played.round===state.round,'This round has already been settled');demand(event.status!=='complete','The tournament is over');
 const hero=state.status==='running'?heroTable(state):null;
 if(hero){demand(event.game.street==='complete'&&event.game.handId===hero.game.handId,'Finish your hand before the round continues');hero.game=event.game;}
 for(const record of played.records){const table=state.tables.find(t=>t.number===record.table);demand(table&&table!==hero&&table.game.handId===record.state.handId&&record.state.street==='complete'&&record.round===state.round,'Another table\'s hand does not belong to this round');table!.game=record.state;}
 const watching=hero?null:watched(state);
 const hooks=state.registration?{reEnters:(player:number)=>deps.random(1000)<Math.round(1000*reEntryChance(event.profiles[player])),ladderFor:(n:number)=>ladderFor(event.preset,event.preset.buyIn*n,n)}:undefined;
 settleRound(state,deps,hooks);
 if(state.registration){
  // New entries play with their own personality: a re-entry is the same player again; a late
  // registrant is a new face from this event's population.
  for(const entry of state.registration.entries)if(!event.profiles[entry.player])event.profiles[entry.player]=entry.kind==='re-entry'?structuredClone(event.profiles[entry.parent!]):entry.kind==='hero-bullet'?structuredClone(event.profiles[0]):createProfile({selection:'random'},deps.token(),event.field?.population??'neutral');
  event.prizePool=event.preset.buyIn*state.players.length;event.feeTotal=event.preset.fee*state.players.length;event.ladder=[...state.ladder];
 }
 mtt.recent.push(...played.records);
 /* Every MTT_BLOCK_ROUNDS settled rounds (and at the end), seal the other tables' hands and Hero's older hands.
    At the final table there are no other tables, but Hero's hands are still sealed on schedule. */
 const sealedTo=mtt.blocks.at(-1)?.lastRound??0,settledTo=state.status==='complete'?state.round:state.round-1,older=Math.max(0,event.history.length-MTT_LIVE_HERO_HANDS);
 if((settledTo-sealedTo>=MTT_BLOCK_ROUNDS||mtt.recent.length>=MTT_BLOCK_HANDS||state.status==='complete')&&(mtt.recent.length||older)){const heroHands=event.history.splice(0,older);mtt.blocks.push(deepFreeze({id:`${event.id}:block:${mtt.blocks.length+1}`,firstRound:sealedTo+1,lastRound:settledTo,hands:mtt.recent,heroHands}));mtt.recent=[];}
 for(const finish of state.finishes.slice(event.finishes.length))event.finishes.push({seatId:finish.player,name:finish.name,place:finish.place,ties:finish.ties,prize:finish.prize,handId:`round:${finish.round}`});
 const heroFinish=event.finishes.find(row=>row.seatId===0),prizeId=`prize:${event.id}`;
 if(heroFinish&&!data.ledger.some(row=>row.id===prizeId))addMoney(data,{id:prizeId,kind:'prize',amount:heroFinish.prize,eventId:event.id,at,note:`Tournament finish ${heroFinish.place}${heroFinish.ties>1?' (tied)':''}`});
 event.status=state.status;event.pending=null;event.handNumber=state.round;
 if(state.status==='complete'){event.finishedAt=at;event.paused=true;event.game=watching?played.records.find(r=>r.table===watching.number)?.state??event.game:event.game;}
 else if(state.status==='running'){event.game=heroTable(state)!.game;}
 else {const shown=watching?played.records.find(r=>r.table===watching.number)?.state:undefined;event.game=shown??event.game;}
 event.frames=[mttGameView(event)];
 settleTournamentHand(data,event,at);
}

/* Sealed blocks never change again: frozen so the save can hash and store each one once. */
export function deepFreeze<T>(value:T):T {if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
/** Every hand Hero played in the event, oldest first: sealed ones, then live ones. */
export const allHeroHands=(event:TournamentEvent):TournamentHand[]=>[...(event.mtt?.blocks.flatMap(block=>block.heroHands)??[]),...event.history];
const recordedRounds=(mtt:TournamentEventMtt)=>[...mtt.blocks.flatMap(block=>block.hands),...mtt.recent];
const verifiedBlocks=new WeakSet<MttBlock>();
/** Per-commit checks: structure, money, seating and standings. `full` also replays every hand. */
export function validateMttEvent(data:TournamentData,event:TournamentEvent,full:boolean):void {
 const mtt=event.mtt;demand(mtt&&event.version===MTT_VERSION&&mttFields(event.preset).includes(event.entrants)&&supportedTournamentPolicy(event.tournamentPolicyVersion),'Unsupported multi-table tournament');
 const state=mtt!.state;demand(state.version===MTT_VERSION&&state.entrants===event.entrants&&state.startingStack===event.preset.startingStack,'Multi-table event disagrees with its preset');
 demand(JSON.stringify(event.levels)===JSON.stringify(blindSchedule(event.preset))&&JSON.stringify(state.levels)===JSON.stringify(event.levels)&&event.handsPerLevel===handsPerLevel(event.preset,event.pace)&&state.handsPerLevel===event.handsPerLevel,'Tournament structure changed');
 const entries=state.players.length;
 if(state.registration)validateRegistration(state,event);else demand(entries===event.entrants,'Unexpected extra entries');
 demand(event.prizePool===event.preset.buyIn*entries&&event.feeTotal===event.preset.fee*entries&&JSON.stringify(event.ladder)===JSON.stringify(ladderFor(event.preset,event.prizePool,entries))&&JSON.stringify(state.ladder)===JSON.stringify(event.ladder),'Tournament prize structure changed');
 const heroEntries=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='entry'),bought=1+(state.registration?.heroReEntries?.length??0)+(state.registration?.heroRequest?1:0);
 demand(heroEntries.length===bought&&heroEntries.every((row,i)=>row.id===(i===0?`entry:${event.id}`:`entry:${event.id}:${i+1}`)&&row.amount===-entryCost(event.preset)),'Tournament entry reconciliation failed');
 demand(Object.keys(event.profiles).length===entries&&state.players.every((p,i)=>p.id===i&&event.profiles[i]&&supportedPolicy(event.profiles[i].policyVersion)),'Unsupported tournament policy');
 demand(event.heroReads===undefined||validEventReads(event.heroReads),'Invalid saved reads');
 if(event.field)validateField(event,state.players.slice(0,event.entrants).map(p=>p.name));else demand(JSON.stringify(state.players.slice(0,event.entrants).map(p=>p.name))===JSON.stringify(mttNames(event.entrants)),'Player names changed');
 checkMtt(state);demand(event.status===state.status&&event.handNumber===state.round,'Event status or round disagrees with the tables');
 demand(JSON.stringify(event.finishes.map(f=>[f.seatId,f.name,f.place,f.ties,f.prize]))===JSON.stringify(state.finishes.map(f=>[f.player,f.name,f.place,f.ties,f.prize])),'Standings disagree with the tables');
 const hero=event.finishes.find(row=>row.seatId===0),prizes=data.ledger.filter(row=>row.eventId===event.id&&row.kind==='prize');
 demand(prizes.length===(hero?1:0)&&(!hero||prizes[0].id===`prize:${event.id}`&&prizes[0].amount===hero.prize),'Tournament payout reconciliation failed');
 assertAccounting(event.game);
 if(event.status==='running'){const table=heroTable(state);demand(table&&table.game.handId===event.game.handId&&event.game.seats.some(seat=>seat.id===0),'Hero\'s table disagrees with the live hand');demand(JSON.stringify(event.game.profile)===JSON.stringify(mttProfile(state,state.round)),'Tournament rules changed');}
 if(event.status==='complete')demand(!!event.finishedAt&&event.paused,'Finished event not closed');
 demand(event.frames.length>=1&&JSON.stringify(event.frames.at(-1))===JSON.stringify(mttGameView(event)),'Current tournament frames disagree');
 const ids=new Set<string>();
 let sealedTo=0;
 for(const block of mtt!.blocks){demand((data.active!==event||Object.isFrozen(block))&&block.hands.length+block.heroHands.length>0&&block.firstRound===sealedTo+1&&block.lastRound>=block.firstRound&&block.hands.every(h=>h.round>=block.firstRound&&h.round<=block.lastRound),'Invalid sealed block of tournament hands');sealedTo=block.lastRound;}
 demand(mtt!.recent.every(h=>h.round>sealedTo),'Unsealed hands overlap a sealed block');
 for(const record of recordedRounds(mtt!)){demand(!ids.has(record.state.handId)&&record.round>=1&&record.round<state.round+(state.status==='complete'?1:0)&&Number.isInteger(record.token),'Missing, duplicate or misplaced table hand');ids.add(record.state.handId);}
 {let prev=0;const back=new Set(state.registration?.heroReEntries?.map(h=>h.round)??[]);allHeroHands(event).forEach(hand=>{
  // Hero plays every round while seated; the only gap is between a knockout and a re-entry (patch 46).
  demand(!ids.has(hand.state.handId)&&(hand.number===prev+1||(prev>0&&hand.number>prev+1&&back.has(hand.number))),'Missing, duplicate or reordered tournament hand');ids.add(hand.state.handId);prev=hand.number;});}
 if(full){
  auditMttContinuity(event,recordedRounds(mtt!),allHeroHands(event));
  for(const table of state.tables)replayTournamentHand(table.game);
  replayTournamentHand(event.game);
  for(const block of mtt!.blocks)if(!verifiedBlocks.has(block)){for(const record of block.hands){assertAccounting(record.state);replayTournamentHand(record.state);}for(const hand of block.heroHands){assertAccounting(hand.state);replayTournamentHand(hand.state);}verifiedBlocks.add(block);}
  for(const record of mtt!.recent){assertAccounting(record.state);replayTournamentHand(record.state);}
 }
 if(event.pending){demand(event.status==='running'&&event.pending.handId===event.game.handId&&event.pending.revision===event.game.revision&&event.game.actor!==null&&event.game.actor!==0,'Stale pending tournament decision');if(event.pending.decision)demand(event.pending.decision.policyVersion===mttProfileAt(event,event.pending.decision.seatId).policyVersion,'Pending tournament policy or identity changed');}
}

/** Late registration and re-entry records (T09, T12): one entry record per player, in order; the
 * opening field in round 1; late entries and re-entries only while registration was open; at most
 * the allowed number of entries per person; a re-entry only after its earlier entry was knocked out. */
function validateRegistration(state:MttState,event:TournamentEvent):void {
 const reg=state.registration!,people=new Map<string,number>(),person=(n:string)=>n.replace(/ \(\d+\)$/,'');
 const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
 demand(reg.closesAfterRound===LATE_REG_LEVELS*state.handsPerLevel&&reg.maxEntriesPerPerson===MAX_ENTRIES_PER_PERSON,'Invalid registration window or entry limit');
 demand(Array.isArray(reg.entries)&&Array.isArray(reg.out)&&Array.isArray(reg.reserve),'Invalid registration records');
 demand(reg.entries.length===state.players.length&&reg.entries.every((e,i)=>e.player===i&&e.name===state.players[i].name),'Entry records disagree with the players');
 demand(new Set(state.players.map(p=>p.name)).size===state.players.length,'Duplicate entry names');
 demand(reg.out.every(o=>integer(o.player)&&o.player<state.players.length&&integer(o.start)&&o.start>0&&integer(o.round)&&o.round>=1&&o.round<=reg.closesAfterRound&&o.round<state.round+(state.status==='complete'?1:0)&&state.players[o.player].stack===0)&&new Set(reg.out.map(o=>o.player)).size===reg.out.length,'Invalid pending elimination records');
 for(const e of reg.entries){
  if(e.kind==='hero-bullet'){demand(integer(e.round)&&e.round===1&&e.parent===undefined&&e.player>=state.entrants&&person(e.name)==='You'&&reg.heroReEntries?.some(h=>h.bullet===e.player)===true&&state.players[e.player].stack===0&&state.players[e.player].table===null,'Invalid record of Hero\'s earlier entry');people.set('You',(people.get('You')??0)+1);continue;}
  demand(['initial','late','re-entry'].includes(e.kind)&&integer(e.round)&&e.round<=state.round,'Invalid entry kind or round');
  demand(e.player<state.entrants?e.kind==='initial'&&e.round===1&&e.parent===undefined:e.kind!=='initial'&&e.round>=2&&e.round<=reg.closesAfterRound+1,'An entry was made outside registration');
  people.set(person(e.name),(people.get(person(e.name))??0)+1);
  if(e.kind==='re-entry'){
   const parent=e.parent,earlier=parent===undefined?undefined:reg.entries[parent],bust=reg.out.find(o=>o.player===parent);
   demand(parent!==undefined&&integer(parent)&&parent>0&&parent<e.player&&earlier&&earlier.kind!=='re-entry'&&e.name===`${earlier.name} (2)`&&bust&&bust.round+1===e.round,'Invalid re-entry identity or knockout');
   demand(JSON.stringify(event.profiles[e.player])===JSON.stringify(event.profiles[parent!]),'Re-entry personality changed');
  }else demand(e.parent===undefined,'Unexpected parent entry');
  if(e.kind==='late')demand(event.profiles[e.player]?.environment===(event.field?.population??'neutral'),'Late entrant population changed');
 }
 demand([...people.values()].every(n=>n<=MAX_ENTRIES_PER_PERSON),'Too many entries for one person');
 demand(reg.reserve.every(r=>typeof r.name==='string'&&r.name.length>0&&integer(r.round)&&r.round>state.round&&r.round<=reg.closesAfterRound+1)&&(state.round<=reg.closesAfterRound||!reg.reserve.length),'Late registrations after the close');
 demand(new Set([...state.players.map(p=>p.name),...reg.reserve.map(r=>r.name)]).size===state.players.length+reg.reserve.length,'Duplicate reserved entrant');
 demand(state.startingStack===event.preset.startingStack,'Entries must start with the full stack');
 demand(reg.heroReEntries===undefined||Array.isArray(reg.heroReEntries)&&reg.heroReEntries.every(h=>integer(h.round)&&integer(h.bullet)),'Invalid Hero re-entry records');
 demand(reg.heroRequest===undefined||typeof reg.heroRequest==='boolean','Invalid Hero re-entry request');
 for(const h of reg.heroReEntries??[])demand(h.round>=2&&h.round<=reg.closesAfterRound+1&&h.round<=state.round&&reg.entries[h.bullet]?.kind==='hero-bullet','Hero re-entered outside registration');
 demand((reg.heroReEntries?.length??0)+(reg.heroRequest?1:0)<MAX_ENTRIES_PER_PERSON,'Too many Hero entries');
 demand(!reg.heroRequest||(state.status==='hero-out'&&state.round<=reg.closesAfterRound),'A re-entry request outside registration');
}
/** Screen facts for a multi-table event, in the Version33 view contract. */
export function mttTournamentView(event:TournamentEvent):TournamentView {
 const state=event.mtt!.state,summary=mttSummary(state),current=mttLevel(state,state.round),index=state.levels.indexOf(current);
 const result=event.finishes.find(row=>row.seatId===0),move=summary.heroMove;
 const finished=event.finishes.slice().sort((a,b)=>a.place-b.place||a.seatId-b.seatId);
 return {...seatTargetOf(event.preset),eventName:event.preset.name,status:event.status,current,next:state.levels[index+1]??null,handsToNextLevel:state.handsPerLevel-((state.round-1)%state.handsPerLevel),entrants:state.players.length,playersLeft:summary.playersLeft,tablesLeft:summary.tablesLeft,placesPaid:state.ladder.length,prizePool:event.prizePool,ladder:state.ladder,averageStack:summary.averageStack,
  hero:summary.hero,handForHand:summary.handForHand,finalTable:summary.finalTable,
  pendingMove:move&&event.status==='running'?{reason:move.reason==='break'?'table-broke':move.reason,fromTable:move.from.table,toTable:move.to.table,toSeat:move.to.seat+1}:null,
  standings:markRegulars(event.field,[...(event.status==='complete'?[]:summary.standings.map(row=>({name:row.name,isHero:row.id===0,stack:row.stack,table:row.table,finished:null,prize:0}))),...(state.registration?.out??[]).filter(o=>!finished.some(f=>f.seatId===o.player)).map(o=>({name:state.players[o.player].name,isHero:o.player===0,stack:0,table:null,finished:null,prize:0,awaitingPlace:true})),...finished.map(row=>({name:row.name,isHero:row.seatId===0,stack:row.place===1?state.players.length*state.startingStack:0,table:null,finished:row.place,prize:row.prize}))]),
  ...(state.registration?{registration:{open:state.status!=='complete'&&state.round<=state.registration.closesAfterRound,closesAfterLevel:Math.ceil(state.registration.closesAfterRound/state.handsPerLevel),entries:state.players.length,reEntries:state.registration.entries.filter(e=>e.kind==='re-entry'||e.kind==='hero-bullet').length,late:state.registration.entries.filter(e=>e.kind==='late').length,heroReEntry:{available:heroCanReEnter(state),pending:!!state.registration.heroRequest,cost:entryCost(event.preset),used:state.registration.heroReEntries?.length??0}}}:{}),
  result:result?{place:result.place,entrants:state.players.length,prize:result.prize,cost:entryCost(event.preset)*(1+(state.registration?.heroReEntries?.length??0)),handsPlayed:allHeroHands(event).length}:null};
}

/** Read-only: game used by fast-forward and the clock to know whether anything is left to deal. */
export const mttHandInProgress=(event:TournamentEvent):GameState=>event.game;
