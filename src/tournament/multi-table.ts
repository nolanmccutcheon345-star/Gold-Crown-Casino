/** Multi-table freezeouts. Pure, synchronous rules: the seat draw, every table playing one hand per
 * round, eliminations ranked across tables, payouts, table breaking and balancing, and the final
 * table. No storage, timers or UI. Randomness comes only from the injected `random` and `token`
 * functions, so a caller can make it secure in play and reproducible in tests.
 *
 * Rounds are synchronized: every table plays exactly one hand per round, then the round settles.
 * Players knocked out in the same round finish in order of the chips they started that hand with
 * (more chips finishes higher), and equal starting stacks share the prizes for the places they
 * occupy. That is the hand-for-hand rule, applied to every round, so a bubble or pay jump can never
 * depend on which table happened to finish its hand first.
 */
import type {BotProfile,GameState,RuleProfile} from '../contracts';
import {applyCommand,assertAccounting,nextTournamentTableHand,observeBot,startTournamentTableHand} from '../core/engine';
import {seedStream} from '../bots/profiles';
import {chooseTournamentDecision,policyUsesIcm,policyUsesStandings,type TournamentContext,type HandResult} from './bot-policy';
import type {BlindLevel} from './presets';

export const MTT_VERSION='multi-table-freezeout-1.0.0';
export const TABLE_SIZE=9;

export interface MttPlayer {id:number;name:string;table:number|null;seat:number|null;stack:number;}
/** `seats` is the physical seat map. The engine numbers a table's seats from `offset`: engine seat
 * id = (physical seat − offset) mod 9. Hero's table is numbered from Hero's seat, so Hero is always
 * engine seat 0 there, as the single-table screens and controller expect; other tables use 0. */
export interface MttTable {number:number;/** Player id in each of the nine physical seats, or null. */seats:(number|null)[];offset:number;game:GameState;}
export interface MttMove {round:number;player:number;name:string;from:{table:number;seat:number};to:{table:number;seat:number};reason:'balance'|'break'|'final-table';}
export interface MttFinish {player:number;name:string;place:number;ties:number;prize:number;round:number;}
/** A completed hand at one table, with the entropy that chose its computer decisions so an audit can re-derive them. */
export interface MttHandRecord {round:number;table:number;token:number;state:GameState;}
/** One entry into the event (T09, T12): the opening field, a late registration, or a re-entry by a
 * player already knocked out. Every entry is its own player record with a fresh starting stack. */
/** `hero-bullet` (patch 46): Hero's earlier entry after Hero re-entered. Hero stays player 0 (the
 * current entry); the knocked-out entry moves to its own record, named "You (1)", and is placed at the close like any other. */
export interface MttEntry {player:number;name:string;round:number;kind:'initial'|'late'|'re-entry'|'hero-bullet';/** For a re-entry: the entry it follows. */parent?:number;}
/** Late registration and re-entry (patch 43). Absent on freezeouts and on events started before it. */
export interface MttRegistration {
 /** Registration closes when this round settles; entries knocked out before then are placed at the close. */closesAfterRound:number;
 /** Most entries one person may make (the first plus re-entries). */maxEntriesPerPerson:number;
 /** Players still to register late, and the round they sit down in. */reserve:{name:string;round:number}[];
 entries:MttEntry[];
 /** Entries knocked out while registration was open, waiting for their place at the close. */out:{player:number;start:number;round:number}[];
 /** Hero's re-entries (patch 46): the round Hero sat down again and the record that holds the earlier entry. */heroReEntries?:{round:number;bullet:number}[];
 /** Hero has paid to re-enter and sits down when this round settles. */heroRequest?:boolean;
}
export interface MttState {
 version:typeof MTT_VERSION;entrants:number;startingStack:number;levels:BlindLevel[];handsPerLevel:number;ladder:number[];
 registration?:MttRegistration;
 /** Index = player id. Player 0 is Hero. */
 players:MttPlayer[];tables:MttTable[];round:number;finishes:MttFinish[];moves:MttMove[];
 status:'running'|'hero-out'|'complete';nextTable:number;
}
export interface MttDeps {random:(limit:number)=>number;handId:()=>string;token:()=>number;}

