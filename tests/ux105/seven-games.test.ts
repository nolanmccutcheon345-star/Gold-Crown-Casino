import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {BlackjackView} from '../../src/blackjack/view-model';

/* Patch 103: the odds helper (poker), dealer odds and the strategy card (blackjack), favourites and sorting (slots),
 * named roulette bets, craps bets working on the come-out, the Dragon Bonus (baccarat), and the Superfecta and box
 * bets (races). */
let queue:(()=>void)[]=[];
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return queue.length;},clearTimeout:()=>{},setInterval:()=>0};
(globalThis as Record<string, unknown>).clearInterval=()=>{};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {oddsHelp,oddsHelperMarkup,boardCategory}=await import('../../src/ui/odds-helper');
const {dealerOdds}=await import('../../src/blackjack/dealer-odds');
const {handAids}=await import('../../src/blackjack/screens');
const {BLACKJACK_TABLES}=await import('../../src/blackjack/presets');
const {ORDER,resolve,validBet,specialBets,SPECIALS}=await import('../../src/casino/roulette');
const {freshTable,addBet,roll,checkTable}=await import('../../src/casino/craps');
const {deal,payout,dragonBonus}=await import('../../src/casino/baccarat');
const {newRace,chance,odds,settleBet,boxBets,TAKE}=await import('../../src/casino/races');
const {CasinoPlayer}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const player=(seed=1)=>{store.clear();queue=[];return new CasinoPlayer({render(){},sound(){},active:()=>true},seq(seed));};
const DICE=Array.from({length:36},(_,i)=>[1+Math.floor(i/6),1+i%6] as [number,number]);

