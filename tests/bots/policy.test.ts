import {describe,it,expect,vi} from 'vitest';
import fc from 'fast-check';
import type {BotObservation, BotProfile, Card} from '../../src/contracts';
import {startHand,applyCommand,observeBot} from '../../src/core/engine';
import * as frozenV2 from '../../src/bots/v2/policy';
import {practiceProfile,rig} from '../verification/helpers';
import {ARCHETYPES,POLICY_VERSION,defaultProfile,chooseDecision,DecisionCache,policyDistribution,handFeatures,securePolicyRandom} from '../../src/bots/policy';

function observation(overrides:Partial<BotObservation>={}):BotObservation {
  return {handId:'fixture-1',revision:3,actingSeat:1,decisionId:'fixture-1:3:1',policyVersion:POLICY_VERSION,
    ownCards:['Kh','Jd'],board:[],street:'preflop',button:0,pot:300,bigBlind:200,
    seats:[{id:0,stack:19900,streetCommitted:100,totalCommitted:100,folded:false,allIn:false},{id:1,stack:19800,streetCommitted:200,totalCommitted:200,folded:false,allIn:false}],
    legal:{actor:1,fold:true,check:false,callAmount:200,minRaiseTo:600,maxRaiseTo:20000,canRaise:true,shortAllInTo:null,reopened:true},
    publicEvents:[],...overrides};
}
/** Context hypotheses use a real engine history. The hand-built observation above
 * intentionally supports boundary fault injection; it is not a valid betting prefix.
 */
function pricedContext(ownCards:Card[],board:Card[]=[],raiseTo=400):BotObservation {
 const reserved=new Set([...ownCards,...board]);
 const unused=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!reserved.has(c));
 const other=unused.splice(0,2),runout=[...board,...unused.splice(0,5-board.length)];
 const ownSeat=board.length?0:1;
 let state=rig(startHand({handId:'priced-hypothesis',button:0,profile:practiceProfile(),seats:[{id:0,name:'Seat0',stack:20000},{id:1,name:'Seat1',stack:20000}]}),ownSeat===0?[ownCards,other]:[other,ownCards],runout);
 const act=(action:{type:'call'|'check'}|{type:'raise';to:number})=>{state=applyCommand(state,{handId:state.handId,revision:state.revision,seatId:state.actor!,decisionId:`prefix:${state.revision}`,action});};
 if(board.length){act({type:'call'});act({type:'check'});act({type:'raise',to:raiseTo});}
 else act({type:'raise',to:raiseTo});
 expect(state.actor).toBe(ownSeat);
 expect(state.seats.reduce((n,s)=>n+s.totalCommitted,0)).toBe(state.pot);
 return observeBot(state,ownSeat,POLICY_VERSION,`observe:${state.revision}`);
}
const versions=[{name:'current',version:POLICY_VERSION,distribution:policyDistribution},{name:'frozen1.1',version:frozenV2.POLICY_VERSION,distribution:frozenV2.policyDistribution}];
function hypothesisDistribution(v:typeof versions[number],o:BotObservation,p:BotProfile){return v.distribution({...o,policyVersion:v.version},{...p,policyVersion:v.version});}
function assertLegal(o:BotObservation,p:BotProfile,random:()=>number) {
  const d=chooseDecision(o,p,random);
  expect(d.handId).toBe(o.handId);expect(d.revision).toBe(o.revision);expect(d.seatId).toBe(o.actingSeat);
  if(d.action.type==='check') expect(o.legal.check).toBe(true);
  if(d.action.type==='fold') expect(o.legal.fold).toBe(true);
  if(d.action.type==='call') expect(o.legal.callAmount).toBeGreaterThan(0);
  if(d.action.type==='raise') {
    expect(Number.isSafeInteger(d.action.to)).toBe(true);
    if(o.legal.canRaise){expect(d.action.to).toBeGreaterThanOrEqual(o.legal.minRaiseTo!);expect(d.action.to).toBeLessThanOrEqual(o.legal.maxRaiseTo!);}
    else expect(d.action.to).toBe(o.legal.shortAllInTo);
  }
}