export function mttLevel(state:Pick<MttState,'levels'|'handsPerLevel'>,round:number):BlindLevel {return state.levels[Math.min(state.levels.length-1,Math.floor((round-1)/state.handsPerLevel))];}
export function mttProfile(state:Pick<MttState,'levels'|'handsPerLevel'>,round:number):RuleProfile {
 const level=mttLevel(state,round);
 return {id:'multi-table-freezeout',version:MTT_VERSION,mode:'tournament',smallBlind:level.smallBlind,bigBlind:level.bigBlind,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:level.ante,antePriority:'blind-first',buttonRule:'dead-button'}};
}
const shuffle=<T,>(items:T[],random:(limit:number)=>number):T[]=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=random(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;};
const fail=(message:string):never=>{throw Error(message);};
const demand=(value:unknown,message:string):void=>{if(!value)fail(message);};
const alive=(state:MttState)=>state.players.filter(p=>p.table!==null);
export const physicalSeat=(table:MttTable,engineSeat:number):number=>(engineSeat+table.offset)%TABLE_SIZE;
export const engineSeat=(table:MttTable,physical:number):number=>(physical-table.offset+TABLE_SIZE)%TABLE_SIZE;
/** The player in an engine seat at a table. */
export const playerAt=(table:MttTable,seat:number):number=>table.seats[physicalSeat(table,seat)]??fail(`No player in seat ${physicalSeat(table,seat)+1} at table ${table.number}`);
export const heroTable=(state:MttState):MttTable|null=>state.tables.find(t=>t.seats.includes(0))??null;
const seatsOf=(state:MttState,table:MttTable)=>table.seats.flatMap((id,seat)=>id===null?[]:[{id:engineSeat(table,seat),name:state.players[id].name,stack:state.players[id].stack}]).sort((a,b)=>a.id-b.id);
/* Hero's table is numbered from Hero's seat; any other table keeps its numbering. */
const wantedOffset=(table:MttTable)=>{const hero=table.seats.indexOf(0);return hero>=0?hero:table.offset;};

/** Tables needed for a field: as few as fit nine-handed. */
export const tablesFor=(players:number)=>Math.ceil(players/TABLE_SIZE);

/** Opening draw: random seats, table sizes differing by at most one, a random button at each table. */
export function createMtt(input:{entrants:number;startingStack:number;levels:BlindLevel[];handsPerLevel:number;ladder:number[];names:string[];registration?:{closesAfterRound:number;maxEntriesPerPerson:number;reserve:{name:string;round:number}[]}},deps:MttDeps):MttState {
 const {entrants}=input;demand(Number.isInteger(entrants)&&entrants>TABLE_SIZE&&entrants<=TABLE_SIZE*12,'A multi-table event seats 10 to 108 players');
 demand(input.names.length===entrants&&new Set(input.names).size===entrants,'Every player needs a unique name');
 const count=tablesFor(entrants),order=shuffle(Array.from({length:entrants},(_,id)=>id),deps.random);
 const state:MttState={version:MTT_VERSION,entrants,startingStack:input.startingStack,levels:input.levels,handsPerLevel:input.handsPerLevel,ladder:input.ladder,players:input.names.map((name,id)=>({id,name,table:null,seat:null,stack:input.startingStack})),tables:[],round:1,finishes:[],moves:[],status:'running',nextTable:count+1};
 for(let t=0;t<count;t++){
  const size=Math.floor(entrants/count)+(t<entrants%count?1:0),mine=order.splice(0,size),seatList=shuffle(Array.from({length:TABLE_SIZE},(_,i)=>i),deps.random).slice(0,size).sort((a,b)=>a-b),seats:(number|null)[]=Array(TABLE_SIZE).fill(null);
  seatList.forEach((seat,i)=>{seats[seat]=mine[i];state.players[mine[i]].table=t+1;state.players[mine[i]].seat=seat;});
  const table:MttTable={number:t+1,seats,offset:0,game:null as unknown as GameState};table.offset=wantedOffset(table);state.tables.push(table);
 }
 if(input.registration){const r=input.registration;demand(r.closesAfterRound>=1&&r.maxEntriesPerPerson>=1&&r.reserve.every(x=>x.round>=2&&x.round<=r.closesAfterRound+1)&&new Set([...input.names,...r.reserve.map(x=>x.name)]).size===input.names.length+r.reserve.length,'Invalid late registration');
  state.registration={closesAfterRound:r.closesAfterRound,maxEntriesPerPerson:r.maxEntriesPerPerson,reserve:[...r.reserve],entries:input.names.map((name,player)=>({player,name,round:1,kind:'initial' as const})),out:[]};}
 for(const table of state.tables)table.game=freshHand(state,table,deps);
 return state;
}
/* A finished hand seen from a table numbered `shift` seats further round: only what the next deal
   reads (seats, button and blinds) is renumbered. Never stored. */
