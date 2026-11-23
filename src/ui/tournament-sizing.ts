/** Raise-size shortcuts for the tournament table. Presentation only: every amount is a
    suggestion clamped to the engine's own legal range, and the engine still validates the action. */
import type {HeroViewModel} from '../contracts';

export interface TournamentSize {id:string;label:string;to:number;}

/** Smallest chip a live event would have in play at this level: 25s until the 100/200 level. */
export const sizingUnit=(bigBlind:number):number=>bigBlind>=200?100:25;

/** Legal raise bounds as the table uses them, or null when Hero cannot raise at all. */
export function raiseBounds(view:HeroViewModel):{min:number;max:number}|null {
 const min=view.legal.shortAllInTo??view.legal.minRaiseTo,max=view.legal.maxRaiseTo??view.legal.shortAllInTo;
 return min===null||max===null||(!view.legal.canRaise&&view.legal.shortAllInTo===null)?null:{min,max};
}

/** Shortcuts strictly between the minimum raise and all-in (those two have their own buttons).
    Unopened preflop: 2, 2.5 and 3 big blinds. Facing a preflop raise: 2.5x, 3x and 4x that raise.
    Postflop with no bet: a third, half, three-quarters and the whole pot. Facing a postflop bet:
    2.5x, 3x and a pot-sized raise. */
export function tournamentSizes(view:HeroViewModel):TournamentSize[] {
 const bounds=raiseBounds(view),hero=view.seats.find(seat=>seat.id===0);
 if(!bounds||!hero||view.actor!==0||view.street==='complete'||view.legal.shortAllInTo!==null&&!view.legal.canRaise)return [];
 const bigBlind=view.profile.bigBlind,unit=sizingUnit(bigBlind),bet=Math.max(0,...view.seats.map(seat=>seat.streetCommitted)),call=view.legal.callAmount;
 const pot=(fraction:number)=>hero.streetCommitted+call+(view.pot+call)*fraction;
 const raw:{id:string;label:string;to:number}[]=view.street==='preflop'
  ?bet<=bigBlind?[2,2.5,3].map(n=>({id:`bb-${n}`,label:`${n} BB`,to:bigBlind*n})):[2.5,3,4].map(n=>({id:`x-${n}`,label:`${n}×`,to:bet*n}))
  :bet===0?[[1/3,'⅓ pot','pot-33'],[1/2,'½ pot','pot-50'],[3/4,'¾ pot','pot-75'],[1,'Pot','pot-100']].map(([n,label,id])=>({id:id as string,label:label as string,to:pot(n as number)}))
  :[...[2.5,3].map(n=>({id:`x-${n}`,label:`${n}×`,to:bet*n})),{id:'pot-100',label:'Pot',to:pot(1)}];
 const seen=new Set<number>();
 return raw.map(option=>({...option,to:Math.round(option.to/unit)*unit})).filter(option=>option.to>bounds.min&&option.to<bounds.max&&!seen.has(option.to)&&!!seen.add(option.to));
}

/** One step up or down from the current draft: a big blind at a time, kept inside the legal range. */
export function stepRaise(view:HeroViewModel,draft:string,direction:1|-1):number|null {
 const bounds=raiseBounds(view);if(!bounds)return null;
 const current=/^\d+$/.test(draft)?Number(draft):bounds.min,step=view.profile.bigBlind;
 return Math.min(bounds.max,Math.max(bounds.min,current+direction*step));
}
