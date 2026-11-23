/** Frozen Phase 0 contract v0.1. Integer chips = cents. No UI/bot financial authority. */
export const CONTRACT_VERSION = '0.2.0';
export type Card = string; // rank [2-9TJQKA] followed by suit [cdhs]
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
export type Action = {type:'fold'|'check'|'call'} | {type:'raise'; to:number};
export interface RuleProfile {
 id:string; version:string; mode:'cash'|'tournament'; smallBlind:number; bigBlind:number; chipUnit:number;
 rake:{basisPoints:number; cap:number; noFlopNoDrop:boolean; rounding?:'floor'|'half-even'; capByDealtIn?:{two:number;threeFour:number;fivePlus:number}; dealtIn?:number; source?:{url:string;retrievedAt:string;currency:'USD';format:'regular-nlhe'}};
 /** Frozen tournament forced-bet profile; never accepted by cash controllers. */
 tournament?:{bigBlindAnte:number;antePriority:'blind-first';buttonRule:'dead-button'};
 /** Live straddle (V410), cash only: the player under the gun may post twice the big blind before
  * the deal and then acts last before the flop. Button/Mississippi and multiple straddles stay deferred (FUT010/FUT011). */
 straddle?:{kind:'utg-live';multiple:2};
 shortRaiseReopens:'cumulative'; oddChipOrder:'clockwise-from-button';
}
export interface Seat {
 id:number; name:string; stack:number; startingStack:number; hole:Card[];
 /** Dead table-wide ante is included in totalCommitted, never streetCommitted. */
 deadAnte?:number;
 streetCommitted:number; totalCommitted:number; folded:boolean; allIn:boolean;
 /** Last wager faced when acting; null means has not acted on this street. */
 lastActedBet:number|null;
}
export interface LegalActionSet {
 actor:number|null; fold:boolean; check:boolean; callAmount:number;
 minRaiseTo:number|null; maxRaiseTo:number|null; canRaise:boolean;
 shortAllInTo:number|null; reopened:boolean;
}
export interface GameCommand {
 handId:string; revision:number; seatId:number; decisionId:string; action:Action;
 policyVersion?:string;
}
export interface GameEvent {
 id:string; handId:string; revision:number; type:'start'|'blind'|'ante'|'action'|'street'|'refund'|'award'|'rake';
 seatId?:number; amount?:number; action?:Action; street?:Street; cards?:Card[];
 detail?:string; decisionId?:string;
}
export interface Pot { amount:number; eligible:number[]; winners:number[]; }
export interface GameState {
 schemaVersion:'0.1.0'; engineVersion:string; handId:string; revision:number;
 /** Original physical ring size survives eliminated seats for the dead button. */
 tournamentSeatCount?:number;
 /** Seat that posted a live straddle this hand, if any. */
 straddleSeat?:number;
 profile:RuleProfile; seats:Seat[]; button:number; smallBlindSeat:number; bigBlindSeat:number;
 street:Street; board:Card[]; deck:Card[]; deckCursor:number; burned:Card[];
 actor:number|null; currentBet:number; minFullRaiseIncrement:number; pending:number[];
 pot:number; pots:Pot[]; rake:number; initialTotal:number; events:GameEvent[];
 committedDecisionIds:string[]; payouts:Record<number,number>; revealedSeats:number[];
 /** Between-hand external transfers; separate from the completed poker hand. */
 tableTransfers?:{id:string;seatId:number;amount:number}[];
 lastTableConfiguration?:{id:string;seats:{id:number;name:string;stack:number}[];profile:RuleProfile};
}
export interface StartHandInput {
 handId:string; seats:{id:number;name:string;stack:number}[]; button:number; profile:RuleProfile;
 /** This hand's voluntary live straddle (the under-the-gun seat), when the rule profile allows it. */
 straddle?:{seatId:number};
}
export interface PublicSeat extends Omit<Seat,'hole'|'lastActedBet'> { hole:Card[]; }
export interface HeroViewModel {
 /** Present only for live-straddle replay capability; ordinary historical frames remain byte-identical. */
 engineVersion?:'0.6.0';
 tournamentSeatCount?:number;
 straddleSeat?:number;
 handId:string; revision:number; profile:RuleProfile; seats:PublicSeat[]; button:number;
 smallBlindSeat:number; bigBlindSeat:number; street:Street; board:Card[]; actor:number|null;
 pot:number; pots:Pot[]; rake:number; payouts:Record<number,number>; legal:LegalActionSet; events:GameEvent[];
 /** Engine-derived, provisional during betting; uncalled excess is not a side pot. */
 uncalledBet:{seatId:number;amount:number}|null;
 /** Only legally revealed showdown hands receive engine-ranked labels. */
 handLabels:Record<number,string>;
}
export interface BotObservation {
 handId:string; revision:number; actingSeat:number; decisionId:string; policyVersion:string;
 chipUnit?:number;
 ownCards:Card[]; board:Card[]; street:Street; button:number; pot:number; bigBlind:number;
 seats:{id:number;stack:number;streetCommitted:number;totalCommitted:number;deadAnte?:number;folded:boolean;allIn:boolean}[];
 legal:LegalActionSet; publicEvents:GameEvent[];
 /** Optional allowed context; legacy policies ignore these fields. */
 rake?:RuleProfile['rake']; memory?:BotMemory;
}
export interface BotDecision extends GameCommand {policyVersion:string; observationHash:string;}
export type Archetype='nit'|'station'|'tag'|'lag'|'fit-or-fold'|'maniac'|'passive-reg'|'stronger-reg';
export type PopulationPreset='low'|'mid'|'high'|'neutral';
export interface BotTraits {
 positionAwareness:number; bluffFrequency:number; valueThreshold:number; drawCalling:number;
 sizeSensitivity:number; riskTolerance:number; riverCuriosity:number; slowPlay:number;
 multiwayCaution:number; adaptation:number; memoryRetention:number; mistakeRate:number; sizingAggression:number;
}
/** Synthetic continuation-logit offsets at 25/50/75/100/150/200/300% pot. Zero is neutral. River applies only to missed draws. */
export type DrawResponseKind='gutshot'|'oesd'|'flush'|'combo';
export type DrawResponseStreet='flop'|'turn'|'river';
export type DrawResponseCurves=Partial<Record<DrawResponseKind,Partial<Record<DrawResponseStreet,number[]>>>>;
export interface OpponentConfig {
 selection:Archetype|'random'|'unknown'|'custom'; baseArchetype?:Archetype; skill?:number;
 aggression?:number; looseness?:number; traits?:Partial<BotTraits>; personalitySeed?:number; drawResponses?:DrawResponseCurves;
}
export interface BotProfile {
 archetype:Archetype; policyVersion:string; aggression:number; looseness:number;
 personalityId?:string; skill?:number; environment?:PopulationPreset; traits?:BotTraits; unknown?:boolean; drawResponses?:DrawResponseCurves;
}
export interface ObservedRate {count:number; opportunities:number;}
export interface ObservedOpponent {
 seatId:number; hands:number; vpip:ObservedRate; pfr:ObservedRate;
 aggression:ObservedRate; foldToBet:ObservedRate; showdowns:Card[][];
}
export interface BotMemory {windowHands:number; opponents:ObservedOpponent[];}
/** Only produced from public legal events and actually revealed showdown cards. */
export interface PublicMemoryHand {
 handId:string; seats:{id:number;revealedCards:Card[]}[]; events:GameEvent[];
}

export interface LedgerEntry {
 id:string; kind:'adjustment'|'buy-in'|'top-up'|'hand-net'|'rake'|'cash-out'|'tournament-payout';
 amount:number; handId?:string; timestamp:string;
}
export interface SessionLedger {version:'0.1.0';wallet:number;entries:LedgerEntry[];}
export interface HandReplay {version:'0.1.0';kind:'public-redacted';handId:string;view:HeroViewModel;}
export interface SealedResume {version:'0.1.0';kind:'private-resume';state:GameState;pending:BotDecision[];ledger:SessionLedger;}
export interface GoldenFixture {
 id:string; profile:RuleProfile; input:StartHandInput; deck:Card[]; actions:GameCommand[];
 expected:{stacks:number[];payouts:Record<number,number>;rake:number}; oracle:string; status:string;
}
