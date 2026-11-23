import {describe,it,expect} from 'vitest';
import type {Action,BotObservation,BotProfile,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {icmEquities,icmBubbleFactor} from '../../src/tournament/icm';
import {icmFactor,analyzeTournamentV2,bubbleAwareness,chooseTournamentV2,validContext,type TournamentContext} from '../../src/tournament/bot-policy-v2';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V25,TOURNAMENT_POLICY_V26} from '../../src/tournament/bot-policy';
import {regularProfile,regularHabitsForProfile} from '../../src/bots/regulars';
import {seedStream} from '../../src/bots/profiles';
import {humanSizing,moodFrom,moodProfile,stackMood,type HandResult} from '../../src/bots/human';
import {readsProfile,emptyReads,type HeroReads} from '../../src/bots/reads';
import {applyHabits,applyMinRaise,habitsOf} from '../../src/bots/habits';
import {createMttEvent} from '../../src/tournament/mtt-event';
import {mttStandings,standingsAtTable} from '../../src/tournament/multi-table';
import {tournamentStandings} from '../../src/tournament/runtime';
import {EVENT_PRESETS} from '../../src/tournament/presets';

const rules:RuleProfile={id:'independent-icm52',version:'1',mode:'tournament',smallBlind:50,bigBlind:100,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:100,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`step:${g.revision}`,action});
const priya=regularProfile('priya','high');
function faced(){let g=startHand({handId:'icm52-ante-mapping',button:0,profile:rules,seats:[1000,5000,1100,5000].map((stack,id)=>({id,name:`P${id}`,stack}))});expect(g.actor).toBe(3);g=act(g,{type:'raise',to:5000});g=act(g,{type:'fold'});g=act(g,{type:'fold'});expect(g.actor).toBe(2);return g;}
const context=():TournamentContext=>({playersLeft:4,paid:3,stacks:[1000,5000,1100,5000],prizes:[5000,3000,2000,0],playerIds:[40,71,9,26],seatPlayers:{0:40,1:71,2:9,3:26}});

// Independent literal enumeration: probability of each complete finishing permutation.
function enumerate(stacks:readonly number[],prizes:readonly number[]):number[]{const out=stacks.map(()=>0);const walk=(remaining:number[],order:number[],probability:number)=>{if(!remaining.length){for(let k=0;k<order.length;k++)out[order[k]]+=probability*(prizes[k]??0);return;}const chips=remaining.reduce((n,i)=>n+stacks[i],0);for(const i of remaining){const p=chips?stacks[i]/chips:1/remaining.length;if(p)walk(remaining.filter(j=>j!==i),[...order,i],probability*p);}};walk(stacks.map((_,i)=>i),[],1);return out;}

// Frozen Version51 2.5 dispatch body. All changed ICM paths must be dormant here.
function frozen25(o:BotObservation,profile:BotProfile,random:()=>number,standings:TournamentContext,recent:HandResult[],reads:HeroReads){
 const own=o.seats.find(s=>s.id===o.actingSeat)!,total=own.stack+own.totalCommitted,average=standings.stacks.reduce((a,b)=>a+b,0)/standings.playersLeft;
 const mood={...moodFrom(recent,profile),...stackMood(total/o.bigBlind,total/average)},read=readsProfile(o,moodProfile(profile,mood),reads),decision=chooseTournamentV2(o,read.profile,random,standings,true);
 const hash=`${TOURNAMENT_POLICY_V25}:${decision.observationHash.slice(decision.observationHash.indexOf(':')+1)}:${mood.tilt.toFixed(3)}/${mood.heater.toFixed(3)}/${(mood.desperate??0).toFixed(3)}/${(mood.bigStack??0).toFixed(3)}:${read.effect?.applied.join('+')??'-'}`;
 const habits=habitsOf(profile,regularHabitsForProfile(profile)),habit=applyHabits(o,profile,decision.action,habits,random);
 return {...decision,observationHash:`${hash}:${habit.habit??'-'}`,action:applyMinRaise(o,humanSizing(o,profile,habit.action,random),habits,random).action};
}

