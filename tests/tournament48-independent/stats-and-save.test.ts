import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import {createProfile,seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V21,TOURNAMENT_POLICY_V22} from '../../src/tournament/bot-policy';
import {chooseTournamentV2 as frozen47} from './frozen-v47-policy';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {playStats,tournamentStats,type Who} from '../../src/tournament/stats';

const rules:RuleProfile={id:'independent48',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`ind:${g.revision}`,action});
const metric=(g:GameState,key:string,id:number)=>playStats([g],seat=>seat===id?['hero']:['field']).find(s=>s.key===key)!.rates.hero;

describe('independent Version 48 integrity and statistical fixtures',()=>{
 it('uses actual blind seats when the button is empty',()=>{
  let g=startHand({handId:'empty-button',button:2,profile:rules,seats:[0,1,3,4,5,6].map(id=>({id,name:`S${id}`,stack:8000}))});
  expect(g.smallBlindSeat).toBe(3);expect(g.bigBlindSeat).toBe(4);expect(g.actor).toBe(5);
  g=act(g,{type:'raise',to:400});
  while(g.actor!==4)g=act(g,{type:'fold'});
  g=act(g,{type:'call'});
  while(g.street!=='complete')g=act(g,{type:'fold'});
  expect(metric(g,'bbdefend',4)).toEqual({count:1,chances:1});
  expect(metric(g,'bbdefend',1)).toEqual({count:0,chances:0});
 });

 it.each(['call','raise'] as const)('counts a player who first %ss and later faces an all-in',opening=>{
  let g=startHand({handId:`returning-${opening}`,button:0,profile:rules,seats:[0,1,2,3].map(id=>({id,name:`S${id}`,stack:id===0?1200:4000}))});
  expect(g.actor).toBe(3);
  g=act(g,opening==='call'?{type:'call'}:{type:'raise',to:400});
  expect(g.actor).toBe(0);g=act(g,{type:'raise',to:1200});
  g=act(g,{type:'fold'});g=act(g,{type:'fold'});expect(g.actor).toBe(3);
  g=act(g,{type:'call'});expect(g.street).toBe('complete');
  expect(metric(g,'callallin',3)).toEqual({count:1,chances:1});
 });

 it('preserves complete Version 47 decisions and fingerprints, including standings stacks',()=>{
  for(const archetype of ['nit','station','stronger-reg','maniac'] as const)for(const depth of [6,18,40]){
   const p=createProfile({selection:archetype},147,'neutral');
   let g=startHand({handId:`frozen47:${archetype}:${depth}`,button:0,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`S${id}`,stack:depth*200+id*50}))});
   const context={playersLeft:8,paid:6,stacks:[...g.seats.map(s=>s.startingStack),400,10000]};
   for(let step=0;g.street!=='complete'&&step<80;step++){
    const o=observeBot(g,g.actor!,p.policyVersion,`old:${step}`);
    const expected=frozen47(o,p,seedStream(step+73),context);
    expect(chooseTournamentDecision(o,p,seedStream(step+73),TOURNAMENT_POLICY_V21,context)).toEqual(expected);
    g=applyCommand(g,expected);
   }
   expect(g.street).toBe('complete');
  }
 });

 it.each([['home-50',9],['daily-125',27]] as const)('reloads the exact regular field and prepared 2.2 decision in %s',async(preset,entrants)=>{
  const port=new MemoryTournamentPersistence();let c=new TournamentController(port);
  await c.init();await c.startEvent(preset,entrants,'fast');expect(c.error).toBe('');
  // Retain this as a Version 48 / policy 2.2 save compatibility fixture.
  const saved=structuredClone(c.data!);saved.active!.tournamentPolicyVersion=TOURNAMENT_POLICY_V22;
  c.close();await port.commit(saved.revision,{...saved,revision:saved.revision+1});c=new TournamentController(port);await c.init();expect(c.status,c.error).toBe('ready');
  for(let i=0;i<10&&(c.data!.active!.game.actor===0||c.data!.active!.game.street==='complete');i++){
   const g=c.data!.active!.game;
   if(g.street==='complete')await c.nextHand();else await c.act(c.gameView!.legal.check?{type:'check'}:{type:'fold'},g.handId,g.revision);
  }
  await c.prepareBot();expect(c.error).toBe('');
  const before=structuredClone(c.data!),pending=before.active!.pending!;
  expect(before.active!.tournamentPolicyVersion).toBe(TOURNAMENT_POLICY_V22);expect(pending.decision).toBeTruthy();c.close();
  const restored=new TournamentController(port);await restored.init();expect(restored.status,restored.error).toBe('ready');
  expect(restored.data!.active!.field).toEqual(before.active!.field);expect(restored.data!.active!.profiles).toEqual(before.active!.profiles);
  expect(restored.data!.active!.pending).toEqual(pending);
  await restored.prepareBot();expect(restored.data!.active!.pending).toEqual(pending);
  const next=applyCommand(restored.data!.active!.game,pending.decision!);
  await restored.commitBot(pending.handId,pending.revision);expect(restored.error).toBe('');expect(restored.data!.active!.game).toEqual(next);
  expect(()=>auditTournamentData(restored.data!)).not.toThrow();restored.close();
 });

 it('uses global player identity across archived MTT hands rather than reusing local seat numbers',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const data=structuredClone(c.data!),e=data.active!;c.close();
  const regularId=Number(Object.keys(e.field!.regulars).find(id=>Number(id)>2)!);
  const otherId=e.mtt!.state.players.find(p=>p.id>0&&p.id!==regularId&&!e.field!.regulars[String(p.id)])!.id;
  const names=new Map(e.mtt!.state.players.map(p=>[p.id,p.name]));
  const games=[0,1].map(n=>{
   let g=startHand({handId:`archived-stats-${n}`,button:0,profile:rules,seats:[0,regularId,otherId].map((player,id)=>({id,name:names.get(player)!,stack:8000}))});
   g=act(g,{type:'raise',to:400});g=act(g,{type:'call'});g=act(g,{type:'fold'});g=act(g,{type:'fold'});
   expect(g.street).toBe('complete');return g;
  });
  const hand=(n:number)=>({number:n+1,settledAt:`2026-11-18T00:00:0${n}Z`,state:games[n],frames:[]});
  e.history=[hand(1)];e.mtt!.blocks=[{id:'stats-archive',firstRound:1,lastRound:1,hands:[],heroHands:[hand(0)]}];
  e.finishes=[{seatId:0,name:'You',place:5,ties:1,prize:0,handId:games[1].handId}];
  const stats=tournamentStats(data),vpip=stats.play.find(s=>s.key==='vpip')!.rates;
  expect(stats.hands).toBe(2);expect(vpip.hero).toEqual({count:2,chances:2});expect(vpip.regulars).toEqual({count:2,chances:2});expect(vpip.field).toEqual({count:2,chances:4});
  const classify=(id:number):Who[]=>id===0?['hero']:id===1?['regulars','field']:['field'];
  expect(stats.play.map(s=>({key:s.key,hero:s.rates.hero,regulars:s.rates.regulars,field:s.rates.field}))).toEqual(playStats(games,classify).map(s=>({key:s.key,hero:s.rates.hero,regulars:s.rates.regulars,field:s.rates.field})));
 });
});
