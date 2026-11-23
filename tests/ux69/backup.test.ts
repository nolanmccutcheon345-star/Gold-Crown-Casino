import {afterEach,describe,expect,it,vi} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {BrowserPersistence} from '../../src/storage/browser';
import {DELETE_PRACTICE_CONFIRMATION} from '../../src/storage/erasure';
import {makeBackup,readBackup,BACKUP_FORMAT} from '../../src/storage/backup';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {validateTournamentData,settleTournamentHand,tournamentProfile,tournamentGameView,type TournamentData} from '../../src/tournament/runtime';
import {applyCommand,legalActions,nextTournamentHand} from '../../src/core/engine';
import {BlackjackController} from '../../src/blackjack/controller';
import {MemoryBlackjackPersistence} from '../../src/blackjack/persistence';
import {backupControls,restoreMarkup,RESTORE_CONFIRMATION} from '../../src/ui/backup-controls';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';

const controllers:{close():void}[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());vi.restoreAllMocks();});

function browserPort(name:string){
 const owner=`${name}-owner`,reference=idbReference(new Map([['lease',{owner,expires:Date.now()+60000}]]));
 const attach=()=>{const port=new BrowserPersistence(name);Object.assign(port as unknown as {db:IDBDatabase;owner:string},{db:reference.db,owner});port.writable=true;return port;};
 return {port:attach(),reference,attach};
}
async function cash(port:BrowserPersistence){const c=new SessionController(port);controllers.push(c);await c.init();expect(c.error).toBe('');return c;}
/** Plays whole hands (Hero folds when it is Hero's turn) and cashes out. */
async function playAndCashOut(c:SessionController,hands=2){
 if(!c.data!.active){await c.startSession({...DEFAULT_SETTINGS,seats:2});expect(c.error).toBe('');}
 for(let h=0;h<hands;h++){
  for(let step=0;step<60&&c.data!.active!.game.street!=='complete';step++){
   const g=c.data!.active!.game;
   if(g.actor===0)await c.act({type:'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}
   expect(c.error).toBe('');
  }
  if(h<hands-1)await c.nextHand();
 }
 await c.cashOut();expect(c.error).toBe('');expect(c.data!.active).toBeNull();
}

function allInHand(data:TournamentData){const event=data.active!;let actions=0;while(event.game.street!=='complete'){const g=event.game,l=legalActions(g);event.game=applyCommand(g,{handId:g.handId,revision:g.revision,seatId:g.actor!,decisionId:`fixture:${g.handId}:${g.revision}`,action:l.canRaise?{type:'raise',to:l.maxRaiseTo!}:l.check?{type:'check'}:{type:'call'}});event.frames.push(tournamentGameView(event.game));expect(++actions).toBeLessThan(100);}settleTournamentHand(data,event,new Date().toISOString());}
function complete(data:TournamentData){let count=0;while(data.active!.status!=='complete'){allInHand(data);validateTournamentData(data);if(String(data.active!.status)==='complete')break;const event=data.active!;event.handNumber++;event.game=nextTournamentHand(event.game,`backup-next-${++count}`,tournamentProfile(event,event.handNumber));event.frames=[tournamentGameView(event.game)];expect(count).toBeLessThan(100);}return data;}
async function tournamentWithEvents(events:number){
 const port=new MemoryTournamentPersistence();let c=new TournamentController(port);await c.init();
 for(let i=0;i<events;i++){
  await c.startEvent('home-20',6,'fast');expect(c.error).toBe('');
  const data=complete(structuredClone(c.data!));data.revision++;await port.commit(c.data!.revision,data);
  c=new TournamentController(port);await c.init();await c.finishEvent();expect(c.error).toBe('');
 }
 expect(c.data!.completed).toHaveLength(events);return {port,c};
}
async function freshTournament(){const port=new MemoryTournamentPersistence(),c=new TournamentController(port);await c.init();expect(c.status).toBe('ready');return {port,c};}
async function blackjack(adjustments:number[]){const port=new MemoryBlackjackPersistence(),c=new BlackjackController(port);await c.init();expect(c.status).toBe('ready');for(const [i,target] of adjustments.entries()){await c.adjustBalance(target,`fixture ${i}`);expect(c.error).toBe('');}return {port,c};}

describe('Patch 69 cash backup and restore',()=>{
 it('backs up the full cash save, refuses with a table open, and restores it onto a cleared device',async()=>{
  const a=await cash(browserPort('backup-a').port);
  await a.startSession({...DEFAULT_SETTINGS,seats:2});
  await expect(a.backupData()).rejects.toThrow(/Cash out/);
  await playAndCashOut(a,3);
  const saved=await a.backupData();
  expect(saved.active).toBeNull();expect(saved.hands.length).toBeGreaterThanOrEqual(3);
  const text=JSON.stringify(makeBackup(saved,null,null,'2026-11-21T12:00:00.000Z'));
  const backup=await readBackup(text);
  expect(backup.format).toBe(BACKUP_FORMAT);expect(backup.summary.cashHands).toBe(saved.hands.length);expect(backup.summary.cashBankroll).toBe(saved.wallet);

  const {port:portB,reference,attach}=browserPort('backup-b');const b=await cash(portB);
  await b.restoreBackup(backup.cash);expect(b.error).toMatch(/Delete saved practice data/);expect(b.status).toBe('ready');
  await b.deleteSavedPracticeData(DELETE_PRACTICE_CONFIRMATION);expect(b.status).toBe('deleted');
  await b.restoreBackup(backup.cash);expect(b.error).toBe('');expect(b.status).toBe('ready');
  expect(b.data!.wallet).toBe(saved.wallet);expect(b.data!.sessions).toEqual(saved.sessions);expect(b.data!.ledger).toEqual(saved.ledger);
  expect(await b.backupData()).toEqual(saved);
  expect([...reference.records.keys()]).not.toContain('erasure');
  /* A new controller on the same store reopens and audits the restored save. */
  b.close();const again=new SessionController(attach());controllers.push(again);await again.init();expect(again.error).toBe('');expect(again.data!.wallet).toBe(saved.wallet);expect((await again.backupData()).hands).toEqual(saved.hands);
 },120000);

 it('keeps the old cash save on a failed replacement and permits a confirmed retry',async()=>{
  const source=await cash(browserPort('replace-source').port);await playAndCashOut(source,2);
  const saved=await source.backupData();
  const target=browserPort('replace-target'),c=await cash(target.port);await playAndCashOut(c,1);
  const before=await c.backupData();
  target.reference.fault.put='current';
  await c.restoreBackup(saved,'REPLACE');expect(c.error).toBeTruthy();
  expect(await c.backupData()).toEqual(before);
  expect((await target.port.load())?.wallet).toBe(before.wallet);
  await c.restoreBackup(saved,'REPLACE');expect(c.error).toBe('');
  c.close();const reloaded=await cash(target.attach());expect(await reloaded.backupData()).toEqual(saved);
 },120000);

 it('refuses unreadable, foreign, tampered or mid-hand backups',async()=>{
  const a=await cash(browserPort('backup-c').port);await playAndCashOut(a,1);const saved=await a.backupData();
  await expect(readBackup('not json')).rejects.toThrow(/not a Poker Night AI backup/);
  await expect(readBackup(JSON.stringify({format:'something-else',cash:saved,createdAt:'x'}))).rejects.toThrow(/not a Poker Night AI backup/);
  const tampered=makeBackup(structuredClone(saved),null,null);tampered.cash.wallet+=1000;
  await expect(readBackup(JSON.stringify(tampered))).rejects.toThrow(/cash part of this backup failed its check/);
  await a.startSession({...DEFAULT_SETTINGS,seats:2});const open=makeBackup({...structuredClone(a.data!)},null,null);
  await expect(readBackup(JSON.stringify(open))).rejects.toThrow(/cash table open/);
  const withCareer={...makeBackup(saved,null,null),career:{version:1,startedAt:new Date().toISOString(),level:2,startBankroll:100000,story:[]}};
  expect((await readBackup(JSON.stringify(withCareer))).career).toEqual(withCareer.career);
  await expect(readBackup(JSON.stringify({...withCareer,career:{...withCareer.career,level:99}}))).rejects.toThrow(/career record failed/);
  const summaryLie=makeBackup(structuredClone(saved),null,null);summaryLie.summary.cashBankroll=999999999;
  expect((await readBackup(JSON.stringify(summaryLie))).summary.cashBankroll).toBe(saved.wallet);
 },120000);
});

describe('Patch 69 tournament backup and restore',()=>{
 it('restores finished events onto a new device and refuses to drop results the backup lacks',async()=>{
  const {c:a}=await tournamentWithEvents(1);const saved=a.backupData();
  const backup=await readBackup(JSON.stringify(makeBackup(await (async()=>{const p=browserPort('backup-t');const c=await cash(p.port);await playAndCashOut(c,1);return c.backupData();})(),saved,null)));
  expect(backup.summary.tournamentEvents).toBe(1);

  const {port:portB,c:b}=await freshTournament();expect(b.restoreProblem(backup.tournament!)).toBe('');
  await b.restoreBackup(backup.tournament!);expect(b.error).toBe('');expect(b.data!.completed).toEqual(saved.completed);expect(b.data!.balance).toBe(saved.balance);
  const reopened=new TournamentController(portB);await reopened.init();expect(reopened.error).toBe('');expect(reopened.data!.completed).toHaveLength(1);
  /* Restoring the same backup again is allowed: nothing on the device is missing from it. */
  expect(reopened.restoreProblem(backup.tournament!)).toBe('');

  const {c:other}=await tournamentWithEvents(1);const before=structuredClone(other.data!);
  expect(other.restoreProblem(backup.tournament!)).toMatch(/not in the backup/);
  await expect(other.restoreBackup(backup.tournament!)).rejects.toThrow(/not in the backup/);expect(other.data).toEqual(before);

  await other.startEvent('home-20',6,'fast');expect(()=>other.backupData()).toThrow(/Finish your tournament/);
  expect(other.restoreProblem(saved)).toMatch(/Finish the tournament/);
 },180000);
});

describe('Patch 69 blackjack backup and restore',()=>{
 it('appends the backup record chain on a new device and never drops this device\'s records',async()=>{
  const {c:a}=await blackjack([150000,175000]);const snap=await a.backupSnapshot();expect(snap.records).toHaveLength(2);
  const {port:portB,c:b}=await blackjack([]);expect(b.restoreProblem(snap)).toBe('');
  await b.restoreBackup(snap);expect(b.error).toBe('');expect(b.data!.balance).toBe(175000);
  const reopened=new BlackjackController(portB);await reopened.init();expect(reopened.error).toBe('');expect(reopened.data!.balance).toBe(175000);expect((await reopened.backupSnapshot()).records).toEqual(snap.records);

  /* The device that made the backup moved on: restoring the older backup would drop a record. */
  await a.adjustBalance(90000,'after backup');expect(a.restoreProblem(snap)).toMatch(/not in the backup/);
  await expect(a.restoreBackup(snap)).rejects.toThrow(/not in the backup/);expect(a.data!.balance).toBe(90000);
  /* A newer backup extends the restored device. */
  const newer=await a.backupSnapshot();expect(reopened.restoreProblem(newer)).toBe('');await reopened.restoreBackup(newer);expect(reopened.data!.balance).toBe(90000);
  /* A different history is refused. */
  const {c:other}=await blackjack([120000]);expect(other.restoreProblem(snap)).toMatch(/not in the backup/);
  /* A tampered chain fails its audit before anything changes. */
  const bad=structuredClone(snap);bad.records[1]={...bad.records[1],hash:'0'.repeat(64)};
  const {c:fresh}=await blackjack([]);await expect(fresh.restoreBackup(bad)).rejects.toThrow();expect(fresh.data!.balance).toBe((await blackjack([])).c.data!.balance);
 },60000);
});

describe('Patch 69 backup screen',()=>{
 const base={blocked:'',working:false,notice:'',problem:'',file:null,pending:null,report:[]};
 it('offers backup and restore, and blocks both while chips are in play',()=>{
  const open=backupControls(base);
  expect(open).toContain('Back up everything');expect(open).toContain('id="restore-file"');expect(open).not.toMatch(/id="make-backup"[^>]*disabled/);
  const blocked=backupControls({...base,blocked:'Cash out your table before backing up or restoring.'});
  expect(blocked).toContain('Cash out your table');expect(blocked).toMatch(/id="make-backup"[^>]*disabled/);expect(blocked).toMatch(/id="restore-file"[^>]*disabled/);
 });
 it('shows what a checked backup holds and asks for the typed confirmation',()=>{
  const html=restoreMarkup({...base,pending:{name:'poker-night-ai-backup-2026-11-21.json',createdAt:'2026-11-21T12:00:00.000Z',summary:{cashHands:1234,cashSessions:7,cashBankroll:1500,tournamentEvents:3,tournamentBalance:2500,blackjackRecords:12,blackjackBalance:800}}},false);
  expect(html).toContain('1,234 hands');expect(html).toContain('bankroll $15<');expect(html).toContain('3 finished');expect(html).toContain('12 records');expect(html).toContain(`Type ${RESTORE_CONFIRMATION} to confirm`);
  expect(html).toContain('replaces this device');expect(html).toContain('id="confirm-restore"');
  expect(restoreMarkup({...base,report:['Cash restored: <b>x</b>']},false)).toContain('&lt;b&gt;');
 });
 it('the file name in a backup cannot inject markup',()=>{
  const html=restoreMarkup({...base,pending:{name:'<img src=x onerror=alert(1)>.json',createdAt:'2026-11-21T12:00:00.000Z',summary:{cashHands:0,cashSessions:0,cashBankroll:0,tournamentEvents:0,tournamentBalance:0,blackjackRecords:0,blackjackBalance:0}}},false);
  expect(html).not.toContain('<img');
 });
});
