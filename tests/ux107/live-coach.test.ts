import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GameState,RuleProfile,Action,Card,HeroViewModel} from '../../src/contracts';
import {startHand,applyCommand,projectView,legalActions} from '../../src/core/engine';

/* Patch 105: the Live coach for Hold'em. It recommends a play and a size and explains it in R-O-R-A-F order
 * (Ranges, Objective, Responses, Alternatives, Future), with every number labelled exact, estimate, pool or rule
 * (Patch 106 adds a fifth label, measured: see tests/ux108).
 * Display only; it reads only Hero's cards and public information. */
const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {ORDER,percentile,inTop,openWidth,topHands,shoveWidth,valueThreeBet,bluffThreeBet}=await import('../../src/coach/ranges');
const {advise,readHand,texture,beatsShare,equityVsTop,equityVsHands,POOL}=await import('../../src/coach/coach');
const {LESSONS,NOTECARDS,OVERLAYS}=await import('../../src/coach/lessons');
const {coachMarkup,freshCoachUi,reviewAction,saveCoachUi,COACH_KEY}=await import('../../src/coach/view');

const cash:RuleProfile={id:'c',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:100,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const tourney:RuleProfile={id:'t',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const money=(n:number)=>`$${(n/100).toFixed(n%100?2:0)}`;
let ids=0;
const start=(button:number,stack=20000,n=6,profile=cash)=>startHand({handId:`h${++ids}`,button,profile,seats:Array.from({length:n},(_,i)=>({id:i,name:i?`P${i}`:'You',stack}))});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
/** Play the listed actions (the seats in turn), stopping with Hero to act. */
const play=(s:GameState,actions:(Action|'f'|'c'|'x'|number)[])=>{for(const a of actions){if(s.actor===0)throw new Error('Hero is to act before the script ended');s=act(s,a==='f'?{type:'fold'}:a==='c'?{type:'call'}:a==='x'?{type:'check'}:typeof a==='number'?{type:'raise',to:a}:a);}if(s.actor!==0)throw new Error(`Hero is not to act (actor ${s.actor}, ${s.street})`);return s;};
const heroActs=(s:GameState,a:Action|'c'|'x'|number)=>act(s,a==='c'?{type:'call'}:a==='x'?{type:'check'}:typeof a==='number'?{type:'raise',to:a}:a);
const see=(s:GameState,hole:Card[],board?:Card[]):HeroViewModel=>{const v=structuredClone(projectView(s,0));v.seats.find(x=>x.id===0)!.hole=hole;if(board)v.board=board;return v;};
const coach=(v:HeroViewModel,mode:'cash'|'tournament'='cash')=>advise(v,{mode,money})!;
// Seats with the button on 0: Hero BTN, 1 SB, 2 BB, 3 LJ (first to act six-handed), 4 HJ, 5 CO.

describe('ranges',()=>{
 it('orders all 169 starting hands, and seats open wider toward the button',()=>{
  expect(ORDER.length).toBe(169);expect(new Set(ORDER.map(h=>h.key)).size).toBe(169);expect(ORDER.reduce((a,h)=>a+h.combos,0)).toBe(1326);
  expect(ORDER[0].key).toBe('AA');expect(percentile('AA')).toBeCloseTo(6/1326,10);expect(percentile(ORDER.at(-1)!.key)).toBe(1);expect(percentile('72o')).toBeGreaterThan(.95);
  const seats=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN'];for(let i=1;i<seats.length;i++)expect(openWidth(seats[i])).toBeGreaterThanOrEqual(openWidth(seats[i-1]));
  // The widths follow the playbook's live full-ring bands (UTG about 7–10%, CO 23–34%, BTN 40–58%).
  expect(openWidth('UTG')).toBeLessThanOrEqual(.101);expect(openWidth('CO')).toBeGreaterThanOrEqual(.23);expect(openWidth('CO')).toBeLessThanOrEqual(.34);expect(openWidth('BTN')).toBeGreaterThanOrEqual(.40);expect(openWidth('BTN')).toBeLessThanOrEqual(.58);
  const utg=topHands(openWidth('UTG'));for(const k of ['AA','77','AKo','AQs','KQs','JTs'])expect(utg).toContain(k);for(const k of ['KJo','A2s','54s','22'])expect(utg).not.toContain(k);
  expect(inTop('K9o',openWidth('BTN'))).toBe(true);expect(inTop('K9o',openWidth('HJ'))).toBe(false);
  expect(shoveWidth('BTN',6)).toBeGreaterThan(shoveWidth('BTN',10));expect(shoveWidth('BTN',10)).toBeGreaterThan(shoveWidth('UTG',10));
  expect(valueThreeBet('QQ',.10)).toBe(true);expect(valueThreeBet('JJ',.10)).toBe(false);expect(valueThreeBet('JJ',.27)).toBe(true);expect(bluffThreeBet('A5s',.43)).toBe(true);expect(bluffThreeBet('A5s',.15)).toBe(false);
 });
});

describe('before the flop',()=>{
 it('first in: raises three big blinds inside the seat’s range and folds outside it',()=>{
  const lj=start(3);// Hero is first to act.
  const aa=coach(see(lj,['As','Ad']));expect(aa.action).toBe('raise');expect(aa.to).toBe(600);expect(aa.headline).toBe('Raise to $6 (3 big blinds)');expect(aa.card.id).toBe('C06');expect(aa.overlay.id).toBe('C10');
  expect(coach(see(lj,['7h','2c'])).action).toBe('fold');expect(coach(see(lj,['Qd','7d'])).action).toBe('fold');
  const btn=play(start(0),['f','f','f']);expect(coach(see(btn,['Qd','7d'])).action).toBe('raise');
  const why=coach(see(lj,['Qd','7d'])).why;expect(why.ranges).toMatch(/top 15%/);expect(why.alternatives).toMatch(/Limping/);
 });
 it('limpers: isolates with four big blinds plus one per limper, overlimps small pairs, and checks the big blind',()=>{
  const two=play(start(0),['c','c','f']);// LJ and HJ limp, CO folds, Hero on the button.
  const iso=coach(see(two,['Ah','Qc']));expect(iso.action).toBe('raise');expect(iso.to).toBe(1200);expect(iso.lesson.id).toBe('iso-raise');
  const over=coach(see(two,['7h','6h']));expect(over.action).toBe('call');expect(over.why.objective).toMatch(/Implied odds/);
  expect(coach(see(two,['9h','4c'])).action).toBe('fold');
  const bb=play(start(4),['c','f','f','f','c']);// Hero is the big blind; a limp and the small blind completes.
  const chk=coach(see(bb,['7h','2c']));expect(chk.action).toBe('check');expect(chk.headline).toBe('Check');
  const big=coach(see(bb,['As','Ks']));expect(big.action).toBe('raise');expect(big.to).toBe(200*(4+2+1));
 });
 it('facing a raise: re-raises three times in position and four times out of position, set-mines only with deep stacks',()=>{
  const ip=play(start(0),[600,'f','f']);
  const qq=coach(see(ip,['Qs','Qd']));expect(qq.action).toBe('raise');expect(qq.to).toBe(1800);expect(qq.lesson.id).toBe('three-bet-value');expect(qq.numbers.find(n=>n.basis==='pool')!.value).toBe('34%');
  const sb=play(start(5),[600,'f','f','f']);const oop=coach(see(sb,['Qs','Qd']));expect(oop.to).toBe(2400);
  const fives=coach(see(ip,['5s','5d']));expect(fives.action).toBe('call');expect(fives.lesson.id).toBe('set-mining');
  const shallow=play(start(0,7000),[600,'f','f']);expect(coach(see(shallow,['5s','5d'])).action).toBe('fold');
  expect(coach(see(ip,['Ah','Tc'])).action).toBe('fold');expect(coach(see(ip,['Ah','Tc'])).why.ranges).toMatch(/dominated/);
  const blind=play(start(4),['f','f','f',500,'f']);// The button raises; Hero defends the big blind.
  const d=coach(see(blind,['8h','7h']));expect(d.action).toBe('call');expect(d.lesson.id).toBe('blind-defense');expect(d.numbers[0].value).toMatch(/you need \d+%/);
  expect(coach(see(blind,['9h','3c'])).action).toBe('fold');
  const sbFold=coach(see(sb,['Kh','Tc']));expect(sbFold.action).toBe('fold');expect(sbFold.lesson.id).toBe('sb-play');
 });
 it('facing a re-raise and a fourth raise: only the top of the range continues',()=>{
  let s=play(start(1),['f','f']);s=play(heroActs(s,600),[1800,'f','f']);// Hero opens the cutoff; the button re-raises.
  expect(coach(see(s,['Ah','Jc'])).action).toBe('fold');expect(coach(see(s,['Ah','Jc'])).lesson.id).toBe('facing-3bet');
  const kk=coach(see(s,['Ks','Kd']));expect(kk.action).toBe('raise');expect(kk.to).toBe(4700);expect(kk.lesson.id).toBe('four-bet');
  expect(coach(see(s,['Js','Jd'])).action).toBe('call');
  const four=play(start(4),[600,1800,4400,'f','f']);// Raise, re-raise, and a fourth raise before Hero in the big blind.
  const aa=coach(see(four,['As','Ad']));expect(aa.action).toBe('all-in');expect(aa.to).toBe(20000);
  const tt=coach(see(four,['Ts','Td']));expect(tt.action).toBe('fold');expect(tt.numbers.some(n=>n.basis==='estimate'&&/QQ\+, AK/.test(n.label))).toBe(true);
 });
 it('short stacks shove or fold, and an all-in is called on price alone',()=>{
  const short=play(start(0,2000,6,tourney),['f','f','f']);
  const shove=coach(see(short,['Ah','8c']),'tournament');expect(shove.action).toBe('all-in');expect(shove.lesson.id).toBe('push-fold');expect(shove.to).toBe(legalActions(short).maxRaiseTo);
  const first=start(3,2000,6,tourney);expect(coach(see(first,['7h','6h']),'tournament').action).toBe('fold');
  const jam=play(start(0,2000),[2000,'f','f']);// A ten-big-blind stack shoves; Hero on the button.
  const call=coach(see(jam,['As','Ks']));expect(call.action).toBe('call');expect(call.lesson.id).toBe('all-in-math');expect(call.numbers.some(n=>n.basis==='estimate')).toBe(true);
  expect(coach(see(jam,['9s','4d'])).action).toBe('fold');
 });
});

describe('after the flop',()=>{
 // Hero on the button calls a raise from the first seat, heads-up to the flop.
 const toFlop=(pre:(Action|'f'|'c'|'x'|number)[],heroPre:Action|'c'|'x'|number,after:(Action|'f'|'c'|'x'|number)[],button=0,stack=20000)=>play(heroActs(play(start(button,stack),pre),heroPre),after);
 it('counts a flush draw exactly and calls on implied odds; folds it when the stacks cannot pay',()=>{
  const s=toFlop([600,'f','f'],'c',['f','f',800]);// Pot 1,500 on the flop; the raiser bets 800.
  const v=see(s,['Ks','Qs'],['As','7s','2d']),a=coach(v);
  expect(a.action).toBe('call');expect(a.lesson.id).toBe('implied-odds');expect(a.numbers[0].value).toBe('$8 to win $23: you need 26%');expect(a.numbers[0].basis).toBe('exact');
  expect(a.numbers.find(n=>/complete your draw/.test(n.label))!.value).toBe('9 (19% on the next card)');expect(a.card.id).toBe('C05');expect(a.overlay.id).toBe('C11');
  const hand=readHand(['Ks','Qs'],['As','7s','2d']);expect(hand.job).toBe('strong draw');expect(hand.drawOuts).toBe(9);
  // A gutshot (four outs) facing the same bet with little behind: the price is wrong and nothing can make it up.
  const tiny=toFlop([600,'f','f'],'c',['f','f',800],0,2400),gut=coach(see(tiny,['6h','5h'],['As','9c','8d']));
  expect(gut.action).toBe('fold');expect(gut.numbers.find(n=>/complete your draw/.test(n.label))!.value).toBe('4 (9% on the next card)');expect(gut.why.alternatives).toMatch(/not realistic/);
 });
 it('raises the nuts, calls a strong pair at the right price, and folds one pair to a river raise',()=>{
  const s=toFlop([600,'f','f'],'c',['f','f',800]);
  const set=coach(see(s,['7h','7c'],['As','7s','2d']));expect(set.action).toBe('raise');expect(set.to).toBe(2400);expect(set.job).toMatch(/^(the nuts|thick value)/);
  const tp=coach(see(s,['Ah','Kc'],['As','7s','2d']));expect(tp.action).toBe('call');expect(tp.job).toMatch(/top pair, good kicker/);expect(tp.numbers.some(n=>n.basis==='estimate')).toBe(true);
  const air=coach(see(s,['5h','4c'],['Ad','Kh','9c']));expect(air.action).toBe('fold');
  // River: Hero bets and is raised.
  let r=toFlop([600,'f','f'],'c',['f','f','x']);r=play(heroActs(r,'x'),['x']);r=play(heroActs(r,'x'),['x']);r=play(heroActs(r,1000),[4000]);
  const v=see(r,['Ah','9c'],['As','7s','2d','Jc','4h']),fold=coach(v);
  expect(v.street).toBe('river');expect(fold.action).toBe('fold');expect(fold.lesson.id).toBe('bluff-catch');expect(fold.card.id).toBe('C08');expect(fold.why.alternatives).toMatch(/In theory you defend/);
 });
 it('the pre-flop raiser bets small on a dry high board heads-up and checks the same hand multiway',()=>{
  let s=play(start(0),['f','f','f']);s=play(heroActs(s,600),['f','c','x']);// Hero raises the button, the big blind calls and checks.
  const bluff=coach(see(s,['Qh','Jc'],['Kd','7s','2c']));expect(bluff.action).toBe('bet');expect(bluff.to).toBe(400);expect(bluff.lesson.id).toBe('range-advantage');expect(bluff.close).toBe(true);
  expect(bluff.numbers.map(n=>n.basis)).toEqual(['exact','pool','measured']);// Patch 106 adds the figure measured in this app.expect(bluff.numbers[1].value).toBe(`${Math.round(100*POOL.flopFoldThird)}%`);
  // Patch 106: value bets are sized up (half the pot is now the smallest, on a dry board heads-up).
  const value=coach(see(s,['Ah','Kc'],['Kd','7s','2c']));expect(value.action).toBe('bet');expect(value.to).toBe(700);expect(value.headline).toMatch(/half the pot/);expect(value.lesson.id).toBe('value-bet');
  // Patch 106: heads-up, the raiser also bets a low connected board, for half the pot instead of a third.
  const low=coach(see(s,['Qh','Jc'],['7d','6s','5c']));expect(low.action).toBe('bet');expect(low.lesson.id).toBe('range-advantage');expect(low.to).toBe(700);expect(low.numbers[0].value).toBe('33%');
  let m=play(start(0),['f','f','f']);m=play(heroActs(m,600),['c','c','x','x']);// Both blinds call.
  const multi=coach(see(m,['Qh','Jc'],['Kd','7s','2c']));expect(multi.action).toBe('check');expect(multi.lesson.id).toBe('multiway');
  const pair=coach(see(s,['9h','9c'],['Kd','7s','2c']));expect(pair.action).toBe('check');expect(pair.lesson.id).toBe('pot-control');expect(pair.job).toMatch(/showdown value/);
 });
 it('out of position with a monster against the raiser: check, planning to raise',()=>{
  const s=play(heroActs(play(start(4),['f','f','f',500,'f']),'c'),[]);// Button raises, Hero calls in the big blind; Hero acts first.
  const a=coach(see(s,['7h','7c'],['Kd','7s','2c']));expect(a.action).toBe('check');expect(a.card.id).toBe('C07');expect(a.lesson.id).toBe('check-raise');expect(a.why.future).toMatch(/raise to about three and a half times/);
 });
 it('bluffs the river only after two checks, with no showdown value, heads-up and in position',()=>{
  let r=toFlop([600,'f','f'],'c',['f','f','x']);r=play(heroActs(r,'x'),['x']);r=play(heroActs(r,'x'),['x']);
  const bluff=coach(see(r,['6h','5h'],['Ks','9d','2c','Jc','3s']));expect(bluff.action).toBe('bet');expect(bluff.lesson.id).toBe('river-bluff');expect(bluff.numbers.find(n=>n.basis==='pool')!.value).toBe('49%');
  const show=coach(see(r,['9h','8h'],['Ks','9d','2c','Jc','3s']));expect(show.action).toBe('check');
  // The turn stab: the flop was checked through and they check again.
  let t=toFlop([600,'f','f'],'c',['f','f','x']);t=play(heroActs(t,'x'),['x']);
  const stab=coach(see(t,['6h','5h'],['Ks','9d','2c','Jc']));expect(stab.action).toBe('bet');expect(stab.to).toBe(800);expect(stab.lesson.id).toBe('fold-equity');expect(stab.numbers[0].value).toBe('33%');
  expect(coach(see(t,['9h','8h'],['Ks','9d','2c','Jc'])).action).toBe('check');
 });
 it('reads hands and boards',()=>{
  expect(readHand(['Ah','Kc'],['Kd','7s','2c']).job).toBe('thick value');expect(readHand(['Kh','4c'],['Kd','7s','2c']).job).toBe('thin value');
  expect(readHand(['Ah','Ac'],['Kd','7s','2c']).pair).toBe('an overpair');expect(readHand(['8h','7c'],['Kd','7s','2c']).pair).toBe('second pair');
  expect(readHand(['Ah','Qc'],['Kd','Ks','2c']).made).toMatch(/all of it on the board/);expect(readHand(['Ah','Qc'],['Kd','Ks','2c']).job).toBe('air');
  expect(readHand(['Jh','Tc'],['9d','8s','2c']).drawOuts).toBe(8);expect(readHand(['Jh','Tc'],['9d','8s','2c']).job).toBe('strong draw');
  expect(readHand(['As','Ks'],['Qs','7s','2s']).job).toBe('the nuts');expect(beatsShare(['As','Ks'],['Qs','7s','2s'])).toBeGreaterThan(.99);
  expect(texture(['Kd','7s','2c']).label).toBe('dry');expect(texture(['9h','8h','7c']).label).toBe('wet');expect(texture(['Kd','Ks','2c']).paired).toBe(true);
  // Known equities, within sampling error: AA against the top 5% is about 80–85%; QQ against QQ+ and AK about 40%.
  expect(equityVsTop(['As','Ad'],.05,'seed',3000)).toBeGreaterThan(.78);const qq=equityVsHands(['Qs','Qd'],['AA','KK','QQ','AKs','AKo'],'seed',4000);expect(qq).toBeGreaterThan(.36);expect(qq).toBeLessThan(.45);
 });
});

describe('what it reads, and what it never recommends',()=>{
 it('never looks at another seat’s cards',()=>{
  const s=play(start(0),[600,'f','f']),v=see(s,['Qs','Qd']);
  for(const seat of v.seats)if(seat.id!==0)Object.defineProperty(seat,'hole',{get(){throw new Error('The coach read a hidden hand');}});
  expect(coach(v).action).toBe('raise');
  const src=readFileSync('src/coach/coach.ts','utf8');expect(src).not.toMatch(/\.deck|burned|projectSpectatorView|GameState/);
 });
 it('over 600 hands of random action, cash and tournament, every recommendation is legal and fully explained',()=>{
  let r=4242;const rand=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return r/4294967296;};const seen=new Set<string>(),lessons=new Set<string>();let n=0;
  for(let h=0;h<600;h++){
   const profile=h%2?cash:tourney,seats=h%3===0?9:h%3===1?6:2,stack=[20000,8000,2400,40000,1400][h%5];
   let s=startHand({handId:`z${h}`,button:h%seats,profile,seats:Array.from({length:seats},(_,i)=>({id:i,name:i?`P${i}`:'You',stack}))});
   for(let i=0;i<300&&s.street!=='complete';i++){
    const l=legalActions(s);let a:Action;
    if(s.actor===0){
     const ad=advise(projectView(s,0),{mode:profile.mode,money})!;expect(ad).not.toBeNull();n++;seen.add(`${s.street}:${ad.action}`);lessons.add(ad.lesson.id);
     for(const part of Object.values(ad.why))expect(part.length).toBeGreaterThan(10);
     expect(ad.lesson.body.length).toBeGreaterThan(80);expect(ad.card.questions.length).toBe(5);expect(ad.overlay.questions.length).toBe(5);expect(['C02','C04','C09']).toContain(ad.ask.id);if(l.callAmount===0)expect(ad.ask.id).toBe('C02');expect(ad.overlay.id).toBe({preflop:'C10',flop:'C11',turn:'C12',river:'C13'}[s.street as 'preflop']);expect(ad.job.length).toBeGreaterThan(3);
     for(const x of ad.numbers)expect(['exact','estimate','pool','rule','measured']).toContain(x.basis);
     if(ad.action==='fold'){expect(l.fold&&!l.check).toBe(true);a={type:'fold'};}
     else if(ad.action==='check'){expect(l.check).toBe(true);a={type:'check'};}
     else if(ad.action==='call'){expect(l.callAmount).toBeGreaterThan(0);a={type:'call'};}
     else{const min=l.shortAllInTo??l.minRaiseTo!,max=l.maxRaiseTo??l.shortAllInTo!;expect(ad.to).not.toBeNull();expect(ad.to!).toBeGreaterThanOrEqual(min);expect(ad.to!).toBeLessThanOrEqual(max);expect(ad.to!%profile.chipUnit===0||ad.to===max).toBe(true);if(ad.action==='all-in')expect(ad.to).toBe(max);a={type:'raise',to:ad.to!};}
    }else{const x=rand(),me=s.seats.find(q=>q.id===s.actor)!,unit=profile.chipUnit,fit=(t:number)=>Math.min(l.maxRaiseTo!,Math.max(l.minRaiseTo!,Math.round(t/unit)*unit));
     a=l.check?(x<.65||!l.canRaise?{type:'check'}:{type:'raise',to:fit(me.streetCommitted+s.pot*.6)}):(x<.4?{type:'fold'}:x<.85||!l.canRaise?{type:'call'}:{type:'raise',to:fit(l.minRaiseTo!+s.pot*.5)});}
    s=act(s,a);
   }
  }
  expect(n).toBeGreaterThan(700);
  for(const k of ['preflop:raise','preflop:fold','preflop:call','preflop:check','preflop:all-in','flop:bet','flop:check','flop:call','flop:fold','turn:bet','river:check'])expect(seen.has(k)).toBe(true);
  expect(lessons.size).toBeGreaterThan(14);
 },240000);
 it('every lesson and notecard is complete, in plain words',()=>{
  for(const l of Object.values(LESSONS)){expect(l.title.length).toBeGreaterThan(8);expect(l.body.length).toBeGreaterThan(150);expect(l.body.length).toBeLessThan(520);}
  expect(Object.keys(NOTECARDS)).toEqual(['C02','C03','C04','C05','C06','C07','C08','C09']);expect(Object.values(OVERLAYS).map(o=>o.id)).toEqual(['C10','C11','C12','C13']);
  const src=readFileSync('src/coach/coach.ts','utf8');for(const id of src.matchAll(/lesson:'([a-z0-9-]+)'/g))expect(LESSONS[id[1]]).toBeDefined();
 });
});

describe('the panel',()=>{
 it('is off until switched on, remembers the choice, and lays the advice out as R-O-R-A-F with labelled numbers',()=>{
  store.clear();const ui=freshCoachUi();expect(ui.on).toBe(false);
  const s=play(start(0),[600,'f','f']),ad=coach(see(s,['Qs','Qd']));
  const off=coachMarkup(ui,null,{waiting:false,tournament:false});expect(off).toContain('id="coach-on"');expect(off).not.toContain('coach-card');expect(off).not.toContain('coach-test');
  ui.on=true;saveCoachUi(ui);expect(store.get(COACH_KEY)).toBe('on');expect(freshCoachUi().on).toBe(true);
  const m=coachMarkup(ui,ad,{waiting:false,tournament:false});
  expect(m).toContain('data-testid="coach-headline">Raise to $18 (3× the raise)<');expect(m).toContain('data-coach-size="1800"');
  for(const k of ['Ranges','Objective','Responses','Alternatives','Future plan'])expect(m).toContain(`<dt>${k}</dt>`);
  expect(m).toMatch(/class="basis pool">pool average</);expect(m).toMatch(/class="basis rule">rule of thumb</);expect(m).toContain('Learn: Re-raise your best hands for value');expect(m).toContain('C06 Considering a raise');expect(m).toContain('not a solver');
  expect(coachMarkup(ui,ad,{waiting:false,tournament:true})).toContain('prize-ladder (ICM)');expect(coachMarkup(ui,null,{waiting:true,tournament:false})).toContain('speaks when it is your turn');
 });
 it('Test me first hides the play behind the notecard questions until asked',()=>{
  const ui={...freshCoachUi(),on:true,test:true};const s=play(start(0),[600,'f','f']),ad=coach(see(s,['Qs','Qd']));
  const q=coachMarkup(ui,ad,{waiting:false,tournament:false});expect(q).toContain('data-testid="coach-quiz"');expect(q).not.toContain('Raise to $18');expect(q).not.toContain('coach-headline');expect((q.match(/<li>/g)??[]).length).toBe(5);expect(q).toContain('id="coach-reveal"');
  // The quiz must not give the play away: it shows the street overlay and the situation card, never the card for the answer.
  expect(q).toContain('C10 preflop overlay');expect(q).toContain('C04 Facing a bet');expect(q).not.toContain('C06');expect(q).not.toMatch(/Considering a raise/);
  const foldSpot=coach(see(s,['9h','4c']));expect(foldSpot.action).toBe('fold');const fq=coachMarkup(ui,foldSpot,{waiting:false,tournament:false});expect(fq).not.toContain('C08');expect(fq).not.toMatch(/fold/i);expect(fq).toBe(q.replace(/x^/,''));
  ui.revealed=ad.key;expect(coachMarkup(ui,ad,{waiting:false,tournament:false})).toContain('Raise to $18');
 });
 it('after you act it says whether you matched the coach and keeps a tally',()=>{
  const ui={...freshCoachUi(),on:true};const s=play(start(0),[600,'f','f']),ad=coach(see(s,['Qs','Qd']));
  ui.last=ad;reviewAction(ui,ad.key,{type:'call'},money);expect(ui.review!.matched).toBe(false);expect(ui.review!.text).toBe('Last decision: you called; the coach had Raise to $18 (3× the raise).');expect(ui.tally).toEqual({matched:0,total:1});
  ui.last=ad;reviewAction(ui,ad.key,{type:'raise',to:1800},money);expect(ui.review!.matched).toBe(true);expect(ui.tally).toEqual({matched:1,total:2});
  ui.last=ad;reviewAction(ui,ad.key,{type:'raise',to:4000},money);expect(ui.review!.text).toMatch(/same play as the coach, with a different size \(the coach had \$18\)/);
  ui.last=ad;reviewAction(ui,'other:1',{type:'fold'},money);expect(ui.tally.total).toBe(3);
  expect(coachMarkup(ui,null,{waiting:true,tournament:false})).toContain('data-testid="coach-review"');
  const evil={...ad,headline:'<img src=x>',why:{...ad.why,ranges:'<script>'}};expect(coachMarkup({...ui,review:null},evil,{waiting:false,tournament:false})).not.toMatch(/<img|<script/);
 });
 it('is wired into cash and tournament tables',()=>{
  const app=readFileSync('src/ui/app.ts','utf8'),t=readFileSync('src/ui/tournament-play.ts','utf8');
  expect(app).toContain("${coachPanel(shown, turn, 'cash', money)}");expect(app).toContain("coachPanel(c.gameView,c.gameView.actor===0&&c.data.active.status==='running','tournament'");
  expect(app).toContain('if (!auto) reviewAction(coachUi');expect(t).toContain('options.onHeroAction?.(action)');
 });
});
