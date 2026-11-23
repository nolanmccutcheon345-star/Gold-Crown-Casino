import type {BotObservation,Card} from '../contracts';
import {evaluate,compareRanks} from '../core/evaluator';
import {clamp} from './profiles';
import {preflopPosition,seatsFromButton} from './preflop';
import {contestablePricing} from './pricing';
const rank=(card:Card)=>'23456789TJQKA'.indexOf(card[0])+2;
function counts(values:(number|string)[]):Map<number|string,number>{const result=new Map<number|string,number>();for(const v of values)result.set(v,(result.get(v)??0)+1);return result;}
function straightHigh(values:number[]):number {const s=new Set(values);if(s.has(14))s.add(1);for(let high=14;high>=5;high--)if(Array.from({length:5},(_,i)=>high-i).every(x=>s.has(x)))return high;return 0;}
// Constant-size memo for a pure visible-card rank predicate, not opponent memory or an equity table.
let lastNutsKey='';let lastNutsResult=false;
function unbeatableRiver(own:Card[],board:Card[],best:number[]):boolean {
 const key=[...own].sort().join('')+'|'+[...board].sort().join('');if(key===lastNutsKey)return lastNutsResult;
 const seen=new Set([...own,...board]);const unseen=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!seen.has(c));
 let unbeatable=true;
 outer:for(let i=0;i<unseen.length-1;i++)for(let j=i+1;j<unseen.length;j++)if(compareRanks(evaluate([...board,unseen[i],unseen[j]]),best)>0){unbeatable=false;break outer;}
 lastNutsKey=key;lastNutsResult=unbeatable;return unbeatable;
}
export interface HandFeatures {strength:number;draw:number;made:boolean;handClass:string;drawClass:string;wetness:number;vulnerability:number;playsBoard:boolean;nutDraw:boolean;overcards:number;suited:boolean;connected:boolean;pairRank:number;blockerStrength:number;absoluteNuts:boolean;cleanOuts:number;pairedBoard:boolean;}
/** Exact visible rank with explicitly heuristic relative strength; this is not equity or a solver. */
export function handFeatures(ownCards:Card[],board:Card[]):HandFeatures {
 const ownRanks=ownCards.map(rank).sort((a,b)=>b-a),[hi,lo]=ownRanks,suited=ownCards[0][1]===ownCards[1][1],connected=hi-lo===1;
 if(!board.length){const pair=hi===lo;return {strength:pair?.52+(hi-2)/12*.46:clamp(.1+(hi-2)/12*.4+(lo-2)/12*.28+(suited?.06:0)+(connected?.045:0)-Math.max(0,hi-lo-3)*.02),draw:0,made:pair,handClass:pair?'pocket-pair':hi>=11&&lo>=10?'broadway':suited&&connected?'suited-connector':suited?'suited':'unpaired',drawClass:'none',wetness:0,vulnerability:0,playsBoard:false,nutDraw:false,overcards:0,suited,connected,pairRank:pair?hi:0,blockerStrength:clamp((ownRanks.includes(14)?.65:0)+(ownRanks.includes(13)?.3:0)),absoluteNuts:false,cleanOuts:0,pairedBoard:false};}
 const all=[...ownCards,...board],allRanks=all.map(rank),boardRanks=board.map(rank),groups=counts(allRanks),boardGroups=counts(boardRanks),suits=counts(all.map(c=>c[1])),boardSuits=counts(board.map(c=>c[1]));
 const best=evaluate(all),category=best[0],boardTop=Math.max(...boardRanks),playsBoard=board.length===5&&compareRanks(best,evaluate(board))===0;
 const overcards=ownRanks.filter(r=>r>boardTop).length;
 const maxBoardSuit=Math.max(...boardSuits.values());
 const ordered=[...new Set(boardRanks)].sort((a,b)=>a-b);let connection=0;
 for(let i=0;i<ordered.length;i++)connection=Math.max(connection,ordered.filter(v=>v>=ordered[i]&&v<=ordered[i]+4).length);
 const wetness=clamp((maxBoardSuit>=3?.5:maxBoardSuit===2?.22:0)+Math.max(0,connection-1)*.17+(boardGroups.size<board.length?.12:0));
 let handClass=['high-card','pair','two-pair','trips','straight','flush','full-house','quads','straight-flush'][category];
 let strength=[.15+hi/14*.13,.45,.73,.81,.86,.91,.96,.985,.998][category];
 const pairRank=category===1?best[1]:0;
 if(category===1){const ownPair=ownRanks.includes(pairRank);if(hi===lo&&hi>boardTop){handClass='overpair';strength=.67;}else if(ownPair&&pairRank===boardTop){handClass='top-pair';strength=.58+Math.min(hi===pairRank?lo:hi,14)/14*.055;}else if(ownPair){handClass=hi===lo?'underpair':'middle-pair';strength=.36+pairRank/14*.12;}else{handClass='board-pair';strength=.16+hi/14*.16+overcards*.035;}}
 if(category===2&&[best[1],best[2]].every(r=>(boardGroups.get(r)??0)>=2)){handClass='board-two-pair';strength=.28+hi/14*.14;}
 if(category===3&&!ownRanks.includes(best[1])){handClass='board-trips';strength=.3+hi/14*.2;}
 if(category===3&&hi===lo&&groups.get(hi)===3){handClass='set';strength=.84;}
 if(category===5){
  const flushSuit=[...suits.entries()].find(([,n])=>n>=5)![0];
  const ownFlush=ownCards.filter(c=>c[1]===flushSuit).map(rank);
  const privateHigh=Math.max(0,...ownFlush);
  const higherUnknown=Array.from({length:13},(_,i)=>i+2).filter(r=>r>privateHigh&&!all.some(c=>c[1]===flushSuit&&rank(c)===r)).length;
  const privateQuality=clamp(1-higherUnknown/9);
  strength=(boardSuits.get(flushSuit)??0)>=4?.46+privateQuality*.46:.64+privateQuality*.28;
 }
 if(category===6){
  if((boardGroups.get(best[1])??0)>=3)strength=.53+best[2]/14*.32;
  if([...boardGroups.entries()].some(([r,n])=>typeof r==='number'&&r>best[1]&&n>=2))strength-=.12;
 }
 if(category===7&&(boardGroups.get(best[1])??0)===4){handClass='board-quads';strength=.25+hi/14*.4;}
 if(playsBoard){handClass=`board-${handClass}`;strength=.34+hi/14*.1;}
 let flushDraw=false,nutDraw=false,backdoor=false,blockerStrength=0;
 for(const [suit,count] of boardSuits){if(count>=2){const highestUnboarded=Array.from({length:13},(_,i)=>14-i).find(r=>!board.some(c=>c[1]===suit&&rank(c)===r))!;if(ownCards.some(c=>c[1]===suit&&rank(c)===highestUnboarded))blockerStrength=count>=3?.85:.45;}}
 if(boardRanks.filter(r=>r>=10).length>=2)blockerStrength=Math.max(blockerStrength,ownRanks.includes(14)?.4:ownRanks.includes(13)?.2:0);
 for(const [suit,n] of suits){const ownInSuit=ownCards.filter(c=>c[1]===suit);if(n===4&&ownInSuit.length){flushDraw=true;const highestUnboarded=Array.from({length:13},(_,i)=>14-i).find(r=>!board.some(c=>c[1]===suit&&rank(c)===r))!;nutDraw=ownInSuit.some(c=>rank(c)===highestUnboarded);}if(n===3&&board.length===3&&ownInSuit.length===2)backdoor=true;}
 const completing:number[]=[];
 if(!straightHigh(allRanks))for(let r=2;r<=14;r++)if(!allRanks.includes(r)){const h=straightHigh([...allRanks,r]);if(h&&ownRanks.some(v=>!boardRanks.includes(v)&&(v<=h&&v>=h-4||(v===14&&h===5))))completing.push(r);}
 const outs=completing.length;
 const straightDraw=outs>=2?(completing.at(-1)!-completing[0]===5?'open-ended':'double-gutshot'):outs===1?'gutshot':'none';
 const live=board.length<5,combo=flushDraw&&outs>0;
 const drawClass=!live?'none':combo?'combo':flushDraw?(nutDraw?'nut-flush':'flush'):straightDraw!=='none'?straightDraw:backdoor?'backdoor':'none';
 const pairedBoard=boardGroups.size<board.length;
 const flushOuts=flushDraw?9:0,straightOuts=outs*4;
 const rawOuts=combo?Math.min(15,flushOuts+straightOuts-2):Math.max(flushOuts,straightOuts);
 const cleanOuts=live?Math.max(0,rawOuts*(flushDraw?(nutDraw?.97:.76):.85)*(pairedBoard?.76:1)+overcards*(pairedBoard?.5:1.3)):0;
 const draw=live?clamp((flushDraw?.32:0)+(outs>=2?.28:outs===1?.14:0)+(backdoor?.05:0),0,.58):0;
 const vulnerability=category<=3?clamp(wetness*(category===1?.8:category===2?.55:.3)+(category===1?(14-pairRank)/14*.15:0)):category===4&&maxBoardSuit>=3?.35:0;
 strength=clamp(strength-vulnerability*.09);
 const absoluteNuts=category===8&&best[1]===14||board.length===5&&category>=3&&unbeatableRiver(ownCards,board,best);
 return {strength,draw,made:category>0&&!handClass.startsWith('board-'),handClass,drawClass,wetness,vulnerability,playsBoard,nutDraw,overcards,suited,connected,pairRank,blockerStrength,absoluteNuts,cleanOuts,pairedBoard};
}
export interface DecisionContext {position:'early'|'middle'|'late'|'blinds';inPosition:boolean;effectiveStackBB:number;spr:number;activePlayers:number;playersBehind:number;price:number;betToPot:number;preflopNode:'unopened'|'limped'|'facing-open'|'facing-3bet'|'facing-4bet';limpers:number;squeeze:boolean;ownPreflopAggressor:boolean;checkedEarlier:boolean;delayedCbetOpportunity:boolean;raisesThisStreet:number;lastAggressor:number|null;}
export interface RunoutFeatures {
 previousDrawClass:string; missedDraw:boolean; drawCompleted:boolean;
 flushCompletion:boolean; straightCompletion:boolean; pairingCard:boolean; overcardArrival:boolean;
}
/** Only already dealt board prefixes: no future runout or hidden card access. */
export function runoutFeatures(own:Card[],board:Card[]):RunoutFeatures {
 if(board.length<4)return {previousDrawClass:'none',missedDraw:false,drawCompleted:false,flushCompletion:false,straightCompletion:false,pairingCard:false,overcardArrival:false};
 const before=board.slice(0,-1),previous=handFeatures(own,before),newCard=board.at(-1)!;
 const priorFlush=previous.drawClass.includes('flush')||previous.drawClass==='combo';
 const priorStraight=['gutshot','open-ended','double-gutshot','combo'].includes(previous.drawClass);
 const currentCategory=evaluate([...own,...board])[0];
 const flushCompleted=priorFlush&&currentCategory===5;
 const straightCompleted=priorStraight&&currentCategory===4;
 const drawCompleted=flushCompleted||straightCompleted||previous.draw>0&&currentCategory>=6;
 const boardRanks=before.map(rank),newRank=rank(newCard);
 const beforeSuits=before.filter(card=>card[1]===newCard[1]).length;
 const connected=before.map(rank).filter(r=>Math.abs(r-newRank)<=4).length;
 return {previousDrawClass:previous.drawClass,missedDraw:board.length===5&&previous.draw>0&&!drawCompleted,drawCompleted,
  flushCompletion:beforeSuits===2||beforeSuits===3,straightCompletion:connected>=3,pairingCard:boardRanks.includes(newRank),overcardArrival:newRank>Math.max(...boardRanks)};
}
export function decisionContext(o:BotObservation):DecisionContext {
 const own=o.seats.find(s=>s.id===o.actingSeat)!,active=o.seats.filter(s=>!s.folded),opponents=active.filter(s=>s.id!==o.actingSeat),total=o.seats.length;
 const button=o.seats.findIndex(s=>s.id===o.button),physicalPosition=preflopPosition(o);
 const position:DecisionContext['position']=physicalPosition==='BTN'||physicalPosition==='CO'?'late':physicalPosition==='SB'||physicalPosition==='BB'?'blinds':physicalPosition==='UTG'?'early':'middle';
 const postOrder=seatsFromButton(o).filter(s=>!s.folded&&!s.allIn);
 const postIndex=postOrder.findIndex(s=>s.id===o.actingSeat),inPosition=postIndex===postOrder.length-1;
 const bbSeat=o.publicEvents.filter(e=>e.type==='blind').at(-1)?.seatId??o.seats[(button+(total===2?1:2))%total].id;
 const bbIndex=o.seats.findIndex(s=>s.id===bbSeat);
 const turnOrder=o.street==='preflop'?[...o.seats.slice(bbIndex+1),...o.seats.slice(0,bbIndex+1)].filter(s=>!s.folded&&!s.allIn):postOrder;
 const turnIndex=turnOrder.findIndex(s=>s.id===o.actingSeat);
 const outstandingWager=Math.max(0,...opponents.map(s=>s.streetCommitted))-own.streetCommitted;
 const effective=Math.max(0,Math.min(own.stack+own.streetCommitted,Math.max(0,...opponents.map(s=>s.stack+s.streetCommitted)))-own.streetCommitted);
 const pre=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raises=pre.filter(e=>e.action?.type==='raise');
 const firstRaise=pre.findIndex(e=>e.action?.type==='raise');
 const limpers=new Set(pre.slice(0,firstRaise<0?undefined:firstRaise).filter(e=>e.action?.type==='call'&&(e.amount??0)>0).map(e=>e.seatId)).size;
 const lastRaiseIndex=pre.map(e=>e.action?.type).lastIndexOf('raise');
 const callsSince=lastRaiseIndex>=0?pre.slice(lastRaiseIndex+1).filter(e=>e.action?.type==='call').length:0;
 const street=o.publicEvents.filter(e=>e.type==='action'&&e.street===o.street),streetRaises=street.filter(e=>e.action?.type==='raise');
 const checkedEarlier=street.some(e=>e.seatId===o.actingSeat&&e.action?.type==='check');
 const ownPreflopAggressor=raises.at(-1)?.seatId===o.actingSeat;
 const flop=o.publicEvents.filter(e=>e.type==='action'&&e.street==='flop');
 const delayedCbetOpportunity=o.street==='turn'&&ownPreflopAggressor&&flop.length>0&&!flop.some(e=>e.action?.type==='raise');
 return {position,inPosition,effectiveStackBB:effective/o.bigBlind,spr:effective/Math.max(o.pot,o.bigBlind),activePlayers:active.length,playersBehind:Math.max(0,turnOrder.length-turnIndex-1),price:contestablePricing(o).price,betToPot:Math.max(0,outstandingWager)/Math.max(o.bigBlind,o.pot-Math.max(0,outstandingWager)),preflopNode:raises.length>=3?'facing-4bet':raises.length===2?'facing-3bet':raises.length===1?'facing-open':limpers?'limped':'unopened',limpers,squeeze:raises.length===1&&callsSince>0,ownPreflopAggressor,checkedEarlier,delayedCbetOpportunity,raisesThisStreet:streetRaises.length,lastAggressor:streetRaises.at(-1)?.seatId??raises.at(-1)?.seatId??null};
}
