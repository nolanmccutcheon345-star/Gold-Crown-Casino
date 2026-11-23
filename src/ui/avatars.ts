/**
 * Drawn avatars (patch 55, redrawn in patch 58). A small original face made from a player's table name: the same name
 * always gets the same face. Patch 58 adds ears, brows, a nose, more hair, hats and clothing, and a mood so the face
 * can react to a hand. Decorative only.
 */
const SKIN=['#f4d3b3','#e8b994','#cf9a6e','#a8714a','#7a5134','#5a3a25'];
const HAIR=['#2b1d16','#5a3a22','#9c6633','#d9b36c','#9a9a9a','#141414','#7a2f22','#e6e1d6'];
const SHIRT=['var(--avatar,#69c8a8)','#2f4a6b','#6b2f3a','#3d5a3a','#4a4a52','#8a6a2a'];

export type Mood='neutral'|'happy'|'sad'|'surprised'|'smirk'|'sigh'|'content'|'grumpy';

/** FNV-1a: a small, stable hash so faces do not change between visits or devices. */
export function nameHash(name:string):number {
 let h=0x811c9dc5;
 for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,0x01000193);}
 return h>>>0;
}
export interface Face {skin:number;hair:number;hairColor:number;extra:number;hat:number;outfit:number;shirt:number;brows:number}
export const HAIR_STYLES=8,EXTRAS=6,HATS=4,OUTFITS=4;
export function faceFor(name:string):Face {
 const h=nameHash(name.trim().toLowerCase()),g=nameHash(`${name.trim().toLowerCase()}#2`);
 return {skin:h%SKIN.length,hair:(h>>>3)%HAIR_STYLES,hairColor:(h>>>7)%HAIR.length,extra:(h>>>11)%EXTRAS,hat:g%7<3?g%HATS:0,outfit:(g>>>4)%OUTFITS,shirt:(g>>>8)%SHIRT.length,brows:(g>>>12)%3};
}

