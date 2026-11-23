/** Patch 99: the casino tables' markup: roulette, craps, baccarat and the races. */
import {CHIPS,money,type CasinoState} from './wallet';
import {ORDER,DOUBLE_ZERO,colourOf,label,outside,stats,ANNOUNCED,sectionOf,PAYS,SPECIALS,type Special,type BetKind as RBetKind,type Announced} from './roulette';
import {total as bacTotal,bigRoad,derivedRoad,ask,cardsLeft,type BaccaratSpot} from './baccarat';
import {POINTS,HARD,BUYS,SPOT_LABEL,maxOdds,maxLay,oddsMultiple,layMultiple,oddsUp,type Spot} from './craps';
import {odds,oddsLabel,settleBet,paddockNote,BOXABLE,TAKE,PICKS,type BetKind as RaceKind} from './races';
import {RACE_FRAMES,type CasinoUi,type CasinoPlayer} from './play';
import {CHAT,type PatronLine} from './patrons';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const short=(c:number)=>c>=100000?`$${(c/100000).toFixed(c%100000?1:0)}k`:`$${(c/100).toFixed(c%100?2:0)}`;
const chipMark=(amount:number)=>amount?`<span class="cz-chip" aria-hidden="true">${short(amount)}</span>`:'';
const red=(c:string)=>c[1]==='h'||c[1]==='d';
const SUIT:Record<string,string>={s:'♠',h:'♥',d:'♦',c:'♣'};
const cardFace=(c:string,i:number)=>`<span class="cz-card${red(c)?' red':''}" style="--i:${i}"><b>${c[0]==='T'?'10':c[0]}</b><i>${SUIT[c[1]]}</i></span>`;

export type CasinoView='roulette'|'craps'|'baccarat'|'races';
const TITLES:Record<CasinoView,string>={roulette:'Roulette',craps:'Craps',baccarat:'Baccarat',races:'Horse racing'};

/** Patch 109: the same presentation-only room marquees throughout the casino floor.
 * No dynamic round data, financial claims, odds, or actions live in this component. */
const ROOM_LABELS:Record<CasinoView,{type:string;subtitle:string;seal:string}>={
 roulette:{type:'THE CLASSIC WHEEL',subtitle:'Wheel · racetrack · live table layout',seal:'✦'},
 craps:{type:'THE DICE TABLE',subtitle:'Shoot the dice · call the point',seal:'◆'},
 baccarat:{type:'THE BACCARAT SALON',subtitle:'Player · banker · shoe and roads',seal:'♠'},
 races:{type:'THE RACECOURSE',subtitle:'Race card · track · live results',seal:'★'},
};
function roomMarquee(game:CasinoView):string {
 const r=ROOM_LABELS[game];
 return `<header class="cz-mode-banner"><span class="cz-mode-seal" aria-hidden="true">${r.seal}</span><div class="cz-mode-copy"><small>THE CARD ROOM · ${r.type}</small><h2>${TITLES[game]}</h2><p>${r.subtitle}</p></div><span class="cz-mode-ornament" aria-hidden="true">♠</span></header>`;
}


function wallet(p:CasinoPlayer,game:CasinoView):string {
 const s=p.state,ui=p.ui,rec=s.games[game],pend=game==='craps'?0:p.pending(game);
 return `<div class="cz-wallet"><div class="cz-balance"><span>CASINO BALANCE</span><b data-testid="casino-balance">${money(s.balance-pend)}</b>${pend?`<small>${money(pend)} on the table</small>`:''}</div>
 <div class="cz-chips" role="group" aria-label="Chip value">${CHIPS.map(c=>`<button type="button" class="cz-chip-pick v${c}${ui.chip===c?' on':''}" data-casino-chip="${c}" aria-pressed="${ui.chip===c}">${short(c)}</button>`).join('')}</div>
 ${s.balance<100&&!pend?'<button type="button" class="button secondary" id="casino-reload">Reload $1,000</button>':''}
 ${rec?`<small class="cz-record">${TITLES[game]}: ${rec.rounds} round${rec.rounds===1?'':'s'} · bet ${money(rec.wagered)} · back ${money(rec.returned)}</small>`:''}</div>
 ${ui.error?`<p class="cz-error" role="alert">${esc(ui.error)}</p>`:''}${ui.notice?`<p class="cz-notice" role="status">${esc(ui.notice)}</p>`:''}`;
}

/** Patch 100: the other players at the table, with what they just said. */
function patronsMarkup(p:CasinoPlayer,game:CasinoView):string {
 const talk=p.ui.talk[game],can=p.canSay(game);
 // Patch 111: patrons address Hero, respond to each other, act, and answer quick chat.
 const line=(l:PatronLine)=>l.mood==='act'?`<p class="act" data-testid="patron-act"><i>${esc(l.name)} ${esc(l.text)}.</i></p>`
  :`<p class="${l.mood}"><b>${esc(l.name)}</b>${l.to?` <small class="to">to ${esc(l.to==='You'?'you':l.to)}</small>`:''} <span data-testid="${l.mood==='hero'?'hero-say':'patron-say'}">“${esc(l.text)}”</span></p>`;
 const chat=`<div class="cz-chat" role="group" data-cz-game="${game}" aria-label="Say something to the table">${CHAT[game].map(o=>`<button type="button" class="chip-say" data-cz-say="${o.key}" ${!can.open||(o.key==='nice'&&!can.nice)?'disabled':''}>${esc(o.text)}</button>`).join('')}</div>`;
 return `<div class="cz-patrons" aria-label="Other players at the table">${p.ui.patrons[game].map(x=>{const t=talk.find(l=>l.name===x.name&&l.mood!=='act');
  return `<div class="cz-patron${t?` says ${t.mood}`:''}"><span class="cz-patron-face" style="--c:${x.colour}" aria-hidden="true">${esc(x.name[0])}</span><small>${esc(x.name)}</small></div>`;}).join('')}${talk.length?`<div class="cz-patron-talk" aria-live="polite">${talk.map(line).join('')}</div>`:''}${chat}</div>`;
}

/** Patch 102: "Your rounds": your last 25 rounds at this table, how each came out, your net this visit, and a small
 * line of your running total over those rounds. */
const signed=(c:number)=>c>0?`+${money(c)}`:c<0?`−${money(-c)}`:money(0);
function roundsPanel(p:CasinoPlayer,game:CasinoView):string {
 const list=p.state.recent.filter(r=>r.game===game).slice(-25),net=p.ui.session[game];
 if(!list.length)return '';
 let acc=0;const run=[0,...list.map(r=>acc+=r.returned-r.wagered)];
 const W=260,H=60,lo=Math.min(...run),hi=Math.max(...run),span=hi-lo||1,x=(i:number)=>6+i*(W-12)/Math.max(1,run.length-1),y=(v:number)=>6+(H-12)*(hi-v)/span;
 const line=run.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
 const dots=run.slice(1).map((v,i)=>`<g class="cz-pt"><circle cx="${x(i+1).toFixed(1)}" cy="${y(v).toFixed(1)}" r="9" class="hit"/><circle cx="${x(i+1).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/><title>Round ${i+1}: ${signed(list[i].returned-list[i].wagered)} · running ${signed(v)}</title></g>`).join('');
 const rows=[...list].reverse().map(r=>{const d=r.returned-r.wagered;return `<li class="${d>0?'up':d<0?'down':'even'}"><span>${esc(String(r.bet??TITLES[game]))}</span><small>${esc(String(r.result??''))}</small><b>${signed(d)}</b></li>`;}).join('');
 return `<details class="cz-rounds" data-testid="rounds-${game}"><summary>Your rounds <span class="${net>0?'up':net<0?'down':''}">This visit ${signed(net)}</span><small>last ${list.length}</small></summary>
 <figure class="cz-trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running total over your last ${list.length} rounds here, ending at ${signed(acc)}"><line x1="6" x2="${W-6}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/><polyline points="${line}" class="run"/>${dots}</svg><figcaption>Running total over ${list.length===1?'this round':`these ${list.length} rounds`}: <b>${signed(acc)}</b> · hover a point for that round</figcaption></figure>
 <ol class="cz-round-list">${rows}</ol></details>`;
}

