import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const commit='a0bfc0950771a6dc1b786e00c13be7f3485b8dcb';
const manifest=JSON.parse(readFileSync(new URL('./published-v7-manifest.json',import.meta.url),'utf8')) as {sourceCommit:string;gitTree:string;bundleSHA256:string;sourceFiles:Record<string,string>};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
describe('Actual published Version 7 verification artifact provenance',()=>{
 it('matches every compiled source file to the immutable published commit, without candidate source substitutions',()=>{
  expect(manifest.sourceCommit).toBe(commit);expect(manifest.gitTree).toBe(execFileSync('git',['rev-parse',`${commit}^{tree}`],{encoding:'utf8'}).trim());
  expect(Object.keys(manifest.sourceFiles)).toHaveLength(33);
  for(const [path,digest]of Object.entries(manifest.sourceFiles))expect(hash(execFileSync('git',['show',`${commit}:${path}`]))).toBe(digest);
 });
 it('matches the executable bundle to its exact SHA-256 manifest',()=>{
  const bytes=readFileSync(new URL('../browser/step5b-published-v7.js',import.meta.url));expect(hash(bytes)).toBe(manifest.bundleSHA256);expect(bytes.toString()).toContain(`Frozen actual published Version 7 source ${commit}`);
 });
 it('executes the original published policy compatibility registry and rejects later unknown policies',async()=>{
  const url='../browser/step5b-published-v7.js';
  const published=await import(url) as {POLICY_VERSION:string;supportedPolicy:(version:string)=>boolean};
  expect(published.POLICY_VERSION).toBe('synthetic-cash-1.2.0');expect(published.supportedPolicy(published.POLICY_VERSION)).toBe(true);
  expect(published.supportedPolicy('synthetic-phase0-0.1.0')).toBe(true);expect(published.supportedPolicy('synthetic-cash-1.5.0')).toBe(false);expect(published.supportedPolicy('synthetic-cash-1.6.0')).toBe(false);
 });
});
