import type { BotObservation, GameCommand, GameEvent, GameState, HeroViewModel, LegalActionSet, Pot, RuleProfile, Seat, StartHandInput } from '../contracts';
import { secureDeck, standardDeck } from './deck';
import { compareRanks, evaluate, handLabel } from './evaluator';
import { calculateRake, resolveRake, validateRake } from '../rules/rake';
import { assertSupportedCashScope } from '../session/release-scope';

export const ENGINE_VERSION = '0.4.0';
export const TOURNAMENT_ENGINE_VERSION = '0.5.0';
/** Cash profiles with live-straddle capability require this replay authority. */
export const STRADDLE_ENGINE_VERSION = '0.6.0';
export function engineVersionForProfile(profile:RuleProfile):string {return profile.mode==='tournament'?TOURNAMENT_ENGINE_VERSION:profile.straddle?STRADDLE_ENGINE_VERSION:ENGINE_VERSION;}
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
function requireCondition(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function clone<T>(value:T):T { return structuredClone(value); }
function seatById(state:GameState,id:number):Seat {
  const seat=state.seats.find(s=>s.id===id);
  requireCondition(seat, 'Unknown seat'); return seat;
}
function after(state:GameState,id:number):Seat[] {
  const i=state.seats.findIndex(s=>s.id===id);
  if(i<0)return clockwise(state.seats,id);
  return [...state.seats.slice(i+1),...state.seats.slice(0,i+1)];
}
/** Physical seat order also works when a between-hand change removes the marker. */
function clockwise(seats:Seat[],id:number):Seat[] {
  const ordered=[...seats].sort((a,b)=>a.id-b.id);
  return [...ordered.filter(s=>s.id>id),...ordered.filter(s=>s.id<=id)];
}

export type ReconfiguredGameState=GameState & {
  lastTableConfiguration?:{id:string;seats:StartHandInput['seats'];profile:RuleProfile};
};
function canAct(seat:Seat):boolean { return !seat.folded && !seat.allIn && seat.stack>0; }
function event(state:GameState,data:Omit<GameEvent,'id'|'handId'|'revision'>):void {
  state.events.push({id:`${state.handId}:${state.events.length}`,handId:state.handId,revision:state.revision,...data});
}
function transferToPot(state:GameState,seat:Seat,amount:number):void {
  requireCondition(integer(amount)&&amount%state.profile.chipUnit===0&&amount<=seat.stack, 'Invalid chip transfer');
  seat.stack-=amount; seat.streetCommitted+=amount; seat.totalCommitted+=amount; state.pot+=amount;
  seat.allIn=seat.stack===0;
}
function validateProfile(profile:RuleProfile):void {
  if(profile?.mode==='tournament') {
    // Apply the existing unsupported-option guard to every other profile field.
    const {tournament,...rest}=profile;assertSupportedCashScope({...rest,mode:'cash'});
    requireCondition(tournament&&integer(tournament.bigBlindAnte)&&tournament.antePriority==='blind-first'&&tournament.buttonRule==='dead-button','Unsupported tournament forced-bet profile');
    requireCondition(tournament.bigBlindAnte%profile.chipUnit===0,'Ante must match chip denomination');
    requireCondition(profile.rake?.basisPoints===0&&profile.rake.cap===0&&!profile.rake.source,'Tournaments cannot charge cash rake');
  } else assertSupportedCashScope(profile);
  // Live straddle (V410): cash only, under the gun, exactly twice the big blind.
  if(profile?.straddle!==undefined){const st=profile.straddle as unknown as Record<string,unknown>;requireCondition(profile.mode==='cash'&&st&&typeof st==='object'&&!Array.isArray(st)&&Object.keys(st).length===2&&Object.hasOwn(st,'kind')&&Object.hasOwn(st,'multiple')&&st.kind==='utg-live'&&st.multiple===2,'Unsupported straddle rule');requireCondition(Number.isSafeInteger(profile.bigBlind*2),'Straddle exceeds safe integer precision');}
  requireCondition(profile && (profile.mode==='cash'||profile.mode==='tournament') && integer(profile.chipUnit)&&profile.chipUnit>0, 'Only integer chip denominations are supported');
  requireCondition(typeof profile.id==='string'&&profile.id.length>0&&typeof profile.version==='string'&&profile.version.length>0,'Rule profile ID/version required');
  requireCondition(integer(profile.smallBlind)&&profile.smallBlind>0&&integer(profile.bigBlind)&&profile.bigBlind>=profile.smallBlind,'Invalid blinds');
  requireCondition(profile.smallBlind%profile.chipUnit===0&&profile.bigBlind%profile.chipUnit===0,'Blinds must match chip denomination');
  requireCondition(profile.shortRaiseReopens==='cumulative'&&profile.oddChipOrder==='clockwise-from-button','Unsupported rule profile');
  validateRake(profile.rake);
  requireCondition(profile.rake.cap%profile.chipUnit===0,'Rake cap must match chip denomination');
  const sourced=profile.rake as import('../rules/rake').VersionedRake;
  requireCondition(!sourced.capByDealtIn||Object.values(sourced.capByDealtIn).every(cap=>cap%profile.chipUnit===0),'Rake caps must match chip denomination');
  requireCondition(!sourced.source||profile.chipUnit===1,'Sourced online rake requires one-cent denomination');
}

export function startHand(input:StartHandInput):GameState {
  return initializeHand(input);
}

// The explicit deck path is private and used only to validate public imported records.
// Normal game creation has no deck/fixture parameter or exported initializer.
function initializeHand(input:StartHandInput,validationDeck?:string[],forcedBlinds?:{small:number;big:number;capacity:number}):GameState {
  requireCondition(input && typeof input.handId==='string'&&input.handId.length>0,'Hand ID required');
  validateProfile(input.profile);
  if(input.straddle!==undefined){const st=input.straddle as unknown as Record<string,unknown>;requireCondition(st&&typeof st==='object'&&!Array.isArray(st)&&Object.keys(st).length===1&&Object.hasOwn(st,'seatId')&&integer(st.seatId as number),'Invalid straddle request');}
  requireCondition(Array.isArray(input.seats)&&input.seats.length>=2&&input.seats.length<=10,'Use 2–10 funded seats');
  requireCondition(new Set(input.seats.map(s=>s.id)).size===input.seats.length,'Duplicate seat ID');
  requireCondition(input.seats.every(s=>integer(s.id)&&s.id<10&&integer(s.stack)&&s.stack>0&&typeof s.name==='string'),'Invalid seat or stack');
  requireCondition(input.seats.every(s=>s.stack%input.profile.chipUnit===0),'Stacks must match chip denomination');
  const initialTotal=input.seats.reduce((n,s)=>n+s.stack,0);
  requireCondition(Number.isSafeInteger(initialTotal),'Total chips exceed safe integer precision');
  const seats:Seat[]=input.seats.map(s=>({...s,startingStack:s.stack,hole:[],streetCommitted:0,totalCommitted:0,folded:false,allIn:false,lastActedBet:null})).sort((a,b)=>a.id-b.id);
  const capacity=forcedBlinds?.capacity??Math.max(...seats.map(s=>s.id))+1;
  requireCondition(integer(capacity)&&capacity>=2&&capacity<=10&&seats.every(s=>s.id<capacity),'Invalid physical table capacity');
  if(forcedBlinds)requireCondition(integer(forcedBlinds.small)&&forcedBlinds.small<capacity&&seats.some(s=>s.id===forcedBlinds.big),'Invalid tournament blind positions');
  requireCondition(seats.some(s=>s.id===input.button)||(input.profile.mode==='tournament'&&integer(input.button)&&input.button<capacity),'Button must be a participating seat or valid tournament dead-button position');
  const state:GameState={schemaVersion:'0.1.0',engineVersion:engineVersionForProfile(input.profile),handId:input.handId,revision:0,profile:clone(input.profile),seats,button:input.button,smallBlindSeat:0,bigBlindSeat:0,street:'preflop',board:[],deck:validationDeck??secureDeck(),deckCursor:0,burned:[],actor:null,currentBet:input.profile.bigBlind,minFullRaiseIncrement:input.profile.bigBlind,pending:[],pot:0,pots:[],rake:0,initialTotal,events:[],committedDecisionIds:[],payouts:{},revealedSeats:[]};
  if(input.profile.mode==='tournament')state.tournamentSeatCount=capacity;
  state.profile.rake=resolveRake(state.profile.rake,seats.length);
  state.smallBlindSeat=seats.length===2?state.button:after(state,state.button)[0].id;
  state.bigBlindSeat=after(state,state.smallBlindSeat)[0].id;
  if(forcedBlinds){state.smallBlindSeat=forcedBlinds.small;state.bigBlindSeat=forcedBlinds.big;}
  event(state,{type:'start',detail:`${state.profile.id}@${state.profile.version}`});
  for(let round=0;round<2;round++) for(const seat of after(state,state.button)) seat.hole.push(state.deck[state.deckCursor++]);
  for(const [id,blind] of [[state.smallBlindSeat,state.profile.smallBlind],[state.bigBlindSeat,state.profile.bigBlind]]) {
    const seat=state.seats.find(s=>s.id===id);if(!seat)continue; // A tournament SB may be dead.
    const amount=Math.min(seat.stack,blind);
    transferToPot(state,seat,amount); event(state,{type:'blind',seatId:id,amount});
  }
  if(state.profile.mode==='tournament'&&state.profile.tournament!.bigBlindAnte>0){
    const seat=seatById(state,state.bigBlindSeat),amount=Math.min(seat.stack,state.profile.tournament!.bigBlindAnte);
    seat.stack-=amount;seat.totalCommitted+=amount;seat.deadAnte=amount;seat.allIn=seat.stack===0;state.pot+=amount;
    event(state,{type:'ante',seatId:seat.id,amount,detail:'Big blind ante; blind funded first; dead money in main pot'});
  }
  state.pending=after(state,state.bigBlindSeat).filter(canAct).map(s=>s.id);
  if(input.straddle!==undefined){
    // A voluntary live straddle: posted before the cards are acted on, it is the current bet, the
    // minimum raise is one more straddle, and the straddler acts last before the flop (the option).
    requireCondition(state.profile.straddle?.kind==='utg-live'&&state.profile.mode==='cash'&&!forcedBlinds,'Straddles are not enabled for these rules');
    const utg=after(state,state.bigBlindSeat)[0],amount=state.profile.bigBlind*state.profile.straddle.multiple;
    requireCondition(state.seats.length>=4&&input.straddle.seatId===utg.id,'Only the player under the gun may straddle, with four or more players');
    requireCondition(utg.stack>amount,'A straddle needs chips behind it');
    transferToPot(state,utg,amount);event(state,{type:'blind',seatId:utg.id,amount,detail:'Live straddle'});
    state.straddleSeat=utg.id;state.currentBet=amount;state.minFullRaiseIncrement=amount;
    state.pending=after(state,utg.id).filter(canAct).map(s=>s.id);
  }
  progress(state);
  assertAccounting(state);
  return state;
}
/** The seat that would be under the gun next hand (the straddle seat), or null with fewer than four funded players. */
export function nextHandStraddleSeat(previous:GameState):number|null {
  const funded=previous.seats.filter(s=>s.stack>0);
  if(funded.length<4)return null;
  const button=clockwise(funded,previous.button)[0].id,small=clockwise(funded,button)[0].id,big=clockwise(funded,small)[0].id;
  return clockwise(funded,big)[0].id;
}

/** Practice cash uses a moving occupied button; HU preserves the next BB obligation.
 * Seat selection and chip carry-forward belong to authority, never the table UI.
 */
export function nextHand(previous:GameState,handId:string,straddle?:(seatId:number)=>boolean):GameState {
  requireCondition(previous.profile.mode==='cash','Use tournament hand-boundary authority');
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before dealing again');
  requireCondition(typeof handId==='string'&&handId.length>0&&handId!==previous.handId,'A fresh hand ID is required');
  assertAccounting(previous);
  const funded=previous.seats.filter(s=>s.stack>0);
  requireCondition(funded.length>=2,'At least two funded seats are required for the next hand');
  let button:number;
  if(funded.length===2) {
    // A simple button advance can incorrectly charge the previous BB twice when
    // three or more seats collapse to heads-up. Advance the BB, then derive BTN.
    const bigBlind=clockwise(funded,previous.bigBlindSeat)[0].id;
    button=funded.find(s=>s.id!==bigBlind)!.id;
  } else button=clockwise(funded,previous.button)[0].id;
  // A voluntary straddle is asked of the next under-the-gun player only when the rules allow one.
  const utg=previous.profile.straddle&&straddle?nextHandStraddleSeat(previous):null;
  const amount=previous.profile.bigBlind*(previous.profile.straddle?.multiple??2),posts=utg!==null&&funded.find(s=>s.id===utg)!.stack>amount&&straddle!(utg);
  const state:ReconfiguredGameState=startHand({handId,profile:previous.profile,button,seats:funded.map(({id,name,stack})=>({id,name,stack})),...(posts?{straddle:{seatId:utg!}}:{})});
  if(previous.tableTransfers) state.tableTransfers=clone(previous.tableTransfers);
  const configured=previous as ReconfiguredGameState;
  if(configured.lastTableConfiguration)state.lastTableConfiguration=clone(configured.lastTableConfiguration);
  return state;
}

/** TDA 2026 dead-button progression: advance the BB to the next funded seat,
 * retain the previous BB position for the SB (possibly dead), then advance
 * the button to the previous SB when occupied. A dead button moves across the
 * vacant gap immediately before the SB, maximizing permissible incoming seats. HU derives the button from the next BB instead.
 * Level changes are accepted only here, after the previous hand is settled. */
export function nextTournamentHand(previous:GameState,handId:string,profile:RuleProfile):GameState {
  requireCondition(previous.profile.mode==='tournament'&&profile.mode==='tournament','Tournament profile required');
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before dealing again');
  requireCondition(typeof handId==='string'&&handId.length>0&&handId!==previous.handId,'A fresh hand ID is required');
  requireCondition(previous.profile.id===profile.id&&previous.profile.version===profile.version&&previous.profile.chipUnit===profile.chipUnit,'Tournament rules cannot change mid-event');
  assertAccounting(previous);validateProfile(profile);
  const funded=previous.seats.filter(s=>s.stack>0);
  requireCondition(funded.length>=2,'Tournament has a unique winner; no further hand');
  const capacity=previous.tournamentSeatCount??Math.max(...previous.seats.map(s=>s.id))+1;
  const big=clockwise(funded,previous.bigBlindSeat)[0].id;
  const small=funded.length===2?funded.find(s=>s.id!==big)!.id:previous.bigBlindSeat;
  const button=funded.length===2?small:funded.some(s=>s.id===previous.smallBlindSeat)?previous.smallBlindSeat:(small+capacity-1)%capacity;
  return initializeHand({handId,profile,button,seats:funded.map(({id,name,stack})=>({id,name,stack}))},undefined,{small,big,capacity});
}

/** Multi-table tournaments: the next hand at a table whose players changed between hands, because
 * players were moved in by balancing or out by balancing or a table break. `seats` lists everyone
 * now at the table with their current stacks, newcomers included. Blinds follow the same TDA
 * dead-button progression as nextTournamentHand over the seats now occupied: the big blind moves
 * to the next occupied seat clockwise, the previous big blind's seat owes the small blind (dead if
 * empty), and the button follows. A newcomer is dealt in at once in whichever seat they were given.
 */
export function nextTournamentTableHand(previous:GameState,handId:string,profile:RuleProfile,seats:StartHandInput['seats'],tableCapacity?:number):GameState {
  requireCondition(previous.profile.mode==='tournament'&&profile.mode==='tournament','Tournament profile required');
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before dealing again');
  requireCondition(typeof handId==='string'&&handId.length>0&&handId!==previous.handId,'A fresh hand ID is required');
  requireCondition(previous.profile.id===profile.id&&previous.profile.version===profile.version&&previous.profile.chipUnit===profile.chipUnit,'Tournament rules cannot change mid-event');
  assertAccounting(previous);validateProfile(profile);
  const capacity=tableCapacity??previous.tournamentSeatCount??Math.max(...previous.seats.map(s=>s.id))+1;
  requireCondition(integer(capacity)&&capacity>=2&&capacity<=10,'Invalid physical table capacity');
  requireCondition(Array.isArray(seats)&&seats.length>=2&&new Set(seats.map(s=>s.id)).size===seats.length&&seats.every(s=>integer(s.id)&&s.id>=0&&s.id<capacity&&integer(s.stack)&&s.stack>0&&typeof s.name==='string'),'Invalid table seating for the next hand');
  const present=seats.map(s=>({id:s.id}) as Seat);
  const big=clockwise(present,previous.bigBlindSeat)[0].id;
  const small=present.length===2?present.find(s=>s.id!==big)!.id:previous.bigBlindSeat;
  const button=present.length===2?small:present.some(s=>s.id===previous.smallBlindSeat)?previous.smallBlindSeat:(small+capacity-1)%capacity;
  return initializeHand({handId,profile,button,seats:seats.map(({id,name,stack})=>({id,name,stack}))},undefined,{small,big,capacity});
}

/** Multi-table tournaments: the first hand at a table of known physical size (nine seats), whatever
 * seats happen to be occupied, so players can later be moved into any empty seat. Blinds as startHand. */
export function startTournamentTableHand(input:StartHandInput,tableCapacity:number):GameState {
  requireCondition(input?.profile?.mode==='tournament','Tournament profile required');
  requireCondition(integer(tableCapacity)&&tableCapacity>=2&&tableCapacity<=10&&Array.isArray(input.seats)&&input.seats.length>=2&&input.seats.every(s=>integer(s.id)&&s.id>=0&&s.id<tableCapacity),'Invalid physical table capacity');
  const present=input.seats.map(s=>({id:s.id}) as Seat);
  requireCondition(present.some(s=>s.id===input.button),'The first button must be an occupied seat');
  const small=present.length===2?input.button:clockwise(present,input.button)[0].id,big=clockwise(present,small)[0].id;
  return initializeHand(input,undefined,{small,big,capacity:tableCapacity});
}

function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Engine-owned between-hand external transfers. Caller must already have stored
 * the immutable completed hand, then atomically call nextHand and pair the Hero
 * delta with the wallet ledger. This intermediate configuration is never a new
 * poker result and must not be persisted, displayed or exported as a hand replay.
 */
export function reconfigureTable(previous:GameState,seats:StartHandInput['seats'],profile:RuleProfile,transferId:string):ReconfiguredGameState {
  requireCondition(previous.profile.mode==='cash'&&profile.mode==='cash','Tournament seats and stacks cannot be reconfigured through cash transfers');
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before reconfiguring');
  requireCondition(typeof transferId==='string'&&transferId.length>0,'Transfer ID required');
  validateProfile(profile);
  requireCondition(Array.isArray(seats)&&seats.length>=2&&seats.length<=10,'Use 2–10 occupied seats');
  requireCondition(new Set(seats.map(s=>s.id)).size===seats.length,'Duplicate seat ID');
  requireCondition(seats.every(s=>integer(s.id)&&s.id<10&&integer(s.stack)&&typeof s.name==='string'),'Invalid seat or stack');
  requireCondition(seats.every(s=>s.stack%profile.chipUnit===0),'Stacks must match chip denomination');
  requireCondition(seats.filter(s=>s.stack>0).length>=2,'At least two funded seats are required for the next hand');
  const request={id:transferId,seats:seats.map(({id,name,stack})=>({id,name,stack})).sort((a,b)=>a.id-b.id),profile:clone(profile)};
  const prior=(previous as ReconfiguredGameState).lastTableConfiguration;
  if(prior?.id===transferId){
    requireCondition(canonical(prior)===canonical(request),'Conflicting table configuration ID');
    return previous as ReconfiguredGameState;
  }
  const receiptPrefix=`configuration:${transferId.length}:${transferId}:seat:`;
  requireCondition(!previous.tableTransfers?.some(t=>t.id.startsWith(receiptPrefix)),'Table configuration ID already applied');
  assertAccounting(previous);
  const before=new Map(previous.seats.map(s=>[s.id,s]));
  const target=new Map(request.seats.map(s=>[s.id,s]));
  const ids=[...new Set([...before.keys(),...target.keys()])].sort((a,b)=>a-b);
  const transfers=ids.map(seatId=>({id:`${receiptPrefix}${seatId}`,seatId,amount:(target.get(seatId)?.stack??0)-(before.get(seatId)?.stack??0)}));
  const initialTotal=previous.initialTotal+transfers.reduce((sum,t)=>sum+t.amount,0);
  requireCondition(integer(initialTotal)&&Number.isSafeInteger(request.seats.reduce((sum,s)=>sum+s.stack,0)),'Total chips exceed safe integer precision');
  const state:ReconfiguredGameState=clone(previous);
  state.seats=request.seats.map(seat=>{
    const existing=before.get(seat.id);
    return existing?{...clone(existing),name:seat.name,stack:seat.stack,allIn:seat.stack===0}:
      {...seat,startingStack:0,hole:[],streetCommitted:0,totalCommitted:0,folded:true,allIn:seat.stack===0,lastActedBet:null};
  });
  state.profile=clone(profile);state.engineVersion=engineVersionForProfile(profile);state.initialTotal=initialTotal;state.revision++;
  state.tableTransfers=[...(state.tableTransfers??[]),...transfers];state.lastTableConfiguration=request;
  assertAccounting(state);
  return state;
}

/** A wallet-funded transfer between hands, separate from poker action/payout events.
 * The caller must atomically persist the paired wallet debit with this candidate.
 * Completed hand records must be captured before invoking this transition.
 */
export function topUpTable(previous:GameState,seatId:number,amount:number,transferId:string,maxStack:number):GameState {
  requireCondition(previous.profile.mode==='cash','Tournament freezeouts do not permit cash top-ups');
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before adding chips');
  requireCondition(typeof transferId==='string'&&transferId.length>0,'Transfer ID required');
  requireCondition(integer(amount)&&amount>0&&integer(maxStack)&&maxStack>0,'Invalid table transfer');
  requireCondition(amount%previous.profile.chipUnit===0&&maxStack%previous.profile.chipUnit===0,'Transfer must match chip denomination');
  const prior=previous.tableTransfers?.find(t=>t.id===transferId);
  if(prior) {
    requireCondition(prior.seatId===seatId&&prior.amount===amount,'Conflicting transfer ID');
    return previous;
  }
  assertAccounting(previous);
  const seat=seatById(previous,seatId);
  requireCondition(Number.isSafeInteger(seat.stack+amount)&&seat.stack+amount<=maxStack,'Top-up exceeds the table maximum');
  requireCondition(Number.isSafeInteger(previous.initialTotal+amount),'Total chips exceed safe integer precision');
  const state=clone(previous);
  const recipient=seatById(state,seatId);
  recipient.stack+=amount; recipient.allIn=false;
  state.initialTotal+=amount; state.revision+=1;
  state.tableTransfers=[...(state.tableTransfers??[]),{id:transferId,seatId,amount}];
  assertAccounting(state);
  return state;
}

export function legalActions(state:GameState):LegalActionSet {
  const none:LegalActionSet={actor:null,fold:false,check:false,callAmount:0,minRaiseTo:null,maxRaiseTo:null,canRaise:false,shortAllInTo:null,reopened:false};
  if(state.street==='complete'||state.actor===null) return none;
  const seat=seatById(state,state.actor);
  const owed=Math.max(0,state.currentBet-seat.streetCommitted);
  // Checking before the first wager does not surrender the right to raise.
  const reopened=seat.lastActedBet===null||seat.lastActedBet===0||state.currentBet-seat.lastActedBet>=state.minFullRaiseIncrement;
  const minRaiseTo=state.currentBet===0?state.profile.bigBlind:state.currentBet+state.minFullRaiseIncrement;
  const maxRaiseTo=seat.streetCommitted+seat.stack;
  const opponentCanRespond=state.seats.some(s=>s.id!==seat.id&&canAct(s));
  const canRaise=reopened&&maxRaiseTo>state.currentBet&&opponentCanRespond;
  return {actor:seat.id,fold:true,check:owed===0,callAmount:Math.min(owed,seat.stack),minRaiseTo:canRaise?minRaiseTo:null,maxRaiseTo:canRaise?maxRaiseTo:null,canRaise,shortAllInTo:canRaise&&maxRaiseTo<minRaiseTo?maxRaiseTo:null,reopened};
}

export function applyCommand(previous:GameState,command:GameCommand):GameState {
  requireCondition(command&&command.handId===previous.handId,'Stale hand');
  requireCondition(typeof command.decisionId==='string'&&command.decisionId.length>0,'Decision ID required');
  // Retry of an already committed command is inert, including after settlement.
  if(previous.committedDecisionIds.includes(command.decisionId)) return previous;
  requireCondition(command.revision===previous.revision,'Stale revision');
  requireCondition(previous.street!=='complete'&&command.seatId===previous.actor,'Not the acting seat');
  const legal=legalActions(previous);
  requireCondition(command.action&&typeof command.action.type==='string','Invalid action');
  const type=command.action.type;
  requireCondition(['fold','check','call','raise'].includes(type),'Unknown action');
  if(type==='check') requireCondition(legal.check,'Cannot check facing a bet');
  if(type==='call') requireCondition(legal.callAmount>0,'Nothing to call');
  if(type==='raise') {
    const to=command.action.to;
    requireCondition(legal.canRaise&&integer(to)&&to%previous.profile.chipUnit===0&&to>previous.currentBet&&to<=legal.maxRaiseTo!,'Illegal raise');
    requireCondition(to>=legal.minRaiseTo!||to===legal.shortAllInTo,'Raise below minimum unless all-in');
  }
  const state=clone(previous); state.revision++;
  const seat=seatById(state,command.seatId);
  let amount=0;
  if(type==='fold') seat.folded=true;
  if(type==='call') { amount=legal.callAmount; transferToPot(state,seat,amount); }
  if(type==='raise'&&command.action.type==='raise') {
    amount=command.action.to-seat.streetCommitted;
    const increment=command.action.to-state.currentBet;
    transferToPot(state,seat,amount);
    if(increment>=state.minFullRaiseIncrement) state.minFullRaiseIncrement=increment;
    state.currentBet=command.action.to;
    state.pending=after(state,seat.id).filter(s=>s.id!==seat.id&&canAct(s)).map(s=>s.id);
  } else state.pending=state.pending.filter(id=>id!==seat.id);
  seat.lastActedBet=state.currentBet;
  state.committedDecisionIds.push(command.decisionId);
  event(state,{type:'action',seatId:seat.id,amount,action:clone(command.action),decisionId:command.decisionId,street:state.street});
  progress(state);
  assertAccounting(state);
  return state;
}

function progress(state:GameState):void {
  for(;;) {
    const contenders=state.seats.filter(s=>!s.folded);
    if(contenders.length===1) { settle(state,false); return; }
    const actors=state.seats.filter(canAct);
    state.pending=state.pending.filter(id=>canAct(seatById(state,id)));
    if(actors.length===1) {
      const only=actors[0];
      const opponentBet=Math.max(...contenders.filter(s=>s.id!==only.id).map(s=>s.streetCommitted));
      if(only.streetCommitted>=opponentBet) state.pending=[];
      else { state.currentBet=opponentBet; state.pending=[only.id]; }
    }
    if(state.pending.length) { state.actor=state.pending[0]; return; }
    state.actor=null;
    if(state.street==='river') { settle(state,true); return; }
    const next=state.street==='preflop'?'flop':state.street==='flop'?'turn':'river';
    state.burned.push(state.deck[state.deckCursor++]);
    const cards=state.deck.slice(state.deckCursor,state.deckCursor+(next==='flop'?3:1));
    state.deckCursor+=cards.length; state.board.push(...cards); state.street=next;
    requireCondition(state.board.every(Boolean)&&state.deckCursor<=52,'Deck exhausted');
    event(state,{type:'street',street:next,cards:[...cards]});
    state.currentBet=0; state.minFullRaiseIncrement=state.profile.bigBlind;
    state.seats.forEach(s=>{s.streetCommitted=0;s.lastActedBet=null;});
    state.pending=after(state,state.button).filter(canAct).map(s=>s.id);
  }
}

/** One pot derivation for active display and settlement. Amounts are provisional
 * until betting closes; newly matching callers may change the eligible groups.
 */
export function derivePots(state:Pick<HeroViewModel,'seats'>):{pots:Pot[];uncalledBet:{seatId:number;amount:number}|null} {
  const wager=(seat:Pick<Seat,'totalCommitted'|'deadAnte'>)=>seat.totalCommitted-(seat.deadAnte??0);
  const ante=state.seats.reduce((sum,seat)=>sum+(seat.deadAnte??0),0);
  const ordered=[...state.seats].sort((a,b)=>wager(b)-wager(a));
  const excess=wager(ordered[0])-wager(ordered[1]);
  const uncalledBet=excess>0?{seatId:ordered[0].id,amount:excess}:null;
  const contributions=state.seats.map(seat=>({seat,amount:wager(seat)-(uncalledBet?.seatId===seat.id?uncalledBet.amount:0)}));
  const levels=[...new Set(contributions.map(c=>c.amount).filter(n=>n>0))].sort((a,b)=>a-b);
  const pots:Pot[]=[]; let before=0;
  for(const level of levels) {
    const contributors=contributions.filter(c=>c.amount>=level);
    const eligible=contributors.filter(c=>!c.seat.folded).map(c=>c.seat.id);
    requireCondition(eligible.length>0,'Pot has no eligible winner');
    const amount=(level-before)*contributors.length;
    const previous=pots[pots.length-1];
    // Folded thresholds do not create side pots or additional odd-chip awards.
    if(previous&&previous.eligible.length===eligible.length&&previous.eligible.every((id,i)=>id===eligible[i])) previous.amount+=amount;
    else pots.push({amount,eligible,winners:[]});
    before=level;
  }
  if(ante>0){if(pots.length)pots[0].amount+=ante;else pots.push({amount:ante,eligible:state.seats.filter(s=>!s.folded).map(s=>s.id),winners:[]});}
  return {pots,uncalledBet};
}

function settle(state:GameState,showdown:boolean):void {
  if(state.street==='complete') return;
  const {pots,uncalledBet}=derivePots(state);
  // Return unmatched excess before rake or payout; it is never a side pot.
  if(uncalledBet) {
    const winner=seatById(state,uncalledBet.seatId); const refund=uncalledBet.amount;
    winner.totalCommitted-=refund; winner.streetCommitted=Math.max(0,winner.streetCommitted-refund); winner.stack+=refund;
    winner.allIn=winner.stack===0; state.pot-=refund;
    event(state,{type:'refund',seatId:winner.id,amount:refund});
  }
  state.rake=calculateRake(state.pot,state.board.length,state.profile.rake,state.profile.chipUnit);
  let rakeRemaining=state.rake;
  if(state.rake) event(state,{type:'rake',amount:state.rake});
  if(showdown) state.revealedSeats=state.seats.filter(s=>!s.folded).map(s=>s.id);
  const ranks=new Map(state.revealedSeats.map(id=>[id,evaluate([...seatById(state,id).hole,...state.board])]));
  for(const pot of pots) {
    const taken=Math.min(rakeRemaining,pot.amount); pot.amount-=taken; rakeRemaining-=taken;
    let winners=[pot.eligible[0]];
    if(showdown) for(const id of pot.eligible.slice(1)) {
      const c=compareRanks(ranks.get(id)!,ranks.get(winners[0])!);
      if(c>0) winners=[id]; else if(c===0) winners.push(id);
    }
    pot.winners=winners;
    const order=after(state,state.button).filter(s=>winners.includes(s.id));
    const chipUnit=state.profile.chipUnit;
    const share=Math.floor(pot.amount/chipUnit/winners.length)*chipUnit; const odd=(pot.amount-share*winners.length)/chipUnit;
    order.forEach((s,i)=>{
      const amount=share+(i<odd?chipUnit:0); s.stack+=amount; s.allIn=s.stack===0;
      state.payouts[s.id]=(state.payouts[s.id]??0)+amount;
      event(state,{type:'award',seatId:s.id,amount,detail:showdown?'Showdown':'Uncontested'});
    });
  }
  state.pots=pots; state.pot=0; state.street='complete'; state.actor=null; state.pending=[];
}

export function assertAccounting(state:GameState):void {
  requireCondition(state.engineVersion===engineVersionForProfile(state.profile)||(state.profile.mode==='cash'&&state.profile.straddle===undefined&&state.engineVersion==='0.3.0'),'Unsupported engine version for rule profile');
  requireCondition(state.seats.every(s=>integer(s.stack)&&integer(s.totalCommitted)&&integer(s.streetCommitted)&&integer(s.deadAnte??0)&&(s.deadAnte??0)<=s.totalCommitted), 'Invalid chip state');
  requireCondition(state.seats.reduce((n,s)=>n+s.stack,0)+state.pot+state.rake===state.initialTotal,'Chip conservation failure');
}

export function projectView(state:GameState,heroSeat:number):HeroViewModel {
  requireCondition(state.seats.some(s=>s.id===heroSeat),'Unknown viewer seat');
  return projectAllowedView(state,heroSeat);
}

/** Tournament observer after elimination: no private hole cards until revealed. */
export function projectSpectatorView(state:GameState):HeroViewModel {
  requireCondition(state.profile.mode==='tournament','Tournament spectator view requires a tournament');
  const view=projectAllowedView(state,-1);
  view.legal={actor:null,fold:false,check:false,callAmount:0,minRaiseTo:null,maxRaiseTo:null,canRaise:false,shortAllInTo:null,reopened:false};
  return view;
}

function projectAllowedView(state:GameState,heroSeat:number):HeroViewModel {
  const seats=state.seats.map(({lastActedBet:_lastActedBet,hole,...seat})=>({...seat,hole:seat.id===heroSeat||state.revealedSeats.includes(seat.id)?[...hole]:[]}));
  const {pots,uncalledBet}=state.street==='complete'?{pots:state.pots,uncalledBet:null}:derivePots(state);
  const handLabels:Record<number,string>={};
  if(state.street==='complete'&&state.board.length===5) {
    for(const seat of state.seats) if(!seat.folded&&state.revealedSeats.includes(seat.id)) handLabels[seat.id]=handLabel(evaluate([...seat.hole,...state.board]));
  }
  return clone({...((state.profile.straddle===undefined)?{}:{engineVersion:STRADDLE_ENGINE_VERSION}),...((state.tournamentSeatCount===undefined)?{}:{tournamentSeatCount:state.tournamentSeatCount}),...(state.straddleSeat===undefined?{}:{straddleSeat:state.straddleSeat}),handId:state.handId,revision:state.revision,profile:state.profile,seats,button:state.button,smallBlindSeat:state.smallBlindSeat,bigBlindSeat:state.bigBlindSeat,street:state.street,board:state.board,actor:state.actor,pot:state.pot,pots,rake:state.rake,payouts:state.payouts,legal:legalActions(state),events:state.events,uncalledBet,handLabels});
}

export function observeBot(state:GameState,seatId:number,policyVersion:string,decisionId:string):BotObservation {
  requireCondition(state.actor===seatId&&state.street!=='complete','Observation requires current actor');
  requireCondition(typeof policyVersion==='string'&&policyVersion.length>0&&typeof decisionId==='string'&&decisionId.length>0,'Decision identity required');
  return clone({handId:state.handId,revision:state.revision,actingSeat:seatId,decisionId,policyVersion,ownCards:seatById(state,seatId).hole,board:state.board,street:state.street,button:state.button,pot:state.pot,bigBlind:state.profile.bigBlind,...(state.profile.chipUnit===1?{}:{chipUnit:state.profile.chipUnit}),seats:state.seats.map(({id,stack,streetCommitted,totalCommitted,deadAnte,folded,allIn})=>({id,stack,streetCommitted,totalCommitted,...(deadAnte===undefined?{}:{deadAnte}),folded,allIn})),legal:legalActions(state),publicEvents:state.events});
}


/** Cheap capability/forced-bet check used before accepting saved public cash records.
 * Full action/card validation remains validatePublicReplay's responsibility. */
export function assertPublicReplayVersion(frame:HeroViewModel):void {
  const enabled=frame.profile.straddle!==undefined;
  requireCondition(enabled?frame.engineVersion===STRADDLE_ENGINE_VERSION:frame.engineVersion===undefined,'Unsupported public replay engine version');
  if(enabled)validateProfile(frame.profile);
  const posts=frame.events.filter(e=>e.type==='blind'&&e.detail==='Live straddle');
  if(frame.straddleSeat===undefined){requireCondition(posts.length===0,'Straddle event is missing its seat');return;}
  requireCondition(enabled&&frame.profile.mode==='cash'&&frame.seats.length>=4,'Straddle seat requires supported rules');
  const ordered=[...frame.seats].sort((a,b)=>a.id-b.id),utg=[...ordered.filter(s=>s.id>frame.bigBlindSeat),...ordered.filter(s=>s.id<=frame.bigBlindSeat)][0];
  requireCondition(integer(frame.straddleSeat)&&utg?.id===frame.straddleSeat,'Invalid public straddle position');
  requireCondition(posts.length===1&&posts[0].seatId===frame.straddleSeat&&posts[0].amount===frame.profile.bigBlind*2&&posts[0].revision===0,'Invalid public straddle posting');
}

/** Reconstruct a possible private deal from permitted public information and replay
 * every command through the canonical reducer. Returns no private state/cards and
 * cannot create or overwrite a live game. Unknown/mucked cards get unused fillers.
 */
export function validatePublicReplay(frames:HeroViewModel[]):void {
  requireCondition(Array.isArray(frames)&&frames.length>0,'Replay frames required');
  for(const frame of frames)assertPublicReplayVersion(frame);
  const first=frames[0],last=frames[frames.length-1];
  requireCondition(first&&last&&first.revision===0&&last.street==='complete','Replay must start at revision zero and finish settled');
  requireCondition(first.seats.some(seat=>seat.id===0),'Replay must contain Hero');
  const seats=[...first.seats].sort((a,b)=>a.id-b.id);
  const lastById=new Map(last.seats.map(seat=>[seat.id,seat]));
  const knownHoles=new Map<number,string[]>();
  for(const seat of seats) {
    const final=lastById.get(seat.id);
    requireCondition(final&&Array.isArray(final.hole)&&(final.hole.length===0||final.hole.length===2),'Invalid replay hole cards');
    // Hero is always visible. Villains are known only if revealed at completion.
    const known=seat.id===0?first.seats.find(s=>s.id===0)!.hole:final.hole;
    requireCondition(Array.isArray(known)&&(known.length===0||known.length===2),'Invalid replay hole cards');
    if(seat.id===0)requireCondition(known.length===2,'Hero cards required');
    knownHoles.set(seat.id,[...known]);
  }
  requireCondition(Array.isArray(last.board)&&[0,3,4,5].includes(last.board.length),'Invalid replay board');
  const known=[...knownHoles.values()].flat().concat(last.board);
  requireCondition(known.every(card=>typeof card==='string'&&/^[2-9TJQKA][cdhs]$/.test(card))&&new Set(known).size===known.length,'Repeated or invalid replay cards');
  const unused=standardDeck().filter(card=>!known.includes(card));
  const take=()=>{const card=unused.shift();requireCondition(card,'Replay deck exhausted');return card;};
  for(const seat of seats)if(knownHoles.get(seat.id)!.length===0)knownHoles.set(seat.id,[take(),take()]);
  const buttonIndex=seats.findIndex(seat=>seat.id===first.button);
  requireCondition(buttonIndex>=0||first.profile.mode==='tournament','Replay button missing');
  const order=buttonIndex>=0?[...seats.slice(buttonIndex+1),...seats.slice(0,buttonIndex+1)]:[...seats.filter(s=>s.id>first.button),...seats.filter(s=>s.id<=first.button)];
  const deck:string[]=[];
  for(let round=0;round<2;round++)for(const seat of order)deck.push(knownHoles.get(seat.id)![round]);
  const board=Array.from({length:5},(_,i)=>last.board[i]??take());
  deck.push(take(),...board.slice(0,3),take(),board[3],take(),board[4],...unused);
  requireCondition(deck.length===52&&new Set(deck).size===52,'Invalid replay deck');
  let forcedBlinds:{small:number;big:number;capacity:number}|undefined;
  if(first.profile.mode==='tournament') {
    const capacity=first.tournamentSeatCount;
    requireCondition(capacity&&integer(capacity)&&capacity>=2&&capacity<=10&&seats.every(s=>s.id<capacity),'Invalid tournament replay capacity');
    requireCondition(integer(first.smallBlindSeat)&&first.smallBlindSeat<capacity&&seats.some(s=>s.id===first.bigBlindSeat),'Invalid tournament replay blinds');
    const next=[...seats.filter(s=>s.id>first.smallBlindSeat),...seats.filter(s=>s.id<=first.smallBlindSeat)][0].id;
    requireCondition(next===first.bigBlindSeat&&(seats.length!==2||first.button===first.smallBlindSeat),'Invalid tournament replay blind order');
    forcedBlinds={small:first.smallBlindSeat,big:first.bigBlindSeat,capacity};
  }
  let state=initializeHand({handId:first.handId,button:first.button,profile:first.profile,seats:seats.map(seat=>({id:seat.id,name:seat.name,stack:seat.startingStack})),...(first.straddleSeat!==undefined?{straddle:{seatId:first.straddleSeat}}:{})},deck,forcedBlinds);
  const canonical=(value:unknown):string=>JSON.stringify(normalize(value));
  function normalize(value:unknown):unknown {
    if(Array.isArray(value))return value.map(normalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,entry])=>entry!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>[key,normalize(entry)]));
    return value;
  }
  requireCondition(canonical(projectView(state,0))===canonical(first),'Initial replay frame differs from authoritative deal');
  for(let index=1;index<frames.length;index++) {
    requireCondition(state.street!=='complete','Replay continues after settlement');
    const frame=frames[index];
    requireCondition(frame&&frame.handId===state.handId&&frame.revision===state.revision+1,'Replay revision discontinuity');
    requireCondition(Array.isArray(frame.events),'Replay events required');
    const additions=frame.events.slice(state.events.length),actions=additions.filter(event=>event.type==='action');
    requireCondition(actions.length===1,'One authoritative action per replay revision required');
    const action=actions[0];
    requireCondition(action.action&&action.decisionId&&action.seatId===state.actor&&action.revision===frame.revision&&action.handId===state.handId,'Replay action identity mismatch');
    state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:action.seatId!,decisionId:action.decisionId,action:action.action});
    requireCondition(canonical(projectView(state,0))===canonical(frame),'Replay frame differs from authoritative action');
  }
  requireCondition(state.street==='complete','Replay did not settle');
}

