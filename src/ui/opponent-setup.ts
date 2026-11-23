import type { Archetype, BotTraits, OpponentConfig, PopulationPreset } from '../contracts';
import type { CashSettings } from '../session/types';
import { drawResponseSetup, readDrawResponses } from './draw-setup';
import { occupiedSeatIds } from '../session/configuration';
import { DEFAULT_CUSTOM_TRAITS } from '../bots/policy';
import { REGULARS, regularById, regularConfig, regularFor, regularProfile, type Stake } from '../bots/regulars';
import { REGULAR_SIZING, STYLE_READS, sizingStyle } from '../bots/sizing-tells';
import { leakRead } from '../bots/leaks';
const STAKE_NAMES:Record<Stake,string>={low:'low stakes',mid:'mid stakes',high:'high stakes'};

export const OPPONENT_LABELS: Record<OpponentConfig['selection'], string> = {
  nit: 'Nit · tight & patient', tag: 'TAG · tight aggressive', lag: 'LAG · loose aggressive',
  station: 'Calling station', maniac: 'Maniac', 'fit-or-fold': 'Fit or fold',
  'passive-reg': 'Recreational player', 'stronger-reg': 'Strong regular',
  random: 'Random · population mix', unknown: 'Unknown · keep style hidden', custom: 'Custom opponent',
};
const ARCHETYPES: Archetype[] = ['nit', 'tag', 'lag', 'station', 'maniac', 'fit-or-fold', 'passive-reg', 'stronger-reg'];
const CHOICES = [...ARCHETYPES, 'random', 'unknown', 'custom'] as OpponentConfig['selection'][];
export const POPULATION_LABELS: Record<PopulationPreset, string> = {
  low: 'Low-stakes mix', mid: 'Mid-stakes mix', high: 'High-stakes mix', neutral: 'Neutral mix',
};
export const TRAIT_FIELDS: {key:keyof BotTraits; label:string; help:string}[] = [
  {key:'positionAwareness', label:'Position awareness', help:'Attention to position when choosing actions.'},
  {key:'bluffFrequency', label:'Bluff tendency', help:'Willingness to make aggressive plays with weaker holdings.'},
  {key:'valueThreshold', label:'Value threshold', help:'Strength required for value aggression.'},
  {key:'drawCalling', label:'Draw calling', help:'Willingness to continue with drawing hands.'},
  {key:'sizeSensitivity', label:'Bet-size sensitivity', help:'How strongly the amount faced affects decisions.'},
  {key:'riskTolerance', label:'Risk tolerance', help:'Willingness to risk chips in uncertain spots.'},
  {key:'riverCuriosity', label:'River curiosity', help:'Tendency to pay to see a river showdown.'},
  {key:'slowPlay', label:'Slow play', help:'Tendency to play strong holdings passively.'},
  {key:'multiwayCaution', label:'Multiway caution', help:'Caution when several opponents remain.'},
  {key:'adaptation', label:'Public-history adaptation', help:'Response to observed public opponent actions.'},
  {key:'memoryRetention', label:'Memory retention', help:'Amount of bounded public history considered.'},
  {key:'mistakeRate', label:'Mistake tendency', help:'Frequency of deliberately imperfect decisions.'},
  {key:'sizingAggression', label:'Sizing aggression', help:'Preference for larger aggressive action sizes.'},
];
const escape = (value:unknown) => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]!);
export function freshPersonalitySeed():number { return crypto.getRandomValues(new Uint32Array(1))[0]; }

/** UI drafts retain supplied identities. Actual profile resolution belongs to the controller. */
export function initializeOpponentSettings(settings:CashSettings, seed= freshPersonalitySeed):CashSettings {
  const used = new Set((settings.opponents ?? []).flatMap(config => config.personalitySeed === undefined ? [] : [config.personalitySeed]));
  const opponents = Array.from({length:9},(_,index):OpponentConfig => {
    const config = structuredClone(settings.opponents?.[index] ?? {selection:settings.archetypes[index] ?? 'tag'});
    if(config.personalitySeed===undefined){
      let candidate=seed();
      while(used.has(candidate))candidate=(candidate+1)>>>0;
      config.personalitySeed=candidate;used.add(candidate);
    }
    if(config.selection==='custom')config.traits={...DEFAULT_CUSTOM_TRAITS,...config.traits};
    return config;
  });
  return {...settings,population:settings.population ?? 'neutral',opponents,tableMode:settings.tableMode ?? 'live'};
}

