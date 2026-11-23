/** The Tournament stats page as markup. Pure function of `tournamentStats` output and the filter. */
import {chips,dollars,ordinal} from './screens';
import type {PlayStat,Rate,ResultGroup,StatsFilter,TournamentStats,EventResult} from './stats';

const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const pct=(value:number|null,signed=false)=>value===null?'—':`${signed&&value>0?'+':''}${(value*100).toFixed(Math.abs(value)<.1&&value!==0?1:0)}%`;
const signedDollars=(cents:number)=>`${cents>0?'+':''}${dollars(cents)}`;
const tone=(n:number)=>n>0?'positive':n<0?'negative':'';
const rate=(r:Rate)=>r.chances?r.count/r.chances:null;
/** Fewer chances than this and a rate is shown greyed with its count only. */
export const MIN_CHANCES=20;

function segmented(name:string,label:string,options:[string,string][],current:string):string {
 return `<div class="segmented" role="group" aria-label="${escape(label)}">${options.map(([value,text])=>`<button type="button" class="segment${value===current?' selected':''}" data-tstats-${name}="${value}" aria-pressed="${value===current}">${escape(text)}</button>`).join('')}</div>`;
}
function filters(filter:StatsFilter):string {
 return `<div class="tstats-filters">${segmented('format','Format',[['all','All formats'],['single','Single table'],['multi','Multi-table']],filter.format)}${segmented('tier','Event type',[['all','All events'],['home','Home'],['casino','Casino'],['series','Series']],filter.tier)}${segmented('recent','Range',[['all','All time'],['20','Last 20']],filter.recent)}</div>`;
}
function groupTable(caption:string,rows:ResultGroup[]):string {
 if(rows.length<2)return '';
 return `<table class="standings-table tstats-group"><caption>${escape(caption)}</caption><thead><tr><th scope="col">Group</th><th scope="col">Events</th><th scope="col">In the money</th><th scope="col">Net</th><th scope="col">Return</th></tr></thead><tbody>${rows.map(g=>`<tr><th scope="row">${escape(g.label)}</th><td>${g.events}</td><td>${g.cashes} · ${pct(g.itm)}</td><td class="${tone(g.net)}">${signedDollars(g.net)}</td><td class="${tone(g.net)}">${pct(g.roi,true)}</td></tr>`).join('')}</tbody></table>`;
}

/** Cumulative net result after each event: one line, a zero line, hover titles on each point. */
export function netChart(events:readonly EventResult[]):string {
 if(events.length<2)return '';
 const W=640,H=200,L=56,R=12,T=14,B=26,points:number[]=[];let total=0;for(const e of events){total+=e.net;points.push(total);}
 const lo=Math.min(0,...points),hi=Math.max(0,...points),span=hi-lo||1,x=(i:number)=>L+(W-L-R)*(events.length===1?0:i/(events.length-1)),y=(v:number)=>T+(H-T-B)*(1-(v-lo)/span);
 const path=points.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
 const dataTable=`<details class="tstats-chart-data"><summary>Chart data · all ${events.length} events</summary><div class="table-scroll"><table class="standings-table"><caption>Every event and cumulative net result, oldest first</caption><thead><tr><th scope="col">Event</th><th scope="col">Finish</th><th scope="col">Net</th><th scope="col">Running net</th></tr></thead><tbody>${events.map((e,i)=>`<tr><th scope="row">${i+1}. ${escape(e.name)}</th><td>${ordinal(e.place)} of ${e.entrants}</td><td>${signedDollars(e.net)}</td><td>${signedDollars(points[i])}</td></tr>`).join('')}</tbody></table></div></details>`;
 const last=points.at(-1)!,step=Math.max(1,Math.ceil(events.length/40));
 const dots=points.map((v,i)=>i%step&&i!==points.length-1?'':`<g class="tstats-point"><circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="9" class="tstats-hit"/><circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" class="tstats-dot"/><title>Event ${i+1}: ${escape(events[i].name)}, ${ordinal(events[i].place)} of ${events[i].entrants}. Running net ${signedDollars(v)}</title></g>`).join('');
 return `<figure class="tstats-chart"><figcaption>Running net result, event by event</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running net result over ${events.length} events, from ${signedDollars(points[0])} after the first to ${signedDollars(last)} now. The expandable chart data table below has every value.">
  <line x1="${L}" x2="${W-R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="tstats-zero"/><text x="${L-8}" y="${(y(0)+4).toFixed(1)}" class="tstats-axis" text-anchor="end">$0</text>
  ${hi>0?`<text x="${L-8}" y="${(y(hi)+4).toFixed(1)}" class="tstats-axis" text-anchor="end">${escape(dollars(hi))}</text>`:''}${lo<0?`<text x="${L-8}" y="${(y(lo)+4).toFixed(1)}" class="tstats-axis" text-anchor="end">${escape(dollars(lo))}</text>`:''}
  <text x="${L}" y="${H-6}" class="tstats-axis">Event 1</text><text x="${W-R}" y="${H-6}" class="tstats-axis" text-anchor="end">Event ${events.length}</text>
  <path d="${path}" class="tstats-line"/>${dots}<text x="${(x(points.length-1)-6).toFixed(1)}" y="${(y(last)-10).toFixed(1)}" class="tstats-label" text-anchor="end">${escape(signedDollars(last))}</text></svg></figure>${dataTable}`;
}

