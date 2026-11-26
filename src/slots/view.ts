/** Patch 90: the slots screens: the floor of machines, and one machine with its reels, bets and features. */
import type {Machine,SpinResult,Sym} from './engine';
import type {SlotsState} from './state';
import {MACHINES} from './machines';
import {lineWinReachable,maxCountAnywhere} from './exact';
import {SLOT_DEFS,artFor} from './art';
import {symbolImage} from './symbol-images';
import type {AutoPlan} from './play';
import {AUTO_COUNTS,LOSS_LIMITS,anticipation,winTier} from './play';

/** Phase 11 (S-U01): the slots screens carry their own sound controls — the same global
 * style.sound / style.volume the poker table style panel edits, so it is one setting
 * everywhere. Until sound is on, a one-time hint chip offers it (dismisses for good). */
export function soundBarMarkup(ui:SlotsUi):string {
 const on=ui.soundOn===true;
 return `<div class="slot-sound-bar">${!on&&ui.soundHint?`<span class="slot-sound-hint">Sound on for the full experience <button type="button" class="slot-hint-on" id="slots-sound-hint-on">Turn sound on</button><button type="button" class="slot-hint-x" id="slots-sound-hint-dismiss" aria-label="Dismiss the sound hint">×</button></span>`:''}<button type="button" class="slot-key small${on?' on':''}" id="slots-sound-toggle" aria-pressed="${on}">SOUND<small>${on?'on':'off'}</small></button><label class="slot-volume">Volume <input type="range" id="slots-sound-volume" min="0" max="100" step="1" value="${ui.volume??70}" aria-label="Sound volume"></label></div>`;
}

export interface SlotsUi {machine:string|null;bet:Record<string,number>;
 /** Phase 10 (P10-F05): the bet size the paytable is VIEWING, per machine. View-only:
  * it never changes the bet a spin is placed at. */
 payBet:Record<string,number>;
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
 /** Phase 11: presentation sub-states — a free spin's reels are rolling, Hold & Spin's
  * open spaces are rolling, the end-of-feature coin tally (-1 = not tallying), a cascade
  * frame is teasing a trigger, and the one-time sound hint still shows. */
 freeRoll:boolean;holdRoll:boolean;tally:number;tease:boolean;soundHint:boolean;
 /** Phase 11 (S-U01): the app's global sound state, mirrored in each render so the
  * slots screens can offer their own toggle and volume. */
 soundOn?:boolean;volume?:number;
 autoOpen:boolean;autoPlan:AutoPlan;autoStart:number;
 session:{spins:number;wagered:number;won:number;best:number;features:number;recent:{total:number;bet:number;feature:boolean}[]};
 /** Phase 13 (S-6): the same visit record kept per machine, so the THIS VISIT
  * strip on a machine counts that machine's spins only. */
 machineSessions:Record<string,{spins:number;wagered:number;won:number;best:number;features:number;recent:{total:number;bet:number;feature:boolean}[]}>;
 /** Patch 93: the double-up in progress, whether this spin's win was already offered, and the floor filter. */
 gamble:{stake:number;round:number;cards:{card:string;won:boolean}[];done:'lost'|'collected'|null}|null;gambleTaken:boolean;
 floor:'all'|'classic'|'video'|'bonus'|'fav';
 /** Patch 103: starred machines (kept on this device) and how the floor is sorted. */
 favs:string[];sort:SlotSort;}
export type SlotSort='floor'|'played'|'payback'|'calm';
export const freshSlotsUi=():SlotsUi=>({machine:null,bet:{},payBet:{},phase:'idle',stopped:0,step:0,result:null,pending:0,auto:0,error:'',notice:'',picked:[],turbo:false,overlay:null,lineIndex:-1,anticipate:[],freeRoll:false,holdRoll:false,tally:-1,tease:false,soundHint:true,autoOpen:false,autoPlan:{count:25,stopFeature:true,stopBig:true,lossLimit:0},autoStart:0,session:{spins:0,wagered:0,won:0,best:0,features:0,recent:[]},machineSessions:{},gamble:null,gambleTaken:false,floor:'all',favs:[],sort:'floor'});
/** Decorative machine-specific commissioned artwork. Reels and payouts remain live DOM. */
export function slotCabinetArt(machineId:string,large=false):string {
 if(!MACHINES.some(m=>m.id===machineId))return '';
 return `<span class="casino-slot-art ${large?'casino-slot-art-large':''}" aria-hidden="true"><picture><source type="image/webp" srcset="/casino-art/${machineId}-marquee.webp"><img src="/casino-art/${machineId}.svg" alt="" loading="${large?'eager':'lazy'}" decoding="async"></picture></span>`;
}
const money=(cents:number)=>`$${(cents/100).toLocaleString('en-US',cents%100?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0})}`;
/** Phase 13.6: money that can carry tenths of a cent, shown exactly. Ways
 * machines split the bet into 50 units, so a per-way award can be worth
 * $0.176; rounding that to $0.18 in the paytable made the table's arithmetic
 * disagree with settlement ($0.18 × 12 ways implies $2.16; the engine pays
 * $2.11, from 17.6¢ × 12 rounded once). Whole-cent amounts render as money(). */
