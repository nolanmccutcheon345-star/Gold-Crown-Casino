import {it,expect} from 'vitest';
import {act,hand,rig,practiceProfile} from '../verification/helpers';
import {observeBot,legalActions,assertAccounting} from '../../src/core/engine';
import {analyzeDecision,chooseDecision,defaultProfile} from '../../src/bots/policy';
import {defaultProfile as oldProfile} from '../../src/bots/v3/profiles';
import {chooseDecision as oldChoose} from '../../src/bots/v3/policy';

function scenario(cap:number,stacks=[20000,20000],board=['Ts','Js','Qs','Ks','As'],holes=[['2c','3d'],['4c','5d']],button=0){
 const rules=practiceProfile();rules.rake={basisPoints:500,cap,noFlopNoDrop:true};
 let g=rig(hand(stacks,button,rules),holes,board);
 g=act(g,{type:'call'});g=act(g,{type:'check'});
 while(g.street!=='river'){g=act(g,{type:'check'});g=act(g,{type:'check'});}
 g=act(g,{type:'check'});g=act(g,{type:'raise',to:legalActions(g).maxRaiseTo!});
 return g;
}
for(const [cap,ev] of [[0,200],[400,0],[500,-50],[501,-50]])it(`exact forced-board chop reconciles cap${cap} and EV${ev}`,()=>{
 const g=scenario(cap),p=defaultProfile('stronger-reg'),o=observeBot(g,g.actor!,p.policyVersion,'new');o.rake=g.profile.rake;
 const a=analyzeDecision(o,p),s=act(g,{type:'call'}),actual=s.seats[o.actingSeat].stack-g.seats[o.actingSeat].stack;
 expect(actual).toBe(ev);expect(a.postflop?.guaranteedChopCallEV).toBe(ev);expect(a.distribution.fold).toBe(ev<0?1:0);assertAccounting(s);
});
it('does not confuse a private royal flush with guaranteed board chop',()=>{
 const g=scenario(500,[20000,20000],['Ts','Js','Qs','2c','3d'],[['4c','5d'],['Ks','As']]),p=defaultProfile('stronger-reg'),o=observeBot(g,g.actor!,p.policyVersion,'private');o.rake=g.profile.rake;
 const a=analyzeDecision(o,p);expect(a.features.absoluteNuts).toBe(true);expect(a.features.playsBoard).toBe(false);expect(a.distribution.fold).toBe(0);expect(a.postflop?.guaranteedChopCallEV).toBeNull();
});
it('preserves exact1.2 decisions for saved sessions and unchanged negative chop behavior',()=>{
 const g=scenario(500),p=oldProfile('stronger-reg'),o=observeBot(g,g.actor!,p.policyVersion,'saved');o.rake=g.profile.rake;
 for(const token of [0,.25,.5,.75,.999999])expect(chooseDecision(o,p,()=>token)).toEqual(oldChoose(o,p,()=>token));
 expect(analyzeDecision(o,p).distribution.fold).toBe(0);
});
it('accounts for unmatched oversized shove and capped callers',()=>{
 const g=scenario(500,[50000,20000]),p=defaultProfile('stronger-reg'),o=observeBot(g,g.actor!,p.policyVersion,'capped');o.rake=g.profile.rake;
 const a=analyzeDecision(o,p),s=act(g,{type:'call'});expect(a.postflop?.guaranteedChopCallEV).toBe(s.seats[o.actingSeat].stack-g.seats[o.actingSeat].stack);expect(a.distribution.fold).toBe(1);expect(a.postflop!.excludedChips).toBeGreaterThan(0);assertAccounting(s);
});