describe('independent final-table ICM boundaries',()=>{
 it('matches independent permutation enumeration for unequal, zero and tied stacks',()=>{
  for(const stacks of [[1,2,4,8],[400,50,1200,800,200,450],[0,0,250,750],[0,0,0]]){
   const prizes=stacks.map((_,i)=>(stacks.length-i)**2*10),want=enumerate(stacks,prizes),got=icmEquities(stacks,prizes);
   for(let i=0;i<stacks.length;i++)expect(got[i]).toBeCloseTo(want[i],9);
   expect(got.reduce((a,b)=>a+b,0)).toBeCloseTo(prizes.reduce((a,b)=>a+b,0),9);
   expect(icmEquities(stacks.map(n=>n*100),prizes)).toEqual(got);
  }
 });
 it('validates public math inputs and keeps flat/winner-take-all pressure finite',()=>{
  expect(()=>icmEquities([-1,2],[1])).toThrow();expect(()=>icmEquities([NaN,2],[1])).toThrow();expect(()=>icmEquities([1,2],[1,2])).toThrow();
  expect(()=>icmBubbleFactor([1,2],[1],0,0)).toThrow();expect(()=>icmBubbleFactor([1,2],[1],0,2)).toThrow();
  expect(icmBubbleFactor([200,800,1000],[100],0,1)).toBeCloseTo(1,10);expect(icmBubbleFactor([200,800,1000],[10,10,10],0,1)).toBe(1);
  expect(icmEquities([],[])).toEqual([]);
 });
 it('does not confuse the ante-paying big blind with another player of the same remaining stack',()=>{
  const g=faced(),o=observeBot(g,2,priya.policyVersion,'icm52-ante'),c=context(),own=o.seats.find(s=>s.id===2)!;
  expect(own.deadAnte).toBe(100);expect(own.stack+own.totalCommitted-own.deadAnte!).toBe(1000);
  const raw=icmBubbleFactor(c.stacks,c.prizes!,2,3),want=Math.min(3,1+(raw-1)*bubbleAwareness(priya,true));
  expect(analyzeTournamentV2(o,priya,c,true,true).bubble).toBeCloseTo(want,12);
  expect(icmFactor(c,priya,1000,5000,true,{me:9,opponent:26})).toBeCloseTo(want,12);
  expect(icmFactor({playersLeft:4,paid:3,stacks:c.stacks,prizes:c.prizes},priya,1050,5000,true)).toBeNull();
 });
 it('is invariant to standings order when identities and their stacks move together',()=>{
  const g=faced(),o=observeBot(g,2,priya.policyVersion,'icm52-order'),a=context(),b={...a,stacks:[5000,1100,5000,1000],playerIds:[26,9,71,40]};
  expect(analyzeTournamentV2(o,priya,a,true,true)).toEqual(analyzeTournamentV2(o,priya,b,true,true));
  expect(validContext({...a,playerIds:[1,1,2,3]})).toBe(false);expect(validContext({...a,seatPlayers:{0:999}})).toBe(false);
 });
 it('binds the new decision hash to prizes and mappings while old policies ignore them',()=>{
  const o=observeBot(faced(),2,priya.policyVersion,'icm52-hash'),a=context(),b={...a,prizes:[6000,2500,1500,0]};
  const decide=(version:string,c:TournamentContext)=>chooseTournamentDecision(o,priya,seedStream(1234),version,c);
  expect(decide(TOURNAMENT_POLICY_V26,a).observationHash).not.toBe(decide(TOURNAMENT_POLICY_V26,b).observationHash);
  expect(decide(TOURNAMENT_POLICY_V26,a).observationHash).not.toBe(decide(TOURNAMENT_POLICY_V26,{...a,seatPlayers:{...a.seatPlayers,2:26,3:9}}).observationHash);
  expect(decide(TOURNAMENT_POLICY_V25,a)).toEqual(decide(TOURNAMENT_POLICY_V25,b));
 });
 it('maps physical seats to global players at Hero and watched MTT tables',()=>{
  let hand=0;const random=seedStream(417),e=createMttEvent({id:'mapping52',preset:EVENT_PRESETS.find(p=>p.id==='daily-125')!,entrants:27,pace:'fast',startedAt:'2026-11-18T00:00:00Z'},{random:n=>Math.floor(random()*n),token:()=>Math.floor(random()*0xffffffff),handId:()=>`mapping52-${hand++}`});
  const state=e.mtt!.state,base=mttStandings(state,true);expect(base.playerIds).toEqual(state.players.map(p=>p.id));
  let nonIdentity=0;
  for(const table of state.tables){
   const c=standingsAtTable(base,table);expect(validContext(c)).toBe(true);
   for(const seat of table.game.seats.filter(s=>s.startingStack>0)){
    const expected=table.seats[(seat.id+table.offset)%9]!;expect(c.seatPlayers![seat.id]).toBe(expected);expect(state.players[expected].name).toBe(seat.name);if(expected!==seat.id)nonIdentity++;
   }
   // The public event projection must bind the currently watched hand, not always Hero's table.
   e.game=table.game;expect(tournamentStandings(e)).toEqual(c);
  }expect(nonIdentity).toBeGreaterThan(10);
 });
 it('evaluates ten-player equity and symmetric pressure without factorial work',()=>{
  const stacks=Array.from({length:10},(_,i)=>(i+1)*1000),prizes=[100,70,50,35,25,15,10,5,0,0],start=performance.now();
  for(let i=0;i<20;i++){const eq=icmEquities(stacks,prizes);expect(eq.reduce((a,b)=>a+b,0)).toBeCloseTo(310,8);expect(Number.isFinite(icmBubbleFactor(stacks,prizes,i%10,(i+1)%10))).toBe(true);}
  console.log(JSON.stringify({evidence:'independent52-icm-ten-player',calls:80,elapsedMs:performance.now()-start}));
 });
 it('preserves old 2.5 decisions and RNG consumption through complete hands with antes',()=>{
  let compared=0;const reads=emptyReads(),recent:HandResult[]=[{deltaBB:-40,showdownLoss:true,share:-.5}];reads.hands=80;reads.foldToCbet={count:60,chances:80};
  for(const id of ['priya','big-earl','nina','yuki'])for(let seed=0;seed<3;seed++){
   const profile=regularProfile(id,'mid');let g=startHand({handId:`icm52-old:${id}:${seed}`,button:seed,profile:rules,seats:[1000,5000,1100,5000].map((stack,i)=>({id:i,name:`P${i}`,stack}))});
   for(let step=0;g.street!=='complete'&&step<150;step++){
    const o=observeBot(g,g.actor!,profile.policyVersion,`old52:${step}`),aRng=seedStream(seed*1000+step),bRng=seedStream(seed*1000+step),c=context();
    const a=chooseTournamentDecision(o,profile,aRng,TOURNAMENT_POLICY_V25,c,recent,reads),b=frozen25(o,profile,bRng,c,recent,reads);
    expect(a).toEqual(b);expect(aRng()).toBe(bRng());g=applyCommand(g,a);compared++;
   }expect(g.street).toBe('complete');
  }expect(compared).toBeGreaterThan(40);
 });
});
