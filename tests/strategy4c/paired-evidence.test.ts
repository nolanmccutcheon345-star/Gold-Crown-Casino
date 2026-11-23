import {describe,expect,it} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {analyzeDecision,chooseDecision} from '../../src/bots/policy';
import {ARCHETYPES,defaultProfile,seedStream} from '../../src/bots/profiles';
import {analyzeDecision as previousAnalysis,chooseDecision as previousDecision} from '../../src/bots/v2/policy';
import {assertAccounting,applyCommand,projectView} from '../../src/core/engine';
import {observation,shortStackOverbet} from './fixtures';
function interval(k:number,n:number):[number,number]{const z=1.95996398454,z2=z*z,p=k/n,den=1+z2/n,mid=(p+z2/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;return [mid-half,mid+half];}
describe('paired fixed-scenario continuation audit: observed choices, not human frequencies',()=>{
 it('reduces the falsely cheap all-in continuation while preserving legal full-hand settlement for every profile',()=>{
  const state=shortStackOverbet(),current=observation(state),old={...structuredClone(current),policyVersion:'synthetic-cash-1.1.0'};
  const rows=ARCHETYPES.map((archetype,index)=>{
   const p=defaultProfile(archetype),prior={...structuredClone(p),policyVersion:'synthetic-cash-1.1.0'};
   const a=previousAnalysis(old,prior),b=analyzeDecision(current,p),n=256,drawSeed=0x4c530000+index;
   const trials:{seed:number;draw:number;before:string;after:string}[]=[];
   let before=0,after=0;const examples:Record<string,ReturnType<typeof projectView>>={};
   for(let i=0;i<n;i++){
    const seed=drawSeed+i*8,draw=seedStream(seed)();
    const left=previousDecision(old,prior,()=>draw),right=chooseDecision(current,p,()=>draw);
    before+=Number(left.action.type==='call');after+=Number(right.action.type==='call');
    for(const d of [left,right]){const settled=applyCommand(state,d);if(!examples[`${d.policyVersion}:${d.action.type}`])examples[`${d.policyVersion}:${d.action.type}`]=projectView(settled,0);assertAccounting(settled);expect(settled.street).toBe('complete');expect(settled.pot).toBe(0);expect(settled.seats.reduce((x,s)=>x+s.stack,0)+settled.rake).toBe(24000);}
    trials.push({seed,draw,before:left.action.type,after:right.action.type});
   }
   expect(b.context.price).toBe(.475);expect(a.context.price).toBe(3800/24000);
   expect(b.distribution.call).toBeLessThan(a.distribution.call);
   return {archetype,opportunities:n,personality:p,baseline:{version:prior.policyVersion,callCount:before,callRate:before/n,wilson95:interval(before,n),price:a.context.price,betToPot:a.context.betToPot,distribution:a.distribution,showdownShare:a.ranges?.equity},candidate:{version:p.policyVersion,callCount:after,callRate:after/n,wilson95:interval(after,n),price:b.context.price,betToPot:b.context.betToPot,distribution:b.distribution,showdownShare:b.ranges?.equity},trials,examples};
  });
  if(process.env.STEP4C_STRATEGY_REPORT){mkdirSync('tests/strategy4c/evidence',{recursive:true});writeFileSync('tests/strategy4c/evidence/paired-short-call.json',JSON.stringify({label:'Conditional synthetic probe, not population or human calibration',fixture:'4c-short-stack-overbet',ownCards:current.ownCards,publicBoard:current.board,policyProfile:'same numeric traits; only version changes',opportunity:'One legal all-in call/fold in the same public scenario per independent seeded action draw',sampleDesign:'Paired across versions; Wilson intervals are conditional Bernoulli Monte Carlo uncertainty, not session-cluster or model uncertainty',completeHands:rows.length*256*2,rows},null,2)+'\n');}
 });
});
