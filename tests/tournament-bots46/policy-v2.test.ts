import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Card} from '../../src/contracts';
import {startHand,applyCommand,observeBot,assertAccounting} from '../../src/core/engine';
import {seedStream,createProfile,ARCHETYPES} from '../../src/bots/profiles';
import {chooseTournamentDecision,supportedTournamentPolicy,TOURNAMENT_BOT_POLICY_VERSION,NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {TOURNAMENT_POLICY_V2,analyzeTournamentV2,shoveFraction,tournamentStyle} from '../../src/tournament/bot-policy-v2';

const V=TOURNAMENT_POLICY_V2;
const rules:RuleProfile={id:'policy-v2-review',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const ref=createProfile({selection:'stronger-reg'},4601,'neutral');
const act=(s:GameState,action:Parameters<typeof applyCommand>[1]['action'])=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`step:${s.revision}`,action});
/** Nine-handed table, button seat 0, small blind 1, big blind 2. Every seat has depthBB big blinds. */
function table(depthBB:number,handId='v2'){return startHand({handId,button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:depthBB*200}))});}
/** Fold round to `seat` (optionally after a raise from `raiser` to `to`). */
function reach(s:GameState,seat:number,raiser?:number,to?:number){while(s.actor!==seat){s=s.actor===raiser&&to!==undefined&&!s.events.some(e=>e.action?.type==='raise')?act(s,{type:'raise',to}):act(s,{type:'fold'});}return s;}
function view(s:GameState,cards:Card[],profile=ref){const o=observeBot(s,s.actor!,profile.policyVersion,`v2:${s.revision}`);o.ownCards=cards;return o;}
const rate=(n:number,f:(seed:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};

describe('tournament policy 2.0.0',()=>{
 it('is superseded for new events by 2.1.0 and 2.2.0 while 2.0.0 and 1.0.0 stay supported for saved events',()=>{
  expect(supportedTournamentPolicy(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);expect(NEW_EVENT_TOURNAMENT_POLICY).not.toBe(V);
  for(const v of [undefined,TOURNAMENT_BOT_POLICY_VERSION,V])expect(supportedTournamentPolicy(v)).toBe(true);
  expect(supportedTournamentPolicy('synthetic-tournament-9.9.9')).toBe(false);
  const o=view(reach(table(30),3),['As','Ks']);
  expect(chooseTournamentDecision(o,ref,seedStream(3),V).observationHash.startsWith(V)).toBe(true);
  expect(chooseTournamentDecision(o,ref,seedStream(3),TOURNAMENT_BOT_POLICY_VERSION).observationHash.startsWith(TOURNAMENT_BOT_POLICY_VERSION)).toBe(true);
 });
 it('never folds aces, kings or queens before the flop at any depth or node',()=>{
  for(const archetype of ARCHETYPES){const p=createProfile({selection:archetype},77,'neutral');
   for(const depth of [4,9,15,25,60])for(const cards of [['As','Ah'],['Ks','Kh'],['Qs','Qh']] as Card[][])for(let seed=0;seed<6;seed++){
    const unopened=view(reach(table(depth),3),cards,p),facing=view(reach(table(depth),2,5,depth<=10?depth*200:500),cards,p);
    for(const o of [unopened,facing])expect(chooseTournamentDecision(o,p,seedStream(seed),V).action.type,`${archetype} ${depth}BB ${cards}`).not.toBe('fold');
   }}
 });
 it('folds seven-deuce offsuit first in under the gun for every archetype',()=>{
  for(const archetype of ARCHETYPES){const p=createProfile({selection:archetype},12,'neutral');for(const depth of [8,20,50])expect(rate(30,seed=>chooseTournamentDecision(view(reach(table(depth),3),['7s','2h'],p),p,seedStream(seed),V).action.type==='fold'),`${archetype} ${depth}`).toBeGreaterThan(.95);}
 });
 it('goes all-in rather than min-raising below its push depth, and raises small when deep',()=>{
  const short=view(reach(table(8),0),['Ad','7c']),deep=view(reach(table(60),0),['Ad','Jc']);
  const shoves=rate(40,seed=>{const d=chooseTournamentDecision(short,ref,seedStream(seed),V).action;return d.type==='raise'&&d.to===short.legal.maxRaiseTo;});
  expect(shoves).toBeGreaterThan(.9);
  for(let seed=0;seed<20;seed++){const d=chooseTournamentDecision(deep,ref,seedStream(seed),V).action;if(d.type==='raise')expect(d.to).toBeLessThanOrEqual(3*200);}
  expect(rate(20,seed=>chooseTournamentDecision(deep,ref,seedStream(seed),V).action.type==='raise')).toBeGreaterThan(.9);
 });
 it('opens wider on the button than under the gun, and loose players wider than tight ones',()=>{
  const btn=analyzeTournamentV2(view(reach(table(40),0),['9s','8s']),ref),utg=analyzeTournamentV2(view(reach(table(40),3),['9s','8s']),ref);
  expect(btn.target).toBeGreaterThan(utg.target*2);
  const nit=createProfile({selection:'nit'},5,'neutral'),maniac=createProfile({selection:'maniac'},5,'neutral'),o=reach(table(40),0);
  expect(analyzeTournamentV2(view(o,['9s','8s'],maniac),maniac).target).toBeGreaterThan(analyzeTournamentV2(view(o,['9s','8s'],nit),nit).target*1.8);
  expect(shoveFraction(8,1)).toBeGreaterThan(shoveFraction(8,8)*4);expect(shoveFraction(5,2)).toBeGreaterThan(shoveFraction(12,2));
 });
 it('defends the big blind more often against the button than against under the gun',()=>{
  const hands:Card[][]=[['Kd','7c'],['Qs','8h'],['Jd','9d'],['Ts','6s'],['8c','7d'],['As','4d'],['5s','5d'],['Kh','Tc']];
  const defend=(raiser:number)=>hands.reduce((sum,cards)=>sum+rate(10,seed=>chooseTournamentDecision(view(reach(table(40),2,raiser,450),cards),ref,seedStream(seed),V).action.type!=='fold'),0)/hands.length;
  expect(defend(0)).toBeGreaterThan(defend(3)+.2);
 });
 it('calls a short all-in wider than a deep one and tighter when the price is worse',()=>{
  const shover=(bb:number)=>{const s=startHand({handId:`shove${bb}`,button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:(id===0?bb:40)*200}))});return analyzeTournamentV2(view(reach(s,2,0,bb*200),['Kd','9c']),ref);};
  const short=shover(5),deep=shover(30);
  expect(short.node).toBe('facing-all-in');expect(deep.node).toBe('facing-all-in');expect(short.target).toBeGreaterThan(deep.target);
 });
 it('makes flop continuation bets as the raiser, more often for aggressive players',()=>{
  const flop=(p:ReturnType<typeof createProfile>,seed:number)=>{let s=reach(table(40,`cb${seed}`),0);s=act(s,{type:'raise',to:450});while(s.actor!==2)s=act(s,{type:'fold'});s=act(s,{type:'call'});s=act(s,{type:'check'});return view(s,s.seats.find(x=>x.id===0)!.hole,p);};
  const cbet=(archetype:'stronger-reg'|'maniac'|'station')=>{const p=createProfile({selection:archetype},31,'neutral');return rate(60,seed=>chooseTournamentDecision(flop(p,seed),p,seedStream(seed),V).action.type==='raise');};
  const reg=cbet('stronger-reg'),maniac=cbet('maniac'),station=cbet('station');
  expect(reg).toBeGreaterThan(.45);expect(maniac).toBeGreaterThan(station);
  expect(tournamentStyle(createProfile({selection:'maniac'},1,'neutral')).cbet).toBeGreaterThan(tournamentStyle(createProfile({selection:'station'},1,'neutral')).cbet);
 });
 it('is deterministic, leaves its input unchanged, and cannot read other players\' cards or the deck',()=>{
  const o=view(reach(table(12),0),['Ah','5h']),before=JSON.stringify(o),secret=Object.assign({},o);
  Object.defineProperty(secret,'deck',{get(){throw Error('deck access');}});for(const s of secret.seats)Object.defineProperty(s,'hole',{get(){throw Error('other private cards');}});
  expect(chooseTournamentDecision(secret,ref,seedStream(888),V)).toEqual(chooseTournamentDecision(o,ref,seedStream(888),V));expect(JSON.stringify(o)).toBe(before);
 });
 it('does not depend on physical seat numbers',()=>{
  const a=view(reach(table(12),0),['As','5s']),b=structuredClone(a),rotate=(id:number)=>(id+4)%9;
  b.actingSeat=rotate(a.actingSeat);b.button=rotate(a.button);b.legal.actor=rotate(a.legal.actor!);b.seats=b.seats.map(s=>({...s,id:rotate(s.id)})).sort((x,y)=>x.id-y.id);b.publicEvents=b.publicEvents.map(e=>({...e,...e.seatId===undefined?{}:{seatId:rotate(e.seatId)}}));
  for(let seed=0;seed<10;seed++)expect(chooseTournamentDecision(a,ref,seedStream(seed),V).action).toEqual(chooseTournamentDecision(b,ref,seedStream(seed),V).action);
 });
 it.each(ARCHETYPES)('plays complete legal hands with antes and uneven stacks as %s',archetype=>{
  const profile=createProfile({selection:archetype},99,'neutral');
  for(let seed=0;seed<12;seed++){let s=startHand({handId:`${archetype}:${seed}`,button:seed%9,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:200*(2+((seed*7+id*5)%60))}))});
   for(let count=0;s.street!=='complete'&&count<200;count++){const o=observeBot(s,s.actor!,profile.policyVersion,`bot:${count}`);s=applyCommand(s,chooseTournamentDecision(o,profile,seedStream(seed*1000+count),V));assertAccounting(s);}
   expect(s.street).toBe('complete');}
 });
});
