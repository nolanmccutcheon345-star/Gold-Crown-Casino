/** Patch 105: the Live coach panel. Off until switched on; the choice is remembered on this device. */
import type {Action} from '../contracts';
import type {Advice,Basis} from './coach';

export const COACH_KEY='poker-night-ai:live-coach',COACH_TEST_KEY='poker-night-ai:live-coach-test';
export interface CoachUi {on:boolean;
 /** "Test me first": show the questions, and the play only when asked. */
 test:boolean;revealed:string|null;
 /** Phase 10 (P10-F01): on compact viewports the coach card collapses to its one-line
  * suggestion; this is the advice key the player has tapped open, if any. */
 expandedKey:string|null;
 /** The advice for the decision on screen, kept so the action taken can be compared with it. */
 last:Advice|null;review:{text:string;matched:boolean}|null;tally:{matched:number;total:number}}
export function freshCoachUi():CoachUi {
 const read=(k:string)=>{try{return localStorage.getItem(k)==='on';}catch{return false;}};
 return {on:read(COACH_KEY),test:read(COACH_TEST_KEY),revealed:null,expandedKey:null,last:null,review:null,tally:{matched:0,total:0}};
}
export function saveCoachUi(ui:CoachUi):void {try{localStorage.setItem(COACH_KEY,ui.on?'on':'off');localStorage.setItem(COACH_TEST_KEY,ui.test?'on':'off');}catch{/* this visit only */}}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const BASIS:Record<Basis,string>={exact:'exact',estimate:'estimate',pool:'pool average',rule:'rule of thumb',measured:'measured here',icm:'ICM'};
const PLAY:Record<string,string>={fold:'folded',check:'checked',call:'called'};

