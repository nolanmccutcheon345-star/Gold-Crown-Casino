/** The Regulars: named computer players with fixed, recognisable styles. Each one is an ordinary
 * custom profile (a base archetype with chosen trait values) and a fixed personality seed, so the
 * same regular plays the same way in every cash game and tournament. Designed characters, not
 * models of real people or measured player types. */
import type {Archetype,BotProfile,BotTraits,OpponentConfig,PopulationPreset} from '../contracts';
import {createProfile,presetTraits,completeProfile} from './profiles';
import type {Habits} from './habits';

export interface Regular {
 id:string;name:string;
 /** Short style label for seat cards and menus. */
 style:string;
 /** One line on how they play and how to beat them. */
 read:string;
 base:Archetype;aggression?:number;looseness?:number;skill?:number;traits:Partial<BotTraits>;
 /** Stakes where this regular usually plays (patch 33). */
 stakes:readonly Stake[];
 /** Habit tendencies that differ from what their traits imply. */
 habits?:Partial<Habits>;
}
export type Stake='low'|'mid'|'high';
const R=(id:string,name:string,style:string,read:string,base:Archetype,shape:{aggression?:number;looseness?:number;skill?:number},traits:Partial<BotTraits>,stakes:Stake[]=['mid'],habits?:Partial<Habits>):Regular=>Object.freeze({id,name,style,read,base,...shape,traits:Object.freeze(traits),stakes:Object.freeze(stakes),...habits?{habits:Object.freeze(habits)}:{}});

