import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {setImmediate} from 'node:timers/promises';
import type {BotObservation,BotProfile} from '../../src/contracts';
import type {DecisionAnalysis} from '../../src/bots/strategy';
import {evaluate,compareRanks} from '../../src/core/evaluator';
import {DECK} from './reference';

it('independently enumerates all river cards for the original thirty weighted turn posteriors',async()=>{
 const source=JSON.parse(gunzipSync(readFileSync('tests/step5a-bots/evidence/original-thirty.json.gz')).toString()) as {handId:string;observation:BotObservation;analysis:DecisionAnalysis;profile:BotProfile}[];
 const result=[];
 for(const row of source){
  const o=row.observation,a=row.analysis;expect(o.street).toBe('turn');expect(a.ranges!.opponents).toHaveLength(1);
  const available=DECK.filter(c=>![...o.ownCards,...o.board].includes(c));const ownRanks=new Map(available.map(r=>[r,evaluate([...o.ownCards,...o.board,r])]));let weighted=0,totalWeight=0,trials=0;
  for(const combo of a.ranges!.opponents[0].combos){let share=0,n=0;for(const river of available.filter(c=>!combo.cards.includes(c))){const board=[...o.board,river],cmp=compareRanks(ownRanks.get(river)!,evaluate([...combo.cards,...board]));share+=cmp>0?1:cmp===0?.5:0;n++;}weighted+=combo.weight*share/n;totalWeight+=combo.weight;trials+=n;}
  const exact=weighted/totalWeight,t=row.profile.traits!,c=a.context,threat=a.postflop!.textureCaution+Math.min(.15,Math.max(0,c.betToPot-.6)*t.sizeSensitivity*.035)+Math.max(0,c.raisesThisStreet-1)*.025*row.profile.skill!;
  const riskPremium=.008+(1-t.riskTolerance)*.025+Math.max(0,c.activePlayers-2)*t.multiwayCaution*.012+threat;
  const curiosity=a.memoryAdjustment.call*.4,netPot=a.postflop!.contestableAfterCall!-a.postflop!.estimatedRake!,call=o.legal.callAmount;
  result.push({handId:row.handId,exactModelEquity:exact,sampledEquity:a.ranges!.equity,sampledSE:a.ranges!.equityStdError,weightedComboCount:a.ranges!.opponents[0].combos.length,riverTrials:trials,call,netContestablePot:netPot,exactModelConditionalCallEV:exact*netPot-call,price:a.postflop!.rakeAdjustedPrice,realizedEquity:a.postflop!.realizedEquity,riskPremium,curiosity,decisionNetEquity:a.postflop!.realizedEquity-a.postflop!.rakeAdjustedPrice-riskPremium+curiosity,continue:1-a.distribution.fold});
  await setImmediate();
 }
 expect(result).toHaveLength(30);expect(result.every(r=>Number.isFinite(r.exactModelConditionalCallEV))).toBe(true);
 if(process.env.STEP5A_POSTERIOR==='1')writeFileSync('tests/step5a-bots/evidence/exact-original-posteriors.json',JSON.stringify(result,null,2));
},120000);
