import {describe,it,expect} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData,tournamentStandings} from '../../src/tournament/runtime';
import {mttProfileAt} from '../../src/tournament/mtt-event';
import {applyCommand,observeBot,startHand} from '../../src/core/engine';
import {createProfile,seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21} from '../../src/tournament/bot-policy';
import {chooseTournamentV2 as frozenV2} from '../tournament-bots47/frozen-v46-policy-v2';
import type {RuleProfile} from '../../src/contracts';

async function step(c:TournamentController){
 const e=c.data!.active!;
 if(e.game.street==='complete')await c.nextHand();
 else if(e.game.actor===0)await c.act(c.gameView!.legal.check?{type:'check'}:{type:'fold'},e.game.handId,e.game.revision);
 else {await c.prepareBot();await c.commitBot(e.game.handId,e.game.revision);}
 expect(c.error).toBe('');
}
async function handComplete(c:TournamentController){
 for(let n=0;c.data!.active!.game.street!=='complete'&&n<200;n++)await step(c);
 expect(c.data!.active!.game.street).toBe('complete');
}

describe('independent prepared-policy and ahead ownership checks',()=>{
 for(const version of [TOURNAMENT_POLICY_V2,TOURNAMENT_POLICY_V21])it.each([['home-50',9],['daily-125',27]] as const)(`${version} prepared decision survives %s reload and full audit`,async(preset,entrants)=>{
  const port=new MemoryTournamentPersistence(),initial=new TournamentController(port);
  await initial.init();await initial.startEvent(preset,entrants,'fast');expect(initial.error).toBe('');
  const save=structuredClone(initial.data!);save.active!.tournamentPolicyVersion=version;const rev=save.revision;save.revision++;
  initial.close();await port.commit(rev,save);
  const c=new TournamentController(port);await c.init();expect(c.status,c.error).toBe('ready');
  for(let n=0;(c.data!.active!.game.actor===0||c.data!.active!.game.street==='complete')&&n<10;n++)await step(c);
  expect(c.data!.active!.game.actor).not.toBe(0);await c.prepareBot();expect(c.error).toBe('');
  const e=c.data!.active!,pending=structuredClone(e.pending!);expect(pending.decision).toBeTruthy();
  const actor=e.game.actor!,profile=e.mtt?mttProfileAt(e,actor):e.profiles[actor];
  const o=observeBot(e.game,actor,profile.policyVersion,`tournament-bot:${e.game.handId}:${e.game.revision}:${actor}`);
  const expected=version===TOURNAMENT_POLICY_V2?frozenV2(o,profile,seedStream(pending.token)):chooseTournamentDecision(o,profile,seedStream(pending.token),version,tournamentStandings(e));
  expect(pending.decision).toEqual(expected);expect(()=>auditTournamentData(c.data!)).not.toThrow();c.close();
  const loaded=new TournamentController(port);await loaded.init();expect(loaded.status,loaded.error).toBe('ready');
  expect(loaded.data!.active!.pending).toEqual(pending);await loaded.prepareBot();expect(loaded.data!.active!.pending).toEqual(pending);
  const next=applyCommand(loaded.data!.active!.game,pending.decision!);await loaded.commitBot(pending.handId,pending.revision);
  expect(loaded.error).toBe('');expect(loaded.data!.active!.game).toEqual(next);expect(()=>loaded.auditHistory()).not.toThrow();loaded.close();
 });
 it('discards in-flight next-round work after a newer committed pause, then advances exactly once',async()=>{
  const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();await c.startEvent('daily-125',27,'fast');await handComplete(c);
  const before=structuredClone(c.data!),round=before.active!.handNumber;
  const advancing=c.nextHand();await c.setPaused(true);await advancing;
  expect(c.data!.active!.paused).toBe(true);expect(c.data!.active!.handNumber).toBe(round);
  expect(c.data!.active!.mtt!.recent).toEqual(before.active!.mtt!.recent);
  expect(c.data!.balance).toBe(before.balance);expect(c.error).toBe('');
  await c.setPaused(false);await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.handNumber).toBe(round+1);
  expect(()=>c.auditHistory()).not.toThrow();c.close();
 });
 it('does not commit in-flight next-round work after close, and a new controller resumes',async()=>{
  const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();await c.startEvent('daily-125',27,'fast');await handComplete(c);
  const before=await port.load(),advancing=c.nextHand();c.close();await advancing;
  expect(await port.load()).toEqual(before);
  const restored=new TournamentController(port);await restored.init();expect(restored.status,restored.error).toBe('ready');await restored.nextHand();
  expect(restored.error).toBe('');expect(restored.data!.active!.handNumber).toBe(before!.active!.handNumber+1);expect(()=>restored.auditHistory()).not.toThrow();restored.close();
 });
 it('binds every public standings stack into the v2.1 decision identity',()=>{
  const rules:RuleProfile={id:'standings-binding',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
  const game=startHand({handId:'public-standings',button:0,profile:rules,seats:Array.from({length:9},(_,id)=>({id,name:`Seat${id}`,stack:4000}))});
  const p=createProfile({selection:'stronger-reg'},6,'neutral'),o=observeBot(game,game.actor!,p.policyVersion,'same-public-hand');
  const a={playersLeft:20,paid:19,stacks:Array(20).fill(4000) as number[]};
  const b={...a,stacks:[...Array(9).fill(4000),...Array(10).fill(100),43000] as number[]};
  expect(a.stacks.reduce((x,y)=>x+y,0)).toBe(b.stacks.reduce((x,y)=>x+y,0));
  const da=chooseTournamentDecision(o,p,seedStream(3),TOURNAMENT_POLICY_V21,a),db=chooseTournamentDecision(o,p,seedStream(3),TOURNAMENT_POLICY_V21,b);
  expect(da.observationHash).not.toBe(db.observationHash);
 });
});