/** Audit a committed tournament hand through the original authoritative reducer.
 * Saved private cards never leave this function; returned frames obey normal visibility.
 * No live state, storage or randomness is changed. Unknown engine versions fail closed.
 */
export function replayTournamentHand(saved:GameState):HeroViewModel[] {
  requireCondition(saved.profile.mode==='tournament'&&saved.engineVersion===TOURNAMENT_ENGINE_VERSION&&saved.schemaVersion==='0.1.0','Unsupported tournament replay version');
  requireCondition(Array.isArray(saved.deck)&&saved.deck.length===52&&new Set(saved.deck).size===52&&saved.deck.every(c=>standardDeck().includes(c)),'Invalid tournament replay deck');
  const capacity=saved.tournamentSeatCount;
  requireCondition(capacity!==undefined,'Tournament replay capacity required');
  let state=initializeHand({handId:saved.handId,profile:saved.profile,button:saved.button,seats:saved.seats.map(s=>({id:s.id,name:s.name,stack:s.startingStack}))},[...saved.deck],{small:saved.smallBlindSeat,big:saved.bigBlindSeat,capacity});
  const view=(s:GameState)=>s.seats.some(seat=>seat.id===0)?projectView(s,0):projectSpectatorView(s);
  const frames=[view(state)];
  for(const action of saved.events.filter(e=>e.type==='action')) {
    requireCondition(action.action&&action.decisionId&&action.seatId===state.actor&&action.revision===state.revision+1&&action.handId===state.handId,'Tournament replay action identity mismatch');
    state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:action.seatId!,decisionId:action.decisionId,action:action.action});
    frames.push(view(state));
  }
  const normalize=(value:unknown):unknown=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)])):value;
  requireCondition(JSON.stringify(normalize(state))===JSON.stringify(normalize(saved)),'Tournament replay differs from committed state');
  return frames;
}
