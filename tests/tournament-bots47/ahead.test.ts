import {describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {auditTournamentData} from '../../src/tournament/runtime';
import {otherTablesKey,playOtherTablesAhead} from '../../src/tournament/mtt-event';
import {heroTable,playOtherTables,type MttDeps,type MttState} from '../../src/tournament/multi-table';

/** Same entropy sequence for two runs. */
function deps(seed:number):MttDeps{let s=seed>>>0;const next=()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s;};return {random:n=>next()%n,handId:()=>`h${next()}`,token:()=>next()};}
async function started(entrants=27){const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',entrants,'fast');expect(c.error).toBe('');return c;}
async function step(c:TournamentController,pause=0){
 const e=c.data!.active!,g=c.gameView!;
 if(e.game.street==='complete'){await c.nextHand();return 'round';}
 if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);
 else{await c.prepareBot();const cur=c.data!.active!;await c.commitBot(cur.game.handId,cur.game.revision);}
 if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
 return 'action';
}

describe('other tables computed while Hero plays',()=>{
 it('produces exactly the hands the end-of-hand path would, from the same entropy',async()=>{
  const c=await started(45),event=structuredClone(c.data!.active!);c.close();
  const early=await playOtherTablesAhead(event,deps(9),{sliceMs:0});
  // Reference: the existing per-table path on a copy, as playMttRound runs it.
  const copy:MttState=structuredClone(event.mtt!.state),hero=heroTable(copy),reference=deps(9),records=[];
  for(const table of copy.tables){if(table===hero)continue;records.push(...playOtherTables({...copy,tables:[table],status:'hero-out'},event.profiles,event.tournamentPolicyVersion,reference));}
  expect(early!.round).toBe(copy.round);expect(JSON.stringify(early!.records)).toBe(JSON.stringify(records));
  expect(early!.records.length).toBe(event.mtt!.state.tables.length-1);
  expect(JSON.stringify(event.mtt!.state)).toBe(JSON.stringify(c.data!.active!.mtt!.state));
 });
 it('yields between single decisions and stops when cancelled',async()=>{
  const c=await started(27),event=c.data!.active!;c.close();
  let time=0,yields=0;const clock=()=>(time+=10);
  const done=await playOtherTablesAhead(event,deps(3),{sliceMs:6,clock,yieldToUI:async()=>{yields++;}});
  const decisions=done!.records.reduce((n,r)=>n+r.state.events.filter(e=>e.type==='action').length,0);
  expect(yields).toBe(decisions);
  let calls=0;const stopped=await playOtherTablesAhead(event,deps(3),{sliceMs:0,yieldToUI:async()=>{calls++;},cancelled:()=>calls>=3});
  expect(stopped).toBeNull();expect(calls).toBe(3);
 });
 it('keys a round by event, round and every other table\'s hand',async()=>{
  const c=await started(27),event=c.data!.active!,key=otherTablesKey(event)!;c.close();
  expect(key.startsWith(`${event.id}:${event.mtt!.state.round}:`)).toBe(true);expect(key.split(',').length).toBe(event.mtt!.state.tables.length-1);
  const moved=structuredClone(event);moved.mtt!.state.round++;expect(otherTablesKey(moved)).not.toBe(key);
  const done=structuredClone(event);done.status='complete';expect(otherTablesKey(done)).toBeNull();
 });
 it('uses the early result in a real event, saves every round and passes the full audit, across a reload',async()=>{
  const port=new MemoryTournamentPersistence();let c=new TournamentController(port);await c.init();await c.startEvent('daily-125',27,'fast');
  let rounds=0;
  for(let guard=0;rounds<12&&guard<3000&&c.data!.active!.status==='running';guard++){
   if(await step(c,4)==='round'){rounds++;expect(c.error).toBe('');}
   if(rounds===6&&guard%5===0&&c.data!.active!.game.street!=='complete'){c.close();c=new TournamentController(port);await c.init();expect(c.status).toBe('ready');}
  }
  expect(rounds).toBeGreaterThanOrEqual(6);expect(c.aheadUsed).toBeGreaterThan(0);expect(c.error).toBe('');
  expect(auditTournamentData(c.data!)).toBeGreaterThan(0);
  const mtt=c.data!.active!.mtt!;expect(mtt.recent.length+mtt.blocks.reduce((n,b)=>n+b.hands.length,0)).toBeGreaterThan(0);
  c.close();
 });
 it('falls back to playing at the end of Hero\'s hand when Hero acts at once',async()=>{
  const c=await started(27);let rounds=0;
  for(let guard=0;rounds<3&&guard<1000;guard++)if(await step(c)==='round'){rounds++;expect(c.error).toBe('');}
  expect(rounds).toBe(3);expect(auditTournamentData(c.data!)).toBeGreaterThan(0);c.close();
 });
});
