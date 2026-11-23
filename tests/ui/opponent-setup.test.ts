import { describe, expect, it } from 'vitest';
import type { CashSettings } from '../../src/session/types';
import type { BotMemory } from '../../src/contracts';
import { initializeOpponentSettings, OPPONENT_LABELS, opponentSetup, randomizeOpponentSettings, readOpponentSettings, TRAIT_FIELDS } from '../../src/ui/opponent-setup';
import { observedOpponentCards } from '../../src/ui/opponent-study';

function settings():CashSettings {
  return {seats:6,stake:'0',smallBlind:100,bigBlind:200,buyIn:20000,archetypes:['tag','nit','station','lag','passive-reg','maniac','fit-or-fold','stronger-reg','tag'],rakeMode:'none',rakeBasisPoints:0,rakeCap:0,noFlopNoDrop:true,minBuyInBB:1,maxBuyInBB:500,allowTopUp:true};
}

describe('Host opponent configuration draft',()=>{
  it('initializes nine independent seeds once, retaining legacy seat styles without mutating saved settings',()=>{
    const prior=settings(),copy=structuredClone(prior);
    const draft=initializeOpponentSettings(prior,()=>5);
    expect(prior).toEqual(copy);
    expect(draft.opponents?.map(item=>item.selection)).toEqual(prior.archetypes);
    expect(new Set(draft.opponents?.map(item=>item.personalitySeed)).size).toBe(9);
    expect(draft.population).toBe('neutral');
    expect(initializeOpponentSettings(draft,()=>{throw new Error('Should retain identities');})).toEqual(draft);
  });
  it('preserves explicit skill, population and zero seed across initialization',()=>{
    const prior={...settings(),population:'high' as const,opponents:[{selection:'unknown' as const,personalitySeed:0,skill:0.83}]};
    const draft=initializeOpponentSettings(prior,()=>5);
    expect(draft.opponents?.[0]).toEqual(prior.opponents[0]);
    expect(draft.population).toBe('high');
  });
  it('randomization assigns random selections and fresh independent identities without changing stakes or preset',()=>{
    const draft=initializeOpponentSettings({...settings(),population:'low'},()=>5);
    const randomized=randomizeOpponentSettings(draft,()=>5);
    expect(randomized.population).toBe('low');
    expect(randomized.bigBlind).toBe(draft.bigBlind);
    expect(randomized.opponents?.every(item=>item.selection==='random' && item.skill===undefined)).toBe(true);
    const previous=new Set(draft.opponents?.map(item=>item.personalitySeed));
    expect(randomized.opponents?.every(item=>!previous.has(item.personalitySeed))).toBe(true);
    expect(new Set(randomized.opponents?.map(item=>item.personalitySeed)).size).toBe(9);
  });
  it('retains all identities and hidden seats when reading a smaller table form',()=>{
    const draft=initializeOpponentSettings(settings(),()=>100);
    const data=new FormData();data.set('opponent-1-selection','unknown');data.set('opponent-1-skill','0.2');
    const next=readOpponentSettings(data,draft);
    expect(next.opponents?.[0]).toEqual({selection:'unknown',skill:0.2,personalitySeed:100});
    expect(next.opponents?.slice(1)).toEqual(draft.opponents?.slice(1));
    expect(next.population).toBe('neutral');
  });
  it.each(['invalid','__proto__','toString'])('rejects unsupported population %s',population=>{
    const data=new FormData();data.set('population',population);
    expect(()=>readOpponentSettings(data,initializeOpponentSettings(settings(),()=>1))).toThrow('valid opponent population');
  });
  it('uses blank skill as population default rather than zero',()=>{
    const draft=initializeOpponentSettings(settings(),()=>1);draft.opponents![0].skill=0.8;
    const data=new FormData();data.set('opponent-1-skill','');
    expect(readOpponentSettings(data,draft).opponents?.[0].skill).toBeUndefined();
    data.set('opponent-1-skill','0');
    expect(readOpponentSettings(data,draft).opponents?.[0].skill).toBe(0);
  });
  it('reads every explicit custom trait exactly within bounds and preserves seed',()=>{
    const draft=initializeOpponentSettings(settings(),()=>99),data=new FormData();
    data.set('opponent-1-selection','custom');data.set('opponent-1-base','lag');data.set('opponent-1-aggression','0');data.set('opponent-1-looseness','1');
    for(const [index,{key}] of TRAIT_FIELDS.entries())data.set(`opponent-1-${key}`,String(index/20));
    const actual=readOpponentSettings(data,draft).opponents![0];
    expect(TRAIT_FIELDS).toHaveLength(13);expect(new Set(TRAIT_FIELDS.map(item=>item.key)).size).toBe(13);
    expect(actual.personalitySeed).toBe(99);expect(actual.baseArchetype).toBe('lag');
    expect(actual.aggression).toBe(0);expect(actual.looseness).toBe(1);
    for(const [index,{key}] of TRAIT_FIELDS.entries())expect(actual.traits?.[key]).toBe(index/20);
  });
  it.each(['-0.01','1.01','NaN','Infinity'])('rejects invalid skill %s',value=>{
    const data=new FormData();data.set('opponent-1-skill',value);
    expect(()=>readOpponentSettings(data,initializeOpponentSettings(settings(),()=>1))).toThrow('0 to 1');
  });
  it.each(['-0.01','1.01','NaN',''])('rejects invalid custom trait %s',value=>{
    const data=new FormData();data.set('opponent-1-selection','custom');data.set('opponent-1-mistakeRate',value);
    expect(()=>readOpponentSettings(data,initializeOpponentSettings(settings(),()=>1))).toThrow('0 to 1');
  });
  it('drops custom overrides when selecting a named, random or unknown opponent',()=>{
    const draft=initializeOpponentSettings({...settings(),opponents:[{selection:'custom',aggression:1,looseness:1,traits:{mistakeRate:0.9},baseArchetype:'maniac'}]},()=>10);
    for(const selection of ['tag','random','unknown']){
      const data=new FormData();data.set('opponent-1-selection',selection);
      expect(readOpponentSettings(data,draft).opponents?.[0]).toEqual({selection,personalitySeed:10});
    }
  });
  it('renders custom controls only for custom seats and never renders seed values',()=>{
    const draft=initializeOpponentSettings(settings(),()=>123456789);
    const names=['You','<Alex>','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'];
    expect(opponentSetup(draft,names,[],new Set())).not.toContain('opponent-1-mistakeRate');
    draft.opponents![0].selection='custom';
    const markup=opponentSetup(draft,names,[],new Set([1]));
    for(const {key} of TRAIT_FIELDS)expect(markup).toContain(`id="opponent-1-${key}"`);
    expect(markup).not.toContain('123456789');expect(markup).toContain('&lt;Alex&gt;');
    expect(markup).toContain('Recreational player');expect(markup).toContain('data-opponent-details="1" open');
  });
});

