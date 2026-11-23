import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {MACHINES,machineById} from '../../src/slots/machines';
import {spin} from '../../src/slots/engine';
import {ART,SLOT_DEFS} from '../../src/slots/art';
import {slotsMarkup,freshSlotsUi} from '../../src/slots/view';
import {freshSlots} from '../../src/slots/state';

/* Patches 91–92: slot art and four new machines. */
const rng=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return Math.floor(s/4294967296*n);};};
describe('art',()=>{
  it('every symbol on every machine has vector art, using the shared gradients',()=>{
    expect(MACHINES.length).toBe(8);
    for(const m of MACHINES)for(const [k,d] of Object.entries(m.symbols)){if(d.tone==='blank')continue;expect(ART[d.art],`${m.id} ${k}`).toMatch(/^<svg class="slot-art"/);}
    const used=new Set(Object.values(ART).join('').match(/url\(#(s[gf]-[a-z]+)\)/g)!.map(x=>x.slice(5,-1)));for(const id of used)expect(SLOT_DEFS,id).toContain(`id="${id}"`);
    expect(Object.values(ART).join('')).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
describe('Triple Diamond',()=>{
  it('one wild triples a line and two pay nine times',()=>{
    const m=machineById('triple-diamond')!;const r=rng(1);let one=0,two=0;
    for(let i=0;i<60000;i++){const x=spin(m,90,r);for(const w of x.wins){const cells=w.cells.map(([a,b])=>x.grid[a][b]),n=cells.filter(c=>c==='DW').length;
      if(w.sym==='B1'&&n===1){one++;expect(w.amount).toBe(10*10*3);}if(w.sym==='B1'&&n===2){two++;expect(w.amount).toBe(10*10*9);}}}
    expect(one).toBeGreaterThan(0);
  });
});
describe('Dust Devil (ways)',()=>{
  it('a ways win counts every combination from the left; free-spin wilds carry ×2 or ×3',()=>{
    const m=machineById('dust-devil')!;const r=rng(2);let mults=0;
    for(let i=0;i<20000;i++){const x=spin(m,200,r);
      for(const w of x.wins){expect(w.line).toBe(-1);const reels=new Set(w.cells.map(c=>c[0]));expect(reels.size).toBe(w.count);expect([...reels].sort()).toEqual(Array.from({length:w.count},(_,k)=>k));}
      if(x.free)for(const f of x.free.spins){expect(f.wildMultipliers).toBeDefined();f.grid.forEach((col,a)=>col.forEach((s,b)=>{const v=f.wildMultipliers![a][b];if(s==='sheriff'){expect([2,3]).toContain(v);mults++;}else expect(v).toBe(1);}));}
      expect(x.wildMultipliers).toBeUndefined();}
    expect(mults).toBeGreaterThan(0);
  });
});
describe('Gem Cascade',()=>{
  it('pays clusters of eight or more, tumbles until nothing wins, and bombs multiply only winning cascades',()=>{
    const m=machineById('gem-cascade')!;const r=rng(3);let tumbles=0,bombed=0;
    for(let i=0;i<20000;i++){const x=spin(m,100,r),c=x.cascade!;expect(c.frames.at(-1)!.win).toBe(0);
      for(const f of c.frames.slice(0,-1)){expect(f.win).toBeGreaterThan(0);expect(f.hits.length).toBeGreaterThanOrEqual(8);}
      const raw=c.frames.reduce((a,f)=>a+f.win,0);expect(x.lineTotal).toBe(raw*c.multiplier);
      if(!raw)expect(c.multiplier).toBe(1);if(c.frames.length>2)tumbles++;if(c.multiplier>1)bombed++;
      for(const f of c.frames)expect(f.grid.length*f.grid[0].length).toBe(30);}
    expect(tumbles).toBeGreaterThan(100);expect(bombed).toBeGreaterThan(20);
  });
});
describe("Pirate's Plunder",()=>{
  it('three maps open a board of twelve chests; three picks pay what they hold',()=>{
    const m=machineById('pirates-plunder')!;const r=rng(4);let bonuses=0;
    for(let i=0;i<30000;i++){const x=spin(m,100,r);if(!x.pick)continue;bonuses++;
      expect(x.pick.prizes.length).toBe(3);expect(x.pick.others.length).toBe(9);expect(x.pick.amount).toBe(x.pick.prizes.reduce((a,b)=>a+b,0)*100);
      expect(x.grid.flat().filter(s=>s==='map').length).toBeGreaterThanOrEqual(3);}
    expect(bonuses).toBeGreaterThan(150);
  });
});
describe('screens',()=>{
  it('each new machine draws, with its own paytable; the pick board waits for taps',()=>{
    const s=freshSlots();for(const id of ['triple-diamond','dust-devil','gem-cascade','pirates-plunder']){const ui=freshSlotsUi();ui.machine=id;const h=slotsMarkup(s,ui);expect(h,id).toContain('class="slot-marquee"');expect(h).toContain('slot-paytable');}
    const m=machineById('pirates-plunder')!,r=rng(9);let x=spin(m,100,r);while(!x.pick)x=spin(m,100,r);
    const ui={...freshSlotsUi(),machine:m.id,result:x,phase:'pick' as const,picked:[3]};const h=slotsMarkup(s,ui);
    expect(h).toContain('data-testid="slot-pick"');expect((h.match(/data-slot-pick=/g)??[]).length).toBe(11);expect(h).toContain('Pick 2 more chests');
    const play=readFileSync('src/slots/play.ts','utf8');expect(play).toContain('autoPick()');expect(play).toContain("this.ui.phase='cascade'");
  });
});
