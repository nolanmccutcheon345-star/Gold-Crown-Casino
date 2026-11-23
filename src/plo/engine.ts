/** Patch 74: Pot-Limit Omaha. A self-contained hand engine: four hole cards each, exactly two from the hand and three
 * from the board at showdown, and pot-limit betting (the largest raise makes the bet the size of the pot after a call).
 * Pure functions over plain data; chips are whole cents and are conserved on every step. */
import type {Card} from '../contracts';
import {compareRanks,evaluate,handLabel} from '../core/evaluator';

export type PloStreet='preflop'|'flop'|'turn'|'river'|'complete';
export interface PloSeat {id:number;name:string;stack:number;startingStack:number;hole:Card[];bet:number;total:number;folded:boolean;allIn:boolean;acted:boolean}
export type PloAction={type:'fold'}|{type:'check'}|{type:'call'}|{type:'raise';to:number};
export interface PloEvent {seatId?:number;kind:'blind'|'action'|'street'|'award'|'refund';text:string;amount?:number;action?:PloAction;cards?:Card[];
 /** Patch 75: how quickly the action came, as the table saw it. Display only. */
 tempo?:'snap'|'tank'}
export interface PloPot {amount:number;eligible:number[];winners:number[]}
export interface PloHand {
 handId:string;button:number;smallBlind:number;bigBlind:number;seats:PloSeat[];deck:Card[];board:Card[];street:PloStreet;
 actor:number|null;currentBet:number;lastRaise:number;potCollected:number;events:PloEvent[];pots:PloPot[];payouts:Record<number,number>;
 initialTotal:number;showdown:number[];labels:Record<number,string>;
}
export interface PloLegal {fold:boolean;check:boolean;call:number;canRaise:boolean;minRaiseTo:number;maxRaiseTo:number}

const order=(h:PloHand)=>h.seats.map(s=>s.id);
const seat=(h:PloHand,id:number)=>h.seats.find(s=>s.id===id)!;
function nextId(h:PloHand,from:number,ok:(s:PloSeat)=>boolean):number|null {
 const ids=order(h),i=ids.indexOf(from);
 for(let k=1;k<=ids.length;k++){const s=seat(h,ids[(i+k)%ids.length]);if(ok(s))return s.id;}
 return null;
}
const live=(h:PloHand)=>h.seats.filter(s=>!s.folded);
const canAct=(s:PloSeat)=>!s.folded&&!s.allIn&&s.stack>0;
/** Every chip is in a stack, a bet or the pot (and after settlement, back in stacks). */
export function assertChips(h:PloHand):void {
 const total=h.seats.reduce((a,s)=>a+s.stack+s.bet,0)+h.potCollected;
 if(total!==h.initialTotal)throw new Error(`PLO chip conservation failed: ${total} vs ${h.initialTotal}`);
 for(const s of h.seats)if(!Number.isSafeInteger(s.stack)||s.stack<0||s.bet<0)throw new Error('PLO stack invalid');
}

/** Deals a hand. Seats with no chips sit out. The deck is used from the top. */
export function startPloHand(input:{handId:string;button:number;smallBlind:number;bigBlind:number;seats:{id:number;name:string;stack:number}[];deck:Card[]}):PloHand {
 const players=input.seats.filter(s=>s.stack>0);
 if(players.length<2)throw new Error('PLO needs two players with chips.');
 if(new Set(input.deck).size!==52)throw new Error('PLO needs a full shuffled deck.');
 const deck=[...input.deck];
 const seats:PloSeat[]=players.map(s=>({id:s.id,name:s.name,stack:s.stack,startingStack:s.stack,hole:[],bet:0,total:0,folded:false,allIn:false,acted:false}));
 const h:PloHand={handId:input.handId,button:input.button,smallBlind:input.smallBlind,bigBlind:input.bigBlind,seats,deck,board:[],street:'preflop',actor:null,currentBet:0,lastRaise:input.bigBlind,potCollected:0,events:[],pots:[],payouts:{},initialTotal:seats.reduce((a,s)=>a+s.stack,0),showdown:[],labels:{}};
 if(!seats.some(s=>s.id===h.button))h.button=seats[0].id;
 for(let r=0;r<4;r++)for(const s of rotation(h))s.hole.push(deck.shift()!);
 const heads=seats.length===2;
 const sb=heads?h.button:nextId(h,h.button,()=>true)!,bb=nextId(h,sb,()=>true)!;
 post(h,sb,h.smallBlind,'small blind');post(h,bb,h.bigBlind,'big blind');
 h.currentBet=Math.max(...seats.map(s=>s.bet));h.lastRaise=h.bigBlind;
 h.actor=nextId(h,bb,canAct);
 if(h.actor===null||!needsAction(h))advance(h);
 assertChips(h);return h;
}
/** Seats starting left of the button, the dealing order. */
function rotation(h:PloHand):PloSeat[] {const ids=order(h),i=ids.indexOf(h.button);return ids.map((_,k)=>seat(h,ids[(i+1+k)%ids.length]));}
function post(h:PloHand,id:number,amount:number,what:string){const s=seat(h,id),paid=Math.min(amount,s.stack);s.stack-=paid;s.bet+=paid;s.total+=paid;if(s.stack===0)s.allIn=true;h.events.push({seatId:id,kind:'blind',text:`posts ${what}`,amount:paid});}

