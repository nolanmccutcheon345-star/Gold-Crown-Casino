import {describe,expect,it} from 'vitest';
import {playSound,ambience,ambienceOn} from '../../src/ui/sounds';
import {normalizeStyle,DEFAULT_STYLE} from '../../src/ui/table-style';

describe('Patch 83 ambience, stings and clicks',()=>{
 it('keeps ambience and button clicks off by default and remembers them',()=>{
  expect(DEFAULT_STYLE.ambience).toBe(false);expect(DEFAULT_STYLE.clicks).toBe(false);
  expect(normalizeStyle({ambience:true,clicks:true})).toMatchObject({ambience:true,clicks:true});expect(normalizeStyle({ambience:'yes'}).ambience).toBe(false);
 });
 it('never plays or throws without a running audio context',()=>{
  expect(()=>{for(const k of ['levelup','money','champion','knockout','promo','matchwin','matchlose','tap'] as const)playSound(k);ambience(true);ambience(false);}).not.toThrow();
  expect(ambienceOn()).toBe(false);
 });
});
