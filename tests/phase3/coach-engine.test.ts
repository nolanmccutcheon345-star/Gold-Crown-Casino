import {describe,it,expect} from 'vitest';
import type {GameState,RuleProfile,Action,Card,HeroViewModel} from '../../src/contracts';
import {startHand,applyCommand,projectView} from '../../src/core/engine';

/* Phase 3: the playbook's Coach Engine Spec as a decision layer under the Live coach.
 *  - the playbook's chart sets live in ranges.ts as data, every width labelled with its source
 *    (widths the sources never state numerically are null — the coach falls back and says so);
 *  - the exact price math (required equity, alpha, MDF, SPR commit equity) and EV comparisons
 *    rank the close alternatives where the spec's math supports an estimate, and only there;
 *  - tournament advice is priced in prize equity, not chips: the bubble factor when the payout
 *    context supports it, the stage/stack-risk risk premium otherwise — so the same spot can be
 *    a call in cash and a fold in a tournament, for a stated reason;
 *  - spots no playbook chart covers are flagged as principle-based reads, never dressed as charts;
 *  - the coach still reads only what Hero can see. */
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const {advise}=await import('../../src/coach/coach');
const {classifySpot,chartCoverage,poolFor,requiredEquity,alpha,mdf,commitEquity,callEv,betEv,raiseEv,tournamentStage,stackRole,bubbleFactor,riskPremium,depthRead,LIVE_MIXED}=await import('../../src/coach/engine');
const {JANDA_6MAX,REDCHIP_LIVE_9MAX,POOL_RFI,POOL_3BET_FREQ,BB_3BET_VS_UTG,DEFEND_VS_3BET,rfiChart,chartWidth,depthBand,shoveCallShare,openWidth}=await import('../../src/coach/ranges');
const {LESSONS}=await import('../../src/coach/lessons');
const {coachMarkup,freshCoachUi}=await import('../../src/coach/view');

