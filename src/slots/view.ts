/** Patch 90: the slots screens: the floor of machines, and one machine with its reels, bets and features. */
import type {Machine,SpinResult,Sym} from './engine';
import type {SlotsState} from './state';
import {MACHINES} from './machines';
import {SLOT_DEFS,artFor} from './art';
import type {AutoPlan} from './play';
import {AUTO_COUNTS,LOSS_LIMITS,winTier} from './play';

export interface SlotsUi {machine:string|null;bet:Record<string,number>;
 /** Patch 98: what the player at the next machine just said. */
 neighbour?:{name:string;text:string;spin:number}|null;
 phase:'idle'|'spinning'|'cascade'|'free'|'hold'|'wheel'|'pick'|'done';
 /** Chests tapped in the pick bonus, in order. */
 picked:number[];
 /** Reels stopped so far while spinning. */
 stopped:number;
 /** Step within a feature (free spin number, hold frame). */
 step:number;
 result:SpinResult|null;
 /** Part of the last win not yet shown in the balance. */
 pending:number;
 auto:number;error:string;notice:string;
 /** Patch 92: presentation and play settings. */
 turbo:boolean;overlay:{kind:'intro'|'outro'|'big';title:string;sub:string;amount:number}|null;
 /** Which winning line is being shown on its own (-1: all of them). */
 lineIndex:number;
 /** Reels still spinning that are slowed for anticipation. */
 anticipate:number[];
 autoOpen:boolean;autoPlan:AutoPlan;autoStart:number;
 session:{spins:number;wagered:number;won:number;best:number;features:number;recent:{total:number;bet:number;feature:boolean}[]};
 /** Patch 93: the double-up in progress, whether this spin's win was already offered, and the floor filter. */
 gamble:{stake:number;round:number;cards:{card:string;won:boolean}[];done:'lost'|'collected'|null}|null;gambleTaken:boolean;
 floor:'all'|'classic'|'video'|'bonus'|'fav';
 /** Patch 103: starred machines (kept on this device) and how the floor is sorted. */
 favs:string[];sort:SlotSort;}
export type SlotSort='floor'|'played'|'payback'|'calm';
export const freshSlotsUi=():SlotsUi=>({machine:null,bet:{},phase:'idle',stopped:0,step:0,result:null,pending:0,auto:0,error:'',notice:'',picked:[],turbo:false,overlay:null,lineIndex:-1,anticipate:[],autoOpen:false,autoPlan:{count:25,stopFeature:true,stopBig:true,lossLimit:0},autoStart:0,session:{spins:0,wagered:0,won:0,best:0,features:0,recent:[]},gamble:null,gambleTaken:false,floor:'all',favs:[],sort:'floor'});
/** Decorative machine-specific commissioned artwork. Reels and payouts remain live DOM. */
export function slotCabinetArt(machineId:string,large=false):string {
 if(!MACHINES.some(m=>m.id===machineId))return '';
 return `<span class="casino-slot-art ${large?'casino-slot-art-large':''}" aria-hidden="true"><picture><source type="image/webp" srcset="/casino-art/${machineId}-marquee.webp"><img src="/casino-art/${machineId}.svg" alt="" loading="${large?'eager':'lazy'}" decoding="async"></picture></span>`;
}
const money=(cents:number)=>`$${(cents/100).toLocaleString('en-US',cents%100?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0})}`;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const smallestBet=()=>Math.min(...MACHINES.flatMap(m=>m.bets));
export function betFor(m:Machine,ui:SlotsUi,balance:number):number {
 const chosen=ui.bet[m.id];if(chosen!==undefined&&m.bets.includes(chosen))return chosen;
 return [...m.bets].reverse().find(b=>b<=Math.max(m.bets[0],balance/40))??m.bets[0];
}

