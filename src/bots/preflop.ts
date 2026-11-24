import type {BotObservation,BotProfile,Card} from '../contracts';
import type {PreflopAnalysis,PreflopNode,PreflopPosition,SizeChoice} from './range-contract';
import {completeProfile,clamp,sigmoid} from './profiles';
import {permittedObservation,validate} from './boundary';
import {contestablePricing} from './pricing';

/** Ordinal designed range inputs, not equity, solved charts, or observed human frequencies. */
export const PREFLOP_MODEL_VERSION='preflop-designed-1.2.0';
const RANKS='23456789TJQKA',SUITS='cdhs';
export interface StartingClass {handClass:string;comboCount:number;highRank:number;lowRank:number;suited:boolean;pair:boolean;baseScore:number;speculative:number;blocker:number;}
// Every class is explicit. Pairs have six combinations, suited classes four and offsuit classes twelve.
const CLASS_ROWS=[
 'AA:100 AKs:96 AKo:91 AQs:89 AQo:83 AJs:83 AJo:74 ATs:78 ATo:65 A9s:66 A9o:49 A8s:63 A8o:44 A7s:60 A7o:40 A6s:57 A6o:36 A5s:65 A5o:39 A4s:62 A4o:35 A3s:58 A3o:31 A2s:55 A2o:28',
 'KK:97 KQs:85 KQo:75 KJs:77 KJo:63 KTs:70 KTo:51 K9s:57 K9o:36 K8s:50 K8o:27 K7s:47 K7o:23 K6s:44 K6o:20 K5s:42 K5o:18 K4s:40 K4o:16 K3s:38 K3o:14 K2s:36 K2o:12',
 'QQ:93 QJs:75 QJo:60 QTs:67 QTo:48 Q9s:54 Q9o:33 Q8s:45 Q8o:24 Q7s:39 Q7o:16 Q6s:36 Q6o:13 Q5s:34 Q5o:11 Q4s:32 Q4o:9 Q3s:30 Q3o:7 Q2s:28 Q2o:6',
 'JJ:88 JTs:72 JTo:54 J9s:57 J9o:36 J8s:47 J8o:25 J7s:39 J7o:17 J6s:31 J6o:10 J5s:29 J5o:8 J4s:27 J4o:6 J3s:25 J3o:4 J2s:23 J2o:3',
 'TT:82 T9s:62 T9o:42 T8s:52 T8o:30 T7s:42 T7o:21 T6s:34 T6o:14 T5s:26 T5o:8 T4s:24 T4o:6 T3s:22 T3o:4 T2s:20 T2o:2',
 '99:76 98s:60 98o:38 97s:51 97o:28 96s:41 96o:19 95s:33 95o:12 94s:25 94o:7 93s:21 93o:4 92s:19 92o:2',
 '88:70 87s:58 87o:35 86s:49 86o:26 85s:40 85o:18 84s:32 84o:11 83s:24 83o:6 82s:18 82o:2',
 '77:65 76s:55 76o:32 75s:47 75o:24 74s:38 74o:16 73s:30 73o:9 72s:22 72o:3',
 '66:60 65s:52 65o:29 64s:44 64o:21 63s:35 63o:13 62s:27 62o:6',
 '55:55 54s:49 54o:26 53s:41 53o:18 52s:33 52o:10',
 '44:51 43s:38 43o:16 42s:30 42o:8',
 '33:47 32s:27 32o:7',
 '22:43',
] as const;
const rank=(card:string)=>RANKS.indexOf(card[0])+2;
export const PREFLOP_CLASSES:readonly Readonly<StartingClass>[]=Object.freeze(CLASS_ROWS.flatMap(row=>row.split(' ')).map(entry=>{
 const [handClass,score]=entry.split(':'),highRank=rank(handClass),lowRank=rank(handClass.slice(1)),pair=highRank===lowRank,suited=handClass.endsWith('s'),gap=highRank-lowRank;
 const speculative=pair?clamp((11-highRank)/7):suited&&highRank===14?.55:suited?clamp((14-highRank)/7)*clamp((5-gap)/4):0;
 return Object.freeze({handClass,comboCount:pair?6:suited?4:12,highRank,lowRank,pair,suited,baseScore:Number(score),speculative,blocker:clamp((highRank===14?.7:highRank===13?.3:0)+(lowRank===13?.2:0))});
}));
const CLASSES=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
function getClass(handClass:string):Readonly<StartingClass>{const c=CLASSES.get(handClass);if(!c)throw new Error('Unknown starting-hand class.');return c;}
function checkCards(cards:readonly Card[]):void{if(cards.some(c=>!/^[2-9TJQKA][cdhs]$/.test(c))||new Set(cards).size!==cards.length)throw new Error('Invalid or duplicated cards.');}
export function classifyStartingHand(cards:readonly Card[]):string{
 if(cards.length!==2)throw new Error('A starting hand must contain two cards.');checkCards(cards);
 const [a,b]=[...cards].sort((x,y)=>rank(y)-rank(x));return a[0]+b[0]+(a[0]===b[0]?'':a[1]===b[1]?'s':'o');
}
export function comboCountForClass(handClass:string):number{return getClass(handClass).comboCount;}
export function combosForClass(handClass:string,deadCards:readonly Card[]=[]):[Card,Card][]{
 const c=getClass(handClass);checkCards(deadCards);const dead=new Set(deadCards),result:[Card,Card][]=[];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){
  if(c.pair&&b<=a||!c.pair&&(c.suited?a!==b:a===b))continue;
  const cards:[Card,Card]=[RANKS[c.highRank-2]+SUITS[a],RANKS[c.lowRank-2]+SUITS[b]];
  if(!cards.some(card=>dead.has(card)))result.push(cards);
 }return result;
}
export function enumerateStartingCombos(deadCards:readonly Card[]=[]):{cards:[Card,Card];handClass:string}[]{
 checkCards(deadCards);return PREFLOP_CLASSES.flatMap(c=>combosForClass(c.handClass,deadCards).map(cards=>({cards,handClass:c.handClass})));
}

