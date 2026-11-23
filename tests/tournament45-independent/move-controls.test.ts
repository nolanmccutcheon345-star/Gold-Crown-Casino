import {describe,expect,it} from 'vitest';
import {TournamentController} from '../../src/tournament/controller';
import {MemoryTournamentPersistence} from '../../src/tournament/persistence';
import {tournamentPlayMarkup,type TournamentPlaySource} from '../../src/ui/tournament-play';
describe('table move action gate',()=>{
 it('locks betting until acknowledged while retaining the notice and cards',async()=>{
  const c=new TournamentController(new MemoryTournamentPersistence());await c.init();await c.startEvent('daily-125',27,'fast');
  let guard=0;while(c.gameView!.actor!==0){expect(++guard).toBeLessThan(100);if(c.gameView!.street==='complete')await c.nextHand();else{await c.prepareBot();const e=c.data!.active!;await c.commitBot(e.game.handId,e.game.revision);}}
  expect(c.error).toBe('');
  const source:TournamentPlaySource={status:c.status,busy:false,error:'',data:c.data,gameView:c.gameView,view:{...c.view!,pendingMove:{reason:'balance',fromTable:1,toTable:2,toSeat:5}},act:c.act.bind(c),nextHand:c.nextHand.bind(c),setPaused:c.setPaused.bind(c),finishEvent:c.finishEvent.bind(c)};
  const locked=tournamentPlayMarkup(source);expect(locked).toContain('tournament-move-ack');
  for(const id of ['t-fold','t-call','t-raise','t-all-in'])expect(locked).toMatch(new RegExp(`id="${id}"[^>]*disabled`));
  const ready=tournamentPlayMarkup(source,'',{moveAcked:true});expect(ready).not.toContain('tournament-move-ack');expect(ready).not.toMatch(/id="t-call"[^>]*disabled/);
  source.gameView={...source.gameView!,street:'complete',actor:null};expect(tournamentPlayMarkup(source)).toMatch(/id="t-next"[^>]*disabled/);
 });
});
