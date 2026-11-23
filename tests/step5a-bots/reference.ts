import type {BotObservation,GameState,PublicMemoryHand} from '../../src/contracts';
import {evaluate,compareRanks} from '../../src/core/evaluator';
import {act,hand,rig,practiceProfile} from '../verification/helpers';
import {legalActions} from '../../src/core/engine';
export const DECK=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s));
export function fixture(own:string[],board:string[],street:'turn'|'river'='river',bet=800):GameState {
 const fillers=DECK.filter(c=>![...own,...board].includes(c)).slice(0,2),full=board.length===5?board:[...board,DECK.find(c=>![...own,...board,...fillers].includes(c))!];
 let g=rig(hand([20000,20000]),[fillers,own],full);
 g=act(g,{type:'call'});g=act(g,{type:'check'});
 while(g.street!==street){g=act(g,{type:'check'});g=act(g,{type:'check'});}
 g=act(g,{type:'check'});return act(g,{type:'raise',to:Math.min(bet,legalActions(g).maxRaiseTo!)});
}
/** Independent exact enumeration. Uses only exact rank evaluator and known-card exclusion. */
export function reference(o:BotObservation){
 const available=DECK.filter(c=>![...o.ownCards,...o.board].includes(c)),top=Math.max(...o.board.map(c=>'23456789TJQKA'.indexOf(c[0])+2));
 const groups={value:{combos:0,share:0,trials:0},bluff:{combos:0,share:0,trials:0}};
 for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){
  const cards=[available[i],available[j]],rank=evaluate([...cards,...o.board]);
  const group=rank[0]>=2||rank[0]===1&&rank[1]===top?groups.value:rank[0]===0?groups.bluff:null;if(!group)continue;
  let sum=0,trials=0;
  for(const river of o.board.length===5?[null]:available.filter(c=>!cards.includes(c))){
   const b=river?[...o.board,river]:o.board,cmp=compareRanks(evaluate([...o.ownCards,...b]),evaluate([...cards,...b]));sum+=cmp>0?1:cmp===0?.5:0;trials++;
  }
  group.combos++;group.share+=sum/trials;group.trials+=trials;
 }
 const v=groups.value.share/groups.value.combos,b=groups.bluff.share/groups.bluff.combos;
 const call=o.legal.callAmount,total=o.pot+call,rake=o.rake?Math.min(o.rake.cap,Math.floor(total*o.rake.basisPoints/10000)):0;
 return {assumption:o.street==='river'?'Terminal call versus fixed polarized range.':'Check-down-after-call counterfactual: no future payments, folds or range changes.',groups,valueEquity:v,bluffEquity:b,call,total,rake,mixes:[.1,.4,.7].map(bluffMass=>({bluffMass,equity:v*(1-bluffMass)+b*bluffMass,callEV:(v*(1-bluffMass)+b*bluffMass)*(total-rake)-call}))};
}
export function observedHistories(mode:'value-heavy'|'mixed'|'overbluffing'):PublicMemoryHand[]{
 const out:PublicMemoryHand[]=[],frequency=mode==='value-heavy'?1:mode==='mixed'?4:9;
 for(let n=0;n<40;n++){
  const rules=practiceProfile();let g=rig(hand([20000,20000],0,rules),[mode==='overbluffing'||mode==='mixed'&&n%2===0?['Jc','Tc']:['Kc','Kd'],['Qc','Qd']],['Ks','9h','4c','2d','7s']);
  const id=`public-${mode}-${n}`;g.handId=id;g.events=g.events.map((e,i)=>({...e,id:`${id}:${i}`,handId:id}));
  g=act(g,{type:'call'});g=act(g,{type:'check'});
  while(g.street!=='complete'){
   g=act(g,{type:'check'});
   g=act(g,n%10<frequency?{type:'raise',to:Math.min(g.pot*2,legalActions(g).maxRaiseTo!)}:{type:'check'});
   if(g.actor!==null&&g.actor===1&&legalActions(g).callAmount>0)g=act(g,{type:'call'});
  }
  out.push({handId:id,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events});
 }
 return out;
}
