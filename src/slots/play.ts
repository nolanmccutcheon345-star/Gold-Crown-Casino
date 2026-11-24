import {slotNeighbour} from '../bots/table-life';
/** Patch 92: playing a slot machine: the spin, the show around it, autoplay and the session record. The result is
 * paid and saved the moment you press Spin (state.ts); everything here is presentation and pacing, so anticipation,
 * slam-stop, turbo and overlays never change what a spin pays. */
import type {Machine,SpinResult} from './engine';
import {machineById} from './machines';
import {playSpin,reloadSlots,saveSlots,gamble,GAMBLE_ROUNDS,type SlotsState,type GambleChoice} from './state';
import {betFor,smallestBet,type SlotsUi} from './view';

export type SlotSound='flip'|'lose'|'shuffle'|'reel'|'anticipate'|'levelup'|'chip'|'flip'|'money'|'win'|'champion'|'bigwin'|'fold';
export interface SlotDeps {render():void;sound(kind:SlotSound):void;active():boolean;motion():boolean}
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
 return null;
}
/** Reels that keep spinning longer because the bonus is one symbol away (or closer). */
export function anticipatedReels(m:Machine,grid:readonly (readonly string[])[]):number[] {
 const a=anticipation(m);if(!a)return [];
 const out:number[]=[];let seen=0;
 for(let reel=0;reel<grid.length;reel++){
  // How many could still land on this reel and the ones after it.
  if(seen>=a.need-1&&seen<a.need+3)out.push(reel);
  seen+=grid[reel].filter(s=>s===a.sym).length;
 }
 // Never for the first reel, and only while a bonus is still possible.
 return out.filter(r=>r>0);
}

