/** Frozen Phase 0 contract v0.1. Integer chips = cents. No UI/bot financial authority. */
export const CONTRACT_VERSION = '0.2.0';
export type Card = string; // rank [2-9TJQKA] followed by suit [cdhs]
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
export type Action = {type:'fold'|'check'|'call'} | {type:'raise'; to:number};
export interface RuleProfile {
 id:string; version:string; mode:'cash'; smallBlind:number; bigBlind:number; chipUnit:1;
 rake:{basisPoints:number; cap:number; noFlopNoDrop:boolean};
 shortRaiseReopens:'cumulative'; oddChipOrder:'clockwise-from-button';
}
export interface Seat {
 id:number; name:string; stack:number; startingStack:number; hole:Card[];
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
 id:string; handId:string; revision:number; type:'start'|'blind'|'action'|'street'|'refund'|'award'|'rake';
 seatId?:number; amount?:number; action?:Action; street?:Street; cards?:Card[];
 detail?:string; decisionId?:string;
}
export interface Pot { amount:number; eligible:number[]; winners:number[]; }
export interface GameState {
 schemaVersion:'0.1.0'; engineVersion:string; handId:string; revision:number;
 profile:RuleProfile; seats:Seat[]; button:number; smallBlindSeat:number; bigBlindSeat:number;
 street:Street; board:Card[]; deck:Card[]; deckCursor:number; burned:Card[];
 actor:number|null; currentBet:number; minFullRaiseIncrement:number; pending:number[];
 pot:number; pots:Pot[]; rake:number; initialTotal:number; events:GameEvent[];
 committedDecisionIds:string[]; payouts:Record<number,number>; revealedSeats:number[];
 /** Between-hand external transfers; separate from the completed poker hand. */
 tableTransfers?:{id:string;seatId:number;amount:number}[];
}
export interface StartHandInput {
 handId:string; seats:{id:number;name:string;stack:number}[]; button:number; profile:RuleProfile;
}
export interface PublicSeat extends Omit<Seat,'hole'|'lastActedBet'> { hole:Card[]; }
export interface HeroViewModel {
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
 ownCards:Card[]; board:Card[]; street:Street; button:number; pot:number; bigBlind:number;
 seats:{id:number;stack:number;streetCommitted:number;totalCommitted:number;folded:boolean;allIn:boolean}[];
 legal:LegalActionSet; publicEvents:GameEvent[];
}
export interface BotDecision extends GameCommand {policyVersion:string; observationHash:string;}
export type Archetype='nit'|'station'|'tag'|'lag'|'fit-or-fold'|'maniac'|'passive-reg'|'stronger-reg';
export interface BotProfile {archetype:Archetype; policyVersion:string; aggression:number; looseness:number;}
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