export function slotsMarkup(state:SlotsState,ui:SlotsUi):string {
 const m=ui.machine?MACHINES.find(x=>x.id===ui.machine):undefined;
 const banner=`${ui.notice?`<p class="session-notice" role="status">${esc(ui.notice)}</p>`:''}${ui.error?`<p class="error-banner" role="alert">${esc(ui.error)}</p>`:''}`;
 return `<section class="panel slots" data-testid="slots">${SLOT_DEFS}${banner}${m?machineMarkup(state,ui,m):lobbyMarkup(state,ui)}</section>`;
}
/** Three symbols that show what a machine is about. */
export function previewSymbols(m:Machine):Sym[] {
 const top=Object.entries(m.pays).sort((a,b)=>Math.max(...b[1])-Math.max(...a[1])).map(([k])=>k);
 const special=[m.wild,m.scatter?.sym,m.coin?.sym,m.wheel?.sym].filter((x):x is Sym=>!!x);
 return [...new Set([...special,...top])].filter(k=>m.symbols[k]&&m.symbols[k].tone!=='blank').slice(0,3);
}
/** Patch 103: the floor in the chosen order (ties keep the floor order). */
export function sortMachines(list:readonly Machine[],sort:SlotSort,state:SlotsState):Machine[] {
 const by=(f:(m:Machine)=>number)=>[...list].map((m,i)=>({m,i})).sort((a,b)=>f(b.m)-f(a.m)||a.i-b.i).map(x=>x.m);
 return sort==='played'?by(m=>state.machines[m.id]?.spins??0):sort==='payback'?by(m=>m.rtp):sort==='calm'?by(m=>-m.stats.swing):[...list];
}
function lobbyMarkup(state:SlotsState,ui:SlotsUi):string {
 const low=state.balance<smallestBet();
 return `<span class="eyebrow">SLOTS · VIRTUAL CHIPS</span><h2>The slot floor</h2>
 <p class="slots-balance" data-testid="slots-balance">Slots balance <b data-count-key="slots-balance" data-count="${state.balance}">${money(state.balance)}</b></p>
 ${low?`<p class="muted">Your slots balance is below the smallest bet. <button type="button" class="button primary" id="slots-reload">Reload ${money(100000)} of practice chips</button></p>`:''}
 <div class="segmented slot-floor-tabs" role="group" aria-label="Show machines">${([['all','All'],['fav',`★ Favourites${ui.favs.length?` (${ui.favs.length})`:''}`],['classic','Classic'],['video','Video'],['bonus','Bonus features']] as const).map(([k,l])=>`<button type="button" class="segment${ui.floor===k?' selected':''}" data-slot-floor="${k}" aria-pressed="${ui.floor===k}">${l}</button>`).join('')}</div>
 ${(()=>{const ids=[...new Set([...state.recent].reverse().map(x=>x.machine))].slice(0,3).map(id=>MACHINES.find(m=>m.id===id)).filter((m):m is Machine=>!!m);return ids.length?`<div class="slot-recently"><small>RECENTLY PLAYED</small>${ids.map(m=>`<button type="button" class="slot-chip" data-slot-machine="${m.id}" style="--glow:${m.theme.glow}">${symbolMarkup(m,previewSymbols(m)[0])}<b>${esc(m.name)}</b></button>`).join('')}</div>`:'';})()}
 <div class="slot-sort"><label for="slot-sort">Sort</label><select id="slot-sort">${([['floor','Floor order'],['played','Most played'],['payback','Highest payback'],['calm','Calmest first']] as const).map(([k,l])=>`<option value="${k}" ${ui.sort===k?'selected':''}>${l}</option>`).join('')}</select></div>
 ${ui.floor==='fav'&&!ui.favs.length?'<p class="muted">No favourites yet. Tap the ☆ on a machine to keep it here.</p>':''}
 <ul class="slot-machines">${sortMachines(MACHINES.filter(m=>ui.floor==='fav'?ui.favs.includes(m.id):ui.floor==='all'||(ui.floor==='classic'?m.kind==='classic'||m.kind==='wheel':ui.floor==='video'?m.kind!=='classic'&&m.kind!=='wheel':m.stats.featureEvery!==null)),ui.sort,state).map(m=>{const r=state.machines[m.id];const preview=previewSymbols(m).map(s=>symbolMarkup(m,s)).join('');
  const fav=ui.favs.includes(m.id);
  return `<li class="slot-li"><button type="button" class="slot-star${fav?' on':''}" data-slot-fav="${m.id}" aria-pressed="${fav}" aria-label="${fav?'Remove':'Add'} ${esc(m.name)} ${fav?'from':'to'} favourites">${fav?'★':'☆'}</button><button type="button" class="slot-card kind-${m.kind}" data-slot-machine="${m.id}" style="--top:${m.theme.top};--bottom:${m.theme.bottom};--glow:${m.theme.glow}"><span class="slot-card-marquee"><i class="slot-lights" aria-hidden="true"></i>${slotCabinetArt(m.id)}<b>${esc(m.name)}</b><small>${esc(m.theme.marquee)}</small></span><span class="slot-card-reels" aria-hidden="true">${preview}</span><span class="slot-card-text"><span>${esc(m.tagline)}</span><small><b>${m.rtp.toFixed(1)}%</b> payback · ${swingMeter(m)} · pays on ${Math.round(m.stats.hitRate)}% of spins${m.stats.featureEvery?` · feature ~1 in ${m.stats.featureEvery}`:''} · ${money(m.bets[0])}–${money(m.bets.at(-1)!)}${r?` · you: ${r.spins} spins, ${r.wagered?(100*r.won/r.wagered).toFixed(0):'0'}% back`:''}</small></span></button></li>`;}).join('')}</ul>
 <details class="slots-how"><summary>How slots work</summary><p>Every spin is drawn at random and has nothing to do with the spins before it. No machine is "due", and no bet size or timing changes the odds.</p><p><b>Payback</b> is the share of all money bet that a machine returns over millions of spins. At 95%, the house keeps about 5 cents of every dollar you bet, however you play. Short sessions swing a long way either side of it, more so on machines with big swings.</p><p>This is practice with virtual chips. Your slots balance is separate from your poker and blackjack balances.</p></details>`;
}
export function symbolMarkup(m:Machine,s:Sym,extra=''):string {
 if(s.startsWith('bomb:'))return `<span class="slot-sym tone-bonus slot-bomb${extra}" title="Multiplier bomb ×${s.slice(5)}">${artFor('bomb')}<b>×${s.slice(5)}</b></span>`;
 const d=m.symbols[s]??{label:s,art:s,tone:'low'};
 return `<span class="slot-sym tone-${d.tone}${extra}" title="${esc(d.label)}">${artFor(d.art)}</span>`;
}
/** The grid to draw now: the base spin, a free spin, or a Hold & Spin frame. */
type Shown={grid:Sym[][];wins:SpinResult['wins'];coins?:(number|null)[][];hits?:[number,number][];mults?:number[][]};
/** What a finished spin looks like at rest: a cascade's last tumble, or the reels with their wins. */
const atRest=(x:SpinResult):Shown=>x.cascade?{grid:x.cascade.frames.at(-1)!.grid,wins:[]}:{grid:x.grid,wins:x.wins,...(x.wildMultipliers?{mults:x.wildMultipliers}:{})};
function currentGrid(m:Machine,ui:SlotsUi):Shown {
 const r=ui.result;
 if(!r)return {grid:m.reels.map(strip=>strip.slice(0,m.rows)),wins:[]};
 if(ui.phase==='cascade'&&r.cascade){const f=r.cascade.frames[Math.min(ui.step,r.cascade.frames.length-1)];return {grid:f.grid,wins:[],hits:f.hits};}
 if(ui.phase==='spinning'&&r.cascade)return {grid:r.cascade.frames[0].grid,wins:[]};
 if((ui.phase==='free'||ui.phase==='done')&&r.free&&!r.hold){const f=r.free.spins[ui.phase==='done'?r.free.spins.length-1:Math.min(ui.step,r.free.spins.length-1)];return atRest(f);}
 if(r.cascade&&ui.phase!=='hold')return {...atRest(r),hits:ui.phase==='done'?[]:undefined};
 if(ui.phase==='hold'&&r.hold){const f=r.hold.frames[Math.min(ui.step,r.hold.frames.length-1)];return {grid:r.grid,wins:[],coins:f.grid};}
 if(ui.phase==='done'&&r.hold)return {grid:r.grid,wins:r.wins,coins:r.hold.frames.at(-1)!.grid};
 return ui.phase==='spinning'?{grid:r.grid,wins:[]}:atRest(r);
}
const LINE_COLOURS=['#ffe14a','#4af0ff','#ff5ad1','#7dff6a','#ff9a3a','#b28cff','#ff4a4a','#4aa8ff'];
/** Lines drawn across the window through each winning line's cells. */
function paylines(m:Machine,wins:SpinResult['wins']):string {
 if(!wins.length||m.ways||m.cascade)return '';
 const cols=m.reels.length,rows=m.rows;
 const paths=wins.slice(0,8).map((w,i)=>{const rowsOfLine=m.lines[w.line]??null;
  const pts=(rowsOfLine?rowsOfLine.map((r,reel)=>[reel,r]):w.cells).map(([reel,row])=>`${((reel+.5)/cols*100).toFixed(2)},${((row+.5)/rows*100).toFixed(2)}`).join(' ');
  return `<polyline points="${pts}" style="--c:${LINE_COLOURS[i%LINE_COLOURS.length]};--i:${i}"/>`;}).join('');
 return `<svg class="slot-paylines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}
function particles(n:number,kind:'coin'|'spark'):string {
 return `<div class="slot-burst ${kind}" aria-hidden="true">${Array.from({length:n},(_,i)=>`<i style="--dx:${((i*37)%100-50)}%;--dy:${-40-(i*53)%60}%;--d:${(i*0.07).toFixed(2)}s;--r:${(i*47)%360}deg"></i>`).join('')}</div>`;
}
function machineMarkup(state:SlotsState,ui:SlotsUi,m:Machine):string {
 const bet=betFor(m,ui,state.balance),busy=ui.phase!=='idle'&&ui.phase!=='done',r=ui.result,rec=state.machines[m.id];
 const shownGrid=currentGrid(m,ui),{grid,coins,mults}=shownGrid,allWins=shownGrid.wins,one=ui.phase==='done'&&ui.lineIndex>=0&&allWins.length>1?allWins[ui.lineIndex%allWins.length]:null,wins=one?[one]:allWins,hit=new Set([...wins.flatMap(w=>w.cells.map(([a,b])=>`${a}:${b}`)),...(shownGrid.hits??[]).map(([a,b])=>`${a}:${b}`)]);
 const settled=ui.phase==='done'||ui.phase==='free'||ui.phase==='cascade';
 const reels=grid.map((col,reel)=>{const spinning=ui.phase==='spinning'&&reel>=ui.stopped,strip=m.reels[reel];
  return `<div class="slot-reel${spinning?' spinning':''}${spinning&&ui.anticipate.includes(reel)?' anticipate':''}" style="--reel:${reel}">${spinning?`<div class="slot-strip">${Array.from({length:m.rows+3},(_,k)=>`<div class="slot-cell">${symbolMarkup(m,strip[(reel*7+k*3)%strip.length])}</div>`).join('')}</div>`:col.map((s,row)=>{
   const coin=coins?.[reel]?.[row];
   if(coins)return `<div class="slot-cell${coin!=null?' coin':' empty'}">${coin!=null?`<span class="slot-coin">${symbolMarkup(m,m.coin!.sym)}<b>${coin>=20?`<small>${coin>=150?'MAJOR':coin>=50?'MINOR':'MINI'}</small>`:''}${money(coin*(r?.bet??bet))}</b></span>`:''}</div>`;
   return `<div class="slot-cell${settled&&hit.has(`${reel}:${row}`)?' hit':''}${settled&&wins.length&&!hit.has(`${reel}:${row}`)?' dim':''}${m.lines.length===1&&row!==1?' off-line':''}${ui.phase==='cascade'&&hit.has(`${reel}:${row}`)?' shatter':''}" style="--row:${row}">${symbolMarkup(m,s)}${mults&&mults[reel][row]>1?`<b class="slot-mult">×${mults[reel][row]}</b>`:''}</div>`;}).join('')}</div>`;}).join('');
 let status='';
 if(ui.phase==='spinning')status='<span class="slot-status">GOOD LUCK!</span>';
 else if(ui.phase==='free'&&r?.free)status=`<span class="slot-status feature">FREE SPIN ${Math.min(ui.step+1,r.free.spins.length)} / ${r.free.spins.length}${m.scatter!.freeMultiplier>1?` · ×${m.scatter!.freeMultiplier}`:""}</span>`;
 else if(ui.phase==='hold'&&r?.hold)status=`<span class="slot-status feature">HOLD &amp; SPIN · ${r.hold.frames[Math.min(ui.step,r.hold.frames.length-1)].respins} RESPINS</span>`;
 else if(ui.phase==='wheel')status='<span class="slot-status feature">BONUS WHEEL!</span>';
 else if(ui.phase==='cascade'&&r?.cascade)status=`<span class="slot-status feature">TUMBLE ${ui.step+1} · ${money(r.cascade.frames.slice(0,ui.step+1).reduce((a,f)=>a+f.win,0))}</span>`;
 else if(ui.phase==='pick'&&r?.pick)status=`<span class="slot-status feature">PICK A CHEST · ${r.pick.prizes.length-ui.picked.length} LEFT</span>`;
 else if(r&&ui.phase==='done'&&one)status=`<span class="slot-status line">${one.line>=0?`LINE ${one.line+1} · `:''}${one.count}× ${esc(m.symbols[one.sym]?.label.replace(/ \(.*\)/,'')??(one.sym==='anybar'?'any bar':one.sym))}${m.ways?` · ${Math.round(one.amount/((m.pays[one.sym]?.[one.count]??1)*(r.bet/m.ways.betUnit)))} way${Math.round(one.amount/((m.pays[one.sym]?.[one.count]??1)*(r.bet/m.ways.betUnit)))===1?'':'s'}`:''} · ${money(one.amount)}</span>`;
 else if(r&&ui.phase==='done')status=r.total>0?`<span class="slot-status win${winTier(r.total,r.bet)?' big':''}" data-testid="slot-win">${winTier(r.total,r.bet)??(r.total>=5*r.bet?'NICE WIN':'WIN')} ${money(r.total)}${r.free?` · FREE SPINS ${money(r.free.total)}`:''}${r.hold?` · HOLD &amp; SPIN ${money(r.hold.total)}${r.hold.full?' · GRAND!':''}`:''}${r.wheel?` · WHEEL ×${r.wheel.x}`:''}${r.cascade&&r.cascade.multiplier>1?` · BOMBS ×${r.cascade.multiplier}`:''}${r.pick?` · TREASURE ${money(r.pick.amount)}`:''}</span>`:'<span class="slot-status quiet">PLACE YOUR BET</span>';
 else status='<span class="slot-status quiet">PLACE YOUR BET</span>';
 const shownWin=ui.phase==='free'&&r?.free?r.free.spins.slice(0,ui.step+1).reduce((a,x)=>a+x.total,0)+r.lineTotal+r.scatterWin:ui.phase==='done'&&r?r.total:0;
 /* Phase 4: the celebration scales with the win tier (BIG 15×, MEGA 40×, EPIC 100×) — more coins, and a
  * cabinet class the styles answer with a stronger glow for the two higher tiers. */
 const tier=r&&ui.phase==='done'?winTier(r.total,r.bet):null;
 const big=!!tier;
 const i=m.bets.indexOf(bet),lower=m.bets[i-1],higher=m.bets[i+1];
 const shown=state.balance-ui.pending;
 return `<div class="slot-head"><button type="button" class="button secondary" id="slots-back" ${busy?'disabled':''}>← Machines</button><span class="slot-name"><small>${m.rtp.toFixed(1)}% payback · ${swingMeter(m)}</small><small>Pays on ${m.stats.hitRate.toFixed(0)}% of spins${m.stats.featureEvery?` · feature about 1 in ${m.stats.featureEvery}`:''} · biggest seen ${m.stats.topSeen.toLocaleString()}× bet</small></span></div>
 <div class="slot-cabinet kind-${m.kind}${big?' big-win':''}${tier==='MEGA WIN'?' mega-win':''}${tier==='EPIC WIN'?' epic-win':''}${r&&settled&&r.total>0?' winning':''}${ui.phase!=='idle'&&ui.phase!=='done'&&ui.phase!=='spinning'?' in-feature':''}" data-testid="slot-machine" style="--top:${m.theme.top};--bottom:${m.theme.bottom};--glow:${m.theme.glow};--cabinet-scene:url('/casino-art/${m.id}-cinematic.webp')">
  <div class="slot-marquee"><i class="slot-lights" aria-hidden="true"></i>${slotCabinetArt(m.id,true)}<h3 style="--len:${m.name.length}">${esc(m.name)}</h3><small>${esc(m.theme.marquee)}</small></div>${ui.neighbour&&ui.machine===m.id?`<div class="slot-neighbour" data-testid="slot-neighbour" aria-live="polite"><span class="slot-nb-face" aria-hidden="true">${esc(ui.neighbour.name[0])}</span><span><b>${esc(ui.neighbour.name)}</b> <small>at the next machine</small><br>“${esc(ui.neighbour.text)}”</span></div>`:''}
  <div class="slot-window-frame"><div class="slot-window${ui.phase==='idle'||(ui.phase==='done'&&!wins.length)?' idle':''}" style="--reels:${m.reels.length};--rows:${m.rows}">${reels}${settled&&!ui.gamble?floats(m,wins,grid.length,grid[0]?.length??m.rows):''}${settled?paylines(m,wins):''}<i class="slot-glass" aria-hidden="true"></i>${ui.phase==='spinning'?'<button type="button" class="slot-slam" id="slots-slam" aria-label="Stop the reels now"></button>':''}</div>${tier==='EPIC WIN'?particles(36,'coin'):tier==='MEGA WIN'?particles(26,'coin'):tier?particles(18,'coin'):r&&ui.phase==='done'&&r.total>=5*r.bet?particles(12,'spark'):''}</div>
  ${ui.overlay?overlayMarkup(ui):''}${ui.gamble?gambleMarkup(ui):''}${m.wheel?wheelMarkup(m,ui):''}${m.pick&&r?.pick&&(ui.phase==='pick'||ui.phase==='done')?pickMarkup(m,ui,r):''}
  <div class="slot-status-row" role="status" aria-live="polite">${status}</div>
  <div class="slot-meters"><div><small>CREDIT</small><b data-count-key="slots-balance" data-count="${shown}">${money(shown)}</b></div><div><small>BET</small><b>${money(bet)}</b></div><div class="${shownWin>0?'lit':''}"><small>WIN</small><b data-count-key="slots-win" data-count="${shownWin}">${money(shownWin)}</b></div></div>
  <div class="slot-deck">
   <div class="slot-bet-step" role="group" aria-label="Bet per spin"><button type="button" class="slot-key" ${lower!==undefined&&!busy?`data-slot-bet="${lower}"`:'disabled'} aria-label="Lower bet">−</button><span><small>BET</small>${money(bet)}</span><button type="button" class="slot-key" ${higher!==undefined&&!busy&&higher<=state.balance?`data-slot-bet="${higher}"`:'disabled'} aria-label="Raise bet">+</button></div>
   <div class="slot-keys"><button type="button" class="slot-key small" id="slots-max" ${busy||bet===m.bets.at(-1)?'disabled':''}>MAX<small>bet</small></button>${r&&ui.phase==='done'&&r.total>0&&ui.auto===0&&!ui.gambleTaken&&!ui.gamble&&r.total<=state.balance?`<button type="button" class="slot-key small gamble" id="slots-gamble">GAMBLE<small>${money(r.total)}</small></button>`:''}<button type="button" class="slot-key small${ui.turbo?' on':''}" id="slots-turbo" aria-pressed="${ui.turbo}">TURBO<small>${ui.turbo?'on':'off'}</small></button>${ui.auto>0?`<button type="button" class="slot-key small on" id="slots-stop">STOP<small>${ui.auto} left</small></button>`:`<button type="button" class="slot-key small${ui.autoOpen?' on':''}" id="slots-auto" aria-expanded="${ui.autoOpen}" ${busy?'disabled':''}>AUTO<small>${ui.autoPlan.count}</small></button>`}</div>
   <button type="button" class="slot-spin-button${ui.phase==='spinning'&&ui.stopped<m.reels.length?' stop':''}" id="slots-spin" ${(busy&&!(ui.phase==='spinning'&&ui.stopped<m.reels.length)&&!ui.overlay)||(!busy&&state.balance<bet)?'disabled':''} aria-label="${ui.phase==='spinning'&&ui.stopped<m.reels.length?'Stop the reels':`Spin for ${money(bet)}`}"><span>${ui.phase==='spinning'&&ui.stopped<m.reels.length?'STOP':'SPIN'}</span></button>
  </div>
 </div>
 ${ui.autoOpen&&!busy?autoMarkup(ui,state.balance):''}${sessionMarkup(ui)}
 ${state.balance<bet&&!busy?`<p class="muted">Not enough for this bet.${state.balance<smallestBet()?' <button type="button" class="button secondary" id="slots-reload">Reload $1,000 of practice chips</button>':' Pick a smaller bet.'}</p>`:''}
 ${paytableMarkup(m,bet)}
 <p class="muted slot-record">${rec?`You on this machine: ${rec.spins} spin${rec.spins===1?'':'s'} · bet ${money(rec.wagered)} · won ${money(rec.won)} · ${(100*rec.won/Math.max(1,rec.wagered)).toFixed(0)}% back · biggest ${money(rec.biggest)}`:'No spins here yet.'} Each spin is independent; long-run payback about ${m.rtp.toFixed(1)}%.</p>`;
}
const WHEEL_COLOURS=['#c0392b','#f39c12','#27ae60','#2980b9','#8e44ad','#16a085','#d35400','#2c3e50','#b03a6f'];
function wheelMarkup(m:Machine,ui:SlotsUi):string {
 const segs=m.wheel!.segments,n=segs.length,r=ui.result?.wheel,turn=r&&(ui.phase==='wheel'||ui.phase==='done')?360*5-(r.segment+.5)*(360/n):0;
 return `<div class="slot-bonus-wheel${r&&(ui.phase==='wheel'||ui.phase==='done')?' shown':''}" aria-hidden="true"><div class="slot-wheel-disc" style="--turn:${turn}deg;--n:${n};background:conic-gradient(${segs.map((_,i)=>`${WHEEL_COLOURS[i%WHEEL_COLOURS.length]} ${(100*i/n).toFixed(2)}% ${(100*(i+1)/n).toFixed(2)}%`).join(',')})">${segs.map((s,i)=>`<span style="--i:${i}">${s.x}×</span>`).join('')}</div><i class="slot-wheel-pointer"></i></div>`;
}

function pickMarkup(m:Machine,ui:SlotsUi,r:SpinResult):string {
 const p=r.pick!,done=ui.picked.length>=p.prizes.length,bet=r.bet;let other=0;
 const cells=Array.from({length:m.pick!.board},(_,i)=>{const k=ui.picked.indexOf(i);
  if(k>=0)return `<span class="slot-chest open won" style="--k:${k}">${artFor('coin')}<b>${money(p.prizes[k]*bet)}</b></span>`;
  if(done){const v=p.others[other++];return `<span class="slot-chest open missed">${artFor('chest')}<b>${money(v*bet)}</b></span>`;}
  return `<button type="button" class="slot-chest" data-slot-pick="${i}" aria-label="Open chest ${i+1}">${artFor('chest')}</button>`;}).join('');
 return `<div class="slot-pick" data-testid="slot-pick"><p>${done?`Your treasure: <b>${money(p.amount)}</b>. The others held what you see.`:`Pick ${p.prizes.length-ui.picked.length} more chest${p.prizes.length-ui.picked.length===1?'':'s'}.`}</p><div class="slot-chests">${cells}</div></div>`;
}
function paytableMarkup(m:Machine,bet:number):string {
 const row=(s:string,cells:string)=>`<tr><td>${symbolMarkup(m,s)}<span class="pay-name">${esc(m.symbols[s]?.label??s)}</span></td>${cells}</tr>`;
 let intro='',head='',body='';
 if(m.cascade){const t=m.cascade.tiers;
  intro=`Eight or more of the same gem anywhere on the screen pay, as shown. Winning gems shatter, the rest fall, and new gems drop in; this repeats while there are wins. Multiplier bombs (×2 to ×100) left on the screen at the end add together and multiply the whole cascade. ${m.scatter?`Four or more diamonds pay ${m.scatter.pays[4]}× to ${m.scatter.pays[6]}× your bet and start ${m.scatter.freeSpins[4]} free spins.`:''}`;
  head=`<th>Gem</th><th>${t[0]}–${t[1]-1}</th><th>${t[1]}–${t[2]-1}</th><th>${t[2]}+</th>`;
  body=Object.entries(m.pays).map(([s,p])=>row(s,p.map(x=>`<td>${money(Math.round(x*bet))}</td>`).join(''))).join('');}
 else{
  const unit=m.ways?bet/m.ways.betUnit:bet/m.lines.length;
  intro=m.ways?`1,024 ways: a symbol pays when it lands on adjacent reels from the left, in any row; every combination pays (your bet buys ${m.ways.betUnit} units of ${money(unit)}). ${esc(m.symbols[m.wild!].label)} stands in on the middle reels. ${m.scatter?`Three, four or five ${esc(m.symbols[m.scatter.sym].label.toLowerCase())}s pay ${m.scatter.pays[3]}×, ${m.scatter.pays[4]}× or ${m.scatter.pays[5]}× your bet and start ${m.scatter.freeSpins[3]}, ${m.scatter.freeSpins[4]} or ${m.scatter.freeSpins[5]} free spins; there every wild is ×2 or ×3, and the wilds in a win multiply together.`:''}`
   :`${m.lines.length} line${m.lines.length===1?'':'s'}, ${money(unit)} each. ${m.wild?`${esc(m.symbols[m.wild].label)} stands in for every symbol except bonus symbols${m.wildMultiplier?` and multiplies the win ×${m.wildMultiplier} (two of them ×${m.wildMultiplier**2})`:''}. `:''}${m.cherry?`Cherries pay anywhere on a line: one ${money(m.cherry.pays[1]*unit)}, two ${money(m.cherry.pays[2]*unit)}, three ${money(m.cherry.pays[3]*unit)}. `:''}${m.anyBar?`Any three bars ${money(m.anyBar.pay*unit)}. `:''}${m.scatter?`Three, four or five ${esc(m.symbols[m.scatter.sym].label.toLowerCase())}s anywhere pay ${m.scatter.pays[3]}×, ${m.scatter.pays[4]}× or ${m.scatter.pays[5]}× your bet and start ${m.scatter.freeSpins[3]}, ${m.scatter.freeSpins[4]} or ${m.scatter.freeSpins[5]} free spins at ${m.scatter.freeMultiplier}× pay. `:''}${m.coin?`${m.coin.trigger} or more coins start Hold &amp; Spin: coins stay, you get 3 respins and each new coin resets them to 3. Coins are worth 1× to 10× your bet, or a Mini (20×), Minor (50×) or Major (150×) jackpot; fill all 15 spaces for the Grand (${m.coin.grand}×). `:''}${m.wheel?`The wheel in the middle of the last reel spins the bonus wheel for ${Math.min(...m.wheel.segments.map(s=>s.x))}× to ${Math.max(...m.wheel.segments.map(s=>s.x))}× your bet. `:''}${m.pick?`Three treasure maps open the chest bonus: pick ${m.pick.picks} of ${m.pick.board} chests, each worth ${Math.min(...m.pick.prizes.map(x=>x.x))}× to ${Math.max(...m.pick.prizes.map(x=>x.x))}× your bet. What is in each chest is decided when the maps land; your taps only open them. `:''}${m.scatterPay?`${esc(m.symbols[m.scatterPay.sym].label.replace(/ \(.*\)/,''))}s pay anywhere on the window, as multiples of your whole bet: ${Object.entries(m.scatterPay.pays).sort((a,b)=>Number(a[0])-Number(b[0])).map(([n,x])=>`${n} pay ${x}×`).join(', ')}. They never pay on a line. `:''}${m.expandWild?`${esc(m.symbols[m.expandWild].label.replace(/ \(.*\)/,''))} expands to fill its whole reel whenever it lands, so every line through that reel can use it. `:''}`;
  head=`<th>Symbol</th>${m.reels.length===3?'<th>Three</th>':'<th>Three</th><th>Four</th><th>Five</th>'}`;
  body=Object.entries(m.pays).map(([s,p])=>row(s,p.slice(3).map(x=>`<td>${x?money(Math.round(x*unit)):'—'}</td>`).join(''))).join('');}
 return `<details class="slot-paytable"><summary>Paytable at ${money(bet)} a spin</summary><p class="muted">${intro}</p><table class="deep-table slot-pays"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
}