export const REGULARS:readonly Regular[]=Object.freeze([
 R('big-earl','Big Earl','Calling station','Calls you down with any pair and loves to see a river. Bet your value hands; never bluff him.','station',{},{riverCuriosity:.98,drawCalling:.97,sizeSensitivity:.05,slowPlay:.45},['low'],{limpCall:.7}),
 R('nina','Nina','Trapping nit','Plays very few hands and slow-plays her big ones. When she finally raises, believe her.','nit',{},{slowPlay:.8,valueThreshold:.85},['low','mid'],{trap:.85}),
 R('marco','Marco','Overbettor','Loose and aggressive, with huge bets for value and as bluffs. Call him down lighter.','lag',{},{sizingAggression:.98,bluffFrequency:.82},['mid'],{overbetTell:.4}),
 R('dot','Dot','Limp-caller','Limps, calls and rarely raises without a monster. Value-bet her thinly.','passive-reg',{aggression:.15,looseness:.8},{drawCalling:.95,valueThreshold:.82},['low'],{limpCall:.85}),
 R('vince','Vince','Maniac','Raises almost every pot. Let him bluff into your good hands.','maniac',{},{},['low','mid']),
 R('priya','Priya','Pressure pro','Strong and aggressive: re-raises often and bets big. Stand up to her with good hands.','stronger-reg',{aggression:.8,skill:.9},{sizingAggression:.82,bluffFrequency:.66},['high'],{delayedBet:.45}),
 R('hank','Hank','Scared money','Folds to pressure, especially in big pots and near the money. Push him around.','fit-or-fold',{aggression:.22},{riskTolerance:.08,multiwayCaution:.95,sizeSensitivity:.92},['low','mid']),
 R('tess','Tess','Trapper','Tight and aggressive, but checks her strong hands to let you bet. Be careful when she check-raises.','tag',{},{slowPlay:.72},['mid'],{trap:.7}),
 R('rocco','Rocco','Fit or fold','Bets the flop, then gives up when called. Float him and bet the turn.','fit-or-fold',{aggression:.45},{sizeSensitivity:.95,bluffFrequency:.35},['low','mid']),
 R('lena','Lena','Sneaky bluffer','Tight before the flop, bluffs more than you would think after it.','tag',{},{bluffFrequency:.72,riverCuriosity:.35},['mid','high'],{delayedBet:.35}),
 R('gus','Gus','Short-stack shover','Moves all-in early with short stacks and calls off light. Tighten up and let him gamble.','passive-reg',{aggression:.45},{riskTolerance:.95},['low']),
 R('mei','Mei','Patient grinder','Strong and disciplined, very tight on the bubble. Steal her blinds near the money.','stronger-reg',{},{riskTolerance:.28},['mid','high']),
 R('duke','Duke','Bubble bully','Attacks short and medium stacks when the money is close. Re-shove on him with good hands.','lag',{aggression:.88},{riskTolerance:.88},['mid','high']),
 R('sal','Sal','Friendly recreational','Plays for fun and misreads spots. Value-bet him and avoid fancy bluffs.','passive-reg',{skill:.2},{mistakeRate:.62},['low'],{donk:.5,minRaise:.5}),
 R('ruth','Ruth','Rock','Only bets with strong hands and folds when raised. Fold to her big bets.','nit',{aggression:.18},{valueThreshold:.92,bluffFrequency:.05},['low','mid']),
 R('theo','Theo','Positional thief','Opens light from late position and steals blinds. Defend and re-raise him.','tag',{looseness:.45},{positionAwareness:.99,bluffFrequency:.55},['mid','high'],{float:.45}),
 R('ivy','Ivy','Draw chaser','Plays draws hard, even in multiway pots. Charge her to see cards.','lag',{},{drawCalling:.9,multiwayCaution:.18},['mid']),
 R('frank','Frank','Tilter','Wild and error-prone, spews chips when things go badly. Wait for good hands.','maniac',{skill:.15},{mistakeRate:.72},['low','mid'],{minRaise:.45}),
 R('ana','Ana','Balanced pro','Tough and balanced; she bluffs rivers. Pick your spots against her.','stronger-reg',{},{bluffFrequency:.65,sizingAggression:.72},['high'],{float:.35,delayedBet:.35}),
 R('walt','Walt','Sheriff','Retired regular who calls the river to keep you honest. Bluff him less.','passive-reg',{},{riverCuriosity:.95,slowPlay:.2},['low']),
 R('bubba','Bubba','Friday-night limper','Limps almost every hand and calls raises to see a flop. Raise his limps and value-bet.','passive-reg',{looseness:.82,aggression:.14},{drawCalling:.9,riverCuriosity:.8},['low'],{limpCall:.85}),
 R('rosie','Rosie','Social caller','Here for fun: calls light and bets only big hands. Never bluff her; bet your value.','station',{},{riverCuriosity:.9,bluffFrequency:.03},['low'],{limpCall:.6,overbetTell:.5}),
 R('tex','Tex','Gambler','Raises blind and loves a coin flip. Wait for a hand and let him come to you.','maniac',{looseness:.94},{riskTolerance:.97},['low']),
 R('gloria','Gloria','Premiums only','Plays only big pairs and big aces and folds to aggression. Steal her blinds; fold to her raises.','nit',{looseness:.08},{valueThreshold:.9,riskTolerance:.15},['low']),
 R('mikey','Mikey','Hit-or-quit','Bets when he hits the flop, gives up when he misses. Fold to his bets, bluff when he checks.','fit-or-fold',{},{sizeSensitivity:.9},['low'],{donk:.45}),
 R('lou','Lou','Old-school rock','Tight and honest: never bluffs the river. Believe his river bets.','nit',{aggression:.3},{bluffFrequency:.04,riverCuriosity:.25},['low','mid']),
 R('kenny','Kenny','Donk bettor','Leads into the raiser with any piece of the flop. Raise his small leads.','passive-reg',{aggression:.35},{bluffFrequency:.25},['low'],{donk:.7,minRaise:.4}),
 R('dante','Dante','Solid regular','Positional and steady; continuation-bets a lot. Check-raise his flop bets now and then.','tag',{},{positionAwareness:.9},['mid'],{delayedBet:.3}),
 R('yuki','Yuki','Turn attacker','Floats the flop and attacks weakness on the turn. Don’t give up on the turn too easily.','lag',{skill:.72},{adaptation:.8},['mid','high'],{float:.55,delayedBet:.45}),
 R('brenda','Brenda','Check-raiser','Check-raises her strong hands and her draws. Bet smaller into her.','tag',{},{slowPlay:.6,drawCalling:.7},['mid'],{trap:.8}),
 R('omar','Omar','Fundamentals pro','Good fundamentals and adjusts to you. Mix up your play.','stronger-reg',{skill:.84},{adaptation:.92},['mid']),
 R('pete','Action Pete','Splasher','Splashes around and overbets the river with his big hands. Call his small bets, fold to his huge ones.','maniac',{skill:.3},{sizingAggression:.85},['mid'],{overbetTell:.6,donk:.35}),
 R('carla','Carla','Tight three-bettor','Tight; re-raises only with premiums. Fold most hands to her 3-bets.','nit',{aggression:.45},{valueThreshold:.85},['mid']),
 R('jules','Jules','Min-raiser','Min-raises everything and folds to resistance. Re-raise him.','fit-or-fold',{aggression:.5},{sizeSensitivity:.9},['low','mid'],{minRaise:.8}),
 R('viktor','Viktor','Relentless pro','Relentless aggression with balanced bluffs. Call down a little lighter.','stronger-reg',{aggression:.82,skill:.9},{bluffFrequency:.66,sizingAggression:.75},['high'],{float:.45,delayedBet:.5}),
 R('sasha','Sasha','Light three-bettor','Hyper-aggressive; re-raises light. Four-bet your good hands.','lag',{aggression:.9,skill:.74},{bluffFrequency:.78},['high']),
 R('hiro','Hiro','Mistake-free','Rarely makes a mistake. Pick your spots and avoid big bluffs.','stronger-reg',{skill:.95},{mistakeRate:.02,adaptation:.95},['high'],{float:.4,delayedBet:.4}),
 R('elena','Elena','Exploiter','Targets weaker players and folds to real strength. Show her strength.','tag',{skill:.82},{adaptation:.95,sizeSensitivity:.85},['high']),
 R('monty','Monty','Big-money recreational','Wealthy recreational: plays any two and never folds a draw. Value-bet him relentlessly.','maniac',{skill:.18},{drawCalling:.97,riverCuriosity:.9},['high'],{limpCall:.5,overbetTell:.5,donk:.5}),
 R('nadia','Nadia','Thin-value grinder','Disciplined; waits and value-bets thin. Don’t pay her off light.','tag',{skill:.8},{valueThreshold:.48,bluffFrequency:.3},['high','mid']),
]);
const BY_ID=new Map(REGULARS.map((regular,index)=>[regular.id,{regular,index}]));
/** Fixed personality seed for each regular (same personality everywhere). */
export const regularSeed=(id:string)=>{const found=BY_ID.get(id);if(!found)throw Error(`Unknown regular ${id}`);return (0x52454700+found.index)>>>0;};
export const regularById=(id:string):Regular|undefined=>BY_ID.get(id)?.regular;
/** The opponent setting that seats a regular at a cash table. */
export function regularConfig(id:string):OpponentConfig {
 const regular=regularById(id);if(!regular)throw Error(`Unknown regular ${id}`);
 const traits={...presetTraits(regular.base),...regular.traits};
 return {selection:'custom',baseArchetype:regular.base,personalitySeed:regularSeed(id),traits,...regular.aggression!==undefined?{aggression:regular.aggression}:{},...regular.looseness!==undefined?{looseness:regular.looseness}:{},...regular.skill!==undefined?{skill:regular.skill}:{}};
}
/** Which regular an opponent setting seats, if it is exactly a regular's setting. */
export function regularFor(config:OpponentConfig|undefined):Regular|undefined {
 if(!config||config.selection!=='custom'||config.personalitySeed===undefined)return undefined;
 const index=config.personalitySeed-0x52454700;if(index<0||index>=REGULARS.length)return undefined;
 const regular=REGULARS[index],expected=regularConfig(regular.id);
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 return config.baseArchetype===expected.baseArchetype&&config.aggression===expected.aggression&&config.looseness===expected.looseness&&config.skill===expected.skill&&same(Object.fromEntries(Object.entries(config.traits??{}).sort()),Object.fromEntries(Object.entries(expected.traits!).sort()))?regular:undefined;
}
export function regularProfile(id:string,environment:PopulationPreset):BotProfile {return createProfile(regularConfig(id),regularSeed(id),environment);}
const REGULAR_NAMES=new Set(REGULARS.map(regular=>regular.name));
export const isRegularName=(name:string)=>REGULAR_NAMES.has(name);

