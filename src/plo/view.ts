import {idleActivity} from '../bots/table-life';
/** Patch 74: the Omaha screen: a lobby, then the table with four cards each and pot-limit betting buttons. */
import type {Card} from '../contracts';
import {legalPlo,potSizes} from './engine';
import {PLO_PLAYERS} from './bots';
import {PLO_STAKES,type PloTable} from './table';
import {seatSpots,actorLine} from '../ui/replayer';
import {facesFor} from '../ui/face-hook';

export interface PloDraw {card:(c:Card|undefined,size?:string)=>string;esc:(s:string)=>string}
const money=(cents:number)=>`$${(cents/100).toLocaleString('en-US',cents%100?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0})}`;
const signed=(cents:number)=>`${cents>0?'+':cents<0?'−':''}${money(Math.abs(cents))}`;

export interface PloUiState {stakes:string;buyInBB:number;raiseTo:number|null;error:string;notice:string;thinking:boolean;
 /** Patch 75: shorter thinking pauses. Timing tells still show. */
 fast?:boolean;
 /** Patch 82: chips on their way to the pot or to a winner, as felt percentages. Display only. */
 fly?:{id:string;from:[number,number];to:[number,number];kind:'pot'|'win'}[];
 /** Patch 95: what you said and the answers, and the quick-chat row. Display only. */
 heroSaid?:{phrase:string;replies:{seatId:number;text:string}[]}|null;quickChat?:string}

export function ploMarkup(t:PloTable,ui:PloUiState,d:PloDraw):string {
 const banner=`${t.notice?`<p class="error-banner" role="alert">${d.esc(t.notice)}</p>`:''}${ui.error?`<p class="error-banner" role="alert">${d.esc(ui.error)}</p>`:''}`;
 return `<section class="panel plo" data-testid="plo">${banner}${t.state.active?tableMarkup(t,ui,d):lobbyMarkup(t,ui,d)}</section>`;
}

function lobbyMarkup(t:PloTable,ui:PloUiState,d:PloDraw):string {
 const stakes=PLO_STAKES.find(s=>s.id===ui.stakes)??PLO_STAKES[0],buyIn=ui.buyInBB*stakes.bigBlind;
 const last=t.state.sessions.filter(s=>s.endedAt).slice(-5).reverse();
 return `<span class="eyebrow">POT-LIMIT OMAHA · VIRTUAL CHIPS</span><h2>Omaha table</h2>
 <p class="muted">Four cards each. At showdown you must use <b>exactly two</b> of your cards and three from the board. The biggest bet or raise is the size of the pot. Your Omaha balance is separate from your Hold’em bankroll.</p>
 <p class="plo-balance" data-testid="plo-balance">Omaha balance <b data-count-key="plo-balance" data-count="${t.state.balance}">${money(t.state.balance)}</b></p>
 <div class="segmented" role="group" aria-label="Stakes">${PLO_STAKES.map(s=>`<button type="button" class="segment${s.id===stakes.id?' selected':''}" data-plo-stakes="${s.id}" aria-pressed="${s.id===stakes.id}">${s.label}</button>`).join('')}</div>
 <div class="segmented" role="group" aria-label="Buy-in">${[40,60,100].map(bb=>`<button type="button" class="segment${bb===ui.buyInBB?' selected':''}" data-plo-buyin="${bb}" aria-pressed="${bb===ui.buyInBB}">${bb} BB · ${money(bb*stakes.bigBlind)}</button>`).join('')}</div>
 <button type="button" class="button primary" id="plo-sit" ${t.state.balance<buyIn?'disabled':''}>Sit down with ${money(buyIn)}</button>${t.state.balance<buyIn?`<p class="muted">Not enough in your Omaha balance. <button type="button" class="button secondary" id="plo-reset">Reset balance to ${money(500000)}</button></p>`:''}
 <h3>Who plays here</h3><ul class="plo-players">${PLO_PLAYERS.map(p=>`<li><b>${d.esc(p.name)}</b> <span class="muted">${d.esc(p.style)}</span><br><small>${d.esc(p.read)}</small></li>`).join('')}</ul>
 ${t.state.hands.length?`<h3>Recent hands</h3><ul class="plo-hands" data-testid="plo-hands">${t.state.hands.slice(-5).reverse().map(h=>`<li><details><summary><span class="plo-cards">${h.hole.map(c=>d.card(c,'small-card')).join('')}</span> <b class="${h.net>=0?'pos':'neg'}">${signed(h.net)}</b> <span class="muted">${d.esc(h.stakes)} · hand ${h.number}</span></summary><p class="muted">Board ${h.board.join(' ')||'not dealt'}${h.shown.length?` · shown: ${h.shown.map(x=>`${d.esc(x.name)} ${x.hole.join('')} (${d.esc(x.label)})`).join(', ')}`:''}</p><ol class="plo-log">${h.summary.map(line=>`<li>${d.esc(line)}</li>`).join('')}</ol></details></li>`).join('')}</ul>`:''}
 ${last.length?`<h3>Recent sessions</h3><ul class="plo-sessions">${last.map(s=>`<li>${d.esc(PLO_STAKES.find(x=>x.id===s.stakes)?.label??s.stakes)} · ${s.hands} hands · <b class="${s.cashOut-s.buyIns>=0?'pos':'neg'}">${signed(s.cashOut-s.buyIns)}</b></li>`).join('')}</ul>`:''}`;
}

