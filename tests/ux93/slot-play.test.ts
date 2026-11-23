import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {anticipatedReels,anticipation,winTier,SlotsPlayer} from '../../src/slots/play';
import {MACHINES,machineById} from '../../src/slots/machines';
import {freshSlots} from '../../src/slots/state';
import {freshSlotsUi,slotsMarkup} from '../../src/slots/view';

/* Patch 92: slot gameplay and presentation. */
let queue:(()=>void)[]=[];
(globalThis as any).window={setTimeout:(f:()=>void)=>{queue.push(f);return queue.length;},clearTimeout:()=>{},setInterval:()=>0};
(globalThis as any).clearInterval=()=>{};
const store=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
const drain=(n=400)=>{for(let i=0;i<n&&queue.length;i++){const f=queue.shift()!;f();}};

describe('anticipation',()=>{
  it('reels slow down only when the bonus is one symbol away, never the first reel',()=>{
    const m=machineById('gold-rush')!;expect(anticipation(m)).toEqual({sym:'nug',need:3});
    const g=(cols:string[][])=>cols;
    expect(anticipatedReels(m,g([['nug','A','K'],['nug','Q','J'],['A','K','Q'],['A','K','Q'],['A','K','Q']]))).toEqual([2,3,4]);
    expect(anticipatedReels(m,g([['nug','A','K'],['A','Q','J'],['A','K','Q'],['A','K','Q'],['A','K','Q']]))).toEqual([]);
    expect(anticipation(machineById('gem-cascade')!)).toBeNull();expect(anticipation(machineById('lucky-sevens')!)).toBeNull();
  });
  it('win tiers',()=>{expect(winTier(1400,100)).toBeNull();expect(winTier(1500,100)).toBe('BIG WIN');expect(winTier(4000,100)).toBe('MEGA WIN');expect(winTier(10000,100)).toBe('EPIC WIN');});
});
describe('the player',()=>{
  const deps={render(){},sound(){},active:()=>true,motion:()=>true};
  it('pays at the press, then plays the show to the end; the result never changes',()=>{
    for(const m of MACHINES){
      queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,deps);p.open(m.id);
      for(let k=0;k<30;k++){const before=p.state.balance;p.spin();const r=ui.result!;expect(p.state.balance).toBe(before-r.bet+r.total);
        // Tap through everything the way a player could: slam, skip overlays, pick chests.
        for(let i=0;i<500&&ui.phase!=='done';i++){if(ui.phase==='spinning'&&ui.stopped<m.reels.length)p.slam();else if(ui.overlay)p.skip();else if(ui.phase==='pick'&&ui.picked.length<(ui.result?.pick?.prizes.length??0))p.pick(ui.picked.length);else drain(1);}
        expect(ui.phase,m.id).toBe('done');expect(ui.pending).toBe(0);expect(p.state.balance).toBe(before-r.bet+r.total);}
      expect(ui.session.spins).toBe(30);
    }
  });
  it('autoplay runs its count and stops on its rules',()=>{
    queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,deps);p.open('lucky-sevens');p.setPlan({count:10,stopFeature:true,stopBig:false,lossLimit:0});p.startAuto();
    drain(5000);expect(ui.session.spins).toBe(10);expect(ui.auto).toBe(0);
    queue=[];const ui2=freshSlotsUi(),p2=new SlotsPlayer({...freshSlots(),balance:300},ui2,deps);p2.open('lucky-sevens');p2.setBet(100);p2.setPlan({count:100,stopFeature:false,stopBig:false,lossLimit:0});p2.startAuto();drain(20000);
    if(ui2.session.spins<100)expect(ui2.notice).toMatch(/Autoplay stopped/);else expect(ui2.auto).toBe(0);
    expect(JSON.parse(store.get('poker-night-ai:slots-prefs')!).plan.count).toBe(100);
  });
  it('turbo is remembered; leaving mid-spin settles at once',()=>{
    queue=[];const ui=freshSlotsUi(),p=new SlotsPlayer(freshSlots(),ui,deps);p.toggleTurbo();expect(new SlotsPlayer(freshSlots(),freshSlotsUi(),deps).ui.turbo).toBe(true);
    p.open('gold-rush');p.spin();p.finishNow();expect(ui.phase).toBe('done');expect(ui.pending).toBe(0);
  });
});
describe('screens',()=>{
  it('controls, overlays, the autoplay panel and the visit record draw',()=>{
    const ui=freshSlotsUi();ui.machine='dust-devil';ui.autoOpen=true;ui.session={spins:3,wagered:600,won:900,best:700,features:1,recent:[{total:0,bet:200,feature:false},{total:700,bet:200,feature:true}]};
    ui.overlay={kind:'big',title:'MEGA WIN',sub:'45× your bet',amount:9000};
    const h=slotsMarkup(freshSlots(),ui);
    for(const id of ['slots-max','slots-turbo','slots-auto','slots-spin','slots-skip','slots-auto-start','auto-loss'])expect(h,id).toContain(`id="${id}"`);
    expect(h).toContain('tier-mega');expect(h).toContain('data-testid="slot-session"');
    const app=readFileSync('src/ui/app.ts','utf8');expect(app).toContain("event.code !== 'Space'");expect(readFileSync('src/ui/sounds.ts','utf8')).toContain("case 'anticipate'");
  });
});
