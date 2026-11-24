import {describe,it,expect} from 'vitest';
import {MACHINES,machineById} from '../../src/slots/machines';
import {spin,type Machine,type SpinResult} from '../../src/slots/engine';
import {ART} from '../../src/slots/art';
import {playSpin,freshSlots,type SlotsState} from '../../src/slots/state';
import {slotsMarkup,freshSlotsUi} from '../../src/slots/view';
import {slotsMachines} from '../../src/stats/career';
import {slotsResult} from '../../src/stats/by-game';

/* Phase 4: the five new machines — integrity, measured payback, feature behaviour, money conservation,
 * career-stats wiring and the tiered win presentation. Seeded RNG throughout, same generator as ux90–ux94. */
const rng=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return Math.floor(s/4294967296*n);};};
const NEW=['stampede-run','poseidons-bounty','crown-wheel','northern-lights','olympus-gold'];
const OLD=['lucky-sevens','wheel-of-riches','gold-rush','lucky-lightning','triple-diamond','dust-devil','gem-cascade','pirates-plunder'];
const news=NEW.map(id=>machineById(id)!);

describe('the expanded floor',()=>{
 it('has thirteen machines: the original eight first, unchanged, then the five new ones',()=>{
  expect(MACHINES.map(m=>m.id)).toEqual([...OLD,...NEW]);
  for(const m of news)expect(m.rtp).toBeGreaterThan(92);
 });
 it('the five new machines use five distinct headline mechanics',()=>{
  const kinds=new Set(news.map(m=>m.kind));
  expect(kinds).toEqual(new Set(['ways','video','cascade']));
  expect(machineById('stampede-run')!.ways).toBeDefined();
  expect(machineById('poseidons-bounty')!.scatterPay).toBeDefined();
  expect(machineById('crown-wheel')!.wheel).toBeDefined();
  expect(machineById('northern-lights')!.cascade).toBeDefined();
  expect(machineById('olympus-gold')!.expandWild).toBe('zeus');
 });
});

describe('paytable integrity',()=>{
 it('every new machine is well-formed: art for every symbol, sane pays, bets and lines',()=>{
  for(const m of news){
   for(const [k,d] of Object.entries(m.symbols)){if(d.tone==='blank')continue;expect(ART[d.art],`${m.id} ${k}`).toMatch(/^<svg class="slot-art"/);}
   for(const [sym,p] of Object.entries(m.pays)){expect(m.symbols[sym],`${m.id} pays ${sym}`).toBeDefined();expect(p.every(x=>x>=0)).toBe(true);expect(Math.max(...p)).toBeGreaterThan(0);}
   expect([...m.bets].sort((a,b)=>a-b)).toEqual(m.bets);expect(m.bets.every(b=>b>0)).toBe(true);
   for(const line of m.lines){expect(line.length).toBe(m.reels.length);for(const r of line)expect(r).toBeLessThan(m.rows);}
   if(m.scatter){expect(Object.keys(m.scatter.freeSpins)).toEqual(Object.keys(m.scatter.pays));}
   for(const strip of m.reels)expect(strip.length).toBeGreaterThanOrEqual(m.rows);
  }
 });
 it('feature symbols are not also line symbols',()=>{
  for(const m of news){
   if(m.scatterPay)expect(m.pays[m.scatterPay.sym]).toBeUndefined();
   if(m.wheel)expect(m.pays[m.wheel.sym]).toBeUndefined();
   if(m.scatter&&m.kind!=='cascade')expect(m.pays[m.scatter.sym]).toBeUndefined();
  }
 });
});

describe('measured payback (seeded simulation)',()=>{
 it('each new machine pays back inside 92–97% and close to its stated figure over 400k spins',()=>{
  for(const m of news){const r=rng(4242),bet=m.bets[1];let paid=0,won=0;const N=400000;
   for(let i=0;i<N;i++){paid+=bet;won+=spin(m,bet,r).total;}
   const rtp=100*won/paid;expect(rtp,m.id).toBeGreaterThan(92);expect(rtp,m.id).toBeLessThan(97);
   expect(Math.abs(rtp-m.rtp),m.id).toBeLessThan(2);}
 },600000);
});

