import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {reviewCandidateIdentity,type CandidateBinding} from '../step5h-external/candidate-evidence';
import type {CandidateRecord} from '../step5f-external/contracts';
const read=(path:string)=>readFileSync(path,'utf8');
const expected:CandidateBinding={sourceCommit:'1'.repeat(40),bundleSHA256:'2'.repeat(64),buildId:'test-only-build',origin:'https://candidate.invalid',verifiedPackage:true};
const sample:CandidateRecord={sourceCommit:expected.sourceCommit,bundleSHA256:expected.bundleSHA256,buildId:expected.buildId,url:expected.origin+'/?run=test-only',isolatedOrigin:true,isolatedSave:true};
describe('Step5H external result provenance without invented execution',()=>{
 it('rejects old candidate source and asset results instead of silently transferring Version12 testing',()=>{
  expect(reviewCandidateIdentity({...sample,sourceCommit:'7ac2175ba3478102c521a149ce339f0fbc4d586b'},expected).status).toBe('REJECTED');
  expect(reviewCandidateIdentity({...sample,bundleSHA256:'3'.repeat(64)},expected).status).toBe('REJECTED');
 });
 it('rejects preserved Site origins and mismatched, unverified or invalid candidate bindings',()=>{
  for(const origin of ['https://ai-texas-hold-em.stevemccutcheon89.chatgpt.site','https://ai-texas-hold-em-v12-test.stevemccutcheon89.chatgpt.site'])expect(reviewCandidateIdentity({...sample,url:origin},{...expected,origin}).status).toBe('REJECTED');
  expect(reviewCandidateIdentity({...sample,url:'https://other.invalid'},expected).status).toBe('REJECTED');
  expect(reviewCandidateIdentity(sample,{...expected,verifiedPackage:false}).status).toBe('REJECTED');
  expect(reviewCandidateIdentity(sample,{...expected,origin:'invalid'}).status).toBe('REJECTED');
 });
 it('a matching identity is only ready for observation review, never proof of actual people, speech or devices',()=>{
  expect(reviewCandidateIdentity(sample,expected)).toEqual({status:'IDENTITY_MATCH_REQUIRES_OBSERVATION_REVIEW',errors:[],physicalDeviceVerified:false,screenReaderVerified:false,newUserStudyVerified:false});
 });
 it('preserves the exact original eight open criteria and blank external outcomes',()=>{
  const originals=JSON.parse(read('docs/specs/acceptance-source.json')) as {id:string}[],gates=JSON.parse(read('tests/step5h-gates/original-gates.json')) as {id:string}[];
  expect(gates.map(x=>x.id).sort()).toEqual(['U10','U11','U16','Z02','Z14','V518','V522','V707'].sort());for(const gate of gates)expect(gate).toEqual(originals.find(x=>x.id===gate.id));
  const device=JSON.parse(read('tests/step5h-external/device-reader-results-template.json'));expect(device.status).toBe('NOT_EXECUTED');expect(device.export.status).toBe('AWAITING_USER_VERIFICATION');expect(device.candidate.sourceCommit).toBe('');expect(device.performance.samples).toBe(0);expect(device.performance.heap).toBeNull();
  const lines=read('tests/step5h-external/hand-observation-form.csv').trim().split(/\r?\n/);expect(lines).toHaveLength(76);for(const label of ['P1','P2','P3'])expect(lines.slice(1).filter(x=>x.startsWith(label+','))).toHaveLength(25);for(const line of lines.slice(1))expect(line).toContain(',NOT_EXECUTED,NOT_EXECUTED,');
 });
});
