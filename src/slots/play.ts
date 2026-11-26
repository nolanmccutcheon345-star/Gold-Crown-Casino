import {slotNeighbour} from '../bots/table-life';
/** Patch 92: playing a slot machine: the spin, the show around it, autoplay and the session record. The result is
 * paid and saved the moment you press Spin (state.ts); everything here is presentation and pacing, so anticipation,
 * slam-stop, turbo and overlays never change what a spin pays. */
import type {Machine,SpinResult} from './engine';
import {machineById} from './machines';
import {playSpin,reloadSlots,saveSlots,gamble,GAMBLE_ROUNDS,type SlotsState,type GambleChoice} from './state';
import {betFor,smallestBet,type SlotsUi} from './view';
import {symbolImage} from './symbol-images';

export type SlotSound='flip'|'lose'|'shuffle'|'reel'|'anticipate'|'levelup'|'chip'|'flip'|'money'|'win'|'champion'|'bigwin'|'fold'|'bells'
 /* Phase 11 layers */|'whirr'|'scatterland'|'clink'|'wheeltick'|'countup'|'countupbig'|'megawin'|'epicwin'|'vault'|'gliss'|'chest'|'retrigger'|'teaseland'|'teasemiss'|'reset';
export interface SlotDeps {render():void;sound(kind:SlotSound,opt?:{ms?:number;pitch?:number}):void;active():boolean;motion():boolean}
export interface AutoPlan {count:number;stopFeature:boolean;stopBig:boolean;
 /** Stop when you are this many cents down since autoplay started (0 = no limit). */
 lossLimit:number}
export const AUTO_COUNTS=[10,25,50,100] as const;
export const LOSS_LIMITS=[0,1000,2500,5000,10000,25000] as const;
const PREFS='poker-night-ai:slots-prefs';
export const BIG_WIN=15,MEGA_WIN=40,EPIC_WIN=100;
export const winTier=(total:number,bet:number)=>total>=EPIC_WIN*bet?'EPIC WIN':total>=MEGA_WIN*bet?'MEGA WIN':total>=BIG_WIN*bet?'BIG WIN':null;

/** The bonus symbol whose arrival builds anticipation, and how many are needed. */
export function anticipation(m:Machine):{sym:string;need:number;reels?:number[]}|null {
 if(m.cascade)return null;
 if(m.pick)return {sym:m.pick.sym,need:m.pick.trigger};
 if(m.scatter)return {sym:m.scatter.sym,need:Math.min(...Object.keys(m.scatter.freeSpins).map(Number))};
 if(m.coin)return {sym:m.coin.sym,need:m.coin.trigger};
 if(m.wheel)return {sym:m.wheel.sym,need:1};
 return null;
}
/** Phase 11 (Anticipation 2.0): reels that keep spinning longer because the bonus is one
 * symbol away. A reel is teased only while the count sits at exactly one short, and the
 * tease STOPS the moment the trigger is secured — no theatre after the fact. The wheel
 * machines tease only their one deciding reel, and only when the symbol actually lands
 * there (the tease dramatises the drawn result; it never manufactures a near-miss). */
export function anticipatedReels(m:Machine,grid:readonly (readonly string[])[]):number[] {
 const a=anticipation(m);if(!a)return [];
 if(m.wheel)return grid[m.wheel.reel]?.[m.wheel.row]===a.sym?[m.wheel.reel]:[];
 const out:number[]=[];let seen=0;
 for(let reel=0;reel<grid.length;reel++){
  if(seen===a.need-1)out.push(reel);
  seen+=grid[reel].filter(s=>s===a.sym).length;
  if(seen>=a.need)break;
 }
 // Never for the first reel.
 return out.filter(r=>r>0);
}
/** Phase 11: scatter-pay machines (Poseidon's pearls) tease the same way toward their
 * lowest paying count — one short, and only until the count is reached. */