const shade=(hex:string,amount:number)=>{const n=parseInt(hex.slice(1),16),c=(v:number)=>Math.max(0,Math.min(255,Math.round(v*(1+amount))));return `#${[c(n>>16),c((n>>8)&255),c(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;};

/** SVG markup, 40×40. */
/** Patch 61: the parts a player can choose for their own face, and how many options each has. */
export const FACE_PARTS={skin:SKIN.length,hair:HAIR_STYLES,hairColor:HAIR.length,hat:HATS,outfit:OUTFITS,shirt:SHIRT.length,extra:EXTRAS,brows:3} as const;
export type FacePart=keyof typeof FACE_PARTS;
/** A saved face, field by field; anything missing or out of range falls back to the name's own face. */
export function normalizeFace(raw:unknown):Partial<Face>|null {
 if(!raw||typeof raw!=='object')return null;
 const out:Partial<Face>={};
 for(const [part,count] of Object.entries(FACE_PARTS) as [FacePart,number][]){const v=(raw as Record<string,unknown>)[part];if(Number.isInteger(v)&&(v as number)>=0&&(v as number)<count)out[part]=v as number;}
 return Object.keys(out).length?out:null;
}
export function avatarSvg(name:string,mood:Mood='neutral',custom:Partial<Face>|null=null):string {
 const f={...faceFor(name),...(custom??{})},skin=SKIN[f.skin],dark=shade(skin,-.16),hair=HAIR[f.hairColor],shirt=SHIRT[f.shirt];
 const back=[
  '', // short styles have nothing behind the head
  `<path d="M10.4 19c-1.6 6.4-.6 12 1.6 15h16c2.2-3 3.2-8.6 1.6-15z" fill="${hair}"/>`, // long
  '',
  '',
  '',
  `<path d="M11 18c-1 4-1 8 0 10h18c1-2 1-6 0-10z" fill="${hair}"/>`, // bob
  '',
  `<circle cx="20" cy="7.4" r="3.6" fill="${hair}"/>`, // top bun
 ][f.hair];
 const front=[
  `<path d="M11.6 17c0-6.2 3.8-9.4 8.4-9.4s8.4 3.2 8.4 9.4c-1.8-3-4.8-4.4-8.4-4.4s-6.6 1.4-8.4 4.4z" fill="${hair}"/>`,
  `<path d="M11.2 18.6c0-7 3.8-10.6 8.8-10.6s8.8 3.6 8.8 10.6c-2-1.8-3.4-3.8-4-6-1.6 1.6-4.4 2.4-7.6 2.4-2 0-3.6-.4-4.8-1-.4 2-.8 3.4-1.2 4.6z" fill="${hair}"/>`,
  `<path d="M12 16.4c.6-5 4-7.6 8-7.6s7.4 2.6 8 7.6c-2.4-1.4-5-2-8-2s-5.6.6-8 2z" fill="${hair}" opacity=".9"/>`,
  `${[[13,12],[16,9.6],[20,8.6],[24,9.6],[27,12],[12.4,15.4],[27.6,15.4]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.1" fill="${hair}"/>`).join('')}`,
  `<path d="M12.2 15.6c1-4.8 4.4-7 7.8-7 2.4 0 4.6 1 6.2 3l2 3.6c-3.2-1.6-6.8-2.4-10.4-2.2-2 .2-3.8 1-5.6 2.6z" fill="${hair}"/>`,
  `<path d="M11.4 19c-.2-6.6 3.8-10.4 8.6-10.4s8.8 3.8 8.6 10.4c-.6-2.6-1.8-4.6-3.4-5.8-2.6 1.4-6.4 1.6-10.4.2-1.6 1.2-2.8 3.2-3.4 5.6z" fill="${hair}"/>`,
  '', // bald
  `<path d="M12 16.4c.6-5 4-7.6 8-7.6s7.4 2.6 8 7.6c-2.4-1.4-5-2-8-2s-5.6.6-8 2z" fill="${hair}"/>`,
 ][f.hair];
 const outfit=[
  `<path d="M6 40c.6-7.2 6-11.4 14-11.4S33.4 32.8 34 40z" fill="${shirt}"/><path d="M16.6 29.2 20 33l3.4-3.8" fill="none" stroke="#ffffff55" stroke-width="1"/>`,
  `<path d="M6 40c.6-7.2 6-11.4 14-11.4S33.4 32.8 34 40z" fill="${shirt}"/><path d="M14 30c1.6 3 3.6 4.6 6 4.6s4.4-1.6 6-4.6" fill="none" stroke="#00000040" stroke-width="2.4"/>`,
  `<path d="M6 40c.6-7.2 6-11.4 14-11.4S33.4 32.8 34 40z" fill="#2a2f35"/><path d="M17 29l3 11 3-11z" fill="${shirt}"/><path d="M17 29l-2.6 3.4L18 40M23 29l2.6 3.4L22 40" fill="none" stroke="#ffffff22" stroke-width=".8"/>`,
  `<path d="M6 40c.6-7.2 6-11.4 14-11.4S33.4 32.8 34 40z" fill="${shirt}"/><path d="M12 31c2 6 5 9 8 9s6-3 8-9" fill="none" stroke="#ffffff30" stroke-width="1"/><circle cx="20" cy="36" r=".9" fill="#ffffff55"/>`,
 ][f.outfit];
 const brows=[
  '<path d="M14.6 17.4c1.2-.8 2.4-.8 3.4-.2M22 17.2c1-.6 2.2-.6 3.4.2" fill="none" stroke="#2a1d16" stroke-width="1" stroke-linecap="round"/>',
  '<path d="M14.4 17h3.6M22 17h3.6" fill="none" stroke="#2a1d16" stroke-width="1.2" stroke-linecap="round"/>',
  '<path d="M14.6 17.6l3.4-.8M22 16.8l3.4.8" fill="none" stroke="#2a1d16" stroke-width="1.1" stroke-linecap="round"/>',
 ][f.brows];
 const sadBrows='<path d="M14.6 16.8l3.4 1M22 17.8l3.4-1" fill="none" stroke="#2a1d16" stroke-width="1.1" stroke-linecap="round"/>';
 const upBrows='<path d="M14.4 16c1.2-1.2 2.6-1.2 3.6-.4M22 15.6c1-.8 2.4-.8 3.6.4" fill="none" stroke="#2a1d16" stroke-width="1.1" stroke-linecap="round"/>';
 const grumpyBrows='<path d="M14.6 16.4l3.6 1.4M21.8 17.8l3.6-1.4" fill="none" stroke="#2a1d16" stroke-width="1.3" stroke-linecap="round"/>';
 const smirkBrows='<path d="M14.6 17.2h3.4M22 16.2c1-.8 2.4-.6 3.4.4" fill="none" stroke="#2a1d16" stroke-width="1.1" stroke-linecap="round"/>';
 const mouth=mood==='content'?'<path d="M17.2 23.8c1.5 1.2 4.1 1.2 5.6 0" fill="none" stroke="#2a1d16" stroke-width=".95" stroke-linecap="round"/>'
  :mood==='grumpy'?'<path d="M17.4 24.8c1.4-.7 3.8-.7 5.2 0" fill="none" stroke="#2a1d16" stroke-width=".95" stroke-linecap="round"/>'
  :mood==='happy'?'<path d="M16.6 23.6c1.6 2.2 5.2 2.2 6.8 0" fill="#7a2b2b" stroke="#2a1d16" stroke-width=".7" stroke-linecap="round"/>'
  :mood==='sad'?'<path d="M17 25c1.6-1.4 4.4-1.4 6 0" fill="none" stroke="#2a1d16" stroke-width=".9" stroke-linecap="round"/>'
  :mood==='surprised'?'<ellipse cx="20" cy="24.6" rx="1.5" ry="1.9" fill="#5a2424" stroke="#2a1d16" stroke-width=".6"/>'
  :mood==='smirk'?'<path d="M17.6 24.4c1.6.4 3.4 0 5-1.4" fill="none" stroke="#2a1d16" stroke-width=".95" stroke-linecap="round"/>'
  :mood==='sigh'?'<path d="M17.6 24.6h4.8" fill="none" stroke="#2a1d16" stroke-width=".9" stroke-linecap="round"/>'
  :'<path d="M17.4 24c1.4.9 3.8.9 5.2 0" fill="none" stroke="#2a1d16" stroke-width=".9" stroke-linecap="round"/>';
 const eyes=mood==='happy'?'<path d="M15.2 19.8c.6-.8 1.8-.8 2.4 0M22.4 19.8c.6-.8 1.8-.8 2.4 0" fill="none" stroke="#1d2427" stroke-width="1" stroke-linecap="round"/>'
  :mood==='surprised'?'<circle cx="16.4" cy="19.4" r="1.45" fill="#fff"/><circle cx="23.6" cy="19.4" r="1.45" fill="#fff"/><circle cx="16.4" cy="19.5" r=".85" fill="#1d2427"/><circle cx="23.6" cy="19.5" r=".85" fill="#1d2427"/>'
  :mood==='sigh'?'<path d="M15.2 19.8h2.4M22.4 19.8h2.4" fill="none" stroke="#1d2427" stroke-width="1" stroke-linecap="round"/>'
  :'<circle cx="16.4" cy="19.6" r="1.05" fill="#1d2427"/><circle cx="23.6" cy="19.6" r="1.05" fill="#1d2427"/>';
 const extras=[
  '',
  '<g fill="none" stroke="#1d2427" stroke-width="1"><circle cx="16.4" cy="19.6" r="2.4"/><circle cx="23.6" cy="19.6" r="2.4"/><path d="M18.8 19.6h2.4"/></g>',
  '<g fill="#1d2427"><rect x="13.4" y="18" width="5.6" height="3.4" rx="1.2"/><rect x="21" y="18" width="5.6" height="3.4" rx="1.2"/><rect x="19" y="18.8" width="2" height=".9"/></g>',
  `<path d="M13 23.2c.4 4.8 3.4 7.2 7 7.2s6.6-2.4 7-7.2c-1.8 1.4-4.2 2-7 2s-5.2-.6-7-2z" fill="${hair}"/>`, // beard
  `<path d="M16 23.4c1.2-.8 2.6-1 4-.2 1.4-.8 2.8-.6 4 .2-1.2.4-2.6.4-4 0-1.4.4-2.8.4-4 0z" fill="${hair}"/>`, // moustache
  '<circle cx="14.6" cy="22.6" r="1.2" fill="#e88b8b" opacity=".45"/><circle cx="25.4" cy="22.6" r="1.2" fill="#e88b8b" opacity=".45"/>', // blush
 ][f.extra];
 const hats=[
  '',
  `<path d="M11.6 15.4c0-5.6 3.8-8.8 8.4-8.8s8.4 3.2 8.4 8.8z" fill="${SHIRT[(f.shirt+2)%SHIRT.length]}"/><rect x="11" y="14.4" width="18" height="2.4" rx="1.2" fill="#00000035"/><circle cx="20" cy="6.4" r="1.6" fill="#ffffff70"/>`, // beanie
  `<path d="M7.4 15.4c2-1.2 5.6-1.8 12.6-1.8s10.6.6 12.6 1.8c-1 1.2-5.2 2-12.6 2s-11.6-.8-12.6-2z" fill="#6b4a2a"/><path d="M13.2 14.4c.2-4.6 2.6-7 6.8-7s6.6 2.4 6.8 7c-2 .6-4.2.8-6.8.8s-4.8-.2-6.8-.8z" fill="#7d5733"/><path d="M13.4 13.2h13.2" stroke="#3a2614" stroke-width="1"/>`, // wide-brim hat
  `<path d="M11.8 15c.4-4.6 3.6-7.2 8.2-7.2s7.8 2.6 8.2 7.2z" fill="${SHIRT[(f.shirt+3)%SHIRT.length]}"/><path d="M19 14.8h13c.6 0 .6 1.6 0 1.6H19z" fill="${SHIRT[(f.shirt+3)%SHIRT.length]}" opacity=".85"/>`, // cap
 ][f.hat];
 const hasHat=f.hat>0;
 const idle=nameHash(`${name}#idle`);
 return `<svg class="face mood-${mood}" viewBox="0 0 40 40" aria-hidden="true" focusable="false" style="--blink-delay:${(idle%4000)/1000}s;--tilt-delay:${((idle>>>12)%7000)/1000}s">${hasHat?'':back}${outfit}<rect x="17" y="24.4" width="6" height="5.6" rx="2" fill="${dark}"/><g class="head"><ellipse cx="11.4" cy="20.4" rx="1.6" ry="2.2" fill="${dark}"/><ellipse cx="28.6" cy="20.4" rx="1.6" ry="2.2" fill="${dark}"/><ellipse cx="20" cy="19" rx="8.6" ry="9.4" fill="${skin}"/>${hasHat?'':front}${mood==='sad'||mood==='sigh'?sadBrows:mood==='surprised'?upBrows:mood==='smirk'?smirkBrows:mood==='grumpy'?grumpyBrows:brows}<g class="eyes">${eyes}</g><path d="M20 20.6c-.4 1.4-.8 2.2-1 2.6.6.3 1.4.3 2 0" fill="none" stroke="${dark}" stroke-width=".8" stroke-linecap="round"/>${mouth}${extras}${hats}</g></svg>`;
}

/** How a seat's face looks after a hand: smiling after a win, glum after losing ten big blinds or more. */
export function moodFor(seat:{stack:number;startingStack:number}|undefined,street:string,bigBlind:number):Mood {
 if(!seat||street!=='complete'||bigBlind<=0)return 'neutral';
 const net=(seat.stack-seat.startingStack)/bigBlind;
 return net>0?'happy':net<=-10?'sad':'neutral';
}

/**
 * Patch 59: how a face looks during a hand, from the latest public action only (never cards). The player who just
 * raised smirks; one who just folded sighs; after a big bet (all-in, or a raise to at least half the pot including it)
 * the other players still in look surprised. Hero's face stays neutral until the hand is settled.
 */
export function liveMood(view:{street:string;pot:number;profile:{bigBlind:number};events:readonly {type:string;seatId?:number;action?:{type:string;to?:number}}[];seats:readonly {id:number;folded:boolean;allIn:boolean;stack:number;startingStack:number}[]}|null|undefined,seatId:number,heroId=0):Mood {
 if(!view)return 'neutral';
 const seat=view.seats.find(item=>item.id===seatId);
 if(view.street==='complete')return moodFor(seat,view.street,view.profile.bigBlind);
 if(!seat||seatId===heroId)return 'neutral';
 let last:(typeof view.events)[number]|undefined;
 for(let i=view.events.length-1;i>=0;i--)if(view.events[i].type==='action'){last=view.events[i];break;}
 if(!last?.action||last.seatId===undefined)return 'neutral';
 if(last.seatId===seatId)return last.action.type==='raise'?'smirk':last.action.type==='fold'?'sigh':'neutral';
 const actor=view.seats.find(item=>item.id===last!.seatId);
 const big=last.action.type==='raise'&&(!!actor?.allIn||(last.action.to??0)*2>=view.pot);
 return big&&!seat.folded?'surprised':'neutral';
}

/**
 * Patch 61: a player's face between reactions, from their public session result only: relaxed once they are 30+ big
 * blinds up on the session, grumpy once 30+ down. (Never from a bot's internal mood or tilt.)
 */
export function sessionMoodFace(stack:number,baseline:number|undefined,bigBlind:number):Mood {
 if(baseline===undefined||bigBlind<=0)return 'neutral';
 const net=(stack-baseline)/bigBlind;
 return net>=30?'content':net<=-30?'grumpy':'neutral';
}
