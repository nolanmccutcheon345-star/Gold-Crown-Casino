import type {AppData,CashSession} from '../session/types';
import {deriveCashStats,type CashStats} from '../stats/cash';
import {getArchiveContext,isVerifiedSnapshot} from '../storage/verified';

export interface CashResultsFilter {sessionId:string;stake:string}
export const ALL_CASH_RESULTS_FILTER:Readonly<CashResultsFilter>=Object.freeze({sessionId:'all',stake:'all'});
export interface FilteredCashResults {
 stats:CashStats;
 /** False means the session clock cannot be assigned to this hand subset.
  * Render time as unavailable, not as the zero sentinel in CashStats. */
 hoursAvailable:boolean;
 unavailableSessionIds:string[];
 disclosure:string;
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);
const stakeKey=(value:{smallBlind:number;bigBlind:number})=>`${value.smallBlind}/${value.bigBlind}`;
const stakeLabel=(value:{smallBlind:number;bigBlind:number})=>`$${(value.smallBlind/100).toFixed(2)} / $${(value.bigBlind/100).toFixed(2)}`;
const matchesSession=(sessionId:string,filter:CashResultsFilter)=>filter.sessionId==='all'||sessionId===filter.sessionId;
const FILTER_DISCLOSURE='Filters apply to completed local cash hands only. Manual bankroll edits, transfers, unfinished hands and imported study records are excluded. BB/100 uses each hand’s own big blind. Tournament ROI, ITM, finish and fees are unsupported and are never combined with cash results.';

function requireVerified(data:AppData):void {
 if(!isVerifiedSnapshot(data))throw Error('Cash results filters require a verified canonical snapshot.');
}
function sessionStakes(session:CashSession):string[] {
 return [stakeKey(session.profile),...(session.configurationHistory??[]).map(entry=>stakeKey(entry.rules))];
}

/** The integrator loads/audits the complete archive before applying a filter.
 * No ledger or imported history enters the independent cash calculation. */
export function deriveFilteredCashStats(data:AppData,filter:CashResultsFilter,now=Date.now()):FilteredCashResults {
 requireVerified(data);
 if(getArchiveContext(data)?.handOffset)throw Error('Cash results filters require the full canonical archive, not a compact resident tail.');
 const candidates=data.hands.filter(hand=>matchesSession(hand.sessionId,filter));
 const hands=filter.stake==='all'?candidates:candidates.filter(hand=>stakeKey(hand.view.profile)===filter.stake);
 const handSessionIds=new Set(hands.map(hand=>hand.sessionId));
 const sessions=data.sessions.filter(session=>session.profile.mode==='cash'&&matchesSession(session.id,filter)&&(filter.stake==='all'||handSessionIds.has(session.id)));
 const unavailable=new Set<string>();
 if(filter.stake!=='all'){
  for(const session of sessions)if(sessionStakes(session).some(stake=>stake!==filter.stake))unavailable.add(session.id);
  for(const hand of candidates)if(handSessionIds.has(hand.sessionId)&&stakeKey(hand.view.profile)!==filter.stake)unavailable.add(hand.sessionId);
 }
 const stats=deriveCashStats(hands,sessions,now);
 // A recorded session clock has no per-stake allocation. Zero is only an
 // internal sentinel because CashStats.activeMs is non-nullable; callers must
 // use hoursAvailable/unavailableSessionIds to display an em dash.
 if(unavailable.size){
  stats.activeMs=0;stats.perHour=null;
  stats.sessions=stats.sessions.map(session=>unavailable.has(session.id)?{...session,activeMs:0,perHour:null}:session);
  stats.activeSession=stats.sessions.find(session=>session.endedAt===null)??null;
 }
 if(filter.stake!=='all')stats.configurationHistory=stats.configurationHistory.filter(row=>stakeKey(row)===filter.stake);
 const hoursAvailable=unavailable.size===0;
 const timing=hoursAvailable?'Recorded playing time and app-clock $/hour use the complete selected sessions; pauses, hidden-tab time and closed-browser time are excluded.'
  :'Playing time and app-clock $/hour are unavailable for this stake subset: a session contains other stakes, and its whole clock cannot be allocated to selected hands. Choose All stakes to view complete session time.';
 const disclosure=`${stats.hands} selected completed cash hands. ${FILTER_DISCLOSURE} ${timing}`;
 return {stats,hoursAvailable,unavailableSessionIds:[...unavailable],disclosure};
}

/** Read-only controls can use the verified compact checkpoint before the full
 * archive is requested. Only public session dates and blind amounts are shown. */
export function cashResultsFilterMarkup(data:AppData,filter:CashResultsFilter,disabled=false):string {
 requireVerified(data);
 const sessions=data.sessions.filter(session=>session.profile.mode==='cash'),stakes=new Map<string,string>();
 const addStake=(profile:{smallBlind:number;bigBlind:number})=>stakes.set(stakeKey(profile),stakeLabel(profile));
 for(const session of sessions){addStake(session.profile);for(const entry of session.configurationHistory??[])addStake(entry.rules);}
 for(const hand of data.hands)if(hand.view.profile.mode==='cash')addStake(hand.view.profile);
 for(const group of getArchiveContext(data)?.statistics.stakes??[]){
  const [smallBlind,bigBlind]=group.key.split('/').map(Number);addStake({smallBlind,bigBlind});
 }
 const option=(value:string,label:string,selected:string)=>`<option value="${escape(value)}"${value===selected?' selected':''}>${escape(label)}</option>`;
 const sessionOptions=option('all','All sessions',filter.sessionId)+sessions.map((session,index)=>option(session.id,`Session ${index+1} · ${new Date(session.startedAt).toLocaleString()}${session.endedAt===null?' · active':''}`,filter.sessionId)).join('');
 const stakeOptions=option('all','All stakes',filter.stake)+[...stakes].sort(([a],[b])=>Number(a.split('/')[1])-Number(b.split('/')[1])||Number(a.split('/')[0])-Number(b.split('/')[0])).map(([value,label])=>option(value,label,filter.stake)).join('');
 return `<div class="history-filters results-filters"><label for="results-filter-session">Results session<select id="results-filter-session" aria-describedby="results-filter-disclosure"${disabled?' disabled':''}>${sessionOptions}</select></label><label for="results-filter-stake">Results stakes<select id="results-filter-stake" aria-describedby="results-filter-disclosure"${disabled?' disabled':''}>${stakeOptions}</select></label></div><p class="muted" id="results-filter-disclosure" data-testid="results-filter-disclosure">${FILTER_DISCLOSURE} A partial stake filter cannot assign a session’s playing time to individual hands; its time and app-clock $/hour remain unavailable.</p>`;
}
