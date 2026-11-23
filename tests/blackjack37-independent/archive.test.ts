import { describe, expect, it } from 'vitest';
import { applyBlackjack, createBlackjackState, orderedBlackjackShoe, type BlackjackState, type ShoeCard } from '../../src/blackjack/engine';
import { BLACKJACK_TABLES } from '../../src/blackjack/presets';
import { anchorFor, appendRecord, auditSnapshot, checkpoint, digest, emptySession, initialBlackjackData, recordAfter, segmentStats, type BlackjackData, type BlackjackSnapshot } from '../../src/blackjack/runtime';
const rules = BLACKJACK_TABLES.find(t=>t.id==='casino-5')!;
function winner(balance=200000):BlackjackState {
  const rest=orderedBlackjackShoe(6),first=['Ac','6c','Kd','Tc'].map(face=>rest.splice(rest.findIndex(c=>c.slice(2)===face),1)[0]);
  const start=createBlackjackState(rules,[...first,...rest] as ShoeCard[],{balance,ante:50});
  return applyBlackjack(start,{id:'natural',revision:0,type:'deal',bet:500});
}
function fixture(count=2):BlackjackSnapshot {
  const data=initialBlackjackData(),records=[];
  for(let n=0;n<count;n++) {
    const engine=winner(data.balance),rec=recordAfter(data.head,{kind:'segment',id:`segment-${n}`,sessionId:`session-${n}`,startedAt:'2026-11-16T00:00:00Z',finishedAt:'2026-11-16T00:01:00Z',engine,reviews:[],closedSession:true});
    records.push(rec);appendRecord(data,rec);data.balance=engine.balance;data.lastSession=segmentStats(engine,[]);
  }
  data.revision=count;
  const c=checkpoint(data);return {checkpoint:c,anchor:anchorFor(c),records};
}
function reseal(s:BlackjackSnapshot):void {
  s.checkpoint.hash=digest(s.checkpoint.payload);s.anchor=anchorFor(s.checkpoint);
}

describe('independent archive and commitment corruption fixtures',()=>{
  it('full replay independently agrees with exact two-natural financial result',()=>{
    const restored=auditSnapshot(fixture());
    expect(restored.balance).toBe(201400); // Two 3:2 $5 naturals less two 50c fees.
    expect(restored.lastSession?.net).toBe(700);
    expect(restored.head.sequence).toBe(2);
  });
  it('rejects omitted archive records even when the active financial checkpoint looks valid',()=>{
    const s=fixture();s.records.shift();expect(()=>auditSnapshot(s)).toThrow();
  });
  it('rejects duplicate archives',()=>{
    const s=fixture();s.records[1]=structuredClone(s.records[0]);expect(()=>auditSnapshot(s)).toThrow();
  });
  it('rejects reordered archives',()=>{
    const s=fixture();s.records.reverse();expect(()=>auditSnapshot(s)).toThrow();
  });
  it('rejects a stale independently valid checkpoint against the newer committed anchor',()=>{
    const old=fixture(1),current=fixture(2);old.anchor=current.anchor;
    expect(()=>auditSnapshot(old)).toThrow('head');
  });
  it('rejects archive payload corruption with unchanged digest',()=>{
    const s=fixture();if(s.records[0].body.kind==='segment')s.records[0].body.engine.balance+=100;
    expect(()=>auditSnapshot(s)).toThrow();
  });
  it('full replay rejects a rehashed inconsistent engine as well as hash corruption',()=>{
    const s=fixture(1),r=s.records[0];if(r.body.kind!=='segment')throw Error('fixture');
    r.body.engine.round!.hands[0].payout+=100;
    r.hash=digest({sequence:r.sequence,previousHash:r.previousHash,body:r.body});s.checkpoint.payload.head.hash=r.hash;reseal(s);
    expect(()=>auditSnapshot(s)).toThrow('replay');
  });
  it('rejects a rehashed unknown historical engine version',()=>{
    const s=fixture(1),r=s.records[0];if(r.body.kind!=='segment')throw Error('fixture');
    (r.body.engine as {version:string}).version='unsupported-future';
    r.hash=digest({sequence:r.sequence,previousHash:r.previousHash,body:r.body});s.checkpoint.payload.head.hash=r.hash;reseal(s);
    expect(()=>auditSnapshot(s)).toThrow('Unsupported');
  });
  it('rejects a rehashed false last-session summary',()=>{
    const s=fixture();s.checkpoint.payload.lastSession!.net++;reseal(s);
    expect(()=>auditSnapshot(s)).toThrow('summary');
  });
  it('detects incorrect incremental prior-session statistics when the same session crosses shoes',()=>{
    const s=fixture(1),data=s.checkpoint.payload;
    data.active={id:'next-segment',sessionId:'session-0',startedAt:'2026-11-16T00:01:00Z',engine:createBlackjackState(rules,orderedBlackjackShoe(6),{balance:data.balance,ante:50}),reviews:[],prior:emptySession()};
    data.active.prior.rounds=999;reseal(s);
    expect(()=>auditSnapshot(s)).toThrow('statistics');
  });
  it('validates an unfinished split without exposing or settling it during audit',()=>{
    const rest=orderedBlackjackShoe(6),first=['8c','6c','8d','Tc','3c'].map(face=>rest.splice(rest.findIndex(c=>c.slice(2)===face),1)[0]);
    let e=createBlackjackState(rules,[...first,...rest]);
    e=applyBlackjack(e,{id:'deal',revision:0,type:'deal',bet:500});e=applyBlackjack(e,{id:'split',revision:1,type:'split'});
    const data:BlackjackData={...initialBlackjackData(),revision:2,balance:198950,active:{id:'a',sessionId:'s',startedAt:'2026-11-16T00:00:00Z',engine:e,reviews:[],prior:emptySession()}};
    const c=checkpoint(data),s={checkpoint:c,anchor:anchorFor(c),records:[]};
    const restored=auditSnapshot(s);expect(restored.active!.engine.round!.phase).toBe('player');expect(restored.balance).toBe(198950);expect(restored.active!.engine.ledger.filter(x=>x.kind==='settle')).toHaveLength(0);
  });
});
