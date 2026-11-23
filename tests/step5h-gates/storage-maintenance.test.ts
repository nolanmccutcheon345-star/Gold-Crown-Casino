import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {AtomicPort,encode} from '../step5d-independent/reference';
class MaintenancePort extends AtomicPort{
 writable=true;calls=0;gate:Promise<void>|null=null;failure:Error|null=null;after:()=>Promise<void>=async()=>{};
 async optimizeStorage(){this.calls++;await this.gate;if(this.failure)throw this.failure;await this.after();}
}
async function settled(){const port=new MaintenancePort(),controller=new SessionController(port);await controller.init();await controller.startSession({...DEFAULT_SETTINGS,seats:2});const game=controller.data!.active!.game;await controller.act({type:'fold'},game.handId,game.revision);await controller.cashOut();expect(controller.data!.hands).toHaveLength(1);expect(controller.data!.active).toBeNull();return{port,controller};}
describe('Step5H explicit nonfinancial storage maintenance',()=>{
 it('retains exact completed hands, ledger and wallet with no extra settlement or save',async()=>{
  const {port,controller:c}=await settled(),before=encode(c.data),identity=c.data,commits=port.commits;expect(c.canCompactSavedHistory).toBe(true);
  expect(await c.compactSavedHistory()).toEqual({revision:c.data!.revision,hands:1,wallet:999900,currentState:'verified-unchanged'});
  expect(c.data).toBe(identity);expect(encode(c.data)).toBe(before);expect(port.commits).toBe(commits);expect(port.calls).toBe(1);expect(c.busy).toBe(false);expect(c.status).toBe('ready');c.close();
 });
 it('blocks wallet changes, new sessions and repeated maintenance until the same request finishes',async()=>{
  const {port,controller:c}=await settled();let release!:()=>void;port.gate=new Promise(resolve=>{release=resolve;});const before=encode(c.data),states:boolean[]=[];c.subscribe(()=>states.push(c.busy));const pending=c.compactSavedHistory();
  expect(c.busy).toBe(true);await c.adjustBankroll(5000000,'Blocked during maintenance');await c.startSession({...DEFAULT_SETTINGS,seats:2});await expect(c.compactSavedHistory()).rejects.toThrow(/owned saved session/);expect(port.calls).toBe(1);expect(encode(c.data)).toBe(before);
  release();await pending;expect(states).toEqual([true,false]);expect(encode(c.data)).toBe(before);c.close();
 });
 it('requires cashout even after showdown; cannot interrupt or silently cancel an active cash session',async()=>{
  const port=new MaintenancePort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const before=encode(c.data);await expect(c.compactSavedHistory()).rejects.toThrow(/End and cash out/);expect(encode(c.data)).toBe(before);
  const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);expect(c.data!.active!.game.street).toBe('complete');await expect(c.compactSavedHistory()).rejects.toThrow(/End and cash out/);expect(port.calls).toBe(0);c.close();
 });
 it('refuses readonly, loading and unsupported environments before calling storage',async()=>{
  const port=new MaintenancePort(),c=new SessionController(port);await c.init();port.writable=false;await expect(c.compactSavedHistory()).rejects.toThrow(/owned saved session/);port.writable=true;c.status='loading';await expect(c.compactSavedHistory()).rejects.toThrow(/owned saved session/);expect(port.calls).toBe(0);c.close();
  const unsupported=new SessionController(new AtomicPort());await unsupported.init();expect(unsupported.canCompactSavedHistory).toBe(false);await expect(unsupported.compactSavedHistory()).rejects.toThrow(/cannot reduce/);expect(unsupported.status).toBe('ready');unsupported.close();
 });
 it('preserves data on quota failure and requires successful Retry before money actions resume',async()=>{
  const {port,controller:c}=await settled(),before=encode(c.data),commits=port.commits;port.failure=Error('QuotaExceededError: maintenance transaction aborted');await expect(c.compactSavedHistory()).rejects.toThrow(/QuotaExceededError/);expect(c.status).toBe('error');expect(c.busy).toBe(false);expect(encode(c.data)).toBe(before);expect(c.error).toContain('QuotaExceededError');await c.adjustBankroll(7000000,'Must not apply');expect(encode(c.data)).toBe(before);
  port.failure=null;await c.retry();expect(c.status).toBe('ready');expect(encode(c.data)).toBe(before);expect(port.commits).toBe(commits);c.close();
 });
 it('rejects ownership loss or a valid newer committed revision without replacing the displayed save',async()=>{
  const first=await settled(),before=encode(first.controller.data);first.port.after=async()=>{first.port.writable=false;};await expect(first.controller.compactSavedHistory()).rejects.toThrow(/Another tab/);expect(first.controller.status).toBe('readonly');expect(encode(first.controller.data)).toBe(before);first.controller.close();
  const second=await settled(),old=encode(second.controller.data);second.port.after=async()=>{const newer=new SessionController(second.port);await newer.init();await newer.adjustBankroll(2000000,'Another committed writer');newer.close();};await expect(second.controller.compactSavedHistory()).rejects.toThrow(/Saved revision changed/);expect(second.controller.status).toBe('readonly');expect(encode(second.controller.data)).toBe(old);second.controller.close();
 });
 it('does not invent success when committed financial data fails independent validation after maintenance',async()=>{
  const {port,controller:c}=await settled(),before=encode(c.data);port.after=async()=>{port.data!.wallet+=1;};await expect(c.compactSavedHistory()).rejects.toThrow();expect(c.status).toBe('error');expect(c.busy).toBe(false);expect(encode(c.data)).toBe(before);c.close();
 });
 it('uses a named native button, described maintenance effects and persistent spoken-status plumbing',()=>{
  const source=readFileSync('src/ui/app.ts','utf8');expect(source).toContain('<button type="button" id="compact-history-storage"');expect(source).toContain('aria-describedby="storage-maintenance-description"');expect(source).toContain('>Reduce saved-history storage</button>');expect(source).toContain('id="storage-maintenance-notice" role="status" aria-live="polite" tabindex="-1"');expect(source).toContain('const announced=savedPracticeAnnouncement(');expect(source).toContain('End and cash out this table before reducing storage.');
 });
 it('permits a bounded Step5H CI evidence path while rejecting traversal and source-tree destinations',()=>{
  const code="import assert from 'node:assert/strict';import {safeOutput} from './scripts/step5d-ci-plan.mjs';assert.equal(safeOutput('/repo','TEST_EVIDENCE/step5h/release'),'/repo/TEST_EVIDENCE/step5h/release');for(const path of ['src/receipt','TEST_EVIDENCE/step5h/../../../outside','/outside/receipt'])assert.throws(()=>safeOutput('/repo',path));";
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);
 });
});