function tableMarkup(t:PloTable,ui:PloUiState,d:PloDraw):string {
 const a=t.state.active!,h=t.hand!,spots=seatSpots(h.seats.map(s=>s.id)),pot=h.potCollected+h.seats.reduce((x,s)=>x+s.bet,0);
 const talk=(a.talk??[]).filter(x=>x.hand===a.number);
 const bubble=(text:string,extra='')=>/^\*.+\*$/.test(text)?`<span class="plo-say plo-gesture${extra}" data-testid="plo-say"><i>${d.esc(text.slice(1,-1))}</i></span>`:`<span class="plo-say${extra}" data-testid="plo-say">“${d.esc(text)}”</span>`;
 const said=ui.heroSaid;
 const say=(id:number)=>{if(said){if(id===0)return bubble(said.phrase,' plo-hero-say');const r=said.replies.find(y=>y.seatId===id);if(r)return bubble(r.text,' plo-reply');}const x=talk.filter(y=>y.seatId===id).at(-1);return x?bubble(x.text):'';};
 const mood=(id:number)=>{const m=a.moods?.[id];return m?.mood==='tilt'?'<span class="plo-mood tilt">steaming</span>':m?.mood==='heater'?'<span class="plo-mood heater">on a heater</span>':'';};
 const hue=(name:string)=>[...name].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7)%360;
 const faces=facesFor(h.seats.filter(s=>s.id!==0).map(s=>s.name));
 const seats=h.seats.map(s=>{const p=spots[s.id],won=h.payouts[s.id]??0,side=p.x<30?' side-left':p.x>70?' side-right':'';
  const cards=s.folded&&s.id!==0?'':`<span class="plo-cards">${s.hole.map(c=>d.card(c||undefined,'small-card')).join('')}</span>`;
  const label=h.street==='complete'&&h.labels[s.id]&&(s.id===0||h.showdown.includes(s.id))?`<span class="plo-label">${d.esc(h.labels[s.id])}</span>`:h.street==='complete'&&h.labels[s.id]?'<span class="plo-label muck">mucks</span>':'';
  return `<div class="plo-seat${side}${s.folded?' folded':''}${h.street==='complete'&&won?' won':''}${h.actor===s.id&&h.street!=='complete'?' acting':''}${s.id===0?' hero':''}" style="left:${p.x.toFixed(1)}%;top:${p.y.toFixed(1)}%">${cards}<div class="plo-plate">${faces?`<span class="plo-avatar plo-face" aria-hidden="true">${faces(s.name,s.id===0,h.street==='complete'&&won?'happy':s.folded?'sigh':'neutral')}</span>`:`<span class="plo-avatar" style="--hue:${s.id===0?42:hue(s.name)}" aria-hidden="true">${d.esc(s.id===0?'You'.slice(0,1):s.name.slice(0,1))}</span>`}<span class="plo-id"><b>${d.esc(s.name)}${h.button===s.id?' <i class="rp-button">D</i>':''}</b><small>${money(s.stack)}${s.allIn&&h.street!=='complete'?' · all in':''}</small></span></div>${h.street==='complete'&&won?`<span class="rp-won">+${money(won)}</span>`:''}${label}${mood(s.id)}${say(s.id)}${s.folded&&s.id!==0&&h.street!=='complete'?((w)=>w?`<span class="idle-act plo-idle" data-testid="idle-act">${d.esc(w)}</span>`:'')(idleActivity(s.name,undefined,`${h.handId}:${s.id}`)):''}</div>`;}).join('');
 /* Bets sit on the felt between the player and the pot, as chips do at a real table. */
 const bets=h.seats.filter(s=>s.bet>0).map(s=>{const p=spots[s.id];return `<span class="plo-bet rp-bet" data-seat="${s.id}" style="left:${(p.x+(50-p.x)*.42).toFixed(1)}%;top:${(p.y+(50-p.y)*.42).toFixed(1)}%"><i class="plo-chip" aria-hidden="true"></i>${money(s.bet)}</span>`;}).join('');
 const hero=h.seats.find(s=>s.id===0),complete=h.street==='complete';
 let panel='';
 if(t.heroTurn){
  const l=legalPlo(h)!,sizes=potSizes(h),to=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,ui.raiseTo??l.minRaiseTo));
  panel=`<div class="plo-actions" data-testid="plo-actions"><p class="muted">Pot ${money(pot)}${l.call?` · ${money(l.call)} to call (you need ${(100*l.call/(pot+l.call)).toFixed(0)}%)`:''}${l.canRaise?` · pot-limit raise up to ${money(l.maxRaiseTo)}`:''}</p>
   <div class="plo-buttons">${l.fold?'<button type="button" class="button secondary" id="plo-fold">Fold</button>':''}<button type="button" class="button secondary" id="plo-${l.check?'check':'call'}">${l.check?'Check':`Call ${money(l.call)}`}</button></div>
   ${l.canRaise?`<label class="plo-raise" for="plo-raise-to">${h.currentBet?'Raise to':'Bet'} <b id="plo-raise-label">${money(to)}</b><input id="plo-raise-to" type="range" min="${l.minRaiseTo}" max="${l.maxRaiseTo}" step="${h.bigBlind/2}" value="${to}"></label>
   <div class="plo-buttons">${sizes?`<button type="button" class="button secondary" data-plo-size="${sizes.half}">½ pot</button><button type="button" class="button secondary" data-plo-size="${sizes.pot}">Pot ${money(sizes.pot)}</button>`:''}<button type="button" class="button primary" id="plo-raise">${h.currentBet?'Raise to':'Bet'} ${money(to)}</button></div>`:''}</div>`;
 }else if(complete){
  const net=hero?hero.stack-hero.startingStack:0,broke=(a.stacks[0]??0)<=0;
  panel=`<div class="plo-actions" data-testid="plo-result"><p class="plo-outcome"><b>${hero&&(h.payouts[0]??0)>0?`You win ${money(h.payouts[0])}`:'Hand over'}</b> · ${signed(net)}${h.labels[0]?` · ${d.esc(h.labels[0])}`:''}</p>
   <div class="plo-buttons">${broke?`<button type="button" class="button primary" id="plo-rebuy">Rebuy ${money(100*a.stakes.bigBlind)}</button>`:'<button type="button" class="button primary" id="plo-next">Deal next hand</button>'}<button type="button" class="button secondary" id="plo-leave">Leave table</button></div></div>`;
 }else panel=`<div class="plo-actions"><p class="muted" role="status">${ui.thinking?`${d.esc(h.seats.find(s=>s.id===h.actor)?.name??'')} is thinking…`:'…'}</p></div>`;
 const log=h.events.filter(e=>e.kind!=='refund').slice(-8).map(e=>{const who=e.seatId===undefined?'':h.seats.find(s=>s.id===e.seatId)?.name??'';return `<li>${e.kind==='street'?`<b>${d.esc(e.text[0].toUpperCase()+e.text.slice(1))}${e.cards?.length?`: ${d.esc(e.cards.map(c=>(c[0]==='T'?'10':c[0])+({c:'♣',d:'♦',h:'♥',s:'♠'} as Record<string,string>)[c[1]]).join(' '))}`:''}</b>`:d.esc(actorLine(who,e.text.replace(/\d+/g,m=>money(Number(m))))+(e.tempo==='snap'?' (snap)':e.tempo==='tank'?' (after a long think)':''))}</li>`;}).join('');
 return `<div class="plo-head"><span class="eyebrow">${d.esc(a.stakes.label)} · HAND ${a.number}</span><span class="plo-head-tools"><label class="plo-fast" for="plo-fast"><input type="checkbox" id="plo-fast" ${ui.fast?'checked':''}> Faster</label>${complete?'':'<button type="button" class="button secondary" id="plo-leave">Leave</button>'}</span></div>
 <div class="rp-felt plo-felt plo-hand-${a.number%2?'a':'b'}" data-testid="plo-table"><span class="plo-print" aria-hidden="true">POT-LIMIT OMAHA</span><div class="rp-center"><div class="rp-board">${h.board.map(c=>d.card(c,'small-card')).join('')}</div><span class="rp-pot">${complete?'Hand complete':`Pot ${money(pot)}`}</span></div>${seats}${bets}${(ui.fly??[]).map(f=>`<span class="plo-fly ${f.kind}" id="plo-fly-${d.esc(f.id)}" aria-hidden="true" style="--fx:${f.from[0].toFixed(1)}%;--fy:${f.from[1].toFixed(1)}%;--tx:${f.to[0].toFixed(1)}%;--ty:${f.to[1].toFixed(1)}%"><i class="plo-chip"></i><i class="plo-chip"></i><i class="plo-chip"></i></span>`).join('')}</div>${ui.quickChat??''}
 ${panel}<ol class="plo-log">${log}</ol><p class="muted plo-foot">Omaha balance ${money(t.state.balance)} · at the table ${money(a.stacks[0]??0)}</p>`;
}