describe('one-line opponent rows in Host setup',()=>{
  const names=['You','Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Sam'];
  it('renders each opponent closed, naming its seat and current style, with the controls still in the form',()=>{
    const draft=initializeOpponentSettings(settings(),()=>7);
    const markup=opponentSetup(draft,names,[],new Set());
    for(const seat of [1,2,3,4,5]){
      expect(markup).toContain(`id="opponent-card-${seat}" data-opponent-card="${seat}" >`);
      expect(markup).toContain(`Seat ${seat+1} · ${OPPONENT_LABELS[draft.opponents![seat-1].selection]}`);
      expect(markup).toContain(`id="opponent-${seat}-selection"`);expect(markup).toContain(`id="opponent-${seat}-skill"`);
    }
    expect(markup).not.toContain('data-opponent-card="6"');
  });
  it('opens a row when asked, and never hides an open personality panel inside a closed row',()=>{
    const draft=initializeOpponentSettings(settings(),()=>7);
    expect(opponentSetup(draft,names,[],new Set(),new Set([2]))).toContain('data-opponent-card="2" open>');
    const inner=opponentSetup(draft,names,[],new Set([3]));
    expect(inner).toContain('data-opponent-card="3" open>');expect(inner).toContain('data-opponent-details="3" open');
    expect(inner).toContain('data-opponent-card="1" >');
  });
  it('shows a set skill in the row',()=>{
    const draft=initializeOpponentSettings(settings(),()=>7);draft.opponents![0].skill=0.2;
    expect(opponentSetup(draft,names,[],new Set())).toContain('· skill 0.2</small>');
  });
});

describe('public opponent study cards',()=>{
  it('renders observed counts, zero-opportunity dash and escaped public names without hidden labels',()=>{
    const memory:BotMemory={windowHands:8,opponents:[{seatId:1,hands:8,vpip:{count:3,opportunities:8},pfr:{count:1,opportunities:7},aggression:{count:0,opportunities:0},foldToBet:{count:2,opportunities:4},showdowns:[['Ah','Kd']]}]};
    const markup=observedOpponentCards(memory,['You','<Alex>']);
    expect(markup).toContain('37.5%');expect(markup).toContain('3 / 8 opportunities');
    expect(markup).toContain('<dd>—');expect(markup).toContain('&lt;Alex&gt;');
    expect(markup).toContain('maximum 120');expect(markup).toContain('Ah Kd');
    expect(markup).not.toContain('personality');expect(markup).not.toContain('archetype');
  });
});
