import type {BotObservation,BotProfile,Card,GameEvent,ObservedRate} from '../../contracts';
import type {ActionMix,OpponentRange,RangeAnalysis,WeightedCombo} from './range-contract';
import {compareRanks,evaluate} from '../../core/evaluator';
import {enumerateStartingCombos,PREFLOP_CLASSES,preflopPosition} from './preflop';

/** Synthetic public-action inference, not a solver or measured human likelihood model. */
export const RANGE_MODEL_VERSION='public-action-ranges-1.1.0';
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sigmoid=(x:number)=>1/(1+Math.exp(-x));
const DECK=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));
const rank=(c:Card)=>'23456789TJQKA'.indexOf(c[0])+2;
const classes=new Map(PREFLOP_CLASSES.map(c=>[c.handClass,c]));
const combos=enumerateStartingCombos().map(c=>({...c,meta:classes.get(c.handClass)!}));
interface Shape {strength:number;draw:number;blocker:number;strong:boolean;}
interface Belief {vpip:number;pfr:number;aggression:number;fold:number;confidence:number;source:string;}
interface Evidence {event:GameEvent;board:Card[];raises:number;size:number;facing:number;pot:number;checked:boolean;playersAtAction:number;}
interface InternalRange {range:OpponentRange;strength:number;nutMass:number;foldChance:number;}
const shapeCache=new Map<string,Shape[]>();
const analysisCache=new Map<string,RangeAnalysis>();
const MAX_CACHE=8;
function putBounded<T>(cache:Map<string,T>,key:string,value:T,max=MAX_CACHE){cache.set(key,value);if(cache.size>max)cache.delete(cache.keys().next().value!);return value;}

