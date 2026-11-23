import type { HeroViewModel } from '../contracts';
import type { CashSession, StoredHand } from '../session/types';
import {isCashPerformanceHand} from '../session/hand-provenance';
import {deriveConfigurationHistory,type ConfigurationHistoryRow} from './configuration-history';
export type {ConfigurationHistoryRow} from './configuration-history';

export type MetricKey = 'vpip'|'pfr'|'threeBet'|'foldToThreeBet'|'raise'|'checkRaise'|'foldToCbet'|'wtsd'|'wsd'|'wwsf';
export interface RateStat { numerator:number; denominator:number; percent:number|null; ci95:[number,number]|null; status:'NO_OPPORTUNITIES'|'INSUFFICIENT_SAMPLE'|'DESCRIPTIVE'; }
export interface ResultGroup { key:string; label:string; hands:number; profit:number; bb100:number|null; rake:number; }
export interface CashSessionStats extends ResultGroup { id:string; startedAt:string; endedAt:string|null; activeMs:number; perHour:number|null; }
export interface CashStats extends ResultGroup {
 namespace:'cash'; activeMs:number; perHour:number|null; winningSessions:number; losingSessions:number; evenSessions:number;
 activeSession:CashSessionStats|null; sessions:CashSessionStats[]; mixedStakes:boolean;
 metrics:Record<MetricKey,RateStat>; positions:ResultGroup[]; stakes:ResultGroup[]; configurations:ResultGroup[];
 configurationHistory:ConfigurationHistoryRow[];
 disclosure:string; opportunityCoverage:{completeHands:number; missingFrames:number};
}
export const STAT_DEFINITIONS:Record<MetricKey,string> = {
 vpip:'Hands with a voluntary preflop call or raise / hands with at least one voluntary preflop decision. Forced blinds, forced all-ins and walks without a decision are excluded.',
 pfr:'Hands with a preflop raise / hands with at least one legal preflop raise opportunity. A legal short all-in raise counts; all-in-only calls and closed raising do not create a raise opportunity.',
 threeBet:'Hands raising after exactly one prior preflop raise / hands where Hero faces exactly one prior preflop raise and can legally raise. Count each eligible hand once; forced all-in/no-raise situations are excluded.',
 foldToThreeBet:'Hands folding to the first re-raise after Hero opened / hands where Hero is the original preflop opener and must respond to that re-raise before a fourth bet. No response opportunity when already all-in.',
 raise:'Postflop decisions raising / postflop decisions facing a bet with legal raising rights. Includes legal short all-in raises; excludes opening bets, all-in-only calls and betting not reopened.',
 checkRaise:'Postflop first responses to a bet after Hero checked on that street that raise / such responses with legal raising rights. Calling or folding consumes that opportunity; a later re-raise after calling is not a check-raise. Multiple opponents do not remove an otherwise legal opportunity.',
 foldToCbet:'Flops folding to the first bet by the last preflop raiser / flops with a legal Hero response to that bet before an intervening raise. Earlier donk bets, delayed turn bets, already-all-in players and absent preflop raises are excluded; intervening calls are allowed.',
 wtsd:'Hands reaching showdown with Hero still eligible / hands in which Hero saw the flop. Preflop folds are excluded even if other players subsequently run out the board.',
 wsd:'Showdowns where Hero receives any positive pot award / showdowns reached by Hero. A split pot counts as a win; this is not positive-net-hand frequency.',
 wwsf:'Hands where Hero receives any positive pot award after seeing the flop / hands where Hero saw the flop. Includes uncontested postflop wins and splits.',
};
/** Public provenance only: do not read archetypes, traits, personality IDs or decisions. */
export function frozenPolicyVersions(profiles:Record<number,{policyVersion:string}>):string[] {
 return [...new Set(Object.values(profiles).map(profile=>profile.policyVersion).filter(version=>typeof version==='string'&&version.length>0))].sort();
}
export const CASH_STAT_FORMULAS = {
 profit:'Sum of completed hand (ending Hero stack − starting Hero stack); excludes deposits, top-ups, cashouts, manual edits/resets and unfinished hands.',
 bb100:'100 × sum(each completed hand net / that hand\'s big blind) / completed hands. Mixed-stake result is hand-weighted big blinds, not total cash divided by one blind.',
 perHour:'Settled profit × 3,600,000 / recorded active milliseconds. Explicit pauses/hidden/closed time are excluded by the session clock; playback speed affects this simulator rate.',
 rake:'Contributed attribution: each seat gets floor(hand rake × post-refund commitment / total post-refund commitment); remaining cents go clockwise after button among contributors. This attribution is not an extra wallet debit; poker net already includes rake.',
 uncertainty:'Rate intervals are descriptive 95% Wilson intervals, not a calibrated skill estimate. Hands in a session are correlated; intervals may be too narrow. Fewer than 100 opportunities are labeled insufficient sample. Financial results have no invented EV or profitability confidence claim.',
} as const;
const keys:MetricKey[]=['vpip','pfr','threeBet','foldToThreeBet','raise','checkRaise','foldToCbet','wtsd','wsd','wwsf'];
const ratio=(numerator:number,denominator:number):RateStat=>{
 if(!denominator)return {numerator,denominator,percent:null,ci95:null,status:'NO_OPPORTUNITIES'};
 const p=numerator/denominator,z=1.959963984540054,d=1+z*z/denominator;
 const center=(p+z*z/(2*denominator))/d,margin=z*Math.sqrt((p*(1-p)+z*z/(4*denominator))/denominator)/d;
 return {numerator,denominator,percent:p*100,ci95:[Math.max(0,center-margin)*100,Math.min(1,center+margin)*100],status:denominator<100?'INSUFFICIENT_SAMPLE':'DESCRIPTIVE'};
};

