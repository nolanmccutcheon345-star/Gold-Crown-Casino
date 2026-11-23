import type {Action,BotObservation,Card,GameState,RuleProfile} from '../../src/contracts';
import {applyCommand,legalActions,observeBot,startHand} from '../../src/core/engine';
import {POLICY_VERSION} from '../../src/bots/profiles';
import {practiceProfile,rig} from '../verification/helpers';
export const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`pricing5a:${g.revision}`,action});
export function profile(rake=false):RuleProfile{return {...practiceProfile(),rake:rake?{basisPoints:500,cap:501,noFlopNoDrop:true}:{basisPoints:0,cap:0,noFlopNoDrop:true}};}
export function observation(g:GameState):BotObservation{return {...observeBot(g,g.actor!,POLICY_VERSION,`pricing5a-observe:${g.revision}`),rake:g.profile.rake};}
export function start(stacks:number[],seed:number,rake=false,royal=false,rules?:RuleProfile):GameState{
 let g=startHand({handId:`pricing5a:${seed}`,button:0,profile:rules??profile(rake),seats:stacks.map((stack,id)=>({id,name:`Seat${id}`,stack}))});
 const board:Card[]=royal?['Tc','Jc','Qc','Kc','Ac']:['2c','5h','8d','Js','Qh'];
 const unused='23456789TJQKA'.split('').flatMap(r=>'cdhs'.split('').map(s=>r+s)).filter(c=>!board.includes(c));
 const random=rng(seed);for(let i=unused.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[unused[i],unused[j]]=[unused[j],unused[i]];}
 g=rig(g,stacks.map((_,i)=>unused.slice(i*2,i*2+2)),board);return g;
}
export function flop(stacks:number[],seed:number,rake=false,royal=false,rules?:RuleProfile):GameState{
 let g=start(stacks,seed,rake,royal,rules);while(g.street==='preflop')g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});return g;
}
export function checkDown(g:GameState){for(let n=0;g.street!=='complete'&&n<200;n++)g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});if(g.street!=='complete')throw Error('Fixture stalled');return g;}
export function rng(seed:number){let a=seed>>>0;return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
