import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import type {RuleProfile} from '../../src/contracts';
import {ruleProfileConfigVersion,withRuleProfileConfigVersion} from '../../src/rules/provenance';
import {pokerStarsProfile} from '../../src/rules/pokerstars';
import {resolveRake} from '../../src/rules/rake';

const profile=():RuleProfile=>({id:'practice-cash',version:'0.3.0',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:500,cap:300,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'});
describe('New rule configuration provenance (V706)',()=>{
 it('is deterministic, idempotent and independent of property insertion order',()=>{
  const a=profile(),b={oddChipOrder:a.oddChipOrder,shortRaiseReopens:a.shortRaiseReopens,rake:{noFlopNoDrop:true,cap:300,basisPoints:500},chipUnit:1,bigBlind:200,smallBlind:100,mode:a.mode,version:a.version,id:a.id};
  expect(ruleProfileConfigVersion(a)).toBe(ruleProfileConfigVersion(b));
  expect(ruleProfileConfigVersion(a)).toMatch(/^0\.3\.0\+cfg\.[0-9a-f]{64}$/);
  expect(ruleProfileConfigVersion(withRuleProfileConfigVersion(a))).toBe(ruleProfileConfigVersion(a));
 });
 it('matches an independent Node SHA-256 of an explicitly ordered configuration fixture',()=>{
  const json='{"rules":{"bigBlind":200,"chipUnit":1,"id":"practice-cash","mode":"cash","oddChipOrder":"clockwise-from-button","rake":{"basisPoints":500,"cap":300,"noFlopNoDrop":true,"rounding":"floor"},"shortRaiseReopens":"cumulative","smallBlind":100},"schema":"cash-rule-configuration/1"}';
  expect(ruleProfileConfigVersion(profile())).toBe(`0.3.0+cfg.${createHash('sha256').update(json).digest('hex')}`);
 });
 it.each(['smallBlind','bigBlind','chipUnit'] as const)('changes when %s changes',key=>{
  const a=profile(),b=structuredClone(a);b[key]*=2;expect(ruleProfileConfigVersion(b)).not.toBe(ruleProfileConfigVersion(a));
 });
 it.each(['basisPoints','cap','noFlopNoDrop','rounding'] as const)('changes when rake.%s changes',key=>{
  const a=profile(),b=structuredClone(a);
  if(key==='noFlopNoDrop')b.rake.noFlopNoDrop=false;
  else if(key==='rounding')b.rake.rounding='half-even';
  else b.rake[key]+=1;
  expect(ruleProfileConfigVersion(b)).not.toBe(ruleProfileConfigVersion(a));
 });
 it('treats legacy omitted floor-rounding and explicit floor as the same effective rule',()=>{
  const a=profile(),b=profile();b.rake.rounding='floor';expect(ruleProfileConfigVersion(a)).toBe(ruleProfileConfigVersion(b));
 });
 it.each(['two','threeFour','fivePlus'] as const)('includes the complete source cap schedule: %s',key=>{
  const a=pokerStarsProfile(100,200),b=structuredClone(a);b.rake.capByDealtIn![key]++;
  expect(ruleProfileConfigVersion(b)).not.toBe(ruleProfileConfigVersion(a));
 });
 it('keeps the configured source version stable when the engine resolves a dealt-in cap',()=>{
  const base=pokerStarsProfile(100,200);
  const two={...base,rake:resolveRake(base.rake,2)},six={...base,rake:resolveRake(base.rake,6)};
  expect(two.rake.cap).toBe(125);expect(six.rake.cap).toBe(275);
  expect(ruleProfileConfigVersion(two)).toBe(ruleProfileConfigVersion(base));
  expect(ruleProfileConfigVersion(six)).toBe(ruleProfileConfigVersion(base));
 });
 it('includes source attribution and implementation-base version without touching policy versions',()=>{
  const a=pokerStarsProfile(100,200),b=structuredClone(a);b.rake.source!.retrievedAt='2026-11-02';
  expect(ruleProfileConfigVersion(b)).not.toBe(ruleProfileConfigVersion(a));
  expect(ruleProfileConfigVersion(a,'2027-01-01')).toMatch(/^2027-01-01\+cfg\./);
 });
 it('never mutates a historical profile or shared rake object',()=>{
  const legacy=profile();legacy.version='0.1.0';Object.freeze(legacy.rake);Object.freeze(legacy);
  const before=JSON.stringify(legacy),next=withRuleProfileConfigVersion(legacy);
  expect(JSON.stringify(legacy)).toBe(before);expect(legacy.version).toBe('0.1.0');expect(next).not.toBe(legacy);expect(next.rake).not.toBe(legacy.rake);
  next.rake.cap=900;expect(legacy.rake.cap).toBe(300);
 });
 it('rejects non-finite inputs rather than collapsing them to JSON null',()=>{
  const invalid=profile();invalid.bigBlind=NaN;expect(()=>ruleProfileConfigVersion(invalid)).toThrow('non-finite');
 });
});
