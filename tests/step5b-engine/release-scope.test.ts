import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {assertSupportedCashScope,UNAVAILABLE_FEATURES} from '../../src/session/release-scope';
import {unavailableFeaturesMarkup} from '../../src/ui/release-scope';
import {practiceProfile} from '../verification/helpers';

describe('X15/V521/V615 explicit disabled release scope',()=>{
 it('contains frozen disabled entries for every named release-scope feature',()=>{
  expect(UNAVAILABLE_FEATURES.map(f=>f.id)).toEqual(['run-it-twice','bomb-pots','extra-games','tournaments','multiplayer','table-chat','dealer-errors','real-time-assistance']);
  expect(Object.isFrozen(UNAVAILABLE_FEATURES)).toBe(true);expect(UNAVAILABLE_FEATURES.every(f=>Object.isFrozen(f)&&f.available===false&&f.reason.length>20)).toBe(true);
 });
 it('renders native disabled controls with explicit reasons and staged tournament wording',()=>{
  const html=unavailableFeaturesMarkup();for(const feature of UNAVAILABLE_FEATURES){
   const button=html.match(new RegExp(`<button[^>]*data-unavailable-feature="${feature.id}"[^>]*>[^<]*</button>`))?.[0];
   expect(button).toBeTruthy();expect(button).toContain(' disabled ');expect(button).toContain('aria-disabled="true"');expect(button).toContain(`aria-describedby="unsupported-${feature.id}"`);
   expect(html).toContain(feature.reason);
  }
  expect(html).toContain('Later releases R2 / R3');expect(html).not.toMatch(/onclick|data-action|href=/);
 });
 it.each(['runItTwice','run-it-twice','run_it_twice','enableRunItTwice','runItTwiceEnabled','bombPot','bombPots','doubleBoard','multiplayer','tableChat','dealerErrors','rta','tournament','straddle','ante'])('rejects attempted %s enablement without mutating settings',key=>{
  const profile={...practiceProfile(),[key]:true},before=JSON.stringify(profile);expect(()=>assertSupportedCashScope(profile)).toThrow(/unsupported|unavailable|cash/i);expect(JSON.stringify(profile)).toBe(before);
 });
 it.each([{mode:'tournament'},{variant:'omaha'},{gameType:'PLO'},{boardCount:2},{runoutCount:2},{features:{runItTwice:true}},{featureFlags:{bombPots:true}},{experimental:{unknownVariant:true}}])('rejects mode and nested flag route %#',flags=>{
  expect(()=>assertSupportedCashScope({...practiceProfile(),...flags})).toThrow();
 });
 it('accepts unchanged cash settings and explicitly off legacy flags, without creating an enabled option',()=>{
  const profile={...practiceProfile(),runItTwice:false,bombPots:'off',featureFlags:{omaha:false},boardCount:1};expect(()=>assertSupportedCashScope(profile)).not.toThrow();expect(UNAVAILABLE_FEATURES.every(f=>!f.available)).toBe(true);
 });
 it('does not consult URL/local-storage toggles, and rejects those fields if submitted as configuration',()=>{
  const storage={getItem(){throw new Error('Local feature storage must not be read');}},location={get search(){throw new Error('URL feature switch must not be read');}};
  vi.stubGlobal('localStorage',storage);vi.stubGlobal('location',location);
  try{expect(unavailableFeaturesMarkup()).toContain('disabled');expect(()=>assertSupportedCashScope(practiceProfile())).not.toThrow();}
  finally{vi.unstubAllGlobals();}
  const query=Object.fromEntries(new URLSearchParams('runItTwice=true&bombPots=true&gameType=omaha'));expect(()=>assertSupportedCashScope({...practiceProfile(),...query})).toThrow();
 });
 it('keeps referenced deferred IDs intact within the original 86-record register',()=>{
  const rows=JSON.parse(readFileSync(new URL('../../docs/specs/backlog-source.json',import.meta.url),'utf8')) as {id:string;status:string}[];
  expect(rows).toHaveLength(86);for(const item of UNAVAILABLE_FEATURES)for(const id of item.backlog.split('/').filter(Boolean))expect(rows.find(row=>row.id===id)?.status).toBe('DEFERRED_NOT_IMPLEMENTED');
 });
});