/* ---------- Roulette ---------- */
function wheelSvg(ui:CasinoUi):string {
 const r=ui.roulette,order=ORDER[r.wheel],n=order.length,step=360/n;
 const idx=r.result?order.indexOf(r.result.pocket):0,angle=r.result?-(idx*step)-1800*r.spins:0;
 const wedges=order.map((num,i)=>{const a0=(i-.5)*step*Math.PI/180,a1=(i+.5)*step*Math.PI/180,R=96,ri=62;
  const p=(a:number,rad:number)=>`${(100+rad*Math.sin(a)).toFixed(2)},${(100-rad*Math.cos(a)).toFixed(2)}`;
  const col=colourOf(num);
  return `<path d="M${p(a0,R)} A${R},${R} 0 0 1 ${p(a1,R)} L${p(a1,ri)} A${ri},${ri} 0 0 0 ${p(a0,ri)} Z" class="pk ${col}"/><text x="100" y="15" transform="rotate(${(i*step).toFixed(2)} 100 100)" class="pkn">${label(num)}</text>`;}).join('');
 const spinning=r.phase==='spinning';
 return `<div class="rl-wheel-wrap"><i class="rl-pointer" aria-hidden="true"></i><svg class="rl-wheel${spinning?' spinning':''}" viewBox="0 0 200 200" role="img" aria-label="${r.result&&!spinning?`Roulette wheel stopped on ${label(r.result.pocket)}`:'Roulette wheel'}"><circle cx="100" cy="100" r="99" class="rl-rim"/><g class="rl-rotor" style="transform:rotate(${angle}deg)">${wedges}<circle cx="100" cy="100" r="60" class="rl-cone"/><circle cx="100" cy="100" r="22" class="rl-hub"/><path d="M100 70 L104 100 L100 130 L96 100Z M70 100 L100 96 L130 100 L100 104Z" class="rl-turret"/></g><g class="rl-ball-orbit${spinning?' spinning':''}"><circle cx="100" cy="${r.result?13:7}" r="4.2" class="rl-ball"/></g></svg></div>`;
}
const rkey=(kind:RBetKind,ns:number[])=>`${kind}|${[...ns].sort((a,b)=>a-b).join('-')}`;
function rouletteLayout(ui:CasinoUi):string {
 const r=ui.roulette,am=r.wheel==='american',on=new Map(r.bets.map(b=>[rkey(b.kind,[...b.numbers]),b.amount]));
 const won=new Map(r.phase!=='spinning'&&r.result?r.result.wins.map(w=>[rkey(w.bet.kind,[...w.bet.numbers]),w]):[]);
 const spot=(kind:RBetKind,ns:number[],cls:string,text:string,aria:string)=>{const k=rkey(kind,ns),amt=on.get(k)??0,w=won.get(k);
  return `<button type="button" class="${cls}${amt?' has-chip':''}${w?' won':''}" data-rbet="${k}" aria-label="${esc(aria)}${amt?`, ${money(amt)} on it`:''}">${text}${chipMark(w?w.bet.amount:amt)}${w?`<span class="cz-float">+${short(w.bet.amount*PAYS[w.bet.kind])}</span>`:''}</button>`;};
 const hit=r.phase!=='spinning'&&r.result?r.result.pocket:-1;
 const cells:string[]=[];
 for(let n=1;n<=36;n++){const col=(n-1)%3,row=Math.floor((n-1)/3),c=colourOf(n);
  const hs:string[]=[];
  if(col<2)hs.push(spot('split',[n,n+1],'hs hs-r','',`Split ${n} and ${n+1}`));
  if(row<11)hs.push(spot('split',[n,n+3],'hs hs-b','',`Split ${n} and ${n+3}`));
  if(col<2&&row<11)hs.push(spot('corner',[n,n+1,n+3,n+4],'hs hs-br','',`Corner ${n}, ${n+1}, ${n+3}, ${n+4}`));
  if(col===0)hs.push(spot('street',[n,n+1,n+2],'hs hs-l','',`Street ${n} to ${n+2}`));
  if(col===0&&row<11)hs.push(spot('line',[n,n+1,n+2,n+3,n+4,n+5],'hs hs-bl','',`Six line ${n} to ${n+5}`));
  if(row===0){if(!am)hs.push(spot('split',[0,n],'hs hs-t','',`Split 0 and ${n}`));
   else{if(n===1)hs.push(spot('split',[0,1],'hs hs-t','','Split 0 and 1'));if(n===3)hs.push(spot('split',[3,DOUBLE_ZERO],'hs hs-t','','Split 00 and 3'));if(n===2){hs.push(spot('split',[0,2],'hs hs-tl','','Split 0 and 2'));hs.push(spot('split',[2,DOUBLE_ZERO],'hs hs-tr','','Split 00 and 2'));}}
   if(n===1)hs.push(am?spot('basket',[0,1,2,3,DOUBLE_ZERO],'hs hs-tc','','Top line 0, 00, 1, 2, 3'):spot('corner',[0,1,2,3],'hs hs-tc','','First four 0, 1, 2, 3'));}
  cells.push(`<div class="rl-cell ${c}${hit===n?' hit':''}" style="grid-column:${col+2};grid-row:${row+2}">${spot('straight',[n],'rl-num',String(n),`Straight ${n}`)}${hs.join('')}${hit===n?'<i class="rl-dolly" aria-hidden="true"></i>':''}</div>`);}
 const zeros=am?`<div class="rl-cell green zero half${hit===0?' hit':''}" style="grid-column:2/3;grid-row:1">${spot('straight',[0],'rl-num','0','Straight 0')}${spot('split',[0,DOUBLE_ZERO],'hs hs-r','','Split 0 and 00')}</div><div class="rl-cell green zero half2${hit===DOUBLE_ZERO?' hit':''}" style="grid-column:3/5;grid-row:1">${spot('straight',[DOUBLE_ZERO],'rl-num','00','Straight 00')}</div>`
  :`<div class="rl-cell green zero${hit===0?' hit':''}" style="grid-column:2/5;grid-row:1">${spot('straight',[0],'rl-num','0','Straight 0')}</div>`;
 const dozens=[0,1,2].map(w=>`<div class="rl-out dz" style="grid-column:1;grid-row:${2+4*w}/span 4">${spot('dozen',outside('dozen',w),'rl-ob',['1st 12','2nd 12','3rd 12'][w],`${['First','Second','Third'][w]} dozen`)}</div>`).join('');
 const cols=[0,1,2].map(w=>`<div class="rl-out cl" style="grid-column:${w+2};grid-row:14">${spot('column',outside('column',w),'rl-ob','2 to 1',`Column ${w+1}`)}</div>`).join('');
 const even=(['low','even','red','black','odd','high'] as const).map((k,i)=>`<div class="rl-out em" style="grid-column:5;grid-row:${2+2*i}/span 2">${spot(k,outside(k),`rl-ob ${k}`,{low:'1–18',even:'EVEN',red:'<i class="dia red"></i>',black:'<i class="dia black"></i>',odd:'ODD',high:'19–36'}[k],{low:'Low 1 to 18',even:'Even',red:'Red',black:'Black',odd:'Odd',high:'High 19 to 36'}[k])}</div>`).join('');
 return `<div class="rl-layout${am?' american':''}" data-testid="roulette-layout">${zeros}${cells.join('')}${dozens}${cols}${even}</div>`;
}
/** Patch 100: the French racetrack. Tap a number for it and two neighbours each side; tap a section for the
 * announced bet. */
