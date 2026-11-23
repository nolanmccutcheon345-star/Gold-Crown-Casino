import type {BotObservation} from '../../contracts';

/** Read-only hypothetical call exposure, never an authoritative pot or payout.
 * A capped caller cannot win unmatched excess or contribution tiers above their
 * own final commitment. Folded players' matching contributions remain dead money.
 * The estimate assumes no further action; future side-pot equity is not solver EV.
 */
export interface ContestablePricing {
 callAmount:number;contestableAfterCall:number;excludedChips:number;price:number;
 rakeAdjustedPrice:number;estimatedRake:number;
}
export function contestablePricing(o:BotObservation):ContestablePricing {
 const callAmount=o.legal.callAmount,own=o.seats.find(s=>s.id===o.actingSeat);
 if(!own||!Number.isSafeInteger(callAmount)||callAmount<0)throw new Error('Invalid call exposure.');
 const contributions=o.seats.map(s=>({id:s.id,amount:s.totalCommitted+(s.id===own.id?callAmount:0)}));
 if(contributions.some(s=>!Number.isSafeInteger(s.amount)||s.amount<0))throw new Error('Invalid contribution exposure.');
 const ordered=[...contributions].sort((a,b)=>b.amount-a.amount);
 const unmatched=ordered.length>1?Math.max(0,ordered[0].amount-ordered[1].amount):0;
 const adjusted=contributions.map(s=>({...s,amount:s.amount-(s.id===ordered[0]?.id?unmatched:0)}));
 const ownCap=adjusted.find(s=>s.id===own.id)!.amount;
 const totalAfterRefund=adjusted.reduce((n,s)=>n+s.amount,0);
 const contestableAfterCall=adjusted.reduce((n,s)=>n+Math.min(s.amount,ownCap),0);
 const excludedChips=contributions.reduce((n,s)=>n+s.amount,0)-contestableAfterCall;
 // Practice rake is charged once on all matched chips, from the main pot first.
 // An all-in call can make a flop certain before it is publicly dealt. Only
 // count this when no player can still change the matched contributions: zero
 // players retain chips, or the sole remaining player has matched every live
 // opponent. In particular, never assume an outstanding opponent call happens.
 const afterCall=o.seats.filter(s=>!s.folded).map(s=>({
  stack:s.stack-(s.id===own.id?callAmount:0),
  streetCommitted:s.streetCommitted+(s.id===own.id?callAmount:0),
 }));
 const ableToAct=afterCall.filter(s=>s.stack>0);
 const knownRunout=o.street==='preflop'&&afterCall.length>=2&&
  (ableToAct.length===0||(ableToAct.length===1&&afterCall.every(s=>s.streetCommitted<=ableToAct[0].streetCommitted)));
 const rakeApplies=o.rake&&(!o.rake.noFlopNoDrop||o.board.length>=3||knownRunout);
 const estimatedRake=rakeApplies?Math.min(o.rake!.cap,Number(BigInt(totalAfterRefund)*BigInt(o.rake!.basisPoints)/10000n)):0;
 const price=callAmount===0?0:callAmount/Math.max(1,contestableAfterCall);
 const rakeAdjustedPrice=callAmount===0?0:callAmount/Math.max(1,contestableAfterCall-Math.min(contestableAfterCall,estimatedRake));
 return {callAmount,contestableAfterCall,excludedChips,price,rakeAdjustedPrice,estimatedRake};
}
