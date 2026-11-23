import {writeFileSync} from 'node:fs';
import {createProfile,analyzeDecision} from '../src/bots/policy';
import {observeBot} from '../src/core/engine';
import {hand,rig,act} from '../tests/verification/helpers';
const cases=[{id:'straight-jt',own:['Jc','Td'],board:['9h','8s','3c','2d','Ah']},{id:'combo-76',own:['7h','6h'],board:['5h','8h','Qc','2d','Ks']},{id:'gutshot-98',own:['9s','8d'],board:['6h','Tc','2s','Kd','4h']},{id:'nut-flush-a5',own:['Ad','5d'],board:['Kd','9d','2c','3h','Qs']}];
function fixture(c:typeof cases[number],street:string,price:number){const used=[...c.own,...c.board],other=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!used.includes(c));let g=rig(hand([100000,100000]),[c.own,other.slice(0,2)],c.board);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});while(g.street!==street)g=act(g,{type:'check'});return act(g,{type:'raise',to:Math.round(2000*price)});}
const rows=[];
for(const c of cases)for(const archetype of ['tag','stronger-reg'] as const)for(const seed of [17,193])for(const street of ['flop','turn'])for(const price of [.25,.5,.75,1,1.5]){
 const p=createProfile({selection:archetype},seed,'neutral'),g=fixture(c,street,price),h=fixture(c,street,price+.0005),a=analyzeDecision(observeBot(g,0,p.policyVersion,'low'),p),b=analyzeDecision(observeBot(h,0,p.policyVersion,'high'),p),totalVariation=a.ranges!.opponents[0].combos.reduce((sum,x,i)=>sum+Math.abs(x.weight-b.ranges!.opponents[0].combos[i].weight),0)/2;
 rows.push({id:c.id,archetype,seed,street,price,before:1-a.distribution.fold,after:1-b.distribution.fold,delta:a.distribution.fold-b.distribution.fold,totalVariation,oldEquity:a.ranges!.equity,newEquity:b.ranges!.equity});
}
rows.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));writeFileSync('tests/step5b-performance/evidence/price-investigation/tiny-changing-posterior.json',JSON.stringify({cases:rows.length,method:'Unasserted diagnostic of1cent price changes belowposterior saturation; fixed heldout card/profile inputs identical to above2pot tests. Tests genuine posterior changes separately from equal-posterior CRN guarantee.',rows},null,2));console.log(JSON.stringify(rows.slice(0,10),null,2));