function overlayMarkup(ui:SlotsUi):string {
 const o=ui.overlay!;
 return `<button type="button" class="slot-overlay ov-${o.kind}${o.kind==='big'?` tier-${o.title.split(' ')[0].toLowerCase()}`:''}" id="slots-skip" data-testid="slot-overlay" aria-label="Continue"><span class="ov-title">${esc(o.title)}</span>${o.amount?`<b class="ov-amount" data-count-key="slots-ov-${o.kind}-${o.amount}" data-count="${o.amount}" data-count-from="0" data-count-ms="${o.kind==='big'?2200:900}">${money(o.amount)}</b>`:''}<span class="ov-sub">${esc(o.sub)}</span>${o.kind==='big'?`<span class="slot-burst coin" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i style="--dx:${((i*37)%100-50)}%;--dy:${-40-(i*53)%60}%;--d:${(i*0.09).toFixed(2)}s;--r:${(i*47)%360}deg"></i>`).join('')}</span>`:''}<small class="ov-tap">Tap to continue</small></button>`;
}
function autoMarkup(ui:SlotsUi,balance:number):string {
 const p=ui.autoPlan;
 return `<div class="slot-auto-panel" data-testid="slot-auto-panel"><div class="slot-auto-row"><span>Spins</span><div class="segmented" role="group" aria-label="Number of autoplay spins">${AUTO_COUNTS.map(n=>`<button type="button" class="segment${n===p.count?' selected':''}" data-auto-count="${n}" aria-pressed="${n===p.count}">${n}</button>`).join('')}</div></div>
 <label class="slot-auto-check"><input type="checkbox" id="auto-stop-feature" ${p.stopFeature?'checked':''}> Stop when a feature is won</label>
 <label class="slot-auto-check"><input type="checkbox" id="auto-stop-big" ${p.stopBig?'checked':''}> Stop on a big win (15× or more)</label>
 <div class="slot-auto-row"><span>Stop if I'm down</span><select id="auto-loss" aria-label="Loss limit">${LOSS_LIMITS.map(v=>`<option value="${v}" ${v===p.lossLimit?'selected':''}>${v?money(v):'No limit'}</option>`).join('')}</select></div>
 <button type="button" class="button primary" id="slots-auto-start" ${balance<=0?'disabled':''}>Start ${p.count} spins</button></div>`;
}
function sessionMarkup(ui:SlotsUi):string {
 const s=ui.session;if(!s.spins)return '';
 const net=s.won-s.wagered;
 return `<div class="slot-session" data-testid="slot-session"><div class="slot-session-row"><span><small>THIS VISIT</small><b>${s.spins} spin${s.spins===1?'':'s'}</b></span><span><small>NET</small><b class="${net>=0?'positive':'negative'}">${net>=0?'+':'−'}${money(Math.abs(net))}</b></span><span><small>BEST WIN</small><b>${money(s.best)}</b></span><span><small>FEATURES</small><b>${s.features}</b></span></div><div class="slot-recent" aria-label="Last spins">${s.recent.map(x=>`<i class="${x.feature?'feat':x.total>=x.bet*5?'good':x.total>0?'win':'none'}" title="${x.total?money(x.total):'No win'}">${x.total?money(x.total):'·'}</i>`).join('')}</div></div>`;
}

/** Patch 93: one to five bars for how much a machine swings. */
export function swingMeter(m:Machine):string {return `<span class="slot-swing" title="Swings: ${m.stats.swing} of 5" aria-label="Swings ${m.stats.swing} of 5">${Array.from({length:5},(_,i)=>`<i class="${i<m.stats.swing?'on':''}"></i>`).join('')}<em>${['calm','steady','lively','wild','very wild'][m.stats.swing-1]}</em></span>`;}
/** Win amounts that float up from the middle of each win (the first four). */
function floats(m:Machine,wins:SpinResult['wins'],cols:number,rows:number):string {
 return wins.slice(0,4).map((w,i)=>{const c=w.cells[Math.floor(w.cells.length/2)]??[0,0];return `<span class="slot-float" style="left:${((c[0]+.5)/cols*100).toFixed(1)}%;top:${((c[1]+.5)/rows*100).toFixed(1)}%;--i:${i}">+${money(w.amount)}</span>`;}).join('');
}
const SUIT:Record<string,string>={s:'♠',h:'♥',d:'♦',c:'♣'};
const cardFace=(c:string)=>`<span class="gamble-card face ${c[1]==='h'||c[1]==='d'?'red':'black'}"><b>${c[0]==='T'?'10':c[0]}</b><i>${SUIT[c[1]]}</i></span>`;
function gambleMarkup(ui:SlotsUi):string {
 const g=ui.gamble!,last=g.cards.at(-1),open=!g.done&&g.round<5;
 return `<div class="slot-gamble" data-testid="slot-gamble" role="dialog" aria-label="Gamble your win"><div class="gamble-head"><span class="ov-title small">${g.done==='lost'?'NO LUCK':g.done==='collected'?'MAXED OUT!':'GAMBLE'}</span><span>Stake <b>${money(g.stake)}</b>${open?` · round ${g.round+1} of 5`:''}</span></div>
 <div class="gamble-table">${last?cardFace(last.card):'<span class="gamble-card back" aria-hidden="true"></span>'}</div>
 ${open?`<div class="gamble-row"><button type="button" class="gamble-btn red" data-gamble="red">RED<small>${money(g.stake*2)}</small></button><button type="button" class="gamble-btn black" data-gamble="black">BLACK<small>${money(g.stake*2)}</small></button></div>
 <div class="gamble-row suits">${(['h','d','s','c'] as const).map(x=>`<button type="button" class="gamble-btn suit ${x==='h'||x==='d'?'red':'black'}" data-gamble="${x}" aria-label="${({h:'Hearts',d:'Diamonds',s:'Spades',c:'Clubs'})[x]}">${SUIT[x]}<small>${money(g.stake*4)}</small></button>`).join('')}</div>
 <button type="button" class="button primary gamble-collect" id="slots-collect">Collect ${money(g.stake)}</button>`:''}
 <div class="gamble-history" aria-label="Cards so far">${g.cards.map(x=>`<span class="${x.won?'won':'lost'}">${x.card[0]==='T'?'10':x.card[0]}${SUIT[x.card[1]]}</span>`).join('')}</div>
 <small class="muted">A fair card each round: colour pays 2×, suit 4×. Even money over time.</small></div>`;
}
