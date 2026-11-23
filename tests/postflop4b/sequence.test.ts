import {describe,expect,it} from 'vitest';
import {applyCommand,assertAccounting,observeBot,startHand} from '../../src/core/engine';
import {analyzeDecision,chooseDecision} from '../../src/bots/policy';
import {ARCHETYPES,defaultProfile,seedStream} from '../../src/bots/profiles';
import {scenarios} from '../step4a/scenarios';
import {practiceProfile} from '../verification/helpers';
const cases=['flop-flushdraw','flop-cbet-air','turn-delayed-cbet','heads-up-checkraise','sixway-checkraise','turn-cheap-forced-flushdraw','river-marginal-halfpot','river-marginal-overbet','river-missed-flush','river-private-quads'];
describe('actual public-range service through complete committed betting sequences',()=>{
 it.each(cases)('%s finishes reproducibly through the authoritative engine with exact chip conservation',id=>{
  const source=scenarios().find(s=>s.id===id)!.state;
  const run=(seed:number)=>{
   let state=structuredClone(source);const random=seedStream(seed),trace:{actor:number;street:string;action:unknown;policy:string;equity:number|undefined}[]=[];
   for(let decisions=0;state.street!=='complete'&&decisions<120;decisions++){
    const actor=state.actor!,profile=defaultProfile(ARCHETYPES[(actor+seed)%ARCHETYPES.length]);
    const observation=observeBot(state,actor,profile.policyVersion,`sequence:${state.handId}:${state.revision}`),copy=structuredClone(observation);
    const analysis=analyzeDecision(observation,profile),decision=chooseDecision(observation,profile,random);
    expect(observation).toEqual(copy);expect(analysis.ranges?.equity).toBeGreaterThanOrEqual(0);expect(analysis.ranges?.equity).toBeLessThanOrEqual(1);
    expect(analysis.postflop?.modelVersion).toBe('public-range-postflop-1.6.0');
    const previous=structuredClone(state);state=applyCommand(state,decision);assertAccounting(state);
    expect(state.revision).toBe(previous.revision+1);expect(applyCommand(state,decision)).toEqual(state);
    trace.push({actor,street:observation.street,action:decision.action,policy:decision.policyVersion,equity:analysis.ranges?.equity});
   }
   expect(state.street).toBe('complete');expect(state.pot).toBe(0);
   expect(state.seats.reduce((sum,seat)=>sum+seat.stack,0)+state.rake).toBe(state.initialTotal);
   return {trace,payouts:state.payouts,stacks:state.seats.map(seat=>seat.stack),rake:state.rake};
  };
  const first=run(1467);expect(first.trace.length).toBeGreaterThan(0);expect(run(1467)).toEqual(first);
 });
});

it('reports the same physical position and premium trap component as the authoritative preflop advisory',()=>{
 let state=startHand({handId:'preflop-diagnostics',button:0,profile:practiceProfile(),seats:Array.from({length:6},(_,id)=>({id,name:`Seat ${id}`,stack:20000}))});
 state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:'first-fold',action:{type:'fold'}});
 expect(state.actor).toBe(4);
 const profile=defaultProfile('station'),observation=observeBot(state,4,profile.policyVersion,'middle-aces');observation.ownCards=['As','Ah'];
 const analysis=analyzeDecision(observation,profile);
 expect(analysis.preflop!.position).toBe('MP');expect(analysis.context.position).toBe('middle');
 expect(analysis.families.trap).toBe(analysis.preflop!.diagnostics.trapProbability);expect(analysis.families.trap).toBeGreaterThan(0);
 expect(analysis.families.value).toBe(analysis.preflop!.diagnostics.premiumValue);
});
