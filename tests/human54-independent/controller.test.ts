import {describe,it,expect} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {legalActions,projectView} from '../../src/core/engine';
import {normalizeTableSettings} from '../../src/session/configuration';
class Port implements PersistencePort {value:AppData|null=null;async load(){return structuredClone(this.value);}async commit(expected:number|null,next:AppData){expect(this.value?.revision??null).toBe(expected);this.value=structuredClone(next);}close(){}}
async function finish(c:SessionController){for(let i=0;i<300&&c.data!.active!.game.street!=='complete';i++){const g=c.data!.active!.game;if(g.actor===0)await c.act({type:legalActions(g).check?'check':'fold'},g.handId,g.revision);else{await c.prepareBot();await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');}expect(c.data!.active!.game.street).toBe('complete');}
describe('independent live straddle controller boundaries',()=>{
 it('rejects malformed settings and raw rule objects instead of silently ignoring them',()=>{
  for(const liveStraddle of ['yes',1,null,{}])expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,liveStraddle} as never)).toThrow();
  expect(()=>normalizeTableSettings({...DEFAULT_SETTINGS,straddle:{kind:'utg-live',multiple:2}} as never)).toThrow();
 });
 it('preference only affects a future eligible hand, survives reload, and queued disabling changes rules at the boundary',async()=>{
  const port=new Port();let c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:6,liveStraddle:true});expect(c.error).toBe('');
  const before=structuredClone(c.data!.active!.game),wallet=c.data!.wallet,ledger=structuredClone(c.data!.ledger);
  await c.setHeroStraddle(true);expect(c.error).toBe('');expect(c.data!.active!.game).toEqual(before);expect(c.data!.wallet).toBe(wallet);expect(c.data!.ledger).toEqual(ledger);
  c.close();c=new SessionController(port);await c.init();expect(c.data!.active!.heroStraddle).toBe(true);expect(c.data!.active!.game).toEqual(before);
  let found=false;
  for(let h=0;h<10&&!found;h++){await finish(c);await c.nextHand();expect(c.error).toBe('');const g=c.data!.active!.game;if(g.straddleSeat===0){found=true;expect(g.seats.find(s=>s.id===0)!.streetCommitted).toBe(400);expect(projectView(g,0).straddleSeat).toBe(0);expect(g.engineVersion).toBe('0.6.0');}}
  expect(found).toBe(true);const a=c.data!.active!,frozen=structuredClone(a.game);
  await c.queueConfiguration({...c.data!.sessions.at(-1)!.settings,liveStraddle:false},a.sessionId,a.game.handId);expect(c.error).toBe('');expect(c.data!.active!.game).toEqual(frozen);
  await finish(c);await c.nextHand();expect(c.error).toBe('');expect(c.data!.active!.game.profile.straddle).toBeUndefined();expect(c.data!.active!.game.straddleSeat).toBeUndefined();expect(c.data!.active!.game.engineVersion).toBe('0.4.0');c.close();
 },60000);
 it('cannot enable Hero preference on an ordinary table',async()=>{const c=new SessionController(new Port());await c.init();await c.startSession(DEFAULT_SETTINGS);const game=structuredClone(c.data!.active!.game);await c.setHeroStraddle(true);expect(c.error).toMatch(/does not allow/);expect(c.data!.active!.heroStraddle).toBeUndefined();expect(c.data!.active!.game).toEqual(game);c.close();});
});