export function moneyExact(cents:number):string {
 if(Math.abs(cents-Math.round(cents))<1e-9)return money(Math.round(cents));
 return `$${(cents/100).toFixed(3)}`;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const smallestBet=()=>Math.min(...MACHINES.flatMap(m=>m.bets));
export function betFor(m:Machine,ui:SlotsUi,balance:number):number {
 const chosen=ui.bet[m.id];if(chosen!==undefined&&m.bets.includes(chosen))return chosen;
 return [...m.bets].reverse().find(b=>b<=Math.max(m.bets[0],balance/40))??m.bets[0];
}
/** Phase 10 (P10-F09): the largest single award a machine can pay, in cents, at its max
 * bet. Phase 13.6: REACHABLE awards only — the Phase 10 version promoted whatever the
 * paytable's biggest number was, and an independent audit proved four of those could
 * never occur (five wilds on machines whose wild never lands on reel one, five Zeus
 * with Zeus on two reels, fifteen pearls on reels that can show nine). Line pays now
 * count only when src/slots/exact.ts can construct them from the reel strips, and
 * scatter / scatter-pay tiers only up to the most the window can physically show.
 * Display only; the engine is untouched. */
export function topAward(m:Machine):number {
 const bet=m.bets.at(-1)!;
 const unit=m.cascade?bet:m.ways?bet/m.ways.betUnit:bet/m.lines.length;
 let top=0;
 if(m.cascade||m.ways)for(const p of Object.values(m.pays))top=Math.max(top,Math.max(...p)*unit);
 else for(const [s,p] of Object.entries(m.pays))for(let c=3;c<p.length;c++)if(p[c]>0&&lineWinReachable(m,s,c))top=Math.max(top,p[c]*unit);
 if(m.coin)top=Math.max(top,m.coin.grand*bet);
 if(m.wheel)top=Math.max(top,Math.max(...m.wheel.segments.map(s=>s.x))*bet);
 if(m.pick)top=Math.max(top,Math.max(...m.pick.prizes.map(p=>p.x))*bet);
 if(m.scatter){const maxN=maxCountAnywhere(m,m.scatter.sym);for(const [n,x] of Object.entries(m.scatter.pays))if(Number(n)<=maxN)top=Math.max(top,x*bet);}
 if(m.scatterPay){const maxN=maxCountAnywhere(m,m.scatterPay.sym);for(const [n,x] of Object.entries(m.scatterPay.pays))if(Number(n)<=maxN)top=Math.max(top,x*bet);}
 return Math.round(top);
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
 ${soundBarMarkup(ui)}
 ${low?`<p class="muted">Your slots balance is below the smallest bet. <button type="button" class="button primary" id="slots-reload">Reload ${money(100000)} of practice chips</button></p>`:''}
 <div class="segmented slot-floor-tabs" role="group" aria-label="Show machines">${([['all','All'],['fav',`★ Favourites${ui.favs.length?` (${ui.favs.length})`:''}`],['classic','Classic'],['video','Video'],['bonus','Bonus features']] as const).map(([k,l])=>`<button type="button" class="segment${ui.floor===k?' selected':''}" data-slot-floor="${k}" aria-pressed="${ui.floor===k}">${l}</button>`).join('')}</div>
 ${(()=>{const ids=[...new Set([...state.recent].reverse().map(x=>x.machine))].slice(0,3).map(id=>MACHINES.find(m=>m.id===id)).filter((m):m is Machine=>!!m);return ids.length?`<div class="slot-recently"><small>RECENTLY PLAYED</small>${ids.map(m=>`<button type="button" class="slot-chip" data-slot-machine="${m.id}" style="--glow:${m.theme.glow}">${symbolMarkup(m,previewSymbols(m)[0],'',true)}<b>${esc(m.name)}</b></button>`).join('')}</div>`:'';})()}
 <div class="slot-sort"><label for="slot-sort">Sort</label><select id="slot-sort">${([['floor','Floor order'],['played','Most played'],['payback','Highest payback'],['calm','Calmest first']] as const).map(([k,l])=>`<option value="${k}" ${ui.sort===k?'selected':''}>${l}</option>`).join('')}</select></div>
 ${ui.floor==='fav'&&!ui.favs.length?'<p class="muted">No favourites yet. Tap the ☆ on a machine to keep it here.</p>':''}
 <ul class="slot-machines">${sortMachines(MACHINES.filter(m=>ui.floor==='fav'?ui.favs.includes(m.id):ui.floor==='all'||(ui.floor==='classic'?m.kind==='classic'||m.kind==='wheel':ui.floor==='video'?m.kind!=='classic'&&m.kind!=='wheel':m.stats.featureEvery!==null)),ui.sort,state).map(m=>{const r=state.machines[m.id];const preview=previewSymbols(m).map(s=>symbolMarkup(m,s,'',true)).join('');
  const fav=ui.favs.includes(m.id);
  return `<li class="slot-li"><button type="button" class="slot-star${fav?' on':''}" data-slot-fav="${m.id}" aria-pressed="${fav}" aria-label="${fav?'Remove':'Add'} ${esc(m.name)} ${fav?'from':'to'} favourites">${fav?'★':'☆'}</button><button type="button" class="slot-card kind-${m.kind}" data-slot-machine="${m.id}" style="--top:${m.theme.top};--bottom:${m.theme.bottom};--glow:${m.theme.glow}"><span class="slot-card-marquee"><i class="slot-lights" aria-hidden="true"></i>${slotCabinetArt(m.id)}<b>${esc(m.name)}</b><small>${esc(m.theme.marquee)}</small></span><span class="slot-card-reels" aria-hidden="true">${preview}</span><span class="slot-card-text"><span>${esc(m.tagline)}</span><small><b>${m.rtp.toFixed(1)}%</b> payback · ${swingMeter(m)} · pays on ${Math.round(m.stats.hitRate)}% of spins${m.stats.featureEvery?` · feature ~1 in ${m.stats.featureEvery}`:''} · ${money(m.bets[0])}–${money(m.bets.at(-1)!)} · top award <b>${money(topAward(m))}</b>${r?` · you: ${r.spins} spins, ${r.wagered?(100*r.won/r.wagered).toFixed(0):'0'}% back${r.spins>=300?' · ★ FLOOR LEGEND':r.spins>=100?' · ★ SHARP':r.spins>=25?' · ★ REGULAR':''}`:''}</small></span></button></li>`;}).join('')}</ul>
 <details class="slots-how"><summary>How slots work</summary><p>Every spin is drawn at random and has nothing to do with the spins before it. No machine is "due", and no bet size or timing changes the odds.</p><p><b>Payback</b> is the share of all money bet that a machine returns over millions of spins. At 95%, the house keeps about 5 cents of every dollar you bet, however you play. Short sessions swing a long way either side of it, more so on machines with big swings.</p><p>This is practice with virtual chips. Your slots balance is separate from your poker and blackjack balances.</p></details>`;
}
/** Phase 8: a symbol's rendered art — the photographic sheet asset when this machine has one,
 * the code-drawn drawing otherwise. The blank symbol has no asset and stays blank. */
export function symbolArt(m:Machine,artKey:string,eager=false):string {
 const img=symbolImage(m.id,artKey);
 return img?`<img class="slot-art-img" src="${img}" alt="" loading="${eager?'eager':'lazy'}"${eager?' fetchpriority="high"':''} decoding="async">`:artFor(artKey);
}
export function symbolMarkup(m:Machine,s:Sym,extra='',eager=false):string {
 if(s.startsWith('bomb:'))return `<span class="slot-sym tone-bonus slot-bomb${extra}" title="Multiplier bomb ×${s.slice(5)}">${symbolArt(m,'bomb',eager)}<b>×${s.slice(5)}</b></span>`;
 const d=m.symbols[s]??{label:s,art:s,tone:'low'};
 const img=symbolImage(m.id,d.art);
 return `<span class="slot-sym tone-${d.tone}${extra}" title="${esc(d.label)}"${img?` role="img" aria-label="${esc(d.label)}"`:''}>${symbolArt(m,d.art,eager)}</span>`;
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
 if((ui.phase==='free'||ui.phase==='done')&&r.free&&!r.hold){const f=r.free.spins[ui.phase==='done'?r.free.spins.length-1:Math.min(ui.step,r.free.spins.length-1)];/* Phase 11: while a free spin's reels roll, show its grid without its wins — they land with the reels. */return ui.freeRoll?{grid:f.grid,wins:[]}:atRest(f);}
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
/** Phase 8: the celebration comes in distinct tiers. A nice win (5×+) spills a few coins;
 * BIG adds sparks, MEGA adds more of both, and EPIC (100×+) gets the full burst plus the
 * crown moment machineMarkup renders. Pure decoration — pointer-events:none throughout,
 * and the reduced-motion / motion-off rules hide the layer entirely. */
function winBurst(tier:string|null,r:SpinResult|null,ui:SlotsUi):string {
 if(!r||ui.phase!=='done')return '';
 if(tier==='EPIC WIN')return particles(36,'coin')+particles(16,'spark');
 if(tier==='MEGA WIN')return particles(26,'coin')+particles(12,'spark');
 if(tier)return particles(18,'coin')+particles(8,'spark');
 return r.total>=5*r.bet?particles(14,'coin'):'';
}
function machineMarkup(state:SlotsState,ui:SlotsUi,m:Machine):string {
 const bet=betFor(m,ui,state.balance),busy=ui.phase!=='idle'&&ui.phase!=='done',r=ui.result,rec=state.machines[m.id];
 const shownGrid=currentGrid(m,ui),{grid,coins,mults}=shownGrid,allWins=shownGrid.wins,one=ui.phase==='done'&&ui.lineIndex>=0&&allWins.length>1?allWins[ui.lineIndex%allWins.length]:null,wins=one?[one]:allWins,hit=new Set([...wins.flatMap(w=>w.cells.map(([a,b])=>`${a}:${b}`)),...(shownGrid.hits??[]).map(([a,b])=>`${a}:${b}`)]);
 const settled=ui.phase==='done'||ui.phase==='free'||ui.phase==='cascade';
 /* Phase 6 re-tiering: the cabinet-wide theatre (dimming the misses, the winning glow) is earned
  * only by a win that at least returns the bet. A sub-bet win stays a quiet meter/status event,
  * so a $0.32 return can no longer out-celebrate a $55 win. */
 const meaningfulWin=!!r&&r.total>=r.bet;
 /* Phase 11: the bonus symbol whose landing pulses while a spin is live (S-F13). */
 const bonusSym=m.scatter?.sym??m.coin?.sym??m.pick?.sym??m.wheel?.sym??m.scatterPay?.sym;
 const prevCoins=ui.phase==='hold'&&r?.hold&&ui.step>0?r.hold.frames[ui.step-1].grid:undefined;
 const reels=grid.map((col,reel)=>{const spinning=(ui.phase==='spinning'||(ui.phase==='free'&&ui.freeRoll))&&reel>=ui.stopped,strip=m.reels[reel];
  /* Phase 11 (S-U09): while a respin rolls, open spaces and not-yet-landed coins show a rolling mini-strip. */
  const rollCell=()=>`<div class="slot-cell rolling"><div class="slot-roll-mini">${Array.from({length:3},(_,k)=>`<div class="slot-cell">${symbolMarkup(m,strip[(reel*7+k*3)%strip.length],'',true)}</div>`).join('')}</div></div>`;
  return `<div class="slot-reel${spinning?' spinning':''}${spinning&&ui.anticipate.includes(reel)?' anticipate':''}" style="--reel:${reel}">${spinning?`<div class="slot-strip">${Array.from({length:m.rows+3},(_,k)=>`<div class="slot-cell">${symbolMarkup(m,strip[(reel*7+k*3)%strip.length],'',true)}</div>`).join('')}</div>`:col.map((s,row)=>{
   const coin=coins?.[reel]?.[row];
   if(coins){if(ui.holdRoll&&(coin==null||prevCoins?.[reel]?.[row]==null))return rollCell();
    const tallyIdx=r?.hold?.coins.findIndex(c=>c.reel===reel&&c.row===row)??-1,tallyLit=ui.phase==='hold'&&ui.tally>=0&&tallyIdx>=0&&tallyIdx<ui.tally;
    return `<div class="slot-cell${coin!=null?' coin':' empty'}${tallyLit?' tally-lit':''}">${coin!=null?`<span class="slot-coin">${symbolMarkup(m,m.coin!.sym,'',true)}<b>${coin>=20?`<small>${coin>=150?'MAJOR':coin>=50?'MINOR':'MINI'}</small>`:''}${money(coin*(r?.bet??bet))}</b></span>`:''}</div>`;}
   return `<div class="slot-cell${settled&&hit.has(`${reel}:${row}`)?' hit':''}${settled&&meaningfulWin&&wins.length&&!hit.has(`${reel}:${row}`)?' dim':''}${m.lines.length===1&&row!==1?' off-line':''}${ui.phase==='cascade'&&hit.has(`${reel}:${row}`)?' shatter':''}${(ui.phase==='spinning'||ui.phase==='free')&&s===bonusSym?' bonus-live':''}" style="--row:${row}">${symbolMarkup(m,s,'',true)}${mults&&mults[reel][row]>1?`<b class="slot-mult">×${mults[reel][row]}</b>`:''}</div>`;}).join('')}</div>`;}).join('');
 /* Phase 9 (fun #16): a factual near-miss line — the settled grid is one symbol
  * short of the feature this machine actually offers. Presentation only. */
 const nearMiss=(()=>{ if(!r||ui.phase!=='done'||r.total>0) return '';
  const flat=r.grid.flat();
  if(m.scatter){const need=Math.min(...Object.keys(m.scatter.freeSpins).map(Number));const n=flat.filter(x=>x===m.scatter!.sym).length;if(need>1&&n===need-1)return `${n} scatters — one short of free spins`;}
  if(m.coin){const n=flat.filter(x=>x===m.coin!.sym).length;if(m.coin.trigger>1&&n===m.coin.trigger-1)return `${n} coins — one short of Hold & Spin`;}
  return '';})();
 /* Phase 11: while a tease is live the status states the fact of the drawn grid so
  * far — how many bonus symbols have landed, and that one more completes it. */
 const teaseStatus=(()=>{ if(ui.phase!=='spinning'||!r||!ui.anticipate.length)return ''; const a=anticipation(m); if(!a)return ''; const landed=r.grid.slice(0,ui.stopped).flat().filter(s=>s===a.sym).length; return landed===a.need-1?`${landed} of ${a.need} ${esc(m.symbols[a.sym]?.label.replace(/ \(.*\)/,'')??'bonus')} — one more`:''; })();
 const tallySum=ui.phase==='hold'&&r?.hold&&ui.tally>0?r.hold.coins.slice(0,ui.tally).reduce((a,c)=>a+c.x*r.bet,0):0;
 let status='';
 if(teaseStatus)status=`<span class="slot-status feature">${teaseStatus}</span>`;
 else if(ui.phase==='spinning')status='<span class="slot-status">GOOD LUCK!</span>';
 else if(ui.phase==='free'&&r?.free)status=`<span class="slot-status feature">FREE SPIN ${Math.min(ui.step+1,r.free.spins.length)} / ${r.free.spins.length}${m.scatter!.freeMultiplier>1?` · ×${m.scatter!.freeMultiplier}`:""}</span>`;
 else if(ui.phase==='hold'&&r?.hold&&ui.tally>=0)status=`<span class="slot-status feature">COUNTING · ${money(tallySum)}</span>`;
 else if(ui.phase==='hold'&&r?.hold)status=`<span class="slot-status feature">HOLD &amp; SPIN · ${r.hold.frames[Math.min(ui.step,r.hold.frames.length-1)].respins} RESPINS</span>`;
 else if(ui.phase==='wheel')status='<span class="slot-status feature">BONUS WHEEL!</span>';
 else if(ui.phase==='cascade'&&r?.cascade)status=`<span class="slot-status feature">TUMBLE ${ui.step+1} · ${money(r.cascade.frames.slice(0,ui.step+1).reduce((a,f)=>a+f.win,0))}</span>`;
 else if(ui.phase==='pick'&&r?.pick)status=`<span class="slot-status feature">PICK A CHEST · ${r.pick.prizes.length-ui.picked.length} LEFT</span>`;
 else if(r&&ui.phase==='done'&&one)status=`<span class="slot-status line">${one.line>=0?`LINE ${one.line+1} · `:''}${one.count}× ${esc(m.symbols[one.sym]?.label.replace(/ \(.*\)/,'')??(one.sym==='anybar'?'any bar':one.sym))}${m.ways?` · ${Math.round(one.amount/((m.pays[one.sym]?.[one.count]??1)*(r.bet/m.ways.betUnit)))} way${Math.round(one.amount/((m.pays[one.sym]?.[one.count]??1)*(r.bet/m.ways.betUnit)))===1?'':'s'}`:''} · ${money(one.amount)}</span>`;
 else if(r&&ui.phase==='done'&&nearMiss)status=`<span class="slot-status near">${nearMiss}</span>`;
 else if(r&&ui.phase==='done')status=r.total>0?`<span class="slot-status win${winTier(r.total,r.bet)?' big':''}" data-testid="slot-win">${winTier(r.total,r.bet)??(r.total>=5*r.bet?'NICE WIN':'WIN')} ${money(r.total)}${r.free?` · FREE SPINS ${money(r.free.total)}`:''}${r.hold?` · HOLD &amp; SPIN ${money(r.hold.total)}${r.hold.full?' · GRAND!':''}`:''}${r.wheel?` · WHEEL ×${r.wheel.x}`:''}${r.cascade&&r.cascade.multiplier>1?` · BOMBS ×${r.cascade.multiplier}`:''}${r.pick?` · TREASURE ${money(r.pick.amount)}`:''}</span>`:'<span class="slot-status quiet">PLACE YOUR BET</span>';
 else status='<span class="slot-status quiet">PLACE YOUR BET</span>';
 const shownWin=ui.phase==='free'&&r?.free?r.free.spins.slice(0,ui.freeRoll?ui.step:ui.step+1).reduce((a,x)=>a+x.total,0)+r.lineTotal+r.scatterWin:ui.phase==='hold'&&r?.hold&&ui.tally>0?tallySum:ui.phase==='done'&&r?r.total:0;
 /* Phase 4: the celebration scales with the win tier (BIG 15×, MEGA 40×, EPIC 100×) — more coins, and a
  * cabinet class the styles answer with a stronger glow for the two higher tiers. */
 const tier=r&&ui.phase==='done'?winTier(r.total,r.bet):null;
 const big=!!tier;
 const i=m.bets.indexOf(bet),lower=m.bets[i-1],higher=m.bets[i+1];
 const shown=state.balance-ui.pending;
 return `<div class="slot-head"><button type="button" class="button secondary" id="slots-back" ${busy?'disabled':''}>← Machines</button><span class="slot-name"><small>${m.rtp.toFixed(1)}% payback · ${swingMeter(m)}</small><small>Pays on ${m.stats.hitRate.toFixed(0)}% of spins${m.stats.featureEvery?` · feature about 1 in ${m.stats.featureEvery}`:''} · biggest seen ${m.stats.topSeen.toLocaleString()}× bet</small><small>Top award <b>${money(topAward(m))}</b> at the ${money(m.bets.at(-1)!)} max bet</small></span></div>
 ${soundBarMarkup(ui)}
 <div class="slot-cabinet kind-${m.kind}${big?' big-win':''}${tier==='MEGA WIN'?' mega-win':''}${tier==='EPIC WIN'?' epic-win':''}${!tier&&r&&ui.phase==='done'&&r.total>=5*r.bet?' nice-win':''}${r&&settled&&meaningfulWin?' winning':''}${ui.phase==='free'?' free-spins':''}${ui.phase!=='idle'&&ui.phase!=='done'&&ui.phase!=='spinning'?' in-feature':''}${ui.tease?' tease':''}" data-testid="slot-machine" style="--top:${m.theme.top};--bottom:${m.theme.bottom};--glow:${m.theme.glow};--reels:${m.reels.length};--rows:${m.rows};--cabinet-scene:url('/casino-art/${m.id}-cinematic.webp')">
  <div class="slot-marquee"><i class="slot-lights" aria-hidden="true"></i>${slotCabinetArt(m.id,true)}<h3 style="--len:${m.name.length}">${esc(m.name)}</h3><small>${esc(m.theme.marquee)}</small></div>
  <div class="slot-window-frame"><div class="slot-window${ui.phase==='idle'||(ui.phase==='done'&&!wins.length)?' idle':''}" style="--reels:${m.reels.length};--rows:${m.rows}">${reels}${settled&&!ui.gamble?floats(m,wins,grid.length,grid[0]?.length??m.rows):''}${settled?paylines(m,wins):''}<i class="slot-glass" aria-hidden="true"></i>${ui.phase==='spinning'?'<button type="button" class="slot-slam" id="slots-slam" aria-label="Stop the reels now"></button>':''}</div>${ui.phase==='free'&&r?.free?`<div class="slot-fs-banner" data-testid="slot-fs-banner"><span>FREE SPINS</span><b>${r.free.spins.length-Math.min(ui.step,r.free.spins.length-1)} LEFT</b><span class="slot-fs-won">WON ${money(shownWin)}</span></div>`:''}${tier==='EPIC WIN'?`<span class="slot-crown-moment" aria-hidden="true">${artFor('crown')}</span><img class="slot-jackpot-burst" src="/casino-art/jackpot-celebration.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">`:''}${winBurst(tier,r,ui)}</div>
  ${ui.overlay?overlayMarkup(ui):''}${ui.gamble?gambleMarkup(ui):''}${m.wheel?wheelMarkup(m,ui):''}${m.pick&&r?.pick&&(ui.phase==='pick'||ui.phase==='done')?pickMarkup(m,ui,r):''}
  ${ui.phase==='free'||ui.phase==='hold'||ui.phase==='cascade'||ui.phase==='wheel'?`<button type="button" class="slot-skip-feature" id="slots-skip-feature">Skip feature ▸▸</button>`:''}
  <div class="slot-status-row" role="status" aria-live="polite">${status}</div>
  <div class="slot-meters"><div><small>CREDIT</small><b data-count-key="slots-balance" data-count="${shown}">${money(shown)}</b></div><div><small>BET</small><b>${money(bet)}</b></div><div class="${shownWin>0?'lit':''}"><small>WIN</small><b data-count-key="slots-win" data-count="${shownWin}">${money(shownWin)}</b></div></div>
  <div class="slot-deck">
   <div class="slot-bet-step" role="group" aria-label="Bet per spin"><button type="button" class="slot-key" ${lower!==undefined&&!busy?`data-slot-bet="${lower}"`:'disabled'} aria-label="Lower bet">−</button><span><small>BET</small>${money(bet)}</span><button type="button" class="slot-key" ${higher!==undefined&&!busy&&higher<=state.balance?`data-slot-bet="${higher}"`:'disabled'} aria-label="Raise bet">+</button></div>
   <div class="slot-keys"><button type="button" class="slot-key small" id="slots-pays">PAYS<small>table</small></button><button type="button" class="slot-key small" id="slots-max" ${busy||bet===m.bets.at(-1)?'disabled':''}>MAX<small>bet</small></button>${r&&ui.phase==='done'&&r.total>0&&ui.auto===0&&!ui.gambleTaken&&!ui.gamble&&r.total<=state.balance?`<button type="button" class="slot-key small gamble" id="slots-gamble">GAMBLE<small>${money(r.total)}</small></button>`:''}<button type="button" class="slot-key small${ui.turbo?' on':''}" id="slots-turbo" aria-pressed="${ui.turbo}">PACE<small>${ui.turbo?'fast':'standard'}</small></button>${ui.auto>0?`<button type="button" class="slot-key small on" id="slots-stop">STOP<small>${ui.auto} left</small></button>`:`<button type="button" class="slot-key small${ui.autoOpen?' on':''}" id="slots-auto" aria-expanded="${ui.autoOpen}" ${busy?'disabled':''}>AUTO<small>${ui.autoPlan.count}</small></button>`}</div>
   <button type="button" class="slot-spin-button${ui.phase==='spinning'&&ui.stopped<m.reels.length?' stop':''}" id="slots-spin" ${(busy&&ui.phase==='pick')||(!busy&&state.balance<bet)?'disabled':''} aria-label="${ui.phase==='spinning'&&ui.stopped<m.reels.length?'Stop the reels':busy?'Advance the feature':`Spin for ${money(bet)}`}"><span>${ui.phase==='spinning'&&ui.stopped<m.reels.length?'STOP':busy?'▸▸':'SPIN'}</span></button>
  </div>
  ${ui.neighbour&&ui.machine===m.id?`<div class="slot-neighbour" data-testid="slot-neighbour" aria-live="polite"><span class="slot-nb-face" aria-hidden="true">${esc(ui.neighbour.name[0])}</span><span><b>${esc(ui.neighbour.name)}</b> <small>at the next machine</small><br>“${esc(ui.neighbour.text)}”</span></div>`:''}
 </div>
 ${ui.autoOpen&&!busy?autoMarkup(ui,state.balance):''}${sessionMarkup(ui)}
 ${state.balance<bet&&!busy?`<p class="muted">Not enough for this bet.${state.balance<smallestBet()?' <button type="button" class="button secondary" id="slots-reload">Reload $1,000 of practice chips</button>':' Pick a smaller bet.'}</p>`:''}
 ${paytableMarkup(m,bet,ui)}
 <p class="muted slot-record">${rec?`You on this machine: ${rec.spins} spin${rec.spins===1?'':'s'} · bet ${money(rec.wagered)} · won ${money(rec.won)} · ${(100*rec.won/Math.max(1,rec.wagered)).toFixed(0)}% back · biggest ${money(rec.biggest)}`:'No spins here yet.'} Each spin is independent; long-run payback about ${m.rtp.toFixed(1)}%.</p>${floorStreakMarkup(state,m)}${bonusWatchMarkup(state,m)}`;
}
/** Phase 10 (fun #15, BONUS WATCH — the honest replacement for a feature-tease meter):
 * spins since your last feature on this machine, and features hit vs the count expected
 * at the machine's published rate, over the spins this counter has seen. History only:
 * triggers are independent random events, so nothing here fills up or comes due. */
/**
 * Phase 10 (fun #18): the floor streak on this machine — the run of winning or losing
 * spins at the tail of the player's own stored recent results. Pure history, stated
 * as history: a run says nothing about the next spin.
 */
export function floorStreakMarkup(state:SlotsState,m:Machine):string {
 const mine=state.recent.filter(r=>r.machine===m.id);if(mine.length<3)return '';
 const nets=mine.map(r=>r.total-r.bet);
 let run=0;const win=nets[nets.length-1]>0;
 for(let i=nets.length-1;i>=0;i--){if(nets[i]!==0&&(nets[i]>0)===win)run++;else break;}
 if(run<3)return '';
 return `<p class="muted slot-streak" data-testid="slot-streak">Your run here: <b>${run} ${win?'winning':'losing'} spins in a row</b> on this machine. History only — every spin is independent and the run changes nothing about the next one.</p>`;
}
export function bonusWatchMarkup(state:SlotsState,m:Machine):string {
 const w=state.watch?.[m.id],every=m.stats.featureEvery;
 if(!w||!every||!w.spins)return '';
 const expected=w.spins/every;
 return `<p class="muted slot-watch" data-testid="slot-bonus-watch">Bonus watch (counting since this counter began): <b>${w.since} spin${w.since===1?'':'s'}</b> since your last feature here · <b>${w.hits} feature${w.hits===1?'':'s'}</b> in ${w.spins} counted spins, against about ${expected<10?expected.toFixed(1):Math.round(expected)} expected at this machine's published rate of 1 in ${every}. History only — every spin is independent and no feature is ever due.</p>`;
}
const WHEEL_COLOURS=['#c0392b','#f39c12','#27ae60','#2980b9','#8e44ad','#16a085','#d35400','#2c3e50','#b03a6f'];
function wheelMarkup(m:Machine,ui:SlotsUi):string {
 const segs=m.wheel!.segments,n=segs.length,r=ui.result?.wheel,turn=r&&(ui.phase==='wheel'||ui.phase==='done')?360*5-(r.segment+.5)*(360/n):0;
 return `<div class="slot-bonus-wheel${r&&(ui.phase==='wheel'||ui.phase==='done')?' shown':''}" aria-hidden="true"><div class="slot-wheel-disc" style="--turn:${turn}deg;--n:${n};background:conic-gradient(${segs.map((_,i)=>`${WHEEL_COLOURS[i%WHEEL_COLOURS.length]} ${(100*i/n).toFixed(2)}% ${(100*(i+1)/n).toFixed(2)}%`).join(',')})">${segs.map((s,i)=>`<span style="--i:${i}">${s.x}×</span>`).join('')}</div><i class="slot-wheel-pointer"></i></div>`;
}

function pickMarkup(m:Machine,ui:SlotsUi,r:SpinResult):string {
 const p=r.pick!,done=ui.picked.length>=p.prizes.length,bet=r.bet;let other=0;
 const cells=Array.from({length:m.pick!.board},(_,i)=>{const k=ui.picked.indexOf(i);
  if(k>=0)return `<span class="slot-chest open won" style="--k:${k}">${symbolArt(m,'coin')}<b>${money(p.prizes[k]*bet)}</b></span>`;
  if(done){const v=p.others[other++];return `<span class="slot-chest open missed">${symbolArt(m,'chest')}<b>${money(v*bet)}</b></span>`;}
  return `<button type="button" class="slot-chest" data-slot-pick="${i}" aria-label="Open chest ${i+1}">${symbolArt(m,'chest')}</button>`;}).join('');
 return `<div class="slot-pick" data-testid="slot-pick"><p>${done?`Your treasure: <b>${money(p.amount)}</b>. The others held what you see.`:`Pick ${p.prizes.length-ui.picked.length} more chest${p.prizes.length-ui.picked.length===1?'':'s'}.`}</p><div class="slot-chests">${cells}</div></div>`;
}
/** Phase 10 (P10-F06): every jackpot and feature award as money at the displayed bet
 * size — coin values (Mini/Minor/Major named), the Grand, each wheel segment, each
 * chest prize, scatter pays and scatter-pay rows. All values are the multipliers
 * already published in machines.ts times the displayed bet; display only.
 * Multiplier bombs multiply a cascade WIN, not the bet, so they are listed as the
 * multipliers they are rather than dressed up as dollar amounts. */
export function featureAwardsMarkup(m:Machine,bet:number):string {
 const rows:string[]=[];
 if(m.coin){
  for(const v of [...m.coin.values].sort((a,b)=>b.x-a.x))rows.push(`<tr><td>${v.name?`${v.name} coin`:'Coin'} (${v.x}× bet)</td><td>${money(Math.round(v.x*bet))}</td></tr>`);
  rows.push(`<tr><td><b>Grand — fill all ${m.reels.length*m.rows} spaces (${m.coin.grand}× bet)</b></td><td><b>${money(m.coin.grand*bet)}</b></td></tr>`);
 }
 if(m.wheel)for(const s of [...m.wheel.segments].sort((a,b)=>b.x-a.x))rows.push(`<tr><td>Wheel segment (${s.x}× bet)</td><td>${money(s.x*bet)}</td></tr>`);
 if(m.pick)for(const p of [...m.pick.prizes].sort((a,b)=>b.x-a.x))rows.push(`<tr><td>Chest prize (${p.x}× bet)</td><td>${money(Math.round(p.x*bet))}</td></tr>`);
 /* Phase 13.6: tiers above the most the window can physically show are not
  * advertised — Poseidon's reels can show at most nine pearls, so the 12- and
  * 15-pearl rows the engine's table carries are never displayed. */
 if(m.scatter)for(const n of Object.keys(m.scatter.pays).map(Number).sort((a,b)=>a-b).filter(n=>n<=maxCountAnywhere(m,m.scatter!.sym)))rows.push(`<tr><td>${n} ${esc(m.symbols[m.scatter.sym]?.label.replace(/ \(.*\)/,'')??'scatter')}s anywhere (${m.scatter.pays[n]}× bet + ${m.scatter.freeSpins[n]} free spins)</td><td>${money(Math.round(m.scatter.pays[n]*bet))}</td></tr>`);
 if(m.scatterPay)for(const n of Object.keys(m.scatterPay.pays).map(Number).sort((a,b)=>a-b).filter(n=>n<=maxCountAnywhere(m,m.scatterPay!.sym)))rows.push(`<tr><td>${n} ${esc(m.symbols[m.scatterPay.sym]?.label.replace(/ \(.*\)/,'')??'scatter')}s anywhere (${m.scatterPay.pays[n]}× bet)</td><td>${money(Math.round(m.scatterPay.pays[n]*bet))}</td></tr>`);
 const bombs=m.cascade?`<p class="muted">Multiplier bombs are worth ${[...m.cascade.bomb.values].sort((a,b)=>a.x-b.x).map(v=>`×${v.x}`).join(', ')}: the bombs left on the screen add together and multiply the whole cascade win (they are multipliers of the win, not of your bet).</p>`:'';
 const wildMult=m.wildMultiplier?`<p class="muted">A wild in a winning line multiplies that win ×${m.wildMultiplier}; two wilds in one line multiply it ×${m.wildMultiplier**2}.</p>`:'';
 if(!rows.length&&!bombs&&!wildMult)return '';
 return `<h4 class="slot-awards-head">Feature &amp; jackpot awards at ${money(bet)} a spin</h4>${rows.length?`<table class="deep-table slot-pays slot-awards"><tbody>${rows.join('')}</tbody></table>`:''}${bombs}${wildMult}`;
}
function paytableMarkup(m:Machine,bet:number,ui:SlotsUi):string {
 /* Phase 10 (P10-F05): the paytable can be VIEWED at any of the machine's bet sizes
  * via its own switcher, without changing the bet a spin is placed at. Payouts are
  * pure multipliers, so this is a re-render of the same data at another size. */
 const viewBet=ui.payBet[m.id]!==undefined&&m.bets.includes(ui.payBet[m.id])?ui.payBet[m.id]:bet;
 const switcher=`<div class="slot-paybets" role="group" aria-label="Paytable bet size"><span>See payouts at</span>${m.bets.map(b=>`<button type="button" class="slot-paybet${b===viewBet?' selected':''}" data-slot-paybet="${b}" aria-pressed="${b===viewBet}">${money(b)}</button>`).join('')}${viewBet!==bet?`<small>Viewing only — your spin bet stays ${money(bet)}</small>`:''}</div>`;
 bet=viewBet;
 const row=(s:string,cells:string)=>`<tr><td>${symbolMarkup(m,s,'',true)}<span class="pay-name">${esc(m.symbols[s]?.label??s)}</span></td>${cells}</tr>`;
 let intro='',head='',body='';
 if(m.cascade){const t=m.cascade.tiers;
  intro=`${t[0]} or more of the same gem anywhere on the screen pay, as shown. Winning gems shatter, the rest fall, and new gems drop in; this repeats while there are wins. Multiplier bombs (×2 to ×100) left on the screen at the end add together and multiply the whole cascade. ${m.scatter?`${esc(m.symbols[m.scatter.sym].label.replace(/ \(.*\)/,''))}s pay and start free spins: ${Object.keys(m.scatter.pays).map(Number).sort((a,b)=>a-b).map(n=>`${n} pay ${m.scatter!.pays[n]}× your bet and start ${m.scatter!.freeSpins[n]} free spins`).join('; ')}.`:''}`;
  head=`<th>Gem</th><th>${t[0]}–${t[1]-1}</th><th>${t[1]}–${t[2]-1}</th><th>${t[2]}+</th>`;
  body=Object.entries(m.pays).map(([s,p])=>row(s,p.map(x=>`<td>${money(Math.round(x*bet))}</td>`).join(''))).join('');}
 else{
  const unit=m.ways?bet/m.ways.betUnit:bet/m.lines.length;
  intro=m.ways?`1,024 ways: a symbol pays when it lands on adjacent reels from the left, in any row; every combination pays (your bet buys ${m.ways.betUnit} units of ${moneyExact(unit)}). Per-way awards below are shown exactly, to the tenth of a cent where the unit split needs it: a win pays the per-way award times the number of ways, rounded once to the nearest cent. ${esc(m.symbols[m.wild!].label)} stands in on the middle reels. ${m.scatter?`Three, four or five ${esc(m.symbols[m.scatter.sym].label.toLowerCase())}s pay ${m.scatter.pays[3]}×, ${m.scatter.pays[4]}× or ${m.scatter.pays[5]}× your bet and start ${m.scatter.freeSpins[3]}, ${m.scatter.freeSpins[4]} or ${m.scatter.freeSpins[5]} free spins; there every wild is ×2 or ×3, and the wilds in a win multiply together.`:''}`
   :`${m.lines.length} line${m.lines.length===1?'':'s'}, ${money(unit)} each. ${m.wild?`${esc(m.symbols[m.wild].label)} stands in for every symbol except bonus symbols${m.wildMultiplier?` and multiplies the win ×${m.wildMultiplier} (two of them ×${m.wildMultiplier**2})`:''}. `:''}${m.cherry?`Cherries pay anywhere on a line: one ${money(m.cherry.pays[1]*unit)}, two ${money(m.cherry.pays[2]*unit)}, three ${money(m.cherry.pays[3]*unit)}. `:''}${m.anyBar?`Any three bars ${money(m.anyBar.pay*unit)}. `:''}${m.scatter?`Three, four or five ${esc(m.symbols[m.scatter.sym].label.toLowerCase())}s anywhere pay ${m.scatter.pays[3]}×, ${m.scatter.pays[4]}× or ${m.scatter.pays[5]}× your bet and start ${m.scatter.freeSpins[3]}, ${m.scatter.freeSpins[4]} or ${m.scatter.freeSpins[5]} free spins at ${m.scatter.freeMultiplier}× pay. `:''}${m.coin?`${m.coin.trigger} or more coins start Hold &amp; Spin: coins stay, you get 3 respins and each new coin resets them to 3. Coins are worth 1× to 10× your bet, or a Mini (20×), Minor (50×) or Major (150×) jackpot; fill all 15 spaces for the Grand (${m.coin.grand}×). `:''}${m.wheel?`The wheel in the middle of the last reel spins the bonus wheel for ${Math.min(...m.wheel.segments.map(s=>s.x))}× to ${Math.max(...m.wheel.segments.map(s=>s.x))}× your bet. `:''}${m.pick?`Three treasure maps open the chest bonus: pick ${m.pick.picks} of ${m.pick.board} chests, each worth ${Math.min(...m.pick.prizes.map(x=>x.x))}× to ${Math.max(...m.pick.prizes.map(x=>x.x))}× your bet. What is in each chest is decided when the maps land; your taps only open them. `:''}${m.scatterPay?`${esc(m.symbols[m.scatterPay.sym].label.replace(/ \(.*\)/,''))}s pay anywhere on the window, as multiples of your whole bet: ${Object.entries(m.scatterPay.pays).sort((a,b)=>Number(a[0])-Number(b[0])).filter(([n])=>Number(n)<=maxCountAnywhere(m,m.scatterPay!.sym)).map(([n,x])=>`${n} pay ${x}×`).join(', ')}. They never pay on a line. `:''}${m.expandWild?`${esc(m.symbols[m.expandWild].label.replace(/ \(.*\)/,''))} expands to fill its whole reel whenever it lands, so every line through that reel can use it. `:''}`;
  head=`<th>Symbol</th>${m.reels.length===3?'<th>Three</th>':'<th>Three</th><th>Four</th><th>Five</th>'}`;
  body=Object.entries(m.pays).map(([s,p])=>row(s,p.slice(3).map((x,ci)=>`<td>${m.ways?(x?moneyExact(x*unit):'—'):(x&&lineWinReachable(m,s,ci+3)?money(Math.round(x*unit)):'—')}</td>`).join(''))).join('');}
 return `<details class="slot-paytable" id="slot-paytable"><summary>Paytable at ${money(bet)} a spin</summary>${switcher}<p class="muted">${intro}</p><table class="deep-table slot-pays"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${featureAwardsMarkup(m,bet)}</details>`;
}

function overlayMarkup(ui:SlotsUi):string {
 const o=ui.overlay!;
 return `<button type="button" class="slot-overlay ov-${o.kind}${o.kind==='big'?` tier-${o.title.split(' ')[0].toLowerCase()}`:''}" id="slots-skip" data-testid="slot-overlay" aria-label="Continue"><span class="ov-title">${esc(o.title)}</span>${o.amount?`<b class="ov-amount" data-count-key="slots-ov-${o.kind}-${o.amount}" data-count="${o.amount}" data-count-from="0" data-count-ms="${o.kind==='big'?(ui.turbo?1100:2200):900}">${money(o.amount)}</b>`:''}<span class="ov-sub">${esc(o.sub)}</span>${o.kind==='big'?`<span class="slot-burst coin" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i style="--dx:${((i*37)%100-50)}%;--dy:${-40-(i*53)%60}%;--d:${(i*0.09).toFixed(2)}s;--r:${(i*47)%360}deg"></i>`).join('')}</span>`:''}<small class="ov-tap">Tap to continue</small></button>`;
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
 /* Phase 13 (S-6): the strip scopes to the machine on screen — it used to count
  * every machine's spins while the line below it counted only this one. */
 const rec=ui.machine?ui.machineSessions[ui.machine]:ui.session;
 /* The all-machines record is only a fallback for a ui that predates the
  * per-machine records (none written yet); once any machine has a record,
  * a machine without one shows no strip rather than another machine's visit. */
 const s=rec??(Object.keys(ui.machineSessions).length===0?ui.session:{spins:0,wagered:0,won:0,best:0,features:0,recent:[]});if(!s.spins)return '';
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