describe('Stampede Run (ways)',()=>{
 it('free-spin eagles carry ×2 or ×3, base-spin wilds carry nothing, and ways always run from the left',()=>{
  const m=machineById('stampede-run')!,r=rng(11);let freeSeen=0;
  for(let i=0;i<30000;i++){const x=spin(m,80,r);expect(x.wildMultipliers).toBeUndefined();
   for(const w of x.wins){expect(w.line).toBe(-1);const reels=[...new Set(w.cells.map(c=>c[0]))].sort();expect(reels).toEqual(Array.from({length:w.count},(_,k)=>k));}
   if(x.free){freeSeen++;for(const f of x.free.spins){expect(f.wildMultipliers).toBeDefined();
    f.grid.forEach((col,a)=>col.forEach((s,b)=>{const v=f.wildMultipliers![a][b];if(s==='eagle')expect([2,3]).toContain(v);else expect(v).toBe(1);}));}}}
  expect(freeSeen).toBeGreaterThan(400);
 });
});

describe("Poseidon's Bounty (scatter-pay)",()=>{
 it('pearls pay anywhere by the largest threshold met, never on a line; shells start ×2 free spins',()=>{
  const m=machineById('poseidons-bounty')!,r=rng(12);let pearlPays=0,freeSeen=0;
  const thresholds=Object.entries(m.scatterPay!.pays).map(([k,v])=>[Number(k),v] as const).sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<60000;i++){const x=spin(m,40,r),pearls=x.grid.flat().filter(s=>s==='pearl').length;
   for(const w of x.wins)expect(w.sym).not.toBe('pearl');
   const met=[...thresholds].reverse().find(([k])=>pearls>=k);
   if(met&&!x.free){pearlPays++;expect(x.scatterWin).toBeGreaterThanOrEqual(Math.round(met[1]*40));}
   if(x.free){freeSeen++;expect(x.free.spins.length).toBeGreaterThanOrEqual(8);}}
  expect(pearlPays).toBeGreaterThan(200);expect(freeSeen).toBeGreaterThan(400);
 });
});

describe('Crown Wheel (wheel on a video machine)',()=>{
 it('a crown in the middle of the last reel spins the wheel and pays its segment times the bet',()=>{
  const m=machineById('crown-wheel')!,r=rng(13);let wheels=0;
  for(let i=0;i<60000;i++){const x=spin(m,50,r);
   for(const w of x.wins)expect(w.sym).not.toBe('crown');
   if(x.grid[4][1]==='crown'){wheels++;expect(x.wheel).toBeDefined();expect(x.wheel!.amount).toBe(Math.round(m.wheel!.segments[x.wheel!.segment].x*50));expect(x.wheel!.x).toBe(m.wheel!.segments[x.wheel!.segment].x);}
   else expect(x.wheel).toBeUndefined();}
  expect(wheels).toBeGreaterThan(800);
 });
});

describe('Northern Lights (cascade)',()=>{
 it('clusters of six or more pay on a 5×4 sky, tumbles end on a non-winning frame, bombs multiply only wins',()=>{
  const m=machineById('northern-lights')!,r=rng(14);let tumbles=0,bombed=0;
  for(let i=0;i<20000;i++){const x=spin(m,100,r),c=x.cascade!;expect(c.frames.at(-1)!.win).toBe(0);
   for(const f of c.frames){expect(f.grid.length).toBe(5);expect(f.grid[0].length).toBe(4);}
   for(const f of c.frames.slice(0,-1)){expect(f.win).toBeGreaterThan(0);expect(f.hits.length).toBeGreaterThanOrEqual(6);}
   const raw=c.frames.reduce((a,f)=>a+f.win,0);expect(x.lineTotal).toBe(raw*c.multiplier);
   if(!raw)expect(c.multiplier).toBe(1);if(c.frames.length>2)tumbles++;if(c.multiplier>1)bombed++;}
  expect(tumbles).toBeGreaterThan(100);expect(bombed).toBeGreaterThan(20);
 });
});

