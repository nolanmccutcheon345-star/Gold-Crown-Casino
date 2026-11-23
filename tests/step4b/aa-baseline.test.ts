import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BotObservation, BotProfile } from '../../src/contracts';
import { ARCHETYPES, analyzeDecision, chooseDecision, createProfile, POLICY_VERSION } from '../../src/bots/policy';
import { applyCommand, assertAccounting, observeBot } from '../../src/core/engine';
import { scenarios, seededRandom } from '../step4a/scenarios';

const SOURCE='59f950d6f395eb623eb97b329c79fbd29fc78168';
const fixturePath=new URL('./fixtures/step4a-aa-59f950d.json',import.meta.url);
const files=['src/bots/policy.ts','src/bots/profiles.ts','src/bots/strategy.ts','src/bots/features.ts','src/bots/boundary.ts','src/core/engine.ts','tests/step4a/scenarios.ts','tests/step4a/evaluation.ts'];
const sha=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const empty=()=>({fold:0,check:0,openLimp:0,callFacingRaise:0,allInCall:0,raise:0,allInRaise:0});
function sample(observation:BotObservation,profile:BotProfile){
 const counts=empty(),raiseSizes:Record<string,number>={},actions:string[]=[];
 const firstIn=!observation.publicEvents.some(e=>e.type==='action');const own=observation.seats.find(s=>s.id===observation.actingSeat)!;
 for(let i=0;i<1000;i++){
  const d=chooseDecision(observation,profile,seededRandom(0x4ab123^i));const action=d.action;
  if(action.type==='fold'){counts.fold++;actions.push('fold');}
  else if(action.type==='check'){counts.check++;actions.push('check');}
  else if(action.type==='call'){
   const kind=observation.legal.callAmount===own.stack?'allInCall':firstIn?'openLimp':'callFacingRaise';counts[kind]++;actions.push(`${kind}:${observation.legal.callAmount}`);
  }else if(action.type==='raise'){
   const kind=action.to===own.streetCommitted+own.stack?'allInRaise':'raise';counts[kind]++;raiseSizes[action.to]=(raiseSizes[action.to]??0)+1;actions.push(`${kind}:${action.to}`);
  }
 }
 return{counts,raiseSizes,actionsSha256:sha(JSON.stringify(actions)),sampleActions:actions};
}
type Audit={sourceCommit:string;policyVersion:string;rows:{archetype:string;profileSeed:number;profile:BotProfile;observation:BotObservation;sampled:ReturnType<typeof sample>}[];};
describe('Exact frozen Step4A first-in-AA anomaly audit',()=>{
 it('reproduces1000 decisions/profile with the exact published profile/action seeds and preserves them for legacy regression',()=>{
  if(process.env.WRITE_STEP4B_AA_BASELINE==='1'){
   expect(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()).toBe(SOURCE);
   expect(POLICY_VERSION).toBe('synthetic-cash-1.0.0');
   const scenario=scenarios().find(s=>s.id==='unopened-aa')!;const state=scenario.state;
   expect(state.revision).toBe(0);expect(state.actor).toBe(3);expect(state.button).toBe(0);expect(state.smallBlindSeat).toBe(1);expect(state.bigBlindSeat).toBe(2);
   expect(state.events.filter(e=>e.type==='action')).toEqual([]);expect(state.seats.find(s=>s.id===3)!.streetCommitted).toBe(0);
   const published=JSON.parse(readFileSync('TEST_EVIDENCE/step4a/final-evaluation/controlled-decisions.json','utf8'));
   const rows=ARCHETYPES.map((archetype,index)=>{
    const profileSeed=1001+index;const profile=createProfile({selection:archetype},profileSeed,'neutral');
    const observation=observeBot(state,state.actor!,profile.policyVersion,'evaluation:unopened-aa');observation.rake=state.profile.rake;
    const sampled=sample(observation,profile);const prior=published.rows.find((r:{scenario:string;archetype:string})=>r.scenario==='unopened-aa'&&r.archetype===archetype);
    expect(sampled.counts).toEqual({fold:prior.actions.fold,check:prior.actions.check,openLimp:prior.actions.call,callFacingRaise:0,allInCall:0,raise:prior.actions.raise,allInRaise:0});
    // Every one of the8000 actions is also submitted to the authority; the
    // fixture is first-in and all-in classification uses actual stack bounds.
    for(let i=0;i<1000;i++){const decision=chooseDecision(observation,profile,seededRandom(0x4ab123^i));assertAccounting(applyCommand(state,decision));}
    return{archetype,profileSeed,profile,observation,analysis:analyzeDecision(observation,profile),sampled};
   });
   const audit={format:'step4b-frozen-step4a-aa-audit',sourceCommit:SOURCE,executedAt:new Date().toISOString(),policyVersion:POLICY_VERSION,
    sourceSha256:Object.fromEntries(files.map(path=>[path,sha(readFileSync(path))])),
    scenario:{id:scenario.id,tableSize:state.seats.length,button:state.button,smallBlindSeat:state.smallBlindSeat,bigBlindSeat:state.bigBlindSeat,actingSeat:state.actor,street:state.street,revision:state.revision,ruleProfile:state.profile,actualFirstIn:true,voluntaryActionsBefore:0,callIsOpenLimp:true,commonActionSeed:0x4ab123,samplesPerProfile:1000},rows};
   mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});writeFileSync(fixturePath,JSON.stringify(audit,null,2)+'\n');
  }
  expect(existsSync(fixturePath)).toBe(true);const saved=JSON.parse(readFileSync(fixturePath,'utf8')) as Audit;
  expect(saved.sourceCommit).toBe(SOURCE);expect(saved.rows).toHaveLength(8);
  for(const row of saved.rows){const actual=sample(row.observation,row.profile);expect(actual).toEqual(row.sampled);expect(Object.values(actual.counts).reduce((n,c)=>n+c,0)).toBe(1000);}
 });
});
