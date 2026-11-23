import {heroReadsSnapshot} from './human-context';
import type {Action,BotProfile} from '../contracts';
import {heroCanReEnter,requestHeroReEntry} from './multi-table';
import {applyCommand,startHand,nextTournamentHand,observeBot,replayTournamentHand} from '../core/engine';
import {chooseTournamentDecision,NEW_EVENT_TOURNAMENT_POLICY,policyUsesReads} from './bot-policy';
import {TOURNAMENT_POLICY_V223} from './bot-policy-v2';
import {seedStream} from '../bots/profiles';
import {canonical} from '../storage/integrity';
import {newHandId} from '../identity';
import {findPreset,blindSchedule,entryCost,handsPerLevel,ladderFor,type EventPace} from './presets';
import {TournamentPersistence,TournamentConflictError} from './persistence';
import {allHeroHands,applyMttRound,createMttEvent,mttFields,mttGameView,mttProfileAt,otherTablesKey,playMttRound,playOtherTablesAhead} from './mtt-event';
import {drawField} from './field';
import {secureIndex} from '../core/deck';
import type {MttDeps} from './multi-table';
import {TOURNAMENT_VERSION,INITIAL_TOURNAMENT_BALANCE,TOURNAMENT_GENESIS_VERSION,sealTournamentArchives,addMoney,demand,settleTournamentHand,tournamentProfile,tournamentView,tournamentGameView,tournamentRecords,auditTournamentData,tournamentStandings,tournamentRecent,tournamentReads,tournamentTableReads,tournamentImages,tournamentGrudges,tournamentInsight,type TournamentData,type TournamentEvent,type TournamentPort} from './runtime';
const now=()=>new Date().toISOString();
const token=()=>crypto.getRandomValues(new Uint32Array(1))[0];
/** Secure randomness for seat draws, buttons and computer decisions at multi-table events. */
const mttDeps:MttDeps={random:secureIndex,handId:newHandId,token};
export class TournamentController {
 data:TournamentData|null=null;status:'loading'|'ready'|'readonly'|'error'='loading';error='';busy=false;
 /** True while the other tables of a multi-table event play their hands, before the round is saved. */
 otherTables=false;
 private readonly port:TournamentPort;private listeners=new Set<()=>void>();private failed:{expected:number|null;next:TournamentData}|null=null;private preparing=false;private closed=false;
 constructor(port:TournamentPort|string=new TournamentPersistence()){this.port=typeof port==='string'?new TournamentPersistence(port):port;}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private emit(){this.listeners.forEach(listener=>listener());this.startAhead();}
 /** The other tables' hands for the current round, computed in small slices while Hero plays. */
 private ahead:{key:string;result:Promise<Awaited<ReturnType<typeof playOtherTablesAhead>>>}|null=null;
 /** Number of rounds reusing an early-start job; the job may still require waiting at hand end. */
 aheadUsed=0;
 private startAhead(){
  const event=this.data?.active;if(this.closed||this.status!=='ready'||!event?.mtt)return;
  const key=otherTablesKey(event);if(!key||this.ahead?.key===key)return;
  const owner={key,result:Promise.resolve(null) as Promise<Awaited<ReturnType<typeof playOtherTablesAhead>>>};
  owner.result=playOtherTablesAhead(event,mttDeps,{cancelled:()=>this.closed||this.ahead!==owner}).catch(()=>null);
  this.ahead=owner;
 }
 get view(){return this.data?.active?tournamentView(this.data.active):null;}
 get gameView(){const event=this.data?.active;return event?event.mtt?mttGameView(event):tournamentGameView(event.game):null;}
 get records(){return this.data?tournamentRecords(this.data):[];}
 /** Patch 69: a copy of the verified tournament save, with no event in progress. Read only. */
 backupData():TournamentData{demand(this.data&&this.status==='ready'&&!this.busy,'Wait until the tournament save is ready before backing up.');demand(!this.data!.active,'Finish your tournament before backing up.');return structuredClone(this.data!);}
 /** Patch 69: why a backup cannot be restored here, or '' when it can. Read only. */
 restoreProblem(backup:TournamentData):string{const current=this.data;if(!current||this.status!=='ready')return 'The tournament save is not ready.';if(current.active)return 'Finish the tournament on this device before restoring.';if(backup.active)return 'A backup with a tournament in progress cannot be restored.';
  return current.completed.every((event,i)=>backup.completed[i]?.id===event.id&&canonical(backup.completed[i])===canonical(event))?'':'This device has tournament results that are not in the backup, so they would be lost.';}
 /** Patch 69: replace this device's tournament save with a backup. Allowed only when the events already saved here are
  * the backup's own first events (a new device has none), so no finished event is ever removed or rewritten. */
 async restoreBackup(backup:TournamentData):Promise<void>{if(this.closed||this.busy||this.status!=='ready'||!this.data)throw Error('The tournament save is not ready.');this.busy=true;this.emit();try{
  const current=this.data,problem=this.restoreProblem(backup);demand(!problem,problem);
  const next=structuredClone({...backup,revision:current.revision+1});auditTournamentData(next);await this.port.commit(current.revision,next);sealTournamentArchives(next);this.data=next;this.error='';
 }catch(error){this.error=String(error);throw error;}finally{this.busy=false;this.emit();}}
 async init():Promise<void>{if(this.busy||this.closed)return;this.busy=true;this.status='loading';this.emit();try{let data=await this.port.load();if(!data){data={schemaVersion:1,genesisVersion:TOURNAMENT_GENESIS_VERSION,revision:0,balance:0,ledger:[],active:null,completed:[]};addMoney(data,{id:'tournament-initial',kind:'initial',amount:INITIAL_TOURNAMENT_BALANCE,at:now(),note:'Initial virtual tournament balance; separate from cash bankroll'});await this.port.commit(null,data);}auditTournamentData(data);sealTournamentArchives(data);this.data=data;this.status='ready';this.error='';}catch(error){this.status=error instanceof TournamentConflictError?'readonly':'error';this.error=String(error);}finally{this.busy=false;this.emit();}}
 private async mutate(change:(data:TournamentData)=>void):Promise<boolean>{if(this.closed||this.busy||this.status!=='ready'||!this.data)return false;const expected=this.data.revision,active=this.data.active,blocks=active?.mtt?.blocks,next:TournamentData={...structuredClone({...this.data,active:blocks?{...active!,mtt:{...active!.mtt!,blocks:[]}}:active,completed:[]}),completed:[...this.data.completed]};if(blocks)next.active!.mtt!.blocks=[...blocks];/* Sealed blocks are frozen: shared, never copied. */this.busy=true;this.emit();try{change(next);next.revision=expected+1;sealTournamentArchives(next);this.failed={expected,next};await this.port.commit(expected,next);this.failed=null;this.data=next;this.error='';return true;}catch(error){this.error=error instanceof Error?error.message:String(error);if(error instanceof TournamentConflictError){this.failed=null;this.status='readonly';}else if(this.failed){this.status='error';}return false;}finally{this.busy=false;this.emit();}}
 /** Retry the exact prepared snapshot after a failed write; never reroll a deck or bot decision. */
 async retry():Promise<void>{if(this.closed||this.busy)return;if(!this.data&&!this.failed){await this.init();return;}this.busy=true;this.emit();try{const current=await this.port.load();if(this.failed){const {expected,next}=this.failed;if(current&&current.revision===next.revision&&canonical(current)===canonical(next)){this.data=current;this.failed=null;}else{if((current?.revision??null)!==expected){demand(current,'The tournament save changed unexpectedly');this.data=current;this.failed=null;}else{await this.port.commit(expected,next);this.data=next;this.failed=null;}}}else{demand(current,'No committed tournament snapshot exists');this.data=current;}auditTournamentData(this.data!);sealTournamentArchives(this.data!);this.status='ready';this.error='';}catch(error){this.error=String(error);this.status=error instanceof TournamentConflictError?'readonly':'error';}finally{this.busy=false;this.emit();}}
 async startEvent(presetId:string,entrants:number,pace:EventPace):Promise<void>{await this.mutate(data=>{demand(!data.active,'Finish the active tournament before registering again');const preset=findPreset(presetId);demand(preset&&preset.fields.includes(entrants)&&([6,9].includes(entrants)||mttFields(preset).includes(entrants)),'Choose a field this event offers');demand(pace==='real'||pace==='fast','Unknown tournament pace');demand(data.balance>=entryCost(preset),'Insufficient virtual tournament balance');const id=`event:${newHandId()}`;
 if(entrants>9){const event=createMttEvent({id,preset,entrants,pace,startedAt:now(),lateRegistration:true},mttDeps);if(policyUsesReads(event.tournamentPolicyVersion))event.heroReads=heroReadsSnapshot(data.completed);data.active=event;addMoney(data,{id:`entry:${id}`,kind:'entry',amount:-entryCost(preset),eventId:id,at:event.startedAt,note:`${preset.name}: prize contribution ${preset.buyIn} cents; fee ${preset.fee} cents`});return;}
 const drawn=drawField(preset,entrants,mttDeps.random,token),profiles=drawn.profiles;const structure={levels:blindSchedule(preset),handsPerLevel:handsPerLevel(preset,pace)};
 const game=startHand({handId:newHandId(),profile:tournamentProfile(structure,1),button:0,seats:Array.from({length:entrants},(_,seat)=>({id:seat,name:drawn.names[seat],stack:preset.startingStack}))});
 const event:TournamentEvent={id,version:TOURNAMENT_VERSION,tournamentPolicyVersion:NEW_EVENT_TOURNAMENT_POLICY,preset:structuredClone(preset),entrants,pace,...structure,startedAt:now(),finishedAt:null,status:'running',game,handNumber:1,paused:false,profiles,field:drawn.field,...(policyUsesReads(NEW_EVENT_TOURNAMENT_POLICY)?{heroReads:heroReadsSnapshot(data.completed)}:{}),pending:null,history:[],frames:[tournamentGameView(game)],finishes:[],ladder:ladderFor(preset,preset.buyIn*entrants,entrants),prizePool:preset.buyIn*entrants,feeTotal:preset.fee*entrants};data.active=event;addMoney(data,{id:`entry:${id}`,kind:'entry',amount:-entryCost(preset),eventId:id,at:event.startedAt,note:`${preset.name}: prize contribution ${preset.buyIn} cents; fee ${preset.fee} cents`});settleTournamentHand(data,event,now());});}
 async adjustBalance(targetCents:number,note='Manual tournament balance adjustment'):Promise<void>{await this.mutate(data=>{demand(Number.isSafeInteger(targetCents)&&targetCents>=0,'Enter a nonnegative whole-cent tournament balance');demand(typeof note==='string'&&note.trim().length>0&&note.length<=300,'Enter an adjustment note of 1–300 characters');addMoney(data,{id:`adjustment:${newHandId()}`,kind:'adjustment',amount:targetCents-data.balance,at:now(),note});});}
 /** `tempo` (policy 2.23.0 only): whether Hero snapped or took a long think, which the table can see. */
 async act(action:Action,handId:string,revision:number,tempo?:'snap'|'tank'|null):Promise<void>{await this.mutate(data=>{const event=data.active;demand(event&&event.status==='running'&&!event.paused,'Resume an active tournament before acting');demand(event.game.handId===handId&&event.game.revision===revision&&event.game.actor===0,'Stale tournament action');event.game=applyCommand(event.game,{handId,revision,seatId:0,decisionId:`tournament-hero:${handId}:${revision}`+(tempo&&event.tournamentPolicyVersion===TOURNAMENT_POLICY_V223?`:${tempo}`:''),action});event.frames.push(tournamentGameView(event.game));event.pending=null;settleTournamentHand(data,event,now());});}
 async setPaused(paused:boolean):Promise<void>{await this.mutate(data=>{demand(data.active&&data.active.status!=='complete','No active tournament');data.active.paused=paused;});}
 async nextHand():Promise<void>{if(this.data?.active?.mtt){await this.nextRound();return;}await this.mutate(data=>{const event=data.active;demand(event&&event.status!=='complete'&&event.game.street==='complete','Finish this hand before dealing');event.handNumber++;event.game=nextTournamentHand(event.game,newHandId(),tournamentProfile(event,event.handNumber));event.frames=[tournamentGameView(event.game)];event.pending=null;settleTournamentHand(data,event,now());});}
 async prepareBot():Promise<void>{if(this.preparing||this.busy||this.status!=='ready')return;this.preparing=true;try{const event=this.data?.active;if(!event||event.paused||event.game.actor===null||event.game.actor===0||event.status==='complete')return;if(!event.pending){if(!await this.mutate(data=>{const e=data.active!;e.pending={token:token(),handId:e.game.handId,revision:e.game.revision,decision:null};}))return;}
  if(this.data?.active?.pending&&!this.data.active.pending.decision)await this.mutate(data=>{const e=data.active!,pending=e.pending!;demand(pending.handId===e.game.handId&&pending.revision===e.game.revision,'Stale prepared tournament decision');const seat=e.game.actor!,profile=e.mtt?mttProfileAt(e,seat):e.profiles[seat];pending.decision=chooseTournamentDecision(observeBot(e.game,seat,profile.policyVersion,`tournament-bot:${e.game.handId}:${e.game.revision}:${seat}`),profile,seedStream(pending.token),e.tournamentPolicyVersion,tournamentStandings(e),tournamentRecent(e,seat),tournamentReads(e,seat),tournamentTableReads(e,seat),tournamentImages(e,seat),tournamentGrudges(e,seat),tournamentInsight(e,seat,profile));});
 }finally{this.preparing=false;}}
 async commitBot(handId:string,revision:number):Promise<void>{await this.mutate(data=>{const event=data.active;demand(event&&!event.paused&&event.status!=='complete'&&event.game.actor!==0,'Tournament bot is not available');demand(event.game.handId===handId&&event.game.revision===revision,'Stale tournament bot action');const decision=event.pending?.decision;demand(decision&&decision.handId===handId&&decision.revision===revision,'Prepare the tournament bot decision first');event.game=applyCommand(event.game,decision);event.frames.push(tournamentGameView(event.game));event.pending=null;settleTournamentHand(data,event,now());});}
 /** Multi-table: the other tables play their hands (on a copy, yielding to the screen between tables),
  * then the whole round settles in one commit. A reload before that commit shows and changes nothing. */
 private async nextRound():Promise<void>{
  if(this.closed||this.busy||this.otherTables||this.status!=='ready')return;const event=this.data?.active;
  if(!event?.mtt||event.status==='complete'||event.game.street!=='complete')return;
  const revision=this.data!.revision;this.otherTables=true;this.emit();
  try{const key=otherTablesKey(event),early=key&&this.ahead?.key===key?await this.ahead.result:null;if(early)this.aheadUsed++;
   const played=early??await playMttRound(event,mttDeps);this.otherTables=false;
   if(this.data?.revision!==revision||this.data.active?.id!==event.id)return;
   await this.mutate(data=>applyMttRound(data,data.active!,played,mttDeps,now()));
  }catch(error){this.error=error instanceof Error?error.message:String(error);}finally{this.otherTables=false;this.emit();}
 }
 /** Re-enter a multi-table event after being knocked out while registration is open (T09): a new
  * entry charged like the first, seated with a fresh stack when the current round settles. */
 async reEnter():Promise<void>{await this.mutate(data=>{const event=data.active;demand(event?.mtt&&heroCanReEnter(event.mtt.state),'Re-entry is not available');
  const cost=entryCost(event!.preset),n=2+(event!.mtt!.state.registration!.heroReEntries?.length??0);demand(data.balance>=cost,'Not enough virtual money to re-enter');
  requestHeroReEntry(event!.mtt!.state);addMoney(data,{id:`entry:${event!.id}:${n}`,kind:'entry',amount:-cost,eventId:event!.id,at:now(),note:`${event!.preset.name}: re-entry; prize contribution ${event!.preset.buyIn} cents; fee ${event!.preset.fee} cents`});});}
 async finishEvent():Promise<void>{await this.mutate(data=>{demand(data.active?.status==='complete','The event must finish before starting another');data.completed.push(data.active);data.active=null;});}
 /** Redacted canonical hands only; never export future cards or private policy parameters. */
 exportHistory():string {demand(this.data&&this.status==='ready','Verify the tournament save before exporting');return JSON.stringify({format:'poker-night-ai-tournament-public-1',events:[...this.data.completed,...this.data.active?[this.data.active]:[]].map(event=>({id:event.id,eventName:event.preset.name,version:event.version,tournamentPolicyVersion:event.tournamentPolicyVersion,startedAt:event.startedAt,entrants:event.mtt?.state.players.length??event.entrants,...(event.mtt?.state.registration?{openingEntrants:event.entrants}:{}),pace:event.pace,prizePool:event.prizePool,ladder:event.ladder,hands:allHeroHands(event).map(hand=>({number:hand.number,settledAt:hand.settledAt,view:tournamentGameView(hand.state),frames:replayTournamentHand(hand.state)})),finishes:event.finishes}))},null,2);}
 auditHistory():number {demand(this.data&&this.status==='ready'&&!this.busy,'Verify the tournament save before auditing');try{return auditTournamentData(this.data);}catch(error){this.status='error';this.error=String(error);this.emit();throw error;}}
 /** Read/export only: never silently roll back an acknowledged action or payout. */
 async exportRecoveryBackup():Promise<string>{demand(this.port.recoveryBackup,'No previous snapshot reader is available');const backup=await this.port.recoveryBackup();demand(backup,'No verified previous snapshot is available');auditTournamentData(backup);return JSON.stringify({format:'poker-night-ai-tournament-recovery-backup-1',warning:'Previous committed state only; may predate an acknowledged action or payout. Not automatically restored or merged.',data:backup});}
 close(){this.closed=true;this.port.close();this.listeners.clear();}
}
