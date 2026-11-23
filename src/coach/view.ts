/** Patch 105: the Live coach panel. Off until switched on; the choice is remembered on this device. */
import type {Action} from '../contracts';
import type {Advice,Basis} from './coach';

export const COACH_KEY='poker-night-ai:live-coach',COACH_TEST_KEY='poker-night-ai:live-coach-test';
export interface CoachUi {on:boolean;
 /** "Test me first": show the questions, and the play only when asked. */
 test:boolean;revealed:string|null;
 /** The advice for the decision on screen, kept so the action taken can be compared with it. */
 last:Advice|null;review:{text:string;matched:boolean}|null;tally:{matched:number;total:number}}
export function freshCoachUi():CoachUi {
 const read=(k:string)=>{try{return localStorage.getItem(k)==='on';}catch{return false;}};
 return {on:read(COACH_KEY),test:read(COACH_TEST_KEY),revealed:null,last:null,review:null,tally:{matched:0,total:0}};
}
export function saveCoachUi(ui:CoachUi):void {try{localStorage.setItem(COACH_KEY,ui.on?'on':'off');localStorage.setItem(COACH_TEST_KEY,ui.test?'on':'off');}catch{/* this visit only */}}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const BASIS:Record<Basis,string>={exact:'exact',estimate:'estimate',pool:'pool average',rule:'rule of thumb',measured:'measured here'};
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
 if(!ui.on)return `<div class="coach-row">${head}</div>`;
 const review=coachReviewMarkup(ui);
 if(!advice)return `<div class="coach-row">${head}${review}${o.waiting?'<p class="coach-wait">The coach speaks when it is your turn.</p>':''}</div>`;
 const ask=`<p><b>${advice.card.id} ${esc(advice.card.name)}:</b> ${esc(advice.card.master)}</p><p><b>${advice.overlay.id} ${esc(advice.overlay.name)}:</b> ${esc(advice.overlay.master)}</p>`;
 if(ui.test&&ui.revealed!==advice.key)return `<div class="coach-row">${head}${review}<div class="coach-card" data-testid="coach-quiz"><p class="coach-play"><span class="eyebrow">COACH · TEST ME</span> <b>What is your play, and why?</b></p><p>Work through your ${advice.overlay.id} ${esc(advice.overlay.name.toLowerCase())} before you look:</p><ol class="coach-questions">${advice.overlay.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol><p><b>${advice.ask.id} ${esc(advice.ask.name)}:</b> ${esc(advice.ask.master)}</p><button type="button" class="button secondary" id="coach-reveal">Show the coach’s play</button></div></div>`;
 const w=advice.why,rows:[string,string][]=[['Ranges',w.ranges],['Objective',w.objective],['Responses',w.responses],['Alternatives',w.alternatives],['Future plan',w.future]];
 return `<div class="coach-row">${head}${review}<div class="coach-card" data-testid="coach-advice" data-coach-action="${advice.action}">
  <p class="coach-play"><span class="eyebrow">COACH</span> <b data-testid="coach-headline">${esc(advice.headline)}</b>${advice.close?' <small class="coach-close">Close spot: another play is reasonable</small>':''}${advice.to!==null?` <button type="button" class="button secondary coach-use" data-coach-size="${advice.to}">Use this size</button>`:''}</p>
  <p class="coach-job"><b>Your hand:</b> ${esc(advice.job)}</p>
  <dl class="coach-why">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  ${advice.numbers.length?`<ul class="coach-numbers">${advice.numbers.map(n=>`<li><span>${esc(n.label)}</span><b>${esc(n.value)}</b><small class="basis ${n.basis}">${BASIS[n.basis]}</small></li>`).join('')}</ul>`:''}
  <details class="coach-lesson" open><summary>Learn: ${esc(advice.lesson.title)}</summary><p>${esc(advice.lesson.body)}</p></details>
  <details class="coach-ask"><summary>Ask yourself (your notecards)</summary>${ask}</details>
  <small class="coach-fine">A rule-based coach built from your playbook, not a solver. Estimates assume a typical range for the action shown. Pool figures are live-game averages, and these opponents may play differently.${o.tournament?' It does not model prize-ladder (ICM) pressure.':''}</small>
 </div></div>`;
}
