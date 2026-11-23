import {describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Card,GameState,Action} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile,POLICY_VERSION} from '../../src/bots/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';

// Frozen independent follow-up cases, distinct from the 8c7d/Jh9s2c discovery
// fixture. Do not tune these inputs after viewing a candidate-policy result.
const cases=[
 {id:'q-high-ip-40bb',hole:['9c','8d'],board:['Qh','Ts','2c','3d','Ks'],stack:8000,preflopTo:600,actor:0},
 {id:'nine-high-ip-150bb',hole:['6c','5d'],board:['9h','7s','2c','3d','Ks'],stack:30000,preflopTo:1000,actor:0},
 {id:'ten-high-oop-150bb',hole:['7c','6d'],board:['Th','8s','2c','3d','Ks'],stack:30000,preflopTo:1000,actor:1},
 {id:'q-high-oop-75bb',hole:['9d','8c'],board:['Qh','Ts','2d','3c','Ks'],stack:15000,preflopTo:600,actor:1},
] as const;
function step(g:GameState,action:Action){return applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`heldout:${g.revision}`,action});}
function fixture(c:typeof cases[number]){
 let g=rig(startHand({handId:`step5b-heldout:${c.id}`,button:0,profile:practiceProfile(),seats:[0,1].map(id=>({id,name:`P${id}`,stack:c.stack}))}),c.actor===0?[[...c.hole],['Ah','Ad']]:[['Ah','Ad'],[...c.hole]],[...c.board] as Card[]);
 g=step(g,{type:'raise',to:c.preflopTo});g=step(g,{type:'call'});expect(g.street).toBe('flop');
 if(c.actor===1)g=step(g,{type:'check'});
 const pot=g.pot;g=step(g,{type:'raise',to:pot/4});expect(g.actor).toBe(c.actor);return g;
}
describe('F02 fixed held-out gutshot contexts',()=>{
 it('preserves the intended station-versus-nit draw-call direction across position, board and stack contexts',()=>{
  const rows=[];
  for(const c of cases){
   const g=fixture(c),results=[];
   for(const archetype of ['station','nit'] as const){
    let calls=0,raises=0,folds=0,expectedCall=0;const diagnostics=[];
    for(let identity=0;identity<4;identity++){
     const profile=createProfile({selection:archetype},0x61bc40+identity*137,'neutral'),o=observeBot(g,c.actor,profile.policyVersion,`heldout:${c.id}:${identity}`);o.rake=g.profile.rake;
     const a=analyzeDecision(o,profile);expect(a.features.drawClass).toBe('gutshot');expect(a.features.made).toBe(false);expectedCall+=a.distribution.call/4;
     diagnostics.push({identity,profile,features:a.features,context:a.context,distribution:a.distribution,rangeEquity:a.ranges?.equity,postflop:a.postflop});
     for(let draw=0;draw<128;draw++){
      const d=chooseDecision(o,profile,seededRandom(0x77b5de^draw^(identity*6521)));calls+=Number(d.action.type==='call');raises+=Number(d.action.type==='raise');folds+=Number(d.action.type==='fold');assertAccounting(applyCommand(g,d));
     }
    }
    results.push({archetype,calls,raises,folds,opportunities:512,expectedCall,diagnostics});
   }
   rows.push({fixture:c,publicState:{street:g.street,board:g.board,pot:g.pot,events:g.events},results});
  }
  const output=resolve(process.env.STEP5B_ACCEPTANCE_EVIDENCE_DIR??'tests/step5b-acceptance/evidence');mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'heldout-draw-surface.json'),JSON.stringify({policyVersion:POLICY_VERSION,method:'Four fixed held-out flop contexts ×2archetypes ×4stable personalities ×128paired draws =4096 actual legal decisions. Simple conditional direction requirement, not measured-human calibration. Expected call probability is the average known synthetic policy distribution; actual sampled call counts and all public prefixes are retained.',rows},null,2));
  for(const row of rows){const station=row.results[0],nit=row.results[1];expect(station.expectedCall,`${row.fixture.id}: station/nit conditional call tendency`).toBeGreaterThan(nit.expectedCall);expect(station.calls,`${row.fixture.id}: observed sampled calls`).toBeGreaterThan(nit.calls);}
 },120000);
});
