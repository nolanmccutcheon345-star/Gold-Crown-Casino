import {beforeAll,describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {fastForwardTournament} from '../../src/tournament/fast-forward';

// A continuous 90-player event split into bounded phases; no relaxed timeout.
describe.sequential('90-player controller, reload and prize reconciliation',()=>{
 const port=new MemoryTournamentPersistence();let c:TournamentController;
 beforeAll(async()=>{c=new TournamentController(port);await c.init();await c.startEvent('nightly-200',90,'fast');expect(c.error).toBe('');});
 for(let batch=0;batch<40;batch++)it(`round phase ${batch+1}`,async()=>{
  for(let i=0;i<4&&c.data!.active!.status!=='complete';i++){
   const round=c.data!.active!.handNumber;
   if(c.data!.active!.status==='hero-out')await fastForwardTournament(c,()=>c.data!.active!.handNumber===round&&c.data!.active!.status!=='complete',async()=>{});
   else{let guard=0;while(c.data!.active!.handNumber===round&&c.data!.active!.status==='running'){
    const e=c.data!.active!,g=c.gameView!;
    if(e.game.street==='complete')await c.nextHand();
    else if(g.actor===0)await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);
    else{await c.prepareBot();const current=c.data!.active!;await c.commitBot(current.game.handId,current.game.revision);}
    expect(c.error).toBe('');expect(++guard).toBeLessThan(500);
   }}
   expect(c.error).toBe('');
  }
  if(batch===3||batch===8){c.close();c=new TournamentController(port);await c.init();expect(c.status,c.error).toBe('ready');}
 });
 it('audits and restores all 90 finishes and one Hero prize',async()=>{
  const e=c.data!.active!;expect(e.status).toBe('complete');const state=e.mtt!.state,entries=state.players.length,registration=state.registration!;
  expect(e.entrants).toBe(90);expect(registration.entries.filter(r=>r.kind==='initial')).toHaveLength(90);
  const late=registration.entries.filter(r=>r.kind==='late').length,reEntries=registration.entries.filter(r=>r.kind==='re-entry').length;
  expect(entries).toBe(90+late+reEntries);expect(registration.entries).toHaveLength(entries);expect(new Set(registration.entries.map(r=>r.player)).size).toBe(entries);
  expect(state.players.reduce((sum,p)=>sum+p.stack,0)).toBe(entries*e.preset.startingStack);
  expect(e.prizePool).toBe(entries*e.preset.buyIn);expect(e.feeTotal).toBe(entries*e.preset.fee);
  expect(e.finishes).toHaveLength(entries);expect(new Set(e.finishes.map(f=>f.seatId)).size).toBe(entries);
  const charges=c.data!.ledger.filter(r=>r.kind==='entry');expect(charges).toHaveLength(1);expect(charges[0].amount).toBe(-(e.preset.buyIn+e.preset.fee));
  expect(e.finishes.reduce((sum,f)=>sum+f.prize,0)).toBe(e.prizePool);
  expect(c.data!.ledger.filter(row=>row.kind==='prize')).toHaveLength(1);expect(()=>c.auditHistory()).not.toThrow();
  c.close();c=new TournamentController(port);await c.init();expect(c.status,c.error).toBe('ready');await c.finishEvent();expect(c.data!.completed).toHaveLength(1);expect(c.data!.completed[0].mtt!.state.players).toHaveLength(entries);expect(c.records.at(-1)!.entrants).toBe(entries);
 });
});
