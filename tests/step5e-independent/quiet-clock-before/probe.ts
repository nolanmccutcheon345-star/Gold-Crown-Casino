import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SessionController,DEFAULT_SETTINGS} from '../../../src/session/controller';
import type {AppData,PersistencePort} from '../../../src/session/types';
class Port implements PersistencePort {
 data:AppData|null=null;gate:Promise<void>|null=null;entered:(()=>void)|null=null;
 async load(){return structuredClone(this.data);}
 async commit(expected:number|null,data:AppData){assert.equal(this.data?.revision??null,expected);this.entered?.();await this.gate;this.data=structuredClone(data);}
 close(){}
}
const port=new Port(),c=new SessionController(port);await c.init();await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);assert.equal(c.data!.active!.game.street,'complete');
const oldId=c.data!.active!.game.handId,oldRevision=c.data!.revision;let publishedBusy=false,publications=0;
c.subscribe(()=>{publishedBusy=c.busy;publications++;});let release!:()=>void;port.gate=new Promise(resolve=>release=resolve);const entered=new Promise<void>(resolve=>port.entered=resolve);
const tick=c.tick();await entered;const during={actualBusy:c.busy,publishedBusy,publications,handId:c.data!.active!.game.handId};
await c.nextHand();const rejected={handId:c.data!.active!.game.handId,error:c.error,revision:c.data!.revision};release();await tick;port.gate=null;port.entered=null;
const afterClock={handId:c.data!.active!.game.handId,revision:c.data!.revision,publishedBusy,publications};await c.nextHand();const afterRetry={handId:c.data!.active!.game.handId,revision:c.data!.revision,street:c.data!.active!.game.street};c.close();
assert.equal(during.actualBusy,true);assert.equal(during.publishedBusy,false);assert.equal(during.publications,0);assert.equal(rejected.handId,oldId);assert.equal(rejected.revision,oldRevision);assert.equal(rejected.error,'');assert.equal(afterClock.handId,oldId);assert.notEqual(afterRetry.handId,oldId);
const report={sourceCheckpoint:'03abe44462b48877f95d722c2efd4ee094ce2206',runtimeSource:'72ee5357f6d2aeac2c03d1c176e4ef3bdc12a913',sourceSHA256:Object.fromEntries(['src/session/controller.ts','src/ui/app.ts'].map(path=>[path,createHash('sha256').update(readFileSync(new URL('../../../'+path,import.meta.url))).digest('hex')])),executedAt:new Date().toISOString(),scope:'Actual production SessionController with held persistence acknowledgement; no DOM or browser claim',during,rejected,afterClock,afterRetry,conclusion:'Confirmed quiet clock busy-start is not published; new-hand request is silently dropped while prior enabled-view state remains unchanged.'};writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
