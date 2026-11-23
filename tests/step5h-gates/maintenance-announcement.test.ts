import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {savedPracticeAnnouncement} from '../../src/ui/accessibility';
const retainedSuccess='Storage maintenance completed. Bankroll is unchanged.';
const table='No active table. Choose New session.';
describe('Current saved-state announcements override retained maintenance status',()=>{
 it.each(['readonly','error'] as const)('announces the current %s problem after earlier maintenance succeeded',status=>{
  const error=status==='readonly'?'Another tab owns this session.':'Quota failure. Retry to verify the saved account.';
  const text=savedPracticeAnnouncement({status,error,maintenanceNotice:retainedSuccess,table});expect(text).toBe(`Saved practice is paused. ${error}`);expect(text).not.toContain('maintenance completed');
 });
 it('announces unverified loading and deletion rather than a retained success',()=>{
  expect(savedPracticeAnnouncement({status:'loading',error:'',maintenanceNotice:retainedSuccess,table})).toBe('Verifying saved practice. Poker actions are unavailable until recovery succeeds.');
  expect(savedPracticeAnnouncement({status:'deleted',error:'',maintenanceNotice:retainedSuccess,table})).toBe('Saved practice data deleted. No new bankroll has been created.');
 });
 it('announces current maintenance progress while the owned ready controller is busy, then its result',()=>{
  const progress='Verifying saved history before reducing redundant copies… Poker actions are paused.';
  expect(savedPracticeAnnouncement({status:'ready',error:'',maintenanceNotice:progress,table})).toBe(progress);
  expect(savedPracticeAnnouncement({status:'ready',error:'',maintenanceNotice:retainedSuccess,table})).toBe(retainedSuccess);
  expect(savedPracticeAnnouncement({status:'ready',error:'',maintenanceNotice:'',table})).toBe(table);
 });
 it('keeps the live footer phase-neutral; the verified wrapper supplies exact candidate identity',()=>{
  const source=readFileSync('src/ui/app.ts','utf8');expect(source).toContain('Cash-game candidate · Synthetic cash practice');expect(source).not.toContain('Step 5E candidate');
 });
});
