import {describe,expect,it} from 'vitest';
import {referenceProblems,contrastRatio,contrastThreshold} from './audit-rules';
describe('Independent accessibility audit evidence rules',()=>{
 it('accepts references only when the exact ID exists',()=>expect(referenceProblems([{element:'input',ids:['bet'],labelledBy:['label'],describedBy:['limit']},{element:'label',ids:['label'],labelledBy:[],describedBy:[]},{element:'text',ids:['limit'],labelledBy:[],describedBy:[]}])).toEqual([]));
 it('reports every missing description, not only the first token',()=>expect(referenceProblems([{element:'bet',ids:['bet'],labelledBy:['label'],describedBy:['minimum','additional']}])).toEqual(['bet: aria-labelledby target missing: label','bet: aria-describedby target missing: minimum','bet: aria-describedby target missing: additional']));
 it('does not accept a same-prefix or case-changed ID',()=>expect(referenceProblems([{element:'bet',ids:['Minimum-x'],labelledBy:[],describedBy:['minimum']}])).toEqual(['bet: aria-describedby target missing: minimum']));
 it('reports ambiguous duplicate IDs even if the reference resolves',()=>expect(referenceProblems([{element:'one',ids:['x'],labelledBy:[],describedBy:[]},{element:'two',ids:['x'],labelledBy:[],describedBy:['x']}])).toEqual(['Duplicate ID: x']));
 it('handles empty graphs without manufacturing failures',()=>expect(referenceProblems([])).toEqual([]));
 it('computes the independent black/white 21:1 extreme',()=>expect(contrastRatio([0,0,0],[255,255,255])).toBe(21));
 it('gives same colors 1:1 and symmetric results',()=>{expect(contrastRatio([19,41,61],[19,41,61])).toBe(1);expect(contrastRatio([70,150,40],[16,27,32])).toBe(contrastRatio([16,27,32],[70,150,40]));});
 it('keeps a near-threshold gray failure below4.5 without rounding',()=>{expect(contrastRatio([119,119,119],[255,255,255])).toBeGreaterThan(4.47);expect(contrastRatio([119,119,119],[255,255,255])).toBeLessThan(4.5);});
 it('uses4.5 for ordinary control text and3 for genuinely large text',()=>{expect(contrastThreshold(14,400)).toBe(4.5);expect(contrastThreshold(23.99,400)).toBe(4.5);expect(contrastThreshold(24,400)).toBe(3);expect(contrastThreshold(56/3,700)).toBe(3);expect(contrastThreshold(18,700)).toBe(4.5);});
});
