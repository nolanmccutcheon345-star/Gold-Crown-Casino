import type {DrawResponseCurves,DrawResponseKind,DrawResponseStreet} from '../contracts';
export const DRAW_RESPONSE_POT_ANCHORS:readonly number[]=Object.freeze([.25,.5,.75,1,1.5,2,3]);
export const DRAW_RESPONSE_KINDS:readonly DrawResponseKind[]=Object.freeze(['gutshot','oesd','flush','combo']);
export const DRAW_RESPONSE_STREETS:readonly DrawResponseStreet[]=Object.freeze(['flop','turn','river']);
/** These are synthetic willingness offsets, never calibrated call percentages. */
export function normalizeDrawResponses(input:DrawResponseCurves):DrawResponseCurves {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid draw response curves.');
 const out:DrawResponseCurves={};
 for(const key of Object.keys(input))if(!DRAW_RESPONSE_KINDS.includes(key as DrawResponseKind))throw new Error('Unknown draw response kind.');
 for(const kind of DRAW_RESPONSE_KINDS){const streets=input[kind];if(streets===undefined)continue;
  if(!streets||typeof streets!=='object'||Array.isArray(streets))throw new Error('Invalid draw response streets.');
  out[kind]={};for(const street of Object.keys(streets))if(!DRAW_RESPONSE_STREETS.includes(street as DrawResponseStreet))throw new Error('Unknown draw response street.');
  for(const street of DRAW_RESPONSE_STREETS){const points=streets[street];if(points===undefined)continue;
   if(!Array.isArray(points)||points.length!==7||points.some(n=>!Number.isFinite(n)||n< -1||n>1))throw new Error('Draw response needs seven values between -1 and 1.');
   out[kind]![street]=[...points];
  }
 }
 return out;
}
export function drawResponseKind(drawClass:string):DrawResponseKind|null {
 if(drawClass==='combo')return 'combo';
 if(drawClass==='nut-flush'||drawClass==='flush')return 'flush';
 if(drawClass==='open-ended'||drawClass==='double-gutshot')return 'oesd';
 return drawClass==='gutshot'?'gutshot':null;
}
export function drawResponseOffset(curves:DrawResponseCurves|undefined,kind:DrawResponseKind|null,street:string,betToPot:number):number {
 if(!curves||!kind||!DRAW_RESPONSE_STREETS.includes(street as DrawResponseStreet))return 0;
 const points=curves[kind]?.[street as DrawResponseStreet];if(!points)return 0;
 if(betToPot<=DRAW_RESPONSE_POT_ANCHORS[0])return points[0];
 for(let i=1;i<7;i++)if(betToPot<=DRAW_RESPONSE_POT_ANCHORS[i]){const t=(betToPot-DRAW_RESPONSE_POT_ANCHORS[i-1])/(DRAW_RESPONSE_POT_ANCHORS[i]-DRAW_RESPONSE_POT_ANCHORS[i-1]);return points[i-1]+t*(points[i]-points[i-1]);}
 return points[6];
}
export function adjustDrawContinuation(chance:number,offset:number):number {
 if(offset===0)return chance;
 const bounded=Math.max(.000001,Math.min(.999999,chance));
 return 1/(1+Math.exp(-(Math.log(bounded/(1-bounded))+4*offset)));
}