describe('synthetic bot legal and identity boundary',()=>{
  it('provides eight immutable-by-copy profiles with explicit version',()=>{
    expect(ARCHETYPES).toHaveLength(8);
    for(const type of ARCHETYPES){const a=defaultProfile(type);a.aggression=0;expect(defaultProfile(type).aggression).toBeGreaterThan(0);expect(a.policyVersion).toBe(POLICY_VERSION);}
  });
  it('samples only engine-provided legal choices across bounded contexts',()=>{
    fc.assert(fc.property(fc.integer({min:0,max:999999}),fc.integer({min:0,max:7}),fc.boolean(),fc.boolean(),(n,index,free,noRaise)=>{
      const o=observation();
      o.legal={...o.legal,check:free,callAmount:free?0:200,canRaise:!noRaise,minRaiseTo:noRaise?null:600,maxRaiseTo:noRaise?null:20000};
      assertLegal(o,defaultProfile(ARCHETYPES[index]),()=>n/1000000);
      const d=policyDistribution(o,defaultProfile(ARCHETYPES[index]));
      expect(Object.values(d).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
      expect(Object.values(d).every(v=>v>=0&&v<=1)).toBe(true);
    }),{seed:70101,numRuns:1000});
  });
  it('supports a short all-in without inventing full-raise rights',()=>{
    const o=observation();o.seats[1].stack=300;
    o.legal={...o.legal,canRaise:true,minRaiseTo:600,maxRaiseTo:500,shortAllInTo:500};
    const d=chooseDecision(o,defaultProfile('maniac'),()=>0.9999);
    expect(d.action).toEqual({type:'raise',to:500});
  });
  it('never folds or calls when free checking is available',()=>{
    const o=observation();o.legal={...o.legal,check:true,callAmount:0,canRaise:false,minRaiseTo:null,maxRaiseTo:null};
    for(const type of ARCHETYPES) for(const n of [0,.3,.99]) expect(chooseDecision(o,defaultProfile(type),()=>n).action.type).toBe('check');
  });
  it('never reads extra hidden state properties or per-seat holes',()=>{
    const o=observation();
    Object.defineProperty(o,'deck',{get(){throw new Error('Forbidden deck read');}});
    Object.defineProperty(o,'heroCards',{get(){throw new Error('Forbidden hero card read');}});
    Object.defineProperty(o.seats[0],'hole',{get(){throw new Error('Forbidden opponent card read');}});
    const first=chooseDecision(o,defaultProfile('tag'),()=>.5);
    expect(first).toEqual(chooseDecision(observation(),defaultProfile('tag'),()=>.5));
  });
  it('does not use card-bearing events as a hidden hand channel',()=>{
    const a=observation(),b=observation();
    a.publicEvents=[{id:'event-1',handId:a.handId,revision:1,type:'action',cards:['As','Ad']}];
    b.publicEvents=[{id:'event-1',handId:a.handId,revision:1,type:'action',cards:['2s','2d']}];
    expect(chooseDecision(a,defaultProfile('tag'),()=>.7)).toEqual(chooseDecision(b,defaultProfile('tag'),()=>.7));
  });
  it('samples once across 100 retry calls and protects cached results from caller mutation',()=>{
    const random=vi.fn(()=>.99),cache=new DecisionCache(random),o=observation(),p=defaultProfile('tag');
    const first=cache.getOrCreate(o,p),drawCount=random.mock.calls.length;
    expect(drawCount).toBeGreaterThan(0);
    for(let i=0;i<100;i++) expect(cache.getOrCreate(structuredClone(o),{...p})).toEqual(first);
    expect(random).toHaveBeenCalledTimes(drawCount);expect(cache.size).toBe(1);
    first.action={type:'fold'};
    expect(cache.getOrCreate(o,p).action.type).toBe('raise');
  });
  it('rejects reused IDs with altered revision, policy, visible card or legal context',()=>{
    const cache=new DecisionCache(()=>.1),o=observation(),p=defaultProfile('tag');cache.getOrCreate(o,p);
    expect(()=>cache.getOrCreate({...o,revision:4},p)).toThrow(/reused/);
    expect(()=>cache.getOrCreate(o,{...p,aggression:.99})).toThrow(/reused/);
    expect(()=>cache.getOrCreate({...o,ownCards:['Ac','Ad']},p)).toThrow(/reused/);
    expect(()=>cache.getOrCreate({...o,legal:{...o.legal,callAmount:300}},p)).toThrow(/reused/);
  });
  it('rejects different IDs at one authority revision without taking a second draw',()=>{
    const random=vi.fn(()=>.99),cache=new DecisionCache(random),o=observation(),p=defaultProfile('tag');
    cache.getOrCreate(o,p);const draws=random.mock.calls.length;
    expect(()=>cache.getOrCreate({...o,decisionId:'reroll'},p)).toThrow(/ID cannot change/);
    expect(random).toHaveBeenCalledTimes(draws);
  });
  it('binds a cache to one hand and rejects uncached stale revisions without eviction',()=>{
    const random=vi.fn(()=>.99),cache=new DecisionCache(random),o=observation(),p=defaultProfile('tag');
    const original=cache.getOrCreate(o,p);
    cache.getOrCreate({...o,revision:5,decisionId:'revision-5'},p);const draws=random.mock.calls.length;
    expect(()=>cache.getOrCreate({...o,handId:'another-hand',decisionId:'another-hand:3'},p)).toThrow(/another hand/);
    expect(()=>cache.getOrCreate({...o,revision:4,decisionId:'late-4'},p)).toThrow(/stale/);
    expect(cache.getOrCreate(o,p)).toEqual(original);expect(cache.size).toBe(2);
    expect(random).toHaveBeenCalledTimes(draws);
  });
  it('reserves the node before sampling and refuses a reroll after a partial entropy failure',()=>{
    const random=vi.fn().mockReturnValueOnce(.9999).mockImplementation(()=>{throw new Error('entropy failure');});
    const cache=new DecisionCache(random),o=observation(),p=defaultProfile('tag');
    expect(()=>cache.getOrCreate(o,p)).toThrow(/entropy failure/);
    expect(random).toHaveBeenCalledTimes(2);
    expect(()=>cache.getOrCreate(o,p)).toThrow(/rather than reroll/);
    expect(()=>cache.getOrCreate({...o,decisionId:'new-id-same-node'},p)).toThrow(/ID cannot change/);
    expect(random).toHaveBeenCalledTimes(2);expect(cache.size).toBe(0);
  });
  it('refuses contradictory short-all-in metadata when the engine closes raising',()=>{
    const o=observation();o.seats[1].stack=300;
    o.legal={...o.legal,canRaise:false,reopened:false,minRaiseTo:null,maxRaiseTo:null,shortAllInTo:500};
    expect(()=>chooseDecision(o,defaultProfile('maniac'),()=>.9999)).toThrow(/raising is closed/);
  });
  it('rejects malformed observations, policy versions and entropy draws',()=>{
    const p=defaultProfile('tag'),o=observation();
    expect(()=>chooseDecision({...o,policyVersion:'wrong'},p)).toThrow(/version/);
    expect(()=>chooseDecision({...o,street:'complete'},p)).toThrow(/turn/);
    expect(()=>chooseDecision({...o,ownCards:['As','As']},p)).toThrow(/cards/);
    expect(()=>chooseDecision({...o,legal:{...o.legal,actor:0}},p)).toThrow(/turn/);
    expect(()=>chooseDecision({...o,legal:{...o.legal,callAmount:0}},p)).toThrow(/Inconsistent/);
    expect(()=>chooseDecision(o,p,()=>NaN)).toThrow(/random/);
    expect(()=>chooseDecision(o,p,()=>1)).toThrow(/random/);
  });
  it('fails closed when cryptographic entropy is absent',()=>{
    const original=globalThis.crypto;
    Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});
    try{expect(()=>securePolicyRandom()).toThrow(/Secure randomness/);}finally{Object.defineProperty(globalThis,'crypto',{value:original,configurable:true});}
  });
});