describe('poker: the odds helper',()=>{
 it('counts a flush draw with overcards exactly: 15 outs, 15/47 next card, 585/1081 by the river',()=>{
  const h=oddsHelp(['Ah','Kh'],['7h','2h','9c'],0,300)!;
  expect(h.hand).toMatch(/high/i);expect(h.outs).toBe(15);expect(h.unseen).toBe(47);expect(h.next).toBeCloseTo(15/47,12);expect(h.river).toBeCloseTo(585/1081,12);
  expect(h.byMake).toEqual([{make:'a flush',cards:9},{make:'a pair',cards:6}]);expect(h.price).toBeNull();
 });
 it('a board that pairs does not count as improving your pair: 88 on K-7-2 has just the two eights',()=>{
  const h=oddsHelp(['8s','8d'],['Kc','7h','2s'],0,100)!;expect(h.hand).toBe('Pair of eights');expect(h.outs).toBe(2);expect(h.byMake).toEqual([{make:'three of a kind',cards:2}]);
  expect(boardCategory(['Kc','Kh','2s'])).toBe(1);expect(boardCategory(['Kc','Kh','2s','2d'])).toBe(2);expect(boardCategory(['Kc','Kh','Ks','2d'])).toBe(6-3);
 });
 it('prices a call: call 20 into 45 needs 20/65; preflop shows only the price; the river shows no outs',()=>{
  const pre=oddsHelp(['As','Qd'],[],20,45)!;expect(pre.hand).toBeNull();expect(pre.next).toBeNull();expect(pre.price!.need).toBeCloseTo(20/65,12);
  const river=oddsHelp(['As','Qd'],['Ac','7h','2s','9d','3c'],50,150)!;expect(river.hand).toBe('Pair of aces');expect(river.next).toBeNull();expect(river.price!.need).toBe(.25);
  const m=oddsHelperMarkup(river,n=>`$${n/100}`);expect(m).toContain('data-testid="odds-helper"');expect(m).toContain('25%');expect(m).toContain('Improving is not the same as winning');
  expect(oddsHelp(['As','As'],[],0,0)).toBeNull();
 });
 it('is wired into cash and tournament tables, off until switched on, and reads only Hero’s cards',()=>{
  const app=readFileSync('src/ui/app.ts','utf8'),t=readFileSync('src/ui/tournament-play.ts','utf8'),src=readFileSync('src/ui/odds-helper.ts','utf8');
  expect(app).toContain("localStorage.getItem(ODDS_HELPER_KEY) === 'on'");expect(app).toContain('oddsPanel(hero.hole, shown.board');expect(app).toContain("oddsHelper:(()=>{const g=c.data.active.game,h=g.seats.find(x=>x.id===0)");
  expect(t).toContain("${options.oddsHelper??''}");expect([...src.matchAll(/^import .* from '([^']+)'/gm)].map(m=>m[1])).toEqual(['../contracts','../core/evaluator']);
 });
});

describe('blackjack: dealer odds and the strategy card',()=>{
 it('dealer bust chances match the standard infinite-deck figures (dealer stands on soft 17)',()=>{
  // A second, separate count: walk every sequence of dealer cards (aces counted as 1, upgraded at the end).
  const walk=(cards:number[],h17:boolean,w:number,out:{bust:number}):void=>{const hard=cards.reduce((a,c)=>a+c,0),soft=cards.includes(1)&&hard+10<=21,t=soft?hard+10:hard;
   if(t>21){out.bust+=w;return;}if(t>17||(t===17&&!(soft&&h17)))return;for(let v=1;v<=10;v++)walk([...cards,v],h17,w*(v===10?4/13:1/13),out);};
  for(const h17 of [false,true])for(let u=2;u<=9;u++){const o={bust:0};walk([u],h17,1,o);expect(dealerOdds(u,h17).bust).toBeCloseTo(o.bust,12);const d=dealerOdds(u,h17);expect(d.bust+Object.values(d.final).reduce((a,x)=>a+x,0)).toBeCloseTo(1,12);}
  // Well-known landmarks: a 6 busts most often (about 42% standing on soft 17), a 9 under 23%.
  expect(dealerOdds(6,false).bust).toBeCloseTo(.4232,4);expect(dealerOdds(2,false).bust).toBeCloseTo(.3536,4);expect(dealerOdds(9,false).bust).toBeLessThan(.23);
  expect(dealerOdds(6,true).bust).toBeGreaterThan(dealerOdds(6,false).bust);
  // After the dealer has checked, an ace can no longer hide a ten.
  expect(dealerOdds(1,false,true).final[21]).toBeLessThan(dealerOdds(1,false,false).final[21]);
 });
 it('shows the bust line on your turn and, with the coach on, your strategy row with the dealer card marked',()=>{
  const table=BLACKJACK_TABLES.find(t=>t.variant==='classic')!;
  const view={phase:'player',table,dealer:{cards:['6s',null],total:6,soft:false},hands:[{cards:['Ts','6h'],total:16,soft:false}],activeHand:0,legal:{actions:['hit','stand','double']}} as unknown as BlackjackView;
  const off=handAids(view,false);expect(off).toContain('data-testid="dealer-odds"');expect(off).toContain('Dealer shows a 6');expect(off).not.toContain('strategy-card');
  const on=handAids(view,true);expect(on).toContain('data-testid="strategy-card"');expect(on).toMatch(/Hard 16<\/b> against a 6: <b>Stand<\/b>/);expect((on.match(/class="bj-sc-[a-z]+ here"/g)??[]).length).toBe(1);
  const pair={...view,dealer:{cards:['8d',null]},hands:[{cards:['8s','8h'],total:16,soft:false}],legal:{actions:['hit','stand','double','split']}} as unknown as BlackjackView;expect(handAids(pair,true)).toMatch(/8,8<\/b> against a 8: <b>Split/);
  const three={...view,dealer:{cards:['5d',null]},hands:[{cards:['3s','4h','4d'],total:11,soft:false}],legal:{actions:['hit','stand']}} as unknown as BlackjackView;expect(handAids(three,true)).toMatch(/Hit<\/b> <small>\(double is not allowed now\)/);
  const free=BLACKJACK_TABLES.find(t=>t.variant==='free-bet');if(free)expect(handAids({...view,table:free},true)).toBe('');
  expect(handAids({...view,phase:'settled'},true)).toBe('');
 });
});

describe('slots: favourites and sorting',()=>{
 it('stars machines, keeps them on this device, and sorts the floor',async()=>{
  const {MACHINES}=await import('../../src/slots/machines');const {sortMachines,freshSlotsUi,slotsMarkup}=await import('../../src/slots/view');
  const {SlotsPlayer}=await import('../../src/slots/play');const {freshSlots}=await import('../../src/slots/state');
  store.clear();const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,{render(){},sound(){},active:()=>true,motion:()=>false});
  p.toggleFav(MACHINES[2].id);p.toggleFav(MACHINES[0].id);p.toggleFav('no-such');expect(ui.favs).toEqual([MACHINES[2].id,MACHINES[0].id]);p.toggleFav(MACHINES[2].id);expect(ui.favs).toEqual([MACHINES[0].id]);
  p.setSort('payback');p.setSort('bogus');expect(ui.sort).toBe('payback');
  const ui2=freshSlotsUi();new SlotsPlayer(freshSlots(),ui2,{render(){},sound(){},active:()=>true,motion:()=>false});expect(ui2.favs).toEqual([MACHINES[0].id]);expect(ui2.sort).toBe('payback');
  const byPay=sortMachines(MACHINES,'payback',freshSlots());for(let i=1;i<byPay.length;i++)expect(byPay[i-1].rtp).toBeGreaterThanOrEqual(byPay[i].rtp);
  const calm=sortMachines(MACHINES,'calm',freshSlots());for(let i=1;i<calm.length;i++)expect(calm[i-1].stats.swing).toBeLessThanOrEqual(calm[i].stats.swing);
  const s={...freshSlots(),machines:{[MACHINES[3].id]:{spins:9,wagered:1,won:0,biggest:0,features:0}}};expect(sortMachines(MACHINES,'played',s)[0].id).toBe(MACHINES[3].id);
  expect(sortMachines(MACHINES,'floor',s).map((m)=>m.id)).toEqual(MACHINES.map(m=>m.id));
  if(slotsMarkup){ui.floor='fav';const m=slotsMarkup(freshSlots(),ui);expect(m).toContain('data-slot-fav');expect(m).toContain('★ Favourites (1)');}
 });
});

