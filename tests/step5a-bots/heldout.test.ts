import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {act,hand,rig,practiceProfile} from '../verification/helpers';
import {observeBot,legalActions,assertAccounting} from '../../src/core/engine';
import {analyzeDecision,defaultProfile} from '../../src/bots/policy';
import {rng} from '../step4c/audit';
import {DECK} from './reference';
const boards=[['Ts','Js','Qs','Ks','As'],['Tc','Jd','Qh','Ks','Ac'],['8c','8d','8h','8s','Ac']];
it('fresh post-freeze holdout reconciles120 board-chop scenarios plus40 private royals',()=>{
 const p=defaultProfile('stronger-reg'),random=rng(0x5a7e2026),rows=[];
 for(let n=0;n<20;n++)for(const button of [0,1])for(const [bi,board] of boards.entries()){
  const stacks=[8000+Math.floor(random()*42000),8000+Math.floor(random()*42000)],rules=practiceProfile();rules.rake={basisPoints:Math.floor(random()*1001),cap:Math.floor(random()*1501),noFlopNoDrop:true};
  const unused=DECK.filter(c=>!board.includes(c));let g=rig(hand(stacks,button,rules),[unused.slice(0,2),unused.slice(2,4)],board);
  g=act(g,{type:'call'});g=act(g,{type:'check'});while(g.street!=='river'){g=act(g,{type:'check'});g=act(g,{type:'check'});}
  g=act(g,{type:'check'});g=act(g,{type:'raise',to:legalActions(g).maxRaiseTo!});
  const o=observeBot(g,g.actor!,p.policyVersion,`heldout-${n}-${button}-${bi}`);o.rake=g.profile.rake;
  const a=analyzeDecision(o,p),s=act(g,{type:'call'}),ev=s.seats[o.actingSeat].stack-g.seats[o.actingSeat].stack;
  expect(a.features.absoluteNuts).toBe(true);expect(a.features.playsBoard).toBe(true);expect(a.postflop?.guaranteedChopCallEV).toBe(ev);expect(a.distribution.fold).toBe(ev<0?1:0);assertAccounting(s);
  rows.push({n,button,board,stacks,rake:rules.rake,cost:o.legal.callAmount,pot:o.pot,callEV:ev,fold:a.distribution.fold,payout:s.payouts});
 }
 const privateRows=[];
 for(let n=0;n<20;n++)for(const button of [0,1]){
  const rules=practiceProfile();rules.rake={basisPoints:500,cap:Math.floor(random()*1501),noFlopNoDrop:true};const hero=1-button;
  const holes=hero===1?[['2c','3d'],['As','Ks']]:[['As','Ks'],['2c','3d']];let g=rig(hand([10000+Math.floor(random()*40000),10000+Math.floor(random()*40000)],button,rules),holes,['Qs','Js','Ts','4c','5d']);
  g=act(g,{type:'call'});g=act(g,{type:'check'});while(g.street!=='river'){g=act(g,{type:'check'});g=act(g,{type:'check'});}
  g=act(g,{type:'check'});g=act(g,{type:'raise',to:legalActions(g).maxRaiseTo!});const o=observeBot(g,g.actor!,p.policyVersion,`private-heldout-${n}-${button}`);o.rake=g.profile.rake;
  const a=analyzeDecision(o,p),s=act(g,{type:'call'});expect(a.features.playsBoard).toBe(false);expect(a.features.absoluteNuts).toBe(true);expect(a.postflop?.guaranteedChopCallEV).toBeNull();expect(a.distribution.fold).toBe(0);expect(s.seats[hero].stack-g.seats[hero].stack).toBeGreaterThan(0);assertAccounting(s);privateRows.push({button,call:o.legal.callAmount,EV:s.seats[hero].stack-g.seats[hero].stack,fold:a.distribution.fold});
 }
 if(process.env.STEP5A_HOLDOUT==='1')writeFileSync('tests/step5a-bots/evidence/fresh-heldout.json',JSON.stringify({runtimeFreeze:'930001a',policy:p.policyVersion,seed:'0x5a7e2026',rows,privateRows},null,2));
},120000);
