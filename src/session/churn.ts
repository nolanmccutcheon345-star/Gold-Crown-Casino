/** Table churn for cash tables (layer human-1.3.0): between hands, busted players rebuy or leave,
 * short stacks top up, players leave after a while (winners hit and run, some losers quit, tilters
 * chase), and someone new sits down in an empty seat: a regular who plays these stakes or a stranger.
 * Deterministic per hand. Applied through the ordinary queued next-hand configuration, so stacks,
 * identities and history follow the existing checked path. Designed behaviour, not fitted data. */
import type {AppData,ActiveTable,CashSettings} from './types';
import {completeProfile,createProfile} from '../bots/profiles';
import {weightsArrayFor} from '../bots/population-benchmarks';
import {tiltProneness} from '../bots/human';
import {REGULARS,regularConfig,regularFor,regularById,regularBuyInForProfile,type Stake} from '../bots/regulars';
import {regularOfProfile} from '../bots/talk';
import {memoryFacts} from './human-memory';
import {cashSessionFacts} from './human-context';
import {occupiedSeatIds} from './configuration';
import {buyInStyle,styleBuyIn} from '../bots/depth';
import {LAST_ORBIT_LINES} from '../bots/routines';
import {MOOD_LEAVE,sessionMoodOf} from '../bots/session-mood';

export const STRANGER_NAMES=['Ray','Lisa','Carlos','Dee','Marty','Wendy','Sonny','Joan','Hector','Trish','Benny','Gail','Rudy','Nora','Vic','Peggy','Abe','Connie','Luis','Bev','Stan','Irene','Otis','Rhonda','Felix','June','Gary','Maxine','Earl','Tina'];
const unit=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
const cashStake=(bigBlind:number):Stake=>bigBlind<=200?'low':bigBlind<=1000?'mid':'high';
/** Layer 1.19.0: what a tilting player says as they reload. */
const RELOAD_LINES=['One more bullet.','I can win it back.','Deal me in, I’m not done.','Same again.'];

/** `changed` false: only news (an announced last orbit), nothing to configure. `lastOrbit`: the next announced-departure state (layer 1.15.0). */
export interface ChurnPlan {settings:CashSettings;news:string[];changed?:boolean;lastOrbit?:Record<number,{personalityId:string;until:number;why:string}>;}
/** What changes before the next hand, or null when the table stays as it is. */
/** `styled` (layer 1.4.0): rebuys, top-ups and newcomers use each player's own buy-in habit, and a
 * short-stacker who has doubled up often leaves with the profit. */
/** `routines` (layer 1.15.0): a player who decides to go announces a last orbit and leaves about one orbit later. */
/** `moods` (layer 1.16.0): session moods change how long players stay, and newcomers say how they feel. */
/** `craft` (layer 1.19.0): stuck players have a limit (a deep loser who is not tilt-prone stops rebuying), tilters
 * reload with a word, regulars keep their stack topped up, and winners leave the way real ones do: regulars lock up
 * a smaller win, recreational players book a big one. */
