import {describe,expect,it} from 'vitest';
import {handOriginDescription} from '../../src/ui/hand-origin';
import {makeCashHandProvenance} from '../../src/session/hand-provenance';
import {practiceProfile} from '../verification/helpers';

describe('Read-only history and replay origin labels',()=>{
 it('shows recorded ordinary cash source without exposing cards or private metadata',()=>{
  const profile=practiceProfile(),hand={view:{profile},provenance:makeCashHandProvenance(profile)};
  const before=JSON.stringify(hand);
  expect(handOriginDescription(hand,'cash')).toBe('Mode: Cash practice · Source: CSPRNG (recorded)');
  expect(JSON.stringify(hand)).toBe(before);
 });
 it('labels legacy source unknown without adding a provenance tag',()=>{
  const hand={view:{profile:practiceProfile()}};
  expect(handOriginDescription(hand,'cash')).toBe('Mode: Cash practice · Source: Unknown (legacy record)');
  expect(Object.keys(hand)).toEqual(['view']);
 });
 it('marks a replay import study-only even when its preserved source claims cash',()=>{
  const profile=practiceProfile(),hand={view:{profile},provenance:makeCashHandProvenance(profile)};
  const before=JSON.stringify(hand);
  expect(handOriginDescription(hand,'imported')).toBe('Mode: Study only · Source: Replay import · No bankroll or cash-stat credit');
  expect(JSON.stringify(hand)).toBe(before);
 });
 it('does not present a mismatched rules fingerprint as verified recorded cash',()=>{
  const profile=practiceProfile(),tag=makeCashHandProvenance(profile);
  expect(()=>handOriginDescription({view:{profile:{...profile,bigBlind:profile.bigBlind+1}},provenance:tag},'cash')).toThrow('fingerprint differs');
 });
 it('labels lab data explicitly when reviewing that namespace without offering normal-play fixture controls',()=>{
  const profile=practiceProfile(),tag={...makeCashHandProvenance(profile),mode:'lab' as const,source:'fixed-deck' as const};
  expect(handOriginDescription({view:{profile},provenance:tag},'lab')).toBe('Mode: Lab · Source: Fixed deck (recorded)');
 });
});
