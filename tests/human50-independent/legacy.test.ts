import {describe,it,expect} from 'vitest';
import {startHand,observeBot,applyCommand} from '../../src/core/engine';
import {createProfile,seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V23} from '../../src/tournament/bot-policy';
import {chooseTournamentDecision as frozen} from './frozen-v49-policy';
import {moodProfile,moodFrom} from '../../src/bots/human';
import {moodProfile as frozenMood,moodFrom as frozenFrom} from './frozen-v49-human';
const rules={id:'legacy50',version:'1',mode:'cash' as const,smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative' as const,oddChipOrder:'clockwise-from-button' as const};
const recent=[{deltaBB:-45,showdownLoss:true,share:-.6},{deltaBB:2,showdownLoss:false},{deltaBB:-11,showdownLoss:true},{deltaBB:45,showdownLoss:false,share:.5}];
describe('independent frozen Version49 compatibility',()=>{
 it('keeps human1.0 mood results and complete adjusted profiles unchanged',()=>{
  for(const archetype of ['nit','maniac','station','stronger-reg','tag','lag'] as const){
   const p=createProfile({selection:archetype},775,'mid');
   for(let n=0;n<=recent.length;n++){
    const a=moodFrom(recent.slice(0,n),p),b=frozenFrom(recent.slice(0,n),p);
    expect(a).toEqual(b);expect(moodProfile(p,a)).toEqual(frozenMood(p,b));
   }
  }
 });
 it('keeps complete2.3 decisions and fingerprints identical in actual legal continuations',()=>{
  let compared=0;
  for(const archetype of ['nit','maniac','station','stronger-reg','tag','lag'] as const){
   const p=createProfile({selection:archetype},778,'mid');
   let g=startHand({handId:`legacy50:${archetype}`,button:0,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`Player${id}`,stack:1200+id*700}))});
   const standings={playersLeft:12,paid:3,stacks:[1200,1900,2600,3300,4000,4700,5000,2000,3000,6000,7000,1500]};
   for(let step=0;g.street!=='complete'&&step<120;step++){
    const obs=observeBot(g,g.actor!,p.policyVersion,`decision:${step}`),a=chooseTournamentDecision(obs,p,seedStream(step+17),TOURNAMENT_POLICY_V23,standings,recent),b=frozen(obs,p,seedStream(step+17),TOURNAMENT_POLICY_V23,standings,recent);
    expect(a).toEqual(b);g=applyCommand(g,a);compared++;
   }
   expect(g.street).toBe('complete');
  }
  expect(compared).toBeGreaterThan(20);
 });
});
