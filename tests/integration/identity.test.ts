import {describe,it,expect,vi} from 'vitest';
import {newHandId} from '../../src/identity';
describe('browser-compatible secure hand identity',()=>{
 it('works when randomUUID is not exposed but secure entropy is available',()=>{
  const secure=crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto',{getRandomValues:secure});
  try {const a=newHandId(),b=newHandId();expect(a).toMatch(/^hand-[0-9a-f]{32}$/);expect(a).not.toBe(b);}finally{vi.unstubAllGlobals();}
 });
 it('fails closed if secure entropy is absent',()=>{
  vi.stubGlobal('crypto',undefined);try{expect(newHandId).toThrow('Secure randomness unavailable');}finally{vi.unstubAllGlobals();}
 });
});
