import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
/* Patch 68: career page and memory talk wiring. */
describe('wiring',()=>{
  const app=readFileSync('src/ui/app.ts','utf8');
  it('career page, home block, career table and memory lines',()=>{
    expect(app).toContain("{ view: 'career', label: 'Career'");expect(app).toContain('function careerView()');expect(app).toContain('id="career-start"');
    expect(app).toContain('id="career-play"');expect(app).toContain('function stakeSettings(level: number)');expect(app).toContain('<h3>Career · ${st.stake}</h3>');
    expect(app).toContain('function memoryGreeting()');expect(app).toContain('/:memory:(remember-call|remember-fold):/');
  });
});
