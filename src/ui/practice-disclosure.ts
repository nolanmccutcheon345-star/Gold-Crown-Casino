export const PRACTICE_DISCLOSURE='Offline poker simulator for practice with virtual chips only. No real-money gambling or real-time assistance for live poker. This app does not connect to live poker clients.';
export const IMPORT_RIGHTS_NOTICE='I own this history or have permission and the right to use it for private study.';
export function assertStudyImportRights(confirmed:boolean):void {
 if(!confirmed)throw new Error('Confirm that you own this history or have permission and the right to use it before importing.');
}
export function importRightsMarkup(confirmed:boolean):string {
 return `<label class="import-rights" for="import-rights"><input id="import-rights" type="checkbox" ${confirmed?'checked':''}>${IMPORT_RIGHTS_NOTICE}</label><p class="muted" id="import-rights-help">Only import records you are entitled to use. Imports are read-only study copies, never a live-game connection or bankroll restore.</p>`;
}
