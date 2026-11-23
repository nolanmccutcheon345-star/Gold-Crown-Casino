/** Patch 53: small line charts for the Stats page. One series per chart, one axis, values from the saved ledger. */
import type {AppData} from '../session/types';

export interface ChartPoint {y:number;label:string}
const MAX_POINTS=240;

/** Keeps the first and last points and, between them, evenly spaced points (the running total is already smooth). */
export function downsample(points:readonly ChartPoint[],limit=MAX_POINTS):ChartPoint[] {
 if(points.length<=limit)return [...points];
 const out:ChartPoint[]=[];
 for(let i=0;i<limit;i++)out.push(points[Math.round(i*(points.length-1)/(limit-1))]);
 return out;
}
/** Running total of completed cash-hand results, in ledger order. */
export function resultSeries(data:AppData,format:(cents:number)=>string):ChartPoint[] {
 let total=0,hand=0;const points:ChartPoint[]=[{y:0,label:'Start · $0'}];
 for(const event of [...data.ledger].sort((a,b)=>a.index-b.index)){
  if(event.kind!=='hand-net')continue;
  total+=event.pokerNet;hand++;
  points.push({y:total,label:`Hand ${hand} · ${total>0?'+':total<0?'−':''}${format(Math.abs(total))} total`});
 }
 return points;
}
/** Bankroll after each money event, worked back from the current balance so the line always ends at today's bankroll. */
export function bankrollSeries(data:AppData,format:(cents:number)=>string):ChartPoint[] {
 const events=[...data.ledger].sort((a,b)=>a.index-b.index).filter(event=>event.walletDelta!==0);
 let balance=data.wallet;const reversed:ChartPoint[]=[];
 const day=(at:string)=>{const d=new Date(at);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric'});};
 for(let i=events.length-1;i>=0;i--){
  const event=events[i];
  reversed.push({y:balance,label:`${day(event.at)} · ${format(balance)}`});
  balance-=event.walletDelta;
 }
 reversed.push({y:balance,label:`Start · ${format(balance)}`});
 const points=reversed.reverse();
 // Before the first deposit the bankroll was simply empty; starting the line at $0 would read as a crash.
 while(points.length>1&&points[0].y===0)points.shift();
 return points;
}

/**
 * Line chart markup. The plot is a stretched SVG (non-scaling strokes); axis values, the crosshair and the tooltip are
 * HTML so text stays readable at phone width. Hover and touch are wired in app.ts from data-points.
 */
export function lineChartMarkup(id:string,title:string,raw:readonly ChartPoint[],format:(cents:number)=>string,zeroLine:boolean):string {
 const points=downsample(raw);
 if(points.length<2)return '';
 const ys=points.map(p=>p.y);
 let lo=Math.min(...ys,zeroLine?0:Infinity),hi=Math.max(...ys,zeroLine?0:-Infinity);
 if(lo===hi){lo-=100;hi+=100;}
 const pad=(hi-lo)*.08;lo-=pad;hi+=pad;
 const X=(i:number)=>i/(points.length-1)*600,Y=(v:number)=>200-(v-lo)/(hi-lo)*200;
 const path=points.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
 const ticks=[hi-pad,(hi+lo)/2,lo+pad];
 const last=points[points.length-1];
 const rows=points;
 return `<figure class="chart" id="${id}" data-chart="${id}"><figcaption><span>${title}</span><b>${escapeText(last.label)}</b></figcaption>
<div class="chart-frame"><div class="chart-axis">${ticks.map(v=>`<span>${escapeText(signedMoney(v,format,zeroLine))}</span>`).join('')}</div>
<div class="chart-plot" tabindex="0" role="img" aria-label="${escapeText(`${title}. ${points[0].label} to ${last.label}.`)}" data-points="${escapeText(JSON.stringify(points.map(p=>[+(100*Y(p.y)/200).toFixed(2),p.label])))}">
<svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">${ticks.map(v=>`<line class="chart-grid" x1="0" x2="600" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`).join('')}${zeroLine?`<line class="chart-zero" x1="0" x2="600" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`:''}<path class="chart-line" d="${path}"/></svg>
<i class="chart-cross" hidden></i><i class="chart-dot" hidden></i><span class="chart-tip" hidden></span></div></div>
<details class="chart-table"><summary>Show as a table</summary><table><thead><tr><th scope="col">Point and value</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${escapeText(p.label)}</td></tr>`).join('')}</tbody></table></details></figure>`;
}
const escapeText=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const signedMoney=(cents:number,format:(c:number)=>string,signed:boolean)=>{const rounded=Math.round(cents/100)*100;return signed&&rounded!==0?`${rounded>0?'+':'−'}${format(Math.abs(rounded))}`:format(Math.abs(rounded));};

/** Crosshair and tooltip for every chart under `root`. */
export function bindCharts(root:ParentNode,signal:AbortSignal):void {
 root.querySelectorAll<HTMLElement>('.chart-plot').forEach(plot=>{
  let data:[number,string][]=[];try{data=JSON.parse(plot.dataset.points??'[]');}catch{return;}
  if(data.length<2)return;
  const cross=plot.querySelector<HTMLElement>('.chart-cross')!,dot=plot.querySelector<HTMLElement>('.chart-dot')!,tip=plot.querySelector<HTMLElement>('.chart-tip')!;
  const show=(index:number)=>{
   const i=Math.max(0,Math.min(data.length-1,index)),x=100*i/(data.length-1),[y,label]=data[i];
   cross.hidden=dot.hidden=tip.hidden=false;
   cross.style.left=dot.style.left=`${x}%`;dot.style.top=`${y}%`;
   tip.textContent=label;tip.style.left=`${Math.min(78,Math.max(22,x))}%`;tip.style.top=y>45?'4px':'auto';tip.style.bottom=y>45?'auto':'4px';
   plot.dataset.index=String(i);
  };
  const hide=()=>{cross.hidden=dot.hidden=tip.hidden=true;delete plot.dataset.index;};
  const at=(event:PointerEvent)=>{const box=plot.getBoundingClientRect();show(Math.round((event.clientX-box.left)/box.width*(data.length-1)));};
  plot.addEventListener('pointermove',at,{signal});plot.addEventListener('pointerdown',at,{signal});
  plot.addEventListener('pointerleave',hide,{signal});plot.addEventListener('blur',hide,{signal});
  plot.addEventListener('keydown',event=>{
   const now=plot.dataset.index===undefined?data.length-1:Number(plot.dataset.index);
   const step=event.shiftKey?Math.ceil(data.length/10):1;
   if(event.key==='ArrowLeft'){event.preventDefault();show(now-step);}else if(event.key==='ArrowRight'){event.preventDefault();show(now+step);}
   else if(event.key==='Home'){event.preventDefault();show(0);}else if(event.key==='End'){event.preventDefault();show(data.length-1);}else if(event.key==='Escape')hide();
  },{signal});
 });
}
