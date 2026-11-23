import type {Action,Card,GameState} from '../../src/contracts';
/** Test-only independent evaluator. Never imports production evaluator/ranges. */
export function five(cards:Card[]):number[]{
 const values=cards.map(c=>'23456789TJQKA'.indexOf(c[0])+2).sort((a,b)=>b-a),counts=new Map<number,number>();for(const r of values)counts.set(r,(counts.get(r)??0)+1);
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),unique=[...counts.keys()].sort((a,b)=>b-a),flush=cards.every(c=>c[1]===cards[0][1]);let straight=0;
 if(unique.length===5){if(unique[0]-unique[4]===4)straight=unique[0];else if(unique.join(',')==='14,5,4,3,2')straight=5;}
 if(flush&&straight)return[8,straight];if(groups[0][1]===4)return[7,groups[0][0],groups[1][0]];if(groups[0][1]===3&&groups[1][1]===2)return[6,groups[0][0],groups[1][0]];
 if(flush)return[5,...values];if(straight)return[4,straight];if(groups[0][1]===3)return[3,groups[0][0],...groups.slice(1).map(g=>g[0])];
 if(groups[0][1]===2&&groups[1][1]===2)return[2,Math.max(groups[0][0],groups[1][0]),Math.min(groups[0][0],groups[1][0]),groups[2][0]];
 if(groups[0][1]===2)return[1,groups[0][0],...groups.slice(1).map(g=>g[0])];return[0,...values];
}
export function compare(a:number[],b:number[]):number{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]??0)-(b[i]??0);if(d)return Math.sign(d);}return 0;}
export function seven(cards:Card[]):number[]{let best:number[]=[];for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const rank=five([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(compare(rank,best)>0)best=rank;}return best;}
export const RANGE_WEIGHTS={valueHeavy:[.1,.5,1,2,4,5,6,7,8],broad:[1,2,3,4,5,6,7,8,9],recreational:[2,6,5,4,3,3,3,3,3]};
export type RangeName=keyof typeof RANGE_WEIGHTS;
export function combos(board:Card[],own:Card[]){const known=new Set([...board,...own]),deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!known.has(c)),hero=seven([...board,...own]),rows=[];for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){const cards=[deck[i],deck[j]],rank=seven([...board,...cards]);rows.push({cards,rank,result:compare(hero,rank)});}return rows;}
export function utility(g:GameState,action:Action,range:RangeName,rows:ReturnType<typeof combos>):number{
 const me=g.seats.find(s=>s.id===g.actor)!,other=g.seats.find(s=>s.id!==g.actor)!,cost=Math.min(me.stack,g.currentBet-me.streetCommitted);
 if(action.type==='fold')return 0;
 const extra=action.type==='raise'?action.to-me.streetCommitted:action.type==='call'?cost:0,raise=action.type==='raise',opponentExtra=raise?Math.min(other.stack,Math.max(0,me.streetCommitted+extra-other.streetCommitted)):0;
 let total=0,weight=0;
 for(const row of rows){const w=RANGE_WEIGHTS[range][row.rank[0]],fraction=opponentExtra/Math.max(1,g.pot+extra);
  // Explicit synthetic response, independent of production parameters: strong
  // made hands always call; pair calls taper rapidly with price. No re-raises.
  const floor=[.02,.10,.35,.55,.8,.9,.97,1,1][row.rank[0]],ceiling=[.15,.75,.9,.98,1,1,1,1,1][row.rank[0]],calls=raise?Math.max(floor,ceiling-fraction*(row.rank[0]>=4?.1:.75)):1;
  const showdown=row.result>0?g.pot+opponentExtra:row.result===0?(g.pot+extra+opponentExtra)/2-extra:-extra;
  total+=w*((1-calls)*g.pot+calls*showdown);weight+=w;
 }
 return total/weight;
}
