import {describe,it,expect} from 'vitest';
import type {Action,GameState,RuleProfile} from '../../src/contracts';
import {startHand,applyCommand,legalActions,observeBot,projectView} from '../../src/core/engine';
import {createProfile,seedStream} from '../../src/bots/profiles';
import {chooseDecision} from '../../src/bots/policy';
import {cashRecentResults} from '../../src/session/human-context';
import {withPublicContext} from '../../src/session/bot-observation';
import {recentResultsByName} from '../../src/tournament/human-context';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {chooseTournamentDecision,TOURNAMENT_POLICY_V22,NEW_EVENT_TOURNAMENT_POLICY} from '../../src/tournament/bot-policy';
import {chooseTournamentV2 as frozen48} from './frozen-v48-policy';
import {DEFAULT_SETTINGS,SessionController} from '../../src/session/controller';
import type {AppData,PersistencePort,StoredHand} from '../../src/session/types';

const rules:RuleProfile={id:'independent49',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:0,antePriority:'blind-first',buttonRule:'dead-button'}};
const act=(g:GameState,action:Action)=>applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`ind:${g.revision}`,action});
function completed(id:string,names=['Alex','Morgan','Jordan']):GameState {
 let g=startHand({handId:id,button:0,profile:rules,seats:names.map((name,id)=>({id,name,stack:8000}))});
 for(let i=0;g.street!=='complete'&&i<100;i++)g=act(g,legalActions(g).check?{type:'check'}:{type:'call'});
 expect(g.street).toBe('complete');return g;
}
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){if((this.value?.revision??null)!==expected)throw Error('stale');this.value=structuredClone(next);}close(){}}

describe('independent human-layer boundaries',()=>{
 it('does not forget the last eight off-table results when recent rounds are sealed',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const e=structuredClone(c.data!.active!);c.close();
  const names=['Moved regular','Other regular','Field player'];
  const records=Array.from({length:8},(_,i)=>({round:i+1,table:i<4?2:3,token:1,state:completed(`archive49:${i}`,names)}));
  e.history=[];e.handNumber=9;e.mtt!.state.round=9;e.mtt!.recent=records;e.mtt!.blocks=[];
  const before=recentResultsByName(e).get(names[0]);expect(before).toHaveLength(8);
  e.mtt!.recent=[];e.mtt!.blocks=Array.from({length:4},(_,i)=>({id:`b${i}`,firstRound:2*i+1,lastRound:2*i+2,hands:records.slice(i*2,i*2+2),heroHands:[]}));
  expect(recentResultsByName(e).get(names[0])).toEqual(before);
 });
 it('keeps cash mood confined to the same session and uninterrupted personality',()=>{
  const p=createProfile({selection:'maniac'},31,'neutral'),old=createProfile({selection:'nit'},32,'neutral');
  const hand=(i:number,profile=p,sessionId='current')=>({id:`cash49:${i}`,sessionId,privateProfiles:{1:profile},view:projectView(completed(`cash49:${i}`),0)}) as unknown as StoredHand;
  const active={sessionId:'current',profiles:{1:p}},hands=[hand(0,p,'previous'),hand(1,old),...Array.from({length:8},(_,i)=>hand(i+2))];
  const got=cashRecentResults(hands,active,1);expect(got).toHaveLength(8);
  expect(cashRecentResults([...hands,hand(10,old)],active,1)).toEqual([]);
  expect(cashRecentResults([...hands,hand(10,p,'different')],active,1)).toEqual([]);
 });
 it('preserves exact Version48 decisions and fingerprints even when recent losses are supplied',()=>{
  for(const archetype of ['nit','station','stronger-reg','maniac'] as const){
   const p=createProfile({selection:archetype},148,'neutral');let g=startHand({handId:`v48:${archetype}`,button:0,profile:rules,seats:Array.from({length:6},(_,id)=>({id,name:`S${id}`,stack:2000+id*500}))});
   const context={playersLeft:8,paid:6,stacks:[...g.seats.map(s=>s.startingStack),400,10000]};
   for(let i=0;g.street!=='complete'&&i<80;i++){
    const o=observeBot(g,g.actor!,p.policyVersion,`old:${i}`),expected=frozen48(o,p,seedStream(i+48),context,true);
    expect(chooseTournamentDecision(o,p,seedStream(i+48),TOURNAMENT_POLICY_V22,context,[{deltaBB:-80,share:-.9,showdownLoss:true}])).toEqual(expected);g=applyCommand(g,expected);
   }
  }
 });
 it.each([['home-50',9],['daily-125',27]] as const)('retains a prepared human-layer decision and its exact commit after %s reload',async(preset,entrants)=>{
  const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();await c.startEvent(preset,entrants,'fast');
  for(let i=0;i<20&&(c.data!.active!.game.actor===0||c.data!.active!.game.street==='complete');i++){
   const g=c.data!.active!.game;if(g.street==='complete')await c.nextHand();else await c.act(legalActions(g).check?{type:'check'}:{type:'fold'},g.handId,g.revision);
  }
  await c.prepareBot();expect(c.error).toBe('');const before=structuredClone(c.data!.active!),pending=before.pending!;expect(before.tournamentPolicyVersion).toBe(NEW_EVENT_TOURNAMENT_POLICY);expect(pending.decision?.observationHash.startsWith(NEW_EVENT_TOURNAMENT_POLICY)).toBe(true);c.close();
  const r=new TournamentController(port);await r.init();expect(r.status,r.error).toBe('ready');expect(r.data!.active!.pending).toEqual(pending);
  await r.prepareBot();expect(r.data!.active!.pending).toEqual(pending);const expected=applyCommand(r.data!.active!.game,pending.decision!);await r.commitBot(pending.handId,pending.revision);expect(r.error).toBe('');expect(r.data!.active!.game).toEqual(expected);expect(()=>auditTournamentData(r.data!)).not.toThrow();r.close();
 });
 it.each([false,true])('reloads cash pending decisions without rerolling (human enabled=%s)',async(enabled)=>{
  const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:3});expect(c.error).toBe('');c.close();
  if(!enabled)delete port.value!.active!.humanLayer;
  const a=new SessionController(port);await a.init();
  const first=a.data!.active!.game;if(first.actor===0)await a.act(legalActions(first).check?{type:'check'}:{type:'fold'},first.handId,first.revision);
  await a.prepareBot();expect(a.error).toBe('');const before=structuredClone(a.data!),pending=before.active!.pending!;expect(pending.decision).toBeTruthy();a.close();
  if(!enabled){const active=before.active!,o=withPublicContext(observeBot(active.game,pending.seatId,pending.policyVersion,pending.decisionId),active.game.profile.rake,active.profiles[pending.seatId],before.hands,active.sessionId);expect(pending.decision).toEqual(chooseDecision(o,active.profiles[pending.seatId],seedStream(pending.drawToken)));}
  const r=new SessionController(port);await r.init();expect(r.status,r.error).toBe('ready');expect(r.data!.active!.humanLayer).toBe(enabled?'human-1.21.0':undefined);expect(r.data!.active!.pending).toEqual(pending);await r.prepareBot();expect(r.data!.active!.pending).toEqual(pending);r.close();
 });
});
