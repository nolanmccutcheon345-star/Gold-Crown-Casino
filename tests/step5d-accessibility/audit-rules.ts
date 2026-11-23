/** Independent, deliberately bounded structural audit. This is not an
 * implementation of the accessibility-name algorithm or a WCAG certification. */
export interface ReferenceFact { element:string; ids:string[]; labelledBy:string[]; describedBy:string[] }
export function referenceProblems(facts:ReferenceFact[]):string[] {
 const counts=new Map<string,number>();
 for(const fact of facts)for(const id of fact.ids)counts.set(id,(counts.get(id)??0)+1);
 const problems=[...counts].filter(([,count])=>count>1).map(([id])=>`Duplicate ID: ${id}`);
 for(const fact of facts)for(const [kind,ids] of [['labelledby',fact.labelledBy],['describedby',fact.describedBy]] as const){
  for(const id of ids)if(!counts.has(id))problems.push(`${fact.element}: aria-${kind} target missing: ${id}`);
 }
 return problems;
}
export type RGB=readonly [number,number,number];
function luminance(rgb:RGB):number {
 const values=rgb.map(component=>{const c=component/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});
 return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
}
export function contrastRatio(foreground:RGB,background:RGB):number {
 const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
/** No rounding at the boundary. 18pt=24CSSpx, 14pt bold=18.666...CSSpx. */
export function contrastThreshold(fontSize:number,fontWeight:number):number {return fontSize>=24||(fontSize>=56/3&&fontWeight>=700)?3:4.5;}