describe('roulette: named bets',()=>{
 it('the Snake and the red and black splits are real layout bets on both wheels with the usual edge',()=>{
  for(const k of ['snake','redSplits','blackSplits'] as const){const bets=specialBets(k,100);
   for(const w of ['european','american'] as const){expect(bets.every(b=>validBet(b,w))).toBe(true);const o=ORDER[w];const back=o.reduce((a,p)=>a+resolve(bets,p).returned,0)/o.length,stake=bets.length*100;expect(1-back/stake).toBeCloseTo(w==='european'?1/37:2/38,10);}}
  expect(SPECIALS.snake.pieces.flatMap(p=>p.numbers)).toEqual([1,5,9,12,14,16,19,23,27,30,32,34]);
  const p=player(2);p.setChip(100);p.setWheel('american');p.placeSpecial('blackSplits');expect(p.ui.roulette.bets.length).toBe(7);expect(p.ui.error).toBe('');
  expect(casinoMarkup(p,'roulette')).toContain('data-special="snake"');
 });
});

describe('craps: working on the come-out',()=>{
 it('place, buy and hardway bets and come odds act on the come-out only when called working',()=>{
  const base=addBet(addBet(addBet(freshTable(),'place6',600),'hard8',500),'buy4',2000);
  expect(roll(base,[2,4]).settled.find(x=>x.spot==='place6')).toBeUndefined();
  const w={...base,working:true};expect(roll(w,[2,4]).settled.find(x=>x.spot==='place6')).toMatchObject({back:1300,stays:true});
  expect(roll(w,[4,4]).settled.find(x=>x.spot==='hard8')).toMatchObject({back:5000});expect(roll(w,[2,2]).settled.find(x=>x.spot==='buy4')!.back).toBe(2000+4000-100);
  const seven=roll(w,[3,4]);expect(seven.settled.filter(x=>x.back===0).map(x=>x.spot).sort()).toEqual(['buy4','hard8','place6']);
  const come={...freshTable(),point:null,comeOn:{6:500},comeOdds:{6:500}};expect(roll(come,[3,4]).settled.find(x=>x.spot==='comeOdds6')!.back).toBe(500);
  expect(roll({...come,working:true},[3,4]).settled.find(x=>x.spot==='comeOdds6')!.back).toBe(0);
  expect(roll({...come,working:true},[3,3]).settled.find(x=>x.spot==='comeOdds6')!.back).toBe(1100);
  const old=JSON.parse(JSON.stringify(freshTable()));delete old.working;expect(checkTable(old).working).toBe(false);expect(()=>checkTable({...freshTable(),working:'yes'})).toThrow();
  const p=player(4);p.setWorking(true);expect(p.craps.working).toBe(true);expect(casinoMarkup(p,'craps')).toContain('id="craps-working" checked');
 });
 it('working bets keep their usual edges (place 6 is still 1/66 per decision)',()=>{
  const t={...addBet(freshTable(),'place6',600),working:true};let ev=0,n=0;for(const d of DICE){const r=roll(t,d),s=r.settled.find(x=>x.spot==='place6');if(s){ev+=s.back;n++;}}
  expect(1-ev/n/600).toBeCloseTo(1/66,10);
 });
});