function racetrack(p:CasinoPlayer):string {
 const o=ORDER.european,res=p.ui.roulette.result&&p.ui.roulette.phase!=='spinning'?p.ui.roulette.result.pocket:-1,unit=p.ui.chip,w=p.ui.roulette.width,n=2*w+1;
 const nums=o.map(x=>`<button type="button" class="rt-n ${colourOf(x)} sec-${sectionOf(x)}${res===x?' hit':''}" data-neighbours="${x}" aria-label="${x} and ${w} neighbour${w===1?'':'s'} each side, ${money(n*unit)}">${x}</button>`).join('');
 const sec=(a:Announced)=>`<button type="button" class="rt-sec sec-${a}" data-announced="${a}" aria-label="${ANNOUNCED[a].name}, ${ANNOUNCED[a].units} chips, ${money(ANNOUNCED[a].units*unit)}"><b>${ANNOUNCED[a].name}</b><small>${ANNOUNCED[a].units} chips · ${short(ANNOUNCED[a].units*unit)}</small></button>`;
 return `<div class="rt" data-testid="racetrack"><h3>Racetrack <small>tap a number for it and its neighbours (${n} chips) · tap a section for the announced bet</small></h3><div class="cz-seg rt-width" role="group" aria-label="Neighbours each side"><span>Neighbours</span>${[1,2,3,4].map(k=>`<button type="button" data-rt-width="${k}" class="${w===k?'on':''}" aria-pressed="${w===k}">${k}</button>`).join('')}</div><div class="rt-ring">${nums}</div><div class="rt-secs">${(['voisins','tiers','orphelins','zero'] as Announced[]).map(sec).join('')}</div><div class="rt-finals" role="group" aria-label="Finals"><span>Finals</span>${Array.from({length:10},(_,d)=>`<button type="button" data-finals="${d}" aria-label="Finals ${d}: every number ending in ${d}, ${d<7?(d===0?4:4):3} chips">${d}</button>`).join('')}</div></div>`;
}
/** Patch 100: hot and cold numbers and the splits from recent spins. Past spins do not change the next one. */
function statsMarkup(board:number[]):string {
 if(board.length<5)return '';
 const s=stats(board.slice(-200)),pct=(a:number,b:number)=>a+b?Math.round(100*a/(a+b)):0,live=s.n-s.zero;
 const chip=(n:number)=>`<span class="${colourOf(n)}">${label(n)}</span>`;
 return `<details class="rl-stats"><summary>Table statistics · last ${s.n} spins</summary><div class="rl-stats-grid"><div><b>Hot</b><div class="rl-history">${s.hot.map(chip).join('')}</div></div><div><b>Cold</b><div class="rl-history">${s.cold.map(chip).join('')}</div></div>
  <div class="rl-bars"><span>Red ${pct(s.red,s.black)}% · Black ${pct(s.black,s.red)}%</span><i style="--a:${pct(s.red,s.black)}%"></i><span>Odd ${pct(s.odd,s.even)}% · Even ${pct(s.even,s.odd)}%</span><i style="--a:${pct(s.odd,s.even)}%"></i><span>Dozens ${s.dozens.map(d=>live?Math.round(100*d/live):0).join('% · ')}% · Zero ${s.zero}</span></div></div><p class="cz-fine">Every spin is independent: hot numbers are no more likely to come up next.</p></details>`;
}
export function rouletteMarkup(p:CasinoPlayer):string {
 const ui=p.ui,r=ui.roulette,board=(p.state.boards?.roulette??[]) as number[],shownBoard=r.phase==='spinning'?board.slice(0,-1):board;
 const spinning=r.phase==='spinning',res=r.result&&!spinning?r.result:null;
 return `<section class="panel cz-game roulette" data-testid="roulette">${roomMarquee('roulette')}${wallet(p,'roulette')}${patronsMarkup(p,'roulette')}
 <div class="cz-felt rl-top"><div class="rl-wheel-col">${wheelSvg(ui)}<p class="cz-call" aria-live="polite">${spinning?'No more bets…':res?esc(p.rouletteCall()):'Place your bets.'}</p>${res?`<p class="cz-result ${res.returned>res.wagered?'up':res.returned?'even':'down'}">${res.returned?`You get back ${money(res.returned)} on ${money(res.wagered)}`:`No win · ${money(res.wagered)} lost`}</p>`:''}</div>
  <div class="rl-side"><div class="cz-seg" role="group" aria-label="Wheel"><button type="button" data-wheel="european" class="${r.wheel==='european'?'on':''}" ${spinning?'disabled':''}>Single zero</button><button type="button" data-wheel="american" class="${r.wheel==='american'?'on':''}" ${spinning?'disabled':''}>Double zero</button></div>
  ${r.wheel==='european'?`<label class="auto-deal-toggle"><input type="checkbox" id="rl-partage" ${r.partage?'checked':''} ${spinning?'disabled':''}>La Partage: even-money bets lose only half on zero (1.35% edge)</label>`:''}
  <div class="rl-history" aria-label="Last numbers">${shownBoard.slice(-12).reverse().map((n,i)=>`<span class="${colourOf(n)}${i===0?' latest':''}">${label(n)}</span>`).join('')||'<small>No spins yet</small>'}</div>
  <p class="cz-fine">${r.wheel==='european'?`Single zero: 2.70% house edge on every bet${r.partage?' (1.35% on even money with La Partage)':''}.`:'Double zero: 5.26% house edge (7.89% on the top line).'} Straight 35:1 · split 17:1 · street 11:1 · corner 8:1 · six line 5:1 · dozens and columns 2:1 · even money 1:1.</p></div></div>
 ${rouletteLayout(ui)}
 <div class="rl-specials" role="group" aria-label="Named bets"><b>Named bets</b>${(['snake','redSplits','blackSplits'] as Special[]).map(k=>`<button type="button" class="button secondary" data-special="${k}" ${spinning?'disabled':''} title="${esc(SPECIALS[k].blurb)}" aria-label="${esc(SPECIALS[k].name)}: ${esc(SPECIALS[k].blurb)}, ${money(SPECIALS[k].pieces.length*ui.chip)}">${esc(SPECIALS[k].name)} <small>${SPECIALS[k].pieces.length} chips · ${short(SPECIALS[k].pieces.length*ui.chip)}</small></button>`).join('')}</div>
 ${r.wheel==='european'?racetrack(p):''}
 ${statsMarkup(shownBoard)}
 <div class="rl-tools"><div class="rl-favs"><b>Favourites</b>${(p.state.favs??[]).map((f,i)=>`<span class="rl-fav"><button type="button" class="button secondary" data-fav="${i}" ${spinning?'disabled':''}>${esc(f.name)}</button><button type="button" class="rc-x" data-fav-del="${i}" aria-label="Delete saved layout">×</button></span>`).join('')}<button type="button" class="button secondary" id="rl-save" ${spinning||(!r.bets.length&&!r.last.length)?'disabled':''}>Save layout</button></div>
  <div class="rl-auto">${r.auto?`<span>Auto-spin: ${r.auto.left} left${r.auto.stopOnWin?' · stops on a win':''}</span><button type="button" class="button secondary" id="casino-stop-auto">Stop</button>`:`<b>Auto-spin</b>${[5,10,25].map(n=>`<button type="button" class="button secondary" data-auto-spin="${n}" ${spinning||(!r.bets.length&&!r.last.length)?'disabled':''}>${n}</button>`).join('')}<label class="auto-deal-toggle"><input type="checkbox" id="rl-stop-win" checked>Stop on a win</label>`}</div></div>
 <div class="cz-actions"><button type="button" class="button secondary" id="roulette-undo" ${spinning||!r.bets.length?'disabled':''}>Undo</button><button type="button" class="button secondary" id="roulette-clear" ${spinning||!r.bets.length?'disabled':''}>Clear</button><button type="button" class="button secondary" id="roulette-rebet" ${spinning||!r.last.length?'disabled':''}>Rebet</button><button type="button" class="button secondary" id="roulette-double" ${spinning||(!r.bets.length&&!r.last.length)?'disabled':''}>Double</button><button type="button" class="button cz-go" id="roulette-spin" ${spinning?'disabled':''}>${!r.bets.length&&r.phase==='done'&&r.last.length?`Spin again · ${money(r.last.reduce((a,b)=>a+b.amount,0))}`:`Spin${r.bets.length?` · ${money(p.pending('roulette'))}`:''}`}</button></div>
 ${roundsPanel(p,'roulette')}
 </section>`;
}