export class SlotsPlayer {
 state:SlotsState;ui:SlotsUi;
 private timer=0;private cycle=0;private after:(()=>void)|null=null;private pickDone:(()=>void)|null=null;
 constructor(state:SlotsState,ui:SlotsUi,private deps:SlotDeps){this.state=state;this.ui=ui;
  try{const p=JSON.parse(localStorage.getItem(PREFS)??'{}');ui.turbo=p.turbo===true;if(p.plan&&AUTO_COUNTS.includes(p.plan.count)&&LOSS_LIMITS.includes(p.plan.lossLimit))ui.autoPlan={count:p.plan.count,stopFeature:p.plan.stopFeature!==false,stopBig:p.plan.stopBig!==false,lossLimit:p.plan.lossLimit};
   if(Array.isArray(p.favs))ui.favs=p.favs.filter((x:unknown)=>typeof x==='string'&&!!machineById(x));if(['floor','played','payback','calm'].includes(p.sort))ui.sort=p.sort;
   if(p.bets&&typeof p.bets==='object')for(const [id,b] of Object.entries(p.bets))if(machineById(id)?.bets.includes(b as number))ui.bet[id]=b as number;}catch{/* defaults */}}
 private savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify({turbo:this.ui.turbo,plan:this.ui.autoPlan,bets:this.ui.bet,favs:this.ui.favs,sort:this.ui.sort}));}catch{/* this visit only */}}
 /** Patch 103: star or unstar a machine, and sort the floor. */
 toggleFav(id:string){if(!machineById(id))return;this.ui.favs=this.ui.favs.includes(id)?this.ui.favs.filter(x=>x!==id):[...this.ui.favs,id];this.savePrefs();}
 setSort(s:string){if(s==='floor'||s==='played'||s==='payback'||s==='calm'){this.ui.sort=s;this.savePrefs();}}
 private get m():Machine|undefined{return machineById(this.ui.machine??'');}
 private wait(ms:number,work:()=>void){clearTimeout(this.timer);this.after=work;this.timer=window.setTimeout(()=>{this.timer=0;this.after=null;if(!this.deps.active()){this.finishNow();return;}work();this.deps.render();},this.ui.turbo?Math.round(ms*.55):ms);}
 private stopCycle(){clearInterval(this.cycle);this.cycle=0;this.ui.lineIndex=-1;}
 get busy(){return this.ui.phase!=='idle'&&this.ui.phase!=='done';}

 open(id:string){this.finishNow();this.stopCycle();Object.assign(this.ui,{gamble:null,machine:id,result:null,phase:'idle',auto:0,error:'',overlay:null,autoOpen:false,neighbour:null});}
 back(){this.finishNow();this.stopCycle();Object.assign(this.ui,{gamble:null,machine:null,result:null,phase:'idle',auto:0,overlay:null,autoOpen:false});}
 setBet(b:number){const m=this.m;if(m&&m.bets.includes(b)&&!this.busy){this.ui.bet[m.id]=b;this.savePrefs();}}
 maxBet(){const m=this.m;if(!m||this.busy)return;const b=[...m.bets].reverse().find(x=>x<=this.state.balance);if(b!==undefined){this.ui.bet[m.id]=b;this.savePrefs();}}
 toggleTurbo(){this.ui.turbo=!this.ui.turbo;this.savePrefs();}
 setPlan(p:Partial<AutoPlan>){this.ui.autoPlan={...this.ui.autoPlan,...p};this.savePrefs();}
 startAuto(){const m=this.m;if(!m||this.busy)return;this.ui.auto=this.ui.autoPlan.count;this.ui.autoStart=this.state.balance;this.ui.autoOpen=false;this.spin();}
 stopAuto(){this.ui.auto=0;}
 reload(){this.state=reloadSlots(this.state,smallestBet());saveSlots(this.state);this.ui.notice='Your slots balance is back to $1,000 of practice chips.';this.ui.error='';}
 /** Space bar or the Spin button: spin when idle, slam the reels when spinning, skip an overlay. */
 press(){if(this.ui.gamble){if(!this.ui.gamble.done)this.collect();return;}if(this.ui.overlay){this.skip();return;}if(this.ui.phase==='spinning'){this.slam();return;}if(!this.busy)this.spin();}
 /** Tap the reels while they spin: stop them all now. */
 slam(){const m=this.m;if(!m||this.ui.phase!=='spinning'||this.ui.stopped>=m.reels.length)return;clearTimeout(this.timer);this.ui.stopped=m.reels.length;this.ui.anticipate=[];this.deps.sound('reel');this.wait(120,()=>this.afterBase());this.deps.render();}
 /** Tap an overlay to move on. */
 skip(){if(!this.ui.overlay)return;const next=this.after;clearTimeout(this.timer);this.timer=0;this.after=null;this.ui.overlay=null;if(next)next();this.deps.render();}

 spin(){
  const m=this.m;if(!m||this.busy)return;
  this.ui.gamble=null;this.ui.gambleTaken=false;
  const bet=betFor(m,this.ui,this.state.balance);
  this.ui.error='';this.ui.notice='';this.stopCycle();
  let result:SpinResult;
  try{const played=playSpin(this.state,m,bet);this.state=played.state;saveSlots(this.state);result=played.result;}
  catch(cause){this.ui.error=(cause as Error).message;this.ui.auto=0;this.deps.render();return;}
  Object.assign(this.ui,{result,pending:result.total,phase:'spinning',stopped:0,step:0,picked:[],overlay:null,anticipate:anticipatedReels(m,result.grid)});
  this.ui.bet[m.id]=bet;
  this.deps.sound('shuffle');
  const gap=150,lead=this.deps.motion()?520:60;
  const stopNext=()=>{this.ui.stopped++;this.deps.sound('reel');
   if(this.ui.stopped<m.reels.length){const slow=this.ui.anticipate.includes(this.ui.stopped);if(slow)this.deps.sound('anticipate');this.wait(slow?gap+780:gap,stopNext);}
   else{this.ui.anticipate=[];this.wait(120,()=>this.afterBase());}};
  this.wait(lead,stopNext);
  this.deps.render();
 }
 private intro(title:string,sub:string,then:()=>void){this.ui.overlay={kind:'intro',title,sub,amount:0};this.deps.sound('levelup');this.wait(1500,()=>{this.ui.overlay=null;then();});}
 private afterBase(){
  const r=this.ui.result!,m=this.m!,stages:(()=>void)[]=[];
  const next=()=>{const st=stages.shift();if(st)st();else this.outro();};
  if(r.cascade&&r.cascade.frames.length>1)stages.push(()=>{this.ui.phase='cascade';this.ui.step=0;const step=()=>{if(this.ui.step<r.cascade!.frames.length-1){this.ui.step++;this.deps.sound('chip');this.wait(this.ui.auto?520:760,step);}else this.wait(500,next);};this.wait(this.ui.auto?600:900,step);});
  if(r.free)stages.push(()=>this.intro('FREE SPINS',`${r.free!.spins.length} free spins${m.scatter!.freeMultiplier>1?` · every win ×${m.scatter!.freeMultiplier}`:m.ways?.freeWild?' · wilds ×2 or ×3':''}`,()=>{this.ui.phase='free';this.ui.step=0;const step=()=>{if(this.ui.step<r.free!.spins.length-1){this.ui.step++;this.deps.sound(r.free!.spins[this.ui.step].total>0?'chip':'flip');this.wait(this.ui.auto?420:780,step);}else this.wait(700,next);};this.wait(900,step);}));
  if(r.hold)stages.push(()=>this.intro('HOLD & SPIN',`${r.hold!.frames[0].grid.flat().filter(x=>x!==null).length} coins locked · 3 respins`,()=>{this.ui.phase='hold';this.ui.step=0;const step=()=>{if(this.ui.step<r.hold!.frames.length-1){this.ui.step++;this.deps.sound('chip');this.wait(560,step);}else this.wait(800,next);};this.wait(700,step);}));
  if(r.wheel)stages.push(()=>this.intro('BONUS WHEEL',`Spin for up to ${Math.max(...m.wheel!.segments.map(s=>s.x))}× your bet`,()=>{this.ui.phase='wheel';this.wait(2900,next);}));
  if(r.pick)stages.push(()=>this.intro('TREASURE CHESTS',`Pick ${r.pick!.prizes.length} chests`,()=>{this.ui.phase='pick';this.ui.picked=[];this.pickDone=next;if(this.ui.auto)this.wait(900,()=>this.autoPick());}));
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
   if(tier&&!this.ui.turbo){this.ui.overlay={kind:'big',title:tier,sub:`${Math.round(r.total/r.bet)}× your bet`,amount:r.total};this.deps.sound('bigwin');this.wait(tier==='BIG WIN'?2600:3600,()=>{this.ui.overlay=null;this.finish();});}
   else this.finish();};
  if((r.free||r.hold||r.wheel||r.pick)&&feature>0){this.ui.overlay={kind:'outro',title:'FEATURE WIN',sub:r.free?`${r.free.spins.length} free spins`:r.hold?(r.hold.full?'GRAND JACKPOT!':`${r.hold.coins.length} coins`):r.wheel?`Wheel ×${r.wheel.x}`:'Treasure',amount:feature};this.deps.sound('money');this.wait(1900,()=>{this.ui.overlay=null;celebrate();});}
  else celebrate();
 }
 private finish(){
  const r=this.ui.result;if(!r||this.ui.phase==='done'||this.ui.phase==='idle')return;
  this.ui.phase='done';this.ui.pending=0;this.pickDone=null;this.ui.overlay=null;
  const s=this.ui.session,feature=!!(r.free||r.hold||r.wheel||r.pick);
  s.spins++;s.wagered+=r.bet;s.won+=r.total;s.best=Math.max(s.best,r.total);if(feature)s.features++;s.recent=[...s.recent,{total:r.total,bet:r.bet,feature}].slice(-14);
  // Patch 98: the player at the next machine reacts now and then. Display only.
  if(this.m){const nb=slotNeighbour(this.m.id,s.spins,{total:r.total,bet:r.bet,feature,big:!!winTier(r.total,r.bet)},s.recent);this.ui.neighbour=nb?{...nb,spin:s.spins}:(this.ui.neighbour&&s.spins-this.ui.neighbour.spin<2?this.ui.neighbour:null);}
  this.deps.sound(winTier(r.total,r.bet)&&this.ui.turbo?'champion':r.total>=5*r.bet?'money':r.total>0?'win':'fold');
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
  g.cards=[...g.cards,{card:out.card,won:out.won}];
  if(out.won){g.stake=out.payout;g.round++;this.ui.session.best=Math.max(this.ui.session.best,g.stake);this.deps.sound(g.round>=GAMBLE_ROUNDS?'bigwin':'money');if(g.round>=GAMBLE_ROUNDS){g.done='collected';this.wait(1800,()=>{this.ui.gamble=null;});}}
  else{g.stake=0;g.done='lost';this.deps.sound('lose');this.wait(1700,()=>{this.ui.gamble=null;});}
  this.deps.render();
 }
 collect(){const g=this.ui.gamble;if(!g)return;clearTimeout(this.timer);this.timer=0;this.after=null;if(g.stake>0)this.deps.sound('win');this.ui.gamble=null;}
 /** Leaving the machine or the page: settle the show at once (the money is already in the balance). */
 finishNow(){const r=this.ui.result;clearTimeout(this.timer);this.timer=0;this.after=null;if(!r||this.ui.phase==='idle'||this.ui.phase==='done')return;this.ui.auto=0;this.ui.overlay=null;this.ui.stopped=this.m?.reels.length??0;this.finish();this.stopCycle();}
}
