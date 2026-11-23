import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action,Card,BotObservation,BotProfile} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {seedStream} from '../../src/bots/profiles';
import {regularProfile} from '../../src/bots/regulars';
import {pushRange,callRange,handRank,pushFold,chartUse,chartBend} from '../../src/tournament/push-fold';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,TOURNAMENT_POLICY_V27,TOURNAMENT_POLICY_V28,supportedTournamentPolicy} from '../../src/tournament/bot-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
const rules:RuleProfile={id:'habits',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(s:GameState,a:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action:a});
const rate=(n:number,f:(i:number)=>boolean)=>{let k=0;for(let i=0;i<n;i++)if(f(i))k++;return k/n;};
const hiro=regularProfile('hiro','high'),dot=regularProfile('dot','low'),tex=regularProfile('tex','low'),hank=regularProfile('hank','low');
const far={playersLeft:60,paid:9,stacks:Array(60).fill(8000)},bubble={playersLeft:10,paid:9,stacks:Array(10).fill(8000)};
/** 9-handed, button 0; folded to `actor`, who has `bb` big blinds; everyone else 40 BB. */
function firstIn(actor:number,bb:number,id='f'){const st=Array(9).fill(8000);st[actor]=bb*200;let s=startHand({handId:id,button:0,profile:rules,seats:st.map((stack,i)=>({id:i,name:`S${i}`,stack}))});while(s.actor!==actor)s=act(s,{type:'fold'});return s;}
function view(s:GameState,cards:Card[],p:BotProfile=hiro):BotObservation{const o=observeBot(s,s.actor!,p.policyVersion,'v');o.ownCards=cards;return o;}
const max=(s:GameState)=>view(s,['2c','3d']).legal.maxRaiseTo!;

describe('push/fold chart',()=>{
 it('ranges shrink with depth and with players behind, calls widen with a better price',()=>{
  for(let b=3;b<15;b++)expect(pushRange(b+1,2)).toBeLessThan(pushRange(b,2));
  for(let n=1;n<8;n++)expect(pushRange(10,n+1)).toBeLessThan(pushRange(10,n));
  expect(pushRange(10,8)).toBeGreaterThan(.12);expect(pushRange(10,8)).toBeLessThan(.22);// UTG, 9-handed
  expect(pushRange(10,2)).toBeGreaterThan(.45);expect(pushRange(10,2)).toBeLessThan(.65);// button
  expect(pushRange(10,2,false)).toBeLessThan(pushRange(10,2));
  expect(callRange(.5,.3,0)).toBeGreaterThan(callRange(.5,.45,0));expect(callRange(.5,.4,2)).toBeLessThan(callRange(.5,.4,0));
  expect(handRank(['As','Ad'])).toBeLessThan(.01);expect(handRank(['7c','2d'])).toBeGreaterThan(.9);expect(handRank(['Ah','5c'])).toBeLessThan(handRank(['Jh','8c']));
 });
 it('skilled players follow the chart; weak players often keep their own habits; risk-takers go wider',()=>{
  expect(chartUse(hiro)).toBe(1);expect(chartUse(dot)).toBeLessThan(chartUse(hiro));
  expect(chartBend(tex)).toBeGreaterThan(1);expect(chartBend(hank)).toBeLessThan(1);expect(Math.abs(chartBend(hiro)-1)).toBeLessThan(.2);
 });
});

