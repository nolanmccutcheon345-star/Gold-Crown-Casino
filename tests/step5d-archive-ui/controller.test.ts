import {expect,it} from 'vitest';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {AtomicPort} from '../step5d-independent/reference';
class ArchivePort extends AtomicPort {
 readonly recoveryDiagnostics=['A redundant copy was unavailable; the selected record was fully verified.'];
 legacyArchiveAuditStatus:'not-audited'|'verified'|'failed'='not-audited';
 gate:Promise<void>|null=null;failure=false;otherRevision=false;audits=0;
 async auditCanonicalArchive(){this.audits++;await this.gate;if(this.failure){this.legacyArchiveAuditStatus='failed';throw Error('Retained archive is corrupt');}this.legacyArchiveAuditStatus='verified';return{revision:this.data!.revision+(this.otherRevision?1:0),hands:this.data!.hands.length,wallet:this.data!.wallet,status:'verified' as const};}
}
it('runs an independent archive audit without a new financial event, and exposes scoped evidence',async()=>{
 const port=new ArchivePort(),c=new SessionController(port);await c.init();const before=structuredClone(c.data),commits=port.commits;
 expect(c.canAuditArchive).toBe(true);expect(c.archiveAuditStatus).toBe('not-audited');expect(c.recoveryDiagnostics).toEqual(port.recoveryDiagnostics);
 const result=await c.auditSavedArchive();expect(result).toEqual({revision:before!.revision,hands:0,wallet:1000000,status:'verified'});
 expect(c.data).toEqual(before);expect(port.commits).toBe(commits);expect(c.status).toBe('ready');expect(c.archiveAuditStatus).toBe('verified');c.close();
});
it('locks new wallet actions while auditing and publishes the completion unlock',async()=>{
 const port=new ArchivePort(),c=new SessionController(port);await c.init();let release!:()=>void;port.gate=new Promise(resolve=>{release=resolve;});
 const before=structuredClone(c.data),states:boolean[]=[];c.subscribe(()=>states.push(c.busy));const pending=c.auditSavedArchive();
 expect(c.busy).toBe(true);await c.adjustBankroll(5000000,'Must not run while auditing');await c.startSession({...DEFAULT_SETTINGS,seats:2});
 await expect(c.auditSavedArchive()).rejects.toThrow(/Wait until/);expect(port.audits).toBe(1);expect(c.data).toEqual(before);
 release();await pending;expect(states).toEqual([true,false]);expect(c.data).toEqual(before);c.close();
});
it('requires the table to be cashed out, preserving an active hand and pending decisions',async()=>{
 const port=new ArchivePort(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const before=structuredClone(c.data);
 await expect(c.auditSavedArchive()).rejects.toThrow(/End and cash out/);expect(port.audits).toBe(0);expect(c.busy).toBe(false);expect(c.data).toEqual(before);c.close();
});
it('retains the verified current bankroll and records when the redundant archive audit fails',async()=>{
 const port=new ArchivePort(),c=new SessionController(port);await c.init();port.failure=true;const before=structuredClone(c.data);
 await expect(c.auditSavedArchive()).rejects.toThrow(/corrupt/);expect(c.busy).toBe(false);expect(c.status).toBe('ready');expect(c.archiveAuditStatus).toBe('failed');expect(c.data).toEqual(before);c.close();
});
it('does not present an audit of a different revision as agreement with this controller',async()=>{
 const port=new ArchivePort(),c=new SessionController(port);await c.init();port.otherRevision=true;const before=structuredClone(c.data);
 await expect(c.auditSavedArchive()).rejects.toThrow(/revision changed/);expect(c.data).toEqual(before);expect(c.busy).toBe(false);c.close();
});
it('fails explicitly for storage ports that cannot audit rather than inventing a verified result',async()=>{
 const c=new SessionController(new AtomicPort());await c.init();expect(c.canAuditArchive).toBe(false);expect(c.recoveryDiagnostics).toEqual([]);
 await expect(c.auditSavedArchive()).rejects.toThrow(/cannot inspect/);c.close();
});
