/** Patch 69: one backup file for all your practice data: the cash save with its full hand history, the
 * tournament save and the blackjack financial record chain. Reading a backup checks all three with the same
 * audits the app uses on its own saves before anything is replaced. The file holds your hidden cards and
 * private analysis, so keep it private. */
import {validCareer,type Career} from '../ui/career';
import type {AppData} from '../session/types';
import type {TournamentData} from '../tournament/runtime';
import {auditTournamentData} from '../tournament/runtime';
import type {BlackjackSnapshot} from '../blackjack/runtime';
import {auditSnapshot as auditBlackjack} from '../blackjack/runtime';
import {auditSnapshot as auditCash} from './verified';
import {checkPlo,type PloState} from '../plo/table';
import {checkSlots,type SlotsState} from '../slots/state';
import {checkCasino,type CasinoState} from '../casino/wallet';

export const BACKUP_FORMAT='poker-night-ai-backup-1';
export interface BackupSummary {cashHands:number;cashSessions:number;cashBankroll:number;tournamentEvents:number;tournamentBalance:number;blackjackRecords:number;blackjackBalance:number}
export interface Backup {format:typeof BACKUP_FORMAT;createdAt:string;warning:string;summary:BackupSummary;career?:Career|null;cash:AppData;tournament:TournamentData|null;blackjack:BlackjackSnapshot|null;
 /** Patch 74: the Omaha balance and history, between tables. Absent in older backups. */
 omaha?:PloState;
 /** Patch 101: the slots balance and the casino balance (roulette, craps, baccarat, races). Absent in older backups. */
 slots?:SlotsState;casino?:CasinoState}

export function summarize(cash:AppData,tournament:TournamentData|null,blackjack:BlackjackSnapshot|null):BackupSummary {
 return {cashHands:cash.hands.length,cashSessions:cash.sessions.length,cashBankroll:cash.wallet,tournamentEvents:tournament?.completed.length??0,tournamentBalance:tournament?.balance??0,
  blackjackRecords:blackjack?.records.length??0,blackjackBalance:blackjack?.checkpoint.payload.balance??0};
}
export function makeBackup(cash:AppData,tournament:TournamentData|null,blackjack:BlackjackSnapshot|null,createdAt=new Date().toISOString()):Backup {
 return {format:BACKUP_FORMAT,createdAt,warning:'Private practice data backup. Contains your hidden cards, notes and private analysis. Virtual chips only.',summary:summarize(cash,tournament,blackjack),cash,tournament,blackjack};
}
/** Parse and fully check a backup file. Throws a plain message when anything does not hold. */
export async function readBackup(text:string):Promise<Backup> {
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('That file is not a Poker Night AI backup.');}
 const b=value as Backup;
 if(!b||typeof b!=='object'||b.format!==BACKUP_FORMAT||!b.cash||typeof b.createdAt!=='string'||!Number.isFinite(Date.parse(b.createdAt))||!Object.hasOwn(b,'blackjack')||!Object.hasOwn(b,'tournament'))throw Error('That file is not a Poker Night AI backup.');
 if(b.career!==undefined&&b.career!==null&&!validCareer(b.career))throw Error('The career record failed its check.');
 if(b.cash.active!==null)throw Error('This backup has a cash table open, so it cannot be restored.');
 try{await auditCash(structuredClone(b.cash));}catch(e){throw Error(`The cash part of this backup failed its check: ${(e as Error).message}`);}
 if(b.tournament){if(b.tournament.active)throw Error('This backup has a tournament in progress, so it cannot be restored.');try{auditTournamentData(structuredClone(b.tournament));}catch(e){throw Error(`The tournament part of this backup failed its check: ${(e as Error).message}`);}}
 if(b.blackjack){let data;try{data=auditBlackjack(structuredClone(b.blackjack));}catch(e){throw Error(`The blackjack part of this backup failed its check: ${(e as Error).message}`);}if(data.active)throw Error('This backup has a blackjack table open, so it cannot be restored.');}
 if(b.omaha!==undefined){try{checkPlo(b.omaha);}catch(e){throw Error(`The Omaha part of this backup failed its check: ${(e as Error).message}`);}if(b.omaha.active)throw Error('This backup has an Omaha table open, so it cannot be restored.');}
 if(b.slots!==undefined){try{b.slots=checkSlots(b.slots);}catch(e){throw Error(`The slots part of this backup failed its check: ${(e as Error).message}`);}}
 if(b.casino!==undefined){try{b.casino=checkCasino(b.casino);}catch(e){throw Error(`The casino part of this backup failed its check: ${(e as Error).message}`);}}
 return {...b,summary:summarize(b.cash,b.tournament,b.blackjack)};
}
