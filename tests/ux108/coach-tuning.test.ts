import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GameState,RuleProfile,Action,Card,HeroViewModel} from '../../src/contracts';
import {startHand,applyCommand,projectView} from '../../src/core/engine';

/* Patch 106: the Live coach after a long simulated test against this app's players (about one million hands in all).
 * The test found four things, each fixed here and confirmed on the same deals:
 *   1. a bet or raise was a much stronger range than the coach assumed, so it called too often with weak pairs;
 *   2. value bets were too small (the river most of all);
 *   3. heads-up, a bet with nothing won the pot more often than its price needs, on more boards than the coach bet;
 *   4. a re-raise over callers was too small.
 * Bigger opening raises were also tried and did not gain, so the opening sizes stay as they were. Display only. */
const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {advise,assumed,POOL,MEASURED}=await import('../../src/coach/coach');
const {LESSONS}=await import('../../src/coach/lessons');
const {coachMarkup,freshCoachUi}=await import('../../src/coach/view');
const {observedStyle}=await import('../../src/stats/drills');
type Read={label:string;hands:number;aggressive:boolean;vpip:number;faced?:number;foldToBet?:number|null};

const cash:RuleProfile={id:'c',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:100,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const tourney:RuleProfile={id:'t',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const money=(n:number)=>`$${(n/100).toFixed(n%100?2:0)}`;
let ids=0;
const start=(button:number,stack=20000,n=6,profile=cash)=>startHand({handId:`k${++ids}`,button,profile,seats:Array.from({length:n},(_,i)=>({id:i,name:i?`P${i}`:'You',stack}))});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
type Step=Action|'f'|'c'|'x'|number;
const toAction=(a:Step):Action=>a==='f'?{type:'fold'}:a==='c'?{type:'call'}:a==='x'?{type:'check'}:typeof a==='number'?{type:'raise',to:a}:a;
/** Play the listed actions (the seats in turn), stopping with Hero to act. */
const play=(s:GameState,actions:Step[])=>{for(const a of actions){if(s.actor===0)throw new Error('Hero is to act before the script ended');s=act(s,toAction(a));}if(s.actor!==0)throw new Error(`Hero is not to act (seat ${s.actor}, ${s.street})`);return s;};
const heroActs=(s:GameState,a:Step)=>act(s,toAction(a));
const see=(s:GameState,hole:Card[],board?:Card[]):HeroViewModel=>{const v=structuredClone(projectView(s,0));v.seats.find(x=>x.id===0)!.hole=hole;if(board)v.board=board;return v;};
const coach=(v:HeroViewModel,styleOf?:(seat:number)=>Read|null,mode:'cash'|'tournament'='cash')=>advise(v,{mode,money,styleOf})!;
// Seats with the button on 0: Hero BTN, 1 SB, 2 BB, 3 LJ (first to act six-handed), 4 HJ, 5 CO.
/** Hero on the button calls a raise from the first seat; heads-up; the raiser checks the flop. */
const calledRaise=()=>play(heroActs(play(start(0),[600,'f','f']),'c'),['f','f','x']);
/** Hero raises the button, the big blind calls and checks the flop. */
const raisedPot=()=>{const s=play(start(0),['f','f','f']);return play(heroActs(s,600),['f','c','x']);};

describe('what a bet means',()=>{
 it('assumes a stronger range with far fewer bluffs than Patch 105 did, on every street',()=>{
  expect(assumed('river',false,.5,false,false,null)).toEqual({width:.14,bluff:.10});
  expect(assumed('river',false,.33,false,false,null).bluff).toBe(.13);expect(assumed('river',false,1,false,false,null).bluff).toBe(.14);
  expect(assumed('turn',false,.5,false,false,null)).toEqual({width:.18,bluff:.12});expect(assumed('turn',false,1,false,false,null).bluff).toBe(.18);
  expect(assumed('flop',false,.5,false,true,null)).toEqual({width:.28,bluff:.17});expect(assumed('flop',false,.5,false,false,null)).toEqual({width:.19,bluff:.10});
  // A raise is narrower still, and each extra player halves the bluffs.
  expect(assumed('river',true,1,false,false,null)).toEqual({width:.045,bluff:.05});expect(assumed('turn',true,1,false,false,null).bluff).toBe(.06);
  expect(assumed('river',false,.5,true,false,null).bluff).toBe(.05);
  // Every one of these is below the live-pool figure the playbook records for river bluffs.
  for(const f of [.33,.5,.75,1,1.5])expect(assumed('river',false,f,false,false,null).bluff).toBeLessThan(POOL.riverBluffShare);
 });
 it('a read adds bluffs only for a loose player who bets a lot; betting a lot with a tight range is strength',()=>{
  const base=assumed('turn',false,.5,false,false,null),r=(label:string,vpip:number,aggressive:boolean,hands=20):Read=>({label,vpip,aggressive,hands});
  const loose=assumed('turn',false,.5,false,false,r('loose, aggressive',.45,true));expect(loose.bluff).toBeCloseTo(base.bluff+.08,10);expect(loose.width).toBeCloseTo(base.width*1.2,10);
  expect(assumed('turn',false,.5,false,false,r('medium, aggressive',.3,true))).toEqual(base);
  expect(assumed('turn',false,.5,false,false,r('tight, aggressive',.18,true)).bluff).toBeCloseTo(base.bluff-.05,10);
  expect(assumed('turn',false,.5,false,false,r('medium, calls a lot',.3,false)).bluff).toBeCloseTo(base.bluff-.05,10);
  expect(assumed('river',true,1,false,false,r('tight',.15,false)).bluff).toBe(.03);// Never below three in a hundred.
  expect(assumed('turn',false,.5,false,false,r('loose, aggressive',.45,true,5))).toEqual(base);// Fewer than eight hands seen: no read yet.
 });
 it('a weak pair folds to a river bet, a strong hand still calls, and the measured figure is shown',()=>{
  // The flop and the turn are checked through, then the raiser bets half the pot on the river.
  let r=calledRaise();r=play(heroActs(r,'x'),['x']);r=play(heroActs(r,'x'),[800]);
  const board:Card[]=['Ks','9d','2c','Jc','3s'],weak=coach(see(r,['9h','8h'],board));
  expect(weak.action).toBe('fold');expect(weak.job).toMatch(/showdown value/);expect(weak.card.id).toBe('C08');
  const measured=weak.numbers.find(n=>n.basis==='measured')!;expect(measured.label).toBe('In this app, a weak pair beats a river bet');expect(measured.value).toBe(`about ${Math.round(100*MEASURED.riverCatcherWins)}% of the time`);
  expect(weak.numbers.find(n=>n.basis==='pool')!.value).toBe(`${Math.round(100*POOL.riverBluffShare)}%`);expect(weak.why.ranges).toMatch(/bluffed the river much less/);
  const est=Number(/(\d+)%/.exec(weak.numbers.find(n=>n.basis==='estimate')!.value)![1]);expect(est).toBeLessThan(20);// Patch 105 put this near 30%.
  const strong=coach(see(r,['Kh','9c'],board));expect(strong.action).toBe('call');expect(strong.job).toMatch(/thick value: two pair/);expect(strong.lesson.id).toBe('raise-or-call');
  // One pair, even top pair with a good kicker, is a bluff-catcher against a river bet from these players: about one chance in five here, with 26% needed.
  const top=coach(see(r,['Kh','Qd'],['Ks','9d','2c','7h','3s']));expect(top.job).toMatch(/top pair, good kicker/);expect(top.action).toBe('fold');expect(top.numbers[0].value).toBe('$8 to win $23: you need 26%');
  const nuts=coach(see(r,['Qh','Td'],board));expect(nuts.job).toMatch(/^the nuts/);expect(['raise','all-in']).toContain(nuts.action);
  // The same weak pair on the flop, facing a bet from the raiser: also a fold now.
  const f=play(heroActs(play(start(0),[600,'f','f']),'c'),['f','f',800]);expect(coach(see(f,['8h','8d'],['As','Kd','4c'])).action).toBe('fold');
 });
 it('deep in the re-raising, only big pairs and ace-king continue by price',()=>{
  const four=play(start(4),[600,1800,4400,'f','f']);// Raise, re-raise, and a fourth raise before Hero in the big blind.
  const small=coach(see(four,['6s','6d']));expect(small.action).toBe('fold');expect(small.lesson.id).toBe('four-bet');
  expect(coach(see(four,['Js','Td'])).action).toBe('fold');expect(['raise','all-in']).toContain(coach(see(four,['As','Ad'])).action);
 });
});

describe('value bets are sized up',()=>{
 it('on the flop: half the pot on a dry board heads-up, the whole pot on a wet board or with several players in',()=>{
  const s=raisedPot();// Pot $13.
  const dry=coach(see(s,['Ah','Kc'],['Kd','7s','2c']));expect(dry.action).toBe('bet');expect(dry.to).toBe(700);expect(dry.headline).toBe('Bet $7 (half the pot)');
  const wet=coach(see(s,['Ah','Kc'],['Kd','Qd','Jc']));expect(wet.action).toBe('bet');expect(wet.to).toBe(1300);expect(wet.headline).toBe('Bet $13 (the pot)');expect(wet.lesson.id).toBe('protection');
  let m=play(start(0),['f','f','f']);m=play(heroActs(m,600),['c','c','x','x']);// Both blinds call: pot $18.
  const multi=coach(see(m,['Ah','Kc'],['Kd','7s','2c']));expect(multi.action).toBe('bet');expect(multi.to).toBe(1800);
 });
 it('on the river: the pot with a strong hand, one and a half times the pot with the best possible hand',()=>{
  let r=raisedPot();r=play(heroActs(r,'x'),['x']);r=play(heroActs(r,'x'),['x']);// Checked down to the river: pot still $13.
  const strong=coach(see(r,['Ah','Kc'],['Kd','7s','2c','9h','3d']));expect(strong.action).toBe('bet');expect(strong.to).toBe(1300);expect(strong.headline).toBe('Bet $13 (the pot)');expect(strong.why.responses).toMatch(/pays off a big bet/);
  const nuts=coach(see(r,['Kh','Kc'],['Kd','7s','2c','Ks','3d']));expect(nuts.job).toMatch(/^the nuts/);expect(nuts.to).toBe(2000);expect(nuts.headline).toBe('Bet $20 (one and a half times the pot)');expect(nuts.lesson.id).toBe('fast-play');expect(nuts.why.responses).toMatch(/more than the pot/);
  // The turn sizes did not gain from growing in the test, so they are unchanged: two-thirds on a board without draws.
  let t=raisedPot();t=play(heroActs(t,'x'),['x']);const turn=coach(see(t,['Ah','Kc'],['Kd','7s','2c','9h']));expect(turn.to).toBe(900);expect(turn.headline).toMatch(/two-thirds of the pot/);
  expect(LESSONS['value-bet'].body).toMatch(/against players who call too much, that means bigger/);
 });
});

describe('betting with nothing, heads-up',()=>{
 const air:Card[]=['6h','5h'];
 it('the raiser bets every flop heads-up: a third on a dry board, half the pot when draws are possible',()=>{
  const s=raisedPot();
  const dry=coach(see(s,['Qh','Jc'],['Kd','7s','2c']));expect(dry.to).toBe(400);expect(dry.lesson.id).toBe('range-advantage');expect(dry.numbers[0]).toEqual({label:'A third-pot bet needs folds',value:'25%',basis:'exact'});
  const low=coach(see(s,['Ah','Qc'],['7d','7s','2c']));expect(low.action).toBe('bet');expect(low.to).toBe(400);expect(low.why.ranges).toMatch(/miss a low flop like this/);
  const lowish=coach(see(s,['Ah','Qc'],['8d','5s','2c']));expect(lowish.action).toBe('bet');expect(lowish.to).toBe(700);// Two cards close together: draws are possible, so half the pot.
  const wet=coach(see(s,['Ah','2c'],['Kd','Qd','Jc']));expect(wet.action).toBe('bet');expect(wet.to).toBe(700);expect(wet.numbers[0]).toEqual({label:'A half-pot bet needs folds',value:'33%',basis:'exact'});
  expect(wet.numbers.map(n=>n.basis)).toEqual(['exact','pool','measured']);expect(wet.numbers[2].value).toBe(`about ${Math.round(100*MEASURED.flopBetFolds)}% of the time`);
  expect(LESSONS['range-advantage'].title).toBe('Range advantage: why the raiser bets the flop heads-up');
 });
 it('in position without the lead: bets half the pot when they check, on any board',()=>{
  const s=calledRaise();// Pot $15; the raiser has checked.
  const stab=coach(see(s,air,['Ks','9d','2c']));expect(stab.action).toBe('bet');expect(stab.to).toBe(800);expect(stab.lesson.id).toBe('fold-equity');expect(stab.close).toBe(true);
  expect(stab.why.ranges).toMatch(/a raiser who checks the flop has usually missed it/);expect(stab.numbers.map(n=>n.basis)).toEqual(['exact','pool','measured']);expect(stab.numbers[1].value).toBe(`${Math.round(100*POOL.flopFold)}%`);
  expect(coach(see(s,air,['Kd','Qd','Jc'])).action).toBe('bet');
  // A hand with showdown value still checks: betting it only folds out what it beats.
  const pair=coach(see(s,['9h','8h'],['Ks','9d','2c']));expect(pair.action).toBe('check');expect(pair.lesson.id).toBe('pot-control');
 });
 it('first to act: bets a pot nobody raised, checks to the raiser, and checks with several players in',()=>{
  // Folded to Hero in the small blind, who calls; the big blind checks. Hero acts first on the flop.
  const limped=play(heroActs(play(start(5),['f','f','f','f']),'c'),['x']);
  const lead=coach(see(limped,air,['Ks','9d','2c']));expect(lead.action).toBe('bet');expect(lead.to).toBe(200);expect(lead.lesson.id).toBe('fold-equity');expect(lead.why.objective).toMatch(/a pot nobody has claimed/);expect(lead.why.ranges).toMatch(/Nobody raised before the flop/);
  // The button raises, Hero calls in the big blind and acts first: check to the raiser.
  const called=play(heroActs(play(start(4),['f','f','f',500,'f']),'c'),[]);
  const oop=coach(see(called,air,['Ks','9d','2c']));expect(oop.action).toBe('check');expect(oop.lesson.id).toBe('initiative');
  let m=play(start(0),['f','f','f']);m=play(heroActs(m,600),['c','c','x','x']);
  const multi=coach(see(m,['Qh','Jc'],['Kd','7s','2c']));expect(multi.action).toBe('check');expect(multi.lesson.id).toBe('multiway');
 });
 it('goes by how often this player has really folded: no bluff into one who rarely folds',()=>{
  const s=calledRaise(),board:Card[]=['Ks','9d','2c'];
  const rarely=(seat:number):Read|null=>seat===3?{label:'medium, calls a lot',hands:30,aggressive:false,vpip:.3,faced:10,foldToBet:.2}:null;
  const no=coach(see(s,air,board),rarely);expect(no.action).toBe('check');expect(no.why.responses).toBe('This opponent has rarely folded to a bet, so a bluff is not worth trying.');
  // "Calls a lot" (more calls than bets) is not the same thing: this player has folded to six bets in ten.
  const folds=(seat:number):Read|null=>seat===3?{label:'medium, calls a lot',hands:30,aggressive:false,vpip:.3,faced:10,foldToBet:.6}:null;
  const yes=coach(see(s,air,board),folds);expect(yes.action).toBe('bet');expect(yes.why.responses).toMatch(/You have seen P3 fold to 6 of 10 bets after the flop\./);
  // Fewer than six bets faced: not enough to rule a bluff out.
  const few=(seat:number):Read|null=>seat===3?{label:'medium',hands:12,aggressive:false,vpip:.3,faced:4,foldToBet:0}:null;
  expect(coach(see(s,air,board),few).action).toBe('bet');
  // The same test holds for the raiser's own bet.
  expect(coach(see(raisedPot(),['Qh','Jc'],['Kd','7s','2c']),seat=>seat===2?{label:'loose',hands:30,aggressive:false,vpip:.5,faced:8,foldToBet:.25}:null).action).toBe('check');
 });
 it('on the turn in position: a second bet after the flop bet was called, two-thirds of the pot',()=>{
  let t=raisedPot();t=play(heroActs(t,400),['c','x']);// Hero bets the flop, the big blind calls and checks the turn. Pot $21.
  const barrel=coach(see(t,['Qh','Jc'],['Kd','7s','2c','4h']));expect(barrel.action).toBe('bet');expect(barrel.to).toBe(1400);expect(barrel.lesson.id).toBe('fold-equity');
  expect(barrel.numbers[0]).toEqual({label:'A two-thirds bet needs folds',value:'40%',basis:'exact'});expect(barrel.why.ranges).toMatch(/They called the flop and have checked again/);
  expect(barrel.numbers.find(n=>n.basis==='measured')!.value).toBe(`about ${Math.round(100*MEASURED.turnBetFolds)}% of the time`);
  // After a checked-through flop it is still the half-pot stab from Patch 105.
  let c=calledRaise();c=play(heroActs(c,'x'),['x']);const stab=coach(see(c,air,['Ks','9d','2c','Jc']));expect(stab.to).toBe(800);expect(stab.numbers[0].value).toBe('33%');
  // No river bluff was added: with nothing on the river after betting twice, the coach still checks.
  let r=raisedPot();r=play(heroActs(r,400),['c','x']);r=play(heroActs(r,1400),['c','x']);expect(coach(see(r,['Qh','Jc'],['Kd','7s','2c','4h','3d'])).action).toBe('check');
 });
});

describe('before the flop',()=>{
 it('a re-raise over a caller is larger in a cash game; opening sizes are unchanged',()=>{
  const s=play(start(0),[600,'c','f']);// The first seat raises, the next calls; Hero is on the button with queens.
  const sq=coach(see(s,['Qs','Qd']));expect(sq.lesson.id).toBe('squeeze');expect(sq.to).toBe(2700);expect(sq.headline).toBe('Raise to $27 (3× the raise plus one and a half raises for each caller)');
  const t=play(start(0,20000,6,tourney),[600,'c','f']),tq=coach(see(t,['Qs','Qd']),undefined,'tournament');expect(tq.to).toBe(2400);expect(tq.headline).toMatch(/plus one raise for each caller/);
  expect(LESSONS.squeeze.body).toMatch(/one and a half in a cash game/);
  // Bigger opening raises were tested and did not gain, so first-in is still three big blinds and four plus one per limper.
  const open=play(start(0),['f','f','f']);expect(coach(see(open,['As','Ad'])).to).toBe(600);
  const limp=play(start(0),['c','f','f']);expect(coach(see(limp,['As','Ad'])).to).toBe(1000);
 });
});

describe('what it reads',()=>{
 it('counts how often a player has folded to a bet after the flop, from public actions only',()=>{
  const ev=(street:string,type:string,seatId=3)=>({type:'action',street,seatId,action:{type},amount:type==='fold'?0:200});
  const hand=(events:unknown[])=>({view:{seats:[{id:3,name:'P3'},{id:0,name:'You'}],events}});
  const hands=[hand([ev('preflop','call'),ev('flop','fold')]),hand([ev('preflop','call'),ev('flop','call'),ev('turn','fold')]),hand([ev('preflop','fold')]),hand([ev('preflop','raise'),ev('flop','raise'),ev('turn','call')]),hand([ev('preflop','call',0),ev('flop','fold',0)])] as never;
  const style=observedStyle(hands,3,'P3');expect(style.hands).toBe(5);expect(style.faced).toBe(4);expect(style.foldToBet).toBe(.5);
  expect(observedStyle(hands,3,'Someone else').foldToBet).toBeNull();expect(observedStyle([] as never,3,'P3').faced).toBe(0);
  // A fold before the flop is not a fold to a bet after it.
  expect(observedStyle([hand([ev('preflop','fold')])] as never,3,'P3')).toMatchObject({faced:0,foldToBet:null});
 });
 it('labels the new numbers "measured here", and says where they come from',()=>{
  const s=calledRaise(),ad=coach(see(s,['6h','5h'],['Ks','9d','2c'])),html=coachMarkup({...freshCoachUi(),on:true},ad,{waiting:false,tournament:false});
  expect(html).toContain('<small class="basis measured">measured here</small>');expect(html).toContain('In this app, heads-up flop bets like this won the pot at once');
  expect(readFileSync('src/ui/casino.css','utf8')).toContain('.coach-numbers .basis.measured{');
  const src=readFileSync('src/coach/coach.ts','utf8');expect(src).toMatch(/measured in a long simulated test of this coach against this app's computer players/);expect(src).toMatch(/They describe these opponents, not live players/);
  expect(MEASURED.riverCatcherWins).toBeGreaterThan(.05);expect(MEASURED.riverCatcherWins).toBeLessThan(.2);expect(MEASURED.flopBetFolds).toBeGreaterThan(.33);expect(MEASURED.turnBetFolds).toBeGreaterThan(.4);
  // Still display only, and still blind to hidden cards.
  expect(src).not.toMatch(/\.deck|burned|projectSpectatorView|GameState/);
  const v=see(s,['6h','5h'],['Ks','9d','2c']);for(const seat of v.seats)if(seat.id!==0)Object.defineProperty(seat,'hole',{get(){throw new Error('The coach read a hidden hand');}});expect(coach(v).action).toBe('bet');
 });
});
