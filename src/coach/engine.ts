/** Phase 3: the decision layer of the playbook's Coach Engine Spec.
 *
 * The Live coach (coach.ts) recommends a play; this module holds the spec's checkable machinery underneath it:
 * spot classification, the exact price math (pot odds, alpha, MDF, SPR commit equity), EV comparisons of the
 * legal actions where the spec's math supports them, per-stake pool profiles, chart coverage (which playbook
 * chart governs this spot — and an honest gap where none does), and the tournament layer (stage, risk premium,
 * bubble factor) that makes tournament advice differ from cash advice in substance, not just in label.
 *
 * Everything here is a pure function of what Hero can see (the HeroViewModel and the options the app passes).
 * It never reads another seat's cards, never touches the rules engine, and every number it returns carries the
 * coach's basis discipline: exact (counted), estimate (vs an assumed range), pool (recorded pool averages),
 * rule (a rule of thumb from the playbook), icm (computed from the payout context with the repo's ICM model).
 * Where the playbook's data does not cover a spot, coverage says so — the coach then gives a principle-based
 * read and labels it as one, instead of fabricating chart precision. */
import type {HeroViewModel} from '../contracts';
import {icmBubbleFactor} from '../tournament/icm';
import {positionOf} from '../stats/leaks';
import {depthBand,rfiChart} from './ranges';

export type Basis='exact'|'estimate'|'pool'|'rule'|'measured'|'icm';
export type StakeBand='micro'|'low'|'mid'|'high';

/* ------------------------------------------------------------------ *
 * Pool profiles. The playbook's live database is one mixed-stakes set (coach.ts POOL — the default).
 * Two sourced adjustments exist for lower stakes, and only those are applied:
 *  - c-bet folds run about 40% on every texture in database checks (Master NLHE rule 141:
 *    ~43% dry, ~39% drawy — the old dry/wet split is falsified), so low-stakes flop folds sit at ~41%.
 *  - low-stakes river bluffing is far below the live-pool average: a low-stakes triple barrel is
 *    bluffing only ~10–15% of the time (rule 107), and small-stakes river raises are almost never
 *    bluffs (rule 156). Micro takes the low end of that band.
 * Mid and high stakes have no separate sourced profile in the playbook, so they use the live-mixed
 * set and say so — inventing per-stake numbers would break the basis discipline.
 * ------------------------------------------------------------------ */
export interface PoolProfile {flopFoldThird:number;flopFold:number;turnFold:number;riverFold:number;foldToThreeBet:number;riverBluffShare:number;label:string;source:string}
export const LIVE_MIXED:PoolProfile={flopFoldThird:.31,flopFold:.42,turnFold:.40,riverFold:.49,foldToThreeBet:.34,riverBluffShare:.32,
 label:'live pool (mixed stakes)',source:'the playbook’s live-pool database averages'};
const LOW_STAKES:PoolProfile={...LIVE_MIXED,flopFold:.41,riverBluffShare:.13,
 label:'low-stakes pool',source:'Master NLHE rules 141 (c-bet folds ≈40% on all textures) and 107 (low-stakes river bluffs ≈10–15%)'};
const MICRO_STAKES:PoolProfile={...LOW_STAKES,riverBluffShare:.10,
 label:'micro-stakes pool',source:'Master NLHE rules 107 and 156 (small-stakes river aggression is almost never a bluff)'};
export function poolFor(stake?:StakeBand):PoolProfile {
 if(stake==='micro')return MICRO_STAKES;
 if(stake==='low')return LOW_STAKES;
 return LIVE_MIXED;
}

/* ------------------------------------------------------------------ *
 * Spot classification: what kind of decision this is, in the spec's terms.
 * ------------------------------------------------------------------ */