/** Public physical seat order supports a genuinely empty dealer position. */
export function seatsFromButton(o:BotObservation,includeButton=false):BotObservation['seats'] {
 const order=[...o.seats].sort((a,b)=>a.id-b.id);
 return [...order.filter(s=>includeButton?s.id>=o.button:s.id>o.button),...order.filter(s=>includeButton?s.id<o.button:s.id<=o.button)];
}
export function publicBlindSeats(o:BotObservation):{small:number|undefined;big:number} {
 const blinds=o.publicEvents.filter(e=>e.type==='blind');
 if(blinds.length&&(!o.seats.some(s=>s.id===o.button)||blinds.length===1))return {small:blinds.length>1?blinds[0].seatId:undefined,big:blinds.at(-1)!.seatId!};
 const order=seatsFromButton(o);return {small:o.seats.length===2?o.button:order[0].id,big:order[o.seats.length===2?0:1].id};
}
function irregularPosition(o:BotObservation,seatId:number):PreflopPosition|null {
 const order=seatsFromButton(o),blinds=publicBlindSeats(o),expectedSmall=o.seats.length===2?o.button:order[0].id,expectedBig=order[o.seats.length===2?0:1].id;
 if(o.seats.some(s=>s.id===o.button)&&blinds.small===expectedSmall&&blinds.big===expectedBig)return null;
 if(!o.seats.some(s=>s.id===seatId)||o.seats.length<2||o.seats.length>10)throw new Error('Invalid seat position.');
 if(seatId===o.button)return 'BTN';if(seatId===blinds.small)return 'SB';if(seatId===blinds.big)return 'BB';
 const others=order.filter(s=>s.id!==blinds.small&&s.id!==blinds.big&&s.id!==o.button),index=others.findIndex(s=>s.id===seatId);
 return index===others.length-1?'CO':index<Math.ceil((others.length-1)/2)?'UTG':'MP';
}

