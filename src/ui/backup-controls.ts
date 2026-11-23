/** Patch 69: Back up and restore. Markup only; the app wires the buttons. */
import type {BackupSummary} from '../storage/backup';

export const RESTORE_CONFIRMATION='REPLACE';
const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);
const chips=(cents:number)=>`$${(cents/100).toLocaleString('en-US',{maximumFractionDigits:2})}`;

export interface BackupState {
 /** Why a backup cannot be made right now, or '' when it can. */
 blocked:string;
 working:boolean;
 notice:string;
 problem:string;
 /** Object URL of the backup just made, with its file name. */
 file:{url:string;name:string}|null;
 /** A checked backup waiting for the typed confirmation. */
 pending:{name:string;createdAt:string;summary:BackupSummary}|null;
 report:string[];
}

export function summaryList(s:BackupSummary):string {
 return `<ul class="backup-summary"><li>Cash: <b>${s.cashHands.toLocaleString('en-US')} hands</b> in ${s.cashSessions} session${s.cashSessions===1?'':'s'} · bankroll ${chips(s.cashBankroll)}</li><li>Tournaments: <b>${s.tournamentEvents} finished</b> · balance ${chips(s.tournamentBalance)}</li><li>Blackjack: <b>${s.blackjackRecords} records</b> · balance ${chips(s.blackjackBalance)}</li></ul>`;
}

export function restoreMarkup(state:BackupState,blocked:boolean):string {
 const p=state.pending;
 const when=p?new Date(p.createdAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'';
 return `<h3>Restore from a backup</h3><p>Pick a backup file. It is checked first; nothing changes until you confirm.</p>
 <label class="button secondary backup-file-label" for="restore-file">Choose backup file<input id="restore-file" type="file" accept="application/json,.json" ${blocked||state.working?'disabled':''} hidden></label>
 ${p?`<div class="backup-pending" data-testid="restore-pending"><p><b>${esc(p.name)}</b> · made ${esc(when)}</p>${summaryList(p.summary)}
 <p class="privacy-blocked">Restoring <b>replaces this device's cash bankroll and hands</b> with the backup's. Tournament and blackjack history is added on; anything on this device that is not in the backup is never overwritten, so a restore that would lose it is refused.</p>
 <form id="restore-form" class="cash-form"><label for="restore-confirmation">Type ${RESTORE_CONFIRMATION} to confirm<input id="restore-confirmation" autocomplete="off" spellcheck="false" required ${state.working?'disabled':''}></label>
 <button id="confirm-restore" class="button primary" type="submit" ${state.working||blocked?'disabled':''}>Restore this backup</button><button id="cancel-restore" class="button secondary" type="button">Cancel</button></form></div>`:''}
 ${state.report.length?`<ul class="backup-report" data-testid="restore-report" role="status">${state.report.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:''}`;
}

export function backupControls(state:BackupState):string {
 const blocked=!!state.blocked;
 return `<section class="panel cashier-panel backup-panel" data-testid="backup-controls"><span class="eyebrow">BACKUP</span><h2>Back up and restore</h2>
 <p>One file with your career, cash hands and bankroll, tournament results and blackjack record. Use it to move to a new phone or keep a safe copy. It holds your hidden cards and notes, so keep it private.</p>
 ${state.blocked?`<p class="privacy-blocked" role="status">${esc(state.blocked)}</p>`:''}
 ${state.problem?`<p class="error-banner" role="alert">${esc(state.problem)}</p>`:''}
 ${state.notice?`<p role="status" data-testid="backup-notice">${esc(state.notice)}</p>`:''}
 <button id="make-backup" class="button primary" ${blocked||state.working?'disabled':''}>${state.working?'Working…':'Back up everything'}</button>
 ${state.file?`<a id="backup-download" class="button secondary" href="${state.file.url}" download="${esc(state.file.name)}">Save ${esc(state.file.name)}</a>${typeof navigator!=='undefined'&&'share' in navigator?'<button id="share-backup" class="button secondary">Share…</button>':''}`:''}
 <hr>${restoreMarkup(state,blocked)}</section>`;
}