export function scatterPayTease(m:Machine,grid:readonly (readonly string[])[]):number[] {
 if(!m.scatterPay)return [];
 const need=Math.min(...Object.keys(m.scatterPay.pays).map(Number)),sym=m.scatterPay.sym;
 const out:number[]=[];let seen=0;
 for(let reel=0;reel<grid.length;reel++){
  if(seen===need-1)out.push(reel);
  seen+=grid[reel].filter(s=>s===sym).length;
  if(seen>=need)break;
 }
 return out.filter(r=>r>0);
}
/** Every reel this spin teases, in stop order: the feature trigger plus scatter-pay. */
export function teasedReels(m:Machine,grid:readonly (readonly string[])[]):number[] {
 return [...new Set([...anticipatedReels(m,grid),...scatterPayTease(m,grid)])].sort((a,b)=>a-b);
}
/** Phase 11: the tease escalates — each successive teased reel holds longer than the last. */
export const TEASE_BASE_MS=600,TEASE_STEP_MS=600;
export function anticipationHoldMs(teased:readonly number[],reel:number):number {
 const i=teased.indexOf(reel);return i<0?0:TEASE_BASE_MS+i*TEASE_STEP_MS;
}
/** Phase 11 (S-U02): opening a machine preloads its full symbol set (plus marquee and
 * cinematic art) so the first paint already has the photographic reels. Best-effort. */
export function preloadMachineArt(m:Machine):void {
 try{
  const Img=(globalThis as {Image?:new()=>{src:string}}).Image;if(!Img)return;
  const urls=new Set<string>();
  for(const s of Object.values(m.symbols)){const u=symbolImage(m.id,s.art);if(u)urls.add(u);}
  urls.add(`/casino-art/${m.id}-marquee.webp`);urls.add(`/casino-art/${m.id}-cinematic.webp`);
  for(const u of urls){const img=new Img();img.src=u;}
 }catch{/* preload is decoration only */}
}

