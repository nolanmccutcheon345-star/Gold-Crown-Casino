import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Archetype,BotProfile,GameState,PublicMemoryHand} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot,projectView} from '../../src/core/engine';
import {analyzeDecision,buildOpponentMemory,chooseDecision,createProfile} from '../../src/bots/policy';
import {act,hand,rig} from '../verification/helpers';
import {seededRandom,scenarios} from '../step4a/scenarios';
import {makeGame} from '../step4c/population';
import {HandAudit} from '../step4c/audit';
const out=(name:string,value:unknown)=>{const dir=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence/runtime');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,name),JSON.stringify(value,null,2));};
function samples(g:GameState,p:BotProfile,n:number,seed:number){const o=observeBot(g,g.actor!,p.policyVersion,'persona-context'),count={fold:0,check:0,call:0,raise:0},seen=new Set<string>();for(let i=0;i<n;i++){const d=chooseDecision(o,p,seededRandom(seed+i));count[d.action.type]++;const key=JSON.stringify(d.action);if(!seen.has(key)){seen.add(key);assertAccounting(applyCommand(g,d));}}return{opportunities:n,count};}
describe('F11/F13/R12 coherent stable personas, not new archetype labels',()=>{
 it('F11: custom trapping TAG checks strong sets sometimes, with more slowplay than straightforward TAG and less trapping on wet boards',()=>{
  const rows=[];
  for(const seed of [0x51181,0x51197,0x511b3,0x511cf]){
   const tag=createProfile({selection:'tag'},seed,'neutral'),tricky=createProfile({selection:'custom',baseArchetype:'tag',traits:{slowPlay:.9}},seed,'neutral');
   const states=[['Kh','7c','2d','8s','3c'],['Kh','Qh','9s','8d','3c']].map(board=>{let g=rig(hand([20000,20000]),[['Kc','Kd'],['As','Ac']],board);g=act(g,{type:'raise',to:1000});g=act(g,{type:'call'});g=act(g,{type:'check'});return g;});
   const analyses=states.map(g=>[tag,tricky].map(p=>analyzeDecision(observeBot(g,0,p.policyVersion,'set'),p)));
   for(let i=0;i<states.length;i++){expect(analyses[i][1].families.trap).toBeGreaterThan(analyses[i][0].families.trap);expect(analyses[i][1].distribution.check).toBeGreaterThan(analyses[i][0].distribution.check);const counts=[samples(states[i],tag,512,0x511000+seed),samples(states[i],tricky,512,0x511000+seed)];expect(counts[1].count.check).toBeGreaterThan(0);expect(counts[1].count.raise).toBeGreaterThan(0);rows.push({seed,board:states[i].board,publicEvents:states[i].events,profiles:[tag,tricky],analysis:analyses[i].map(a=>({features:a.features,distribution:a.distribution,families:a.families,sizing:a.sizing})),counts});}
   expect(analyses[0][1].families.trap).toBeGreaterThan(analyses[1][1].families.trap);
  }
  out('F11-trapping.json',{claim:'Configured slow-playing Custom TAG, not an additional archetype or human validation',rows});
 });
 it.each(['station','nit'] as Archetype[])('F13: hidden %s behaves exactly like its assigned type over100 legitimate complete hands, without revealing the type',archetype=>{
  const personality=0x513a19,known=createProfile({selection:archetype},personality,'neutral'),unknown=createProfile({selection:'unknown',baseArchetype:archetype},personality,'neutral');
  expect(unknown.archetype).toBe(archetype);expect(unknown.unknown).toBe(true);const profiles=Array.from({length:3},(_,id)=>id===1?known:createProfile({selection:id===0?'tag':'lag'},0x513b17+id,'neutral'));
  const history:PublicMemoryHand[]=[],hands=[];let decisions=0,focusDecisions=0;const totals:Record<string,{count:number;opportunities:number}>={};
  for(let index=0;index<100;index++){
   const seed=0x513000+index;let g=makeGame(`identity-${index}`,3,seed,100,index%2===0,index%3),twin=structuredClone(g);const audit=new HandAudit([0,1,2]);let guard=0;
   while(g.street!=='complete'&&guard++<200){const actor=g.actor!,p=profiles[actor],hiddenProfile=actor===1?unknown:p,o=observeBot(g,actor,p.policyVersion,`${g.handId}:${g.revision}`),v=observeBot(twin,actor,hiddenProfile.policyVersion,`${twin.handId}:${twin.revision}`);o.memory=buildOpponentMemory(history,actor,p.traits?.memoryRetention??.5);v.memory=structuredClone(o.memory);o.rake=g.profile.rake;v.rake=twin.profile.rake;const drawSeed=seed^Math.imul(g.revision+1,0x72e3a91),d=chooseDecision(o,p,seededRandom(drawSeed)),hidden=chooseDecision(v,hiddenProfile,seededRandom(drawSeed));expect(hidden.action).toEqual(d.action);
    const view=projectView(twin,0);expect(view.seats[1].hole).toEqual([]);expect(JSON.stringify(view)).not.toContain(JSON.stringify(archetype));expect(view).not.toHaveProperty('privateProfiles');audit.record(g,d.action);g=applyCommand(g,d);twin=applyCommand(twin,hidden);audit.after(g);expect(twin).toEqual(g);assertAccounting(g);decisions++;if(actor===1)focusDecisions++;
   }
   expect(g.street).toBe('complete');const metrics=audit.finish(g).get(1)!;for(const [key,c]of Object.entries(metrics)){totals[key]??={count:0,opportunities:0};totals[key].count+=c.count;totals[key].opportunities+=c.opportunities;}
   history.push({handId:g.handId,seats:g.seats.map(s=>({id:s.id,revealedCards:g.revealedSeats.includes(s.id)?s.hole:[]})),events:g.events});hands.push({seed,button:g.button,actions:g.events.filter(e=>e.type==='action').length,focusNet:g.seats[1].stack-g.seats[1].startingStack,payouts:g.payouts,...(index<2?{completePublicEvents:g.events,board:g.board}:{}),equivalentUnknownAndNamed:true});
  }
  expect(history).toHaveLength(100);expect(focusDecisions).toBeGreaterThan(0);expect(unknown.archetype).toBe(archetype);out(`F13-unknown-${archetype}.json`,{claim:'Paired synthetic known/Unknown identity equivalence, not measured human resemblance',profile:unknown,completedHandsPerIdentity:100,decisions,focusDecisions,opportunityDefinitions:'Independent HandAudit public-action definitions; no type label used to classify behavior',totals,hands,method:'Same secure-engine seeded test deck, public histories,stable personality and paired action seeds; stack100BBreset per controlledhand, alternating rake. Unknown mask cannot change assigned policy; no continuousbankroll claim.'});
 },120000);
 it('R12: station and nit differ on long repeated draw/weak-pair/oversized-response strata without a Hero seat advantage',()=>{
  const cases=scenarios().filter(s=>['flop-marginal-overbet','flop-flushdraw','river-marginal-overbet'].includes(s.id)),rows=[];
  for(const s of cases){const a=createProfile({selection:'station'},0x512a31,'neutral'),b=createProfile({selection:'nit'},0x512a31,'neutral'),counts=[samples(s.state,a,4096,0x512ff),samples(s.state,b,4096,0x512ff)],continueCount=counts.map(r=>r.count.call+r.count.raise);expect(continueCount[0]).toBeGreaterThan(continueCount[1]);
   // Permute the two-seat public identities including actor,button andlegalactor.
   // The same legal observation still has the same exact policy distribution.
   for(const p of [a,b]){const o=observeBot(s.state,s.state.actor!,p.policyVersion,'roles'),permuted=structuredClone(o),map=(id:number)=>(id+1)%2;permuted.actingSeat=map(o.actingSeat);permuted.button=map(o.button);permuted.legal.actor=map(o.legal.actor!);permuted.seats.forEach(seat=>{seat.id=map(seat.id);});permuted.publicEvents.forEach(e=>{if(e.seatId!==undefined)e.seatId=map(e.seatId);});expect(analyzeDecision(permuted,p).distribution).toEqual(analyzeDecision(o,p).distribution);}
   rows.push({scenario:s.id,own:s.state.seats[s.state.actor!].hole,board:s.state.board,publicEvents:s.state.events,profiles:[a,b],counts,continueCount});
  }
  out('R12-station-nit.json',{claim:'24,576 repeated synthetic decisions in3 independent public strata; no real-human or live-profit inference',opportunitiesPerProfilePerContext:4096,decisionSamples:24576,rows});
 },60000);
});
