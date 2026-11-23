import type { BotObservation, GameCommand, GameEvent, GameState, HeroViewModel, LegalActionSet, Pot, RuleProfile, Seat, StartHandInput } from '../contracts';
import { secureDeck, standardDeck } from './deck';
import { compareRanks, evaluate, handLabel } from './evaluator';

export const ENGINE_VERSION = '0.3.0';
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
function requireCondition(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function clone<T>(value:T):T { return structuredClone(value); }
function seatById(state:GameState,id:number):Seat {
  const seat=state.seats.find(s=>s.id===id);
  requireCondition(seat, 'Unknown seat'); return seat;
}
function after(state:GameState,id:number):Seat[] {
  const i=state.seats.findIndex(s=>s.id===id);
  return [...state.seats.slice(i+1),...state.seats.slice(0,i+1)];
}
function canAct(seat:Seat):boolean { return !seat.folded && !seat.allIn && seat.stack>0; }
function event(state:GameState,data:Omit<GameEvent,'id'|'handId'|'revision'>):void {
  state.events.push({id:`${state.handId}:${state.events.length}`,handId:state.handId,revision:state.revision,...data});
}
function transferToPot(state:GameState,seat:Seat,amount:number):void {
  requireCondition(integer(amount)&&amount<=seat.stack, 'Invalid chip transfer');
  seat.stack-=amount; seat.streetCommitted+=amount; seat.totalCommitted+=amount; state.pot+=amount;
  seat.allIn=seat.stack===0;
}
function validateProfile(profile:RuleProfile):void {
  requireCondition(profile && profile.mode==='cash' && profile.chipUnit===1, 'Only integer-cent cash profiles are supported');
  requireCondition(typeof profile.id==='string'&&profile.id.length>0&&typeof profile.version==='string'&&profile.version.length>0,'Rule profile ID/version required');
  requireCondition(integer(profile.smallBlind)&&profile.smallBlind>0&&integer(profile.bigBlind)&&profile.bigBlind>=profile.smallBlind,'Invalid blinds');
  requireCondition(profile.shortRaiseReopens==='cumulative'&&profile.oddChipOrder==='clockwise-from-button','Unsupported rule profile');
  requireCondition(profile.rake&&integer(profile.rake.basisPoints)&&profile.rake.basisPoints<=10000&&integer(profile.rake.cap)&&typeof profile.rake.noFlopNoDrop==='boolean','Invalid rake');
}

export function startHand(input:StartHandInput):GameState {
  return initializeHand(input);
}

// The explicit deck path is private and used only to validate public imported records.
// Normal game creation has no deck/fixture parameter or exported initializer.
function initializeHand(input:StartHandInput,validationDeck?:string[]):GameState {
  requireCondition(input && typeof input.handId==='string'&&input.handId.length>0,'Hand ID required');
  validateProfile(input.profile);
  requireCondition(Array.isArray(input.seats)&&input.seats.length>=2&&input.seats.length<=10,'Use 2–10 funded seats');
  requireCondition(new Set(input.seats.map(s=>s.id)).size===input.seats.length,'Duplicate seat ID');
  requireCondition(input.seats.every(s=>integer(s.id)&&s.id<10&&integer(s.stack)&&s.stack>0&&typeof s.name==='string'),'Invalid seat or stack');
  const initialTotal=input.seats.reduce((n,s)=>n+s.stack,0);
  requireCondition(Number.isSafeInteger(initialTotal),'Total chips exceed safe integer precision');
  const seats:Seat[]=input.seats.map(s=>({...s,startingStack:s.stack,hole:[],streetCommitted:0,totalCommitted:0,folded:false,allIn:false,lastActedBet:null})).sort((a,b)=>a.id-b.id);
  requireCondition(seats.some(s=>s.id===input.button),'Button must be a participating seat');
  const state:GameState={schemaVersion:'0.1.0',engineVersion:ENGINE_VERSION,handId:input.handId,revision:0,profile:clone(input.profile),seats,button:input.button,smallBlindSeat:0,bigBlindSeat:0,street:'preflop',board:[],deck:validationDeck??secureDeck(),deckCursor:0,burned:[],actor:null,currentBet:input.profile.bigBlind,minFullRaiseIncrement:input.profile.bigBlind,pending:[],pot:0,pots:[],rake:0,initialTotal,events:[],committedDecisionIds:[],payouts:{},revealedSeats:[]};
  state.smallBlindSeat=seats.length===2?state.button:after(state,state.button)[0].id;
  state.bigBlindSeat=after(state,state.smallBlindSeat)[0].id;
  event(state,{type:'start',detail:`${state.profile.id}@${state.profile.version}`});
  for(let round=0;round<2;round++) for(const seat of after(state,state.button)) seat.hole.push(state.deck[state.deckCursor++]);
  for(const [id,blind] of [[state.smallBlindSeat,state.profile.smallBlind],[state.bigBlindSeat,state.profile.bigBlind]]) {
    const seat=seatById(state,id); const amount=Math.min(seat.stack,blind);
    transferToPot(state,seat,amount); event(state,{type:'blind',seatId:id,amount});
  }
  state.pending=after(state,state.bigBlindSeat).filter(canAct).map(s=>s.id);
  progress(state);
  assertAccounting(state);
  return state;
}

/** Practice cash uses a moving occupied button; HU preserves the next BB obligation.
 * Seat selection and chip carry-forward belong to authority, never the table UI.
 */
export function nextHand(previous:GameState,handId:string):GameState {
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before dealing again');
  requireCondition(typeof handId==='string'&&handId.length>0&&handId!==previous.handId,'A fresh hand ID is required');
  assertAccounting(previous);
  const funded=previous.seats.filter(s=>s.stack>0);
  requireCondition(funded.length>=2,'At least two funded seats are required for the next hand');
  let button:number;
  if(funded.length===2) {
    // A simple button advance can incorrectly charge the previous BB twice when
    // three or more seats collapse to heads-up. Advance the BB, then derive BTN.
    const bigBlind=after(previous,previous.bigBlindSeat).find(s=>s.stack>0)!.id;
    button=funded.find(s=>s.id!==bigBlind)!.id;
  } else button=after(previous,previous.button).find(s=>s.stack>0)!.id;
  const state=startHand({handId,profile:previous.profile,button,seats:funded.map(({id,name,stack})=>({id,name,stack}))});
  if(previous.tableTransfers) state.tableTransfers=clone(previous.tableTransfers);
  return state;
}

/** A wallet-funded transfer between hands, separate from poker action/payout events.
 * The caller must atomically persist the paired wallet debit with this candidate.
 * Completed hand records must be captured before invoking this transition.
 */
export function topUpTable(previous:GameState,seatId:number,amount:number,transferId:string,maxStack:number):GameState {
  requireCondition(previous.street==='complete'&&previous.actor===null,'Finish the current hand before adding chips');
  requireCondition(typeof transferId==='string'&&transferId.length>0,'Transfer ID required');
  requireCondition(integer(amount)&&amount>0&&integer(maxStack)&&maxStack>0,'Invalid table transfer');
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
    requireCondition(legal.canRaise&&integer(to)&&to>previous.currentBet&&to<=legal.maxRaiseTo!,'Illegal raise');
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
function derivePots(state:GameState):{pots:Pot[];uncalledBet:{seatId:number;amount:number}|null} {
  const ordered=[...state.seats].sort((a,b)=>b.totalCommitted-a.totalCommitted);
  const excess=ordered[0].totalCommitted-ordered[1].totalCommitted;
  const uncalledBet=excess>0?{seatId:ordered[0].id,amount:excess}:null;
  const contributions=state.seats.map(seat=>({seat,amount:seat.totalCommitted-(uncalledBet?.seatId===seat.id?uncalledBet.amount:0)}));
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
  const rakeEligible=(!state.profile.rake.noFlopNoDrop||state.board.length>=3)?state.pot:0;
  // Transparent practice profile: floor to integer cents, capped once per hand.
  const rake=Number((BigInt(rakeEligible)*BigInt(state.profile.rake.basisPoints))/10000n);
  state.rake=Math.min(state.profile.rake.cap,rake);
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
    const share=Math.floor(pot.amount/winners.length); const odd=pot.amount%winners.length;
    order.forEach((s,i)=>{
      const amount=share+(i<odd?1:0); s.stack+=amount; s.allIn=s.stack===0;
      state.payouts[s.id]=(state.payouts[s.id]??0)+amount;
      event(state,{type:'award',seatId:s.id,amount,detail:showdown?'Showdown':'Uncontested'});
    });
  }
  state.pots=pots; state.pot=0; state.street='complete'; state.actor=null; state.pending=[];
}

export function assertAccounting(state:GameState):void {
  requireCondition(state.seats.every(s=>integer(s.stack)&&integer(s.totalCommitted)&&integer(s.streetCommitted)), 'Invalid chip state');
  requireCondition(state.seats.reduce((n,s)=>n+s.stack,0)+state.pot+state.rake===state.initialTotal,'Chip conservation failure');
}

export function projectView(state:GameState,heroSeat:number):HeroViewModel {
  requireCondition(state.seats.some(s=>s.id===heroSeat),'Unknown viewer seat');
  const seats=state.seats.map(({lastActedBet:_lastActedBet,hole,...seat})=>({...seat,hole:seat.id===heroSeat||state.revealedSeats.includes(seat.id)?[...hole]:[]}));
  const {pots,uncalledBet}=state.street==='complete'?{pots:state.pots,uncalledBet:null}:derivePots(state);
  const handLabels:Record<number,string>={};
  if(state.street==='complete'&&state.board.length===5) {
    for(const seat of state.seats) if(!seat.folded&&state.revealedSeats.includes(seat.id)) handLabels[seat.id]=handLabel(evaluate([...seat.hole,...state.board]));
  }
  return clone({handId:state.handId,revision:state.revision,profile:state.profile,seats,button:state.button,smallBlindSeat:state.smallBlindSeat,bigBlindSeat:state.bigBlindSeat,street:state.street,board:state.board,actor:state.actor,pot:state.pot,pots,rake:state.rake,payouts:state.payouts,legal:legalActions(state),events:state.events,uncalledBet,handLabels});
}

export function observeBot(state:GameState,seatId:number,policyVersion:string,decisionId:string):BotObservation {
  requireCondition(state.actor===seatId&&state.street!=='complete','Observation requires current actor');
  requireCondition(typeof policyVersion==='string'&&policyVersion.length>0&&typeof decisionId==='string'&&decisionId.length>0,'Decision identity required');
  return clone({handId:state.handId,revision:state.revision,actingSeat:seatId,decisionId,policyVersion,ownCards:seatById(state,seatId).hole,board:state.board,street:state.street,button:state.button,pot:state.pot,bigBlind:state.profile.bigBlind,seats:state.seats.map(({id,stack,streetCommitted,totalCommitted,folded,allIn})=>({id,stack,streetCommitted,totalCommitted,folded,allIn})),legal:legalActions(state),publicEvents:state.events});
}


/** Reconstruct a possible private deal from permitted public information and replay
 * every command through the canonical reducer. Returns no private state/cards and
 * cannot create or overwrite a live game. Unknown/mucked cards get unused fillers.
 */
export function validatePublicReplay(frames:HeroViewModel[]):void {
  requireCondition(Array.isArray(frames)&&frames.length>0,'Replay frames required');
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
  requireCondition(buttonIndex>=0,'Replay button missing');
  const order=[...seats.slice(buttonIndex+1),...seats.slice(0,buttonIndex+1)];
  const deck:string[]=[];
  for(let round=0;round<2;round++)for(const seat of order)deck.push(knownHoles.get(seat.id)![round]);
  const board=Array.from({length:5},(_,i)=>last.board[i]??take());
  deck.push(take(),...board.slice(0,3),take(),board[3],take(),board[4],...unused);
  requireCondition(deck.length===52&&new Set(deck).size===52,'Invalid replay deck');
  let state=initializeHand({handId:first.handId,button:first.button,profile:first.profile,seats:seats.map(seat=>({id:seat.id,name:seat.name,stack:seat.startingStack}))},deck);
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