/* ---------- Baccarat ---------- */
/** Patch 101: the three derived roads and what each would show after a Banker or a Player win. Red means the road
 * is repeating its pattern, blue that it is choppy. They describe the past; they do not change the odds. */
function derivedMarkup(results:('P'|'B'|'T')[]):string {
 const names=['Big Eye Boy','Small Road','Cockroach Pig'],cls=['eye','small','roach'];
 const roads=([1,2,3] as const).map((k,i)=>{const cells=bigRoad(derivedRoad(results,k).map(x=>x==='R'?'B':'P')),maxCol=cells.length?Math.max(...cells.map(c=>c.col)):0,from=Math.max(0,maxCol-29);
  return `<div class="dr"><small>${names[i]}</small><div class="dr-grid ${cls[i]}">${cells.filter(c=>c.col>=from).map(c=>`<i class="${c.v==='B'?'r':'b'}" style="grid-column:${c.col-from+1};grid-row:${c.row+1}"></i>`).join('')||'<em>—</em>'}</div></div>`;}).join('');
 const preview=(n:'P'|'B')=>`<span class="dr-ask ${n==='B'?'banker':'player'}"><b>${n==='B'?'Banker':'Player'} ask</b>${ask(results,n).map((v,i)=>`<i class="${cls[i]} ${v==='R'?'r':v==='B'?'b':'none'}" title="${names[i]}: ${v==='R'?'red':v==='B'?'blue':'nothing yet'}"></i>`).join('')}</span>`;
 return `<div class="dr-roads" data-testid="derived-roads">${roads}</div><div class="dr-asks">${preview('B')}${preview('P')}</div>`;
}
/** Patch 100: the Big Road scoreboard (the last 24 columns). */
function bigRoadMarkup(results:('P'|'B'|'T')[]):string {
 const cells=bigRoad(results),maxCol=cells.length?Math.max(...cells.map(c=>c.col)):0,from=Math.max(0,maxCol-23);
 return `<div class="big-road" data-testid="big-road">${cells.filter(c=>c.col>=from).map(c=>`<span class="br ${c.v==='P'?'p':'b'}" style="grid-column:${c.col-from+1};grid-row:${c.row+1}">${c.ties?`<i>${c.ties>1?c.ties:''}</i>`:''}</span>`).join('')||'<small>No hands yet</small>'}</div>`;
}
export function baccaratMarkup(p:CasinoPlayer):string {
 const sh=p.shoe(),left=cardsLeft(sh),b=p.ui.baccarat,coup=b.coup,dealing=b.phase==='dealing',done=b.phase==='done';
 const shownP:{c:string;down:boolean}[]=[],shownB:{c:string;down:boolean}[]=[];
 if(coup){let pi=0,bi=0;coup.order.slice(0,b.shown).forEach((w,i)=>{const down=b.waiting&&i===b.faceDown;if(w==='P')shownP.push({c:coup.player[pi++],down});else shownB.push({c:coup.banker[bi++],down});});}
 const spot=(s:BaccaratSpot,title:string,pays:string)=>{const a=b.bets[s]??0,won=done&&(b.bySpot[s]??0)>(b.last[s]??0),push=done&&b.bySpot[s]!==undefined&&b.bySpot[s]===(b.last[s]??0);
  return `<button type="button" class="bc-spot ${s}${a?' has-chip':''}${won?' won':''}${push?' push':''}" data-bspot="${s}" ${dealing?'disabled':''} aria-label="${title}, pays ${pays}${a?`, ${money(a)} on it`:''}"><b>${title}</b><small>${pays}</small>${chipMark(done?(b.last[s]??0):a)}</button>`;};
 const face=(x:{c:string;down:boolean},i:number)=>x.down?`<button type="button" class="cz-card down" data-bac-peel style="--i:${i}" aria-label="Peel the card"><span>PEEL</span></button>`:cardFace(x.c,i);
 const hand=(name:string,cards:{c:string;down:boolean}[],who:'player'|'banker')=>`<div class="bc-hand ${who}${done&&coup?.winner===who?' winner':''}"><span class="bc-hand-name">${name}</span><div class="bc-cards">${cards.map(face).join('')||'<span class="cz-card-slot"></span><span class="cz-card-slot"></span>'}</div><b class="bc-total">${cards.length&&!cards.some(x=>x.down)?bacTotal(cards.map(x=>x.c)):cards.length?'?':''}</b></div>`;
 const beads=(p.state.boards?.baccarat??[]) as string[],shownBeads=dealing?beads.slice(0,-1):beads;
 const cols=Math.max(12,Math.ceil(shownBeads.length/6));
 const plate=Array.from({length:cols*6},(_,i)=>{const col=Math.floor(i/6),row=i%6,v=shownBeads[col*6+row];return `<span class="bead ${v==='P'?'p':v==='B'?'b':v==='T'?'t':''}">${v??''}</span>`;}).slice(-72).join('');
 const res=done?(b.returned>b.wagered?`You get back ${money(b.returned)} on ${money(b.wagered)}`:b.returned?`Back ${money(b.returned)} on ${money(b.wagered)}`:`No win · ${money(b.wagered)} lost`):'';
 return `<section class="panel cz-game baccarat" data-testid="baccarat">${roomMarquee('baccarat')}${wallet(p,'baccarat')}${patronsMarkup(p,'baccarat')}
 <div class="cz-felt bc-felt"><p class="bc-arc">${b.ez?'EZ BACCARAT · NO COMMISSION · BANKER 3-CARD 7 PUSHES':'BANKER PAYS 19 TO 20 · TIE PAYS 8 TO 1'}</p>
  <div class="bc-hands">${hand('PLAYER',shownP,'player')}${hand('BANKER',shownB,'banker')}</div>
  <p class="cz-call" aria-live="polite">${b.waiting?'Squeeze it… tap the card to peel.':dealing?'Cards…':done?esc(p.baccaratCall())+(b.ez&&coup&&coup.winner==='banker'&&coup.banker.length===3&&coup.bankerTotal===7?' Dragon 7!':b.ez&&coup&&coup.winner==='player'&&coup.player.length===3&&coup.playerTotal===8?' Panda 8!':''):'Place your bets.'}</p>${res?`<p class="cz-result ${b.returned>b.wagered?'up':b.returned?'even':'down'}">${res}</p>`:''}
  <div class="bc-spots">${spot('playerPair','P pair','11:1')}${spot('tie','TIE','8:1')}${spot('bankerPair','B pair','11:1')}${spot('player','PLAYER','1:1')}${spot('banker','BANKER',b.ez?'1:1 · 3-card 7 pushes':'0.95:1')}${b.ez?spot('dragon7','DRAGON 7','40:1')+spot('panda8','PANDA 8','25:1'):''}${spot('lucky6','LUCKY 6','12:1 · 3 cards 20:1')}${spot('dragonP','DRAGON P','win by 4–9 · up to 30:1')}${spot('dragonB','DRAGON B','win by 4–9 · up to 30:1')}</div></div>
 <div class="bc-shoe" data-testid="bac-shoe"><span class="bc-shoe-box" style="--fill:${(100*left/sh.cards.length).toFixed(1)}%" aria-hidden="true"></span><span>Shoe ${sh.number} · <b>${left}</b> cards left${sh.cutOut&&!sh.last?' · <em>cut card is out: last hand</em>':sh.last?' · <em>shuffling before the next hand</em>':''}</span>${b.shuffled?`<span class="bc-burn">New shoe. Burn card ${cardFace(sh.burned[0],0)} → ${sh.burned.length-1} burned. Fresh roads.</span>`:''}<button type="button" class="button secondary" id="bac-shuffle" ${dealing?'disabled':''}>Shuffle now</button></div>
 <div class="bc-options"><label class="auto-deal-toggle"><input type="checkbox" id="bac-ez" ${b.ez?'checked':''} ${dealing?'disabled':''}>EZ Baccarat (no commission)</label><label class="auto-deal-toggle"><input type="checkbox" id="bac-squeeze" ${b.squeeze?'checked':''}>Squeeze my cards</label>${b.auto>0?`<span>Auto-deal: ${b.auto} left</span><button type="button" class="button secondary" id="casino-stop-auto">Stop</button>`:`<span class="bc-auto"><b>Auto-deal</b>${[5,10,25].map(n=>`<button type="button" class="button secondary" data-auto-deal="${n}" ${dealing?'disabled':''}>${n}</button>`).join('')}</span>`}</div>
 <div class="cz-actions"><button type="button" class="button secondary" id="bac-clear" ${dealing?'disabled':''}>Clear</button><button type="button" class="button secondary" id="bac-rebet" ${dealing||!Object.keys(b.last).length?'disabled':''}>Rebet</button><button type="button" class="button cz-go" id="bac-deal" ${dealing?'disabled':''}>${done&&Object.keys(b.last).length?'Deal again':'Deal'}${p.pending('baccarat')?` · ${money(p.pending('baccarat'))}`:done&&Object.keys(b.last).length?` · ${money(Object.values(b.last).reduce((x:number,y)=>x+(y??0),0))}`:''}</button></div>
 <div class="bc-road"><h3>Big road</h3>${bigRoadMarkup(shownBeads as ('P'|'B'|'T')[])}${derivedMarkup(shownBeads as ('P'|'B'|'T')[])}<h3>Bead plate <small>P ${beads.filter(x=>x==='P').length} · B ${beads.filter(x=>x==='B').length} · T ${beads.filter(x=>x==='T').length}</small></h3><div class="bead-plate" style="--cols:${Math.min(cols,12)}">${plate}</div>
 <p class="cz-fine">Eight decks in a shoe that lasts from hand to hand: the first card says how many to burn, and the cut card sits 14 cards from the end (one more hand after it comes out, then a new shoe and fresh roads). Player draws on 0–5; Banker draws by the standard table. ${b.ez?'EZ: Banker 1.02% · Player 1.24% · Dragon 7 7.6% · Panda 8 10.2% house edge.':'Banker 1.06% · Player 1.24% · Tie 14.4% house edge.'} Lucky 6 (Banker wins with 6) 16.68%. Dragon Bonus: your side wins with a natural 1:1 (a natural tie pushes), or wins by 9 30:1, 8 10:1, 7 6:1, 6 4:1, 5 2:1, 4 1:1; Player 2.65%, Banker 9.37%. With squeeze on, the cards for the side you backed most come face down: tap to peel.</p></div>
 ${roundsPanel(p,'baccarat')}
 </section>`;
}

