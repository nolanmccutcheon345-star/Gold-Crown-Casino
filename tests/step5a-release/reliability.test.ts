import {describe,expect,it} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import type {AppData,PersistencePort} from '../../src/session/types';
import {assertAccounting,legalActions} from '../../src/core/engine';
import {canonical,validateData} from '../../src/storage/integrity';

/** Isolated copy-on-write/CAS store. No production browser storage is accessed. */
class Port implements PersistencePort {
 data:AppData|null=null; fault:'before'|'after'|null=null;
 async load(){return structuredClone(this.data);}
 async commit(revision:number|null,next:AppData){
  const fault=this.fault;this.fault=null;
  if(fault==='before')throw Error('Injected interrupted write');
  if((this.data?.revision??null)!==revision)throw Error('Concurrent revision changed');
  this.data=structuredClone(next);
  if(fault==='after')throw Error('Injected lost commit acknowledgement');
 }
 close(){}
}
async function open(port:Port){const c=new SessionController(port);await c.init();expect(c.status).toBe('ready');return c;}
function money(d:AppData){
 const game=d.active?.game,hero=game?.seats.find(s=>s.id===0);
 if(game)assertAccounting(game);
 expect(d.wallet).toBe(d.ledger.reduce((n,e)=>n+e.walletDelta,0));
 expect(d.ledger.reduce((n,e)=>n+e.tableDelta,0)).toBe(hero?hero.stack+(game!.street==='complete'?0:hero.totalCommitted):0);
 expect(d.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(d.hands.reduce((n,h)=>n+h.net,0));
 expect(new Set(d.ledger.map(e=>e.id)).size).toBe(d.ledger.length);
 expect(new Set(d.hands.map(h=>h.id)).size).toBe(d.hands.length);
 expect(d.ledger.filter(e=>e.kind==='hand-net')).toHaveLength(d.hands.length);
 expect(d.ledger.filter(e=>e.kind!=='hand-net').every(e=>e.pokerNet===0)).toBe(true);
}

describe('Step 5A composite guest-session stress with actual current bot policies',()=>{
 for(const seats of [2,6,9,10])for(const tableMode of ['live','study'] as const){
  it(`${seats}-seat ${tableMode}: repeated hands, parallel callbacks, lost writes, reload, study import and exact cashout`,async()=>{
   const port=new Port();let c=await open(port);
   const settings={...structuredClone(DEFAULT_SETTINGS),seats,buyIn:100000,tableMode,opponents:Array.from({length:seats-1},(_,i)=>({selection:DEFAULT_SETTINGS.archetypes[i],personalitySeed:51000+i*101,skill:i%2?.3:.85}))};
   await Promise.all([c.startSession(settings),c.startSession(settings)]);
   expect(c.data!.sessions).toHaveLength(1);expect(c.data!.ledger.filter(e=>e.kind==='buy-in')).toHaveLength(1);
   let identity=canonical(c.data!.active!.profiles),actions=0,faulted=false;
   for(let hand=0;hand<3;hand++){
    for(let guard=0;c.data!.active!.game.street!=='complete'&&guard<300;guard++){
     const g=c.data!.active!.game;
     if(g.actor===0){
      const legal=legalActions(g),action=legal.check?{type:'check' as const}:legal.callAmount>g.seats.find(s=>s.id===0)!.stack*.25?{type:'fold' as const}:{type:'call' as const};
      await Promise.all([c.act(action,g.handId,g.revision),c.act(action,g.handId,g.revision)]);
      expect(c.error).toBe('');
     }else{
      await Promise.all([c.prepareBot(),c.prepareBot()]);expect(c.error).toBe('');
      const pending=structuredClone(c.data!.active!.pending);
      if(!faulted){
       port.fault=tableMode==='live'?'before':'after';await c.commitBot(g.handId,g.revision);expect(c.status).toBe('error');
       expect(c.data!.active!.pending).toEqual(pending);await c.retry();expect(c.status).toBe('ready');faulted=true;
      }else await Promise.all([c.commitBot(g.handId,g.revision),c.commitBot(g.handId,g.revision)]);
      expect(c.error).toBe('');const after=canonical(c.data!.active!.game);await c.commitBot(g.handId,g.revision);expect(canonical(c.data!.active!.game)).toBe(after);expect(c.error).toMatch(/Obsolete bot callback rejected/);
     }
     money(c.data!);actions++;
     if(actions%7===0){const before=canonical(c.data);c.close();c=await open(port);expect(canonical(c.data)).toBe(before);}
     expect(canonical(c.data!.active!.profiles)).toBe(identity);
    }
    expect(c.data!.active!.game.street).toBe('complete');expect(c.data!.hands).toHaveLength(hand+1);
    expect(canonical(c.data!.hands[hand].privateProfiles)).toBe(identity);
    if(hand<2){
     const game=c.data!.active!.game,hero=game.seats.find(s=>s.id===0)!;
     if(hero.stack<20000){await c.topUp(100000-hero.stack);expect(c.error).toBe('');}
     // Large initial stacks keep this short reliability sample seated; a failure
     // here is explicit, never repaired by inventing opponent table funds.
     expect(game.seats.filter(s=>s.stack>0).length).toBeGreaterThanOrEqual(2);
     const old=structuredClone(game),oldProfiles=structuredClone(c.data!.active!.profiles);await Promise.all([c.nextHand(),c.nextHand()]);
     expect(c.error).toBe('');
     const active=c.data!.active!;expect(active.number).toBe(hand+2);
     // A successful between-hand churn may change the lineup. Identity stays
     // strict within each hand and its archive, with evidence for each arrival.
     for(const seat of active.game.seats){
      if(canonical(active.profiles[seat.id])===canonical(oldProfiles[seat.id]))continue;
      expect(seat.id).not.toBe(0);
      expect(active.configuration?.reason).toBe('next-hand-configuration');
      expect(active.configuration?.effectiveHandId).toBe(active.game.handId);
      expect(active.churnNews?.handId).toBe(active.game.handId);
      const priorName=old.seats.find(s=>s.id===seat.id)!.name;
      expect(active.churnNews!.lines.some(line=>line.startsWith(`${priorName} `)&&line.endsWith(`${seat.name} sits down.`))).toBe(true);
     }
     expect(canonical(c.data!.hands[hand].privateProfiles)).toBe(identity);
     identity=canonical(active.profiles);
     const next=canonical(c.data!.active!.game);await c.commitBot(old.handId,old.revision);expect(canonical(c.data!.active!.game)).toBe(next);
    }
   }
   expect(faulted).toBe(true);const before={wallet:c.data!.wallet,ledger:canonical(c.data!.ledger),hands:canonical(c.data!.hands),active:canonical(c.data!.active)};
   const exported=await c.exportHistory();expect(JSON.stringify(exported)).not.toMatch(/privateProfiles|personalitySeed|drawToken|deckCursor/);
   await c.importHistory(JSON.stringify(exported));await c.importHistory(JSON.stringify(exported));
   expect(c.data!.importedHands).toHaveLength(3);expect(c.data!.wallet).toBe(before.wallet);expect(canonical(c.data!.ledger)).toBe(before.ledger);expect(canonical(c.data!.hands)).toBe(before.hands);expect(canonical(c.data!.active)).toBe(before.active);
   const pokerNet=c.data!.hands.reduce((n,h)=>n+h.net,0);await c.adjustBankroll(c.data!.wallet+12345,'Step5A isolated manual edit');
   expect(c.data!.ledger.reduce((n,e)=>n+e.pokerNet,0)).toBe(pokerNet);
   port.fault=tableMode==='live'?'after':'before';await c.cashOut();expect(c.status).toBe('error');await c.retry();await Promise.all([c.cashOut(),c.cashOut()]);
   expect(c.data!.active).toBeNull();expect(c.data!.ledger.filter(e=>e.kind==='cash-out')).toHaveLength(1);money(c.data!);await validateData(c.data!);
   const saved=canonical(c.data);c.close();c=await open(port);expect(canonical(c.data)).toBe(saved);c.close();
  },30000);
 }
});