export type SpotKind='unopened'|'facing-open'|'facing-3bet'|'facing-4bet-plus'|'facing-bet'|'facing-raise'|'free';
export interface Spot {kind:SpotKind;street:string;position:string;playersIn:number;effectiveBB:number;spr:number|null;label:string}
function preflopRaises(view:HeroViewModel):number {
 return view.events.filter(e=>e.type==='action'&&e.street==='preflop'&&e.action?.type==='raise').length;
}
export function classifySpot(view:HeroViewModel):Spot {
 const hero=view.seats.find(s=>s.id===0)!,bb=view.profile.bigBlind;
 const live=view.seats.filter(s=>!s.folded),playersIn=live.length;
 const heroStart=hero.stack+hero.totalCommitted;
 const eff=Math.min(heroStart,Math.max(...live.filter(s=>s.id!==0).map(s=>s.stack+s.totalCommitted),0));
 const effectiveBB=bb>0?eff/bb:0,spr=view.street==='preflop'?null:Math.min(hero.stack,Math.max(...live.filter(s=>s.id!==0).map(s=>s.stack),0))/Math.max(1,view.pot);
 const position=positionOf(view,0),call=view.legal.callAmount;
 let kind:SpotKind;
 if(view.street==='preflop'){
  const r=preflopRaises(view);
  kind=r===0?'unopened':r===1?'facing-open':r===2?'facing-3bet':'facing-4bet-plus';
 } else kind=call===0?'free':hero.streetCommitted>0?'facing-raise':'facing-bet';
 const streetName=view.street==='preflop'?'Preflop':view.street[0].toUpperCase()+view.street.slice(1);
 const kindName:Record<SpotKind,string>={unopened:'first in', 'facing-open':'facing an open', 'facing-3bet':'facing a 3-bet', 'facing-4bet-plus':'facing 4-bet+ action', 'facing-bet':'facing a bet', 'facing-raise':'facing a raise', free:'checked to you / first to act'};
 const label=`${streetName} · ${kindName[kind]} · ${playersIn===2?'heads-up':`${playersIn} players in`} · ${position}${spr!==null?` · SPR ${spr.toFixed(1)}`:` · ${Math.round(effectiveBB)}bb effective`}`;
 return {kind,street:view.street,position,playersIn,effectiveBB,spr,label};
}

/* ------------------------------------------------------------------ *
 * The exact price math (Master NLHE §8.1, rules 4–5).
 * ------------------------------------------------------------------ */
/** The share of the time a call must win to break even: call ÷ (pot after the call). */
export const requiredEquity=(pot:number,call:number):number=>call>0?call/(pot+call):0;
/** Alpha: the fold share a pure bluff of this size needs to break even, bet ÷ (bet + pot). */
export const alpha=(bet:number,pot:number):number=>bet>0?bet/(bet+pot):0;
/** Minimum defense frequency: pot ÷ (bet + pot) = 1 − alpha. A river, polarized-range tool (rule 7). */
export const mdf=(bet:number,pot:number):number=>pot>0?pot/(bet+pot):1;
/** SPR commit equity (rule 4, with the playbook's own correction to rule 168: this ladder is the equity a
 * hand needs to commit at a given SPR — it is not a bet-size table). SPR 1 → 33%, 2 → 40%, 3 → 43%;
 * above about 4, one pair cannot stack off at all, so the ladder stops there. */
export function commitEquity(spr:number):number {
 if(spr<=1)return .33;if(spr>=3)return .43;
 return spr<=2?.33+(spr-1)*.07:.40+(spr-2)*.03;
}

/* ------------------------------------------------------------------ *
 * EV comparisons. Chip EV relative to folding (fold = 0), in chips; callers convert to big blinds.
 * These are the spec's formulas, fed with the coach's labelled equity estimates — they rank the
 * alternatives; they are not solver output and are always shown with the estimate basis.
 * ------------------------------------------------------------------ */
export interface Alternative {action:string;ev:number|null;basis:Basis;note:string;recommended?:boolean;
 /** The EV pre-formatted by the coach (e.g. "+2.3 bb"), since the panel does not know the blind size. */
 evLabel?:string}
/** EV of calling: win (pot + call) with probability eq, having added `call`. */
export const callEv=(eq:number,pot:number,call:number):number=>eq*(pot+call)-call;
/** EV of a bet that is never raised: folds win the pot; calls play out at eqWhenCalled. */
export const betEv=(foldShare:number,eqWhenCalled:number,pot:number,bet:number):number=>foldShare*pot+(1-foldShare)*(eqWhenCalled*(pot+bet)-bet);
/** EV of a raise over a bet: the bettor folds `foldShare` (hero takes the pot as it stands), or calls the
 * extra `callerAdds`, after which the pot plays out at eqVsContinue. `added` is what hero puts in beyond
 * what is already committed on this street. */
