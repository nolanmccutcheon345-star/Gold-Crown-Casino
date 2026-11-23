import type { Archetype, BotDecision, BotProfile, GameState, HeroViewModel, RuleProfile } from '../contracts';
export interface CashSettings {
 seats:number; stake:string; smallBlind:number; bigBlind:number; buyIn:number;
 archetypes:Archetype[]; rakeMode:'none'|'custom'; rakeBasisPoints:number; rakeCap:number; noFlopNoDrop:boolean;
 minBuyInBB:number; maxBuyInBB:number; allowTopUp:boolean;
}
export interface MoneyEvent {
 id:string; index:number; at:string; epoch:number; kind:'adjustment'|'reset'|'buy-in'|'top-up'|'hand-net'|'cash-out';
 walletDelta:number; tableDelta:number; pokerNet:number; sessionId?:string; handId?:string; note:string;
 previousHash:string; hash:string;
}
export interface StoredHand {
 id:string; sessionId:string; epoch:number; number:number; startedAt:string; endedAt:string;
 view:HeroViewModel; frames:HeroViewModel[]; net:number;
 /** Device-private immutable analysis metadata; never in public table/replay/export. */
 privateProfiles:Record<number,BotProfile>;
 previousHash:string; hash:string;
}
export interface CashSession {
 id:string; epoch:number; startedAt:string; endedAt:string|null; settings:CashSettings; profile:RuleProfile;
 buyIns:number; cashOut:number; activeMs:number; lastActiveAt:number|null; handIds:string[];
}
export interface PendingBot {
 decisionId:string; handId:string; revision:number; seatId:number; policyVersion:string;
 drawToken:number; decision:BotDecision|null;
}
export interface ActiveTable {
 sessionId:string; game:GameState; profiles:Record<number,BotProfile>; number:number;
 startedAt:string; frames:HeroViewModel[]; paused:boolean; pending:PendingBot|null;
}
export interface AppData {
 schemaVersion:3; revision:number; epoch:number; wallet:number; initialBankroll:number;
 ledger:MoneyEvent[]; sessions:CashSession[]; hands:StoredHand[]; active:ActiveTable|null;
 /** Public imported study records never enter live accounting/statistics. */
 importedHands:PublicHand[];
}
export interface PublicHand {
 version:'0.3.0'; kind:'public-redacted'; handId:string; sessionId:string; number:number;
 startedAt:string; endedAt:string; view:HeroViewModel; frames:HeroViewModel[]; net:number;
 previousHash:string; hash:string;
}
export interface PublicHistory { format:'ai-texas-hold-em-public-history'; version:'0.3.0'; disclosure:string; hands:PublicHand[]; }
export interface PersistencePort {
 readonly writable?:boolean;
 takeOver?():Promise<void>;
 load():Promise<AppData|null>;
 commit(expectedRevision:number|null,data:AppData):Promise<void>;
 close():void;
}
