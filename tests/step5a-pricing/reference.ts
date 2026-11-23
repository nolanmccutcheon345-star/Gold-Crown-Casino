/** Independent test oracle: vertical contribution slices, no production imports. */
export interface PublicSeat { id:number; stack:number; streetCommitted:number; totalCommitted:number; folded:boolean; }
export interface PublicPriceInput { actingSeat:number; street:string; bigBlind:number; board:readonly string[]; seats:readonly PublicSeat[]; rake?:{basisPoints:number;cap:number;noFlopNoDrop:boolean}; }
export interface Slice { low:number;high:number;amount:number;contributors:number[];eligible:number[]; }
export function independentSlices(seats:readonly {id:number;amount:number;folded:boolean}[]):{slices:Slice[];refunds:Record<number,number>} {
 const points=[0,...new Set(seats.map(s=>s.amount).filter(x=>x>0))].sort((a,b)=>a-b),slices:Slice[]=[],refunds:Record<number,number>={};
 for(let i=1;i<points.length;i++){
  const participants=seats.filter(s=>s.amount>=points[i]),amount=(points[i]-points[i-1])*participants.length;
  if(participants.length===1){refunds[participants[0].id]=(refunds[participants[0].id]??0)+amount;continue;}
  slices.push({low:points[i-1],high:points[i],amount,contributors:participants.map(s=>s.id),eligible:participants.filter(s=>!s.folded).map(s=>s.id)});
 }
 return{slices,refunds};
}
export function independentCall(input:PublicPriceInput){
 const own=input.seats.find(s=>s.id===input.actingSeat);if(!own||own.folded)throw Error('Missing active caller');
 const highest=Math.max(...input.seats.map(s=>s.streetCommitted),input.street==='preflop'?input.bigBlind:0);
 const callAmount=Math.min(own.stack,Math.max(0,highest-own.streetCommitted));
 const all=input.seats.map(s=>({id:s.id,amount:s.totalCommitted+(s.id===own.id?callAmount:0),folded:s.folded}));
 const {slices,refunds}=independentSlices(all);
 const matched=slices.reduce((n,s)=>n+s.amount,0),eligible=slices.filter(s=>s.eligible.includes(own.id));
 const contestableAfterCall=eligible.reduce((n,s)=>n+s.amount,0),excludedChips=all.reduce((n,s)=>n+s.amount,0)-contestableAfterCall;
 const survivors=input.seats.filter(s=>!s.folded).map(s=>({id:s.id,chips:s.stack-(s.id===own.id?callAmount:0),paid:s.streetCommitted+(s.id===own.id?callAmount:0)}));
 const withChips=survivors.filter(s=>s.chips>0);
 // No prospective opponent call is priced. A remaining wager must already be
 // matched before the hypothetical actor call can imply an automatic runout.
 const runout=input.street==='preflop'&&survivors.length>1&&withChips.length<=1&&withChips.every(s=>survivors.every(other=>other.paid<=s.paid));
 const rakeOn=!!input.rake&&(!input.rake.noFlopNoDrop||input.board.length>=3||runout);
 const estimatedRake=rakeOn?Math.min(input.rake!.cap,Math.floor(matched/10000)*input.rake!.basisPoints+Math.floor((matched%10000)*input.rake!.basisPoints/10000)):0;
 let remainingRake=estimatedRake,eligibleNet=0;
 for(const s of slices){const taken=Math.min(s.amount,remainingRake);remainingRake-=taken;if(s.eligible.includes(own.id))eligibleNet+=s.amount-taken;}
 return{callAmount,contestableAfterCall,excludedChips,estimatedRake,price:callAmount?callAmount/Math.max(1,contestableAfterCall):0,rakeAdjustedPrice:callAmount?callAmount/Math.max(1,eligibleNet):0,slices,refunds,matched,eligibleNet,runout};
}
/** Tie-only settlement oracle for a common royal-flush board. No evaluator used. */
export function independentBoardTie(seats:readonly {id:number;amount:number;folded:boolean}[],button:number,rake:number){
 const {slices,refunds}=independentSlices(seats),pools:{amount:number;eligible:number[]}[]=[];
 for(const s of slices){const last=pools.at(-1);if(last&&last.eligible.join(',')===s.eligible.join(','))last.amount+=s.amount;else pools.push({amount:s.amount,eligible:s.eligible});}
 const payouts:Record<number,number>={};let left=rake;
 for(const p of pools){const taken=Math.min(p.amount,left);left-=taken;p.amount-=taken;const clockwise=[...p.eligible].sort((a,b)=>((a-button+10)%10||10)-((b-button+10)%10||10));
  const share=Math.floor(p.amount/clockwise.length),extra=p.amount%clockwise.length;clockwise.forEach((id,i)=>payouts[id]=(payouts[id]??0)+share+(i<extra?1:0));
 }
 return{pools,payouts,refunds};
}