describe('pre-registered narrow synthetic context hypotheses',()=>{
  it('station continues marginal priced hands more than nit, while TAG raises more than station when strong',()=>{
    const marginal=observation({ownCards:['9h','8h']});
    expect(policyDistribution(marginal,defaultProfile('station')).fold).toBeLessThan(policyDistribution(marginal,defaultProfile('nit')).fold);
    const strong=observation({ownCards:['Ah','Ad']});
    expect(policyDistribution(strong,defaultProfile('tag')).raise).toBeGreaterThan(policyDistribution(strong,defaultProfile('station')).raise);
  });
  it('higher call price reduces continuation in a paired context',()=>{
    const cheap=pricedContext(['Kh','Jd'],[],400),costly=pricedContext(['Kh','Jd'],[],800);
    expect(cheap.legal.callAmount).toBe(200);expect(costly.legal.callAmount).toBe(600);
    for(const v of versions) for(const type of ARCHETYPES) expect(hypothesisDistribution(v,costly,defaultProfile(type)).fold).toBeGreaterThan(hypothesisDistribution(v,cheap,defaultProfile(type)).fold);
  });
  it('flush draw is valued before river but not after river',()=>{
    expect(handFeatures(['Ah','7h'],['Kh','2h','9c']).draw).toBeGreaterThan(0);
    expect(handFeatures(['Ah','7h'],['Kh','2h','9c','4s','Jd']).draw).toBe(0);
    const draw=pricedContext(['Ah','7h'],['Kh','2h','9c']),noDraw=pricedContext(['Ad','7s'],['Kh','2h','9c']);
    for(const v of versions) expect(hypothesisDistribution(v,draw,defaultProfile('tag')).fold).toBeLessThan(hypothesisDistribution(v,noDraw,defaultProfile('tag')).fold);
  });
  it('fit-or-fold penalty applies on a missed flop without changing preflop via hidden information',()=>{
    const missed=pricedContext(['Kh','Jd'],['8c','4s','2d']);
    const fit=defaultProfile('fit-or-fold');const matched={...fit,archetype:'tag' as const};
    for(const v of versions) expect(hypothesisDistribution(v,missed,fit).fold).toBeGreaterThan(hypothesisDistribution(v,missed,matched).fold);
  });
});
