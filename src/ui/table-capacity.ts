export interface TableSlot { id: number; occupied: boolean; hero: boolean; }
/** Seat IDs are physical positions, independent of occupied-player count. */
export function tableSeatSlots(capacity: number, occupiedSeatIds: readonly number[]): TableSlot[] {
  if(!Number.isInteger(capacity)||capacity<2||capacity>10)throw new Error('Table capacity must be 2–10.');
  if(occupiedSeatIds.length<2||occupiedSeatIds.length>capacity||new Set(occupiedSeatIds).size!==occupiedSeatIds.length||!occupiedSeatIds.includes(0)||occupiedSeatIds.some(id=>!Number.isInteger(id)||id<0||id>=capacity))throw new Error('Choose occupied seats within capacity, including Hero and at least one opponent.');
  const occupied=new Set(occupiedSeatIds);
  return Array.from({length:capacity},(_,id)=>({id,occupied:occupied.has(id),hero:id===0}));
}
