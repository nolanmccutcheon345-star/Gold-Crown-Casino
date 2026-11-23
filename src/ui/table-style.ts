/** Patch 52: how the poker table looks and sounds. Display preferences only: nothing here reaches the engine or the bots. */
import type {Card} from '../contracts';
import {compareRanks,evaluate,handLabel} from '../core/evaluator';
import {normalizeFace,type Face} from './avatars';
import {validPortrait} from './portraits';

export const TABLE_STYLE_KEY='poker-night-ai:table-style';
export const FELTS=[['green','Classic green'],['blue','Casino blue'],['burgundy','Burgundy'],['charcoal','Charcoal'],['casino','Casino night'],['kitchen','Kitchen table']] as const;
export const THEMES=[['dark','Dark'],['light','Light']] as const;
export type Theme=typeof THEMES[number][0];
export const TEXT_SIZES=[['normal','Standard'],['large','Large'],['larger','Larger']] as const;
export type TextSize=typeof TEXT_SIZES[number][0];
export const BREAK_CHOICES=[0,30,60,90,120] as const;
export const BACKS=[['blue','Blue'],['red','Red'],['black','Black']] as const;
export type Felt=typeof FELTS[number][0];
export type Back=typeof BACKS[number][0];
export interface TableStyle {felt:Felt;back:Back;fourColor:boolean;sound:boolean;handLabel:boolean;chips:boolean;keys:boolean;theme:Theme;vibrate:boolean;avatars:boolean;breakEvery:number;textSize:TextSize;trends:boolean;heroFace:Partial<Face>|null;
 /** Patch 63: illustrated portraits instead of drawn faces, and Hero's chosen portrait. */
 portraits:boolean;heroPortrait:number|null;
 /** Patch 67: the dealer reads out the board, all-ins and who wins (browser speech). */
 dealerVoice:boolean;
 /** Patch 70: what Hero tokes the dealer on a pot won. */
 tokes:'off'|'one'|'regular';
 /** Patch 80: sound volume, 0 to 100. */
 volume:number;
 /** Patch 83: a quiet card-room murmur at the tables, and a click on buttons. Both off by default. */
 ambience:boolean;clicks:boolean}
/** Single-key shortcuts are off by default (WCAG 2.1.4: they can clash with screen readers and speech input). */
/** Sound and the hand label are off unless the player turns them on: a live table is quiet and nobody reads your hand for you. */
export const DEFAULT_STYLE:TableStyle={felt:'green',back:'blue',fourColor:false,sound:false,handLabel:false,chips:true,keys:false,theme:'dark',vibrate:false,avatars:true,breakEvery:0,textSize:'normal',trends:true,heroFace:null,portraits:true,heroPortrait:null,dealerVoice:false,tokes:'off',volume:70,ambience:false,clicks:false};

const pick=<T extends string>(value:unknown,options:readonly (readonly [T,string])[],fallback:T):T=>options.some(([id])=>id===value)?value as T:fallback;
/** Unknown or damaged values fall back to the defaults one field at a time. */
export function normalizeStyle(raw:unknown):TableStyle {
 const v=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
 const flag=(key:keyof TableStyle)=>typeof v[key]==='boolean'?v[key] as boolean:DEFAULT_STYLE[key] as boolean;
 return {felt:pick(v.felt,FELTS,DEFAULT_STYLE.felt),back:pick(v.back,BACKS,DEFAULT_STYLE.back),fourColor:flag('fourColor'),sound:flag('sound'),handLabel:flag('handLabel'),chips:flag('chips'),keys:flag('keys'),theme:pick(v.theme,THEMES,DEFAULT_STYLE.theme),vibrate:flag('vibrate'),avatars:flag('avatars'),breakEvery:(BREAK_CHOICES as readonly number[]).includes(v.breakEvery as number)?v.breakEvery as number:DEFAULT_STYLE.breakEvery,textSize:pick(v.textSize,TEXT_SIZES,DEFAULT_STYLE.textSize),trends:flag('trends'),heroFace:normalizeFace(v.heroFace),portraits:flag('portraits'),heroPortrait:validPortrait(v.heroPortrait),dealerVoice:flag('dealerVoice'),tokes:v.tokes==='one'||v.tokes==='regular'?v.tokes:'off',volume:typeof v.volume==='number'&&Number.isFinite(v.volume)?Math.max(0,Math.min(100,Math.round(v.volume))):70,ambience:flag('ambience'),clicks:flag('clicks')};
}
export function readStyle():TableStyle {try{const text=localStorage.getItem(TABLE_STYLE_KEY);return normalizeStyle(text?JSON.parse(text):null);}catch{return {...DEFAULT_STYLE};}}
export function saveStyle(style:TableStyle):void {try{localStorage.setItem(TABLE_STYLE_KEY,JSON.stringify(normalizeStyle(style)));}catch{/* keep for this visit only */}}
/** Classes for the app shell. Blackjack keeps its own look. */
export const styleClasses=(style:TableStyle):string=>` felt-${style.felt} back-${style.back}${style.fourColor?' four-color':''}${style.chips?'':' no-chips'}${style.theme==='light'?' theme-light':''}${style.textSize==='normal'?'':` text-${style.textSize}`}`;

