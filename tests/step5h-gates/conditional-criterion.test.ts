import {beforeAll,describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Action,Archetype,Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';

const identitySeeds=[0x5eca91,0x5eca91+101,0x5eca91+202,0x5eca91+303];
const trialsPerIdentity=128;
const rows:Record<string,ReturnType<typeof measure>>={};
function act(g:GameState,action:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`public-prefix:${g.revision}`,action});}
function river(){
 let g=rig(startHand({handId:'5h:F08:weak-pair',button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`Seat ${id}`,stack:30000}))}),[['9d','8c'],['Ah','Ad']],['Jh','9s','2c','3d','Ks']);
 g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});
 while(g.street!=='river')g=act(g,{type:'check'});
 expect(g.actor).toBe(1);expect(g.pot).toBe(2000);g=act(g,{type:'raise',to:1000});expect(g.actor).toBe(0);return g;
}
function preflop(node:'unopened'|'facing-open',own:Card[]){
 const holes:Card[][]=[['3d','4c'],['5d','6c'],['8d','9c'],['Qh','Qs'],['Jd','Jc'],['Td','Tc']];holes[node==='unopened'?3:4]=own;
 let g=rig(startHand({handId:`5h:F09:${node}`,button:0,profile:practiceProfile(),seats:holes.map((_,id)=>({id,name:`Seat ${id}`,stack:30000}))}),holes,['2c','9h','8s','3c','6h']);
 if(node==='facing-open')g=act(g,{type:'raise',to:600});return g;
}
function interval(count:number,total:number){const z=1.959963984540054,p=count/total,den=1+z*z/total,mid=(p+z*z/(2*total))/den,half=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den;return[mid-half,mid+half];}
function measure(g:GameState,archetype:Archetype){
 const row={archetype,policyVersion:POLICY_VERSION,opportunities:0,calls:0,folds:0,raises:0,ownCards:[...g.seats.find(s=>s.id===g.actor)!.hole],legal:legalActions(g),publicState:{handId:g.handId,revision:g.revision,street:g.street,board:g.board,pot:g.pot,button:g.button,events:g.events,profile:g.profile},identities:[] as {seed:number;distribution:ReturnType<typeof analyzeDecision>['distribution'];range:unknown}[],raiseInterval95:[] as number[],callInterval95:[] as number[]};
 for(const seed of identitySeeds){
  const p=createProfile({selection:archetype},seed,'neutral'),o=observeBot(g,g.actor!,p.policyVersion,`paired:${seed}`);o.rake=g.profile.rake;
  const a=analyzeDecision(o,p);row.identities.push({seed,distribution:a.distribution,range:a.ranges?{modelVersion:a.ranges.modelVersion,equity:a.ranges.equity,uncertainty:a.ranges.uncertainty,opponents:a.ranges.opponents.map(x=>({seatId:x.seatId,observedActions:x.observedActions,updates:x.updates,effectiveCombos:x.effectiveCombos}))}:null});
  for(let trial=0;trial<trialsPerIdentity;trial++){
   const d=chooseDecision(o,p,seededRandom(0x5e5eed^seed^trial));row.opportunities++;row.calls+=Number(d.action.type==='call');row.folds+=Number(d.action.type==='fold');row.raises+=Number(d.action.type==='raise');assertAccounting(applyCommand(g,d));
  }
 }
 row.raiseInterval95=interval(row.raises,row.opportunities);row.callInterval95=interval(row.calls,row.opportunities);return row;
}
beforeAll(()=>{
 const g=river();rows.station=measure(g,'station');rows.tag=measure(g,'tag');
 for(const node of ['unopened','facing-open'] as const)for(const [label,cards] of [['premium',['As','Ad']],['broadway',['Kh','Ts']],['weak',['7h','2d']]] as const)for(const a of ['maniac','nit'] as const)rows[`${node}:${label}:${a}`]=measure(preflop(node,[...cards]),a);
 const out=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5h-gates/evidence');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'step5h-conditional-results.json'),JSON.stringify({kind:'Synthetic functional contrast; not expert assessment, human calibration or solver verification',policyVersion:POLICY_VERSION,identitySeeds,trialsPerIdentity,method:'Each row has512 legal decision opportunities:4 stable identities times128 paired action streams. Wilson intervals describe Monte Carlo action sampling within these fixed synthetic contexts, not human-population uncertainty. No minimum calling quota or policy edit. Exact actor cards and public prefixes are test-only diagnostics.',rows},null,2));
},120000);
describe('Step5H original F08/F09 missing clauses on independent legal prefixes',()=>{
 it('F08: station calls the weak pair more often than the actual TAG, which evaluates the public river range and can fold',()=>{
  expect(rows.station.opportunities).toBe(512);expect(rows.tag.opportunities).toBe(512);expect(rows.station.calls).toBeGreaterThan(rows.tag.calls);expect(rows.tag.folds).toBeGreaterThan(0);
  for(const identity of rows.tag.identities){const range=identity.range as {modelVersion:string;equity:number;opponents:{observedActions:number;updates:unknown[]}[]};expect(range.modelVersion).toBeTruthy();expect(range.equity).toBeGreaterThanOrEqual(0);expect(range.equity).toBeLessThanOrEqual(1);expect(range.opponents).toHaveLength(1);expect(range.opponents[0].observedActions).toBeGreaterThan(0);expect(range.opponents[0].updates.length).toBeGreaterThan(0);}
 });
 it('F09: maniac raises more than nit at identical broadway open and 3bet opportunities, with every action accepted by the engine',()=>{
  for(const node of ['unopened','facing-open']){const a=rows[`${node}:broadway:maniac`],b=rows[`${node}:broadway:nit`];expect(a.opportunities).toBe(512);expect(a.raises).toBeGreaterThan(b.raises);expect(a.legal.canRaise).toBe(true);expect(a.legal.minRaiseTo).not.toBeNull();}
 });
 it('F09: both personalities depend on their own private cards with identical public state and paired random streams',()=>{
  for(const node of ['unopened','facing-open'] as const){
   const strong=preflop(node,['As','Ad']),weak=preflop(node,['7h','2d']);
   for(const archetype of ['maniac','nit'] as const){
    for(const seed of identitySeeds){const p=createProfile({selection:archetype},seed,'neutral'),a=observeBot(strong,strong.actor!,p.policyVersion,'matched-private'),b=observeBot(weak,weak.actor!,p.policyVersion,'matched-private');const {ownCards:ownA,...publicA}=a,{ownCards:ownB,...publicB}=b;expect(publicA).toEqual(publicB);expect(ownA).not.toEqual(ownB);expect(analyzeDecision(a,p).distribution).not.toEqual(analyzeDecision(b,p).distribution);}
    expect(rows[`${node}:premium:${archetype}`].raises).toBeGreaterThan(rows[`${node}:weak:${archetype}`].raises);
   }
  }
 });
});