describe('push/fold decisions',()=>{
 it('first in at 10 BB: shove strong hands all-in, fold trash, never limp; deep or a free check is not a push/fold spot',()=>{
  const s=firstIn(0,10),aa=pushFold(view(s,['As','Ad']),hiro,far,seedStream(1))!,trash=pushFold(view(s,['7c','2d']),hiro,far,seedStream(1))!;
  expect(aa.play).toBe('shove');expect(aa.action).toEqual({type:'raise',to:max(s)});expect(()=>act(s,aa.action)).not.toThrow();
  expect(trash.play).toBe('fold');expect(trash.action).toEqual({type:'fold'});
  expect(pushFold(view(firstIn(0,25),['As','Ad']),hiro,far,seedStream(1))).toBeNull();
  // Folded to the big blind's walk is impossible; a limped pot to the big blind can be shoved.
  let l=firstIn(1,10);l=act(l,{type:'call'});const bb=pushFold(view(l,['Kd','Qd']),hiro,far,seedStream(2));expect(bb?.play).toBe('shove');
  expect(pushFold(view(l,['7c','2d']),hiro,far,seedStream(2))!.action).toEqual({type:'check'});
 });
 it('shove rates follow position: wider on the button than under the gun',()=>{
  const deal=(i:number):Card[]=>{const R='23456789TJQKA',S='cdhs',r=seedStream(i*7+1),a=R[Math.floor(r()*13)]+S[Math.floor(r()*4)];let b=a;while(b===a)b=R[Math.floor(r()*13)]+S[Math.floor(r()*4)];return [a,b];};
  const utg=firstIn(3,10,'u'),btn=firstIn(0,10,'b');
  const u=rate(800,i=>pushFold(view(utg,deal(i)),hiro,far,seedStream(i))?.play==='shove'),b=rate(800,i=>pushFold(view(btn,deal(i)),hiro,far,seedStream(i))?.play==='shove');
  expect(u).toBeGreaterThan(.1);expect(u).toBeLessThan(.25);expect(b).toBeGreaterThan(.4);expect(b).toBeLessThan(.7);
  // Prize pressure on the bubble narrows the range.
  const onBubble=rate(800,i=>pushFold(view(btn,deal(i)),hiro,bubble,seedStream(i))?.play==='shove');expect(onBubble).toBeLessThan(b);
 });
 it('calling an all-in by price; re-shoving over a late open; legal throughout',()=>{
  let s=firstIn(0,10,'c');s=act(s,{type:'raise',to:max(s)});while(s.actor!==2)s=act(s,{type:'fold'});
  const call=pushFold(view(s,['Ah','9c']),hiro,far,seedStream(3))!;expect(call.play).toBe('call');expect(()=>act(s,call.action)).not.toThrow();
  expect(pushFold(view(s,['8c','3d']),hiro,far,seedStream(3))!.play).toBe('fold');
  // A 30 BB all-in is not a push/fold call.
  let deep=firstIn(0,30,'d');deep=act(deep,{type:'raise',to:max(deep)});while(deep.actor!==2)deep=act(deep,{type:'fold'});expect(pushFold(view(deep,['Ah','9c']),hiro,far,seedStream(3))).toBeNull();
  // Button opens to 2.2 BB; big blind with 15 BB re-shoves strong hands, leaves the rest to the earlier policy.
  const st=Array(9).fill(8000);st[2]=3000;let r=startHand({handId:'rs',button:0,profile:rules,seats:st.map((stack,i)=>({id:i,name:`S${i}`,stack}))});
  while(r.actor!==0)r=act(r,{type:'fold'});r=act(r,{type:'raise',to:440});r=act(r,{type:'fold'});
  const re=pushFold(view(r,['Ah','Qc']),hiro,far,seedStream(4))!;expect(re.play).toBe('reshove');expect(()=>act(r,re.action)).not.toThrow();
  expect(pushFold(view(r,['9h','6c']),hiro,far,seedStream(4))).toBeNull();
  let u=startHand({handId:'ru',button:0,profile:rules,seats:st.map((stack,i)=>({id:i,name:`S${i}`,stack}))});u=act(u,{type:'raise',to:440});while(u.actor!==2)u=act(u,{type:'fold'});
  expect(pushFold(view(u,['Ah','Qc']),hiro,far,seedStream(4))).toBeNull();// under-the-gun open: no re-shove chart
 });
});

describe('tournament policy 2.8.0',()=>{
 it('push/fold reaches 2.8.0 decisions only; 2.7.0 stays supported',()=>{
  expect(Number(NEW_EVENT_TOURNAMENT_POLICY.split('.')[1])).toBeGreaterThanOrEqual(8);void TOURNAMENT_POLICY_V28;expect(supportedTournamentPolicy(TOURNAMENT_POLICY_V27)).toBe(true);
  const o=view(firstIn(0,10,'p'),['Kd','Js']);
  const d=chooseTournamentDecision(o,hiro,seedStream(5),TOURNAMENT_POLICY_V28,far,[],null,{});expect(d.observationHash).toMatch(/:pf:(shove|fold):/);
  expect(chooseTournamentDecision(o,hiro,seedStream(5),TOURNAMENT_POLICY_V27,far,[],null,{}).observationHash).not.toContain(':pf:');
  // Skilled players stop limping short; limp-callers still sometimes limp.
  const deal=(i:number):Card[]=>{const R='23456789TJQKA',S='cdhs',r=seedStream(i*11+3),a=R[Math.floor(r()*13)]+S[Math.floor(r()*4)];let b=a;while(b===a)b=R[Math.floor(r()*13)]+S[Math.floor(r()*4)];return [a,b];};
  const limps=(p:BotProfile)=>rate(600,i=>chooseTournamentDecision(view(firstIn(0,10,`l${i}`),deal(i),p),p,seedStream(i),TOURNAMENT_POLICY_V28,far,[],null,{}).action.type==='call');
  expect(limps(hiro)).toBe(0);expect(limps(dot)).toBeGreaterThan(.03);
 });
 it('new events use 2.8.0 and pass the full audit',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  expect(c.data!.active!.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);
  for(let guard=0;guard<4000&&c.data!.active!.handNumber<=10&&c.data!.active!.status==='running';guard++){const a=c.data!.active!,g=c.gameView!;
   if(a.game.street==='complete'){await c.nextHand();continue;}
   if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(a.game.handId,a.game.revision);}expect(c.error).toBe('');}
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 },180000);
});
