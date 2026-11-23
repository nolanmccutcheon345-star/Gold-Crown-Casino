import {describe,it,expect} from 'vitest';
import {netChart,tournamentStatsMarkup} from '../../src/tournament/stats-screen';
import {tournamentStats,type EventResult} from '../../src/tournament/stats';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';

describe('independent chart and result-time projections',()=>{
 it('provides escaped cumulative text data for every chart event beyond the last twenty',()=>{
  const events:EventResult[]=Array.from({length:25},(_,i)=>({id:`chart-${i}`,name:`Event <${i}>`,tier:'home',entrants:9,multi:false,place:1,cost:100,prize:i%2?50:200,net:i%2?-50:100,hands:1,finishedAt:'2026-11-18T00:00:00Z'}));
  const markup=netChart(events),table=markup.slice(markup.indexOf('<details'));
  expect(table).toContain('Chart data · all 25 events');expect(table).toContain('Running net');
  expect((table.match(/<tr><th scope="row">/g)??[]).length).toBe(25);
  for(let i=0;i<25;i++)expect(table).toContain(`Event &lt;${i}&gt;`);
  expect(table).not.toContain('Event <');expect(table).toContain('<td>+$7</td>');
 });

 it('dates a still-running MTT result at the Hero prize transaction, not registration',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const data=structuredClone(c.data!),event=data.active!;c.close();
  event.startedAt='2026-11-17T23:50:00Z';event.finishedAt=null;event.status='hero-out';
  event.finishes=[{seatId:0,name:'You',place:27,ties:1,prize:0,handId:'round:1'}];
  const finished='2026-11-18T00:05:00Z';
  data.ledger.push({id:`prize:${event.id}`,sequence:data.ledger.length,kind:'prize',amount:0,balance:data.balance,eventId:event.id,at:finished,note:'Tournament finish 27'});
  const stats=tournamentStats(data);expect(stats.events[0].finishedAt).toBe(finished);
  // A winner's normalized average is legitimately zero; it must not render as missing.
  stats.averageFinish=0;expect(tournamentStatsMarkup(stats)).toContain('Top 0%');
 });
});
