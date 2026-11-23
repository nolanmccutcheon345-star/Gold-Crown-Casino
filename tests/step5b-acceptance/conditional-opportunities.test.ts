import {beforeAll,describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Action,Archetype,Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,legalActions,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';
import {summarizeConditionalResponse,type ConditionalResponseEvidence} from '../../src/stats/conditional';

function action(g:GameState,a:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`prefix:${g.revision}`,action:a});}
function postflop(id:string,own:Card[],fraction:number,street:'flop'|'river'='flop'){
 const board=['Jh','9s','2c','3d','Ks'];let g=rig(startHand({handId:`5b-independent:${id}`,button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`Player ${id}`,stack:30000}))}),[own,['Ah','Ad']],board);
 g=action(g,{type:'raise',to:1000});g=action(g,{type:'call'});
 while(g.street!==street)g=action(g,{type:'check'});
 expect(g.actor).toBe(1);expect(g.pot).toBe(2000);g=action(g,{type:'raise',to:2000*fraction});expect(g.actor).toBe(0);return g;
}
function preflop(id:string,threeBet:boolean){
 let g=rig(startHand({handId:`5b-independent:${id}`,button:0,profile:practiceProfile(),seats:[0,1,2,3,4,5].map(id=>({id,name:`Player ${id}`,stack:30000}))}),[['2d','3c'],['4d','5c'],['6d','7c'],threeBet?['As','Ad']:['Kh','Ts'],threeBet?['Kh','Ts']:['As','Ad'],['Qd','Qc']],['Jh','9s','2c','3d','Ks']);
 if(threeBet)g=action(g,{type:'raise',to:600});return g;
}
interface Row{callEvidence:ConditionalResponseEvidence;defendEvidence:ConditionalResponseEvidence;scenario:string;archetype:Archetype;policyVersion:string;opportunities:number;calls:number;folds:number;raises:number;defends:number;rate:number;wilson95:[number,number];privateIdentitySeeds:number[];callProbability:number;defendProbability:number;state:Pick<GameState,'handId'|'profile'|'street'|'board'|'button'|'pot'|'events'>;ownCards:Card[];legal:ReturnType<typeof legalActions>;drawClass:string;diagnostics:unknown[];}
const rows:Row[]=[];
function interval(count:number,n:number):[number,number]{const z=1.959963984540054,p=count/n,den=1+z*z/n,mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return[mid-half,mid+half];}
function measure(scenario:string,g:GameState,archetype:Archetype){
 const row:Row={callEvidence:summarizeConditionalResponse(0,0),defendEvidence:summarizeConditionalResponse(0,0),scenario,archetype,policyVersion:POLICY_VERSION,opportunities:0,calls:0,folds:0,raises:0,defends:0,rate:0,wilson95:[0,1],privateIdentitySeeds:[],callProbability:0,defendProbability:0,state:{handId:g.handId,profile:g.profile,street:g.street,board:g.board,button:g.button,pot:g.pot,events:g.events},ownCards:[...g.seats.find(s=>s.id===g.actor)!.hole],legal:legalActions(g),drawClass:'',diagnostics:[]};
 for(let identity=0;identity<4;identity++){
  const seed=0x5bca00+identity*101;row.privateIdentitySeeds.push(seed);const p=createProfile({selection:archetype},seed,'neutral'),o=observeBot(g,g.actor!,p.policyVersion,`matched:${scenario}:${identity}`);o.rake=g.profile.rake;
  const analysis=analyzeDecision(o,p);row.callProbability+=analysis.distribution.call/4;row.defendProbability+=(1-analysis.distribution.fold)/4;row.drawClass=analysis.features.drawClass;row.diagnostics.push({seed,profile:p,features:analysis.features,context:analysis.context,distribution:analysis.distribution,postflop:analysis.postflop,rangeEquity:analysis.ranges?.equity,rangeUncertainty:analysis.ranges?.uncertainty});
  for(let draw=0;draw<128;draw++){
   const d=chooseDecision(o,p,seededRandom(0x51ead^draw^(identity*7919)));row.opportunities++;row.calls+=Number(d.action.type==='call');row.folds+=Number(d.action.type==='fold');row.raises+=Number(d.action.type==='raise');row.defends+=Number(d.action.type!=='fold');
   // Every sampled size is accepted by the authority and conserves chips.
   assertAccounting(applyCommand(g,d));
  }
 }
 row.callEvidence=summarizeConditionalResponse(row.calls,row.opportunities);row.defendEvidence=summarizeConditionalResponse(row.defends,row.opportunities);
 row.rate=row.defends/row.opportunities;row.wilson95=interval(row.defends,row.opportunities);rows.push(row);return row;
}
const find=(scenario:string,archetype:Archetype)=>rows.find(r=>r.scenario===scenario&&r.archetype===archetype)!;
beforeAll(()=>{
 const cheap=postflop('gutshot-25',['8c','7d'],.25),expensive=postflop('gutshot-175',['8c','7d'],1.75),oesd=postflop('oesd-25',['Tc','8d'],.25),air=postflop('air-50',['6c','4d'],.5),weakPair=postflop('river-pair-50',['9d','8c'],.5,'river'),topPair=postflop('top-pair-50',['Jd','8c'],.5),noPair=postflop('no-pair-50',['6c','4d'],.5);
 for(const a of ['nit','station','tag'] as const){measure('gutshot-25',cheap,a);measure('gutshot-175',expensive,a);measure('oesd-25',oesd,a);}
 for(const a of ['fit-or-fold','lag'] as const)measure('air-50',air,a);
 for(const a of ['station','stronger-reg'] as const)measure('river-pair-50',weakPair,a);
 measure('top-pair-50',topPair,'station');measure('no-pair-50',noPair,'station');
 for(const a of ['maniac','nit'] as const){measure('unopened',preflop('unopened',false),a);measure('facing-open',preflop('facing-open',true),a);}
 const output=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence');mkdirSync(output,{recursive:true});
 writeFileSync(resolve(output,'conditional-opportunities.json'),JSON.stringify({kind:'Synthetic functional contrasts only; not human calibration or solver verification',policyVersion:POLICY_VERSION,method:'512 actual legal decisions per row: 4 fixed personality identities ×128 paired decision seeds. Denominator is the fully specified eligible decision, not hands/VPIP. Wilson intervals describe pooled Monte Carlo draws conditional on these four synthetic identities; they are not human-population confidence intervals. Full public prefixes and allowed private actor cards retained.',rows},null,2));
},120000);
describe('Remaining V7 conditional opportunities on independent held-out legal prefixes',()=>{
 it('F02: station calls the naked gutshot facing25% pot more than nit',()=>{expect(find('gutshot-25','station').drawClass).toBe('gutshot');expect(find('gutshot-25','station').calls).toBeGreaterThan(find('gutshot-25','nit').calls);});
 it('F03: station and nit each call the same gutshot less facing175% than25% pot',()=>{for(const a of ['station','nit'] as const)expect(find('gutshot-175',a).calls).toBeLessThan(find('gutshot-25',a).calls);});
 it('F04: fit-or-fold folds no-draw air facing half-pot more than LAG',()=>{expect(find('air-50','fit-or-fold').drawClass).toBe('none');expect(find('air-50','fit-or-fold').folds).toBeGreaterThan(find('air-50','lag').folds);});
 it('F05: OESD defends more than a naked gutshot at identical flop price',()=>{for(const a of ['station','nit','tag'] as const){expect(find('oesd-25',a).drawClass).toBe('open-ended');expect(find('oesd-25',a).defends).toBeGreaterThan(find('gutshot-25',a).defends);}});
 it('F08: station calls weak pair on half-pot river more than strong regular',()=>{expect(find('river-pair-50','station').calls).toBeGreaterThan(find('river-pair-50','stronger-reg').calls);});
 it('F09: maniac raises more than nit unopened and versus one preflop raise',()=>{for(const scenario of ['unopened','facing-open'])expect(find(scenario,'maniac').raises).toBeGreaterThan(find(scenario,'nit').raises);});
 it('F12: station responds differently to top pair versus no pair on identical board and price',()=>{expect(find('top-pair-50','station').defends).toBeGreaterThan(find('no-pair-50','station').defends);});
});
