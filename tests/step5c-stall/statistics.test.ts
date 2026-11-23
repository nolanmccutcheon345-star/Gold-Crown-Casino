import {describe,it,expect} from 'vitest';
import {summarize,overlap} from './statistics';
describe('rare stall evidence calculations',()=>{
 it('uses nearest-rank percentiles, preserves rare maximum and input order',()=>{const samples=[9791,...Array.from({length:999},(_,n)=>n%30)];const before=[...samples],result=summarize(samples);expect(result.samples).toBe(1000);expect(result.p99).toBe(29);expect(result.max).toBe(9791);expect(samples).toEqual(before);});
 it('does not invent observations for an empty run',()=>expect(summarize([])).toEqual({samples:0,p50:null,p95:null,p99:null,max:null}));
 it('only attributes GC inside the actual measured preparation window',()=>{expect(overlap({start:100,end:200},{start:50,end:120})).toBe(20);expect(overlap({start:100,end:200},{start:200,end:220})).toBe(0);expect(overlap({start:100,end:200},{start:130,end:160})).toBe(30);});
});
