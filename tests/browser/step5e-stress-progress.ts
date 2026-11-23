/** QA-only invariants: a command acknowledgement cannot substitute for a new hand. */
export function requireNextHand(before:{handId:string;number:number;hands:number;sessionId:string},after:{handId:string;number:number;hands:number;sessionId:string}):void {
 if(after.handId===before.handId||after.number!==before.number+1||after.hands!==before.hands||after.sessionId!==before.sessionId)throw Error('Stress next hand did not advance exactly once in the same session');
}
export function requireCompletedHand(result:{handId:string;hands:number;settlements:number},expected:{handId:string;hands:number},seen:ReadonlySet<string>):void {
 if(result.handId!==expected.handId||result.hands!==expected.hands||result.settlements!==expected.hands||seen.has(result.handId))throw Error('Stress completion is not the expected unique newly settled hand');
}
