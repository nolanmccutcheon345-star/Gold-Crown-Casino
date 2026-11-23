import { describe, expect, it } from 'vitest';
import { BlackjackController } from '../../src/blackjack/controller';
import { MemoryBlackjackPersistence } from '../../src/blackjack/persistence';
import { applyBlackjack, createBlackjackState, orderedBlackjackShoe, type BlackjackState } from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { anchorFor, checkpoint, emptySession, initialBlackjackData, type BlackjackData, type BlackjackRecord } from '../../src/blackjack/runtime';
const table=BLACKJACK_TABLES.find(t=>t.id==='casino-5')!;
function engine(faces:string[]):BlackjackState {
  const rest=orderedBlackjackShoe(6),first=faces.map(face=>rest.splice(rest.findIndex(c=>c.slice(2)===face),1)[0]);
  const state=createBlackjackState(table,[...first,...rest]);
  return applyBlackjack(state,{id:'deal-0',revision:0,type:'deal',bet:500});
}
function fixture(e=engine(['9c','6c','8d','Tc','8h'])) {
  const port=new MemoryBlackjackPersistence(),data={...initialBlackjackData(),revision:2,balance:e.balance,active:{id:'active',sessionId:'session',startedAt:'2026-11-16T00:00:00Z',engine:e,reviews:[],prior:emptySession()}};
  port.current=checkpoint(data);port.anchor=anchorFor(port.current);return port;
}
class UncertainPort extends MemoryBlackjackPersistence {
  fail:'before'|'after'|null=null;
  override async commit(expected:number|null,data:BlackjackData,records:BlackjackRecord[]) {
    const fail=this.fail;this.fail=null;
    if(fail==='before')throw Error('Injected quota failure');
    await super.commit(expected,data,records);
    if(fail==='after')throw Error('Commit acknowledged after interrupted caller');
  }
}
function uncertain() {
  const source=fixture(),port=new UncertainPort();port.current=source.current;port.anchor=source.anchor;return port;
}

describe('independent live controller recovery fixtures',()=>{
  it.each(['before','after'] as const)('%s commit failure retries the exact settlement once',async failure=>{
    const port=uncertain(),c=new BlackjackController(port);await c.init();
    const before=c.publicState!,revision=c.data!.revision;port.fail=failure;
    await c.act('stand',revision);
    expect(c.status).toBe('error');expect(c.publicState).toEqual(before);
    await c.retry();expect(c.status).toBe('ready');expect(c.publicState!.round!.phase).toBe('settled');
    expect(c.data!.balance).toBe(200450);
    expect(c.data!.active!.engine.ledger.filter(x=>x.kind==='settle')).toHaveLength(1);
    await c.act('stand',revision);expect(c.data!.balance).toBe(200450);
    expect(await c.auditHistory()).toBe(1);
  });
  it('Retry recovers a transient initial storage-read failure without reloading the page',async()=>{
    class InitiallyUnavailable extends MemoryBlackjackPersistence {
      unavailable=true;
      override async load(){if(this.unavailable){this.unavailable=false;throw Error('Storage temporarily unavailable');}return super.load();}
    }
    const port=new InitiallyUnavailable(),c=new BlackjackController(port);await c.init();expect(c.status).toBe('error');expect(c.data).toBe(null);
    await c.retry();expect(c.status).toBe('ready');expect(c.data!.balance).toBe(200000);expect(port.current!.revision).toBe(0);
  });
  it('concurrent same-tab button submissions can only commit one action',async()=>{
    const port=fixture(),c=new BlackjackController(port);await c.init();const rev=c.data!.revision;
    await Promise.all([c.act('stand',rev),c.act('stand',rev)]);
    expect(c.data!.revision).toBe(rev+1);expect(c.data!.balance).toBe(200450);
    expect(c.data!.active!.engine.ledger.filter(x=>x.kind==='settle')).toHaveLength(1);
  });
  it('second-tab stale stand is read-only and retry reloads the first settled result',async()=>{
    const port=fixture(),a=new BlackjackController(port),b=new BlackjackController(port);await a.init();await b.init();
    const rev=a.data!.revision;await a.act('stand',rev);await b.act('stand',rev);
    expect(b.status).toBe('readonly');expect(b.publicState!.round!.phase).toBe('player');
    await b.retry();expect(b.status).toBe('ready');expect(b.data!.balance).toBe(a.data!.balance);
    expect(b.data!.revision).toBe(a.data!.revision);expect(await b.auditHistory()).toBe(1);
  });
  it('reload after split resumes the precise hand and only one ante',async()=>{
    const port=fixture(engine(['8c','6c','8d','Tc','3h','Th','2s','9d']));
    const first=new BlackjackController(port);await first.init();await first.act('split',first.data!.revision);
    const resume=new BlackjackController(port);await resume.init();expect(resume.publicState).toEqual(first.publicState);
    expect(resume.publicState!.round!.hands[1].cards).toHaveLength(1);
    await resume.act('double',resume.data!.revision);await resume.act('stand',resume.data!.revision);
    expect(resume.data!.balance).toBe(201450);expect(resume.data!.active!.engine.ledger.filter(x=>x.kind==='ante')).toHaveLength(1);
    await resume.leave();expect(await resume.auditHistory()).toBe(1);
    const restored=new BlackjackController(port);await restored.init();expect(restored.data!.balance).toBe(201450);expect(restored.session.rounds).toBe(1);
  });
  it('public history and count observation omit insurance-stage dealer hole and future shoe',async()=>{
    const c=new BlackjackController(fixture(engine(['9c','Ac','7d','Td','Kh'])));await c.init();
    expect(c.seen).toEqual(['9c','Ac','7d']);
    const history=await c.exportHistory();expect(history).not.toContain('Td');expect(history).not.toContain('Kh');
    const exported=JSON.parse(history);expect(exported.segments[0].current.round.dealer).toEqual(['Ac',null]);
    expect(history).not.toContain('initialShoe');expect(history).not.toContain('commands');
  });
  it('corrupt checkpoint blocks initialization and cannot silently reset the wallet',async()=>{
    const port=fixture();port.current!.payload.balance++;
    const before=JSON.stringify(port.current),c=new BlackjackController(port);await c.init();
    expect(c.status).toBe('error');expect(c.data).toBe(null);expect(JSON.stringify(port.current)).toBe(before);
    await c.sit('casino-5',50);expect(c.data).toBe(null);expect(JSON.stringify(port.current)).toBe(before);
  });
  it('uncounted model comparisons do not inflate coach accuracy denominators',async()=>{
    const c=new BlackjackController(fixture());await c.init();await c.act('stand',c.data!.revision);
    expect(c.session.decisions).toBe(0);expect(c.session.mistakes).toBe(0);
  });
});
