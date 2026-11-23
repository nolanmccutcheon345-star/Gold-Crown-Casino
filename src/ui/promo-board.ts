/** Patch 70: the card room's promotion board, dealer tokes and what the house takes. Markup and device-only toke notes. */
import type {AppData} from '../session/types';
import {HIGH_HAND_HOUR,highHandHours,houseTake,jackpotBefore,TOKE_LABELS,type HighHandHour,type TokePolicy} from '../session/promos';

const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);
export const dollars=(cents:number)=>`$${(cents/100).toLocaleString('en-US',{maximumFractionDigits:2})}`;

export function currentHour(data:AppData,sessionId:string):HighHandHour|null {const hours=highHandHours(data,sessionId,true);const last=hours.at(-1);return !last?null:last.closed&&last.hands>=HIGH_HAND_HOUR?{...last,hour:last.hour+1,hands:0,closed:false,leader:null}:last;}

/** The strip under the table: this hour's high hand and the progressive bad-beat jackpot. */
export function promoBoard(data:AppData,sessionId:string,notice:string):string {
 const hour=currentHour(data,sessionId),jackpot=jackpotBefore(data);
 const session=data.sessions.find(s=>s.id===sessionId);if(!session)return'';
 const prize=hour?.prize??Math.max(10_000,50*session.settings.bigBlind),left=HIGH_HAND_HOUR-(hour?.hands??0);
 const leader=hour?.leader?`${esc(hour.leader.name)}, ${esc(hour.leader.label.toLowerCase())}`:'nobody yet';
 const lastHit=jackpot.lastHit?.where==='room'?' · last hit at another table':'';
 return `<details class="promo-board" data-testid="promo-board"><summary><span class="promo-chip">HIGH HAND ${dollars(prize)}</span> <span>${leader} · ${left} hand${left===1?'':'s'} left</span> <span class="promo-chip jackpot">BAD BEAT ${dollars(jackpot.amount)}</span></summary>
 <ul><li><b>High hand of the hour</b> (every ${HIGH_HAND_HOUR} hands): the best full house or better, both hole cards playing, shown at the table. Paid by the house when the hour ends or you leave.</li>
 <li><b>Bad-beat jackpot</b>: aces full of tens or better, both cards playing, loses at showdown to a better hand, both cards playing. Half to the losing hand, a quarter to the winner, a quarter shared by the rest of the table.${lastHit}</li>
 <li>Promotions are house money. They go to your bankroll, not your poker results. Only hands the table saw count.</li></ul></details>${notice?`<p class="promo-notice" role="status" data-testid="promo-notice">${esc(notice)}</p>`:''}`;
}

export function tokeSelect(policy:TokePolicy):string {
 return `<label class="style-select" for="style-tokes">Dealer tokes<select id="style-tokes">${(Object.keys(TOKE_LABELS) as TokePolicy[]).map(p=>`<option value="${p}" ${p===policy?'selected':''}>${esc(TOKE_LABELS[p])}</option>`).join('')}</select></label>`;
}

/** Results panel: what rake, tokes and promotions did to your result. */
export function houseTakeMarkup(data:AppData,policy:TokePolicy):string {
 const t=houseTake(data.hands,data.ledger);if(t.hands<20)return '';
 const sign=(n:number)=>`${n>=0?'+':''}${n.toFixed(1)}`;
 return `<section class="panel results-panel house-take" data-testid="house-take"><span class="eyebrow">THE HOUSE</span><h2>Rake, tokes and promotions</h2><p class="muted">Your last ${t.hands.toLocaleString('en-US')} saved hands.</p>
 <div class="result-table"><div class="result-row"><span>Rake from pots you won (${t.potsWon})</span><span>${dollars(t.rake)}</span><span>${t.rakePer100.toFixed(1)} BB/100</span></div>
 <div class="result-row"><span>Dealer tokes</span><span>${dollars(t.tokes)}</span><span>${esc(TOKE_LABELS[policy])}</span></div>
 <div class="result-row"><span>Promotions won</span><span>${dollars(t.promos)}</span><span>house money</span></div></div>
 <p>Before rake you won <b>${sign(t.bbPer100Before)} BB/100</b>; after rake <b>${sign(t.bbPer100After)} BB/100</b>. ${t.rakePer100>=4?'Rake is a big part of beating small stakes: play fewer marginal pots that get raked and won small.':'Rake is taking a modest share.'} Tokes and promotions are counted in your bankroll, never in your poker result.</p></section>`;
}
