import {it,expect} from 'vitest';
import {act,hand,rig} from '../verification/helpers';
import {observeBot,legalActions} from '../../src/core/engine';
import {analyzeDecision} from '../../src/bots/policy';
import {defaultProfile} from '../../src/bots/v3/profiles';
import {writeFileSync} from 'node:fs';

it('records guaranteed split-pot rake loss under the original 1.2 forced nuts call',()=>{
 const p=defaultProfile('stronger-reg');
 let g=rig(hand([20000,20000]),[['2c','3d'],['4c','5d']],['Ts','Js','Qs','Ks','As']);
 g.profile.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
 g=act(g,{type:'call'});g=act(g,{type:'check'});
 while(g.street!=='river') {g=act(g,{type:'check'});g=act(g,{type:'check'});}
 g=act(g,{type:'check'});g=act(g,{type:'raise',to:legalActions(g).maxRaiseTo!});
 const o=observeBot(g,g.actor!,p.policyVersion,'terminal-audit');o.rake=g.profile.rake;
 const a=analyzeDecision(o,p),before=g.seats[g.actor!].stack;
 const settled=act(g,{type:'call'}),after=settled.seats[o.actingSeat].stack;
 const result={observation:o,analysis:a,callCost:o.legal.callAmount,foldStack:before,callStack:after,incrementalCallEV:after-before,settlement:{pots:settled.pots,payouts:settled.payouts,rake:settled.rake}};
 expect(a.features.absoluteNuts).toBe(true);expect(a.features.playsBoard).toBe(true);expect(after-before).toBe(-50);
 if(process.env.STEP5A_RECONSTRUCT==='1'){writeFileSync('tests/step5a-bots/evidence/terminal-tie-before.json',JSON.stringify(result,null,2));console.log(JSON.stringify({fold:a.distribution.fold,callEV:after-before,cost:o.legal.callAmount,pot:o.pot,rake:settled.rake,payout:settled.payouts}));}
 // Baseline demonstration; subsequent version-gated regression will assert its repair.
 expect(a.distribution.fold).toBe(0);
});
