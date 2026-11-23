import { describe, expect, it } from 'vitest';
import type { Archetype } from '../../src/contracts';
import { ARCHETYPES, analyzeDecision, createProfile } from '../../src/bots/policy';
import { assertAccounting, observeBot } from '../../src/core/engine';
import { allHandClasses, firstIn } from './preflop-fixtures';

describe('Step4B preregistered default premium/context release guards',()=>{
 it.each([{archetype:'nit',floor:.90},{archetype:'station',floor:.80},{archetype:'passive-reg',floor:.80},{archetype:'tag',floor:.95},{archetype:'stronger-reg',floor:.95}] as const)('$archetype first-in AA/KK use bounded ordinary limps',({archetype,floor})=>{
  const p=createProfile({selection:archetype},1001+ARCHETYPES.indexOf(archetype),'neutral');
  for(const own of [['As','Ah'],['Ks','Kh']]){
   const state=firstIn(own);const o=observeBot(state,3,p.policyVersion,`guard:${own.join('')}`);assertAccounting(state);
   expect(o.publicEvents.some(e=>e.type==='action')).toBe(false);
   expect(analyzeDecision(o,p).distribution.raise,`${archetype}/${own.join('')}: synthetic coherence bound, not empirical rate`).toBeGreaterThanOrEqual(floor);
  }
 });
 it('nit marginal JTo early entry is at most half button entry and below AA entry',()=>{
  const p=createProfile({selection:'nit'},1001,'neutral');const entry=(cards:string[],position:'early'|'button')=>{
   const state=firstIn(cards,position);return 1-analyzeDecision(observeBot(state,state.actor!,p.policyVersion,`entry:${position}`),p).distribution.fold;
  };
  expect(entry(['Jh','Tc'],'early')).toBeLessThanOrEqual(entry(['Jh','Tc'],'button')*.5);
  expect(entry(['Jh','Tc'],'early')).toBeLessThan(entry(['As','Ah'],'early'));
 });
 it('1326 distinct physical combinations map to exactly169 correctly weighted classes',()=>{
  const classes=allHandClasses();expect(classes).toHaveLength(169);expect(classes.reduce((n,c)=>n+c.weight,0)).toBe(1326);
  expect(classes.filter(c=>c.label.length===2)).toHaveLength(13);expect(classes.filter(c=>c.label.endsWith('s'))).toHaveLength(78);expect(classes.filter(c=>c.label.endsWith('o'))).toHaveLength(78);
  for(const c of classes)expect(c.weight).toBe(c.label.length===2?6:c.label.endsWith('s')?4:12);
  expect(new Set(classes.flatMap(c=>c.combos.map(cards=>[...cards].sort().join('')))).size).toBe(1326);
 });
 it.each([20,40,60,100,150,250])('legal first-in fixtures span all five positions at%sBB',stack=>{
  for(const position of ['early','middle','cutoff','button','small-blind'] as const){const state=firstIn(['As','Kh'],position,stack);assertAccounting(state);expect(state.actor).not.toBeNull();expect(new Set(state.deck).size).toBe(52);}
 });
 it('premium entry ordering is not below marginal connectors in the same first-in context',()=>{
  for(const archetype of ['nit','tag','stronger-reg'] satisfies Archetype[]){const p=createProfile({selection:archetype},1001+ARCHETYPES.indexOf(archetype),'neutral');
   const entry=(own:string[])=>{const s=firstIn(own);return 1-analyzeDecision(observeBot(s,s.actor!,p.policyVersion,own.join('')),p).distribution.fold;};
   for(const premium of [['As','Ah'],['Ks','Kh'],['Qs','Qh'],['As','Ks']])expect(entry(premium)).toBeGreaterThanOrEqual(entry(['9h','8h']));
  }
 });
});
