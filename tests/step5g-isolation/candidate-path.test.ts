import {describe,it,expect} from 'vitest';
import {compiledCandidatePath} from '../browser/compiled-candidate-path';
describe('Source-specific compiled QA selection',()=>{
 it('keeps frozen Version12 default and supports a separately verified later package',()=>{expect(compiledCandidatePath(null)).toBe('./step5f-candidate-checkpoint/manifest.json');expect(compiledCandidatePath('step5f-candidate-step5g-hardening')).toBe('./step5f-candidate-step5g-hardening/manifest.json');});
 it.each(['../production','https://example.invalid','step5f-candidate/../../dist','step5f-candidate?token=x','step5f-candidate#fragment','step5f-candidate%2fsecret','step5f-candidate\\secret','step5f-candidate-'+ 'a'.repeat(100)])('rejects unsafe selection %s',name=>{expect(()=>compiledCandidatePath(name)).toThrow('Invalid local compiled candidate package');});
});
