import {describe,it,expect} from 'vitest';
import {timingRecorder} from '../browser/step5f-bounded-evidence';
import {parameters,namespaceFor,encodeReceipt,decodeReceipt} from '../browser/step5f-support';
const base='?run=123-456&hands=1000&reader=candidate&scenario=closed&storage=normal';
describe('bounded recovery diagnostic scopes',()=>{
 it('retains aggregate maxima after a raw timing ring wraps',()=>{
  const log=timingRecorder(2);for(let n=0;n<5;n++)log.record({phase:'audit',name:'record',start:n,end:n+1,milliseconds:n===0?50:n});
  expect(log.samples).toHaveLength(2);expect(log.samples.some(row=>row.milliseconds===50)).toBe(false);
  expect(log.totals['audit:record']).toEqual({count:5,totalMs:60,maxMs:50});expect(log.summary()).toMatchObject({total:5,retained:2,dropped:3});
 });
 it('defaults to the combined workflow and validates explicit isolated scopes',()=>{
  expect(parameters(base)).toMatchObject({workload:'history-audit',pause:false});
  for(const workload of ['history-audit','compact-audit','history-only','recovery-only'])expect(parameters(base+'&workload='+workload+'&pause=1')).toMatchObject({workload,pause:true});
  expect(()=>parameters(base+'&workload=skip-verification')).toThrow(/workload/);expect(()=>parameters(base+'&pause=yes')).toThrow(/pause/);
 });
 it('does not reuse a preparation receipt under a different workflow',()=>{
  const args=parameters(base+'&workload=compact-audit'),receipt={version:1 as const,parameters:args,namespace:namespaceFor(args),expected:{wallet:100,hands:1000,activeDigest:null},evidence:{}};
  expect(decodeReceipt(encodeReceipt(receipt),args)).toEqual(receipt);
  expect(()=>decodeReceipt(encodeReceipt(receipt),parameters(base+'&workload=history-audit'))).toThrow(/parameters differ/);
 });
});
