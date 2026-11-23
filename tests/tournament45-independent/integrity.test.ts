import { describe, expect, it } from 'vitest';
import { TournamentController } from '../../src/tournament/controller';
import { MemoryTournamentPersistence } from '../../src/tournament/persistence';
import { addMoney, auditTournamentData } from '../../src/tournament/runtime';
import { playMttRound } from '../../src/tournament/mtt-event';
import { startTournamentTableHand } from '../../src/core/engine';
import { heroTable } from '../../src/tournament/multi-table';

async function setup() {
 const c = new TournamentController(new MemoryTournamentPersistence());
 await c.init(); await c.startEvent('daily-125',18,'fast');
 expect(c.error).toBe(''); return c;
}
async function finishHeroHand(c:TournamentController) {
 while(c.data!.active!.game.street!=='complete') {
  const g=c.gameView!;
  if(g.actor===0) await c.act({type:g.legal.check?'check':'fold'},g.handId,g.revision);
  else { await c.prepareBot(); const e=c.data!.active!; await c.commitBot(e.game.handId,e.game.revision); }
  expect(c.error).toBe('');
 }
}
describe('independent MTT integrity regressions',()=>{
 it('rejects an invented Hero prize while all entrants still play',async()=>{
  const c=await setup(), data=structuredClone(c.data!), e=data.active!;
  e.mtt!.state.finishes.push({player:0,name:'You',place:1,ties:1,prize:e.ladder[0],round:1});
  e.finishes.push({seatId:0,name:'You',place:1,ties:1,prize:e.ladder[0],handId:'round:1'});
  addMoney(data,{id:`prize:${e.id}`,kind:'prize',amount:e.ladder[0],eventId:e.id,at:e.startedAt,note:'Invented prize'});
  expect(()=>auditTournamentData(data)).toThrow();
 });
 it('records a background hand completed immediately by forced all-ins',async()=>{
  const c=await setup(), e=structuredClone(c.data!.active!), state=e.mtt!.state;
  const table=state.tables.find(t=>t!==heroTable(state))!;
  table.game=startTournamentTableHand({handId:'forced-all-in',profile:table.game.profile,button:1,seats:[{id:1,name:'A',stack:1},{id:2,name:'B',stack:1}]},9);
  expect(table.game.street).toBe('complete');
  state.tables=[table]; state.status='hero-out'; e.status='hero-out'; e.game=table.game;
  const played=await playMttRound(e,{random:()=>0,handId:()=> 'unused',token:()=>0},async()=>{});
  expect(played.records).toHaveLength(1);
 });
 it('rejects changed saved player stacks despite internally balanced engine games',async()=>{
  const c=await setup(), data=structuredClone(c.data!);
  data.active!.mtt!.state.players[1].stack+=123;
  expect(()=>auditTournamentData(data)).toThrow();
 });
 it('audits the current non-Hero tables as well as the visible game',async()=>{
  const c=await setup(), data=structuredClone(c.data!), state=data.active!.mtt!.state;
  const other=state.tables.find(t=>t!==heroTable(state))!;
  const seat=other.game.seats[0];
  seat.hole=[...other.game.seats[1].hole];
  expect(()=>auditTournamentData(data)).toThrow();
 });
 it('rejects a missing completed background table hand',async()=>{
  const c=await setup(); await finishHeroHand(c); await c.nextHand(); expect(c.error).toBe('');
  const data=structuredClone(c.data!); expect(data.active!.mtt!.recent.length).toBeGreaterThan(0);
  data.active!.mtt!.recent=[];
  expect(()=>auditTournamentData(data)).toThrow();
 });
});
