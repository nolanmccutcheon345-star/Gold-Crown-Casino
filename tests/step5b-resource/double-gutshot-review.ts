import {writeFileSync} from 'node:fs';
import {hand,rig,act} from '../verification/helpers';
import {assertAccounting,observeBot} from '../../src/core/engine';
import {analyzeDecision,createProfile} from '../../src/bots/policy';
import {contestablePricing} from '../../src/bots/pricing';
const rows=[];
for(const wager of [1500,2999,3000,4500]){
 let game=rig(hand([100000,4000,100000]),[['Ac','Ad'],['9c','7d'],['Kc','Kd']],['5h','8h','Js','2c','3d']);game=act(game,{type:'raise',to:1000});while(game.street==='preflop')game=act(game,{type:'call'});game=act(game,{type:'check'});game=act(game,{type:'check'});game=act(game,{type:'raise',to:wager});const profiles=[];
 for(const archetype of ['nit','tag','station','stronger-reg'] as const){const p=createProfile({selection:archetype},0x59000,'neutral'),o=observeBot(game,game.actor!,p.policyVersion,'independent-doublegut-review'),a=analyzeDecision(o,p);profiles.push({archetype,legal:o.legal,pricing:contestablePricing(o),features:a.features,postflop:a.postflop,distribution:a.distribution});}
 const afterCall=act(game,{type:'call'}),afterBehindFolds=act(afterCall,{type:'fold'});assertAccounting(afterBehindFolds);rows.push({wager,publicContributions:game.seats.map(s=>({id:s.id,total:s.totalCommitted,remaining:s.stack})),profiles,afterCall:{actor:afterCall.actor,street:afterCall.street,ownRemaining:afterCall.seats[1].stack},afterBehindFolds:{actor:afterBehindFolds.actor,street:afterBehindFolds.street,pot:afterBehindFolds.pot,board:afterBehindFolds.board,events:afterBehindFolds.events.filter(e=>e.type==='refund'||e.type==='award')}});
}
writeFileSync('tests/step5b-resource/double-gutshot-review.json',JSON.stringify({claim:'Independent mechanical/public-input review only, no solver or human calibration.',rows},null,2));for(const row of rows)console.log(JSON.stringify({wager:row.wager,after:row.afterBehindFolds,profile:row.profiles.map(p=>({archetype:p.archetype,continue:1-p.distribution.fold,call:p.distribution.call,pricing:p.pricing,post:p.postflop}))}));