export function legalPlo(h:PloHand):PloLegal|null {
 if(h.actor===null||h.street==='complete')return null;
 const s=seat(h,h.actor),toCall=Math.min(h.currentBet-s.bet,s.stack);
 const potAfterCall=h.potCollected+h.seats.reduce((a,x)=>a+x.bet,0)+toCall;
 const cap=s.bet+s.stack;
 const maxTo=Math.min(cap,h.currentBet+potAfterCall);
 const minTo=Math.min(cap,h.currentBet+Math.max(h.lastRaise,h.bigBlind));
 const others=h.seats.filter(x=>x.id!==s.id&&canAct(x)).length;
 /* A raise must be allowed: someone else can still act, the player has chips beyond the call, and (after a short
  * all-in that did not make a full raise) the player has not already acted since the last full raise. */
 const canRaise=s.stack>toCall&&others>0&&!s.acted;
 return {fold:toCall>0,check:toCall===0,call:toCall,canRaise,minRaiseTo:minTo,maxRaiseTo:maxTo};
}
/** The biggest raise the pot allows, and half of it, for buttons. */
export function potSizes(h:PloHand):{half:number;pot:number}|null {
 const l=legalPlo(h);if(!l||!l.canRaise)return null;
 const s=seat(h,h.actor!),full=l.maxRaiseTo;const halfTo=Math.max(l.minRaiseTo,Math.round(h.currentBet+(full-h.currentBet)/2));
 return {half:Math.min(halfTo,s.bet+s.stack),pot:full};
}

/** Someone still has to act on this street. */
function needsAction(h:PloHand):boolean {
 const actors=h.seats.filter(canAct);if(!actors.length)return false;
 if(!actors.some(x=>!x.acted||x.bet<h.currentBet))return false;
 return !(actors.length===1&&actors[0].bet>=h.currentBet);
}