function renumber(game:GameState,shift:number):GameState {
 const by=((shift%TABLE_SIZE)+TABLE_SIZE)%TABLE_SIZE;if(!by)return game;const map=(id:number)=>(id-by+TABLE_SIZE)%TABLE_SIZE;
 return {...game,seats:game.seats.map(seat=>({...seat,id:map(seat.id)})).sort((a,b)=>a.id-b.id),button:map(game.button),smallBlindSeat:map(game.smallBlindSeat),bigBlindSeat:map(game.bigBlindSeat)};
}
function freshHand(state:MttState,table:MttTable,deps:MttDeps):GameState {
 table.offset=wantedOffset(table);
 const seats=seatsOf(state,table),button=seats[deps.random(seats.length)].id;
 return startTournamentTableHand({handId:deps.handId(),profile:mttProfile(state,state.round),button,seats},TABLE_SIZE);
}

/** Public standings at the start of the current round: players left, places paid, every remaining stack. */
export function mttStandings(state:MttState,withPrizes=false):TournamentContext {
 const out=new Set([...state.finishes.map(f=>f.player),...(state.registration?.out.map(o=>o.player)??[])]),stacks=state.players.filter(p=>!out.has(p.id)).map(p=>p.stack);
 const context:TournamentContext={playersLeft:stacks.length,paid:state.ladder.filter(prize=>prize>0).length,stacks};
 if(withPrizes){context.prizes=state.ladder.slice(0,stacks.length);context.playerIds=state.players.filter(p=>!out.has(p.id)).map(p=>p.id);}
 return context;
}
/** Bind public global standings to the engine's local seats, including Hero's offset. */
export function standingsAtTable(context:TournamentContext,table:MttTable):TournamentContext {return {...context,seatPlayers:Object.fromEntries(table.game.seats.filter(seat=>seat.startingStack>0).map(seat=>[seat.id,playerAt(table,seat.id)]))};}
/** One computer decision at a table, from the hand's entropy token and the decision's revision. */
export function seatDecision(game:GameState,table:MttTable,profiles:Record<number,BotProfile>,token:number,policyVersion:string|undefined,standings?:TournamentContext,recent?:ReadonlyMap<string,HandResult[]>){
 const seat=game.actor!,player=playerAt(table,seat),profile=profiles[player];demand(player!==0,'A computer decision was asked for Hero');
 return chooseTournamentDecision(observeBot(game,seat,profile.policyVersion,`mtt-bot:${game.handId}:${game.revision}:${seat}`),profile,seedStream((token^Math.imul(game.revision+1,0x9e3779b1))>>>0),policyVersion,policyUsesIcm(policyVersion)&&standings?standingsAtTable(standings,table):standings,recent?.get(game.seats.find(s=>s.id===seat)!.name)??[]);
}
/** Play every hand still in progress at tables other than Hero's (all tables once Hero is out) to the end. */
export function playOtherTables(state:MttState,profiles:Record<number,BotProfile>,policyVersion:string|undefined,deps:MttDeps,recent?:ReadonlyMap<string,HandResult[]>):MttHandRecord[] {
 const hero=state.status==='running'?heroTable(state):null,records:MttHandRecord[]=[],standings=policyUsesStandings(policyVersion)?mttStandings(state,policyUsesIcm(policyVersion)):undefined;
 for(const table of state.tables){
  if(table===hero)continue;
  const token=deps.token();let game=table.game;
  while(game.street!=='complete')game=applyCommand(game,seatDecision(game,table,profiles,token,policyVersion,standings,recent));
  table.game=game;records.push({round:state.round,table:table.number,token,state:game});
 }
 return records;
}

