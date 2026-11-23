import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

/* Patch 101: backups for slots and the casino, La Partage, finals, favourites, auto-spin, hop bets, the Fire Bet,
 * shooters, horn and press, the derived roads, auto-deal, scratches, the Daily Double, the race day and replays. */
let queue:(()=>void)[]=[];const intervals=new Map<number,()=>void>();let ids=0;
(globalThis as any).window={setTimeout:(f:()=>void)=>{queue.push(f);return ++ids;},clearTimeout:()=>{},setInterval:(f:()=>void)=>{const id=++ids;intervals.set(id,f);return id;}};
(globalThis as any).clearInterval=(id:number)=>{intervals.delete(id);};
const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {ORDER,resolve,finals,outside}=await import('../../src/casino/roulette');
const {freshTable,addBet,roll,cannotAdd,checkTable,POINTS}=await import('../../src/casino/craps');
const {derivedRoad,ask}=await import('../../src/casino/baccarat');
const {newRace,runRace,chance,odds,ddOdds,ddChance,TAKE}=await import('../../src/casino/races');
const {CasinoPlayer,RACE_FRAMES}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const {CASINO_START,checkCasino,freshCasino}=await import('../../src/casino/wallet');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const flush=()=>{for(let i=0;i<400&&queue.length;i++)queue.shift()!();};
const runIntervals=()=>{for(let i=0;i<RACE_FRAMES+5&&intervals.size;i++)for(const f of [...intervals.values()])f();};
const player=(seed=1)=>{store.clear();queue=[];intervals.clear();return new CasinoPlayer({render(){},sound(){},active:()=>true},seq(seed));};

