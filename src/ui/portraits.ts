/** Patch 63: illustrated portrait avatars (Patch 84: 60 more, 106 in all). Display only: nothing here reaches the engine or the bots.
 * 46 portraits (public/avatars, 256 px, with 128 px copies in avatars/s for seats). Each regular has
 * a portrait chosen for their character; everyone else gets one from their name, matching the name
 * where it is clearly a woman's or a man's. Within one table no two players share a portrait. */
import {nameHash,type Mood} from './avatars';

export const PORTRAIT_COUNT=106;
/** Portraits of women; the rest are men. */
const WOMEN=new Set([1,5,7,11,13,17,19,23,25,29,31,35,37,42,44,
 47,50,53,55,57,59,63,65,68,71,75,76,80,82,85,87,89,92,95,97,101,105]);
/** Regulars, by display name, and the portrait chosen for each. */
const REGULAR_PORTRAITS:Record<string,number>={
 'Big Earl':14,Nina:13,Marco:0,Dot:1,Vince:16,Priya:7,Hank:10,Tess:11,Rocco:24,Lena:23,Gus:33,Mei:82,Duke:45,Sal:4,Ruth:19,Theo:6,Ivy:25,Frank:39,
 Ana:1,Walt:34,Bubba:40,Rosie:31,Tex:26,Gloria:57,Mikey:30,Lou:8,Kenny:27,Dante:12,Yuki:71,Brenda:5,Omar:77,'Action Pete':9,Carla:76,Jules:103,
 Viktor:43,Sasha:37,Hiro:56,Elena:97,Monty:28,Nadia:53,
};
const FEMALE_NAMES=new Set(['Lisa','Dee','Wendy','Joan','Trish','Gail','Nora','Peggy','Connie','Bev','Irene','Rhonda','June','Maxine','Tina','Rita','Mona','Dora']);
const MALE_NAMES=new Set(['Ray','Carlos','Marty','Sonny','Hector','Benny','Rudy','Vic','Abe','Luis','Stan','Otis','Felix','Gary','Earl','Gil','Ned']);
/** Hero's portrait when they have not picked one. */
export const DEFAULT_HERO_PORTRAIT=6;
const ALL=Array.from({length:PORTRAIT_COUNT},(_,i)=>i);
const first=(name:string)=>name.split(' ')[0];

/** The portrait a name would get on its own (no other players to avoid). */
export function portraitFor(name:string,taken:ReadonlySet<number>=new Set()):number {
 const fixed=REGULAR_PORTRAITS[name];if(fixed!==undefined&&!taken.has(fixed))return fixed;
 const given=first(name),pool=FEMALE_NAMES.has(given)?ALL.filter(i=>WOMEN.has(i)):MALE_NAMES.has(given)?ALL.filter(i=>!WOMEN.has(i)):ALL;
 // Regulars whose own portrait is taken keep to portraits of the same kind.
 const kind=fixed===undefined?pool:ALL.filter(i=>WOMEN.has(i)===WOMEN.has(fixed));
 const free=kind.filter(i=>!taken.has(i)),from=free.length?free:kind;
 return from[nameHash(name)%from.length];
}
/** One portrait per player at a table, in seat order; Hero's own choice is reserved first. */
export function tablePortraits(names:readonly string[],hero:number|null=null):Map<string,number> {
 const out=new Map<string,number>(),taken=new Set<number>();
 if(hero!==null)taken.add(hero);
 // Regulars first, so a stranger never takes a regular's own portrait.
 for(const name of [...names].sort((a,b)=>Number(REGULAR_PORTRAITS[b]!==undefined)-Number(REGULAR_PORTRAITS[a]!==undefined))){
  if(out.has(name))continue;const p=portraitFor(name,taken);out.set(name,p);taken.add(p);
 }
 return out;
}
/** Seat-id-safe variant: display names are not unique and must not be used as identities. */
export function tablePortraitsForSeats(seats:readonly {id:number;name:string}[],hero:number|null=null):Map<number,number> {
 const out=new Map<number,number>(),taken=new Set<number>();
 if(hero!==null)taken.add(hero);
 const sorted=[...seats].sort((a,b)=>Number(REGULAR_PORTRAITS[b.name]!==undefined)-Number(REGULAR_PORTRAITS[a.name]!==undefined)||a.id-b.id);
 for(const seat of sorted){if(out.has(seat.id))continue;const value=portraitFor(seat.name,taken);out.set(seat.id,value);taken.add(value);}
 return out;
}
export const validPortrait=(value:unknown):number|null=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<PORTRAIT_COUNT?value as number:null;
const file=(i:number)=>`p${String(i).padStart(2,'0')}.webp`;
/** A portrait image; `mood` drives a light reaction (glow, tilt, dim) in CSS. */
export function portraitMarkup(index:number,mood:Mood='neutral',size:'seat'|'large'='seat'):string {
 const f=file(index),src=size==='seat'?`/avatars/s/${f}`:`/avatars/${f}`;
 return `<span class="portrait" data-mood="${mood}"><img src="${src}" srcset="/avatars/s/${f} 128w, /avatars/${f} 256w" sizes="${size==='seat'?'64px':'128px'}" alt="" decoding="async" loading="lazy" draggable="false"></span>`;
}