/* ---------- Craps ---------- */
const PIPS:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const die=(v:number,rolling:boolean,i:number)=>`<span class="cz-die${rolling?' rolling':''}" style="--d:${i}" aria-hidden="true">${Array.from({length:9},(_,k)=>`<i class="${PIPS[v].includes(k)?'pip':''}"></i>`).join('')}</span>`;
export function crapsMarkup(p:CasinoPlayer):string {
 const ui=p.ui,c=ui.craps,t=p.craps,rolling=c.phase==='rolling',last=c.last,point=rolling&&last?last.pointBefore:t.point;
 const amt=(s:Spot|string):number=>{for(const [pre,f] of [['dontComeOdds','dontComeOdds'],['comeOdds','comeOdds'],['place','place'],['hard','hard'],['buy','buy'],['lay','lay']] as const)if(s.startsWith(pre)&&/^\d+$/.test(s.slice(pre.length)))return (t[f] as Record<number,number>)[Number(s.slice(pre.length))]??0;return (t as unknown as Record<string,number>)[s]??0;};
 const spot=(s:Spot,inner:string,cls:string,aria:string)=>{const a=amt(s);return `<button type="button" class="cr-spot ${cls}${a?' has-chip':''}" data-cspot="${s}" ${rolling?'disabled':''} aria-label="${esc(aria)}${a?`, ${money(a)} on it`:''}">${inner}${chipMark(a)}</button>`;};
 const nums=POINTS.map(n=>{const come=t.comeOn[n]??0,dc=t.dontComeOn[n]??0;return `<div class="cr-num${point===n?' is-point':''}"><span class="cr-big">${n===6?'SIX':n===9?'NINE':n}</span>${point===n?'<i class="cr-puck on">ON</i>':''}${spot(`place${n}` as Spot,`<small>Place ${({4:'9:5',10:'9:5',5:'7:5',9:'7:5',6:'7:6',8:'7:6'} as const)[n]}</small>`,'cr-place',`Place ${n}`)}${(BUYS as readonly number[]).includes(n)?spot(`buy${n}` as Spot,'<small>Buy · 5%</small>','cr-buy',`Buy ${n}, true odds less 5% commission on a win`):''}${spot(`lay${n}` as Spot,`<small>Lay ${({4:'1:2',10:'1:2',5:'2:3',9:'2:3',6:'5:6',8:'5:6'} as const)[n]}</small>`,'cr-lay',`Lay ${n}: wins if a 7 comes first, true odds less 5% of the win`)}${come?`<span class="cr-come-chip" title="Come bet on ${n}">C ${short(come)}</span>${spot(`comeOdds${n}` as Spot,'<small>+ odds</small>','cr-codds',`Odds on your come bet on ${n}`)}`:''}${dc?`<span class="cr-come-chip dc" title="Don’t come bet on ${n}">DC ${short(dc)}</span>${spot(`dontComeOdds${n}` as Spot,'<small>+ lay</small>','cr-codds',`Lay odds on your don’t come bet on ${n}`)}`:''}</div>`;}).join('');
 const hist=((p.state.boards?.craps??[]) as [number,number][]),shownHist=rolling?hist.slice(0,-1):hist;
 const dice=last?last.dice:[3,4] as [number,number];
 const net=c.lastReturned;
 const sh=c.shooter,locked=oddsUp(t);
 return `<section class="panel cz-game craps" data-testid="craps">${roomMarquee('craps')}${wallet(p,'craps')}${patronsMarkup(p,'craps')}
 <div class="cr-oddsx"><div class="cz-seg" role="group" aria-label="Table odds"><button type="button" data-odds-x="345" class="${t.oddsX==='345'?'on':''}" aria-pressed="${t.oddsX==='345'}" ${rolling||(locked&&t.oddsX!=='345')?'disabled':''}>3-4-5x odds</button><button type="button" data-odds-x="10" class="${t.oddsX==='10'?'on':''}" aria-pressed="${t.oddsX==='10'}" ${rolling||(locked&&t.oddsX!=='10')?'disabled':''}>10x odds</button></div><small>${locked?'Odds are up: take them down to change the limit.':t.oddsX==='10'?'Take 10x on every point; lay 20x on 4/10, 15x on 5/9, 12x on 6/8.':'Take 3x on 4/10, 4x on 5/9, 5x on 6/8; lay up to 6x.'}</small><label class="auto-deal-toggle"><input type="checkbox" id="craps-working" ${t.working?'checked':''} ${rolling?'disabled':''}>Working on the come-out: place, buy and hardway bets and come odds</label></div>
 <div class="cz-felt cr-felt">
  <div class="cr-head"><span class="cr-puck${point?' on':''}" aria-label="${point?`Point is ${point}`:'Point is off'}">${point?'ON':'OFF'}</span><div class="cr-dice">${die(dice[0],rolling,0)}${die(dice[1],rolling,1)}</div><p class="cz-call" aria-live="polite">${rolling?'Dice are out…':last?esc(last.call):'Coming out! Bet the Pass line.'}${!rolling&&last&&last.pointBefore&&last.sum===7?` The dice go to ${esc(p.shooterName())}.`:''}</p><span class="cr-shooter" data-testid="shooter">Shooter: <b>${esc(p.shooterName())}</b> · ${sh.rolls} roll${sh.rolls===1?'':'s'} · ${sh.points} point${sh.points===1?'':'s'} made${sh.best?` · best hand ${sh.best} rolls`:''}</span></div>
  ${!rolling&&last&&last.settled.length?`<p class="cz-result ${net>0?'up':'down'}">${last.settled.map(s=>`${esc(SPOT_LABEL[s.spot]??s.spot)} ${s.back>s.stake?`+${money(s.back-s.stake)}`:s.back===s.stake?'push':`−${money(s.stake)}`}`).join(' · ')}</p>`:''}
  <div class="cr-numbers">${nums}</div>
  <div class="cr-row half">${spot('come','<b>COME</b>','cr-come','Come')}${spot('dontCome','<b>DON’T COME</b><small>bar 12</small>','cr-dc','Don’t come')}</div>
  <div class="cr-row cr-bigs">${spot('big6','<b>BIG 6</b><small>1:1</small>','cr-big6','Big 6, even money')}${spot('big8','<b>BIG 8</b><small>1:1</small>','cr-big8','Big 8, even money')}</div>
  ${spot('field','<b>FIELD</b><small>3 · 4 · 9 · 10 · 11 &nbsp;·&nbsp; <em>2 pays double</em> · <em>12 pays triple</em></small>','cr-field','Field')}
  <div class="cr-row">${spot('dontPass','<b>DON’T PASS BAR</b><small>bar 12</small>','cr-dp','Don’t pass')}${spot('dontOdds',`<small>LAY ODDS${t.point&&t.dontPass?` · up to ${short(maxLay(t))}`:''}</small>`,'cr-odds','Lay odds')}</div>
  <div class="cr-row">${spot('pass','<b>PASS LINE</b>','cr-pass','Pass line')}${spot('passOdds',`<small>ODDS${t.point&&t.pass?` · up to ${short(maxOdds(t))}`:''}</small>`,'cr-odds','Pass odds')}</div>
  <div class="cr-props"><span class="cr-props-title">PROPOSITIONS</span>
   ${HARD.map(h=>spot(`hard${h}` as Spot,`<b>Hard ${h}</b><small>${h===4||h===10?'7:1':'9:1'}</small>`,'cr-prop',`Hard ${h}`)).join('')}
   ${spot('any7','<b>Any 7</b><small>4:1</small>','cr-prop seven','Any seven')}${spot('anyCraps','<b>Any craps</b><small>7:1</small>','cr-prop','Any craps')}${spot('yo','<b>Yo 11</b><small>15:1</small>','cr-prop','Yo eleven')}${spot('aceDeuce','<b>Ace-deuce</b><small>15:1</small>','cr-prop','Ace-deuce')}${spot('aces','<b>Aces</b><small>30:1</small>','cr-prop','Aces')}${spot('twelve','<b>Twelve</b><small>30:1</small>','cr-prop','Twelve')}<button type="button" class="cr-spot cr-prop cr-horn" id="craps-horn" ${rolling?'disabled':''} aria-label="Horn bet: one chip each on 2, 3, 11 and 12"><b>Horn</b><small>4 chips</small></button><button type="button" class="cr-spot cr-prop cr-horn" id="craps-ce" ${rolling?'disabled':''} aria-label="C and E: one chip each on Any craps and Yo eleven"><b>C &amp; E</b><small>2 chips</small></button><button type="button" class="cr-spot cr-prop cr-horn" id="craps-world" ${rolling?'disabled':''} aria-label="World bet: the Horn plus Any 7, five chips"><b>World</b><small>5 chips</small></button></div>
  <details class="cr-hops"><summary>Hop bets <small>one roll, exact dice · easy 15:1 · hard 30:1</small></summary><div class="cr-hop-grid">${[1,2,3,4,5,6].flatMap(a=>[1,2,3,4,5,6].filter(b=>b>=a).map(b=>spot(`hop${a}${b}` as Spot,`<b>${a}-${b}</b>`,'cr-prop cr-hop'+(a===b?' hard':''),`Hop ${a} and ${b}, pays ${a===b?'30':'15'} to 1`))).join('')}</div></details>
  <div class="cr-fire">${spot('fire',`<b>🔥 FIRE BET</b><small>4 points 24:1 · 5 points 249:1 · 6 points 999:1</small>`,'cr-fire-spot',`Fire Bet`)}<span class="cr-fire-points" aria-label="Points made by this shooter">${POINTS.map(n=>`<i class="${t.firePoints.includes(n)?'lit':''}">${n}</i>`).join('')}</span>${t.newShooter&&!t.point?'':'<small class="cr-fire-note">Fire Bet opens for the next shooter.</small>'}</div>
 </div>
 <div class="cz-actions">${Object.keys(t.place).length||Object.keys(t.buy).length?`<button type="button" class="button secondary" id="craps-press" ${rolling?'disabled':''}>Press</button>`:''}${c.lastLayout&&!t.point&&!rolling?`<button type="button" class="button secondary" id="craps-same">Same bets · ${money(Object.values(c.lastLayout).reduce((a:number,b)=>a+(b??0),0))}</button>`:''}<button type="button" class="button secondary${c.takeDown?' on':''}" id="craps-takedown" aria-pressed="${c.takeDown}" ${rolling?'disabled':''}>${c.takeDown?'Tap a bet to take it down':'Take down'}</button><button type="button" class="button cz-go" id="craps-roll" ${rolling?'disabled':''}>${p.shooterName()==='You'?'Roll the dice':`${esc(p.shooterName())} rolls`}</button></div>
 <div class="cr-history" aria-label="Recent rolls">${shownHist.slice(-14).reverse().map(([a,b2],i)=>`<span class="${a+b2===7?'seven':''}${i===0?' latest':''}">${a+b2}</span>`).join('')||'<small>No rolls yet</small>'}</div>
 ${diceChart((p.state.boards?.craps??[]) as [number,number][],rolling)}
 <p class="cz-fine">The dice pass to the next player after each seven-out. Odds (${t.oddsX==='10'?'10x':'3-4-5x'} at this table), on the line or behind Come and Don’t Come bets, pay true odds with no house edge; come odds are off on the come-out. Lay bets pay true odds against the number less 5% of the win (4/10 1.67%, 5/9 2%, 6/8 2.27%) and work on every roll. Big 6 and Big 8 pay even money (9.09%). C&amp;E is a chip each on Any craps and Yo; World is the Horn plus Any 7. Buy 4, 5, 9 and 10 pay true odds less 5% of the bet on a win (4/10 1.67%, 5/9 2%). Place, buy and hardway bets and come odds are off on the come-out unless you turn on “Working on the come-out”. Pass 1.41% · Don’t pass 1.36% · Field 2.78% · Place 6/8 1.52% · Any 7 16.7% house edge.</p>
 ${roundsPanel(p,'craps')}
 </section>`;
}

