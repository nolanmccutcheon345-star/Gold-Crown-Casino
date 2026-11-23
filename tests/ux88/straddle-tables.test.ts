import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {straddleTable,tableChoices,seatPreview} from '../../src/ui/table-picker';
import {regularFor} from '../../src/bots/regulars';
import {REGULAR_STRADDLE} from '../../src/bots/straddle';
import {rules,DEFAULT_SETTINGS} from '../../src/session/controller';
import {normalizeTableSettings,syntheticLiveOneTwoPreset} from '../../src/session/configuration';


/* Patch 88: live straddle tables. */
let seed=7;const random=(n:number)=>{seed=(seed*1103515245+12345)>>>0;return seed%n;};
describe('the straddle game',()=>{
  const base=syntheticLiveOneTwoPreset(DEFAULT_SETTINGS as never) as never;
  it('allows straddles under the existing V410 rule and seats the regulars who like to straddle',()=>{
    for(let k=0;k<20;k++){
      const t=straddleTable(base,random);expect(t.straddle).toBe(true);expect(t.settings.liveStraddle).toBe(true);
      expect(rules(t.settings).straddle).toEqual({kind:'utg-live',multiple:2});
      const regs=(t.settings.opponents??[]).map(o=>regularFor(o)).filter(Boolean);
      expect(regs.length).toBeGreaterThanOrEqual(2);for(const r of regs)expect(REGULAR_STRADDLE[r!.id]??0).toBeGreaterThanOrEqual(.3);
      expect(()=>normalizeTableSettings(t.settings)).not.toThrow();
      expect(seatPreview(t.settings).length).toBe(t.settings.seats-1);
    }
  });
  it('keeps regulars already seated at the other tables away, and the three ordinary tables unchanged',()=>{
    const t=straddleTable(base,random,['tex','vince']);for(const o of t.settings.opponents??[])expect(['tex','vince']).not.toContain(regularFor(o)?.id);
    expect(tableChoices(base,random).length).toBe(3);expect(tableChoices(base,random).every(x=>!x.straddle&&!x.settings.liveStraddle)).toBe(true);
  });
});
describe('on screen',()=>{
  it('the floor lists the straddle game; Hero is asked before going under the gun; straddlers say something',()=>{
    const app=readFileSync('src/ui/app.ts','utf8');
    expect(app).toContain('straddleTable(base, undefined, sitting)');expect(app).toContain('data-testid="straddle-note"');
    expect(app).toContain('nextHandStraddleSeat(a.game) !== 0');expect(app).toContain('data-straddle-choice');expect(app).toContain('straddleLine() ??');
  });
});
