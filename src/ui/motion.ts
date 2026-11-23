/** Table animations: a display preference only. It never changes dealt cards, rules, timing of bot decisions or results. */
export const MOTION_KEY='poker-night-ai:table-motion';
/** On unless the player turned it off. The device's reduced-motion setting always wins (see motion.css). */
export function readMotion():boolean {try{return localStorage.getItem(MOTION_KEY)!=='off';}catch{return true;}}
export function saveMotion(on:boolean):void {try{localStorage.setItem(MOTION_KEY,on?'on':'off');}catch{/* keep for this visit only */}}
/** Alternates per hand so the deal animation restarts on reused card elements. */
export const dealClass=(handNumber:number):string=>`deal-${Math.abs(handNumber)%2}`;
/** Browser tab title while Hero has a decision, so a player in another tab sees it is their turn. */
export const turnTitle=(base:string,heroTurn:boolean):string=>heroTurn?`● Your turn · ${base}`:base;