/** Patch 102: how often each total has come up at this table, against how often it should (ways out of 36). */
const WAYS=[1,2,3,4,5,6,5,4,3,2,1];
function diceChart(hist:[number,number][],rolling:boolean):string {
 const h=rolling?hist.slice(0,-1):hist,n=h.length;if(n<10)return '';
 const count=WAYS.map((_,i)=>h.filter(([a,b])=>a+b===i+2).length),top=Math.max(...count.map(c=>c/n),6/36)*1.08;
 const cols=WAYS.map((w,i)=>{const got=count[i]/n,want=w/36;return `<div class="dc-col" title="${i+2}: ${count[i]} of ${n} rolls (${(100*got).toFixed(1)}%) · expected ${(100*want).toFixed(1)}%"><div class="dc-plot"><i class="dc-bar" style="--h:${(100*got/top).toFixed(1)}%"></i><i class="dc-want" style="--h:${(100*want/top).toFixed(1)}%"></i></div><small>${i+2}</small></div>`;}).join('');
 return `<details class="cr-chart" data-testid="dice-chart"><summary>Dice chart · last ${n} rolls <small>bars: this table · gold line: expected</small></summary><div class="dc-grid" role="img" aria-label="${WAYS.map((w,i)=>`${i+2}: ${(100*count[i]/n).toFixed(0)}% against ${(100*w/36).toFixed(0)}%`).join(', ')}">${cols}</div><p class="cz-fine">Every roll is independent: a total that has been “cold” is no more likely to come up next.</p></details>`;
}