/** Integer-cent, table-wide exact rake allocation for a clearly named reporting convention. */
export function contributedRake(view:HeroViewModel):Record<number,number> {
 const shares:Record<number,number>={};const total=view.seats.reduce((sum,s)=>sum+s.totalCommitted,0);
 for(const seat of view.seats)shares[seat.id]=total?Number(BigInt(view.rake)*BigInt(seat.totalCommitted)/BigInt(total)):0;
 let remainder=view.rake-Object.values(shares).reduce((a,b)=>a+b,0);
 const seats=[...view.seats].sort((a,b)=>a.id-b.id),i=seats.findIndex(s=>s.id===view.button);
 for(const seat of [...seats.slice(i+1),...seats.slice(0,i+1)]) if(remainder>0&&seat.totalCommitted>0){shares[seat.id]++;remainder--;}
 if(remainder!==0)throw new Error('Rake attribution cannot reconcile');
 return shares;
}
export function heroPosition(view:HeroViewModel):string {
 if(view.seats.length===2)return view.button===0?'BTN/SB':'BB';
 if(view.button===0)return 'BTN';if(view.smallBlindSeat===0)return 'SB';if(view.bigBlindSeat===0)return 'BB';
 const ids=view.seats.map(s=>s.id).sort((a,b)=>a-b),i=ids.indexOf(view.bigBlindSeat);
 const others=[...ids.slice(i+1),...ids.slice(0,i+1)].filter(id=>![view.button,view.smallBlindSeat,view.bigBlindSeat].includes(id));
 const index=others.indexOf(0),fromEnd=others.length-index;
 if(fromEnd===1)return 'CO';if(fromEnd===2)return 'HJ';if(fromEnd===3)return 'LJ';
 return index===0?'UTG':`UTG+${index}`;
}
function handOpportunities(hand:StoredHand):{values:Record<MetricKey,[number,number]>;complete:boolean} {
 const values=Object.fromEntries(keys.map(key=>[key,[0,0]])) as Record<MetricKey,[number,number]>;
 // Frames are keyed by the exact committed pre-action revision, never reconstructed
 // from final stacks or future actions. Index once instead of scanning for every node.
 const frames=new Map(hand.frames.map(frame=>[`${frame.revision}:${frame.actor}`,frame]));
 const actions=hand.view.events.filter(e=>e.type==='action');
 let raises=0,opener:number|undefined,lastPreflopRaiser:number|undefined;
 let vpip=false,pfr=false,voluntaryOpportunity=false,raiseOpportunity=false,threeOpportunity=false,threeSuccess=false,foldThreeOpportunity=false,foldThreeSuccess=false,preflopComplete=true,postflopComplete=true;
 for(const event of actions.filter(e=>e.street==='preflop')) {
  if(event.seatId===0) {
   const frame=frames.get(`${event.revision-1}:0`);if(!frame)preflopComplete=false;
   if(frame) {
    voluntaryOpportunity=true;
    if(frame.legal.canRaise||frame.legal.shortAllInTo!==null)raiseOpportunity=true;
    if(raises===1&&(frame.legal.canRaise||frame.legal.shortAllInTo!==null)) {
     threeOpportunity=true;if(event.action?.type==='raise')threeSuccess=true;
    }
    if(raises===2&&opener===0&&frame.legal.callAmount>0) {
     foldThreeOpportunity=true;if(event.action?.type==='fold')foldThreeSuccess=true;
    }
   }
   if((event.action?.type==='call'||event.action?.type==='raise')&&(event.amount??0)>0)vpip=true;
   if(event.action?.type==='raise')pfr=true;
  }
  if(event.action?.type==='raise'){if(raises===0)opener=event.seatId;lastPreflopRaiser=event.seatId;raises++;}
 }
 // Incomplete imported/legacy frames cannot establish eligible-node denominators.
 if(preflopComplete){
  values.vpip=[Number(vpip&&voluntaryOpportunity),Number(voluntaryOpportunity)];
  values.pfr=[Number(pfr&&raiseOpportunity),Number(raiseOpportunity)];
  values.threeBet=[Number(threeSuccess),Number(threeOpportunity)];
  values.foldToThreeBet=[Number(foldThreeSuccess),Number(foldThreeOpportunity)];
 }
 let street:string|undefined,checked=false,streetWagered=false,facingCbet=false;
 for(const event of actions.filter(e=>e.street!=='preflop')) {
  if(event.street!==street){street=event.street;checked=false;streetWagered=false;facingCbet=false;}
  if(event.seatId===0) {
   const frame=frames.get(`${event.revision-1}:0`);
   if(!frame)postflopComplete=false;
   if(frame&&frame.legal.callAmount>0) {
    const canRaise=frame.legal.canRaise||frame.legal.shortAllInTo!==null;
    if(canRaise){values.raise[1]++;if(event.action?.type==='raise')values.raise[0]++;}
    if(checked&&canRaise){values.checkRaise[1]++;if(event.action?.type==='raise')values.checkRaise[0]++;}
    if(facingCbet){values.foldToCbet[1]++;if(event.action?.type==='fold')values.foldToCbet[0]++;}
    checked=false;facingCbet=false;
   }
   if(event.action?.type==='check')checked=true;
  }
  if(event.action?.type==='raise') {
   // The engine names both opening bets and raises "raise". Only the first
   // flop wager by the final preflop aggressor is a flop continuation bet.
   facingCbet=street==='flop'&&!streetWagered&&event.seatId===lastPreflopRaiser&&event.seatId!==0;
   streetWagered=true;
  }
 }
 if(!postflopComplete)for(const key of ['raise','checkRaise','foldToCbet'] as const)values[key]=[0,0];
 const preflopFold=actions.some(e=>e.seatId===0&&e.street==='preflop'&&e.action?.type==='fold');
 const sawFlop=hand.view.board.length>=3&&!preflopFold;
 const showdown=Object.hasOwn(hand.view.handLabels,0),won=(hand.view.payouts[0]??0)>0;
 values.wtsd=[Number(sawFlop&&showdown),Number(sawFlop)];values.wsd=[Number(showdown&&won),Number(showdown)];values.wwsf=[Number(sawFlop&&won),Number(sawFlop)];
 return {values,complete:preflopComplete&&postflopComplete};
}
function totals(hands:StoredHand[],key:string,label:string):ResultGroup {
 const byBlind=new Map<number,number>();
 for(const hand of hands)byBlind.set(hand.view.profile.bigBlind,(byBlind.get(hand.view.profile.bigBlind)??0)+hand.net);
 const bbWon=[...byBlind].reduce((sum,[blind,net])=>sum+net/blind,0);
 return {key,label,hands:hands.length,profit:hands.reduce((sum,h)=>sum+h.net,0),bb100:hands.length?100*bbWon/hands.length:null,rake:hands.reduce((sum,h)=>sum+(contributedRake(h.view)[0]??0),0)};
}
function grouped(hands:StoredHand[],getKey:(h:StoredHand)=>[string,string]):ResultGroup[] {
 const groups=new Map<string,{label:string;hands:StoredHand[]}>();
 for(const hand of hands){const [key,label]=getKey(hand);const group=groups.get(key)??{label,hands:[]};group.hands.push(hand);groups.set(key,group);}
 return [...groups].map(([key,group])=>totals(group.hands,key,group.label));
}
/** Only canonical settled cash records enter these statistics; external ledger adjustments never do. */
export function deriveCashStats(records:StoredHand[],sessions:CashSession[],now=Date.now()):CashStats {
 const seen=new Set<string>();
 const hands=records.filter(h=>h.view.street==='complete'&&h.view.profile.mode==='cash'&&isCashPerformanceHand(h,'cash')).filter(h=>{if(seen.has(h.id))throw new Error('Duplicate canonical hand ID');seen.add(h.id);return true;});
 const opportunities=hands.map(handOpportunities);
 const metrics=Object.fromEntries(keys.map(key=>[key,ratio(opportunities.reduce((sum,h)=>sum+h.values[key][0],0),opportunities.reduce((sum,h)=>sum+h.values[key][1],0))])) as Record<MetricKey,RateStat>;
 const sessionResults=sessions.map(s=>{
  const activeMs=s.activeMs+(s.endedAt===null&&s.lastActiveAt!==null?Math.max(0,now-s.lastActiveAt):0);
  const result=totals(hands.filter(h=>h.sessionId===s.id),s.id,s.startedAt);
  return {...result,id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,activeMs,perHour:activeMs>0?result.profit*3600000/activeMs:null};
 });
 const activeMs=sessionResults.reduce((sum,s)=>sum+s.activeMs,0),all=totals(hands,'cash','All cash hands');
 const stakes=grouped(hands,h=>[`${h.view.profile.smallBlind}/${h.view.profile.bigBlind}`,`$${h.view.profile.smallBlind/100}/$${h.view.profile.bigBlind/100}`]);
 return {...all,namespace:'cash',activeMs,perHour:activeMs>0?all.profit*3600000/activeMs:null,metrics,sessions:sessionResults,
  winningSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit>0).length,losingSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit<0).length,evenSessions:sessionResults.filter(s=>s.endedAt!==null&&s.profit===0).length,
  activeSession:sessionResults.find(s=>s.endedAt===null)??null,mixedStakes:stakes.length>1,stakes,
  positions:grouped(hands,h=>[heroPosition(h.view),heroPosition(h.view)]),configurationHistory:deriveConfigurationHistory(hands,sessions),
  configurations:grouped(hands,h=>{const p=h.view.profile,policies=frozenPolicyVersions(h.privateProfiles);const key=JSON.stringify([h.view.seats.length,p.smallBlind,p.bigBlind,p.id,p.version,p.rake,policies]);return [key,`${h.view.seats.length} seats · $${p.smallBlind/100}/$${p.bigBlind/100} · Rules ${p.id}@${p.version} · Policies ${policies.join(', ')||'unrecorded'} · ${p.rake.basisPoints/100}% rake / $${p.rake.cap/100} cap${p.rake.noFlopNoDrop?' / no flop no drop':''}`];}),
  disclosure:`Observed virtual cash simulation only. ${hands.length} settled hands; ${sessionResults.length} sessions. ${CASH_STAT_FORMULAS.uncertainty} ${CASH_STAT_FORMULAS.rake}`,
  opportunityCoverage:{completeHands:opportunities.filter(h=>h.complete).length,missingFrames:opportunities.filter(h=>!h.complete).length},
 };
}

