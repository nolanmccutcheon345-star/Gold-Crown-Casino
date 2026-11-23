import type { DrawResponseCurves } from '../contracts';

export const DRAW_PRICE_PERCENTAGES=[25,50,75,100,150,200,300] as const;
const KINDS=['gutshot','oesd','flush','combo'] as const;
const STREETS=['flop','turn','river'] as const;
const LABELS={gutshot:'Gutshot',oesd:'Open-ended straight draw',flush:'Flush draw',combo:'Combo draw'};

/** Host-only synthetic policy editor; never render this in a live-table seat. */
export function drawResponseSetup(prefix:string,curves:DrawResponseCurves|undefined):string {
  return `<section class="draw-curves"><h4>Draw response by street and price</h4><p>Each control is a synthetic inclination adjustment: −1 folds more, 0 keeps the base policy, +1 continues more. This is not a promised calling frequency. Price = outstanding street wager ÷ (current pot minus that wager), with a one-big-blind denominator floor. Legal actions, hand strength and pot eligibility still apply.</p><p>River controls apply only to a missed earlier draw. River draws have zero outs and no future-card equity.</p>${KINDS.map(kind=>STREETS.map(street=>`<details id="${prefix}-draw-${kind}-${street}-details"><summary>${LABELS[kind]} · ${street}</summary><div class="draw-curve-fields">${DRAW_PRICE_PERCENTAGES.map((percent,index)=>{const id=`${prefix}-draw-${kind}-${street}-${index}`;return `<label for="${id}">${percent}% pot<input id="${id}" name="${id}" type="number" inputmode="decimal" min="-1" max="1" step="0.05" value="${curves?.[kind]?.[street]?.[index]??0}" aria-label="${LABELS[kind]} ${street} facing ${percent}% pot response"></label>`;}).join('')}</div></details>`).join('')).join('')}</section>`;
}

export function readDrawResponses(data:FormData,prefix:string,prior?:DrawResponseCurves):DrawResponseCurves|undefined {
  const result:DrawResponseCurves=structuredClone(prior??{});
  let present=prior!==undefined;
  for(const kind of KINDS)for(const street of STREETS){
    const ids=DRAW_PRICE_PERCENTAGES.map((_,index)=>`${prefix}-draw-${kind}-${street}-${index}`);
    if(!ids.some(id=>data.has(id)))continue;
    const values=ids.map((id,index)=>{
      if(!data.has(id))return prior?.[kind]?.[street]?.[index]??0;
      const raw=String(data.get(id)).trim(),value=Number(raw);
      if(!raw||!Number.isFinite(value)||value < -1||value>1)throw new Error('Draw response adjustments must be between −1 and +1.');
      return value;
    });
    if(values.some(value=>value!==0)||prior?.[kind]?.[street]){result[kind]={...result[kind],[street]:values};present=true;}
  }
  return present?result:undefined;
}