export class SlotsPlayer {
 state:SlotsState;ui:SlotsUi;
 private timer=0;private cycle=0;private after:(()=>void)|null=null;private pickDone:(()=>void)|null=null;
 /* Phase 11: every wait carries a generation. A step that was superseded by a newer
  * wait, or already consumed early by skip/tap-to-advance, can never fire a second
  * time — multi-step feature chains (real free-spin rolls, respin rolls) would
  * otherwise fork when an overlay is tapped through. */
 private waitGen=0;
 constructor(state:SlotsState,ui:SlotsUi,private deps:SlotDeps){this.state=state;this.ui=ui;
  try{const p=JSON.parse(localStorage.getItem(PREFS)??'{}');ui.turbo=p.turbo===true;ui.soundHint=p.soundHint!==false;if(p.plan&&AUTO_COUNTS.includes(p.plan.count)&&LOSS_LIMITS.includes(p.plan.lossLimit))ui.autoPlan={count:p.plan.count,stopFeature:p.plan.stopFeature!==false,stopBig:p.plan.stopBig!==false,lossLimit:p.plan.lossLimit};
   if(Array.isArray(p.favs))ui.favs=p.favs.filter((x:unknown)=>typeof x==='string'&&!!machineById(x));if(['floor','played','payback','calm'].includes(p.sort))ui.sort=p.sort;
   if(p.bets&&typeof p.bets==='object')for(const [id,b] of Object.entries(p.bets))if(machineById(id)?.bets.includes(b as number))ui.bet[id]=b as number;}catch{/* defaults */}}
 private savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify({turbo:this.ui.turbo,plan:this.ui.autoPlan,bets:this.ui.bet,favs:this.ui.favs,sort:this.ui.sort,soundHint:this.ui.soundHint}));}catch{/* this visit only */}}
 /** Phase 11 (S-U01): the one-time sound hint on the slots floor, dismissed for good. */
 dismissSoundHint(){if(!this.ui.soundHint)return;this.ui.soundHint=false;this.savePrefs();}
 /** Patch 103: star or unstar a machine, and sort the floor. */
 toggleFav(id:string){if(!machineById(id))return;this.ui.favs=this.ui.favs.includes(id)?this.ui.favs.filter(x=>x!==id):[...this.ui.favs,id];this.savePrefs();}
 setSort(s:string){if(s==='floor'||s==='played'||s==='payback'||s==='calm'){this.ui.sort=s;this.savePrefs();}}
 private get m():Machine|undefined{return machineById(this.ui.machine??'');}
 private wait(ms:number,work:()=>void){const gen=++this.waitGen;clearTimeout(this.timer);this.after=work;this.timer=window.setTimeout(()=>{if(gen!==this.waitGen)return;this.timer=0;this.after=null;if(!this.deps.active()){this.finishNow();return;}work();this.deps.render();},this.ui.turbo?Math.round(ms*.55):ms);}
 private stopCycle(){clearInterval(this.cycle);this.cycle=0;this.ui.lineIndex=-1;}
 get busy(){return this.ui.phase!=='idle'&&this.ui.phase!=='done';}

 open(id:string){this.finishNow();this.stopCycle();Object.assign(this.ui,{gamble:null,machine:id,result:null,phase:'idle',auto:0,error:'',overlay:null,autoOpen:false,neighbour:null,freeRoll:false,holdRoll:false,tally:-1,tease:false});const m=machineById(id);if(m)preloadMachineArt(m);}
 back(){this.finishNow();this.stopCycle();Object.assign(this.ui,{gamble:null,machine:null,result:null,phase:'idle',auto:0,overlay:null,autoOpen:false,freeRoll:false,holdRoll:false,tally:-1,tease:false});}
 setBet(b:number){const m=this.m;if(m&&m.bets.includes(b)&&!this.busy){this.ui.bet[m.id]=b;this.savePrefs();}}
 maxBet(){const m=this.m;if(!m||this.busy)return;const b=[...m.bets].reverse().find(x=>x<=this.state.balance);if(b!==undefined){this.ui.bet[m.id]=b;this.savePrefs();}}
 toggleTurbo(){this.ui.turbo=!this.ui.turbo;this.savePrefs();}
 setPlan(p:Partial<AutoPlan>){this.ui.autoPlan={...this.ui.autoPlan,...p};this.savePrefs();}
 startAuto(){const m=this.m;if(!m||this.busy)return;this.ui.auto=this.ui.autoPlan.count;this.ui.autoStart=this.state.balance;this.ui.autoOpen=false;this.spin();}
 stopAuto(){this.ui.auto=0;}
 reload(){this.state=reloadSlots(this.state,smallestBet());saveSlots(this.state);this.ui.notice='Your slots balance is back to $1,000 of practice chips.';this.ui.error='';}
 /** Space bar or the Spin button: spin when idle, slam the reels when spinning, skip an overlay.
  * Phase 11 (S-U03): during a feature, pressing advances the presentation to the next step
  * at once — the result was settled at the original spin and can never change. */
 press(){if(this.ui.gamble){if(!this.ui.gamble.done)this.collect();return;}if(this.ui.overlay){this.skip();return;}if(this.ui.phase==='spinning'){this.slam();return;}if(this.busy){this.firePending();return;}this.spin();}
 /** Run the pending presentation step now instead of waiting out its timer. */
 private firePending(){const next=this.after;if(!next)return;clearTimeout(this.timer);this.timer=0;this.after=null;this.waitGen++;next();this.deps.render();}
 /** Phase 11 (S-U03): settle a feature's presentation instantly (the money is already settled). */
 skipFeature(){if(!this.busy||this.ui.phase==='pick'||this.ui.phase==='spinning')return;this.finishNow();this.deps.render();}
 /** Tap the reels while they spin: stop them all now. */
 slam(){const m=this.m;if(!m||this.ui.phase!=='spinning'||this.ui.stopped>=m.reels.length)return;clearTimeout(this.timer);this.ui.stopped=m.reels.length;this.ui.anticipate=[];this.deps.sound('reel');this.wait(120,()=>this.afterBase());this.deps.render();}
 /** Tap an overlay to move on. */
 skip(){if(!this.ui.overlay)return;const next=this.after;clearTimeout(this.timer);this.timer=0;this.after=null;this.waitGen++;this.ui.overlay=null;if(next)next();this.deps.render();}

 spin(){
  const m=this.m;if(!m||this.busy)return;
  this.ui.gamble=null;this.ui.gambleTaken=false;
  const bet=betFor(m,this.ui,this.state.balance);
  this.ui.error='';this.ui.notice='';this.stopCycle();
  let result:SpinResult;
  try{const played=playSpin(this.state,m,bet);this.state=played.state;saveSlots(this.state);result=played.result;}
  catch(cause){this.ui.error=(cause as Error).message;this.ui.auto=0;this.deps.render();return;}
  Object.assign(this.ui,{result,pending:result.total,phase:'spinning',stopped:0,step:0,picked:[],overlay:null,anticipate:teasedReels(m,result.grid),freeRoll:false,holdRoll:false,tally:-1,tease:false});
  this.ui.bet[m.id]=bet;
  this.deps.sound('whirr');
  // Phase 11 pacing (S-F03): the standard base cycle is ~1.5s (lead + staggered stops +
  // settle), toward the 1.5–3s commercial norm; the Fast profile (ui.turbo, via wait())
  // keeps the old snappy values, and slam-stop is always there. Anticipation 2.0: a
  // teased reel holds for an escalating time while the riser climbs, a bonus symbol
  // landing gets its own sting, and the tease resolves — sting on land, soft drop on miss.
  const gap=210,lead=this.deps.motion()?380:60,a=anticipation(m);
  const stopNext=()=>{this.ui.stopped++;const stoppedReel=this.ui.stopped-1;
   this.deps.sound('reel');
   const landedBonus=!!a&&result.grid[stoppedReel]?.includes(a.sym);
   const landedTease=landedBonus||(!!m.scatterPay&&result.grid[stoppedReel]?.includes(m.scatterPay.sym));
   if(this.ui.anticipate.includes(stoppedReel)&&(a||m.scatterPay)){
    if(landedTease)this.deps.sound('teaseland');
    else if(!this.ui.anticipate.some(r=>r>stoppedReel))this.deps.sound('teasemiss');
   }else if(landedBonus)this.deps.sound('scatterland');
   if(this.ui.stopped<m.reels.length){const nextReel=this.ui.stopped,slow=this.ui.anticipate.includes(nextReel),hold=slow?anticipationHoldMs(this.ui.anticipate,nextReel):0;
    if(slow)this.deps.sound('anticipate',{ms:hold+gap});
    this.wait(gap+hold,stopNext);}
   else{this.ui.anticipate=[];this.wait(150,()=>this.afterBase());}};
  this.wait(lead,stopNext);
  this.deps.render();
 }
 private intro(title:string,sub:string,then:()=>void,sound:SlotSound='levelup'){this.ui.overlay={kind:'intro',title,sub,amount:0};this.deps.sound(sound);this.wait(1500,()=>{this.ui.overlay=null;then();});}
 private afterBase(){
  const r=this.ui.result!,m=this.m!,stages:(()=>void)[]=[];
  const next=()=>{const st=stages.shift();if(st)st();else this.outro();};
  if(r.cascade&&r.cascade.frames.length>1)stages.push(()=>{this.ui.phase='cascade';this.ui.step=0;
   /* Phase 11 (S-U06): cascade machines tease too — a settled frame sitting one scatter
    * short of the free-spins trigger glows and climbs while the next tumble is pending,
    * and resolves when the trigger frame lands. Reads the precomputed frames only. */
   const a=m.scatter?{sym:m.scatter.sym,need:Math.min(...Object.keys(m.scatter.freeSpins).map(Number))}:null;
   const frameTease=(idx:number)=>{if(!a||!r.free)return;const n=r.cascade!.frames[idx].grid.flat().filter(s=>s===a.sym).length;
    if(n===a.need-1){this.ui.tease=true;this.deps.sound('anticipate',{ms:700});}
    else{if(this.ui.tease&&n>=a.need)this.deps.sound('teaseland');this.ui.tease=false;}};
   frameTease(0);
   const step=()=>{if(this.ui.step<r.cascade!.frames.length-1){this.ui.step++;this.deps.sound('chip');frameTease(this.ui.step);this.wait(this.ui.auto?380:430,step);}else{this.ui.tease=false;this.wait(350,next);}};this.wait(this.ui.auto?450:620,step);});
  if(r.free)stages.push(()=>this.intro('FREE SPINS',`${r.free!.spins.length} free spins${m.scatter!.freeMultiplier>1?` · every win ×${m.scatter!.freeMultiplier}`:m.ways?.freeWild?' · wilds ×2 or ×3':''}`,()=>{
   this.ui.phase='free';this.ui.step=0;
   /* Phase 11 (S-U04): in the Standard profile each free spin is a real spin — strips
    * roll, reels stop staggered left to right (~1.45s a spin), retriggers sweat with
    * the same anticipation machinery as the base game, and the banner's running total
    * counts what has actually landed. The Fast profile keeps the old frame-swap pace.
    * Either way the precomputed spins are presented, never recomputed. */
   if(this.ui.turbo){const step=()=>{if(this.ui.step<r.free!.spins.length-1){this.ui.step++;this.deps.sound(r.free!.spins[this.ui.step].total>0?'money':'flip');this.wait(this.ui.auto?360:600,step);}else this.wait(500,next);};this.wait(650,step);return;}
   const spins=r.free!.spins,a=anticipation(m);
   const playSpin=(idx:number)=>{
    const f=spins[idx];this.ui.step=idx;this.ui.freeRoll=true;this.ui.stopped=0;this.ui.anticipate=teasedReels(m,f.grid);
    this.deps.sound('whirr');
    const gapF=this.ui.auto?110:160,leadF=this.ui.auto?260:400;
    const stopNext=()=>{this.ui.stopped++;const stoppedReel=this.ui.stopped-1;this.deps.sound('reel');
     const landed=!!a&&f.grid[stoppedReel]?.includes(a.sym);
     if(this.ui.anticipate.includes(stoppedReel)&&a){if(landed)this.deps.sound('teaseland');else if(!this.ui.anticipate.some(x=>x>stoppedReel))this.deps.sound('teasemiss');}
     else if(landed)this.deps.sound('scatterland');
     if(this.ui.stopped<m.reels.length){const nx=this.ui.stopped,slow=this.ui.anticipate.includes(nx),hold=slow?anticipationHoldMs(this.ui.anticipate,nx):0;if(slow)this.deps.sound('anticipate',{ms:hold+gapF});this.wait(gapF+hold,stopNext);}
     else{this.ui.anticipate=[];this.ui.freeRoll=false;
      if(a&&m.scatter&&f.grid.flat().filter(s=>s===a.sym).length>=a.need)this.deps.sound('retrigger');
      this.deps.sound(f.total>0?'money':'flip');
      this.wait(this.ui.auto?300:420,()=>{if(idx<spins.length-1)playSpin(idx+1);else this.wait(400,next);});}};
    this.wait(leadF,stopNext);};
   playSpin(0);},'bells'));
  if(r.hold)stages.push(()=>this.intro('HOLD & SPIN',`${r.hold!.frames[0].grid.flat().filter(x=>x!==null).length} coins locked · 3 respins`,()=>{
   this.ui.phase='hold';this.ui.step=0;
   /* Phase 11 (S-U09): in the Standard profile the open spaces genuinely respin —
    * they roll, stop, and only then does the precomputed frame show. A new coin lands
    * with a clink ladder and, when it resets the counter, a reset chime and a beat.
    * The final respin crawls when the grid is nearly full (the Grand sweat). At the
    * end the total tallies coin by coin. The Fast profile keeps the old frame swaps. */
   if(this.ui.turbo){const step=()=>{if(this.ui.step<r.hold!.frames.length-1){this.ui.step++;this.deps.sound('chip');this.wait(460,step);}else this.wait(600,next);};this.wait(550,step);return;}
   const frames=r.hold!.frames,cells=m.reels.length*m.rows;
   const coinsIn=(f:{grid:(number|null)[][]})=>f.grid.flat().filter(x=>x!==null).length;
   const tally=()=>{const coins=r.hold!.coins;let k=0;this.ui.tally=0;
    if(!coins.length){this.wait(300,next);return;}
    const tick=()=>{k++;this.ui.tally=k;this.deps.sound('clink',{pitch:1+k*.06});this.deps.render();if(k<coins.length)this.wait(120,tick);else this.wait(550,next);};
    this.wait(200,tick);};
   const stepTo=(idx:number)=>{
    const f=frames[idx],prev=frames[idx-1];
    let newCoins=0;f.grid.forEach((col,reel)=>col.forEach((v,row)=>{if(v!==null&&prev.grid[reel][row]===null)newCoins++;}));
    const lastRespin=idx===frames.length-1&&prev.respins===1,crawl=lastRespin&&coinsIn(prev)>=cells-3;
    this.ui.step=idx;this.ui.holdRoll=true;this.deps.sound('whirr');
    if(crawl)this.deps.sound('anticipate',{ms:1250});
    this.wait(crawl?1300:640,()=>{
     this.ui.holdRoll=false;
     if(newCoins>0){for(let k=0;k<newCoins;k++)this.deps.sound('clink',{pitch:1+k*.09});if(f.respins===3&&prev.respins<3)this.deps.sound('reset');}
     else this.deps.sound('chip');
     this.deps.render();
     this.wait(430,()=>{if(idx<frames.length-1)stepTo(idx+1);else tally();});});};
   if(frames.length>1)this.wait(550,()=>stepTo(1));else tally();},'vault'));
  if(r.wheel)stages.push(()=>this.intro('BONUS WHEEL',`Spin for up to ${Math.max(...m.wheel!.segments.map(s=>s.x))}× your bet`,()=>{this.ui.phase='wheel';this.deps.sound('wheeltick');this.wait(2900,next);},'gliss'));
  if(r.pick)stages.push(()=>this.intro('TREASURE CHESTS',`Pick ${r.pick!.prizes.length} chests`,()=>{this.ui.phase='pick';this.ui.picked=[];this.pickDone=next;if(this.ui.auto)this.wait(900,()=>this.autoPick());},'chest'));
  next();
 }
 pick(index:number){
  const r=this.ui.result,m=this.m;if(!r?.pick||!m?.pick||this.ui.phase!=='pick'||this.ui.picked.includes(index)||index<0||index>=m.pick.board||this.ui.picked.length>=r.pick.prizes.length)return;
  this.ui.picked.push(index);this.deps.sound('money');
  if(this.ui.picked.length>=r.pick.prizes.length){const done=this.pickDone;this.pickDone=null;this.wait(1500,()=>done?.());}
  else if(this.ui.auto)this.wait(700,()=>this.autoPick());
  this.deps.render();
 }
 private autoPick(){const m=this.m;if(!m?.pick)return;const free=Array.from({length:m.pick.board},(_,i)=>i).filter(i=>!this.ui.picked.includes(i));this.pick(free[Math.floor(free.length/2)]);}
 /** After a feature: its total; then a big-win celebration if earned; then done. */
 private outro(){
  const r=this.ui.result!,feature=(r.free?.total??0)+(r.hold?.total??0)+(r.wheel?.amount??0)+(r.pick?.amount??0)+(r.cascade&&r.cascade.frames.length>1?r.lineTotal:0);
  const celebrate=()=>{const tier=winTier(r.total,r.bet);
   /* Phase 11 (S-U03): the Fast profile no longer deletes the big-win celebration —
    * it gets a shortened count-up instead. Each tier has its own fanfare (S-U07),
    * and a tick stream runs under the tally. */
   if(tier){this.ui.overlay={kind:'big',title:tier,sub:`${Math.round(r.total/r.bet)}× your bet`,amount:r.total};this.deps.sound(tier==='EPIC WIN'?'epicwin':tier==='MEGA WIN'?'megawin':'bigwin');this.deps.sound('countupbig',{ms:this.ui.turbo?1050:2100});this.wait(this.ui.turbo?1300:tier==='BIG WIN'?2200:3000,()=>{this.ui.overlay=null;this.finish();});}
   else this.finish();};
  if((r.free||r.hold||r.wheel||r.pick)&&feature>0){this.ui.overlay={kind:'outro',title:'FEATURE WIN',sub:r.free?`${r.free.spins.length} free spins`:r.hold?(r.hold.full?'GRAND JACKPOT!':`${r.hold.coins.length} coins`):r.wheel?`Wheel ×${r.wheel.x}`:'Treasure',amount:feature};this.deps.sound('money');this.deps.sound('countup',{ms:850});this.wait(1500,()=>{this.ui.overlay=null;celebrate();});}
  else celebrate();
 }
 private finish(){
  const r=this.ui.result;if(!r||this.ui.phase==='done'||this.ui.phase==='idle')return;
  this.ui.phase='done';this.ui.pending=0;this.pickDone=null;this.ui.overlay=null;this.ui.freeRoll=false;this.ui.holdRoll=false;this.ui.tease=false;
  const s=this.ui.session,feature=!!(r.free||r.hold||r.wheel||r.pick);
  s.spins++;s.wagered+=r.bet;s.won+=r.total;s.best=Math.max(s.best,r.total);if(feature)s.features++;s.recent=[...s.recent,{total:r.total,bet:r.bet,feature}].slice(-14);
  /* Phase 13 (S-6): mirror the same spin into the per-machine visit record the
   * THIS VISIT strip now reads. The all-machines record above still feeds the
   * neighbour feature. */
  if(this.m){const ms=this.ui.machineSessions[this.m.id]??{spins:0,wagered:0,won:0,best:0,features:0,recent:[]};ms.spins++;ms.wagered+=r.bet;ms.won+=r.total;ms.best=Math.max(ms.best,r.total);if(feature)ms.features++;ms.recent=[...ms.recent,{total:r.total,bet:r.bet,feature}].slice(-14);this.ui.machineSessions[this.m.id]=ms;}
  // Patch 98: the player at the next machine reacts now and then. Display only.
  if(this.m){const nb=slotNeighbour(this.m.id,s.spins,{total:r.total,bet:r.bet,feature,big:!!winTier(r.total,r.bet)},s.recent);this.ui.neighbour=nb?{...nb,spin:s.spins}:(this.ui.neighbour&&s.spins-this.ui.neighbour.spin<2?this.ui.neighbour:null);}
  // Phase 11 (S-U07): losses are quiet now — no swish on a zero return, so wins stand out.
  if(r.total>0)this.deps.sound(winTier(r.total,r.bet)&&this.ui.turbo?'champion':r.total>=5*r.bet?'money':'win');
  // Show every winning line together, then one at a time.
  const lines=(r.free?r.free.spins.at(-1)!.wins:r.wins).length;
  if(lines>1&&this.deps.active()){this.ui.lineIndex=-1;this.cycle=window.setInterval(()=>{if(!this.deps.active()||this.ui.phase!=='done'){this.stopCycle();return;}this.ui.lineIndex=(this.ui.lineIndex+1)%lines;this.deps.render();},1300);}
  if(this.ui.auto>0){
   this.ui.auto--;const m=this.m,bet=m?betFor(m,this.ui,this.state.balance):0,plan=this.ui.autoPlan;
   const why=!m?'':this.state.balance<bet?'not enough balance for the next spin':plan.stopFeature&&feature?'a feature was won':plan.stopBig&&winTier(r.total,r.bet)?'a big win landed':plan.lossLimit&&this.ui.autoStart-this.state.balance>=plan.lossLimit?'your loss limit was reached':'';
   if(why){this.ui.notice=`Autoplay stopped: ${why}.`;this.ui.auto=0;}
   else if(this.ui.auto>0&&this.deps.active()){clearTimeout(this.timer);this.timer=window.setTimeout(()=>{this.timer=0;if(this.deps.active()&&this.ui.auto>0&&!this.busy){this.spin();}},this.ui.turbo?250:r.total>0?900:500);}
  }
 }
 /** Patch 93: the double-up, offered once after a winning spin (not during autoplay). */
 get canGamble(){const r=this.ui.result;return !!r&&this.ui.phase==='done'&&r.total>0&&this.ui.auto===0&&!this.ui.gambleTaken&&!this.ui.gamble&&r.total<=this.state.balance;}
 openGamble(){if(!this.canGamble)return;this.stopCycle();this.ui.gambleTaken=true;this.ui.gamble={stake:this.ui.result!.total,round:0,cards:[],done:null};this.deps.sound('flip');}
 choose(choice:GambleChoice){
  const g=this.ui.gamble;if(!g||g.done||g.round>=GAMBLE_ROUNDS)return;
  const out=gamble(this.state,g.stake,choice);this.state=out.state;saveSlots(this.state);
  this.ui.session.won+=out.payout-g.stake;
  if(this.m&&this.ui.machineSessions[this.m.id])this.ui.machineSessions[this.m.id].won+=out.payout-g.stake;
  g.cards=[...g.cards,{card:out.card,won:out.won}];
  if(out.won){g.stake=out.payout;g.round++;this.ui.session.best=Math.max(this.ui.session.best,g.stake);this.deps.sound(g.round>=GAMBLE_ROUNDS?'bigwin':'money');if(g.round>=GAMBLE_ROUNDS){g.done='collected';this.wait(1800,()=>{this.ui.gamble=null;});}}
  else{g.stake=0;g.done='lost';this.deps.sound('lose');this.wait(1700,()=>{this.ui.gamble=null;});}
  this.deps.render();
 }
 collect(){const g=this.ui.gamble;if(!g)return;clearTimeout(this.timer);this.timer=0;this.after=null;this.waitGen++;if(g.stake>0)this.deps.sound('win');this.ui.gamble=null;}
 /** Leaving the machine or the page: settle the show at once (the money is already in the balance). */
 finishNow(){const r=this.ui.result;clearTimeout(this.timer);this.timer=0;this.after=null;this.waitGen++;if(!r||this.ui.phase==='idle'||this.ui.phase==='done')return;this.ui.auto=0;this.ui.overlay=null;this.ui.stopped=this.m?.reels.length??0;this.finish();this.stopCycle();}
}
