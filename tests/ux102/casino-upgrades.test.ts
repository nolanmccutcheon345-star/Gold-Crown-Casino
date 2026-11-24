import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

/* Patch 100: racetrack bets, come odds and buy bets, EZ Baccarat and the Big Road, quinella and trifecta, other
 * players at the tables. */
let queue:(()=>void)[]=[];const intervals=new Map<number,()=>void>();let ids=0;
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return ++ids;},clearTimeout:()=>{},setInterval:(f:()=>void)=>{const id=++ids;intervals.set(id,f);return id;}};
(globalThis as Record<string, unknown>).clearInterval=(id:number)=>{intervals.delete(id);};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {ORDER,resolve,validBet,announcedBets,neighbours,ANNOUNCED,stats}=await import('../../src/casino/roulette');
const {freshTable,addBet,roll,cannotAdd,checkTable}=await import('../../src/casino/craps');
const {bankerDraws,deal,payout,bigRoad,isDragon7,isPanda8}=await import('../../src/casino/baccarat');
const {newRace,chance,odds,settleBet,margin,paths,TAKE}=await import('../../src/casino/races');
const {patronsFor,patronLine}=await import('../../src/casino/patrons');
const {CasinoPlayer,RACE_FRAMES}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const flush=()=>{for(let i=0;i<300&&queue.length;i++)queue.shift()!();};
const player=(seed=1)=>{store.clear();queue=[];intervals.clear();return new CasinoPlayer({render(){},sound(){},active:()=>false},seq(seed));};