/** Settle a round once every table's hand is complete: stacks, knockouts and prizes, then breaking,
 * balancing or the final table, then the next hand at every table. Returns the moves made. */
/** A new entry: a player record with a fresh stack, not yet seated. */
function addEntry(state:MttState,name:string,kind:'late'|'re-entry',parent?:number):number {
 demand(!state.players.some(p=>p.name===name),`Entry name ${name} is already taken`);
 const id=state.players.length;state.players.push({id,name,table:null,seat:null,stack:state.startingStack});
 state.registration!.entries.push({player:id,name,round:state.round+1,kind,...(parent!==undefined?{parent}:{})});return id;
}
/** Places and prizes for players knocked out together, best place first (`place`), in the
 * hand-for-hand order: more chips at the start of the hand finishes higher; equal stacks share. */
export function placeGroup(busted:{player:number;start:number}[],place:number,ladder:readonly number[],round:number,names:readonly string[]):MttFinish[] {
 const out:MttFinish[]=[],sorted=[...busted].sort((a,b)=>b.start-a.start||a.player-b.player);
 for(let i=0;i<sorted.length;){
  const group=sorted.slice(i).filter(b=>b.start===sorted[i].start),total=group.reduce((sum,_,n)=>sum+(ladder[place+n-1]??0),0);
  group.forEach((b,n)=>out.push({player:b.player,name:names[b.player],place,ties:group.length,prize:Math.floor(total/group.length)+(n<total%group.length?1:0),round}));
  place+=group.length;i+=group.length;
 }
 return out;
}
/** At the close of registration: places for everyone knocked out while it was open. Later rounds'
 * knockouts finish higher; within a round, the hand-for-hand order. */
