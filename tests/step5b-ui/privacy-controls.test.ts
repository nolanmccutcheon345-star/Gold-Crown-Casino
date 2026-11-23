import {describe,expect,it} from 'vitest';
import {deletedPracticeMarkup,privacyControls} from '../../src/ui/privacy-controls';
describe('Truthful M12 privacy and erasure controls',()=>{
 it('describes actual absent network diagnostics without inventing a supported opt-in service',()=>{
  const html=privacyControls({active:false,locked:false,handCount:1,confirm:false});
  expect(html).toContain('Optional telemetry and diagnostic uploads: Off.');
  expect(html).toContain('requires your explicit opt-in');
  expect(html).not.toContain('type="checkbox"');expect(html).toContain('excluding hidden opponent cards and future cards');
 });
 it('blocks destructive confirmation whenever a table remains seated',()=>{
  const html=privacyControls({active:true,locked:false,handCount:1,confirm:true});
  expect(html).toContain('End and cash out the current table first');
  expect(html).toContain('id="confirm-delete-practice" class="button secondary destructive-button" type="submit" disabled');
 });
 it('requires explicit typed confirmation and describes complete deletion scope',()=>{
  const html=privacyControls({active:false,locked:false,handCount:1,confirm:true});
  expect(html).toContain('Type DELETE ALL PRACTICE DATA to confirm');expect(html).toContain('canonical and imported hands');expect(html).toContain('recovery copies');
 });
 it('does not automatically create a replacement bankroll after deletion and escapes errors',()=>{
  const html=deletedPracticeMarkup(false,'<bad>');expect(html).toContain('No new bankroll has been created');expect(html).toContain('id="start-fresh-practice"');expect(html).toContain('&lt;bad&gt;');expect(html).not.toContain('<bad>');
 });
});
