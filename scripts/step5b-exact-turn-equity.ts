import {readFileSync,writeFileSync} from 'node:fs';
import {evaluate,compareRanks} from '../src/core/evaluator';
const source='tests/step5b-performance/evidence/price-investigation/baseline/inputs.json';
const input=JSON.parse(readFileSync(source,'utf8')) as {rows:{kind:string;street:string;potFraction:number;ownCards:string[];board:string[];range:{equity:number;equityStdError:number;combos:{cards:string[];weight:number}[]}}[]},output=[];
for(const kind of ['oesd','combo']){
 const rows=input.rows.filter(r=>r.kind===kind&&r.street==='turn'&&[.5,.75].includes(r.potFraction)),reference=rows[0],unseen=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>![...reference.ownCards,...reference.board].includes(c));
 const ownRank=new Map(unseen.map(river=>[river,evaluate([...reference.ownCards,...reference.board,river])])),equityByCombo=new Map<string,number>();let evaluations=0;
 for(const combo of reference.range.combos){let share=0,n=0;for(const river of unseen){if(combo.cards.includes(river))continue;const comparison=compareRanks(ownRank.get(river)!,evaluate([...combo.cards,...reference.board,river]));share+=comparison>0?1:comparison===0?.5:0;n++;evaluations++;}equityByCombo.set(combo.cards.join(''),share/n);}
 for(const r of rows){const exact=r.range.combos.reduce((sum,c)=>sum+c.weight*equityByCombo.get(c.cards.join(''))!,0);output.push({kind,potFraction:r.potFraction,exactWeightedShowdownEquity:exact,old96TrialEquity:r.range.equity,oldStandardError:r.range.equityStdError,weightedCombos:r.range.combos.length,terminalOpponentEvaluations:evaluations});}
}
writeFileSync('tests/step5b-performance/evidence/price-investigation/exact-turn-equity.json',JSON.stringify({method:'Independent exhaustive weighted heads-up turn river enumeration over every legal opponent combo and remaining river. Uses authoritative hand evaluator (already independently PokerKit-tested), NOT production MonteCarlo sampler. Exact for supplied synthetic range, not proof that the range models humans or that equity is decisionEV.',source,output},null,2));console.log(JSON.stringify(output,null,2));
