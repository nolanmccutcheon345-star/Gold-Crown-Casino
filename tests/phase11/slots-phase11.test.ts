import {describe,it,expect} from 'vitest';
import {anticipatedReels,anticipation,anticipationHoldMs,scatterPayTease,teasedReels,SlotsPlayer} from '../../src/slots/play';
import {machineById} from '../../src/slots/machines';
import {freshSlots} from '../../src/slots/state';
import {freshSlotsUi,slotsMarkup,symbolArt} from '../../src/slots/view';
import {streetBudgetDelay,STREET_BUDGET_FLOOR_MS} from '../../src/ui/think-time';

/* Phase 11: Anticipation 2.0 state, pacing profiles, real free spins, Hold & Spin
 * drama, the sound on-ramp, and the EA-F01 street budget. Presentation only — every
 * test that plays a spin also checks the balance invariant (paid at the press). */
let queue:(()=>void)[]=[];
(globalThis as Record<string, unknown>).window={setTimeout:(f:()=>void)=>{queue.push(f);return queue.length;},clearTimeout:()=>{},setInterval:()=>0};
(globalThis as Record<string, unknown>).clearInterval=()=>{};
const store=new Map<string,string>();(globalThis as Record<string, unknown>).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const deps={render(){},sound(){},active:()=>true,motion:()=>true};
const stepOnce=()=>{const f=queue.shift();if(f)f();};

describe('anticipation 2.0',()=>{
 const g=(cols:string[][])=>cols;
 it('stops teasing the moment the trigger is secured',()=>{
  const m=machineById('gold-rush')!;
  // Third nugget lands on reel 2: reels 3 and 4 must NOT be teased any more.
  expect(anticipatedReels(m,g([['nug','A','K'],['nug','Q','J'],['nug','K','Q'],['A','K','Q'],['A','K','Q']]))).toEqual([2]);
  // Nothing lands after one short: every remaining reel is teased (the pinned case).
  expect(anticipatedReels(m,g([['nug','A','K'],['nug','Q','J'],['A','K','Q'],['A','K','Q'],['A','K','Q']]))).toEqual([2,3,4]);
 });
 it('escalates: each successive teased reel holds longer',()=>{
  const teased=[2,3,4];
  expect(anticipationHoldMs(teased,2)).toBe(600);
  expect(anticipationHoldMs(teased,3)).toBe(1200);
  expect(anticipationHoldMs(teased,4)).toBe(1800);
  expect(anticipationHoldMs(teased,0)).toBe(0);
 });
 it('wheel machines tease only the deciding reel, and only when the symbol lands',()=>{
  const cw=machineById('crown-wheel')!;expect(anticipation(cw)).toEqual({sym:'crown',need:1});
  const grid=Array.from({length:5},()=>['A','K','Q']);grid[4][1]='crown';
  expect(anticipatedReels(cw,grid)).toEqual([4]);
  grid[4][1]='A';expect(anticipatedReels(cw,grid)).toEqual([]);
 });
 it('scatter-pay pearls tease toward the lowest paying count, then stop',()=>{
  const m=machineById('poseidons-bounty')!;
  const grid=[['pearl','A','K'],['pearl','Q','J'],['pearl','A','K'],['pearl','K','Q'],['A','K','Q']];
  // Four pearls down, one short of five: only reels after the count reached 4 tease.
  expect(scatterPayTease(m,grid)).toEqual([4]);
  grid[4][0]='pearl'; // the fifth lands on the last reel — it is teased, nothing after it exists
  expect(scatterPayTease(m,grid)).toEqual([4]);
  const early=[['pearl','A','K'],['pearl','Q','J'],['A','K','Q'],['A','K','Q'],['A','K','Q']];
  expect(scatterPayTease(m,early)).toEqual([]);
  expect(teasedReels(m,early)).toEqual(anticipatedReels(m,early));
 });
});

describe('EA-F01 street budget',()=>{
 it('caps a street once its think budget is spent, and only then',()=>{
  expect(streetBudgetDelay(0,3000,6500)).toBe(3000);
  expect(streetBudgetDelay(6499,3000,6500)).toBe(3000);
  expect(streetBudgetDelay(6500,3000,6500)).toBe(STREET_BUDGET_FLOOR_MS);
  expect(streetBudgetDelay(9000,120,6500)).toBe(120);
 });
});