export const raiseEv=(foldShare:number,eqVsContinue:number,pot:number,added:number,callerAdds:number):number=>
 foldShare*pot+(1-foldShare)*(eqVsContinue*(pot+added+callerAdds)-added);

/* ------------------------------------------------------------------ *
 * Chart coverage: which playbook chart governs this spot — or an honest gap.
 * ------------------------------------------------------------------ */
export interface Coverage {chart:string|null;source:string;gap:string|null}
export function chartCoverage(view:HeroViewModel):Coverage {
 const spot=classifySpot(view),raises=preflopRaises(view);
 if(view.street==='preflop'){
  if(spot.kind==='unopened'){
   const chart=rfiChart(view.seats.length);
   return {chart:chart.id,source:chart.source,gap:null};
  }
  if(spot.kind==='facing-open')return {chart:'3bet-call-charts',source:'Red Chip 6-max and live 9-handed 3-bet/call charts, captured in the playbook’s Preflop Ranges tab',gap:null};
  if(spot.kind==='facing-3bet')return {chart:'defend-vs-3bet',source:'Janda defending vs 3-bets (Book 1, Part Two) and Master NLHE §8.5 continuing shares',gap:null};
  return {chart:null,source:'',gap:'No full chart for 4-bet+ pots at this depth in the playbook — principle-based read (price against a tiny range):'};
 }
 if(raises>=3)return {chart:null,source:'',gap:'No chart for this spot (a 4-bet pot after the flop) in the playbook — principle-based read:'};
 return {chart:'postflop-framework',source:'Master NLHE §§3–8: range/nut advantage, sizing theory, barreling benchmarks, river thresholds',gap:null};
}

/* ------------------------------------------------------------------ *
 * The tournament layer (Master NLHE §11). Cash advice prices chips; tournament advice prices
 * prize equity. Three levels of evidence, in order:
 *  1. Exact bubble factor from the payout context (players left ≤ 10), via the repo's ICM model:
 *     required equity to call an all-in = BF ÷ (BF + 1) (§11.1, rule 39).
 *  2. Stage + stack-role risk premium when the field state is known (worked example §11:
 *     a spot needing 37.5% by chip odds needed ~47% under ICM; medium stacks tighten most,
 *     the chip leader's premium is smallest, short stacks have little equity to protect).
 *  3. A survival heuristic from stack risk alone when no payout context is supplied
 *     ("stack off tighter than cash" — §11 heuristics), labelled as a rule of thumb.
 * ------------------------------------------------------------------ */
export interface TournamentCoachContext {
 /** Players still in the event, including Hero. */
 playersLeft:number;/** Places that pay. */
 paidPlaces:number;
 /** Remaining prize amounts, best first, in the event's money units (ICM is unit-agnostic). */
 prizes?:readonly number[];
 /** Every remaining player's stack, including Hero's. Needed (with prizes) for an exact bubble factor. */
 stacks?:readonly number[];
 /** Hero's index into `stacks`. */
 heroIndex?:number;
 /** The index into `stacks` of the player Hero is up against (the bettor / effective opponent). */
 opponentIndex?:number;
}
export type TStage='early'|'middle'|'bubble'|'in-the-money'|'final-table'|'unknown';
export function tournamentStage(ctx?:TournamentCoachContext):TStage {
 if(!ctx||ctx.playersLeft<=0||ctx.paidPlaces<=0)return 'unknown';
 if(ctx.playersLeft<=9&&ctx.playersLeft<=ctx.paidPlaces)return 'final-table';
 if(ctx.playersLeft<=ctx.paidPlaces)return 'in-the-money';
 if(ctx.playersLeft<=ctx.paidPlaces+Math.max(2,Math.round(ctx.paidPlaces*.15)))return 'bubble';
 if(ctx.playersLeft<=ctx.paidPlaces*3)return 'middle';
 return 'early';
}
/** Hero's stack role, which predicts the bubble factor: mid stacks carry the highest factors,
 * the chip leader the lowest, short stacks low (§11.1). Null without the field's stacks. */