/** Fixed habits belong only to the unedited regular, not merely a reused seed. */
function authoredRegularProfile(profile:BotProfile):Regular|undefined {
 const index=Number.parseInt(profile.personalityId?.split(':')[1]??'',16)-0x52454700;
 const r=Number.isInteger(index)?REGULARS[index]:undefined;
 if(!r)return undefined;
 const actual=completeProfile(profile),expected=completeProfile(regularProfile(r.id,profile.environment??'neutral'));
 const keys=Object.keys(expected) as (keyof typeof expected)[];
 const matches=keys.every(key=>key==='traits'?Object.keys(expected.traits).every(k=>actual.traits[k as keyof BotTraits]===expected.traits[k as keyof BotTraits]):actual[key]===expected[key]);
 return matches?r:undefined;
}

export function regularHabitsForProfile(profile:BotProfile):Partial<Habits>|undefined {return authoredRegularProfile(profile)?.habits;}
/** Fixed buy-in habits belong only to the unchanged authored regular. */
export const REGULAR_BUY_IN:Readonly<Record<string,'short'|'standard'|'deep'>>=Object.freeze({
 gus:'short',hank:'short',mikey:'short',rosie:'standard',kenny:'standard',gloria:'standard',
 priya:'deep',viktor:'deep',sasha:'deep',hiro:'deep',elena:'deep',vince:'deep',monty:'deep',marco:'deep',tex:'deep',ana:'deep',
});
export function regularBuyInForProfile(profile:BotProfile):'short'|'standard'|'deep'|undefined {const regular=authoredRegularProfile(profile);return regular?REGULAR_BUY_IN[regular.id]:undefined;}