const NAMES:Record<string,string>={A:'Ace',K:'King',Q:'Queen',J:'Jack',T:'Ten','9':'Nine','8':'Eight','7':'Seven','6':'Six','5':'Five','4':'Four','3':'Three','2':'Two'};
const PLURAL:Record<string,string>={A:'aces',K:'kings',Q:'queens',J:'jacks',T:'tens','9':'nines','8':'eights','7':'sevens','6':'sixes','5':'fives','4':'fours','3':'threes','2':'twos'};
const ORDER='23456789TJQKA';
/**
 * Hero's own made hand, from Hero's two cards and the public board only.
 * Preflop names the starting hand. A five-card board that beats Hero's cards is called out.
 */
export function heroHandLabel(hole:readonly Card[],board:readonly Card[]):string {
 if(hole.length!==2)return '';
 if(board.length<3){
  const [a,b]=[...hole].sort((x,y)=>ORDER.indexOf(y[0])-ORDER.indexOf(x[0]));
  if(a[0]===b[0])return `Pocket ${PLURAL[a[0]]}`;
  return `${NAMES[a[0]]}-${NAMES[b[0]].toLowerCase()} ${a[1]===b[1]?'suited':'offsuit'}`;
 }
 const best=evaluate([...hole,...board]);
 const label=handLabel(best);
 return board.length===5&&compareRanks(evaluate([...board]),best)===0?`${label} · playing the board`:label;
}

/** Chip colours by size of the bet in big blinds, largest first. At most five chips are drawn. */
const DENOMS:readonly [number,string][]=[[100,'black'],[25,'green'],[5,'red'],[1,'white']];
export function chipColors(amount:number,bigBlind:number):string[] {
 if(amount<=0||bigBlind<=0)return [];
 const out:string[]=[];let left=amount/bigBlind;
 for(const [size,color] of DENOMS){while(left>=size-1e-9&&out.length<5){out.push(color);left-=size;}}
 if(!out.length)out.push('blue');
 return out;
}
export const chipStackMarkup=(amount:number,bigBlind:number,extra=''):string=>{
 const colors=chipColors(amount,bigBlind);
 return colors.length?`<i class="chip-stack${extra}" aria-hidden="true">${colors.map(color=>`<span class="chip chip-${color}"></span>`).join('')}</i>`:'<i></i>';
};

/** Keyboard shortcuts: key → the button it presses, cash table first, then tournament. */
export const SHORTCUTS:Readonly<Record<string,readonly string[]>>={f:['#fold','#t-fold'],c:['#call','#t-call'],k:['#call','#t-call'],r:['#raise','#t-raise'],n:['#next-hand','#t-next']};
/** The button a key should press, or null. Typing in a field, modifier keys and disabled buttons never trigger. */
export function shortcutTarget(event:{key:string;altKey:boolean;ctrlKey:boolean;metaKey:boolean;target:EventTarget|null},root:ParentNode):HTMLButtonElement|null {
 if(event.altKey||event.ctrlKey||event.metaKey)return null;
 const target=event.target as HTMLElement|null;
 if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))){
  return null;
 }
 for(const selector of SHORTCUTS[event.key.toLowerCase()]??[]){
  const button=root.querySelector<HTMLButtonElement>(selector);
  if(button&&!button.disabled)return button;
 }
 return null;
}

/** How many break reminders are due: one each time playing time passes another full interval. */
export const breaksDue=(activeMs:number,everyMinutes:number):number=>everyMinutes>0?Math.floor(activeMs/(everyMinutes*60000)):0;