export function stackRole(ctx:TournamentCoachContext):'short'|'mid'|'big'|null {
 if(!ctx.stacks||!ctx.stacks.length||ctx.heroIndex===undefined)return null;
 const mine=ctx.stacks[ctx.heroIndex];if(mine===undefined)return null;
 const avg=ctx.stacks.reduce((a,b)=>a+b,0)/ctx.stacks.length;
 return mine<avg*.5?'short':mine>avg*1.5?'big':'mid';
}
export interface BubbleFactorResult {bf:number;requiredAllIn:number;role:'short'|'mid'|'big'|null}
/** Exact bubble factor for Hero's all-in against the context's opponent, when the payout context
 * supports it (≤10 players left — the ICM model's exact range). Null otherwise. */
export function bubbleFactor(ctx?:TournamentCoachContext):BubbleFactorResult|null {
 if(!ctx?.prizes?.length||!ctx.stacks?.length||ctx.playersLeft>10||ctx.heroIndex===undefined||ctx.opponentIndex===undefined)return null;
 try{
  const bf=icmBubbleFactor(ctx.stacks,ctx.prizes,ctx.heroIndex,ctx.opponentIndex);
  return {bf,requiredAllIn:bf/(bf+1),role:stackRole(ctx)};
 }catch{return null;}
}
export interface RiskPremium {points:number;basis:Basis;note:string;bf?:BubbleFactorResult}
/** The risk premium: how many extra points of equity a tournament decision needs beyond chip odds.
 * `riskedShare` is the call (or the stack put at risk) as a share of Hero's stack — the premium
 * binds hardest when the whole stack is at risk, and scales down for small prices (§11: chips lost
 * are worth more than chips won, in proportion to what losing them costs). */
export function riskPremium(ctx:TournamentCoachContext|undefined,heroStack:number,risked:number):RiskPremium {
 const bf=bubbleFactor(ctx);
 if(bf&&risked>=heroStack*.999)return {points:Math.max(0,bf.requiredAllIn-.5),basis:'icm',bf,
  note:`Bubble factor ${bf.bf.toFixed(2)}: an all-in here needs ${Math.round(100*bf.requiredAllIn)}% equity, not the chip-odds price (Master NLHE §11.1).`};
 const stage=tournamentStage(ctx),scale=heroStack>0?Math.min(1,risked/Math.max(1,heroStack)):0;
 if(stage==='unknown'){
  // No payout context: the survival heuristic from stack risk alone (§11 heuristics).
  const points=scale>=.999?.05:scale>=.5?.04:scale>=.25?.02:0;
  return {points,basis:'rule',note:points>0?'Tournament survival: chips lost cost more than chips won gain, so a stack-risking call needs extra equity beyond the chip price (§11 heuristics). No payout context was supplied, so this is a rule of thumb, not an ICM price.':''};
 }
 const role=ctx?stackRole(ctx):null;
 const base=stage==='bubble'?.09:stage==='final-table'?.06:stage==='in-the-money'?.03:stage==='middle'?.015:.005;
 const roleMult=role==='mid'?1:role==='big'?.4:role==='short'?.55:1;
 const points=base*roleMult*(0.4+0.6*scale);
 const roleNote=role==='mid'?' Medium stacks tighten most here — busting ahead of the short stacks is the disaster (§11.1).':role==='big'?' The big stack’s premium is the smallest: it can afford to apply pressure (§11.1).':role==='short'?' A short stack has little prize equity to protect, so its premium is low (§11.1).':'';
 return {points,basis:'rule',note:`${stage==='bubble'?'On the bubble':stage==='final-table'?'At the final table':stage==='in-the-money'?'In the money':'At this stage'}, prize equity makes chips lost worth more than chips won: add about ${Math.round(100*points)} points to the chip-odds price.${roleNote}`};
}
/** The depth read for a tournament stack: which depth band Hero is in and what it does to ranges (§2.7). */
export function depthRead(effBB:number):{band:string;rises:string;falls:string;note:string} {
 const b=depthBand(effBB);return {band:b.label,rises:b.rises,falls:b.falls,note:b.note};
}