describe('Olympus Gold (expanding wilds)',()=>{
 it('a landed Zeus fills its whole reel, only ever on reels two and four',()=>{
  const m=machineById('olympus-gold')!,r=rng(15);let expanded=0;
  for(let i=0;i<30000;i++){const x=spin(m,40,r);
   x.grid.forEach((col,reel)=>{if(col.includes('zeus')){expanded++;expect(col.every(s=>s==='zeus')).toBe(true);expect([1,3]).toContain(reel);}});}
  expect(expanded).toBeGreaterThan(1000);
 });
});

describe('money conservation and the record',()=>{
 it('across 2,000 played spins per machine, credits balance exactly and the per-machine record is exact',()=>{
  for(const m of news){let s:SlotsState={...freshSlots(),balance:100000000};const r=rng(21),bet=m.bets[1];
   let wagered=0,won=0,biggest=0,features=0;
   for(let i=0;i<2000;i++){const p=playSpin(s,m,bet,r);s=p.state;wagered+=bet;won+=p.result.total;biggest=Math.max(biggest,p.result.total);if(p.result.free||p.result.hold||p.result.wheel)features++;}
   expect(s.balance).toBe(100000000-wagered+won);
   expect(s.machines[m.id]).toEqual({spins:2000,wagered,won,biggest,features});}
 });
 it('the new machines appear in the career stats per-machine lines and totals automatically',()=>{
  let s:SlotsState={...freshSlots(),balance:100000000};const r=rng(22);
  for(const m of news)for(let i=0;i<50;i++)s=playSpin(s,m,m.bets[0],r).state;
  const lines=slotsMachines(s);for(const id of NEW){const line=lines.find(l=>l.id===id)!;expect(line, id).toBeDefined();expect(line.spins).toBe(50);expect(line.wagered).toBe(50*machineById(id)!.bets[0]);expect(line.net).toBe(line.won-line.wagered);}
  expect(slotsResult(s).samples).toBe(250);
 });
});

describe('presentation',()=>{
 const fake=(m:Machine,total:number):SpinResult=>({grid:m.reels.map(st=>st.slice(0,m.rows)),wins:[],scatterWin:0,lineTotal:total,total,bet:m.bets[1]});
 it('every new machine draws with a live region, a keyboard-operable spin button and its paytable notes',()=>{
  const s=freshSlots();
  for(const m of news){const ui=freshSlotsUi();ui.machine=m.id;const h=slotsMarkup(s,ui);
   expect(h,m.id).toContain('data-testid="slot-machine"');expect(h).toContain('role="status"');expect(h).toContain('aria-live="polite"');
   expect(h).toContain('id="slots-spin"');expect(h).toContain('slot-paytable');expect(h).toContain(`/casino-art/${m.id}-cinematic.webp`);}
  const p=freshSlotsUi();p.machine='poseidons-bounty';expect(slotsMarkup(s,p)).toContain('pay anywhere');
  const o=freshSlotsUi();o.machine='olympus-gold';expect(slotsMarkup(s,o)).toContain('expands to fill');
 });
 it('the win celebration scales by tier: BIG, then MEGA, then EPIC',()=>{
  const s=freshSlots(),m=machineById('gold-rush')!,bet=m.bets[1];
  const at=(total:number)=>{const ui=freshSlotsUi();ui.machine=m.id;ui.phase='done';ui.result=fake(m,total);return slotsMarkup(s,ui);};
  const big=at(20*bet);expect(big).toContain('big-win');expect(big).not.toContain('mega-win');expect(big).not.toContain('epic-win');
  const mega=at(50*bet);expect(mega).toContain('mega-win');expect((mega.match(/slot-burst coin/g)??[]).length).toBe(1);expect(mega).toContain('MEGA WIN');
  const epic=at(120*bet);expect(epic).toContain('epic-win');expect(epic).toContain('EPIC WIN');
  const small=at(2*bet);expect(small).not.toContain('big-win');
 });
 it('the floor lists all thirteen machines',()=>{
  const h=slotsMarkup(freshSlots(),freshSlotsUi());
  for(const m of MACHINES)expect(h).toContain(`data-slot-machine="${m.id}"`);
 });
});