// Linear-time, deliberately approximate likelihood features. Exact showdown comparisons below
// always use the authoritative evaluator. Never enumerate nuts for every hypothetical combo.
function shape(cards:readonly Card[],board:readonly Card[]):Shape {
 const hi=Math.max(...cards.map(rank));
 if(!board.length){const m=classes.get(className(cards))!;return {strength:m.baseScore/100,draw:m.speculative,blocker:m.blocker,strong:m.baseScore>=90};}
 const all=[...cards,...board],counts=new Array<number>(15).fill(0),bc=new Array<number>(15).fill(0);
 const suits:Record<string,number>={c:0,d:0,h:0,s:0},bs:Record<string,number>={c:0,d:0,h:0,s:0};
 for(const c of all){counts[rank(c)]++;suits[c[1]]++;}for(const c of board){bc[rank(c)]++;bs[c[1]]++;}
 const pairs=counts.map((n,r)=>n>=2?r:0).filter(Boolean).sort((a,b)=>b-a),trips=pairs.filter(r=>counts[r]>=3);
 let straight=0,privateStraightDraw=false;const have=new Set(all.map(rank));if(have.has(14))have.add(1);const boardHave=new Set(board.map(rank));if(boardHave.has(14))boardHave.add(1);
 for(let top=14;top>=5;top--){let n=0;for(let r=top-4;r<=top;r++)if(have.has(r))n++;if(n===4&&cards.some(c=>{const r=rank(c)===14&&top===5?1:rank(c);return r>=top-4&&r<=top&&!boardHave.has(r);}))privateStraightDraw=true;if(n===5&&!straight)straight=top;}
 const flushSuit=Object.keys(suits).find(s=>suits[s]>=5),drawSuit=Object.keys(suits).find(s=>suits[s]===4);
 const top=Math.max(...board.map(rank)),ownRanks=cards.map(rank),ownPair=ownRanks[0]===ownRanks[1];
 let strength=.15+hi/14*.1,draw=0,blocker=0;
 if(pairs.length){const pr=pairs[0];strength=ownPair&&pr>top?.69:ownRanks.includes(pr)&&pr===top?.59+hi/14*.04:ownRanks.includes(pr)?.38+pr/14*.11:.2+hi/14*.07;}
 if(pairs.length>=2)strength=pairs.slice(0,2).some(r=>bc[r]<2)?.75:.32+hi/14*.04;
 if(trips.length)strength=ownRanks.includes(trips[0])?.83:.4+hi/14*.05;
 if(straight)strength=.85;
 if(flushSuit){const privateHigh=Math.max(0,...cards.filter(c=>c[1]===flushSuit).map(rank));const higherUnknown=Array.from({length:13},(_,i)=>i+2).filter(r=>r>privateHigh&&!all.some(c=>c[1]===flushSuit&&rank(c)===r)).length;const quality=clamp(1-higherUnknown/9);strength=bs[flushSuit]>=4?.46+quality*.46:.64+quality*.28;}
 if(trips.length&&pairs.some(r=>r!==trips[0]))strength=bc[trips[0]]>=3?.59+pairs.find(r=>r!==trips[0])!/14*.28:.95;
 if(pairs.some(r=>counts[r]===4)){const q=pairs.find(r=>counts[r]===4)!;strength=bc[q]===4?.45+hi/14*.4:.995;}
 if(board.length<5){if(drawSuit&&cards.some(c=>c[1]===drawSuit))draw=.7;if(!straight&&privateStraightDraw)draw=Math.max(draw,.5);if(drawSuit&&!straight&&privateStraightDraw)draw=.95;}
 for(const suit of Object.keys(bs))if(bs[suit]>=2){const highest=Array.from({length:13},(_,i)=>14-i).find(r=>!board.some(c=>c[1]===suit&&rank(c)===r));if(cards.some(c=>c[1]===suit&&rank(c)===highest))blocker=Math.max(blocker,bs[suit]>=3?.9:.4);}
 return {strength:clamp(strength),draw,blocker,strong:strength>=.82};
}
function className(cards:readonly Card[]){const sorted=[...cards].sort((a,b)=>rank(b)-rank(a)),a=sorted[0][0],b=sorted[1][0];return a===b?a+b:a+b+(sorted[0][1]===sorted[1][1]?'s':'o');}
function boardShapes(board:Card[]){const key=board.join('');const hit=shapeCache.get(key);if(hit)return hit;return putBounded(shapeCache,key,combos.map(c=>c.cards.some(x=>board.includes(x))?{strength:0,draw:0,blocker:0,strong:false}:shape(c.cards,board)),4);}
function observed(rate:ObservedRate|undefined,prior:number,adaptation:number){const n=Math.max(0,rate?.opportunities??0),count=clamp(rate?.count??0,0,n),weight=n/(n+24)*adaptation;return {value:prior*(1-weight)+(n?count/n:prior)*weight,weight};}
function belief(o:BotObservation,p:BotProfile,seatId:number):Belief {
 // Environment is the observing player's configured public population belief, not opponent truth.
 const low=p.environment==='low',high=p.environment==='high';const priors={vpip:low?.38:high?.27:.31,pfr:low?.16:high?.23:.2,aggression:low?.29:high?.45:.37,fold:low?.38:high?.47:.43};
 const known=o.memory?.opponents.find(m=>m.seatId===seatId),adapt=p.traits?.adaptation??.5;
 const v=observed(known?.vpip,priors.vpip,adapt),r=observed(known?.pfr,priors.pfr,adapt),a=observed(known?.aggression,priors.aggression,adapt),f=observed(known?.foldToBet,priors.fold,adapt);
 return {vpip:clamp(v.value,.08,.82),pfr:clamp(r.value,.03,.7),aggression:clamp(a.value,.08,.85),fold:clamp(f.value,.1,.82),confidence:(v.weight+r.weight+a.weight+f.weight)/4,source:known?'public observed rates shrunk toward synthetic population prior':'synthetic population prior; no private opponent profile'};
}
function evidence(o:BotObservation):Evidence[] {
 const results:Evidence[]=[],commits=new Map<number,number>(),checked=new Set<number>(),seen=new Set<string>();let street='preflop',pot=0,wager=0,raises=0;const active=new Set(o.seats.map(s=>s.id));
 for(const event of o.publicEvents){if(seen.has(event.id))continue;seen.add(event.id);
  if(event.type==='street'){street=event.street??street;commits.clear();checked.clear();wager=0;raises=0;continue;}
  const id=event.seatId;if(id===undefined)continue;const amount=Math.max(0,event.amount??0);
  if(event.type==='blind'){commits.set(id,(commits.get(id)??0)+amount);pot+=amount;wager=Math.max(wager,commits.get(id)!);continue;}
  if(event.type==='refund'){pot=Math.max(0,pot-amount);continue;}
  if(event.type!=='action'||!event.action)continue;
  const es=event.street??street;if(es!==street){street=es;commits.clear();checked.clear();wager=0;raises=0;}
  const board=o.board.slice(0,es==='flop'?3:es==='turn'?4:es==='river'||es==='complete'?5:0),facing=Math.max(0,wager-(commits.get(id)??0));
  const additional=event.action.type==='raise'?Math.max(0,event.action.to-(commits.get(id)??0)):amount;
  results.push({event,board,raises,size:additional/Math.max(o.bigBlind,pot),facing,pot,checked:checked.has(id),playersAtAction:active.size});
  if(event.action.type==='fold')active.delete(id);
  if(event.action.type==='check')checked.add(id);
  if(event.action.type==='raise'){wager=Math.max(wager,event.action.to);commits.set(id,event.action.to);raises++;}else if(event.action.type==='call')commits.set(id,(commits.get(id)??0)+amount);
  pot+=amount;
 }
 return results;
}
function likelihoods(o:BotObservation,seatId:number,b:Belief,e:Evidence,comboIndex:number):ActionMix{
 const m=combos[comboIndex].meta,act=e.event.action!.type;
 const observedPrice=act==='fold'||act==='call'?e.facing/Math.max(o.bigBlind,e.pot):e.size;
 const normalize=(fold:number,check:number,call:number,raise:number):ActionMix=>{
  // Reconstructed facing/free-check action family, not a second betting-legality engine.
  const facing=e.facing>0||act==='call';const f=facing?fold:.002,c=facing?call:0,k=facing?0:check,total=f+c+k+raise;
  return {fold:f/total,check:k/total,call:c/total,raise:raise/total};
 };
 if(!e.board.length){
  const position=preflopPosition(o,seatId),late=position==='BTN'?1:position==='CO'?.7:position==='SB'?.45:position==='BB'?.3:position==='MP'?.2:0;
  const seat=o.seats.find(s=>s.id===seatId)!,depth=clamp((seat.stack+seat.totalCommitted)/o.bigBlind,20,250);
  const speculative=m.speculative*clamp((depth-35)/165,-.1,1)*.07;
  const score=m.baseScore/100+speculative;
  const threshold=.71-late*.13-(b.vpip-.31)*.6-(o.seats.length<=3?.09:0)+e.raises*.105+Math.max(0,observedPrice-1)*.025;
  const enter=sigmoid((score-threshold)*12),premium=sigmoid((score-.88)*24);
  const aggressive=sigmoid((score-(threshold+.08))*15)*(.4+b.pfr*1.25)+premium*.3;
  const raise=clamp(aggressive*(e.raises>1?.65:1)+(1-enter)*(.016+b.aggression*.035)*(1+m.blocker)/(1+e.raises*1.8),.012,.98);
  const call=clamp(enter*(1-clamp(aggressive*.65))+.12*m.speculative*clamp((depth-30)/170),.015,.94);
  // A free big-blind check is weak evidence, not a voluntary preflop call.
  return normalize(clamp(1-enter,.015,.98),clamp(.95-aggressive*.45,.15,.98),call,raise);
 }
 const f=boardShapes(e.board)[comboIndex],multi=e.playersAtAction>2;
 const threat=clamp(observedPrice/2),value=sigmoid((f.strength-(.62+threat*.13+(multi?.035:0)))*15);
 const bluff=(.04+b.aggression*.17)*(1-value)*(e.board.length<5?.35+f.draw*.75:.25+f.blocker*.9)*(multi?.6:1);
 const raise=clamp((value*(.6+b.aggression*.36)+bluff)*(e.checked?(.5+f.strength*.5+f.draw*.15):1),.009,.98);
 const drawPrice=e.facing/Math.max(1,e.pot+e.facing),drawValue=e.board.length<5?f.draw*clamp(.6-drawPrice)*.8:0;
 const call=clamp(sigmoid((f.strength-(.42+threat*.17+(multi?.04:0)))*12)*(.84-value*.2)+drawValue,.012,.97);
 return normalize(clamp(1-sigmoid((f.strength-(.45+threat*.14))*11)-f.draw*.15,.012,.98),clamp(.91-value*(.39+b.aggression*.24)-bluff*.5,.08,.97),call,raise);
}
/** Independent diagnostic of a public action-family model; hypotheses only, never actual hole cards. */
export function publicActionLikelihoods(o:BotObservation,p:BotProfile,seatId:number,eventId:string,cards:[Card,Card]):ActionMix {
 const e=evidence(o).find(item=>item.event.id===eventId&&item.event.seatId===seatId);if(!e)throw new Error('Unknown public action.');
 const index=combos.findIndex(c=>c.cards.includes(cards[0])&&c.cards.includes(cards[1]));
 if(index<0||new Set(cards).size!==2||cards.some(c=>o.ownCards.includes(c)||o.board.includes(c)))throw new Error('Hypothesis conflicts with known cards.');
 return likelihoods(o,seatId,belief(o,p,seatId),e,index);
}
function infer(o:BotObservation,p:BotProfile,seatId:number,dead:Set<Card>,events:Evidence[]):InternalRange {
 const b=belief(o,p,seatId),indices=combos.flatMap((c,i)=>c.cards.some(card=>dead.has(card))?[]:[i]);
 const n=indices.length,weights=new Float64Array(n).fill(1/n),updates:OpponentRange['updates']=[];const relevant=events.filter(e=>e.event.seatId===seatId);
 for(const e of relevant){let total=0;for(let i=0;i<n;i++){weights[i]*=Math.pow(likelihoods(o,seatId,b,e,indices[i])[e.event.action!.type],.82+.12*b.confidence);total+=weights[i];}
  // Explicit contamination component: unmodeled mistakes/traps survive every update.
  const contamination=.025+.035*(1-b.confidence);for(let i=0;i<n;i++)weights[i]=(1-contamination)*weights[i]/total+contamination/n;
  let squares=0,premium=0;for(let i=0;i<n;i++){squares+=weights[i]**2;if(combos[indices[i]].meta.baseScore>=90)premium+=weights[i];}
  updates.push({eventId:e.event.id,street:e.event.street??'preflop',action:e.event.action!.type,effectiveCombos:1/squares,premiumMass:premium});
 }
 let premium=0,strong=0,draw=0,mean=0,nuts=0,squares=0,fold=0;const features=boardShapes(o.board);
 const weighted:WeightedCombo[]=indices.map((index,i)=>{const c=combos[index],f=features[index],w=weights[i];if(c.meta.baseScore>=90)premium+=w;if(f.strong)strong+=w;if(f.draw>=.5)draw+=w;mean+=w*f.strength;if(f.strength>=.9)nuts+=w;squares+=w*w;
  // Probability of folding to a half-pot probe, calibrated only as synthetic context.
  fold+=w*clamp((1-sigmoid((f.strength-.46)*11)-f.draw*.25)*(.65+b.fold),.025,.94);
  return {cards:[...c.cards] as [Card,Card],weight:w};});
 const uncertainty=clamp(.65-.27*b.confidence-.04*Math.min(4,relevant.length),.22,.85);
 return {range:{seatId,combos:weighted,observedActions:relevant.length,effectiveCombos:1/squares,uncertainty,priorSource:b.source,premiumMass:premium,strongMadeMass:strong,drawMass:draw,updates},strength:mean,nutMass:nuts,foldChance:fold};
}
function hashSeed(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function randomStream(seed:number){let n=seed;return()=>{n=(n+0x6d2b79f5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function cumulative(range:OpponentRange){let sum=0;return range.combos.map(c=>(sum+=c.weight));}
function pick(cdf:number[],u:number){let lo=0,hi=cdf.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<u)lo=mid+1;else hi=mid;}return lo;}
function sampleEquity(o:BotObservation,ranges:OpponentRange[],seed:number){
 const wanted=ranges.length<=1?96:ranges.length<=3?72:48,random=randomStream(seed),cdfs=ranges.map(cumulative);
 let samples=0,total=0,squares=0,attempts=0;const maxAttempts=wanted*150;
 while(samples<wanted&&attempts++<maxAttempts){
  const used=new Set([...o.ownCards,...o.board]),holes:Card[][]=[];let compatible=true;
  // Reject the entire independent product draw on a collision. Sequential conditional
  // sampling would bias early seats. Accepted tuples sample product weights | disjoint.
  for(let i=0;i<ranges.length;i++){const cards=ranges[i].combos[pick(cdfs[i],random())].cards;if(cards.some(c=>used.has(c))){compatible=false;break;}cards.forEach(c=>used.add(c));holes.push(cards);}
  if(!compatible)continue;
  const board=[...o.board],remaining=DECK.filter(c=>!used.has(c));
  while(board.length<5){const index=Math.floor(random()*remaining.length);board.push(remaining[index]);remaining[index]=remaining.at(-1)!;remaining.pop();}
  const own=evaluate([...o.ownCards,...board]);let tied=1,beaten=false;
  for(const cards of holes){const comparison=compareRanks(evaluate([...cards,...board]),own);if(comparison>0){beaten=true;break;}if(comparison===0)tied++;}
  const share=beaten?0:1/tied;total+=share;squares+=share*share;samples++;
 }
 const equity=samples?total/samples:1/(ranges.length+1),variance=samples>1?Math.max(0,(squares-total*total/samples)/(samples-1)):0;
 return {equity,samples,standardError:samples>1?Math.sqrt(variance/samples):.5,limited:samples<wanted};
}
function canonical(o:BotObservation,p:BotProfile){
 const index=o.seats.findIndex(s=>s.id===o.button),ordered=[...o.seats.slice(index),...o.seats.slice(0,index)],ids=new Map(ordered.map((s,i)=>[s.id,i]));
 const publicKey={own:[...o.ownCards].sort(),board:o.board,street:o.street,actor:ids.get(o.actingSeat),pot:o.pot,bb:o.bigBlind,seats:ordered.map(s=>[s.stack,s.streetCommitted,s.totalCommitted,s.folded,s.allIn]),events:o.publicEvents.map(e=>[e.type,e.seatId===undefined?null:ids.get(e.seatId),e.street,e.amount,e.action?.type,e.action?.type==='raise'?e.action.to:null]),memory:o.memory?.opponents.map(m=>[ids.get(m.seatId),m.vpip.count,m.vpip.opportunities,m.pfr.count,m.pfr.opportunities,m.aggression.count,m.aggression.opportunities,m.foldToBet.count,m.foldToBet.opportunities]).sort((a,b)=>(a[0]??0)-(b[0]??0)),environment:p.environment,adaptation:o.memory?.opponents.length?p.traits?.adaptation:0};
 // Common random numbers across nearby price/stack/memory hypotheses: a one-cent
 // change must update posterior weights, not redraw every equity trial. Hidden
 // cards and identities never enter this stream. The FULL priced public state
 // remains the cache key, so distinct posteriors are still recomputed.
 const equityStream={own:publicKey.own,board:publicKey.board,street:publicKey.street,actor:publicKey.actor,seats:ordered.map(s=>ids.get(s.id)),line:o.publicEvents.map(e=>[e.type,e.seatId===undefined?null:ids.get(e.seatId),e.street,e.action?.type])};
 return {seedKey:JSON.stringify(equityStream),cacheKey:JSON.stringify([publicKey,o.seats.map(s=>s.id),o.publicEvents.map(e=>e.id)])};
}
function freeze(analysis:RangeAnalysis):RangeAnalysis {for(const r of [...analysis.opponents,...(analysis.foldedOpponents??[])]){for(const c of r.combos){Object.freeze(c.cards);Object.freeze(c);}Object.freeze(r.combos);for(const u of r.updates)Object.freeze(u);Object.freeze(r.updates);Object.freeze(r);}Object.freeze(analysis.opponents);Object.freeze(analysis.foldedOpponents);Object.freeze(analysis.assumptions);return Object.freeze(analysis);}
/** Full public posterior + bounded joint equity. Pure, deterministic, immutable cached result. */
export function analyzeRanges(o:BotObservation,p:BotProfile):RangeAnalysis {
 if(o.ownCards.length!==2||new Set([...o.ownCards,...o.board]).size!==o.ownCards.length+o.board.length)throw new Error('Range inference requires unique known cards.');
 const keys=canonical(o,p),hit=analysisCache.get(keys.cacheKey);if(hit)return hit;
 const dead=new Set([...o.ownCards,...o.board]),events=evidence(o),buttonIndex=o.seats.findIndex(s=>s.id===o.button),ordered=[...o.seats.slice(buttonIndex),...o.seats.slice(0,buttonIndex)];
 const active=ordered.filter(s=>s.id!==o.actingSeat&&!s.folded),inferred=active.map(s=>infer(o,p,s.id,dead,events));
 const foldedOpponents=ordered.filter(s=>s.id!==o.actingSeat&&s.folded).map(s=>infer(o,p,s.id,dead,events).range);
 const ownPublic=infer(o,p,o.actingSeat,new Set(o.board),events),ranges=inferred.map(r=>r.range);
 const sampled=ranges.length?sampleEquity(o,ranges,hashSeed(keys.seedKey)):{equity:1,samples:0,standardError:0,limited:false};
 const strength=inferred.length?inferred.reduce((n,r)=>n+r.strength,0)/inferred.length:ownPublic.strength,nuts=inferred.length?inferred.reduce((n,r)=>n+r.nutMass,0)/inferred.length:ownPublic.nutMass;
 const foldEquity=active.some(s=>s.allIn)?0:inferred.reduce((n,r)=>n*r.foldChance,1);
 const assumptions=['Synthetic likelihoods with a nonzero contamination floor; not measured human or solver ranges.','Uniform dealt-card prior; position, depth and shrunk public observations condition action likelihoods.','Range/nut advantages compare public-line model strength and strong-tail proxies, not solved strategy ranges.','Equity is a joint compatible-range showdown share including ties; excludes rake, side-pot eligibility and future betting EV.','Fold equity assumes a half-pot probe and independent fold responses; correlated multiway responses are not modeled.'];
 if(sampled.limited)assumptions.push('Joint compatibility rejection reached its bounded attempt limit; fewer equity samples, never hidden-card fallback.');
 const result:RangeAnalysis={modelVersion:RANGE_MODEL_VERSION,opponents:ranges,foldedOpponents,equity:sampled.equity,equitySamples:sampled.samples,equityStdError:sampled.standardError,rangeAdvantage:clamp(ownPublic.strength-strength,-1,1),nutAdvantage:clamp(ownPublic.nutMass-nuts,-1,1),foldEquity,uncertainty:sampled.limited?.95:inferred.length?inferred.reduce((n,r)=>n+r.range.uncertainty,0)/inferred.length:0,assumptions};
 return putBounded(analysisCache,keys.cacheKey,freeze(result));
}
