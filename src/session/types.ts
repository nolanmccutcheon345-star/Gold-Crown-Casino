import type { Archetype, BotDecision, BotProfile, GameState, HeroViewModel, RuleProfile, OpponentConfig, PopulationPreset } from '../contracts';
import type { HandProvenance } from './hand-provenance';
import type { UserNotes } from './notes';
import type { RecordedCashConfiguration } from './configuration-history';
export interface CashSettings {
 chipUnit?:number;
 capacity?:number; occupiedSeatIds?:number[]; seatStacks?:Record<number,number>;
 /** One-time seat names for newcomers (table churn); consumed like seatStacks. */
 seatNames?:Record<number,string>;
 seats:number; stake:string; smallBlind:number; bigBlind:number; buyIn:number;
 archetypes:Archetype[]; rakeMode:'none'|'custom'|'pokerstars-usd-2026'; rakeBasisPoints:number; rakeCap:number; noFlopNoDrop:boolean;
 minBuyInBB:number; maxBuyInBB:number; allowTopUp:boolean;
 /** Allow a live straddle under the gun (twice the big blind), V410. Absent on older saves. */
 liveStraddle?:boolean;
 /** Optional for legacy saves; new sessions persist resolved persona seeds. */
 population?:PopulationPreset; opponents?:OpponentConfig[]; tableMode?:'live'|'study';
 /** Patch 73: a heads-up challenge match against one regular. Nobody joins, leaves or rebuys during the match. */
 challenge?:{rung:number;opponent:string};
}
export interface MoneyEvent {
 id:string; index:number; at:string; epoch:number; kind:'adjustment'|'reset'|'buy-in'|'top-up'|'hand-net'|'cash-out'|'table-adjustment';
 walletDelta:number; tableDelta:number; pokerNet:number; sessionId?:string; handId?:string; note:string;
 previousHash:string; hash:string;
}
export interface StoredHand {
 configuration?:RecordedCashConfiguration;
 provenance?:HandProvenance;
 id:string; sessionId:string; epoch:number; number:number; startedAt:string; endedAt:string;
 view:HeroViewModel; frames:HeroViewModel[]; net:number;
 /** Device-private immutable analysis metadata; never in public table/replay/export. */
 privateProfiles:Record<number,BotProfile>;
 previousHash:string; hash:string;
}
export interface CashSession {
 configurationHistory?:RecordedCashConfiguration[];
 id:string; epoch:number; startedAt:string; endedAt:string|null; settings:CashSettings; profile:RuleProfile;
 buyIns:number; tableWithdrawals?:number; cashOut:number; activeMs:number; lastActiveAt:number|null; handIds:string[];
}
export interface PendingBot {
 decisionId:string; handId:string; revision:number; seatId:number; policyVersion:string;
 drawToken:number; decision:BotDecision|null;
}
export interface ActiveTable {
 dealerTips?:{cents:number;pots:number;lastHand:string;lastTip:number};
 configuration?:RecordedCashConfiguration;
 sessionId:string; game:GameState; profiles:Record<number,BotProfile>; number:number;
 startedAt:string; frames:HeroViewModel[]; paused:boolean; pending:PendingBot|null;
 /** Durable intent: finish normal play, or fold on the next legal Hero turn, then cash out. */
 exitMode:'finish'|'fold'|null;
 queuedConfiguration?:{id:string;sessionId:string;requestedHandId:string;settings:CashSettings;queuedAt:string};
 lastAppliedConfigurationId?:string;
 /** Human touches (mood, human bet amounts) for tables started since patch 31. */
 humanLayer?:'human-1.0.0'|'human-1.1.0'|'human-1.2.0'|'human-1.3.0'|'human-1.4.0'|'human-1.5.0'|'human-1.6.0'|'human-1.7.0'|'human-1.8.0'|'human-1.9.0'|'human-1.10.0'|'human-1.11.0'|'human-1.12.0'|'human-1.13.0'|'human-1.14.0'|'human-1.15.0'|'human-1.16.0'|'human-1.17.0'|'human-1.18.0'|'human-1.19.0'|'human-1.20.0'|'human-1.21.0';
 /** Table news from the last churn, shown during the hand it applies to. */
 /** Standing choice for future eligible UTG hands; never changes the current hand. */
 heroStraddle?:boolean;
 churnNews?:{handId:string;lines:string[]};
 /** Layer 1.15.0: players who announced their last orbit, by seat: who, and the session hand count at which they go. */
 lastOrbit?:Record<number,{personalityId:string;until:number;why:string}>;
}
export interface AppData {
 /** Public-only bounded reads and cumulative current-session facts; no financial authority. */
 humanMemory?:import('./human-memory').HumanMemory;
 schemaVersion:4; revision:number; epoch:number; wallet:number; initialBankroll:number;
 ledger:MoneyEvent[]; sessions:CashSession[]; hands:StoredHand[]; active:ActiveTable|null;
 /** Public imported study records never enter live accounting/statistics. */
 importedHands:PublicHand[];
 /** User-authored public-player observations; never policy data or financial results. */
 userNotes?:UserNotes;
 /** Durable safe-fallback audit; contains no hidden cards or policy parameters. */
 policyViolations?:Array<{id:string;at:string;handId:string;revision:number;seatId:number;policyVersion:string;proposedAction:import('../contracts').Action|null;fallback:import('../contracts').Action;reason:string}>;
 namedPresets?:Array<{id:string;name:string;version:1;createdAt:string;updatedAt:string;settings:CashSettings}>;
}
export interface PublicHand {
 configuration?:RecordedCashConfiguration;
 provenance?:HandProvenance;
 version:'0.3.0'; kind:'public-redacted'; handId:string; sessionId:string; number:number;
 startedAt:string; endedAt:string; view:HeroViewModel; frames:HeroViewModel[]; net:number;
 /** Optional public provenance only; legacy records and hashes are not rewritten. */
 policyVersions?:string[];
 previousHash:string; hash:string;
}
export interface PublicHistory { format:'ai-texas-hold-em-public-history'; version:'0.3.0'; disclosure:string; hands:PublicHand[]; }
export interface PersistencePort {
 readonly writable?:boolean;
 readonly deleted?:boolean;
 readonly recoveryDiagnostics?:readonly string[];
 readonly legacyArchiveAuditStatus?:'not-required'|'not-audited'|'verified'|'failed';
 /** Audited maintenance may retire redundant acceleration copies; canonical records remain. */
 optimizeStorage?():Promise<void>;
 auditCanonicalArchive?():Promise<{revision:number;hands:number;wallet:number;status:'verified';checksum?:string;current?:boolean}>;
 /** Read-only canonical archive, verified against the current durable revision. */
 loadFullHistory?():Promise<AppData>;
 readHand?(index:number):Promise<StoredHand>;
 erase?(expectedRevision:number):Promise<void>;
 startFresh?(initial:AppData):Promise<void>;
 /** Patch 69: after deletion, start from a fully audited backup instead of an empty save. */
 restoreFresh?(data:AppData,expectedRevision?:number):Promise<void>;
 takeOver?():Promise<void>;
 load():Promise<AppData|null>;
 commit(expectedRevision:number|null,data:AppData):Promise<void>;
 close():void;
}