describe('roulette racetrack',()=>{
  it('announced bets are real layout bets with the right chip counts, and keep the 2.70% edge',()=>{
    for(const a of ['voisins','tiers','orphelins','zero'] as const){const bets=announcedBets(a,100);expect(bets.every(b=>validBet(b,'european'))).toBe(true);expect(bets.reduce((x,b)=>x+b.amount,0)).toBe(ANNOUNCED[a].units*100);
      const ev=ORDER.european.reduce((x,p)=>x+resolve(bets,p).returned,0)/37/(ANNOUNCED[a].units*100);expect(1-ev).toBeCloseTo(1/37,10);}
    const cover=new Set(['voisins','tiers','orphelins'].flatMap(a=>announcedBets(a as 'voisins',100).flatMap(b=>[...b.numbers])));expect(cover.size).toBe(37);
    expect(neighbours(0,'european').map(b=>b.numbers[0])).toEqual([3,26,0,32,15]);expect(neighbours(26,'european').map(b=>b.numbers[0])).toEqual([35,3,26,0,32]);
  });
  it('stats count hot and cold numbers and the splits',()=>{
    const s=stats([17,17,17,0,1,2,3,32]);expect(s.hot[0]).toBe(17);expect(s.zero).toBe(1);expect(s.red+s.black).toBe(7);expect(s.dozens.reduce((a,b)=>a+b,0)).toBe(7);
  });
  it('the table places them, only on the single-zero wheel',()=>{
    const p=player();p.placeAnnounced('voisins');expect(p.pending('roulette')).toBe(9*500);p.placeNeighbours(17);expect(p.pending('roulette')).toBe(14*500);
    p.setWheel('american');p.placeAnnounced('tiers');expect(p.ui.error).toMatch(/single-zero/);
    p.setWheel('european');expect(casinoMarkup(p,'roulette')).toContain('data-testid="racetrack"');
  });
});
describe('craps: odds on come bets, buy bets',()=>{
  const dice:[number,number][]=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)dice.push([a,b]);
  const before7=(n:number)=>{const w=dice.filter(([a,b])=>a+b===n).length;return w/(w+6);};
  const back=(t:ReturnType<typeof freshTable>,d:[number,number],spot:string)=>roll(t,d).settled.filter(x=>x.spot===spot).reduce((a,x)=>a+x.back,0);
  it('come odds and lay odds pay true odds (no edge); come odds are off on the come-out',()=>{
    for(const p of [4,5,6,8,9,10] as const){const t={...freshTable(),point:(p===4?5:4) as 4,comeOn:{[p]:1000},comeOdds:{[p]:6000},dontComeOn:{[p]:1000},dontComeOdds:{[p]:6000}};
      const hit=dice.find(([a,b])=>a+b===p)!,q=before7(p);
      expect(q*back(t,hit,`comeOdds${p}`)+(1-q)*back(t,[3,4],`comeOdds${p}`)).toBeCloseTo(6000,6);
      expect(q*back(t,hit,`dontComeOdds${p}`)+(1-q)*back(t,[3,4],`dontComeOdds${p}`)).toBeCloseTo(6000,6);
      const off={...t,point:null};expect(back(off,[3,4],`comeOdds${p}`)).toBe(6000);expect(back(off,hit,`comeOdds${p}`)).toBe(6000);}
    const t={...freshTable(),point:6 as const,comeOn:{5:1000}};expect(cannotAdd(t,'comeOdds5',4000)).toBeNull();expect(cannotAdd(t,'comeOdds5',4100)).toMatch(/4x/);expect(cannotAdd(t,'comeOdds8',100)).toMatch(/Come bet on 8/);
  });
  it('buy bets: 4/10 1.67%, 5/9 2%, off on the come-out, and they stay up',()=>{
    const edge=(b:4|5|9|10)=>{const t=addBet({...freshTable(),point:(b===4?5:4) as 4},`buy${b}`,2000),hit=dice.find(([x,y])=>x+y===b)!,q=before7(b);return 1-(q*back(t,hit,`buy${b}`)+(1-q)*back(t,[3,4],`buy${b}`))/2000;};
    expect(edge(4)).toBeCloseTo(1/60,10);expect(edge(10)).toBeCloseTo(1/60,10);expect(edge(5)).toBeCloseTo(.02,10);expect(edge(9)).toBeCloseTo(.02,10);
    expect(roll(addBet(freshTable(),'buy4',2000),[2,2]).settled).toEqual([]);
    expect(roll(addBet({...freshTable(),point:5},'buy4',2000),[1,3]).table.buy[4]).toBe(2000);
    expect(checkTable({...freshTable(),comeOdds:undefined,buy:undefined})).toEqual(freshTable());
  });
  it('shooter stats and "same bets" after a seven-out',()=>{
    for(let k=0;k<40;k++){const p=player(k);p.setChip(2500);p.crapsSpot('pass');let guard=0;
      while(guard++<200){if(p.craps.point&&!p.craps.place[6])p.crapsSpot('place6');if(!p.craps.point&&!p.craps.pass)p.crapsSpot('pass');const before=p.craps.point;p.rollCraps();const r=p.ui.craps.last!;flush();if(before&&r.sum===7)break;}
      expect(p.ui.craps.lastLayout).not.toBeNull();expect(p.ui.craps.shooter.rolls).toBe(0);
      const bal=p.state.balance;p.sameBets();expect(p.craps.pass).toBe(2500);expect(p.state.balance).toBe(bal-2500-(p.craps.place[6]??0));}
  });
});
describe('baccarat: EZ Baccarat and the Big Road',()=>{
  it('exact edges: EZ Banker 1.02%, Dragon 7 7.61%, Panda 8 10.19%',()=>{
    const counts=[128,32,32,32,32,32,32,32,32,32];let n=416;let pW=0,bW=0,dragon=0,panda=0;
    const draw=(f:(v:number,p:number)=>void)=>{for(let v=0;v<10;v++){if(!counts[v])continue;const p=counts[v]/n;counts[v]--;n--;f(v,p);counts[v]++;n++;}};
    const fin=(P:number,B:number,pc:number,bc:number,pr:number)=>{if(P>B){pW+=pr;if(pc===3&&P===8)panda+=pr;}else if(B>P){bW+=pr;if(bc===3&&B===7)dragon+=pr;}};
    draw((p1,a)=>draw((b1,b)=>draw((p2,c)=>draw((b2,d)=>{const base=a*b*c*d,pt=(p1+p2)%10,bt=(b1+b2)%10;
      if(pt>=8||bt>=8)return fin(pt,bt,2,2,base);
      if(pt<=5)draw((p3,e)=>{const P=(pt+p3)%10;if(bankerDraws(bt,p3))draw((b3,f)=>fin(P,(bt+b3)%10,3,3,base*e*f));else fin(P,bt,3,2,base*e);});
      else if(bankerDraws(bt,null))draw((b3,f)=>fin(pt,(bt+b3)%10,2,3,base*f));else fin(pt,bt,2,2,base);}))));
    expect(-((bW-dragon)-pW)).toBeCloseTo(.010183,5);expect(-(dragon*40-(1-dragon))).toBeCloseTo(.076112,5);expect(-(panda*25-(1-panda))).toBeCloseTo(.10188,5);
  },120000);
  it('pays EZ hands',()=>{
    const d7=deal(['3s','2h','3d','2c','3h']);// player 6 stands; banker 4 draws a 3: a three-card 7
    expect(isDragon7(d7)).toBe(true);expect(payout(d7,{banker:1000,dragon7:100,panda8:100},true).bySpot).toEqual({banker:1000,dragon7:4100,panda8:0});
    const p8=deal(['2s','4h','3d','3c','3h']);// player 5 draws a 3: 8; banker 7 stands
    expect(isPanda8(p8)).toBe(true);expect(payout(p8,{panda8:100,player:1000},true).returned).toBe(2600+2000);
    const plain=deal(['3s','5h','4d','2c']);// 7 v 7 tie
    expect(payout(plain,{banker:1000},true).returned).toBe(1000);
    const bw=deal(['2s','9h','3d','Kc','5h']);expect(payout(bw,{banker:1000},true).returned).toBe(2000);expect(payout(bw,{banker:1000},false).returned).toBe(1950);
    expect(payout(bw,{dragon7:100},false).returned).toBe(0);
  });
  it('the Big Road starts a new column on each change, marks ties, and turns a long streak right',()=>{
    const r=bigRoad(['B','B','P','T','P','P','B']);expect(r.map(c=>[c.col,c.row,c.v,c.ties])).toEqual([[0,0,'B',0],[0,1,'B',0],[1,0,'P',1],[1,1,'P',0],[1,2,'P',0],[2,0,'B',0]]);
    const long=bigRoad(Array(8).fill('B'));expect(long.map(c=>[c.col,c.row])).toEqual([[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,5],[2,5]]);
    const p=player();for(let i=0;i<4;i++){p.dealBaccarat();if(!p.ui.baccarat.coup){p.placeBaccarat('banker');p.dealBaccarat();}flush();}
    expect(casinoMarkup(p,'baccarat')).toContain('data-testid="big-road"');
  });
  it('squeeze: the side you backed comes face down until you peel it',()=>{
    for(let k=0;k<20;k++){const p=player(k);p.setSqueeze(true);p.placeBaccarat('player');p.dealBaccarat();const b=p.ui.baccarat;
      queue.shift()!();expect(b.waiting).toBe(true);expect(b.faceDown).toBe(0);expect(casinoMarkup(p,'baccarat')).toContain('data-bac-peel');
      let guard=0;while(b.phase==='dealing'&&guard++<20){if(b.waiting)p.peel();else queue.shift()?.();}
      expect(b.phase).toBe('done');expect(b.shown).toBe(b.coup!.order.length);}
  });
});
describe('races: quinella, trifecta, past performances, photo finishes',()=>{
  it('chances add up and every price keeps the take',()=>{
    for(let k=0;k<20;k++){const c=newRace(k,seq(k)),ns=c.runners.map(r=>r.no);let q=0,t=0;
      for(const a of ns)for(const b of ns)if(a<b)q+=chance(c,'quinella',[a,b]);
      for(const a of ns)for(const b of ns)for(const d of ns)if(a!==b&&b!==d&&a!==d)t+=chance(c,'trifecta',[a,b,d]);
      expect(q).toBeCloseTo(1,10);expect(t).toBeCloseTo(1,10);
      for(const k2 of ['quinella','trifecta'] as const){const picks=k2==='quinella'?[1,2]:[1,2,3],o=odds(c,k2,picks);if(o)expect(chance(c,k2,picks)*(1+o)).toBeLessThanOrEqual(1-TAKE+1e-9);}
      for(const r of c.runners){expect(r.past.length).toBeGreaterThanOrEqual(3);expect(r.best).toBe(Math.max(...r.past.map(x=>x.speed)));expect(r.form).toHaveLength(4);}}
    const order=[2,5,1,3,4,6,7,8];
    expect(settleBet({kind:'quinella',picks:[5,2],amount:100},10,order)).toBe(1100);expect(settleBet({kind:'trifecta',picks:[2,5,1],amount:100},99.5,order)).toBe(10050);expect(settleBet({kind:'trifecta',picks:[5,2,1],amount:100},99.5,order)).toBe(0);
  });
  it('margins read like a race call, and close ones go to a photo',()=>{
    let photos=0;for(let k=0;k<300;k++){const m=margin(paths([1,2,3,4,5,6,7,8],50,seq(k)),[1,2,3,4,5,6,7,8]);expect(m.text).toMatch(/^by (a nose|a head|a neck|a length|\d+ lengths)$/);if(m.photo)photos++;}
    expect(photos).toBeGreaterThan(10);expect(photos).toBeLessThan(150);
  });
  it('the table builds multi-horse bets in order and runs the race',()=>{
    for(let k=0;k<20;k++){const p=player(k);p.setRaceKind('trifecta');p.pickRunner(3);p.pickRunner(1);expect(p.ui.races.picking).toEqual([3,1]);p.pickRunner(1);expect(p.ui.races.picking).toEqual([3]);p.pickRunner(1);p.pickRunner(6);
      expect(p.ui.races.bets[0]?.picks??[3,1,6]).toEqual([3,1,6]);p.setRaceKind('quinella');p.pickRunner(2);p.pickRunner(4);
      if(!p.ui.races.bets.length)continue;p.startRace();for(let i=0;i<RACE_FRAMES+5&&intervals.size;i++)for(const f of [...intervals.values()])f();
      if(p.ui.races.photo)expect(p.ui.races.call).toBe('Photo finish!');flush();expect(p.ui.races.phase).toBe('done');expect(p.ui.races.call).toMatch(/wins it by/);}
  });
});
describe('other players at the tables',()=>{
  it('three or four players per table, who talk after rounds',()=>{
    for(const g of ['roulette','craps','baccarat','races']){const ps=patronsFor(g,'2026-11-22');expect(ps.length).toBeGreaterThanOrEqual(3);expect(ps.length).toBeLessThanOrEqual(4);
      for(const w of ['start','win','lose','big'] as const)expect(patronLine(g,ps[0],w,'7','x')).not.toMatch(/\{b\}/);}
    let talked=0;for(let k=0;k<20;k++){const p=player(k);p.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);p.spinRoulette();flush();if(p.ui.talk.roulette.length)talked++;expect(casinoMarkup(p,'roulette')).toContain('cz-patrons');}
    expect(talked).toBeGreaterThan(5);
    expect(readFileSync('src/ui/app.ts','utf8')).toContain("casino.placeAnnounced(b.dataset.announced as never)");
  });
});
