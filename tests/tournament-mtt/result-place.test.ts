import {describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
/* Multi-table fields put finishing places past 20 on the table screen, so the suffix must follow English ordinals. */
describe('table-screen finishing place',()=>{
 it('writes 21st, 22nd, 23rd, 11th–13th and 2nd correctly',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  const base=c.view!,result={entrants:27,place:2,cost:12500,prize:0,finishedAt:'2026-11-17T00:00:00.000Z'};
  const text=(place:number)=>{const source:TournamentPlaySource={status:c.status,busy:false,error:'',data:c.data,gameView:c.gameView,view:{...base,result:{...(base.result??result),...result,place}} as typeof base,act:c.act.bind(c),nextHand:c.nextHand.bind(c),setPaused:c.setPaused.bind(c),finishEvent:c.finishEvent.bind(c)};return tournamentPlayMarkup(source);};
  for(const [place,label] of [[2,'2nd'],[3,'3rd'],[4,'4th'],[11,'11th'],[12,'12th'],[13,'13th'],[21,'21st'],[22,'22nd'],[23,'23rd'],[27,'27th']] as const)expect(text(place),String(place)).toContain(`You finished ${label}.`);
  expect(text(1)).toContain('You won the tournament.');
 });
});
