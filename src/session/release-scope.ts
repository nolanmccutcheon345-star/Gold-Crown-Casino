/** R1 is one tested cash-game authority. This catalog is not a feature toggle. */
export const UNAVAILABLE_FEATURES=Object.freeze([
 {id:'run-it-twice',label:'Run it twice',phase:'Optional after R1',reason:'Not implemented. Each hand uses one board and one settlement.',backlog:'FUT001'},
 {id:'bomb-pots',label:'Bomb pots',phase:'Optional after R1',reason:'Not implemented. Normal preflop betting and a single board remain required.',backlog:'FUT004/FUT005'},
 {id:'extra-games',label:'Other poker games',phase:'Optional after R1',reason:'Not implemented. Only No-Limit Texas Hold’em cash games are supported.',backlog:''},
 {id:'tournaments',label:'Tournament modes',phase:'Later releases R2 / R3',reason:'Unavailable in cash R1. Single-table and multi-table tournament work remains scheduled separately.',backlog:''},
 {id:'multiplayer',label:'Peer multiplayer',phase:'Optional after R1',reason:'Not implemented. Current opponents are local synthetic policies.',backlog:'FUT055'},
 {id:'table-chat',label:'Table chat',phase:'Optional after R1',reason:'Not implemented. No player messaging service is connected.',backlog:''},
 {id:'dealer-errors',label:'Dealer errors and floor rulings',phase:'Optional after R1',reason:'Not implemented. No dealer-error or discretionary floor-rule simulation is enabled.',backlog:''},
 {id:'real-time-assistance',label:'Real-time assistance',phase:'Unsupported',reason:'This standalone practice simulator does not connect to live poker clients or provide in-game assistance.',backlog:''},
].map(feature=>Object.freeze({...feature,available:false as const})));

const disabled=(value:unknown)=>value===undefined||value===null||value===false||value===0||value===''||typeof value==='string'&&['0','false','off','none','disabled'].includes(value.toLowerCase());
const normalize=(key:string)=>key.toLowerCase().replace(/[-_\s]/g,'');
const unavailableKeys=new Set(['runittwice','runitthrice','runittimes','bombpot','bombpots','doubleboard','multiplayer','peerplay','tablechat','chat','dealererrors','floorrulings','realtimeassistance','rta','tournament','tournaments','straddle','straddles','ante','antes']);
const flagContainers=new Set(['featureflags','features','experimentalflags','experimental','variants']);

/** Explicitly reject attempted unavailable options rather than preserve a flag
 * that falsely suggests a variant is active. URL/local-storage values are never
 * read here; caller-owned settings/profile validation is the only entry point. */
export function assertSupportedCashScope(candidate:unknown):void {
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error('Cash settings or rule profile required.');
 for(const [key,value] of Object.entries(candidate)){
  const normalized=normalize(key);
  const featureKey=normalized.replace(/^enable/,'').replace(/enabled$/,'');
  // The one supported straddle is the exact live under-the-gun rule object (V410); any other straddle flag stays rejected.
  const liveStraddle=key==='straddle'&&!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.hasOwn(value,'kind')&&Object.hasOwn(value,'multiple')&&(value as Record<string,unknown>).kind==='utg-live'&&(value as Record<string,unknown>).multiple===2;
  if(unavailableKeys.has(featureKey)&&!disabled(value)&&!liveStraddle)throw new Error(`${key} is unsupported in cash R1 and cannot be enabled.`);
  if(['mode','gamemode'].includes(normalized)&&!disabled(value)&&value!=='cash')throw new Error('Only cash mode is supported in R1. Tournament and alternative modes remain unavailable.');
  if(['variant','gametype','game'].includes(normalized)&&!disabled(value)&&!(typeof value==='string'&&['nlhe','nolimittexasholdem','texasholdem','holdem'].includes(normalize(value).replace(/[’']/g,''))))throw new Error('Only No-Limit Texas Hold’em is supported in cash R1.');
  if(['boardcount','runoutcount','runouts'].includes(normalized)&&!disabled(value)&&value!==1&&value!=='1')throw new Error('Multiple boards or runouts are unsupported in cash R1.');
  if(flagContainers.has(normalized)&&!disabled(value)){
   if(typeof value!=='object'||value===null||Array.isArray(value)||Object.values(value).some(flag=>!disabled(flag)))throw new Error('Optional feature flags cannot enable unsupported cash formats in R1.');
  }
 }
}
