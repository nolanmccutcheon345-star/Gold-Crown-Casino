/** Who a new tournament seats: some of the named regulars plus field players drawn from the
 * population mix that fits the event's tier. Saved on the event so it can be checked later.
 * Events saved before this existed keep their old fixed archetype rotation and names. */
import type {BotProfile,PopulationPreset} from '../contracts';
import {createProfile,completeProfile} from '../bots/profiles';
import {REGULARS,regularById,regularProfile,isRegularName,type Stake} from '../bots/regulars';
import type {EventPreset} from './presets';

/** cast-1: the original twenty regulars, any event. cast-2 (patch 33): forty regulars, drawn from those who play the event's stakes. */
export const FIELD_VERSION_1='cast-1';
export const FIELD_VERSION='cast-2';
export interface EventField {version:typeof FIELD_VERSION_1|typeof FIELD_VERSION;population:PopulationPreset;/** Player id → regular id. */regulars:Record<string,string>;}

const FIRST=['Alex','Morgan','Jordan','Riley','Casey','Taylor','Drew','Quinn','Avery','Blake','Cameron','Dakota','Emerson','Finley','Harper','Jamie','Kendall','Logan','Parker','Reese','Rowan','Sage','Skyler','Sydney','Tatum','Hayden','Jesse','Kai','Lane','Micah'];
/** "You", then first names, then first names with an initial: unique for up to 108 players.
 * Identical to the names events have always used, so field players keep familiar names. */
export function baseNames(entrants:number):string[] {return Array.from({length:entrants},(_,i)=>i===0?'You':i<=FIRST.length?FIRST[i-1]:`${FIRST[(i-1)%FIRST.length]} ${String.fromCharCode(65+Math.floor((i-1)/FIRST.length)-1)}.`);}
/** Home games draw a recreational mix, casino dailies a mid-stakes mix, series events a tougher mix. */
export function fieldPopulation(preset:Pick<EventPreset,'tier'>):PopulationPreset {return preset.tier==='home'?'low':preset.tier==='casino'||preset.tier==='sng'||preset.tier==='satellite'?'mid':'high';}
const ORIGINAL=REGULARS.slice(0,20);
/** Which stakes an event's tier plays at. */
export const tierStake=(preset:Pick<EventPreset,'tier'>):Stake=>preset.tier==='home'?'low':preset.tier==='casino'||preset.tier==='sng'||preset.tier==='satellite'?'mid':'high';
/** The regulars an event may seat. */
export function regularPool(preset:Pick<EventPreset,'tier'>,version:EventField['version']=FIELD_VERSION):string[] {
 return version===FIELD_VERSION_1?ORIGINAL.map(r=>r.id):REGULARS.filter(r=>r.stakes.includes(tierStake(preset))).map(r=>r.id);
}
/** About four in ten opponents are regulars (cast-1: at most twenty; cast-2: at most the stake's pool). */
export const regularCount=(entrants:number,pool=ORIGINAL.length)=>Math.min(pool,Math.max(1,Math.round((entrants-1)*.4)));
export function fieldNames(entrants:number,field:EventField):string[] {const names=baseNames(entrants);for(const [player,id] of Object.entries(field.regulars))names[Number(player)]=regularById(id)!.name;return names;}

/** Draw a field: which regulars come, where they sit in the entry list, and everyone's profile. */
export function drawField(preset:Pick<EventPreset,'tier'>,entrants:number,random:(n:number)=>number,token:()=>number):{field:EventField;profiles:Record<number,BotProfile>;names:string[]} {
 const population=fieldPopulation(preset),pool=regularPool(preset,FIELD_VERSION),size=pool.length,players=Array.from({length:entrants-1},(_,i)=>i+1);
 for(let i=pool.length-1;i>0;i--){const j=random(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 for(let i=players.length-1;i>0;i--){const j=random(i+1);[players[i],players[j]]=[players[j],players[i]];}
 const count=regularCount(entrants,size),regulars:Record<string,string>={};
 for(let i=0;i<count;i++)regulars[String(players[i])]=pool[i];
 const field:EventField={version:FIELD_VERSION,population,regulars},profiles:Record<number,BotProfile>={};
 for(let player=0;player<entrants;player++){const id=regulars[String(player)];profiles[player]=id?regularProfile(id,population):createProfile({selection:'random'},token(),population);}
 return {field,profiles,names:fieldNames(entrants,field)};
}

/** Add each regular's style label to standings rows (events with a saved field only). */
export function markRegulars<T extends {name:string;regular?:string}>(field:EventField|undefined,rows:T[]):T[] {
 if(!field)return rows;const styles=new Map(Object.values(field.regulars).map(id=>[regularById(id)!.name,regularById(id)!.style]));
 return rows.map(row=>styles.has(row.name)?{...row,regular:styles.get(row.name)}:row);
}
const canonical=(value:unknown)=>JSON.stringify(value);
/** Check a saved field against the event's entrants, names and profiles. */
export function validateField(event:{entrants:number;preset:Pick<EventPreset,'tier'>;profiles:Record<number,BotProfile>;field?:EventField},names:string[]):void {
 const field=event.field;if(!field)return;
 const fail=(message:string)=>{throw Error(`Tournament field: ${message}`);};
 if((field.version!==FIELD_VERSION&&field.version!==FIELD_VERSION_1)||field.population!==fieldPopulation(event.preset))fail('unsupported field version or population');
 const entries=Object.entries(field.regulars),pool=regularPool(event.preset,field.version);
 if(entries.length!==regularCount(event.entrants,pool.length))fail('wrong number of regulars');
 if(entries.some(([,id])=>!pool.includes(id)))fail('a regular is not in this event\'s pool');
 if(new Set(entries.map(([,id])=>id)).size!==entries.length)fail('a regular is entered twice');
 for(const [player,id] of entries){
  const n=Number(player);if(!Number.isInteger(n)||n<1||n>=event.entrants||String(n)!==player)fail('a regular has an invalid entry');
  if(!regularById(id))fail('unknown regular');
  if(canonical(completeProfile(event.profiles[n]))!==canonical(completeProfile(regularProfile(id,field.population))))fail(`${regularById(id)!.name}'s style changed`);
 }
 for(let player=1;player<event.entrants;player++)if(!field.regulars[String(player)]&&event.profiles[player].environment!==field.population)fail('a field player has the wrong population');
 if(canonical(names)!==canonical(fieldNames(event.entrants,field)))fail('player names changed');
 if(names.filter((name,i)=>!field.regulars[String(i)]&&isRegularName(name)).length)fail('a field player uses a regular\'s name');
}