/** Patch 82: where chips fly when bets are gathered into the pot, and when the pot goes to its winners. */
export interface FlySnapshot {handId:string;street:string;bets:Record<number,number>}
export function ploFlights(prev:FlySnapshot|null,h:import('./engine').PloHand,stamp:string):{id:string;from:[number,number];to:[number,number];kind:'pot'|'win'}[] {
 if(!prev||prev.handId!==h.handId)return [];
 const spots=seatSpots(h.seats.map(s=>s.id)),center:[number,number]=[50,47],out:{id:string;from:[number,number];to:[number,number];kind:'pot'|'win'}[]=[];
 if(prev.street!==h.street)for(const [id,bet] of Object.entries(prev.bets)){const p=spots[Number(id)];if(!p||bet<=0)continue;out.push({id:`${stamp}-p${id}`,from:[p.x+(50-p.x)*.42,p.y+(50-p.y)*.42],to:center,kind:'pot'});}
 if(h.street==='complete'&&prev.street!=='complete')for(const [id,won] of Object.entries(h.payouts)){const p=spots[Number(id)];if(!p||won<=0)continue;out.push({id:`${stamp}-w${id}`,from:center,to:[p.x,p.y],kind:'win'});}
 return out;
}
export const flySnapshot=(h:import('./engine').PloHand):FlySnapshot=>({handId:h.handId,street:h.street,bets:Object.fromEntries(h.seats.filter(s=>s.bet>0).map(s=>[s.id,s.bet]))});
