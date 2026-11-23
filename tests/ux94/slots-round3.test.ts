import {describe,it,expect} from 'vitest';
import {gamble,freshSlots,checkSlots} from '../../src/slots/state';
import {MACHINES} from '../../src/slots/machines';
import {spin} from '../../src/slots/engine';
import {SlotsPlayer} from '../../src/slots/play';
import {freshSlotsUi,slotsMarkup} from '../../src/slots/view';

/* Patch 93: the double-up, measured machine facts, the floor and reel life. */
let queue:(()=>void)[]=[];
(globalThis as any).window={setTimeout:(f:()=>void)=>{queue.push(f);return queue.length;},clearTimeout:()=>{},setInterval:()=>0};
(globalThis as any).clearInterval=()=>{};
const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const rng=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return Math.floor(s/4294967296*n);};};
describe('double-up',()=>{
  it('is even money: colour wins half the time at 2×, suit a quarter at 4×',()=>{
    const r=rng(1);let s={...freshSlots(),balance:10**12};let colourWins=0,suitWins=0;const N=200000;
    for(let i=0;i<N;i++){const a=gamble(s,100,'red',r);s=a.state;if(a.won){colourWins++;expect(a.payout).toBe(200);expect(['h','d']).toContain(a.card[1]);}else expect(a.payout).toBe(0);}
    for(let i=0;i<N;i++){const a=gamble(s,100,'s',r);s=a.state;if(a.won){suitWins++;expect(a.payout).toBe(400);expect(a.card[1]).toBe('s');}}
    expect(Math.abs(colourWins/N-.5)).toBeLessThan(.005);expect(Math.abs(suitWins/N-.25)).toBeLessThan(.005);
    expect(s.gamble!.rounds).toBe(2*N);expect(Math.abs(s.gamble!.won/s.gamble!.wagered-1)).toBeLessThan(.01);
    expect(checkSlots(JSON.parse(JSON.stringify(s))).gamble).toEqual(s.gamble);
  });
  it('refuses bad stakes and choices',()=>{const s=freshSlots();expect(()=>gamble(s,0,'red')).toThrow();expect(()=>gamble(s,s.balance+1,'red')).toThrow();expect(()=>gamble(s,100,'green' as never)).toThrow();});
  it('the player offers it once after a win, keeps the balance right, and closes on a loss or after five wins',()=>{
    const deps={render(){},sound(){},active:()=>true,motion:()=>false};
    let offered=0;
    for(let k=0;k<200;k++){queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,deps);p.open('lucky-sevens');p.spin();
      for(let i=0;i<300&&ui.phase!=='done';i++){if(ui.overlay)p.skip();else{const f=queue.shift();f?.();}}
      if(!p.canGamble)continue;offered++;const before=p.state.balance;p.openGamble();expect(p.canGamble).toBe(false);
      let stake=ui.gamble!.stake;p.choose('black');const g=ui.gamble!;
      if(g.done==='lost')expect(p.state.balance).toBe(before-stake);else expect(p.state.balance).toBe(before+stake);
      p.collect();expect(ui.gamble).toBeNull();p.openGamble();expect(ui.gamble).toBeNull();}
    expect(offered).toBeGreaterThan(20);
  });
});
describe('machine facts',()=>{
  it('hit rate and feature frequency on every machine match what it shows',()=>{
    for(const m of MACHINES){const r=rng(42),bet=m.bets[1],N=120000;let hits=0,feat=0;
      for(let i=0;i<N;i++){const x=spin(m,bet,r);if(x.total>0)hits++;if(x.free||x.hold||x.wheel||x.pick)feat++;}
      expect(Math.abs(100*hits/N-m.stats.hitRate),m.id).toBeLessThan(1);
      if(m.stats.featureEvery===null)expect(feat).toBe(0);else expect(Math.abs(N/feat-m.stats.featureEvery)/m.stats.featureEvery,m.id).toBeLessThan(.2);
      expect(m.stats.swing).toBeGreaterThanOrEqual(1);expect(m.stats.swing).toBeLessThanOrEqual(5);}
  },300000);
});
describe('screens',()=>{
  it('the floor filters, shows recent machines and machine facts; the gamble panel draws',()=>{
    const s={...freshSlots(),recent:[{machine:'gem-cascade',bet:20,total:0,at:''},{machine:'gold-rush',bet:20,total:0,at:''}]};
    const ui=freshSlotsUi();ui.floor='classic';const h=slotsMarkup(s,ui);
    expect(h).toContain('data-slot-machine="lucky-sevens"');expect(h).toContain('data-slot-machine="triple-diamond"');
    expect(h).not.toContain('data-slot-machine="dust-devil" ');expect(h).toContain('RECENTLY PLAYED');expect(h).toContain('slot-swing');
    ui.floor='bonus';const b=slotsMarkup(s,ui);expect(b).not.toContain('class="slot-card kind-classic" data-slot-machine="lucky-sevens"');
    ui.machine='gold-rush';ui.gamble={stake:500,round:1,cards:[{card:'Kh',won:true}],done:null};const g=slotsMarkup(s,ui);
    expect(g).toContain('data-testid="slot-gamble"');for(const c of ['red','black','h','d','s','c'])expect(g).toContain(`data-gamble="${c}"`);expect(g).toContain('Collect $5');
  });
  it('bets are remembered per machine',()=>{const deps={render(){},sound(){},active:()=>true,motion:()=>false};const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,deps);p.open('gold-rush');p.setBet(200);
    const ui2=freshSlotsUi();new SlotsPlayer(freshSlots(),ui2,deps);expect(ui2.bet['gold-rush']).toBe(200);});
});