/** Collapsed physical positions: BTN includes the heads-up button/small blind. */
export function preflopPosition(o:BotObservation,seatId=o.actingSeat):PreflopPosition{
 const irregular=irregularPosition(o,seatId);if(irregular)return irregular;
 const order=[...o.seats].sort((a,b)=>a.id-b.id),n=order.length,button=order.findIndex(s=>s.id===o.button),index=order.findIndex(s=>s.id===seatId);
 if(n<2||n>10||button<0||index<0)throw new Error('Invalid seat position.');
 const distance=(index-button+n)%n;if(distance===0)return 'BTN';
 if(n===2)return 'BB';if(distance===1)return 'SB';if(distance===2)return 'BB';
 if(distance===n-1)return 'CO';
 const earlyCount=Math.ceil((n-4)/2);return distance-3<earlyCount?'UTG':'MP';
}

/** Exact positional label for review only; policy uses actual responders behind. */
export function physicalPosition(o:BotObservation,seatId=o.actingSeat):string{
 const irregular=irregularPosition(o,seatId);if(irregular)return irregular;
 const order=[...o.seats].sort((a,b)=>a.id-b.id),n=order.length,b=order.findIndex(s=>s.id===o.button),i=order.findIndex(s=>s.id===seatId),d=(i-b+n)%n;
 if(i<0||b<0||n<2||n>10)throw new Error('Invalid seat position.');
 if(d===0)return n===2?'BTN/SB':'BTN';if(n===2||d===2)return 'BB';if(d===1)return 'SB';
 const behind=n-d+2;if(behind===3)return 'CO';if(behind===4)return 'HJ';if(behind===5)return n===6?'UTG/LJ':'LJ';return d===3?'UTG':`UTG+${d-3}`;
}

