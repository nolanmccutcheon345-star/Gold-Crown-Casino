import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Action,GameState} from '../../src/contracts';
import {assertAccounting,projectView} from '../../src/core/engine';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import * as policy from '../../src/bots/policy';
import {handFeatures} from '../../src/bots/features';
import {rig} from '../verification/helpers';
import {canonical,validateData} from '../../src/storage/integrity';
class Memory implements PersistencePort{
 data:AppData|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,next:AppData){if((this.data?.revision??null)!==expected)throw Error('Revision changed');this.data=structuredClone(next);}
 close(){}
}
function audit(data:AppData){
 const g=data.active!.game;assertAccounting(g);const hero=g.seats.find(s=>s.id===0)!;
 const table=hero.stack+(g.street==='complete'?0:hero.totalCommitted);
 expect(data.wallet+g.seats.reduce((n,s)=>n+s.stack,0)+g.pot+g.rake).toBe(1072000);
 expect(data.wallet).toBe(data.ledger.reduce((n,e)=>n+e.walletDelta,0));expect(table).toBe(data.ledger.reduce((n,e)=>n+e.tableDelta,0));
 expect(data.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);expect(data.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(data.hands.reduce((n,h)=>n+h.net,0));
 expect(new Set(data.ledger.map(e=>e.id)).size).toBe(data.ledger.length);
}
afterEach(()=>vi.restoreAllMocks());
describe('X03 independent source/sink accounting through multi-all-in settlement and cashier',()=>{
 it.each([false,true])('three all-ins, folded dead money, uncalled return, rake%s, top-up and cashout conserve independent expected cents',async rake=>{
  const choose=policy.chooseDecision;vi.spyOn(policy,'chooseDecision').mockImplementation((o,p,r)=>{
   const action:Action=o.actingSeat===3?{type:'raise',to:30000}:o.actingSeat===1?{type:'call'}:{type:'fold'};return{...choose(o,p,r),action};
  });
  const port=new Memory(),first=new SessionController(port);await first.init();await first.startSession({...DEFAULT_SETTINGS,seats:4,buyIn:30000,seatStacks:{0:5000,1:12000,2:30000,3:30000},rakeMode:rake?'custom':'none',rakeBasisPoints:500,rakeCap:500});expect(first.error).toBe('');
  const fixture=structuredClone(port.data!);fixture.active!.game=rig(fixture.active!.game,[['As','Ah'],['Ks','Kh'],['2c','3d'],['Qs','Qh']],['Ac','Ad','7c','8d','9s']);fixture.active!.frames=[projectView(fixture.active!.game,0)];port.data=fixture;first.close();
  const c=new SessionController(port);await c.init();expect(c.error).toBe('');audit(c.data!);
  let g:GameState=c.data!.active!.game;while(g.street!=='complete'){
   if(g.actor===0)await c.act({type:'call'},g.handId,g.revision);else{await c.prepareBot();audit(c.data!);await c.commitBot(g.handId,g.revision);}expect(c.error).toBe('');audit(c.data!);g=c.data!.active!.game;
  }
  const drop=rake?500:0;expect(g.events.filter(e=>e.type==='refund').map(e=>[e.seatId,e.amount])).toEqual([[3,18000]]);
  expect(g.pots.map(p=>({amount:p.amount,eligible:p.eligible,winners:p.winners}))).toEqual([{amount:15200-drop,eligible:[0,1,3],winners:[0]},{amount:14000,eligible:[1,3],winners:[1]}]);
  expect(g.rake).toBe(drop);expect(g.seats.map(s=>s.stack)).toEqual([15200-drop,14000,29800,18000]);expect(c.data!.wallet).toBe(995000);expect(c.data!.hands[0].net).toBe(10200-drop);
  const records=canonical(c.data!.hands);await c.topUp(1000);expect(c.error).toBe('');audit(c.data!);expect(c.data!.wallet).toBe(994000);expect(c.data!.active!.game.seats[0].stack).toBe(16200-drop);
  await c.cashOut();expect(c.error).toBe('');expect(c.data!.wallet).toBe(1010200-drop);expect(c.data!.wallet+14000+29800+18000+drop).toBe(1072000);
  expect(canonical(c.data!.hands)).toBe(records);expect(c.data!.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='top-up')).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);
  const restored=new SessionController(port);await restored.init();await restored.cashOut();expect(restored.data!.wallet).toBe(1010200-drop);expect(canonical(restored.data!.hands)).toBe(records);await validateData(restored.data!);c.close();restored.close();
 });
});
describe('R06 draw classes apply only to future community-card opportunities',()=>{
 it('distinguishes naked gutshot from OESD and has no draw class, outs or future draw equity on the river',()=>{
  const gut={own:['9c','8d'],board:['6h','2s','Tc','4d','Kh']},oesd={own:['9c','8d'],board:['6h','7s','Kc','2d','Qh']};
  const g=handFeatures(gut.own,gut.board.slice(0,3)),o=handFeatures(oesd.own,oesd.board.slice(0,3));expect(g.drawClass).toBe('gutshot');expect(o.drawClass).toBe('open-ended');expect(o.cleanOuts).toBeGreaterThan(g.cleanOuts);
  for(const fixture of [gut,oesd,{own:['Ah','3h'],board:['Qh','7h','2c','8d','Ks']},{own:['9h','8h'],board:['6h','7h','Kc','2d','Qs']}]){
   const f=handFeatures(fixture.own,fixture.board);expect(f.drawClass).toBe('none');expect(f.cleanOuts).toBe(0);expect(f.draw).toBe(0);
  }
 });
});