/** Fill every opponent seat with a different regular, in random order. */
export function seatRegulars(settings:CashSettings, random:(n:number)=>number=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n):CashSettings {
  // Regulars who play these stakes first, then (if the table needs more) the nearest other stakes.
  const stake=cashStake(settings.bigBlind),order:Stake[]=stake==='low'?['low','mid','high']:stake==='mid'?['mid','low','high']:['high','mid','low'];
  const shuffle=(ids:string[])=>{for(let i=ids.length-1;i>0;i--){const j=random(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;};
  const pool:string[]=[];for(const tier of order)pool.push(...shuffle(REGULARS.filter(r=>r.stakes.includes(tier)&&!pool.includes(r.id)).map(r=>r.id)));
  return {...settings,opponents:Array.from({length:9},(_,index)=>regularConfig(pool[index]))};
}
/** Which stakes a cash table plays, from its big blind in cents: up to $2 low, up to $10 mid, above that high. */
export const cashStake=(bigBlind:number):Stake=>bigBlind<=200?'low':bigBlind<=1000?'mid':'high';

export function randomizeOpponentSettings(settings:CashSettings, seed=freshPersonalitySeed):CashSettings {
  const previous=new Set(settings.opponents?.map(config=>config.personalitySeed));
  const used=new Set<number>();
  const opponents=Array.from({length:9},():OpponentConfig=>{
    let personalitySeed=seed();
    while(used.has(personalitySeed)||previous.has(personalitySeed))personalitySeed=(personalitySeed+1)>>>0;
    used.add(personalitySeed);
    return {selection:'random',personalitySeed};
  });
  return {...settings,opponents};
}

function unit(data:FormData,key:string,fallback:number|undefined,optional=false):number|undefined {
  if(!data.has(key))return fallback;
  const raw=String(data.get(key)).trim();
  if(optional&&!raw)return undefined;
  const value=Number(raw);
  if(!raw||!Number.isFinite(value)||value<0||value>1)throw new Error('Opponent skill and custom traits must be numbers from 0 to 1.');
  return value;
}

export function readOpponentSettings(data:FormData,settings:CashSettings):Pick<CashSettings,'opponents'|'population'|'archetypes'|'tableMode'> {
  const population=String(data.get('population') ?? settings.population ?? 'neutral') as PopulationPreset;
  if(!Object.hasOwn(POPULATION_LABELS,population))throw new Error('Choose a valid opponent population preset.');
  const opponents=(settings.opponents ?? []).map((prior,index):OpponentConfig=>{
    const prefix=`opponent-${index+1}`;
    const raw=String(data.get(`${prefix}-selection`) ?? (regularFor(prior)?`regular:${regularFor(prior)!.id}`:prior.selection));
    if(raw.startsWith('regular:')){const id=raw.slice(8);if(!regularById(id))throw new Error('Choose a listed regular.');return regularConfig(id);}
    const selection=raw as OpponentConfig['selection'];
    if(!CHOICES.includes(selection))throw new Error('Choose a supported opponent style.');
    const skill=unit(data,`${prefix}-skill`,prior.skill,true);
    const next:OpponentConfig={selection,personalitySeed:prior.personalitySeed};
    const drawResponses=readDrawResponses(data,prefix,prior.drawResponses);if(drawResponses)next.drawResponses=drawResponses;
    if(skill!==undefined)next.skill=skill;
    if(selection==='custom'){
      const baseArchetype=String(data.get(`${prefix}-base`) ?? prior.baseArchetype ?? 'tag') as Archetype;
      if(!ARCHETYPES.includes(baseArchetype))throw new Error('Choose a supported custom base style.');
      next.baseArchetype=baseArchetype;
      next.aggression=unit(data,`${prefix}-aggression`,prior.aggression ?? 0.6)!;
      next.looseness=unit(data,`${prefix}-looseness`,prior.looseness ?? 0.4)!;
      next.traits=Object.fromEntries(TRAIT_FIELDS.map(({key})=>[key,unit(data,`${prefix}-${key}`,prior.traits?.[key] ?? DEFAULT_CUSTOM_TRAITS[key])!])) as unknown as BotTraits;
    }
    return next;
  });
  const seated=opponents.map(config=>regularFor(config)?.name).filter((name,index)=>name&&occupiedSeatIds(settings).includes(index+1)) as string[];
  const twice=seated.find((name,index)=>seated.indexOf(name)!==index);if(twice)throw new Error(`${twice} can only sit in one seat.`);
  // Legacy field remains a compatibility fallback; random/unknown are never resolved in presentation code.
  const archetypes=opponents.map((config,index)=>ARCHETYPES.includes(config.selection as Archetype) ? config.selection as Archetype : config.baseArchetype ?? settings.archetypes[index] ?? 'tag');
  return {opponents,population,archetypes,tableMode:settings.tableMode ?? 'live'};
}

export function opponentSetup(settings:CashSettings,names:readonly string[],colors:readonly string[],openDetails:ReadonlySet<number>,openCards:ReadonlySet<number>=new Set()):string {
  const unitInput=(id:string,label:string,value:number,help:string)=>`<label for="${id}">${label}<input id="${id}" name="${id}" type="number" min="0" max="1" step="any" inputmode="decimal" value="${value}" required><small>${help}</small></label>`;
  return `<section class="opponent-setup" aria-labelledby="opponent-heading"><div class="roster-heading"><h3 id="opponent-heading">Your opponents</h3><span>Host controls · hidden at the live table</span></div>
    <div class="population-controls"><label for="population">Population preset<select id="population" name="population">${Object.entries(POPULATION_LABELS).map(([key,label])=>`<option value="${key}" ${settings.population===key?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" id="randomize-lineup" class="button secondary">Randomize realistic lineup</button><button type="button" id="seat-regulars" class="button secondary">Seat the regulars</button></div>
    <p class="opponent-explainer">Population presets are synthetic style mixes, not measured player pools. Stakes do not change this preset or force skill. Randomize assigns new, independent personalities; otherwise identities remain stable for your next session. Regulars are named players with fixed styles who play the same way every time, here and in tournaments.</p>
    <div class="opponent-lineup"><div class="opponent-hero"><span class="avatar tiny-avatar" style="--avatar:${colors[0]}">Y</span><b>You · Seat 1</b><span class="you-label">YOUR SEAT</span></div>
    ${occupiedSeatIds(settings).filter(id=>id!==0).map(seat=>{
      const config=settings.opponents![seat-1],prefix=`opponent-${seat}`,regular=regularFor(config),custom=config.selection==='custom'&&!regular,name=regular?.name??names[seat];
      // Each opponent is one line (name, seat, current style) that opens to its controls.
      return `<article class="opponent-config" data-opponent-seat="${seat}"><details class="opponent-card" id="opponent-card-${seat}" data-opponent-card="${seat}" ${openCards.has(seat)||openDetails.has(seat)?'open':''}><summary class="opponent-config-heading"><span class="avatar tiny-avatar" style="--avatar:${colors[seat]}">${escape(name[0])}</span><h4>${escape(name)}<small>Seat ${seat+1} · ${regular?`Regular · ${escape(regular.style)}`:`${OPPONENT_LABELS[config.selection]}${config.skill===undefined?'':` · skill ${config.skill}`}`}</small></h4><span class="outline-tag" data-testid="persona-evidence-tier" data-evidence-tier="DESIGNED">DESIGNED · Synthetic</span></summary>
        <div class="opponent-basic"><label for="${prefix}-selection">Style<select id="${prefix}-selection" name="${prefix}-selection" data-opponent-selection="${seat}"><optgroup label="Styles">${CHOICES.map(choice=>`<option value="${choice}" ${!regular&&config.selection===choice?'selected':''}>${OPPONENT_LABELS[choice]}</option>`).join('')}</optgroup>${(['low','mid','high'] as Stake[]).map(tier=>`<optgroup label="Regulars · ${STAKE_NAMES[tier]}">${REGULARS.filter(r=>r.stakes[0]===tier).map(r=>`<option value="regular:${r.id}" ${regular?.id===r.id?'selected':''}>${escape(r.name)} · ${escape(r.style)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${regular?`<p class="regular-read" data-testid="regular-read">${escape(regular.read)} ${escape(STYLE_READS[sizingStyle(regularProfile(regular.id,'mid'),REGULAR_SIZING[regular.id])])} ${escape(leakRead(regular.id))}</p>`:`<label for="${prefix}-skill">Skill · 0 to 1<input id="${prefix}-skill" name="${prefix}-skill" type="number" min="0" max="1" step="any" inputmode="decimal" placeholder="Preset default" value="${config.skill ?? ''}"><small>Blank uses the style’s default skill. Style and skill are separate.</small></label>`}</div>
        <details id="opponent-details-${seat}" data-opponent-details="${seat}" ${openDetails.has(seat)?'open':''}><summary>${custom?'Custom traits & behavior':'Personality & behavior'}</summary>${regular?`<p>${escape(regular.name)} is a regular: a fixed personality built on the ${escape(OPPONENT_LABELS[regular.base])} style. Choose Custom opponent to make your own variation.</p>`:''}<p>A stable personality varies decisions within this style. Skill is a simulator control, not a measured player rating or solver strength. Personalities persist with the session and saved history.</p>
        ${config.selection==='unknown'?'<p>Unknown keeps its actual style hidden during play and ordinary Study. After ending and cashing out the session, you may explicitly reveal its recorded starting style. Private parameters and hidden cards remain concealed.</p>':''}
        ${regular?'':custom?`<label class="custom-base" for="${prefix}-base">Base style<select id="${prefix}-base" name="${prefix}-base">${ARCHETYPES.map(archetype=>`<option value="${archetype}" ${(config.baseArchetype ?? 'tag')===archetype?'selected':''}>${OPPONENT_LABELS[archetype]}</option>`).join('')}</select></label><p>All custom controls range from 0 (low) to 1 (high). These are tendencies; actions must still be legal.</p><div class="custom-traits">${unitInput(`${prefix}-aggression`,'Aggression',config.aggression ?? 0.6,'Overall tendency to bet or raise.')}${unitInput(`${prefix}-looseness`,'Looseness',config.looseness ?? 0.4,'Overall willingness to enter and continue hands.')}${TRAIT_FIELDS.map(({key,label,help})=>unitInput(`${prefix}-${key}`,label,config.traits?.[key] ?? DEFAULT_CUSTOM_TRAITS[key],help)).join('')}</div>`:'<p>Select Custom opponent to edit aggression, looseness and 13 individual traits.</p>'}${drawResponseSetup(prefix,config.drawResponses)}</details></details>
      </article>`;
    }).join('')}</div><p class="opponent-explainer">Synthetic practice policies · not human-validated opponents or solver advice. Live play shows only permitted cards and public actions.</p></section>`;
}