export interface DepthBracket{lowerBB:number;upperBB:number;fraction:number;smallPair:number;suitedConnectors:number;suitedAce:number;offsuitBroadway:number;}
const DEPTH_ANCHORS=[
 {bb:20,smallPair:-11,suitedConnectors:-15,suitedAce:-5,offsuitBroadway:2},
 {bb:40,smallPair:-7,suitedConnectors:-9,suitedAce:-2,offsuitBroadway:1},
 {bb:60,smallPair:-3,suitedConnectors:-4,suitedAce:0,offsuitBroadway:0},
 {bb:100,smallPair:0,suitedConnectors:0,suitedAce:0,offsuitBroadway:0},
 {bb:150,smallPair:3,suitedConnectors:5,suitedAce:2,offsuitBroadway:-2},
 {bb:200,smallPair:6,suitedConnectors:9,suitedAce:4,offsuitBroadway:-4},
 {bb:300,smallPair:8,suitedConnectors:12,suitedAce:5,offsuitBroadway:-5},
] as const;
export function depthBracket(effectiveBB:number):DepthBracket{
 if(!Number.isFinite(effectiveBB)||effectiveBB<0)throw new Error('Invalid effective stack.');
 const depth=clamp(effectiveBB,20,300);let lower=DEPTH_ANCHORS[0] as typeof DEPTH_ANCHORS[number],upper=lower;
 for(const point of DEPTH_ANCHORS){if(point.bb<=depth)lower=point;if(point.bb>=depth){upper=point;break;}}
 const fraction=upper.bb===lower.bb?0:(depth-lower.bb)/(upper.bb-lower.bb);
 const blend=(key:'smallPair'|'suitedConnectors'|'suitedAce'|'offsuitBroadway')=>lower[key]+(upper[key]-lower[key])*fraction;
 return {lowerBB:lower.bb,upperBB:upper.bb,fraction,smallPair:blend('smallPair'),suitedConnectors:blend('suitedConnectors'),suitedAce:blend('suitedAce'),offsuitBroadway:blend('offsuitBroadway')};
}
const POSITIONS:readonly PreflopPosition[]=['UTG','MP','CO','BTN','SB','BB'];
const BASES:Record<BotProfile['archetype'],{looseness:number;cutoffs:readonly number[]}>= {
 nit:{looseness:.13,cutoffs:[80,76,70,62,72,68]},station:{looseness:.9,cutoffs:[40,37,34,28,27,24]},tag:{looseness:.34,cutoffs:[68,64,58,49,58,50]},lag:{looseness:.68,cutoffs:[58,54,46,36,45,38]},
 'fit-or-fold':{looseness:.4,cutoffs:[70,66,61,55,60,53]},maniac:{looseness:.89,cutoffs:[40,36,29,20,25,20]},'passive-reg':{looseness:.72,cutoffs:[47,43,38,32,31,28]},'stronger-reg':{looseness:.4,cutoffs:[66,62,55,46,55,47]},
};
const smooth=(n:number)=>{const x=clamp(n);return x*x*(3-2*x);};
export interface PreflopModifiers{seats:number;callBB:number;price:number;limpers:number;coldCallers:number;squeeze:boolean;openerPosition:PreflopPosition|null;rakeFraction:number;/** Exact public responders behind actor; omitted advisory calls infer the representative physical role. */playersBehind?:number;}
const DEFAULT_MODIFIERS:PreflopModifiers={seats:6,callBB:1,price:.25,limpers:0,coldCallers:0,squeeze:false,openerPosition:null,rakeFraction:0};
interface ClassWeight{handClass:string;comboCount:number;continueWeight:number;raiseWeight:number;callWeight:number;score:number;cutoff:number;premiumValue:number;trapProbability:number;openingInitiativeCredit:number;playersBehind:number;}
function classWeight(c:Readonly<StartingClass>,p:ReturnType<typeof completeProfile>,position:PreflopPosition,node:PreflopNode,effectiveBB:number,m:PreflopModifiers):ClassWeight{
 const t=p.traits,base=BASES[p.archetype],b=depthBracket(effectiveBB),awareness=.4+.6*t.positionAwareness;
 const playersBehind=m.playersBehind??(position==='UTG'?m.seats-1:position==='MP'?4:position==='CO'?3:position==='BTN'?(m.seats===2?1:2):position==='SB'?1:0);
 // A folded-to button faces two blinds regardless of how many seats were dealt.
 // Additional early full-ring seats add distinct response-player pressure; the
 // six coarse public labels remain backward-compatible diagnostics only.
 const openingIndex=playersBehind<=1?(position==='BTN'?3:4):playersBehind===2?3:playersBehind===3?2:playersBehind===4?1:0;
 const rawCutoff=node==='unopened'?base.cutoffs[openingIndex]+Math.max(0,playersBehind-5)*2.5:base.cutoffs[POSITIONS.indexOf(position)];
 const positional=base.cutoffs[1]+(rawCutoff-base.cutoffs[1])*awareness;
 // First-in initiative is distinct from paying an established value range.
 // Position/competence recognize fold equity and realization; passive/low-skill
 // profiles retain their mistakes. This is an authored prior, not a target RFI.
 const openingInitiativeCredit=node==='unopened'?(4+8*p.skill)*(.55+.45*t.positionAwareness)+Math.max(0,5-playersBehind)*2*t.positionAwareness*p.skill+(m.seats===2?8*(.5+.5*p.skill):0):0;
 const depthEffect=c.pair&&c.highRank<=9?b.smallPair*clamp((11-c.highRank)/7):c.suited&&c.highRank===14?b.suitedAce:c.suited&&c.highRank-c.lowRank<=3?b.suitedConnectors*clamp((5-(c.highRank-c.lowRank))/4):!c.suited&&!c.pair&&c.lowRank>=10?b.offsuitBroadway:0;
 const score=c.baseScore+depthEffect;
 const nodePressure=node==='facing-4bet'?31:node==='facing-3bet'?20:node==='facing-open'?8:node==='limped'?1:0;
 const reference=node==='facing-4bet'?24:node==='facing-3bet'?10:node==='facing-open'?3:1;
 const pricePressure=node!=='unopened'&&m.callBB>0?Math.log2(clamp(m.callBB/reference,.25,16))*(3+t.sizeSensitivity*5):0;
 const oddsPressure=node==='unopened'?0:Math.max(0,m.price-.25)*(6+t.sizeSensitivity*10);
 const openerPressure=m.openerPosition==='UTG'?3*p.skill:m.openerPosition==='BTN'?-3*t.positionAwareness:0;
 const multiway=(m.coldCallers+m.limpers*.35)*t.multiwayCaution*(c.speculative>.5?-.7:1.6);
 const tablePressure=node==='unopened'?0:Math.max(-4,m.seats-6)*t.multiwayCaution*.7;
 const environment=p.environment==='low'?-.8:p.environment==='high'?.8:0;
 const cutoff=positional-openingInitiativeCredit-(p.looseness-base.looseness)*24+nodePressure+pricePressure+oddsPressure+openerPressure+multiway+tablePressure+environment+m.rakeFraction*20;
 const width=4.5+t.mistakeRate*2.5;
 let continuation=sigmoid((score-cutoff)/width);
 const firstIn=node==='unopened'||node==='limped';
 const coreValue=smooth((c.baseScore-74)/20);
 // Continuous value ordering spans every class. No hand-name-specific action override.
 let protection=firstIn?coreValue:smooth((c.baseScore-(node==='facing-open'?78:node==='facing-3bet'?82:88))/(node==='facing-open'?22:node==='facing-3bet'?18:12));
 if(!firstIn){
  protection+=(1-protection)*clamp((60-effectiveBB)/40)*coreValue*.35;
  protection-=Math.max(0,Math.log2(Math.max(1,m.callBB/reference)))*t.sizeSensitivity*.15*protection*(1-protection);
 }
 continuation=Math.max(continuation,clamp(protection));
 const valueThreshold=node==='facing-4bet'?91:node==='facing-3bet'?87:node==='facing-open'?80:74;
 const valueSpan=node==='facing-4bet'?9:node==='facing-3bet'?12:node==='facing-open'?18:20;
 const premiumValue=smooth((c.baseScore-valueThreshold)/valueSpan);
 const trapProbability=clamp(t.slowPlay*(1-p.aggression)*(.08+.32*(1-p.skill))*(node==='facing-3bet'?1.4:node==='facing-4bet'?1.25:1),0,.3);
 const openingPreference=sigmoid((p.aggression+p.skill*.65-.55)*8);
 let ordinaryRaise=firstIn?openingPreference:.06+p.aggression*.32;
 if(node==='limped')ordinaryRaise*=.65+Math.min(.25,m.limpers*.07)+p.aggression*.15;
 if(m.squeeze)ordinaryRaise+=t.bluffFrequency*p.aggression*.16*c.blocker;
 if(!firstIn)ordinaryRaise+=Number(c.suited)*c.blocker*t.bluffFrequency*p.aggression*.12;
 // Value benefits dominate normal passive style; trapping remains deliberately bounded.
 let raiseConditional=ordinaryRaise*(1-premiumValue)+(1-trapProbability)*premiumValue;
 const shortCommit=clamp((55-effectiveBB)/35)*premiumValue*t.riskTolerance;
 if(!firstIn)raiseConditional+=shortCommit*.16;
 raiseConditional=clamp(raiseConditional,0,1);
 const mistakes=t.mistakeRate*(1-p.skill*.8)*.025*(1-coreValue);
 continuation=clamp(continuation*(1-mistakes)+p.looseness*.35*mistakes);
 return {handClass:c.handClass,comboCount:c.comboCount,continueWeight:continuation,raiseWeight:continuation*raiseConditional,callWeight:continuation*(1-raiseConditional),score,cutoff,premiumValue,trapProbability,openingInitiativeCredit,playersBehind};
}
export function rangeWeights(profile:BotProfile,position:PreflopPosition,node:PreflopNode,effectiveBB:number,modifiers:Partial<PreflopModifiers>={}):ClassWeight[]{
 if(!POSITIONS.includes(position))throw new Error('Unknown preflop position.');
 if(!['unopened','limped','facing-open','facing-3bet','facing-4bet'].includes(node))throw new Error('Unknown preflop node.');
 const p=completeProfile(profile),m={...DEFAULT_MODIFIERS,...modifiers};
 if(m.playersBehind!==undefined&&(!Number.isInteger(m.playersBehind)||m.playersBehind<0||m.playersBehind>=m.seats)||!Number.isInteger(m.seats)||m.seats<2||m.seats>10||!Number.isFinite(m.callBB)||m.callBB<0||!Number.isFinite(m.price)||m.price<0||m.price>1||!Number.isInteger(m.limpers)||m.limpers<0||m.limpers>9||!Number.isInteger(m.coldCallers)||m.coldCallers<0||m.coldCallers>9||typeof m.squeeze!=='boolean'||m.openerPosition!==null&&!POSITIONS.includes(m.openerPosition)||!Number.isFinite(m.rakeFraction)||m.rakeFraction<0||m.rakeFraction>1)throw new Error('Invalid preflop range modifiers.');
 return PREFLOP_CLASSES.map(c=>classWeight(c,p,position,node,effectiveBB,m));
}
function context(o:BotObservation):{position:PreflopPosition;node:PreflopNode;effectiveStackBB:number;modifiers:PreflopModifiers}{
 const own=o.seats.find(s=>s.id===o.actingSeat)!,opponents=o.seats.filter(s=>s.id!==own.id&&!s.folded);
 const effectiveStackBB=Math.min(own.stack+own.streetCommitted,Math.max(0,...opponents.map(s=>s.stack+s.streetCommitted)))/o.bigBlind;
 const actions=o.publicEvents.filter(e=>e.type==='action'&&e.street==='preflop'),raises=actions.filter(e=>e.action?.type==='raise');
 const firstRaise=actions.findIndex(e=>e.action?.type==='raise'),lastRaise=actions.map(e=>e.action?.type).lastIndexOf('raise');
 const limpers=new Set(actions.slice(0,firstRaise<0?undefined:firstRaise).filter(e=>e.action?.type==='call'&&e.seatId!==own.id).map(e=>e.seatId)).size;
 const coldCallers=lastRaise<0?0:new Set(actions.slice(lastRaise+1).filter(e=>e.action?.type==='call'&&e.seatId!==own.id).map(e=>e.seatId)).size;
 const node:PreflopNode=raises.length>=3?'facing-4bet':raises.length===2?'facing-3bet':raises.length===1?'facing-open':limpers?'limped':'unopened';
 const opener=raises[0]?.seatId,pricing=contestablePricing(o);
 const ordered=[...o.seats].sort((a,b)=>a.id-b.id),actorIndex=ordered.findIndex(s=>s.id===own.id),bbIndex=ordered.findIndex(s=>s.id===publicBlindSeats(o).big);
 let playersBehind=0;for(let step=1;step<ordered.length;step++){const index=(actorIndex+step)%ordered.length,seat=ordered[index];if(!seat.folded&&!seat.allIn)playersBehind++;if(index===bbIndex)break;}
 return {position:preflopPosition(o),node,effectiveStackBB,modifiers:{seats:o.seats.length,callBB:o.legal.callAmount/o.bigBlind,price:pricing.price,playersBehind,limpers,coldCallers,squeeze:raises.length===1&&coldCallers>0,openerPosition:opener===undefined?null:preflopPosition(o,opener),rakeFraction:(o.rake?.cap??0)>0?(o.rake?.basisPoints??0)/10000:0}};
}
function sizes(o:BotObservation,p:ReturnType<typeof completeProfile>,c:ReturnType<typeof context>,weight:ClassWeight):SizeChoice[]{
 if(!o.legal.canRaise)return [];if(o.legal.shortAllInTo!==null)return [{label:'Short all-in',raiseTo:o.legal.shortAllInTo,weight:1}];
 const result:SizeChoice[]=[],own=o.seats.find(s=>s.id===o.actingSeat)!,facing=own.streetCommitted+o.legal.callAmount;
 const add=(label:string,to:number,w:number)=>{const raiseTo=clamp(Math.round(to/(o.chipUnit??1))*(o.chipUnit??1),o.legal.minRaiseTo!,o.legal.maxRaiseTo!),existing=result.find(s=>s.raiseTo===raiseTo);if(existing)existing.weight+=w;else result.push({label:raiseTo===o.legal.maxRaiseTo?'All-in':label,raiseTo,weight:w});};
 const deep=Math.max(0,Math.min(200,c.effectiveStackBB)-100)/100,short=Math.max(0,40-c.effectiveStackBB)/20;
 if(c.node==='unopened'||c.node==='limped'){
  const open=2.25+p.traits.sizingAggression*.65+deep*.2-short*.2+(c.position==='SB'?.3:0)+(p.environment==='low'?.25:0);
  const isolation=c.modifiers.limpers*(.8+p.traits.sizingAggression*.45);
  for(const [offset,w] of [[-.25,.25],[0,.5],[.55,.25]])add(c.modifiers.limpers?'Isolation raise':'Open raise',(open+isolation+offset)*o.bigBlind,w);
 }else{
  const outOfPosition=c.position==='SB'||c.position==='BB';
  const multiple=c.node==='facing-open'?(outOfPosition?3.5:3):2.25;
  const callers=c.modifiers.coldCallers*facing*.7;
  for(const [offset,w] of [[-.25,.25],[0,.5],[.5,.25]])add(c.modifiers.squeeze?'Squeeze':c.node==='facing-open'?'3-bet':'4-bet+',facing*(multiple+offset+deep*.15)+callers,w);
 }
 if(c.node!=='unopened'&&c.effectiveStackBB<=40&&weight.premiumValue>.5)add('All-in',o.legal.maxRaiseTo!,clamp((45-c.effectiveStackBB)/30)*(.4+weight.premiumValue));
 const total=result.reduce((sum,s)=>sum+s.weight,0);return result.map(s=>({...s,weight:s.weight/total}));
}
export function analyzePreflop(observation:BotObservation,profile:BotProfile):PreflopAnalysis{
 const o=permittedObservation(observation),p=completeProfile(profile);validate(o,p);if(o.street!=='preflop'||o.board.length)throw new Error('Preflop analysis requires a preflop observation.');
 const handClass=classifyStartingHand(o.ownCards),c=context(o),w=classWeight(getClass(handClass),p,c.position,c.node,c.effectiveStackBB,c.modifiers);
 let raise=o.legal.canRaise?w.raiseWeight:0;
 let call=o.legal.canRaise?w.callWeight:w.continueWeight;
 let fold=1-w.continueWeight,check=0;
 if(o.legal.check){fold=0;call=0;check=1-raise;}
 else if(!o.legal.fold){call+=fold;fold=0;}
 if(!o.legal.canRaise)raise=0;
 const b=depthBracket(c.effectiveStackBB);
 return {modelVersion:PREFLOP_MODEL_VERSION,handClass,comboCount:w.comboCount,position:c.position,node:c.node,effectiveStackBB:c.effectiveStackBB,distribution:{fold,check,call,raise},sizing:sizes(o,p,c,w),diagnostics:{baseScore:getClass(handClass).baseScore,adjustedScore:w.score,rangeCutoff:w.cutoff,continueWeight:w.continueWeight,premiumValue:w.premiumValue,trapProbability:w.trapProbability,openingInitiativeCredit:w.openingInitiativeCredit,playersBehind:w.playersBehind,physicalPosition:physicalPosition(o),contestableAfterCall:contestablePricing(o).contestableAfterCall,excludedChips:contestablePricing(o).excludedChips,lowerDepthBB:b.lowerBB,upperDepthBB:b.upperBB,depthFraction:b.fraction,limpers:c.modifiers.limpers,coldCallers:c.modifiers.coldCallers,squeeze:Number(c.modifiers.squeeze),callBB:c.modifiers.callBB,callPrice:c.modifiers.price,openerPosition:c.modifiers.openerPosition??'none',classCount:PREFLOP_CLASSES.length,totalCombinations:1326,evidence:'DESIGNED_SYNTHETIC_NOT_HUMAN_VALIDATED'}};
}
