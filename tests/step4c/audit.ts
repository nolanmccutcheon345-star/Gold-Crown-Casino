import type {Action,Card,GameState} from '../../src/contracts';
import {legalActions} from '../../src/core/engine';
import {evaluate,compareRanks} from '../../src/core/evaluator';
export const STYLES=['nit','station','tag','lag','fit-or-fold','maniac','passive-reg','stronger-reg'] as const;
export type Counter={count:number;opportunities:number};
export type Counters=Record<string,Counter>;
export function rng(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function physicalPosition(n:number,button:number,seat:number):string {
 const d=(seat-button+n)%n;if(d===0)return 'BTN';if(n===2)return 'BB';if(d===1)return 'SB';if(d===2)return 'BB';
 const early:Record<number,string[]>={4:['CO'],5:['UTG','CO'],6:['UTG','HJ','CO'],7:['UTG','LJ','HJ','CO'],8:['UTG','MP','LJ','HJ','CO'],9:['UTG','UTG+1','MP','LJ','HJ','CO'],10:['UTG','UTG+1','UTG+2','MP','LJ','HJ','CO']};
 return early[n][d-3];
}
const rank=(c:string)=>'23456789TJQKA'.indexOf(c[0])+2;
export function auditCards(own:Card[],board:Card[]) {
 if(board.length<3)return{category:'preflop',categoryIndex:-1,draw:false,value:false,air:false,privatePair:false,texture:'preflop'};
 const all=[...own,...board],r=evaluate(all),br=board.length>=5?evaluate(board):null;
 const privateContribution=br===null||compareRanks(r,br)>0;
 const suits=[...'cdhs'].map(s=>board.filter(c=>c[1]===s).length),ranks=board.map(rank),unique=new Set(ranks);
 const connected=[...unique].sort((a,b)=>a-b).some((x,i,a)=>i+2<a.length&&a[i+2]-x<=4);
 const texture=[Math.max(...suits)>=3?'monotone':Math.max(...suits)>=2?'two-tone':'rainbow',unique.size<board.length?'paired':'unpaired',connected?'connected':'dry'].join('/');
 const flushDraw=board.length<5&&[...'cdhs'].some(s=>all.filter(c=>c[1]===s).length===4&&own.some(c=>c[1]===s));
 const ranksAll=new Set(all.map(rank));if(ranksAll.has(14))ranksAll.add(1);
 let straightDraw=false;
 if(board.length<5&&r[0]<4)for(let start=1;start<=10;start++){
  const seq=Array.from({length:5},(_,i)=>start+i),missing=seq.filter(x=>!ranksAll.has(x));
  if(missing.length===1&&own.some(c=>!board.some(b=>rank(b)===rank(c))&&(seq.includes(rank(c))||rank(c)===14&&seq.includes(1))))straightDraw=true;
 }
 const draw=board.length<5&&r[0]<4&&(flushDraw||straightDraw),privatePair=r[0]===1&&privateContribution&&own.some(c=>rank(c)===r[1]);
 const value=privateContribution&&(r[0]>=2||privatePair&&r[1]===Math.max(...ranks));
 return{category:['high-card','pair','two-pair','trips','straight','flush','full-house','quads','straight-flush'][r[0]],categoryIndex:r[0],draw,value,air:r[0]===0&&!draw,privatePair,texture};
}
export const DEFINITIONS:Record<string,string>={
 vpip:'Hand/player with voluntary preflop call/raise / hand/player with at least one voluntary decision',pfr:'Hand/player raising preflop / hand/player with a legal preflop raise opportunity',rfi:'Raise before any voluntary action / priced unopened decision with legal raising; excludes BB free option',limp:'Call before any voluntary action / priced unopened decision',overlimp:'Call behind limper / priced unraised decision after voluntary call',isolation:'Raise over limper(s) / unraised decision after voluntary call with legal raising',coldCall:'Call with no prior voluntary contribution, nonblind seat / priced first response to one open',threeBet:'Raise after one raise / first legal re-raise opportunity facing exactly one raise',fourBet:'Raise after two raises / first legal re-raise opportunity facing exactly two raises',squeeze:'Raise after open and cold call / legal re-raise opportunity after open and cold call',foldToThreeBet:'Fold / opener first priced response after second preflop raise',blindDefense:'Call or raise / SB or BB first priced response to open',flopCbet:'Bet / last preflop raiser first legal unopened-flop opportunity',turnBarrel:'Bet turn / previous flop aggressor first legal unopened-turn opportunity',riverBarrel:'Bet river / previous turn aggressor first legal unopened-river opportunity',checkRaise:'Raise after checking / first later legal raise opportunity facing price on same street',foldToCbet:'Fold / first response to a true flop cbet',drawCall:'Call / visible private-contribution draw facing price before river',drawRaise:'Raise / private-contribution draw with legal raising before river',valueBet:'Bet/raise / legal raising opportunity with operational private two-pair+ or top-pair value proxy',airBet:'Bet/raise / legal raising opportunity with unpaired no-live-draw proxy (not true bluff intention)',riverBluffCatch:'Call / river priced decision with one private pair proxy',foldSmall:'Fold / facing last postflop bet or raise increment ≤25% of pot after the raiser called, frozen at that raise event',continueOverbet:'Call/raise / facing last postflop bet or raise increment ≥150% of pot after the raiser called, frozen at that raise event',WTSD:'Reached showdown / saw flop while eligible (includes all-in runouts)',WSD:'Positive pot award / showdown participant; ties count as awards',WWSF:'Positive pot award / saw flop while eligible'};
export class HandAudit {
 readonly counters=new Map<number,Counters>();readonly segments:{seat:number;street:string;node:string;texture:string;players:number;metric:string;count:number;opportunities:number}[]=[];
 readonly sizing:{seat:number;street:string;node:string;texture:string;category:string;players:number;raiseToBB:number;incrementPot:number}[]=[];
 private flags=new Map<number,{vpipOpp:boolean;vpip:boolean;pfrOpp:boolean;pfr:boolean;sawFlop:boolean}>();private seen=new Set<string>();private checked=new Set<string>();private voluntary=new Set<number>();
 private raises=0;private limps=0;private callsAfterRaise=0;private lastRaiser:number|null=null;private opener:number|null=null;private streetRaises:Record<string,number>={preflop:0,flop:0,turn:0,river:0};private streetAggressor:Record<string,number|null>={preflop:null,flop:null,turn:null,river:null};private cbetter:number|null=null;private lastWagerFraction:Record<string,number>={preflop:0,flop:0,turn:0,river:0};
 constructor(ids:number[]){for(const id of ids){this.counters.set(id,{});this.flags.set(id,{vpipOpp:false,vpip:false,pfrOpp:false,pfr:false,sawFlop:false});}}
 private add(seat:number,metric:string,hit:boolean,context?:{street:string;node:string;texture:string;players:number},once?:string){
  const key=`${seat}:${metric}:${once??''}`;if(once!==undefined&&this.seen.has(key))return;if(once!==undefined)this.seen.add(key);
  const c=this.counters.get(seat)!,old=c[metric]??{count:0,opportunities:0};old.count+=Number(hit);old.opportunities++;c[metric]=old;
  if(context)this.segments.push({seat,metric,count:Number(hit),opportunities:1,...context});
 }
 record(before:GameState,a:Action){
  const seat=before.actor!,own=before.seats.find(s=>s.id===seat)!,legal=legalActions(before),f=this.flags.get(seat)!,cards=auditCards(own.hole,before.board),players=before.seats.filter(s=>!s.folded).length;
  const node=before.street==='preflop'?(this.raises>=3?'fourbet+':this.raises===2?'threebet':this.raises===1?'open':this.limps?'limped':'unopened'):(legal.callAmount>0?this.streetRaises[before.street]>1?'reraise':'facing-bet':this.streetRaises[before.street]?'checked-to-after-bet':'unopened-street');
  const ctx={street:before.street,node,texture:cards.texture,players},raising=a.type==='raise',calling=a.type==='call',folding=a.type==='fold';
  if(before.street==='preflop'){
   f.vpipOpp=true;f.vpip ||=calling||raising;f.pfrOpp ||=legal.canRaise;f.pfr ||=raising;
   if(this.raises===0&&!this.limps&&legal.callAmount>0){this.add(seat,'limp',calling,ctx,'hand');if(legal.canRaise)this.add(seat,'rfi',raising,ctx,'hand');}
   if(this.raises===0&&this.limps>0&&legal.callAmount>0){this.add(seat,'overlimp',calling,ctx,'hand');if(legal.canRaise)this.add(seat,'isolation',raising,ctx,'hand');}
   if(this.raises===1&&legal.callAmount>0&&seat!==this.lastRaiser){
    if(legal.canRaise)this.add(seat,'threeBet',raising,ctx,'hand');
    const pos=physicalPosition(before.seats.length,before.button,seat);
    if(!this.voluntary.has(seat)&&pos!=='SB'&&pos!=='BB')this.add(seat,'coldCall',calling,ctx,'hand');
    if(pos==='SB'||pos==='BB')this.add(seat,'blindDefense',!folding,ctx,'hand');
    if(this.callsAfterRaise>0&&legal.canRaise)this.add(seat,'squeeze',raising,ctx,'hand');
   }
   if(this.raises===2&&legal.callAmount>0&&seat!==this.lastRaiser){if(legal.canRaise)this.add(seat,'fourBet',raising,ctx,'hand');if(seat===this.opener)this.add(seat,'foldToThreeBet',folding,ctx,'hand');}
   if(calling){if(this.raises===0)this.limps++;else if(!this.voluntary.has(seat))this.callsAfterRaise++;this.voluntary.add(seat);}
   if(raising){if(this.raises===0)this.opener=seat;this.raises++;this.lastRaiser=seat;this.callsAfterRaise=0;this.voluntary.add(seat);}
  }else{
   const key=`${before.street}:${seat}`,lastPrior=this.streetAggressor[before.street==='flop'?'preflop':before.street==='turn'?'flop':'turn'];
   if(seat===lastPrior&&this.streetRaises[before.street]===0&&legal.callAmount===0&&legal.canRaise){const name=before.street==='flop'?'flopCbet':before.street==='turn'?'turnBarrel':'riverBarrel';this.add(seat,name,raising,ctx,'street');if(before.street==='flop'&&raising)this.cbetter=seat;}
   if(before.street==='flop'&&this.cbetter!==null&&seat!==this.cbetter&&this.streetRaises.flop===1&&legal.callAmount>0)this.add(seat,'foldToCbet',folding,ctx,'street');
   if(this.checked.has(key)&&legal.callAmount>0&&legal.canRaise)this.add(seat,'checkRaise',raising,ctx,before.street);
   if(a.type==='check')this.checked.add(key);
   if(cards.draw&&legal.callAmount>0)this.add(seat,'drawCall',calling,ctx);
   if(cards.draw&&legal.canRaise)this.add(seat,'drawRaise',raising,ctx);
   if(cards.value&&legal.canRaise)this.add(seat,'valueBet',raising,ctx);
   if(cards.air&&legal.canRaise)this.add(seat,'airBet',raising,ctx);
   if(before.street==='river'&&cards.privatePair&&legal.callAmount>0)this.add(seat,'riverBluffCatch',calling,ctx);
   const wagerFraction=this.lastWagerFraction[before.street];
   if(legal.callAmount>0&&wagerFraction<=.25)this.add(seat,'foldSmall',folding,ctx);
   if(legal.callAmount>0&&wagerFraction>=1.5)this.add(seat,'continueOverbet',!folding,ctx);
  }
  if(raising){this.lastWagerFraction[before.street]=(a.to-own.streetCommitted-legal.callAmount)/Math.max(1,before.pot+legal.callAmount);this.streetRaises[before.street]++;this.streetAggressor[before.street]=seat;this.sizing.push({seat,street:before.street,node,texture:cards.texture,category:cards.category,players,raiseToBB:a.to/before.profile.bigBlind,incrementPot:(a.to-own.streetCommitted-legal.callAmount)/Math.max(1,before.pot+legal.callAmount)});}
 }
 after(g:GameState){if(g.board.length>=3)for(const s of g.seats)if(!s.folded)this.flags.get(s.id)!.sawFlop=true;}
 finish(g:GameState){for(const s of g.seats){const f=this.flags.get(s.id)!;if(f.vpipOpp)this.add(s.id,'vpip',f.vpip);if(f.pfrOpp)this.add(s.id,'pfr',f.pfr);
  const showdown=g.revealedSeats.includes(s.id)&&g.revealedSeats.length>1,won=(g.payouts[s.id]??0)>0;if(f.sawFlop){this.add(s.id,'WTSD',showdown);this.add(s.id,'WWSF',won);}if(showdown)this.add(s.id,'WSD',won);
 }return this.counters;}
}
export function reconcile(g:GameState){
 if(g.street!=='complete')throw Error('Unfinished hand');const eventIds=new Set<string>(),decisionIds=new Set<string>();let paid=0,returned=0,awarded=0,rake=0;
 const balances=new Map(g.seats.map(s=>[s.id,s.startingStack]));
 for(const e of g.events){if(eventIds.has(e.id))throw Error('Duplicate event');eventIds.add(e.id);if(e.type==='action'){if(!e.decisionId||decisionIds.has(e.decisionId))throw Error('Duplicate decision');decisionIds.add(e.decisionId);}
  if(e.type==='blind'||e.type==='action'){paid+=e.amount??0;balances.set(e.seatId!,balances.get(e.seatId!)!-(e.amount??0));}
  if(e.type==='refund'||e.type==='award'){if(e.type==='refund')returned+=e.amount??0;else awarded+=e.amount??0;balances.set(e.seatId!,balances.get(e.seatId!)!+(e.amount??0));}if(e.type==='rake')rake+=e.amount??0;
 }
 if(paid-returned!==awarded+rake||g.rake!==rake||g.seats.some(s=>balances.get(s.id)!==s.stack)||g.seats.reduce((n,s)=>n+s.stack,0)+rake!==g.initialTotal)throw Error('Independent money reconciliation failed');
 return{paid,returned,awarded,rake,actions:decisionIds.size,total:g.initialTotal};
}
export function wilson(c:number,n:number):[number,number]|null{if(!n)return null;const z=1.96,p=c/n,div=1+z*z/n,mid=(p+z*z/2/n)/div,half=z*Math.sqrt(p*(1-p)/n+z*z/4/n/n)/div;return[100*Math.max(0,mid-half),100*Math.min(1,mid+half)];}
export function clusteredRate(blocks:Counter[],seed=121){const eligible=blocks.filter(b=>b.opportunities>0),count=eligible.reduce((n,b)=>n+b.count,0),opportunities=eligible.reduce((n,b)=>n+b.opportunities,0),random=rng(seed),boot:number[]=[];
 if(eligible.length>=8)for(let trial=0;trial<1000;trial++){let c=0,n=0;for(let j=0;j<eligible.length;j++){const b=eligible[Math.floor(random()*eligible.length)];c+=b.count;n+=b.opportunities;}boot.push(100*c/n);}
 boot.sort((a,b)=>a-b);return{count,opportunities,percent:opportunities?100*count/opportunities:null,blocks:eligible.length,clusterBootstrap95:boot.length&&count>0&&count<opportunities?[boot[24],boot[974]]:null,clusterBootstrapCaveat:count===0||count===opportunities?'All observed outcomes identical; ordinary resampling cannot estimate unobserved tail uncertainty. Wilson is conditional only.':null,conditionalWilson95:wilson(count,opportunities),coverage:eligible.length<8||opportunities<100?'INSUFFICIENT_FOR_PRECISE_CONDITIONAL_ESTIMATE':'DESCRIPTIVE_SYNTHETIC_ESTIMATE'};
}
