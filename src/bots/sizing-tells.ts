/** Bet-size tells (cash layer human-1.6.0, tournament policy 2.9.0). Live players size their bets
 * in habitual ways a watchful opponent can learn:
 * - "big means strong": small bets with medium hands and bluffs, big bets with strong hands;
 * - "small means strong": trappers bet small to keep you in with their best hands and bet big to bluff;
 * - "blocker bets": a small river lead with a medium hand to set the price, big bets otherwise honest;
 * - "polarized": big bets with the best and worst hands, smaller bets with the middle;
 * - "balanced": no additional per-player sizing tell is applied.
 * How strongly the habit shows grows as skill falls. Deterministic per personality.
 * Designed behaviour, not fitted to human data. Pure functions. */
import type {Action,BotObservation,BotProfile} from '../contracts';
import {completeProfile,clamp} from './profiles';
import {regularProfile} from './regulars';
import {regularOfProfile} from './talk';
import {handFeatures} from './features';

export type SizingStyle='big-means-strong'|'small-means-strong'|'blocker-bets'|'polarized'|'balanced';
export const STYLE_READS:Record<SizingStyle,string>={
 'big-means-strong':'Sizing tell: bets small with medium hands, big when strong.',
 'small-means-strong':'Sizing tell: small bets are traps; big bets are often bluffs.',
 'blocker-bets':'Sizing tell: a small river lead means a medium hand.',
 'polarized':'Sizing: bigger bets with strong hands or bluffs, smaller with medium hands.',
 'balanced':'Sizing: no added sizing tell.',
};
const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};

/** Regulars whose sizing habit is part of their character. */
export const REGULAR_SIZING:Readonly<Record<string,SizingStyle>>=Object.freeze({
 'big-earl':'big-means-strong',dot:'blocker-bets',rosie:'big-means-strong',sal:'big-means-strong',bubba:'blocker-bets',monty:'big-means-strong',
 tess:'small-means-strong',brenda:'small-means-strong',nina:'small-means-strong',
 marco:'polarized',vince:'polarized',sasha:'polarized',pete:'polarized',
 hiro:'balanced',ana:'balanced',omar:'balanced',viktor:'balanced',priya:'balanced',
});
/** Named sizing overrides belong only to the complete, unchanged authored profile. */
export function regularSizingForProfile(profile:BotProfile):SizingStyle|undefined {
 const id=regularOfProfile(profile);if(!id)return undefined;
 const actual=completeProfile(profile),expected=completeProfile(regularProfile(id,profile.environment??'neutral'));
 const same=(Object.keys(expected) as (keyof typeof expected)[]).every(key=>key==='traits'?Object.keys(expected.traits).every(k=>actual.traits[k as keyof typeof expected.traits]===expected.traits[k as keyof typeof expected.traits]):actual[key]===expected[key]);
 return same?REGULAR_SIZING[id]:undefined;
}
/** Round a normal raise on the table's denomination, preserving a legal capped all-in. */
function legalSize(o:BotObservation,to:number):number {
 const unit=o.chipUnit??1,min=o.legal.minRaiseTo!,max=o.legal.maxRaiseTo!;
 return Math.min(max,Math.max(min,Math.round(to/unit)*unit));
}
/** A personality's sizing habit: good players are balanced; others get a habit from their style. */
export function sizingStyle(profile:BotProfile,override?:SizingStyle):SizingStyle {
 if(override)return override;
 const p=completeProfile(profile);if(p.skill>=.78)return 'balanced';
 const r=unit(`sizing:${profile.personalityId??`${p.archetype}:${p.skill}`}`);
 if(p.traits.slowPlay>=.6&&r<.6)return 'small-means-strong';
 if(p.aggression>=.68)return r<.6?'polarized':'big-means-strong';
 if(p.aggression<=.35)return r<.45?'blocker-bets':'big-means-strong';
 return r<.55?'big-means-strong':r<.75?'blocker-bets':r<.9?'polarized':'small-means-strong';
}
/** How plainly the habit shows (0 balanced … 1 obvious). */
export function tellStrength(profile:BotProfile,style:SizingStyle):number {const p=completeProfile(profile);return style==='balanced'?0:clamp((.85-p.skill)*1.4);}

function draw(random:()=>number):number {const x=random();if(!Number.isFinite(x)||x<0||x>=1)throw Error('Bot random draw must be in [0, 1).');return x;}
/** Re-size a bet or raise after the flop by the player's habit. Calls, checks, folds, all-ins and
 * preflop actions are left alone; a short all-in stays as it is. Returns the habit applied, if any. */
export function applySizingTell(o:BotObservation,profile:BotProfile,action:Action,random:()=>number,override?:SizingStyle):{action:Action;tell:string|null} {
 const keep={action,tell:null};
 if(o.street==='preflop'||action.type!=='raise'||!o.legal.canRaise||!o.ownCards||o.ownCards.length!==2)return keep;
 const max=o.legal.maxRaiseTo!;if(o.legal.shortAllInTo!==null||action.to>=max)return keep;
 const style=sizingStyle(profile,override),k=tellStrength(profile,style);if(k<=0||draw(random)>=.5+.5*k)return keep;
 const f=handFeatures(o.ownCards,o.board),strong=f.made&&!f.playsBoard&&f.strength>=.68,medium=!strong&&f.strength>=.5,weak=!strong&&!medium;
 const own=o.seats.find(s=>s.id===o.actingSeat)!,facing=Math.max(0,...o.seats.map(s=>s.streetCommitted)),noBet=facing===0;
 let fraction:number|null=null,tell='';
 if(noBet){
  // Bets into an unbet pot, as a fraction of the pot.
  if(style==='big-means-strong'){fraction=strong?.95:medium?.4:.33;tell='size=strength';}
  if(style==='small-means-strong'){fraction=strong?.3:weak?.9:.55;tell='small=strong';}
  if(style==='blocker-bets'){fraction=o.street==='river'&&medium?.25:strong?.8:.55;tell=o.street==='river'&&medium?'blocker':'honest';}
  if(style==='polarized'){fraction=strong||weak?1.1:.5;tell='polar';}
  if(fraction===null)return keep;
  const to=own.streetCommitted+o.pot*(fraction*(1-.15*(1-k))+.6*.15*(1-k));
  return {action:{type:'raise',to:legalSize(o,to)},tell};
 }
 // Raises: strong hands raise bigger for "big means strong" players, smaller for trappers.
 const scale=style==='big-means-strong'||style==='polarized'?(strong?1+.35*k:1-.2*k):style==='small-means-strong'?(strong?1-.25*k:1+.25*k):1;
 if(scale===1)return keep;
 const to=facing+(action.to-facing)*scale;
 return {action:{type:'raise',to:legalSize(o,to)},tell:'raise-size'};
}