export interface LivePaceProjection {
 kind:'hypothetical-live-pace'; assumedHandsPerHour:number; liveEquivalentHours:number;
 projectedBBPerHour:number|null; projectedProfitPerHour:number|null;
 actualActiveMs:number; actualProfitPerHour:number|null; mixedStakes:boolean; disclosure:string;
}
/** A pace assumption applied to observed hand results, never added to any ledger. */
export function projectLivePace(stats:Pick<CashStats,'hands'|'profit'|'bb100'|'activeMs'|'perHour'> & {mixedStakes?:boolean},handsPerHour=30):LivePaceProjection {
 if(!Number.isFinite(handsPerHour)||handsPerHour<=0)throw new Error('Assumed hands/hour must be positive and finite');
 return {kind:'hypothetical-live-pace',assumedHandsPerHour:handsPerHour,liveEquivalentHours:stats.hands/handsPerHour,
  projectedBBPerHour:stats.bb100===null?null:stats.bb100*handsPerHour/100,
  projectedProfitPerHour:stats.hands?stats.profit/stats.hands*handsPerHour:null,
  actualActiveMs:stats.activeMs,actualProfitPerHour:stats.perHour,mixedStakes:stats.mixedStakes??false,
  disclosure:`Hypothetical projection at an assumed ${handsPerHour} hands/hour, using this simulator's observed per-hand results and stake mix. Live-equivalent hours are not elapsed time. Projected cash/hour uses observed cash per hand, never a selected current blind; projected BB/hour uses per-hand-normalized BB/100. This is not measured live earnings or evidence of real-world profitability.`,
 };
}
