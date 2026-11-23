import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Card} from '../../src/contracts';
import {startHand,applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {chooseTournamentDecision,supportedTournamentPolicy,policyUsesStandings,TOURNAMENT_BOT_POLICY_VERSION,TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21,NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {analyzeTournamentV2,bubbleAwareness,bubbleFactor,bubblePressure,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {chooseTournamentV2 as frozenV2} from './frozen-v46-policy-v2';

const rules:RuleProfile={id:'policy-v21-review',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const ref=createProfile({selection:'stronger-reg'},4701,'neutral');
const act=(s:GameState,action:Parameters<typeof applyCommand>[1]['action'])=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`step:${s.revision}`,action});
/** Nine-handed table, button 0; `stacks` in big blinds per seat (default all `depth`). */
function table(depth:number,stacks:Record<number,number>={},handId='v21'){return startHand({handId,button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:(stacks[id]??depth)*200}))});}
function reach(s:GameState,seat:number,raiser?:number,to?:number){while(s.actor!==seat){s=s.actor===raiser&&to!==undefined&&!s.events.some(e=>e.action?.type==='raise')?act(s,{type:'raise',to}):act(s,{type:'fold'});}return s;}
function view(s:GameState,cards:Card[],profile=ref){const o=observeBot(s,s.actor!,profile.policyVersion,`v21:${s.revision}`);o.ownCards=cards;return o;}
/** Field standings: `left` players, `paid` places, own table stacks plus filler stacks of `filler` chips. */
function standings(left:number,paid:number,game:GameState,filler=20*200):TournamentContext {
 const table=game.seats.map(s=>s.startingStack),stacks=[...table,...Array.from({length:Math.max(0,left-table.length)},()=>filler)].slice(0,left);
 return {playersLeft:left,paid,stacks};
}

