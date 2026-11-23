/** QA reference from the Host's explicit Unknown/Random choices, never resolved bot profiles. */
export function expectedPublicMix(occupied:number[]):{selection:'unknown'|'random';count:number}[]{
 if(occupied.length<2||new Set(occupied).size!==occupied.length||!occupied.includes(0)||occupied.some(id=>![0,1,2].includes(id)))throw Error('Unexpected occupied configuration fixture seats');
 const selected={1:'unknown',2:'random'} as const,counts=new Map<'unknown'|'random',number>();
 for(const id of occupied)if(id!==0){const selection=selected[id as 1|2];counts.set(selection,(counts.get(selection)??0)+1);}
 return [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([selection,count])=>({selection,count}));
}
