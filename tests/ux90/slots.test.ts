import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {MACHINES} from '../../src/slots/machines';
import {spin,type Machine} from '../../src/slots/engine';
import {playSpin,reloadSlots,freshSlots,checkSlots,readSlots,SLOTS_START} from '../../src/slots/state';
import {slotsMarkup,freshSlotsUi} from '../../src/slots/view';

/* Patch 90: slots. */
const rng=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return Math.floor(s/4294967296*n);};};
/** The classic machine's exact payback: every combination of reel stops. */
function exactClassic(m:Machine):number {
  let paid=0,won=0;const [a,b,c]=m.reels;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)for(let k=0;k<c.length;k++){const seq=[i,j,k];let n=0;const r=spin(m,m.bets[1],()=>seq[n++]);paid+=m.bets[1];won+=r.total;}
  return 100*won/paid;
}
describe('payback',()=>{
  it('the classic machines pay back exactly what they say, to a tenth of a percent',()=>{for(const m of MACHINES.filter(x=>x.kind==='classic')){expect(Math.abs(exactClassic(m)-m.rtp),m.id).toBeLessThan(.1);}expect(MACHINES.filter(x=>x.kind==='classic').length).toBe(2);});
  it('every machine pays back between 92% and 97% over a million spins, close to what it says',()=>{
    for(const m of MACHINES){const r=rng(9001),bet=m.bets[1];let paid=0,won=0;const N=m.kind==='hold'?1500000:1000000;
      for(let i=0;i<N;i++){paid+=bet;won+=spin(m,bet,r).total;}
      const rtp=100*won/paid;expect(rtp,m.id).toBeGreaterThan(92);expect(rtp,m.id).toBeLessThan(97);expect(Math.abs(rtp-m.rtp),m.id).toBeLessThan(m.stats.swing>=4?2.5:1);}
  },600000);
  it('features happen about as often as designed',()=>{
    const count=(id:string,n:number,f:(x:ReturnType<typeof spin>)=>boolean)=>{const m=MACHINES.find(x=>x.id===id)!,r=rng(5);let k=0;for(let i=0;i<n;i++)if(f(spin(m,m.bets[0],r)))k++;return n/Math.max(1,k);};
    expect(count('gold-rush',100000,x=>!!x.free)).toBeGreaterThan(50);expect(count('gold-rush',100000,x=>!!x.free)).toBeLessThan(110);
    expect(count('lucky-lightning',100000,x=>!!x.hold)).toBeGreaterThan(80);expect(count('lucky-lightning',100000,x=>!!x.hold)).toBeLessThan(180);
    expect(count('wheel-of-riches',100000,x=>!!x.wheel)).toBeGreaterThan(25);expect(count('wheel-of-riches',100000,x=>!!x.wheel)).toBeLessThan(40);
  },120000);
});
describe('rules of the reels',()=>{
  it('wins are line pays plus features, wilds stand in, scatters and coins never pay on lines',()=>{
    const r=rng(3);
    for(const m of MACHINES)for(let i=0;i<4000;i++){const x=spin(m,m.bets[0],r);
      const sum=x.lineTotal+x.scatterWin+(x.free?.total??0)+(x.hold?.total??0)+(x.wheel?.amount??0)+(x.pick?.amount??0);expect(x.total).toBe(sum);
      for(const w of x.wins){expect(w.amount).toBeGreaterThan(0);expect(w.sym).not.toBe(m.scatter?.sym);expect(w.sym).not.toBe(m.coin?.sym);}
      if(x.hold){expect(x.hold.coins.length).toBeGreaterThanOrEqual(m.coin!.trigger);expect(x.hold.frames.at(-1)!.respins===0||x.hold.full).toBe(true);}
      if(x.free)expect(x.free.spins.length).toBeLessThanOrEqual(50);}
  });
});
describe('balance',()=>{
  it('a spin is paid and credited in one step, with the record kept',()=>{
    const m=MACHINES[2];let s=freshSlots();const r=rng(1);
    for(let i=0;i<200;i++){const before=s.balance;const p=playSpin(s,m,m.bets[0],r);expect(p.state.balance).toBe(before-m.bets[0]+p.result.total);s=p.state;}
    expect(s.machines[m.id].spins).toBe(200);expect(s.machines[m.id].wagered).toBe(200*m.bets[0]);expect(s.recent.length).toBe(30);
    expect(()=>playSpin(s,m,7,r)).toThrow();expect(()=>playSpin({...s,balance:0},m,m.bets[0],r)).toThrow();
    expect(()=>reloadSlots(s,20)).toThrow();expect(reloadSlots({...s,balance:5},20).balance).toBe(SLOTS_START);
    expect(checkSlots(JSON.parse(JSON.stringify(s)))).toEqual(s);expect(()=>checkSlots({balance:-1})).toThrow();
    expect(readSlots({getItem:()=>'{bad'}).notice).toMatch(/reset/);
  });
  it('the floor and a machine draw, with payback shown',()=>{
    const s=freshSlots(),ui=freshSlotsUi();const lobby=slotsMarkup(s,ui);for(const m of MACHINES){expect(lobby).toContain(`data-slot-machine="${m.id}"`);expect(lobby).toContain(`${m.rtp.toFixed(1)}%`);}
    expect(lobby).toContain('No machine is "due"');
    ui.machine='gold-rush';const page=slotsMarkup(s,ui);expect(page).toContain('id="slots-spin"');expect(page).toContain('Paytable');
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain("{ view: 'slots', label: 'Slots'");expect(readFileSync('src/slots/play.ts','utf8')).toContain('saveSlots(this.state');
  });
});
