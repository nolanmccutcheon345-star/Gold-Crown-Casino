import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

/* Patch 99: the casino tables' controller and screens. */
let queue:(()=>void)[]=[];const intervals=new Map<number,()=>void>();let ids=0;
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return ++ids;},clearTimeout:()=>{},setInterval:(f:()=>void)=>{const id=++ids;intervals.set(id,f);return id;}};
(globalThis as Record<string, unknown>).clearInterval=(id:number)=>{intervals.delete(id);};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {CasinoPlayer,RACE_FRAMES}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const {CASINO_KEY,CASINO_START}=await import('../../src/casino/wallet');
const {onLayout}=await import('../../src/casino/craps');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const flush=()=>{for(let i=0;i<200&&queue.length;i++)queue.shift()!();};
const runIntervals=()=>{for(let i=0;i<RACE_FRAMES+5&&intervals.size;i++)for(const f of [...intervals.values()])f();};
const player=(seed=1)=>{store.clear();queue=[];intervals.clear();return new CasinoPlayer({render(){},sound(){},active:()=>false},seq(seed));};
const saved=()=>JSON.parse(store.get(CASINO_KEY)!);

describe('roulette table',()=>{
  it('stakes the chips, saves the result before the wheel stops, and pays it',()=>{
    for(let k=0;k<30;k++){const p=player(k);p.setChip(500);p.placeRoulette('straight',[17]);p.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);p.placeRoulette('straight',[17]);
      expect(p.pending('roulette')).toBe(1500);p.spinRoulette();expect(p.ui.roulette.phase).toBe('spinning');expect(p.pending('roulette')).toBe(0);
      const out=p.ui.roulette.result!;expect(p.state.balance).toBe(CASINO_START-1500+out.returned);expect(saved().balance).toBe(p.state.balance);
      flush();expect(p.ui.roulette.phase).toBe('done');expect(p.ui.roulette.bets).toEqual([]);
      p.spinRoulette();expect(p.ui.roulette.phase).toBe('spinning');expect(p.ui.roulette.last.reduce((a,b)=>a+b.amount,0)).toBe(1500);}
  });
  it('refuses layout bets that do not exist and chips you cannot cover',()=>{
    const p=player();p.placeRoulette('split',[3,4]);expect(p.ui.error).toMatch(/not on this layout/);
    p.setChip(50000);p.placeRoulette('red',[1]);p.placeRoulette('straight',[1]);p.placeRoulette('straight',[2]);p.placeRoulette('straight',[3]);expect(p.ui.error).toMatch(/Not enough/);
    p.setWheel('american');expect(p.ui.roulette.wheel).toBe('american');expect(casinoMarkup(p,'roulette')).toContain('data-rbet="basket|0-1-2-3-37"');
  });
});
describe('baccarat table',()=>{
  it('deals card by card, pays, and deals again with the same bets',()=>{
    for(let k=0;k<30;k++){const p=player(k);p.setChip(2500);p.placeBaccarat('banker');p.placeBaccarat('tie');p.dealBaccarat();
      const b=p.ui.baccarat;expect(b.phase).toBe('dealing');expect(p.state.balance).toBe(CASINO_START-5000+b.returned);
      const n=b.coup!.order.length;queue.shift()!();expect(b.shown).toBe(1);flush();expect(b.shown).toBe(n);expect(b.phase).toBe('done');
      expect(casinoMarkup(p,'baccarat')).toContain('Deal again');p.dealBaccarat();expect(p.ui.baccarat.wagered).toBe(5000);expect((p.state.boards!.baccarat as string[]).length).toBe(2);}
  });
});
describe('craps table',()=>{
  it('chips leave the balance when placed, come back when taken down, and the books balance on every roll',()=>{
    for(let k=0;k<20;k++){const p=player(k);p.setChip(2500);p.crapsSpot('pass');p.crapsSpot('field');expect(p.state.balance).toBe(CASINO_START-5000);
      for(let roll=0;roll<40;roll++){if(p.craps.point){if(!p.craps.place[6])p.crapsSpot('place6');}else if(!p.craps.pass)p.crapsSpot('pass');
        p.rollCraps();flush();}
      const r=p.state.games.craps??{wagered:0,returned:0},onTable=onLayout(p.craps);
      // Balance = start - everything ever placed - restakes + everything returned; equivalently start - wagered + returned - money still on the table.
      expect(p.state.balance).toBe(CASINO_START-r.wagered+r.returned-onTable);}
    const p=player(3);p.setChip(500);p.crapsSpot('dontPass');p.toggleTakeDown();p.crapsSpot('dontPass');expect(p.state.balance).toBe(CASINO_START);
    p.crapsSpot('come');expect(p.ui.error).toMatch(/Come bets need a point/);
  });
});
describe('race track',()=>{
  it('locks the odds, runs the race, pays, and moves to the next race',()=>{
    for(let k=0;k<15;k++){const p=player(k);p.setChip(500);p.pickRunner(1);p.setRaceKind('exacta');p.pickRunner(2);expect(p.ui.races.picking).toEqual([2]);p.pickRunner(3);
      const bets=p.ui.races.bets;expect(bets.length).toBe(2);expect(bets[1].picks).toEqual([2,3]);
      p.startRace();const h=p.ui.races;expect(h.phase).toBe('running');expect(p.state.balance).toBe(CASINO_START-1000+h.returned);expect(p.pending('races')).toBe(0);
      runIntervals();flush();expect(h.phase).toBe('done');expect(h.frame).toBe(RACE_FRAMES);expect(h.results).toEqual(h.order!.slice(0,3));expect(h.call).toContain('wins it');
      const n=h.card.number;p.nextRace();expect(p.ui.races.card.number).toBe(n+1);expect(p.ui.races.bets).toEqual([]);}
  });
});
describe('screens and navigation',()=>{
  it('every table renders and the four games are under Play',()=>{
    const p=player();for(const g of ['roulette','craps','baccarat','races'] as const){const m=casinoMarkup(p,g);expect(m).toContain(`data-testid="${g}"`);expect(m).toContain('data-testid="casino-balance"');}
    const app=readFileSync('src/ui/app.ts','utf8');for(const v of ['roulette','craps','baccarat','races'])expect(app).toContain(`{ view: '${v}'`);
    /* Phase 14 contract change: the Home hub strip became the unified
     * wallet; the casino balance now reaches Home through walletComponents. */
    expect(app).toContain("casino: { available: casino.state.balance, inPlay: 0 }");expect(app).toContain("import './casino.css';");
  });
});