export function planChurn(data:AppData,active:ActiveTable,styled=false,routines=false,moods=false,craft=false):ChurnPlan|null {
 const session=data.sessions.find(s=>s.id===active.sessionId);if(!session||active.queuedConfiguration||active.exitMode)return null;
 /* Patch 73: a heads-up challenge is a match: nobody comes or goes until it ends. */
 if(session.settings.challenge)return null;
 const settings=structuredClone(session.settings),game=active.game,bb=settings.bigBlind,buyIn=settings.buyIn,hand=game.handId;
 const seats=occupiedSeatIds(settings).filter(id=>id!==0),names=new Set(game.seats.map(s=>s.name));
 const stacks:Record<number,number>={},seatNames:Record<number,string>={},news:string[]=[];let leaves=0;
 const orbit:Record<number,{personalityId:string;until:number;why:string}>=routines?structuredClone(active.lastOrbit??{}):{};const orbitBefore=JSON.stringify(orbit);
 const seated=new Set(seats.map(id=>regularFor(settings.opponents?.[id-1])?.id).filter(Boolean) as string[]);
 const newcomer=(id:number,left:string|undefined)=>{
  const roll=unit(`${hand}:${id}:who`),pool=REGULARS.filter(r=>r.stakes.includes(cashStake(bb))&&!seated.has(r.id)&&!names.has(r.name)&&r.id!==left);
  const sit=(config:NonNullable<CashSettings['opponents']>[number])=>{settings.opponents![id-1]=config;
   const profile=styled?createProfile(config,config.personalitySeed??0,settings.population??'neutral',settings.venue==='live'?weightsArrayFor(settings.population??'neutral','live'):undefined):null;
   stacks[id]=profile?styleBuyIn(buyInStyle(profile,regularBuyInForProfile(profile)),settings):buyIn;};
  if(roll<.5&&pool.length){const r=pool[Math.floor(unit(`${hand}:${id}:reg`)*pool.length)];seated.add(r.id);sit(regularConfig(r.id));names.add(r.name);return r.name;}
  const free=STRANGER_NAMES.filter(n=>!names.has(n)),name=free[Math.floor(unit(`${hand}:${id}:name`)*free.length)]??`Player ${id+1}`;names.add(name);
  sit({selection:'random',personalitySeed:Math.floor(unit(`${hand}:${id}:seed`)*0xffffffff)>>>0});seatNames[id]=name;return name;
 };
 for(const id of seats){
  const seat=game.seats.find(s=>s.id===id),profile=active.profiles[id];if(!seat||!profile)continue;
  const p=completeProfile(profile),name=seat.name,regular=regularOfProfile(profile),facts=data.humanMemory?memoryFacts(data.humanMemory,active,id):cashSessionFacts(data.hands,active,id),prone=tiltProneness(p),r=(k:string)=>unit(`${hand}:${id}:${k}`);
  const replace=(why:string)=>{const who=newcomer(id,regular);news.push(`${name} ${why}. ${who} sits down.`);leaves++;};
  const style=styled?buyInStyle(profile,regularBuyInForProfile(profile)):'standard',own=styled?styleBuyIn(style,settings):buyIn;
  if(seat.stack===0){
   const limit=craft&&facts.netBB<-250&&prone<=.5;
   const rebuy=limit?.25:facts.netBB<-100&&prone>.5?.9:p.skill<.5?.8:.55;
   if(leaves>=1||r('rebuy')<rebuy){stacks[id]=own;news.push(`${name} rebuys.`);if(craft&&facts.netBB<-100&&prone>.5)news.push(`${name}: “${RELOAD_LINES[Math.floor(r('reload')*RELOAD_LINES.length)]}”`);}else if(leaves<1)replace(limit?'hits their limit and leaves':'busts and leaves');
   continue;
  }
  if(craft&&settings.allowTopUp&&p.skill>=.65&&seat.stack<.85*own&&r('topup-reg')<.6){stacks[id]=own;news.push(`${name} tops up.`);continue;}
  if(settings.allowTopUp&&seat.stack<.4*own&&r('topup')<(p.skill>=.6||style==='short'?.7:.25)){stacks[id]=own;news.push(`${name} tops up.`);continue;}
  if(routines){const o=orbit[id];
   if(o&&o.personalityId!==profile.personalityId)delete orbit[id];
   else if(o){if(facts.hands>=o.until&&leaves<1){delete orbit[id];replace(o.why);}continue;}
  }
  if(leaves>=1||facts.hands<15)continue;
  if(styled&&style==='short'&&seat.stack>=2*own&&facts.netBB*bb>=own&&r('double')<.12){replace('doubles up and leaves');continue;}
  let hazard=1/(110+180*p.skill);
  if(facts.netBB>=100&&p.skill>=.6)hazard*=3;// hit and run
  else if(craft&&facts.netBB>=60&&p.skill>=.6)hazard*=2;// a regular locks up a smaller win
  if(craft&&facts.netBB>=150&&p.skill<.5)hazard*=2.2;// a recreational player books a big one
  if(facts.netBB<=-100)hazard*=prone<.4?2.5:.4;// quit when stuck, or chase
  if(facts.hands>200)hazard*=1.5;
  if(moods)hazard*=MOOD_LEAVE[sessionMoodOf(`${active.sessionId}:${id}:${profile.personalityId??''}`,profile)];
  const why=craft&&facts.netBB>=150&&p.skill<.5?'books the win and leaves':facts.netBB>=100?'racks up and leaves':facts.netBB<=-100?'calls it a night':'leaves the table';
  if(r('leave')<hazard){
   // Layer 1.15.0: announce it and play one more orbit first.
   if(routines&&profile.personalityId){orbit[id]={personalityId:profile.personalityId,until:facts.hands+game.seats.length,why};news.push(`${name}: “${LAST_ORBIT_LINES[Math.floor(r('orbit')*LAST_ORBIT_LINES.length)]}”`);}
   else replace(why);
  }
 }
 const orbitChanged=routines&&JSON.stringify(orbit)!==orbitBefore;
 if(!news.length&&!orbitChanged)return null;
 const changed=Object.keys(stacks).length>0||leaves>0;
 settings.seatStacks=stacks;if(Object.keys(seatNames).length)settings.seatNames=seatNames;
 return routines?{settings,news,changed,lastOrbit:orbit}:{settings,news};
}
export const regularName=(id:string)=>regularById(id)?.name;
