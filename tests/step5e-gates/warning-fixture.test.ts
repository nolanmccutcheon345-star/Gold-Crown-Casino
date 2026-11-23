import {expect,it} from 'vitest';
import {warningFixture} from './warning-fixture';
import {deriveCashStats} from '../../src/stats/cash';
import {validateData} from '../../src/storage/integrity';
it.each(['small','variance'] as const)('G09/M06 genuine legal-engine %s positive fixture remains financially valid',async kind=>{const data=await warningFixture(kind);await validateData(data);expect(data.hands).toHaveLength(8);const nets=data.hands.map(h=>h.net);expect(nets).toEqual(kind==='small'?Array(8).fill(400):[15000,-14000,15000,-14000,15000,-14000,15000,-14000]);expect(data.wallet).toBe(1000000+nets.reduce((a,b)=>a+b,0));const stats=deriveCashStats(data.hands,data.sessions);expect(stats.hands).toBe(8);expect(stats.profit).toBe(kind==='small'?3200:4000);expect(stats.disclosure).toContain('Fewer than 100 opportunities are labeled insufficient sample');expect(stats.disclosure).toContain('no invented EV or profitability confidence claim');});