describe('sound on-ramp (S-U01)',()=>{
 it('the floor and the machine both carry a sound toggle and a volume slider',()=>{
  const ui=freshSlotsUi();ui.soundOn=false;ui.volume=70;
  const floor=slotsMarkup(freshSlots(),ui);
  expect(floor).toContain('id="slots-sound-toggle"');expect(floor).toContain('id="slots-sound-volume"');
  expect(floor).toContain('Sound on for the full experience');
  ui.machine='gold-rush';const machine=slotsMarkup(freshSlots(),ui);
  expect(machine).toContain('id="slots-sound-toggle"');expect(machine).toContain('id="slots-sound-volume"');
 });
 it('the hint dismisses for good',()=>{
  queue=[];const ui=freshSlotsUi();const p=new SlotsPlayer(freshSlots(),ui,deps);
  expect(ui.soundHint).toBe(true);p.dismissSoundHint();expect(ui.soundHint).toBe(false);
  const ui2=freshSlotsUi();new SlotsPlayer(freshSlots(),ui2,deps);expect(ui2.soundHint).toBe(false);
 });
 it('reel art loads eager with high priority when asked (S-U02)',()=>{
  const m=machineById('gold-rush')!;
  expect(symbolArt(m,'nugget',true)).toContain('loading="eager"');
  expect(symbolArt(m,'nugget',true)).toContain('fetchpriority="high"');
  expect(symbolArt(m,'nugget')).toContain('loading="lazy"');
 });
});

describe('feature presentation',()=>{
 it('free spins really roll in the Standard profile, and the balance never moves after the press',()=>{
  queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer({...freshSlots(),balance:100000000},ui,deps);p.open('stampede-run');
  let sawRoll=false,sawFeature=false,spins=0;
  while(spins<600&&!sawFeature){
   const before=p.state.balance;p.spin();spins++;const r=ui.result!;
   expect(p.state.balance).toBe(before-r.bet+r.total);
   let slammed=false;
   for(let i=0;i<3000&&ui.phase!=='done';i++){
    if(ui.phase==='free'){sawFeature=true;if(ui.freeRoll&&ui.stopped<5)sawRoll=true;}
    if(ui.overlay)p.skip();else if(ui.phase==='spinning'&&!slammed){p.slam();slammed=true;}else stepOnce();
   }
   expect(ui.phase).toBe('done');expect(p.state.balance).toBe(before-r.bet+r.total);
  }
  expect(sawFeature).toBe(true);expect(sawRoll).toBe(true);
 },120000);
 it('Hold & Spin rolls its respins and tallies coin by coin in the Standard profile',()=>{
  queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer({...freshSlots(),balance:100000000},ui,deps);p.open('lucky-lightning');
  let sawRoll=false,sawTally=false,sawHold=false,spins=0;
  while(spins<900&&!sawHold){
   const before=p.state.balance;p.spin();spins++;const r=ui.result!;
   expect(p.state.balance).toBe(before-r.bet+r.total);
   let slammed=false;
   for(let i=0;i<3000&&ui.phase!=='done';i++){
    if(ui.phase==='hold'){sawHold=true;if(ui.holdRoll)sawRoll=true;if(ui.tally>0)sawTally=true;}
    if(ui.overlay)p.skip();else if(ui.phase==='spinning'&&!slammed){p.slam();slammed=true;}else stepOnce();
   }
   expect(ui.phase).toBe('done');expect(p.state.balance).toBe(before-r.bet+r.total);
  }
  expect(sawHold).toBe(true);expect(sawRoll).toBe(true);expect(sawTally).toBe(true);
 },120000);
 it('the Fast profile keeps the frame-swap pace and still finishes every feature',()=>{
  queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer({...freshSlots(),balance:100000000},ui,deps);p.open('stampede-run');p.toggleTurbo();
  let sawFeature=false;
  for(let s=0;s<600&&!sawFeature;s++){
   const before=p.state.balance;p.spin();const r=ui.result!;
   let slammed=false;
   for(let i=0;i<3000&&ui.phase!=='done';i++){
    if(ui.phase==='free'){sawFeature=true;expect(ui.freeRoll).toBe(false);}
    if(ui.overlay)p.skip();else if(ui.phase==='spinning'&&!slammed){p.slam();slammed=true;}else stepOnce();
   }
   expect(ui.phase).toBe('done');expect(p.state.balance).toBe(before-r.bet+r.total);
  }
  expect(sawFeature).toBe(true);
 },120000);
 it('a Skip feature control is offered during features, and the spin button advances instead of disabling',()=>{
  const ui=freshSlotsUi();ui.machine='gold-rush';ui.phase='free';ui.result=null;
  const h=slotsMarkup(freshSlots(),ui);
  expect(h).toContain('id="slots-skip-feature"');
  expect(h).toContain('Advance the feature');
  ui.phase='idle';expect(slotsMarkup(freshSlots(),ui)).not.toContain('id="slots-skip-feature"');
 });
});
