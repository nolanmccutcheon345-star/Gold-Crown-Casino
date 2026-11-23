import {describe,it,expect} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import type {Action,BotObservation,Card} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot} from '../../src/core/engine';
import {ARCHETYPES,analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {act,hand,rig} from '../verification/helpers';
import {scenarios,seededRandom,type Scenario} from '../step4a/scenarios';
const seeds=[0x5bd171,0x5bd293,0x5bd3b5,0x5bd4d7];
const actionKeys=['fold','check','call','raise'] as const;
type Counts=Record<typeof actionKeys[number],number>;
function field(count:number):Scenario {
 const own:Card[]=['2c','9d'],board:Card[]=['Ah','Kd','2s','7c','3d'],known=new Set([...own,...board]);
 const rest='23456789TJQKA'.split('').flatMap(r=>'cdhs'.split('').map(s=>r+s)).filter(c=>!known.has(c)),opening=9000/count;
 let g=rig(hand(Array(count).fill(45000+opening)),Array.from({length:count},(_,i)=>i===1?own:rest.splice(0,2)),board);
 g=act(g,{type:'raise',to:opening});while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});
 expect(g.pot).toBe(9000);expect(g.actor).toBe(1);expect(g.seats.every(s=>s.stack===45000)).toBe(true);
 while(g.actor!==0)g=act(g,{type:'check'});g=act(g,{type:'raise',to:3000});expect(g.actor).toBe(1);
 return{id:`matched-${count}-way`,label:'Weak-pair response at matched20% call price',state:g,notes:'Field/callers vary; same pot/board/own cards/stack and postflop OOP. Preflop physical labels differ.'};
}
function sizeBin(o:BotObservation,to:number){const raise=to-o.seats.find(s=>s.id===o.actingSeat)!.streetCommitted-o.legal.callAmount,ratio=raise/Math.max(1,o.pot+o.legal.callAmount);return ratio<.5?3:ratio<1?4:ratio<2?5:6;}
function joint(o:BotObservation,a:ReturnType<typeof analyzeDecision>){const out=[a.distribution.fold,a.distribution.check,a.distribution.call,0,0,0,0];for(const s of a.sizing)out[sizeBin(o,s.raiseTo)]+=a.distribution.raise*s.weight;expect(out.reduce((n,x)=>n+x,0)).toBeCloseTo(1,10);return out;}
function ci(count:number,n:number){const z=1.959963984540054,z2=z*z,p=count/n,den=1+z2/n,center=(p+z2/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;return[Math.max(0,center-half),Math.min(1,center+half)];}
function legal(o:BotObservation,a:Action){if(a.type==='fold')expect(o.legal.fold).toBe(true);else if(a.type==='check')expect(o.legal.check).toBe(true);else if(a.type==='call')expect(o.legal.callAmount).toBeGreaterThan(0);else if(a.type==='raise'){expect(o.legal.canRaise).toBe(true);expect(Number.isInteger(a.to)).toBe(true);expect(a.to).toBeLessThanOrEqual(o.legal.maxRaiseTo!);expect(a.to>=o.legal.minRaiseTo!||a.to===o.legal.shortAllInTo).toBe(true);}}
describe('V433/Y01 preregistered functional archetype diversity',()=>{
 it('all28 pairs differ across multiple unchanged public-context strata at declared thresholds',()=>{
  const contexts=[...scenarios(),...[2,3,6,9,10].map(field)],rows:Record<string,unknown>[]=[],mixtures=new Map<string,{street:string;mix:number[]}[]>();let draws=0,applied=0;
  const actions=new Map<string,Counts>();
  for(const archetype of ARCHETYPES){
   const mixes:{street:string;mix:number[]}[]=[];mixtures.set(archetype,mixes);
   for(const seed of seeds){const p=createProfile({selection:archetype},seed,'neutral');
    for(const [contextIndex,context]of contexts.entries()){
     const g=context.state,o=observeBot(g,g.actor!,p.policyVersion,`diversity:${context.id}:${seed}`),a=analyzeDecision(o,p),mix=joint(o,a),count:Counts={fold:0,check:0,call:0,raise:0},sizeCounts:Record<string,number>={},seen=new Set<string>();mixes.push({street:g.street,mix});
     for(let draw=0;draw<128;draw++){const d=chooseDecision(o,p,seededRandom(seed^0x5bd00000^Math.imul(contextIndex+1,65537)^draw));legal(o,d.action);count[d.action.type]++;draws++;if(d.action.type==='raise')sizeCounts[d.action.to]=(sizeCounts[d.action.to]??0)+1;const key=JSON.stringify(d.action);if(!seen.has(key)){seen.add(key);assertAccounting(applyCommand(g,d));applied++;}}
     const aggregate=actions.get(`${archetype}:${context.id}`)??{fold:0,check:0,call:0,raise:0};for(const key of actionKeys)aggregate[key]+=count[key];actions.set(`${archetype}:${context.id}`,aggregate);
     rows.push({archetype,personalitySeed:seed,scenario:context.id,street:g.street,seats:g.seats.length,own:o.ownCards,board:o.board,publicEvents:o.publicEvents,legal:o.legal,pot:o.pot,contextNotes:context.notes,exactActionDistribution:a.distribution,exactJointActionSize:mix,conditionalSizeChoices:a.sizing,opportunities:128,sampledActions:count,sampledRaiseSizes:sizeCounts,conditionalMonteCarloWilson95:Object.fromEntries(actionKeys.map(key=>[key,ci(count[key],128)]))});
    }
   }
  }
  const pairs=[];
  for(let left=0;left<ARCHETYPES.length;left++)for(let right=left+1;right<ARCHETYPES.length;right++){
   const a=mixtures.get(ARCHETYPES[left])!,b=mixtures.get(ARCHETYPES[right])!,strata:Record<string,{sum:number;n:number}>={};let total=0;
   a.forEach((x,i)=>{const tv=x.mix.reduce((n,p,k)=>n+Math.abs(p-b[i].mix[k]),0)/2;total+=tv;const s=strata[x.street]??={sum:0,n:0};s.sum+=tv;s.n++;});
   const byStreet=Object.fromEntries(Object.entries(strata).map(([street,s])=>[street,s.sum/s.n])),mean=total/a.length;const pass=mean>=.025&&Object.values(byStreet).filter(n=>n>=.015).length>=2;
   pairs.push({left:ARCHETYPES[left],right:ARCHETYPES[right],meanJointTotalVariation:mean,byStreet,pass});
  }
  const rate=(archetype:string,id:string,kind:'raise'|'continue')=>{const c=actions.get(`${archetype}:${id}`)!;return(kind==='raise'?c.raise:c.call+c.raise)/512;};
  const directions=[{name:'station weak-pair continue exceeds nit',left:rate('station','flop-marginal-cheap','continue'),right:rate('nit','flop-marginal-cheap','continue')},{name:'station draw continue exceeds nit',left:rate('station','flop-flushdraw','continue'),right:rate('nit','flop-flushdraw','continue')},{name:'maniac air raise exceeds station',left:rate('maniac','heads-up-air','raise'),right:rate('station','heads-up-air','raise')},{name:'TAG unopened AA raise exceeds station',left:rate('tag','unopened-aa','raise'),right:rate('station','unopened-aa','raise')}];
  const dir=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(dir,{recursive:true});const metadata={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeBase:'e08e8b0',policyVersion:POLICY_VERSION,node:process.version,at:new Date().toISOString(),protocolCommit:'48212a1',protocolSha256:createHash('sha256').update(readFileSync('tests/step5b-acceptance/DIVERSITY_PROTOCOL.md')).digest('hex'),population:'All8 current archetypes,4 fixed personality seeds,37 actual legal contexts,128 paired action draws each',draws,appliedDistinctLegalProposals:applied,thresholds:{meanJointTV:.025,atLeastTwoStreetTV:.015},uncertainty:'Conditional Monte Carlo Wilson intervals only; repeated context/personality samples are not independent human opportunities. No human calibration, expert/solver claim or simultaneous-family confidence. Consumed development contexts, not an unseen strategic holdout.'};
  writeFileSync(resolve(dir,'archetype-diversity.json'),JSON.stringify({...metadata,pairs,directions,rows},null,2));
  expect(draws).toBe(8*4*37*128);expect(pairs).toHaveLength(28);expect(pairs.filter(p=>!p.pass)).toEqual([]);expect(directions.filter(d=>d.left<=d.right)).toEqual([]);
 },120000);
});
