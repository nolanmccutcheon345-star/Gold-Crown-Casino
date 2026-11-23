import type {Action,BotObservation,Card,GameState} from '../../src/contracts';
import {applyCommand,observeBot,startHand} from '../../src/core/engine';
import {POLICY_VERSION} from '../../src/bots/profiles';
import {practiceProfile,rig} from '../verification/helpers';
export function action(state:GameState,a:Action):GameState {
 if(state.actor===null)throw new Error('Fixture finished');
 return applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor,decisionId:`audit:${state.revision}`,action:a});
}
export function shortStackOverbet(own:Card[]=['Qd','Jd']):GameState {
 let s=rig(startHand({handId:'4c-short-stack-overbet',button:0,profile:practiceProfile(),seats:[{id:0,name:'Short',stack:4000},{id:1,name:'Deep',stack:20000}]}),[own,['8c','9c']],['Qs','7h','2c','6s','3d']);
 s=action(s,{type:'call'});s=action(s,{type:'check'});s=action(s,{type:'raise',to:19800});return s;
}
export function observation(s=shortStackOverbet()):BotObservation {return {...observeBot(s,s.actor!,POLICY_VERSION,`observed:${s.revision}`),rake:s.profile.rake};}

export function multiwaySidePot(raked=false):GameState {
 const profile=practiceProfile();if(raked)profile.rake={basisPoints:500,cap:500,noFlopNoDrop:true};
 let s=rig(startHand({handId:'4c-side-pot-price',button:0,profile,seats:[{id:0,name:'Short',stack:2000},{id:1,name:'Deep A',stack:5000},{id:2,name:'Deep B',stack:5000}]}),[['As','Ah'],['Kc','Qc'],['Kd','Jc']],['9h','7d','2c','6s','3d']);
 s=action(s,{type:'raise',to:1000});s=action(s,{type:'call'});s=action(s,{type:'call'});
 s=action(s,{type:'raise',to:4000});s=action(s,{type:'call'});return s;
}