function playRow(stat:PlayStat,showRegulars:boolean):string {
 const cell=(r:Rate)=>r.chances?`<td class="${r.chances<MIN_CHANCES?'muted':''}">${pct(rate(r))}<small>${r.count}/${r.chances}</small></td>`:'<td class="muted">—</td>';
 const hero=rate(stat.rates.hero),strong=rate(stat.rates.strong);
 const gap=hero!==null&&strong!==null&&stat.rates.hero.chances>=MIN_CHANCES&&stat.rates.strong.chances>=MIN_CHANCES&&Math.abs(hero-strong)>=.08?(hero>strong?'Higher than the strong regulars':'Lower than the strong regulars'):'';
 return `<tr><th scope="row">${escape(stat.label)}<small>${escape(stat.help)}</small>${gap?`<span class="tstats-gap">${gap}</span>`:''}</th>${cell(stat.rates.hero)}${cell(stat.rates.strong)}${showRegulars?cell(stat.rates.regulars):''}${cell(stat.rates.field)}</tr>`;
}

export function tournamentStatsMarkup(stats:TournamentStats):string {
 const {totals}=stats,filter=filters(stats.filter);
 if(!totals.events)return `<section class="panel tournament-stats" data-testid="tournament-stats" aria-labelledby="tstats-title"><h2 id="tstats-title">Tournament stats</h2>${filter}<p class="lobby-note">No finished tournaments match these filters yet. Results and playing statistics appear here once you finish an event (or bust out of one).</p></section>`;
 const showRegulars=stats.play.some(p=>p.rates.regulars.chances>0);
 const recent=stats.events.slice(-20).reverse();
 return `<section class="panel tournament-stats" data-testid="tournament-stats" aria-labelledby="tstats-title"><h2 id="tstats-title">Tournament stats</h2>${filter}
  <p class="lobby-note">Virtual practice money. Return is net result divided by entry costs, kept apart from cash-game results.</p>
  <dl class="lobby-facts tstats-summary">
   <div><dt>Events</dt><dd>${totals.events}<small>${chips(stats.hands)} hands played</small></dd></div>
   <div><dt>In the money</dt><dd>${totals.cashes}<small>${pct(totals.itm)} of events</small></dd></div>
   <div><dt>Net</dt><dd class="${tone(totals.net)}">${signedDollars(totals.net)}<small>${dollars(totals.cost)} in entries</small></dd></div>
   <div><dt>Return</dt><dd class="${tone(totals.net)}">${pct(totals.roi,true)}</dd></div>
   <div><dt>Wins</dt><dd>${stats.wins}</dd></div>
   <div><dt>Final tables</dt><dd>${stats.multiEvents?`${stats.finalTables}<small>of ${stats.multiEvents} multi-table events</small>`:'—<small>multi-table events only</small>'}</dd></div>
   <div><dt>Average finish</dt><dd>${stats.averageFinish===null?'—':`Top ${Math.round(stats.averageFinish*100)}%`}<small>0% is first, 100% is last</small></dd></div>
   <div><dt>Best finish</dt><dd>${stats.bestFinish?`${ordinal(stats.bestFinish.place)} of ${chips(stats.bestFinish.entrants)}`:'—'}<small>${stats.bestFinish?escape(stats.bestFinish.name):''}</small></dd></div>
   <div><dt>Biggest cash</dt><dd>${stats.biggestCash?dollars(stats.biggestCash):'—'}</dd></div>
  </dl>
  ${netChart(stats.events)}
  <div class="tstats-groups">${groupTable('By format',stats.groups.format)}${groupTable('By event type',stats.groups.tier)}${groupTable('By field size',stats.groups.field)}</div>
  <h3 class="tstats-heading">How you play</h3>
  <p class="lobby-note">From every hand you played in these events, compared with the computer players at your table in the same hands. Strong regulars are the strongest built-in style, a designed reference rather than a solver or human benchmark. Grey rates have fewer than ${MIN_CHANCES} chances.</p>
  <div class="table-scroll"><table class="standings-table tstats-play"><thead><tr><th scope="col">Statistic</th><th scope="col">You</th><th scope="col">Strong regulars</th>${showRegulars?'<th scope="col">Named regulars</th>':''}<th scope="col">Whole field</th></tr></thead><tbody>${stats.play.map(stat=>playRow(stat,showRegulars)).join('')}</tbody></table></div>
  <h3 class="tstats-heading">Recent events</h3>
  <div class="table-scroll"><table class="standings-table"><thead><tr><th scope="col">Event</th><th scope="col">Finish</th><th scope="col">Hands</th><th scope="col">Net</th></tr></thead><tbody>${recent.map(e=>`<tr><th scope="row">${escape(e.name)}<small>${escape(new Date(e.finishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}))}</small></th><td>${ordinal(e.place)} of ${chips(e.entrants)}</td><td>${e.hands}</td><td class="${tone(e.net)}">${signedDollars(e.net)}</td></tr>`).join('')}</tbody></table></div>
 </section>`;
}
