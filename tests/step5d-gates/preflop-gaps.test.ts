import {describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import type {Action,Card,GameState} from '../../src/contracts';
import {applyCommand,assertAccounting,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,createProfile} from '../../src/bots/policy';
import {allHandClasses} from '../step4b/preflop-fixtures';
import {act,practiceProfile} from '../verification/helpers';
import {seededRandom} from '../step4a/scenarios';

function fresh(count:number,depth:number):GameState{
 return startHand({handId:`step5d-preflop:${count}:${depth}`,button:0,profile:practiceProfile(),seats:Array.from({length:count},(_,id)=>({id,name:`Seat ${id}`,stack:depth*200}))});
}
function firstIn(count:number,depth:number,seat:number):GameState{
 let game=fresh(count,depth);
 for(let attempts=0;game.actor!==seat&&attempts<count;attempts++)game=act(game,{type:'fold'});
 expect(game.actor).toBe(seat);return game;
}
function record(file:string,value:unknown):void{
 const directory=resolve(process.env.STEP5D_GATES_EVIDENCE_DIR??'test-results/step5d-gates');mkdirSync(directory,{recursive:true});
 writeFileSync(resolve(directory,file),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:{node:process.version,platform:process.platform,arch:process.arch},...value as object},null,2)+'\n');
}
const classRows=allHandClasses();

describe('Step5D exact current preflop context requirements',()=>{
 it('F01: current TAG button raises and enters more independently combo-weighted hands than UTG across six-to-ten-seat formats',()=>{
  expect(classRows).toHaveLength(169);expect(classRows.reduce((sum,row)=>sum+row.weight,0)).toBe(1326);
  const identities=[0x5df001,0x5df102,0x5df203],rows=[];
  for(const seats of [6,7,8,9,10])for(const depth of [20,100,250])for(const identity of identities){
   const profile=createProfile({selection:'tag'},identity,'neutral');
   const outcomes=[3,0].map(seat=>{
    const state=firstIn(seats,depth,seat);let raiseCombos=0,entryCombos=0;
    for(const row of classRows){
     const observation=observeBot(state,seat,profile.policyVersion,'F01-current-exhaustive');observation.ownCards=[...row.combos[0]];
     const analysis=analyzeDecision(observation,profile);expect(analysis.preflop!.position).toBe(seat===0?'BTN':'UTG');
     expect(analysis.preflop!.node).toBe('unopened');
     expect(Object.values(analysis.distribution).reduce((sum,n)=>sum+n,0)).toBeCloseTo(1,12);
     raiseCombos+=row.weight*analysis.distribution.raise;
     entryCombos+=row.weight*(analysis.distribution.raise+analysis.distribution.call);
    }
    return{seat,position:seat===0?'BTN':'UTG',raiseCombos,entryCombos};
   });
   const [utg,button]=outcomes;
   expect(button.raiseCombos).toBeGreaterThan(utg.raiseCombos);expect(button.entryCombos).toBeGreaterThan(utg.entryCombos);
   rows.push({seats,depthBB:depth,identity,profile,rule:practiceProfile(),utg,button,additionalRaiseCombos:button.raiseCombos-utg.raiseCombos,additionalEntryCombos:button.entryCombos-utg.entryCombos});
  }
  expect(rows).toHaveLength(45);
  record('F01-current.json',{protocol:'tests/step5d-gates/PREFLOP_GAP_PROTOCOL.md',classes:169,physicalCombinations:1326,contexts:45,rows,
   expected:'Current TAG button has greater weighted opening-raise and voluntary-entry mass than UTG in every declared context.',observed:'All directional assertions passed; exact effect sizes retained for materiality review.',
   limits:'Exact synthetic probability mass, not sampled VPIP/PFR, human calibration or solver ranges. Earlier legal folds change position and remaining field together. No distinct UTG comparison is invented for heads-up/three-handed games.'});
 });

 it('R03: identical QJs and 97s classes change conditional distributions across actual position and unopened, limp, open and three-bet nodes',()=>{
  const profile=createProfile({selection:'tag'},0x5d0301,'neutral'),rows=[];
  const prefixes:{node:string;actions:Action[]}[]=[
   {node:'unopened',actions:[{type:'fold'},{type:'fold'}]},
   {node:'limped',actions:[{type:'call'},{type:'fold'}]},
   {node:'facing-open',actions:[{type:'raise',to:600},{type:'fold'}]},
   {node:'facing-3bet',actions:[{type:'raise',to:600},{type:'raise',to:1800}]},
  ];
  for(const ownCards of [['Qc','Jc'],['9h','7h']] as Card[][])for(const seat of [5,0]){
   const contextRows=[];
   for(const prefix of prefixes){
    let state=fresh(6,100);for(const action of prefix.actions)state=act(state,action);
    if(seat===0)state=act(state,{type:'fold'});expect(state.actor).toBe(seat);
    const observation=observeBot(state,seat,profile.policyVersion,'R03-current-context');observation.ownCards=[...ownCards];
    const analysis=analyzeDecision(observation,profile);expect(analysis.preflop!.node).toBe(prefix.node);
    expect(analysis.preflop!.position).toBe(seat===0?'BTN':'CO');
    expect(analysis.preflop!.handClass).toBe(ownCards[0]==='Qc'?'QJs':'97s');expect(analysis.preflop!.comboCount).toBe(4);
    const proposals=[];
    for(let sample=0;sample<32;sample++){
     const command=chooseDecision(observation,profile,seededRandom(0x5d0300+sample));
     const result=applyCommand(state,command);assertAccounting(result);proposals.push(command.action);
    }
    contextRows.push({cards:ownCards,seat,position:analysis.preflop!.position,node:analysis.preflop!.node,handClass:analysis.preflop!.handClass,distribution:analysis.distribution,sizing:analysis.sizing,legal:observation.legal,publicEvents:observation.publicEvents,proposals});
   }
   expect(new Set(contextRows.map(row=>row.handClass)).size).toBe(1);
   expect(new Set(contextRows.map(row=>JSON.stringify(row.distribution))).size).toBe(4);
   rows.push(...contextRows);
  }
  for(const cards of ['QcJc','9h7h']){
   const own=rows.filter(row=>row.cards.join('')===cards);
   expect(prefixes.some(prefix=>JSON.stringify(own.find(row=>row.seat===5&&row.node===prefix.node)!.distribution)!==JSON.stringify(own.find(row=>row.seat===0&&row.node===prefix.node)!.distribution))).toBe(true);
  }
  record('R03-current.json',{protocol:'tests/step5d-gates/PREFLOP_GAP_PROTOCOL.md',profile,rule:practiceProfile(),rows,decisions:rows.length*32,
   expected:'Each fixed class retains its identity while the distribution changes across the four public nodes; some matched nodes also change with position; all sampled proposals are legal.',observed:'All declared assertions passed.',limits:'Synthetic conditional behavior; no universal strategy ranking, measured human ranges or guaranteed profitability.'});
 });
});
