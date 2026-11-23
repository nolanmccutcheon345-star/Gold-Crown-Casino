import {describe,it,expect} from 'vitest';
import {tablePortraitsForSeats} from '../../src/ui/portraits';
import {readFileSync,existsSync} from 'node:fs';
import {PORTRAIT_COUNT,DEFAULT_HERO_PORTRAIT,portraitFor,tablePortraits,portraitMarkup,validPortrait} from '../../src/ui/portraits';
import {DEFAULT_STYLE,normalizeStyle} from '../../src/ui/table-style';
import {REGULARS} from '../../src/bots/regulars';
import {STRANGER_NAMES} from '../../src/session/churn';

/* Patch 63: illustrated portrait avatars. */
const root='';
const WOMEN=new Set([1,5,7,11,13,17,19,23,25,29,31,35,37,42,44,47,50,53,55,57,59,63,65,68,71,75,76,80,82,85,87,89,92,95,97,101,105]);

describe('portrait files',()=>{
  it('every portrait exists at both sizes and is small',()=>{
    for(let i=0;i<PORTRAIT_COUNT;i++){const f=`p${String(i).padStart(2,'0')}.webp`;
      for(const path of [`public/avatars/${f}`,`public/avatars/s/${f}`]){expect(existsSync(root+path),path).toBe(true);const b=readFileSync(root+path);expect(b.subarray(8,12).toString()).toBe('WEBP');expect(b.length).toBeLessThan(40000);}}
  });
});

describe('who gets which portrait',()=>{
  it('every regular has a portrait of their own, stable across calls',()=>{
    for(const r of REGULARS){const p=portraitFor(r.name);expect(p).toBeGreaterThanOrEqual(0);expect(p).toBeLessThan(PORTRAIT_COUNT);expect(portraitFor(r.name)).toBe(p);}
    expect(portraitFor('Big Earl')).toBe(14);expect(portraitFor('Mei')).toBe(82);
  });
  it('clearly female and male names get matching portraits',()=>{
    for(const n of ['Lisa','Wendy','Joan','Peggy','Maxine','Tina'])expect(WOMEN.has(portraitFor(n)),n).toBe(true);
    for(const n of ['Ray','Carlos','Hector','Otis','Gary'])expect(WOMEN.has(portraitFor(n)),n).toBe(false);
  });
  it('no two players at a table share a portrait, and Hero keeps theirs',()=>{
    const names=['Dot','Ana','Lisa','Wendy','Joan','Alex','Morgan','Big Earl','Sal'];
    const m=tablePortraits(names,DEFAULT_HERO_PORTRAIT);expect(new Set(m.values()).size).toBe(names.length);expect([...m.values()]).not.toContain(DEFAULT_HERO_PORTRAIT);
    expect(m.get('Big Earl')).toBe(14);expect(WOMEN.has(m.get('Dot')!)).toBe(true);expect(WOMEN.has(m.get('Ana')!)).toBe(true);
    const nine=STRANGER_NAMES.slice(0,9),m2=tablePortraits(nine,0);expect(new Set(m2.values()).size).toBe(9);
  });
  it('markup uses the small file at seats and offers both sizes',()=>{
    const h=portraitMarkup(3,'happy');expect(h).toContain('src="/avatars/s/p03.webp"');expect(h).toContain('/avatars/p03.webp 256w');expect(h).toContain('data-mood="happy"');expect(h).toContain('alt=""');
    expect(portraitMarkup(3,'neutral','large')).toContain('src="/avatars/p03.webp"');
  });
});

describe('settings',()=>{
  it('portraits are on by default and Hero\'s choice is validated',()=>{
    expect(DEFAULT_STYLE.portraits).toBe(true);expect(DEFAULT_STYLE.heroPortrait).toBeNull();
    expect(normalizeStyle({heroPortrait:12}).heroPortrait).toBe(12);
    for(const bad of [-1,106,1.5,'3',null])expect(normalizeStyle({heroPortrait:bad}).heroPortrait).toBeNull();
    expect(normalizeStyle({portraits:false}).portraits).toBe(false);expect(validPortrait(45)).toBe(45);
  });
  it('the app renders portraits through one helper and keeps the drawn faces',()=>{
    const app=readFileSync(root+'src/ui/app.ts','utf8');expect(app).toContain('function faceArt(');expect(app).toContain('id="style-portraits"');expect(app).toContain('data-portrait=');
    expect(app.match(/avatarSvg\(/g)!.length).toBe(2);// drawn fallback and the drawn-face preview
    const css=readFileSync(root+'src/ui/polish.css','utf8');expect(css).toContain('.face-badge:has(.portrait)');expect(css).toContain('prefers-reduced-motion:reduce){.portrait');
  });
});

// Duplicate display names are allowed at separate seats.
it('keeps seat portraits distinct even when names match',()=>{
 const ids=tablePortraitsForSeats([{id:1,name:'Alex'},{id:2,name:'Alex'},{id:3,name:'Riley'}],6);
 expect(new Set(ids.values()).size).toBe(3);
 expect(ids.get(1)).not.toBe(ids.get(2));
});
