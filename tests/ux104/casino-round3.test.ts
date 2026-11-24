import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

/* Patch 102: sounds for every casino game, "Your rounds", racetrack neighbours 1-4 and Double, craps odds limits,
 * lay bets, Big 6/8, C&E and World, the dice chart, a real baccarat shoe with burn and cut cards, Lucky 6, across
 * the board, paddock notes and quick races. */
let queue:(()=>void)[]=[];const intervals=new Map<number,()=>void>();let ids=0,lastTick=0;
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return ++ids;},clearTimeout:()=>{},setInterval:(f:()=>void,ms:number)=>{const id=++ids;lastTick=ms;intervals.set(id,f);return id;}};
(globalThis as Record<string, unknown>).clearInterval=(id:number)=>{intervals.delete(id);};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {freshTable,addBet,roll,cannotAdd,checkTable,maxOdds,maxLay,POINTS}=await import('../../src/casino/craps');
const {deal,payout,newShoe,dealShoe,checkShoe,cardsLeft,pointOf,CUT_FROM_END}=await import('../../src/casino/baccarat');
const {newRace,odds,paddockNote}=await import('../../src/casino/races');
const {CasinoPlayer,RACE_FRAMES,RACE_MS,QUICK_RACE_MS}=await import('../../src/casino/play');
const {casinoMarkup}=await import('../../src/casino/view');
const {trimRecent,RECENT_KEEP,checkCasino,freshCasino}=await import('../../src/casino/wallet');
const seq=(seed:number)=>{let s=seed>>>0;return (n:number)=>{s=(Math.imul(s^(s>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;s^=s>>>13;return Math.floor((s>>>0)/4294967296*n);};};
const flush=()=>{for(let i=0;i<400&&queue.length;i++)queue.shift()!();};
const runIntervals=()=>{for(let i=0;i<RACE_FRAMES+5&&intervals.size;i++)for(const f of [...intervals.values()])f();};
const sounds:string[]=[];
const player=(seed=1,keep=false)=>{if(!keep)store.clear();queue=[];intervals.clear();return new CasinoPlayer({render(){},sound(k){sounds.push(k);},active:()=>true},seq(seed));};
const DICE=Array.from({length:36},(_,i)=>[1+Math.floor(i/6),1+i%6] as [number,number]);

/** Play a bet until it is decided; returns the expected return per decision over all dice paths. */
function decided(t0:ReturnType<typeof freshTable>,spot:string):number {
 // P(7) vs P(n): resolve by the two deciding totals only, which is exact for lay and Big bets.
 let ev=0,tot=0;
 for(const d of DICE){const r=roll(t0,d),p=r.settled.find(x=>x.spot===spot);if(p){ev+=p.back;tot++;}}
 return ev/tot;
}
describe('craps',()=>{
 it('lay bets pay true odds less 5% of the win: exact edges 1.67%, 2%, 2.27%',()=>{
  const want:Record<number,number>={4:1/60,10:1/60,5:1/50,9:1/50,6:1/44,8:1/44};
  for(const n of POINTS){const t=addBet(freshTable(),`lay${n}` as never,600);expect(1-decided(t,`lay${n}`)/600).toBeCloseTo(want[n],10);}
  // A lay bet works on the come-out and stays up after it wins.
  const t=addBet(freshTable(),'lay4',600),r=roll(t,[3,4]);expect(r.settled[0]).toMatchObject({spot:'lay4',back:885,stays:true});expect(r.restaked).toBe(600);expect(r.table.lay[4]).toBe(600);
  expect(roll(t,[2,2]).table.lay[4]).toBeUndefined();expect(cannotAdd(freshTable(),'lay7' as never,100)).toMatch(/Lay bets/);
 });
 it('Big 6 and Big 8 pay even money: edge 1/11, working on the come-out',()=>{
  for(const s of ['big6','big8'] as const){const t=addBet(freshTable(),s,1100);expect(1-decided(t,s)/1100).toBeCloseTo(1/11,10);}
  const r=roll(addBet(freshTable(),'big6',500),[2,4]);expect(r.settled[0]).toMatchObject({back:1000,stays:true});expect(r.table.big6).toBe(500);
  expect(roll(addBet(freshTable(),'big8',500),[3,4]).table.big8).toBe(0);
 });
 it('10x odds: 10x behind every point; lays to win 10x; old saves load as 3-4-5x',()=>{
  let t:ReturnType<typeof freshTable>={...addBet(freshTable(),'pass',1000),oddsX:'10' as const};t=roll(t,[2,2]).table;
  expect(maxOdds(t)).toBe(10000);expect(cannotAdd(t,'passOdds',10000)).toBeNull();expect(cannotAdd(t,'passOdds',10100)).toMatch(/10x/);
  let d:ReturnType<typeof freshTable>={...addBet(freshTable(),'dontPass',1000),oddsX:'10' as const};d=roll(d,[2,2]).table;expect(maxLay(d)).toBe(20000);
  d={...d,oddsX:'345'};expect(maxLay(d)).toBe(6000);
  const old=JSON.parse(JSON.stringify(freshTable()));delete old.lay;delete old.big6;delete old.big8;delete old.oddsX;
  const back=checkTable(old);expect(back.oddsX).toBe('345');expect(back.lay).toEqual({});expect(back.big6).toBe(0);
  expect(()=>checkTable({...freshTable(),oddsX:'100'})).toThrow();
 });
 it('the odds limit changes only with no odds up; C&E and World place their chips; Big and lay bets go through the controller',()=>{
  const p=player(3);p.setChip(500);p.crapsSpot('pass');p.setOddsX('10');expect(p.craps.oddsX).toBe('10');
  // Roll until a point is set, then take 10x odds.
  for(let i=0;i<40&&!p.craps.point;i++){if(!p.craps.pass)p.crapsSpot('pass');p.rollCraps();flush();}
  expect(p.craps.point).not.toBeNull();p.setChip(2500);p.crapsSpot('passOdds');p.crapsSpot('passOdds');expect(p.craps.passOdds).toBe(5000);
  p.setOddsX('345');expect(p.ui.error).toMatch(/odds down/);expect(p.craps.oddsX).toBe('10');
  p.setChip(100);const before=p.state.balance;p.placeGroup('ce');expect(p.craps.anyCraps).toBe(100);expect(p.craps.yo).toBe(100);
  p.placeGroup('world');expect([p.craps.aces,p.craps.aceDeuce,p.craps.yo,p.craps.twelve,p.craps.any7]).toEqual([100,100,200,100,100]);
  expect(before-p.state.balance).toBe(700);p.crapsSpot('big8');p.crapsSpot('lay10');expect(p.craps.big8).toBe(100);expect(p.craps.lay[10]).toBe(100);
 });
 it('the dice chart compares each total with how often it should come up, from the kept history',()=>{
  const p=player(5);p.setChip(100);
  for(let i=0;i<30;i++){p.crapsSpot('field');p.rollCraps();flush();}
  expect((p.state.boards!.craps as unknown[]).length).toBe(30);
  const m=casinoMarkup(p,'craps');expect(m).toContain('data-testid="dice-chart"');expect(m).toContain('last 30 rolls');expect(m).toContain('expected 16.7%');
  expect(m).toContain('data-odds-x="10"');expect(m).toContain('data-cspot="lay4"');expect(m).toContain('data-cspot="big6"');expect(m).toContain('id="craps-world"');
 });
});

describe('baccarat',()=>{
 it('Lucky 6 pays 12:1 (two cards) and 20:1 (three): exact eight-deck edge 16.68%, and the Banker wins 45.86%',()=>{
  // Every deal by point value, without replacement, through the engine's own deal() and payout().
  const card=['K','A','2','3','4','5','6','7','8','9'].map(r=>r+'s'),counts=[128,32,32,32,32,32,32,32,32,32];let N=416,ev=0,banker=0;
  const seqv:number[]=[];
  const go=(depth:number,w:number)=>{
   if(depth===6){const coup=deal(seqv.map(v=>card[v]));const back=payout(coup,{lucky6:1}).returned;ev+=w*back;if(coup.winner==='banker')banker+=w;return;}
   for(let v=0;v<10;v++){if(!counts[v])continue;const ww=w*counts[v]/N;counts[v]--;N--;seqv.push(v);go(depth+1,ww);seqv.pop();counts[v]++;N++;}
  };
  go(0,1);
  expect(1-ev).toBeCloseTo(0.166836,5);expect(banker).toBeCloseTo(0.458597,5);
  // Two- and three-card Banker sixes.
  expect(payout(deal(['Ks','3s','Ks','3s','Ks','Ks']),{lucky6:100}).returned).toBe(1300);// Player 0 draws a 0; Banker 3+3 stands
  expect(payout(deal(['3s','3s','3s','3s','Ks','Ks']),{lucky6:100}).returned).toBe(0);// 6 all: a tie, not a Banker win
  expect(payout(deal(['Ks','Ks','Ks','2s','Ks','4s']),{lucky6:100}).returned).toBe(2100);
 });
 it('a fresh shoe burns by its first card, the cut card sits 14 from the end, and one more hand follows it',()=>{
  for(let s=1;s<20;s++){const sh=newShoe(seq(s));const v=pointOf(sh.cards[0])||10;expect(sh.next).toBe(1+v);expect(sh.burned.length).toBe(1+v);expect(sh.cut).toBe(416-CUT_FROM_END);}
  let sh=newShoe(seq(9)),hands=0;
  while(!sh.cutOut){sh=dealShoe(sh).shoe;hands++;expect(sh.last).toBe(false);}
  expect(cardsLeft(sh)).toBeLessThanOrEqual(CUT_FROM_END);const one=dealShoe(sh).shoe;expect(one.last).toBe(true);expect(hands).toBeGreaterThan(60);
  expect(()=>checkShoe({...sh,next:-1})).toThrow();expect(()=>checkShoe({...sh,cards:sh.cards.slice(1)})).toThrow();expect(checkShoe(JSON.parse(JSON.stringify(sh))).next).toBe(sh.next);
 });
 it('the table plays through the shoe, keeps it between visits, and starts fresh roads after the shuffle',()=>{
  const p=player(11);p.setChip(100);p.placeBaccarat('lucky6');p.dealBaccarat();flush();
  const first=p.shoe();expect(first.number).toBe(1);
  const q=player(99,true);expect(q.shoe().next).toBe(first.next);expect(q.shoe().cards.join()).toBe(first.cards.join());
  let shuffledAt=-1,roadBefore=0;
  for(let i=0;i<200&&shuffledAt<0;i++){p.placeBaccarat('player');roadBefore=(p.state.boards!.baccarat as unknown[]).length;p.dealBaccarat();flush();if(p.ui.baccarat.shuffled)shuffledAt=i;}
  expect(shuffledAt).toBeGreaterThan(0);expect(p.shoe().number).toBe(2);expect(roadBefore).toBeGreaterThan(40);expect((p.state.boards!.baccarat as unknown[]).length).toBe(1);
  const m=casinoMarkup(p,'baccarat');expect(m).toContain('Shoe 2');expect(m).toContain('New shoe. Burn card');expect(m).toContain('data-bspot="lucky6"');
  p.shuffleShoe();expect(p.shoe().number).toBe(3);expect((p.state.boards!.baccarat as unknown[]).length).toBe(0);
 });
});

describe('roulette',()=>{
 it('neighbours go 1 to 4 each side; Double doubles the layout, or the last spin',()=>{
  const p=player(2);p.setChip(100);p.setWidth(4);p.placeNeighbours(0);expect(p.ui.roulette.bets.length).toBe(9);
  expect(new Set(p.ui.roulette.bets.map(b=>b.numbers[0]))).toEqual(new Set([12,35,3,26,0,32,15,19,4]));
  p.setWidth(9);expect(p.ui.roulette.width).toBe(4);p.setWidth(1);p.clearRoulette();p.placeNeighbours(17);expect(p.ui.roulette.bets.length).toBe(3);
  p.doubleRoulette();expect(p.ui.roulette.bets.every(b=>b.amount===200)).toBe(true);
  p.spinRoulette();flush();expect(p.ui.roulette.bets.length).toBe(0);p.doubleRoulette();expect(p.ui.roulette.bets.map(b=>b.amount)).toEqual([400,400,400]);
  const big={...p.state,balance:1000};p.state=big;p.ui.roulette.bets=[{kind:'straight',numbers:[1],amount:800}];p.doubleRoulette();expect(p.ui.error).toMatch(/Doubling needs/);
  const m=casinoMarkup(player(2),'roulette');expect(m).toContain('data-rt-width="4"');expect(m).toContain('id="roulette-double"');
 });
});

describe('races',()=>{
 it('across the board puts one chip each on Win, Place and Show',()=>{
  const p=player(4);p.setChip(500);p.setRaceKind('atb');const no=p.ui.races.card.runners.find(r=>!r.scratched&&odds(p.ui.races.card,'show',[r.no]))!.no;
  p.pickRunner(no);expect(p.ui.races.bets.map(b=>b.kind)).toEqual(['win','place','show']);expect(p.pending('races')).toBe(1500);
  p.pickRunner(no);expect(p.ui.races.bets.every(b=>b.amount===1000)).toBe(true);
  expect(casinoMarkup(p,'races')).toContain('data-race-kind="atb"');
 });
 it('paddock notes are fixed for each race, blank for a scratched horse, and lean with the horse’s chance',()=>{
  let keen=0,sour=0,strong=0,weak=0;
  for(let s=1;s<400;s++){const c=newRace(1,seq(s));
   for(const r of c.runners){const a=paddockNote(c,r.no);expect(paddockNote(c,r.no)).toBe(a);if(r.scratched){expect(a).toBe('');continue;}expect(a.length).toBeGreaterThan(5);
    const rank=[...c.runners.filter(x=>!x.scratched)].sort((x,y)=>y.p-x.p).findIndex(x=>x.no===r.no);
    if(rank===0){strong++;if(/toes|fit and ready|Blinkers|Dropping|Top rider|bullet/.test(a))keen++;}
    if(rank>=6){weak++;if(/Sweating|Fractious|Moving up|dull|Kicked|poor run/.test(a))sour++;}}}
  expect(keen/strong).toBeGreaterThan(.5);expect(sour/weak).toBeGreaterThan(.5);
 });
 it('a quick race runs in 7 seconds instead of 14, with the bugle at the start and the crowd in the stretch',()=>{
  const p=player(6);p.setChip(500);const no=p.ui.races.card.runners.find(r=>!r.scratched)!.no;p.pickRunner(no);
  sounds.length=0;p.setQuick(true);p.startRace();expect(lastTick).toBeCloseTo(QUICK_RACE_MS/RACE_FRAMES,6);expect(sounds[0]).toBe('bugle');runIntervals();flush();
  expect(sounds).toContain('crowd');expect(p.ui.races.phase).toBe('done');
  p.nextRace();p.setQuick(false);p.pickRunner(p.ui.races.card.runners.find(r=>!r.scratched)!.no);p.startRace();expect(lastTick).toBeCloseTo(RACE_MS/RACE_FRAMES,6);
 });
});

describe('your rounds, and sounds',()=>{
 it('each table lists your last 25 rounds with what you bet and how it came out, and your net this visit',()=>{
  const p=player(8);p.setChip(100);
  for(let i=0;i<30;i++){p.placeRoulette('red',[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);p.spinRoulette();flush();}
  const mine=p.state.recent.filter(r=>r.game==='roulette');expect(mine.length).toBe(30);expect(mine.at(-1)!.bet).toBe('Red');expect(mine.at(-1)!.result).toMatch(/^\d+ (red|black|green)$/);
  const net=mine.reduce((a,r)=>a+r.returned-r.wagered,0);expect(p.ui.session.roulette).toBe(net);
  const m=casinoMarkup(p,'roulette');expect(m).toContain('data-testid="rounds-roulette"');expect((m.match(/<li class="(up|down|even)"><span>Red</g)??[]).length).toBe(25);expect(m).toContain('last 25');
  expect(casinoMarkup(p,'craps')).not.toContain('data-testid="rounds-craps"');
 });
 it('the round list keeps 60 per game, so a long craps session never pushes out the other games',()=>{
  const list=[...Array.from({length:5},()=>({game:'roulette' as const})),...Array.from({length:90},()=>({game:'craps' as const}))];
  const kept=trimRecent(list);expect(kept.filter(r=>r.game==='craps').length).toBe(RECENT_KEEP);expect(kept.filter(r=>r.game==='roulette').length).toBe(5);
  const s={...freshCasino(),recent:list.map(r=>({...r,wagered:1,returned:0,at:'x'}))};expect(checkCasino(s).recent.length).toBe(65);
 });
 it('every casino sound has a voice, and every sound the tables ask for is mapped',async()=>{
  const {CASINO_KINDS}=await import('../../src/ui/sounds');const src=readFileSync('src/ui/sounds.ts','utf8'),app=readFileSync('src/ui/app.ts','utf8'),play=readFileSync('src/casino/play.ts','utf8');
  for(const k of CASINO_KINDS)expect(src).toContain(`case '${k}':`);
  const map=app.match(/const CASINO_SOUNDS[^\n]*/)![0];
  for(const k of new Set([...play.matchAll(/deps\.sound\('([a-z]+)'\)/g)].map(m=>m[1])))expect(map).toContain(`${k}: '`);
  for(const k of ['money','win','fold','flip'])expect(map).toContain(`${k}: '`);
 });
});