const cash:RuleProfile={id:'c',version:'1',mode:'cash',smallBlind:100,bigBlind:200,chipUnit:100,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
const tourney:RuleProfile={id:'t',version:'1',mode:'tournament',smallBlind:100,bigBlind:200,chipUnit:1,rake:{basisPoints:0,cap:0,noFlopNoDrop:true},shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button',tournament:{bigBlindAnte:200,antePriority:'blind-first',buttonRule:'dead-button'}};
const money=(n:number)=>`$${(n/100).toFixed(n%100?2:0)}`;
const start=(handId:string,button:number,stack=20000,n=6,profile=cash)=>startHand({handId,button,profile,seats:Array.from({length:n},(_,i)=>({id:i,name:i?`P${i}`:'You',stack}))});
const act=(s:GameState,action:Action)=>applyCommand(s,{handId:s.handId,revision:s.revision,seatId:s.actor!,decisionId:`d:${s.revision}`,action});
type Step=Action|'f'|'c'|'x'|number;
const toA=(a:Step):Action=>a==='f'?{type:'fold'}:a==='c'?{type:'call'}:a==='x'?{type:'check'}:typeof a==='number'?{type:'raise',to:a}:a;
const play=(s:GameState,actions:Step[])=>{for(const a of actions){if(s.actor===0)throw new Error('Hero is to act before the script ended');s=act(s,toA(a));}if(s.actor!==0)throw new Error(`Hero is not to act (actor ${s.actor}, ${s.street})`);return s;};
const seq=(s:GameState,actions:Step[])=>{for(const a of actions)s=act(s,toA(a));return s;};
const heroActs=(s:GameState,a:Step)=>act(s,toA(a));
const see=(s:GameState,hole:Card[],board?:Card[]):HeroViewModel=>{const v=structuredClone(projectView(s,0));v.seats.find(x=>x.id===0)!.hole=hole;if(board)v.board=board;return v;};
// Seats with the button on 0: Hero BTN, 1 SB, 2 BB, 3 LJ (first to act six-handed), 4 HJ, 5 CO.

describe('playbook chart sets, as data with sources',()=>{
 it('carries the sourced anchors, and null — never an invented number — where the chart tab was not reproduced',()=>{
  expect(JANDA_6MAX.widths.UTG).toBe(.176);           // Master NLHE §2.1: UTG opens a linear 17.6% at NL500.
  expect(JANDA_6MAX.widths.BTN).toBe(.42);            // §2.2: BTN 42% at 100bb.
  expect(JANDA_6MAX.source).toMatch(/Janda/);
  expect(chartWidth(JANDA_6MAX,'UTG')).toEqual({width:.176,stated:true});
  const co=chartWidth(JANDA_6MAX,'CO');expect(co.stated).toBe(false);expect(co.width).toBe(openWidth('CO')); // fallback, labelled unstated
  expect(REDCHIP_LIVE_9MAX.widths.BTN).toBe(openWidth('BTN'));
  expect(POOL_RFI.widths.BTN).toBe(.48);expect(POOL_RFI.kind).toBe('pool');  // rule 167 frequency audit
  expect(POOL_3BET_FREQ.CO).toBe(.09);expect(BB_3BET_VS_UTG).toBe(.054);    // §2.4 solver anchor
  expect(DEFEND_VS_3BET.small).toBeGreaterThan(DEFEND_VS_3BET.large);       // §8.5: defend more vs small 3-bets
  expect(rfiChart(6).id).toBe('janda-6max');expect(rfiChart(9).id).toBe('redchip-live-9max');
 });
 it('depth bands rotate ranges, and calling ranges run at just over half the shoving range',()=>{
  expect(depthBand(4).label).toMatch(/shove-or-fold/);expect(depthBand(10).label).toMatch(/tightest/);
  expect(depthBand(25).falls).toMatch(/22–44/);expect(depthBand(100).label).toMatch(/full stack/);
  expect(shoveCallShare('BTN',10)).toBe(.55);expect(shoveCallShare('BB',5)).toBeGreaterThan(.55); // rule 57 + the BB exception
  expect(depthRead(10).band).toMatch(/tightest/);
 });
});

describe('the exact price math',()=>{
 it('required equity, alpha and MDF are the spec formulas (§8.1)',()=>{
  expect(requiredEquity(1500,800)).toBeCloseTo(800/2300,10);
  expect(alpha(60,100)).toBeCloseTo(.375,10);expect(mdf(60,100)).toBeCloseTo(.625,10);
  expect(alpha(50,100)+mdf(50,100)).toBeCloseTo(1,10);
  expect(requiredEquity(100,0)).toBe(0);
 });
 it('SPR commit equity follows the ladder — 33 / 40 / 43 — and stops above SPR 4 (rule 4)',()=>{
  expect(commitEquity(1)).toBe(.33);expect(commitEquity(2)).toBe(.40);expect(commitEquity(3)).toBe(.43);
  expect(commitEquity(10)).toBe(.43);expect(commitEquity(1.5)).toBeCloseTo(.365,10);
 });
 it('EV helpers price fold at zero and calls by pot odds',()=>{
  expect(callEv(.5,100,50)).toBe(25);expect(callEv(.25,100,50)).toBe(-12.5);
  expect(betEv(1,0,100,50)).toBe(100);expect(betEv(0,.5,100,50)).toBe(25);
  expect(raiseEv(1,0,100,50,50)).toBe(100);expect(raiseEv(0,.5,100,50,50)).toBe(50);
 });
 it('pool profiles: the default is the playbook live set; only sourced per-stake adjustments differ',()=>{
  expect(poolFor(undefined)).toEqual(LIVE_MIXED);expect(poolFor('mid')).toEqual(LIVE_MIXED);expect(poolFor('high')).toEqual(LIVE_MIXED);
  expect(poolFor('low').riverBluffShare).toBe(.13);   // rule 107: low-stakes river bluffs ~10–15%
  expect(poolFor('low').flopFold).toBe(.41);          // rule 141: c-bet folds ~40% on every texture
  expect(poolFor('micro').riverBluffShare).toBe(.10);
  expect(poolFor('low').foldToThreeBet).toBe(LIVE_MIXED.foldToThreeBet); // no sourced delta: unchanged
 });
});

describe('spot classification and chart coverage',()=>{
 it('classifies the decision and names the governing chart; 9-handed tables use the live full-ring set',()=>{
  const six=see(start('p3-cls6',0),['As','Kd']);
  expect(classifySpot(six).kind).toBe('unopened');expect(classifySpot(six).label).toMatch(/Preflop · first in/);
  expect(chartCoverage(six).chart).toBe('janda-6max');
  const nine=see(start('p3-cls9',0,20000,9),['As','Kd']);
  expect(chartCoverage(nine).chart).toBe('redchip-live-9max');
  const facing=see(play(start('p3-clsF',0),[600,'f','f']),['As','Kd']);
  expect(classifySpot(facing).kind).toBe('facing-open');expect(chartCoverage(facing).chart).toBe('3bet-call-charts');
 });
 it('flags an honest gap where no chart covers the spot — preflop 4-bet+ and postflop 4-bet pots',()=>{
  const four=play(start('p3-gap1',4),[600,1800,4400,'f','f']); // raise, 3-bet, 4-bet before Hero in the big blind
  const ad=advise(see(four,['Ts','Td']),{mode:'cash',money})!;
  expect(ad.action).toBe('fold');expect(ad.gap).toMatch(/principle-based read/);expect(ad.spot).toMatch(/facing 4-bet\+/);
  let s=heroActs(four,'c');s=seq(s,['f','f']);       // Hero calls the 4-bet; the opener and 3-bettor fold
  s=heroActs(s,'x');s=play(s,[3000]);                // Hero checks the flop; the 4-bettor bets into him
  const post=advise(see(s,['Ts','Td'],['Kd','7c','2s']),{mode:'cash',money})!;
  expect(post.gap).toMatch(/No chart for this spot \(a 4-bet pot after the flop\)/);
  const normal=advise(see(play(start('p3-gap2',3),[]),['As','Ad']),{mode:'cash',money})!;
  expect(normal.gap).toBeUndefined();expect(normal.spot).toMatch(/first in/);
 });
});

describe('EV-ranked alternatives',()=>{
 it('preflop chart decisions name the alternatives without inventing EVs',()=>{
  const ad=advise(see(start('p3-alt1',3),['As','Ad']),{mode:'cash',money})!;
  expect(ad.action).toBe('raise');expect(ad.alternatives?.length).toBeGreaterThan(0);
  for(const a of ad.alternatives!)expect(a.ev).toBeNull();
  expect(ad.alternatives![0].note).toMatch(/chart decision/);
 });
 it('a facing decision ranks fold / call / raise by EV from the same equity the coach decides with',()=>{
  let s=play(start('p3-alt2',0,2600),[600,'f','f']);s=heroActs(s,'c');s=seq(s,['f','f']);
  s=play(s,[700]);s=heroActs(s,'c');s=play(s,[800]);   // turn: Hero faces 800 with bottom pair (about 24% against the assumed range)
  const ad=advise(see(s,['5s','4s'],['As','8d','3c','5h']),{mode:'cash',money})!;
  expect(ad.action).toBe('call');
  const alt=ad.alternatives!;expect(alt.map(a=>a.action)).toEqual(expect.arrayContaining(['Fold','Call','Raise']));
  expect(alt.find(a=>a.action==='Fold')!.ev).toBe(0);
  const call=alt.find(a=>a.action==='Call')!;expect(call.ev!).toBeGreaterThan(0);expect(call.evLabel).toMatch(/^\+/);
  expect(alt.find(a=>a.recommended)?.action).toBe('Call');
  expect([...alt].sort((x,y)=>(y.ev??-Infinity)-(x.ev??-Infinity))).toEqual(alt); // sorted best first
 });
 it('a free postflop decision compares check against a bet, with numbers shown',()=>{
  let s=play(start('p3-alt3',0),[600,'f','f']);s=heroActs(s,'c');s=seq(s,['f','f']);s=play(s,['x']);
  const ad=advise(see(s,['Ks','Qs'],['As','7s','2d']),{mode:'cash',money})!;
  const alt=ad.alternatives!;expect(alt.map(a=>a.action)).toEqual(expect.arrayContaining(['Check','Bet']));
  for(const a of alt)expect(a.ev).not.toBeNull();
 });
});

describe('the tournament layer: prize equity, not chips',()=>{
 const prizes=[5000,3000,2000,1200,800,500],stacks=[20000,20000,20000,20000,20000,20000];
 const icmCtx={playersLeft:6,paidPlaces:6,prizes,stacks,heroIndex:0,opponentIndex:3};
 it('stage and stack role follow the field state (§11.1)',()=>{
  expect(tournamentStage({playersLeft:7,paidPlaces:6})).toBe('bubble');
  expect(tournamentStage({playersLeft:9,paidPlaces:9})).toBe('final-table');
  expect(tournamentStage({playersLeft:20,paidPlaces:10})).toBe('middle');
  expect(tournamentStage({playersLeft:100,paidPlaces:10})).toBe('early');
  expect(tournamentStage(undefined)).toBe('unknown');
  expect(stackRole({playersLeft:6,paidPlaces:6,stacks:[60000,10000,10000,10000,10000,10000],heroIndex:0})).toBe('big');
  expect(stackRole({playersLeft:6,paidPlaces:6,stacks,heroIndex:0})).toBe('mid');
 });
 it('the bubble factor converts straight to a calling threshold: BF ÷ (BF + 1)',()=>{
  const bf=bubbleFactor(icmCtx)!;expect(bf).not.toBeNull();
  expect(bf.bf).toBeGreaterThan(1.4);expect(bf.bf).toBeLessThan(1.8);
  expect(bf.requiredAllIn).toBeCloseTo(bf.bf/(bf.bf+1),10);expect(bf.requiredAllIn).toBeGreaterThan(.55);
  expect(bubbleFactor({playersLeft:20,paidPlaces:6,prizes,stacks,heroIndex:0,opponentIndex:3})).toBeNull(); // exact ICM is a final-table tool
  expect(riskPremium(undefined,20000,20000).points).toBe(.05);  // no context: survival heuristic, whole stack at risk
  expect(riskPremium(undefined,20000,100).points).toBe(0);
  const bub=riskPremium({playersLeft:7,paidPlaces:6,stacks:[20000,20000,20000,20000,20000,20000,20000],heroIndex:0},20000,20000);
  expect(bub.points).toBeCloseTo(.09,10);expect(bub.basis).toBe('rule');
 });
 it('the same all-in spot is a call in cash and a fold in the tournament — priced by ICM, and it says so',()=>{
  const s=play(start('p3-icm',4),['f','f',20000,'f','f']);  // LJ shoves 100bb; Hero in the big blind with JJ
  const v=see(s,['Js','Jd']);
  const cashAd=advise(v,{mode:'cash',money})!;
  expect(cashAd.action).toBe('call');expect(cashAd.icmPriced).toBeUndefined();
  const tAd=advise(v,{mode:'tournament',money,tournament:icmCtx})!;
  expect(tAd.action).toBe('fold');expect(tAd.lesson.id).toBe('icm');expect(tAd.icmPriced).toBe(true);
  expect(tAd.numbers.some(n=>n.basis==='icm'&&n.label==='Bubble factor')).toBe(true);
  expect(tAd.numbers.some(n=>/under ICM/.test(n.value))).toBe(true);
  // The chip EV of calling is still positive — the fold is the risk premium, not a math error.
  expect(tAd.alternatives!.find(a=>a.action==='Call')!.ev!).toBeGreaterThan(0);
  const html=coachMarkup({...freshCoachUi(),on:true},tAd,{waiting:false,tournament:true});
  expect(html).toContain('Close alternatives');expect(html).toContain('priced with prize-ladder (ICM) pressure');
 });
 it('a postflop call that clears the chip price can fail the tournament price (risk premium in the margin)',()=>{
  let s=play(start('p3-prem',0,2600),[600,'f','f']);s=heroActs(s,'c');s=seq(s,['f','f']);
  s=play(s,[700]);s=heroActs(s,'c');s=play(s,[800]);
  const v=see(s,['5s','4s'],['As','8d','3c','5h']);
  const cashAd=advise(v,{mode:'cash',money})!;expect(cashAd.action).toBe('call');
  expect(cashAd.numbers.some(n=>n.label==='Tournament risk premium')).toBe(false);
  const tAd=advise(v,{mode:'tournament',money})!;
  expect(tAd.action).toBe('fold');
  expect(tAd.numbers.some(n=>n.label==='Tournament risk premium'&&n.basis==='rule')).toBe(true);
  expect(tAd.why.alternatives).toMatch(/chips lost cost more than chips won gain/);
 });
 it('bubble context tightens the shove chart and names the stage; without context the chart is unchanged',()=>{
  const s=play(start('p3-push',0,2000,6,tourney),['f','f','f']); // Hero on the button, 10bb
  const plain=advise(see(s,['As','Ad']),{mode:'tournament',money})!;
  expect(plain.numbers.find(n=>/Shoving range/.test(n.label))!.value).toMatch(/top 38%/);
  const ctx={playersLeft:7,paidPlaces:6,prizes:[5000,3000,2000,1200,800,500],stacks:[2000,2000,2000,2000,2000,2000,2000],heroIndex:0};
  const bub=advise(see(s,['As','Ad']),{mode:'tournament',money,tournament:ctx})!;
  expect(bub.action).toBe('all-in');
  expect(bub.numbers.find(n=>/Shoving range/.test(n.label))!.value).toMatch(/top 32%/);
  expect(bub.numbers.some(n=>n.label==='Tournament stage'&&n.value==='on the bubble')).toBe(true);
  expect(bub.numbers.some(n=>n.label==='Stack depth')).toBe(true);
 });
});

describe('stake-band pool profiles reach the panel numbers',()=>{
 it('the river bluff-share figure follows the stake band: 32% live-mixed, 13% low, 10% micro',()=>{
  const seq2=(s:GameState,actions:Step[])=>{for(const a of actions)s=act(s,toA(a));return s;};
  let s=play(start('p3-pool',0,2200),[600,'f','f']);s=heroActs(s,'c');s=seq2(s,['f','f']);
  s=play(s,['x']);s=heroActs(s,'x');s=play(s,['x']);s=heroActs(s,'x');s=play(s,[900]);
  const v=see(s,['9c','8c'],['Kd','7c','2s','9h','4d']);
  const row=(o:object)=>advise(v,{mode:'cash',money,...o})!.numbers.find(n=>n.label==='Pool river bets that are bluffs')!.value;
  expect(row({})).toBe('32%');expect(row({stake:'low'})).toBe('13%');expect(row({stake:'micro'})).toBe('10%');expect(row({stake:'high'})).toBe('32%');
 });
});

describe('lessons and the observation boundary',()=>{
 it('the engine-spec lessons exist for both tracks',()=>{
  for(const id of ['decision-priority','equity-realization','alpha-mdf','spr-commit','geometric-sizing','barrel-plan','icm','depth-rotation','pool-tendencies'])
   expect(LESSONS[id],id).toBeDefined();
  expect(LESSONS['icm'].body).toMatch(/Tournaments only/);
 });
 it('advice is identical when another seat’s cards are (hypothetically) written into the view: the coach never reads them',()=>{
  const s=play(start('p3-bound',4),['f','f',20000,'f','f']);
  const a=advise(see(s,['Js','Jd']),{mode:'cash',money})!;
  const leaked=see(s,['Js','Jd']);leaked.seats.find(x=>x.id===3)!.hole=['As','Ad'];
  const b=advise(leaked,{mode:'cash',money})!;
  expect(b.action).toBe(a.action);expect(b.headline).toBe(a.headline);
  expect(b.alternatives?.map(x=>[x.action,x.ev])).toEqual(a.alternatives?.map(x=>[x.action,x.ev]));
 });
});
