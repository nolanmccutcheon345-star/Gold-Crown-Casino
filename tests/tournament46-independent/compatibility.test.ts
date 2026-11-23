import {describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {mttProfileAt} from '../../src/tournament/mtt-event';
import {applyCommand,observeBot,startHand,assertAccounting} from '../../src/core/engine';
import {ARCHETYPES,createProfile,seedStream} from '../../src/bots/profiles';
import {chooseTournamentDecision,TOURNAMENT_BOT_POLICY_VERSION} from '../../src/tournament/bot-policy';
import {chooseTournamentDecision as frozenDecision} from './frozen-v45-policy';
import type {RuleProfile} from '../../src/contracts';

const rules:RuleProfile={id:'independent-legacy',version:'1',mode:'tournament',smallBlind:25,bigBlind:50,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:50,antePriority:'blind-first',buttonRule:'dead-button'}};
const versions=[undefined,TOURNAMENT_BOT_POLICY_VERSION];

describe('independent V45 saved-policy compatibility',()=>{
 it.each(versions)('matches the frozen V45 decision implementation for %s',version=>{
  let compared=0;
  for(const archetype of ARCHETYPES)for(const depth of [3,10,20,70]){
   const profile=createProfile({selection:archetype},47,'neutral');
   let game=startHand({handId:`frozen:${archetype}:${depth}`,button:depth%6,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`Seat ${id}`,stack:depth*50+id*25}))});
   for(let step=0;game.street!=='complete'&&step<150;step++){
    const observation=observeBot(game,game.actor!,profile.policyVersion,`frozen:${step}`);
    const actual=chooseTournamentDecision(observation,profile,seedStream(step+depth),version);
    expect(actual).toEqual(frozenDecision(observation,profile,seedStream(step+depth),version));
    game=applyCommand(game,actual);assertAccounting(game);compared++;
   }
   expect(game.street).toBe('complete');
  }
  expect(compared).toBeGreaterThan(100);
 });

 for(const version of versions)it.each([['home-50',9],['daily-125',27]] as const)(`reloads and audits a prepared ${version??'unversioned'} decision in %s (%s players)`,async(preset,entrants)=>{
  const port=new MemoryTournamentPersistence();
  const initial=new TournamentController(port);await initial.init();await initial.startEvent(preset,entrants,'fast');
  expect(initial.error).toBe('');
  const saved=structuredClone(initial.data!);
  if(version===undefined)delete saved.active!.tournamentPolicyVersion;
  else saved.active!.tournamentPolicyVersion=version;
  const previous=saved.revision;saved.revision++;
  await port.commit(previous,saved);initial.close();
  const old=new TournamentController(port);await old.init();expect(old.status).toBe('ready');
  // Prepare several real decisions, including a pending one persisted across reload.
  for(let step=0;step<4;step++){
   const e=old.data!.active!;
   if(e.game.street==='complete')await old.nextHand();
   else if(e.game.actor===0)await old.act(old.gameView!.legal.check?{type:'check'}:{type:'fold'},e.game.handId,e.game.revision);
   else {await old.prepareBot();await old.commitBot(e.game.handId,e.game.revision);}
   expect(old.error).toBe('');
  }
  if(old.data!.active!.game.street==='complete')await old.nextHand();
  if(old.data!.active!.game.actor===0){const e=old.data!.active!;await old.act(old.gameView!.legal.check?{type:'check'}:{type:'fold'},e.game.handId,e.game.revision);}
  if(old.data!.active!.game.street==='complete')await old.nextHand();
  await old.prepareBot();expect(old.error).toBe('');
  const event=old.data!.active!,pending=structuredClone(event.pending!);
  expect(pending?.decision).toBeTruthy();
  const actor=event.game.actor!,profile=event.mtt?mttProfileAt(event,actor):event.profiles[actor];
  const observation=observeBot(event.game,actor,profile.policyVersion,`tournament-bot:${event.game.handId}:${event.game.revision}:${actor}`);
  expect(pending.decision).toEqual(frozenDecision(observation,profile,seedStream(pending.token),version));
  expect(()=>auditTournamentData(old.data!)).not.toThrow();old.close();
  const reloaded=new TournamentController(port);await reloaded.init();
  expect(reloaded.status,reloaded.error).toBe('ready');
  expect(reloaded.data!.active!.tournamentPolicyVersion).toBe(version);
  expect(reloaded.data!.active!.pending).toEqual(pending);
  await reloaded.prepareBot();expect(reloaded.data!.active!.pending).toEqual(pending);
  const expected=applyCommand(reloaded.data!.active!.game,pending.decision!);
  await reloaded.commitBot(pending.handId,pending.revision);expect(reloaded.error).toBe('');
  expect(reloaded.data!.active!.game).toEqual(expected);
  expect(()=>auditTournamentData(reloaded.data!)).not.toThrow();
  reloaded.close();
 });
});