export function closeRegistrationPlaces(out:readonly {player:number;start:number;round:number}[],aliveAtClose:number,ladder:readonly number[],names:readonly string[]):MttFinish[] {
 const rounds=[...new Set(out.map(o=>o.round))].sort((a,b)=>b-a),finishes:MttFinish[]=[];let place=aliveAtClose+1;
 for(const round of rounds){const group=out.filter(o=>o.round===round);finishes.push(...placeGroup(group,place,ladder,round,names));place+=group.length;}
 return finishes;
}
/** Hooks a caller gives the round settlement for registration: who re-enters, and the prize ladder for a field size. */
export interface MttRegistrationHooks {reEnters:(player:number)=>boolean;ladderFor:(entries:number)=>number[];}
const entriesOf=(reg:MttRegistration,name:string)=>{const person=(n:string)=>n.replace(/ \(\d+\)$/,'');return reg.entries.filter(e=>person(e.name)===person(name)).length;};
/** Whether Hero may re-enter now (T09): knocked out while registration is open, entries left, not already requested. */
export function heroCanReEnter(state:MttState):boolean {
 const reg=state.registration;if(!reg||state.status!=='hero-out'||state.round>reg.closesAfterRound||reg.heroRequest)return false;
 return reg.out.some(o=>o.player===0)&&1+(reg.heroReEntries?.length??0)<reg.maxEntriesPerPerson;
}
/** Hero re-enters: Hero sits down with a fresh stack when the current round settles. */
export function requestHeroReEntry(state:MttState):void {demand(heroCanReEnter(state),'Re-entry is not available');state.registration!.heroRequest=true;}
export function settleRound(state:MttState,deps:MttDeps,hooks?:MttRegistrationHooks):MttMove[] {
 demand(state.status!=='complete','The tournament is over');
 demand(state.tables.every(t=>t.game.street==='complete'),'Every table must finish its hand before the round settles');
 const busted:{player:number;start:number}[]=[];
 for(const table of state.tables){
  assertAccounting(table.game);
  for(const seat of table.game.seats){
   const id=playerAt(table,seat.id),player=state.players[id];player.stack=seat.stack;
   if(seat.stack===0){busted.push({player:id,start:seat.startingStack});table.seats[physicalSeat(table,seat.id)]=null;player.table=null;player.seat=null;}
  }
 }
 const reg=state.registration,open=!!reg&&state.round<=reg.closesAfterRound;
 const pending:number[]=[];
 if(open){
  // While registration is open nobody is placed yet: knockouts wait for the close, and computer
  // players may re-enter (a new entry with a fresh stack, seated next round).
  for(const b of busted){reg!.out.push({player:b.player,start:b.start,round:state.round});
   const name=state.players[b.player].name;
   if(b.player!==0&&hooks&&entriesOf(reg!,name)<reg!.maxEntriesPerPerson&&hooks.reEnters(b.player)){const n=entriesOf(reg!,name)+1,person=name.replace(/ \(\d+\)$/,'');pending.push(addEntry(state,`${person} (${n})`,'re-entry',b.player));}}
  if(reg!.heroRequest){
   // Hero's knocked-out entry moves to its own record; Hero (player 0) gets a fresh stack.
   const bullet=state.players.length,k=1+(reg!.heroReEntries?.length??0),name=`You (${k})`;
   state.players.push({id:bullet,name,table:null,seat:null,stack:0});
   reg!.entries.push({player:bullet,name,round:1,kind:'hero-bullet'});
   for(const o of reg!.out)if(o.player===0)o.player=bullet;
   state.players[0].stack=state.startingStack;(reg!.heroReEntries??=[]).push({round:state.round+1,bullet});reg!.heroRequest=false;pending.push(0);
  }
  for(const r of reg!.reserve.filter(r=>r.round===state.round+1))pending.push(addEntry(state,r.name,'late'));
  reg!.reserve=reg!.reserve.filter(r=>r.round>state.round+1);
 }else{
  const left=alive(state).length;state.finishes.push(...placeGroup(busted,left+1,state.ladder,state.round,state.players.map(p=>p.name)));
 }
 if(open&&hooks)state.ladder=hooks.ladderFor(state.players.length);
 if(reg&&state.round===reg.closesAfterRound){
  // Registration closes: the field is final, so are the prizes and the places of everyone already out.
  const aliveAtClose=alive(state).length+pending.length;state.ladder=hooks?hooks.ladderFor(state.players.length):state.ladder;
  state.finishes.push(...closeRegistrationPlaces(reg.out,aliveAtClose,state.ladder,state.players.map(p=>p.name)));reg.reserve=[];
 }
 const left=alive(state).length+pending.length;
 demand(left>=1,'Everyone cannot be eliminated at once');
 if(left===1&&open&&state.round<reg!.closesAfterRound){state.ladder=hooks?hooks.ladderFor(state.players.length):state.ladder;state.finishes.push(...closeRegistrationPlaces(reg!.out,1,state.ladder,state.players.map(p=>p.name)));reg!.reserve=[];}
 if(left===1){const winner=alive(state)[0];state.finishes.push({player:winner.id,name:winner.name,place:1,ties:1,prize:state.ladder[0],round:state.round});state.status='complete';return [];}
 if(state.finishes.some(f=>f.player===0)||reg?.out.some(o=>o.player===0))state.status='hero-out';
 else if(state.status==='hero-out')state.status='running';
 state.tables=state.tables.filter(t=>t.seats.some(id=>id!==null));
 // New entries sit down at the shortest table with a free seat, or at a new table.
 const seated:MttMove[]=[];
 for(const id of pending){let target=state.tables.filter(t=>count(t)<TABLE_SIZE).sort((a,b)=>count(a)-count(b)||a.number-b.number)[0];
  if(!target){target={number:state.nextTable++,seats:Array(TABLE_SIZE).fill(null),offset:0,game:null as unknown as GameState};state.tables.push(target);}
  const empty=target.seats.flatMap((p,seat)=>p===null?[seat]:[]),pick=empty[deps.random(empty.length)];target.seats[pick]=id;state.players[id].table=target.number;state.players[id].seat=pick;}
 const moves=[...seated,...rearrange(state,deps)],previous=new Map(state.tables.filter(t=>t.game).map(t=>[t.number,t.game]));
 state.round++;
 for(const table of state.tables){
  const prior=previous.get(table.number);
  if(!prior){table.game=freshHand(state,table,deps);continue;}
  const offset=wantedOffset(table),from=renumber(prior,offset-table.offset);table.offset=offset;
  table.game=nextTournamentTableHand(from,deps.handId(),mttProfile(state,state.round),seatsOf(state,table),TABLE_SIZE);
 }
 state.moves.push(...moves);
 return moves;
}

