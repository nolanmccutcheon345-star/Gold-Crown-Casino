import {describe,it,expect} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {TOURNAMENT_BOT_POLICY_VERSION,NEW_EVENT_TOURNAMENT_POLICY as TOURNAMENT_POLICY_V2} from '../../src/tournament/bot-policy';
async function play(preset:string,entrants:number,hands:number){
 const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent(preset,entrants,'fast');
 for(let guard=0;c.data!.active&&c.data!.active.handNumber<=hands&&guard<4000;guard++){const e=c.data!.active!;
  if(e.game.street==='complete'){if(e.status==='complete')break;await c.nextHand();continue;}
  if(c.gameView!.actor===0){const legal=c.gameView!.legal;await c.act(legal.check?{type:'check'}:{type:'fold'},c.gameView!.handId,c.gameView!.revision);}
  else{await c.prepareBot();const a=c.data!.active!;await c.commitBot(a.game.handId,a.game.revision);}
  expect(c.error).toBe('');}
 return c;
}
describe('tournament policy on saved events',()=>{
 it.each([['home-50',9],['daily-125',27]] as const)('new %s %s-player events store the newest policy and pass the full audit',async(preset,entrants)=>{
  const c=await play(preset,entrants,6);expect(c.data!.active!.tournamentPolicyVersion).toBe(TOURNAMENT_POLICY_V2);expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
 });
 it('an event saved with 1.0.0 keeps replaying its prepared decision with 1.0.0',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('home-50',9,'fast');
  const data=structuredClone(c.data!);data.active!.tournamentPolicyVersion=TOURNAMENT_BOT_POLICY_VERSION;
  // With no prepared decision the stored version only selects the policy; the audit accepts it.
  expect(()=>auditTournamentData(data)).not.toThrow();
  data.active!.tournamentPolicyVersion='synthetic-tournament-9.9.9';expect(()=>auditTournamentData(data)).toThrow();
 });
});