describe('baccarat: the Dragon Bonus',()=>{
 it('exact eight-deck edges through the game’s own dealing: Player 2.65%, Banker 9.37%',()=>{
  const card=['K','A','2','3','4','5','6','7','8','9'].map(r=>r+'s'),counts=[128,32,32,32,32,32,32,32,32,32];let N=416,evP=0,evB=0;const s:number[]=[];
  const go=(d:number,w:number)=>{if(d===6){const c=deal(s.map(v=>card[v])),r=payout(c,{dragonP:1,dragonB:1}).bySpot;evP+=w*(r.dragonP!-1);evB+=w*(r.dragonB!-1);return;}
   for(let v=0;v<10;v++){if(!counts[v])continue;const ww=w*counts[v]/N;counts[v]--;N--;s.push(v);go(d+1,ww);s.pop();counts[v]++;N++;}};
  go(0,1);expect(-evP).toBeCloseTo(.026517,5);expect(-evB).toBeCloseTo(.093731,5);
 });
 it('pays by the margin, 1:1 on a natural win, and pushes a natural tie',()=>{
  expect(dragonBonus(deal(['9s','Ks','Ks','Ks','Ks','Ks']),'player')).toBe(1);// natural 9 over 0
  expect(dragonBonus(deal(['9s','9d','Ks','Ks','Ks','Ks']),'player')).toBe(0);// 9-9 natural tie
  expect(dragonBonus(deal(['Ks','Ks','Ks','Ks','Ks','Ks']),'player')).toBe(-1);// 0-0 tie, not natural
  const c=deal(['Ks','5s','Ks','Ks','9s','Ks']);expect(c.playerTotal-c.bankerTotal).toBe(4);expect(dragonBonus(c,'player')).toBe(1);expect(dragonBonus(c,'banker')).toBe(-1);
  expect(casinoMarkup(player(3),'baccarat')).toContain('data-bspot="dragonB"');
 });
});

describe('races: Superfecta and boxes',()=>{
 it('the Superfecta chances over every order of four add up to 1, and its odds keep the take',()=>{
  const c=newRace(1,seq(5)),live=c.runners.filter(r=>!r.scratched).map(r=>r.no);let sum=0;
  for(const a of live)for(const b of live)for(const x of live)for(const y of live)if(new Set([a,b,x,y]).size===4){const p=chance(c,'superfecta',[a,b,x,y]);sum+=p;const o=odds(c,'superfecta',[a,b,x,y]);if(o)expect((o+1)*p).toBeLessThanOrEqual(1-TAKE+1e-12);}
  expect(sum).toBeCloseTo(1,10);
  expect(settleBet({kind:'superfecta',picks:[3,1,4,2],amount:100},20,[3,1,4,2,5])).toBe(2100);expect(settleBet({kind:'superfecta',picks:[3,1,4,2],amount:100},20,[3,1,2,4])).toBe(0);
 });
 it('a box puts every order in, one chip each',()=>{
  expect(boxBets('exacta',[1,2],100).map(b=>b.picks.join())).toEqual(['1,2','2,1']);expect(boxBets('trifecta',[1,2,3],100).length).toBe(6);expect(boxBets('superfecta',[1,2,3,4],100).length).toBe(24);
  expect(()=>boxBets('win',[1],100)).toThrow();expect(()=>boxBets('trifecta',[1,1,2],100)).toThrow();
  const p=player(7);p.setChip(100);p.setRaceKind('trifecta');p.setBox(true);const live=p.ui.races.card.runners.filter(r=>!r.scratched).slice(0,3);
  for(const r of live)p.pickRunner(r.no);expect(p.ui.races.bets.length).toBe(6);expect(new Set(p.ui.races.bets.map(b=>b.picks.join())).size).toBe(6);expect(p.pending('races')).toBe(600);
  const m=casinoMarkup(p,'races');expect(m).toContain('id="race-box" checked');expect(m).toContain('data-race-kind="superfecta"');
 });
});