describe('tournament policy 2.1.0 (bubble and pay jumps)',()=>{
 it('was the policy for new events until 2.2.0, reads standings, and 2.0.0 and 1.0.0 stay supported',()=>{
  expect(supportedTournamentPolicy(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);expect(NEW_EVENT_TOURNAMENT_POLICY).not.toBe(TOURNAMENT_POLICY_V21);
  for(const v of [undefined,TOURNAMENT_BOT_POLICY_VERSION,TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21])expect(supportedTournamentPolicy(v)).toBe(true);
  expect(policyUsesStandings(TOURNAMENT_POLICY_V21)).toBe(true);for(const v of [undefined,TOURNAMENT_BOT_POLICY_VERSION,TOURNAMENT_POLICY_V2])expect(policyUsesStandings(v)).toBe(false);
  const g=reach(table(30),3),o=view(g,['As','Ks']);
  expect(()=>chooseTournamentDecision(o,ref,seedStream(1),TOURNAMENT_POLICY_V21)).toThrow(/standings/);
  expect(()=>chooseTournamentDecision(o,ref,seedStream(1),TOURNAMENT_POLICY_V21,{playersLeft:3,paid:2,stacks:[1,2]})).toThrow(/standings/);
  expect(chooseTournamentDecision(o,ref,seedStream(1),TOURNAMENT_POLICY_V21,standings(27,4,g)).observationHash.startsWith(TOURNAMENT_POLICY_V21)).toBe(true);
 });
 it('keeps 2.0.0 decisions identical to the frozen Version 46 policy, standings or not',()=>{
  let compared=0;
  for(const archetype of ARCHETYPES)for(const depth of [4,11,22,60]){
   const profile=createProfile({selection:archetype},48,'neutral');
   let game=startHand({handId:`frozen46:${archetype}:${depth}`,button:depth%9,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:depth*200+id*150}))});
   for(let step=0;game.street!=='complete'&&step<200;step++){
    const o=observeBot(game,game.actor!,profile.policyVersion,`frozen46:${step}`);
    const actual=chooseTournamentDecision(o,profile,seedStream(step*7+depth),TOURNAMENT_POLICY_V2,standings(12,4,game));
    expect(actual).toEqual(frozenV2(o,profile,seedStream(step*7+depth)));
    game=applyCommand(game,actual);assertAccounting(game);compared++;
   }
   expect(game.street).toBe('complete');
  }
  expect(compared).toBeGreaterThan(150);
 });
 it('plays exactly like 2.0.0 when no pay jump is near',()=>{
  let compared=0;
  for(const archetype of ARCHETYPES)for(const depth of [6,15,40]){
   const profile=createProfile({selection:archetype},49,'neutral');
   let game=startHand({handId:`far:${archetype}:${depth}`,button:2,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:depth*200+id*100}))});
   for(let step=0;game.street!=='complete'&&step<200;step++){
    const o=observeBot(game,game.actor!,profile.policyVersion,`far:${step}`),far=standings(90,13,game);expect(bubblePressure(far)).toBe(0);
    const a=chooseTournamentDecision(o,profile,seedStream(step+depth),TOURNAMENT_POLICY_V21,far),b=chooseTournamentDecision(o,profile,seedStream(step+depth),TOURNAMENT_POLICY_V2);
    expect(a.action).toEqual(b.action);game=applyCommand(game,a);compared++;
   }
  }
  expect(compared).toBeGreaterThan(60);
 });
 it('rises toward the money bubble, eases in the money, and vanishes heads-up',()=>{
  const p=(left:number,paid:number)=>bubblePressure({playersLeft:left,paid,stacks:Array(left).fill(1000)});
  expect(p(30,4)).toBe(0);expect(p(6,4)).toBeLessThan(p(5,4));expect(p(5,4)).toBeGreaterThan(.7);
  expect(p(4,4)).toBeLessThan(p(5,4));expect(p(4,4)).toBeGreaterThan(0);expect(p(3,4)).toBeLessThan(p(4,4));expect(p(2,4)).toBe(0);
  expect(p(14,13)).toBeGreaterThan(p(25,13));
 });
 it('gives medium covered stacks the biggest bubble factor, and weighs it by archetype',()=>{
  const c:TournamentContext={playersLeft:5,paid:4,stacks:[20000,20000,20000,20000,20000]},bb=1000;
  const covered=bubbleFactor(c,ref,20000,30000,bb),covering=bubbleFactor(c,ref,20000,10000,bb),short=bubbleFactor(c,ref,4000,30000,bb);
  expect(covered).toBeGreaterThan(1.5);expect(covering).toBeLessThan(covered);expect(short).toBeLessThan(covered);
  const station=createProfile({selection:'station'},1,'neutral'),nit=createProfile({selection:'nit'},1,'neutral'),maniac=createProfile({selection:'maniac'},1,'neutral');
  expect(bubbleAwareness(station)).toBeLessThan(bubbleAwareness(nit));expect(bubbleAwareness(maniac)).toBeLessThan(bubbleAwareness(ref));
  expect(bubbleFactor(c,station,20000,30000,bb)).toBeLessThan(covered);
  expect(bubbleFactor({...c,playersLeft:40,stacks:Array(40).fill(20000)},ref,20000,30000,bb)).toBe(1);
 });
 it('calls an all-in tighter on the bubble when covered, but not when it covers the shover',()=>{
  // Seat 0 (button) moves all-in; seat 2 (big blind) decides. Medium stacks; field of 5 with 4 paid vs 27 left.
  const facing=(shover:number,me:number,left:number)=>{const g=reach(table(20,{0:shover,2:me}),2,0,shover*200);return analyzeTournamentV2(view(g,['Kd','Tc']),ref,standings(left,4,g,me*200));};
  const bubble=facing(25,20,5),early=facing(25,20,27),covering=facing(12,30,5);
  expect(bubble.node).toBe('facing-all-in');expect(bubble.bubble).toBeGreaterThan(1.4);expect(bubble.target).toBeLessThan(early.target*.8);
  expect(early.bubble).toBe(1);expect(covering.bubble).toBeLessThan(bubble.bubble);
 });
 it('opens wider with a big stack on the bubble and tighter with a covered medium stack',()=>{
  const g=reach(table(20,{0:60}),0),big=analyzeTournamentV2(view(g,['Qd','8c']),ref,standings(5,4,g,15*200)),bigEarly=analyzeTournamentV2(view(g,['Qd','8c']),ref,standings(27,4,g,15*200));
  expect(big.target).toBeGreaterThan(bigEarly.target);
  const m=reach(table(20,{4:60}),0),medium=analyzeTournamentV2(view(m,['Qd','8c']),ref,standings(5,4,m,60*200)),mediumEarly=analyzeTournamentV2(view(m,['Qd','8c']),ref,standings(27,4,m,60*200));
  expect(medium.target).toBeLessThan(mediumEarly.target);
 });
 it.each(ARCHETYPES)('plays complete legal hands near the bubble as %s',archetype=>{
  const profile=createProfile({selection:archetype},77,'neutral');
  for(let seed=0;seed<10;seed++){let s=startHand({handId:`${archetype}:${seed}`,button:seed%9,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:200*(2+((seed*7+id*5)%40))}))});
   const field=standings(10,9,s);
   for(let count=0;s.street!=='complete'&&count<200;count++){const o=observeBot(s,s.actor!,profile.policyVersion,`bot:${count}`);s=applyCommand(s,chooseTournamentDecision(o,profile,seedStream(seed*1000+count),TOURNAMENT_POLICY_V21,field));assertAccounting(s);}
   expect(s.street).toBe('complete');}
 });
});
