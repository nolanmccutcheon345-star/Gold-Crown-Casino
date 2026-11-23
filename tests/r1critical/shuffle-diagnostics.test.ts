import {describe,expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {secureDeck,secureIndex,standardDeck} from '../../src/core/deck';

function interval(successes:number,total:number) {
 const p=successes/total,z=1.96,d=1+z*z/total,c=(p+z*z/(2*total))/d,h=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/d;
 return {successes,total,rate:p,wilson95:[c-h,c+h]};
}

describe('R1 production shuffle diagnostics, not a cryptographic certification',()=>{
 it('V401: rejection sampling excludes the modulo-biased tail, including the largest valid bound',()=>{
  const words=[0xffffffff,0xfffffffe,0xfffffffd,0xfffffffc,51],seen:number[]=[];
  vi.stubGlobal('crypto',{getRandomValues:(target:Uint32Array)=>{const value=words.shift()!;seen.push(value);target[0]=value;return target;}});
  try{expect(secureIndex(52)).toBe(51);expect(seen).toHaveLength(5);}finally{vi.unstubAllGlobals();}
  vi.stubGlobal('crypto',{getRandomValues:(target:Uint32Array)=>{target[0]=0xffffffff;return target;}});
  try{expect(secureIndex(0x100000000)).toBe(0xffffffff);}finally{vi.unstubAllGlobals();}
  for(const bound of [0,-1,1.5,NaN,Infinity,0x100000001])expect(()=>secureIndex(bound)).toThrow();
 });

 it('A02/V401: 100,000 actual CSPRNG shuffles have unique cards and no gross position or consecutive-deal anomaly',()=>{
  const samples=100000,cards=standardDeck(),indices=new Map(cards.map((card,index)=>[card,index]));
  const counts=Array.from({length:52},()=>Array(52).fill(0) as number[]);
  let firstTwoSameSuit=0,firstTwoSameRank=0,successiveFirstRepeat=0,previous='';const started=Date.now();
  for(let n=0;n<samples;n++){
   const deck=secureDeck();
   if(deck.length!==52||new Set(deck).size!==52||deck.some(card=>!indices.has(card)))throw new Error(`Invalid production deck at sample ${n}`);
   for(let position=0;position<52;position++)counts[position][indices.get(deck[position])!]++;
   firstTwoSameSuit+=Number(deck[0][1]===deck[1][1]);firstTwoSameRank+=Number(deck[0][0]===deck[1][0]);
   if(n>0)successiveFirstRepeat+=Number(deck[0]===previous);previous=deck[0];
  }
  const expected=samples/52,sd=Math.sqrt(samples/52*51/52),cells=counts.flat();
  const maxAbsoluteMarginalZ=Math.max(...cells.map(n=>Math.abs(n-expected)/sd));
  const pearsonPositionStatistic=cells.reduce((sum,n)=>sum+(n-expected)**2/expected,0);
  const comparison=(observed:number,total:number,p:number)=>({...interval(observed,total),nullProbability:p,z:(observed-total*p)/Math.sqrt(total*p*(1-p))});
  const diagnostics={samples,generatedAt:new Date().toISOString(),elapsedMs:Date.now()-started,source:'src/core/deck.ts secureDeck using Node Web Crypto getRandomValues; no seeded substitute',
   uniquenessFailures:0,expectedCountPerCardPosition:expected,positionCounts:counts,maxAbsoluteMarginalZ,pearsonPositionStatistic,
   firstTwoSameSuit:comparison(firstTwoSameSuit,samples,12/51),firstTwoSameRank:comparison(firstTwoSameRank,samples,3/51),successiveFirstRepeat:comparison(successiveFirstRepeat,samples-1,1/52),
   interpretation:'Screening diagnostics only: 2,704 dependent card-position cells, plus three predeclared binary checks. An eight-standard-deviation gross-anomaly alarm is deliberately conservative; no claim of cryptographic proof or complete independence. Wilson intervals describe each marginal only. Production uses rejection-sampled Fisher-Yates and fails closed without CSPRNG.'};
  const directory=process.env.R1_EVIDENCE_DIR;
  if(directory){mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/shuffle-diagnostics.json`,JSON.stringify(diagnostics,null,2)+'\n');}
  console.info('R1 shuffle diagnostics',JSON.stringify({...diagnostics,positionCounts:undefined}));
  expect(maxAbsoluteMarginalZ).toBeLessThan(8);
  for(const check of [diagnostics.firstTwoSameSuit,diagnostics.firstTwoSameRank,diagnostics.successiveFirstRepeat])expect(Math.abs(check.z)).toBeLessThan(8);
 },120000);
});
