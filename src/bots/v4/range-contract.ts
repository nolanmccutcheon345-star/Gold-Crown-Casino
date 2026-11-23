import type { Card } from '../../contracts';
/** Step4B pure deterministic advisory interfaces. No chip/card authority or external entropy. */
export interface ActionMix {fold:number;check:number;call:number;raise:number;}
export interface SizeChoice {label:string;raiseTo:number;weight:number;}
export type PreflopPosition='UTG'|'MP'|'CO'|'BTN'|'SB'|'BB';
export type PreflopNode='unopened'|'limped'|'facing-open'|'facing-3bet'|'facing-4bet';
export interface PreflopAnalysis {
 modelVersion:string; handClass:string; comboCount:number; position:PreflopPosition;
 node:PreflopNode; effectiveStackBB:number; distribution:ActionMix; sizing:SizeChoice[];
 /** Designed inputs/weights for independent tests; never ordinary Live Table. */
 diagnostics:Record<string,number|string>;
}
export interface WeightedCombo {cards:[Card,Card];weight:number;}
export interface OpponentRange {
 seatId:number; combos:WeightedCombo[]; observedActions:number; effectiveCombos:number;
 uncertainty:number; priorSource:string; premiumMass:number; strongMadeMass:number; drawMass:number;
 /** Scalar summaries after each observed action, no truth labels or private policies. */
 updates:{eventId:string;street:string;action:string;effectiveCombos:number;premiumMass:number}[];
}
export interface RangeAnalysis {
 modelVersion:string; opponents:OpponentRange[];
 /** Diagnostic posterior for publicly folded seats; excluded from active equity and fold equity. */
 foldedOpponents?:OpponentRange[];
 /** Model-dependent estimate incl ties, NOT solver/human validation or decision EV. */
 equity:number; equitySamples:number; equityStdError:number;
 rangeAdvantage:number; nutAdvantage:number; foldEquity:number; uncertainty:number;
 assumptions:string[];
}