export function applyPlo(input:PloHand,action:PloAction):PloHand {
 const h:PloHand=structuredClone(input);const l=legalPlo(h);if(!l)throw new Error('No action is due.');
 const s=seat(h,h.actor!);
 if(action.type==='fold'){if(!l.fold)throw new Error('Check instead of folding.');s.folded=true;h.events.push({seatId:s.id,kind:'action',text:'folds',action});}
 else if(action.type==='check'){if(!l.check)throw new Error('You cannot check facing a bet.');h.events.push({seatId:s.id,kind:'action',text:'checks',action});}
 else if(action.type==='call'){if(l.call<=0)throw new Error('Nothing to call.');s.stack-=l.call;s.bet+=l.call;s.total+=l.call;if(s.stack===0)s.allIn=true;h.events.push({seatId:s.id,kind:'action',text:`calls ${l.call}`,amount:l.call,action});}
 else{
  if(!l.canRaise)throw new Error('Raising is not allowed here.');
  const to=action.to;if(!Number.isSafeInteger(to)||to>l.maxRaiseTo||to<l.minRaiseTo&&to!==s.bet+s.stack||to<=h.currentBet)throw new Error(`Raise between ${l.minRaiseTo} and ${l.maxRaiseTo} (pot limit).`);
  const add=to-s.bet;s.stack-=add;s.bet=to;s.total+=add;if(s.stack===0)s.allIn=true;
  const raiseBy=to-h.currentBet,full=raiseBy>=Math.max(h.lastRaise,h.bigBlind);
  if(full){h.lastRaise=raiseBy;for(const x of h.seats)if(x.id!==s.id)x.acted=false;}
  const bet=h.currentBet===0;h.currentBet=to;h.events.push({seatId:s.id,kind:'action',text:`${bet?'bets':'raises to'} ${to}`,amount:to,action});
 }
 s.acted=true;
 if(live(h).length===1){finish(h);assertChips(h);return h;}
 if(needsAction(h))h.actor=nextId(h,s.id,x=>canAct(x)&&(!x.acted||x.bet<h.currentBet));
 else advance(h);
 assertChips(h);return h;
}
/** Collect bets, deal the next street (or run the board out when nobody can act), or go to showdown. */
function advance(h:PloHand){
 for(;;){
  // Return an uncalled bet before collecting.
  const sorted=[...h.seats].sort((a,b)=>b.bet-a.bet);
  if(sorted.length>1&&sorted[0].bet>sorted[1].bet){const top=sorted[0],extra=top.bet-sorted[1].bet;top.bet-=extra;top.total-=extra;top.stack+=extra;if(extra>0){top.allIn=top.stack===0;h.events.push({seatId:top.id,kind:'refund',text:`gets ${extra} back`,amount:extra});}}
  for(const s of h.seats){h.potCollected+=s.bet;s.bet=0;s.acted=false;}
  h.currentBet=0;h.lastRaise=h.bigBlind;
  if(live(h).length===1){finish(h);return;}
  if(h.street==='river'){showdown(h);return;}
  const n=h.street==='preflop'?3:1;h.deck.shift();const cards=h.deck.splice(0,n);h.board.push(...cards);
  h.street=h.street==='preflop'?'flop':h.street==='flop'?'turn':'river';
  h.events.push({kind:'street',text:h.street,cards});
  const first=nextId(h,h.button,canAct);
  if(first!==null&&live(h).filter(canAct).length>=2){h.actor=first;return;}
 }
}
/** Best Omaha hand: exactly two hole cards and three board cards. */
export function omahaRank(hole:Card[],board:Card[]):number[] {
 if(hole.length!==4||board.length!==5)throw new Error('Omaha needs four hole cards and five board cards.');
 let best:number[]|null=null;
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(let x=0;x<5;x++)for(let y=x+1;y<5;y++)for(let z=y+1;z<5;z++){
  const r=evaluate([hole[a],hole[b],board[x],board[y],board[z]]);if(!best||compareRanks(r,best)>0)best=r;}
 return best!;
}
function pots(h:PloHand):PloPot[] {
 const levels=[...new Set(h.seats.filter(s=>s.total>0&&!s.folded).map(s=>s.total))].sort((a,b)=>a-b);
 const out:PloPot[]=[];let prev=0;
 for(const level of levels){const amount=h.seats.reduce((a,s)=>a+Math.max(0,Math.min(s.total,level)-prev),0);const eligible=h.seats.filter(s=>!s.folded&&s.total>=level).map(s=>s.id);if(amount>0)out.push({amount,eligible,winners:[]});prev=level;}
 // Chips from folded players above the last live level join the last pot.
 const counted=out.reduce((a,p)=>a+p.amount,0),total=h.seats.reduce((a,s)=>a+s.total,0);if(out.length&&total>counted)out[out.length-1].amount+=total-counted;
 return out;
}
function award(h:PloHand,list:PloPot[]){
 h.pots=list;h.potCollected=0;
 for(const pot of list){
  const ids=order(h),start=ids.indexOf(h.button);
  const winners=[...pot.winners].sort((a,b)=>((ids.indexOf(a)-start+ids.length-1)%ids.length)-((ids.indexOf(b)-start+ids.length-1)%ids.length));
  const share=Math.floor(pot.amount/winners.length);let odd=pot.amount-share*winners.length;
  for(const id of winners){const extra=odd>0?1:0;odd-=extra;const won=share+extra;seat(h,id).stack+=won;h.payouts[id]=(h.payouts[id]??0)+won;}
 }
 for(const [id,amount] of Object.entries(h.payouts))h.events.push({seatId:Number(id),kind:'award',text:`wins ${amount}`,amount});
 h.street='complete';h.actor=null;
}
function finish(h:PloHand){
 for(const s of h.seats){h.potCollected+=s.bet;s.bet=0;}
 const winner=live(h)[0];const list=[{amount:h.potCollected,eligible:[winner.id],winners:[winner.id]}];award(h,list);
}
function showdown(h:PloHand){
 while(h.board.length<5){h.deck.shift();h.board.push(h.deck.shift()!);}
 const ranks=new Map(live(h).map(s=>[s.id,omahaRank(s.hole,h.board)]));
 h.showdown=[...ranks.keys()];for(const [id,r] of ranks)h.labels[id]=handLabel(r);
 const list=pots(h);
 for(const pot of list){let best:number[]|null=null;for(const id of pot.eligible){const r=ranks.get(id)!;if(!best||compareRanks(r,best)>0){best=r;pot.winners=[id];}else if(compareRanks(r,best)===0)pot.winners.push(id);}}
 award(h,list);
}
/** What a player may see: their own cards, and cards shown at showdown. */
export function ploView(h:PloHand,viewer:number):PloHand {
 const v=structuredClone(h);v.deck=[];
 for(const s of v.seats)if(s.id!==viewer&&!(h.street==='complete'&&h.showdown.includes(s.id)))s.hole=s.hole.map(()=>'');
 return v;
}