/* ---------- Races ---------- */
const horse=(fill:string,trim:string)=>`<svg viewBox="0 0 64 40" class="rc-horse-svg" aria-hidden="true"><path stroke="#f3e3c3" stroke-width="1.2" d="M6 26c4-1 7-6 10-9 4-4 12-5 18-4 4 1 8 0 11-3 2-2 5-4 8-4l3 2-2 3c2 1 4 3 3 5l-4 1-3-2c-2 3-2 6-1 9l-2 9h-3l1-8-6-1c-3 2-9 2-13 1l-4 8h-3l2-9c-3 2-7 3-10 3z" fill="#2a170b"/><path d="M27 8l6 1 2 7-5 3-5-2z" fill="${fill}"/><path d="M27 12l8 1" stroke="${trim}" stroke-width="2"/><circle cx="31" cy="5" r="3" fill="${trim}"/></svg>`;
export function racesMarkup(p:CasinoPlayer):string {
 const h=p.ui.races,c=h.card,running=h.phase==='running',done=h.phase==='done',frame=h.frame;
 // A scratched horse has no path and must never enter the running-order display.
 const pos=(no:number)=>h.paths?.[no]?.[Math.min(frame,RACE_FRAMES)]??-1;
 const lanes=c.runners.map(r=>r.scratched?`<div class="rc-lane scr"><span class="rc-lane-no" style="--silk:${r.silks[0]};--trim:${r.silks[1]}">${r.no}</span><small>scratched</small></div>`:`<div class="rc-lane"><span class="rc-lane-no" style="--silk:${r.silks[0]};--trim:${r.silks[1]}">${r.no}</span><span class="rc-runner" data-race-horse="${r.no}" style="--x:${pos(r.no)}">${horse(r.silks[0],r.silks[1])}<b class="rc-cloth" style="--silk:${r.silks[0]};--trim:${r.silks[1]}">${r.no}</b></span></div>`).join('');
 const kinds:[RaceKind|'dd'|'atb',string][]=[['win','Win'],['place','Place'],['show','Show'],['atb','Across the board'],['exacta','Exacta'],['quinella','Quinella'],['trifecta','Trifecta'],['superfecta','Superfecta'],['dd','Daily Double']];
 const dd=h.kind==='dd',atb=h.kind==='atb',leg2=dd&&h.picking.length===1,card=leg2?h.next:c;
 const multi=!dd&&!atb&&PICKS[h.kind as RaceKind]>1,ORD=['1st','2nd','3rd','4th'],boxing=h.box&&BOXABLE.includes(h.kind as RaceKind);
 const rows=card.runners.map(r=>{
  const wo=odds(card,'win',[r.no]),o=dd||multi||r.scratched?0:atb?(['win','place','show'] as const).every(k=>odds(c,k,[r.no]))?1:0:odds(c,h.kind as RaceKind,[r.no]);
  const at=leg2?-1:h.picking.indexOf(r.no),placed=!leg2&&h.order?h.order.indexOf(r.no)+1:0;
  const label=r.scratched?'SCR':dd?(leg2?'Leg 2':at>=0?'Leg 1 ✓':'Leg 1'):multi?(at>=0?`${h.kind==='quinella'||boxing?'✓':ORD[at]+' ✓'}`:h.kind==='quinella'||boxing?'Pick':ORD[h.picking.length]):atb?(o?'W·P·S':'off'):o?oddsLabel(o):'off';
  const note=leg2?'':paddockNote(c,r.no);
  const pp=r.scratched?'<small class="rc-scr">Scratched: does not run</small>':`${note?`<small class="rc-paddock" data-testid="paddock-note">Paddock: ${esc(note)}</small>`:''}<details class="rc-pp"><summary>${esc(r.jockey)} · ${r.age}yo · ${r.weight} lb · form ${r.form} · best speed <b>${r.best}</b></summary><table><tr><th>Ran</th><th>Track</th><th>Dist</th><th>Fin</th><th>Speed</th></tr>${r.past.slice(0,3).map(x=>`<tr><td>${x.daysAgo}d ago</td><td>${esc(x.track)}</td><td>${esc(x.distance)}</td><td>${x.finish}/${x.field}</td><td>${x.speed}</td></tr>`).join('')}</table></details>`;
  return `<tr class="${r.scratched?'scr':''}${at>=0?' sel':''}${done&&placed&&placed<=3?` placed p${placed}`:''}"><td><span class="rc-cloth" style="--silk:${r.silks[0]};--trim:${r.silks[1]}">${r.no}</span></td><td><b>${esc(r.name)}</b>${pp}</td><td class="rc-ml">${r.scratched?'—':wo?oddsLabel(wo):'—'}</td>
   <td><button type="button" class="button secondary rc-bet${at>=0?' on':''}" data-race-pick="${r.no}" ${running||r.scratched||(!multi&&!dd&&!o)?'disabled':''} aria-label="${dd?`Daily Double ${leg2?'second':'first'} leg: ${esc(r.name)}`:multi?`${h.kind}: ${esc(r.name)}${at>=0?', picked':''}`:atb?`Across the board on ${esc(r.name)}: win, place and show, three chips`:`${h.kind} on ${esc(r.name)}`}">${label}</button></td></tr>`;}).join('');
 const slip=[...h.bets.map((b,i)=>{const name=(no:number)=>c.runners[no-1].name;const ret=b.amount+Math.floor(b.amount*b.odds);
  const won=done&&h.order?settleBet(b,b.odds,h.order)>0:null;
  return `<li class="${won===true?'won':won===false?'lost':''}"><span><b>${b.kind.toUpperCase()}</b> ${b.picks.map(name).map(esc).join(b.kind==='quinella'?' & ':' → ')} <small>at ${b.odds.toFixed(1)} to 1</small></span><span>${money(b.amount)} → ${money(ret)}</span>${h.phase==='betting'?`<button type="button" class="rc-x" data-race-remove="${i}" aria-label="Remove bet">×</button>`:''}</li>`;}),
  ...h.dd.map((d,i)=>`<li><span><b>DAILY DOUBLE</b> ${esc(c.runners[d.picks[0]-1].name)} + ${esc(h.next.runners[d.picks[1]-1].name)} <small>(race ${c.number + 1}) at ${d.odds.toFixed(1)} to 1</small></span><span>${money(d.amount)} → ${money(d.amount+Math.floor(d.amount*d.odds))}</span>${h.phase==='betting'?`<button type="button" class="rc-x" data-race-remove="${h.bets.length+i}" aria-label="Remove bet">×</button>`:''}</li>`)].join('');
 const riding=p.day.dd.filter(d=>d.race===c.number-1),alive=p.day.dd.filter(d=>d.race===c.number);
 const ridingMarkup=riding.length&&!done?`<p class="rc-dd-live">Daily Double alive: ${riding.map(d=>`#${d.picks[1]} ${esc(c.runners[d.picks[1]-1].name)} wins → ${money(d.amount+Math.floor(d.amount*d.odds))}`).join(' · ')}</p>`:alive.length&&done?`<p class="rc-dd-live">Daily Double: first leg won! Now riding on ${alive.map(d=>`#${d.picks[1]} ${esc(h.next.runners[d.picks[1]-1].name)}`).join(', ')} in race ${c.number+1}.</p>`:'';
 const board=p.day.results.length?`<details class="rc-board"><summary>Today’s results (${p.day.results.length})</summary><table class="rc-table"><tr><th>Race</th><th>Track</th><th>Winner</th><th>Odds</th></tr>${[...p.day.results].reverse().map(r=>`<tr><td>${r.number}</td><td>${esc(r.track)}</td><td>#${r.no} ${esc(r.name)}</td><td>${r.odds?oddsLabel(r.odds):'—'}</td></tr>`).join('')}</table></details>`:'';
 return `<section class="panel cz-game races" data-testid="races">${roomMarquee('races')}${wallet(p,'races')}${patronsMarkup(p,'races')}
 <div class="rc-card-head"><b>Race ${c.number} · ${esc(c.track)}</b><span>${esc(c.distance)} · ${esc(c.going)} · purse ${esc(c.purse)}</span><label class="auto-deal-toggle"><input type="checkbox" id="race-quick" ${h.quick?'checked':''} ${running?'disabled':''}>Quick race (7 seconds)</label></div>
 <div class="cz-felt rc-track" data-testid="race-track"><div class="rc-rail"></div><div class="rc-finish" aria-hidden="true"></div>${lanes}${h.call==='Photo finish!'?'<p class="rc-photo" data-testid="photo-finish">PHOTO</p>':''}<p class="rc-caller" aria-live="polite">${esc(h.call||'Post time. Place your bets.')}</p></div>
 ${running||done?`<p class="rc-order" aria-hidden="true">Running order <b data-race-order>${c.runners.filter(r=>!r.scratched).sort((a,b)=>pos(b.no)-pos(a.no)).slice(0,4).map((r,i)=>`${i+1}. #${r.no}`).join('  ')}</b></p>`:''}
 ${done&&h.order?`<div class="rc-result"><span>1st <b>${esc(c.runners[h.order[0]-1].name)}</b></span><span>2nd <b>${esc(c.runners[h.order[1]-1].name)}</b></span><span>3rd <b>${esc(c.runners[h.order[2]-1].name)}</b></span><p class="cz-result ${h.returned>h.wagered?'up':h.returned?'even':'down'}">${h.returned?`You get back ${money(h.returned)} on ${money(h.wagered)}`:`No winners · ${money(h.wagered)} lost`}</p></div>`:''}
 <div class="cz-seg rc-kinds" role="group" aria-label="Bet type">${kinds.map(([k,l])=>`<button type="button" data-race-kind="${k}" class="${h.kind===k?'on':''}" ${h.phase!=='betting'?'disabled':''}>${l}</button>`).join('')}</div>
 ${ridingMarkup}<p class="cz-fine">${({dd:leg2?`Daily Double, leg 2: pick the winner of race ${c.number+1} (${esc(h.next.track)}). Leg 1: #${h.picking[0]} ${esc(c.runners[h.picking[0]-1].name)}.`:`Daily Double: pick this race’s winner, then the winner of race ${c.number+1}. Paid after race ${c.number+1}.`,win:'Win: your horse finishes first.',place:'Place: first or second.',show:'Show: first, second or third.',exacta:'Exacta: the first two in order. Pick the winner, then the runner-up.',quinella:'Quinella: the first two in either order. Pick two horses.',trifecta:'Trifecta: the first three in order. Pick 1st, 2nd, then 3rd.',superfecta:'Superfecta: the first four in order. Pick 1st, 2nd, 3rd, then 4th.',atb:'Across the board: one chip each to Win, Place and Show on one horse (three chips).'} as Record<string,string>)[h.kind]}${boxing?` Boxed: pick ${PICKS[h.kind as RaceKind]} horses and every order goes in, one chip each (${({exacta:2,trifecta:6,superfecta:24} as Record<string,number>)[h.kind]} chips).`:''}${multi&&h.picking.length?` Picked: ${h.picking.map(n=>'#'+n).join(', ')}.`:''} Odds are fixed when you bet.</p>
 ${BOXABLE.includes(h.kind as RaceKind)?`<label class="auto-deal-toggle"><input type="checkbox" id="race-box" ${h.box?'checked':''} ${h.phase!=='betting'?'disabled':''}>Box it: every order of your horses</label>`:''}
 <table class="rc-table"><thead><tr><th>#</th><th>Horse</th><th title="Win odds">Odds</th><th>${multi||dd?'Pick':atb?'W·P·S':h.kind[0].toUpperCase()+h.kind.slice(1)}</th></tr></thead><tbody>${leg2?`<tr class="rc-leg2"><td colspan="4">Race ${h.next.number} · ${esc(h.next.track)} · ${esc(h.next.distance)}</td></tr>`:''}${rows}</tbody></table>
 <div class="rc-slip"><h3>Bet slip</h3>${slip?`<ul>${slip}</ul>`:'<p class="muted">No bets yet. Pick a horse.</p>'}</div>
 <div class="cz-actions">${done?'<button type="button" class="button secondary" id="race-replay">Replay</button><button type="button" class="button cz-go" id="race-next">Next race</button>':`<button type="button" class="button secondary" id="race-clear" ${running||!p.pending('races')?'disabled':''}>Clear</button><button type="button" class="button cz-go" id="race-start" ${running?'disabled':''}>${running?(h.replay?'Replay…':'They’re running…'):`Start the race${p.pending('races')?` · ${money(p.pending('races'))}`:''}`}</button>`}</div>
 ${board}
 <p class="cz-fine">Fixed odds from each horse’s true chance with a ${Math.round(TAKE*100)}% take, like a track’s pools: every bet returns about ${100-Math.round(TAKE*100)}% over time. Prices under 1/10 are not offered. Paddock notes are what a railbird would see: a hint, not a promise.</p>
 ${roundsPanel(p,'races')}
 </section>`;
}
export function casinoMarkup(p:CasinoPlayer,game:CasinoView):string {
 return game==='roulette'?rouletteMarkup(p):game==='craps'?crapsMarkup(p):game==='baccarat'?baccaratMarkup(p):racesMarkup(p);
}
export const CASINO_TITLES=TITLES;
export type {CasinoState};