/* Seats where a newcomer should not be put when another empty seat exists, because they would pay a
   blind or take the button straight away: the previous big blind's seat (next small blind), the seat
   before it (next button), and any empty seat between it and the next occupied seat (that newcomer
   would be the next big blind). */
function awkwardSeats(table:MttTable):Set<number> {
 if(!table.game)return new Set();// a table opened this round for new entries has no hand yet
 const bb=physicalSeat(table,table.game.bigBlindSeat),out=new Set([bb,(bb+TABLE_SIZE-1)%TABLE_SIZE]);
 for(let step=1;step<TABLE_SIZE;step++){const seat=(bb+step)%TABLE_SIZE;if(table.seats[seat]!==null)break;out.add(seat);}
 return out;
}
function seatPlayer(state:MttState,id:number,table:MttTable,deps:MttDeps,round:number,reason:MttMove['reason'],moves:MttMove[]):void {
 const empty=table.seats.flatMap((p,seat)=>p===null?[seat]:[]);demand(empty.length>0,`Table ${table.number} is full`);
 const avoid=awkwardSeats(table),good=empty.filter(seat=>!avoid.has(seat)),pick=(good.length?good:empty)[deps.random((good.length?good:empty).length)];
 const player=state.players[id];
 if(player.table!==null&&player.seat!==null){moves.push({round,player:id,name:player.name,from:{table:player.table,seat:player.seat},to:{table:table.number,seat:pick},reason});const from=state.tables.find(t=>t.number===player.table);if(from)from.seats[player.seat]=null;}
 table.seats[pick]=id;player.table=table.number;player.seat=pick;
}
/* The physical seat of the player at a table who would post the big blind next hand: the one moved when balancing, so
   nobody escapes or pays the big blind twice because of a move. */
function nextBigBlind(table:MttTable):number {
 const occupied=table.seats.flatMap((p,seat)=>p===null?[]:[seat]);if(!table.game)return occupied[0];
 const bb=physicalSeat(table,table.game.bigBlindSeat);
 return occupied.find(seat=>seat>bb)??occupied[0];
}
const count=(t:MttTable)=>t.seats.filter(p=>p!==null).length;
function rearrange(state:MttState,deps:MttDeps):MttMove[] {
 const moves:MttMove[]=[],round=state.round,players=alive(state);
 if(players.length<=TABLE_SIZE&&state.tables.length>1){
  // Final table: everyone redrawn to fresh seats at one new table with a new button.
  const table:MttTable={number:state.nextTable++,seats:Array(TABLE_SIZE).fill(null),offset:0,game:null as unknown as GameState},seats=shuffle(Array.from({length:TABLE_SIZE},(_,i)=>i),deps.random);
  shuffle(players.map(p=>p.id),deps.random).forEach((id,i)=>{const player=state.players[id];moves.push({round,player:id,name:player.name,from:{table:player.table!,seat:player.seat!},to:{table:table.number,seat:seats[i]},reason:'final-table'});table.seats[seats[i]]=id;player.table=table.number;player.seat=seats[i];});
  state.tables=[table];return moves;
 }
 // Break tables (highest number first) until the field fits the fewest tables possible.
 while(state.tables.length>tablesFor(players.length)){
  const broken=state.tables.reduce((a,b)=>b.number>a.number?b:a);state.tables=state.tables.filter(t=>t!==broken);
  for(const id of shuffle(broken.seats.filter((p):p is number=>p!==null),deps.random)){
   const fewest=Math.min(...state.tables.map(count)),targets=state.tables.filter(t=>count(t)===fewest&&count(t)<TABLE_SIZE);
   seatPlayer(state,id,targets[deps.random(targets.length)],deps,round,'break',moves);
  }
 }
 // Balance: move the next big blind from the fullest table to the shortest until they differ by at most one.
 for(;;){
  const most=Math.max(...state.tables.map(count)),least=Math.min(...state.tables.map(count));if(most-least<=1)break;
  const from=state.tables.filter(t=>count(t)===most).reduce((a,b)=>b.number>a.number?b:a),to=state.tables.filter(t=>count(t)===least).reduce((a,b)=>b.number<a.number?b:a);
  const physical=nextBigBlind(from);seatPlayer(state,from.seats[physical]??fail(`No player in seat ${physical+1} at table ${from.number}`),to,deps,round,'balance',moves);
 }
 return moves;
}