describe('backups',()=>{
  it('a backup carries the slots and casino balances and checks them',async()=>{
    const {readBackup,makeBackup}=await import('../../src/storage/backup');
    const {SessionController}=await import('../../src/session/controller');
    const {freshSlots}=await import('../../src/slots/state');
    class Memory{data:unknown=null;async load(){return structuredClone(this.data);}async commit(_e:number|null,d:unknown){this.data=structuredClone(d);}close(){}}
    const c=new SessionController(new Memory() as never);await c.init();const cash=await c.backupData();c.close();
    const ok=makeBackup(cash,null,null);ok.slots=freshSlots();ok.casino={...freshCasino(),balance:123456,favs:[{name:'x',wheel:'european',bets:[{kind:'red',numbers:outside('red'),amount:500}]}]};
    const back=await readBackup(JSON.stringify(ok));expect(back.casino!.balance).toBe(123456);expect(back.casino!.favs!.length).toBe(1);expect(back.slots).toBeTruthy();
    const old=makeBackup(cash,null,null);const o=await readBackup(JSON.stringify(old));expect(o.casino).toBeUndefined();expect(o.slots).toBeUndefined();
    const bad=makeBackup(cash,null,null);(bad as any).casino={balance:-1};await expect(readBackup(JSON.stringify(bad))).rejects.toThrow(/casino part/);
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain('backup.casino=structuredClone(casino.state)');expect(app).toContain('casino.restore(backup.casino)');
  });
});
describe('roulette',()=>{
  it('La Partage halves the even-money edge to 1.35% and changes nothing else',()=>{
    for(const k of ['red','black','odd','even','low','high'] as const){const b={kind:k,numbers:outside(k),amount:1000};const ev=ORDER.european.reduce((a,p)=>a+resolve([b],p,true).returned,0)/37/1000;expect(1-ev).toBeCloseTo(1/74,10);}
    const s={kind:'straight' as const,numbers:[17],amount:1000};expect(ORDER.european.reduce((a,p)=>a+resolve([s],p,true).returned,0)).toBe(36000);
  });
  it('finals cover every number ending in the digit',()=>{
    expect(finals(0,100).map(b=>b.numbers[0])).toEqual([0,10,20,30]);expect(finals(7,100).map(b=>b.numbers[0])).toEqual([7,17,27]);expect(()=>finals(10,100)).toThrow();
  });
  it('favourites save (up to three), reload, and survive the save check; auto-spin repeats and stops',()=>{
    const p=player();p.placeRoulette('red',outside('red'));p.saveFavourite();p.placeFinals(7);p.saveFavourite();p.saveFavourite();p.saveFavourite();
    expect(p.state.favs!.length).toBe(3);expect(checkCasino(JSON.parse(JSON.stringify(p.state))).favs!.length).toBe(3);
    p.clearRoulette();p.useFavourite(0);expect(p.ui.roulette.bets.length).toBeGreaterThan(0);p.deleteFavourite(0);expect(p.state.favs!.length).toBe(2);
    const a=player(5);a.placeRoulette('straight',[17]);a.autoSpin(5,false);let spins=0;while(a.ui.roulette.phase==='spinning'&&spins<10){flush();spins++;}
    expect(a.state.games.roulette!.rounds).toBe(5);expect(a.ui.roulette.auto).toBeNull();
    const w=player(9);w.placeRoulette('red',outside('red'));w.autoSpin(25,true);for(let i=0;i<40&&(w.ui.roulette.auto||w.ui.roulette.phase==='spinning');i++)flush();
    const r=w.state.games.roulette!;expect(r.rounds).toBeLessThanOrEqual(25);if(r.rounds<25)expect(w.ui.roulette.result!.returned).toBeGreaterThan(w.ui.roulette.result!.wagered);
    expect(casinoMarkup(w,'roulette')).toContain('data-finals="7"');
  });
});
describe('craps',()=>{
  const dice:[number,number][]=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)dice.push([a,b]);
  it('hop bets: easy 15:1 (11.1%), hard 30:1 (13.9%), one roll',()=>{
    const ev=(spot:string)=>dice.reduce((x,d)=>x+roll(addBet(freshTable(),spot as never,3600),d).settled.reduce((y,s)=>y+s.back,0),0)/36/3600;
    expect(1-ev('hop25')).toBeCloseTo(1/9,10);expect(1-ev('hop33')).toBeCloseTo(5/36,10);
    expect(cannotAdd(freshTable(),'hop52' as never,100)).toMatch(/smaller first/);expect(roll(addBet(freshTable(),'hop16' as never,100),[6,1]).settled[0].back).toBe(1600);
  });
  it('the Fire Bet pays on different points made: exact edge 20.76% with 24/249/999',()=>{
    // Exact value by subsets of points made: V(S) is what one unit returns from a come-out with S already made.
    const ways=(n:number)=>dice.filter(([a,b])=>a+b===n).length;const pts=[4,5,6,8,9,10];const memo=new Map<number,number>();
    const pay=(k:number)=>k>=5?250:k===4?25:0;
    const V=(mask:number):number=>{const k=pts.filter((_,i)=>mask>>i&1).length;if(k===6)return 1000;if(memo.has(mask))return memo.get(mask)!;
      let sum=0,stay=0;for(let s=2;s<=12;s++){const w=ways(s)/36;const i=pts.indexOf(s);if(i<0){stay+=w;continue;}const q=ways(s)/(ways(s)+6);if(mask>>i&1){stay+=w*q;sum+=w*(1-q)*pay(k);}else sum+=w*(q*V(mask|1<<i)+(1-q)*pay(k));}
      const v=sum/(1-stay);memo.set(mask,v);return v;};
    expect(1-V(0)).toBeCloseTo(.20759,4);
    // The engine: points collect; 4 points pay 24:1 at the seven-out; the bet goes on only for a new shooter.
    let t=addBet(freshTable(),'fire',100);expect(cannotAdd(roll(t,[1,3]).table,'fire',100)).toMatch(/new shooter/);
    for(const p of [4,5,6,8]){t=roll(t,[1,p-1]).table;if(p>7)t=roll(t,[2,p-2]).table;else t=roll(t,p<=6?[Math.floor(p/2),Math.ceil(p/2)]:[1,1]).table;}
    expect(t.firePoints.length).toBeGreaterThanOrEqual(3);
    let u:ReturnType<typeof freshTable>={...freshTable(),fire:100,firePoints:[4,5,6,8] as never,newShooter:false,point:9 as const};const r=roll(u,[3,4]);expect(r.settled.find(x=>x.spot==='fire')!.back).toBe(2500);expect(r.table.newShooter).toBe(true);
    u={...freshTable(),fire:100,firePoints:[4,5,6,8,9] as never,newShooter:false,point:10 as const};expect(roll(u,[4,6]).settled.find(x=>x.spot==='fire')!.back).toBe(100000);
    expect(checkTable({...freshTable(),hop:undefined,fire:undefined,firePoints:undefined,newShooter:undefined})).toEqual(freshTable());void POINTS;
  });
  it('the dice pass around the table; horn and press place the right chips',()=>{
    for(let k=0;k<10;k++){const p=player(k);p.setChip(500);p.crapsSpot('pass');let seats=new Set<string>([p.shooterName()]);
      for(let i=0;i<120;i++){if(!p.craps.point&&!p.craps.pass)p.crapsSpot('pass');p.rollCraps();flush();seats.add(p.shooterName());}
      expect(seats.size).toBeGreaterThan(1);expect(casinoMarkup(p,'craps')).toContain('data-testid="shooter"');}
    const p=player(2);p.setChip(500);const b0=p.state.balance;p.placeHorn();expect(p.craps.aces+p.craps.aceDeuce+p.craps.yo+p.craps.twelve).toBe(2000);expect(p.state.balance).toBe(b0-2000);
    p.crapsSpot('place6');p.crapsSpot('buy4');p.pressPlace();expect(p.craps.place[6]).toBe(1000);expect(p.craps.buy[4]).toBe(1000);
  });
});
describe('baccarat roads and auto-deal',()=>{
  it('derived roads follow the standard rules',()=>{
    expect(derivedRoad(['P','P','P','B','B','B'],1)).toEqual(['R','R']);// column 2 copies column 1
    expect(derivedRoad(['B','B','P','B'],1)).toEqual(['B']);// new column: the two before differ (2 v 1)
    expect(derivedRoad(['B','P','B','P','B'],1)).toEqual(['R','R','R']);// chop: equal columns
    expect(derivedRoad(['B','B','P','B','B','B'],1)).toEqual(['B','B','R']);
    expect(derivedRoad(['B','P','B','P','B'],2)).toEqual(['R','R']);expect(derivedRoad(['B','P','B','P','B'],3)).toEqual(['R']);
    expect(ask(['B','P','B','P'],'B')).toEqual(['R','R','R']);expect(ask(['B'],'P')).toEqual([null,null,null]);
  });
  it('auto-deal deals the same bets until it runs out',()=>{
    const p=player(3);p.placeBaccarat('banker');p.autoDeal(5);for(let i=0;i<60&&(p.ui.baccarat.auto>0||p.ui.baccarat.phase==='dealing');i++)flush();
    expect(p.state.games.baccarat!.rounds).toBe(5);expect(casinoMarkup(p,'baccarat')).toContain('data-testid="derived-roads"');
  });
});
describe('race day',()=>{
  it('scratches: the horse does not run, takes no bets, and the others’ chances still add up',()=>{
    let seen=0;for(let k=0;k<200;k++){const c=newRace(k,seq(k));const scr=c.runners.filter(r=>r.scratched);if(!scr.length)continue;seen++;
      expect(scr.length).toBe(1);expect(c.runners.reduce((a,r)=>a+r.p,0)).toBeCloseTo(1,10);expect(odds(c,'win',[scr[0].no])).toBe(0);
      const o=runRace(c,seq(k+1));expect(o).not.toContain(scr[0].no);expect(o.length).toBe(7);
      let s=0;for(const r of c.runners)s+=chance(c,'show',[r.no]);expect(s).toBeCloseTo(3,10);}
    expect(seen).toBeGreaterThan(30);
  });
  it('the Daily Double keeps the take and pays after the second race',()=>{
    const a=newRace(1,seq(1)),b=newRace(2,seq(2));for(const x of a.runners)for(const y of b.runners){const o=ddOdds(a,b,x.no,y.no);if(o)expect(ddChance(a,b,x.no,y.no)*(1+o)).toBeLessThanOrEqual(1-TAKE+1e-9);}
    for(let k=0;k<30;k++){const p=player(k);p.setChip(500);p.setRaceKind('dd');const fav=[...p.ui.races.card.runners].filter(r=>!r.scratched).sort((x,y)=>y.p-x.p)[0].no,fav2=[...p.ui.races.next.runners].filter(r=>!r.scratched).sort((x,y)=>y.p-x.p)[0].no;
      p.pickRunner(fav);p.pickRunner(fav2);expect(p.ui.races.dd.length).toBe(1);expect(p.pending('races')).toBe(500);
      p.startRace();runIntervals();flush();const won1=p.ui.races.order![0]===fav;
      expect(p.day.dd.length).toBe(won1?1:0);
      // Balance = start - wagered + returned - Daily Double money still riding.
      const g=p.state.games.races,riding=p.day.dd.reduce((s,d)=>s+d.amount,0);expect(p.state.balance).toBe(CASINO_START-(g?.wagered??0)+(g?.returned??0)-riding);
      p.nextRace();expect(p.ui.races.card.number).toBe(2);
      if(won1){p.startRace();runIntervals();flush();expect(p.day.dd.length).toBe(0);const g2=p.state.games.races!;expect(p.state.balance).toBe(CASINO_START-g2.wagered+g2.returned);}}
  });
  it('the race day is saved: a new visit picks up the same race, results and riding Daily Double',()=>{
    const p=player(4);p.pickRunner(1);p.startRace();runIntervals();flush();p.nextRace();
    const q=new CasinoPlayer({render(){},sound(){},active:()=>true},seq(77));expect(q.ui.races.card.id).toBe(p.ui.races.card.id);expect(q.day.results.length).toBe(1);expect(q.day.number).toBe(2);
  });
  it('a replay moves the horses again without paying twice',()=>{
    const p=player(6);p.pickRunner(2);p.startRace();runIntervals();flush();const s=JSON.stringify(p.state);
    p.replayRace();expect(p.ui.races.replay).toBe(true);runIntervals();flush();expect(p.ui.races.phase).toBe('done');expect(JSON.stringify(p.state)).toBe(s);
    expect(casinoMarkup(p,'races')).toContain('id="race-replay"');
  });
});