/** Compare what Hero did with the coach's play for that decision, and keep the running tally. */
export function reviewAction(ui:CoachUi,key:string,action:Action,money:(n:number)=>string):void {
 const advice=ui.last;if(!ui.on||!advice||advice.key!==key)return;
 const aggressive=advice.action==='bet'||advice.action==='raise'||advice.action==='all-in';
 const same=action.type==='raise'?aggressive:advice.action===action.type;
 const did=action.type==='raise'?`put in ${money(action.to)}`:PLAY[action.type];
 const sizeOff=action.type==='raise'&&aggressive&&advice.to!==null&&Math.abs(action.to-advice.to)>.35*advice.to;
 ui.tally={matched:ui.tally.matched+(same?1:0),total:ui.tally.total+1};
 ui.review={matched:same,text:same?`Last decision: you ${did}, the same play as the coach${sizeOff?`, with a different size (the coach had ${money(advice.to!)})`:''}.`:`Last decision: you ${did}; the coach had ${advice.headline}.${advice.close?' It was a close spot.':''}`};
 ui.last=null;
}
/** The last review and the tally, for the end-of-hand panel (where the coach itself is not shown). */
export function coachReviewMarkup(ui:CoachUi):string {
 return ui.on&&ui.review?`<p class="coach-review ${ui.review.matched?'matched':'missed'}" data-testid="coach-review">${esc(ui.review.text)} <small>Same play as the coach on ${ui.tally.matched} of ${ui.tally.total} decisions this visit.</small></p>`:'';
}
export function coachMarkup(ui:CoachUi,advice:Advice|null,o:{waiting:boolean;tournament:boolean}):string {
 const head=`<div class="coach-switches"><label class="t-watch-result"><input id="coach-on" type="checkbox" ${ui.on?'checked':''}>Live coach</label>${ui.on?`<label class="t-watch-result"><input id="coach-test" type="checkbox" ${ui.test?'checked':''}>Test me first</label>`:''}</div>`;
 /* Phase 6 (F-15): while the coach is off, say what it is — a bare checkbox in a
  * settings cluster meant nobody ever found the playbook coach. One line and a
  * one-tap way to switch it on; the choice itself still belongs to the player. */
 /* Phase 12 (T-F09): in a tournament the decision panel carries the decision, not
  * marketing copy — the ~180px teaser paragraph inflated every tournament decision
  * panel, so the tournament coach row is just the switch. Cash keeps the teaser. */
 if(!ui.on)return o.tournament?`<div class="coach-row">${head}</div>`:`<div class="coach-row">${head}<p class="coach-teaser">The Live coach reads each decision like the playbook — pot odds in plain words, and the principle behind the play. <button type="button" class="coach-teaser-on" id="coach-enable">Turn on the coach</button></p></div>`;
 const review=coachReviewMarkup(ui);
 if(!advice)return `<div class="coach-row">${head}${review}${o.waiting?'<p class="coach-wait">The coach speaks when it is your turn.</p>':''}</div>`;
 const ask=`<p><b>${advice.card.id} ${esc(advice.card.name)}:</b> ${esc(advice.card.master)}</p><p><b>${advice.overlay.id} ${esc(advice.overlay.name)}:</b> ${esc(advice.overlay.master)}</p>`;
 if(ui.test&&ui.revealed!==advice.key)return `<div class="coach-row">${head}${review}<div class="coach-card" data-testid="coach-quiz"><p class="coach-play"><span class="eyebrow">COACH · TEST ME</span> <b>What is your play, and why?</b></p><p>Work through your ${advice.overlay.id} ${esc(advice.overlay.name.toLowerCase())} before you look:</p><ol class="coach-questions">${advice.overlay.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol><p><b>${advice.ask.id} ${esc(advice.ask.name)}:</b> ${esc(advice.ask.master)}</p><button type="button" class="button secondary" id="coach-reveal">Show the coach’s play</button></div></div>`;
 const w=advice.why,rows:[string,string][]=[['Ranges',w.ranges],['Objective',w.objective],['Responses',w.responses],['Alternatives',w.alternatives],['Future plan',w.future]];
 /* Phase 10 (P10-F01): the card leads with the one-line suggestion; everything behind
  * "Why this play" sits in .coach-detail, which compact viewports keep closed until
  * tapped (see phone-play.css). The lesson is a closed <details> by default now, with
  * an id so a render can keep it open across the decision. */
 const open=ui.expandedKey===advice.key;
 return `<div class="coach-row">${head}${review}<div class="coach-card${open?' coach-open':''}" data-testid="coach-advice" data-coach-action="${advice.action}">
  <p class="coach-play"><span class="eyebrow">COACH</span> <b data-testid="coach-headline">${esc(advice.headline)}</b>${advice.close?' <small class="coach-close">Close spot: another play is reasonable</small>':''}${advice.to!==null?` <button type="button" class="button secondary coach-use" data-coach-size="${advice.to}">Use this size</button>`:''} <button type="button" class="coach-toggle" data-coach-toggle="${esc(advice.key)}" aria-expanded="${open}">${open?'Hide the why':'Why this play'} ▾</button></p>
  <div class="coach-detail">
  <p class="coach-job"><b>Your hand:</b> ${esc(advice.job)}</p>
  ${advice.spot?`<p class="coach-spot"><small>${esc(advice.spot)}</small></p>`:''}
  ${advice.gap?`<p class="coach-gap"><small>${esc(advice.gap)}</small></p>`:''}
  <dl class="coach-why">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  ${advice.numbers.length?`<ul class="coach-numbers">${advice.numbers.map(n=>`<li><span>${esc(n.label)}</span><b>${esc(n.value)}</b><small class="basis ${n.basis}">${BASIS[n.basis]}</small></li>`).join('')}</ul>`:''}
  ${advice.alternatives?.length?`<div class="coach-alternatives"><p class="coach-alt-head"><b>Close alternatives</b> <small>EV against folding; an estimate is only shown where the math supports one</small></p><ul class="coach-numbers">${advice.alternatives.map(a=>`<li><span>${esc(a.action)}${a.recommended?' · the coach’s play':''}</span><b>${esc(a.evLabel??'—')}</b><small class="basis ${a.basis}">${BASIS[a.basis]}</small><small class="coach-alt-note">${esc(a.note)}</small></li>`).join('')}</ul></div>`:''}
  <details class="coach-lesson" id="coach-lesson"><summary>Learn: ${esc(advice.lesson.title)}</summary><p>${esc(advice.lesson.body)}</p></details>
  <details class="coach-ask" id="coach-ask"><summary>Ask yourself (your notecards)</summary>${ask}</details>
  <small class="coach-fine">A rule-based coach built from your playbook, not a solver. Estimates assume a typical range for the action shown. Pool figures are live-game averages, and these opponents may play differently.${o.tournament?(advice.icmPriced?' Tournament advice on this spot was priced with prize-ladder (ICM) pressure from the payout context supplied.':' It does not model prize-ladder (ICM) pressure.'):''}</small>
  </div>
 </div></div>`;
}