/** Checks that must hold between rounds; used by tests and by save validation. */
export function checkMtt(state:MttState):void {
 const players=alive(state),total=players.reduce((sum,p)=>sum+p.stack,0);
 demand(total===state.players.length*state.startingStack,'Chips are not conserved between rounds');
 for(const table of state.tables){
  demand(table.seats.length===TABLE_SIZE,'A table must have nine seats');
  for(const [seat,id] of table.seats.entries())if(id!==null)demand(state.players[id].table===table.number&&state.players[id].seat===seat,'Seat map and player record disagree');
  // Once the event is over the last hand stays on the table for display; the knocked-out seats are already empty.
  if(state.status!=='complete'){demand(table.game.seats.every(s=>table.seats[physicalSeat(table,s.id)]!==null&&state.players[playerAt(table,s.id)].name===s.name),'A hand is dealt to an empty seat or the wrong player');demand(!table.seats.includes(0)||table.offset===table.seats.indexOf(0),'Hero must be seat 0 at their table');}
  if(state.status!=='complete')demand(table.game.seats.every(s=>s.startingStack===state.players[playerAt(table,s.id)].stack),'Hand starting stacks disagree with player records');
  assertAccounting(table.game);
 }
 for(const p of players)demand(state.tables.filter(t=>t.seats.includes(p.id)).length===1,'Each remaining player sits at exactly one table');
 const counts=state.tables.map(count);demand(state.status==='complete'||Math.max(...counts)-Math.min(...counts)<=1,'Tables are out of balance');
 demand(state.tables.length===Math.max(1,tablesFor(players.length))||state.status==='complete','Too many tables for the players left');
 demand(new Set(state.finishes.map(f=>f.player)).size===state.finishes.length,'A player finished twice');
 if(state.status==='complete'){demand(state.finishes.length===state.players.length&&state.finishes.reduce((s,f)=>s+f.prize,0)===state.ladder.reduce((a,b)=>a+b,0),'Final standings or prizes are incomplete');}
}

/** Display facts for the tournament screens. */
export function mttSummary(state:MttState){
 const players=alive(state),hero=state.players[0],heroAt=heroTable(state),paid=state.ladder.length,left=players.length;
 const ranked=[...players].sort((a,b)=>b.stack-a.stack||a.id-b.id);
 return {
  playersLeft:left,tablesLeft:state.tables.length,finalTable:state.tables.length===1,
  handForHand:left>paid&&left-paid<=state.tables.length,
  hero:heroAt&&hero.table!==null?{stack:hero.stack,rank:ranked.findIndex(p=>p.id===0)+1,table:hero.table,seat:hero.seat!+1}:null,
  /** Hero's most recent move, if it happened at the end of the last round. */
  heroMove:state.moves.filter(m=>m.player===0&&m.round===state.round-1).at(-1)??null,
  averageStack:Math.floor(state.players.length*state.startingStack/Math.max(1,left)),
  standings:ranked.map(p=>({id:p.id,name:p.name,stack:p.stack,table:p.table})),
 };
}
