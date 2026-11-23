import {getEventListeners} from 'node:events';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {BrowserPersistence} from '../../src/storage/browser';
import {SessionController,DEFAULT_SETTINGS} from '../../src/session/controller';
import {idbReference} from '../step5b-recovery-extensions/idb-reference';
import {validateData} from '../../src/storage/integrity';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('U12 controller and writer lifecycle resources',()=>{
 it('50 complete sessions/reloads retain at most one clock and one lease heartbeat, then release all listeners and timers',async()=>{
  vi.useFakeTimers();vi.stubGlobal('navigator',{});const doc=Object.assign(new EventTarget(),{visibilityState:'hidden'}),win=new EventTarget();vi.stubGlobal('document',doc);vi.stubGlobal('window',win);const reference=idbReference();let maximumTimers=0;
  for(let n=0;n<50;n++){
   const port=new BrowserPersistence('ai-texas-step5b-resource-timers');Object.assign(port,{db:reference.db,owner:`timer-owner-${n}`});await port.takeOver();const c=new SessionController(port);await c.init();expect(c.status).toBe('ready');await c.startSession({...DEFAULT_SETTINGS,seats:2});const g=c.data!.active!.game;await c.act({type:'fold'},g.handId,g.revision);await c.cashOut();expect(c.error).toBe('');expect(c.data!.hands).toHaveLength(n+1);
   await vi.advanceTimersByTimeAsync(15000);maximumTimers=Math.max(maximumTimers,vi.getTimerCount());expect(vi.getTimerCount()).toBe(2);expect(getEventListeners(doc,'visibilitychange')).toHaveLength(1);expect(getEventListeners(win,'pagehide')).toHaveLength(1);expect(getEventListeners(win,'pageshow')).toHaveLength(1);await validateData(c.data!);
   c.close();expect(vi.getTimerCount()).toBe(0);expect(getEventListeners(doc,'visibilitychange')).toHaveLength(0);expect(getEventListeners(win,'pagehide')).toHaveLength(0);expect(getEventListeners(win,'pageshow')).toHaveLength(0);await Promise.resolve();
  }
  expect(maximumTimers).toBe(2);
 });
});
