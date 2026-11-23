import {describe,it,expect} from 'vitest';
import {freshCasino,stake,settle,reloadCasino,checkCasino,pushBoard,CASINO_START} from '../../src/casino/wallet';
import {ORDER,DOUBLE_ZERO,resolve,validBet,outside,PAYS,colourOf,call as rouletteCall,type RouletteBet,type Wheel} from '../../src/casino/roulette';
import {bankerDraws,deal,payout,total,pointOf,call as bacCall,type Coup} from '../../src/casino/baccarat';
import {freshTable,addBet,roll,removeBet,cannotAdd,maxOdds,onLayout,checkTable,type CrapsTable,type Spot} from '../../src/casino/craps';
import {newRace,runRace,chance,odds,settleBet,paths,TAKE,validRaceBet,oddsLabel} from '../../src/casino/races';

/* Patch 99: the casino games' rules and money. House edges are computed exactly, from every outcome, through the
 * same functions the tables use. */
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};

describe('casino balance',()=>{
  it('stakes, settles, records and reloads in cents',()=>{
    let s=freshCasino();expect(s.balance).toBe(CASINO_START);
    s=stake(s,2500);expect(s.balance).toBe(97500);s=settle(s,'roulette',2500,5000);expect(s.balance).toBe(102500);
    expect(s.games.roulette).toEqual({rounds:1,wagered:2500,returned:5000,biggest:2500});
    expect(()=>stake(s,s.balance+1)).toThrow();expect(()=>stake(s,0)).toThrow();expect(()=>reloadCasino(s)).toThrow();
    const broke={...s,balance:50};expect(reloadCasino(broke).balance).toBe(CASINO_START);
    s=pushBoard(s,'roulette',17);expect(checkCasino(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(()=>checkCasino({balance:-1})).toThrow();
  });
});
describe('roulette',()=>{
  const wheels:Wheel[]=['european','american'];
  it('wheels hold every pocket once, in the real order',()=>{
    expect([...ORDER.european].sort((a,b)=>a-b)).toEqual(Array.from({length:37},(_,i)=>i));
    expect([...ORDER.american].sort((a,b)=>a-b)).toEqual(Array.from({length:38},(_,i)=>i));
    expect(colourOf(0)).toBe('green');expect(colourOf(DOUBLE_ZERO)).toBe('green');expect(colourOf(32)).toBe('red');expect(colourOf(15)).toBe('black');
    expect(rouletteCall(17)).toBe('17 black, odd, low.');
  });
  it('every bet has the exact house edge: 2.70% single zero, 5.26% double zero (7.89% on the top line)',()=>{
    const ev=(b:RouletteBet,w:Wheel)=>ORDER[w].reduce((a,p)=>a+resolve([b],p).returned,0)/ORDER[w].length/b.amount;
    const bets:RouletteBet[]=[{kind:'straight',numbers:[17],amount:100},{kind:'split',numbers:[17,20],amount:100},{kind:'street',numbers:[16,17,18],amount:100},{kind:'corner',numbers:[16,17,19,20],amount:100},{kind:'line',numbers:[16,17,18,19,20,21],amount:100},
     ...(['dozen','column'] as const).flatMap(k=>[0,1,2].map(w=>({kind:k,numbers:outside(k,w),amount:100}))),...(['red','black','odd','even','low','high'] as const).map(k=>({kind:k,numbers:outside(k),amount:100}))];
    for(const b of bets){expect(validBet(b,'european')).toBe(true);expect(1-ev(b,'european')).toBeCloseTo(1/37,10);expect(1-ev(b,'american')).toBeCloseTo(2/38,10);}
    expect(1-ev({kind:'basket',numbers:[0,1,2,3,DOUBLE_ZERO],amount:100},'american')).toBeCloseTo(3/38,10);
  });
  it('only bets a real layout allows',()=>{
    const ok=(kind:RouletteBet['kind'],numbers:number[],w:Wheel='european')=>validBet({kind,numbers,amount:100},w);
    expect(ok('split',[3,4])).toBe(false);expect(ok('split',[3,6])).toBe(true);expect(ok('split',[0,3])).toBe(true);expect(ok('split',[0,3],'american')).toBe(false);
    expect(ok('split',[0,DOUBLE_ZERO],'american')).toBe(true);expect(ok('split',[2,DOUBLE_ZERO],'american')).toBe(true);expect(ok('straight',[DOUBLE_ZERO])).toBe(false);
    expect(ok('street',[2,3,4])).toBe(false);expect(ok('corner',[2,3,5,6])).toBe(true);expect(ok('corner',[3,4,6,7])).toBe(false);expect(ok('corner',[34,35,37,38])).toBe(false);
    expect(ok('line',[31,32,33,34,35,36])).toBe(true);expect(ok('line',[34,35,36,37,38,39])).toBe(false);expect(ok('basket',[0,1,2,3,DOUBLE_ZERO])).toBe(false);
    expect(validBet({kind:'straight',numbers:[5],amount:0},'european')).toBe(false);
    expect(PAYS.straight).toBe(35);
  });
});
describe('baccarat',()=>{
  it('the drawing rules give the exact eight-deck odds: Banker 1.06%, Player 1.24%, Tie 14.36%',()=>{
    // Enumerate every deal by card value, without replacement (value 0 = tens and faces: 128 cards; 1-9: 32 each).
    const counts=[128,32,32,32,32,32,32,32,32,32];let n=416;let pW=0,bW=0,tie=0;
    const draw=(f:(v:number,p:number)=>void)=>{for(let v=0;v<10;v++){if(!counts[v])continue;const p=counts[v]/n;counts[v]--;n--;f(v,p);counts[v]++;n++;}};
    draw((p1,a)=>draw((b1,b)=>draw((p2,c)=>draw((b2,d)=>{const base=a*b*c*d,pt=(p1+p2)%10,bt=(b1+b2)%10;
      const fin=(P:number,B:number,pr:number)=>{if(P>B)pW+=pr;else if(B>P)bW+=pr;else tie+=pr;};
      if(pt>=8||bt>=8)return fin(pt,bt,base);
      if(pt<=5)draw((p3,e)=>{const P=(pt+p3)%10;if(bankerDraws(bt,p3))draw((b3,f)=>fin(P,(bt+b3)%10,base*e*f));else fin(P,bt,base*e);});
      else if(bankerDraws(bt,null))draw((b3,f)=>fin(pt,(bt+b3)%10,base*f));else fin(pt,bt,base);}))));
    expect(pW+bW+tie).toBeCloseTo(1,9);
    expect(-(bW*.95-pW)).toBeCloseTo(.010579,5);expect(-(pW-bW)).toBeCloseTo(.012351,5);expect(-(tie*8-(1-tie))).toBeCloseTo(.143596,5);
  },120000);
  it('deals in order and pays the spots',()=>{
    const coup=deal(['3s','5h','4d','2c','Kh','Tc']);// player 3+4=7 stands; banker 5+2=7 stands
    expect(coup.player).toEqual(['3s','4d']);expect(coup.banker).toEqual(['5h','2c']);expect(coup.winner).toBe('tie');
    const r=payout(coup,{player:1000,banker:1000,tie:500,playerPair:100});expect(r.bySpot).toEqual({player:1000,banker:1000,tie:4500,playerPair:0});
    const b=deal(['2s','9h','3d','Kc','5h','4c']);// player 5 draws 5 → 0; banker 9 natural? 9+K=9 natural
    expect(b.natural).toBe(true);expect(b.winner).toBe('banker');expect(payout(b,{banker:1000}).returned).toBe(1950);
    const c=deal(['As','5h','Ad','Kc','2h','8c']);// player 2 draws 2 → 4; banker 5, player third 2 → banker does not draw (5 draws on 4-7)
    expect(c.player.length).toBe(3);expect(c.banker.length).toBe(2);expect(c.winner).toBe('banker');expect(payout(c,{playerPair:100}).returned).toBe(1200);
    expect(total(['9s','8h'])).toBe(7);expect(pointOf('Q')).toBe(0);expect(bacCall(c as Coup)).toBe('Banker wins, five over four.');
  });
});
describe('craps',()=>{
  const dice:[number,number][]=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)dice.push([a,b]);
  const back=(t:CrapsTable,d:[number,number],spot?:string)=>roll(t,d).settled.filter(x=>!spot||x.spot===spot).reduce((a,x)=>a+x.back,0);
  const pt=(point:number,bets:Partial<CrapsTable>):CrapsTable=>({...freshTable(),point:point as never,...bets});
  /** Chance of rolling `n` before a seven. */
  const before7=(n:number)=>{const w=dice.filter(([a,b])=>a+b===n).length;return w/(w+6);};
  it('one-roll bets have their exact edges',()=>{
    const ev=(spot:Spot)=>dice.reduce((s,d)=>s+back(addBet(freshTable(),spot,3600),d),0)/36/3600;
    expect(1-ev('field')).toBeCloseTo(1/36,10);expect(1-ev('any7')).toBeCloseTo(1/6,10);expect(1-ev('anyCraps')).toBeCloseTo(1/9,10);
    expect(1-ev('yo')).toBeCloseTo(1/9,10);expect(1-ev('aces')).toBeCloseTo(5/36,10);expect(1-ev('aceDeuce')).toBeCloseTo(1/9,10);expect(1-ev('twelve')).toBeCloseTo(5/36,10);
  });
  it('the line: Pass 1.41%, Don’t Pass 1.36%; odds are free',()=>{
    const line=(spot:'pass'|'dontPass')=>{let ev=0;for(const d of dice){const r=roll(addBet(freshTable(),spot,6000),d);
      if(r.table.point===null){ev+=back(addBet(freshTable(),spot,6000),d)/36;continue;}
      const p=r.table.point,hit=dice.find(([a,b])=>a+b===p)!,t=r.table,q=before7(p);ev+=(q*back(t,hit)+(1-q)*back(t,[3,4]))/36;}return ev/6000;};
    expect(1-line('pass')).toBeCloseTo(7/495,10);expect(1-line('dontPass')).toBeCloseTo(3/220,10);
    for(const p of [4,5,6,8,9,10]){const hit=dice.find(([a,b])=>a+b===p&&a!==b)??dice.find(([a,b])=>a+b===p)!,t=pt(p,{passOdds:6000,dontOdds:6000}),q=before7(p);
      expect(q*back(t,hit,'passOdds')+(1-q)*back(t,[3,4],'passOdds')).toBeCloseTo(6000,6);expect(q*back(t,hit,'dontOdds')+(1-q)*back(t,[3,4],'dontOdds')).toBeCloseTo(6000,6);}
  });
  it('place bets and hardways: 6.67% / 4% / 1.52%, hard 4/10 11.1%, hard 6/8 9.09%',()=>{
    const place=(p:number)=>{const t=pt(5===p?4:5,{place:{[p]:3000}}),hit=dice.find(([a,b])=>a+b===p)!,q=before7(p);return 1-(q*back(t,hit,`place${p}`)+(1-q)*back(t,[3,4],`place${p}`))/3000;};
    expect(place(4)).toBeCloseTo(1/15,10);expect(place(10)).toBeCloseTo(1/15,10);expect(place(5)).toBeCloseTo(1/25,10);expect(place(9)).toBeCloseTo(1/25,10);expect(place(6)).toBeCloseTo(1/66,10);expect(place(8)).toBeCloseTo(1/66,10);
    const hard=(h:number)=>{const t=pt(h===4?5:4,{hard:{[h]:1000}}),win=1,lose=dice.filter(([a,b])=>a+b===7||(a+b===h&&a!==b)).length,q=win/(win+lose);return 1-(q*back(t,[h/2,h/2],`hard${h}`))/1000;};
    expect(hard(4)).toBeCloseTo(1/9,10);expect(hard(10)).toBeCloseTo(1/9,10);expect(hard(6)).toBeCloseTo(1/11,10);expect(hard(8)).toBeCloseTo(1/11,10);
  });
  it('place bets and hardways are off on the come-out; winners stay up',()=>{
    const t={...freshTable(),place:{6:600},hard:{6:500}};expect(roll(t,[3,3]).settled).toEqual([]);expect(roll(t,[3,4]).settled).toEqual([]);
    const on=pt(5,{place:{6:600},hard:{6:500}}),r=roll(on,[3,3]);expect(r.table.place[6]).toBe(600);expect(r.table.hard[6]).toBe(500);expect(r.restaked).toBe(1100);expect(back(on,[3,3])).toBe(600+700+500+4500);
  });
  it('come bets travel to their number and the point cycle works',()=>{
    let t=addBet(freshTable(),'pass',1000);let r=roll(t,[2,2]);expect(r.table.point).toBe(4);expect(r.call).toContain('point is 4');
    t=addBet(addBet(r.table,'come',500),'passOdds',3000);expect(cannotAdd(t,'passOdds',100)).toMatch(/3x/);expect(maxOdds(t)).toBe(3000);
    r=roll(t,[3,3]);expect(r.table.comeOn[6]).toBe(500);
    r=roll(r.table,[1,3]);expect(r.table.point).toBeNull();expect(r.settled.find(x=>x.spot==='pass')!.back).toBe(2000);expect(r.settled.find(x=>x.spot==='passOdds')!.back).toBe(9000);expect(r.table.comeOn[6]).toBe(500);
    r=roll(r.table,[3,4]);expect(r.settled.find(x=>x.spot==='come6')!.back).toBe(0);expect(onLayout(r.table)).toBe(0);
    expect(()=>addBet(freshTable(),'come',100)).toThrow();expect(()=>removeBet(pt(6,{pass:100}),'pass')).toThrow();expect(removeBet(pt(6,{dontPass:100,dontOdds:600}),'dontPass').back).toBe(700);
    expect(checkTable(JSON.parse(JSON.stringify(r.table)))).toEqual(r.table);expect(()=>checkTable({point:7})).toThrow();
    expect(roll(addBet(freshTable(),'dontPass',1000),[6,6]).settled[0].back).toBe(1000);
  });
});
describe('horse racing',()=>{
  it('race cards are well formed and the chances add up (win 1, place 2, show 3)',()=>{
    for(let k=0;k<30;k++){const c=newRace(k,seq(k));expect(c.runners.length).toBe(8);expect(new Set(c.runners.map(r=>r.name)).size).toBe(8);
      const s=(kind:'win'|'place'|'show')=>c.runners.reduce((a,r)=>a+chance(c,kind,[r.no]),0);expect(s('win')).toBeCloseTo(1,10);expect(s('place')).toBeCloseTo(2,10);expect(s('show')).toBeCloseTo(3,10);
      let ex=0;for(const a of c.runners)for(const b of c.runners)if(a!==b)ex+=chance(c,'exacta',[a.no,b.no]);expect(ex).toBeCloseTo(1,10);}
  });
  it('every offered price keeps at least the 16% take, and very short prices are not offered',()=>{
    for(let k=0;k<40;k++){const c=newRace(k,seq(100+k));
      for(const r of c.runners)for(const kind of ['win','place','show'] as const){const o=odds(c,kind,[r.no]);if(o===0)continue;expect(chance(c,kind,[r.no])*(1+o)).toBeLessThanOrEqual(1-TAKE+1e-9);}
      const o=odds(c,'exacta',[1,2]);if(o)expect(chance(c,'exacta',[1,2])*(1+o)).toBeLessThanOrEqual(1-TAKE+1e-9);}
    expect(oddsLabel(2.5)).toBe('5/2');expect(oddsLabel(12.3)).toBe('12/1');expect(oddsLabel(.9)).toBe('4/5');
  });
  it('races are won in proportion to the true chances',()=>{
    const c=newRace(1,seq(7)),r=seq(99),wins=new Array(9).fill(0),N=40000;
    for(let i=0;i<N;i++){const o=runRace(c,r);expect(new Set(o).size).toBe(8);wins[o[0]]++;}
    for(const x of c.runners)expect(Math.abs(wins[x.no]/N-x.p)).toBeLessThan(.012);
  });
  it('bets settle on the finishing order; the show matches the order',()=>{
    const c=newRace(2,seq(3)),order=[3,1,2,4,5,6,7,8];
    expect(settleBet({kind:'win',picks:[3],amount:1000},2.5,order)).toBe(3500);expect(settleBet({kind:'place',picks:[1],amount:1000},1.2,order)).toBe(2200);
    expect(settleBet({kind:'show',picks:[4],amount:1000},1,order)).toBe(0);expect(settleBet({kind:'exacta',picks:[3,1],amount:200},14.3,order)).toBe(3060);
    expect(validRaceBet(c,{kind:'exacta',picks:[2,2],amount:100})).toBe(false);
    const p=paths(order,120,seq(5));for(let i=0;i<7;i++)expect(p[order[i]][120]).toBeGreaterThan(p[order[i+1]][120]);expect(p[3][120]).toBe(1);for(const no of order)expect(p[no][0]).toBe(0);
  });
});
